import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from './monitoring.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CacheService } from '../cache/cache.service';

export class MonitoringController {
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await MonitoringService.getDashboardStats(
        req.user?.role,
        req.user?.districtId || undefined,
        req.user?.trainingCentreId || undefined
      );
      res.json({ success: true, stats });
    } catch (error) {
      next(error);
    }
  }

  static async getDelayedBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const delayedBatches = await MonitoringService.checkDelayedBatches();
      res.json({ success: true, delayedBatches });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { entityType, entityId, action, limit } = req.query as {
        entityType?: string;
        entityId?: string;
        action?: string;
        limit?: string;
      };

      const logs = await AuditService.getLogs({
        entityType,
        entityId,
        action,
        limit: limit ? parseInt(limit, 10) : 100,
      });

      res.json({ success: true, logs });
    } catch (error) {
      next(error);
    }
  }

  static async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const notifications = await NotificationService.getNotificationsForUser(
        req.user!.id,
        req.user!.role
      );
      res.json({ success: true, notifications });
    } catch (error) {
      next(error);
    }
  }

  static async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      const notification = await NotificationService.markAsRead(req.params.id);
      res.json({ success: true, notification });
    } catch (error) {
      next(error);
    }
  }

  static async getWhatsAppLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, limit } = req.query as { status?: string; limit?: string };
      const logs = await WhatsAppService.getDeliveryLogs({
        status,
        limit: limit ? parseInt(limit, 10) : 100,
      });
      res.json({ success: true, logs });
    } catch (error) {
      next(error);
    }
  }

  static async retryWhatsApp(req: Request, res: Response, next: NextFunction) {
    try {
      const log = await WhatsAppService.retryDelivery(req.params.id);
      res.json({
        success: true,
        log,
        message: `WhatsApp notification re-dispatched to ${log.candidatePhone}. Status: ${log.status}.`,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPerformanceMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const cacheDiagnostics = CacheService.getDiagnostics();
      const mem = process.memoryUsage();
      res.json({
        success: true,
        metrics: {
          cache: cacheDiagnostics,
          memory: {
            heapUsedMb: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
            heapTotalMb: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2)),
            rssMb: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
          },
          uptimeSeconds: Math.round(process.uptime()),
          nodeVersion: process.version,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
