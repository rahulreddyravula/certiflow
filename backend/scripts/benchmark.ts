import { prisma } from '../src/database';
import { MonitoringService } from '../src/modules/monitoring/monitoring.service';
import { CertificateService } from '../src/modules/certificate/certificate.service';
import { CandidateService } from '../src/modules/candidate/candidate.service';
import { BatchService } from '../src/modules/batch/batch.service';
import { AuthUser } from '../src/middleware/auth.middleware';

async function runBenchmark() {
  console.log('==============================================');
  console.log(' CERTIFLOW PERFORMANCE BENCHMARK & AUDIT ');
  console.log('==============================================');

  const adminUser: AuthUser = {
    id: 'benchmark_admin',
    email: 'admin@certiflow.gov.in',
    name: 'Admin',
    role: 'STATE_OFFICE',
  };

  // 1. Dashboard Stats Aggregation Benchmark (Cold vs Warm Cache)
  console.log('\n[1] Testing MonitoringService.getDashboardStats (Cold DB vs Warm Cache)...');
  const t0 = performance.now();
  const statsCold = await MonitoringService.getDashboardStats(adminUser.role);
  const t1 = performance.now();
  console.log(`  ✓ Cold fetch (Neon DB Roundtrips): ${(t1 - t0).toFixed(2)} ms`);
  console.log(`    Total Batches: ${statsCold.batches.total}, Candidates: ${statsCold.candidates.total}, Certificates: ${statsCold.certificates.total}`);

  const t0Cached = performance.now();
  const statsWarm = await MonitoringService.getDashboardStats(adminUser.role);
  const t1Cached = performance.now();
  console.log(`  ✓ Warm fetch (Cache-Aside Hit): ${(t1Cached - t0Cached).toFixed(2)} ms (Speedup: ${((t1 - t0) / Math.max(0.01, t1Cached - t0Cached)).toFixed(0)}x faster!)`);

  // 2. Certificate List Payload & Latency Benchmark
  console.log('\n[2] Testing CertificateService.getCertificates (qrCodeDataUrl Excluded)...');
  const t2 = performance.now();
  const certs = await CertificateService.getCertificates({ limit: 50 });
  const t3 = performance.now();
  const jsonSize = JSON.stringify(certs).length;
  console.log(`  ✓ Fetched ${certs.length} certificates in ${(t3 - t2).toFixed(2)} ms`);
  console.log(`    Payload size: ${(jsonSize / 1024).toFixed(2)} KB (Target: < 50 KB without base64 QR codes)`);
  const hasBase64 = certs.some((c: any) => c.qrCodeDataUrl !== undefined);
  console.log(`    qrCodeDataUrl stripped from list: ${!hasBase64}`);

  // 3. Candidate Dedicated Query Benchmark
  console.log('\n[3] Testing CandidateService.getCandidates (Dedicated Paginated Endpoint)...');
  const t4 = performance.now();
  const candidatesResult = await CandidateService.getCandidates({ limit: 50, search: 'Plumber' });
  const t5 = performance.now();
  console.log(`  ✓ Candidate query with search completed in ${(t5 - t4).toFixed(2)} ms`);
  console.log(`    Matched: ${candidatesResult.candidates.length} of ${candidatesResult.total} total`);

  // 4. Batches Query Benchmark
  console.log('\n[4] Testing BatchService.getBatches (Indexed)...');
  const t6 = performance.now();
  const batches = await BatchService.getBatches(adminUser, { limit: 50 });
  const t7 = performance.now();
  console.log(`  ✓ Fetched ${batches.length} batches in ${(t7 - t6).toFixed(2)} ms`);

  await prisma.$disconnect();
  console.log('\n==============================================');
  console.log(' BENCHMARK COMPLETED SUCCESSFULLY ');
  console.log('==============================================');
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
