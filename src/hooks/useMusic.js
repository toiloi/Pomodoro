import { useEffect, useSyncExternalStore } from 'react';
import { music } from '../lib/musicEngine.js';

export function useMusic() {
  useEffect(() => {
    music.init();
  }, []);
  const state = useSyncExternalStore(music.subscribe, music.getSnapshot);
  const nowIdx = state.pos >= 0 ? state.order[state.pos] : -1;
  const nowTrack = state.queue[nowIdx] || null;
  const nowMeta = nowTrack ? state.meta[nowTrack.id] : null;
  return { ...state, nowIdx, nowTrack, nowMeta, engine: music };
}
