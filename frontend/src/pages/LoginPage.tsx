import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { DEMO_PERSONAS } from '../components/DemoSwitcher';
import { ShieldCheck, Lock, Mail, ArrowRight, FileSearch, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, demoLogin, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to authenticate. Please check your credentials.');
    }
  };

  const handleDemoSelect = async (role: any, userEmail: string) => {
    setError(null);
    try {
      await demoLogin(role, userEmail);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed demo switch.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between py-4 sm:py-6 px-3.5 sm:px-6 lg:px-8 font-sans relative overflow-x-hidden">
      {/* Top National Header */}
      <div className="relative z-10 max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-4 sm:mb-6">
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          <div className="flex items-center space-x-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shadow-2xs"></span>
            <span className="w-2 h-2 rounded-full bg-white inline-block shadow-2xs"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block shadow-2xs"></span>
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-300">
            भारत सरकार | Government of India
          </span>
        </div>
        <div className="flex items-center space-x-1.5 sm:space-x-2 text-[10px] sm:text-[11px] text-emerald-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>GovNet 256-bit TLS Gateway</span>
        </div>
      </div>

      {/* Background Radial Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Portal Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-2">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-brand-700 to-brand-500 shadow-xl shadow-brand-500/20 text-white font-bold text-xl sm:text-2xl tracking-wider mb-2 border border-brand-400/30">
          CF
        </div>
        <span className="text-[10px] sm:text-[11px] text-amber-400 font-bold tracking-widest uppercase block mb-1">
          कौशल भारत - कुशल भारत • SKILL INDIA MISSION
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          CertiFlow
        </h2>
        <p className="mt-1 text-xs text-slate-400 font-medium">
          National Skilling Certificate Issuance & Verification Platform
        </p>
      </div>

      {/* Main Container */}
      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 space-y-4 sm:space-y-6">
        {/* 1-Click Demo Persona Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center space-x-2 mb-3 sm:mb-4">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Explore Demo Personas (1-Click Login)
            </h3>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mb-3 sm:mb-4 leading-relaxed">
            Select any official role persona below to instantly sign in and explore the full approval lifecycle:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
            {DEMO_PERSONAS.map((p) => {
              const roleTitle =
                p.role === 'QUALITY_TEAM'
                  ? 'QUALITY OFFICER'
                  : p.role === 'STATE_OFFICE'
                  ? 'STATE OFFICER'
                  : p.role.replace('_', ' ');

              return (
                <button
                  key={p.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleDemoSelect(p.role, p.email)}
                  className="flex items-start space-x-2.5 sm:space-x-3 p-2.5 sm:p-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 hover:border-brand-500/50 text-left transition-all group min-h-[44px]"
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${p.avatarColor} flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5`}
                  >
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white group-hover:text-blue-200 transition-colors truncate">
                        {p.name}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                    </div>
                    <span className="text-[11px] text-white font-semibold tracking-wide block truncate">
                      {roleTitle}
                    </span>
                    <span className="text-[10px] text-slate-300 block truncate">
                      {p.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Standard Email/Password Form */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-md">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 sm:mb-4">
            Standard Credentials Login
          </h3>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@certiflow.gov.in"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 min-h-[44px]"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default password for demo users: <span className="font-mono text-slate-400">password123</span>
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-2.5 sm:py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all disabled:opacity-50 min-h-[44px]"
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Workspace'}
            </button>
          </form>
        </div>

        {/* Public Verification Link */}
        <div className="text-center pt-1 sm:pt-2">
          <button
            onClick={() => navigate('/verify')}
            className="inline-flex items-center space-x-2 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors p-2"
          >
            <FileSearch className="w-4 h-4 shrink-0" />
            <span>Verify an Issued Certificate Without Signing In</span>
          </button>
        </div>

        {/* Statutory Legal Advisory */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[10px] text-slate-400 text-center leading-relaxed">
          <strong className="text-slate-300">STATUTORY NOTICE:</strong> This is a restricted Government of India Portal. Unauthorized access, credential tampering, or forged certificate generation is punishable under Section 43 & 66 of the Information Technology Act 2000.
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-500 py-3 sm:py-4 relative z-10 border-t border-slate-900 mt-4 sm:mt-6">
        Ministry of Skill Development and Entrepreneurship • Digital India Initiative
      </footer>
    </div>
  );
};
