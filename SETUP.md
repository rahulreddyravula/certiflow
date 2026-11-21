# CertiFlow – Setup & Installation Guide

This guide describes how to run CertiFlow both in local standalone development mode and with Docker Compose.

---

## 1. System Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Docker & Docker Compose** (Optional for containerized deployment)

---

## 2. Option A: Local Development Setup (Quickest)

CertiFlow includes a zero-configuration SQLite profile for rapid local development and testing without requiring external PostgreSQL or Redis services.

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 2: Push Database Schema & Seed Demo Data
```bash
# Push schema to local dev database
npm run db:push:sqlite

# Seed demo users (Anika, Dev, Meera, Kabir, Neha, Farah) and sample batches
npm run db:seed
```

### Step 3: Run Automated Test Suite
```bash
npm test
```
*Expected: 8 tests passing.*

### Step 4: Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### Step 5: Start Both Servers
Open two terminal windows:

**Terminal 1 (Backend API):**
```bash
cd backend
npm run dev
# Starts on http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```bash
cd frontend
npm run dev
# Starts on http://localhost:5173
```

Navigate to `http://localhost:5173` in your browser.

---

## 3. Option B: Docker Compose Setup (Production Mode)

CertiFlow can be started in a fully containerized multi-tier architecture with PostgreSQL 16, Redis 7, Backend REST API, Dedicated Background Worker, and Nginx-powered Frontend.

### Step 1: Clone & Configure Environment
```bash
cp .env.example .env
```

### Step 2: Launch Containers
```bash
docker compose up --build -d
```

### Step 3: Verify Container Health
```bash
docker compose ps
```

You should see 5 healthy running services:
- `certiflow-postgres` (PostgreSQL 16 on port 5432)
- `certiflow-redis` (Redis 7 on port 6379)
- `certiflow-backend` (Node API on port 5000)
- `certiflow-worker` (Dedicated BullMQ daemon)
- `certiflow-frontend` (Nginx on port 80)

### Step 4: Access Application
- Web Dashboard: `http://localhost` (or `http://localhost:5173` in dev mode)
- Backend Healthcheck: `http://localhost:5000/api/health`
- Public Certificate Verification: `http://localhost/verify`

---

## 4. Exploring the End-to-End Workflow

1. Open `http://localhost:5173`.
2. Click **Anika** on the top demo bar to sign in as the Training Centre.
3. Open **Batches Registry** -> **Create New Batch**.
4. In the new batch details page, click **Upload Candidates CSV** and select `sample_data/valid_batch_sample.csv`.
5. Notice real-time atomic validation passing -> Click **Validate & Save Batch**.
6. Click **Submit for District Approval**.
7. Click **Dev** on the top demo bar -> Navigate to **District Approvals** -> Inspect batch -> Record **Approve** (Approval 1 of 2 recorded).
8. Click **Meera** on the top demo bar -> Navigate to **District Approvals** -> Inspect batch -> Record **Approve** (Approval 2 of 2 recorded, advancing batch).
9. If batch candidate count was $\ge 50$ (e.g. `sample_data/large_batch_sample.csv`):
   - Switch to **Neha** -> Navigate to **Quality Review** -> Approve batch.
10. Switch to **Farah** (State Directorate) -> Navigate to **State Directorate** -> Click **Inspect & Sanction** -> Grant Final State Approval.
11. Observe automatic background certificate generation and simulated WhatsApp dispatch!
12. Click **Issued Certificates** -> View generated certificate with vector styling, gold seal, and live verification QR code!
13. Open `/verify/<CertificateID>` in an incognito window without logging in to see genuine verification.
14. Under **State Directorate**, cancel that certificate with a test revocation reason, and re-verify in the public portal to see the immediate `CANCELLED` status!

---

## 5. Troubleshooting & FAQ

- **Port Conflict (5000 / 5173 / 5432)**:
  Update the respective `PORT` in `.env` or adjust the host port mapping in `docker-compose.yml`.
- **Database Lock / Stale State**:
  Run `npm run db:push:sqlite && npm run db:seed` in the `backend/` folder to reset the database to a pristine demo state.
- **SSE Stream Disconnected**:
  Ensure your browser supports standard EventSource and that no ad-blocker or proxy is terminating long-lived HTTP streams.
