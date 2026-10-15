const multer = require('multer');
const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let { message } = err;

  if (err instanceof multer.MulterError) {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = `File too large (max ${env.maxUploadMb}MB)`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  } else if (err.code === 11000) {
    status = 409;
    message = 'Already exists';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 && env.nodeEnv === 'production' ? 'Server error' : message });
}

module.exports = { notFound, errorHandler };
