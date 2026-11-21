# CertiFlow – High-Scale Production Deployment Architecture
## Engineering Blueprint for National Scale

This document outlines the production architecture, capacity planning, cost estimation, and resilience engineering for deploying CertiFlow at national scale to support:

- **100,000** registered vocational users across training centres, districts, and state bodies.
- **10,000** daily active users (DAU).
- **500** candidate batches approved per hour during peak declaration windows.
- **30,000** PDF certificates generated and dynamically signed per peak hour.
- **30,000** WhatsApp notification dispatches delivered per peak hour.
- **50,000+** unauthenticated public credential verification queries daily.

---

## 1. High-Scale Production Architecture

```
                                [ Cloudflare CDN & Edge Shield ]
                                (DDoS Protection, WAF, Rate Limiting)
                                                |
                       +------------------------+------------------------+
                       |                                                 |
                       v                                                 v
           [ Public Verification API ]                        [ Static Web Client ]
         (Cached Edge / Regional POPs)                      (Cloudflare Pages / S3)
                       |
                       +------------------------+
                                                |
                                                v
                              [ AWS Application Load Balancer / Nginx ]
                                                |
                       +------------------------+------------------------+
                       |                        |                        |
                       v                        v                        v
               [ API Node 1 ]             [ API Node 2 ]           [ API Node N ]
               (Express / ECS)            (Express / ECS)          (Express / ECS)
                       |                        |                        |
                       +------------------------+------------------------+
                                                |
                     +--------------------------+--------------------------+
                     |                                                     |
                     v                                                     v
          [ Amazon Aurora PostgreSQL ]                              [ Amazon ElastiCache ]
          (Primary Writer + Read Replicas)                          (Redis Cluster / BullMQ)
                     |                                                     |
                     |                                         +-----------+-----------+
                     |                                         |                       |
                     |                                         v                       v
                     |                              [ PDF Worker Cluster ]  [ WhatsApp Worker Cluster ]
                     |                              (Auto-scaling ECS Fargate) (Auto-scaling ECS Fargate)
                     |                                         |                       |
                     +-----------------------------------------+                       v
                     |                                                            [ Meta Cloud API ]
                     v                                                            (Rate-limited Hub)
        [ Amazon S3 Secure Storage ]
        (WORM Vault / CloudFront Signed URLs)
```

---

## 2. Infrastructure & Hosting Choices

### Core Infrastructure
- **Compute**: AWS ECS Fargate (Serverless Containers). Decouples API nodes from background workers. Eliminates container OS patching overhead while providing sub-minute horizontal auto-scaling based on CPU/Memory and BullMQ queue depth.
- **Primary Database**: Amazon Aurora PostgreSQL (Serverless v2).
  - Multi-AZ deployment with 1 Primary Writer and 2 Read Replicas.
  - Read-write splitting: read replicas serve dashboard analytics, candidate lookups, and audit log exports, while the primary writer handles batch submissions, approvals, and outbox event insertions.
- **Distributed Cache & Queues**: Amazon ElastiCache for Redis (Cluster Mode Enabled).
  - 3-shard cluster with in-memory persistence and automatic failover.
- **Artifact Storage**: Amazon S3 (Standard + S3 Glacier Instant Retrieval).
  - Certificate PDFs stored using Server-Side Encryption (KMS) with S3 Object Lock (WORM - Write Once, Read Many) to prevent unauthorized tampering or deletion.
  - Public downloads stream through CloudFront with signed URLs.

---

## 3. Capacity & Throughput Sizing

### A. PDF Certificate Generation Throughput
- **Requirement**: 30,000 certificates per hour $\approx$ 8.33 certificates per second (steady state) / 25 certificates per second (peak burst).
- **Processing Time**: ~200ms per PDF (vector drawing + QR code encoding via PDFKit).
- **Worker Concurrency**:
  - 1 vCPU worker process can generate 5 PDFs per second.
  - Sizing: $25 \text{ certs/sec} \div 5 \text{ certs/sec/worker} = 5 \text{ worker tasks}$.
  - Provisioning: **8 Fargate tasks (1 vCPU, 2GB RAM)** provide 60% headroom for bursts.

### B. WhatsApp Message Dispatch Throughput
- **Requirement**: 30,000 messages per hour $\approx$ 8.33 messages per second.
- **WhatsApp Cloud API Limits**: Standard Tier 2 accounts support 80 messages per second; Tier 3 supports 250 mps.
- **Worker Concurrency**:
  - BullMQ rate-limiter configured at `max: 50, duration: 1000` to prevent carrier throttling.
  - Sizing: **4 Fargate tasks (0.5 vCPU, 1GB RAM)** consuming the `whatsapp-notifications` queue.

