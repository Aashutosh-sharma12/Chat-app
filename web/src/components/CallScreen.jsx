import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, SwitchCamera, Video, VideoOff } from 'lucide-react';
import { useCall } from '../store/call';
import { acceptCall, endCall, rejectCall, switchCamera, toggleCamera, toggleMute } from '../callManager';
import Avatar from './Avatar.jsx';
import { clockDuration } from '../utils/format';

const END_REASONS = {
  busy: 'User is busy',
  rejected: 'Call declined',
  'no-answer': 'No answer',
  cancelled: 'Call cancelled',
  hangup: 'Call ended',
  disconnected: 'Connection lost',
  'connection-failed': 'Connection failed',
  'answered-elsewhere': 'Answered on another device',
  'no-permission': 'Camera or microphone permission denied',
  unsupported: 'Calls need a secure (https) connection and a supported browser',
  error: 'Call failed',
};

function Timer({ since }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed((Date.now() - since) / 1000);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [since]);
  return <span className="call-status">{clockDuration(elapsed)}</span>;
}

// Attaches a MediaStream to a media element.
function Stream({ stream, muted, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

export default function CallScreen() {
  const s = useCall();
  if (s.status === 'idle' || !s.peer) return null;

  const isVideo = s.callType === 'video';
  const connected = s.status === 'connected';
  const showRemoteVideo = isVideo && s.remoteStream && connected && !s.remoteCameraOff;
  const statusText =
    s.status === 'outgoing'
      ? 'Ringing...'
      : s.status === 'incoming'
        ? `Incoming ${isVideo ? 'video' : 'voice'} call`
        : s.status === 'connecting'
          ? 'Connecting...'
          : s.status === 'ended'
            ? END_REASONS[s.endReason] || 'Call ended'
            : null;

  return (
    <div className="call" role="dialog" aria-label="Call">
      {/* Always mounted so remote audio plays even when the video is hidden. */}
      <Stream stream={s.remoteStream} className={showRemoteVideo ? 'call-remote' : 'call-hidden'} />
      {isVideo && s.localStream && !connected && !s.cameraOff && s.status !== 'incoming' && s.status !== 'ended' && (
        <Stream stream={s.localStream} muted className="call-remote mirror" />
      )}

      <div className="call-top">
        {!showRemoteVideo && <Avatar name={s.peer.name} src={s.peer.avatarUrl} size={120} />}
        <h2>{s.peer.name}</h2>
        {statusText ? <span className="call-status">{statusText}</span> : s.connectedAt ? <Timer since={s.connectedAt} /> : null}
        {connected && s.remoteMuted && <small>{s.peer.name} muted their microphone</small>}
        {connected && isVideo && s.remoteCameraOff && <small>Camera is off</small>}
      </div>

      {isVideo && s.localStream && connected && !s.cameraOff && <Stream stream={s.localStream} muted className="call-pip mirror" />}

      <div className="call-controls">
        {s.status === 'incoming' ? (
          <>
            <div className="call-action">
              <button className="call-btn red" onClick={rejectCall} aria-label="Decline">
                <PhoneOff size={26} />
              </button>
              <span>Decline</span>
            </div>
            <div className="call-action">
              <button className="call-btn green ringing" onClick={acceptCall} aria-label="Accept">
                {isVideo ? <Video size={26} /> : <Phone size={26} />}
              </button>
              <span>Accept</span>
            </div>
          </>
        ) : s.status !== 'ended' ? (
          <>
            {isVideo && (
              <button className="call-btn" onClick={switchCamera} aria-label="Switch camera" title="Switch camera">
                <SwitchCamera size={24} />
              </button>
            )}
            {isVideo && (
              <button className={`call-btn ${s.cameraOff ? 'on' : ''}`} onClick={toggleCamera} aria-label="Toggle camera" title="Camera">
                {s.cameraOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
            )}
            <button className={`call-btn ${s.muted ? 'on' : ''}`} onClick={toggleMute} aria-label="Toggle microphone" title="Microphone">
              {s.muted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button className="call-btn red" onClick={() => endCall()} aria-label="End call" title="End call">
              <PhoneOff size={26} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
