import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'fs';
import { CertificateService } from './certificate.service';

const cancelSchema = z.object({
  reason: z.string().min(5, 'Cancellation reason must be at least 5 characters'),
});

export class CertificateController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId, search, status, limit } = req.query as {
        batchId?: string;
        search?: string;
        status?: string;
        limit?: string;
      };
      const certificates = await CertificateService.getCertificates({
        batchId,
        search,
        status,
        limit: limit ? parseInt(limit, 10) : 100,
      });
      res.json({ success: true, certificates });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const certificate = await CertificateService.getCertificateById(req.params.id);
      res.json({ success: true, certificate });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const data = cancelSchema.parse(req.body);
      const certificate = await CertificateService.cancelCertificate(req.params.id, data.reason, req.user!);
      res.json({
        success: true,
        certificate,
        message: `Certificate ${certificate.certificateNumber} has been officially cancelled.`,
      });
    } catch (error) {
      next(error);
    }
  }

  static async downloadPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const filePath = await CertificateService.getPdfFilePath(req.params.certificateNumber);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.certificateNumber}.pdf"`);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}
