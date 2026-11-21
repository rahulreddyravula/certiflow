import { app } from './app';
import { config } from './config';
import { connectDatabase } from './database';
import { QueueService } from './queue/queue.service';

async function bootstrap() {
  await connectDatabase();
  await QueueService.init();

  const server = app.listen(config.port, () => {
    console.log(`🚀 CertiFlow Backend Server running on port ${config.port} [${config.env}]`);
    console.log(`🌐 API Base URL: http://localhost:${config.port}/api`);
    console.log(`📡 SSE Stream: http://localhost:${config.port}/api/events/subscribe`);
  });

  const gracefulShutdown = async () => {
    console.log('\n🛑 Gracefully shutting down CertiFlow server...');
    await QueueService.shutdown();
    server.close(() => {
      console.log('✅ HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

bootstrap();
