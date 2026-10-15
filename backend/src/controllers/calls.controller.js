const CallLog = require('../models/CallLog');
const env = require('../config/env');

async function history(req, res) {
  const me = req.user._id;
  const logs = await CallLog.find({ $or: [{ caller: me }, { callee: me }], status: { $ne: 'ringing' } })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('caller callee');

  res.json({
    calls: logs.map((l) => {
      const outgoing = l.caller._id.equals(me);
      return {
        _id: l._id,
        callId: l.callId,
        callType: l.callType,
        status: l.status,
        direction: outgoing ? 'outgoing' : 'incoming',
        user: (outgoing ? l.callee : l.caller).toPublic(),
        duration: l.duration,
        createdAt: l.createdAt,
      };
    }),
  });
}

function iceServers(req, res) {
  const servers = [];
  if (env.stunUrls.length) servers.push({ urls: env.stunUrls });
  if (env.turnUrls.length) {
    servers.push({ urls: env.turnUrls, username: env.turnUsername, credential: env.turnCredential });
  }
  res.json({ iceServers: servers });
}

module.exports = { history, iceServers };
