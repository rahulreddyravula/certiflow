import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'navy';
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'blue',
  badge,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'emerald':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-600',
          border: 'border-emerald-100',
        };
      case 'amber':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-600',
          border: 'border-amber-100',
        };
      case 'rose':
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-600',
          border: 'border-rose-100',
        };
      case 'navy':
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-800',
          border: 'border-slate-200',
        };
      case 'blue':
      default:
        return {
          bg: 'bg-blue-50',
          text: 'text-brand-600',
          border: 'border-blue-100',
        };
    }
  };

  const colors = getColors();

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-slate-500 leading-snug line-clamp-2">
          {title}
        </span>
        <div
          className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${colors.bg} ${colors.text} border ${colors.border} shrink-0`}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
          {value}
        </span>
        {badge && (
          <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-[11px] sm:text-xs text-slate-500 line-clamp-1">{subtitle}</p>}
    </div>
  );
};
