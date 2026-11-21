import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface CertificateData {
  certificateNumber: string;
  candidateName: string;
  courseName: string;
  trainingCentreName: string;
  districtName: string;
  issueDate: Date;
  verificationUrl: string;
}

export class PdfService {
  static ensureDirectoryExists() {
    if (!fs.existsSync(config.certificatesDir)) {
      fs.mkdirSync(config.certificatesDir, { recursive: true });
    }
  }

  static async generateCertificatePdf(data: CertificateData): Promise<{ filePath: string; qrCodeDataUrl: string }> {
    this.ensureDirectoryExists();

    const fileName = `${data.certificateNumber}.pdf`;
    const filePath = path.join(config.certificatesDir, fileName);

    // 1. Generate QR Code Buffer and Data URL
    const qrCodeDataUrl = await QRCode.toDataURL(data.verificationUrl, {
      margin: 1,
      width: 160,
      color: {
        dark: '#1e3a8a',
        light: '#ffffff',
      },
    });

    const qrImageBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

    // 2. Build PDF Document (Landscape A4: 841.89 x 595.28)
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const pageWidth = 841.89;
      const pageHeight = 595.28;

      // Outer Decorative Border (Deep Navy Blue)
      doc.rect(20, 20, pageWidth - 40, pageHeight - 40)
        .lineWidth(4)
        .strokeColor('#0f172a')
        .stroke();

      // Inner Gold Accent Border
      doc.rect(26, 26, pageWidth - 52, pageHeight - 52)
        .lineWidth(1.5)
        .strokeColor('#d97706')
        .stroke();

      // Corner Accents
      const corners = [
        [32, 32],
        [pageWidth - 32, 32],
        [pageWidth - 32, pageHeight - 32],
        [32, pageHeight - 32],
      ];
      doc.save();
      doc.rect(28, 28, 20, 20).fillColor('#0f172a').fill();
      doc.rect(pageWidth - 48, 28, 20, 20).fillColor('#0f172a').fill();
      doc.rect(pageWidth - 48, pageHeight - 48, 20, 20).fillColor('#0f172a').fill();
      doc.rect(28, pageHeight - 48, 20, 20).fillColor('#0f172a').fill();
      doc.restore();

      // Header: Programme Banner
      doc.font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#d97706')
        .text('NATIONAL SKILL DEVELOPMENT MISSION • GOVERNMENT OF INDIA', 0, 55, {
          align: 'center',
          characterSpacing: 1.5,
        });

      doc.font('Helvetica-Bold')
        .fontSize(28)
        .fillColor('#0f172a')
        .text('CERTIFICATE OF VOCATIONAL COMPETENCY', 0, 78, {
          align: 'center',
          characterSpacing: 2,
        });

      doc.font('Helvetica')
        .fontSize(11)
        .fillColor('#475569')
        .text('This is to officially certify that', 0, 125, {
          align: 'center',
        });

      // Candidate Name
      doc.font('Helvetica-Bold')
        .fontSize(32)
        .fillColor('#1e3a8a')
        .text(data.candidateName, 0, 150, {
          align: 'center',
        });

      // Name underline decoration
      const nameWidth = doc.widthOfString(data.candidateName);
      const startX = (pageWidth - Math.min(nameWidth + 60, 450)) / 2;
      doc.moveTo(startX, 192)
        .lineTo(startX + Math.min(nameWidth + 60, 450), 192)
        .lineWidth(1)
        .strokeColor('#cbd5e1')
        .stroke();

      // Body text
      doc.font('Helvetica')
        .fontSize(12)
        .fillColor('#334155')
        .text(
          `has successfully satisfied all academic and practical assessment standards for the approved skill qualification:`,
          100,
          208,
          { align: 'center', width: pageWidth - 200 }
        );

      // Course Name
      doc.font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#0f172a')
        .text(data.courseName, 80, 235, {
          align: 'center',
          width: pageWidth - 160,
        });

      // Training Centre & District
      doc.font('Helvetica')
        .fontSize(11)
        .fillColor('#64748b')
        .text(`Conducted through accredited facility:`, 0, 275, { align: 'center' });

      doc.font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#1e293b')
        .text(`${data.trainingCentreName} (${data.districtName} District)`, 0, 292, {
          align: 'center',
        });

      // Issue date & Unique ID details
      const formattedDate = new Date(data.issueDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#64748b')
        .text(`Date of Issuance: ${formattedDate}`, 80, 345);

      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#0f172a')
        .text(`Certificate Identifier: ${data.certificateNumber}`, 80, 362);

      doc.font('Helvetica')
        .fontSize(8.5)
        .fillColor('#94a3b8')
        .text(`Public Registry Verification: ${data.verificationUrl}`, 80, 378);

      // Embed QR Code
      doc.image(qrImageBuffer, 80, 400, { width: 90, height: 90 });
      doc.font('Helvetica')
        .fontSize(7.5)
        .fillColor('#64748b')
        .text('Scan with smartphone to verify authenticity directly from state records', 80, 495, { width: 120 });

      // Signatures
      const sigLineY = 475;

      // Signature 1: District Commissioner
      doc.moveTo(pageWidth - 450, sigLineY)
        .lineTo(pageWidth - 280, sigLineY)
        .lineWidth(1)
        .strokeColor('#94a3b8')
        .stroke();
      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#1e293b')
        .text('Authorized District Officer', pageWidth - 450, sigLineY + 6, { width: 170, align: 'center' });
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor('#64748b')
        .text('District Skilling Authority', pageWidth - 450, sigLineY + 20, { width: 170, align: 'center' });

      // Signature 2: State Directorate
      doc.moveTo(pageWidth - 240, sigLineY)
        .lineTo(pageWidth - 70, sigLineY)
        .lineWidth(1)
        .strokeColor('#94a3b8')
        .stroke();
      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#1e293b')
        .text('Director of Vocational Training', pageWidth - 240, sigLineY + 6, { width: 170, align: 'center' });
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor('#64748b')
        .text('State Skill Development Council', pageWidth - 240, sigLineY + 20, { width: 170, align: 'center' });

      // Official Seal Graphic (Circular Emblem in Center)
      const sealCenterX = pageWidth / 2;
      const sealCenterY = 460;
      doc.circle(sealCenterX, sealCenterY, 32)
        .lineWidth(2)
        .strokeColor('#d97706')
        .stroke();
      doc.circle(sealCenterX, sealCenterY, 28)
        .lineWidth(0.8)
        .strokeColor('#d97706')
        .stroke();
      doc.font('Helvetica-Bold')
        .fontSize(7)
        .fillColor('#d97706')
        .text('VERIFIED', sealCenterX - 20, sealCenterY - 10, { width: 40, align: 'center' });
      doc.font('Helvetica-Bold')
        .fontSize(6)
        .fillColor('#0f172a')
        .text('AUTHENTIC', sealCenterX - 20, sealCenterY + 2, { width: 40, align: 'center' });

      doc.end();

      writeStream.on('finish', () => {
        resolve({ filePath, qrCodeDataUrl });
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    });
  }
}
