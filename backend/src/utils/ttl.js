const env = require('../config/env');

const HOUR = 60 * 60 * 1000;

const messageExpiry = (from = new Date()) => new Date(from.getTime() + env.messageTtlHours * HOUR);

// Images and videos: 24h. Voice notes: follow AUDIO_TTL_HOURS (default 3 days, same as messages).
const mediaExpiry = (type, from = new Date()) =>
  new Date(from.getTime() + (type === 'audio' ? env.audioTtlHours : env.mediaTtlHours) * HOUR);

module.exports = { messageExpiry, mediaExpiry };
