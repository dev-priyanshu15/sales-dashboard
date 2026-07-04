import { Pool } from 'pg';
import { env } from './env.js';

// Single shared connection pool for the whole app.
// pg manages up to `max` connections; queries queue when all are busy.
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
});

export async function closePool(): Promise<void> {
  await pool.end();
}
