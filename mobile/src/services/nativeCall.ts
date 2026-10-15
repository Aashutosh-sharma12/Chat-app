/* eslint-disable @typescript-eslint/no-require-imports */
import { callsSupported } from './runtime';

// Loaded lazily: importing react-native-webrtc in Expo Go crashes because its native module is missing.
type WebRTC = typeof import('react-native-webrtc');
type InCall = typeof import('react-native-incall-manager').default;

export const webrtc: WebRTC | null = callsSupported ? require('react-native-webrtc') : null;
export const inCall: InCall | null = callsSupported ? require('react-native-incall-manager').default : null;
