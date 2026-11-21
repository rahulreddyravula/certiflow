import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Candidate } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { Users, Search, CheckCircle2, XCircle, Award } from 'lucide-react';

export const CandidatesPage: React.FC = () => {
  const { user } = useAuthStore();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Debounce search query by 300ms to eliminate rapid duplicate API calls
  const debouncedSearch = useDebounce(search, 300);

  const fetchCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'ALL') params.assessmentStatus = statusFilter;

      const res = await api.get('/candidates', { params });
      setCandidates(res.data.candidates || []);
      setTotalCount(res.data.total || (res.data.candidates ? res.data.candidates.length : 0));
    } catch (err) {
      console.error('Failed to load candidates:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates, user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Candidate Records Database</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive registry of enrolled skilling students across all training centres.
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
          Total Registered: <span className="text-slate-900 font-bold">{totalCount}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, email, course..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 min-h-[38px]"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Assessment:</span>
          {['ALL', 'PASSED', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading candidate records...</div>
        ) : candidates.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No Candidates Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              {search ? 'Try adjusting your search query or filter.' : 'Upload candidate CSVs to populate records.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Qualification / Course</th>
                  <th className="py-3 px-4">Training Centre</th>
                  <th className="py-3 px-4">Assessment Result</th>
                  <th className="py-3 px-4 text-right">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{c.email}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{c.phone}</td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{c.courseName}</td>
                    <td className="py-3 px-4 text-slate-600">{c.trainingCentreName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.assessmentStatus === 'PASSED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {c.assessmentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {c.certificate ? (
                        <span className="inline-flex items-center space-x-1 text-brand-600 font-mono text-[10px] bg-brand-50 px-2 py-0.5 rounded border border-brand-200 font-semibold">
                          <Award className="w-3 h-3 text-brand-600" />
                          <span>{c.certificate.certificateNumber}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Not Issued</span>
                      )}
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
