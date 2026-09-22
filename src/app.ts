import express, { Express } from 'express';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import extractRoute from './routes/extract';
import healthRoute from './routes/health';

export function createApp(): Express {
  const app = express();

  // Health check is intentionally unauthenticated so it can be used by
  // uptime monitors / load balancers without a token.
  app.use(healthRoute);

  app.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'medical-ocr-service' });
  });

  app.use(requireAuth);
  app.use(extractRoute);

  // Must be registered last — Express identifies error middleware by arity (4 args).
  app.use(errorHandler);

  return app;
}
