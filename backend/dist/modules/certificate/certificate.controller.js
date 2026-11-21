"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateController = void 0;
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const certificate_service_1 = require("./certificate.service");
const cancelSchema = zod_1.z.object({
    reason: zod_1.z.string().min(5, 'Cancellation reason must be at least 5 characters'),
});
class CertificateController {
    static async list(req, res, next) {
        try {
            const { batchId, search, status, limit } = req.query;
            const certificates = await certificate_service_1.CertificateService.getCertificates({
                batchId,
                search,
                status,
                limit: limit ? parseInt(limit, 10) : 100,
            });
            res.json({ success: true, certificates });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const certificate = await certificate_service_1.CertificateService.getCertificateById(req.params.id);
            res.json({ success: true, certificate });
        }
        catch (error) {
            next(error);
        }
    }
    static async cancel(req, res, next) {
        try {
            const data = cancelSchema.parse(req.body);
            const certificate = await certificate_service_1.CertificateService.cancelCertificate(req.params.id, data.reason, req.user);
            res.json({
                success: true,
                certificate,
                message: `Certificate ${certificate.certificateNumber} has been officially cancelled.`,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async downloadPdf(req, res, next) {
        try {
            const filePath = await certificate_service_1.CertificateService.getPdfFilePath(req.params.certificateNumber);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${req.params.certificateNumber}.pdf"`);
            const stream = fs_1.default.createReadStream(filePath);
            stream.pipe(res);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CertificateController = CertificateController;
