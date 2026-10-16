import { uploadMedia } from './api/client';
import { useChat } from './store/chat';
import { myId } from './store/auth';
import { emitAck } from './socket';
import { newId } from './utils/id';

const drafts = new Map(); // clientId -> original request, for retry

function optimistic(o, clientId) {
  const now = new Date();
  return {
    _id: clientId,
    clientId,
    conversation: o.conversationId,
    sender: myId(),
    receiver: o.to,
    type: o.type,
    text: o.text,
    media: null,
    replyTo: o.replyTo ?? null,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 72 * 3600 * 1000).toISOString(),
    localUri: o.file ? URL.createObjectURL(o.file) : undefined,
  };
}

async function deliver(o, clientId) {
  const chat = useChat.getState();
  try {
    const media = o.file ? await uploadMedia(o.file) : null;
    const res = await emitAck('message:send', { to: o.to, type: o.type, text: o.text, mediaId: media?._id, clientId, replyTo: o.replyTo?._id });
    if (!res.ok) throw new Error(res.error);
    chat.replaceLocal(clientId, res.message);
    drafts.delete(clientId);
  } catch (err) {
    console.warn('[send] failed:', err.message);
    chat.markFailed(clientId);
  }
}

function send(o) {
  const clientId = newId();
  drafts.set(clientId, o);
  useChat.getState().addLocal(optimistic(o, clientId));
  return deliver(o, clientId);
}

export const sendText = (to, conversationId, text, replyTo) => send({ to, conversationId, type: 'text', text, replyTo });

export const sendFile = (to, conversationId, file, replyTo) =>
  send({ to, conversationId, type: file.type.split('/')[0], file, replyTo });

// Same clientId on retry, so the server never stores the message twice.
export function retry(message) {
  const o = message.clientId && drafts.get(message.clientId);
  if (!o) return;
  useChat.getState().markPending(message);
  return deliver(o, message.clientId);
}
