const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: 'Conversation', required: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    receiver: { type: ObjectId, ref: 'User', required: true },
    // Client generated id so the sender can match the server ack to its optimistic bubble.
    clientId: { type: String },
    type: { type: String, enum: ['text', 'image', 'video', 'audio'], default: 'text' },
    text: { type: String, maxlength: 4000 },
    media: { type: ObjectId, ref: 'Media' },
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
    deliveredAt: Date,
    seenAt: Date,
    // MongoDB deletes the document automatically once this time passes (3 days by default).
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, status: 1 });
messageSchema.index({ sender: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

messageSchema.methods.toPublic = function toPublic() {
  const media = this.media && typeof this.media.toPublic === 'function' ? this.media.toPublic() : this.media || null;
  return {
    _id: this._id,
    conversation: this.conversation,
    sender: this.sender,
    receiver: this.receiver,
    clientId: this.clientId,
    type: this.type,
    text: this.text,
    media,
    status: this.status,
    deliveredAt: this.deliveredAt,
    seenAt: this.seenAt,
    createdAt: this.createdAt,
    expiresAt: this.expiresAt,
  };
};

module.exports = mongoose.model('Message', messageSchema);
