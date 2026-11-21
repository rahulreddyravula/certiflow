import { Router } from 'express';
import { CertificateController } from './certificate.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();

router.get('/', authMiddleware, CertificateController.list);
router.get('/:id', authMiddleware, CertificateController.getById);
router.get('/:certificateNumber/download', CertificateController.downloadPdf);
router.post('/:id/cancel', authMiddleware, requireRole(['STATE_OFFICE']), CertificateController.cancel);

export default router;
