import { api } from './client';
import type { CallLogEntry, Conversation, Media, Message, User } from '@/types';

type AuthResponse = { user: User; accessToken: string; refreshToken: string };

export const authApi = {
  register: (body: { phone: string; password: string; name: string }) =>
    api.post<AuthResponse>('/auth/register', body).then((r) => r.data),
  login: (body: { phone: string; password: string }) => api.post<AuthResponse>('/auth/login', body).then((r) => r.data),
  logout: (pushToken?: string | null) => api.post('/auth/logout', pushToken ? { pushToken } : {}),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
};

export const usersApi = {
  searchByPhone: (phone: string) =>
    api.get<{ users: User[] }>('/users/search', { params: { phone } }).then((r) => r.data.users),
  searchByText: (q: string) => api.get<{ users: User[] }>('/users/search', { params: { q } }).then((r) => r.data.users),
  get: (id: string) => api.get<{ user: User }>(`/users/${id}`).then((r) => r.data.user),
  updateMe: (body: Partial<Pick<User, 'name' | 'about'>>) =>
    api.patch<{ user: User }>('/users/me', body).then((r) => r.data.user),
};

export const chatApi = {
  conversations: () => api.get<{ conversations: Conversation[] }>('/conversations').then((r) => r.data.conversations),
  withUser: (userId: string) =>
    api.post<{ conversation: Conversation }>(`/conversations/with/${userId}`).then((r) => r.data.conversation),
  messages: (conversationId: string, before?: string) =>
    api
      .get<{ messages: Message[]; hasMore: boolean }>(`/conversations/${conversationId}/messages`, {
        params: { before, limit: 30 },
      })
      .then((r) => r.data),
};

export const pushApi = {
  register: (token: string) => api.post('/push/token', { token }),
};

export const callsApi = {
  history: () => api.get<{ calls: CallLogEntry[] }>('/calls').then((r) => r.data.calls),
  iceServers: () => api.get<{ iceServers: RTCIceServerLike[] }>('/calls/ice-servers').then((r) => r.data.iceServers),
};

export type RTCIceServerLike = { urls: string | string[]; username?: string; credential?: string };

// Multipart upload goes through axios (XMLHttpRequest). Expo SDK 57 replaces global fetch with expo/fetch,
// which rejects React Native's { uri, name, type } file parts, so fetch cannot be used here.
export async function uploadMedia(
  uri: string,
  mimeType: string,
  fileName?: string,
  onProgress?: (fraction: number) => void
): Promise<Media> {
  const form = new FormData();
  const name = fileName || uri.split('/').pop() || 'upload';
  form.append('file', { uri, name, type: mimeType } as unknown as Blob);

  const { data } = await api.post<{ media: Media }>('/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 5 * 60 * 1000, // videos on slow networks
    transformRequest: (body) => body, // keep FormData as-is so XHR builds the multipart body
    onUploadProgress: (e) => e.total && onProgress?.(e.loaded / e.total),
  });
  return data.media;
}
