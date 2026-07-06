import { pool } from '../config/db.js';
import type { Job, JobStatus } from '../types/index.js';

function toJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    filename: row.filename as string,
    status: row.status as JobStatus,
    totalRows: row.total_rows as number,
    processedRows: row.processed_rows as number,
    validRows: row.valid_rows as number,
    invalidRows: row.invalid_rows as number,
    duplicateRows: row.duplicate_rows as number,
    errorMessage: (row.error_message as string) ?? null,
    createdAt: row.created_at as Date,
    startedAt: (row.started_at as Date) ?? null,
    finishedAt: (row.finished_at as Date) ?? null,
  };
}

export const jobRepository = {
  async create(userId: number, filename: string, totalRows: number): Promise<Job> {
    const { rows } = await pool.query(
      `INSERT INTO jobs (user_id, filename, total_rows)
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, filename, totalRows]
    );
    return toJob(rows[0]);
  },

  // user_id is part of the WHERE clause everywhere: ownership is
  // enforced at the data layer, not left to controllers to remember.
  async findByIdForUser(jobId: number, userId: number): Promise<Job | null> {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1 AND user_id = $2', [
      jobId,
      userId,
    ]);
    return rows[0] ? toJob(rows[0]) : null;
  },

  async listForUser(userId: number, limit = 20): Promise<Job[]> {
    const { rows } = await pool.query(
      'SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return rows.map(toJob);
  },

  // Used by the worker (no user scoping — workers are trusted).
  async findById(jobId: number): Promise<Job | null> {
    const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    return rows[0] ? toJob(rows[0]) : null;
  },

  async markProcessing(jobId: number): Promise<void> {
    await pool.query(
      `UPDATE jobs SET status = 'processing', started_at = now(), processed_rows = 0 WHERE id = $1`,
      [jobId]
    );
  },

  async updateProgress(jobId: number, processedRows: number): Promise<void> {
    await pool.query('UPDATE jobs SET processed_rows = $2 WHERE id = $1', [jobId, processedRows]);
  },

  async markCompleted(
    jobId: number,
    counts: { valid: number; invalid: number; duplicate: number }
  ): Promise<void> {
    await pool.query(
      `UPDATE jobs
       SET status = 'completed', finished_at = now(),
           processed_rows = total_rows,
           valid_rows = $2, invalid_rows = $3, duplicate_rows = $4
       WHERE id = $1`,
      [jobId, counts.valid, counts.invalid, counts.duplicate]
    );
  },

  // System-wide observability numbers, surfaced on /health (spec bonus: job failure rate).
  async systemMetrics(): Promise<{
    totalJobs: number;
    failedJobs: number;
    jobFailureRate: number;
    avgJobDurationMs: number | null;
  }> {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
              AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)
                FILTER (WHERE status = 'completed') AS avg_ms
       FROM jobs`
    );
    const { total, failed, avg_ms } = rows[0];
    return {
      totalJobs: total,
      failedJobs: failed,
      jobFailureRate: total > 0 ? Math.round((failed / total) * 10000) / 10000 : 0,
      avgJobDurationMs: avg_ms !== null ? Math.round(Number(avg_ms)) : null,
    };
  },

  async markFailed(jobId: number, errorMessage: string): Promise<void> {
    await pool.query(
      `UPDATE jobs SET status = 'failed', finished_at = now(), error_message = $2 WHERE id = $1`,
      [jobId, errorMessage]
    );
  },
};

export type JobRepository = typeof jobRepository;
