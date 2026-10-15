import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { useCall } from '@/store/call';
import {
  acceptCall,
  endCall,
  rejectCall,
  switchCamera,
  toggleCamera,
  toggleMute,
  toggleSpeaker,
} from '@/services/callManager';
import { colors } from '@/config';
import { webrtc } from '@/services/nativeCall';
import { duration } from '@/utils/time';

const END_REASONS: Record<string, string> = {
  busy: 'User is busy',
  rejected: 'Call declined',
  'no-answer': 'No answer',
  cancelled: 'Call cancelled',
  hangup: 'Call ended',
  disconnected: 'Connection lost',
  'connection-failed': 'Connection failed',
  'answered-elsewhere': 'Answered on another device',
  'no-permission': 'Camera/microphone permission denied',
};

function Timer({ since }: { since: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((Date.now() - since) / 1000), 1000);
    return () => clearInterval(t);
  }, [since]);
  return <Text style={styles.status}>{duration(elapsed)}</Text>;
}

function RoundButton({ icon, onPress, active, color }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; active?: boolean; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.round, { backgroundColor: color || (active ? '#fff' : 'rgba(255,255,255,0.18)') }]}
    >
      <Ionicons name={icon} size={28} color={active && !color ? '#111' : '#fff'} />
    </Pressable>
  );
}

export default function CallScreen() {
  const RTCView = webrtc?.RTCView;
  const insets = useSafeAreaInsets();
  const s = useCall();
  const isVideo = s.callType === 'video';

  // Opened without an active call (e.g. stale navigation): just leave.
  useEffect(() => {
    if (s.status === 'idle' && router.canGoBack()) router.back();
  }, [s.status]);

  if (!s.peer) return <View style={styles.container} />;

  const statusText =
    s.status === 'outgoing'
      ? 'Ringing...'
      : s.status === 'incoming'
        ? `Incoming ${isVideo ? 'video' : 'voice'} call`
        : s.status === 'connecting'
          ? 'Connecting...'
          : s.status === 'ended'
            ? END_REASONS[s.endReason || ''] || 'Call ended'
            : null;

  const showRemoteVideo = isVideo && s.remoteStream && s.status === 'connected' && !s.remoteCameraOff;

  return (
    <View style={styles.container}>
      {!RTCView ? null : showRemoteVideo ? (
        <RTCView streamURL={s.remoteStream!.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : isVideo && s.localStream && !s.cameraOff && s.status !== 'connected' ? (
        <RTCView streamURL={s.localStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror />
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + 40 }]}>
        {!showRemoteVideo && <Avatar name={s.peer.name} uri={s.peer.avatarUrl} size={110} />}
        <Text style={styles.name}>{s.peer.name}</Text>
        {statusText ? <Text style={styles.status}>{statusText}</Text> : s.connectedAt ? <Timer since={s.connectedAt} /> : null}
        {s.status === 'connected' && s.remoteMuted && <Text style={styles.hint}>{s.peer.name} muted their microphone</Text>}
        {s.status === 'connected' && isVideo && s.remoteCameraOff && <Text style={styles.hint}>Camera is off</Text>}
      </View>

      {RTCView && isVideo && s.localStream && s.status === 'connected' && !s.cameraOff && (
        <RTCView
          streamURL={s.localStream.toURL()}
          style={[styles.pip, { top: insets.top + 16 }]}
          objectFit="cover"
          mirror
          zOrder={1}
        />
      )}

      <View style={[styles.controls, { paddingBottom: insets.bottom + 30 }]}>
        {s.status === 'incoming' ? (
          <View style={styles.row}>
            <View style={styles.labelled}>
              <RoundButton icon="close" color={colors.danger} onPress={rejectCall} />
              <Text style={styles.label}>Decline</Text>
            </View>
            <View style={styles.labelled}>
              <RoundButton icon={isVideo ? 'videocam' : 'call'} color={colors.accent} onPress={acceptCall} />
              <Text style={styles.label}>Accept</Text>
            </View>
          </View>
        ) : s.status !== 'ended' ? (
          <View style={styles.row}>
            {isVideo && <RoundButton icon="camera-reverse-outline" onPress={switchCamera} />}
            {isVideo && <RoundButton icon={s.cameraOff ? 'videocam-off' : 'videocam'} active={s.cameraOff} onPress={toggleCamera} />}
            {!isVideo && <RoundButton icon="volume-high" active={s.speakerOn} onPress={toggleSpeaker} />}
            <RoundButton icon={s.muted ? 'mic-off' : 'mic'} active={s.muted} onPress={toggleMute} />
            <RoundButton icon="call" color={colors.danger} onPress={() => endCall()} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B141A' },
  top: { alignItems: 'center', gap: 10 },
  name: { color: '#fff', fontSize: 28, fontWeight: '600', marginTop: 12, textShadowColor: '#0008', textShadowRadius: 4 },
  status: { color: '#D1D7DB', fontSize: 16, textShadowColor: '#0008', textShadowRadius: 4 },
  hint: { color: '#D1D7DB', fontSize: 14 },
  pip: { position: 'absolute', right: 16, width: 110, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#222' },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', paddingHorizontal: 20 },
  round: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  labelled: { alignItems: 'center', gap: 8 },
  label: { color: '#fff', fontSize: 14 },
});
