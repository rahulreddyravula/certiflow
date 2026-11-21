"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const queue_service_1 = require("./queue/queue.service");
async function startWorker() {
    console.log('⚙️ Starting CertiFlow Dedicated Background Worker...');
    await (0, database_1.connectDatabase)();
    await queue_service_1.QueueService.init();
    console.log('✅ CertiFlow Background Worker active and listening to BullMQ queues & outbox.');
    const shutdown = async () => {
        console.log('🛑 Shutting down background worker...');
        await queue_service_1.QueueService.shutdown();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
startWorker();
