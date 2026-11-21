import { connectDatabase } from './database';
import { QueueService } from './queue/queue.service';

async function startWorker() {
  console.log('⚙️ Starting CertiFlow Dedicated Background Worker...');
  await connectDatabase();
  await QueueService.init();

  console.log('✅ CertiFlow Background Worker active and listening to BullMQ queues & outbox.');

  const shutdown = async () => {
    console.log('🛑 Shutting down background worker...');
    await QueueService.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker();
