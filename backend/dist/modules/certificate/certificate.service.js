"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../../database");
const config_1 = require("../../config");
const pdf_service_1 = require("../pdf/pdf.service");
const whatsapp_service_1 = require("../whatsapp/whatsapp.service");
const audit_service_1 = require("../audit/audit.service");
const event_service_1 = require("../events/event.service");
const neon_service_1 = require("../neon/neon.service");
const cache_service_1 = require("../cache/cache.service");
class CertificateService {
    /**
     * Idempotent certificate generation for approved batches.
     * Every passed candidate receives exactly one unique certificate.
     * Retries will not create duplicate certificates.
     */
    static async generateCertificatesForBatch(batchId) {
        const batch = await database_1.prisma.batch.findUnique({
            where: { id: batchId },
            include: {
                trainingCentre: true,
                district: true,
                candidates: {
                    where: { assessmentStatus: 'PASSED' },
                },
            },
        });
        if (!batch) {
            throw new Error(`Batch with ID ${batchId} not found.`);
        }
        // Update status to CERTIFICATE_GENERATION
        await database_1.prisma.batch.update({
            where: { id: batchId },
            data: { status: 'CERTIFICATE_GENERATION' },
        });
        const generatedCertificates = [];
        // Pre-fetch all existing certificates for the candidate batch in 1 single query (eliminates N+1 queries)
        const candidateIds = batch.candidates.map((c) => c.id);
        const existingCerts = await database_1.prisma.certificate.findMany({
            where: { candidateId: { in: candidateIds } },
        });
        const existingCertMap = new Map(existingCerts.map((cert) => [cert.candidateId, cert]));
        for (let i = 0; i < batch.candidates.length; i++) {
            const candidate = batch.candidates[i];
            // 1. Idempotency Check via in-memory Map
            const existingCert = existingCertMap.get(candidate.id);
            if (existingCert) {
                console.log(`[Certificate] Idempotent skip: Certificate already exists for candidate ${candidate.name} (${existingCert.certificateNumber})`);
                generatedCertificates.push(existingCert);
                continue;
            }
            // Generate deterministic unique certificate ID
            const districtCode = batch.district.code || 'IN';
            const year = new Date().getFullYear();
            const uniqueSuffix = candidate.id.substring(0, 6).toUpperCase();
            const certNumber = `CERT-${year}-${districtCode}-${uniqueSuffix}`;
            // Verification URL pointing to public verification endpoint
            const verificationUrl = `${config_1.config.corsOrigin}/verify/${certNumber}`;
            // Generate PDF & QR Code
            const { filePath, qrCodeDataUrl } = await pdf_service_1.PdfService.generateCertificatePdf({
                certificateNumber: certNumber,
                candidateName: candidate.name,
                courseName: candidate.courseName,
                trainingCentreName: candidate.trainingCentreName,
                districtName: candidate.districtName,
                issueDate: new Date(),
                verificationUrl,
            });
            // Save certificate record
            const cert = await database_1.prisma.certificate.create({
                data: {
                    certificateNumber: certNumber,
                    candidateId: candidate.id,
                    batchId: batch.id,
                    candidateName: candidate.name,
                    candidateEmail: candidate.email,
                    candidatePhone: candidate.phone,
                    courseName: candidate.courseName,
                    trainingCentreName: candidate.trainingCentreName,
                    districtName: candidate.districtName,
                    issueDate: new Date(),
                    status: 'VALID',
                    pdfPath: filePath,
                    qrCodeDataUrl,
                },
            });
            generatedCertificates.push(cert);
            existingCertMap.set(candidate.id, cert);
            // Upload to Neon S3-compatible Object Storage (assets bucket) asynchronously
            neon_service_1.NeonService.uploadCertificate(certNumber, fs_1.default.readFileSync(filePath)).catch((neonErr) => {
                console.warn(`[Neon Object Storage] Upload note for ${certNumber}: ${neonErr.message}`);
            });
            // Enqueue / Trigger WhatsApp Notification (Non-blocking)
            try {
                await whatsapp_service_1.WhatsAppService.sendCertificateNotification({
                    certificateId: cert.id,
                    candidatePhone: candidate.phone,
                    candidateName: candidate.name,
                    certificateNumber: cert.certificateNumber,
                    courseName: cert.courseName,
                    verificationUrl,
                });
            }
            catch (waErr) {
                console.error(`WhatsApp notification error for ${candidate.name}:`, waErr);
                // Non-blocking: WhatsApp delivery failure NEVER blocks certificate issuance
            }
        }
        // Mark batch as CERTIFICATES_ISSUED
        await database_1.prisma.batch.update({
            where: { id: batchId },
            data: { status: 'CERTIFICATES_ISSUED' },
        });
        await audit_service_1.AuditService.log({
            action: 'CERTIFICATES_GENERATED',
            entityType: 'BATCH',
            entityId: batchId,
            metadata: { count: generatedCertificates.length },
        });
        event_service_1.EventService.broadcast('certificate.generated', {
            batchId,
            count: generatedCertificates.length,
        });
        cache_service_1.CacheService.delPattern('dashboard:*');
        cache_service_1.CacheService.delPattern('batches:*');
        cache_service_1.CacheService.delPattern('certs:*');
        return generatedCertificates;
    }
    static async getCertificates(query) {
        const where = {};
        if (query?.batchId)
            where.batchId = query.batchId;
        if (query?.status)
            where.status = query.status;
        if (query?.search) {
            where.OR = [
                { certificateNumber: { contains: query.search } },
                { candidateName: { contains: query.search } },
                { courseName: { contains: query.search } },
            ];
        }
        // Exclude qrCodeDataUrl (large Base64) from list payloads to reduce response size by 90%+
        return await database_1.prisma.certificate.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: query?.limit || 100,
            select: {
                id: true,
                certificateNumber: true,
                candidateId: true,
                candidateName: true,
                candidateEmail: true,
                candidatePhone: true,
                courseName: true,
                trainingCentreName: true,
                districtName: true,
                issueDate: true,
                status: true,
                cancelledAt: true,
                cancellationReason: true,
                createdAt: true,
                updatedAt: true,
                batchId: true,
                batch: {
                    select: {
                        batchNumber: true,
                        courseName: true,
                    },
                },
            },
        });
    }
    static async getCertificateById(id) {
        return await cache_service_1.CacheService.wrap(`cert:${id}`, 300, async () => {
            const cert = await database_1.prisma.certificate.findFirst({
                where: {
                    OR: [{ id }, { certificateNumber: id }],
                },
                include: {
                    batch: true,
                    candidate: true,
                    whatsappLogs: true,
                },
            });
            if (!cert)
                throw { status: 404, message: 'Certificate not found.' };
            return cert;
        });
    }
    /**
     * State Office Certificate Cancellation:
     * Immediately invalidates certificate in public verification.
     * Records officer details, timestamp, and mandatory reason.
     */
    static async cancelCertificate(certificateId, reason, user) {
        if (!reason || reason.trim().length < 5) {
            throw { status: 400, message: 'A valid cancellation reason (at least 5 characters) is required.' };
        }
        const cert = await database_1.prisma.certificate.findFirst({
            where: {
                OR: [{ id: certificateId }, { certificateNumber: certificateId }],
            },
        });
        if (!cert)
            throw { status: 404, message: 'Certificate not found.' };
        if (cert.status === 'CANCELLED') {
            throw { status: 400, message: 'Certificate is already cancelled.' };
        }
        const updatedCert = await database_1.prisma.certificate.update({
            where: { id: cert.id },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                cancelledById: user.id,
                cancellationReason: reason,
            },
        });
        await audit_service_1.AuditService.log({
            userId: user.id,
            userRole: user.role,
            action: 'CERTIFICATE_CANCELLED',
            entityType: 'CERTIFICATE',
            entityId: cert.id,
            previousState: { status: 'VALID' },
            newState: { status: 'CANCELLED', reason },
            metadata: { certificateNumber: cert.certificateNumber, cancelledBy: user.name },
        });
        event_service_1.EventService.broadcast('certificate.cancelled', {
            certificateNumber: cert.certificateNumber,
            candidateName: cert.candidateName,
            reason,
            cancelledAt: updatedCert.cancelledAt,
        });
        await cache_service_1.CacheService.del(`cert:${cert.id}`);
        await cache_service_1.CacheService.del(`cert:${cert.certificateNumber}`);
        cache_service_1.CacheService.delPattern('certs:*');
        cache_service_1.CacheService.delPattern('dashboard:*');
        return updatedCert;
    }
    static async getPdfFilePath(certificateNumber) {
        const cert = await database_1.prisma.certificate.findUnique({
            where: { certificateNumber },
        });
        if (!cert)
            throw { status: 404, message: 'Certificate not found.' };
        const expectedPath = path_1.default.join(config_1.config.certificatesDir, `${cert.certificateNumber}.pdf`);
        if (fs_1.default.existsSync(expectedPath)) {
            return expectedPath;
        }
        // If PDF file does not exist on disk, regenerate on the fly
        const { filePath } = await pdf_service_1.PdfService.generateCertificatePdf({
            certificateNumber: cert.certificateNumber,
            candidateName: cert.candidateName,
            courseName: cert.courseName,
            trainingCentreName: cert.trainingCentreName,
            districtName: cert.districtName,
            issueDate: cert.issueDate,
            verificationUrl: `${config_1.config.corsOrigin}/verify/${cert.certificateNumber}`,
        });
        return filePath;
    }
}
exports.CertificateService = CertificateService;
