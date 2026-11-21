import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGetDashboardStatsQuery } from '../store/apiSlice';
import { StatCard } from '../components/StatCard';
import { PageSkeleton } from '../components/PageSkeleton';
import {
  Layers,
  Clock,
  CheckCircle2,
  RotateCcw,
  Award,
  ShieldAlert,
  AlertTriangle,
  PlusCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data, isLoading, isFetching, refetch } = useGetDashboardStatsQuery();
  const stats = data?.stats;

  useEffect(() => {
    refetch();
  }, [user?.id, user?.role, refetch]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    const handleUpdate = () => {
      refetch();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('certiflow:update', handleUpdate);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('certiflow:update', handleUpdate);
    };
  }, [refetch]);

  if (isLoading && !stats) {
    return <PageSkeleton />;
  }

  if (!stats) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900">Dashboard Metrics Unavailable</h3>
        <p className="text-xs text-slate-500 mt-1">Unable to load real-time statistics from Neon server.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors shadow-xs"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const role = user?.role;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200">
              {role?.replace('_', ' ')}
            </span>
            <span className="text-xs text-slate-500">• Session Active</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 truncate">
            Welcome back, {user?.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time status overview of the National Skilling Certificate Lifecycle.
          </p>
        </div>

        {/* Quick CTA per Role */}
        <div className="flex flex-wrap items-center gap-2">
          {role === 'TRAINING_CENTRE' && (
            <button
              onClick={() => navigate('/batches')}
              className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create / Upload Batch</span>
            </button>
          )}

          {role === 'DISTRICT_OFFICER' && (
            <button
              onClick={() => navigate('/district-approvals')}
              className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>District Approval Queue ({stats.batches.breakdown.districtReview})</span>
            </button>
          )}

          {role === 'QUALITY_TEAM' && (
            <button
              onClick={() => navigate('/quality-review')}
              className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Quality Queue ({stats.batches.breakdown.qualityReview})</span>
            </button>
          )}

          {role === 'STATE_OFFICE' && (
            <button
              onClick={() => navigate('/state-office')}
              className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-600 text-white font-semibold text-xs shadow-sm transition-all min-h-[40px]"
            >
              <Award className="w-4 h-4" />
              <span>State Sanctions ({stats.batches.breakdown.stateReview})</span>
            </button>
          )}

          <button
            onClick={() => navigate('/verify')}
            className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors min-h-[40px]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Public Verifier</span>
          </button>
        </div>
      </div>

      {/* SLA Breach Alert Banner if any overdue */}
      {stats.monitoring.delayedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                SLA Delay Alert ({stats.monitoring.delayedCount} Batches Exceeded Target)
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                One or more candidate batches have exceeded the statutory {stats.monitoring.slaHoursDistrict}h district / {stats.monitoring.slaHoursState}h state review window.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/monitoring')}
            className="text-xs font-semibold text-amber-800 underline hover:text-amber-900 shrink-0 self-end sm:self-center"
          >
            Inspect Overdue Batches
          </button>
        </div>
      )}

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Batches"
          value={stats.batches.total}
          subtitle="Registered in programme"
          icon={Layers}
          variant="navy"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.batches.pending}
          subtitle={`${stats.batches.breakdown.districtReview} district, ${stats.batches.breakdown.qualityReview} quality, ${stats.batches.breakdown.stateReview} state`}
          icon={Clock}
          variant="amber"
          badge="In Review"
        />
        <StatCard
          title="Certificates Issued"
          value={stats.certificates.valid}
          subtitle={`Out of ${stats.candidates.total} candidates`}
          icon={Award}
          variant="emerald"
        />
        <StatCard
          title="Returned / Rejected"
          value={stats.batches.returned + stats.batches.rejected}
          subtitle={`${stats.batches.returned} returned, ${stats.batches.rejected} rejected`}
          icon={RotateCcw}
          variant="rose"
        />
      </div>

      {/* Workflow Stage Breakdown & Candidate Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Stage Funnel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Approval Pipeline Stages
            </h3>
            <span className="text-[11px] sm:text-xs text-slate-500">Live PostgreSQL Metrics</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs font-medium text-slate-500">District Review</span>
              <div className="flex items-baseline justify-between mt-1 gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold text-slate-900">
                  {stats.batches.breakdown.districtReview}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold shrink-0">
                  2 Officers Required
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Batches awaiting 1st or 2nd officer clearance</p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs font-medium text-slate-500">Quality Review</span>
              <div className="flex items-baseline justify-between mt-1 gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold text-slate-900">
                  {stats.batches.breakdown.qualityReview}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold shrink-0">
                  &gt;= 50 Candidates
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Large batch technical & statistical inspection</p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-xs font-medium text-slate-500">State Directorate</span>
              <div className="flex items-baseline justify-between mt-1 gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold text-slate-900">
                  {stats.batches.breakdown.stateReview}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold shrink-0">
                  Final Gate
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Final sign-off triggering certificate issuance</p>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
            <div className="p-2 rounded-lg bg-slate-50/50 sm:bg-transparent">
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">Total Candidates</span>
              <h4 className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">{stats.candidates.total}</h4>
            </div>
            <div className="p-2 rounded-lg bg-slate-50/50 sm:bg-transparent">
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">Passed Candidates</span>
              <h4 className="text-base sm:text-lg font-bold text-emerald-600 mt-0.5">{stats.candidates.passed}</h4>
            </div>
            <div className="p-2 rounded-lg bg-slate-50/50 sm:bg-transparent">
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">Valid Certificates</span>
              <h4 className="text-base sm:text-lg font-bold text-brand-600 mt-0.5">{stats.certificates.valid}</h4>
            </div>
            <div className="p-2 rounded-lg bg-slate-50/50 sm:bg-transparent">
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">Cancelled by State</span>
              <h4 className="text-base sm:text-lg font-bold text-rose-600 mt-0.5">{stats.certificates.cancelled}</h4>
            </div>
          </div>
        </div>

        {/* Recent Audit Activity */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent System Audit Trail
            </h3>
            <button
              onClick={() => navigate('/audit-logs')}
              className="text-xs text-brand-600 hover:text-brand-800 font-semibold p-1"
            >
              View Full
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 sm:space-y-3 max-h-72 lg:max-h-none">
            {stats.recentActivity.slice(0, 6).map((log) => (
              <div key={log.id} className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 truncate">{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 mt-1 text-[11px] text-slate-500 truncate">
                  <span className="font-medium text-slate-700">{log.userRole || 'SYSTEM'}</span>
                  <span>•</span>
                  <span className="truncate">ID: {log.entityId.substring(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
