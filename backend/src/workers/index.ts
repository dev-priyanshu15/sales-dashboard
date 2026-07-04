import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { JOB_QUEUE_NAME, type ProcessJobData } from '../queue/jobQueue.js';
import { processJob } from './jobProcessor.js';
import { logger } from '../utils/logger.js';

// Queue consumer process. Run with: npm run worker
// Handles one file-processing job at a time; row-level concurrency
// happens INSIDE processJob via the worker pool.
const worker = new Worker<ProcessJobData>(
  JOB_QUEUE_NAME,
  async (job) => {
    await processJob(job.data.jobId);
  },
  { connection: redisConnection, concurrency: 1 }
);

worker.on('completed', (job) => logger.info({ jobId: job.data.jobId }, 'queue job completed'));
worker.on('failed', (job, err) =>
  logger.error({ jobId: job?.data.jobId, err: err.message }, 'queue job failed')
);

logger.info('worker started, waiting for jobs');
