import type { NextFunction, Request, Response } from 'express';
import type { AuthService } from '../services/authService.js';
import { logger } from '../utils/logger.js';

// Controllers only translate HTTP <-> service calls.
// No business logic lives here.
export function createAuthController(authService: AuthService) {
  return {
    async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { email, password } = req.body ?? {};
        const result = await authService.signup(email, password);
        logger.info({ userId: result.user.id }, 'user signed up');
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },

    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { email, password } = req.body ?? {};
        const result = await authService.login(email, password);
        logger.info({ userId: result.user.id }, 'user logged in');
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
