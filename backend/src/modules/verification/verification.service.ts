import { prisma } from '../../database';

export interface VerificationResult {
  status: 'VALID' | 'CANCELLED' | 'NOT_FOUND';
  certificateNumber?: string;
  candidateName?: string;
  courseName?: string;
  trainingCentreName?: string;
  districtName?: string;
  issueDate?: Date;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  verificationTimestamp: string;
  message: string;
}

export class VerificationService {
  private static maskName(fullName: string): string {
    const parts = fullName.split(' ');
    return parts
      .map((part) => {
        if (part.length <= 2) return part;
        return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
      })
      .join(' ');
  }

  static async verifyCertificate(identifier: string): Promise<VerificationResult> {
    const trimmed = identifier.trim();
    const now = new Date().toISOString();

    const cert = await prisma.certificate.findFirst({
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
