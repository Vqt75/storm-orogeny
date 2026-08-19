import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { healthRouter } from './routes/health.js';
import { createMeRouter } from './routes/me.js';
import { createProjectsRouter } from './routes/projects.js';
import { createAssetsRouter } from './routes/assets.js';
import { createControlRouter } from './routes/control.js';
import { createStudioRouter } from './routes/studio.js';
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

  // Project Shell — même principe. Enregistrée après /projects/new
  // (Express matche par ordre d'enregistrement) : /projects/new reste
  // toujours capté par la route exacte ci-dessus, jamais par ce
  // paramètre générique. UUID validé pour ne jamais confondre avec un
  // futur segment littéral. GET /api/projects/:id/context protégé par
  // devAuth + requireProjectCapability côté client.
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  app.get('/projects/:projectId', (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'project-shell.html'));
  });

  // Studio — vertical slice Questions (Phase 2B). Même principe que
  // le reste : page statique publique, les vraies données/écritures
  // passent par /api/projects/:id/studio/*, protégées par devAuth +
  // requireProjectCapability côté client.
  app.get('/projects/:projectId/studio', (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'studio-questions.html'));
  });

  // Studio — vertical slice Actualités (Phase 2B). Chemin distinct de
  // Questions (/studio/news, pas /studio) : ces vertical slices sont
  // encore des pages indépendantes en attendant leur fusion dans un
  // vrai Studio unifié, elles ne peuvent pas partager la même URL.
  app.get('/projects/:projectId/studio/news', (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'studio-actualites.html'));
  });

  // Studio — vertical slice Espaces (Phase 2B). Même principe.
  app.get('/projects/:projectId/studio/spaces', (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'studio-espaces.html'));
  });

  // Studio — vertical slice Ambassadeurs (Phase 2B). Même principe.
  app.get('/projects/:projectId/studio/ambassadors', (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'studio-ambassadeurs.html'));
  });

  // Studio — vertical slice Homepage (Phase 2B). Même principe.
  app.get('/projects/:projectId/studio/homepage', (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next();
      return;
    }
    res.sendFile(path.join(PUBLIC_DIR, 'studio-homepage.html'));
  });

  // Storm Control — même principe. GET /api/control/* protégé par
  // devAuth + capabilities organisationnelles côté serveur (jamais
  // seulement masqué côté front).
  app.get('/control', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'control.html'));
  });

  // Fichiers statiques (CSS/JS des pages ci-dessus, polices) — jamais
  // de donnée sensible dans public/, uniquement de l'interface.
  app.use(express.static(PUBLIC_DIR));

  // Toute route de domaine passe par devAuth — AuthN uniquement (qui
  // es-tu ?), jamais d'autorisation ici (voir devAuth.js). Scopé
  // explicitement à /api/* : /health et toute route inconnue ne
  // doivent jamais passer par l'authentification.
  const authenticated = devAuth({ pool, config });
  app.use('/api/me', authenticated, createMeRouter({ pool }));
  app.use('/api/projects', authenticated, createProjectsRouter({ pool, storageAdapter }));
  app.use('/api/projects', authenticated, createStudioRouter({ pool, storageAdapter }));
  app.use('/api/assets', authenticated, createAssetsRouter({ pool, storageAdapter }));
  app.use('/api/control', authenticated, createControlRouter({ pool }));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
