import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import type { JobService } from '../services/jobService.js';

export function createJobController(jobService: JobService) {
  return {
    async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        if (!req.file) throw new HttpError(400, 'No file uploaded (field name must be "file")');
        const job = await jobService.createFromUpload(
          req.user!.userId,
          req.file.originalname,
          req.file.buffer
        );
        res.status(201).json(job);
      } catch (err) {
        next(err);
      }
    },

    async process(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        await jobService.startProcessing(Number(req.params.id), req.user!.userId);
        res.status(202).json({ message: 'Processing started' });
      } catch (err) {
        next(err);
      }
    },

    async get(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        res.json(await jobService.getJob(Number(req.params.id), req.user!.userId));
      } catch (err) {
        next(err);
      }
    },

    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        res.json(await jobService.listJobs(req.user!.userId));
      } catch (err) {
        next(err);
      }
    },
  };
}

export type JobController = ReturnType<typeof createJobController>;
