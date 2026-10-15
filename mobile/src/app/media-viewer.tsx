import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />;
}

export default function MediaViewer() {
  const { uri, type } = useLocalSearchParams<{ uri: string; type: 'image' | 'video' }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {type === 'video' ? (
        <VideoPlayer uri={uri} />
      ) : (
        <Image source={uri} style={StyleSheet.absoluteFill} contentFit="contain" />
      )}
      <Pressable style={[styles.close, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="close" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', left: 16 },
});
