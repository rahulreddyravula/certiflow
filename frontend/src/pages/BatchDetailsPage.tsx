import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { api } from '../api/client';
import { Batch, CsvUploadResponse } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import {
  Layers,
  ArrowLeft,
  Upload,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldAlert,
  Award,
  Users,
  AlertTriangle,
  FileText,
  Clock,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';

export const BatchDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);

  // CSV Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<CsvUploadResponse | null>(null);

  // Approval Decision Modal State
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'district' | 'quality' | 'state'>('district');
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'RETURN' | 'REJECT'>('APPROVE');
  const [comments, setComments] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Resubmit Modal State
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [resubmitting, setResubmitting] = useState(false);

  const fetchBatch = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/batches/${id}`);
      setBatch(res.data.batch);
    } catch (err) {
      console.error('Failed to load batch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatch();

    const handleUpdate = (e: any) => {
      if (!e.detail || e.detail.type === 'batch' || e.detail.type === 'all' || e.detail.type === 'certificate') {
        fetchBatch();
      }
    };
    window.addEventListener('certiflow:update', handleUpdate);
    return () => window.removeEventListener('certiflow:update', handleUpdate);
  }, [id]);

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !batch) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/batches/${batch.id}/upload-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(res.data);
      addToast({
        title: 'Upload Successful',
        message: res.data.message,
        type: 'SUCCESS',
      });
      fetchBatch();
      setTimeout(() => {
        setIsUploadOpen(false);
        setFile(null);
        setUploadResult(null);
      }, 1500);
    } catch (err: any) {
      if (err.response?.data) {
        setUploadResult(err.response.data);
      } else {
        addToast({
          title: 'Upload Failed',
          message: err.message || 'Error processing CSV file.',
          type: 'ERROR',
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitForDistrict = async () => {
    if (!batch) return;
    try {
      await api.post(`/batches/${batch.id}/submit`);
      addToast({
        title: 'Submitted for Review',
        message: `Batch ${batch.batchNumber} has been sent for district approval.`,
        type: 'SUCCESS',
      });
      fetchBatch();
    } catch (err: any) {
      addToast({
        title: 'Submission Failed',
        message: err.response?.data?.error || 'Failed to submit batch.',
        type: 'ERROR',
      });
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;
    setDecisionError(null);
    setSubmittingDecision(true);

    let endpoint = `/batches/${batch.id}/district-decision`;
    if (decisionType === 'quality') endpoint = `/batches/${batch.id}/quality-decision`;
    if (decisionType === 'state') endpoint = `/batches/${batch.id}/state-decision`;

    try {
      await api.post(endpoint, {
        decision: decisionAction,
        comments,
      });

      addToast({
        title: 'Decision Recorded',
        message: `Decision '${decisionAction}' was logged successfully.`,
        type: 'SUCCESS',
      });

      setIsDecisionOpen(false);
      setComments('');
      fetchBatch();
    } catch (err: any) {
      setDecisionError(err.response?.data?.error || 'Failed to record decision.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleResubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;
    setResubmitting(true);
    try {
      await api.post(`/batches/${batch.id}/resubmit`, { notes: resubmitNotes });
      addToast({
        title: 'Batch Resubmitted',
        message: `Batch ${batch.batchNumber} resubmitted as new version. Prior decisions preserved.`,
        type: 'SUCCESS',
      });
      setIsResubmitOpen(false);
      setResubmitNotes('');
      fetchBatch();
    } catch (err: any) {
      addToast({
        title: 'Resubmission Failed',
        message: err.response?.data?.error || 'Failed to resubmit batch.',
        type: 'ERROR',
      });
    } finally {
      setResubmitting(false);
    }
  };

  if (loading || !batch) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading batch details...</div>;
  }

  const role = user?.role;
  const isTC = role === 'TRAINING_CENTRE';
  const isDO = role === 'DISTRICT_OFFICER' || role === 'STATE_OFFICE';
  const isQuality = role === 'QUALITY_TEAM' || role === 'STATE_OFFICE';
  const isState = role === 'STATE_OFFICE';

  const currentVersionDistrictApprovals =
    batch.districtApprovals?.filter(
      (a) => a.versionNumber === batch.currentVersionNumber && a.status === 'APPROVED'
    ) || [];

  const officerAlreadyApproved = currentVersionDistrictApprovals.some(
    (a) => a.officerId === user?.id
  );

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/batches')}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Batches Registry</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Training Centre actions */}
          {isTC && batch.status === 'DRAFT' && (
            <>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors min-h-[40px]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Candidates CSV</span>
              </button>

              <button
                onClick={handleSubmitForDistrict}
                disabled={batch.totalCandidates === 0}
                className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-sm disabled:opacity-50 transition-all min-h-[40px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for District Approval</span>
              </button>
            </>
          )}

          {/* Returned for Correction: Resubmit CTA */}
          {isTC && batch.status === 'RETURNED_FOR_CORRECTION' && (
            <>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors min-h-[40px]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Updated CSV</span>
              </button>

              <button
                onClick={() => setIsResubmitOpen(true)}
                className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resubmit Batch for Review</span>
              </button>
            </>
          )}

          {/* District Officer Review Button */}
          {isDO && batch.status === 'DISTRICT_REVIEW' && (
            <button
              onClick={() => {
                setDecisionType('district');
                setIsDecisionOpen(true);
              }}
              disabled={officerAlreadyApproved}
              className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-sm disabled:opacity-50 transition-all min-h-[40px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {officerAlreadyApproved
                  ? 'Your Approval Recorded'
                  : `Record District Decision (${currentVersionDistrictApprovals.length}/2 Approved)`}
              </span>
            </button>
          )}

          {/* Quality Team Review Button */}
          {isQuality && batch.status === 'QUALITY_REVIEW' && (
            <button
              onClick={() => {
                setDecisionType('quality');
                setIsDecisionOpen(true);
              }}
              className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Record Quality Review Decision</span>
            </button>
          )}

          {/* State Office Final Sanction Button */}
          {isState && batch.status === 'STATE_REVIEW' && (
            <button
              onClick={() => {
                setDecisionType('state');
                setIsDecisionOpen(true);
              }}
              className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>Grant State Final Sanction</span>
            </button>
          )}
        </div>
      </div>

      {/* Returned Batch Alert Box if RETURNED_FOR_CORRECTION */}
      {batch.status === 'RETURNED_FOR_CORRECTION' && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-orange-950 shadow-xs flex items-start space-x-4">
          <RotateCcw className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-orange-900">
              Batch Returned for Correction (Version {batch.currentVersionNumber})
            </h4>
            <p className="text-xs text-orange-800 mt-1 leading-relaxed bg-white/60 p-3 rounded-xl border border-orange-200/60 font-mono">
              Reason: {batch.returnReason || 'No specific explanation logged.'}
            </p>
            <p className="text-[11px] text-orange-700 mt-2">
              <strong>Policy:</strong> When corrected and resubmitted, a new version will be created. Prior approval decisions remain in the immutable history, and fresh district consensus will be required.
            </p>
          </div>
        </div>
      )}

      {/* Batch Overview Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="font-mono text-xs font-bold text-slate-500">{batch.batchNumber}</span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Version {batch.currentVersionNumber}
              </span>
              <StatusBadge status={batch.status} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-2 truncate">{batch.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{batch.courseName}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Candidates</span>
              <span className="text-base sm:text-lg font-bold text-slate-900">{batch.totalCandidates}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Passed</span>
              <span className="text-base sm:text-lg font-bold text-emerald-600">{batch.passedCandidates}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Certificates</span>
              <span className="text-base sm:text-lg font-bold text-brand-600">
                {batch.certificates?.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Facility Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 text-xs text-slate-600">
          <div className="p-3 rounded-xl bg-slate-50 sm:bg-transparent border sm:border-0 border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Training Facility</span>
            <span className="font-bold text-slate-800 block truncate">{batch.trainingCentre.name}</span>
            <span className="block text-[11px] text-slate-400">Code: {batch.trainingCentre.code}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 sm:bg-transparent border sm:border-0 border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Jurisdiction</span>
            <span className="font-bold text-slate-800 block truncate">{batch.district.name} District</span>
            <span className="block text-[11px] text-slate-400">{batch.district?.state || 'Madhya Pradesh'}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 sm:bg-transparent border sm:border-0 border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Quality Scrutiny</span>
            <span className="font-bold text-slate-800 block truncate">
              {batch.requiresQualityReview ? 'Required (Large Batch >= 50)' : 'Standard (Direct to State)'}
            </span>
          </div>
        </div>
      </div>

      {/* Two-Officer District Consensus Tracker */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              District Two-Officer Consensus Gate (Version {batch.currentVersionNumber})
            </h3>
          </div>
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
            Requirement: 2 distinct authorized district officers must approve
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Officer 1 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Primary District Officer Review</span>
              {currentVersionDistrictApprovals[0] ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  APPROVED
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  PENDING REVIEW
                </span>
              )}
            </div>
            {currentVersionDistrictApprovals[0] ? (
              <div className="mt-2 text-xs">
                <span className="font-semibold text-slate-900 block">
                  {currentVersionDistrictApprovals[0].officerName}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {new Date(currentVersionDistrictApprovals[0].decidedAt).toLocaleString()}
                </span>
                <p className="text-[11px] text-slate-600 mt-1 italic">
                  "{currentVersionDistrictApprovals[0].comments}"
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Awaiting first officer evaluation.</p>
            )}
          </div>

          {/* Officer 2 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Secondary District Officer Review</span>
              {currentVersionDistrictApprovals[1] ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  APPROVED
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  PENDING SECOND OFFICER
                </span>
              )}
            </div>
            {currentVersionDistrictApprovals[1] ? (
              <div className="mt-2 text-xs">
                <span className="font-semibold text-slate-900 block">
                  {currentVersionDistrictApprovals[1].officerName}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {new Date(currentVersionDistrictApprovals[1].decidedAt).toLocaleString()}
                </span>
                <p className="text-[11px] text-slate-600 mt-1 italic">
                  "{currentVersionDistrictApprovals[1].comments}"
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Awaiting distinct second authorized officer clearance.
              </p>
            )}
          </div>
        </div>

        {/* Historical decisions note */}
        {batch.districtApprovals && batch.districtApprovals.length > currentVersionDistrictApprovals.length && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 mb-2">Previous Version Audit History:</h4>
            <div className="space-y-1.5">
              {batch.districtApprovals
                .filter((a) => a.versionNumber !== batch.currentVersionNumber)
                .map((a) => (
                  <div key={a.id} className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      v{a.versionNumber} by {a.officerName} ({a.status}): "{a.comments}"
                    </span>
                    <span>{new Date(a.decidedAt).toLocaleDateString()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Candidate Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Enrolled Candidates ({batch.candidates?.length || 0})
            </h3>
            <span className="text-[11px] text-slate-500">
              Only candidates with PASSED assessment status are eligible for certificates.
            </span>
          </div>

          {isTC && batch.status === 'DRAFT' && (
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{batch.candidates?.length ? 'Re-upload CSV' : 'Upload CSV'}</span>
            </button>
          )}
        </div>

        {!batch.candidates || batch.candidates.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No candidates uploaded yet</h4>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Upload a CSV file containing candidate names, emails, phone numbers, and assessment results.
            </p>
            {isTC && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white font-semibold text-xs shadow-sm hover:bg-brand-500"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Candidate CSV</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Contact (Email / Phone)</th>
                  <th className="py-3 px-4">Completion Date</th>
                  <th className="py-3 px-4">Assessment Status</th>
                  <th className="py-3 px-4 text-right">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {batch.candidates.map((candidate, idx) => (
                  <tr key={candidate.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{candidate.name}</td>
                    <td className="py-3 px-4">
                      <span className="block text-slate-800">{candidate.email}</span>
                      <span className="block text-[11px] text-slate-400">{candidate.phone}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(candidate.completionDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          candidate.assessmentStatus === 'PASSED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {candidate.assessmentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px]">
                      {candidate.assessmentStatus === 'PASSED' && batch.status === 'CERTIFICATES_ISSUED' ? (
                        <span className="text-brand-600 font-bold">Issued</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Spreadsheet Upload & Atomic Validation Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload & Validate Candidate Spreadsheet (CSV / Excel)"
        description="Upload CSV or Excel (.csv, .xlsx, .xls). All rows will be rigorously checked. If any row contains errors, ZERO records will be saved."
        maxWidth="2xl"
      >
        <form onSubmit={handleCsvUpload} className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-brand-500 transition-colors bg-slate-50">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="text-xs font-bold text-slate-800 block">Select CSV or Excel spreadsheet to upload</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Must include: Candidate Name, Candidate Email, Phone Number, Course Name, Training Centre, District, Completion Date, Assessment Status
            </span>
            <input
              type="file"
              accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="mt-3 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
            />
          </div>

          {/* Validation Result Inspector */}
          {uploadResult && (
            <div className="space-y-3">
              <div
                className={`p-4 rounded-xl border text-xs ${
                  uploadResult.isValid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-bold">
                  <span>{uploadResult.isValid ? 'Validation Passed!' : 'Validation Failed!'}</span>
                  <span className="text-[11px] sm:text-xs font-mono">
                    Total: {uploadResult.totalRows} | Valid: {uploadResult.validRows} | Invalid:{' '}
                    {uploadResult.invalidRows}
                  </span>
                </div>
                <p className="mt-1">{uploadResult.message}</p>
              </div>

              {/* Error Breakdown Table */}
              {!uploadResult.isValid && uploadResult.errors?.length > 0 && (
                <div className="border border-rose-200 rounded-xl overflow-x-auto max-h-48 overflow-y-auto scrollbar-thin">
                  <table className="w-full min-w-[340px] text-left text-xs">
                    <thead className="bg-rose-100/60 text-rose-800 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Field</th>
                        <th className="py-2 px-3">Exact Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 text-slate-700">
                      {uploadResult.errors.map((err, i) => (
                        <tr key={i} className="hover:bg-rose-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-rose-700">{err.row}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{err.field}</td>
                          <td className="py-2 px-3 text-rose-600">{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsUploadOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm disabled:opacity-50"
            >
              {uploading ? 'Validating Spreadsheet...' : 'Validate & Save Batch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Review Decision Modal */}
      <Modal
        isOpen={isDecisionOpen}
        onClose={() => setIsDecisionOpen(false)}
        title={`Record ${decisionType.toUpperCase()} Review Decision`}
        description={`Submit your formal statutory evaluation for Batch ${batch.batchNumber}.`}
      >
        <form onSubmit={handleDecisionSubmit} className="space-y-4">
          {decisionError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {decisionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Decision
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecisionAction('APPROVE')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                  decisionAction === 'APPROVE'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setDecisionAction('RETURN')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                  decisionAction === 'RETURN'
                    ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Return (Corrections)
              </button>
              <button
                type="button"
                onClick={() => setDecisionAction('REJECT')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                  decisionAction === 'REJECT'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Reject Batch
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Comments / Statutory Explanation {decisionAction !== 'APPROVE' && '(Mandatory)'}
            </label>
            <textarea
              rows={3}
              required={decisionAction !== 'APPROVE'}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={
                decisionAction === 'APPROVE'
                  ? 'e.g. Training logs and attendance registers verified. Approved.'
                  : 'Please specify the exact reasons, missing documents, or corrections required...'
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDecisionOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingDecision}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm disabled:opacity-50"
            >
              {submittingDecision ? 'Submitting...' : 'Commit Decision'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Resubmit Modal */}
      <Modal
        isOpen={isResubmitOpen}
        onClose={() => setIsResubmitOpen(false)}
        title="Resubmit Corrected Batch"
        description="Resubmitting increments the batch version to v2. Previous approvals are invalidated and fresh district approvals will be required."
      >
        <form onSubmit={handleResubmitBatch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Resubmission Notes for District Officers
            </label>
            <textarea
              rows={3}
              value={resubmitNotes}
              onChange={(e) => setResubmitNotes(e.target.value)}
              placeholder="e.g. Corrected invalid phone numbers on candidate records. Clear attendance copies attached."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsResubmitOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-sm disabled:opacity-50"
            >
              {resubmitting ? 'Resubmitting...' : 'Confirm Resubmission'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
