"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const database_1 = require("./database");
const queue_service_1 = require("./queue/queue.service");
async function bootstrap() {
    await (0, database_1.connectDatabase)();
    await queue_service_1.QueueService.init();
    const server = app_1.app.listen(config_1.config.port, () => {
        console.log(`🚀 CertiFlow Backend Server running on port ${config_1.config.port} [${config_1.config.env}]`);
        console.log(`🌐 API Base URL: http://localhost:${config_1.config.port}/api`);
        console.log(`📡 SSE Stream: http://localhost:${config_1.config.port}/api/events/subscribe`);
    });
    const gracefulShutdown = async () => {
        console.log('\n🛑 Gracefully shutting down CertiFlow server...');
        await queue_service_1.QueueService.shutdown();
        server.close(() => {
            console.log('✅ HTTP server closed.');
            process.exit(0);
        });
    };
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
}
bootstrap();
