import { create } from 'zustand';

const timers = {};

export const usePresence = create((set) => ({
  byUser: {},
  typing: {},
  set: (userId, p) => set((s) => ({ byUser: { ...s.byUser, [userId]: p } })),
  setTyping: (userId, isTyping) => {
    clearTimeout(timers[userId]);
    // Safety net in case the "stopped typing" event is lost.
    if (isTyping) timers[userId] = setTimeout(() => usePresence.getState().setTyping(userId, false), 6000);
    set((s) => ({ typing: { ...s.typing, [userId]: isTyping } }));
  },
  reset: () => set({ byUser: {}, typing: {} }),
}));
