import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { Certificate } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useDebounce } from '../hooks/useDebounce';
import { Award, Search, Download, Eye, ShieldBan, FileText } from 'lucide-react';

export const CertificatesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Debounce search input to eliminate unnecessary API requests on every keystroke
  const debouncedSearch = useDebounce(search, 300);

  const fetchCertificates = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get('/certificates', { params });
      setCertificates(res.data.certificates || []);
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchCertificates();

    // Listen to real-time events for instant refresh
    const handleUpdate = (e: any) => {
      if (!e.detail || e.detail.type === 'certificate' || e.detail.type === 'all') {
        fetchCertificates();
      }
    };
    window.addEventListener('certiflow:update', handleUpdate);
    return () => window.removeEventListener('certiflow:update', handleUpdate);
  }, [fetchCertificates, user?.id]);

  const handleDownload = (certNum: string) => {
    window.open(`/api/certificates/${certNum}/download`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            National Certificate Registry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamper-proof verifiable credentials issued to certified skill programme graduates.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchCertificates();
          }}
          className="relative w-full md:w-80"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search certificate #, candidate name..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 min-h-[38px]"
          />
        </form>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Status:</span>
          {['ALL', 'VALID', 'CANCELLED'].map((st) => (
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

      {/* Certificates Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading certificate records...</div>
        ) : certificates.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <Award className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No Certificates Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Certificates appear here immediately once a batch receives final state approval.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Certificate ID</th>
                  <th className="py-3.5 px-4">Candidate Name</th>
                  <th className="py-3.5 px-4">Qualification / Course</th>
                  <th className="py-3.5 px-4">Centre & District</th>
                  <th className="py-3.5 px-4">Issue Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-mono font-bold text-brand-700">
                      {cert.certificateNumber}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{cert.candidateName}</td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                      {cert.courseName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="block font-medium text-slate-800">{cert.trainingCentreName}</span>
                      <span className="text-[10px] text-slate-400">{cert.districtName} District</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(cert.issueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={cert.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => navigate(`/certificates/${cert.certificateNumber}`)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-600 transition-colors inline-flex items-center"
                        title="View Certificate"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(cert.certificateNumber)}
                        className="p-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition-colors inline-flex items-center"
                        title="Download Vector PDF"
                      >
                        <Download className="w-4 h-4" />
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
