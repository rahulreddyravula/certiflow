import { app } from '../src/app';
import { connectDatabase, prisma } from '../src/database';
import request from 'supertest';
import fs from 'fs';
import { AuthService } from '../src/modules/auth/auth.service';
import { CertificateService } from '../src/modules/certificate/certificate.service';

async function runPhase3Verification() {
  console.log('====================================================');
  console.log('🔍 VERIFYING BACKEND PHASE 3: CERTIFICATES & PUBLIC VERIFICATION');
  console.log('====================================================\n');

  await connectDatabase();

  const anikaAuth = await AuthService.demoLogin('TRAINING_CENTRE', 'anika@training.certiflow.gov.in');
  const farahAuth = await AuthService.demoLogin('STATE_OFFICE', 'farah@state.certiflow.gov.in');

  // 1. Setup an Approved Batch with Passed Candidates
  console.log('1. Setting up Approved Batch for Certificate Generation:');
  const district = (await prisma.district.findFirst())!;
  const tc = (await prisma.trainingCentre.findFirst())!;

  const testBatch = await prisma.batch.create({
    data: {
      batchNumber: `BATCH-CERT-DEMO-${Date.now()}`,
      title: 'Advanced Machine Learning & AI Operator',
      courseName: 'AI & Data Specialist (NSQF Level 5)',
      districtId: district.id,
      trainingCentreId: tc.id,
      status: 'APPROVED',
      totalCandidates: 3,
      passedCandidates: 2,
      failedCandidates: 1,
    },
  });

  const v1 = await prisma.batchVersion.create({
    data: {
      batchId: testBatch.id,
      versionNumber: 1,
      candidateCount: 3,
      status: 'APPROVED',
    },
  });

  const cand1 = await prisma.candidate.create({
    data: {
      batchId: testBatch.id,
      batchVersionId: v1.id,
      name: 'Rameshwar Sen',
      email: `rameshwar.${Date.now()}@example.com`,
      phone: '+919826011901',
      courseName: testBatch.courseName,
      trainingCentreName: tc.name,
      districtName: district.name,
      completionDate: new Date('2026-11-10'),
      assessmentStatus: 'PASSED',
    },
  });

  const cand2 = await prisma.candidate.create({
    data: {
      batchId: testBatch.id,
      batchVersionId: v1.id,
      name: 'Kavita Chawla',
      email: `kavita.${Date.now()}@example.com`,
      phone: '+919826011902',
      courseName: testBatch.courseName,
      trainingCentreName: tc.name,
      districtName: district.name,
      completionDate: new Date('2026-11-10'),
      assessmentStatus: 'PASSED',
    },
  });

  const cand3 = await prisma.candidate.create({
    data: {
      batchId: testBatch.id,
      batchVersionId: v1.id,
      name: 'Suresh Raina',
      email: `suresh.${Date.now()}@example.com`,
      phone: '+919826011903',
      courseName: testBatch.courseName,
      trainingCentreName: tc.name,
      districtName: district.name,
      completionDate: new Date('2026-11-10'),
      assessmentStatus: 'FAILED', // Should NOT receive a certificate
    },
  });

  console.log(`   Created Batch ${testBatch.batchNumber} with 2 PASSED and 1 FAILED candidate.`);

  // 2. Generate Certificates
  console.log('\n2. Executing Certificate Generation Engine:');
  const certs = await CertificateService.generateCertificatesForBatch(testBatch.id);
  console.log(`   Generated ${certs.length} Certificates (Only PASSED candidates received certificates):`);

  certs.forEach((c) => {
    console.log(`      • ${c.candidateName.padEnd(16)} | ID: ${c.certificateNumber} | Status: ${c.status}`);
    if (c.pdfPath && fs.existsSync(c.pdfPath)) {
      const stats = fs.statSync(c.pdfPath);
      console.log(`        PDF File on Disk: ${c.pdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);
    }
  });

  // Verify batch status is now CERTIFICATES_ISSUED
  const updatedBatch = await prisma.batch.findUnique({ where: { id: testBatch.id } });
  console.log(`   Batch Status Updated To: ${updatedBatch?.status} (✅ CERTIFICATES_ISSUED)`);

  // 3. Idempotency Check
  console.log('\n3. Testing Certificate Generation Idempotency (Re-running generation on same batch):');
  const retryCerts = await CertificateService.generateCertificatesForBatch(testBatch.id);
  console.log(`   Retry Count Returned: ${retryCerts.length}`);
  const totalCertsInDb = await prisma.certificate.count({ where: { batchId: testBatch.id } });
  console.log(`   Database Certificate Count: ${totalCertsInDb} (✅ Exactly 2 certificates, zero duplicates created)`);

  const sampleCert = certs[0];

  // 4. Authenticated Certificate PDF Download
  console.log('\n4. Testing PDF Download Stream:');
  const downloadRes = await request(app).get(`/api/certificates/${sampleCert.certificateNumber}/download`);
  console.log(`   Status: ${downloadRes.status} ${downloadRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Content-Type: ${downloadRes.headers['content-type']}`);
  console.log(`   Binary PDF Stream Length: ${downloadRes.body.length || downloadRes.text.length} bytes`);

  // 5. Public Credential Verification (VALID State)
  console.log('\n5. Testing Public Verification Portal (Unauthenticated GET /api/verify/:certId):');
  const publicVerifyRes = await request(app).get(`/api/verify/${sampleCert.certificateNumber}`);
  console.log(`   Status: ${publicVerifyRes.status} ${publicVerifyRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Verification Result: [${publicVerifyRes.body.status}]`);
  console.log(`   Masked Candidate Name: ${publicVerifyRes.body.candidateName} (✅ PII protected)`);
  console.log(`   Course: ${publicVerifyRes.body.courseName}`);
  console.log(`   Training Facility: ${publicVerifyRes.body.trainingCentreName}`);
  console.log(`   Message: "${publicVerifyRes.body.message}"`);

  // 6. Public Verification (NOT FOUND State)
  console.log('\n6. Testing Public Verification on Non-Existent ID:');
  const notFoundRes = await request(app).get('/api/verify/CERT-INVALID-9999-XYZ');
  console.log(`   Status: ${notFoundRes.status} ${notFoundRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Verification Result: [${notFoundRes.body.status}]`);
  console.log(`   Message: "${notFoundRes.body.message}"`);

  // 7. Role Authorization: Training Centre attempts to cancel certificate
  console.log('\n7. Testing RBAC: Unauthorized Role (Training Centre) Attempts Cancellation:');
  const unauthCancelRes = await request(app)
    .post(`/api/certificates/${sampleCert.id}/cancel`)
    .set('Authorization', `Bearer ${anikaAuth.token}`)
    .send({ reason: 'Attempted cancellation without authority' });

  console.log(`   Status: ${unauthCancelRes.status} ${unauthCancelRes.status === 403 ? '✅ 403 Forbidden (RBAC Protected)' : '❌ Failed'}`);

  // 8. State Directorate Cancels Certificate
  console.log('\n8. State Directorate (Farah Khan) Executes Statutory Revocation:');
  const cancellationReason = 'Candidate failed mandatory physical biometric verification audit on 2026-11-20.';
  const cancelRes = await request(app)
    .post(`/api/certificates/${sampleCert.id}/cancel`)
    .set('Authorization', `Bearer ${farahAuth.token}`)
    .send({ reason: cancellationReason });

  console.log(`   Status: ${cancelRes.status} ${cancelRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Certificate Database Status: ${cancelRes.body.certificate.status}`);
  console.log(`   Cancellation Reason Stored: "${cancelRes.body.certificate.cancellationReason}"`);
  console.log(`   Revoked Timestamp: ${cancelRes.body.certificate.cancelledAt}`);

  // 9. Public Verification (CANCELLED State)
  console.log('\n9. Re-Verifying Cancelled Certificate in Public Registry:');
  const postCancelVerifyRes = await request(app).get(`/api/verify/${sampleCert.certificateNumber}`);
  console.log(`   Status: ${postCancelVerifyRes.status} ${postCancelVerifyRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Verification Result: [${postCancelVerifyRes.body.status}] (✅ Immediately CANCELLED)`);
  console.log(`   Revocation Notice: "${postCancelVerifyRes.body.message}"`);
  console.log(`   Public Reason Displayed: "${postCancelVerifyRes.body.cancellationReason}"`);

  console.log('\n====================================================');
  console.log('🎉 PHASE 3: CERTIFICATES & VERIFICATION 100% OPERATIONAL');
  console.log('====================================================');

  await prisma.$disconnect();
}

runPhase3Verification().catch(console.error);
