"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationController = void 0;
const verification_service_1 = require("./verification.service");
class VerificationController {
    static async verify(req, res, next) {
        try {
            const { certificateNumber } = req.params;
            if (!certificateNumber) {
                res.status(400).json({ success: false, error: 'Certificate identifier is required.' });
                return;
            }
            const result = await verification_service_1.VerificationService.verifyCertificate(certificateNumber);
            res.json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.VerificationController = VerificationController;
