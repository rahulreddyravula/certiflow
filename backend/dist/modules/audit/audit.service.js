"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const database_1 = require("../../database");
class AuditService {
    static async log(params, client = database_1.prisma) {
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
        }
        catch (error) {
            console.error('Failed to write audit log:', error);
        }
    }
    static async getLogs(filter) {
        const where = {};
        if (filter?.entityType)
            where.entityType = filter.entityType;
        if (filter?.entityId)
            where.entityId = filter.entityId;
        if (filter?.action)
            where.action = filter.action;
        return await database_1.prisma.auditLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: filter?.limit || 100,
        });
    }
}
exports.AuditService = AuditService;
