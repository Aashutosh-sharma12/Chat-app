import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/config';
import { clockTime } from '@/utils/time';
import { Ticks } from './Ticks';
import { VoiceNote } from './VoiceNote';
import type { Message } from '@/types';

type Props = { message: Message; mine: boolean; onRetry?: (m: Message) => void };

const EXPIRED_LABEL = { image: 'Photo expired', video: 'Video expired', audio: 'Voice message expired' };

function MediaContent({ message }: { message: Message }) {
  const { type, media, localUri, status } = message;
  if (type === 'text') return null;

  if (media?.deleted) {
    return (
      <View style={styles.expired}>
        <Ionicons name="time-outline" size={16} color={colors.muted} />
        <Text style={styles.expiredText}>{EXPIRED_LABEL[type]}</Text>
      </View>
    );
  }

  const uri = media?.url || localUri;
  if (!uri) return null;
  const uploading = status === 'pending';

  if (type === 'audio') {
    return (
      <View>
        <VoiceNote uri={uri} knownDuration={media?.duration} />
        {uploading && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.primary} />}
      </View>
    );
  }

  const ratio = media?.width && media?.height ? media.width / media.height : 4 / 3;
  const preview = type === 'video' ? media?.thumbnailUrl || undefined : uri;

  return (
    <Pressable
      disabled={uploading || !media?.url}
      onPress={() => router.push({ pathname: '/media-viewer', params: { uri: media!.url!, type } })}
    >
      <View style={[styles.media, { aspectRatio: Math.max(0.6, Math.min(ratio, 1.6)) }]}>
        {preview ? (
          <Image source={preview} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]} />
        )}
        {type === 'video' && !uploading && (
          <View style={styles.play}>
            <Ionicons name="play" size={28} color="#fff" />
          </View>
        )}
        {uploading && <ActivityIndicator size="large" color="#fff" />}
      </View>
    </Pressable>
  );
}

function MessageBubbleImpl({ message, mine, onRetry }: Props) {
  const failed = message.status === 'failed';
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        disabled={!failed}
        onPress={() => onRetry?.(message)}
        style={[styles.bubble, mine ? styles.mine : styles.theirs, message.type !== 'text' && styles.mediaBubble]}
      >
        <MediaContent message={message} />
        {!!message.text && <Text style={styles.text}>{message.text}</Text>}
        <View style={styles.meta}>
          <Text style={styles.time}>{clockTime(message.createdAt)}</Text>
          {mine && <Ticks status={message.status} />}
        </View>
      </Pressable>
      {failed && <Text style={styles.failed}>Not sent. Tap to retry.</Text>}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

const styles = StyleSheet.create({
  row: { paddingHorizontal: 10, marginVertical: 2 },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 10, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 4, elevation: 1 },
  mediaBubble: { padding: 4, width: 260 },
  mine: { backgroundColor: colors.bubbleMine, borderTopRightRadius: 2 },
  theirs: { backgroundColor: colors.bubbleTheirs, borderTopLeftRadius: 2 },
  text: { fontSize: 16, color: colors.text, paddingHorizontal: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 3, marginTop: 2, paddingHorizontal: 2 },
  time: { fontSize: 11, color: colors.muted },
  media: { width: '100%', borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ccc' },
  videoPlaceholder: { backgroundColor: '#333' },
  play: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  expired: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10 },
  expiredText: { color: colors.muted, fontStyle: 'italic' },
  failed: { fontSize: 12, color: colors.danger, marginTop: 2 },
});
