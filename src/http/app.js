import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { healthRouter } from './routes/health.js';
import { createMeRouter } from './routes/me.js';
import { createProjectsRouter } from './routes/projects.js';
import { createAssetsRouter } from './routes/assets.js';
import { devAuth } from './middleware/devAuth.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// Application Express — un vrai routeur, jamais une comparaison
// littérale de req.url comme dans Tectonic (server.js). Chaque route
// vit dans son propre module sous src/http/routes/, montée ici.
export function createApp({ logger, pool, config, storageAdapter }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);

  // Storm Home — page statique publique. Les vraies données arrivent
  // via /api/me et /api/projects, appelés côté client et protégés par
  // devAuth ; la page elle-même ne porte aucune donnée sensible.
  app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'home.html'));
  });

  // Project Setup — même principe : page statique publique, les
  // écritures réelles (POST /api/projects, upload de logo) restent
  // protégées par devAuth côté client.
  app.get('/projects/new', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'project-setup.html'));
  });

  // Fichiers statiques (CSS/JS des pages ci-dessus) — jamais de donnée
  // sensible dans public/, uniquement de l'interface.
  app.use(express.static(PUBLIC_DIR));

  // Toute route de domaine passe par devAuth — AuthN uniquement (qui
  // es-tu ?), jamais d'autorisation ici (voir devAuth.js). Scopé
  // explicitement à /api/* : /health et toute route inconnue ne
  // doivent jamais passer par l'authentification.
  const authenticated = devAuth({ pool, config });
  app.use('/api/me', authenticated, createMeRouter({ pool }));
  app.use('/api/projects', authenticated, createProjectsRouter({ pool, storageAdapter }));
  app.use('/api/assets', authenticated, createAssetsRouter({ pool, storageAdapter }));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
