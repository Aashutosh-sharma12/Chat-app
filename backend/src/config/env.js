require('dotenv').config({ quiet: true });

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

const env = {
  port: num(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chat-app',

  jwtSecret: process.env.JWT_SECRET || 'dev-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  mediaTtlHours: num(process.env.MEDIA_TTL_HOURS, 24),
  audioTtlHours: num(process.env.AUDIO_TTL_HOURS, 72),
  messageTtlHours: num(process.env.MESSAGE_TTL_HOURS, 72),
  mediaCleanupCron: process.env.MEDIA_CLEANUP_CRON || '*/15 * * * *',

  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 50),
  defaultCountry: process.env.DEFAULT_COUNTRY || 'IN',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  stunUrls: list(process.env.STUN_URLS || 'stun:stun.l.google.com:19302'),
  turnUrls: list(process.env.TURN_URLS),
  turnUsername: process.env.TURN_USERNAME,
  turnCredential: process.env.TURN_CREDENTIAL,
};

if (env.nodeEnv === 'production' && (env.jwtSecret.startsWith('dev-') || env.jwtSecret.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
