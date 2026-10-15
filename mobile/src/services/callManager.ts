import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { Socket } from 'socket.io-client';
import type { MediaStream, RTCIceCandidate, RTCPeerConnection } from 'react-native-webrtc';
import { callsApi, RTCIceServerLike } from '@/api/endpoints';
import { useCall } from '@/store/call';
import { newId } from '@/utils/id';
import type { CallType, User } from '@/types';
import { emitAck, getSocket } from './socket';
import { inCall, webrtc } from './nativeCall';

// Only reached when calls are supported (development build), so the native modules exist.
const rtc = () => webrtc!;
const InCallManager = {
  start: (o: { media: 'audio' | 'video'; ringback: string }) => inCall?.start(o),
  stop: () => inCall?.stop(),
  stopRingback: () => inCall?.stopRingback(),
  startRingtone: (r: string, v: number[], c: string, s: number) => inCall?.startRingtone(r, v, c, s),
  stopRingtone: () => inCall?.stopRingtone(),
  setForceSpeakerphoneOn: (on: boolean) => inCall?.setForceSpeakerphoneOn(on),
};

type SDP = { type: string; sdp?: string };
type Candidate = { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null };

const FALLBACK_ICE: RTCIceServerLike[] = [{ urls: ['stun:stun.l.google.com:19302'] }];

let pc: RTCPeerConnection | null = null;
let pendingOffer: SDP | null = null;
let queuedIce: Candidate[] = []; // remote candidates that arrived before the remote description
// The caller's own candidates are held until the server has registered the call (offer acked);
// otherwise the server rejects them as "Call not found" and the local Wi-Fi candidates are lost.
let signalingReady = false;
let outgoingIce: Candidate[] = [];
let iceServers: RTCIceServerLike[] | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const state = () => useCall.getState();

// react-native-webrtc implements addEventListener at runtime, but its published typings omit it.
type PeerEvents = {
  icecandidate: { candidate: RTCIceCandidate | null };
  track: { streams: MediaStream[] };
  connectionstatechange: unknown;
};
function on<K extends keyof PeerEvents>(peer: RTCPeerConnection, type: K, fn: (e: PeerEvents[K]) => void) {
  (peer as unknown as { addEventListener: (t: string, f: (e: PeerEvents[K]) => void) => void }).addEventListener(type, fn);
}

const toDescription = (d: SDP) => new (rtc().RTCSessionDescription)({ type: d.type, sdp: d.sdp ?? '' });

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

async function getLocalStream(type: CallType) {
  return rtc().mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video' ? { facingMode: 'user', width: 640, height: 480, frameRate: 30 } : false,
  });
}

async function createPeer(stream: MediaStream) {
  const peer = new (rtc().RTCPeerConnection)({ iceServers: await getIceServers() });
  stream.getTracks().forEach((track) => peer.addTrack(track, stream));

  on(peer, 'icecandidate', (event) => {
    const { callId } = state();
    if (!event.candidate || !callId) return;
    const candidate = event.candidate.toJSON();
    if (signalingReady) getSocket()?.emit('call:ice', { callId, candidate });
    else outgoingIce.push(candidate);
  });

  on(peer, 'track', (event) => {
    const [remote] = event.streams;
    if (remote) state().patch({ remoteStream: remote });
  });

  on(peer, 'connectionstatechange', () => {
    const s = peer.connectionState;
    if (s === 'connected' && state().status !== 'connected') {
      InCallManager.stopRingback();
      state().patch({ status: 'connected', connectedAt: Date.now() });
    } else if (s === 'failed') {
      endCall('connection-failed');
    }
  });

  return peer;
}

async function flushIce() {
  if (!pc) return;
  const list = queuedIce;
  queuedIce = [];
  for (const c of list) await pc.addIceCandidate(new (rtc().RTCIceCandidate)(c)).catch(() => {});
}

function startAudioSession(type: CallType, ringback: boolean) {
  InCallManager.start({ media: type === 'video' ? 'video' : 'audio', ringback: ringback ? '_DTMF_' : '' });
  // Video calls default to loudspeaker, voice calls to the earpiece (like WhatsApp).
  InCallManager.setForceSpeakerphoneOn(type === 'video');
  state().patch({ speakerOn: type === 'video' });
}

function cleanup(reason: string) {
  InCallManager.stopRingtone();
  InCallManager.stopRingback();
  InCallManager.stop();
  state().localStream?.getTracks().forEach((t) => t.stop());
  pc?.close();
  pc = null;
  pendingOffer = null;
  queuedIce = [];
  outgoingIce = [];
  signalingReady = false;
  state().patch({ status: 'ended', endReason: reason, localStream: null, remoteStream: null });

  // Show the reason briefly, then leave the call screen.
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    state().reset();
    if (router.canGoBack()) router.back();
  }, 1500);
}

