import { memo } from 'react';
import { Reply, RotateCcw } from 'lucide-react';
import { Spinner, Ticks } from './ui.jsx';
import { myId } from '../store/auth';
import { clock, replyLabel } from '../utils/format';

function Body({ m, onOpen }) {
  const src = m.media?.url || m.localUri;
  const expired = m.media?.deleted;

  if (m.type === 'text') return <span className="text">{m.text}</span>;
  if (expired) return <em className="expired">Media expired</em>;
  if (!src) return <Spinner />;

  const uploading = m.status === 'pending';
  return (
    <>
      {m.type === 'image' && <img className="media" src={src} alt="" onClick={() => onOpen(m)} loading="lazy" />}
      {m.type === 'video' && <video className="media" src={src} poster={m.media?.thumbnailUrl || undefined} controls preload="metadata" />}
      {m.type === 'audio' && <audio src={src} controls preload="metadata" />}
      {uploading && (
        <span className="uploading">
          <Spinner size={22} />
        </span>
      )}
      {m.text && <span className="text">{m.text}</span>}
    </>
  );
}

function Quote({ r, peerName, onPress }) {
  const mineQuote = r.sender === myId();
  return (
    <button className={`quote ${mineQuote ? 'q-mine' : ''}`} onClick={() => onPress(r._id)}>
      <strong>{mineQuote ? 'You' : peerName}</strong>
      <span>{replyLabel(r)}</span>
    </button>
  );
}

function MessageBubble({ m, mine, peerName, onRetry, onOpen, onReply, onQuotePress }) {
  const canReply = m.status !== 'pending' && m.status !== 'failed';
  return (
    <div className={`msg ${mine ? 'mine' : 'theirs'}`} id={`msg-${m._id}`}>
      <div className={`bubble ${m.type !== 'text' && m.type !== 'audio' ? 'has-media' : ''}`}>
        {canReply && (
          <button className="reply-btn" onClick={() => onReply(m)} aria-label="Reply" title="Reply">
            <Reply size={16} />
          </button>
        )}
        {m.replyTo && <Quote r={m.replyTo} peerName={peerName} onPress={onQuotePress} />}
        <Body m={m} onOpen={onOpen} />
        <span className="meta">
          {clock(m.createdAt)}
          {mine && <Ticks status={m.status} />}
        </span>
      </div>
      {m.status === 'failed' && (
        <button className="retry" onClick={() => onRetry(m)}>
          <RotateCcw size={13} /> Not sent. Retry
        </button>
      )}
    </div>
  );
}

export default memo(MessageBubble);
