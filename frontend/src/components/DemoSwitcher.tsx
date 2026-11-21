import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { UserCheck, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Role } from '../types';

interface DemoPersona {
  name: string;
  role: Role;
  email: string;
  description: string;
  avatarColor: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    name: 'Anika Sharma',
    role: 'TRAINING_CENTRE',
    email: 'anika@training.certiflow.gov.in',
    description: 'Training Centre (Apex)',
    avatarColor: 'bg-emerald-600',
  },
  {
    name: 'Dev Verma',
    role: 'DISTRICT_OFFICER',
    email: 'dev@district.certiflow.gov.in',
    description: 'District Officer 1 (Bhopal)',
    avatarColor: 'bg-blue-600',
  },
  {
    name: 'Meera Rao',
    role: 'DISTRICT_OFFICER',
    email: 'meera@district.certiflow.gov.in',
    description: 'District Officer 2 (Bhopal)',
    avatarColor: 'bg-indigo-600',
  },
  {
    name: 'Kabir Singh',
    role: 'DISTRICT_OFFICER',
    email: 'kabir@district.certiflow.gov.in',
    description: 'District Officer 3 (Indore)',
    avatarColor: 'bg-cyan-600',
  },
  {
    name: 'Neha Gupta',
    role: 'QUALITY_TEAM',
    email: 'neha@quality.certiflow.gov.in',
    description: 'Quality Team Lead',
    avatarColor: 'bg-amber-600',
  },
  {
    name: 'Farah Khan',
    role: 'STATE_OFFICE',
    email: 'farah@state.certiflow.gov.in',
    description: 'State Director (Final Sanction)',
    avatarColor: 'bg-purple-600',
  },
];

export const DemoSwitcher: React.FC = () => {
  const { user, demoLogin, isLoading } = useAuthStore();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-4 py-2 text-xs shadow-inner">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold text-slate-300 text-[11px] sm:text-xs">
            Demo Persona Switcher:
          </span>
        </div>

        {/* Mobile Toggle Button for Personas */}
        <button
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="sm:hidden px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center space-x-1 border border-slate-700"
          aria-expanded={mobileExpanded}
        >
          <span>{user ? user.name.split(' ')[0] : 'Switch Role'}</span>
          {mobileExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Desktop / Tablet Horizontal Button Tray */}
        <div className="hidden sm:flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
          {DEMO_PERSONAS.map((p) => {
            const isActive = user?.email === p.email;
            return (
              <button
                key={p.email}
                disabled={isLoading || isActive}
                onClick={() => demoLogin(p.role, p.email)}
                className={`px-2 sm:px-2.5 py-1 rounded-md font-medium text-[11px] sm:text-xs transition-all flex items-center space-x-1.5 border shrink-0 ${
                  isActive
                    ? 'bg-brand-600 border-brand-400 text-white shadow-sm ring-1 ring-white/20'
                    : 'bg-slate-800/80 hover:bg-slate-750 hover:border-slate-600 text-slate-300 border-slate-700'
                }`}
                title={`${p.name} - ${p.description}`}
              >
                <span className={`w-2 h-2 rounded-full ${p.avatarColor} shrink-0`} />
                <span>{p.name.split(' ')[0]}</span>
                <span className="text-[10px] text-slate-400 opacity-80">({p.role.split('_')[0]})</span>
                {isActive && <UserCheck className="w-3 h-3 text-white ml-0.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Accordion Dropdown for Personas */}
      {mobileExpanded && (
        <div className="sm:hidden pt-2.5 mt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1.5">
          {DEMO_PERSONAS.map((p) => {
            const isActive = user?.email === p.email;
            return (
              <button
                key={p.email}
                disabled={isLoading || isActive}
                onClick={() => {
                  demoLogin(p.role, p.email);
                  setMobileExpanded(false);
                }}
                className={`p-2 rounded-lg font-medium text-[11px] text-left transition-all flex items-center space-x-1.5 border ${
                  isActive
                    ? 'bg-brand-600 border-brand-400 text-white shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${p.avatarColor} shrink-0`} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-slate-400 block truncate">
                    {p.role.split('_')[0]}
                  </span>
                </div>
                {isActive && <UserCheck className="w-3 h-3 text-white shrink-0 ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
