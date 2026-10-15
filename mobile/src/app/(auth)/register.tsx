import { Text } from 'react-native';
import { Link } from 'expo-router';
import { AuthForm } from '@/components/AuthForm';
import { useAuth } from '@/store/auth';
import { colors } from '@/config';

export default function Register() {
  const register = useAuth((s) => s.register);
  return (
    <AuthForm
      title="Create account"
      subtitle="Sign up with your phone number and a password"
      fields={[
        { key: 'name', label: 'Your name', placeholder: 'Name shown to others' },
        { key: 'phone', label: 'Phone number', placeholder: '+91 98765 43210', keyboard: 'phone-pad' },
        { key: 'password', label: 'Password', placeholder: 'At least 6 characters', secure: true },
        { key: 'confirm', label: 'Confirm password', placeholder: 'Repeat password', secure: true },
      ]}
      submitLabel="Sign up"
      validate={(v) => {
        if (!v.name?.trim()) return 'Enter your name';
        if (!v.phone?.trim()) return 'Enter your phone number';
        if (!v.password || v.password.length < 6) return 'Password must be at least 6 characters';
        if (v.password !== v.confirm) return 'Passwords do not match';
        return null;
      }}
      onSubmit={(v) => register(v.name.trim(), v.phone.trim(), v.password)}
      footer={
        <Text style={{ color: colors.muted }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: colors.primary, fontWeight: '600' }}>
            Log in
          </Link>
        </Text>
      }
    />
  );
}
