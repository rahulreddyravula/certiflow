import { Router } from 'express';
import { VerificationController } from './verification.controller';
import { createRateLimiter } from '../../middleware/rateLimiter.middleware';
import { config } from '../../config';

const router = Router();

// Rate limited public endpoint - no authentication required
const verifyLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: config.publicVerifyRateLimit,
});

router.get('/:certificateNumber', verifyLimiter, VerificationController.verify);

export default router;