### C. Public Verification Traffic
- **Requirement**: 50,000 daily queries with spikes after exam result announcements.
- **Caching Strategy**:
  - Cloudflare Edge Caches `/api/verify/:certId` responses for 60 seconds (`Cache-Control: public, max-age=60`).
  - When a certificate is cancelled by the State Office, a purge webhook purges that certificate's Cloudflare cache key immediately (`https://api.cloudflare.com/client/v4/zones/.../purge_cache`), guaranteeing zero delay in reflecting revoked credentials.

---

## 4. Resilience, Recovery & Failure Scenarios

### 1. Redis Restart / Outage Handling
- The architecture uses a **Transactional Outbox Pattern**:
  - When a batch receives final state approval, the database transaction writes an `OutboxEvent('certificate.generation_requested')` inside the same commit.
  - If Redis crashes, restarts, or loses connectivity, the database transaction still succeeds.
  - Once Redis connectivity is restored, the Outbox Poller daemon reads pending events and re-enqueues them with zero data loss.

### 2. WhatsApp Provider Outage
- WhatsApp delivery is **strictly non-blocking**:
  - A telecom carrier outage or WhatsApp Cloud API 504 Gateway Timeout never rolls back or halts certificate issuance.
  - The BullMQ worker implements exponential backoff:
    - Attempt 1: Immediate.
    - Attempt 2: 15 seconds.
    - Attempt 3: 60 seconds.
    - Attempt 4: 5 minutes.
  - Idempotency keys (`wa_<certificateId>`) ensure that network retry attempts never send duplicate WhatsApp messages to candidates.

### 3. Worker Crash & Job Recovery
- BullMQ worker locks are configured with a 30-second lease and automatic stalled-job detection.
- If a container dies mid-generation, BullMQ reassigns the uncompleted job to another healthy container.
- Certificate generation checks database uniqueness before creating records (`WHERE candidateId = ...`), ensuring zero duplicates on job redelivery.

### 4. Database Bottleneck Prevention
- Connection pooling managed via **AWS RDS Proxy** (max 2,000 active connections).
- High-volume candidate inserts use `createMany` batch inserts (chunks of 500 records), avoiding single-row transaction thrashing.
- Composite indexes on `(batchId, versionNumber, officerId)` ensure $O(1)$ approval consensus lookups.

---

## 5. Security Architecture

1. **Role-Based Access Control (RBAC)**: Enforced at both API Gateway middleware and Prisma service layers.
2. **PII Masking**: Public verification endpoints partially mask candidate names (`A***v S****a`) and omit phone numbers and email addresses entirely.
3. **WORM Storage**: Certificates in Amazon S3 use Object Lock in Governance mode with a 5-year retention policy to prevent accidental or malicious file tampering.
4. **Rate Limiting**: Sliding-window rate limiter (100 req/min per IP) protects `/api/verify` from brute-force certificate enumeration.

---

## 6. Estimated Monthly Cost Breakdown (AWS)

| Resource | Sizing / Configuration | Estimated Monthly Cost |
| :--- | :--- | :--- |
| **Amazon Aurora PostgreSQL Serverless v2** | 2 - 8 ACUs (Auto-scaling), 1 Writer + 1 Reader, 150GB storage | \$280 |
| **AWS RDS Proxy** | Managed database connection pool | \$30 |
| **Amazon ElastiCache Redis** | Cluster: 2x `cache.t4g.medium` (Multi-AZ) | \$95 |
| **ECS Fargate (API Cluster)** | 4x tasks (1 vCPU, 2GB RAM) auto-scaling up to 12 | \$140 |
| **ECS Fargate (Worker Cluster)** | 8x tasks (1 vCPU, 2GB RAM) for PDF + WhatsApp | \$180 |
| **Amazon S3 & CloudFront** | 100GB storage, 1M GET requests, KMS keys | \$25 |
| **Cloudflare Enterprise / Pro** | WAF, DDoS protection, CDN edge caching | \$40 |
| **Application Load Balancer** | 1 ALB with SSL termination | \$25 |
| **AWS CloudWatch** | Logs, alarms, container metrics | \$35 |
| **Total Estimated Monthly Cost** | | **~\$850 / month** |

### Architectural Trade-Offs
- **Serverless Fargate vs Dedicated EC2**: Fargate costs ~15% more per vCPU-hour than reserved EC2 instances, but eliminates EC2 management overhead, OS hardening, and capacity reservation waste during off-peak night hours.
- **Aurora PostgreSQL vs Self-Managed Postgres**: Aurora provides automatic 6-way storage replication across 3 Availability Zones and continuous point-in-time backups, ensuring compliance with government audit regulations.
