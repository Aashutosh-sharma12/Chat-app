import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/config';
import type { MessageStatus } from '@/types';

// WhatsApp ticks: clock (sending), ✓ sent, ✓✓ delivered, blue ✓✓ seen, ! failed.
export function Ticks({ status, size = 16 }: { status: MessageStatus; size?: number }) {
  switch (status) {
    case 'pending':
      return <Ionicons name="time-outline" size={size - 2} color={colors.muted} />;
    case 'failed':
      return <Ionicons name="alert-circle" size={size - 2} color={colors.danger} />;
    case 'sent':
      return <Ionicons name="checkmark" size={size} color={colors.muted} />;
    case 'delivered':
      return <Ionicons name="checkmark-done" size={size} color={colors.muted} />;
    case 'seen':
      return <Ionicons name="checkmark-done" size={size} color={colors.seen} />;
  }
}
