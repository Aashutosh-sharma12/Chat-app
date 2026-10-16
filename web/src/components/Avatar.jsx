import { initials } from '../utils/format';

const HUES = [160, 200, 260, 330, 20, 45, 120];

export default function Avatar({ name, src, size = 44, online }) {
  const hue = HUES[(name?.charCodeAt(0) || 0) % HUES.length];
  const style = { width: size, height: size, fontSize: size * 0.38 };
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      {src ? (
        <img className="avatar" src={src} alt="" style={style} />
      ) : (
        <span className="avatar" style={{ ...style, background: `hsl(${hue} 50% 42%)` }}>
          {initials(name)}
        </span>
      )}
      {online && <i className="online-dot" />}
    </span>
  );
}
