"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationService = void 0;
const database_1 = require("../../database");
class VerificationService {
    static maskName(fullName) {
        const parts = fullName.split(' ');
        return parts
            .map((part) => {
            if (part.length <= 2)
                return part;
            return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
        })
            .join(' ');
    }
    static async verifyCertificate(identifier) {
        const trimmed = identifier.trim();
        const now = new Date().toISOString();
        const cert = await database_1.prisma.certificate.findFirst({
            where: {
                OR: [
                    { certificateNumber: trimmed },
                    { id: trimmed },
                ],
            },
        });
        if (!cert) {
            return {
                status: 'NOT_FOUND',
                verificationTimestamp: now,
                message: 'Certificate not found. The entered credential does not match any recognized record in the national skill registry.',
            };
        }
        if (cert.status === 'CANCELLED') {
            return {
                status: 'CANCELLED',
                certificateNumber: cert.certificateNumber,
                candidateName: this.maskName(cert.candidateName),
                courseName: cert.courseName,
                trainingCentreName: cert.trainingCentreName,
                districtName: cert.districtName,
                issueDate: cert.issueDate,
                cancelledAt: cert.cancelledAt,
                cancellationReason: cert.cancellationReason,
                verificationTimestamp: now,
                message: 'This certificate was officially cancelled by the State Authority and is NO LONGER VALID.',
            };
        }
        return {
            status: 'VALID',
            certificateNumber: cert.certificateNumber,
            candidateName: this.maskName(cert.candidateName),
            courseName: cert.courseName,
            trainingCentreName: cert.trainingCentreName,
            districtName: cert.districtName,
            issueDate: cert.issueDate,
            verificationTimestamp: now,
            message: 'Certificate verified as authentic and officially issued under the National Skill Mission.',
        };
    }
}
exports.VerificationService = VerificationService;
