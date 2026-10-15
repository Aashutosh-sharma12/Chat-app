import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/config';
import { errorMessage } from '@/api/client';

type Field = { key: string; label: string; placeholder: string; secure?: boolean; keyboard?: 'phone-pad' | 'default' };

type Props = {
  title: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  validate: (values: Record<string, string>) => string | null;
  footer: React.ReactNode;
};

export function AuthForm({ title, subtitle, fields, submitLabel, onSubmit, validate, footer }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  async function submit() {
    const problem = validate(values);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Ionicons name="chatbubbles" size={44} color="#fff" />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {fields.map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={f.placeholder}
                placeholderTextColor={colors.muted}
                secureTextEntry={f.secure && !visible[f.key]}
                keyboardType={f.keyboard || 'default'}
                autoCapitalize={f.key === 'name' ? 'words' : 'none'}
                autoCorrect={false}
                autoComplete={f.secure ? 'password' : f.keyboard === 'phone-pad' ? 'tel' : 'name'}
                value={values[f.key] || ''}
                onChangeText={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                onSubmitEditing={submit}
              />
              {f.secure && (
                <Pressable
                  onPress={() => setVisible((s) => ({ ...s, [f.key]: !s[f.key] }))}
                  hitSlop={10}
                  style={styles.eye}
                  accessibilityRole="button"
                  accessibilityLabel={visible[f.key] ? 'Hide password' : 'Show password'}
                >
                  <Ionicons name={visible[f.key] ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
                </Pressable>
              )}
            </View>
          </View>
        ))}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.button, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{submitLabel}</Text>}
        </Pressable>

        <View style={styles.footer}>{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', color: colors.text },
  subtitle: { fontSize: 15, textAlign: 'center', color: colors.muted, marginTop: 6, marginBottom: 28 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text },
  eye: { paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 24, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 24, alignItems: 'center' },
});
