import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authRateLimiter } from './middleware/rateLimiter.js';
import { pool } from './config/db.js';
import { buildContainer } from './container.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createJobRoutes } from './routes/jobRoutes.js';

export function createApp(): express.Express {
  const app = express();
  const container = buildContainer();

  app.use(express.json());
  app.use(requestLogger);

  // Liveness + DB connectivity check
  app.get('/health', async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'connected' });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/auth', authRateLimiter, createAuthRoutes(container.authController));
  app.use('/api/jobs', createJobRoutes(container.jobController, container.reportController));

  app.use(errorHandler);
  return app;
}
