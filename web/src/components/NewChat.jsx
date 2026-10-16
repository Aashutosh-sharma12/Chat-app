import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { usersApi } from '../api/client';
import Avatar from './Avatar.jsx';
import { Modal, Spinner, useDebounced } from './ui.jsx';

export default function NewChat({ onClose, onPick }) {
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (term.length < 2) {
      setUsers([]);
      return;
    }
    let live = true;
    setLoading(true);
    setError('');
    usersApi
      .search(term)
      .then((u) => live && setUsers(u))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [term]);

  return (
    <Modal title="New chat" onClose={onClose}>
      <div className="modal-body">
        <div className="input-wrap">
          <Search size={18} />
          <input autoFocus placeholder="Search by phone number or name" value={q} onChange={(e) => setQ(e.target.value)} />
          {loading && <Spinner size={16} />}
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="list compact">
          {users.map((u) => (
            <button key={u._id} className="row" onClick={() => onPick(u)}>
              <Avatar name={u.name} src={u.avatarUrl} size={40} />
              <div className="row-main">
                <strong>{u.name}</strong>
                <small>{u.phone}</small>
              </div>
            </button>
          ))}
          {!loading && term.length >= 2 && users.length === 0 && !error && <p className="empty">No users found</p>}
          {term.length < 2 && <p className="empty">Type at least 2 characters or a full phone number</p>}
        </div>
      </div>
    </Modal>
  );
}
