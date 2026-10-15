const mongoose = require('mongoose');
const CallLog = require('../models/CallLog');
const ApiError = require('../utils/ApiError');
const registry = require('./registry');
const { sendPush } = require('../services/push');

const RING_TIMEOUT_MS = 45 * 1000;
const MAX_BUFFERED_ICE = 100;

// In-memory call state (single process).
const calls = new Map(); // callId -> call
const userCall = new Map(); // userId -> callId

const io = () => registry.getIO();

// Sends to a specific socket when we know which device is in the call, otherwise to all of the user's devices.
function sendTo(userId, socketId, event, payload) {
  if (socketId) io().to(socketId).emit(event, payload);
  else registry.emitToUser(userId, event, payload);
}

function getCall(callId, userId) {
  const c = calls.get(callId);
  if (!c || (c.caller !== userId && c.callee !== userId)) throw new ApiError(404, 'Call not found');
  return c;
}

async function finish(c, status, reason, notify) {
  if (!calls.has(c.callId)) return;
  clearTimeout(c.timer);
  calls.delete(c.callId);
  if (userCall.get(c.caller) === c.callId) userCall.delete(c.caller);
  if (userCall.get(c.callee) === c.callId) userCall.delete(c.callee);

  const endedAt = new Date();
  const duration = c.answeredAt ? Math.round((endedAt - c.answeredAt) / 1000) : 0;
  const payload = { callId: c.callId, reason, duration };

  if (notify.includes('caller')) sendTo(c.caller, c.callerSocket, 'call:ended', payload);
  if (notify.includes('callee')) sendTo(c.callee, c.calleeSocket, 'call:ended', payload);

  try {
    await CallLog.updateOne({ callId: c.callId }, { status, endedAt, duration });
  } catch (err) {
    console.error('[call] log update', err.message);
  }

  if (status === 'missed') {
    sendPush(c.callee, {
      title: 'Missed call',
      body: `${c.callerInfo.name} (${c.callType === 'video' ? 'video' : 'voice'} call)`,
      data: { kind: 'missed-call', userId: c.caller },
      channelId: 'calls',
    }).catch(() => {});
  }
}

function incomingPayload(c) {
  return { callId: c.callId, callType: c.callType, from: c.callerInfo, sdp: c.offer };
}

