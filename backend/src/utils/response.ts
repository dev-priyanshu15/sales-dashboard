import type { Request, Response } from 'express';

// Every JSON response goes through this envelope, so clients can rely
// on one shape: { success, statusCode, data | message, timestamp, path }.
export function sendSuccess(req: Request, res: Response, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    statusCode,
    data,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}
