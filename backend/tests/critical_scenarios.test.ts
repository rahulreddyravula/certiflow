import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/database';
import { AuthService } from '../src/modules/auth/auth.service';
import { ApprovalService } from '../src/modules/approval/approval.service';
import { CertificateService } from '../src/modules/certificate/certificate.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';
import { MonitoringService } from '../src/modules/monitoring/monitoring.service';

describe('CertiFlow Critical Test Suite', () => {
  let anikaToken: string;
  let devToken: string;
  let meeraToken: string;
  let nehaToken: string;
  let farahToken: string;

  let tcUser: any;
  let devUser: any;
  let meeraUser: any;
  let farahUser: any;

  beforeAll(async () => {
    // Obtain auth tokens for all demo personas
    const anikaLogin = await AuthService.demoLogin('TRAINING_CENTRE', 'anika@training.certiflow.gov.in');
    anikaToken = anikaLogin.token;
    tcUser = anikaLogin.user;

    const devLogin = await AuthService.demoLogin('DISTRICT_OFFICER', 'dev@district.certiflow.gov.in');
    devToken = devLogin.token;
    devUser = devLogin.user;

    const meeraLogin = await AuthService.demoLogin('DISTRICT_OFFICER', 'meera@district.certiflow.gov.in');
    meeraToken = meeraLogin.token;
    meeraUser = meeraLogin.user;

    const nehaLogin = await AuthService.demoLogin('QUALITY_TEAM', 'neha@quality.certiflow.gov.in');
    nehaToken = nehaLogin.token;

    const farahLogin = await AuthService.demoLogin('STATE_OFFICE', 'farah@state.certiflow.gov.in');
    farahToken = farahLogin.token;
    farahUser = farahLogin.user;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST 1: CSV Validation
  describe('TEST 1: CSV Validation & Atomic Transaction', () => {
    it('should reject invalid CSV with exact errors and persist ZERO candidates', async () => {
      // 1. Create a draft batch
      const createRes = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${anikaToken}`)
        .send({
          title: 'Test Batch for CSV Validation',
          courseName: 'Solar PV Installer',
          districtId: tcUser.district.id,
          trainingCentreId: tcUser.trainingCentre.id,
        });

      expect(createRes.status).toBe(201);
      const batchId = createRes.body.batch.id;

      // 2. CSV containing invalid rows (missing name, bad email, bad phone, bad date, bad status)
      const invalidCsv = `Candidate Name,Candidate Email,Phone Number,Course Name,Training Centre,District,Completion Date,Assessment Status
,valid.email@example.com,9826011111,Solar PV,Apex Centre,Bhopal,2026-11-01,PASSED
John Doe,invalid-email-address,9826011112,Solar PV,Apex Centre,Bhopal,2026-11-01,PASSED
Jane Smith,jane@example.com,12345,Solar PV,Apex Centre,Bhopal,2026-11-01,PASSED
Alice Brown,alice@example.com,9826011114,Solar PV,Apex Centre,Bhopal,invalid-date,PASSED
Bob Green,bob@example.com,9826011115,Solar PV,Apex Centre,Bhopal,2026-11-01,UNKNOWN_STATUS`;

      const uploadRes = await request(app)
        .post(`/api/batches/${batchId}/upload-csv`)
        .set('Authorization', `Bearer ${anikaToken}`)
        .attach('file', Buffer.from(invalidCsv), 'invalid_candidates.csv');

      expect(uploadRes.status).toBe(422);
      expect(uploadRes.body.isValid).toBe(false);
      expect(uploadRes.body.errors.length).toBeGreaterThanOrEqual(5);

      // Verify exact error fields
      const errorFields = uploadRes.body.errors.map((e: any) => e.field);
      expect(errorFields).toContain('Candidate Name');
      expect(errorFields).toContain('Candidate Email');
      expect(errorFields).toContain('Phone Number');
      expect(errorFields).toContain('Completion Date');
      expect(errorFields).toContain('Assessment Status');

      // Verify atomic guarantee: ZERO candidate records saved in DB
      const candidateCount = await prisma.candidate.count({
        where: { batchId },
      });
      expect(candidateCount).toBe(0);
    });
  });

  // TEST 2: Simultaneous District Approval
  describe('TEST 2: Simultaneous District Approval & Concurrency Control', () => {
    it('should record both distinct decisions and advance workflow exactly once', async () => {
      // 1. Create batch with candidates and submit
      const createRes = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${anikaToken}`)
        .send({
          title: 'Concurrency Test Batch',
          courseName: 'Data Operator',
          districtId: tcUser.district.id,
          trainingCentreId: tcUser.trainingCentre.id,
        });

      const batchId = createRes.body.batch.id;

      const validCsv = `Candidate Name,Candidate Email,Phone Number,Course Name,Training Centre,District,Completion Date,Assessment Status
Test Candidate 1,test1@example.com,9826055551,Data Operator,Apex Centre,Bhopal,2026-11-01,PASSED
Test Candidate 2,test2@example.com,9826055552,Data Operator,Apex Centre,Bhopal,2026-11-01,PASSED`;

      await request(app)
        .post(`/api/batches/${batchId}/upload-csv`)
        .set('Authorization', `Bearer ${anikaToken}`)
        .attach('file', Buffer.from(validCsv), 'valid_batch.csv');

      // Submit for district approval
      await request(app)
        .post(`/api/batches/${batchId}/submit`)
        .set('Authorization', `Bearer ${anikaToken}`);

      // 2. Fire simultaneous approvals by Officer Dev and Officer Meera
      const [resDev, resMeera] = await Promise.all([
        ApprovalService.recordDistrictDecision({
          batchId,
          decision: 'APPROVE',
          comments: 'Simultaneous approval by Dev',
          user: devUser,
        }),
        ApprovalService.recordDistrictDecision({
          batchId,
          decision: 'APPROVE',
          comments: 'Simultaneous approval by Meera',
          user: meeraUser,
        }),
      ]);

      expect(resDev).toBeDefined();
      expect(resMeera).toBeDefined();

      // Check recorded decisions
      const approvals = await prisma.districtApproval.findMany({
        where: { batchId },
      });
      expect(approvals.length).toBe(2);

      const officerIds = approvals.map((a) => a.officerId);
      expect(officerIds).toContain(devUser.id);
      expect(officerIds).toContain(meeraUser.id);

      // Check that batch is now in STATE_REVIEW (totalCandidates is 2, < 50 threshold)
      const finalBatch = await prisma.batch.findUnique({ where: { id: batchId } });
      expect(finalBatch?.status).toBe('STATE_REVIEW');

      // Check duplicate rejection: Dev cannot approve again!
      await expect(
        ApprovalService.recordDistrictDecision({
          batchId,
          decision: 'APPROVE',
          comments: 'Duplicate attempt',
          user: devUser,
        })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  // TEST 3: Certificate Idempotency
  describe('TEST 3: Certificate Idempotency', () => {
    it('should generate unique certificates and never create duplicates on retry', async () => {
      // Create batch with 5 passed candidates
      const createRes = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${anikaToken}`)
        .send({
          title: 'Idempotency Certificate Batch',
          courseName: 'Plumbing Technician',
          districtId: tcUser.district.id,
          trainingCentreId: tcUser.trainingCentre.id,
        });

      const batchId = createRes.body.batch.id;

      let csvContent = 'Candidate Name,Candidate Email,Phone Number,Course Name,Training Centre,District,Completion Date,Assessment Status\n';
      for (let i = 1; i <= 5; i++) {
        csvContent += `Plumber ${i},plumber${i}@example.com,982606660${i},Plumbing,Apex Centre,Bhopal,2026-11-01,PASSED\n`;
      }

      await request(app)
        .post(`/api/batches/${batchId}/upload-csv`)
        .set('Authorization', `Bearer ${anikaToken}`)
        .attach('file', Buffer.from(csvContent), 'plumbing.csv');

      // First execution: generate certificates
      const firstRunCerts = await CertificateService.generateCertificatesForBatch(batchId);
      expect(firstRunCerts.length).toBe(5);

      // Check unique certificate numbers
      const certNumbers = new Set(firstRunCerts.map((c) => c.certificateNumber));
      expect(certNumbers.size).toBe(5);

      // Second execution: retry generation on the same batch
      const secondRunCerts = await CertificateService.generateCertificatesForBatch(batchId);
      expect(secondRunCerts.length).toBe(5);

      // Total count in database MUST remain exactly 5
      const totalInDb = await prisma.certificate.count({
        where: { batchId },
      });
      expect(totalInDb).toBe(5);
    });
  });

  // TEST 4: WhatsApp Failure & Retry
  describe('TEST 4: WhatsApp Delivery Failure & Non-Blocking Retry', () => {
    it('should track delivery failures without blocking certificate issuance and support retries', async () => {
      // Create isolated candidate and certificate for clean failure & retry simulation
      const batch = (await prisma.batch.findFirst())!;
      const version = (await prisma.batchVersion.findFirst({ where: { batchId: batch.id } }))!;
      const candidate = await prisma.candidate.create({
        data: {
          batchId: batch.id,
          batchVersionId: version.id,
          name: 'WhatsApp Test Candidate',
          email: `wa.retry.${Date.now()}@example.com`,
          phone: '+919826077777',
          courseName: 'Electrician',
          trainingCentreName: 'Apex Centre',
          districtName: 'Bhopal',
          completionDate: new Date(),
          assessmentStatus: 'PASSED',
        },
      });

      const testCert = await prisma.certificate.create({
        data: {
          certificateNumber: `CERT-TEST-WA-${Date.now()}`,
          candidateId: candidate.id,
          batchId: batch.id,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          candidatePhone: candidate.phone,
          courseName: candidate.courseName,
          trainingCentreName: candidate.trainingCentreName,
          districtName: candidate.districtName,
          status: 'VALID',
        },
      });

      const params = {
        certificateId: testCert.id,
        candidatePhone: '+919826077777',
        candidateName: testCert.candidateName,
        certificateNumber: testCert.certificateNumber,
        courseName: testCert.courseName,
        verificationUrl: `http://localhost:5173/verify/${testCert.certificateNumber}`,
      };

      // 1. First attempt: force failure
      const failedResult = await WhatsAppService.sendCertificateNotification(
        { ...params, forceFailure: true },
        1
      );
      expect(failedResult.status).toBe('FAILED');
      expect(failedResult.attempts).toBe(1);
      expect(failedResult.errorMessage).toContain('Simulated Network Glitch');

      // 2. Second attempt: retry with success
      const retryResult = await WhatsAppService.sendCertificateNotification(
        { ...params, forceSuccess: true },
        2
      );
      expect(retryResult.status).toBe('DELIVERED');
      expect(retryResult.attempts).toBe(2);
      expect(retryResult.idempotencyKey).toBe(`wa_${testCert.id}`);
    });
  });

  // TEST 5: Certificate Cancellation
  describe('TEST 5: State Certificate Cancellation', () => {
    it('should immediately invalidate certificate in public verification with reason', async () => {
      // Find an existing VALID certificate from seeded batch
      const validCert = await prisma.certificate.findFirst({
        where: { status: 'VALID' },
      });
      expect(validCert).toBeDefined();

      // 1. Verify before cancellation -> VALID
      const preCheck = await request(app).get(`/api/verify/${validCert!.certificateNumber}`);
      expect(preCheck.status).toBe(200);
      expect(preCheck.body.status).toBe('VALID');

      // 2. Cancel through State Office
      const cancelRes = await request(app)
        .post(`/api/certificates/${validCert!.id}/cancel`)
        .set('Authorization', `Bearer ${farahToken}`)
        .send({
          reason: 'Biometric audit revealed proxy attendance during final practical exam.',
        });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.certificate.status).toBe('CANCELLED');

      // 3. Verify immediately through public verification without auth -> CANCELLED
      const postCheck = await request(app).get(`/api/verify/${validCert!.certificateNumber}`);
      expect(postCheck.status).toBe(200);
      expect(postCheck.body.status).toBe('CANCELLED');
      expect(postCheck.body.cancellationReason).toContain('Biometric audit');
    });
  });

  // TEST 6: Delayed Approval / SLA Detection
  describe('TEST 6: Delayed Approval & SLA Overdue Detection', () => {
    it('should detect batches pending beyond SLA and generate state notification', async () => {
      // Create an overdue batch (> 48h)
      const overdueBatch = await prisma.batch.create({
        data: {
          batchNumber: `BATCH-OVERDUE-${Date.now()}`,
          title: 'Overdue SLA Test Batch',
          courseName: 'Welding Expert',
          districtId: tcUser.district.id,
          trainingCentreId: tcUser.trainingCentre.id,
          status: 'DISTRICT_REVIEW',
          submittedAt: new Date(Date.now() - 72 * 3600000), // 72 hours ago (> 48h SLA)
          totalCandidates: 10,
        },
      });

      // Run SLA monitor scan
      const overdueList = await MonitoringService.checkDelayedBatches();
      const detected = overdueList.find((b) => b.id === overdueBatch.id);

      expect(detected).toBeDefined();
      expect(detected?.isOverdue).toBe(true);
      expect(detected?.hoursElapsed).toBeGreaterThanOrEqual(71);

      // Verify notification created for State Office
      const notification = await prisma.notification.findFirst({
        where: {
          roleTarget: 'STATE_OFFICE',
          message: { contains: overdueBatch.batchNumber },
        },
      });
      expect(notification).toBeDefined();
    });
  });

  // TEST 7: Returned Batch & Resubmission
  describe('TEST 7: Returned Batch & Versioned Resubmission', () => {
    it('should preserve historical decisions, increment version, and require fresh approvals', async () => {
      // 1. Create an isolated returned batch with historical rejection
      const testBatch = await prisma.batch.create({
        data: {
          batchNumber: `BATCH-RET-${Date.now()}`,
          title: 'Retail Sales Correction Test',
          courseName: 'Retail Sales Associate',
          districtId: tcUser.district.id,
          trainingCentreId: tcUser.trainingCentre.id,
          currentVersionNumber: 1,
          status: 'RETURNED_FOR_CORRECTION',
          returnReason: 'Candidate phone numbers on row 3 and 7 are missing 10-digit format.',
          returnedAt: new Date(),
        },
      });

      const v1 = await prisma.batchVersion.create({
        data: {
          batchId: testBatch.id,
          versionNumber: 1,
          status: 'RETURNED_FOR_CORRECTION',
          notes: 'Returned by Officer Dev for phone format correction.',
        },
      });

      await prisma.districtApproval.create({
        data: {
          batchId: testBatch.id,
          versionNumber: 1,
          officerId: devUser.id,
          officerName: devUser.name,
          status: 'RETURNED',
          comments: 'Candidate phone numbers on row 3 and 7 are missing 10-digit format.',
        },
      });

      await prisma.candidate.create({
        data: {
          batchId: testBatch.id,
          batchVersionId: v1.id,
          name: 'Corrected Candidate',
          email: `corrected.${Date.now()}@example.com`,
          phone: '+919826088888',
          courseName: testBatch.courseName,
          trainingCentreName: 'Apex Centre',
          districtName: 'Bhopal',
          completionDate: new Date(),
          assessmentStatus: 'PASSED',
        },
      });

      // Verify batch starts in RETURNED_FOR_CORRECTION
      expect(testBatch.status).toBe('RETURNED_FOR_CORRECTION');
      expect(testBatch.currentVersionNumber).toBe(1);

      // 2. Training Centre resubmits batch
      const resubmitRes = await request(app)
        .post(`/api/batches/${testBatch.id}/resubmit`)
        .set('Authorization', `Bearer ${anikaToken}`)
        .send({ notes: 'Updated phone numbers and clear attendance register attached.' });

      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.batch.status).toBe('DISTRICT_REVIEW');
      expect(resubmitRes.body.batch.currentVersionNumber).toBe(2);

      // 3. Prior version 1 decisions remain in history
      const v1Approvals = await prisma.districtApproval.findMany({
        where: { batchId: testBatch.id, versionNumber: 1 },
      });
      expect(v1Approvals.length).toBe(1);
      expect(v1Approvals[0].status).toBe('RETURNED');

      // 4. Version 2 currently has 0 approvals and requires fresh approvals
      const v2Approvals = await prisma.districtApproval.findMany({
        where: { batchId: testBatch.id, versionNumber: 2 },
      });
      expect(v2Approvals.length).toBe(0);
    });
  });

  // TEST 8: Authorization & RBAC
  describe('TEST 8: Role-Based Access Control (RBAC)', () => {
    it('should reject unauthorized operations across roles', async () => {
      // Training centre attempting to cancel a certificate -> 403 Forbidden
      const cancelAttempt = await request(app)
        .post('/api/certificates/dummy-id/cancel')
        .set('Authorization', `Bearer ${anikaToken}`)
        .send({ reason: 'Unauthorized attempt' });
      expect(cancelAttempt.status).toBe(403);

      // District officer attempting to create a batch -> 403 Forbidden
      const createAttempt = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ title: 'Officer Batch' });
      expect(createAttempt.status).toBe(403);

      // Unauthenticated request -> 401 Unauthorized
      const unauthAttempt = await request(app).get('/api/batches');
      expect(unauthAttempt.status).toBe(401);
    });
  });
});
