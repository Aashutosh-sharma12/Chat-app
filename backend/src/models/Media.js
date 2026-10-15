const mongoose = require('mongoose');
const env = require('../config/env');

const mediaSchema = new mongoose.Schema(
  {
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['image', 'video', 'audio'], required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
    url: { type: String, required: true },
    thumbnailUrl: String,
    width: Number,
    height: Number,
    duration: Number, // seconds, for video/audio
    bytes: Number,
    // When the Cloudinary file must be removed (24h for image/video).
    expiresAt: { type: Date, required: true },
    deleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

mediaSchema.index({ deleted: 1, expiresAt: 1 });
// Drop the bookkeeping record once every message that could reference it has expired too.
mediaSchema.index({ deletedAt: 1 }, { expireAfterSeconds: env.messageTtlHours * 3600 });

mediaSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    type: this.type,
    url: this.deleted ? null : this.url,
    thumbnailUrl: this.deleted ? null : this.thumbnailUrl,
    width: this.width,
    height: this.height,
    duration: this.duration,
    expiresAt: this.expiresAt,
    deleted: this.deleted,
  };
};

module.exports = mongoose.model('Media', mediaSchema);
