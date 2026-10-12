import { useEffect, useState } from 'react';
import { parseYouTube, thumb } from '../lib/youtube.js';
import { playChime } from '../lib/chime.js';
import { CloseIcon, LinkIcon } from './Icons.jsx';

/** Ô dán link YouTube (kiểu thanh tìm kiếm Spotify). */
export function LinkInput({ m, onLoad, placeholder = 'Dán link YouTube – video hoặc playlist' }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const parsed = parseYouTube(value);
    if (!parsed) {
      setError('Không nhận ra link YouTube. Hãy dán link video hoặc playlist.');
      return;
    }
    setError('');
    onLoad(parsed, value.trim());
    setValue('');
  };
  const msg = error ? { text: error, error: true } : m.msg;
  return (
    <div className="link-input-wrap">
      <form className="link-input" onSubmit={submit}>
        <LinkIcon size={18} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="pill-btn" disabled={!value.trim() || m.loading}>
          {m.loading ? 'Đang tải…' : 'Thêm'}
        </button>
      </form>
      {msg && <p className={`hint ${msg.error ? 'error' : ''}`}>{msg.text}</p>}
    </div>
  );
}

/** Ô số có nút - / + */
export function Stepper({ value, onChange, min = 1, max = 300, label }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (v) => {
    const n = Math.round(Number(v));
    onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value);
  };
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-box">
        <button type="button" onClick={() => commit(value - 1)} disabled={value <= min}>−</button>
        <input
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <button type="button" onClick={() => commit(value + 1)} disabled={value >= max}>+</button>
      </div>
      <span className="stepper-unit">phút</span>
    </div>
  );
}

export function Modal({ onClose, children, className = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true">
        <button className="icon-btn modal-close" onClick={onClose} title="Đóng">
          <CloseIcon size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label, desc }) {
  return (
    <label className="switch-row">
      <span>
        <span className="switch-label">{label}</span>
        {desc && <span className="switch-desc">{desc}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" />
    </label>
  );
}

export function SettingsModal({ settings, setSettings, onClose }) {
  const upd = (patch) => setSettings((s) => ({ ...s, ...patch }));
  return (
    <Modal onClose={onClose}>
      <h2 className="modal-title">Cài đặt</h2>
      <Switch
        label="Nhạc theo phiên"
        desc="Tự phát nhạc khi tập trung, dừng khi nghỉ hoặc tạm dừng"
        checked={settings.musicFollowTimer}
        onChange={(v) => upd({ musicFollowTimer: v })}
      />
      <Switch
        label="Tự chuyển phiên"
        desc="Hết phiên tự bắt đầu phiên tiếp theo"
        checked={settings.autoStartNext}
        onChange={(v) => upd({ autoStartNext: v })}
      />
      <Switch
        label="Thông báo trình duyệt"
        desc="Hiện thông báo khi hết phiên, kể cả khi đang ở tab khác"
        checked={settings.notify}
        onChange={(v) => {
          upd({ notify: v });
          if (v && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        }}
      />
      <div className="setting-block">
        <div className="switch-label">Âm lượng chuông báo</div>
        <div className="chime-row">
          <input
            type="range"
            className="slider"
            min={0}
            max={100}
            value={Math.round(settings.chimeVolume * 100)}
            style={{ '--pct': `${settings.chimeVolume * 100}%` }}
            onChange={(e) => upd({ chimeVolume: Number(e.target.value) / 100 })}
          />
          <button className="pill-btn outline" onClick={() => playChime('focus', settings.chimeVolume)}>
            Thử chuông
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Popup khi hết phiên. */
export function SessionEndModal({ info, onStartNext, onClose }) {
  const isFocusDone = info.finished === 'focus';
  return (
    <Modal onClose={onClose} className="end-modal">
      <div className={`end-badge ${isFocusDone ? 'focus' : 'break'}`}>{isFocusDone ? '🎉' : '⏰'}</div>
      <h2 className="modal-title">{isFocusDone ? 'Hết giờ tập trung!' : 'Hết giờ nghỉ!'}</h2>
      <p className="end-text">
        {isFocusDone
          ? `Bạn đã hoàn thành ${info.completed} phiên. Đứng dậy vươn vai, nghỉ ${info.nextMin} phút nhé.`
          : `Sẵn sàng quay lại làm việc ${info.nextMin} phút chưa?`}
      </p>
      <div className="end-actions">
        {info.autoStarted ? (
          <button className="pill-btn" onClick={onClose}>OK</button>
        ) : (
          <>
            <button className="pill-btn outline" onClick={onClose}>Để sau</button>
            <button className="pill-btn" onClick={onStartNext}>
              {isFocusDone ? 'Bắt đầu nghỉ' : 'Bắt đầu tập trung'}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Đĩa than quay + vòng tiến độ Pomodoro bao quanh. */
export function Disc({ m, progress, size = 340 }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const cover = m.nowTrack ? thumb(m.nowTrack.id) : null;
  return (
    <div className={`turntable ${m.isPlaying ? 'spinning' : ''}`} style={{ '--size': `${size}px` }}>
      <svg className="ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
        />
      </svg>
      <div className="disc">
        <div className="grooves" />
        <div className="disc-label" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} />
        <div className="disc-hole" />
      </div>
    </div>
  );
}
