const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

function present(conv, meId) {
  const other = conv.participants.find((p) => p && p._id.toString() !== meId.toString());
  return {
    _id: conv._id,
    user: other && other.toPublic ? other.toPublic() : other,
    lastMessage: conv.lastMessage && conv.lastMessage._id ? conv.lastMessage : null,
    unread: (conv.unread && conv.unread.get(meId.toString())) || 0,
    updatedAt: conv.updatedAt,
  };
}

async function list(req, res) {
  const convs = await Conversation.find({ participants: req.user._id, 'lastMessage._id': { $exists: true } })
    .sort({ updatedAt: -1 })
    .limit(200)
    // Only load the other person; the signed-in user's own document is not needed.
    .populate({ path: 'participants', match: { _id: { $ne: req.user._id } } });
  res.json({ conversations: convs.map((c) => present(c, req.user._id)) });
}

// Opens (or creates) the 1-to-1 conversation with another user.
async function withUser(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId) || userId === req.user._id.toString()) throw new ApiError(400, 'Invalid user');
  if (!(await User.exists({ _id: userId }))) throw new ApiError(404, 'User not found');

  const conv = await Conversation.findOrCreate(req.user._id, userId);
  await conv.populate('participants');
  res.json({ conversation: present(conv, req.user._id) });
}

// Paginated history, newest first. Pass ?before=<ISO date> to load older messages.
async function messages(req, res) {
  const conv = await Conversation.findOne({ _id: req.params.id, participants: req.user._id });
  if (!conv) throw new ApiError(404, 'Conversation not found');

  const { before, limit } = req.validQuery;
  const filter = { conversation: conv._id };
  if (before) filter.createdAt = { $lt: before };

  const items = await Message.find(filter).sort({ createdAt: -1 }).limit(limit).populate('media');
  res.json({ messages: items.map((m) => m.toPublic()), hasMore: items.length === limit });
}

module.exports = { list, withUser, messages };
