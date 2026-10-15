import Constants, { ExecutionEnvironment } from 'expo-constants';

// Expo Go only ships Expo's own native modules: no WebRTC, and no remote push on Android.
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const callsSupported = !isExpoGo;
export const pushSupported = !isExpoGo;
