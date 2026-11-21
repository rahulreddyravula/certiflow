import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { Batch, DelayedBatchItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import {
  Building2,
  Award,
  Eye,
  AlertTriangle,
  Clock,
  ShieldBan,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export const StateOfficePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [delayedBatches, setDelayedBatches] = useState<DelayedBatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Certificate Cancellation State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [certIdentifier, setCertIdentifier] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStateData = async () => {
    try {
      setLoading(true);
      const [batchesRes, delayedRes] = await Promise.all([
        api.get('/batches', { params: { status: 'STATE_REVIEW' } }),
        api.get('/monitoring/delayed-batches'),
      ]);
      setBatches(batchesRes.data.batches || []);
      setDelayedBatches(delayedRes.data.delayedBatches || []);
    } catch (err) {
      console.error('Failed to load state office data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStateData();

    const handleUpdate = (e: any) => {
      if (!e.detail || e.detail.type === 'batch' || e.detail.type === 'certificate' || e.detail.type === 'all') {
        fetchStateData();
      }
    };
    window.addEventListener('certiflow:update', handleUpdate);
    return () => window.removeEventListener('certiflow:update', handleUpdate);
  }, [user?.id]);

  const handleCancelCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certIdentifier || !cancelReason) return;

    setCancelling(true);
    setCancelStatus(null);
    try {
      const res = await api.post(`/certificates/${certIdentifier}/cancel`, {
        reason: cancelReason,
      });
      setCancelStatus({
        success: true,
        message: `Certificate ${res.data.certificate.certificateNumber} officially cancelled. Verification status is now CANCELLED.`,
      });
      setCertIdentifier('');
      setCancelReason('');
    } catch (err: any) {
      setCancelStatus({
        success: false,
        message: err.response?.data?.error || 'Failed to cancel certificate.',
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
              State Directorate Authority
            </span>
            <span className="text-xs text-slate-400">• Final Sanction & Cancellation Authority</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            State Executive Command Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Grant final sanction to approved candidate batches and execute statutory certificate revocations.
          </p>
        </div>

        <button
          onClick={() => setIsCancelModalOpen(true)}
          className="w-full sm:w-auto justify-center inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
        >
          <ShieldBan className="w-4 h-4" />
          <span>Revoke / Cancel Certificate</span>
        </button>
      </div>

      {/* SLA Delayed Batches Warning Card */}
      {delayedBatches.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-950 shadow-xs">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
              SLA Overdue Batches Requiring Executive Intervention ({delayedBatches.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100/60">
                <tr>
                  <th className="py-2 px-3">Batch Number</th>
                  <th className="py-2 px-3">Training Centre</th>
                  <th className="py-2 px-3">Stage</th>
                  <th className="py-2 px-3">Elapsed Time</th>
                  <th className="py-2 px-3">SLA Target</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/60">
                {delayedBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-amber-100/40">
                    <td className="py-2 px-3 font-mono font-bold text-amber-950">{b.batchNumber}</td>
                    <td className="py-2 px-3 text-amber-900">{b.trainingCentreName}</td>
                    <td className="py-2 px-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-2 px-3 font-bold text-rose-700">{b.hoursElapsed} hours</td>
                    <td className="py-2 px-3 text-amber-800">{b.slaHours} hours</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => navigate(`/batches/${b.id}`)}
                        className="text-xs font-bold text-brand-700 hover:text-brand-900"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batches Awaiting Final Sanction */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Batches Awaiting Final State Approval ({batches.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Granting approval here triggers automatic background PDF certificate generation.
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading state approval queue...</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">State Sanction Queue is Up to Date</h3>
            <p className="text-xs text-slate-500 mt-1">
              All batches cleared by district officers and quality teams have received final sanction.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Batch Number</th>
                  <th className="py-3.5 px-4">Course & Title</th>
                  <th className="py-3.5 px-4">Centre & District</th>
                  <th className="py-3.5 px-4">Eligible Candidates</th>
                  <th className="py-3.5 px-4">Quality Status</th>
                  <th className="py-3.5 px-4 text-right">Sanction Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {batch.batchNumber}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <span className="font-bold text-slate-900 block truncate">{batch.title}</span>
                      <span className="text-[11px] text-slate-500 truncate block">
                        {batch.courseName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800 block truncate">
                        {batch.trainingCentre?.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {batch.district?.name} District
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">
                      {batch.passedCandidates} Passed
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Cleared
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => navigate(`/batches/${batch.id}`)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-semibold text-white shadow-2xs transition-colors"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Inspect & Sanction</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Certificate Revocation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setCancelStatus(null);
        }}
        title="Statutory Certificate Revocation / Cancellation"
        description="Only the State Directorate has legal authority to cancel an issued certificate. Verification will immediately show CANCELLED."
      >
        <form onSubmit={handleCancelCertificate} className="space-y-4">
          {cancelStatus && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                cancelStatus.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {cancelStatus.message}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Certificate Number or Database ID
            </label>
            <input
              type="text"
              required
              value={certIdentifier}
              onChange={(e) => setCertIdentifier(e.target.value)}
              placeholder="e.g. CERT-2026-BPL-0001"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Statutory Revocation Reason (Mandatory & Audited)
            </label>
            <textarea
              rows={3}
              required
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Audit inquiry confirmed falsified practical biometric verification on 2026-11-15."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCancelModalOpen(false);
                setCancelStatus(null);
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={cancelling || !certIdentifier || !cancelReason}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm disabled:opacity-50"
            >
              {cancelling ? 'Revoking...' : 'Confirm Revocation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
