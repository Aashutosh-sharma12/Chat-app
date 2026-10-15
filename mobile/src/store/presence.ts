import { create } from 'zustand';

type Presence = { isOnline: boolean; lastSeen: string | null };

type PresenceState = {
  byUser: Record<string, Presence>;
  typing: Record<string, boolean>; // userId -> is typing to me
  set: (userId: string, p: Presence) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  reset: () => void;
};

const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const usePresence = create<PresenceState>((set) => ({
  byUser: {},
  typing: {},
  set: (userId, p) => set((s) => ({ byUser: { ...s.byUser, [userId]: p } })),
  setTyping: (userId, isTyping) => {
    clearTimeout(typingTimers[userId]);
    // Safety net in case the "stopped typing" event is lost.
    if (isTyping) typingTimers[userId] = setTimeout(() => usePresence.getState().setTyping(userId, false), 6000);
    set((s) => ({ typing: { ...s.typing, [userId]: isTyping } }));
  },
  reset: () => set({ byUser: {}, typing: {} }),
}));
