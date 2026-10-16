import { create } from 'zustand';
import { authApi, tokens } from '../api/client';
import { localDb } from '../localDb';

const USER_KEY = 'user';
const cachedUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};
const remember = (user) => {
  localDb.use(user._id);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
};

export const useAuth = create((set) => ({
  status: 'loading', // loading | signedOut | signedIn
  user: null,

  async hydrate() {
    if (!tokens.refresh) return set({ status: 'signedOut' });
    const cached = cachedUser();
    if (cached) localDb.use(cached._id);
    try {
      set({ status: 'signedIn', user: remember(await authApi.me()) });
    } catch (err) {
      // Offline or server asleep: keep the cached session and cached chats.
      if (err.status === 0 && cached) set({ status: 'signedIn', user: cached });
      else {
        tokens.clear();
        localStorage.removeItem(USER_KEY);
        set({ status: 'signedOut', user: null });
      }
    }
  },

  async login(phone, password) {
    const res = await authApi.login({ phone, password });
    tokens.set(res.accessToken, res.refreshToken);
    set({ status: 'signedIn', user: remember(res.user) });
  },

  async register(name, phone, password) {
    const res = await authApi.register({ name, phone, password });
    tokens.set(res.accessToken, res.refreshToken);
    set({ status: 'signedIn', user: remember(res.user) });
  },

  setUser: (user) => set({ user: remember(user) }),

  async logout() {
    await authApi.logout();
    tokens.clear();
    localStorage.removeItem(USER_KEY);
    set({ status: 'signedOut', user: null });
  },

  expire() {
    set({ status: 'signedOut', user: null });
  },
}));

export const myId = () => useAuth.getState().user?._id ?? '';
