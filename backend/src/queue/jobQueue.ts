import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const JOB_QUEUE_NAME = 'sales-jobs';

export interface ProcessJobData {
  jobId: number;
}

// Producer side of the queue: the API enqueues, the worker consumes.
export const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,                                   // retry failed jobs
    backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export async function enqueueProcessing(jobId: number): Promise<void> {
  await jobQueue.add('process', { jobId });
}
