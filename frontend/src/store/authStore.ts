import { create } from 'zustand';
import { User, Role } from '../types';
import { api } from '../api/client';

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
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  demoLogin: async (role: Role, email?: string) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/demo-login', { role, email });
      const { token, user } = res.data;
      localStorage.setItem('certiflow_token', token);
      localStorage.setItem('certiflow_user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('certiflow_token');
    localStorage.removeItem('certiflow_user');
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
