import { prisma } from '../../database';
import { config } from '../../config';
import { EventService } from '../events/event.service';

export interface WhatsAppSendParams {
  certificateId: string;
  candidatePhone: string;
  candidateName: string;
  certificateNumber: string;
  courseName: string;
  verificationUrl: string;
  forceSuccess?: boolean; // For deterministic unit testing
  forceFailure?: boolean; // For deterministic unit testing
}

export interface WhatsAppProviderResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode: number;
}

export class WhatsAppService {
  // Simulated WhatsApp Cloud API endpoint
  static async simulateApiCall(params: WhatsAppSendParams): Promise<WhatsAppProviderResponse> {
    // Artificial simulated latency
    if (config.simulateWhatsAppDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.simulateWhatsAppDelayMs));
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
    if (roll < config.simulateWhatsAppFailureRate) {
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
  static async sendCertificateNotification(params: WhatsAppSendParams, attemptNumber: number = 1) {
    const idempotencyKey = `wa_${params.certificateId}`;

    // 1. Find or create delivery log
    let log = await prisma.whatsAppDeliveryLog.findUnique({
      where: { idempotencyKey },
    });

    if (log && log.status === 'DELIVERED') {
      console.log(`[WhatsApp] Idempotent skip: Certificate ${params.certificateNumber} already delivered.`);
      return log;
    }

    if (!log) {
      log = await prisma.whatsAppDeliveryLog.create({
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
      log = await prisma.whatsAppDeliveryLog.update({
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

      EventService.broadcast('whatsapp.delivered', {
        logId: log.id,
        certificateId: params.certificateId,
        candidateName: params.candidateName,
        phone: params.candidatePhone,
        status: 'DELIVERED',
      });
    } else {
      log = await prisma.whatsAppDeliveryLog.update({
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

      EventService.broadcast('whatsapp.failed', {
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

  static async retryDelivery(logId: string) {
    const log = await prisma.whatsAppDeliveryLog.findUnique({
      where: { id: logId },
      include: { certificate: true },
    });

    if (!log) throw { status: 404, message: 'WhatsApp delivery log not found.' };

    return await this.sendCertificateNotification(
      {
        certificateId: log.certificateId,
        candidatePhone: log.candidatePhone,
        candidateName: log.candidateName,
        certificateNumber: log.certificate.certificateNumber,
        courseName: log.certificate.courseName,
        verificationUrl: `${config.corsOrigin}/verify/${log.certificate.certificateNumber}`,
        forceSuccess: true, // Manual retry by authorized user forces successful dispatch
      },
      log.attempts + 1
    );
  }

  static async getDeliveryLogs(filter?: { status?: string; limit?: number }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;

    return await prisma.whatsAppDeliveryLog.findMany({
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
