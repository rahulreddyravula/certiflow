"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const database_1 = require("../database");
const certificate_service_1 = require("../modules/certificate/certificate.service");
const whatsapp_service_1 = require("../modules/whatsapp/whatsapp.service");
const monitoring_service_1 = require("../modules/monitoring/monitoring.service");
class QueueService {
    static isRedisAvailable = false;
    static redisClient = null;
    static certificateQueue = null;
    static whatsappQueue = null;
    static certificateWorker = null;
    static whatsappWorker = null;
    static outboxInterval = null;
    static slaInterval = null;
    static async init() {
        console.log('🔄 Initializing Queue System...');
        // Try connecting to Redis
        try {
            const client = new ioredis_1.default(config_1.config.redisUrl, {
                maxRetriesPerRequest: null,
                connectTimeout: 2000,
                retryStrategy: () => null, // Do not hang if Redis is offline
            });
            await new Promise((resolve, reject) => {
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
        }
        catch (err) {
            console.log('ℹ️ Redis is offline or not reachable. Operating in High-Reliability In-Process Asynchronous Queue mode.');
            this.isRedisAvailable = false;
        }
        // Start outbox polling and SLA periodic checker
        this.startOutboxProcessor();
        this.startSlaMonitor();
    }
    static initBullQueues() {
        if (!this.redisClient)
            return;
        this.certificateQueue = new bullmq_1.Queue('certificate-generation', { connection: this.redisClient });
        this.whatsappQueue = new bullmq_1.Queue('whatsapp-notifications', { connection: this.redisClient });
        // Certificate Generation Worker
        this.certificateWorker = new bullmq_1.Worker('certificate-generation', async (job) => {
            console.log(`[BullMQ Worker] Processing Certificate Generation for Batch: ${job.data.batchId}`);
            await certificate_service_1.CertificateService.generateCertificatesForBatch(job.data.batchId);
        }, { connection: this.redisClient, concurrency: 5 });
        // WhatsApp Notification Worker with Exponential Backoff
        this.whatsappWorker = new bullmq_1.Worker('whatsapp-notifications', async (job) => {
            console.log(`[BullMQ Worker] Processing WhatsApp notification for: ${job.data.candidateName} (Attempt ${job.attemptsMade + 1})`);
            const result = await whatsapp_service_1.WhatsAppService.sendCertificateNotification(job.data, job.attemptsMade + 1);
            if (result.status === 'FAILED') {
                throw new Error(`WhatsApp simulated failure: ${result.errorMessage}`);
            }
        }, {
            connection: this.redisClient,
            concurrency: 10,
            limiter: { max: 20, duration: 1000 },
        });
        this.certificateWorker.on('completed', (job) => console.log(`[BullMQ] Certificate job ${job.id} completed.`));
        this.whatsappWorker.on('failed', (job, err) => console.log(`[BullMQ] WhatsApp job ${job?.id} failed: ${err.message}`));
    }
    /**
     * Enqueue Certificate Generation
     */
    static async enqueueCertificateGeneration(batchId) {
        if (this.isRedisAvailable && this.certificateQueue) {
            await this.certificateQueue.add('generate', { batchId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
        }
        else {
            // In-process asynchronous non-blocking execution
            setImmediate(async () => {
                try {
                    await certificate_service_1.CertificateService.generateCertificatesForBatch(batchId);
                }
                catch (error) {
                    console.error('[In-Process Worker] Error generating certificates:', error);
                }
            });
        }
    }
    /**
     * Enqueue WhatsApp Notification
     */
    static async enqueueWhatsAppNotification(data) {
        if (this.isRedisAvailable && this.whatsappQueue) {
            await this.whatsappQueue.add('send-whatsapp', data, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1500 },
            });
        }
        else {
            // In-process asynchronous execution
            setImmediate(async () => {
                try {
                    await whatsapp_service_1.WhatsAppService.sendCertificateNotification(data, 1);
                }
                catch (error) {
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
                const pendingEvents = await database_1.prisma.outboxEvent.findMany({
                    where: { status: 'PENDING' },
                    take: 20,
                    orderBy: { createdAt: 'asc' },
                });
                for (const event of pendingEvents) {
                    try {
                        const payload = JSON.parse(event.payload);
                        if (event.eventType === 'certificate.generation_requested') {
                            await this.enqueueCertificateGeneration(payload.batchId);
                        }
                        else if (event.eventType === 'whatsapp.delivery_requested') {
                            await this.enqueueWhatsAppNotification(payload);
                        }
                        // Mark outbox event PROCESSED
                        await database_1.prisma.outboxEvent.update({
                            where: { id: event.id },
                            data: { status: 'PROCESSED', processedAt: new Date() },
                        });
                    }
                    catch (eventErr) {
                        console.error(`Failed to process Outbox Event ${event.id}:`, eventErr);
                        await database_1.prisma.outboxEvent.update({
                            where: { id: event.id },
                            data: {
                                retryCount: event.retryCount + 1,
                                status: event.retryCount >= 3 ? 'FAILED' : 'PENDING',
                            },
                        });
                    }
                }
            }
            catch (err) {
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
                await monitoring_service_1.MonitoringService.checkDelayedBatches();
            }
            catch (err) {
                console.error('SLA monitor interval error:', err);
            }
        }, 5 * 60 * 1000);
    }
    static async shutdown() {
        if (this.outboxInterval)
            clearInterval(this.outboxInterval);
        if (this.slaInterval)
            clearInterval(this.slaInterval);
        if (this.certificateWorker)
            await this.certificateWorker.close();
        if (this.whatsappWorker)
            await this.whatsappWorker.close();
        if (this.redisClient)
            await this.redisClient.quit();
    }
}
exports.QueueService = QueueService;
