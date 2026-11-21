import { Router } from 'express';
import { BatchController } from './batch.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { uploadCsv } from '../../middleware/upload.middleware';

const router = Router();

// List & Get Details
router.get('/', authMiddleware, BatchController.list);
router.get('/:id', authMiddleware, BatchController.getById);

// Training Centre actions
router.post('/', authMiddleware, requireRole(['TRAINING_CENTRE']), BatchController.create);
router.post('/:id/upload-csv', authMiddleware, requireRole(['TRAINING_CENTRE']), uploadCsv.single('file'), BatchController.uploadCsv);
router.post('/:id/submit', authMiddleware, requireRole(['TRAINING_CENTRE']), BatchController.submit);
router.post('/:id/resubmit', authMiddleware, requireRole(['TRAINING_CENTRE']), BatchController.resubmit);

// Approval actions
router.post('/:id/district-decision', authMiddleware, requireRole(['DISTRICT_OFFICER', 'STATE_OFFICE']), BatchController.districtDecision);
router.post('/:id/quality-decision', authMiddleware, requireRole(['QUALITY_TEAM', 'STATE_OFFICE']), BatchController.qualityDecision);
router.post('/:id/state-decision', authMiddleware, requireRole(['STATE_OFFICE']), BatchController.stateDecision);

export default router;
