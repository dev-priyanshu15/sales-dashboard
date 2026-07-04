import pino from 'pino';
import { env } from '../config/env.js';

// Structured JSON logs in production; pretty-printed in development.
// Use logger.child({ jobId }) to attach a correlation ID to every
// log line emitted while processing a job.
export const logger = pino({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  transport:
    env.nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
