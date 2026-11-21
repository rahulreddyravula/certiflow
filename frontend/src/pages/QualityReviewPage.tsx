import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { Batch } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ShieldAlert, Eye, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

export const QualityReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQualityBatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/batches', {
        params: { status: 'QUALITY_REVIEW' },
      });
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error('Failed to load quality review batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityBatches();

    const handleUpdate = (e: any) => {
      if (!e.detail || e.detail.type === 'batch' || e.detail.type === 'all') {
        fetchQualityBatches();
      }
    };
    window.addEventListener('certiflow:update', handleUpdate);
    return () => window.removeEventListener('certiflow:update', handleUpdate);
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              Quality Assurance Desk
            </span>
            <span className="text-xs text-slate-400">• Large Batch Threshold &gt;= 50</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Quality Assurance & Audit Queue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Batches with 50+ candidates receive enhanced scrutiny before final state sanction.
          </p>
        </div>
      </div>

      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-amber-900">Enhanced Quality Protocol Active</h4>
          <p className="text-amber-800 mt-0.5 leading-relaxed">
            The Quality Team inspects candidate pass rates, biometric attendance veracity, instructor ratios, and exam center compliance. Approving here advances the batch to State Final Sanction.
          </p>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading quality review queue...</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No Batches in Quality Review</h3>
            <p className="text-xs text-slate-500 mt-1">
              All large batches have either completed quality review or are still in district review.
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
                  <th className="py-3.5 px-4">District</th>
                  <th className="py-3.5 px-4">Candidates</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
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
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {batch.trainingCentre?.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{batch.district?.name}</td>
                    <td className="py-3.5 px-4 font-bold text-amber-700">
                      {batch.totalCandidates} candidates
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => navigate(`/batches/${batch.id}`)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 font-semibold text-white shadow-2xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect & Audit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
