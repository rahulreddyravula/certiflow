# CertiFlow – Skilling Certificate Issuance & Verification Platform

> **An enterprise-grade, event-driven digital certificate issuance and public verification platform designed for national government vocational skilling programmes.**

CertiFlow manages the complete end-to-end lifecycle of candidate skilling certifications: from training centre registration and atomic CSV cohort upload, through multi-tier district officer consensus and large-batch quality audits, to final state executive sanction, tamper-proof PDF certificate generation with dynamic QR verification, resilient WhatsApp delivery with exponential backoff, and state-governed revocation.

---

## 1. Key System Features & Highlights

- **Multi-Officer District Consensus**: Requires two distinct authorized district officers to review and approve every cohort before advancing. Simultaneous approvals are handled via database transactions and unique constraints.
- **Configurable Quality Auditing**: Large cohorts (threshold configurable, default: $\ge 50$ candidates) trigger automatic routing to the dedicated Quality Team.
- **Strict Atomic CSV Validation**: Uploaded candidate data is validated in its entirety across 8 mandatory criteria (email regex, phone length, intra-batch duplication detection, date validity, assessment status). If a single row fails, **zero partial records are persisted**.
- **Vector PDF Certificate Engine**: Generates professional, vector-rendered certificates with official borders, gold seal graphics, candidate metadata, and embedded verification QR codes using PDFKit.
- **Instant Public Verification**: Public unauthenticated endpoint (`/verify/:id`) checking real-time database state with rate limiting. Returns `VALID`, `CANCELLED`, or `NOT_FOUND` while masking sensitive PII.
- **Statutory Certificate Revocation**: Only the State Directorate has legal authority to cancel an issued certificate. Cancelled credentials immediately reflect as `CANCELLED` during public verification.
- **Resilient Event-Driven Processing**: Built using the Transactional Outbox pattern, Redis, and BullMQ for reliable, non-blocking certificate generation and simulated WhatsApp delivery.
- **Simulated WhatsApp Gateway**: Mock provider with realistic network failure simulation, exponential backoff retries, and idempotency guarantees that prevent duplicate dispatches.
- **Proactive SLA Breach Monitoring**: Background monitors track time spent in review stages against statutory SLA targets (48h district, 48h state), alerting state executives to overdue bottlenecks.
- **Real-Time Live Updates**: Server-Sent Events (SSE) stream notifications to all connected clients without browser polling.
- **1-Click Reviewer Persona Switcher**: Instant switching between Anika (Training Centre), Dev, Meera, Kabir (District Officers), Neha (Quality Team), and Farah (State Directorate).

---

## 2. Technology Stack & Architectural Decisions

| Layer | Technologies | Architectural Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query v5, Zustand, React Hook Form, Zod, Lucide React | Type-safe enterprise UI with rapid rendering, optimistic state management, clean responsive dashboard aesthetics, and zero layout clutter. |
| **Backend** | Node.js, Express.js, TypeScript, REST API, JWT, RBAC, Zod | Clean modular architecture separating routing, controllers, business services, and database persistence. |
| **Database** | PostgreSQL 16 (Production/Docker) / SQLite (Local Standalone), Prisma ORM | Relational schema with foreign keys, composite unique constraints (`@@unique([batchId, versionNumber, officerId])`), and atomic transactions. |
| **Queues & Cache** | Redis 7, BullMQ, In-Process Fallback | Asynchronous task offloading for PDF generation and WhatsApp delivery with automatic exponential backoff. |
| **Security** | JWT (7-day validity), bcrypt password hashing, sliding-window rate limiting, role-based authorization gates | Strict RBAC ensuring users cannot perform actions outside their statutory authority. |
| **Testing** | Vitest, Supertest | 100% automated coverage of all 8 mandatory critical business scenarios. |

---

## 3. High-Level Architecture Diagram

```
       +--------------------------------------------------------------+
       |                       React Web Client                       |
       |  (Training Centre / District Officer / Quality / State)      |
       +------------------------------+-------------------------------+
                                      |
                           HTTPS REST & SSE Stream
                                      |
                                      v
       +--------------------------------------------------------------+
       |                    Express.js Backend API                    |
       |  +----------------+  +-----------------+  +---------------+  |
       |  | Auth & RBAC    |  | Batch Controller|  | SSE Broadcaster| |
       |  +----------------+  +-----------------+  +---------------+  |
       +------------------------------+-------------------------------+
                                      |
                     Prisma ORM (Transactions & Outbox)
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
        +-------------------------+       +-------------------------+
        |   PostgreSQL / SQLite   |       |      Redis & BullMQ     |
        |  - Users & Batches      |       |  - Certificate Queue    |
        |  - Outbox Events        |       |  - WhatsApp Queue       |
        |  - Immutable Audit Logs |       +------------+------------+
        +-------------------------+                    |
                                                       v
                                          +-------------------------+
                                          | Dedicated Worker Daemon |
                                          | - PDF Vector Generation |
                                          | - QR Code Embedding     |
                                          | - WhatsApp Mock Provider|
                                          +-------------------------+
```

