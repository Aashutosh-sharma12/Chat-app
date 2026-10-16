import { useState } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../store/auth';
import { usersApi } from '../api/client';
import { useTheme } from '../components/Theme.jsx';
import Avatar from '../components/Avatar.jsx';
import { Spinner } from '../components/ui.jsx';

export default function SettingsPanel() {
  const { user, setUser, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState(user?.name || '');
  const [about, setAbout] = useState(user?.about || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const dirty = name.trim() !== user?.name || about !== (user?.about || '');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      setUser(await usersApi.updateMe({ name: name.trim(), about }));
      setMsg({ ok: true, text: 'Profile saved' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  return (
    <>
      <header className="panel-head">
        <h2>Settings</h2>
      </header>
      <div className="settings">
        <div className="profile">
          <Avatar name={user.name} src={user.avatarUrl} size={88} />
          <strong>{user.name}</strong>
          <small>{user.phone}</small>
        </div>

        <form onSubmit={save}>
          <label className="field">
            <span>Name</span>
            <div className="input-wrap">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
            </div>
          </label>
          <label className="field">
            <span>About</span>
            <div className="input-wrap">
              <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} />
            </div>
          </label>
          {msg && <div className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</div>}
          <button className="btn btn-primary btn-block" disabled={busy || !dirty || !name.trim()}>
            {busy && <Spinner size={16} />} Save changes
          </button>
        </form>

        <div className="setting-row">
          <span>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</span>
          <button className="btn btn-ghost" onClick={toggle}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} Switch
          </button>
        </div>

        <button className="btn btn-danger-ghost btn-block" onClick={logout}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </>
  );
}
