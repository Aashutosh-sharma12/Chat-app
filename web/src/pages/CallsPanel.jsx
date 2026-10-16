import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Phone, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { callsApi } from '../api/client';
import { startCall } from '../callManager';
import { useCall } from '../store/call';
import Avatar from '../components/Avatar.jsx';
import { ListSkeleton } from '../components/ui.jsx';
import { dayLabel, clock, duration } from '../utils/format';

export default function CallsPanel() {
  const [calls, setCalls] = useState(null);
  const [error, setError] = useState('');
  const busy = useCall((s) => s.status !== 'idle');

  useEffect(() => {
    callsApi.history().then(setCalls).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <header className="panel-head">
        <h2>Calls</h2>
      </header>
      <p className="panel-note">Tap the icon next to a call to call that person back.</p>
      <div className="list">
        {error ? (
          <div className="form-error">{error}</div>
        ) : !calls ? (
          <ListSkeleton />
        ) : calls.length === 0 ? (
          <p className="empty">No calls yet</p>
        ) : (
          calls.map((c) => {
            const bad = c.status === 'missed' || c.status === 'rejected';
            const Dir = c.direction === 'incoming' ? ArrowDownLeft : ArrowUpRight;
            return (
              <Link key={c._id} to={`/chats/${c.user._id}`} className="row">
                <Avatar name={c.user.name} src={c.user.avatarUrl} />
                <div className="row-main">
                  <strong className={bad ? 'danger' : ''}>{c.user.name}</strong>
                  <small className="call-meta">
                    <Dir size={14} className={bad ? 'danger' : 'accent'} /> {c.status}
                    {c.duration ? ` · ${duration(c.duration)}` : ''} · {dayLabel(c.createdAt)} {clock(c.createdAt)}
                  </small>
                </div>
                <button
                  className="icon-btn"
                  disabled={busy}
                  title={`${c.callType === 'video' ? 'Video' : 'Voice'} call`}
                  aria-label="Call back"
                  onClick={(e) => {
                    e.preventDefault();
                    startCall(c.user, c.callType);
                  }}
                >
                  {c.callType === 'video' ? <Video size={20} /> : <Phone size={20} />}
                </button>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
