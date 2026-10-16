const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const registry = require('./registry');
const { markDelivered } = require('../services/chat');
const call = require('./call');

async function partnersOf(userId) {
  const ids = await Conversation.distinct('participants', { participants: userId });
  return ids.map(String).filter((id) => id !== userId);
}

async function broadcast(userId, isOnline, lastSeen) {
  const payload = { userId, isOnline, lastSeen };
  for (const partner of await partnersOf(userId)) registry.emitToUser(partner, 'presence:update', payload);
}

async function onConnect(socket) {
  const { userId } = socket;
  const cameOnline = registry.addSocket(userId, socket.id);
  if (cameOnline) {
    const lastSeen = new Date();
    await User.updateOne({ _id: userId }, { isOnline: true, lastSeen });
    await broadcast(userId, true, lastSeen);
  }
  // Anything sent while this user was offline is now delivered (double grey tick for the sender).
  await markDelivered(userId);
}

function register(socket) {
  const { userId } = socket;
  const { handler } = require('./index');

  socket.on(
    'presence:get',
    handler(async ({ userId: target }) => {
      if (!mongoose.isValidObjectId(target)) return { isOnline: false, lastSeen: null };
      const user = await User.findById(target).select('lastSeen');
      return { userId: target, isOnline: registry.isOnline(target), lastSeen: user ? user.lastSeen : null };
    })
  );

  socket.on('typing', ({ to, conversationId, isTyping } = {}) => {
    if (!mongoose.isValidObjectId(to)) return;
    registry.emitToUser(to, 'typing', { from: userId, conversationId, isTyping: Boolean(isTyping) });
  });

  socket.on('disconnect', async () => {
    const wentOffline = registry.removeSocket(userId, socket.id);
    if (!wentOffline) return;
    call.onUserOffline(userId);
    const lastSeen = new Date();
    try {
      await User.updateOne({ _id: userId }, { isOnline: false, lastSeen });
      await broadcast(userId, false, lastSeen);
    } catch (err) {
      console.error('[presence] disconnect', err.message);
    }
  });
}

module.exports = { register, onConnect };
