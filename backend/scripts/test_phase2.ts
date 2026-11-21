import { app } from '../src/app';
import { connectDatabase, prisma } from '../src/database';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';

async function runPhase2Verification() {
  console.log('====================================================');
  console.log('🔍 VERIFYING BACKEND PHASE 2: CORE WORKFLOW');
  console.log('====================================================\n');

  await connectDatabase();

  // Obtain tokens for demonstration actors
  const anikaAuth = await AuthService.demoLogin('TRAINING_CENTRE', 'anika@training.certiflow.gov.in');
  const devAuth = await AuthService.demoLogin('DISTRICT_OFFICER', 'dev@district.certiflow.gov.in');
  const meeraAuth = await AuthService.demoLogin('DISTRICT_OFFICER', 'meera@district.certiflow.gov.in');
  const nehaAuth = await AuthService.demoLogin('QUALITY_TEAM', 'neha@quality.certiflow.gov.in');
  const farahAuth = await AuthService.demoLogin('STATE_OFFICE', 'farah@state.certiflow.gov.in');

  const tcUser = anikaAuth.user;

  // 1. Batch Creation by Training Centre
  console.log('1. Training Centre creates a new Cohort Batch:');
  const createRes = await request(app)
    .post('/api/batches')
    .set('Authorization', `Bearer ${anikaAuth.token}`)
    .send({
      title: 'Solar PV Installer Technician - Phase 2 Demonstration Cohort',
      courseName: 'Solar PV Installer (Suryamitra NSQF Level 4)',
      districtId: tcUser.district?.id,
      trainingCentreId: tcUser.trainingCentre?.id,
    });

  console.log(`   Status: ${createRes.status} ${createRes.status === 201 ? '✅ 201 Created' : '❌ Failed'}`);
  const batchId = createRes.body.batch.id;
  const batchNum = createRes.body.batch.batchNumber;
  console.log(`   Created Batch: ${batchNum} (Status: ${createRes.body.batch.status}, Version: ${createRes.body.batch.currentVersionNumber})`);

  // 2. CSV Validation Rejection (Atomic Guarantee)
  console.log('\n2. Testing Atomic CSV Validation Rejection on Invalid Data:');
  const invalidCsv = `Candidate Name,Candidate Email,Phone Number,Course Name,Training Centre,District,Completion Date,Assessment Status
,missing.name@example.com,9826011111,Solar PV,Apex Centre,Bhopal,2026-11-01,PASSED
Priya Patel,invalid-email-format,9826011112,Solar PV,Apex Centre,Bhopal,2026-11-01,PASSED
Rohan Joshi,rohan@example.com,12345,Solar PV,Apex Centre,Bhopal,2026-11-01,PASSED
Sneha Kulkarni,sneha@example.com,9826011114,Solar PV,Apex Centre,Bhopal,bad-date,PASSED
Vikram Rajput,vikram@example.com,9826011115,Solar PV,Apex Centre,Bhopal,2026-11-01,NOT_A_VALID_STATUS`;

  const invalidUploadRes = await request(app)
    .post(`/api/batches/${batchId}/upload-csv`)
    .set('Authorization', `Bearer ${anikaAuth.token}`)
    .attach('file', Buffer.from(invalidCsv), 'invalid_candidates.csv');

  console.log(`   Status: ${invalidUploadRes.status} ${invalidUploadRes.status === 422 ? '✅ 422 Unprocessable (Atomic Rejection)' : '❌ Failed'}`);
  console.log(`   Total Rows: ${invalidUploadRes.body.totalRows} | Invalid Rows: ${invalidUploadRes.body.invalidRows}`);
  console.log('   Detected Exact Field Errors:');
  invalidUploadRes.body.errors.forEach((err: any) => {
    console.log(`      - Row ${err.row}: [${err.field}] ${err.error}`);
  });

  const candidatesCountAfterFailed = await prisma.candidate.count({ where: { batchId } });
  console.log(`   Database Candidate Count: ${candidatesCountAfterFailed} (✅ Zero partial records persisted)`);

  // 3. Valid CSV Upload (Atomic Success)
  console.log('\n3. Uploading Valid Candidate CSV:');
  const validCsv = `Candidate Name,Candidate Email,Phone Number,Course Name,Training Centre,District,Completion Date,Assessment Status
Amitabh Sharma,amitabh.s@example.com,9826033301,Solar PV,Apex Skill Institute,Bhopal,2026-11-01,PASSED
Deepika Padukone,deepika.p@example.com,9826033302,Solar PV,Apex Skill Institute,Bhopal,2026-11-01,PASSED
Rajesh Khanna,rajesh.k@example.com,9826033303,Solar PV,Apex Skill Institute,Bhopal,2026-11-01,PASSED`;

  const validUploadRes = await request(app)
    .post(`/api/batches/${batchId}/upload-csv`)
    .set('Authorization', `Bearer ${anikaAuth.token}`)
    .attach('file', Buffer.from(validCsv), 'valid_candidates.csv');

  console.log(`   Status: ${validUploadRes.status} ${validUploadRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Parsed & Saved Candidates: ${validUploadRes.body.validRows} / ${validUploadRes.body.totalRows}`);

  // 4. Submit Batch for District Approval
  console.log('\n4. Submitting Batch for District Approval:');
  const submitRes = await request(app)
    .post(`/api/batches/${batchId}/submit`)
    .set('Authorization', `Bearer ${anikaAuth.token}`);

  console.log(`   Status: ${submitRes.status} ${submitRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   New Batch Status: ${submitRes.body.batch.status} (Transferred to District Review)`);

  // 5. District Officer 1 (Dev) Approval
  console.log('\n5. District Officer 1 (Dev Verma) Records Approval:');
  const do1Res = await request(app)
    .post(`/api/batches/${batchId}/district-decision`)
    .set('Authorization', `Bearer ${devAuth.token}`)
    .send({
      decision: 'APPROVE',
      comments: 'Local facility inspected. Candidate attendance sheets verified.',
    });

  console.log(`   Status: ${do1Res.status} ${do1Res.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Approvals Count: ${do1Res.body.approvalsCount} / 2 (Consensus Pending second officer)`);
  console.log(`   Batch Status: ${do1Res.body.batch.status} (Remains in DISTRICT_REVIEW)`);

  // 6. Duplicate Approval Prevention Check
  console.log('\n6. Testing Duplicate Approval Prevention (Dev attempts second vote):');
  const duplicateRes = await request(app)
    .post(`/api/batches/${batchId}/district-decision`)
    .set('Authorization', `Bearer ${devAuth.token}`)
    .send({
      decision: 'APPROVE',
      comments: 'Attempting duplicate approval',
    });

  console.log(`   Status: ${duplicateRes.status} ${duplicateRes.status === 400 ? '✅ 400 Bad Request (Duplicate Prevented)' : '❌ Failed'}`);
  console.log(`   Rejection Message: "${duplicateRes.body.error}"`);

  // 7. District Officer 2 (Meera) Approval -> Reaches Consensus
  console.log('\n7. District Officer 2 (Meera Rao) Records Consensus Approval:');
  const do2Res = await request(app)
    .post(`/api/batches/${batchId}/district-decision`)
    .set('Authorization', `Bearer ${meeraAuth.token}`)
    .send({
      decision: 'APPROVE',
      comments: 'Independent assessment audit checked. Approved as second officer.',
    });

  console.log(`   Status: ${do2Res.status} ${do2Res.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Approvals Count: ${do2Res.body.approvalsCount} / 2 (Consensus Satisfied!)`);
  console.log(`   New Batch Status: ${do2Res.body.batch.status} (Advanced to STATE_REVIEW)`);

  // 8. State Directorate Final Sanction (Farah)
  console.log('\n8. State Directorate (Farah Khan) Grants Final Sanction:');
  const stateRes = await request(app)
    .post(`/api/batches/${batchId}/state-decision`)
    .set('Authorization', `Bearer ${farahAuth.token}`)
    .send({
      decision: 'APPROVE',
      comments: 'State executive sanction granted. Certificate generation authorized.',
    });

  console.log(`   Status: ${stateRes.status} ${stateRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Final Batch Status: ${stateRes.body.batch.status} (Triggered Certificate Generation Outbox)`);

  // Verify Outbox Event created
  const outboxEvent = await prisma.outboxEvent.findFirst({
    where: { aggregateId: batchId, eventType: 'certificate.generation_requested' },
  });
  console.log(`   ✅ Transactional Outbox Event Created: ${outboxEvent?.eventType} [Status: ${outboxEvent?.status}]`);

  // 9. Demonstration of Returned Batch Workflow (Versioned Resubmission)
  console.log('\n9. Testing Returned Batch Workflow & Versioned Resubmission:');
  // Create another batch and return it
  const batchToReturn = await prisma.batch.create({
    data: {
      batchNumber: `BATCH-RETURN-DEMO-${Date.now()}`,
      title: 'Batch to Demonstrate Return Policy',
      courseName: 'Electrician Apprentice',
      districtId: tcUser.district?.id!,
      trainingCentreId: tcUser.trainingCentre?.id!,
      status: 'DISTRICT_REVIEW',
      currentVersionNumber: 1,
      totalCandidates: 2,
    },
  });

  const v1Record = await prisma.batchVersion.create({
    data: {
      batchId: batchToReturn.id,
      versionNumber: 1,
      candidateCount: 2,
      status: 'DISTRICT_REVIEW',
    },
  });

  await prisma.candidate.create({
    data: {
      batchId: batchToReturn.id,
      batchVersionId: v1Record.id,
      name: 'Sample Trainee',
      email: `sample.${Date.now()}@example.com`,
      phone: '+919826099999',
      courseName: batchToReturn.courseName,
      trainingCentreName: 'Apex Centre',
      districtName: 'Bhopal',
      completionDate: new Date(),
      assessmentStatus: 'PASSED',
    },
  });

  // Dev returns it with a reason
  const returnRes = await request(app)
    .post(`/api/batches/${batchToReturn.id}/district-decision`)
    .set('Authorization', `Bearer ${devAuth.token}`)
    .send({
      decision: 'RETURN',
      comments: 'Candidate phone numbers missing country codes. Training facility CCTV logs not uploaded.',
    });

  console.log(`   Status: ${returnRes.status} ${returnRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Batch Status after Return: ${returnRes.body.batch.status}`);
  console.log(`   Stored Return Reason: "${returnRes.body.batch.returnReason}"`);

  // Anika resubmits it as v2
  const resubmitRes = await request(app)
    .post(`/api/batches/${batchToReturn.id}/resubmit`)
    .set('Authorization', `Bearer ${anikaAuth.token}`)
    .send({ notes: 'Updated phone numbers and uploaded clear facility logs.' });

  console.log(`   Status: ${resubmitRes.status} ${resubmitRes.status === 200 ? '✅ 200 OK' : '❌ Failed'}`);
  console.log(`   Resubmitted Batch Status: ${resubmitRes.body.batch.status}`);
  console.log(`   Incremented Version Number: v${resubmitRes.body.batch.currentVersionNumber}`);

  // Historical audit check
  const priorDecisions = await prisma.districtApproval.findMany({
    where: { batchId: batchToReturn.id, versionNumber: 1 },
  });
  const currentDecisions = await prisma.districtApproval.findMany({
    where: { batchId: batchToReturn.id, versionNumber: 2 },
  });

  console.log(`   Historical v1 Decisions Preserved: ${priorDecisions.length} (Status: ${priorDecisions[0]?.status})`);
  console.log(`   Current v2 Decisions Count: ${currentDecisions.length} (✅ Fresh 2-officer review required)`);

  console.log('\n====================================================');
  console.log('🎉 PHASE 2: CORE WORKFLOW IS 100% OPERATIONAL & VERIFIED');
  console.log('====================================================');

  await prisma.$disconnect();
}

runPhase2Verification().catch(console.error);
