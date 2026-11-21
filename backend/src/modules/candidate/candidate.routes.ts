import { Router } from 'express';
import { CandidateController } from './candidate.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, CandidateController.list);

export default router;
