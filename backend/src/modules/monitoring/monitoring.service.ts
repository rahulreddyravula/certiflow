import { prisma } from '../../database';
import { config } from '../../config';
import { NotificationService } from '../notification/notification.service';
import { EventService } from '../events/event.service';
import { CacheService } from '../cache/cache.service';

export interface DelayedBatchItem {
  id: string;
  batchNumber: string;
  title: string;
  status: string;
  trainingCentreName: string;
  districtName: string;
  totalCandidates: number;
  stageEnteredAt: Date;
  hoursElapsed: number;
  slaHours: number;
  isOverdue: boolean;
}

export class MonitoringService {
  /**
   * Scan database for batches exceeding stage SLA.
   * District SLA default: 48h
   * State SLA default: 48h
   */
  static async checkDelayedBatches(): Promise<DelayedBatchItem[]> {
    const pendingBatches = await prisma.batch.findMany({
      where: {
        status: {
          in: ['DISTRICT_REVIEW', 'QUALITY_REVIEW', 'STATE_REVIEW'],
        },
      },
      include: {
        trainingCentre: true,
        district: true,
      },
    });

    const now = Date.now();
    const delayedBatches: DelayedBatchItem[] = [];

    // Pre-fetch recent alert messages in one query to eliminate N+1 queries in the loop
    const recentAlerts = await prisma.notification.findMany({
      where: {
        roleTarget: 'STATE_OFFICE',
        createdAt: { gte: new Date(now - 12 * 3600000) },
      },
      select: { message: true },
    });
    const recentAlertMessages = recentAlerts.map((a) => a.message);

    for (const batch of pendingBatches) {
      const stageDate = batch.submittedAt || batch.updatedAt || batch.createdAt;
      const hoursElapsed = Math.round((now - new Date(stageDate).getTime()) / 3600000);

      const slaHours = batch.status === 'DISTRICT_REVIEW' ? config.slaHoursDistrict : config.slaHoursState;
      const isOverdue = hoursElapsed > slaHours;

      if (isOverdue) {
        delayedBatches.push({
          id: batch.id,
          batchNumber: batch.batchNumber,
          title: batch.title,
          status: batch.status,
          trainingCentreName: batch.trainingCentre.name,
          districtName: batch.district.name,
          totalCandidates: batch.totalCandidates,
          stageEnteredAt: stageDate,
          hoursElapsed,
          slaHours,
          isOverdue,
        });

        // Trigger notification to State Office only if not recently notified (prevents duplicate spam on page refresh)
        const alreadyNotified = recentAlertMessages.some((msg) => msg.includes(batch.batchNumber));

        if (!alreadyNotified) {
          recentAlertMessages.push(batch.batchNumber);
          await NotificationService.send({
            roleTarget: 'STATE_OFFICE',
            title: `SLA Breach Alert: Batch ${batch.batchNumber}`,
            message: `Batch ${batch.batchNumber} has been delayed in '${batch.status}' for ${hoursElapsed} hours (SLA target: ${slaHours}h).`,
            type: 'WARNING',
            link: `/batches/${batch.id}`,
          });

          EventService.broadcast('batch.overdue', {
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            status: batch.status,
            hoursElapsed,
          });
        }
      }
    }

    return delayedBatches;
  }

