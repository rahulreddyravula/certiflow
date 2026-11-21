"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const database_1 = require("../../database");
const config_1 = require("../../config");
const event_service_1 = require("../events/event.service");
class WhatsAppService {
    // Simulated WhatsApp Cloud API endpoint
    static async simulateApiCall(params) {
        // Artificial simulated latency
        if (config_1.config.simulateWhatsAppDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, config_1.config.simulateWhatsAppDelayMs));
        }
        if (params.forceSuccess) {
            return {
                success: true,
                messageId: `wamid.HBgL${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                statusCode: 200,
            };
        }
        if (params.forceFailure) {
            return {
                success: false,
                error: 'Simulated Network Glitch: 504 Gateway Timeout connecting to WhatsApp cloud node',
                statusCode: 504,
            };
        }
        // Dynamic failure simulation based on configured rate
        const roll = Math.random();
        if (roll < config_1.config.simulateWhatsAppFailureRate) {
            const errorTypes = [
                { code: 504, msg: 'Simulated Network Glitch: 504 Gateway Timeout' },
                { code: 503, msg: 'Simulated Provider Busy: 503 Service Unavailable' },
                { code: 429, msg: 'Simulated Rate Limit: 429 Too Many Requests to Telecom Hub' },
            ];
            const selected = errorTypes[Math.floor(Math.random() * errorTypes.length)];
            return {
                success: false,
                error: selected.msg,
                statusCode: selected.code,
            };
        }
        return {
            success: true,
            messageId: `wamid.HBgL${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            statusCode: 200,
        };
    }
    // Idempotent delivery processor with retry & backoff tracking
    static async sendCertificateNotification(params, attemptNumber = 1) {
        const idempotencyKey = `wa_${params.certificateId}`;
        // 1. Find or create delivery log
        let log = await database_1.prisma.whatsAppDeliveryLog.findUnique({
            where: { idempotencyKey },
        });
        if (log && log.status === 'DELIVERED') {
            console.log(`[WhatsApp] Idempotent skip: Certificate ${params.certificateNumber} already delivered.`);
            return log;
        }
        if (!log) {
            log = await database_1.prisma.whatsAppDeliveryLog.create({
                data: {
                    certificateId: params.certificateId,
                    candidatePhone: params.candidatePhone,
                    candidateName: params.candidateName,
                    status: 'PENDING',
                    attempts: 0,
                    idempotencyKey,
                },
            });
        }
        // 2. Perform the simulated call
        const response = await this.simulateApiCall(params);
        if (response.success) {
            log = await database_1.prisma.whatsAppDeliveryLog.update({
                where: { id: log.id },
                data: {
                    status: 'DELIVERED',
                    attempts: attemptNumber,
                    lastAttemptAt: new Date(),
                    errorMessage: null,
                    responsePayload: JSON.stringify({
                        messageId: response.messageId,
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                    }),
                },
            });
            event_service_1.EventService.broadcast('whatsapp.delivered', {
                logId: log.id,
                certificateId: params.certificateId,
                candidateName: params.candidateName,
                phone: params.candidatePhone,
                status: 'DELIVERED',
            });
        }
        else {
            log = await database_1.prisma.whatsAppDeliveryLog.update({
                where: { id: log.id },
                data: {
                    status: 'FAILED',
                    attempts: attemptNumber,
                    lastAttemptAt: new Date(),
                    errorMessage: response.error,
                    responsePayload: JSON.stringify({
                        error: response.error,
                        statusCode: response.statusCode,
                        failedAt: new Date().toISOString(),
                    }),
                },
            });
            event_service_1.EventService.broadcast('whatsapp.failed', {
                logId: log.id,
                certificateId: params.certificateId,
                candidateName: params.candidateName,
                phone: params.candidatePhone,
                error: response.error,
                status: 'FAILED',
                attempts: attemptNumber,
            });
        }
        return log;
    }
    static async retryDelivery(logId) {
        const log = await database_1.prisma.whatsAppDeliveryLog.findUnique({
            where: { id: logId },
            include: { certificate: true },
        });
        if (!log)
            throw { status: 404, message: 'WhatsApp delivery log not found.' };
        return await this.sendCertificateNotification({
            certificateId: log.certificateId,
            candidatePhone: log.candidatePhone,
            candidateName: log.candidateName,
            certificateNumber: log.certificate.certificateNumber,
            courseName: log.certificate.courseName,
            verificationUrl: `${config_1.config.corsOrigin}/verify/${log.certificate.certificateNumber}`,
            forceSuccess: true, // Manual retry by authorized user forces successful dispatch
        }, log.attempts + 1);
    }
    static async getDeliveryLogs(filter) {
        const where = {};
        if (filter?.status)
            where.status = filter.status;
        return await database_1.prisma.whatsAppDeliveryLog.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: filter?.limit || 100,
            include: {
                certificate: {
                    select: {
                        certificateNumber: true,
                        courseName: true,
                        trainingCentreName: true,
                    },
                },
            },
        });
    }
}
exports.WhatsAppService = WhatsAppService;
