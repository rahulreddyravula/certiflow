import { Request, Response, NextFunction } from 'express';
import { CandidateService } from './candidate.service';

export class CandidateController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, assessmentStatus, batchId, limit, offset } = req.query as {
        search?: string;
        assessmentStatus?: string;
        batchId?: string;
        limit?: string;
        offset?: string;
      };

      const result = await CandidateService.getCandidates({
        search,
        assessmentStatus,
        batchId,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
