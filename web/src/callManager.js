import { callsApi } from './api/client';
import { useCall } from './store/call';
import { emitAck, getSocket } from './socket';
import { newId } from './utils/id';
import { sounds } from './sounds';

const FALLBACK_ICE = [{ urls: ['stun:stun.l.google.com:19302'] }];

let pc = null;
let pendingOffer = null;
let queuedIce = []; // remote candidates that arrived before the remote description
// The caller's own candidates are held until the server has registered the call (offer acked);
// otherwise the server rejects them as "Call not found" and the local candidates are lost.
let signalingReady = false;
let outgoingIce = [];
let iceServers = null;
let closeTimer = null;
let facing = 'user';

const state = () => useCall.getState();
const isBusy = () => !['idle', 'ended'].includes(state().status);

async function getIceServers() {
  if (!iceServers) {
    try {
      iceServers = await callsApi.iceServers();
    } catch {
      return FALLBACK_ICE;
    }
  }
  return iceServers.length ? iceServers : FALLBACK_ICE;
}

async function getLocalStream(type) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: type === 'video' ? { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } : false,
  });
}

async function createPeer(stream) {
  const peer = new RTCPeerConnection({ iceServers: await getIceServers() });
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));

  peer.addEventListener('icecandidate', (event) => {
    const { callId } = state();
    if (!event.candidate || !callId) return;
    const candidate = event.candidate.toJSON();
    if (signalingReady) getSocket()?.emit('call:ice', { callId, candidate });
    else outgoingIce.push(candidate);
  });

  peer.addEventListener('track', (event) => {
    const [remote] = event.streams;
    if (remote) state().patch({ remoteStream: remote });
  });

  peer.addEventListener('connectionstatechange', () => {
    if (peer !== pc) return;
    if (peer.connectionState === 'connected' && state().status !== 'connected') {
      sounds.stop();
      state().patch({ status: 'connected', connectedAt: Date.now() });
    } else if (peer.connectionState === 'failed') {
      endCall('connection-failed');
    }
  });

  return peer;
}

async function flushIce() {
  if (!pc) return;
  const list = queuedIce;
  queuedIce = [];
  for (const c of list) await pc.addIceCandidate(c).catch(() => {});
}

function cleanup(reason) {
  sounds.stop();
  state().localStream?.getTracks().forEach((t) => t.stop());
  pc?.close();
  pc = null;
  pendingOffer = null;
  queuedIce = [];
  outgoingIce = [];
  signalingReady = false;
  facing = 'user';
  state().patch({ status: 'ended', endReason: reason, localStream: null, remoteStream: null });

  // Show the reason briefly, then close the call screen.
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => state().reset(), 1500);
}

const failReason = (err) =>
  err?.message === 'unsupported' ? 'unsupported' : /permission|denied|notallowed/i.test(`${err?.name} ${err?.message}`) ? 'no-permission' : 'error';

export async function startCall(peer, callType) {
  if (isBusy()) return;
  clearTimeout(closeTimer);
  const callId = newId();
  state().reset();
  signalingReady = false;
  outgoingIce = [];
  state().patch({ status: 'outgoing', callId, callType, peer });

  try {
    const stream = await getLocalStream(callType);
    state().patch({ localStream: stream });
    pc = await createPeer(stream);
    await pc.setLocalDescription(await pc.createOffer());

    sounds.ringback();
    const res = await emitAck('call:offer', { to: peer._id, callId, callType, sdp: pc.localDescription.toJSON() });
    if (!res.ok) return cleanup(res.error);
    if (res.busy) return cleanup('busy');
    signalingReady = true;
    for (const candidate of outgoingIce) getSocket()?.emit('call:ice', { callId, candidate });
    outgoingIce = [];
  } catch (err) {
    console.warn('[call] start failed', err);
    cleanup(failReason(err));
  }
}

