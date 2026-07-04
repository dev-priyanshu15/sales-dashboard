import rateLimit from 'express-rate-limit';

// Uploads are the expensive endpoint — cap them per client.
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, try again in a few minutes' },
});

// Slow brute-force attempts on login/signup.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});
