import React from 'react';
import { BatchStatus } from '../types';

interface StatusBadgeProps {
  status: BatchStatus | 'VALID' | 'CANCELLED' | 'PENDING' | 'DELIVERED' | 'FAILED' | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'APPROVED':
      case 'CERTIFICATES_ISSUED':
      case 'VALID':
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/10';
      case 'STATE_REVIEW':
      case 'QUALITY_REVIEW':
      case 'DISTRICT_REVIEW':
      case 'SUBMITTED':
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/10';
      case 'REJECTED':
      case 'CANCELLED':
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/10';
      case 'RETURNED_FOR_CORRECTION':
        return 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-500/10';
      case 'CERTIFICATE_GENERATION':
        return 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/10';
      case 'DRAFT':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-500/10';
    }
  };

  const formatText = (text: string) => {
    return text.replace(/_/g, ' ');
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ring-1 ${getBadgeStyle()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {formatText(status)}
    </span>
  );
};