---

## 4. Pre-Configured Demo Credentials

The database is seeded with 6 mandatory demonstration personas. You can sign in using these credentials or use the **1-Click Demo Persona Bar** at the top of the interface:

| Persona | Name | Role | Email | Password | Scope & Responsibilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC** | Anika Sharma | `TRAINING_CENTRE` | `anika@training.certiflow.gov.in` | `password123` | Apex Skill Institute (Bhopal). Create cohorts, upload candidate CSVs, submit batches. |
| **DO 1** | Dev Verma | `DISTRICT_OFFICER` | `dev@district.certiflow.gov.in` | `password123` | Bhopal District. First officer approval, return for correction, or rejection. |
| **DO 2** | Meera Rao | `DISTRICT_OFFICER` | `meera@district.certiflow.gov.in` | `password123` | Bhopal District. Second distinct officer consensus verification. |
| **DO 3** | Kabir Singh | `DISTRICT_OFFICER` | `kabir@district.certiflow.gov.in` | `password123` | Indore District. Independent district approvals in Indore. |
| **QT** | Neha Gupta | `QUALITY_TEAM` | `neha@quality.certiflow.gov.in` | `password123` | State Quality Desk. Reviews batches with $\ge 50$ candidates before state review. |
| **SO** | Farah Khan | `STATE_OFFICE` | `farah@state.certiflow.gov.in` | `password123` | State Directorate. Final executive sanction, SLA overdue monitor, certificate cancellation. |

---

## 5. Sample Data & Demonstration Cohorts

Pre-loaded cohorts available immediately upon launch:
- `BATCH-2026-001`: Domestic Data Entry Operator (10 candidates) – **Certificates Issued**. Demonstrates valid certificates, 1 state-cancelled certificate (`CERT-2026-BPL-0003`), and 1 failed WhatsApp delivery.
- `BATCH-2026-002`: Solar PV Installer (25 candidates) – **District Review**. Approved by Officer Dev; awaiting Officer Meera's second approval.
- `BATCH-2026-003`: Healthcare Assistant Mega Batch (60 candidates) – **Quality Review**. Approved by two district officers; currently undergoing Neha's quality check ($\ge 50$ rule).
- `BATCH-2026-004`: CNC Machinist (20 candidates) – **State Review**. District clearances complete; awaiting Farah's final sanction.
- `BATCH-2026-005`: Retail Sales Associate – **Returned for Correction**. Returned by Officer Dev for invalid phone formats. Demonstrates versioned resubmission.
- `BATCH-2026-006`: Automotive EV Technician – **Draft**. Fresh draft batch for uploading candidate CSVs.

Ready-to-use CSV files are located in `sample_data/`:
- `sample_data/valid_batch_sample.csv` (15 valid candidates)
- `sample_data/invalid_batch_sample.csv` (contains missing fields, invalid emails, bad phone formats, invalid dates for testing rejection)
- `sample_data/large_batch_sample.csv` (55 candidates to trigger Quality Review)

---

## 6. Automated Testing Suite

All 8 mandatory evaluation test cases are fully implemented and passing:

```bash
cd backend
npm test
```

1. **TEST 1: CSV Validation & Atomic Transaction**: Exact row and field error breakdown; zero candidate rows saved when any validation error occurs.
2. **TEST 2: Simultaneous District Approval & Concurrency Control**: Two officers approve in parallel; both decisions recorded, batch advances exactly once, duplicate approvals thrown out.
3. **TEST 3: Certificate Idempotency**: Batch with passed candidates receives unique certificates; repeat executions skip duplicates and maintain exact counts.
4. **TEST 4: WhatsApp Failure & Exponential Backoff**: WhatsApp timeouts simulate network glitches without blocking certificate issuance; failed deliveries retry with backoff.
5. **TEST 5: State Certificate Revocation**: Cancellation by State Office immediately invalidates public verification results and displays revocation audit reason.
6. **TEST 6: Delayed Approval SLA Monitoring**: Batches exceeding the 48-hour SLA threshold are detected by the background scanner and dispatch executive alerts.
7. **TEST 7: Returned Batch & Versioned Resubmission**: Historical return reason is immutably preserved; resubmission increments version to v2 and requires fresh district approvals.
8. **TEST 8: Role-Based Authorization Enforcement**: Unauthorized actions (e.g. TC cancelling certificates, DO creating batches) return HTTP 403 Forbidden.
