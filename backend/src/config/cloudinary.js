const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

const isConfigured = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
} else {
  console.warn('[cloudinary] credentials missing, media upload is disabled');
}

module.exports = { cloudinary, isConfigured };
