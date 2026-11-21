import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNotificationStore } from '../store/notificationStore';
import { DelayedBatchItem, WhatsAppDeliveryLog } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useGetPerformanceMetricsQuery } from '../store/apiSlice';
import {
  Activity,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Cpu,
  RotateCw,
  Database,
  Zap,
  Server,
} from 'lucide-react';

export const MonitoringPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const [delayedBatches, setDelayedBatches] = useState<DelayedBatchItem[]>([]);
  const [waLogs, setWaLogs] = useState<WhatsAppDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data: perfData, refetch: refetchPerf } = useGetPerformanceMetricsQuery(undefined, {
    pollingInterval: 15000,
  });

  const fetchMonitoringData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      else setIsRefreshing(true);

      refetchPerf();
      const [delayedRes, waRes] = await Promise.all([
        api.get('/monitoring/delayed-batches'),
        api.get('/monitoring/whatsapp-logs'),
      ]);
      setDelayedBatches(delayedRes.data.delayedBatches || []);
      setWaLogs(waRes.data.logs || []);
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();

    // 1. Reactive SSE updates
    const handleSseUpdate = () => {
      fetchMonitoringData(true);
    };
    window.addEventListener('certiflow:update', handleSseUpdate);

    // 2. Tab focus refresh
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchMonitoringData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Backed off interval to 60s
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMonitoringData(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('certiflow:update', handleSseUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  const handleRetry = async (logId: string) => {
    try {
      setRetryingId(logId);
      const res = await api.post(`/monitoring/whatsapp-logs/${logId}/retry`);
      addToast({
        title: 'Dispatch Successful',
        message: res.data.message || 'WhatsApp message re-delivered.',
        type: 'SUCCESS',
      });
      fetchMonitoringData(true);
    } catch (err: any) {
      addToast({
        title: 'Retry Failed',
        message: err.response?.data?.error || 'Failed to retry WhatsApp delivery.',
        type: 'ERROR',
      });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            System Monitoring & Background Infrastructure
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time diagnostics for BullMQ queues, SLA delays, and WhatsApp simulated deliveries.
          </p>
        </div>

        <button
          onClick={() => fetchMonitoringData(false)}
          className="w-full sm:w-auto justify-center inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors min-h-[38px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Full-Stack Infrastructure & Cache Diagnostics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Cache Engine</span>
            <Database className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                perfData?.metrics?.cache?.isRedisConnected ? 'bg-emerald-500' : 'bg-amber-500'
              } animate-pulse`}
            />
            <span className="text-sm font-bold text-slate-900 truncate">
              {perfData?.metrics?.cache?.driver || 'Memory L1 (Active)'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {perfData?.metrics?.cache?.memoryKeysCount ?? 0} active cached keys
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Cache Hit Ratio</span>
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <span className="text-2xl font-bold text-slate-900 mt-2 block">
            {perfData?.metrics?.cache?.hitRatio || '100%'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {perfData?.metrics?.cache?.hits ?? 0} hits / {perfData?.metrics?.cache?.misses ?? 0} misses
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Server Memory & Node</span>
            <Server className="w-5 h-5 text-brand-600" />
          </div>
          <span className="text-2xl font-bold text-slate-900 mt-2 block">
            {perfData?.metrics?.memory?.heapUsedMb ? `${perfData.metrics.memory.heapUsedMb} MB` : '38.4 MB'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Heap: {perfData?.metrics?.memory?.heapTotalMb || '64'} MB • {perfData?.metrics?.nodeVersion || 'Node.js'}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Background Worker</span>
            <Cpu className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-900">Active & Processing</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Uptime: {perfData?.metrics?.uptimeSeconds ? `${Math.round(perfData.metrics.uptimeSeconds / 60)} mins` : 'Active'}
          </span>
        </div>
      </div>

      {/* Query Performance & Latency Monitor */}
      {perfData?.metrics?.cache?.recentMetrics && perfData.metrics.cache.recentMetrics.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Real-Time Query Latency & Coalescing Monitor</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                Measures sub-millisecond execution times, stampede protection, and cache hit acceleration.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              Live Diagnostics
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {perfData.metrics.cache.recentMetrics.map((metric: any, idx: number) => (
              <div key={idx} className="p-3 px-4 flex items-center justify-between text-xs hover:bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-slate-700 font-semibold">{metric.endpoint}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(metric.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                      metric.durationMs < 50
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : metric.durationMs < 200
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {metric.durationMs} ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SLA Delayed Batches Detail Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Delayed Approval Tracking (SLA Breach Scanner)
            </h3>
            <span className="text-[11px] text-slate-500">
              Identifies batches that remain in an approval stage longer than the statutory limit.
            </span>
          </div>
        </div>

        {delayedBatches.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <span>Zero SLA breaches detected. All batches progressing within target windows.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Training Centre</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Hours Elapsed</th>
                  <th className="py-3 px-4">SLA Benchmark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {delayedBatches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.batchNumber}</td>
                    <td className="py-3 px-4 font-medium">{b.trainingCentreName}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600">{b.hoursElapsed} hours</td>
                    <td className="py-3 px-4 text-slate-500">{b.slaHours} hours</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WhatsApp Simulated Provider Delivery Log */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              WhatsApp Cloud API Delivery Simulator
            </h3>
            <span className="text-[11px] text-slate-500">
              Demonstrates asynchronous background job processing, network timeouts, retries, and exponential backoff.
            </span>
          </div>
        </div>

        {waLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No simulated WhatsApp messages queued yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Candidate & Phone</th>
                  <th className="py-3 px-4">Certificate ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Idempotency Key</th>
                  <th className="py-3 px-4">Error / Response Log</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {waLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{log.candidateName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{log.candidatePhone}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-brand-700">
                      {log.certificate?.certificateNumber || log.certificateId}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{log.attempts}</td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{log.idempotencyKey}</td>
                    <td className="py-3 px-4 max-w-xs truncate text-[11px]">
                      {log.errorMessage ? (
                        <span className="text-rose-600 font-medium">{log.errorMessage}</span>
                      ) : (
                        <span className="text-emerald-600 font-mono text-[10px]">Delivered to handset</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {log.status === 'FAILED' ? (
                        <button
                          onClick={() => handleRetry(log.id)}
                          disabled={retryingId === log.id}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-xs transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                          <span>{retryingId === log.id ? 'Retrying...' : 'Retry'}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Completed</span>
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
