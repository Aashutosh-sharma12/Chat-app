import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_URL } from '@/config';

const ACCESS = 'accessToken';
const REFRESH = 'refreshToken';

let refreshing: Promise<string | null> | null = null;
let onSessionExpired: () => void = () => {};

// Keeps tokens in memory for fast access and in SecureStore so the session survives restarts.
export const tokenStore = {
  accessToken: null as string | null,
  refreshToken: null as string | null,

  async load() {
    this.accessToken = await SecureStore.getItemAsync(ACCESS);
    this.refreshToken = await SecureStore.getItemAsync(REFRESH);
  },

  async set(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    await SecureStore.setItemAsync(ACCESS, access);
    await SecureStore.setItemAsync(REFRESH, refresh);
  },

  async clear() {
    this.accessToken = null;
    this.refreshToken = null;
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
  },

  onExpired(cb: () => void) {
    onSessionExpired = cb;
  },

  // Single-flight refresh: concurrent 401s share one request.
  refresh(): Promise<string | null> {
    if (!this.refreshToken) return Promise.resolve(null);
    if (!refreshing) {
      refreshing = axios
        .post(`${API_URL}/api/auth/refresh`, { refreshToken: this.refreshToken }, { timeout: 15000 })
        .then(async ({ data }) => {
          await this.set(data.accessToken, data.refreshToken);
          return data.accessToken as string;
        })
        .catch(async (err) => {
          // Only a rejected token ends the session; network errors keep it for the next try.
          if (err?.response?.status === 401) {
            await this.clear();
            onSessionExpired();
          }
          return null;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  },
};