function register(socket) {
  const { handler } = require('./index');
  const me = socket.userId;

  // Caller starts a call. Payload: { to, callId, callType: 'audio' | 'video', sdp }
  socket.on(
    'call:offer',
    handler(async ({ to, callId, callType, sdp }) => {
      if (!mongoose.isValidObjectId(to) || to === me) throw new ApiError(400, 'Invalid callee');
      if (typeof callId !== 'string' || callId.length < 8 || callId.length > 64 || calls.has(callId)) {
        throw new ApiError(400, 'Invalid call id');
      }
      if (!['audio', 'video'].includes(callType)) throw new ApiError(400, 'Invalid call type');
      if (!sdp) throw new ApiError(400, 'Missing offer');
      if (userCall.has(me)) throw new ApiError(409, 'You are already in a call');

      if (userCall.has(to)) {
        await CallLog.create({ callId, caller: me, callee: to, callType, status: 'busy', endedAt: new Date() });
        return { busy: true };
      }

      const c = {
        callId,
        caller: me,
        callee: to,
        callType,
        offer: sdp,
        callerSocket: socket.id,
        calleeSocket: null,
        callerInfo: socket.user.toPublic(),
        pendingIce: [],
        answeredAt: null,
      };
      c.timer = setTimeout(() => finish(c, 'missed', 'no-answer', ['caller', 'callee']), RING_TIMEOUT_MS);
      calls.set(callId, c);
      userCall.set(me, callId);
      userCall.set(to, callId);
      await CallLog.create({ callId, caller: me, callee: to, callType });

      registry.emitToUser(to, 'call:incoming', incomingPayload(c));
      if (!registry.isOnline(to)) {
        sendPush(to, {
          title: `Incoming ${callType === 'video' ? 'video' : 'voice'} call`,
          body: c.callerInfo.name,
          data: { kind: 'call', callId, callType, userId: me, name: c.callerInfo.name },
          channelId: 'calls',
          ttl: RING_TIMEOUT_MS / 1000,
        }).catch(() => {});
      }
      return { busy: false, calleeOnline: registry.isOnline(to) };
    })
  );

  // Callee accepts. Payload: { callId, sdp }
  socket.on(
    'call:answer',
    handler(async ({ callId, sdp }) => {
      const c = getCall(callId, me);
      if (c.callee !== me || c.answeredAt) throw new ApiError(409, 'Call cannot be answered');
      clearTimeout(c.timer);
      c.answeredAt = new Date();
      c.calleeSocket = socket.id;
      await CallLog.updateOne({ callId }, { status: 'answered', answeredAt: c.answeredAt });

      io().to(c.callerSocket).emit('call:answered', { callId, sdp });
      // Caller ICE candidates gathered while ringing are delivered now that the callee has the offer applied.
      for (const candidate of c.pendingIce) io().to(socket.id).emit('call:ice', { callId, candidate });
      c.pendingIce = [];
      // Stop ringing on the callee's other devices.
      socket.to(registry.userRoom(me)).emit('call:ended', { callId, reason: 'answered-elsewhere', duration: 0 });
    })
  );

  // Payload: { callId, candidate }
  socket.on(
    'call:ice',
    handler(async ({ callId, candidate }) => {
      const c = getCall(callId, me);
      if (!candidate) return;
      if (me === c.caller) {
        if (c.calleeSocket) io().to(c.calleeSocket).emit('call:ice', { callId, candidate });
        else if (c.pendingIce.length < MAX_BUFFERED_ICE) c.pendingIce.push(candidate);
      } else {
        io().to(c.callerSocket).emit('call:ice', { callId, candidate });
      }
    })
  );

  socket.on(
    'call:reject',
    handler(async ({ callId }) => {
      const c = getCall(callId, me);
      if (c.callee !== me || c.answeredAt) throw new ApiError(409, 'Call cannot be rejected');
      await finish(c, 'rejected', 'rejected', ['caller', 'callee']);
    })
  );

  socket.on(
    'call:end',
    handler(async ({ callId }) => {
      const c = calls.get(callId);
      if (!c || (c.caller !== me && c.callee !== me)) return; // already ended
      if (!c.answeredAt) await finish(c, 'missed', 'cancelled', ['callee']);
      else await finish(c, 'ended', 'hangup', [me === c.caller ? 'callee' : 'caller']);
    })
  );

  // Mute / camera off indicator for the other side. Payload: { callId, kind: 'audio' | 'video', enabled }
  socket.on(
    'call:toggle',
    handler(async ({ callId, kind, enabled }) => {
      const c = getCall(callId, me);
      const other = me === c.caller ? [c.callee, c.calleeSocket] : [c.caller, c.callerSocket];
      sendTo(other[0], other[1], 'call:toggle', { callId, kind, enabled: Boolean(enabled) });
    })
  );
}

// A callee who opens the app from the push notification still gets the ringing call.
function onConnect(socket) {
  const callId = userCall.get(socket.userId);
  const c = callId && calls.get(callId);
  if (c && c.callee === socket.userId && !c.answeredAt) socket.emit('call:incoming', incomingPayload(c));
}

function onUserOffline(userId) {
  const callId = userCall.get(userId);
  const c = callId && calls.get(callId);
  if (!c) return;
  // A ringing callee who simply has no app open must not cancel the call; the push can still bring them in.
  if (!c.answeredAt && userId === c.callee) return;
  const status = c.answeredAt ? 'ended' : 'missed';
  finish(c, status, 'disconnected', [userId === c.caller ? 'callee' : 'caller']);
}

module.exports = { register, onConnect, onUserOffline };
