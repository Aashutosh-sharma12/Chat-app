import { create } from 'zustand';
import { chatApi } from '../api/client';

const RANK = { failed: 0, pending: 1, sent: 2, delivered: 3, seen: 4 };
const LABELS = { image: 'Photo', video: 'Video', audio: 'Voice message', text: '' };

const upsert = (list, conv) => [conv, ...list.filter((c) => c._id !== conv._id)];

const preview = (m) => ({
  _id: m._id,
  sender: m.sender,
  type: m.type,
  text: m.type === 'text' ? m.text || '' : LABELS[m.type],
  status: m.status,
  createdAt: m.createdAt,
});

const initial = { conversations: [], messages: {}, hasMore: {}, convByUser: {}, activeConversationId: null, listLoaded: false };

// messages[conversationId] is newest first; the UI reverses it for display.
export const useChat = create((set, get) => ({
  ...initial,

  async loadConversations() {
    const conversations = await chatApi.conversations();
    const convByUser = { ...get().convByUser };
    for (const c of conversations) convByUser[c.user._id] = c._id;
    set({ conversations, convByUser, listLoaded: true });
  },

  async openWithUser(userId) {
    const conv = await chatApi.withUser(userId);
    set((s) => ({ convByUser: { ...s.convByUser, [userId]: conv._id } }));
    return conv;
  },

  async loadMessages(conversationId, older = false) {
    const current = get().messages[conversationId] || [];
    const before = older ? current.filter((m) => m.status !== 'pending' && m.status !== 'failed').at(-1)?.createdAt : undefined;
    if (older && !before) return;
    const { messages, hasMore } = await chatApi.messages(conversationId, before);

    set((s) => {
      const existing = s.messages[conversationId] || [];
      const merged = older
        ? [...existing, ...messages.filter((m) => !existing.some((e) => e._id === m._id))]
        : [...existing.filter((m) => m.status === 'pending' || m.status === 'failed'), ...messages];
      return { messages: { ...s.messages, [conversationId]: merged }, hasMore: { ...s.hasMore, [conversationId]: hasMore } };
    });
  },

  setActive: (id) => set({ activeConversationId: id }),

  addLocal: (message) =>
    set((s) => ({ messages: { ...s.messages, [message.conversation]: [message, ...(s.messages[message.conversation] || [])] } })),

  replaceLocal(clientId, message) {
    set((s) => {
      const list = (s.messages[message.conversation] || []).map((m) =>
        m.clientId === clientId ? { ...message, localUri: m.localUri } : m
      );
      const conversations = s.conversations.map((c) =>
        c._id === message.conversation ? { ...c, lastMessage: preview(message), updatedAt: message.createdAt } : c
      );
      return { messages: { ...s.messages, [message.conversation]: list }, conversations };
    });
    // A brand-new chat is not in the list yet: refresh once it has its first message.
    if (!get().conversations.some((c) => c._id === message.conversation)) get().loadConversations().catch(() => {});
  },

  markFailed(clientId) {
    set((s) => {
      const messages = { ...s.messages };
      for (const id of Object.keys(messages)) {
        if (messages[id].some((m) => m.clientId === clientId)) {
          messages[id] = messages[id].map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m));
        }
      }
      return { messages };
    });
  },

  markPending(message) {
    set((s) => ({
      messages: {
        ...s.messages,
        [message.conversation]: s.messages[message.conversation].map((m) =>
          m.clientId === message.clientId ? { ...m, status: 'pending' } : m
        ),
      },
    }));
  },

  receive(message, from) {
    set((s) => {
      const list = s.messages[message.conversation];
      const messages =
        list && !list.some((m) => m._id === message._id) ? { ...s.messages, [message.conversation]: [message, ...list] } : s.messages;

      const isActive = s.activeConversationId === message.conversation;
      const existing = s.conversations.find((c) => c._id === message.conversation);
      let conversations = s.conversations;
      if (existing) {
        conversations = upsert(s.conversations, {
          ...existing,
          lastMessage: preview(message),
          unread: isActive ? 0 : existing.unread + 1,
          updatedAt: message.createdAt,
        });
      } else if (from) {
        conversations = upsert(s.conversations, {
          _id: message.conversation,
          user: from,
          lastMessage: preview(message),
          unread: isActive ? 0 : 1,
          updatedAt: message.createdAt,
        });
      }
      const convByUser = from ? { ...s.convByUser, [from._id]: message.conversation } : s.convByUser;
      return { messages, conversations, convByUser };
    });
  },

  applyStatus(conversationId, ids, status) {
    const idSet = new Set(ids);
    // Never move a tick backwards (e.g. a late "delivered" after "seen").
    const bump = (m) => (idSet.has(m._id) && RANK[status] > RANK[m.status] ? { ...m, status } : m);
    set((s) => ({
      messages: s.messages[conversationId] ? { ...s.messages, [conversationId]: s.messages[conversationId].map(bump) } : s.messages,
      conversations: s.conversations.map((c) =>
        c._id === conversationId && c.lastMessage ? { ...c, lastMessage: bump(c.lastMessage) } : c
      ),
    }));
  },

  clearUnread: (id) => set((s) => ({ conversations: s.conversations.map((c) => (c._id === id ? { ...c, unread: 0 } : c)) })),

  reset: () => set(initial),
}));
