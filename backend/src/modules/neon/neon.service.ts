import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '../../database';
import { config } from '../../config';

export interface NeonServiceStatus {
  postgres: { status: 'connected' | 'error'; latencyMs?: number; version?: string; tables?: { users: number; batches: number; certificates: number }; error?: string };
  functions: { status: 'healthy' | 'error'; url: string; response?: any; error?: string };
  objectStorage: { status: 'connected' | 'error'; bucket: string; endpoint?: string; objectCount?: number; error?: string };
  auth: { status: 'configured' | 'error'; jwksUrl: string; keysCount?: number; error?: string };
  realtime: { status: 'configured'; url: string };
  aiGateway: { status: 'configured'; baseUrl: string; hasToken: boolean };
}

export class NeonService {
  private static s3Client: S3Client | null = null;

  static getS3Client(): S3Client | null {
    if (!this.s3Client && config.neon.s3Endpoint && config.neon.s3AccessKeyId && config.neon.s3SecretAccessKey) {
      this.s3Client = new S3Client({
        region: config.neon.s3Region,
        endpoint: config.neon.s3Endpoint,
        credentials: {
          accessKeyId: config.neon.s3AccessKeyId,
          secretAccessKey: config.neon.s3SecretAccessKey,
        },
        forcePathStyle: true,
      });
    }
    return this.s3Client;
  }

  static async testPostgres() {
    const start = Date.now();
    try {
      const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
      const users = await prisma.user.count();
      const batches = await prisma.batch.count();
      const certificates = await prisma.certificate.count();
      const latencyMs = Date.now() - start;

      return {
        status: 'connected' as const,
        latencyMs,
        version: result[0]?.version?.split(' ')[0] + ' ' + (result[0]?.version?.split(' ')[1] || ''),
        tables: { users, batches, certificates },
      };
    } catch (err: any) {
      return {
        status: 'error' as const,
        error: err.message,
      };
    }
  }

  static async testFunctions() {
    const url = config.neon.functionHelloUrl;
    try {
      const response = await fetch(url);
      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return {
        status: response.ok ? ('healthy' as const) : ('error' as const),
        url,
        response: data,
      };
    } catch (err: any) {
      return {
        status: 'error' as const,
        url,
        error: err.message,
      };
    }
  }

  static async testObjectStorage() {
    const bucket = config.neon.storageBucket;
    const client = this.getS3Client();

    if (!client) {
      return {
        status: 'error' as const,
        bucket,
        error: 'S3 credentials not configured',
      };
    }

    try {
      // 1. Put a test health ping object into Neon assets bucket
      const testKey = `healthcheck/${Date.now()}-ping.txt`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: testKey,
          Body: Buffer.from(`CertiFlow health check at ${new Date().toISOString()}`),
          ContentType: 'text/plain',
        })
      );

      // 2. List objects
      const listRes = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          MaxKeys: 10,
        })
      );

      return {
        status: 'connected' as const,
        bucket,
        endpoint: config.neon.s3Endpoint,
        objectCount: listRes.KeyCount || 0,
      };
    } catch (err: any) {
      return {
        status: 'error' as const,
        bucket,
        endpoint: config.neon.s3Endpoint,
        error: err.message,
      };
    }
  }

  static async testAuth() {
    const jwksUrl = config.neon.authJwksUrl || '';
    if (!jwksUrl) {
      return {
        status: 'error' as const,
        jwksUrl: 'Not set',
        error: 'NEON_AUTH_JWKS_URL is missing',
      };
    }

    try {
      const response = await fetch(jwksUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const jwks = (await response.json()) as { keys?: any[] };
      return {
        status: 'configured' as const,
        jwksUrl,
        keysCount: jwks.keys ? jwks.keys.length : 0,
      };
    } catch (err: any) {
      return {
        status: 'error' as const,
        jwksUrl,
        error: err.message,
      };
    }
  }

  static async testRealtime() {
    return {
      status: 'configured' as const,
      url: config.neon.realtimeUrl || 'Not configured',
    };
  }

  static async testAiGateway() {
    return {
      status: 'configured' as const,
      baseUrl: config.neon.aiGatewayBaseUrl || 'Not configured',
      hasToken: !!config.neon.aiGatewayToken,
    };
  }

  static async uploadCertificate(certificateNumber: string, pdfBuffer: Buffer): Promise<{ uploaded: boolean; s3Key?: string; error?: string }> {
    const client = this.getS3Client();
    if (!client) {
      return { uploaded: false, error: 'S3 client not initialized' };
    }

    try {
      const s3Key = `certificates/${certificateNumber}.pdf`;
      await client.send(
        new PutObjectCommand({
          Bucket: config.neon.storageBucket,
          Key: s3Key,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        })
      );
      return { uploaded: true, s3Key };
    } catch (err: any) {
      return { uploaded: false, error: err.message };
    }
  }

  static async getFullStatus(): Promise<NeonServiceStatus> {
    const [postgres, functions, objectStorage, auth, realtime, aiGateway] = await Promise.all([
      this.testPostgres(),
      this.testFunctions(),
      this.testObjectStorage(),
      this.testAuth(),
      this.testRealtime(),
      this.testAiGateway(),
    ]);

    return {
      postgres,
      functions,
      objectStorage,
      auth,
      realtime,
      aiGateway,
    };
  }
}
