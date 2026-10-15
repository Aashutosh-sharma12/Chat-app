const mongoose = require('mongoose');
const env = require('./env');

async function connectDB(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[db] connected');
  return mongoose.connection;
}

module.exports = { connectDB };
