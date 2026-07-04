import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

// 429 responses use the same envelope as the error handler.
function limitHandler(message: string) {
  return (req: Request, res: Response): void => {
    res.status(429).json({
      success: false,
      statusCode: 429,
      message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  };
}

// Uploads are the expensive endpoint — cap them per client.
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler('Too many uploads, try again in a few minutes'),
});

// Slow brute-force attempts on login/signup.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler('Too many attempts, try again later'),
});
