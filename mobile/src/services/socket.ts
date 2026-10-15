import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/config';
import { tokenStore } from './tokenStore';
import { useChat } from '@/store/chat';
import { usePresence } from '@/store/presence';
import { callEvents } from './callManager';
import type { Message, MessageStatus, User } from '@/types';

let socket: Socket | null = null;

export const getSocket = () => socket;

type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Emits with an ack and a timeout so a dead connection never leaves the UI hanging.
export function emitAck<T = object>(event: string, payload: object, timeoutMs = 10000): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, error: 'Not connected' });
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: Ack<T>) => {
      resolve(err ? { ok: false, error: 'Request timed out' } : res);
    });
  });
}

// Marks the open chat as seen, but only while the app is actually in the foreground.
export function markActiveSeen() {
  const conversationId = useChat.getState().activeConversationId;
  if (!conversationId || AppState.currentState !== 'active' || !socket?.connected) return;
  socket.emit('message:seen', { conversationId });
  useChat.getState().clearUnread(conversationId);
}

export function connectSocket() {
  if (socket) return socket;

  socket = io(API_URL, {
    transports: ['websocket'],
    // Called on every (re)connect so a refreshed token is picked up.
    auth: (cb) => cb({ token: tokenStore.accessToken }),
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    // Catch up on anything missed while disconnected.
    useChat.getState().loadConversations().catch(() => {});
    const active = useChat.getState().activeConversationId;
    if (active) useChat.getState().loadMessages(active).catch(() => {});
    markActiveSeen();
  });

  socket.on('connect_error', async (err) => {
    if (err.message !== 'unauthorized') return; // network errors: socket.io retries by itself
    const token = await tokenStore.refresh();
    if (token && socket) socket.connect();
  });

  socket.on('message:new', ({ message, from }: { message: Message; from: User }) => {
    useChat.getState().receive(message, from);
    socket?.emit('message:delivered', { messageIds: [message._id] });
    if (useChat.getState().activeConversationId === message.conversation) markActiveSeen();
  });

  socket.on(
    'message:status',
    ({ conversationId, messageIds, status }: { conversationId: string; messageIds: string[]; status: MessageStatus }) => {
      useChat.getState().applyStatus(conversationId, messageIds, status);
    }
  );

  socket.on('presence:update', ({ userId, isOnline, lastSeen }: { userId: string; isOnline: boolean; lastSeen: string }) => {
    usePresence.getState().set(userId, { isOnline, lastSeen });
    if (!isOnline) usePresence.getState().setTyping(userId, false);
  });

  socket.on('typing', ({ from, isTyping }: { from: string; isTyping: boolean }) => {
    usePresence.getState().setTyping(from, isTyping);
  });

  callEvents.attach(socket);
  return socket;
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export async function fetchPresence(userId: string) {
  const res = await emitAck<{ isOnline: boolean; lastSeen: string | null }>('presence:get', { userId });
  if (res.ok) usePresence.getState().set(userId, { isOnline: res.isOnline, lastSeen: res.lastSeen });
}

let typingTimer: ReturnType<typeof setTimeout> | null = null;
let typingSent = false;

// Sends "typing" once, then "stopped" after 2.5s without keystrokes.
export function notifyTyping(to: string, conversationId: string) {
  if (!socket?.connected) return;
  if (!typingSent) {
    socket.emit('typing', { to, conversationId, isTyping: true });
    typingSent = true;
  }
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => stopTyping(to, conversationId), 2500);
}

export function stopTyping(to: string, conversationId: string) {
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = null;
  if (typingSent) socket?.emit('typing', { to, conversationId, isTyping: false });
  typingSent = false;
}
