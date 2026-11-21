import { prisma } from '../../database';
import { EventService } from '../events/event.service';

export interface CreateNotificationParams {
  userId?: string | null;
  roleTarget?: string | null;
  title: string;
  message: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  link?: string;
}

export class NotificationService {
  static async send(params: CreateNotificationParams, client: any = prisma) {
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
      EventService.broadcast('notification.new', {
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
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  static async getNotificationsForUser(userId: string, role: string) {
    return await prisma.notification.findMany({
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

  static async markAsRead(notificationId: string) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }
}
