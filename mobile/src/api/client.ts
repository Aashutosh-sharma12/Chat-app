import { AxiosError, create, InternalAxiosRequestConfig, isAxiosError } from 'axios';
import { API_URL } from '@/config';
import { tokenStore } from '@/services/tokenStore';

export const api = create({ baseURL: `${API_URL}/api`, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, refresh the access token once and retry the request.
api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  if (error.response?.status === 401 && original && !original._retried && !original.url?.startsWith('/auth/')) {
    original._retried = true;
    const token = await tokenStore.refresh();
    if (token) {
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }
  }
  return Promise.reject(error);
});

export function errorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (!err.response) return 'Cannot reach the server. Check your connection.';
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
