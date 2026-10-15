const mongoose = require('mongoose');
const { sendMessage, markDelivered, markSeen } = require('../services/chat');

function register(socket) {
  const { handler } = require('./index');

  // Ack = single grey tick. Payload: { to, type, text?, mediaId?, clientId }
  socket.on(
    'message:send',
    handler(async (payload) => {
      const { message } = await sendMessage(socket.user, payload);
      return { message: message.toPublic() };
    })
  );

  // Receiver confirms it got messages while online (double grey tick).
  socket.on(
    'message:delivered',
    handler(async ({ messageIds }) => {
      const ids = (Array.isArray(messageIds) ? messageIds : []).filter((id) => mongoose.isValidObjectId(id));
      if (ids.length) await markDelivered(socket.userId, { _id: { $in: ids } });
    })
  );

  // Receiver has the chat open (double blue tick).
  socket.on(
    'message:seen',
    handler(async ({ conversationId }) => ({ count: await markSeen(socket.userId, conversationId) }))
  );
}

module.exports = { register };
