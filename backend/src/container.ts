import { userRepository } from './repositories/userRepository.js';
import { jobRepository } from './repositories/jobRepository.js';
import { transactionRepository } from './repositories/transactionRepository.js';
import { createAuthService } from './services/authService.js';
import { createJobService } from './services/jobService.js';
import { reportRepository } from './repositories/reportRepository.js';
import { createReportService } from './services/reportService.js';
import { createAuthController } from './controllers/authController.js';
import { createJobController } from './controllers/jobController.js';
import { createReportController } from './controllers/reportController.js';
import { enqueueProcessing } from './queue/jobQueue.js';

// Composition root: the ONLY place that knows how the layers fit
// together. Everything else receives its dependencies.
export function buildContainer() {
  const authService = createAuthService({ userRepo: userRepository });
  const authController = createAuthController(authService);

  const jobService = createJobService({
    jobRepo: jobRepository,
    txnRepo: transactionRepository,
    enqueue: enqueueProcessing,
  });
  const jobController = createJobController(jobService);

  const reportService = createReportService({
    jobRepo: jobRepository,
    reportRepo: reportRepository,
    txnRepo: transactionRepository,
  });
  const reportController = createReportController(reportService);

  return {
    authController,
    jobController,
    reportController,
  };
}

export type Container = ReturnType<typeof buildContainer>;
