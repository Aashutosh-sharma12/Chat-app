const cron = require('node-cron');
const env = require('../config/env');
const Media = require('../models/Media');
const { deleteAssets, isConfigured } = require('../services/cloudinary');

const BATCH = 100; // Cloudinary delete_resources limit

let running = false;

// Deletes expired files from Cloudinary (images/videos after 24h, voice notes after AUDIO_TTL_HOURS).
async function runMediaCleanup() {
  if (running) return { deleted: 0 };
  running = true;
  let total = 0;
  try {
    for (const resourceType of ['image', 'video']) {
      for (;;) {
        const expired = await Media.find({ deleted: false, resourceType, expiresAt: { $lte: new Date() } })
          .select('_id publicId')
          .limit(BATCH)
          .lean();
        if (expired.length === 0) break;

        // Without Cloudinary credentials there is nothing remote to delete; still mark them so the app shows "expired".
        const removed = isConfigured ? await deleteAssets(expired.map((m) => m.publicId), resourceType) : expired.map((m) => m.publicId);
        if (removed.length === 0) break; // Cloudinary refused everything; retry on next run

        const gone = new Set(removed);
        const ids = expired.filter((m) => gone.has(m.publicId)).map((m) => m._id);
        await Media.updateMany({ _id: { $in: ids } }, { deleted: true, deletedAt: new Date() });
        total += removed.length;
        if (expired.length < BATCH) break;
      }
    }
    if (total) console.log(`[media-cleanup] deleted ${total} expired file(s)`);
  } catch (err) {
    console.error('[media-cleanup] failed', err.message);
  } finally {
    running = false;
  }
  return { deleted: total };
}

function startMediaCleanup() {
  cron.schedule(env.mediaCleanupCron, runMediaCleanup);
  runMediaCleanup(); // catch up on anything that expired while the server was down
}

module.exports = { startMediaCleanup, runMediaCleanup };
