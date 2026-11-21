import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? ['error'] : ['error', 'warn'],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to database successfully.');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
}
