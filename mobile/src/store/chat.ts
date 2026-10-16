import { create } from 'zustand';
import { chatApi } from '@/api/endpoints';
import { localDb } from '@/services/localDb';
import type { Conversation, Message, MessageStatus, User } from '@/types';

const RANK: Record<MessageStatus, number> = { failed: 0, pending: 1, sent: 2, delivered: 3, seen: 4 };

type ChatState = {
  conversations: Conversation[];
  // Newest first (the chat list is an inverted FlatList).
  messages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  convByUser: Record<string, string>;
  activeConversationId: string | null;

  hydrate: () => Promise<void>;
  loadConversations: () => Promise<void>;
  openWithUser: (userId: string) => Promise<Conversation>;
  loadMessages: (conversationId: string, older?: boolean) => Promise<void>;
  setActive: (conversationId: string | null) => void;

  addLocal: (message: Message) => void;
  replaceLocal: (clientId: string, message: Message) => void;
  markFailed: (clientId: string) => void;
  receive: (message: Message, from?: User) => void;
  applyStatus: (conversationId: string, ids: string[], status: MessageStatus) => void;
  clearUnread: (conversationId: string) => void;
  reset: () => void;
};

function upsertConversation(list: Conversation[], conv: Conversation) {
  return [conv, ...list.filter((c) => c._id !== conv._id)];
}

function preview(m: Message) {
  const labels = { image: '📷 Photo', video: '🎥 Video', audio: '🎤 Voice message', text: '' };
  return {
    _id: m._id,
    sender: m.sender,
    type: m.type,
    text: m.type === 'text' ? m.text || '' : labels[m.type],
    status: m.status,
    createdAt: m.createdAt,
  };
}

const initial = {
  conversations: [] as Conversation[],
  messages: {} as Record<string, Message[]>,
  hasMore: {} as Record<string, boolean>,
  convByUser: {} as Record<string, string>,
  activeConversationId: null as string | null,
};

export const useChat = create<ChatState>((set, get) => ({
  ...initial,

  // Fills the list from the on-device database (no network).
  async hydrate() {
    if (get().conversations.length) return;
    const saved = await localDb.getKV<Conversation[]>('conversations');
    if (saved && !get().conversations.length) {
      const byUser: Record<string, string> = {};
      for (const c of saved) byUser[c.user._id] = c._id;
      set({ conversations: saved, convByUser: { ...byUser, ...get().convByUser } });
    }
  },

  async loadConversations() {
    await get().hydrate(); // show the saved list right away, then refresh from the server
    const conversations = await chatApi.conversations();
    const convByUser = { ...get().convByUser };
    for (const c of conversations) convByUser[c.user._id] = c._id;
    set({ conversations, convByUser });
    localDb.setKV('conversations', conversations);
  },

  async openWithUser(userId) {
    // Conversation ids never change, so a known chat needs no request.
    await get().hydrate();
    const known = get().conversations.find((c) => c.user._id === userId);
    if (known) return known;
    const conv = await chatApi.withUser(userId);
    set((s) => ({ convByUser: { ...s.convByUser, [userId]: conv._id } }));
    return conv;
  },

  async loadMessages(conversationId, older = false) {
    const current = get().messages[conversationId] || [];
    const before = older ? current.filter((m) => m.status !== 'pending' && m.status !== 'failed').at(-1)?.createdAt : undefined;
    if (older && !before) return;

    // First open in this session: show the saved messages while the network request runs.
    if (!older && current.length === 0) {
      const saved = await localDb.getMessages(conversationId);
      if (saved.length) {
        set((s) => (s.messages[conversationId]?.length ? s : { messages: { ...s.messages, [conversationId]: saved } }));
      }
    }

    let page;
    try {
      page = await chatApi.messages(conversationId, before);
    } catch (err) {
      // Offline or server asleep: keep showing what is saved on the device.
      if (!older && get().messages[conversationId]?.length) return;
      throw err;
    }
    const { messages, hasMore } = page;
    localDb.putMessages(messages);

    set((s) => {
      const existing = s.messages[conversationId] || [];
      let merged: Message[];
      if (older) {
        merged = [...existing, ...messages.filter((m) => !existing.some((e) => e._id === m._id))];
      } else {
        // Keep unsent local messages on top of a fresh page.
        const local = existing.filter((m) => m.status === 'pending' || m.status === 'failed');
        merged = [...local, ...messages];
      }
      return { messages: { ...s.messages, [conversationId]: merged }, hasMore: { ...s.hasMore, [conversationId]: hasMore } };
    });
  },

  setActive(conversationId) {
    set({ activeConversationId: conversationId });
  },

  addLocal(message) {
    set((s) => ({
      messages: { ...s.messages, [message.conversation]: [message, ...(s.messages[message.conversation] || [])] },
    }));
  },

  replaceLocal(clientId, message) {
    localDb.putMessages([message]);
    set((s) => {
      const list = (s.messages[message.conversation] || []).map((m) =>
        m.clientId === clientId ? { ...message, localUri: m.localUri, localMime: m.localMime } : m
      );
      const conversations = s.conversations.map((c) =>
        c._id === message.conversation ? { ...c, lastMessage: preview(message), updatedAt: message.createdAt } : c
      );
      return { messages: { ...s.messages, [message.conversation]: list }, conversations };
    });
    // A brand-new chat is not in the list yet: refresh it once it has its first message.
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

  receive(message, from) {
    localDb.putMessages([message]);
    set((s) => {
      const list = s.messages[message.conversation];
      const messages =
        list && !list.some((m) => m._id === message._id)
          ? { ...s.messages, [message.conversation]: [message, ...list] }
          : s.messages;

      const isActive = s.activeConversationId === message.conversation;
      const existing = s.conversations.find((c) => c._id === message.conversation);
      const conversations = existing
        ? upsertConversation(s.conversations, {
            ...existing,
            lastMessage: preview(message),
            unread: isActive ? 0 : existing.unread + 1,
            updatedAt: message.createdAt,
          })
        : from
          ? upsertConversation(s.conversations, {
              _id: message.conversation,
              user: from,
              lastMessage: preview(message),
              unread: isActive ? 0 : 1,
              updatedAt: message.createdAt,
            })
          : s.conversations;

      const convByUser = from ? { ...s.convByUser, [from._id]: message.conversation } : s.convByUser;
      return { messages, conversations, convByUser };
    });
  },

  applyStatus(conversationId, ids, status) {
    localDb.setStatus(ids, status);
    const idSet = new Set(ids);
    // Never move a tick backwards (e.g. a late "delivered" after "seen").
    const bump = <T extends { _id: string; status: MessageStatus }>(m: T): T =>
      idSet.has(m._id) && RANK[status] > RANK[m.status] ? { ...m, status } : m;

    set((s) => ({
      messages: s.messages[conversationId]
        ? { ...s.messages, [conversationId]: s.messages[conversationId].map(bump) }
        : s.messages,
      conversations: s.conversations.map((c) =>
        c._id === conversationId && c.lastMessage ? { ...c, lastMessage: bump(c.lastMessage) } : c
      ),
    }));
  },

  clearUnread(conversationId) {
    set((s) => ({ conversations: s.conversations.map((c) => (c._id === conversationId ? { ...c, unread: 0 } : c)) }));
  },

  reset() {
    localDb.clear();
    set(initial);
  },
}));
