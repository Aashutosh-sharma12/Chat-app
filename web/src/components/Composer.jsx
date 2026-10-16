import { useEffect, useRef, useState } from 'react';
import { Mic, Paperclip, Send, Trash2, X } from 'lucide-react';
import { notifyTyping, stopTyping } from '../socket';
import { sendFile, sendText } from '../messaging';
import { replyLabel } from '../utils/format';

const MAX_MB = 50;

function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return options.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

export default function Composer({ to, conversationId, reply, onCancelReply }) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(null); // { seconds }
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const areaRef = useRef(null);
  const rec = useRef(null);
  const timer = useRef(null);
  // Recorder callbacks outlive renders, so read the latest reply through refs.
  const replyRef = useRef(null);
  const onCancelReplyRef = useRef(onCancelReply);
  replyRef.current = reply?.ref;
  onCancelReplyRef.current = onCancelReply;

  useEffect(() => () => {
    clearInterval(timer.current);
    rec.current?.stream?.getTracks().forEach((t) => t.stop());
    stopTyping(to, conversationId);
  }, [to, conversationId]);

  useEffect(() => {
    if (reply) areaRef.current?.focus();
  }, [reply]);

  // Auto-grow the textarea up to a few lines.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    sendText(to, conversationId, body, reply?.ref);
    onCancelReply();
    stopTyping(to, conversationId);
    setText('');
  }

  function onFiles(e) {
    setError('');
    for (const file of e.target.files) {
      if (!/^(image|video|audio)\//.test(file.type)) setError('Only images, videos and audio can be sent');
      else if (file.size > MAX_MB * 1024 * 1024) setError(`File too large (max ${MAX_MB}MB)`);
      else {
        sendFile(to, conversationId, file, reply?.ref);
        onCancelReply();
      }
    }
    e.target.value = '';
  }

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recorder.cancelled || !chunks.length) return;
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        sendFile(to, conversationId, new File(chunks, `voice-${Date.now()}.${ext}`, { type }), replyRef.current);
        onCancelReplyRef.current();
      };
      recorder.start();
      rec.current = recorder;
      setRecording({ seconds: 0 });
      timer.current = setInterval(() => setRecording((r) => r && { seconds: r.seconds + 1 }), 1000);
    } catch {
      setError('Microphone access was blocked');
    }
  }

  function stopRecording(cancel) {
    clearInterval(timer.current);
    if (rec.current) {
      rec.current.cancelled = cancel;
      if (rec.current.state !== 'inactive') rec.current.stop();
    }
    rec.current = null;
    setRecording(null);
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="composer-wrap">
      {error && <div className="composer-error">{error}</div>}
      {reply && (
        <div className="reply-bar">
          <div className="quote-bar">
            <strong>{reply.name}</strong>
            <span>{replyLabel(reply.ref)}</span>
          </div>
          <button className="icon-btn" onClick={onCancelReply} aria-label="Cancel reply">
            <X size={18} />
          </button>
        </div>
      )}
      <div className="composer">
        {recording ? (
          <>
            <button className="icon-btn danger" onClick={() => stopRecording(true)} aria-label="Cancel recording">
              <Trash2 size={20} />
            </button>
            <div className="recording">
              <i /> Recording {fmt(recording.seconds)}
            </div>
            <button className="send-btn" onClick={() => stopRecording(false)} aria-label="Send voice message">
              <Send size={20} />
            </button>
          </>
        ) : (
          <>
            <button className="icon-btn" onClick={() => fileRef.current.click()} aria-label="Attach file" title="Attach photo, video or audio">
              <Paperclip size={20} />
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={onFiles} />
            <textarea
              ref={areaRef}
              rows={1}
              placeholder="Type a message"
              value={text}
              maxLength={4000}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) notifyTyping(to, conversationId);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && reply) onCancelReply();
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {text.trim() ? (
              <button className="send-btn" onClick={submit} aria-label="Send">
                <Send size={20} />
              </button>
            ) : (
              <button className="send-btn" onClick={startRecording} aria-label="Record voice message" title="Record voice message">
                <Mic size={20} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
