import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { UserRepository } from '../repositories/userRepository.js';
import type { AuthTokenPayload } from '../types/index.js';

// bcrypt cost 10 = 2^10 internal rounds per hash — slow enough to make brute-forcing stolen hashes impractical.
const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthResult {
  token: string;
  user: { id: number; email: string; role: string };
}

// Business rules for signup/login. Receives its repository as a
// dependency (Dependency Inversion) so it can be tested with a fake.
export function createAuthService({ userRepo }: { userRepo: UserRepository }) {
  // Signs {userId, email, role} into a JWT — the server stores nothing, it verifies the signature per request.
  function issueToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  return {
    async signup(email: string, password: string): Promise<AuthResult> {
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email address');
      if (!password || password.length < 8) {
        throw new HttpError(400, 'Password must be at least 8 characters');
      }
      if (await userRepo.findByEmail(email)) {
        throw new HttpError(409, 'An account with this email already exists');
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await userRepo.create(email, passwordHash);

      const token = issueToken({ userId: user.id, email: user.email, role: user.role });
      return { token, user: { id: user.id, email: user.email, role: user.role } };
    },

    async login(email: string, password: string): Promise<AuthResult> {
      const user = await userRepo.findByEmail(email);
      // Same error for "no such user" and "wrong password" so an
      // attacker can't probe which emails are registered.
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new HttpError(401, 'Invalid email or password');
      }

      const token = issueToken({ userId: user.id, email: user.email, role: user.role });
      return { token, user: { id: user.id, email: user.email, role: user.role } };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
