import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.js';
import type { JobController } from '../controllers/jobController.js';
import type { ReportController } from '../controllers/reportController.js';

// Files are held in memory (buffer) — fine for CSV sizes in scope
// (10k rows ≈ a few MB). 20MB cap rejects absurd uploads early.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export function createJobRoutes(
  controller: JobController,
  reports: ReportController
): Router {
  const router = Router();

  router.use(requireAuth); // every job route requires a logged-in user

  router.post('/upload', uploadRateLimiter, upload.single('file'), controller.upload);//4 cheez auth,ratelimit,multer,controller 1 req pe
  router.post('/:id/process', controller.process);
  router.get('/', controller.list);
  router.get('/:id', controller.get);

  router.get('/:id/report', reports.get);
  router.post('/:id/aggregate', reports.aggregate);
  router.get('/:id/export', reports.exportCsv);

  return router;
}
