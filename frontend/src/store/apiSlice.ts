import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  DashboardStats,
  Batch,
  Candidate,
  Certificate,
  AuditLog,
  DelayedBatchItem,
  WhatsAppDeliveryLog,
} from '../types';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('certiflow_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    'Dashboard',
    'Batches',
    'Batch',
    'Candidates',
    'Certificates',
    'Certificate',
    'AuditLogs',
    'Monitoring',
    'Performance',
  ],
  // Keep unused query data in memory for 60s for instant back/forward navigation
  keepUnusedDataFor: 60,
  refetchOnMountOrArgChange: 30, // Only refetch on mount if data is older than 30s
  endpoints: (builder) => ({
    // 1. Dashboard Stats
    getDashboardStats: builder.query<{ success: boolean; stats: DashboardStats }, void>({
      query: () => '/monitoring/dashboard-stats',
      providesTags: ['Dashboard'],
      keepUnusedDataFor: 45,
    }),

    // 2. Batches
    getBatches: builder.query<{ success: boolean; batches: Batch[] }, { status?: string; search?: string; limit?: number } | void>({
      query: (params) => ({
        url: '/batches',
        params: params || {},
      }),
      providesTags: (result) =>
        result?.batches
          ? [
              ...result.batches.map(({ id }) => ({ type: 'Batch' as const, id })),
              { type: 'Batches', id: 'LIST' },
            ]
          : [{ type: 'Batches', id: 'LIST' }],
    }),

    getBatchById: builder.query<{ success: boolean; batch: Batch }, string>({
      query: (id) => `/batches/${id}`,
      providesTags: (result, error, id) => [{ type: 'Batch', id }],
    }),

    // 3. Candidates
    getCandidates: builder.query<
      { success: boolean; candidates: Candidate[]; total: number; limit: number; offset: number },
      { search?: string; assessmentStatus?: string; batchId?: string; limit?: number; offset?: number } | void
    >({
      query: (params) => ({
        url: '/candidates',
        params: params || {},
      }),
      providesTags: ['Candidates'],
    }),

    // 4. Certificates
    getCertificates: builder.query<
      { success: boolean; certificates: Certificate[] },
      { batchId?: string; search?: string; status?: string; limit?: number } | void
    >({
      query: (params) => ({
        url: '/certificates',
        params: params || {},
      }),
      providesTags: ['Certificates'],
      keepUnusedDataFor: 120, // Certificates are largely static
    }),

    getCertificateById: builder.query<{ success: boolean; certificate: Certificate }, string>({
      query: (id) => `/certificates/${id}`,
      providesTags: (result, error, id) => [{ type: 'Certificate', id }],
      keepUnusedDataFor: 180,
    }),

    // 5. Monitoring & Performance
    getDelayedBatches: builder.query<{ success: boolean; delayedBatches: DelayedBatchItem[] }, void>({
      query: () => '/monitoring/delayed-batches',
      providesTags: ['Monitoring'],
    }),

    getWhatsAppLogs: builder.query<{ success: boolean; logs: WhatsAppDeliveryLog[] }, void>({
      query: () => '/monitoring/whatsapp-logs',
      providesTags: ['Monitoring'],
    }),

    getPerformanceMetrics: builder.query<{ success: boolean; metrics: any }, void>({
      query: () => '/monitoring/performance',
      providesTags: ['Performance'],
      keepUnusedDataFor: 15,
    }),

    // 6. Audit Logs
    getAuditLogs: builder.query<{ success: boolean; logs: AuditLog[] }, { action?: string; limit?: number } | void>({
      query: (params) => ({
        url: '/monitoring/audit-logs',
        params: params || {},
      }),
      providesTags: ['AuditLogs'],
    }),

    // Mutations with automatic cache invalidation
    createBatch: builder.mutation<any, { title: string; courseName: string; districtId: string; trainingCentreId: string }>({
      query: (body) => ({
        url: '/batches',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Batches', id: 'LIST' }, 'Dashboard'],
    }),

    submitBatch: builder.mutation<any, string>({
      query: (id) => ({
        url: `/batches/${id}/submit`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Batch', id }, { type: 'Batches', id: 'LIST' }, 'Dashboard'],
    }),

    recordDistrictDecision: builder.mutation<any, { id: string; decision: string; comments?: string }>({
      query: ({ id, ...body }) => ({
        url: `/batches/${id}/district-decision`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Batch', id }, { type: 'Batches', id: 'LIST' }, 'Dashboard'],
    }),

    recordQualityDecision: builder.mutation<any, { id: string; decision: string; comments?: string }>({
      query: ({ id, ...body }) => ({
        url: `/batches/${id}/quality-decision`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Batch', id }, { type: 'Batches', id: 'LIST' }, 'Dashboard'],
    }),

    recordStateDecision: builder.mutation<any, { id: string; decision: string; comments?: string }>({
      query: ({ id, ...body }) => ({
        url: `/batches/${id}/state-decision`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Batch', id },
        { type: 'Batches', id: 'LIST' },
        'Certificates',
        'Dashboard',
      ],
    }),

    cancelCertificate: builder.mutation<any, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/certificates/${id}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Certificate', id }, 'Certificates', 'Dashboard'],
    }),

    retryWhatsApp: builder.mutation<any, string>({
      query: (id) => ({
        url: `/monitoring/whatsapp-logs/${id}/retry`,
        method: 'POST',
      }),
      invalidatesTags: ['Monitoring', 'Performance'],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetBatchesQuery,
  useGetBatchByIdQuery,
  useGetCandidatesQuery,
  useGetCertificatesQuery,
  useGetCertificateByIdQuery,
  useGetDelayedBatchesQuery,
  useGetWhatsAppLogsQuery,
  useGetPerformanceMetricsQuery,
  useGetAuditLogsQuery,
  useCreateBatchMutation,
  useSubmitBatchMutation,
  useRecordDistrictDecisionMutation,
  useRecordQualityDecisionMutation,
  useRecordStateDecisionMutation,
  useCancelCertificateMutation,
  useRetryWhatsAppMutation,
} = apiSlice;
