import { env } from '../config/env.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { reportRepository } from '../repositories/reportRepository.js';
import { validateRow } from '../validators/rowValidator.js';
import { computeNetAmount } from '../services/pricing.js';
import { runWithConcurrency, sleep } from '../utils/concurrency.js';
import { logger } from '../utils/logger.js';

// Processes one uploaded file end-to-end:
//   1. mark job processing
//   2. flag duplicate transaction_ids (single SQL pass)
//   3. validate + compute remaining rows CONCURRENTLY (worker pool)
//   4. write final counts and mark completed
// Row-level failures NEVER throw — they become 'invalid' rows.
// Only infrastructure errors (DB down) fail the job itself.
export async function processJob(jobId: number): Promise<void> {
  const log = logger.child({ jobId }); // correlation ID on every line
  const startedAt = Date.now();

  try {
    await jobRepository.markProcessing(jobId);
    log.info('job started');

    const duplicates = await transactionRepository.markDuplicates(jobId);
    log.info({ duplicates }, 'duplicate pass complete');

    const pending = await transactionRepository.fetchPendingRows(jobId);
    let processed = duplicates; // duplicates count as handled rows

    // Row results are buffered and flushed in batches: 50 rows = 1
    // UPDATE per outcome + 1 progress write, instead of 50 UPDATEs.
    const FLUSH_EVERY = 50;
    let validBuffer: Parameters<typeof transactionRepository.markValidBatch>[0] = [];
    let invalidBuffer: Parameters<typeof transactionRepository.markInvalidBatch>[0] = [];

    async function flush(): Promise<void> {
      // Snapshot-and-clear synchronously (no await in between), so rows
      // pushed by other pool workers mid-flush land in the NEXT flush.
      const valid = validBuffer;
      const invalid = invalidBuffer;
      validBuffer = [];
      invalidBuffer = [];
      await Promise.all([
        transactionRepository.markValidBatch(valid),
        transactionRepository.markInvalidBatch(invalid),
        jobRepository.updateProgress(jobId, processed),
      ]);
    }

    await runWithConcurrency(pending, env.workerConcurrency, async (row) => {
      // Simulated per-row cost — this is WHY the pool exists:
      // 10k rows x 25ms sequentially = ~4 minutes; with 10 workers = ~25s.
      await sleep(env.rowProcessingDelayMs);

      const result = validateRow(row.raw);
      if (result.ok) {
        const net = computeNetAmount(
          result.row.quantity,
          result.row.unitPrice,
          result.row.discountPercent
        );
        validBuffer.push({ id: row.id, row: result.row, netAmount: net });
      } else {
        invalidBuffer.push({ id: row.id, errors: result.errors });
        log.warn({ rowNumber: row.rowNumber, errors: result.errors }, 'row invalid');
      }

      processed += 1;
      if (processed % FLUSH_EVERY === 0) {
        await flush();
      }
    });

    await flush(); // remaining rows after the last full batch

    const counts = await transactionRepository.countByStatus(jobId);
    await jobRepository.markCompleted(jobId, {
      valid: counts.valid,
      invalid: counts.invalid,
      duplicate: counts.duplicate,
    });

    // Aggregate metrics are computed as soon as rows are done, so the
    // dashboard has a report the moment the job flips to completed.
    const metrics = await reportRepository.computeMetrics(jobId);
    await reportRepository.saveReport(jobId, metrics);
    log.info('aggregate report stored');

    log.info(
      { durationMs: Date.now() - startedAt, ...counts },
      'job completed'
    );
  } catch (err) {
    log.error(err, 'job failed');
    await jobRepository.markFailed(jobId, (err as Error).message);
    throw err; // rethrow so BullMQ counts the attempt and can retry
  }
}
