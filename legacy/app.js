'use strict';

/* ================= Tiện ích ================= */
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const setAll = (sel, fn) => $$(sel).forEach(fn);

function showView(view) {
  document.body.dataset.view = view;
  window.scrollTo(0, 0);
  if (view === 'session') scrollActiveIntoView();
}

/* ================= Settings ================= */
const DEFAULTS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  rounds: 4,
  musicFollowTimer: true,
  autoStartNext: false,
  notify: false,
  volume: 60,
  loop: true,
  shuffle: false,
};
const settings = { ...DEFAULTS, ...store.get('settings', {}) };
const saveSettings = () => store.set('settings', settings);

function fillSettingsForm() {
  for (const k of ['focusMin', 'shortMin', 'longMin', 'rounds']) $(k).value = settings[k];
  for (const k of ['musicFollowTimer', 'autoStartNext', 'notify']) $(k).checked = settings[k];
}

$('settingsToggle').addEventListener('click', () => {
  fillSettingsForm();
  $('settings').classList.toggle('hidden');
});

$('saveSettings').addEventListener('click', () => {
  const num = (id, min, max) => {
    const n = Math.round(parseFloat($(id).value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : settings[id];
  };
  settings.focusMin = num('focusMin', 1, 300);
  settings.shortMin = num('shortMin', 1, 120);
  settings.longMin = num('longMin', 1, 120);
  settings.rounds = num('rounds', 1, 12);
  settings.musicFollowTimer = $('musicFollowTimer').checked;
  settings.autoStartNext = $('autoStartNext').checked;
  settings.notify = $('notify').checked;
  saveSettings();

  if (settings.notify && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  $('settings').classList.add('hidden');
  // Áp dụng thời gian mới nếu timer đang không chạy
  if (!timer.running) setMode(timer.mode, false);
});

/* ================= Timer ================= */
const MODE_LABEL = { focus: 'Tập trung', short: 'Nghỉ ngắn', long: 'Nghỉ dài' };
const durationOf = (mode) =>
  ({ focus: settings.focusMin, short: settings.shortMin, long: settings.longMin }[mode]) * 60 * 1000;

const timer = {
  mode: 'focus',
  total: durationOf('focus'),
  remaining: durationOf('focus'),
  endAt: 0,
  running: false,
  completedFocus: 0,
  intervalId: null,
};

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
}

function render() {
  const time = fmt(timer.remaining);
  const startLabel = timer.running ? 'Tạm dừng' : (timer.remaining < timer.total ? 'Tiếp tục' : 'Bắt đầu');
  const roundText = timer.mode === 'focus'
    ? `Phiên #${timer.completedFocus + 1} · còn ${settings.rounds - (timer.completedFocus % settings.rounds)} phiên tới nghỉ dài`
    : `Đã xong ${timer.completedFocus} phiên tập trung`;

  setAll('.js-time', (el) => { el.textContent = time; });
  setAll('.js-bar', (el) => { el.style.width = `${(1 - timer.remaining / timer.total) * 100}%`; });
  setAll('.js-round', (el) => { el.textContent = roundText; });
  setAll('.js-mode-label', (el) => { el.textContent = MODE_LABEL[timer.mode]; });
  $('dashStart').textContent = timer.running ? 'Vào phiên ▸' : startLabel;
  $('sessionStartPause').textContent = startLabel;

  document.title = `${time} · ${MODE_LABEL[timer.mode]}`;
  document.body.dataset.mode = timer.mode;
  setAll('.mode', (b) => b.classList.toggle('active', b.dataset.mode === timer.mode));
}

function tick() {
  timer.remaining = timer.endAt - Date.now();
  if (timer.remaining <= 0) {
    timer.remaining = 0;
    finish();
    return;
  }
  render();
}

function start() {
  if (timer.running) return;
  timer.running = true;
  timer.endAt = Date.now() + timer.remaining;
  timer.intervalId = setInterval(tick, 250);
  syncMusicWithTimer();
  render();
}

function pause() {
  if (!timer.running) return;
  timer.running = false;
  clearInterval(timer.intervalId);
  timer.remaining = Math.max(0, timer.endAt - Date.now());
  if (settings.musicFollowTimer) music.pause();
  render();
}

function setMode(mode, autoStart) {
  pause();
  timer.mode = mode;
  timer.total = timer.remaining = durationOf(mode);
  render();
  if (autoStart) start();
}

function nextMode() {
  if (timer.mode === 'focus') {
    timer.completedFocus++;
    return timer.completedFocus % settings.rounds === 0 ? 'long' : 'short';
  }
  return 'focus';
}

function finish() {
  clearInterval(timer.intervalId);
  timer.running = false;
  const finished = timer.mode;
  const next = nextMode();
  chime();
  notify(finished === 'focus' ? 'Hết giờ tập trung! Nghỉ chút nào ☕' : 'Hết giờ nghỉ! Quay lại làm việc 💪');
  setMode(next, settings.autoStartNext);
  if (!settings.autoStartNext && settings.musicFollowTimer) music.pause();
}

$('dashStart').addEventListener('click', () => {
  start();
  showView('session');
});
$('sessionStartPause').addEventListener('click', () => (timer.running ? pause() : start()));
$('backDash').addEventListener('click', () => showView('dashboard'));
$('openPlayer').addEventListener('click', () => showView('session'));
setAll('.js-reset', (b) => b.addEventListener('click', () => setMode(timer.mode, false)));
setAll('.js-skip', (b) => b.addEventListener('click', () => setMode(nextMode(), timer.running)));
setAll('.mode', (b) => b.addEventListener('click', () => setMode(b.dataset.mode, false)));

// Phím tắt: Space = bắt đầu/tạm dừng (khi không gõ trong ô input)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    timer.running ? pause() : start();
  }
});

