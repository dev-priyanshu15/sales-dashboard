import { HttpError } from '../middleware/errorHandler.js';
import { parseCsvBuffer } from '../utils/csv.js';
import { REQUIRED_FIELDS } from '../validators/rules.js';
import { logger } from '../utils/logger.js';
import type { JobRepository } from '../repositories/jobRepository.js';
import type { TransactionRepository } from '../repositories/transactionRepository.js';
import type { Job } from '../types/index.js';

interface Deps {
  jobRepo: JobRepository;
  txnRepo: TransactionRepository;
  enqueue: (jobId: number) => Promise<void>;
}

export function createJobService({ jobRepo, txnRepo, enqueue }: Deps) {
  return {
    // Upload = persist raw rows + create a pending job.
    // Processing does NOT start here — the user triggers it explicitly
    // (spec: "trigger processing manually after upload").
    // Upload = parse -> header pre-check -> create pending job -> bulk-insert raw rows. No processing yet.
    async createFromUpload(userId: number, filename: string, buffer: Buffer): Promise<Job> {
      const rows = parseCsvBuffer(buffer);
      if (rows.length === 0) throw new HttpError(400, 'CSV contains no data rows');

      // Header pre-check: a file missing whole columns would just
      // produce 100% invalid rows — reject it up front with a message
      // that says exactly what's missing.
      const headers = Object.keys(rows[0]);
      const missing = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
      if (missing.length > 0) {
        throw new HttpError(
          400,
          `This does not look like a sales CSV — missing required column(s): ${missing.join(', ')}`
        );
      }

      const job = await jobRepo.create(userId, filename, rows.length);
      await txnRepo.insertRawRows(job.id, rows);

      logger.info({ jobId: job.id, userId, totalRows: rows.length }, 'upload accepted');
      return job;
    },

    // Ownership check -> push jobId to Redis -> return immediately; the worker process does the rest.
    async startProcessing(jobId: number, userId: number): Promise<void> {
      const job = await jobRepo.findByIdForUser(jobId, userId);
      if (!job) throw new HttpError(404, 'Job not found');
      if (job.status === 'processing') throw new HttpError(409, 'Job is already processing');

      await enqueue(job.id);
      logger.info({ jobId }, 'processing enqueued');
    },

    async getJob(jobId: number, userId: number): Promise<Job> {
      const job = await jobRepo.findByIdForUser(jobId, userId);
      if (!job) throw new HttpError(404, 'Job not found');
      return job;
    },

    async listJobs(userId: number): Promise<Job[]> {
      return jobRepo.listForUser(userId);
    },
  };
}

export type JobService = ReturnType<typeof createJobService>;
