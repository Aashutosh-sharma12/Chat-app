import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { callsApi } from '@/api/endpoints';
import { Avatar } from '@/components/Avatar';
import { startCall } from '@/services/callManager';
import { colors } from '@/config';
import { duration, listTime } from '@/utils/time';
import type { CallLogEntry } from '@/types';

function Row({ call }: { call: CallLogEntry }) {
  const missed = call.direction === 'incoming' && ['missed', 'rejected'].includes(call.status);
  const icon = call.direction === 'incoming' ? 'arrow-down' : 'arrow-up';
  return (
    <View style={styles.row}>
      <Avatar name={call.user.name} uri={call.user.avatarUrl} size={46} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, missed && { color: colors.danger }]}>{call.user.name}</Text>
        <View style={styles.meta}>
          <Ionicons name={icon} size={14} color={missed ? colors.danger : colors.accent} style={{ transform: [{ rotate: '45deg' }] }} />
          <Text style={styles.metaText}>
            {listTime(call.createdAt)}
            {call.duration > 0 ? ` · ${duration(call.duration)}` : call.status === 'busy' ? ' · busy' : ''}
          </Text>
        </View>
      </View>
      <Pressable hitSlop={10} onPress={() => startCall(call.user, call.callType)}>
        <Ionicons name={call.callType === 'video' ? 'videocam' : 'call'} size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export default function Calls() {
  const [calls, setCalls] = useState<CallLogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setCalls(await callsApi.history());
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={calls}
      keyExtractor={(c) => c._id}
      renderItem={({ item }) => <Row call={item} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListEmptyComponent={<Text style={styles.empty}>No calls yet. Start one from a chat.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 14 },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { color: colors.muted, fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 80 },
});
