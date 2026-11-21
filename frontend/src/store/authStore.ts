import { create } from 'zustand';
import { User, Role } from '../types';
import { api } from '../api/client';
import { store } from './index';
import { apiSlice } from './apiSlice';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: (role: Role, email?: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('certiflow_token', token);
      localStorage.setItem('certiflow_user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true, isLoading: false });

      // Invalidate RTK Query cache so all stats refetch for the new role
      store.dispatch(apiSlice.util.resetApiState());
      window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'all' } }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  demoLogin: async (role: Role, email?: string) => {
    // 1. Instant Optimistic Switch from LocalStorage Cache (0ms latency!)
    if (email) {
      const cached = localStorage.getItem(`certiflow_demo_${email}`);
      if (cached) {
        try {
          const { token, user } = JSON.parse(cached);
          localStorage.setItem('certiflow_token', token);
          localStorage.setItem('certiflow_user', JSON.stringify(user));
          set({ token, user, isAuthenticated: true, isLoading: false });

          // Instantly wipe stale cache and broadcast auth change to all active views
          store.dispatch(apiSlice.util.resetApiState());
          window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'all', role } }));
        } catch (e) {
          // ignore cache parse error
        }
      }
    }

    try {
      const res = await api.post('/auth/demo-login', { role, email });
      const { token, user } = res.data;
      localStorage.setItem('certiflow_token', token);
      localStorage.setItem('certiflow_user', JSON.stringify(user));
      if (email) {
        localStorage.setItem(`certiflow_demo_${email}`, JSON.stringify({ token, user }));
      }
      set({ token, user, isAuthenticated: true, isLoading: false });

      // Instantly wipe stale cache and broadcast auth change to all active views
      store.dispatch(apiSlice.util.resetApiState());
      window.dispatchEvent(new CustomEvent('certiflow:update', { detail: { type: 'all', role } }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('certiflow_token');
    localStorage.removeItem('certiflow_user');
    store.dispatch(apiSlice.util.resetApiState());
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('certiflow_token');
    const userStr = localStorage.getItem('certiflow_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true });
      } catch (e) {
        localStorage.removeItem('certiflow_token');
        localStorage.removeItem('certiflow_user');
      }
    }
  },
}));
