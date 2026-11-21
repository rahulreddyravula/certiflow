import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { BatchService } from './batch.service';
import { ApprovalService } from '../approval/approval.service';
import { prisma } from '../../database';

const createBatchSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  courseName: z.string().min(1, 'Course name is required').trim(),
  districtId: z.string().optional(),
  trainingCentreId: z.string().optional(),
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN']),
  comments: z.string().optional(),
});

const resubmitSchema = z.object({
  notes: z.string().optional(),
});

export class BatchController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createBatchSchema.parse(req.body);
      const user = req.user!;

      let districtId = data.districtId || user.districtId;
      let trainingCentreId = data.trainingCentreId || user.trainingCentreId;

      // If missing from token, fallback to fetching from DB for this user
      if (!trainingCentreId || !districtId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { district: true, trainingCentre: true },
        });
        if (dbUser) {
          districtId = districtId || dbUser.districtId || dbUser.district?.id;
          trainingCentreId = trainingCentreId || dbUser.trainingCentreId || dbUser.trainingCentre?.id;
        }
      }

      // If training centre is known, guarantee districtId from the training centre
      if (!districtId && trainingCentreId) {
        const tc = await prisma.trainingCentre.findUnique({ where: { id: trainingCentreId } });
        if (tc) districtId = tc.districtId;
      }

      if (!trainingCentreId) {
        return res.status(400).json({ success: false, error: 'A Training Centre association is required to create a batch.' });
      }
      if (!districtId) {
        return res.status(400).json({ success: false, error: 'A District association is required to create a batch.' });
      }

      const batch = await BatchService.createBatch(
        {
          title: data.title,
          courseName: data.courseName,
          districtId,
          trainingCentreId,
        },
        user
      );
      res.status(201).json({ success: true, batch });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, limit } = req.query as { status?: string; search?: string; limit?: string };
      const batches = await BatchService.getBatches(req.user!, {
        status,
        search,
        limit: limit ? parseInt(limit, 10) : 100,
      });
      res.json({ success: true, batches });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await BatchService.getBatchById(req.params.id);
      res.json({ success: true, batch });
    } catch (error) {
      next(error);
    }
  }

  static async uploadCsv(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No CSV or Excel spreadsheet file provided.' });
        return;
      }

      let csvContent = '';
      const lowerName = req.file.originalname.toLowerCase();
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        csvContent = XLSX.utils.sheet_to_csv(sheet);
      } else {
        csvContent = req.file.buffer.toString('utf-8');
      }

      const result = await BatchService.uploadCandidatesCsv(
        req.params.id,
        csvContent,
        req.file.originalname,
        req.user!
      );

      if (!result.isValid) {
        res.status(422).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await BatchService.submitBatch(req.params.id, req.user!);
      res.json({ success: true, batch, message: 'Batch successfully submitted for district approval.' });
    } catch (error) {
      next(error);
    }
  }

  static async districtDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const data = decisionSchema.parse(req.body);
      const result = await ApprovalService.recordDistrictDecision({
        batchId: req.params.id,
        decision: data.decision,
        comments: data.comments,
        user: req.user!,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async qualityDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const data = decisionSchema.parse(req.body);
      const batch = await ApprovalService.recordQualityDecision({
        batchId: req.params.id,
        decision: data.decision,
        comments: data.comments,
        user: req.user!,
      });
      res.json({ success: true, batch });
    } catch (error) {
      next(error);
    }
  }

  static async stateDecision(req: Request, res: Response, next: NextFunction) {
    try {
      const data = decisionSchema.parse(req.body);
      const batch = await ApprovalService.recordStateDecision({
        batchId: req.params.id,
        decision: data.decision,
        comments: data.comments,
        user: req.user!,
      });
      res.json({ success: true, batch });
    } catch (error) {
      next(error);
    }
  }

  static async resubmit(req: Request, res: Response, next: NextFunction) {
    try {
      const data = resubmitSchema.parse(req.body);
      const batch = await ApprovalService.resubmitReturnedBatch(req.params.id, req.user!, data.notes);
      res.json({ success: true, batch, message: 'Batch resubmitted for fresh district approval.' });
    } catch (error) {
      next(error);
    }
  }
}
