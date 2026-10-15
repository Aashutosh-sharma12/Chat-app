const Media = require('../models/Media');
const ApiError = require('../utils/ApiError');
const { mediaExpiry } = require('../utils/ttl');
const { uploadBuffer, videoThumbnail, resourceTypeFor } = require('../services/cloudinary');

// Uploads one file to Cloudinary. The app then sends a chat message that references the returned media id.
async function upload(req, res) {
  if (!req.file) throw new ApiError(400, 'File is required (field name "file")');
  const type = req.file.mimetype.split('/')[0]; // image | video | audio

  const result = await uploadBuffer(req.file.buffer, type);
  const media = await Media.create({
    uploader: req.user._id,
    type,
    publicId: result.public_id,
    resourceType: resourceTypeFor(type),
    url: result.secure_url,
    thumbnailUrl: type === 'video' ? videoThumbnail(result.public_id) : undefined,
    width: result.width,
    height: result.height,
    duration: result.duration,
    bytes: result.bytes,
    expiresAt: mediaExpiry(type),
  });

  res.status(201).json({ media: media.toPublic() });
}

module.exports = { upload };
