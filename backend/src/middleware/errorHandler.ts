import type { NextFunction, Request, Response } from 'express';
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
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  logger.error({ err, path: req.path }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
