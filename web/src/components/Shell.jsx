import { useEffect } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { MessageCircle, Moon, PhoneCall, Settings, Sun } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useChat } from '../store/chat';
import { useTheme } from './Theme.jsx';
import Avatar from './Avatar.jsx';
import ChatList from '../pages/ChatList.jsx';
import CallsPanel from '../pages/CallsPanel.jsx';
import SettingsPanel from '../pages/SettingsPanel.jsx';
import ChatWindow from '../pages/ChatWindow.jsx';

const PANELS = { chats: ChatList, calls: CallsPanel, settings: SettingsPanel };

export default function Shell() {
  const { section, userId } = useParams();
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const unread = useChat((s) => s.conversations.reduce((n, c) => n + (c.unread || 0), 0));
  const Panel = PANELS[section];

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  useEffect(() => {
    document.title = unread ? `(${unread}) ChatApp` : 'ChatApp';
  }, [unread]);

  if (!Panel) return <Navigate to="/chats" replace />;
  const chatOpen = section === 'chats' && userId;

  return (
    <div className={`app ${chatOpen ? 'chat-open' : ''}`}>
      <aside className="rail">
        <span className="brand-logo">
          <MessageCircle size={20} />
        </span>
        <nav>
          <NavLink to="/chats" title="Chats" className="rail-link">
            <MessageCircle size={22} />
            {unread > 0 && <b className="badge">{unread > 99 ? '99+' : unread}</b>}
            <span>Chats</span>
          </NavLink>
          <NavLink to="/calls" title="Calls" className="rail-link">
            <PhoneCall size={22} />
            <span>Calls</span>
          </NavLink>
          <NavLink to="/settings" title="Settings" className="rail-link">
            <Settings size={22} />
            <span>Settings</span>
          </NavLink>
        </nav>
        <div className="rail-foot">
          <button className="rail-link" onClick={toggle} title="Toggle theme">
            {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
            <span>Theme</span>
          </button>
          {user && <Avatar name={user.name} src={user.avatarUrl} size={36} />}
        </div>
      </aside>

      <section className="panel">
        <Panel />
      </section>

      <section className="stage">
        {chatOpen ? (
          <ChatWindow key={userId} userId={userId} />
        ) : (
          <div className="welcome">
            <span className="brand-logo big">
              <MessageCircle size={34} />
            </span>
            <h2>ChatApp for Web</h2>
            <p>Select a chat to start messaging, or start a new one from the chat list.</p>
          </div>
        )}
      </section>
    </div>
  );
}
