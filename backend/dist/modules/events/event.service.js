"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventService = void 0;
const database_1 = require("../../database");
class EventService {
    static sseClients = [];
    // Register an SSE client
    static addClient(client) {
        this.sseClients.push(client);
    }
    // Remove an SSE client
    static removeClient(clientId) {
        this.sseClients = this.sseClients.filter((c) => c.id !== clientId);
    }
    // Broadcast an SSE event to connected browsers
    static broadcast(eventName, data, targetRole, targetUserId) {
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        this.sseClients.forEach((client) => {
            // If target user is specified, send only to them
            if (targetUserId && client.userId !== targetUserId)
                return;
            // If target role is specified, send only to that role (or state office which sees everything)
            if (targetRole && client.role !== targetRole && client.role !== 'STATE_OFFICE')
                return;
            try {
                client.res.write(payload);
            }
            catch (err) {
                // Stale client, will be cleaned on close
            }
        });
    }
    // Transactional Outbox event creation
    static async createOutboxEvent(params, prismaClient = database_1.prisma) {
        const event = await prismaClient.outboxEvent.create({
            data: {
                eventType: params.eventType,
                aggregateType: params.aggregateType,
                aggregateId: params.aggregateId,
                payload: JSON.stringify(params.payload),
                status: 'PENDING',
            },
        });
        // Also broadcast in real-time
        this.broadcast(params.eventType, params.payload);
        return event;
    }
}
exports.EventService = EventService;