const isBusy = () => !['idle', 'ended'].includes(state().status);

// ---- Public API used by screens ----

const EXPO_GO_MSG = 'Voice and video calls need a development build. Chat, media and voice notes work in Expo Go.';

export async function startCall(peer: User, callType: CallType) {
  if (!webrtc) return Alert.alert('Calls unavailable in Expo Go', EXPO_GO_MSG);
  if (isBusy()) return;
  if (closeTimer) clearTimeout(closeTimer);
  const callId = newId();
  state().reset();
  signalingReady = false;
  outgoingIce = [];
  state().patch({ status: 'outgoing', callId, callType, peer });
  router.push('/call');

  try {
    const stream = await getLocalStream(callType);
    state().patch({ localStream: stream });
    pc = await createPeer(stream);
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);

    startAudioSession(callType, true);
    const res = await emitAck<{ busy: boolean }>('call:offer', {
      to: peer._id,
      callId,
      callType,
      sdp: pc.localDescription?.toJSON(),
    });
    if (!res.ok) return cleanup(res.error);
    if (res.busy) return cleanup('busy');
    signalingReady = true;
    for (const candidate of outgoingIce) getSocket()?.emit('call:ice', { callId, candidate });
    outgoingIce = [];
  } catch (err) {
    console.warn('[call] start failed', err);
    cleanup(err instanceof Error && /permission/i.test(err.message) ? 'no-permission' : 'error');
  }
}

export async function acceptCall() {
  const { callId, callType } = state();
  if (state().status !== 'incoming' || !callId || !pendingOffer) return;
  InCallManager.stopRingtone();
  state().patch({ status: 'connecting' });
  signalingReady = true; // the call already exists on the server

  try {
    const stream = await getLocalStream(callType);
    state().patch({ localStream: stream });
    pc = await createPeer(stream);
    await pc.setRemoteDescription(toDescription(pendingOffer));
    await flushIce();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    startAudioSession(callType, false);

    const res = await emitAck('call:answer', { callId, sdp: pc.localDescription?.toJSON() });
    if (!res.ok) cleanup(res.error);
  } catch (err) {
    console.warn('[call] accept failed', err);
    getSocket()?.emit('call:end', { callId });
    cleanup('error');
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

export function switchCamera() {
  state().localStream?.getVideoTracks().forEach((t: any) => t._switchCamera?.());
}

export function toggleSpeaker() {
  const speakerOn = !state().speakerOn;
  InCallManager.setForceSpeakerphoneOn(speakerOn);
  state().patch({ speakerOn });
}

// ---- Socket events ----

export const callEvents = {
  attach(socket: Socket) {
    socket.on('call:incoming', ({ callId, callType, from, sdp }: { callId: string; callType: CallType; from: User; sdp: SDP }) => {
      if (state().callId === callId) return; // re-sent after reconnect
      if (!webrtc) {
        socket.emit('call:reject', { callId });
        Alert.alert(`Missed ${callType === 'video' ? 'video' : 'voice'} call from ${from.name}`, EXPO_GO_MSG);
        return;
      }
      if (isBusy()) {
        socket.emit('call:reject', { callId });
        return;
      }
      if (closeTimer) clearTimeout(closeTimer);
      state().reset();
      pendingOffer = sdp;
      queuedIce = [];
      state().patch({ status: 'incoming', callId, callType, peer: from });
      InCallManager.startRingtone('_DEFAULT_', [0, 1000, 1000], 'playback', 45);
      router.push('/call');
    });

    socket.on('call:answered', async ({ callId, sdp }: { callId: string; sdp: SDP }) => {
      if (callId !== state().callId || !pc) return;
      InCallManager.stopRingback();
      state().patch({ status: 'connecting' });
      await pc.setRemoteDescription(toDescription(sdp));
      await flushIce();
    });

    socket.on('call:ice', async ({ callId, candidate }: { callId: string; candidate: Candidate }) => {
      if (callId !== state().callId) return;
      if (pc?.remoteDescription) await pc.addIceCandidate(new (rtc().RTCIceCandidate)(candidate)).catch(() => {});
      else queuedIce.push(candidate);
    });

    socket.on('call:ended', ({ callId, reason }: { callId: string; reason: string }) => {
      if (callId === state().callId && state().status !== 'ended') cleanup(reason);
    });

    socket.on('call:toggle', ({ callId, kind, enabled }: { callId: string; kind: 'audio' | 'video'; enabled: boolean }) => {
      if (callId !== state().callId) return;
      state().patch(kind === 'audio' ? { remoteMuted: !enabled } : { remoteCameraOff: !enabled });
    });
  },
};
