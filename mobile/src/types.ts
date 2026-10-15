export type User = {
  _id: string;
  phone: string;
  name: string;
  about?: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  lastSeen: string | null;
};

export type MediaType = 'image' | 'video' | 'audio';
export type MessageType = 'text' | MediaType;

// pending/failed exist only on the device, before the server acks.
export type MessageStatus = 'pending' | 'failed' | 'sent' | 'delivered' | 'seen';

export type Media = {
  _id: string;
  type: MediaType;
  url: string | null;
  thumbnailUrl?: string | null;
  width?: number;
  height?: number;
  duration?: number;
  expiresAt: string;
  deleted: boolean;
};

export type Message = {
  _id: string;
  clientId?: string;
  conversation: string;
  sender: string;
  receiver: string;
  type: MessageType;
  text?: string;
  media: Media | null;
  status: MessageStatus;
  deliveredAt?: string;
  seenAt?: string;
  createdAt: string;
  expiresAt: string;
  // Local only
  localUri?: string;
  localMime?: string;
};

export type LastMessage = {
  _id: string;
  sender: string;
  type: MessageType;
  text: string;
  status: MessageStatus;
  createdAt: string;
};

export type Conversation = {
  _id: string;
  user: User;
  lastMessage: LastMessage | null;
  unread: number;
  updatedAt: string;
};

export type CallType = 'audio' | 'video';

export type CallLogEntry = {
  _id: string;
  callId: string;
  callType: CallType;
  status: 'answered' | 'missed' | 'rejected' | 'busy' | 'ended';
  direction: 'incoming' | 'outgoing';
  user: User;
  duration: number;
  createdAt: string;
};
