import { create } from 'zustand';
import { AuthSessionUser } from '@diagramz/shared';
import { apiClient, setAccessToken } from '../lib/api';

interface AuthState {
  user: AuthSessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: AuthSessionUser | null) => void;
  checkAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user, isLoading: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<AuthSessionUser>('/auth/me');
      set({ user: res.data, isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore error on logout
    } finally {
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  },
}));
