import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { DemoSwitcher } from './DemoSwitcher';
import { ToastContainer } from './ToastContainer';
import { ShieldCheck } from 'lucide-react';

export const Layout: React.FC = () => {
  const { isAuthenticated, token, loadFromStorage } = useAuthStore();
  const { connectSSE, disconnectSSE, fetchNotifications } = useNotificationStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (token) {
      connectSSE(token);
      fetchNotifications();
    }
    return () => {
      disconnectSSE();
    };
  }, [token, connectSSE, disconnectSSE, fetchNotifications]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated && !localStorage.getItem('certiflow_token')) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Official Government of India Header Banner */}
      <div className="bg-slate-950 text-slate-300 text-[10px] sm:text-[11px] px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1 shrink-0">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-500 inline-block shadow-2xs"></span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white inline-block shadow-2xs"></span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-600 inline-block shadow-2xs"></span>
          </div>
          <span className="font-semibold text-slate-200 truncate">भारत सरकार | Government of India</span>
          <span className="hidden md:inline text-slate-600">•</span>
          <span className="hidden md:inline text-slate-400">कौशल विकास एवं उद्यमशीलता मंत्रालय (MSDE)</span>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4 text-[10px] text-slate-400">
          <span className="flex items-center space-x-1 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline sm:inline">GovNet 256-bit TLS</span>
          </span>
          <span className="hidden sm:inline border-l border-slate-800 pl-3">Standard Accessible View</span>
        </div>
      </div>

      {/* National Tricolor Line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-600" />

      {/* 1-Click Demo Persona Bar at Top */}
      <DemoSwitcher />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Real-Time Toast Notifications */}
      <ToastContainer />
    </div>
  );
};
