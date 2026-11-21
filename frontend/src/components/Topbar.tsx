import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Bell, LogOut, Check, Menu } from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, isConnected, markAsRead } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3.5 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Hamburger Menu (Mobile/Tablet) + Platform Title */}
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1 mr-2">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition-colors shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-xs sm:text-sm md:text-base font-bold text-slate-800 tracking-tight truncate">
            Skilling Certificate Lifecycle Platform
          </h1>
        </div>

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
          <span className="text-[11px] font-medium text-slate-600 hidden md:inline">
            {isConnected ? 'Real-Time SSE' : 'Connecting SSE...'}
          </span>
        </div>
      </div>

      {/* Right Actions: Notifications, User Avatar, Logout */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
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

          {/* Notifications Dropdown (Responsive width and positioning) */}
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
    </header>
  );
};
