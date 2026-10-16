const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Strictly 1-to-1: `key` is the two participant ids sorted and joined, so each pair has one conversation.
const conversationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    participants: {
      type: [{ type: ObjectId, ref: 'User' }],
      validate: (v) => v.length === 2,
      index: true,
    },
    // Snapshot so the chat list still renders after the message itself expires.
    lastMessage: {
      _id: ObjectId,
      sender: ObjectId,
      type: { type: String },
      text: String,
      status: String,
      createdAt: Date,
    },
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

// Chat list: my conversations, newest first.
conversationSchema.index({ participants: 1, updatedAt: -1 });

conversationSchema.statics.keyFor = (a, b) => [a.toString(), b.toString()].sort().join('_');

conversationSchema.statics.findOrCreate = async function findOrCreate(a, b) {
  const key = this.keyFor(a, b);
  return this.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, participants: [a, b] } },
    { upsert: true, returnDocument: 'after' }
  );
};

module.exports = mongoose.model('Conversation', conversationSchema);
