import { useState } from 'react';
import { fmtTime } from '../hooks/useTimer.js';
import { thumb } from '../lib/youtube.js';
import { Disc, LinkInput } from './Common.jsx';
import { ChevronDownIcon, PauseIcon, PlayIcon, ResetIcon, SearchIcon, SettingsIcon, SkipIcon } from './Icons.jsx';
import { PlayerControls, SongProgress, TrackList, VolumeControl } from './Player.jsx';

export default function Session({ m, timer, onBack, onLoad, onOpenSettings }) {
  const [filter, setFilter] = useState('');
  const isFocus = timer.mode === 'focus';
  const cover = m.nowTrack ? thumb(m.nowTrack.id) : null;

  return (
    <div className={`session ${isFocus ? 'focus' : 'break'}`}>
      {cover && <div className="session-bg" style={{ backgroundImage: `url("${cover}")` }} />}

      <header className="session-top">
        <button className="icon-btn circle-dark" onClick={onBack} title="Về Dashboard">
          <ChevronDownIcon size={22} />
        </button>
        <div className="session-heading">
          <span className="eyebrow">{isFocus ? 'Đang tập trung' : 'Đang nghỉ'}</span>
          <span className="session-sub">
            {isFocus ? `Phiên #${timer.completed + 1}` : `Đã xong ${timer.completed} phiên`}
          </span>
        </div>
        <button className="icon-btn circle-dark" onClick={onOpenSettings} title="Cài đặt">
          <SettingsIcon size={18} />
        </button>
      </header>

      <div className="session-grid">
        {/* Trái: đĩa + đồng hồ */}
        <section className="stage">
          <Disc m={m} progress={timer.progress} />
          <div className="stage-time">{fmtTime(timer.remaining)}</div>
          <div className="stage-label">{isFocus ? 'Tập trung' : 'Nghỉ ngơi'}</div>
          <div className="stage-actions">
            <button className="icon-btn" onClick={timer.reset} title="Đặt lại"><ResetIcon size={22} /></button>
            <button className="play-xl white" onClick={timer.toggle} title={timer.running ? 'Tạm dừng' : 'Tiếp tục'}>
              {timer.running ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
            </button>
            <button className="icon-btn" onClick={timer.skip} title="Bỏ qua phiên"><SkipIcon size={22} /></button>
          </div>
        </section>

        {/* Phải: nhạc */}
        <section className="side">
          <div className="glass now-card">
            <div className="now-card-head">
              {m.nowTrack ? <img src={thumb(m.nowTrack.id)} alt="" /> : <div className="img-ph" />}
              <div className="now-meta">
                <span className="now-title big">{m.nowMeta?.title || (m.nowTrack ? 'Đang tải…' : 'Chưa có nhạc')}</span>
                <span className="now-author">
                  {m.nowMeta?.author}
                  {m.queue.length > 1 && ` · ${m.nowIdx + 1}/${m.queue.length}`}
                </span>
              </div>
            </div>
            <SongProgress m={m} />
            <div className="now-card-controls">
              <PlayerControls m={m} size="lg" />
            </div>
            <VolumeControl m={m} />
          </div>

          <div className="glass queue-card">
            <div className="queue-head">
              <h3>Danh sách phát {m.queue.length > 0 && <span className="muted">· {m.queue.length} bài</span>}</h3>
              <label className="search">
                <SearchIcon size={16} />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Tìm bài" />
              </label>
            </div>
            <div className="queue-scroll">
              <TrackList m={m} filter={filter} autoScroll />
            </div>
            <LinkInput m={m} onLoad={onLoad} placeholder="Đổi nhạc: dán link YouTube" />
          </div>
        </section>
      </div>
    </div>
  );
}
