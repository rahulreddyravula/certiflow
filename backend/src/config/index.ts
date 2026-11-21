import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'certiflow_default_jwt_secret_change_in_production',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  largeBatchThreshold: parseInt(process.env.LARGE_BATCH_THRESHOLD || '50', 10),
  slaHoursDistrict: parseInt(process.env.SLA_HOURS_DISTRICT || '48', 10),
  slaHoursState: parseInt(process.env.SLA_HOURS_STATE || '48', 10),
  simulateWhatsAppFailureRate: parseFloat(process.env.SIMULATE_WHATSAPP_FAILURE_RATE || '0.2'),
  simulateWhatsAppDelayMs: parseInt(process.env.SIMULATE_WHATSAPP_DELAY_MS || '300', 10),
  publicVerifyRateLimit: parseInt(process.env.PUBLIC_VERIFY_RATE_LIMIT || '100', 10),
  storageDir: path.resolve(__dirname, '../../storage'),
  certificatesDir: path.resolve(__dirname, '../../storage/certificates'),
  neon: {
    branch: process.env.NEON_BRANCH || 'production',
    branchId: process.env.NEON_BRANCH_ID,
    functionHostSuffix: process.env.NEON_FUNCTION_HOST_SUFFIX,
    functionHelloUrl: process.env.NEON_FUNCTION_HELLO_URL || 'https://br-empty-term-beocdrrk-hello.compute.c-9.us-east-2.aws.neon.tech/',
    authBaseUrl: process.env.NEON_AUTH_BASE_URL,
    authJwksUrl: process.env.NEON_AUTH_JWKS_URL,
    realtimeUrl: process.env.NEON_REALTIME_URL,
    realtimeSecret: process.env.NEON_REALTIME_SECRET,
    s3Endpoint: process.env.AWS_ENDPOINT_URL_S3,
    s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Region: process.env.AWS_REGION || 'us-east-2',
    storageBucket: process.env.NEON_STORAGE_BUCKET || 'assets',
    aiGatewayBaseUrl: process.env.NEON_AI_GATEWAY_BASE_URL,
    aiGatewayToken: process.env.NEON_AI_GATEWAY_TOKEN,
  },
};
