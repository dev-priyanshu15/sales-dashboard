import { HttpError } from '../middleware/errorHandler.js';
import { REQUIRED_FIELDS } from '../validators/rules.js';
import { logger } from '../utils/logger.js';
import type { JobRepository } from '../repositories/jobRepository.js';
import type { ReportMetrics, ReportRepository } from '../repositories/reportRepository.js';
import type { TransactionRepository } from '../repositories/transactionRepository.js';

interface Deps {
  jobRepo: JobRepository;
  reportRepo: ReportRepository;
  txnRepo: TransactionRepository;
}

export function createReportService({ jobRepo, reportRepo, txnRepo }: Deps) {
  async function assertCompletedJob(jobId: number, userId: number) {
    const job = await jobRepo.findByIdForUser(jobId, userId);
    if (!job) throw new HttpError(404, 'Job not found');
    if (job.status !== 'completed') {
      throw new HttpError(409, `Job is ${job.status}; report available once completed`);
    }
    return job;
  }

  return {
    // Re-run aggregation on demand (spec requirement).
    async runAggregation(jobId: number, userId: number): Promise<ReportMetrics> {
      await assertCompletedJob(jobId, userId);
      const metrics = await reportRepo.computeMetrics(jobId);
      await reportRepo.saveReport(jobId, metrics);
      logger.info({ jobId }, 'aggregation re-computed');
      return metrics;
    },

    async getReport(jobId: number, userId: number): Promise<ReportMetrics> {
      await assertCompletedJob(jobId, userId);
      const existing = await reportRepo.latestForJob(jobId);
      if (existing) return existing.metrics;
      // No stored report yet (e.g. job predates aggregation) — compute one.
      const metrics = await reportRepo.computeMetrics(jobId);
      await reportRepo.saveReport(jobId, metrics);
      return metrics;
    },

    // Annotated results CSV: original columns + status, net_amount, errors.
    async exportCsv(jobId: number, userId: number): Promise<string> {
      await assertCompletedJob(jobId, userId);
      const rows = await txnRepo.fetchAllForExport(jobId);

      const header = [...REQUIRED_FIELDS, 'validation_status', 'net_amount', 'errors'];
      const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

      const lines = rows.map((row) => {
        const cells = REQUIRED_FIELDS.map((f) => escape(row.raw[f] ?? ''));
        cells.push(row.status, row.netAmount?.toString() ?? '', escape(row.errors?.join('; ') ?? ''));
        return cells.join(',');
      });

      return [header.join(','), ...lines].join('\n');
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
