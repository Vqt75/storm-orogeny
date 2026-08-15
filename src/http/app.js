import express from 'express';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';

// Application Express — un vrai routeur, jamais une comparaison
// littérale de req.url comme dans Tectonic (server.js). Chaque route
// vit dans son propre module sous src/http/routes/, montée ici.
export function createApp({ logger }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);

  // Les routes de domaine (Phase 0.7 : /api/me, /api/projects, ...)
  // se monteront ici, chacune dans son propre module.

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
