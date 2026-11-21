"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringService = void 0;
const database_1 = require("../../database");
const config_1 = require("../../config");
const notification_service_1 = require("../notification/notification.service");
const event_service_1 = require("../events/event.service");
const cache_service_1 = require("../cache/cache.service");
class MonitoringService {
    /**
     * Scan database for batches exceeding stage SLA.
     * District SLA default: 48h
     * State SLA default: 48h
     */
    static async checkDelayedBatches() {
        const pendingBatches = await database_1.prisma.batch.findMany({
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
        const delayedBatches = [];
        // Pre-fetch recent alert messages in one query to eliminate N+1 queries in the loop
        const recentAlerts = await database_1.prisma.notification.findMany({
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
            const slaHours = batch.status === 'DISTRICT_REVIEW' ? config_1.config.slaHoursDistrict : config_1.config.slaHoursState;
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
                    await notification_service_1.NotificationService.send({
                        roleTarget: 'STATE_OFFICE',
                        title: `SLA Breach Alert: Batch ${batch.batchNumber}`,
                        message: `Batch ${batch.batchNumber} has been delayed in '${batch.status}' for ${hoursElapsed} hours (SLA target: ${slaHours}h).`,
                        type: 'WARNING',
                        link: `/batches/${batch.id}`,
                    });
                    event_service_1.EventService.broadcast('batch.overdue', {
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
    static async getDashboardStats(userRole, districtId, trainingCentreId) {
        const cacheKey = `dashboard:stats:${userRole || 'ALL'}:${districtId || 'all'}:${trainingCentreId || 'all'}`;
        return await cache_service_1.CacheService.wrap(cacheKey, 30, async () => {
            const batchWhere = {};
            if (userRole === 'TRAINING_CENTRE' && trainingCentreId) {
                batchWhere.trainingCentreId = trainingCentreId;
            }
            else if (userRole === 'DISTRICT_OFFICER' && districtId) {
                batchWhere.districtId = districtId;
            }
            // Consolidated database queries: 3 groupBys + 2 selected recent lists + overdue batch scan in parallel
            const [batchGroups, candidateGroups, certificateGroups, recentAuditLogs, whatsappLogs, overdueBatches,] = await Promise.all([
                // 1 query for all batch status counts
                database_1.prisma.batch.groupBy({
                    by: ['status'],
                    where: batchWhere,
                    _count: { id: true },
                }),
                // 1 query for all candidate assessment status counts
                database_1.prisma.candidate.groupBy({
                    by: ['assessmentStatus'],
                    _count: { id: true },
                }),
                // 1 query for all certificate status counts
                database_1.prisma.certificate.groupBy({
                    by: ['status'],
                    _count: { id: true },
                }),
                // Project only necessary fields for dashboard feed
                database_1.prisma.auditLog.findMany({
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
                database_1.prisma.whatsAppDeliveryLog.findMany({
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
            const batchStatusMap = {};
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
            const candidateStatusMap = {};
            let totalCandidates = 0;
            for (const cg of candidateGroups) {
                candidateStatusMap[cg.assessmentStatus] = cg._count.id;
                totalCandidates += cg._count.id;
            }
            const passedCandidates = candidateStatusMap['PASSED'] || 0;
            const failedCandidates = candidateStatusMap['FAILED'] || 0;
            // Parse certificate status counts
            const certStatusMap = {};
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
                    slaHoursDistrict: config_1.config.slaHoursDistrict,
                    slaHoursState: config_1.config.slaHoursState,
                    largeBatchThreshold: config_1.config.largeBatchThreshold,
                },
                recentActivity: recentAuditLogs,
                recentWhatsAppDeliveries: whatsappLogs,
            };
        });
    }
}
exports.MonitoringService = MonitoringService;
