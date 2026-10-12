import { useEffect, useRef, useState } from 'react';
import { fmtSec } from '../hooks/useTimer.js';
import { thumb } from '../lib/youtube.js';
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
} from './Icons.jsx';

/** Bộ nút trộn / trước / phát / tiếp / lặp. */
export function PlayerControls({ m, size = 'md' }) {
  const { engine } = m;
  const disabled = !m.nowTrack;
  return (
    <div className={`player-controls ${size}`}>
      <button
        className={`icon-btn toggle ${m.shuffle ? 'on' : ''}`}
        onClick={engine.toggleShuffle}
        title="Trộn bài"
      >
        <ShuffleIcon size={size === 'lg' ? 22 : 18} />
      </button>
      <button className="icon-btn" onClick={engine.prev} disabled={disabled} title="Bài trước">
        <PrevIcon size={size === 'lg' ? 26 : 20} />
      </button>
      <button className="play-btn" onClick={engine.toggle} disabled={disabled} title={m.isPlaying ? 'Dừng' : 'Phát'}>
        {m.isPlaying ? <PauseIcon size={size === 'lg' ? 24 : 16} /> : <PlayIcon size={size === 'lg' ? 24 : 16} />}
      </button>
      <button className="icon-btn" onClick={engine.next} disabled={disabled} title="Bài tiếp">
        <NextIcon size={size === 'lg' ? 26 : 20} />
      </button>
      <button className={`icon-btn toggle ${m.loop ? 'on' : ''}`} onClick={engine.toggleLoop} title="Lặp lại">
        <RepeatIcon size={size === 'lg' ? 22 : 18} />
      </button>
    </div>
  );
}

/** Thanh tiến độ bài hát, kéo để tua. */
export function SongProgress({ m }) {
  const [drag, setDrag] = useState(null);
  const value = drag ?? m.current;
  const max = m.duration || 0;
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div className="song-progress">
      <span>{fmtSec(value)}</span>
      <input
        type="range"
        className="slider"
        min={0}
        max={max || 1}
        step={1}
        value={value}
        disabled={!max}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={() => {
          if (drag != null) m.engine.seek(drag);
          setDrag(null);
        }}
        onKeyUp={() => {
          if (drag != null) m.engine.seek(drag);
          setDrag(null);
        }}
      />
      <span>{fmtSec(max)}</span>
    </div>
  );
}

export function VolumeControl({ m }) {
  const level = m.volume === 0 ? 0 : m.volume < 50 ? 0.5 : 1;
  return (
    <div className="volume">
      <button
        className="icon-btn"
        title="Tắt / bật tiếng"
        onClick={() => {
          if (m.volume > 0) {
            m.engine.lastVolume = m.volume;
            m.engine.setVolume(0);
          } else m.engine.setVolume(m.engine.lastVolume || 70);
        }}
      >
        <VolumeIcon size={18} level={level} />
      </button>
      <input
        type="range"
        className="slider"
        min={0}
        max={100}
        value={m.volume}
        style={{ '--pct': `${m.volume}%` }}
        onChange={(e) => m.engine.setVolume(Number(e.target.value))}
      />
    </div>
  );
}

/** Danh sách bài kiểu Spotify. */
export function TrackList({ m, filter = '', autoScroll = false }) {
  const q = filter.trim().toLowerCase();
  const activeRef = useRef(null);
  useEffect(() => {
    if (autoScroll) activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [m.nowIdx, autoScroll]);
  if (!m.queue.length) {
    return <div className="tracklist-empty">Chưa có bài nào. Dán link YouTube để thêm nhạc.</div>;
  }
  return (
    <ol className="tracklist">
      {m.queue.map((t, i) => {
        const meta = m.meta[t.id];
        const title = meta?.title || 'Đang tải…';
        const author = meta?.author || '';
        if (q && !`${title} ${author}`.toLowerCase().includes(q)) return null;
        const active = i === m.nowIdx;
        return (
          <li
            key={`${t.id}-${i}`}
            className={`track ${active ? 'active' : ''} ${t.unavailable ? 'unavailable' : ''}`}
            onClick={() => !t.unavailable && m.engine.playIndex(i, true)}
            ref={active ? activeRef : undefined}
          >
            <span className="track-num">
              {active && m.isPlaying ? (
                <span className="eq"><i /><i /><i /></span>
              ) : (
                <>
                  <span className="n">{i + 1}</span>
                  <PlayIcon size={14} className="hover-play" />
                </>
              )}
            </span>
            <img src={thumb(t.id)} alt="" loading="lazy" />
            <span className="track-meta">
              <span className="track-title">{title}</span>
              <span className="track-author">{t.unavailable ? 'Không phát được' : author}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
