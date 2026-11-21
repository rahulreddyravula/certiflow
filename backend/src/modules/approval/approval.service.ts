import { prisma } from '../../database';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { EventService } from '../events/event.service';
import { CacheService } from '../cache/cache.service';
import { AuthUser } from '../../middleware/auth.middleware';

export interface DecisionParams {
  batchId: string;
  decision: 'APPROVE' | 'REJECT' | 'RETURN';
  comments?: string;
  user: AuthUser;
}

export class ApprovalService {
  /**
   * District Approval: Requires two distinct officers to approve.
   * Concurrency-safe via database transactions and unique constraints.
   */
  static async recordDistrictDecision(params: DecisionParams) {
    const { batchId, decision, comments, user } = params;

    return await prisma.$transaction(
      async (tx) => {
        const batch = await tx.batch.findUnique({
          where: { id: batchId },
        });

        if (!batch) {
          throw { status: 404, message: 'Batch not found.' };
        }

        if (batch.status !== 'DISTRICT_REVIEW') {
          throw {
            status: 400,
            message: `Batch cannot be reviewed in district stage. Current status: ${batch.status}`,
          };
        }

        // Check if this officer already voted on this version
        const existingVote = await tx.districtApproval.findUnique({
          where: {
            batchId_versionNumber_officerId: {
              batchId,
              versionNumber: batch.currentVersionNumber,
              officerId: user.id,
            },
          },
        });

        if (existingVote) {
          throw {
            status: 400,
            message: `Officer ${user.name} has already submitted a decision for version ${batch.currentVersionNumber} of this batch.`,
          };
        }

        if (decision === 'REJECT') {
          await tx.districtApproval.create({
            data: {
              batchId,
              versionNumber: batch.currentVersionNumber,
              officerId: user.id,
              officerName: user.name,
              status: 'REJECTED',
              comments: comments || 'Rejected by District Officer',
            },
          });

          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: {
              status: 'REJECTED',
              rejectedAt: new Date(),
              rejectionReason: comments || 'Rejected during district review',
            },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'BATCH_REJECTED_BY_DISTRICT',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: batch.status },
              newState: { status: 'REJECTED', reason: comments },
            },
            tx
          );

          await NotificationService.send(
            {
              roleTarget: 'TRAINING_CENTRE',
              title: `Batch Rejected: ${batch.batchNumber}`,
              message: `Batch ${batch.batchNumber} was rejected by District Officer ${user.name}. Reason: ${comments || 'No comment provided.'}`,
              type: 'ERROR',
              link: `/batches/${batch.id}`,
            },
            tx
          );

          await EventService.createOutboxEvent(
            {
              eventType: 'batch.rejected',
              aggregateType: 'BATCH',
              aggregateId: batch.id,
              payload: { batchId, status: 'REJECTED', reason: comments },
            },
            tx
          );

          return { batch: updatedBatch, approvalsCount: 1, advanced: false };
        }

