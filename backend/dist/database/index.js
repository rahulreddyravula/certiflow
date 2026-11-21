"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDatabase = connectDatabase;
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'test' ? ['error'] : ['error', 'warn'],
});
async function connectDatabase() {
    try {
        await exports.prisma.$connect();
        console.log('✅ Connected to database successfully.');
    }
    catch (error) {
        console.error('❌ Database connection error:', error);
        process.exit(1);
    }
}