function syncMusicWithTimer() {
  if (!settings.musicFollowTimer) return;
  if (timer.mode === 'focus') music.play();
  else music.pause();
}

/* ================= Âm báo & thông báo ================= */
let audioCtx;
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [880, 660, 880].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.35;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  } catch { /* ignore */ }
}

function notify(text) {
  if (!settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification('Pomodoro Music', { body: text }); } catch { /* ignore */ }
}

/* ================= Đọc link YouTube ================= */
/**
 * Tách videoId / listId từ link YouTube.
 * Hỗ trợ: watch?v=, youtu.be/, /shorts/, /embed/, /live/, playlist?list=, music.youtube.com,
 * hoặc dán thẳng ID video (11 ký tự) / ID playlist.
 */
function parseYouTube(input) {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[\w-]{11}$/.test(raw)) return { videoId: raw, listId: null };
  if (/^(PL|OL|UU|FL|RD|LL)[\w-]{10,}$/.test(raw)) return { videoId: null, listId: raw };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch { return null; }

  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let videoId = null;
  const listId = url.searchParams.get('list');

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/')[1] || null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    videoId = url.searchParams.get('v');
    const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
    if (!videoId && m) videoId = m[2];
  } else {
    return null;
  }

  if (videoId && !/^[\w-]{11}$/.test(videoId)) videoId = null;
  if (!videoId && !listId) return null;
  return { videoId, listId };
}

