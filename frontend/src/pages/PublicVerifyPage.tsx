import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FileSearch,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface VerificationData {
  status: 'VALID' | 'CANCELLED' | 'NOT_FOUND';
  certificateNumber?: string;
  candidateName?: string;
  courseName?: string;
  trainingCentreName?: string;
  districtName?: string;
  issueDate?: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  verificationTimestamp: string;
  message: string;
}

export const PublicVerifyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(id || '');
  const [result, setResult] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performVerification = async (certNumber: string) => {
    if (!certNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/verify/${certNumber.trim()}`);
      setResult(res.data);
    } catch (err: any) {
      if (err.response?.data) {
        setResult(err.response.data);
      } else {
        setError('Network error. Unable to connect to verification registry.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      setSearchInput(id);
      performVerification(id);
    }
  }, [id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput) {
      performVerification(searchInput);
      navigate(`/verify/${searchInput}`, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between overflow-x-hidden">
      {/* Official Government of India Header Banner */}
      <div className="bg-slate-900/90 text-slate-300 text-[10px] sm:text-[11px] px-3.5 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1 shrink-0">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-500 inline-block shadow-2xs"></span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white inline-block shadow-2xs"></span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-600 inline-block shadow-2xs"></span>
          </div>
          <span className="font-semibold text-slate-200 truncate">भारत सरकार | Government of India</span>
          <span className="hidden md:inline text-slate-600">•</span>
          <span className="hidden md:inline text-slate-400">National Skill Registry</span>
        </div>
        <div className="flex items-center space-x-2 text-[10px] text-emerald-400 font-medium">
          <ShieldCheck className="w-3 h-3 shrink-0" />
          <span>Official Public Verifier Gateway</span>
        </div>
      </div>
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600" />

      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 px-3.5 sm:px-6 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
            CF
          </div>
          <div className="min-w-0">
            <span className="font-bold text-xs sm:text-sm text-white block leading-tight truncate">
              CertiFlow Public Verifier
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 block truncate">
              Government Skilling Credential Gateway
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="text-xs text-brand-400 hover:text-brand-300 font-semibold shrink-0 ml-2"
        >
          Staff & Officer Login →
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-3.5 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-brand-600/10 border border-brand-500/20 text-brand-400 mb-2">
            <FileSearch className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Verify Skilling Certificate
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Instantly verify the authenticity of vocational and skilling certificates directly against state government databases.
          </p>
        </div>

        {/* Search Input Box (Responsive stacked for mobile, inline for sm+) */}
        <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Enter Certificate ID (e.g. CERT-2026-BPL-0001)"
                className="w-full bg-slate-900 border-2 border-slate-700 hover:border-slate-600 focus:border-brand-500 rounded-xl sm:rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-xl font-mono min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchInput.trim()}
              className="px-5 py-3 rounded-xl sm:rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 min-h-[44px] shrink-0"
            >
              {loading ? 'Checking...' : 'Verify Now'}
            </button>
          </div>
        </form>

        {error && (
          <div className="max-w-xl mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center">
            {error}
          </div>
        )}

        {/* Verification Result Cards */}
        {result && (
          <div className="max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-200">
            {/* 1. VALID STATUS */}
            {result.status === 'VALID' && (
              <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-start sm:items-center space-x-3 mb-5 sm:mb-6">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase block">
                      Authenticity Confirmed
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white">Genuine & Valid Certificate</h3>
                  </div>
                </div>

                <div className="space-y-3 text-xs border-t border-slate-800 pt-4 sm:pt-5">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-slate-800/60 gap-0.5">
                    <span className="text-slate-400 text-[11px]">Certificate Identifier</span>
                    <span className="font-mono font-bold text-brand-400">{result.certificateNumber}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-slate-800/60 gap-0.5">
                    <span className="text-slate-400 text-[11px]">Certified Graduate</span>
                    <span className="font-bold text-white">{result.candidateName}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start py-1 border-b border-slate-800/60 gap-0.5">
                    <span className="text-slate-400 text-[11px]">Course / Qualification</span>
                    <span className="font-semibold text-slate-200 sm:text-right max-w-xs">{result.courseName}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start py-1 border-b border-slate-800/60 gap-0.5">
                    <span className="text-slate-400 text-[11px]">Accredited Centre</span>
                    <span className="text-slate-300 sm:text-right">
                      {result.trainingCentreName} ({result.districtName} District)
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-1 border-b border-slate-800/60 gap-0.5">
                    <span className="text-slate-400 text-[11px]">Date of Issuance</span>
                    <span className="text-slate-300">
                      {result.issueDate ? new Date(result.issueDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px] text-slate-400">
                  <span>Verified at: {new Date(result.verificationTimestamp).toLocaleTimeString()}</span>
                  <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>State Blockchain Registry</span>
                  </span>
                </div>
              </div>
            )}

            {/* 2. CANCELLED STATUS */}
            {result.status === 'CANCELLED' && (
              <div className="bg-slate-900 border-2 border-rose-500/50 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="flex items-start sm:items-center space-x-3 mb-5 sm:mb-6">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                    <XCircle className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-rose-400 uppercase block">
                      Statutory Revocation Notice
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white">Certificate Has Been Cancelled</h3>
                  </div>
                </div>

                <div className="p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 mb-4 sm:mb-5">
                  <span className="font-bold block text-rose-200">Statutory Cancellation Reason:</span>
                  <p className="mt-1 italic leading-relaxed">{result.cancellationReason || 'Revoked by order of State Directorate.'}</p>
                  {result.cancelledAt && (
                    <span className="text-[10px] text-rose-400 block mt-2">
                      Effective Date: {new Date(result.cancelledAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs border-t border-slate-800 pt-3.5 text-slate-400">
                  <div className="flex justify-between items-center py-1">
                    <span>Certificate Identifier</span>
                    <span className="font-mono font-bold text-slate-300">{result.certificateNumber}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span>Registered Name</span>
                    <span className="font-semibold text-slate-300">{result.candidateName}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. NOT FOUND STATUS */}
            {result.status === 'NOT_FOUND' && (
              <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">Certificate Not Found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  {result.message || 'No matching certificate records found in the national skilling portal database.'}
                </p>
                <span className="text-[10px] text-slate-500 mt-3 block">
                  Please verify that you typed the identifier exactly as shown on the certificate document.
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-500 py-4 border-t border-slate-900 px-4">
        Ministry of Skill Development and Entrepreneurship • Digital India Initiative
      </footer>
    </div>
  );
};
