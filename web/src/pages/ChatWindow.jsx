import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Video, X } from 'lucide-react';
import { usersApi } from '../api/client';
import { useChat } from '../store/chat';
import { usePresence } from '../store/presence';
import { myId } from '../store/auth';
import { fetchPresence, markActiveSeen } from '../socket';
import { retry } from '../messaging';
import { startCall } from '../callManager';
import { useCall } from '../store/call';
import Avatar from '../components/Avatar.jsx';
import Composer from '../components/Composer.jsx';
import MessageBubble from '../components/MessageBubble.jsx';
import { ErrorState, Spinner } from '../components/ui.jsx';
import { dayLabel, lastSeenText } from '../utils/format';

export default function ChatWindow({ userId }) {
  const navigate = useNavigate();
  const [peer, setPeer] = useState(() => useChat.getState().conversations.find((c) => c.user._id === userId)?.user || null);
  const [convId, setConvId] = useState(() => useChat.getState().convByUser[userId] || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [preview, setPreview] = useState(null);
  const [replying, setReplying] = useState(null);

  const messages = useChat((s) => (convId ? s.messages[convId] : null));
  const hasMore = useChat((s) => (convId ? s.hasMore[convId] : false));
  const presence = usePresence((s) => s.byUser[userId]);
  const typing = usePresence((s) => s.typing[userId]);
  const callActive = useCall((s) => s.status !== 'idle');
  const scroller = useRef(null);
  const stick = useRef(true); // keep pinned to the bottom unless the user scrolled up
  const prevHeight = useRef(0);

  // Open the conversation, load history and mark it active.
  useEffect(() => {
    let live = true;
    const chat = useChat.getState();
    (async () => {
      try {
        const conv = await chat.openWithUser(userId);
        if (!live) return;
        setPeer(conv.user || peer || (await usersApi.get(userId)));
        setConvId(conv._id);
        chat.setActive(conv._id);
        await chat.loadMessages(conv._id);
        if (!live) return;
        setLoading(false);
        fetchPresence(userId);
        markActiveSeen();
      } catch (e) {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      }
    })();
    const onVisible = () => markActiveSeen();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
      useChat.getState().setActive(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const ordered = useMemo(() => (messages ? [...messages].reverse() : []), [messages]);

  // Stick to the bottom on new messages; preserve position after loading older ones.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current && !stick.current) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevHeight.current = 0;
  }, [ordered.length, typing, loading]);

  function onScroll() {
    const el = scroller.current;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  async function loadOlder() {
    setLoadingOlder(true);
    stick.current = false;
    prevHeight.current = scroller.current.scrollHeight;
    try {
      await useChat.getState().loadMessages(convId, true);
    } finally {
      setLoadingOlder(false);
    }
  }

  const me = myId();
  const peerName = peer?.name || '';
  const replyRef = useMemo(
    () => (replying ? { _id: replying._id, sender: replying.sender, type: replying.type, text: replying.text } : null),
    [replying]
  );

  // Jump to the quoted message and flash it.
  const scrollToMessage = useCallback((id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1400);
  }, []);
  const status = typing ? 'typing...' : lastSeenText(presence ?? (peer && { isOnline: peer.isOnline, lastSeen: peer.lastSeen }));

  if (error) return <ErrorState message={error} onBack={() => navigate('/chats')} />;

  let lastDay = '';
  return (
    <div className="chat">
      <header className="chat-head">
        <button className="icon-btn back" onClick={() => navigate('/chats')} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        {peer && <Avatar name={peer.name} src={peer.avatarUrl} size={42} online={presence?.isOnline ?? peer.isOnline} />}
        <div className="chat-title">
          <strong>{peer?.name || ' '}</strong>
          <small className={typing || presence?.isOnline ? 'accent' : ''}>{status}</small>
        </div>
        <div className="grow" />
        <button className="icon-btn" disabled={!peer || callActive} onClick={() => startCall(peer, 'video')} aria-label="Video call" title="Video call">
          <Video size={22} />
        </button>
        <button className="icon-btn" disabled={!peer || callActive} onClick={() => startCall(peer, 'audio')} aria-label="Voice call" title="Voice call">
          <Phone size={21} />
        </button>
      </header>

      <div className="messages" ref={scroller} onScroll={onScroll}>
        {loading ? (
          <div className="center">
            <Spinner size={30} />
          </div>
        ) : (
          <>
            {hasMore && (
              <button className="btn btn-ghost older" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder && <Spinner size={14} />} Load older messages
              </button>
            )}
            <div className="notice">Messages and media are removed automatically after a few days.</div>
            {ordered.length === 0 && <div className="notice">No messages yet. Say hello!</div>}
            {ordered.map((m) => {
              const day = dayLabel(m.createdAt);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <div key={m.clientId || m._id}>
                  {showDay && <div className="day">{day}</div>}
                  <MessageBubble
                    m={m}
                    mine={m.sender === me}
                    peerName={peerName}
                    onRetry={retry}
                    onOpen={setPreview}
                    onReply={setReplying}
                    onQuotePress={scrollToMessage}
                  />
                </div>
              );
            })}
            {typing && (
              <div className="msg theirs">
                <div className="bubble typing">
                  <i /> <i /> <i />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {convId && (
        <Composer
          to={userId}
          conversationId={convId}
          reply={replyRef && { ref: replyRef, name: replyRef.sender === me ? 'You' : peerName }}
          onCancelReply={() => setReplying(null)}
        />
      )}

      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)}>
          <button className="icon-btn" aria-label="Close">
            <X size={24} />
          </button>
          <img src={preview.media?.url || preview.localUri} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
