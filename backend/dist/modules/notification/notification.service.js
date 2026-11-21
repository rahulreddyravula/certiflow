"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const database_1 = require("../../database");
const event_service_1 = require("../events/event.service");
class NotificationService {
    static async send(params, client = database_1.prisma) {
        try {
            const notification = await client.notification.create({
                data: {
                    userId: params.userId || null,
                    roleTarget: params.roleTarget || null,
                    title: params.title,
                    message: params.message,
                    type: params.type || 'INFO',
                    link: params.link || null,
                },
            });
            // Broadcast real-time SSE notification
            event_service_1.EventService.broadcast('notification.new', {
                id: notification.id,
                userId: notification.userId,
                roleTarget: notification.roleTarget,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                link: notification.link,
                createdAt: notification.createdAt,
            });
            return notification;
        }
        catch (error) {
            console.error('Failed to create notification:', error);
        }
    }
    static async getNotificationsForUser(userId, role) {
        return await database_1.prisma.notification.findMany({
            where: {
                OR: [
                    { userId },
                    { roleTarget: role },
                    { AND: [{ userId: null }, { roleTarget: null }] },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    static async markAsRead(notificationId) {
        return await database_1.prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
    }
}
exports.NotificationService = NotificationService;
