import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/config';

const PALETTE = ['#00A884', '#53BDEB', '#FF7F50', '#A78BFA', '#F59E0B', '#EC4899'];

export function Avatar({ name, uri, size = 48, online }: { name: string; uri?: string | null; size?: number; online?: boolean }) {
  const color = PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={uri} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
          <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
      )}
      {online && <View style={[styles.dot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '600' },
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.accent, borderWidth: 2, borderColor: '#fff' },
});
