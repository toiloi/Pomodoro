import { useCallback, useEffect, useRef, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Session from './components/Session.jsx';
import { SessionEndModal, SettingsModal } from './components/Common.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useMusic } from './hooks/useMusic.js';
import { fmtTime, useTimer } from './hooks/useTimer.js';
import { playChime, unlockAudio } from './lib/chime.js';
import { store } from './lib/storage.js';
import { parseYouTube } from './lib/youtube.js';

const DEFAULT_SETTINGS = {
  focusMin: 25,
  breakMin: 5,
  musicFollowTimer: true,
  autoStartNext: false,
  notify: false,
  chimeVolume: 0.9,
};

function notify(text) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('Pomodoro Music', { body: text });
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [settings, setSettings] = useLocalStorage('settings.v2', DEFAULT_SETTINGS);
  const [history, setHistory] = useLocalStorage('library', []);
  const [view, setView] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [endInfo, setEndInfo] = useState(null);
  const m = useMusic();

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const completedRef = useRef(0);

  const onFinish = useCallback((finished, next) => {
    const s = settingsRef.current;
    playChime(finished, s.chimeVolume);
    m.engine.duck(4000);
    if (s.notify) notify(finished === 'focus' ? 'Hết giờ tập trung! Nghỉ chút nào ☕' : 'Hết giờ nghỉ! Quay lại làm việc 💪');
    setEndInfo({
      finished,
      completed: completedRef.current + (finished === 'focus' ? 1 : 0),
      nextMin: next === 'focus' ? s.focusMin : s.breakMin,
      autoStarted: s.autoStartNext,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timer = useTimer({
    focusMs: settings.focusMin * 60_000,
    breakMs: settings.breakMin * 60_000,
    autoStartNext: settings.autoStartNext,
    onFinish,
  });
  completedRef.current = timer.completed;

  // Tự đóng popup nếu phiên tiếp theo đã tự chạy
  useEffect(() => {
    if (!endInfo?.autoStarted) return undefined;
    const t = setTimeout(() => setEndInfo(null), 8000);
    return () => clearTimeout(t);
  }, [endInfo]);

  // Nhạc theo phiên: phát khi đang tập trung, dừng khi nghỉ / tạm dừng
  useEffect(() => {
    if (!settings.musicFollowTimer) return;
    if (timer.running && timer.mode === 'focus') m.engine.play();
    else m.engine.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.running, timer.mode]);

  // Tiêu đề tab
  useEffect(() => {
    document.title = timer.started
      ? `${fmtTime(timer.remaining)} · ${timer.mode === 'focus' ? 'Tập trung' : 'Nghỉ'}`
      : 'Pomodoro Music';
  }, [timer.remaining, timer.mode, timer.started]);

  // Lưu vào thư viện mỗi khi tải link thành công
  useEffect(() => {
    m.engine.onSourceLoaded = (source, firstId, count) => {
      setHistory((h) => [{ url: source.url, firstId, count }, ...h.filter((x) => x.url !== source.url)].slice(0, 30));
    };
  }, [m.engine, setHistory]);

  // Nạp sẵn (không tự phát) link dùng lần trước
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const last = store.get('lastLink', null);
    const parsed = last && parseYouTube(last);
    if (parsed) m.engine.load(parsed, last, false);
  }, [m.engine]);

  // Mở khoá âm thanh ngay lần click đầu tiên để chuông kêu được cả khi tab chạy nền
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Phím tắt: Space = bắt đầu / tạm dừng
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || ['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      timer.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timer]);

  const load = (parsed, url) => {
    if (!parsed) return;
    // Trong màn phiên hoặc khi timer đang chạy thì phát luôn; ở dashboard chỉ nạp sẵn
    const autoplay = view === 'session' || (timer.running && (timer.mode === 'focus' || !settings.musicFollowTimer));
    m.engine.load(parsed, url, autoplay);
  };

  const startSession = () => {
    timer.start();
    setView('session');
  };

  return (
    <div className={`app mode-${timer.mode}`}>
      {view === 'dashboard' ? (
        <Dashboard
          m={m}
          timer={timer}
          settings={settings}
          setSettings={setSettings}
          history={history}
          onLoad={load}
          onRemoveHistory={(url) => setHistory((h) => h.filter((x) => x.url !== url))}
          onStart={startSession}
          onOpenSession={() => setView('session')}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : (
        <Session
          m={m}
          timer={timer}
          onBack={() => setView('dashboard')}
          onLoad={load}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {showSettings && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
      {endInfo && (
        <SessionEndModal
          info={endInfo}
          onClose={() => setEndInfo(null)}
          onStartNext={() => {
            setEndInfo(null);
            timer.start();
          }}
        />
      )}
    </div>
  );
}