/* ================= Thông tin bài (tên, kênh) ================= */
const thumb = (id, q = 'mqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
const metaCache = store.get('meta', {});
let metaSaveTimer = null;
function saveMetaSoon() {
  clearTimeout(metaSaveTimer);
  metaSaveTimer = setTimeout(() => {
    const keys = Object.keys(metaCache);
    // Giới hạn cache để không đầy localStorage
    if (keys.length > 3000) keys.slice(0, keys.length - 3000).forEach((k) => delete metaCache[k]);
    store.set('meta', metaCache);
  }, 1000);
}

async function fetchOEmbed(id) {
  const watch = encodeURIComponent(`https://www.youtube.com/watch?v=${id}`);
  const endpoints = [
    `https://www.youtube.com/oembed?format=json&url=${watch}`,
    `https://noembed.com/embed?url=${watch}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.title) return { title: data.title, author: data.author_name || '' };
    } catch { /* thử endpoint tiếp */ }
  }
  return null;
}

// Hàng đợi tải thông tin, chạy song song tối đa 4 request
const metaQueue = [];
let metaWorkers = 0;
function requestMeta(id) {
  if (metaCache[id]) return;
  metaQueue.push(id);
  while (metaWorkers < 4 && metaQueue.length) runMetaWorker();
}
async function runMetaWorker() {
  metaWorkers++;
  while (metaQueue.length) {
    const id = metaQueue.shift();
    if (metaCache[id]) continue;
    const meta = await fetchOEmbed(id);
    if (meta) {
      metaCache[id] = meta;
      saveMetaSoon();
      onMetaUpdated(id);
    }
  }
  metaWorkers--;
}

/* ================= Trình phát & hàng đợi ================= */
let player = null;
let playerReady = false;
let pendingLoad = null;   // link chờ player sẵn sàng
let loadToken = 0;        // huỷ lần tải cũ khi người dùng dán link mới
let listCued = false;

let source = null;        // { url, listId, videoId }
let queue = [];           // [{ id, unavailable }]
let order = [];           // thứ tự phát (index trong queue), đã trộn nếu bật shuffle
let pos = -1;             // vị trí hiện tại trong order
let isPlaying = false;
let queueEls = [];

const nowIdx = () => (pos >= 0 ? order[pos] : -1);
const nowTrack = () => queue[nowIdx()];
const titleOf = (id) => metaCache[id]?.title || 'Đang tải tên bài…';
const authorOf = (id) => metaCache[id]?.author || '';

window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player('player', {
    width: '200',
    height: '200',
    playerVars: { playsinline: 1, rel: 0, controls: 0 },
    events: {
      onReady() {
        playerReady = true;
        player.setVolume(settings.volume);
        if (pendingLoad) {
          const p = pendingLoad;
          pendingLoad = null;
          loadSource(p.parsed, p.url, p.autoplay);
        }
      },
      onStateChange: onPlayerState,
      onError: onPlayerError,
    },
  });
};

function setMsg(text, isError = false) {
  setAll('.js-msg', (el) => {
    el.textContent = text;
    el.classList.toggle('error', isError);
  });
}

function loadSource(parsed, url, autoplay) {
  if (!playerReady) {
    pendingLoad = { parsed, url, autoplay };
    setMsg('Đang khởi động trình phát YouTube…');
    return;
  }
  const token = ++loadToken;

  if (!parsed.listId) {
    setQueue([parsed.videoId], parsed.videoId, { url, ...parsed }, autoplay);
    return;
  }

  // Playlist: cue để YouTube trả về danh sách ID, sau đó tự quản lý việc phát
  setMsg('Đang lấy danh sách bài…');
  listCued = false;
  player.cuePlaylist({ list: parsed.listId, listType: 'playlist', index: 0 });
  const startedAt = Date.now();
  const poll = setInterval(() => {
    if (token !== loadToken) return clearInterval(poll);
    const ids = listCued ? player.getPlaylist() : null;
    if (ids && ids.length) {
      clearInterval(poll);
      setQueue(ids, parsed.videoId, { url, ...parsed }, autoplay);
    } else if (Date.now() - startedAt > 15000) {
      clearInterval(poll);
      setMsg('Không lấy được playlist (có thể là playlist riêng tư hoặc link sai).', true);
    }
  }, 300);
}

function setQueue(ids, startId, src, autoplay) {
  source = src;
  queue = ids.map((id) => ({ id, unavailable: false }));
  const startIdx = Math.max(0, startId ? ids.indexOf(startId) : 0);
  buildOrder(startIdx);
  renderQueue();
  ids.forEach(requestMeta);
  playIndex(startIdx, autoplay);

  setMsg(ids.length > 1 ? `Đã tải playlist ${ids.length} bài.` : 'Đã tải video.');
  store.set('lastLink', src.url);
  saveHistoryWhenTitled(src.url, ids[startIdx], ids.length);
}

function buildOrder(firstIdx) {
  order = queue.map((_, i) => i);
  if (settings.shuffle) {
    order = order.filter((i) => i !== firstIdx);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.unshift(firstIdx);
  }
  pos = order.indexOf(firstIdx);
}

function playIndex(idx, autoplay = true) {
  if (!queue[idx]) return;
  pos = order.indexOf(idx);
  const { id } = queue[idx];
  autoplay ? player.loadVideoById(id) : player.cueVideoById(id);
  updateNowPlaying();
  highlightActive();
}

function step(dir, auto = false) {
  if (!queue.length) return;
  for (let tries = 0; tries < queue.length; tries++) {
    let p = pos + dir;
    if (p >= order.length || p < 0) {
      if (!settings.loop && auto) { setPlaying(false); return; }
      p = (p + order.length) % order.length;
    }
    pos = p;
    if (!queue[order[pos]].unavailable) { playIndex(order[pos], true); return; }
  }
  setMsg('Không còn bài nào phát được trong danh sách.', true);
}

function onPlayerState(e) {
  const S = YT.PlayerState;
  if (e.data === S.CUED) listCued = true;

  if (e.data === S.PLAYING) {
    setPlaying(true);
    // Bổ sung tên bài từ player nếu oEmbed chưa có
    const t = nowTrack();
    const data = player.getVideoData?.() || {};
    if (t && !metaCache[t.id] && data.title) {
      metaCache[t.id] = { title: data.title, author: data.author || '' };
      saveMetaSoon();
      onMetaUpdated(t.id);
    }
  } else if (e.data === S.PAUSED || e.data === S.CUED) {
    setPlaying(false);
  } else if (e.data === S.ENDED) {
    if (queue.length === 1) {
      if (settings.loop) { player.seekTo(0, true); player.playVideo(); } else setPlaying(false);
    } else {
      step(1, true);
    }
  }
}

function onPlayerError(e) {
  const reasons = {
    2: 'Link không hợp lệ.',
    5: 'Lỗi trình phát HTML5.',
    100: 'Video không tồn tại hoặc đã bị xoá/riêng tư.',
    101: 'Chủ video không cho phép phát nhúng.',
    150: 'Chủ video không cho phép phát nhúng.',
    153: 'Thiếu thông tin origin – hãy mở web qua http://localhost thay vì mở file trực tiếp.',
  };
  const msg = reasons[e.data] || `Lỗi YouTube (${e.data}).`;
  const t = nowTrack();
  if (t) {
    t.unavailable = true;
    queueEls[nowIdx()]?.classList.add('unavailable');
  }
  if (queue.length > 1) {
    setMsg(`${msg} Đang chuyển bài tiếp theo…`, true);
    setTimeout(() => step(1, true), 800);
  } else {
    setMsg(msg, true);
    setPlaying(false);
  }
}

function setPlaying(on) {
  isPlaying = on;
  document.body.classList.toggle('playing', on);
  $('playPause').textContent = on ? '⏸' : '▶';
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
}

const music = {
  play() { if (playerReady && nowTrack()) player.playVideo(); },
  pause() { if (playerReady && nowTrack()) player.pauseVideo(); },
};

/* ================= Giao diện danh sách phát ================= */
function renderQueue() {
  const ol = $('queueList');
  ol.innerHTML = '';
  queueEls = [];
  $('queueCount').textContent = queue.length ? `· ${queue.length} bài` : '';

  if (!queue.length) {
    ol.innerHTML = '<li class="empty">Chưa có bài nào. Dán link YouTube bên dưới để bắt đầu.</li>';
    return;
  }

  queue.forEach((track, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="num"><span class="num-text">${i + 1}</span><span class="eq"><i></i><i></i><i></i></span></div>
      <img loading="lazy" alt="" />
      <div class="meta"><div class="t"></div><div class="a"></div></div>`;
    li.querySelector('img').src = thumb(track.id, 'default');
    li.addEventListener('click', () => {
      if (track.unavailable) return;
      playIndex(i, true);
    });
    queueEls.push(li);
    fillQueueItem(i);
    ol.append(li);
  });
  applyFilter();
  highlightActive();
}

