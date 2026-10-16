/* End-to-end smoke test: REST auth, chat ticks, presence, typing, call signaling, TTL and media cleanup.
 * Uses an in-memory MongoDB, so no database setup is needed: `npm run test:socket` */
const assert = require('assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: connect } = require('socket.io-client');

process.env.CLOUDINARY_CLOUD_NAME = '';

const { start } = require('../src/server');
const Message = require('../src/models/Message');
const Media = require('../src/models/Media');
const CallLog = require('../src/models/CallLog');
const { runMediaCleanup } = require('../src/jobs/mediaCleanup');

let base;
const once = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const step = (name) => console.log(`  ✓ ${name}`);

(async () => {
  const mongo = await MongoMemoryServer.create();
  const { server, io } = await start({ mongoUri: mongo.getUri('chat-test'), port: 0, jobs: false });
  base = `http://localhost:${server.address().port}`;
  const sockets = [];
  const open = (token) => {
    const s = connect(base, { auth: { token }, transports: ['websocket'], forceNew: true });
    sockets.push(s);
    return once(s, 'connect').then(() => s);
  };

  try {
    // Auth
    const a = await api('/auth/register', { method: 'POST', body: { phone: '+919876543210', password: 'secret123', name: 'Alice' } });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    const b = await api('/auth/register', { method: 'POST', body: { phone: '9876501234', password: 'secret123', name: 'Bob' } });
    assert.equal(b.body.user.phone, '+919876501234');
    const dup = await api('/auth/register', { method: 'POST', body: { phone: '9876543210', password: 'x123456', name: 'X' } });
    assert.equal(dup.status, 409);
    const bad = await api('/auth/login', { method: 'POST', body: { phone: '9876543210', password: 'wrong123' } });
    assert.equal(bad.status, 401);
    const login = await api('/auth/login', { method: 'POST', body: { phone: '9876543210', password: 'secret123' } });
    assert.equal(login.status, 200);
    const refreshed = await api('/auth/refresh', { method: 'POST', body: { refreshToken: login.body.refreshToken } });
    assert.equal(refreshed.status, 200);
    step('register / login / refresh with phone + password');

    const A = { id: a.body.user._id, token: login.body.accessToken };
    const B = { id: b.body.user._id, token: b.body.accessToken };

    const found = await api('/users/search?phone=9876501234', { token: A.token });
    assert.equal(found.body.users[0]._id, B.id);
    step('search user by phone number');

    // Bob is offline: message stays "sent"
    const sa = await open(A.token);
    const ack1 = await emit(sa, 'message:send', { to: B.id, type: 'text', text: 'Hi Bob', clientId: 'c-1' });
    assert.equal(ack1.ok, true, ack1.error);
    assert.equal(ack1.message.status, 'sent');
    const again = await emit(sa, 'message:send', { to: B.id, type: 'text', text: 'Hi Bob', clientId: 'c-1' });
    assert.equal(again.message._id, ack1.message._id);
    step('send while receiver offline -> sent (single tick), retry is idempotent');

    const expiresIn = new Date(ack1.message.expiresAt) - new Date(ack1.message.createdAt);
    assert.equal(Math.round(expiresIn / 3600000), 72);
    const ttlIndex = (await Message.collection.indexes()).find((i) => i.key.expiresAt === 1);
    assert.equal(ttlIndex.expireAfterSeconds, 0);
    step('message expiresAt = +3 days with Mongo TTL index');

    // Bob connects: Alice gets presence + delivered
    const presenceP = once(sa, 'presence:update');
    const deliveredP = once(sa, 'message:status');
    const sb = await open(B.token);
    const presence = await presenceP;
    assert.deepEqual([presence.userId, presence.isOnline], [B.id, true]);
    const delivered = await deliveredP;
    assert.equal(delivered.status, 'delivered');
    step('receiver comes online -> presence online + delivered (double tick)');

    const got = await emit(sa, 'presence:get', { userId: B.id });
    assert.equal(got.isOnline, true);

    // Live message
    const newP = once(sb, 'message:new');
    const ack2 = await emit(sa, 'message:send', { to: B.id, type: 'text', text: 'Are you there?', clientId: 'c-2' });
    const incoming = await newP;
    assert.equal(incoming.message._id, ack2.message._id);
    assert.equal(incoming.from.name, 'Alice');
    const liveDelivered = once(sa, 'message:status');
    await emit(sb, 'message:delivered', { messageIds: [incoming.message._id] });
    assert.equal((await liveDelivered).status, 'delivered');
    step('real-time message + delivered ack');

    // Typing
    const typingP = once(sa, 'typing');
    sb.emit('typing', { to: A.id, conversationId: incoming.message.conversation, isTyping: true });
    assert.equal((await typingP).isTyping, true);
    step('typing indicator');

    // Conversation list + unread
    let convs = await api('/conversations', { token: B.token });
    assert.equal(convs.body.conversations[0].unread, 2);
    assert.equal(convs.body.conversations[0].user.name, 'Alice');

    // Seen
    const seenP = once(sa, 'message:status');
    const seenAck = await emit(sb, 'message:seen', { conversationId: incoming.message.conversation });
    assert.equal(seenAck.count, 2);
    const seen = await seenP;
    assert.equal(seen.status, 'seen');
    assert.equal(seen.messageIds.length, 2);
    convs = await api('/conversations', { token: B.token });
    assert.equal(convs.body.conversations[0].unread, 0);
    assert.equal(convs.body.conversations[0].lastMessage.status, 'seen');
    step('seen (blue ticks) + unread reset');

    const history = await api(`/conversations/${incoming.message.conversation}/messages?limit=1`, { token: A.token });
    assert.equal(history.body.messages.length, 1);
    assert.equal(history.body.hasMore, true);
    assert.equal(history.body.messages[0].text, 'Are you there?');
    step('paginated history');

    // Reply: quotes a message from the same conversation; an unknown id is ignored instead of failing
    const replyAck = await emit(sb, 'message:send', { to: A.id, type: 'text', text: 'Yes!', clientId: 'c-r1', replyTo: ack2.message._id });
    assert.equal(replyAck.message.replyTo._id, ack2.message._id);
    assert.equal(replyAck.message.replyTo.text, 'Are you there?');
    assert.equal(replyAck.message.replyTo.sender, A.id);
    const noQuote = await emit(sb, 'message:send', { to: A.id, type: 'text', text: 'Hi again', clientId: 'c-r2', replyTo: '64b000000000000000000000' });
    assert.equal(noQuote.message.replyTo, null);
    step('reply quotes the original message');

    // Media cleanup: an image older than 24h gets deleted
    await Media.create({
      uploader: A.id, type: 'image', publicId: 'chat-app/image/x', resourceType: 'image', url: 'https://x/y.jpg',
      expiresAt: new Date(Date.now() - 1000),
    });
    await Media.create({
      uploader: A.id, type: 'image', publicId: 'chat-app/image/fresh', resourceType: 'image', url: 'https://x/z.jpg',
      expiresAt: new Date(Date.now() + 3600000),
    });
    const { deleted } = await runMediaCleanup();
    assert.equal(deleted, 1);
    const old = await Media.findOne({ publicId: 'chat-app/image/x' });
    assert.equal(old.deleted, true);
    assert.equal(old.toPublic().url, null);
    step('media cleanup removes expired files only');

    // Calls: ring, ICE buffering, answer, hangup
    const callId = 'call-12345678';
    const incomingCall = once(sb, 'call:incoming');
    const offerAck = await emit(sa, 'call:offer', { to: B.id, callId, callType: 'video', sdp: { type: 'offer', sdp: 'o' } });
    assert.equal(offerAck.ok, true, offerAck.error);
    assert.equal((await incomingCall).from.name, 'Alice');
    await emit(sa, 'call:ice', { callId, candidate: { candidate: 'early' } });

    const answeredP = once(sa, 'call:answered');
    const flushedIce = once(sb, 'call:ice');
    await emit(sb, 'call:answer', { callId, sdp: { type: 'answer', sdp: 'a' } });
    assert.equal((await answeredP).sdp.type, 'answer');
    assert.equal((await flushedIce).candidate.candidate, 'early');

    const iceToA = once(sa, 'call:ice');
    await emit(sb, 'call:ice', { callId, candidate: { candidate: 'from-b' } });
    assert.equal((await iceToA).candidate.candidate, 'from-b');

    // A third user calling Bob gets "busy"
    const c = await api('/auth/register', { method: 'POST', body: { phone: '+14155550123', password: 'secret123', name: 'Carol' } });
    const sc = await open(c.body.accessToken);
    const busy = await emit(sc, 'call:offer', { to: B.id, callId: 'call-busy-0001', callType: 'audio', sdp: { type: 'offer' } });
    assert.equal(busy.busy, true);

    const endedP = once(sb, 'call:ended');
    await emit(sa, 'call:end', { callId });
    assert.equal((await endedP).reason, 'hangup');
    const log = await CallLog.findOne({ callId });
    assert.equal(log.status, 'ended');
    step('video call: offer -> ring -> ICE buffer -> answer -> busy for others -> hangup');

    // Rejected call
    const callId2 = 'call-87654321';
    const ring2 = once(sb, 'call:incoming');
    await emit(sa, 'call:offer', { to: B.id, callId: callId2, callType: 'audio', sdp: { type: 'offer' } });
    await ring2;
    const rejectedP = once(sa, 'call:ended');
    await emit(sb, 'call:reject', { callId: callId2 });
    assert.equal((await rejectedP).reason, 'rejected');
    const calls = await api('/calls', { token: B.token });
    assert.ok(calls.body.calls.some((x) => x.status === 'rejected' && x.direction === 'incoming'));
    step('voice call rejected + call history');

    // Offline presence
    const offP = once(sa, 'presence:update');
    sb.disconnect();
    const off = await offP;
    assert.deepEqual([off.userId, off.isOnline], [B.id, false]);
    step('receiver disconnects -> offline + last seen');

    // Unauthorized socket
    const bad2 = connect(base, { auth: { token: 'nope' }, transports: ['websocket'], forceNew: true });
    sockets.push(bad2);
    const err = await once(bad2, 'connect_error');
    assert.equal(err.message, 'unauthorized');
    step('socket rejects invalid JWT');

    console.log('\nAll smoke tests passed');
  } finally {
    sockets.forEach((s) => s.close());
    await new Promise((r) => setTimeout(r, 300)); // let disconnect handlers finish
    io.close();
    server.close();
    await require('mongoose').disconnect();
    await mongo.stop();
  }
})().catch((err) => {
  console.error('\nSmoke test FAILED:', err);
  process.exit(1);
});
