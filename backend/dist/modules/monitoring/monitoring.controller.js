"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringController = void 0;
const monitoring_service_1 = require("./monitoring.service");
const audit_service_1 = require("../audit/audit.service");
const notification_service_1 = require("../notification/notification.service");
const whatsapp_service_1 = require("../whatsapp/whatsapp.service");
const cache_service_1 = require("../cache/cache.service");
class MonitoringController {
    static async getStats(req, res, next) {
        try {
            const stats = await monitoring_service_1.MonitoringService.getDashboardStats(req.user?.role, req.user?.districtId || undefined, req.user?.trainingCentreId || undefined);
            res.json({ success: true, stats });
        }
        catch (error) {
            next(error);
        }
    }
    static async getDelayedBatches(req, res, next) {
        try {
            const delayedBatches = await monitoring_service_1.MonitoringService.checkDelayedBatches();
            res.json({ success: true, delayedBatches });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAuditLogs(req, res, next) {
        try {
            const { entityType, entityId, action, limit } = req.query;
            const logs = await audit_service_1.AuditService.getLogs({
                entityType,
                entityId,
                action,
                limit: limit ? parseInt(limit, 10) : 100,
            });
            res.json({ success: true, logs });
        }
        catch (error) {
            next(error);
        }
    }
    static async getNotifications(req, res, next) {
        try {
            const notifications = await notification_service_1.NotificationService.getNotificationsForUser(req.user.id, req.user.role);
            res.json({ success: true, notifications });
        }
        catch (error) {
            next(error);
        }
    }
    static async markNotificationRead(req, res, next) {
        try {
            const notification = await notification_service_1.NotificationService.markAsRead(req.params.id);
            res.json({ success: true, notification });
        }
        catch (error) {
            next(error);
        }
    }
    static async getWhatsAppLogs(req, res, next) {
        try {
            const { status, limit } = req.query;
            const logs = await whatsapp_service_1.WhatsAppService.getDeliveryLogs({
                status,
                limit: limit ? parseInt(limit, 10) : 100,
            });
            res.json({ success: true, logs });
        }
        catch (error) {
            next(error);
        }
    }
    static async retryWhatsApp(req, res, next) {
        try {
            const log = await whatsapp_service_1.WhatsAppService.retryDelivery(req.params.id);
            res.json({
                success: true,
                log,
                message: `WhatsApp notification re-dispatched to ${log.candidatePhone}. Status: ${log.status}.`,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getPerformanceMetrics(req, res, next) {
        try {
            const cacheDiagnostics = cache_service_1.CacheService.getDiagnostics();
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
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MonitoringController = MonitoringController;
