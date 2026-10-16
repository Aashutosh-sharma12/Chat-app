import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { isAxiosError } from 'axios';
import { authApi } from '@/api/endpoints';
import { tokenStore } from '@/services/tokenStore';
import { localDb } from '@/services/localDb';
import type { User } from '@/types';

const USER_KEY = 'user';

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  hydrate: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string) => Promise<void>;
  setUser: (user: User) => void;
  signOutLocal: () => Promise<void>;
};

async function saveUser(user: User) {
  localDb.use(user._id);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  async hydrate() {
    await tokenStore.load();
    if (!tokenStore.refreshToken) return set({ status: 'signedOut' });

    const cached = await SecureStore.getItemAsync(USER_KEY);
    if (cached) localDb.use((JSON.parse(cached) as User)._id);
    try {
      const user = await authApi.me();
      await saveUser(user);
      set({ status: 'signedIn', user });
    } catch (err) {
      // Offline at launch: keep the cached session instead of logging the user out.
      if (cached && isAxiosError(err) && !err.response) {
        set({ status: 'signedIn', user: JSON.parse(cached) });
      } else {
        await tokenStore.clear();
        set({ status: 'signedOut', user: null });
      }
    }
  },

  async login(phone, password) {
    const res = await authApi.login({ phone, password });
    await tokenStore.set(res.accessToken, res.refreshToken);
    await saveUser(res.user);
    set({ status: 'signedIn', user: res.user });
  },

  async register(name, phone, password) {
    const res = await authApi.register({ name, phone, password });
    await tokenStore.set(res.accessToken, res.refreshToken);
    await saveUser(res.user);
    set({ status: 'signedIn', user: res.user });
  },

  setUser(user) {
    saveUser(user);
    set({ user });
  },

  async signOutLocal() {
    await tokenStore.clear();
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ status: 'signedOut', user: null });
  },
}));

export const myId = () => useAuth.getState().user?._id ?? '';
