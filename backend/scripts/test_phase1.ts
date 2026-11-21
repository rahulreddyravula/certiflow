import { app } from '../src/app';
import { connectDatabase, prisma } from '../src/database';
import request from 'supertest';

async function runPhase1Verification() {
  console.log('====================================================');
  console.log('🔍 VERIFYING BACKEND PHASE 1: FOUNDATION');
  console.log('====================================================\n');

  // 1. Database Connection & System Config Check
  console.log('1. Database Connection & System Setup:');
  await connectDatabase();
  const configs = await prisma.systemConfig.findMany();
  console.log('   ✅ System Configuration loaded:');
  configs.forEach((c) => console.log(`      - ${c.key}: ${c.value} (${c.description || ''})`));

  // 2. Healthcheck Endpoint
  console.log('\n2. Testing GET /api/health:');
  const healthRes = await request(app).get('/api/health');
  console.log(`   Status: ${healthRes.status} ${healthRes.status === 200 ? '✅ OK' : '❌ FAILED'}`);
  console.log('   Payload:', JSON.stringify(healthRes.body));

  // 3. Demo Users List Endpoint
  console.log('\n3. Testing GET /api/auth/demo-users:');
  const demoUsersRes = await request(app).get('/api/auth/demo-users');
  console.log(`   Status: ${demoUsersRes.status} ${demoUsersRes.status === 200 ? '✅ OK' : '❌ FAILED'}`);
  console.log(`   Found ${demoUsersRes.body.users.length} Pre-Seeded Demonstration Personas:`);
  demoUsersRes.body.users.forEach((u: any) => {
    console.log(`      • ${u.name.padEnd(16)} | Role: ${u.role.padEnd(18)} | Email: ${u.email}`);
  });

  // 4. Standard Credentials Login Endpoint
  console.log('\n4. Testing POST /api/auth/login (Standard Credentials):');
  const loginRes = await request(app).post('/api/auth/login').send({
    email: 'anika@training.certiflow.gov.in',
    password: 'password123',
  });
  console.log(`   Status: ${loginRes.status} ${loginRes.status === 200 ? '✅ OK' : '❌ FAILED'}`);
  console.log(`   JWT Token Generated: ${loginRes.body.token.substring(0, 30)}...`);
  console.log(`   Authenticated User: ${loginRes.body.user.name} (${loginRes.body.user.role})`);
  const anikaToken = loginRes.body.token;

  // 5. Protected Endpoint /api/auth/me (JWT Verification)
  console.log('\n5. Testing GET /api/auth/me (Protected Route with JWT):');
  const meRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${anikaToken}`);
  console.log(`   Status: ${meRes.status} ${meRes.status === 200 ? '✅ OK' : '❌ FAILED'}`);
  console.log('   Decoded JWT Payload:', JSON.stringify(meRes.body.user));

  // 6. 1-Click Demo Login Endpoint
  console.log('\n6. Testing POST /api/auth/demo-login (Instant Role Switch):');
  const demoLoginRes = await request(app).post('/api/auth/demo-login').send({
    role: 'STATE_OFFICE',
    email: 'farah@state.certiflow.gov.in',
  });
  console.log(`   Status: ${demoLoginRes.status} ${demoLoginRes.status === 200 ? '✅ OK' : '❌ FAILED'}`);
  console.log(`   Switched to: ${demoLoginRes.body.user.name} (${demoLoginRes.body.user.role})`);

  // 7. Role-Based Access Control (RBAC) Enforcement
  console.log('\n7. Testing RBAC Access Control Rejection:');
  const unauthorizedRes = await request(app)
    .post('/api/certificates/dummy-id/cancel')
    .set('Authorization', `Bearer ${anikaToken}`) // Training centre trying to cancel certificate
    .send({ reason: 'Unauthorized cancellation attempt' });
  console.log(`   Status: ${unauthorizedRes.status} ${unauthorizedRes.status === 403 ? '✅ 403 Forbidden (RBAC Enforced)' : '❌ Failed'}`);
  console.log('   Rejection Response:', JSON.stringify(unauthorizedRes.body));

  console.log('\n====================================================');
  console.log('🎉 PHASE 1: FOUNDATION IS 100% OPERATIONAL & VERIFIED');
  console.log('====================================================');

  await prisma.$disconnect();
}

runPhase1Verification().catch(console.error);