  /**
   * Comprehensive System Dashboard Statistics (Live from DB or Redis/Memory Cache)
   * Highly optimized: Replaced 14 sequential count queries with 3 aggregation groupBys
   * Wrapped in CacheService (cache-aside with stampede protection)
   */
  static async getDashboardStats(userRole?: string, districtId?: string, trainingCentreId?: string) {
    const cacheKey = `dashboard:stats:${userRole || 'ALL'}:${districtId || 'all'}:${trainingCentreId || 'all'}`;

    return await CacheService.wrap(cacheKey, 30, async () => {
      const batchWhere: any = {};
      if (userRole === 'TRAINING_CENTRE' && trainingCentreId) {
        batchWhere.trainingCentreId = trainingCentreId;
      } else if (userRole === 'DISTRICT_OFFICER' && districtId) {
        batchWhere.districtId = districtId;
      }

      // Consolidated database queries: 3 groupBys + 2 selected recent lists + overdue batch scan in parallel
      const [
        batchGroups,
        candidateGroups,
        certificateGroups,
        recentAuditLogs,
        whatsappLogs,
        overdueBatches,
      ] = await Promise.all([
        // 1 query for all batch status counts
        prisma.batch.groupBy({
          by: ['status'],
          where: batchWhere,
          _count: { id: true },
        }),
        // 1 query for all candidate assessment status counts
        prisma.candidate.groupBy({
          by: ['assessmentStatus'],
          _count: { id: true },
        }),
        // 1 query for all certificate status counts
        prisma.certificate.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        // Project only necessary fields for dashboard feed
        prisma.auditLog.findMany({
          take: 10,
          orderBy: { timestamp: 'desc' },
          select: {
            id: true,
            action: true,
            userRole: true,
            entityType: true,
            entityId: true,
            newState: true,
            previousState: true,
            timestamp: true,
          },
        }),
        // Project only necessary fields for WhatsApp delivery widget
        prisma.whatsAppDeliveryLog.findMany({
          take: 10,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            candidateName: true,
            candidatePhone: true,
            status: true,
            attempts: true,
            lastAttemptAt: true,
            errorMessage: true,
            updatedAt: true,
          },
        }),
        this.checkDelayedBatches(),
      ]);

      // Parse batch status counts
      const batchStatusMap: Record<string, number> = {};
      let totalBatches = 0;
      for (const bg of batchGroups) {
        batchStatusMap[bg.status] = bg._count.id;
        totalBatches += bg._count.id;
      }

      const approvedBatches = batchStatusMap['APPROVED'] || 0;
      const rejectedBatches = batchStatusMap['REJECTED'] || 0;
      const returnedBatches = batchStatusMap['RETURNED_FOR_CORRECTION'] || 0;
      const districtReviewBatches = batchStatusMap['DISTRICT_REVIEW'] || 0;
      const qualityReviewBatches = batchStatusMap['QUALITY_REVIEW'] || 0;
      const stateReviewBatches = batchStatusMap['STATE_REVIEW'] || 0;
      const certificatesIssuedBatches = batchStatusMap['CERTIFICATES_ISSUED'] || 0;
      const pendingBatches = districtReviewBatches + qualityReviewBatches + stateReviewBatches;

      // Parse candidate status counts
      const candidateStatusMap: Record<string, number> = {};
      let totalCandidates = 0;
      for (const cg of candidateGroups) {
        candidateStatusMap[cg.assessmentStatus] = cg._count.id;
        totalCandidates += cg._count.id;
      }
      const passedCandidates = candidateStatusMap['PASSED'] || 0;
      const failedCandidates = candidateStatusMap['FAILED'] || 0;

      // Parse certificate status counts
      const certStatusMap: Record<string, number> = {};
      let totalCertificates = 0;
      for (const certG of certificateGroups) {
        certStatusMap[certG.status] = certG._count.id;
        totalCertificates += certG._count.id;
      }
      const validCertificates = certStatusMap['VALID'] || 0;
      const cancelledCertificates = certStatusMap['CANCELLED'] || 0;

      return {
        batches: {
          total: totalBatches,
          pending: pendingBatches,
          approved: approvedBatches,
          rejected: rejectedBatches,
          returned: returnedBatches,
          certificatesIssued: certificatesIssuedBatches,
          breakdown: {
            districtReview: districtReviewBatches,
            qualityReview: qualityReviewBatches,
            stateReview: stateReviewBatches,
          },
        },
        candidates: {
          total: totalCandidates,
          passed: passedCandidates,
          failed: failedCandidates,
        },
        certificates: {
          total: totalCertificates,
          valid: validCertificates,
          cancelled: cancelledCertificates,
        },
        monitoring: {
          delayedCount: overdueBatches.length,
          delayedBatches: overdueBatches,
          slaHoursDistrict: config.slaHoursDistrict,
          slaHoursState: config.slaHoursState,
          largeBatchThreshold: config.largeBatchThreshold,
        },
        recentActivity: recentAuditLogs,
        recentWhatsAppDeliveries: whatsappLogs,
      };
    });
  }
}
