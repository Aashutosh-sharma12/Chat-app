import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { Ticks } from '@/components/Ticks';
import { useChat } from '@/store/chat';
import { usePresence } from '@/store/presence';
import { myId } from '@/store/auth';
import { colors } from '@/config';
import { listTime } from '@/utils/time';
import type { Conversation } from '@/types';

function Row({ conv }: { conv: Conversation }) {
  const presence = usePresence((s) => s.byUser[conv.user._id]);
  const typing = usePresence((s) => s.typing[conv.user._id]);
  const online = presence ? presence.isOnline : conv.user.isOnline;
  const last = conv.lastMessage;
  const mine = last?.sender === myId();

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F5F6F6' }]}
      onPress={() => router.push({ pathname: '/chat/[userId]', params: { userId: conv.user._id, name: conv.user.name } })}
    >
      <Avatar name={conv.user.name} uri={conv.user.avatarUrl} online={online} />
      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={styles.name} numberOfLines={1}>
            {conv.user.name}
          </Text>
          {last && <Text style={[styles.time, conv.unread > 0 && { color: colors.accent }]}>{listTime(last.createdAt)}</Text>}
        </View>
        <View style={styles.line}>
          <View style={styles.preview}>
            {typing ? (
              <Text style={[styles.previewText, { color: colors.accent }]}>typing...</Text>
            ) : (
              <>
                {mine && last && <Ticks status={last.status} size={15} />}
                <Text style={styles.previewText} numberOfLines={1}>
                  {last?.text}
                </Text>
              </>
            )}
          </View>
          {conv.unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{conv.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function Chats() {
  const conversations = useChat((s) => s.conversations);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      useChat.getState().loadConversations().catch(() => {});
    }, [])
  );

  const refresh = async () => {
    setRefreshing(true);
    await useChat.getState().loadConversations().catch(() => {});
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c._id}
        renderItem={({ item }) => <Row conv={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={56} color={colors.border} />
            <Text style={styles.emptyText}>No chats yet. Tap the button below to message someone by phone number.</Text>
            <Text style={styles.emptyNote}>Messages disappear after 3 days, photos and videos after 24 hours.</Text>
          </View>
        }
      />
      <Pressable style={styles.fab} onPress={() => router.push('/new-chat')}>
        <Ionicons name="chatbox-ellipses" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 14 },
  body: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingBottom: 10 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 17, fontWeight: '600', color: colors.text, flex: 1 },
  time: { fontSize: 12, color: colors.muted },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1, marginTop: 3 },
  previewText: { fontSize: 15, color: colors.muted, flexShrink: 1 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40, gap: 12, marginTop: 60 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 15 },
  emptyNote: { color: colors.muted, textAlign: 'center', fontSize: 12 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
