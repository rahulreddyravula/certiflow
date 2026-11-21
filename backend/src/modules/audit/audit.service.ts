import { prisma } from '../../database';

export interface AuditLogParams {
  userId?: string | null;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: any;
  newState?: any;
  metadata?: any;
}

export class AuditService {
  static async log(params: AuditLogParams, client: any = prisma) {
    try {
      return await client.auditLog.create({
        data: {
          userId: params.userId || null,
          userRole: params.userRole || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          previousState: params.previousState ? JSON.stringify(params.previousState) : null,
          newState: params.newState ? JSON.stringify(params.newState) : null,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  static async getLogs(filter?: { entityType?: string; entityId?: string; action?: string; limit?: number }) {
    const where: any = {};
    if (filter?.entityType) where.entityType = filter.entityType;
    if (filter?.entityId) where.entityId = filter.entityId;
    if (filter?.action) where.action = filter.action;

    return await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filter?.limit || 100,
    });
  }
}
