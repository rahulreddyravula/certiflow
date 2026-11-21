import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  Layers,
  Users,
  Award,
  CheckSquare,
  ShieldAlert,
  Building2,
  FileSearch,
  Activity,
  History,
  ExternalLink,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const role = user?.role;

  const navItems = [
    {
      label: 'Main Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['TRAINING_CENTRE', 'DISTRICT_OFFICER', 'QUALITY_TEAM', 'STATE_OFFICE'],
    },
    {
      label: 'Batches Registry',
      path: '/batches',
      icon: Layers,
      roles: ['TRAINING_CENTRE', 'DISTRICT_OFFICER', 'QUALITY_TEAM', 'STATE_OFFICE'],
    },
    {
      label: 'District Approvals',
      path: '/district-approvals',
      icon: CheckSquare,
      badge: '2-Officer',
      roles: ['DISTRICT_OFFICER', 'STATE_OFFICE'],
    },
    {
      label: 'Quality Review',
      path: '/quality-review',
      icon: ShieldAlert,
      badge: 'Large Batches',
      roles: ['QUALITY_TEAM', 'STATE_OFFICE'],
    },
    {
      label: 'State Directorate',
      path: '/state-office',
      icon: Building2,
      badge: 'Final Sanction',
      roles: ['STATE_OFFICE'],
    },
    {
      label: 'Candidates',
      path: '/candidates',
      icon: Users,
      roles: ['TRAINING_CENTRE', 'DISTRICT_OFFICER', 'QUALITY_TEAM', 'STATE_OFFICE'],
    },
    {
      label: 'Issued Certificates',
      path: '/certificates',
      icon: Award,
      roles: ['TRAINING_CENTRE', 'DISTRICT_OFFICER', 'QUALITY_TEAM', 'STATE_OFFICE'],
    },
    {
      label: 'Public Verification',
      path: '/verify',
      icon: FileSearch,
      roles: ['TRAINING_CENTRE', 'DISTRICT_OFFICER', 'QUALITY_TEAM', 'STATE_OFFICE'],
    },
    {
      label: 'Audit Trail',
      path: '/audit-logs',
      icon: History,
      roles: ['DISTRICT_OFFICER', 'QUALITY_TEAM', 'STATE_OFFICE'],
    },
    {
      label: 'System & WhatsApp Logs',
      path: '/monitoring',
      icon: Activity,
      roles: ['STATE_OFFICE', 'QUALITY_TEAM'],
    },
  ];

  const allowedItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer (Fixed on mobile, static on lg screens) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[280px] lg:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 text-slate-300 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center shadow-md shadow-brand-500/20 text-white font-bold text-lg tracking-wider">
              CF
            </div>
            <div>
              <span className="font-bold text-base text-white tracking-tight">CertiFlow</span>
              <span className="block text-[10px] text-brand-400 font-medium tracking-wider uppercase">
                Govt. Skilling Portal
              </span>
            </div>
          </div>

          {/* Close button on mobile/tablet */}
          <button
            onClick={onClose}
            className="p-2 -mr-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Context Card */}
        <div className="p-3.5 mx-3 my-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {user?.name ? user.name[0] : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-white truncate">{user?.name}</h4>
              <p className="text-[11px] text-brand-400 font-medium truncate capitalize">
                {role?.toLowerCase().replace('_', ' ')}
              </p>
            </div>
          </div>
          {user?.trainingCentre && (
            <p className="text-[10px] text-slate-400 mt-2 truncate">
              Centre: {user.trainingCentre.name}
            </p>
          )}
          {user?.district && (
            <p className="text-[10px] text-slate-400 truncate">District: {user.district.name}</p>
          )}
        </div>

        {/* Navigation Menu Links */}
        <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Navigation Menu
          </div>
          {allowedItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                // Auto-close drawer on mobile when navigating
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <item.icon className="w-4 h-4 opacity-80 shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 shrink-0 ml-2">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* Public Verification Link */}
        <div className="p-3 border-t border-slate-800">
          <a
            href="/verify"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border border-slate-800"
          >
            <span className="flex items-center space-x-2">
              <ExternalLink className="w-3.5 h-3.5 text-brand-400" />
              <span>Open Public Verifier</span>
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">Live</span>
          </a>
        </div>
      </aside>
    </>
  );
};
