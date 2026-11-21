import { create } from 'zustand';
import { NotificationItem } from '../types';
import { api } from '../api/client';
import { store } from './index';
import { apiSlice } from './apiSlice';

export interface ToastAlert {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: ToastAlert[];
  isConnected: boolean;
  eventSource: EventSource | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  addToast: (toast: Omit<ToastAlert, 'id'>) => void;
  removeToast: (id: string) => void;
  connectSSE: (token: string) => void;
  disconnectSSE: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  toasts: [],
  isConnected: false,
  eventSource: null,

  fetchNotifications: async () => {
    try {
      const res = await api.get('/monitoring/notifications');
      const notifications = res.data.notifications || [];
      const unreadCount = notifications.filter((n: NotificationItem) => !n.read).length;
      set({ notifications, unreadCount });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.patch(`/monitoring/notifications/${id}/read`);
      set((state) => {
        const updated = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
        return {
          notifications: updated,
          unreadCount: updated.filter((n) => !n.read).length,
        };
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  addToast: (toast) => {
    // Deduplicate identical active toasts
    const existing = get().toasts.find(
      (t) => t.title === toast.title || t.message === toast.message
    );
    if (existing) return;

    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    
    // Limit to max 3 toasts at any time (slice off oldest)
    set((state) => {
      const current = state.toasts.length >= 3 ? state.toasts.slice(-2) : state.toasts;
      return { toasts: [...current, { ...toast, id }] };
    });

    // Auto dismiss after 5s
    setTimeout(() => {
      get().removeToast(id);
    }, 5000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  connectSSE: (token: string) => {
    const existing = get().eventSource;
    if (existing) {
      existing.close();
    }

    try {
      const sseUrl = `/api/events/subscribe?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);

      es.onopen = () => {
        set({ isConnected: true, eventSource: es });
      };

      es.onerror = () => {
        set({ isConnected: false });
      };

      // Listen to common SSE events and broadcast to active pages
      es.addEventListener('notification.new', (event) => {
        const data = JSON.parse(event.data);
        get().addToast({
          title: data.title,
          message: data.message,
          type: data.type || 'INFO',
        });
        get().fetchNotifications();
        window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'notification' } }));
      });

      es.addEventListener('batch.submitted', (event) => {
        const data = JSON.parse(event.data);
        get().addToast({
          title: 'Batch Submitted',
          message: `Batch ${data.batchId} submitted for district review.`,
          type: 'INFO',
        });
        store.dispatch(apiSlice.util.invalidateTags(['Batches', 'Dashboard']));
        window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'batch' } }));
      });

      es.addEventListener('batch.quality_approved', (event) => {
        const data = JSON.parse(event.data);
        get().addToast({
          title: 'Quality Review Passed',
          message: `Batch ${data.batchId} cleared quality team audit.`,
          type: 'SUCCESS',
        });
        store.dispatch(apiSlice.util.invalidateTags(['Batches', 'Dashboard']));
        window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'batch' } }));
      });

      es.addEventListener('certificate.generated', (event) => {
        const data = JSON.parse(event.data);
        get().addToast({
          title: 'Certificates Generated',
          message: `Generated ${data.count} official certificates.`,
          type: 'SUCCESS',
        });
        store.dispatch(apiSlice.util.invalidateTags(['Certificates', 'Dashboard', 'Batches']));
        window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'certificate' } }));
      });

      es.addEventListener('certificate.cancelled', (event) => {
        const data = JSON.parse(event.data);
        get().addToast({
          title: 'Certificate Cancelled',
          message: `Certificate ${data.certificateNumber} was cancelled by State Directorate.`,
          type: 'ERROR',
        });
        store.dispatch(apiSlice.util.invalidateTags(['Certificates', 'Dashboard']));
        window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'certificate' } }));
      });

      es.addEventListener('batch.overdue', () => {
        get().fetchNotifications();
        store.dispatch(apiSlice.util.invalidateTags(['Monitoring', 'Dashboard']));
        window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'batch' } }));
      });
    } catch (err) {
      console.error('Failed to establish SSE stream:', err);
    }
  },

  disconnectSSE: () => {
    const es = get().eventSource;
    if (es) {
      es.close();
      set({ eventSource: null, isConnected: false });
    }
  },
}));
