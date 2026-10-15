import { Text } from 'react-native';
import { Link } from 'expo-router';
import { AuthForm } from '@/components/AuthForm';
import { useAuth } from '@/store/auth';
import { colors } from '@/config';

export default function Login() {
  const login = useAuth((s) => s.login);
  return (
    <AuthForm
      title="Welcome back"
      subtitle="Log in with your phone number"
      fields={[
        { key: 'phone', label: 'Phone number', placeholder: '+91 98765 43210', keyboard: 'phone-pad' },
        { key: 'password', label: 'Password', placeholder: 'Your password', secure: true },
      ]}
      submitLabel="Log in"
      validate={(v) => (!v.phone?.trim() ? 'Enter your phone number' : !v.password ? 'Enter your password' : null)}
      onSubmit={(v) => login(v.phone.trim(), v.password)}
      footer={
        <Text style={{ color: colors.muted }}>
          New here?{' '}
          <Link href="/register" style={{ color: colors.primary, fontWeight: '600' }}>
            Create an account
          </Link>
        </Text>
      }
    />
  );
}
