/**
 * Tách videoId / listId từ link YouTube.
 * Hỗ trợ: watch?v=, youtu.be/, /shorts/, /embed/, /live/, playlist?list=, music.youtube.com,
 * hoặc dán thẳng ID video (11 ký tự) / ID playlist.
 */
export function parseYouTube(input) {
  const raw = (input || '').trim();
  if (!raw) return null;

  if (/^[\w-]{11}$/.test(raw)) return { videoId: raw, listId: null };
  if (/^(PL|OL|UU|FL|RD|LL)[\w-]{10,}$/.test(raw)) return { videoId: null, listId: raw };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

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

export const thumb = (id, q = 'mqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`;

export async function fetchOEmbed(id) {
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
    } catch {
      /* thử endpoint tiếp */
    }
  }
  return null;
}

let apiPromise = null;
/** Nạp YouTube IFrame API một lần duy nhất. */
export function loadYouTubeAPI() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return apiPromise;
}

export const YT_ERRORS = {
  2: 'Link không hợp lệ.',
  5: 'Lỗi trình phát HTML5.',
  100: 'Video không tồn tại hoặc đã bị xoá/riêng tư.',
  101: 'Chủ video không cho phép phát nhúng.',
  150: 'Chủ video không cho phép phát nhúng.',
  153: 'Thiếu thông tin origin – hãy mở web qua http://localhost.',
};
