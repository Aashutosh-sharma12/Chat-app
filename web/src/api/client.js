import { API_URL } from '../config';

const ACCESS = 'accessToken';
const REFRESH = 'refreshToken';
const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const tokens = {
  get access() {
    return read(ACCESS);
  },
  get refresh() {
    return read(REFRESH);
  },
  set(access, refresh) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

let onExpired = () => {};
export const setExpiredHandler = (fn) => {
  onExpired = fn;
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function send(path, { method = 'GET', body, form, token }) {
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. It may be waking up, please try again in a moment.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message || `Request failed (${res.status})`);
  return data;
}

let refreshing = null;
// Single-flight refresh: concurrent 401s share one request.
export function refreshTokens() {
  if (!tokens.refresh) return Promise.resolve(null);
  refreshing ||= send('/auth/refresh', { method: 'POST', body: { refreshToken: tokens.refresh } })
    .then((d) => {
      tokens.set(d.accessToken, d.refreshToken);
      return d.accessToken;
    })
    .catch((err) => {
      // Only a rejected token ends the session; network errors keep it for the next try.
      if (err.status === 401) {
        tokens.clear();
        onExpired();
      }
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api(path, opts = {}) {
  try {
    return await send(path, { ...opts, token: tokens.access });
  } catch (err) {
    if (err.status !== 401 || !tokens.refresh) throw err;
    const token = await refreshTokens();
    if (!token) throw err;
    return send(path, { ...opts, token });
  }
}

export const authApi = {
  login: (body) => send('/auth/login', { method: 'POST', body }),
  register: (body) => send('/auth/register', { method: 'POST', body }),
  me: () => api('/auth/me').then((r) => r.user),
  logout: () => api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}),
};

export const usersApi = {
  search: (q) => api(`/users/search?${/^[+\d\s()-]+$/.test(q) ? 'phone' : 'q'}=${encodeURIComponent(q)}`).then((r) => r.users),
  get: (id) => api(`/users/${id}`).then((r) => r.user),
  updateMe: (body) => api('/users/me', { method: 'PATCH', body }).then((r) => r.user),
};

export const chatApi = {
  conversations: () => api('/conversations').then((r) => r.conversations),
  withUser: (userId) => api(`/conversations/with/${userId}`, { method: 'POST' }).then((r) => r.conversation),
  messages: (id, before) => api(`/conversations/${id}/messages?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`),
};

export const callsApi = {
  history: () => api('/calls').then((r) => r.calls),
  iceServers: () => api('/calls/ice-servers').then((r) => r.iceServers),
};

export function uploadMedia(file) {
  const form = new FormData();
  form.append('file', file, file.name || 'upload');
  return api('/media', { method: 'POST', form }).then((r) => r.media);
}
