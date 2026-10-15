import { create } from 'zustand';
import type { MediaStream } from 'react-native-webrtc';
import type { CallType, User } from '@/types';

export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended';

type CallState = {
  status: CallStatus;
  callId: string | null;
  callType: CallType;
  peer: User | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  speakerOn: boolean;
  remoteMuted: boolean;
  remoteCameraOff: boolean;
  connectedAt: number | null;
  endReason: string | null;
  patch: (p: Partial<CallState>) => void;
  reset: () => void;
};

const initial = {
  status: 'idle' as CallStatus,
  callId: null,
  callType: 'audio' as CallType,
  peer: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
  speakerOn: false,
  remoteMuted: false,
  remoteCameraOff: false,
  connectedAt: null,
  endReason: null,
};

export const useCall = create<CallState>((set) => ({
  ...initial,
  patch: (p) => set(p),
  reset: () => set(initial),
}));
