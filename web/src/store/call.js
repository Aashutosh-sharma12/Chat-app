import { create } from 'zustand';

// status: idle | outgoing | incoming | connecting | connected | ended
const initial = {
  status: 'idle',
  callId: null,
  callType: 'audio',
  peer: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
  remoteMuted: false,
  remoteCameraOff: false,
  connectedAt: null,
  endReason: null,
};

export const useCall = create((set) => ({
  ...initial,
  patch: (p) => set(p),
  reset: () => set(initial),
}));
