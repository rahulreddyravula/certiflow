import { Request, Response, NextFunction } from 'express';
import { VerificationService } from './verification.service';

export class VerificationController {
  static async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const { certificateNumber } = req.params;
      if (!certificateNumber) {
        res.status(400).json({ success: false, error: 'Certificate identifier is required.' });
        return;
      }

      const result = await VerificationService.verifyCertificate(certificateNumber);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
