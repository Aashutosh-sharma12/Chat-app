const bcrypt = require('bcryptjs');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { normalizePhone } = require('../utils/phone');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');

const tokensFor = (user) => ({ accessToken: signAccessToken(user), refreshToken: signRefreshToken(user) });

async function register(req, res) {
  const phone = normalizePhone(req.body.phone);
  if (!phone) throw new ApiError(400, 'Invalid phone number');
  if (await User.exists({ phone })) throw new ApiError(409, 'Phone number already registered');

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({ phone, passwordHash, name: req.body.name });
  res.status(201).json({ user: user.toPublic(), ...tokensFor(user) });
}

async function login(req, res) {
  const phone = normalizePhone(req.body.phone);
  const user = phone && (await User.findOne({ phone }).select('+passwordHash +tokenVersion'));
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw new ApiError(401, 'Incorrect phone number or password');
  }
  res.json({ user: user.toPublic(), ...tokensFor(user) });
}

async function refresh(req, res) {
  let payload;
  try {
    payload = verifyRefreshToken(req.body.refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== payload.v) throw new ApiError(401, 'Refresh token revoked');
  res.json({ user: user.toPublic(), ...tokensFor(user) });
}

// Revokes all refresh tokens and removes this device's push token.
async function logout(req, res) {
  const update = { $inc: { tokenVersion: 1 } };
  if (req.body && req.body.pushToken) update.$pull = { pushTokens: req.body.pushToken };
  await User.updateOne({ _id: req.user._id }, update);
  res.json({ ok: true });
}

async function me(req, res) {
  res.json({ user: req.user.toPublic() });
}

module.exports = { register, login, refresh, logout, me };
