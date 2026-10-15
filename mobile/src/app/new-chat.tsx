import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '@/api/endpoints';
import { Avatar } from '@/components/Avatar';
import { colors } from '@/config';
import type { User } from '@/types';

// Find people by phone number (or name) and open a 1-to-1 chat.
export default function NewChat() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const looksLikePhone = /^[+\d\s()-]+$/.test(q);
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const byPhone = looksLikePhone && q.replace(/\D/g, '').length >= 7 ? await usersApi.searchByPhone(q) : [];
        setResults(byPhone.length ? byPhone : await usersApi.searchByText(q));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          style={styles.input}
          autoFocus
          placeholder="Phone number or name"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator color={colors.primary} />}
      </View>
      <FlatList
        data={query.trim().length >= 2 ? results : []}
        keyExtractor={(u) => u._id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F5F6F6' }]}
            onPress={() => router.replace({ pathname: '/chat/[userId]', params: { userId: item._id, name: item.name } })}
          >
            <Avatar name={item.name} uri={item.avatarUrl} online={item.isOnline} />
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.phone}>{item.phone}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          query.trim().length >= 2 && !loading ? (
            <Text style={styles.empty}>No users found. They need to sign up with this number first.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: '#F0F2F5',
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  phone: { fontSize: 14, color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, margin: 30 },
});
