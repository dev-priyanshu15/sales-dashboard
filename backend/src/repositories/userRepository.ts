import { pool } from '../config/db.js';
import type { Role, User } from '../types/index.js';

// The ONLY place that runs SQL against the users table.

function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    role: row.role as Role,
  };
}

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async create(email: string, passwordHash: string, role: Role = 'user'): Promise<User> {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, passwordHash, role]
    );
    return toUser(rows[0]);
  },
};

export type UserRepository = typeof userRepository;
