import express from 'express';
import { errorHandler, HttpError } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authRateLimiter } from './middleware/rateLimiter.js';
import { pool } from './config/db.js';
import { jobRepository } from './repositories/jobRepository.js';
import { buildContainer } from './container.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createJobRoutes } from './routes/jobRoutes.js';
import { sendSuccess } from './utils/response.js';

export function createApp(): express.Express {
  const app = express();
  const container = buildContainer();

  app.use(express.json());
  app.use(requestLogger);

  // Liveness + DB connectivity + system metrics (job failure rate, avg duration)
  app.get('/health', async (req, res, next) => {
    try {
      await pool.query('SELECT 1');
      const metrics = await jobRepository.systemMetrics();
      sendSuccess(req, res, { status: 'ok', db: 'connected', metrics });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/auth', authRateLimiter, createAuthRoutes(container.authController));
  app.use('/api/jobs', createJobRoutes(container.jobController, container.reportController));

  // Unknown routes get the same error envelope as everything else.
  app.use((req, _res, next) => next(new HttpError(404, `Route not found: ${req.method} ${req.path}`)));

  app.use(errorHandler);
  return app;
}
