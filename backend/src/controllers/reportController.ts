import type { NextFunction, Request, Response } from 'express';
import type { ReportService } from '../services/reportService.js';

export function createReportController(reportService: ReportService) {
  return {
    async get(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        res.json(await reportService.getReport(Number(req.params.id), req.user!.userId));
      } catch (err) {
        next(err);
      }
    },

    async aggregate(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        res.json(await reportService.runAggregation(Number(req.params.id), req.user!.userId));
      } catch (err) {
        next(err);
      }
    },

    async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const csv = await reportService.exportCsv(Number(req.params.id), req.user!.userId);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="job-${req.params.id}-results.csv"`);
        res.send(csv);
      } catch (err) {
        next(err);
      }
    },
  };
}

export type ReportController = ReturnType<typeof createReportController>;
