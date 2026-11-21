export type Role = 'TRAINING_CENTRE' | 'DISTRICT_OFFICER' | 'QUALITY_TEAM' | 'STATE_OFFICE';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  districtId?: string | null;
  trainingCentreId?: string | null;
  district?: { id: string; name: string; code: string } | null;
  trainingCentre?: { id: string; name: string; code: string } | null;
}

export type BatchStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DISTRICT_REVIEW'
  | 'QUALITY_REVIEW'
  | 'STATE_REVIEW'
  | 'APPROVED'
  | 'CERTIFICATE_GENERATION'
  | 'CERTIFICATES_ISSUED'
  | 'REJECTED'
  | 'RETURNED_FOR_CORRECTION';

export interface Batch {
  id: string;
  batchNumber: string;
  title: string;
  courseName: string;
  trainingCentreId: string;
  districtId: string;
  currentVersionNumber: number;
  status: BatchStatus;
  totalCandidates: number;
  passedCandidates: number;
  failedCandidates: number;
  requiresQualityReview: boolean;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  returnedAt?: string | null;
  returnReason?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  trainingCentre: { id: string; name: string; code: string };
  district: { id: string; name: string; code: string; state?: string };
  districtApprovals?: DistrictApproval[];
  qualityReviews?: QualityReview[];
  stateApprovals?: StateApproval[];
  versions?: BatchVersion[];
  candidates?: Candidate[];
  certificates?: Certificate[];
  _count?: {
    candidates: number;
    certificates: number;
  };
}

export interface BatchVersion {
  id: string;
  batchId: string;
  versionNumber: number;
  csvFileName?: string | null;
  candidateCount: number;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface Candidate {
  id: string;
  batchId: string;
  batchVersionId: string;
  name: string;
  email: string;
  phone: string;
  courseName: string;
  trainingCentreName: string;
  districtName: string;
  completionDate: string;
  assessmentStatus: 'PASSED' | 'FAILED';
  createdAt: string;
  certificate?: {
    id: string;
    certificateNumber: string;
    status: string;
  } | null;
}

export interface DistrictApproval {
  id: string;
  batchId: string;
  versionNumber: number;
  officerId: string;
  officerName: string;
  status: 'APPROVED' | 'REJECTED' | 'RETURNED';
  comments?: string | null;
  decidedAt: string;
}

export interface QualityReview {
  id: string;
  batchId: string;
  versionNumber: number;
  reviewerId: string;
  reviewerName: string;
  status: 'APPROVED' | 'REJECTED' | 'RETURNED';
  comments?: string | null;
  decidedAt: string;
}

export interface StateApproval {
  id: string;
  batchId: string;
  versionNumber: number;
  officerId: string;
  officerName: string;
  status: 'APPROVED' | 'REJECTED' | 'RETURNED';
  comments?: string | null;
  decidedAt: string;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  candidateId: string;
  batchId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  courseName: string;
  trainingCentreName: string;
  districtName: string;
  issueDate: string;
  status: 'VALID' | 'CANCELLED';
  pdfPath?: string | null;
  qrCodeDataUrl?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  batch?: { batchNumber: string; courseName: string };
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: string | null;
  newState?: string | null;
  metadata?: string | null;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  userId?: string | null;
  roleTarget?: string | null;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  link?: string | null;
  createdAt: string;
}

export interface WhatsAppDeliveryLog {
  id: string;
  certificateId: string;
  candidatePhone: string;
  candidateName: string;
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  attempts: number;
  lastAttemptAt?: string | null;
  errorMessage?: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  certificate?: {
    certificateNumber: string;
    courseName: string;
    trainingCentreName: string;
  };
}

export interface DelayedBatchItem {
  id: string;
  batchNumber: string;
  title: string;
  status: string;
  trainingCentreName: string;
  districtName: string;
  totalCandidates: number;
  stageEnteredAt: string;
  hoursElapsed: number;
  slaHours: number;
  isOverdue: boolean;
}

export interface DashboardStats {
  batches: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    returned: number;
    certificatesIssued: number;
    breakdown: {
      districtReview: number;
      qualityReview: number;
      stateReview: number;
    };
  };
  candidates: {
    total: number;
    passed: number;
    failed: number;
  };
  certificates: {
    total: number;
    valid: number;
    cancelled: number;
  };
  monitoring: {
    delayedCount: number;
    delayedBatches: DelayedBatchItem[];
    slaHoursDistrict: number;
    slaHoursState: number;
    largeBatchThreshold: number;
  };
  recentActivity: AuditLog[];
  recentWhatsAppDeliveries: WhatsAppDeliveryLog[];
}

export interface CsvValidationError {
  row: number;
  field: string;
  error: string;
  value?: string;
}

export interface CsvUploadResponse {
  success: boolean;
  isValid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: CsvValidationError[];
  message: string;
  batch?: Batch;
}
