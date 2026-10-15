const http = require('http');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');
const { initSocket } = require('./socket');
const { startMediaCleanup } = require('./jobs/mediaCleanup');

async function start({ mongoUri, port = env.port, jobs = true } = {}) {
  await connectDB(mongoUri);
  const server = http.createServer(app);
  const io = initSocket(server);
  if (jobs) startMediaCleanup();
  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`[server] listening on http://localhost:${server.address().port}`);
  return { server, io };
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { start };