function fillQueueItem(i) {
  const li = queueEls[i];
  if (!li) return;
  const { id } = queue[i];
  li.querySelector('.t').textContent = titleOf(id);
  li.querySelector('.a').textContent = authorOf(id);
  li.dataset.search = `${titleOf(id)} ${authorOf(id)}`.toLowerCase();
}

function highlightActive() {
  queueEls.forEach((li, i) => li.classList.toggle('active', i === nowIdx()));
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  const li = queueEls[nowIdx()];
  if (li && document.body.dataset.view === 'session') li.scrollIntoView({ block: 'nearest' });
}

function applyFilter() {
  const q = $('queueFilter').value.trim().toLowerCase();
  queueEls.forEach((li) => { li.hidden = q && !li.dataset.search.includes(q); });
}
$('queueFilter').addEventListener('input', applyFilter);

function onMetaUpdated(id) {
  queue.forEach((t, i) => { if (t.id === id) fillQueueItem(i); });
  if (nowTrack()?.id === id) updateNowPlaying();
  applyFilter();
}

function updateNowPlaying() {
  const t = nowTrack();
  if (!t) return;
  const title = titleOf(t.id);
  const author = authorOf(t.id);
  $('trackTitle').textContent = title;
  $('trackAuthor').textContent = queue.length > 1 ? `${author}${author ? ' · ' : ''}Bài ${nowIdx() + 1}/${queue.length}` : author;
  $('discLabel').style.backgroundImage = `url("${thumb(t.id, 'hqdefault')}")`;

  // Thẻ "đã tải" trên dashboard
  $('loadedInfo').classList.remove('hidden');
  $('loadedThumb').src = thumb(t.id);
  $('loadedTitle').textContent = title;
  $('loadedCount').textContent = queue.length > 1 ? `Playlist · ${queue.length} bài` : 'Video đơn';

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title, artist: author, artwork: [{ src: thumb(t.id, 'hqdefault'), sizes: '480x360', type: 'image/jpeg' }],
    });
  }
}

