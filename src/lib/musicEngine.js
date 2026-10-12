import { store } from './storage.js';
import { fetchOEmbed, loadYouTubeAPI, YT_ERRORS } from './youtube.js';

/**
 * Bộ phát nhạc: dùng YouTube IFrame player ẩn để lấy âm thanh,
 * tự quản lý hàng đợi (chọn bài, trộn, lặp, bỏ qua bài lỗi).
 * React đọc state qua subscribe/getSnapshot (useSyncExternalStore).
 */
class MusicEngine {
  state = {
    ready: false,
    source: null, // { url, videoId, listId }
    queue: [], // [{ id, unavailable }]
    order: [], // thứ tự phát (index trong queue)
    pos: -1, // vị trí hiện tại trong order
    isPlaying: false,
    loading: false,
    msg: null, // { text, error }
    meta: store.get('meta', {}), // id -> { title, author }
    current: 0,
    duration: 0,
    volume: store.get('volume', 70),
    shuffle: store.get('shuffle', false),
    loop: store.get('loop', true),
  };

  listeners = new Set();
  player = null;
  pending = null;
  loadToken = 0;
  listCued = false;
  progressTimer = null;
  duckTimer = null;
  metaQueue = [];
  metaWorkers = 0;
  metaSaveTimer = null;

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  // ---------- Khởi tạo ----------
  async init() {
    if (this.initStarted) return;
    this.initStarted = true;

    const host = document.createElement('div');
    host.className = 'yt-hidden';
    host.setAttribute('aria-hidden', 'true');
    const el = document.createElement('div');
    host.append(el);
    document.body.append(host);

    const YT = await loadYouTubeAPI();
    this.YT = YT;
    this.player = new YT.Player(el, {
      width: '200',
      height: '200',
      playerVars: { playsinline: 1, rel: 0, controls: 0 },
      events: {
        onReady: () => {
          this.player.setVolume(this.state.volume);
          this.set({ ready: true });
          if (this.pending) {
            const p = this.pending;
            this.pending = null;
            this.load(p.parsed, p.url, p.autoplay);
          }
        },
        onStateChange: (e) => this.onState(e.data),
        onError: (e) => this.onError(e.data),
      },
    });
  }

  // ---------- Getter tiện dụng ----------
  get nowIdx() {
    const { pos, order } = this.state;
    return pos >= 0 ? order[pos] : -1;
  }
  get nowTrack() {
    return this.state.queue[this.nowIdx];
  }

  msg(text, error = false) {
    this.set({ msg: text ? { text, error } : null });
  }

  // ---------- Tải link ----------
  load(parsed, url, autoplay) {
    if (!this.state.ready) {
      this.pending = { parsed, url, autoplay };
      this.msg('Đang khởi động trình phát…');
      return;
    }
    const token = ++this.loadToken;

    if (!parsed.listId) {
      this.setQueue([parsed.videoId], parsed.videoId, { url, ...parsed }, autoplay);
      return;
    }

    // Playlist: cue để YouTube trả về danh sách ID, sau đó tự phát từng bài
    this.set({ loading: true });
    this.msg('Đang lấy danh sách bài…');
    this.listCued = false;
    this.player.cuePlaylist({ list: parsed.listId, listType: 'playlist', index: 0 });
    const startedAt = Date.now();
    const poll = setInterval(() => {
      if (token !== this.loadToken) return clearInterval(poll);
      const ids = this.listCued ? this.player.getPlaylist() : null;
      if (ids?.length) {
        clearInterval(poll);
        this.setQueue(ids, parsed.videoId, { url, ...parsed }, autoplay);
      } else if (Date.now() - startedAt > 15000) {
        clearInterval(poll);
        this.set({ loading: false });
        this.msg('Không lấy được playlist (có thể là playlist riêng tư hoặc link sai).', true);
      }
    }, 300);
  }

  setQueue(ids, startId, source, autoplay) {
    const queue = ids.map((id) => ({ id, unavailable: false }));
    const startIdx = Math.max(0, startId ? ids.indexOf(startId) : 0);
    this.set({ source, queue, loading: false });
    this.buildOrder(startIdx);
    ids.forEach((id) => this.requestMeta(id));
    this.playIndex(startIdx, autoplay);
    this.msg(ids.length > 1 ? `Đã tải playlist ${ids.length} bài.` : 'Đã tải video.');
    store.set('lastLink', source.url);
    this.onSourceLoaded?.(source, ids[startIdx], ids.length);
  }

  buildOrder(firstIdx) {
    let order = this.state.queue.map((_, i) => i);
    if (this.state.shuffle && order.length > 1) {
      order = order.filter((i) => i !== firstIdx);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      order.unshift(firstIdx);
    }
    this.set({ order, pos: order.indexOf(firstIdx) });
  }

  // ---------- Điều khiển ----------
  playIndex(idx, autoplay = true) {
    const track = this.state.queue[idx];
    if (!track || !this.player) return;
    this.set({ pos: this.state.order.indexOf(idx), current: 0, duration: 0 });
    autoplay ? this.player.loadVideoById(track.id) : this.player.cueVideoById(track.id);
    this.updateMediaSession();
  }

  step(dir, auto = false) {
    const { queue, order } = this.state;
    if (!queue.length) return;
    let pos = this.state.pos;
    for (let tries = 0; tries < queue.length; tries++) {
      pos += dir;
      if (pos >= order.length || pos < 0) {
        if (!this.state.loop && auto) {
          this.set({ isPlaying: false });
          return;
        }
        pos = (pos + order.length) % order.length;
      }
      if (!queue[order[pos]].unavailable) {
        this.playIndex(order[pos], true);
        return;
      }
    }
    this.msg('Không còn bài nào phát được trong danh sách.', true);
  }

