import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Certificate } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ArrowLeft, Download, ShieldCheck, ExternalLink, Printer } from 'lucide-react';

export const CertificateViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCert = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/certificates/${id}`);
        setCert(res.data.certificate);
      } catch (err) {
        console.error('Failed to load certificate:', err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchCert();
  }, [id]);

  const handleDownloadPdf = () => {
    if (!cert) return;
    window.open(`/api/certificates/${cert.certificateNumber}/download`, '_blank');
  };

  if (loading || !cert) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading certificate preview...</div>;
  }

  const isCancelled = cert.status === 'CANCELLED';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/certificates')}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Certificates</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-none justify-center inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors min-h-[38px]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex-1 sm:flex-none justify-center inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[38px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Official PDF</span>
          </button>
        </div>
      </div>

      {/* Cancellation Warning if cancelled */}
      {isCancelled && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 text-rose-900 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-rose-800">
              Revoked Credential Notice
            </h4>
            <p className="text-xs text-rose-700 mt-0.5">
              This certificate was officially cancelled by the State Office. Reason:{' '}
              <span className="font-semibold">{cert.cancellationReason}</span>
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-[10px] font-bold shrink-0">
            CANCELLED
          </span>
        </div>
      )}

      {/* Certificate Card Canvas */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border-4 sm:border-8 border-slate-900 p-4 sm:p-8 lg:p-12 shadow-2xl relative overflow-hidden font-serif">
        {/* Inner Gold Border */}
        <div className="border border-amber-500 sm:border-2 p-4 sm:p-8 sm:p-10 relative">
          {/* Watermark Emblem */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-4">
            <div className="w-64 sm:w-96 h-64 sm:h-96 rounded-full border-4 sm:border-8 border-slate-900 flex items-center justify-center font-sans font-black text-6xl sm:text-8xl text-slate-900">
              GOVT
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-1.5 sm:space-y-2">
            <span className="text-[10px] sm:text-xs font-sans font-bold tracking-widest text-amber-600 uppercase block">
              National Skill Development Mission • Government of India
            </span>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-wide leading-tight">
              CERTIFICATE OF VOCATIONAL COMPETENCY
            </h1>
            <p className="text-xs sm:text-sm font-sans text-slate-500 italic mt-1 sm:mt-2">
              This is to officially certify that
            </p>
          </div>

          {/* Candidate Name */}
          <div className="text-center my-4 sm:my-6">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-brand-900 tracking-tight">
              {cert.candidateName}
            </h2>
            <div className="w-36 sm:w-48 h-0.5 bg-slate-300 mx-auto mt-2" />
          </div>

          {/* Statement */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs sm:text-sm text-slate-700 font-sans leading-relaxed">
              has successfully satisfied all statutory academic and practical assessment standards for the qualification:
            </p>
            <h3 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-900">
              {cert.courseName}
            </h3>
            <p className="text-xs font-sans text-slate-500 mt-2">
              Conducted through accredited facility: <strong className="text-slate-800">{cert.trainingCentreName}</strong> ({cert.districtName} District)
            </p>
          </div>

          {/* Lower Metadata, Seal, and Signatures */}
          <div className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 font-sans">
            {/* Left: QR Code & Verification */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left space-y-2 sm:space-y-0 sm:space-x-4">
              {cert.qrCodeDataUrl ? (
                <img
                  src={cert.qrCodeDataUrl}
                  alt="Verification QR Code"
                  className="w-16 h-16 sm:w-20 sm:h-20 border border-slate-200 p-1 bg-white shadow-xs rounded-lg shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                  QR Code
                </div>
              )}
              <div className="text-center sm:text-left text-xs min-w-0">
                <span className="font-mono font-bold text-slate-900 block truncate max-w-[220px]">
                  ID: {cert.certificateNumber}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Issued: {new Date(cert.issueDate).toLocaleDateString()}
                </span>
                <a
                  href={`/verify/${cert.certificateNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-brand-600 hover:text-brand-800 font-semibold inline-flex items-center space-x-1 mt-1"
                >
                  <span>Public Registry Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Center: Gold Seal */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-amber-500 p-1 flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-full border border-amber-500 flex flex-col items-center justify-center text-center">
                <span className="text-[7px] font-black text-amber-600 tracking-tighter">VERIFIED</span>
                <span className="text-[6px] font-bold text-slate-800 tracking-tighter">SEAL</span>
              </div>
            </div>

            {/* Right: Signatures (wrap on mobile/tablet) */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-center text-xs">
              <div className="min-w-[110px] max-w-[130px]">
                <div className="w-full border-b border-slate-400 pb-1 font-mono text-[9px] text-slate-400 truncate">
                  [Authorized Signature]
                </div>
                <span className="font-bold text-slate-800 text-[11px] block mt-1 truncate">
                  District Officer
                </span>
                <span className="text-[9px] text-slate-400 block truncate">District Skilling Mission</span>
              </div>

              <div className="min-w-[110px] max-w-[130px]">
                <div className="w-full border-b border-slate-400 pb-1 font-mono text-[9px] text-slate-400 truncate">
                  [Directorate Seal]
                </div>
                <span className="font-bold text-slate-800 text-[11px] block mt-1 truncate">
                  Director of Training
                </span>
                <span className="text-[9px] text-slate-400 block truncate">State Skill Council</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
