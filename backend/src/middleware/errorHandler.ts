import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Throw this from anywhere (controller/service) to send a specific
// HTTP status. Anything else becomes a 500.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : 'Internal server error';

  if (statusCode >= 500) {
    logger.error({ err, path: req.path }, 'unhandled error');
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    // Stack traces are a debugging aid, not something to leak in prod.
    ...(env.nodeEnv === 'development' && err.stack ? { stack: err.stack } : {}),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}
