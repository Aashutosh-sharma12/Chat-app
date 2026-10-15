import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors } from '@/config';
import { duration } from '@/utils/time';

export function VoiceNote({ uri, knownDuration }: { uri: string; knownDuration?: number }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = status.duration || knownDuration || 0;
  const progress = total ? Math.min(1, status.currentTime / total) : 0;

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  return (
    <View style={styles.row}>
      <Pressable hitSlop={8} onPress={() => (status.playing ? player.pause() : player.play())}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={28} color={colors.muted} />
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        <View style={[styles.knob, { left: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.time}>{duration(status.playing || status.currentTime > 0 ? status.currentTime : total)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', width: 220, gap: 8, paddingVertical: 4 },
  track: { flex: 1, height: 3, backgroundColor: '#C8CDD0', borderRadius: 2, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  knob: { position: 'absolute', width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: colors.primary },
  time: { fontSize: 12, color: colors.muted, minWidth: 34 },
});
