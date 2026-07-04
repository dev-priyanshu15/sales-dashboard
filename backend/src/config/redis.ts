import { env } from './env.js';

// Plain connection options — BullMQ creates and manages its own
// ioredis clients from these. maxRetriesPerRequest: null is required
// by BullMQ for its blocking connections.
export const redisConnection = {
  host: env.redisHost,
  port: env.redisPort,
  maxRetriesPerRequest: null as null,
};
