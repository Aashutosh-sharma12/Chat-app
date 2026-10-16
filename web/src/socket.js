import { io } from 'socket.io-client';
import { API_URL } from './config';
import { refreshTokens, tokens } from './api/client';
import { useChat } from './store/chat';
import { usePresence } from './store/presence';
import { callEvents } from './callManager';

let socket = null;
export const getSocket = () => socket;

// Emits with an ack and a timeout so a dead connection never leaves the UI hanging.
export function emitAck(event, payload, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, error: 'Not connected' });
    socket.timeout(timeoutMs).emit(event, payload, (err, res) => resolve(err ? { ok: false, error: 'Request timed out' } : res));
  });
}

// Marks the open chat as seen, but only while the tab is visible.
export function markActiveSeen() {
  const id = useChat.getState().activeConversationId;
  if (!id || document.visibilityState !== 'visible' || !socket?.connected) return;
  socket.emit('message:seen', { conversationId: id });
  useChat.getState().clearUnread(id);
}

export function connectSocket() {
  if (socket) return socket;
  socket = io(API_URL, {
    transports: ['websocket'],
    auth: (cb) => cb({ token: tokens.access }), // re-read on every reconnect
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    useChat.getState().loadConversations().catch(() => {});
    const active = useChat.getState().activeConversationId;
    if (active) useChat.getState().loadMessages(active).catch(() => {});
    markActiveSeen();
  });

  socket.on('connect_error', async (err) => {
    if (err.message !== 'unauthorized') return;
    if (await refreshTokens()) socket?.connect();
  });

  socket.on('message:new', ({ message, from }) => {
    useChat.getState().receive(message, from);
    usePresence.getState().setTyping(message.sender, false);
    socket.emit('message:delivered', { messageIds: [message._id] });
    if (useChat.getState().activeConversationId === message.conversation) markActiveSeen();
    if (document.visibilityState !== 'visible') notify(from, message);
  });

  socket.on('message:status', ({ conversationId, messageIds, status }) =>
    useChat.getState().applyStatus(conversationId, messageIds, status)
  );

  socket.on('presence:update', ({ userId, isOnline, lastSeen }) => {
    usePresence.getState().set(userId, { isOnline, lastSeen });
    if (!isOnline) usePresence.getState().setTyping(userId, false);
  });

  socket.on('typing', ({ from, isTyping }) => usePresence.getState().setTyping(from, isTyping));
  callEvents.attach(socket);
  return socket;
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

function notify(from, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const body = message.type === 'text' ? message.text : `Sent a ${message.type}`;
  new Notification(from?.name || 'New message', { body, tag: message.conversation });
}

export async function fetchPresence(userId) {
  const res = await emitAck('presence:get', { userId });
  if (res.ok) usePresence.getState().set(userId, { isOnline: res.isOnline, lastSeen: res.lastSeen });
}

let typingTimer = null;
let typingSent = false;

// Sends "typing" once, then "stopped" after 2.5s without keystrokes.
export function notifyTyping(to, conversationId) {
  if (!socket?.connected) return;
  if (!typingSent) {
    socket.emit('typing', { to, conversationId, isTyping: true });
    typingSent = true;
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => stopTyping(to, conversationId), 2500);
}

export function stopTyping(to, conversationId) {
  clearTimeout(typingTimer);
  typingTimer = null;
  if (typingSent) socket?.emit('typing', { to, conversationId, isTyping: false });
  typingSent = false;
}
