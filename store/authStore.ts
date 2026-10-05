import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'attendance_jwt_token';

const webStorage = {
  get: async () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set: async (value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, value);
    }
  },
  remove: async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  },
};

const getStoredToken = async () => {
  if (Platform.OS === 'web') {
    return webStorage.get();
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
};

const saveStoredToken = async (token: string) => {
  if (Platform.OS === 'web') {
    await webStorage.set(token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

const deleteStoredToken = async () => {
  if (Platform.OS === 'web') {
    await webStorage.remove();
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

export interface User {
  id: string;
  // Present when the JWT payload includes it explicitly. This is the
  // `users.id` value — required by endpoints like PUT /api/hr/expoToken.
  // Do NOT confuse with `employee_id`, which points to a different row.
  user_id?: string;
  employee_id?: string;
  Name: string;
  Role: string;
  email: string;
  userType: string;
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAppReady: boolean;
  pendingEmail: string | null;

  checkAuth: () => Promise<void>;
  setAuthSuccess: (token: string) => Promise<void>;
  setPendingEmail: (email: string) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAppReady: false,
  pendingEmail: null,

  checkAuth: async () => {
    try {
      const storedToken = await getStoredToken();
      if (storedToken) {
        const decodedUser = jwtDecode<User>(storedToken);
        set({ token: storedToken, user: decodedUser, isAppReady: true });
        return;
      }
    } catch (error) {
      console.error('Failed to load token:', error);
    }

    set({ isAppReady: true });
  },

  setAuthSuccess: async (token: string) => {
    try {
      await saveStoredToken(token);
      const decodedUser = jwtDecode<User>(token);

      set({
        token,
        user: decodedUser,
        pendingEmail: null,
      });
    } catch (error) {
      console.error('Failed to save auth token:', error);
    }
  },

  setPendingEmail: (email: string) => {
    set({ pendingEmail: email });
  },

  logout: async () => {
    try {
      await deleteStoredToken();
      set({ token: null, user: null, pendingEmail: null });
      // Dynamic import avoids a top-level circular import with
      // lib/notifications.ts (which imports this store).
      const { resetPushRegistrationGuard } = await import('@/lib/notifications');
      resetPushRegistrationGuard();
    } catch (error) {
      console.error('Failed to delete token:', error);
    }
  },
}));