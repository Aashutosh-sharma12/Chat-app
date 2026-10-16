import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, MessageCircle, Moon, Phone, Sun, User, Zap, ShieldCheck, Image } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useTheme } from '../components/Theme.jsx';
import { Spinner } from '../components/ui.jsx';

const FEATURES = [
  [Zap, 'Real-time messaging with typing and read receipts'],
  [Image, 'Share photos, videos and voice notes'],
  [ShieldCheck, 'Private one-to-one chats that expire automatically'],
];

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isRegister) await register(form.name, form.phone, form.password);
      else await login(form.phone, form.password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <button className="icon-btn auth-theme" onClick={toggle} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="auth-hero">
        <span className="brand-logo big">
          <MessageCircle size={32} />
        </span>
        <h1>ChatApp</h1>
        <p>Simple, fast and private messaging, now on the web.</p>
        <ul>
          {FEATURES.map(([Icon, text]) => (
            <li key={text}>
              <Icon size={18} /> {text}
            </li>
          ))}
        </ul>
        <div className="blobs" aria-hidden="true">
          <i /> <i /> <i />
        </div>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted">{isRegister ? 'Register with your phone number' : 'Sign in with your phone number'}</p>

        {isRegister && (
          <label className="field">
            <span>Name</span>
            <div className="input-wrap">
              <User size={18} />
              <input placeholder="Your name" value={form.name} onChange={set('name')} maxLength={60} required autoComplete="name" />
            </div>
          </label>
        )}

        <label className="field">
          <span>Phone number</span>
          <div className="input-wrap">
            <Phone size={18} />
            <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} required autoComplete="username" />
          </div>
        </label>

        <label className="field">
          <span>Password</span>
          <div className="input-wrap">
            <Lock size={18} />
            <input
              type={show ? 'text' : 'password'}
              placeholder={isRegister ? 'At least 6 characters' : 'Your password'}
              value={form.password}
              onChange={set('password')}
              minLength={6}
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <button type="button" className="icon-btn flat" onClick={() => setShow((s) => !s)} aria-label="Show password">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {error && <div className="form-error">{error}</div>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy && <Spinner size={16} />} {isRegister ? 'Create account' : 'Sign in'}
        </button>

        <p className="switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Register'}</Link>
        </p>
      </form>
    </div>
  );
}
