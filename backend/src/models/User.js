const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true }, // E.164
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    about: { type: String, trim: true, maxlength: 140, default: 'Hey there! I am using ChatApp.' },
    avatarUrl: { type: String, default: null },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    pushTokens: { type: [String], default: [], select: false },
    // Incremented on logout so old refresh tokens stop working.
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    phone: this.phone,
    name: this.name,
    about: this.about,
    avatarUrl: this.avatarUrl,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
  };
};

module.exports = mongoose.model('User', userSchema);
