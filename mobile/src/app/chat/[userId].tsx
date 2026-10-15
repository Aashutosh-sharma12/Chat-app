import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { usersApi } from '@/api/endpoints';
import { Avatar } from '@/components/Avatar';
import { Composer } from '@/components/Composer';
import { MessageBubble } from '@/components/MessageBubble';
import { useChat } from '@/store/chat';
import { usePresence } from '@/store/presence';
import { myId } from '@/store/auth';
import { fetchPresence, markActiveSeen, notifyTyping, stopTyping } from '@/services/socket';
import { retry, sendMedia, sendText } from '@/services/messaging';
import { startCall } from '@/services/callManager';
import { colors } from '@/config';
import { dayLabel, lastSeenText } from '@/utils/time';
import type { Message, User } from '@/types';

const EMPTY: Message[] = [];

// Current time, refreshed every minute (0 until the first tick, which filters nothing).
function useMinuteClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return now;
}

function HeaderTitle({ user, fallbackName }: { user: User | null; fallbackName: string }) {
  const presence = usePresence((s) => (user ? s.byUser[user._id] : undefined));
  const typing = usePresence((s) => (user ? s.typing[user._id] : false));
  const status = typing
    ? 'typing...'
    : presence?.isOnline
      ? 'online'
      : lastSeenText(presence?.lastSeen ?? user?.lastSeen ?? null);

  return (
    <View style={styles.headerTitle}>
      <Avatar name={user?.name || fallbackName || '?'} uri={user?.avatarUrl} size={36} />
      <View>
        <Text style={styles.headerName} numberOfLines={1}>
          {user?.name || fallbackName}
        </Text>
        {!!status && <Text style={styles.headerStatus}>{status}</Text>}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useChat((s) => s.convByUser[userId]);
  const messages = useChat((s) => (conversationId ? s.messages[conversationId] : undefined) ?? EMPTY);
  const hasMore = useChat((s) => (conversationId ? s.hasMore[conversationId] : false));
  const [loadingMore, setLoadingMore] = useState(false);

  // Open (or create) the 1-to-1 conversation and load the latest page.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [u, conv] = await Promise.all([usersApi.get(userId), useChat.getState().openWithUser(userId)]);
        if (!active) return;
        setUser(u);
        usePresence.getState().set(u._id, { isOnline: u.isOnline, lastSeen: u.lastSeen });
        useChat.getState().setActive(conv._id);
        await useChat.getState().loadMessages(conv._id);
        markActiveSeen();
        fetchPresence(u._id);
      } catch {
        if (active) setError('Could not open this chat. Check your connection.');
      }
    })();
    return () => {
      active = false;
      useChat.getState().setActive(null);
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      if (conversationId) stopTyping(userId, conversationId);
    };
  }, [userId, conversationId]);

  // Hide anything past its 3-day expiry even before the server sweep removes it.
  const now = useMinuteClock();
  const visible = useMemo(() => messages.filter((m) => new Date(m.expiresAt).getTime() > now), [messages, now]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    await useChat.getState().loadMessages(conversationId, true).catch(() => {});
    setLoadingMore(false);
  }, [conversationId, hasMore, loadingMore]);

  const me = myId();

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      // List is inverted: the next item is the older one, so a day header goes above when the day changes.
      const older = visible[index + 1];
      const showDay = !older || !dayjs(older.createdAt).isSame(item.createdAt, 'day');
      return (
        <View>
          {showDay && (
            <View style={styles.dayChip}>
              <Text style={styles.dayText}>{dayLabel(item.createdAt)}</Text>
            </View>
          )}
          <MessageBubble message={item} mine={item.sender === me} onRetry={retry} />
        </View>
      );
    },
    [visible, me]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.chatBg }}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitle user={user} fallbackName={name || ''} />,
          headerRight: () =>
            user ? (
              <View style={styles.headerActions}>
                <Pressable hitSlop={10} onPress={() => startCall(user, 'video')}>
                  <Ionicons name="videocam" size={24} color="#fff" />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => startCall(user, 'audio')}>
                  <Ionicons name="call" size={22} color="#fff" />
                </Pressable>
              </View>
            ) : null,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !conversationId ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
        ) : (
          <FlatList
            inverted
            data={visible}
            keyExtractor={(m) => m.clientId || m._id}
            renderItem={renderItem}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: 12 }} /> : null}
            ListEmptyComponent={
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  🔒 Messages disappear after 3 days. Photos and videos disappear after 24 hours.
                </Text>
              </View>
            }
          />
        )}
        <View style={{ paddingBottom: insets.bottom }}>
          {conversationId && (
            <Composer
              onTyping={() => notifyTyping(userId, conversationId)}
              onSendText={(t) => {
                stopTyping(userId, conversationId);
                sendText(userId, conversationId, t);
              }}
              onSendMedia={(type, uri, mime, fileName, durationSec) =>
                sendMedia(userId, conversationId, type, uri, mime, { fileName, duration: durationSec })
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: -10 },
  headerName: { color: '#fff', fontSize: 17, fontWeight: '600', maxWidth: 170 },
  headerStatus: { color: '#E0F2EF', fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 22, marginRight: 4 },
  dayChip: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 8 },
  dayText: { fontSize: 12, color: colors.muted },
  notice: { alignSelf: 'center', backgroundColor: '#FFEECD', borderRadius: 8, padding: 10, margin: 20, transform: [{ scaleY: -1 }] },
  noticeText: { fontSize: 13, color: '#54656F', textAlign: 'center' },
  error: { flex: 1, textAlign: 'center', marginTop: 60, color: colors.muted },
});
