import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Image, Mic, Plus, Search, Video } from 'lucide-react';
import { useChat } from '../store/chat';
import { usePresence } from '../store/presence';
import { myId } from '../store/auth';
import Avatar from '../components/Avatar.jsx';
import NewChat from '../components/NewChat.jsx';
import { ListSkeleton, Ticks } from '../components/ui.jsx';
import { listTime } from '../utils/format';

const ICONS = { image: Image, video: Video, audio: Mic };

const Row = memo(function Row({ c }) {
  const typing = usePresence((s) => s.typing[c.user._id]);
  const online = usePresence((s) => s.byUser[c.user._id]?.isOnline ?? c.user.isOnline);
  const last = c.lastMessage;
  const Icon = last && ICONS[last.type];
  const isMine = last?.sender === myId();
  return (
    <NavLink to={`/chats/${c.user._id}`} className="row">
      <Avatar name={c.user.name} src={c.user.avatarUrl} online={online} />
      <div className="row-main">
        <div className="row-top">
          <strong>{c.user.name}</strong>
          <small className={c.unread ? 'accent' : ''}>{listTime(last?.createdAt || c.updatedAt)}</small>
        </div>
        <div className="row-bottom">
          {typing ? (
            <span className="accent">typing...</span>
          ) : (
            <span className="preview">
              {isMine && last && <Ticks status={last.status} />}
              {Icon && <Icon size={14} />}
              {last?.text}
            </span>
          )}
          {c.unread > 0 && <b className="badge">{c.unread}</b>}
        </div>
      </div>
    </NavLink>
  );
});

export default function ChatList() {
  const conversations = useChat((s) => s.conversations);
  const listLoaded = useChat((s) => s.listLoaded);
  const loadConversations = useChat((s) => s.loadConversations);
  const [q, setQ] = useState('');
  const [newChat, setNewChat] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations().catch(() => {});
  }, [loadConversations]);

  const list = conversations.filter((c) => c.user.name.toLowerCase().includes(q.toLowerCase()) || c.user.phone.includes(q));

  return (
    <>
      <header className="panel-head">
        <h2>Chats</h2>
        <button className="icon-btn filled" onClick={() => setNewChat(true)} title="New chat" aria-label="New chat">
          <Plus size={20} />
        </button>
      </header>

      <div className="panel-search">
        <div className="input-wrap">
          <Search size={18} />
          <input placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="list">
        {!listLoaded ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          <div className="empty">
            <p>{q ? 'No chats match your search' : 'No conversations yet'}</p>
            {!q && (
              <button className="btn btn-primary" onClick={() => setNewChat(true)}>
                Start a chat
              </button>
            )}
          </div>
        ) : (
          list.map((c) => <Row key={c._id} c={c} />)
        )}
      </div>

      {newChat && (
        <NewChat
          onClose={() => setNewChat(false)}
          onPick={(u) => {
            setNewChat(false);
            navigate(`/chats/${u._id}`);
          }}
        />
      )}
    </>
  );
}
