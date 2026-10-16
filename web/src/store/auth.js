import { create } from 'zustand';
import { authApi, tokens } from '../api/client';

export const useAuth = create((set) => ({
  status: 'loading', // loading | signedOut | signedIn
  user: null,

  async hydrate() {
    if (!tokens.refresh) return set({ status: 'signedOut' });
    try {
      set({ status: 'signedIn', user: await authApi.me() });
    } catch (err) {
      if (err.status === 0) set({ status: 'signedIn', user: null }); // offline: retry later
      else {
        tokens.clear();
        set({ status: 'signedOut', user: null });
      }
    }
  },

  async login(phone, password) {
    const res = await authApi.login({ phone, password });
    tokens.set(res.accessToken, res.refreshToken);
    set({ status: 'signedIn', user: res.user });
  },

  async register(name, phone, password) {
    const res = await authApi.register({ name, phone, password });
    tokens.set(res.accessToken, res.refreshToken);
    set({ status: 'signedIn', user: res.user });
  },

  setUser: (user) => set({ user }),

  async logout() {
    await authApi.logout();
    tokens.clear();
    set({ status: 'signedOut', user: null });
  },

  expire() {
    set({ status: 'signedOut', user: null });
  },
}));

export const myId = () => useAuth.getState().user?._id ?? '';
