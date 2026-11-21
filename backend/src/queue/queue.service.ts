import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { prisma } from '../database';
import { CertificateService } from '../modules/certificate/certificate.service';
import { WhatsAppService } from '../modules/whatsapp/whatsapp.service';
import { MonitoringService } from '../modules/monitoring/monitoring.service';

export class QueueService {
  private static isRedisAvailable = false;
  private static redisClient: IORedis | null = null;

  private static certificateQueue: Queue | null = null;
  private static whatsappQueue: Queue | null = null;

  private static certificateWorker: Worker | null = null;
  private static whatsappWorker: Worker | null = null;

  private static outboxInterval: NodeJS.Timeout | null = null;
  private static slaInterval: NodeJS.Timeout | null = null;

  static async init() {
    console.log('🔄 Initializing Queue System...');

    // Try connecting to Redis
    try {
      const client = new IORedis(config.redisUrl, {
        maxRetriesPerRequest: null,
        connectTimeout: 2000,
        retryStrategy: () => null, // Do not hang if Redis is offline
      });

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          this.isRedisAvailable = true;
          this.redisClient = client;
          resolve();
        });
        client.on('error', (err) => {
          reject(err);
        });
      });

      console.log('✅ Connected to Redis for BullMQ!');
      this.initBullQueues();
    } catch (err) {
      console.log('ℹ️ Redis is offline or not reachable. Operating in High-Reliability In-Process Asynchronous Queue mode.');
      this.isRedisAvailable = false;
    }

    // Start outbox polling and SLA periodic checker
    this.startOutboxProcessor();
    this.startSlaMonitor();
  }

  private static initBullQueues() {
    if (!this.redisClient) return;

    this.certificateQueue = new Queue('certificate-generation', { connection: this.redisClient });
    this.whatsappQueue = new Queue('whatsapp-notifications', { connection: this.redisClient });

    // Certificate Generation Worker
    this.certificateWorker = new Worker(
      'certificate-generation',
      async (job: Job) => {
        console.log(`[BullMQ Worker] Processing Certificate Generation for Batch: ${job.data.batchId}`);
        await CertificateService.generateCertificatesForBatch(job.data.batchId);
      },
      { connection: this.redisClient, concurrency: 5 }
    );

    // WhatsApp Notification Worker with Exponential Backoff
    this.whatsappWorker = new Worker(
      'whatsapp-notifications',
      async (job: Job) => {
        console.log(`[BullMQ Worker] Processing WhatsApp notification for: ${job.data.candidateName} (Attempt ${job.attemptsMade + 1})`);
        const result = await WhatsAppService.sendCertificateNotification(job.data, job.attemptsMade + 1);
        if (result.status === 'FAILED') {
          throw new Error(`WhatsApp simulated failure: ${result.errorMessage}`);
        }
      },
      {
        connection: this.redisClient,
        concurrency: 10,
        limiter: { max: 20, duration: 1000 },
      }
    );

    this.certificateWorker.on('completed', (job) => console.log(`[BullMQ] Certificate job ${job.id} completed.`));
    this.whatsappWorker.on('failed', (job, err) => console.log(`[BullMQ] WhatsApp job ${job?.id} failed: ${err.message}`));
  }

  /**
   * Enqueue Certificate Generation
   */
  static async enqueueCertificateGeneration(batchId: string) {
    if (this.isRedisAvailable && this.certificateQueue) {
      await this.certificateQueue.add('generate', { batchId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    } else {
      // In-process asynchronous non-blocking execution
      setImmediate(async () => {
        try {
          await CertificateService.generateCertificatesForBatch(batchId);
        } catch (error) {
          console.error('[In-Process Worker] Error generating certificates:', error);
        }
      });
    }
  }

  /**
   * Enqueue WhatsApp Notification
   */
  static async enqueueWhatsAppNotification(data: any) {
    if (this.isRedisAvailable && this.whatsappQueue) {
      await this.whatsappQueue.add('send-whatsapp', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1500 },
      });
    } else {
      // In-process asynchronous execution
      setImmediate(async () => {
        try {
          await WhatsAppService.sendCertificateNotification(data, 1);
        } catch (error) {
          console.error('[In-Process Worker] Error sending WhatsApp message:', error);
        }
      });
    }
  }

  /**
   * Transactional Outbox Pattern Poller:
   * Polls pending outbox records from DB and guarantees at-least-once delivery
   */
  static startOutboxProcessor() {
    this.outboxInterval = setInterval(async () => {
      try {
        const pendingEvents = await prisma.outboxEvent.findMany({
          where: { status: 'PENDING' },
          take: 20,
          orderBy: { createdAt: 'asc' },
        });

        for (const event of pendingEvents) {
          try {
            const payload = JSON.parse(event.payload);

            if (event.eventType === 'certificate.generation_requested') {
              await this.enqueueCertificateGeneration(payload.batchId);
            } else if (event.eventType === 'whatsapp.delivery_requested') {
              await this.enqueueWhatsAppNotification(payload);
            }

            // Mark outbox event PROCESSED
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: { status: 'PROCESSED', processedAt: new Date() },
            });
          } catch (eventErr) {
            console.error(`Failed to process Outbox Event ${event.id}:`, eventErr);
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: {
                retryCount: event.retryCount + 1,
                status: event.retryCount >= 3 ? 'FAILED' : 'PENDING',
              },
            });
          }
        }
      } catch (err) {
        // Silent catch for database polling
      }
    }, 2000);
  }

  /**
   * SLA Monitoring Recurring Loop
   */
  static startSlaMonitor() {
    // Check SLA every 5 minutes in production, or immediately on trigger
    this.slaInterval = setInterval(async () => {
      try {
        await MonitoringService.checkDelayedBatches();
      } catch (err) {
        console.error('SLA monitor interval error:', err);
      }
    }, 5 * 60 * 1000);
  }

  static async shutdown() {
    if (this.outboxInterval) clearInterval(this.outboxInterval);
    if (this.slaInterval) clearInterval(this.slaInterval);
    if (this.certificateWorker) await this.certificateWorker.close();
    if (this.whatsappWorker) await this.whatsappWorker.close();
    if (this.redisClient) await this.redisClient.quit();
  }
}
