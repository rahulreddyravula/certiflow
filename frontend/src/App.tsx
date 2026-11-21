import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageSkeleton } from './components/PageSkeleton';

// Code-split route bundles for optimal initial page loading speed
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const BatchesPage = lazy(() => import('./pages/BatchesPage').then(m => ({ default: m.BatchesPage })));
const BatchDetailsPage = lazy(() => import('./pages/BatchDetailsPage').then(m => ({ default: m.BatchDetailsPage })));
const DistrictApprovalPage = lazy(() => import('./pages/DistrictApprovalPage').then(m => ({ default: m.DistrictApprovalPage })));
const QualityReviewPage = lazy(() => import('./pages/QualityReviewPage').then(m => ({ default: m.QualityReviewPage })));
const StateOfficePage = lazy(() => import('./pages/StateOfficePage').then(m => ({ default: m.StateOfficePage })));
const CandidatesPage = lazy(() => import('./pages/CandidatesPage').then(m => ({ default: m.CandidatesPage })));
const CertificatesPage = lazy(() => import('./pages/CertificatesPage').then(m => ({ default: m.CertificatesPage })));
const CertificateViewPage = lazy(() => import('./pages/CertificateViewPage').then(m => ({ default: m.CertificateViewPage })));
const PublicVerifyPage = lazy(() => import('./pages/PublicVerifyPage').then(m => ({ default: m.PublicVerifyPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage').then(m => ({ default: m.MonitoringPage })));

export const App: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
      <Routes>
        {/* Public Routes (No authentication required) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify" element={<PublicVerifyPage />} />
        <Route path="/verify/:id" element={<PublicVerifyPage />} />

        {/* Authenticated Workspace Routes */}
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/batches" element={<BatchesPage />} />
          <Route path="/batches/:id" element={<BatchDetailsPage />} />
          <Route
            path="/district-approvals"
            element={
              <ProtectedRoute allowedRoles={['DISTRICT_OFFICER', 'STATE_OFFICE']}>
                <DistrictApprovalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quality-review"
            element={
              <ProtectedRoute allowedRoles={['QUALITY_TEAM', 'STATE_OFFICE']}>
                <QualityReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/state-office"
            element={
              <ProtectedRoute allowedRoles={['STATE_OFFICE']}>
                <StateOfficePage />
              </ProtectedRoute>
            }
          />
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/certificates/:id" element={<CertificateViewPage />} />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['DISTRICT_OFFICER', 'QUALITY_TEAM', 'STATE_OFFICE']}>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/monitoring"
            element={
              <ProtectedRoute allowedRoles={['STATE_OFFICE', 'QUALITY_TEAM']}>
                <MonitoringPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};
export default App;
