import { prisma } from '../../database';
import { config } from '../../config';
import { CsvService } from '../csv/csv.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { EventService } from '../events/event.service';
import { CacheService } from '../cache/cache.service';
import { AuthUser } from '../../middleware/auth.middleware';

export interface CreateBatchDto {
  title: string;
  courseName: string;
  districtId: string;
  trainingCentreId: string;
}

export class BatchService {
  static async createBatch(data: CreateBatchDto, user: AuthUser) {
    const count = await prisma.batch.count();
    const batchNumber = `BATCH-2026-${String(count + 1).padStart(3, '0')}`;

    const batch = await prisma.batch.create({
      data: {
        batchNumber,
        title: data.title,
        courseName: data.courseName,
        districtId: data.districtId,
        trainingCentreId: data.trainingCentreId,
        status: 'DRAFT',
        currentVersionNumber: 1,
      },
      include: {
        district: true,
        trainingCentre: true,
      },
    });

    // Create initial version record
    await prisma.batchVersion.create({
      data: {
        batchId: batch.id,
        versionNumber: 1,
        status: 'DRAFT',
        notes: 'Initial batch draft created.',
      },
    });

    await AuditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'BATCH_CREATED',
      entityType: 'BATCH',
      entityId: batch.id,
      newState: { batchNumber, title: data.title, status: 'DRAFT' },
    });

    CacheService.delPattern('dashboard:*');
    CacheService.delPattern('batches:*');

    return batch;
  }

  static async getBatches(user: AuthUser, query?: { status?: string; search?: string; limit?: number }) {
    const where: any = {};

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query?.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { batchNumber: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { courseName: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Role-based visibility
    if (user.role === 'TRAINING_CENTRE') {
      if (user.trainingCentreId) {
        where.trainingCentreId = user.trainingCentreId;
      }
    } else if (user.role === 'DISTRICT_OFFICER') {
      if (user.districtId) {
        where.districtId = user.districtId;
      }
    }

    return await prisma.batch.findMany({
      where,
      include: {
        trainingCentre: { select: { id: true, name: true, code: true } },
        district: { select: { id: true, name: true, code: true } },
        districtApprovals: {
          select: {
            id: true,
            versionNumber: true,
            officerId: true,
            officerName: true,
            status: true,
            comments: true,
            decidedAt: true,
          },
        },
        _count: {
          select: {
            candidates: true,
            certificates: true,
          },
        },
      },
      take: query?.limit || 100,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getBatchById(id: string) {
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        trainingCentre: true,
        district: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        candidates: {
          orderBy: { name: 'asc' },
        },
        districtApprovals: {
          orderBy: { decidedAt: 'desc' },
        },
        qualityReviews: {
          orderBy: { decidedAt: 'desc' },
        },
        stateApprovals: {
          orderBy: { decidedAt: 'desc' },
        },
        certificates: {
          select: {
            id: true,
            certificateNumber: true,
            candidateName: true,
            status: true,
            issueDate: true,
            cancellationReason: true,
          },
        },
      },
    });

    if (!batch) {
      throw { status: 404, message: 'Batch not found' };
    }

    return batch;
  }

  /**
   * Upload and process candidate CSV atomically.
   */
  static async uploadCandidatesCsv(batchId: string, csvContent: string, fileName: string, user: AuthUser) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw { status: 404, message: 'Batch not found.' };
    }

    if (batch.status !== 'DRAFT' && batch.status !== 'RETURNED_FOR_CORRECTION') {
      throw {
        status: 400,
        message: `Candidates can only be uploaded when batch is in DRAFT or RETURNED_FOR_CORRECTION status. Current status: ${batch.status}`,
      };
    }

    // 1. Run atomic validation
    const validationResult = CsvService.parseAndValidate(csvContent);

    if (!validationResult.isValid) {
      return {
        success: false,
        isValid: false,
        totalRows: validationResult.totalRows,
        validRows: validationResult.validRows,
        invalidRows: validationResult.invalidRows,
        errors: validationResult.errors,
        message: 'CSV validation failed. No records were persisted.',
      };
    }

    // 2. Persist in a single fast database transaction
    return await prisma.$transaction(
      async (tx) => {
        let versionRecord = await tx.batchVersion.findUnique({
          where: {
            batchId_versionNumber: {
              batchId: batch.id,
              versionNumber: batch.currentVersionNumber,
            },
          },
        });

        if (!versionRecord) {
          versionRecord = await tx.batchVersion.create({
            data: {
              batchId: batch.id,
              versionNumber: batch.currentVersionNumber,
              csvFileName: fileName,
              candidateCount: validationResult.parsedCandidates.length,
              status: batch.status,
            },
          });
        } else {
          await tx.batchVersion.update({
            where: { id: versionRecord.id },
            data: {
              csvFileName: fileName,
              candidateCount: validationResult.parsedCandidates.length,
            },
          });
        }

        // Delete existing candidates for this version to avoid duplicates on re-upload
        await tx.candidate.deleteMany({
          where: { batchId: batch.id, batchVersionId: versionRecord.id },
        });

        let passedCount = 0;
        let failedCount = 0;

        const candidatesData = validationResult.parsedCandidates.map((c) => {
          if (c.assessmentStatus === 'PASSED') passedCount++;
          else failedCount++;

          return {
            batchId: batch.id,
            batchVersionId: versionRecord!.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            courseName: c.courseName,
            trainingCentreName: c.trainingCentreName,
            districtName: c.districtName,
            completionDate: c.completionDate,
            assessmentStatus: c.assessmentStatus,
          };
        });

        // Fast batch insert
        await tx.candidate.createMany({
          data: candidatesData,
        });

        const totalCandidates = validationResult.parsedCandidates.length;
        const requiresQualityReview = totalCandidates >= config.largeBatchThreshold;

        const updatedBatch = await tx.batch.update({
          where: { id: batch.id },
          data: {
            totalCandidates,
            passedCandidates: passedCount,
            failedCandidates: failedCount,
            requiresQualityReview,
          },
        });

        await AuditService.log(
          {
            userId: user.id,
            userRole: user.role,
            action: 'CANDIDATES_CSV_UPLOADED',
            entityType: 'BATCH',
            entityId: batch.id,
            newState: {
              totalCandidates,
              passedCount,
              failedCount,
              requiresQualityReview,
              fileName,
            },
          },
          tx
        );

        CacheService.delPattern('dashboard:*');
        CacheService.delPattern('batches:*');
        CacheService.delPattern('candidates:*');

        return {
          success: true,
          isValid: true,
          totalRows: validationResult.totalRows,
          validRows: validationResult.validRows,
          invalidRows: 0,
          errors: [],
          batch: updatedBatch,
          message: `Successfully uploaded and validated ${totalCandidates} candidates!`,
        };
      },
      { timeout: 30000, maxWait: 10000 }
    );
  }

  /**
   * Submit Batch for District Approval
   */
  static async submitBatch(batchId: string, user: AuthUser) {
    return await prisma.$transaction(
      async (tx) => {
        const batch = await tx.batch.findUnique({
          where: { id: batchId },
          include: { candidates: true },
        });

        if (!batch) throw { status: 404, message: 'Batch not found.' };

        if (batch.status !== 'DRAFT') {
          throw { status: 400, message: `Only DRAFT batches can be submitted. Current status: ${batch.status}` };
        }

        if (batch.candidates.length === 0) {
          throw { status: 400, message: 'Cannot submit a batch with 0 candidates. Please upload a valid CSV first.' };
        }

        const requiresQualityReview = batch.candidates.length >= config.largeBatchThreshold;

        const updatedBatch = await tx.batch.update({
          where: { id: batchId },
          data: {
            status: 'DISTRICT_REVIEW',
            submittedAt: new Date(),
            requiresQualityReview,
          },
        });

        await AuditService.log(
          {
            userId: user.id,
            userRole: user.role,
            action: 'BATCH_SUBMITTED',
            entityType: 'BATCH',
            entityId: batch.id,
            previousState: { status: 'DRAFT' },
            newState: { status: 'DISTRICT_REVIEW', requiresQualityReview },
          },
          tx
        );

        await NotificationService.send(
          {
            roleTarget: 'DISTRICT_OFFICER',
            title: `New Batch Submitted: ${batch.batchNumber}`,
            message: `Training centre submitted batch ${batch.batchNumber} (${batch.candidates.length} candidates) for district approval.`,
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
            payload: { batchId: batch.id, totalCandidates: batch.candidates.length, requiresQualityReview },
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
