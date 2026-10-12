import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pomodoro 2 chế độ: 'focus' và 'break'.
 * Dùng mốc kết thúc (endAt) thay vì đếm lùi để không bị lệch khi tab chạy nền.
 */
export function useTimer({ focusMs, breakMs, autoStartNext, onFinish }) {
  const [mode, setMode] = useState('focus');
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(focusMs);
  const [completed, setCompleted] = useState(0);
  const endAt = useRef(0);

  const durationOf = useCallback((m) => (m === 'focus' ? focusMs : breakMs), [focusMs, breakMs]);
  const total = durationOf(mode);

  // Lưu giá trị mới nhất vào ref để interval không bị dùng giá trị cũ
  const latest = useRef({});
  latest.current = { mode, durationOf, autoStartNext, onFinish };

  // Đổi thời lượng trong cài đặt khi đang dừng → cập nhật ngay
  useEffect(() => {
    if (!running) setRemaining(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const begin = useCallback((ms) => {
    endAt.current = Date.now() + ms;
    setRemaining(ms);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const left = endAt.current - Date.now();
      if (left > 0) {
        setRemaining(left);
        return;
      }
      // Hết phiên
      clearInterval(id);
      const { mode: finished, durationOf: dur, autoStartNext: auto, onFinish: cb } = latest.current;
      const next = finished === 'focus' ? 'break' : 'focus';
      if (finished === 'focus') setCompleted((c) => c + 1);
      setMode(next);
      setRunning(false);
      setRemaining(dur(next));
      if (auto) begin(dur(next));
      cb?.(finished, next);
    }, 250);
    return () => clearInterval(id);
  }, [running, begin]);

  const start = useCallback(() => {
    if (!running) begin(remaining);
  }, [running, remaining, begin]);

  const pause = useCallback(() => {
    if (!running) return;
    setRemaining(Math.max(0, endAt.current - Date.now()));
    setRunning(false);
  }, [running]);

  const toggle = useCallback(() => (running ? pause() : start()), [running, pause, start]);

  const reset = useCallback(() => {
    setRunning(false);
    setRemaining(total);
  }, [total]);

  const switchMode = useCallback(
    (m, keepRunning = false) => {
      setMode(m);
      if (keepRunning) begin(durationOf(m));
      else {
        setRunning(false);
        setRemaining(durationOf(m));
      }
    },
    [durationOf, begin],
  );

  const skip = useCallback(() => switchMode(mode === 'focus' ? 'break' : 'focus', running), [mode, running, switchMode]);

  return {
    mode,
    running,
    remaining,
    total,
    completed,
    progress: total ? 1 - remaining / total : 0,
    started: running || remaining < total,
    start,
    pause,
    toggle,
    reset,
    skip,
    switchMode,
  };
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
}

export function fmtSec(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
