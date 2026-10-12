import { fmtTime } from '../hooks/useTimer.js';
import { parseYouTube, thumb } from '../lib/youtube.js';
import { LinkInput, Stepper } from './Common.jsx';
import { CloseIcon, ExpandIcon, LibraryIcon, MusicIcon, PlayIcon, ResetIcon, SettingsIcon, SkipIcon } from './Icons.jsx';
import { PlayerControls, SongProgress, TrackList, VolumeControl } from './Player.jsx';

const PRESETS = [
  [25, 5],
  [50, 10],
  [90, 20],
];

export default function Dashboard({ m, timer, settings, setSettings, history, onLoad, onRemoveHistory, onStart, onOpenSession, onOpenSettings }) {
  const isFocus = timer.mode === 'focus';
  const sourceTitle = m.queue.length
    ? m.meta[m.queue[0].id]?.title || 'Đang tải…'
    : null;

  return (
    <div className="dash">
      {/* ---------- Sidebar: thư viện ---------- */}
      <aside className="sidebar">
        <div className="panel brand">
          <span className="logo">🍅</span>
          <span>Pomodoro Music</span>
        </div>
        <div className="panel library">
          <div className="library-head">
            <LibraryIcon size={22} />
            <span>Thư viện</span>
          </div>
          {history.length === 0 && <p className="muted small pad">Link bạn đã dùng sẽ hiện ở đây.</p>}
          <ul className="library-list">
            {history.map((h) => {
              const title = m.meta[h.firstId]?.title || h.url;
              const active = m.source?.url === h.url;
              return (
                <li key={h.url} className={active ? 'active' : ''} onClick={() => onLoad(parseYouTube(h.url), h.url)} title={h.url}>
                  <img src={thumb(h.firstId)} alt="" />
                  <span className="lib-meta">
                    <span className="lib-title">{title}</span>
                    <span className="lib-sub">{h.count > 1 ? `Playlist · ${h.count} bài` : 'Video'}</span>
                  </span>
                  <button
                    className="icon-btn lib-del"
                    title="Xoá khỏi thư viện"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveHistory(h.url);
                    }}
                  >
                    <CloseIcon size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <main className="panel main">
        <section className={`hero ${isFocus ? 'focus' : 'break'}`}>
          <div className="hero-top">
            <div className="seg">
              <button className={isFocus ? 'on' : ''} onClick={() => timer.switchMode('focus')}>Tập trung</button>
              <button className={!isFocus ? 'on' : ''} onClick={() => timer.switchMode('break')}>Nghỉ</button>
            </div>
            <button className="icon-btn circle-dark" onClick={onOpenSettings} title="Cài đặt">
              <SettingsIcon size={18} />
            </button>
          </div>

          <div className="eyebrow">{isFocus ? `Phiên #${timer.completed + 1}` : `Đã xong ${timer.completed} phiên`}</div>
          <h1 className="hero-time">{fmtTime(timer.remaining)}</h1>
          <div className="hero-progress"><div style={{ width: `${timer.progress * 100}%` }} /></div>

          <div className="hero-actions">
            <button className="play-xl" onClick={timer.running ? onOpenSession : onStart} title={timer.running ? 'Vào phiên' : 'Bắt đầu'}>
              {timer.running ? <ExpandIcon size={24} /> : <PlayIcon size={28} />}
            </button>
            <button className="icon-btn" onClick={timer.reset} title="Đặt lại"><ResetIcon size={24} /></button>
            <button className="icon-btn" onClick={timer.skip} title="Bỏ qua phiên"><SkipIcon size={24} /></button>
            <span className="hero-hint">{timer.running ? 'Đang chạy · bấm để mở màn phiên' : timer.started ? 'Đã tạm dừng' : 'Bấm để bắt đầu'}</span>
          </div>

          <div className="durations">
            <Stepper label="Tập trung" value={settings.focusMin} onChange={(v) => setSettings((s) => ({ ...s, focusMin: v }))} />
            <Stepper label="Nghỉ" value={settings.breakMin} max={120} onChange={(v) => setSettings((s) => ({ ...s, breakMin: v }))} />
            <div className="presets">
              {PRESETS.map(([f, b]) => (
                <button
                  key={f}
                  className={`chip ${settings.focusMin === f && settings.breakMin === b ? 'on' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, focusMin: f, breakMin: b }))}
                >
                  {f}/{b}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="content">
          <h2 className="section-title">Nhạc cho phiên làm việc</h2>
          <LinkInput m={m} onLoad={onLoad} />

          {m.queue.length > 0 ? (
            <>
              <div className="playlist-head">
                <img src={thumb(m.queue[0].id)} alt="" />
                <div>
                  <div className="eyebrow">{m.queue.length > 1 ? 'Playlist' : 'Video'}</div>
                  <div className="playlist-title">{sourceTitle}</div>
                  <div className="muted small">{m.queue.length} bài</div>
                </div>
              </div>
              <TrackList m={m} />
            </>
          ) : (
            <div className="empty-music">
              <MusicIcon size={40} />
              <p>Dán link một video hoặc playlist YouTube bất kỳ — lofi, nhạc không lời, playlist của riêng bạn…</p>
            </div>
          )}
        </section>
      </main>

      {/* ---------- Thanh đang phát ---------- */}
      <footer className="now-bar">
        <div className="now-left">
          {m.nowTrack ? (
            <>
              <img src={thumb(m.nowTrack.id)} alt="" className={m.isPlaying ? 'spin-slow' : ''} />
              <span className="now-meta">
                <span className="now-title">{m.nowMeta?.title || 'Đang tải…'}</span>
                <span className="now-author">{m.nowMeta?.author}</span>
              </span>
            </>
          ) : (
            <span className="muted small">Chưa có nhạc</span>
          )}
        </div>
        <div className="now-center">
          <PlayerControls m={m} />
          <SongProgress m={m} />
        </div>
        <div className="now-right">
          <VolumeControl m={m} />
          <button className="icon-btn" onClick={onOpenSession} title="Mở màn phiên">
            <ExpandIcon size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
