import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { Batch } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useDebounce } from '../hooks/useDebounce';
import {
  Layers,
  Search,
  Filter,
  PlusCircle,
  Eye,
} from 'lucide-react';

export const BatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Debounce search input to avoid spamming the backend
  const debouncedSearch = useDebounce(search, 300);

  // Create Batch Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get('/batches', { params });
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchBatches();

    // Listen to real-time events for instant refresh
    const handleUpdate = (e: any) => {
      if (!e.detail || e.detail.type === 'batch' || e.detail.type === 'all') {
        fetchBatches();
      }
    };
    window.addEventListener('certiflow:update', handleUpdate);
    return () => window.removeEventListener('certiflow:update', handleUpdate);
  }, [fetchBatches, user?.id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBatches();
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await api.post('/batches', {
        title: newTitle.trim(),
        courseName: newCourse.trim(),
        districtId: user?.districtId || user?.district?.id,
        trainingCentreId: user?.trainingCentreId || user?.trainingCentre?.id,
      });
      setIsCreateOpen(false);
      setNewTitle('');
      setNewCourse('');
      navigate(`/batches/${res.data.batch.id}`);
    } catch (err: any) {
      const detailsMsg = err.response?.data?.details?.map((d: any) => d.message).join('. ');
      const errorMsg = detailsMsg || err.response?.data?.error || 'Failed to create batch.';
      setCreateError(errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const isTrainingCentre = user?.role === 'TRAINING_CENTRE';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Batches Registry</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor, approve, and manage candidate batches across all lifecycle stages.
          </p>
        </div>

        {isTrainingCentre && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto justify-center inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Batch</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch #, course, or title..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 min-h-[38px]"
          />
        </form>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto scrollbar-thin">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:inline" />
          <span className="text-xs font-semibold text-slate-500 shrink-0 hidden sm:inline">Filter:</span>
          {['ALL', 'DISTRICT_REVIEW', 'QUALITY_REVIEW', 'STATE_REVIEW', 'APPROVED', 'CERTIFICATES_ISSUED', 'RETURNED_FOR_CORRECTION', 'DRAFT'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All' : st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Batches Table with responsive horizontal scroll */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No batches found</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-3 sm:px-4">Batch Number</th>
                  <th className="py-3.5 px-3 sm:px-4">Course & Title</th>
                  <th className="py-3.5 px-3 sm:px-4">Centre & District</th>
                  <th className="py-3.5 px-3 sm:px-4">Candidates</th>
                  <th className="py-3.5 px-3 sm:px-4">District Approvals</th>
                  <th className="py-3.5 px-3 sm:px-4">Status</th>
                  <th className="py-3.5 px-3 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {batches.map((batch) => {
                  const approvedCount =
                    batch.districtApprovals?.filter(
                      (a) => a.versionNumber === batch.currentVersionNumber && a.status === 'APPROVED'
                    ).length || 0;

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-3 sm:px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {batch.batchNumber}
                        <span className="block text-[10px] text-slate-400 font-sans font-normal">
                          v{batch.currentVersionNumber}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 sm:px-4 max-w-xs">
                        <span className="font-bold text-slate-900 block truncate">{batch.title}</span>
                        <span className="text-[11px] text-slate-500 truncate block">
                          {batch.courseName}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 sm:px-4">
                        <span className="font-medium text-slate-800 block truncate max-w-[180px]">
                          {batch.trainingCentre?.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {batch.district?.name} District
                        </span>
                      </td>

                      <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{batch.totalCandidates}</span>
                        {batch.requiresQualityReview && (
                          <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-semibold">
                            Large
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              approvedCount >= 1 ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                            title="Officer 1 Approval"
                          />
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              approvedCount >= 2 ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                            title="Officer 2 Approval"
                          />
                          <span className="text-[11px] font-medium text-slate-500 ml-1">
                            {approvedCount}/2
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                        <StatusBadge status={batch.status} />
                      </td>

                      <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/batches/${batch.id}`)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-600 font-semibold text-slate-700 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
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

      {/* Create Batch Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Candidate Batch"
        description="Establish a new training batch under your assigned training centre facility."
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs leading-relaxed">
              {createError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Batch Title / Cohort Name
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Electrician Fast-Track Batch Q1"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Course / Skill Trade Name
            </label>
            <input
              type="text"
              required
              value={newCourse}
              onChange={(e) => setNewCourse(e.target.value)}
              placeholder="e.g. Solar Panel Installation & Maintenance"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 min-h-[40px]"
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newTitle || !newCourse}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
            >
              {creating ? 'Creating Batch...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