        if (decision === 'RETURN') {
          if (!comments || comments.trim().length < 5) {
            throw { status: 400, message: 'A descriptive return reason (at least 5 characters) is mandatory when returning a batch for correction.' };
          }

          await tx.districtApproval.create({
            data: {
              batchId,
              versionNumber: batch.currentVersionNumber,
              officerId: user.id,
              officerName: user.name,
              status: 'RETURNED',
              comments,
            },
          });

          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: {
              status: 'RETURNED_FOR_CORRECTION',
              returnedAt: new Date(),
              returnReason: comments,
            },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'BATCH_RETURNED_FOR_CORRECTION',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: batch.status },
              newState: { status: 'RETURNED_FOR_CORRECTION', reason: comments },
            },
            tx
          );

          await NotificationService.send(
            {
              roleTarget: 'TRAINING_CENTRE',
              title: `Batch Returned for Correction: ${batch.batchNumber}`,
              message: `District Officer ${user.name} returned batch ${batch.batchNumber}. Reason: ${comments}`,
              type: 'WARNING',
              link: `/batches/${batch.id}`,
            },
            tx
          );

          await EventService.createOutboxEvent(
            {
              eventType: 'batch.returned',
              aggregateType: 'BATCH',
              aggregateId: batch.id,
              payload: { batchId, status: 'RETURNED_FOR_CORRECTION', reason: comments },
            },
            tx
          );

          return { batch: updatedBatch, approvalsCount: 1, advanced: false };
        }

        // APPROVAL FLOW
        await tx.districtApproval.create({
          data: {
            batchId,
            versionNumber: batch.currentVersionNumber,
            officerId: user.id,
            officerName: user.name,
            status: 'APPROVED',
            comments: comments || 'Approved by District Officer',
          },
        });

        const approvedCount = await tx.districtApproval.count({
          where: {
            batchId,
            versionNumber: batch.currentVersionNumber,
            status: 'APPROVED',
          },
        });

        let nextStatus = batch.status;
        let advanced = false;

        if (approvedCount >= 2) {
          nextStatus = batch.requiresQualityReview ? 'QUALITY_REVIEW' : 'STATE_REVIEW';
          advanced = true;

          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: { status: nextStatus },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'DISTRICT_SECOND_APPROVAL_COMPLETED',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: 'DISTRICT_REVIEW', approvals: 1 },
              newState: { status: nextStatus, approvals: 2 },
              metadata: { officer2: user.name },
            },
            tx
          );

          if (batch.requiresQualityReview) {
            await NotificationService.send(
              {
                roleTarget: 'QUALITY_TEAM',
                title: `Large Batch Needs Quality Review: ${batch.batchNumber}`,
                message: `Batch ${batch.batchNumber} (${batch.totalCandidates} candidates) received 2 district approvals and requires Quality Team clearance.`,
                type: 'INFO',
                link: `/quality`,
              },
              tx
            );
            await EventService.createOutboxEvent(
              {
                eventType: 'batch.quality_review_requested',
                aggregateType: 'BATCH',
                aggregateId: batch.id,
                payload: { batchId, totalCandidates: batch.totalCandidates },
              },
              tx
            );
          } else {
            await NotificationService.send(
              {
                roleTarget: 'STATE_OFFICE',
                title: `Batch Ready for Final State Approval: ${batch.batchNumber}`,
                message: `Batch ${batch.batchNumber} received both district approvals and awaits state sanction.`,
                type: 'INFO',
                link: `/state`,
              },
              tx
            );
            await EventService.createOutboxEvent(
              {
                eventType: 'batch.state_review_requested',
                aggregateType: 'BATCH',
                aggregateId: batch.id,
                payload: { batchId },
              },
              tx
            );
          }

          return { batch: updatedBatch, approvalsCount: approvedCount, advanced };
        } else {
          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'DISTRICT_FIRST_APPROVAL_RECORDED',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { approvals: 0 },
              newState: { approvals: 1 },
              metadata: { officer1: user.name },
            },
            tx
          );

          await NotificationService.send(
            {
              roleTarget: 'DISTRICT_OFFICER',
              title: `Action Required: Second Approval Needed`,
              message: `Officer ${user.name} approved batch ${batch.batchNumber}. A second district officer must review.`,
              type: 'INFO',
              link: `/batches/${batch.id}`,
            },
            tx
          );

          await EventService.createOutboxEvent(
            {
              eventType: 'batch.first_district_approved',
              aggregateType: 'BATCH',
              aggregateId: batch.id,
              payload: { batchId, officerId: user.id, officerName: user.name },
            },
            tx
          );

          const res = { batch, approvalsCount: approvedCount, advanced: false };
          CacheService.delPattern('dashboard:*');
          CacheService.delPattern('batches:*');
          return res;
        }
      },
      { timeout: 30000, maxWait: 10000 }
    );
  }

  /**
   * Quality Review: Approves large batches before state review.
   */
  static async recordQualityDecision(params: DecisionParams) {
    const { batchId, decision, comments, user } = params;

    return await prisma.$transaction(
      async (tx) => {
        const batch = await tx.batch.findUnique({ where: { id: batchId } });
        if (!batch) throw { status: 404, message: 'Batch not found.' };

        if (batch.status !== 'QUALITY_REVIEW') {
          throw { status: 400, message: `Batch is not in Quality Review stage. Current status: ${batch.status}` };
        }

        await tx.qualityReview.create({
          data: {
            batchId,
            versionNumber: batch.currentVersionNumber,
            reviewerId: user.id,
            reviewerName: user.name,
            status: decision === 'APPROVE' ? 'APPROVED' : decision === 'RETURN' ? 'RETURNED' : 'REJECTED',
            comments: comments || `${decision} by Quality Team`,
          },
        });

        if (decision === 'APPROVE') {
          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: { status: 'STATE_REVIEW' },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'QUALITY_REVIEW_APPROVED',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: 'QUALITY_REVIEW' },
              newState: { status: 'STATE_REVIEW' },
            },
            tx
          );

          await NotificationService.send(
            {
              roleTarget: 'STATE_OFFICE',
              title: `Quality Clearance Granted: ${batch.batchNumber}`,
              message: `Quality Team approved large batch ${batch.batchNumber}. Awaiting State Office sanction.`,
              type: 'SUCCESS',
              link: `/state`,
            },
            tx
          );

          await EventService.createOutboxEvent(
            {
              eventType: 'batch.quality_approved',
              aggregateType: 'BATCH',
              aggregateId: batch.id,
              payload: { batchId },
            },
            tx
          );

          return updatedBatch;
        } else if (decision === 'RETURN') {
          if (!comments) throw { status: 400, message: 'Comments are required when returning batch from quality review.' };

          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: {
              status: 'RETURNED_FOR_CORRECTION',
              returnedAt: new Date(),
              returnReason: `Quality Team Return: ${comments}`,
            },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'QUALITY_REVIEW_RETURNED',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: 'QUALITY_REVIEW' },
              newState: { status: 'RETURNED_FOR_CORRECTION', reason: comments },
            },
            tx
          );

          await EventService.createOutboxEvent(
            {
              eventType: 'batch.returned',
              aggregateType: 'BATCH',
              aggregateId: batch.id,
              payload: { batchId, reason: comments },
            },
            tx
          );

          return updatedBatch;
        } else {
          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: {
              status: 'REJECTED',
              rejectedAt: new Date(),
              rejectionReason: `Quality Team Rejection: ${comments}`,
            },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'QUALITY_REVIEW_REJECTED',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: 'QUALITY_REVIEW' },
              newState: { status: 'REJECTED', reason: comments },
            },
            tx
          );

          CacheService.delPattern('dashboard:*');
          CacheService.delPattern('batches:*');
          CacheService.delPattern('dashboard:*');
          CacheService.delPattern('batches:*');
          CacheService.delPattern('certs:*');
          return updatedBatch;
        }
      },
      { timeout: 30000, maxWait: 10000 }
    );
  }

  /**
   * State Office Approval
   */
  static async recordStateDecision(params: DecisionParams) {
    const { batchId, decision, comments, user } = params;

    return await prisma.$transaction(
      async (tx) => {
        const batch = await tx.batch.findUnique({ where: { id: batchId } });
        if (!batch) throw { status: 404, message: 'Batch not found.' };

        if (batch.status !== 'STATE_REVIEW') {
          throw { status: 400, message: `Batch is not awaiting State Office review. Current status: ${batch.status}` };
        }

        await tx.stateApproval.create({
          data: {
            batchId,
            versionNumber: batch.currentVersionNumber,
            officerId: user.id,
            officerName: user.name,
            status: decision === 'APPROVE' ? 'APPROVED' : decision === 'RETURN' ? 'RETURNED' : 'REJECTED',
            comments: comments || `${decision} by State Directorate`,
          },
        });

        if (decision === 'APPROVE') {
          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: {
              status: 'APPROVED',
              approvedAt: new Date(),
            },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'STATE_FINAL_APPROVAL_GRANTED',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: 'STATE_REVIEW' },
              newState: { status: 'APPROVED' },
              metadata: { sanctionedBy: user.name },
            },
            tx
          );

          await NotificationService.send(
            {
              roleTarget: 'TRAINING_CENTRE',
              title: `Batch Approved: ${batch.batchNumber}`,
              message: `Batch ${batch.batchNumber} received final state approval! Certificates are being queued for generation.`,
              type: 'SUCCESS',
              link: `/batches/${batch.id}`,
            },
            tx
          );

          await EventService.createOutboxEvent(
            {
              eventType: 'certificate.generation_requested',
              aggregateType: 'BATCH',
              aggregateId: batch.id,
              payload: { batchId: batch.id },
            },
            tx
          );

          return updatedBatch;
        } else if (decision === 'RETURN') {
          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: {
              status: 'RETURNED_FOR_CORRECTION',
              returnedAt: new Date(),
              returnReason: `State Directorate Return: ${comments}`,
            },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'STATE_RETURNED_FOR_CORRECTION',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: 'STATE_REVIEW' },
              newState: { status: 'RETURNED_FOR_CORRECTION', reason: comments },
            },
            tx
          );

          return updatedBatch;
        } else {
          const updatedBatch = await tx.batch.update({
            where: { id: batchId },
            data: {
              status: 'REJECTED',
              rejectedAt: new Date(),
              rejectionReason: `State Directorate Rejection: ${comments}`,
            },
          });

          await AuditService.log(
            {
              userId: user.id,
              userRole: user.role,
              action: 'STATE_BATCH_REJECTED',
              entityType: 'BATCH',
              entityId: batchId,
              previousState: { status: 'STATE_REVIEW' },
              newState: { status: 'REJECTED', reason: comments },
            },
            tx
          );

          CacheService.delPattern('dashboard:*');
          CacheService.delPattern('batches:*');
          CacheService.delPattern('certs:*');
          return updatedBatch;
        }
      },
      { timeout: 30000, maxWait: 10000 }
    );
  }

  /**
   * Resubmit Returned Batch
   */
  static async resubmitReturnedBatch(batchId: string, user: AuthUser, notes?: string) {
    return await prisma.$transaction(
      async (tx) => {
        const batch = await tx.batch.findUnique({
          where: { id: batchId },
          include: { candidates: true },
        });

        if (!batch) throw { status: 404, message: 'Batch not found.' };

        if (batch.status !== 'RETURNED_FOR_CORRECTION') {
          throw {
            status: 400,
            message: `Only batches with status RETURNED_FOR_CORRECTION can be resubmitted. Current status: ${batch.status}`,
          };
        }

        if (batch.candidates.length === 0) {
          throw { status: 400, message: 'Cannot resubmit batch without any candidate records.' };
        }

        const nextVersion = batch.currentVersionNumber + 1;

        const versionRecord = await tx.batchVersion.create({
          data: {
            batchId: batch.id,
            versionNumber: nextVersion,
            candidateCount: batch.candidates.length,
            status: 'RESUBMITTED',
            notes: notes || `Resubmitted after addressing return corrections. Prior version was ${batch.currentVersionNumber}.`,
          },
        });

        await tx.candidate.updateMany({
          where: { batchId: batch.id },
          data: { batchVersionId: versionRecord.id },
        });

        const updatedBatch = await tx.batch.update({
          where: { id: batchId },
          data: {
            currentVersionNumber: nextVersion,
            status: 'DISTRICT_REVIEW',
            submittedAt: new Date(),
            returnReason: null,
            returnedAt: null,
          },
        });

        await AuditService.log(
          {
            userId: user.id,
            userRole: user.role,
            action: 'BATCH_RESUBMITTED_NEW_VERSION',
            entityType: 'BATCH',
            entityId: batch.id,
            previousState: { status: 'RETURNED_FOR_CORRECTION', version: batch.currentVersionNumber },
            newState: { status: 'DISTRICT_REVIEW', version: nextVersion },
            metadata: { notes, policy: 'Prior version approvals invalidated; fresh 2-officer review required.' },
          },
          tx
        );

        await NotificationService.send(
          {
            roleTarget: 'DISTRICT_OFFICER',
            title: `Resubmitted Batch: ${batch.batchNumber} (v${nextVersion})`,
            message: `Batch ${batch.batchNumber} was updated by Training Centre and resubmitted for fresh district review.`,
            type: 'INFO',
            link: `/batches/${batch.id}`,
          },
          tx
        );

        await EventService.createOutboxEvent(
          {
            eventType: 'batch.submitted',
            aggregateType: 'BATCH',
            aggregateId: batch.id,
            payload: { batchId: batch.id, version: nextVersion, isResubmission: true },
          },
          tx
        );

        CacheService.delPattern('dashboard:*');
        CacheService.delPattern('batches:*');
        return updatedBatch;
      },
      { timeout: 30000, maxWait: 10000 }
    );
  }
}
