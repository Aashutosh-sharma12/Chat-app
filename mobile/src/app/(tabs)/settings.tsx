import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { authApi, usersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/store/auth';
import { getPushToken } from '@/services/pushToken';
import { colors } from '@/config';

export default function Settings() {
  const user = useAuth((s) => s.user)!;
  const [name, setName] = useState(user.name);
  const [about, setAbout] = useState(user.about || '');
  const dirty = name.trim() !== user.name || about.trim() !== (user.about || '');

  async function save() {
    try {
      const updated = await usersApi.updateMe({ name: name.trim(), about: about.trim() });
      useAuth.getState().setUser(updated);
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
    }
  }

  function logout() {
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await authApi.logout(getPushToken()).catch(() => {});
          await useAuth.getState().signOutLocal();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar name={user.name} uri={user.avatarUrl} size={72} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.phone}>{user.phone}</Text>
        </View>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={60} />
      <Text style={styles.label}>About</Text>
      <TextInput style={styles.input} value={about} onChangeText={setAbout} maxLength={140} />
      {dirty && (
        <Pressable style={styles.save} onPress={save}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      )}

      <Text style={styles.note}>Messages are deleted after 3 days. Photos and videos are deleted after 24 hours.</Text>

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  name: { fontSize: 20, fontWeight: '600', color: colors.text },
  phone: { fontSize: 15, color: colors.muted, marginTop: 2 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, marginTop: 10 },
  input: { borderBottomWidth: 1, borderColor: colors.border, fontSize: 16, paddingVertical: 8, color: colors.text },
  save: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 8, marginTop: 14 },
  saveText: { color: '#fff', fontWeight: '600' },
  note: { color: colors.muted, fontSize: 13, marginTop: 30 },
  logout: { marginTop: 'auto', paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
