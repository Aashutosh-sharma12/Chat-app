import { uploadMedia } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useChat } from '@/store/chat';
import { myId } from '@/store/auth';
import { emitAck } from './socket';
import { newId } from '@/utils/id';
import type { MediaType, Message } from '@/types';

type Outgoing = {
  to: string;
  conversationId: string;
  type: Message['type'];
  text?: string;
  localUri?: string;
  mimeType?: string;
  fileName?: string;
  duration?: number;
};

const drafts = new Map<string, Outgoing>(); // clientId -> original request, for retry

function optimistic(o: Outgoing, clientId: string): Message {
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
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 72 * 3600 * 1000).toISOString(),
    localUri: o.localUri,
    localMime: o.mimeType,
  };
}

async function deliver(o: Outgoing, clientId: string) {
  const chat = useChat.getState();
  try {
    let mediaId: string | undefined;
    if (o.type !== 'text') {
      const media = await uploadMedia(o.localUri!, o.mimeType!, o.fileName);
      mediaId = media._id;
    }
    const res = await emitAck<{ message: Message }>('message:send', {
      to: o.to,
      type: o.type,
      text: o.text,
      mediaId,
      clientId,
    });
    if (!res.ok) throw new Error(res.error);
    chat.replaceLocal(clientId, res.message);
    drafts.delete(clientId);
  } catch (err) {
    console.warn('[send] failed:', errorMessage(err));
    chat.markFailed(clientId);
  }
}

export function sendText(to: string, conversationId: string, text: string) {
  return send({ to, conversationId, type: 'text', text });
}

export function sendMedia(
  to: string,
  conversationId: string,
  type: MediaType,
  localUri: string,
  mimeType: string,
  extra: { fileName?: string; duration?: number } = {}
) {
  return send({ to, conversationId, type, localUri, mimeType, ...extra });
}

function send(o: Outgoing) {
  const clientId = newId();
  drafts.set(clientId, o);
  useChat.getState().addLocal(optimistic(o, clientId));
  return deliver(o, clientId);
}

// Same clientId on retry, so the server never stores the message twice.
export function retry(message: Message) {
  const o = message.clientId && drafts.get(message.clientId);
  if (!o || !message.clientId) return;
  useChat.setState((s) => ({
    messages: {
      ...s.messages,
      [message.conversation]: s.messages[message.conversation].map((m) =>
        m.clientId === message.clientId ? { ...m, status: 'pending' } : m
      ),
    },
  }));
  return deliver(o, message.clientId);
}