/* ================= Nút điều khiển nhạc ================= */
setAll('.js-link-form', (form) => form.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = form.querySelector('.js-link');
  const url = input.value.trim();
  const parsed = parseYouTube(url);
  if (!parsed) {
    setMsg('Không nhận ra link YouTube. Hãy dán link video hoặc playlist.', true);
    return;
  }
  // Ở dashboard chỉ nạp sẵn; trong màn hình phiên thì phát luôn
  const autoplay = document.body.dataset.view === 'session' || timer.running;
  loadSource(parsed, url, autoplay);
  input.value = '';
}));

$('playPause').addEventListener('click', () => {
  if (!playerReady || !nowTrack()) return;
  isPlaying ? player.pauseVideo() : player.playVideo();
});
$('prev').addEventListener('click', () => {
  if (!playerReady || !nowTrack()) return;
  if (player.getCurrentTime() > 3 || queue.length === 1) player.seekTo(0, true);
  else step(-1);
});
$('next').addEventListener('click', () => { if (playerReady) step(1); });

if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('play', () => music.play());
    navigator.mediaSession.setActionHandler('pause', () => music.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => $('prev').click());
    navigator.mediaSession.setActionHandler('nexttrack', () => $('next').click());
  } catch { /* ignore */ }
}

$('volume').value = settings.volume;
$('volume').addEventListener('input', (e) => {
  settings.volume = Number(e.target.value);
  if (playerReady) player.setVolume(settings.volume);
  saveSettings();
});

function bindToggle(id, key, apply) {
  const btn = $(id);
  btn.classList.toggle('on', settings[key]);
  btn.addEventListener('click', () => {
    settings[key] = !settings[key];
    btn.classList.toggle('on', settings[key]);
    saveSettings();
    apply?.(settings[key]);
  });
}
bindToggle('shuffle', 'shuffle', () => { if (queue.length) buildOrder(nowIdx()); });
bindToggle('loop', 'loop');

/* ================= Lịch sử link ================= */
function saveHistoryWhenTitled(url, firstId, count) {
  const label = () => {
    const t = metaCache[firstId]?.title || url;
    return count > 1 ? `📃 ${t} (+${count - 1} bài)` : t;
  };
  addHistory(url, label());
  if (!metaCache[firstId]) {
    // Cập nhật lại tên khi đã tải được thông tin bài
    const check = setInterval(() => {
      if (metaCache[firstId]) { clearInterval(check); addHistory(url, label()); }
    }, 1000);
    setTimeout(() => clearInterval(check), 20000);
  }
}

function addHistory(url, title) {
  const list = store.get('history', []).filter((h) => h.url !== url);
  list.unshift({ url, title });
  store.set('history', list.slice(0, 15));
  renderHistory();
}

function renderHistory() {
  const ul = $('historyList');
  ul.innerHTML = '';
  const list = store.get('history', []);
  if (!list.length) {
    ul.innerHTML = '<li>Chưa có link nào.</li>';
    return;
  }
  list.forEach((h) => {
    const li = document.createElement('li');
    const load = document.createElement('button');
    load.className = 'load';
    load.textContent = h.title;
    load.title = h.url;
    load.addEventListener('click', () => {
      const parsed = parseYouTube(h.url);
      if (parsed) loadSource(parsed, h.url, timer.running);
    });
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Xoá';
    del.addEventListener('click', () => {
      store.set('history', store.get('history', []).filter((x) => x.url !== h.url));
      renderHistory();
    });
    li.append(load, del);
    ul.append(li);
  });
}

/* ================= Khởi động ================= */
fillSettingsForm();
renderHistory();
renderQueue();
render();

// Nạp sẵn (không tự phát) link dùng lần trước
const last = store.get('lastLink', null);
const lastParsed = last && parseYouTube(last);
if (lastParsed) loadSource(lastParsed, last, false);
