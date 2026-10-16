import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const clockTime = (iso: string) => dayjs(iso).format('h:mm A');

// Chat list style: time today, "Yesterday", weekday this week, else date.
export function listTime(iso: string) {
  const d = dayjs(iso);
  const now = dayjs();
  if (d.isSame(now, 'day')) return d.format('h:mm A');
  if (d.isSame(now.subtract(1, 'day'), 'day')) return 'Yesterday';
  if (now.diff(d, 'day') < 7) return d.format('dddd');
  return d.format('DD/MM/YYYY');
}

export function lastSeenText(iso: string | null) {
  if (!iso) return '';
  const d = dayjs(iso);
  const now = dayjs();
  if (d.isSame(now, 'day')) return `last seen today at ${d.format('h:mm A')}`;
  if (d.isSame(now.subtract(1, 'day'), 'day')) return `last seen yesterday at ${d.format('h:mm A')}`;
  return `last seen ${d.format('DD/MM/YYYY')} at ${d.format('h:mm A')}`;
}

export function duration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function dayLabel(iso: string) {
  const d = dayjs(iso);
  const now = dayjs();
  if (d.isSame(now, 'day')) return 'Today';
  if (d.isSame(now.subtract(1, 'day'), 'day')) return 'Yesterday';
  return d.format('D MMMM YYYY');
}

const REPLY_LABELS = { image: '📷 Photo', video: '🎥 Video', audio: '🎤 Voice message', text: '' };

// Short text for a quoted message (the text itself, or a label for media).
export const replyLabel = (r: { type: keyof typeof REPLY_LABELS; text?: string }) =>
  r.type === 'text' ? r.text || '' : REPLY_LABELS[r.type];
