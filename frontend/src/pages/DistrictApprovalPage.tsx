import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { Batch } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { CheckSquare, Eye, Clock, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

export const DistrictApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDistrictBatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/batches', {
        params: { status: 'DISTRICT_REVIEW' },
      });
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error('Failed to load district batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistrictBatches();

    const handleUpdate = (e: any) => {
      if (!e.detail || e.detail.type === 'batch' || e.detail.type === 'all') {
        fetchDistrictBatches();
      }
    };
    window.addEventListener('certiflow:update', handleUpdate);
    return () => window.removeEventListener('certiflow:update', handleUpdate);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
              District Jurisdiction: {user?.district?.name || 'All Assigned'}
            </span>
            <span className="text-xs text-slate-400">• Two-Officer Consensus</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            District Approvals Queue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every candidate batch requires approval from two distinct authorized district officers.
          </p>
        </div>
      </div>

      {/* Consensus Rule Reminder Banner */}
      <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-blue-950">Statutory Two-Officer Rule Enforced</h4>
          <p className="text-blue-800 mt-0.5 leading-relaxed">
            Officer 1 reviews candidate attendance and local training facility logs. Officer 2 performs independent cross-verification. Duplicate approvals by the same officer are cryptographically prevented.
          </p>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading district review queue...</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">District Queue is Clear</h3>
            <p className="text-xs text-slate-500 mt-1">
              No batches are currently awaiting district officer approval in this jurisdiction.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Batch Number</th>
                  <th className="py-3.5 px-4">Course & Title</th>
                  <th className="py-3.5 px-4">Training Centre</th>
                  <th className="py-3.5 px-4">Candidates</th>
                  <th className="py-3.5 px-4">Consensus Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {batches.map((batch) => {
                  const currentApprovals =
                    batch.districtApprovals?.filter(
                      (a) =>
                        a.versionNumber === batch.currentVersionNumber && a.status === 'APPROVED'
                    ) || [];
                  const userAlreadyVoted = currentApprovals.some((a) => a.officerId === user?.id);

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {batch.batchNumber}
                        <span className="block text-[10px] text-slate-400 font-sans font-normal">
                          v{batch.currentVersionNumber}
                        </span>
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

                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {batch.totalCandidates}
                        {batch.requiresQualityReview && (
                          <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold">
                            Large Batch
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              currentApprovals.length === 1
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {currentApprovals.length === 1
                              ? '1 of 2 Approved'
                              : '0 of 2 Approved'}
                          </span>
                          {userAlreadyVoted && (
                            <span className="text-[10px] text-emerald-600 font-semibold">
                              (You Approved)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate(`/batches/${batch.id}`)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 font-semibold text-white shadow-2xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review & Decide</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
