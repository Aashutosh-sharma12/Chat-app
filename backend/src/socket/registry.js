// Shared socket state so REST controllers and socket handlers can both emit events.
// Single-process only: for several server instances use @socket.io/redis-adapter and keep presence in Redis.
let io = null;
const userSockets = new Map(); // userId -> Set<socketId>

const userRoom = (userId) => `user:${userId}`;

module.exports = {
  setIO(instance) {
    io = instance;
  },
  getIO() {
    return io;
  },
  userRoom,

  addSocket(userId, socketId) {
    const set = userSockets.get(userId) || new Set();
    const wasOffline = set.size === 0;
    set.add(socketId);
    userSockets.set(userId, set);
    return wasOffline;
  },

  // Returns true when this was the user's last open socket.
  removeSocket(userId, socketId) {
    const set = userSockets.get(userId);
    if (!set) return true;
    set.delete(socketId);
    if (set.size === 0) {
      userSockets.delete(userId);
      return true;
    }
    return false;
  },

  isOnline(userId) {
    return userSockets.has(userId.toString());
  },

  emitToUser(userId, event, payload) {
    if (io) io.to(userRoom(userId.toString())).emit(event, payload);
  },
};
