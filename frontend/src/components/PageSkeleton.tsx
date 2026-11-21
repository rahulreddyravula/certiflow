import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title placeholder */}
      <div className="space-y-2">
        <div className="h-7 bg-slate-200/90 rounded-xl w-64" />
        <div className="h-3.5 bg-slate-200/70 rounded-md w-96" />
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex justify-between items-center mb-3">
              <div className="h-3 bg-slate-200 rounded w-24" />
              <div className="w-8 h-8 bg-slate-100 rounded-xl" />
            </div>
            <div className="h-6 bg-slate-200 rounded w-16 mb-2" />
            <div className="h-2.5 bg-slate-100 rounded w-32" />
          </div>
        ))}
      </div>

      {/* Content Table Skeleton */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="h-4 bg-slate-200 rounded w-48" />
          <div className="h-8 bg-slate-100 rounded-xl w-32" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-50 rounded-xl w-full" />
          ))}
        </div>
      </div>
    </div>
  );
};
