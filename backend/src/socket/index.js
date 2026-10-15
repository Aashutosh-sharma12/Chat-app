const { Server } = require('socket.io');
const env = require('../config/env');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokens');
const registry = require('./registry');
const presence = require('./presence');
const chat = require('./chat');
const call = require('./call');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',') },
    pingInterval: 20000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  });
  registry.setIO(io);

  // JWT handshake: client connects with io(url, { auth: { token } }).
  io.use(async (socket, next) => {
    try {
      const { token } = socket.handshake.auth || {};
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error('unauthorized'));
      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    socket.join(registry.userRoom(socket.userId));
    chat.register(socket);
    call.register(socket);
    presence.register(socket);
    await presence.onConnect(socket);
    call.onConnect(socket);
  });

  return io;
}

// Wraps a socket handler so thrown errors become `{ ok: false, error }` acks instead of crashing.
function handler(fn) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const result = await fn(payload || {});
      reply({ ok: true, ...(result || {}) });
    } catch (err) {
      if (!err.status) console.error('[socket]', err);
      reply({ ok: false, error: err.status ? err.message : 'Server error' });
    }
  };
}

module.exports = { initSocket, handler };
