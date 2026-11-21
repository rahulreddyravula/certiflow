import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CertiFlow database seeding...');

  // 1. Clean existing records in dependency order
  await prisma.outboxEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.whatsAppDeliveryLog.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.districtApproval.deleteMany();
  await prisma.qualityReview.deleteMany();
  await prisma.stateApproval.deleteMany();
  await prisma.batchVersion.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.trainingCentre.deleteMany();
  await prisma.district.deleteMany();
  await prisma.systemConfig.deleteMany();

  // 2. System Configuration
  await prisma.systemConfig.createMany({
    data: [
      { key: 'LARGE_BATCH_THRESHOLD', value: '50', description: 'Candidate count threshold triggering mandatory Quality Team review' },
      { key: 'SLA_HOURS_DISTRICT', value: '48', description: 'District approval SLA target in hours' },
      { key: 'SLA_HOURS_STATE', value: '48', description: 'State approval SLA target in hours' },
    ],
  });

  // 3. Districts
  const districtBhopal = await prisma.district.create({
    data: {
      code: 'BPL',
      name: 'Bhopal',
      state: 'Madhya Pradesh',
    },
  });

  const districtIndore = await prisma.district.create({
    data: {
      code: 'IND',
      name: 'Indore',
      state: 'Madhya Pradesh',
    },
  });

  const districtJabalpur = await prisma.district.create({
    data: {
      code: 'JBP',
      name: 'Jabalpur',
      state: 'Madhya Pradesh',
    },
  });

  // 4. Training Centres
  const tcBhopal = await prisma.trainingCentre.create({
    data: {
      code: 'TC-BPL-001',
      name: 'Apex Skill Institute Bhopal',
      districtId: districtBhopal.id,
      address: 'Plot 42, MP Nagar Zone II, Bhopal',
      contactEmail: 'apex.bhopal@skills.org',
      contactPhone: '+91 755 2445566',
    },
  });

  const tcIndore = await prisma.trainingCentre.create({
    data: {
      code: 'TC-IND-001',
      name: 'Pragati Kaushal Kendra Indore',
      districtId: districtIndore.id,
      address: 'Industrial Area Sector 3, Sanwer Road, Indore',
      contactEmail: 'pragati.indore@skills.org',
      contactPhone: '+91 731 2889900',
    },
  });

  // 5. Users
  const passwordHash = await bcrypt.hash('password123', 10);

  // Anika – Training Centre
  const userAnika = await prisma.user.create({
    data: {
      email: 'anika@training.certiflow.gov.in',
      passwordHash,
      name: 'Anika Sharma',
      role: 'TRAINING_CENTRE',
      trainingCentreId: tcBhopal.id,
      districtId: districtBhopal.id,
    },
  });

  // Dev – District Officer (Bhopal)
  const userDev = await prisma.user.create({
    data: {
      email: 'dev@district.certiflow.gov.in',
      passwordHash,
      name: 'Dev Verma',
      role: 'DISTRICT_OFFICER',
      districtId: districtBhopal.id,
    },
  });

  // Meera – District Officer (Bhopal)
  const userMeera = await prisma.user.create({
    data: {
      email: 'meera@district.certiflow.gov.in',
      passwordHash,
      name: 'Meera Rao',
      role: 'DISTRICT_OFFICER',
      districtId: districtBhopal.id,
    },
  });

  // Kabir – District Officer (Indore)
  const userKabir = await prisma.user.create({
    data: {
      email: 'kabir@district.certiflow.gov.in',
      passwordHash,
      name: 'Kabir Singh',
      role: 'DISTRICT_OFFICER',
      districtId: districtIndore.id,
    },
  });

  // Neha – Quality Team
  const userNeha = await prisma.user.create({
    data: {
      email: 'neha@quality.certiflow.gov.in',
      passwordHash,
      name: 'Neha Gupta',
      role: 'QUALITY_TEAM',
    },
  });

  // Farah – State Office
  const userFarah = await prisma.user.create({
    data: {
      email: 'farah@state.certiflow.gov.in',
      passwordHash,
      name: 'Farah Khan',
      role: 'STATE_OFFICE',
    },
  });

  console.log('✅ Demo users created: Anika, Dev, Meera, Kabir, Neha, Farah (password: password123)');

  // 6. Sample Batches

  // BATCH 1: Fully Issued (10 candidates, certificates generated, 1 cancelled, 1 failed whatsapp)
  const batch1 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-001',
      title: 'Data Entry & Digital Literacy Batch 01',
      courseName: 'Domestic Data Entry Operator (NSQF Level 4)',
      trainingCentreId: tcBhopal.id,
      districtId: districtBhopal.id,
      currentVersionNumber: 1,
      status: 'CERTIFICATES_ISSUED',
      totalCandidates: 10,
      passedCandidates: 9,
      failedCandidates: 1,
      requiresQualityReview: false,
      submittedAt: new Date(Date.now() - 7 * 86400000),
      approvedAt: new Date(Date.now() - 5 * 86400000),
    },
  });

  const batch1Version = await prisma.batchVersion.create({
    data: {
      batchId: batch1.id,
      versionNumber: 1,
      csvFileName: 'data_entry_bpl_batch01.csv',
      candidateCount: 10,
      status: 'APPROVED',
      notes: 'Initial upload validated successfully',
    },
  });

  // District approvals for Batch 1 (Dev and Meera)
  await prisma.districtApproval.createMany({
    data: [
      {
        batchId: batch1.id,
        versionNumber: 1,
        officerId: userDev.id,
        officerName: userDev.name,
        status: 'APPROVED',
        comments: 'Verified candidate attendance and training logs. Approved.',
        decidedAt: new Date(Date.now() - 6 * 86400000),
      },
      {
        batchId: batch1.id,
        versionNumber: 1,
        officerId: userMeera.id,
        officerName: userMeera.name,
        status: 'APPROVED',
        comments: 'Second officer review completed. Assessment scores cross-checked.',
        decidedAt: new Date(Date.now() - 5.5 * 86400000),
      },
    ],
  });

  // State approval for Batch 1 (Farah)
  await prisma.stateApproval.create({
    data: {
      batchId: batch1.id,
      versionNumber: 1,
      officerId: userFarah.id,
      officerName: userFarah.name,
      status: 'APPROVED',
      comments: 'State office final sanction granted. Proceed with certificate generation.',
      decidedAt: new Date(Date.now() - 5 * 86400000),
    },
  });

  // Candidates for Batch 1
  const candidateNames = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '+919826011111', passed: true },
    { name: 'Priya Patel', email: 'priya.patel@example.com', phone: '+919826011112', passed: true },
    { name: 'Rohan Joshi', email: 'rohan.joshi@example.com', phone: '+919826011113', passed: true },
    { name: 'Sneha Kulkarni', email: 'sneha.k@example.com', phone: '+919826011114', passed: true },
    { name: 'Vikram Rajput', email: 'vikram.r@example.com', phone: '+919826011115', passed: true },
    { name: 'Pooja Verma', email: 'pooja.verma@example.com', phone: '+919826011116', passed: true },
    { name: 'Amitabh Mishra', email: 'amitabh.m@example.com', phone: '+919826011117', passed: true },
    { name: 'Divya Nair', email: 'divya.nair@example.com', phone: '+919826011118', passed: true },
    { name: 'Karan Saxena', email: 'karan.s@example.com', phone: '+919826011119', passed: true },
    { name: 'Manish Tiwari', email: 'manish.t@example.com', phone: '+919826011120', passed: false },
  ];

  for (let i = 0; i < candidateNames.length; i++) {
    const item = candidateNames[i];
    const candidate = await prisma.candidate.create({
      data: {
        batchId: batch1.id,
        batchVersionId: batch1Version.id,
        name: item.name,
        email: item.email,
        phone: item.phone,
        courseName: batch1.courseName,
        trainingCentreName: tcBhopal.name,
        districtName: districtBhopal.name,
        completionDate: new Date('2026-10-31'),
        assessmentStatus: item.passed ? 'PASSED' : 'FAILED',
      },
    });

    if (item.passed) {
      const certNum = `CERT-2026-BPL-${String(i + 1).padStart(4, '0')}`;
      const isCancelled = i === 2; // Rohan Joshi cancelled

      const certificate = await prisma.certificate.create({
        data: {
          certificateNumber: certNum,
          candidateId: candidate.id,
          batchId: batch1.id,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          candidatePhone: candidate.phone,
          courseName: candidate.courseName,
          trainingCentreName: candidate.trainingCentreName,
          districtName: candidate.districtName,
          issueDate: new Date(Date.now() - 5 * 86400000),
          status: isCancelled ? 'CANCELLED' : 'VALID',
          pdfPath: `/certificates/${certNum}.pdf`,
          qrCodeDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=http://localhost:5173/verify/${certNum}`,
          cancelledAt: isCancelled ? new Date(Date.now() - 1 * 86400000) : null,
          cancelledById: isCancelled ? userFarah.id : null,
          cancellationReason: isCancelled ? 'Candidate failed mandatory practical biometric re-verification on 2026-11-15' : null,
        },
      });

      // WhatsApp delivery simulation for certificates
      const isFailedWA = i === 4; // Vikram Rajput failed
      await prisma.whatsAppDeliveryLog.create({
        data: {
          certificateId: certificate.id,
          candidatePhone: candidate.phone,
          candidateName: candidate.name,
          status: isFailedWA ? 'FAILED' : 'DELIVERED',
          attempts: isFailedWA ? 3 : 1,
          lastAttemptAt: new Date(Date.now() - 4 * 86400000),
          errorMessage: isFailedWA ? 'Simulated error: Telecom carrier timeout 504 Gateway Timeout' : null,
          idempotencyKey: `wa_${certificate.id}`,
          responsePayload: isFailedWA ? JSON.stringify({ error: 'Gateway timeout', code: 'ETIMEDOUT' }) : JSON.stringify({ messageId: `wamid.HBgL${i}99823`, status: 'delivered' }),
        },
      });
    }
  }

  // BATCH 2: In DISTRICT_REVIEW (1 of 2 approved by Dev, waiting for Meera)
  const batch2 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-002',
      title: 'Solar PV Installation & Maintenance Batch 02',
      courseName: 'Solar PV Installer (Suryamitra NSQF Level 4)',
      trainingCentreId: tcBhopal.id,
      districtId: districtBhopal.id,
      currentVersionNumber: 1,
      status: 'DISTRICT_REVIEW',
      totalCandidates: 25,
      passedCandidates: 24,
      failedCandidates: 1,
      requiresQualityReview: false,
      submittedAt: new Date(Date.now() - 1 * 86400000),
    },
  });

  const batch2Version = await prisma.batchVersion.create({
    data: {
      batchId: batch2.id,
      versionNumber: 1,
      csvFileName: 'solar_pv_installer_bpl_02.csv',
      candidateCount: 25,
      status: 'IN_REVIEW',
      notes: 'Submitted for district approval',
    },
  });

  // Approved by Dev only
  await prisma.districtApproval.create({
    data: {
      batchId: batch2.id,
      versionNumber: 1,
      officerId: userDev.id,
      officerName: userDev.name,
      status: 'APPROVED',
      comments: 'Site inspection completed. Training facility compliance verified. Approved as Officer 1.',
      decidedAt: new Date(Date.now() - 12 * 3600000),
    },
  });

  // Seed sample candidates for Batch 2
  for (let i = 1; i <= 5; i++) {
    await prisma.candidate.create({
      data: {
        batchId: batch2.id,
        batchVersionId: batch2Version.id,
        name: `Solar Trainee ${i}`,
        email: `solar.trainee${i}@example.com`,
        phone: `+91982602220${i}`,
        courseName: batch2.courseName,
        trainingCentreName: tcBhopal.name,
        districtName: districtBhopal.name,
        completionDate: new Date('2026-11-10'),
        assessmentStatus: 'PASSED',
      },
    });
  }

  // BATCH 3: In QUALITY_REVIEW (Large batch with 60 candidates, >= 50 threshold)
  // Both district officers (Dev & Meera) have approved. Awaiting Neha (Quality Team)!
  const batch3 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-003',
      title: 'Mega Healthcare & Nursing Assistant Batch 03',
      courseName: 'General Duty Assistant (Healthcare NSQF Level 4)',
      trainingCentreId: tcBhopal.id,
      districtId: districtBhopal.id,
      currentVersionNumber: 1,
      status: 'QUALITY_REVIEW',
      totalCandidates: 60,
      passedCandidates: 58,
      failedCandidates: 2,
      requiresQualityReview: true,
      submittedAt: new Date(Date.now() - 3 * 86400000),
    },
  });

  const batch3Version = await prisma.batchVersion.create({
    data: {
      batchId: batch3.id,
      versionNumber: 1,
      csvFileName: 'healthcare_assistant_bpl_mega.csv',
      candidateCount: 60,
      status: 'IN_QUALITY_REVIEW',
      notes: 'Batch candidate count (60) exceeds threshold (50). Quality review triggered.',
    },
  });

  await prisma.districtApproval.createMany({
    data: [
      {
        batchId: batch3.id,
        versionNumber: 1,
        officerId: userDev.id,
        officerName: userDev.name,
        status: 'APPROVED',
        comments: 'District review pass. Hospital clinical log verified.',
        decidedAt: new Date(Date.now() - 2.5 * 86400000),
      },
      {
        batchId: batch3.id,
        versionNumber: 1,
        officerId: userMeera.id,
        officerName: userMeera.name,
        status: 'APPROVED',
        comments: 'Practical clinical exam records checked. Forwarded for large-batch Quality Review.',
        decidedAt: new Date(Date.now() - 2 * 86400000),
      },
    ],
  });

  // Seed 5 sample candidates for Batch 3
  for (let i = 1; i <= 5; i++) {
    await prisma.candidate.create({
      data: {
        batchId: batch3.id,
        batchVersionId: batch3Version.id,
        name: `Healthcare Trainee ${i}`,
        email: `health.trainee${i}@example.com`,
        phone: `+91982603330${i}`,
        courseName: batch3.courseName,
        trainingCentreName: tcBhopal.name,
        districtName: districtBhopal.name,
        completionDate: new Date('2026-11-12'),
        assessmentStatus: 'PASSED',
      },
    });
  }

  // BATCH 4: In STATE_REVIEW (Approved by 2 District Officers, awaiting Farah)
  const batch4 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-004',
      title: 'CNC Machinist & Lathe Operator Batch 04',
      courseName: 'CNC Operator Turning (NSQF Level 3)',
      trainingCentreId: tcIndore.id,
      districtId: districtIndore.id,
      currentVersionNumber: 1,
      status: 'STATE_REVIEW',
      totalCandidates: 20,
      passedCandidates: 19,
      failedCandidates: 1,
      requiresQualityReview: false,
      submittedAt: new Date(Date.now() - 2 * 86400000),
    },
  });

  const batch4Version = await prisma.batchVersion.create({
    data: {
      batchId: batch4.id,
      versionNumber: 1,
      csvFileName: 'cnc_operator_indore_04.csv',
      candidateCount: 20,
      status: 'AWAITING_STATE_APPROVAL',
      notes: 'District approvals satisfied. Pending State Office sanction.',
    },
  });

  await prisma.districtApproval.createMany({
    data: [
      {
        batchId: batch4.id,
        versionNumber: 1,
        officerId: userKabir.id,
        officerName: userKabir.name,
        status: 'APPROVED',
        comments: 'Indore district industrial safety & technical exam logs verified.',
        decidedAt: new Date(Date.now() - 1.5 * 86400000),
      },
      {
        batchId: batch4.id,
        versionNumber: 1,
        officerId: userDev.id, // Dev acting as second authorized officer
        officerName: userDev.name,
        status: 'APPROVED',
        comments: 'Secondary district verification completed.',
        decidedAt: new Date(Date.now() - 1 * 86400000),
      },
    ],
  });

  // BATCH 5: RETURNED_FOR_CORRECTION (Demonstrating returned batch scenario)
  const batch5 = await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-005',
      title: 'Retail Sales & Customer Service Batch 05',
      courseName: 'Retail Sales Associate (NSQF Level 3)',
      trainingCentreId: tcBhopal.id,
      districtId: districtBhopal.id,
      currentVersionNumber: 1,
      status: 'RETURNED_FOR_CORRECTION',
      totalCandidates: 15,
      passedCandidates: 15,
      failedCandidates: 0,
      requiresQualityReview: false,
      submittedAt: new Date(Date.now() - 4 * 86400000),
      returnedAt: new Date(Date.now() - 2 * 86400000),
      returnReason: 'Candidate phone numbers on row 3 and 7 are missing the 10-digit format. Training centre attendance register page 4 is smudged. Please correct and re-upload.',
    },
  });

  await prisma.batchVersion.create({
    data: {
      batchId: batch5.id,
      versionNumber: 1,
      csvFileName: 'retail_sales_bpl_05_v1.csv',
      candidateCount: 15,
      status: 'RETURNED_FOR_CORRECTION',
      notes: 'Returned by Officer Dev for candidate phone number corrections.',
    },
  });

  await prisma.districtApproval.create({
    data: {
      batchId: batch5.id,
      versionNumber: 1,
      officerId: userDev.id,
      officerName: userDev.name,
      status: 'RETURNED',
      comments: 'Candidate phone numbers on row 3 and 7 are missing the 10-digit format. Training centre attendance register page 4 is smudged. Please correct and re-upload.',
      decidedAt: new Date(Date.now() - 2 * 86400000),
    },
  });

  // BATCH 6: DRAFT (Newly created batch by Training Centre Anika)
  await prisma.batch.create({
    data: {
      batchNumber: 'BATCH-2026-006',
      title: 'Automotive Electric Vehicle Specialist 06',
      courseName: 'EV Service Technician (NSQF Level 4)',
      trainingCentreId: tcBhopal.id,
      districtId: districtBhopal.id,
      currentVersionNumber: 1,
      status: 'DRAFT',
      totalCandidates: 0,
      passedCandidates: 0,
      failedCandidates: 0,
    },
  });

  // 7. Seed Initial Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: userMeera.id,
        roleTarget: 'DISTRICT_OFFICER',
        title: 'Action Required: Batch Awaiting 2nd Approval',
        message: 'Batch BATCH-2026-002 was approved by Officer Dev Verma and requires your secondary review.',
        type: 'WARNING',
        link: '/batches',
      },
      {
        userId: userNeha.id,
        roleTarget: 'QUALITY_TEAM',
        title: 'Quality Review Triggered: Large Batch',
        message: 'Batch BATCH-2026-003 has 60 candidates and requires Quality Team clearance.',
        type: 'INFO',
        link: '/quality',
      },
      {
        userId: userFarah.id,
        roleTarget: 'STATE_OFFICE',
        title: 'Batch Awaiting Final Sanction',
        message: 'Batch BATCH-2026-004 has completed district clearance and is pending state approval.',
        type: 'INFO',
        link: '/state',
      },
      {
        userId: userAnika.id,
        roleTarget: 'TRAINING_CENTRE',
        title: 'Batch Returned for Correction',
        message: 'Batch BATCH-2026-005 was returned by District Officer Dev. Please correct candidate phone numbers.',
        type: 'ERROR',
        link: '/batches',
      },
    ],
  });

  // 8. Seed Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: userAnika.id,
        userRole: 'TRAINING_CENTRE',
        action: 'BATCH_SUBMITTED',
        entityType: 'BATCH',
        entityId: batch1.id,
        previousState: JSON.stringify({ status: 'DRAFT' }),
        newState: JSON.stringify({ status: 'SUBMITTED', version: 1 }),
        metadata: JSON.stringify({ totalCandidates: 10 }),
        timestamp: new Date(Date.now() - 7 * 86400000),
      },
      {
        userId: userDev.id,
        userRole: 'DISTRICT_OFFICER',
        action: 'DISTRICT_APPROVAL_RECORDED',
        entityType: 'BATCH',
        entityId: batch1.id,
        previousState: JSON.stringify({ approvalCount: 0 }),
        newState: JSON.stringify({ approvalCount: 1 }),
        metadata: JSON.stringify({ officer: 'Dev Verma', decision: 'APPROVED' }),
        timestamp: new Date(Date.now() - 6 * 86400000),
      },
      {
        userId: userMeera.id,
        userRole: 'DISTRICT_OFFICER',
        action: 'DISTRICT_APPROVAL_RECORDED',
        entityType: 'BATCH',
        entityId: batch1.id,
        previousState: JSON.stringify({ approvalCount: 1 }),
        newState: JSON.stringify({ approvalCount: 2, status: 'STATE_REVIEW' }),
        metadata: JSON.stringify({ officer: 'Meera Rao', decision: 'APPROVED' }),
        timestamp: new Date(Date.now() - 5.5 * 86400000),
      },
      {
        userId: userFarah.id,
        userRole: 'STATE_OFFICE',
        action: 'STATE_APPROVAL_RECORDED',
        entityType: 'BATCH',
        entityId: batch1.id,
        previousState: JSON.stringify({ status: 'STATE_REVIEW' }),
        newState: JSON.stringify({ status: 'APPROVED' }),
        metadata: JSON.stringify({ officer: 'Farah Khan', decision: 'APPROVED' }),
        timestamp: new Date(Date.now() - 5 * 86400000),
      },
      {
        userId: userFarah.id,
        userRole: 'STATE_OFFICE',
        action: 'CERTIFICATE_CANCELLED',
        entityType: 'CERTIFICATE',
        entityId: 'CERT-2026-BPL-0003',
        previousState: JSON.stringify({ status: 'VALID' }),
        newState: JSON.stringify({ status: 'CANCELLED', reason: 'Biometric verification failure' }),
        metadata: JSON.stringify({ candidate: 'Rohan Joshi' }),
        timestamp: new Date(Date.now() - 1 * 86400000),
      },
    ],
  });

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