  next = () => this.step(1);
  prev = () => {
    if (!this.nowTrack) return;
    if (this.player.getCurrentTime() > 3 || this.state.queue.length === 1) this.seek(0);
    else this.step(-1);
  };
  play = () => {
    if (this.player && this.nowTrack) this.player.playVideo();
  };
  pause = () => {
    if (this.player && this.nowTrack) this.player.pauseVideo();
  };
  toggle = () => (this.state.isPlaying ? this.pause() : this.play());
  seek = (sec) => {
    if (!this.nowTrack) return;
    this.player.seekTo(sec, true);
    this.set({ current: sec });
  };
  setVolume = (v) => {
    this.set({ volume: v });
    store.set('volume', v);
    if (this.player && !this.duckTimer) this.player.setVolume(v);
  };
  toggleShuffle = () => {
    this.set({ shuffle: !this.state.shuffle });
    store.set('shuffle', this.state.shuffle);
    if (this.state.queue.length) this.buildOrder(this.nowIdx);
  };
  toggleLoop = () => {
    this.set({ loop: !this.state.loop });
    store.set('loop', this.state.loop);
  };

  /** Hạ nhỏ nhạc trong lúc chuông kêu để nghe rõ chuông. */
  duck(ms = 3500) {
    if (!this.player || !this.state.ready) return;
    clearTimeout(this.duckTimer);
    this.player.setVolume(Math.round(this.state.volume * 0.15));
    this.duckTimer = setTimeout(() => {
      this.duckTimer = null;
      this.player.setVolume(this.state.volume);
    }, ms);
  }

  // ---------- Sự kiện player ----------
  onState(s) {
    const S = this.YT.PlayerState;
    if (s === S.CUED) this.listCued = true;

    if (s === S.PLAYING) {
      this.set({ isPlaying: true, duration: this.player.getDuration() || 0 });
      this.startProgress();
      // Bổ sung tên bài từ player nếu oEmbed chưa có
      const t = this.nowTrack;
      const data = this.player.getVideoData?.() || {};
      if (t && !this.state.meta[t.id] && data.title) this.setMeta(t.id, { title: data.title, author: data.author || '' });
    } else if (s === S.PAUSED || s === S.CUED) {
      this.set({ isPlaying: false });
      this.stopProgress();
    } else if (s === S.ENDED) {
      this.stopProgress();
      if (this.state.queue.length === 1) {
        if (this.state.loop) {
          this.player.seekTo(0, true);
          this.player.playVideo();
        } else this.set({ isPlaying: false });
      } else {
        this.step(1, true);
      }
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.state.isPlaying ? 'playing' : 'paused';
    }
  }

  onError(code) {
    const text = YT_ERRORS[code] || `Lỗi YouTube (${code}).`;
    const idx = this.nowIdx;
    if (idx >= 0) {
      const queue = this.state.queue.slice();
      queue[idx] = { ...queue[idx], unavailable: true };
      this.set({ queue });
    }
    if (this.state.queue.length > 1) {
      this.msg(`${text} Đang chuyển bài tiếp theo…`, true);
      setTimeout(() => this.step(1, true), 800);
    } else {
      this.msg(text, true);
      this.set({ isPlaying: false });
    }
  }

  startProgress() {
    this.stopProgress();
    this.progressTimer = setInterval(() => {
      this.set({ current: this.player.getCurrentTime() || 0, duration: this.player.getDuration() || 0 });
    }, 500);
  }
  stopProgress() {
    clearInterval(this.progressTimer);
  }

  // ---------- Thông tin bài ----------
  setMeta(id, m) {
    this.set({ meta: { ...this.state.meta, [id]: m } });
    if (this.nowTrack?.id === id) this.updateMediaSession();
    clearTimeout(this.metaSaveTimer);
    this.metaSaveTimer = setTimeout(() => {
      const meta = { ...this.state.meta };
      const keys = Object.keys(meta);
      if (keys.length > 3000) keys.slice(0, keys.length - 3000).forEach((k) => delete meta[k]);
      store.set('meta', meta);
    }, 1000);
  }

  requestMeta(id) {
    if (this.state.meta[id]) return;
    this.metaQueue.push(id);
    while (this.metaWorkers < 4 && this.metaQueue.length) this.runMetaWorker();
  }

  async runMetaWorker() {
    this.metaWorkers++;
    while (this.metaQueue.length) {
      const id = this.metaQueue.shift();
      if (this.state.meta[id]) continue;
      const m = await fetchOEmbed(id);
      if (m) this.setMeta(id, m);
    }
    this.metaWorkers--;
  }

  updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.nowTrack) return;
    const { id } = this.nowTrack;
    const m = this.state.meta[id] || {};
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: m.title || 'Pomodoro Music',
        artist: m.author || '',
        artwork: [{ src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }],
      });
      navigator.mediaSession.setActionHandler('play', this.play);
      navigator.mediaSession.setActionHandler('pause', this.pause);
      navigator.mediaSession.setActionHandler('previoustrack', this.prev);
      navigator.mediaSession.setActionHandler('nexttrack', this.next);
    } catch {
      /* ignore */
    }
  }
}

export const music = new MusicEngine();
