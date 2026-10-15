const { cloudinary, isConfigured } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

const FOLDER = 'chat-app';
const TAG = 'chat-media';

// Cloudinary stores audio under the "video" resource type.
const resourceTypeFor = (type) => (type === 'image' ? 'image' : 'video');

function uploadBuffer(buffer, type) {
  if (!isConfigured) throw new ApiError(503, 'Media storage is not configured');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceTypeFor(type), folder: `${FOLDER}/${type}`, tags: [TAG, type] },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

function videoThumbnail(publicId) {
  return cloudinary.url(publicId, { resource_type: 'video', format: 'jpg', transformation: [{ start_offset: 0 }] });
}

// Deletes up to 100 assets per call (Cloudinary limit). Returns the public ids that were removed or already gone.
async function deleteAssets(publicIds, resourceType) {
  if (!isConfigured || publicIds.length === 0) return [];
  const res = await cloudinary.api.delete_resources(publicIds, { resource_type: resourceType, invalidate: true });
  return Object.entries(res.deleted || {})
    .filter(([, state]) => state === 'deleted' || state === 'not_found')
    .map(([id]) => id);
}

module.exports = { uploadBuffer, videoThumbnail, deleteAssets, resourceTypeFor, isConfigured };
