const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

// Sends a push notification to every registered device of a user and prunes dead tokens.
async function sendPush(userId, { title, body, data = {}, channelId = 'messages', priority = 'high', ttl }) {
  const user = await User.findById(userId).select('+pushTokens');
  if (!user || user.pushTokens.length === 0) return;

  const tokens = user.pushTokens.filter((t) => Expo.isExpoPushToken(t));
  const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default', channelId, priority, ttl }));

  const invalid = [];
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((t, i) => {
        if (t.status === 'error' && t.details && t.details.error === 'DeviceNotRegistered') invalid.push(chunk[i].to);
      });
    } catch (err) {
      console.error('[push] send failed', err.message);
    }
  }

  if (invalid.length) await User.updateOne({ _id: userId }, { $pull: { pushTokens: { $in: invalid } } });
}

module.exports = { sendPush };
