export const initials = (name = '?') =>
  name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

export const clock = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const sameDay = (a, b) => a.toDateString() === b.toDateString();

export function dayLabel(d) {
  const date = new Date(d);
  const now = new Date();
  if (sameDay(date, now)) return 'Today';
  if (sameDay(date, new Date(now.getTime() - 86400000))) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export const listTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return sameDay(date, new Date()) ? clock(date) : dayLabel(date);
};

export function lastSeenText(p) {
  if (!p) return '';
  if (p.isOnline) return 'online';
  if (!p.lastSeen) return 'offline';
  return `last seen ${dayLabel(p.lastSeen).toLowerCase()} at ${clock(p.lastSeen)}`;
}

export const duration = (sec = 0) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
};

const LABELS = { image: 'Photo', video: 'Video', audio: 'Voice message' };

// Short text for a quoted message (the text itself, or a label for media).
export const replyLabel = (r) => (r.type === 'text' ? r.text || '' : LABELS[r.type] || '');

// 0:00 style timer for calls.
export const clockDuration = (sec = 0) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};
