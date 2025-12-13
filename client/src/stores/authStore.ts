import { create } from 'zustand';
import api from '../utils/api';

interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Login function
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      if (response.data.success && response.data.token && response.data.data?.user) {
        const token = response.data.token;
        const user = response.data.data.user;

        // Store token in localStorage
        localStorage.setItem('token', token);

        // Update state
        set({
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
          },
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: 'Login failed: Invalid response',
        });
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Login failed. Please try again.';
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  },

  // Register function
  register: async (username: string, email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', {
        username,
        email,
        password,
      });

      if (response.data.success && response.data.token && response.data.data?.user) {
        const token = response.data.token;
        const user = response.data.data.user;

        // Store token in localStorage
        localStorage.setItem('token', token);

        // Update state
        set({
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
          },
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: 'Registration failed: Invalid response',
        });
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || 'Registration failed. Please try again.';
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  },

  // Logout function
  logout: () => {
    // Clear token from localStorage
    localStorage.removeItem('token');

    // Reset state
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  // Check auth function
  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/auth/me');

      if (response.data.success && response.data.data?.user) {
        const user = response.data.data.user;
        set({
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
          },
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        // Invalid response, clear everything
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      // Auth failed, clear everything
      localStorage.removeItem('token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  // Clear error function
  clearError: () => {
    set({ error: null });
  },
}));







