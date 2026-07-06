// URL -> controller mapping for auth. Public routes — no requireAuth, the token is created here.
import { Router } from 'express';
import type { AuthController } from '../controllers/authController.js';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();
  router.post('/signup', controller.signup);
  router.post('/login', controller.login);
  return router;
}
