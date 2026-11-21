"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeonService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const database_1 = require("../../database");
const config_1 = require("../../config");
class NeonService {
    static s3Client = null;
    static getS3Client() {
        if (!this.s3Client && config_1.config.neon.s3Endpoint && config_1.config.neon.s3AccessKeyId && config_1.config.neon.s3SecretAccessKey) {
            this.s3Client = new client_s3_1.S3Client({
                region: config_1.config.neon.s3Region,
                endpoint: config_1.config.neon.s3Endpoint,
                credentials: {
                    accessKeyId: config_1.config.neon.s3AccessKeyId,
                    secretAccessKey: config_1.config.neon.s3SecretAccessKey,
                },
                forcePathStyle: true,
            });
        }
        return this.s3Client;
    }
    static async testPostgres() {
        const start = Date.now();
        try {
            const result = await database_1.prisma.$queryRaw `SELECT version();`;
            const users = await database_1.prisma.user.count();
            const batches = await database_1.prisma.batch.count();
            const certificates = await database_1.prisma.certificate.count();
            const latencyMs = Date.now() - start;
            return {
                status: 'connected',
                latencyMs,
                version: result[0]?.version?.split(' ')[0] + ' ' + (result[0]?.version?.split(' ')[1] || ''),
                tables: { users, batches, certificates },
            };
        }
        catch (err) {
            return {
                status: 'error',
                error: err.message,
            };
        }
    }
    static async testFunctions() {
        const url = config_1.config.neon.functionHelloUrl;
        try {
            const response = await fetch(url);
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            }
            catch {
                data = text;
            }
            return {
                status: response.ok ? 'healthy' : 'error',
                url,
                response: data,
            };
        }
        catch (err) {
            return {
                status: 'error',
                url,
                error: err.message,
            };
        }
    }
    static async testObjectStorage() {
        const bucket = config_1.config.neon.storageBucket;
        const client = this.getS3Client();
        if (!client) {
            return {
                status: 'error',
                bucket,
                error: 'S3 credentials not configured',
            };
        }
        try {
            // 1. Put a test health ping object into Neon assets bucket
            const testKey = `healthcheck/${Date.now()}-ping.txt`;
            await client.send(new client_s3_1.PutObjectCommand({
                Bucket: bucket,
                Key: testKey,
                Body: Buffer.from(`CertiFlow health check at ${new Date().toISOString()}`),
                ContentType: 'text/plain',
            }));
            // 2. List objects
            const listRes = await client.send(new client_s3_1.ListObjectsV2Command({
                Bucket: bucket,
                MaxKeys: 10,
            }));
            return {
                status: 'connected',
                bucket,
                endpoint: config_1.config.neon.s3Endpoint,
                objectCount: listRes.KeyCount || 0,
            };
        }
        catch (err) {
            return {
                status: 'error',
                bucket,
                endpoint: config_1.config.neon.s3Endpoint,
                error: err.message,
            };
        }
    }
    static async testAuth() {
        const jwksUrl = config_1.config.neon.authJwksUrl || '';
        if (!jwksUrl) {
            return {
                status: 'error',
                jwksUrl: 'Not set',
                error: 'NEON_AUTH_JWKS_URL is missing',
            };
        }
        try {
            const response = await fetch(jwksUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const jwks = (await response.json());
            return {
                status: 'configured',
                jwksUrl,
                keysCount: jwks.keys ? jwks.keys.length : 0,
            };
        }
        catch (err) {
            return {
                status: 'error',
                jwksUrl,
                error: err.message,
            };
        }
    }
    static async testRealtime() {
        return {
            status: 'configured',
            url: config_1.config.neon.realtimeUrl || 'Not configured',
        };
    }
    static async testAiGateway() {
        return {
            status: 'configured',
            baseUrl: config_1.config.neon.aiGatewayBaseUrl || 'Not configured',
            hasToken: !!config_1.config.neon.aiGatewayToken,
        };
    }
    static async uploadCertificate(certificateNumber, pdfBuffer) {
        const client = this.getS3Client();
        if (!client) {
            return { uploaded: false, error: 'S3 client not initialized' };
        }
        try {
            const s3Key = `certificates/${certificateNumber}.pdf`;
            await client.send(new client_s3_1.PutObjectCommand({
                Bucket: config_1.config.neon.storageBucket,
                Key: s3Key,
                Body: pdfBuffer,
                ContentType: 'application/pdf',
            }));
            return { uploaded: true, s3Key };
        }
        catch (err) {
            return { uploaded: false, error: err.message };
        }
    }
    static async getFullStatus() {
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
exports.NeonService = NeonService;
