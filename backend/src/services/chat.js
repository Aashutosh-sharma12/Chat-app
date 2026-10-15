const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Media = require('../models/Media');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { messageExpiry } = require('../utils/ttl');
const registry = require('../socket/registry');
const { sendPush } = require('./push');

const PREVIEW = { image: '📷 Photo', video: '🎥 Video', audio: '🎤 Voice message' };

function snapshot(message) {
  return {
    _id: message._id,
    sender: message.sender,
    type: message.type,
    text: message.type === 'text' ? message.text.slice(0, 200) : PREVIEW[message.type],
    status: message.status,
    createdAt: message.createdAt,
  };
}

async function sendMessage(sender, { to, type = 'text', text, mediaId, clientId }) {
  if (!mongoose.isValidObjectId(to)) throw new ApiError(400, 'Invalid recipient');
  if (to === sender._id.toString()) throw new ApiError(400, 'Cannot message yourself');

  // Retried send with the same clientId: return the stored message instead of creating a duplicate.
  if (clientId) {
    const existing = await Message.findOne({ sender: sender._id, clientId }).populate('media');
    if (existing) return { message: existing, duplicate: true };
  }

  const receiver = await User.findById(to);
  if (!receiver) throw new ApiError(404, 'Recipient not found');

  let media = null;
  if (type === 'text') {
    if (!text || !text.trim()) throw new ApiError(400, 'Message text is empty');
  } else {
    if (!mongoose.isValidObjectId(mediaId)) throw new ApiError(400, 'mediaId is required');
    media = await Media.findOne({ _id: mediaId, uploader: sender._id, deleted: false });
    if (!media) throw new ApiError(404, 'Media not found');
    if (media.type !== type) throw new ApiError(400, 'Media type mismatch');
  }

  const conversation = await Conversation.findOrCreate(sender._id, receiver._id);
  const now = new Date();
  const message = await Message.create({
    conversation: conversation._id,
    sender: sender._id,
    receiver: receiver._id,
    clientId,
    type,
    text: type === 'text' ? text.trim() : text ? text.trim() : undefined,
    media: media ? media._id : undefined,
    expiresAt: messageExpiry(now),
  });
  message.media = media;

  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: snapshot(message) }, $inc: { [`unread.${receiver._id}`]: 1 } }
  );

  const payload = message.toPublic();
  registry.emitToUser(receiver._id, 'message:new', { message: payload, from: sender.toPublic() });

  if (!registry.isOnline(receiver._id)) {
    sendPush(receiver._id, {
      title: sender.name,
      body: type === 'text' ? payload.text.slice(0, 120) : PREVIEW[type],
      data: { kind: 'message', conversationId: conversation._id.toString(), userId: sender._id.toString() },
    }).catch((e) => console.error('[push]', e.message));
  }

  return { message, duplicate: false };
}

// Marks messages addressed to `userId` as delivered and tells each sender.
async function markDelivered(userId, filter = {}) {
  const pending = await Message.find({ receiver: userId, status: 'sent', ...filter }).select('_id sender conversation');
  if (pending.length === 0) return 0;

  const deliveredAt = new Date();
  await Message.updateMany({ _id: { $in: pending.map((m) => m._id) } }, { status: 'delivered', deliveredAt });
  notifySenders(pending, 'delivered', deliveredAt);
  await syncLastMessageStatus(pending, 'delivered');
  return pending.length;
}

// Marks every unseen message in a conversation as seen by `userId` (the chat is open on their screen).
async function markSeen(userId, conversationId) {
  if (!mongoose.isValidObjectId(conversationId)) throw new ApiError(400, 'Invalid conversation');
  const unseen = await Message.find({
    conversation: conversationId,
    receiver: userId,
    status: { $ne: 'seen' },
  }).select('_id sender conversation');

  await Conversation.updateOne({ _id: conversationId, participants: userId }, { $set: { [`unread.${userId}`]: 0 } });
  if (unseen.length === 0) return 0;

  const seenAt = new Date();
  const ids = unseen.map((m) => m._id);
  await Message.updateMany({ _id: { $in: ids }, deliveredAt: null }, { deliveredAt: seenAt });
  await Message.updateMany({ _id: { $in: ids } }, { status: 'seen', seenAt });
  notifySenders(unseen, 'seen', seenAt);
  await syncLastMessageStatus(unseen, 'seen');
  return unseen.length;
}

function notifySenders(messages, status, at) {
  const bySender = new Map();
  for (const m of messages) {
    const key = `${m.sender}|${m.conversation}`;
    if (!bySender.has(key)) bySender.set(key, { sender: m.sender, conversation: m.conversation, ids: [] });
    bySender.get(key).ids.push(m._id);
  }
  for (const { sender, conversation, ids } of bySender.values()) {
    registry.emitToUser(sender, 'message:status', { conversationId: conversation, messageIds: ids, status, at });
  }
}

async function syncLastMessageStatus(messages, status) {
  const ids = messages.map((m) => m._id);
  await Conversation.updateMany({ 'lastMessage._id': { $in: ids } }, { $set: { 'lastMessage.status': status } });
}

module.exports = { sendMessage, markDelivered, markSeen };
