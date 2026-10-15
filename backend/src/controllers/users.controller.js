const mongoose = require('mongoose');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { normalizePhone } = require('../utils/phone');

// Search by exact phone number (WhatsApp style: you find people by their number).
async function search(req, res) {
  const { phone, q } = req.validQuery;
  const filter = { _id: { $ne: req.user._id } };

  if (phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return res.json({ users: [] });
    filter.phone = normalized;
  } else if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(escaped, 'i') }, { phone: new RegExp(escaped) }];
  } else {
    return res.json({ users: [] });
  }

  const users = await User.find(filter).limit(20);
  res.json({ users: users.map((u) => u.toPublic()) });
}

async function getById(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid id');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ user: user.toPublic() });
}

async function updateMe(req, res) {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user.toPublic() });
}

module.exports = { search, getById, updateMe };
