const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

async function register(req, res) {
  const { token } = req.body;
  if (!Expo.isExpoPushToken(token)) throw new ApiError(400, 'Invalid Expo push token');
  // A device belongs to one account at a time.
  await User.updateMany({ pushTokens: token, _id: { $ne: req.user._id } }, { $pull: { pushTokens: token } });
  await User.updateOne({ _id: req.user._id }, { $addToSet: { pushTokens: token } });
  res.json({ ok: true });
}

async function unregister(req, res) {
  await User.updateOne({ _id: req.user._id }, { $pull: { pushTokens: req.body.token } });
  res.json({ ok: true });
}

module.exports = { register, unregister };
