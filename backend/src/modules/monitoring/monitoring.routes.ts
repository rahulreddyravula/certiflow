import { Router } from 'express';
import { MonitoringController } from './monitoring.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.get('/dashboard-stats', authMiddleware, MonitoringController.getStats);
router.get('/delayed-batches', authMiddleware, MonitoringController.getDelayedBatches);
router.get('/audit-logs', authMiddleware, MonitoringController.getAuditLogs);
router.get('/notifications', authMiddleware, MonitoringController.getNotifications);
router.patch('/notifications/:id/read', authMiddleware, MonitoringController.markNotificationRead);
router.get('/whatsapp-logs', authMiddleware, MonitoringController.getWhatsAppLogs);
router.post('/whatsapp-logs/:id/retry', authMiddleware, MonitoringController.retryWhatsApp);
router.get('/performance', authMiddleware, MonitoringController.getPerformanceMetrics);

export default router;
