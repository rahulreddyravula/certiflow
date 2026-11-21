import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { DEMO_PERSONAS } from './DemoSwitcher';
import { Bell, LogOut, Check, Menu, Sparkles, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { user, logout, demoLogin, isLoading } = useAuthStore();
  const { notifications, unreadCount, isConnected, markAsRead } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileSwitcher, setShowMobileSwitcher] = useState(false);

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-6 flex items-center justify-between shadow-xs relative">
      {/* Left: Mobile Hamburger + Platform Title (Guaranteed NO Truncation) */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden transition-colors shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-900 tracking-tight shrink-0 whitespace-nowrap">
          <span className="hidden sm:inline">Skilling Certificate Lifecycle Platform</span>
          <span className="sm:hidden font-black text-brand-600">CertiFlow</span>
        </h1>
      </div>

      {/* Center: Demo Persona Switcher (Fixed in this place only) */}
      <div className="hidden md:flex items-center justify-center flex-1 mx-2 lg:mx-4 min-w-0">
        <div className="bg-slate-100/95 border border-slate-200/90 rounded-xl p-1 flex items-center space-x-1 max-w-full overflow-x-auto no-scrollbar shadow-2xs">
          {/* Switcher Label */}
          <div className="flex items-center space-x-1 px-1.5 py-0.5 text-slate-600 font-bold text-[10px] sm:text-[11px] shrink-0 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="hidden xl:inline">SWITCH:</span>
          </div>

          {/* Persona Buttons */}
          {DEMO_PERSONAS.map((p) => {
            const isActive = user?.email === p.email;
            const firstName = p.name.split(' ')[0];
            const roleLabel =
              p.role === 'TRAINING_CENTRE'
                ? 'TRAINING'
                : p.role === 'DISTRICT_OFFICER'
                ? 'DISTRICT'
                : p.role === 'QUALITY_TEAM'
                ? 'QUALITY'
                : 'STATE';

            return (
              <button
                key={p.email}
                disabled={isActive}
                onClick={() => demoLogin(p.role, p.email)}
                className={`px-2 py-1 rounded-lg text-xs transition-all flex items-center space-x-1 shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/90'
                }`}
                title={`${p.name} - ${p.description}`}
              >
                <span className={`w-2 h-2 rounded-full ${p.avatarColor} shrink-0`} />
                <span className="font-medium">{firstName}</span>
                {isActive ? (
                  <span className="text-[10px] text-blue-100">
                    ({roleLabel})
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 hidden 2xl:inline">
                    ({roleLabel})
                  </span>
                )}
                {isActive && <UserCheck className="w-3 h-3 text-white ml-0.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Actions: Mobile Switch Toggle, SSE indicator, Notifications, User Avatar, Logout */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {/* Mobile Switcher Toggle Button */}
        <button
          onClick={() => setShowMobileSwitcher(!showMobileSwitcher)}
          className="md:hidden flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold"
          title="Switch Demo Role"
        >
          <Sparkles className="w-3 h-3 text-amber-600" />
          <span>Switch</span>
          {showMobileSwitcher ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Live SSE Pulse Indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs shrink-0">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="text-[11px] font-medium text-slate-600 hidden 2xl:inline">
            {isConnected ? 'Real-Time SSE' : 'Connecting SSE...'}
          </span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
              <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Live Notifications ({notifications.length})
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Automatic Updates</span>
              </div>

              <div className="max-h-72 sm:max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 sm:p-3.5 hover:bg-slate-50 transition-colors ${
                        !n.read ? 'bg-brand-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-slate-900 leading-snug">
                          {n.title}
                        </h4>
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-brand-600 hover:text-brand-800 p-0.5 rounded shrink-0"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1.5 block">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Pill */}
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
            {user?.name ? user.name[0] : 'U'}
          </div>
          <div className="hidden lg:block text-left max-w-[130px] xl:max-w-[160px]">
            <span className="text-xs font-semibold text-slate-800 block leading-none truncate">
              {user?.name}
            </span>
            <span className="text-[10px] text-slate-500 capitalize block truncate">
              {user?.role.toLowerCase().replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
          title="Sign Out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile Switcher Dropdown Menu */}
      {showMobileSwitcher && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-slate-900 border-b border-slate-800 p-3 shadow-xl z-50">
          <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Select Demo Persona:</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_PERSONAS.map((p) => {
              const isActive = user?.email === p.email;
              return (
                <button
                  key={p.email}
                  disabled={isLoading || isActive}
                  onClick={() => {
                    demoLogin(p.role, p.email);
                    setShowMobileSwitcher(false);
                  }}
                  className={`p-2 rounded-lg text-xs font-medium text-left flex items-center space-x-2 border transition-all ${
                    isActive
                      ? 'bg-blue-600 border-blue-400 text-white font-semibold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${p.avatarColor} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate">{p.name.split(' ')[0]}</span>
                    <span className="text-[9px] text-slate-400 block truncate">
                      {p.role.split('_')[0]}
                    </span>
                  </div>
                  {isActive && <UserCheck className="w-3.5 h-3.5 text-white shrink-0 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
