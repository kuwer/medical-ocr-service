import express, { Express } from 'express';
import path from 'path';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import extractRoute from './routes/extract';
import healthRoute from './routes/health';
import webExtractRoute from './routes/webExtract';
import { env } from './config/env';

export function createApp(): Express {
  const app = express();

  // Health check is intentionally unauthenticated so it can be used by
  // uptime monitors / load balancers without a token.
  app.use(healthRoute);

  app.use(express.static(path.join(__dirname, '../public')));

  if (env.publicWebApp) {
    app.use(webExtractRoute);
  }

  app.use(requireAuth);
  app.use(extractRoute);

  // Must be registered last — Express identifies error middleware by arity (4 args).
  app.use(errorHandler);

  return app;
}
