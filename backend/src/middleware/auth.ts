import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './errorHandler.js';
import type { AuthTokenPayload } from '../types/index.js';

// Make req.user available (and typed) on authenticated routes.
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

// Verifies "Authorization: Bearer <token>" and attaches req.user.
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Missing or malformed Authorization header'));
    return;
  }

  try {
    req.user = jwt.verify(header.slice('Bearer '.length), env.jwtSecret) as AuthTokenPayload;
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

// Role guard for admin-only routes. Use AFTER requireAuth.
export function requireRole(role: 'admin') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      next(new HttpError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}
