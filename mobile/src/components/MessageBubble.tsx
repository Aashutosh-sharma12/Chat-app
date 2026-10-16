import { memo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/config';
import { myId } from '@/store/auth';
import { clockTime, replyLabel } from '@/utils/time';
import { Ticks } from './Ticks';
import { VoiceNote } from './VoiceNote';
import type { Message } from '@/types';

type Props = {
  message: Message;
  mine: boolean;
  peerName: string; // shown as the author of quoted messages that are not mine
  onRetry?: (m: Message) => void;
  onReply?: (m: Message) => void;
  onQuotePress?: (id: string) => void;
};

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

function Quote({ message, mine, peerName, onPress }: { message: Message; mine: boolean; peerName: string; onPress?: (id: string) => void }) {
  const r = message.replyTo;
  if (!r) return null;
  const mineQuote = r.sender === myId();
  return (
    <Pressable onPress={() => onPress?.(r._id)} style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]}>
      <View style={[styles.quoteBar, { backgroundColor: mineQuote ? colors.primary : '#B44CF4' }]} />
      <View style={styles.quoteBody}>
        <Text style={[styles.quoteName, { color: mineQuote ? colors.primary : '#B44CF4' }]} numberOfLines={1}>
          {mineQuote ? 'You' : peerName}
        </Text>
        <Text style={styles.quoteText} numberOfLines={2}>
          {replyLabel(r)}
        </Text>
      </View>
    </Pressable>
  );
}

function MessageBubbleImpl({ message, mine, peerName, onRetry, onReply, onQuotePress }: Props) {
  const failed = message.status === 'failed';
  const swipe = useRef<Swipeable>(null);
  const canReply = !!onReply && message.status !== 'pending' && message.status !== 'failed';

  const bubble = (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        disabled={!failed}
        onPress={() => onRetry?.(message)}
        style={[styles.bubble, mine ? styles.mine : styles.theirs, message.type !== 'text' && styles.mediaBubble]}
      >
        <Quote message={message} mine={mine} peerName={peerName} onPress={onQuotePress} />
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

  if (!canReply) return bubble;
  // Swipe right to reply; the row springs back and the composer shows the quote.
  return (
    <Swipeable
      ref={swipe}
      friction={2}
      overshootLeft={false}
      leftThreshold={48}
      renderLeftActions={() => (
        <View style={styles.swipeIcon}>
          <Ionicons name="arrow-undo" size={20} color={colors.muted} />
        </View>
      )}
      onSwipeableOpen={() => {
        onReply(message);
        swipe.current?.close();
      }}
    >
      {bubble}
    </Swipeable>
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
  quote: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', marginBottom: 4, minWidth: 120 },
  quoteMine: { backgroundColor: 'rgba(0,0,0,0.06)' },
  quoteTheirs: { backgroundColor: 'rgba(0,0,0,0.05)' },
  quoteBar: { width: 4 },
  quoteBody: { flex: 1, paddingHorizontal: 8, paddingVertical: 4 },
  quoteName: { fontSize: 13, fontWeight: '700' },
  quoteText: { fontSize: 13, color: colors.muted },
  swipeIcon: { width: 44, justifyContent: 'center', alignItems: 'center' },
  failed: { fontSize: 12, color: colors.danger, marginTop: 2 },
});