export async function acceptCall() {
  const { callId, callType } = state();
  if (state().status !== 'incoming' || !callId || !pendingOffer) return;
  sounds.stop();
  state().patch({ status: 'connecting' });
  signalingReady = true; // the call already exists on the server

  try {
    const stream = await getLocalStream(callType);
    state().patch({ localStream: stream });
    pc = await createPeer(stream);
    await pc.setRemoteDescription(pendingOffer);
    await flushIce();
    await pc.setLocalDescription(await pc.createAnswer());

    const res = await emitAck('call:answer', { callId, sdp: pc.localDescription.toJSON() });
    if (!res.ok) cleanup(res.error);
  } catch (err) {
    console.warn('[call] accept failed', err);
    getSocket()?.emit('call:end', { callId });
    cleanup(failReason(err));
  }
}

export function rejectCall() {
  const { callId } = state();
  if (callId) getSocket()?.emit('call:reject', { callId });
  cleanup('rejected');
}

export function endCall(reason = 'hangup') {
  const { callId } = state();
  if (callId) getSocket()?.emit('call:end', { callId });
  cleanup(reason);
}

// Used when the user signs out mid-call.
export function hangupIfActive() {
  if (isBusy()) endCall();
}

export function toggleMute() {
  const muted = !state().muted;
  state().localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  state().patch({ muted });
  getSocket()?.emit('call:toggle', { callId: state().callId, kind: 'audio', enabled: !muted });
}

export function toggleCamera() {
  const cameraOff = !state().cameraOff;
  state().localStream?.getVideoTracks().forEach((t) => (t.enabled = !cameraOff));
  state().patch({ cameraOff });
  getSocket()?.emit('call:toggle', { callId: state().callId, kind: 'video', enabled: !cameraOff });
}

// Swaps between front and back cameras by replacing the outgoing video track.
export async function switchCamera() {
  const { localStream } = state();
  const sender = pc?.getSenders().find((s) => s.track?.kind === 'video');
  if (!localStream || !sender) return;
  const next = facing === 'user' ? 'environment' : 'user';
  try {
    const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next } });
    const [track] = fresh.getVideoTracks();
    track.enabled = !state().cameraOff;
    await sender.replaceTrack(track);
    localStream.getVideoTracks().forEach((t) => {
      t.stop();
      localStream.removeTrack(t);
    });
    localStream.addTrack(track);
    facing = next;
    state().patch({ localStream: new MediaStream(localStream.getTracks()) });
  } catch {
    /* only one camera available */
  }
}

export const callEvents = {
  attach(socket) {
    socket.on('call:incoming', ({ callId, callType, from, sdp }) => {
      if (state().callId === callId) return; // re-sent after reconnect
      if (isBusy() || !window.RTCPeerConnection) {
        socket.emit('call:reject', { callId });
        return;
      }
      clearTimeout(closeTimer);
      state().reset();
      pendingOffer = sdp;
      queuedIce = [];
      state().patch({ status: 'incoming', callId, callType, peer: from });
      sounds.ring();
      if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(`Incoming ${callType} call`, { body: from.name, tag: callId, requireInteraction: true });
        n.onclick = () => window.focus();
      }
    });

    socket.on('call:answered', async ({ callId, sdp }) => {
      if (callId !== state().callId || !pc) return;
      sounds.stop();
      state().patch({ status: 'connecting' });
      await pc.setRemoteDescription(sdp);
      await flushIce();
    });

    socket.on('call:ice', async ({ callId, candidate }) => {
      if (callId !== state().callId) return;
      if (pc?.remoteDescription) await pc.addIceCandidate(candidate).catch(() => {});
      else queuedIce.push(candidate);
    });

    socket.on('call:ended', ({ callId, reason }) => {
      if (callId === state().callId && state().status !== 'ended') cleanup(reason);
    });

    socket.on('call:toggle', ({ callId, kind, enabled }) => {
      if (callId !== state().callId) return;
      state().patch(kind === 'audio' ? { remoteMuted: !enabled } : { remoteCameraOff: !enabled });
    });
  },
};
