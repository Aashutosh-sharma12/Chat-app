import { useEffect, useState } from 'react';
import { Check, CheckCheck, Clock, MessageCircle, TriangleAlert, X } from 'lucide-react';

export const Spinner = ({ size = 20 }) => <span className="spinner" style={{ width: size, height: size }} />;

export const SplashLoader = () => (
  <div className="splash">
    <span className="brand-logo big pulse">
      <MessageCircle size={34} />
    </span>
    <Spinner size={26} />
  </div>
);

export const Skeleton = ({ w = '100%', h = 14, round }) => (
  <span className="skeleton" style={{ width: w, height: h, borderRadius: round ? '50%' : 8 }} />
);

export const ListSkeleton = ({ rows = 8 }) =>
  Array.from({ length: rows }, (_, i) => (
    <div className="row skel-row" key={i}>
      <Skeleton w={48} h={48} round />
      <div className="skel-lines">
        <Skeleton w="45%" />
        <Skeleton w="75%" h={12} />
      </div>
    </div>
  ));

export const Ticks = ({ status }) => {
  if (status === 'pending') return <Clock size={13} className="tick" />;
  if (status === 'failed') return <TriangleAlert size={14} className="tick failed" />;
  if (status === 'sent') return <Check size={15} className="tick" />;
  return <CheckCheck size={15} className={`tick ${status === 'seen' ? 'seen' : ''}`} />;
};

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-wrap" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const useDebounced = (value, ms = 350) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms, setV]);
  return v;
};

export const ErrorState = ({ message, onBack }) => (
  <div className="welcome">
    <TriangleAlert size={36} />
    <h2>Something went wrong</h2>
    <p>{message}</p>
    <button className="btn btn-primary" onClick={onBack}>
      Back to chats
    </button>
  </div>
);
