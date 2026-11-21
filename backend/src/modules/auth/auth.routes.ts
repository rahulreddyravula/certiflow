import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { createRateLimiter } from '../../middleware/rateLimiter.middleware';

const router = Router();

// Protect credential login with sliding-window rate limiting
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 attempts per minute
});

router.post('/login', authLimiter, AuthController.login);
router.post('/demo-login', AuthController.demoLogin);
router.get('/demo-users', AuthController.getDemoUsers);
router.get('/me', authMiddleware, AuthController.me);

export default router;
