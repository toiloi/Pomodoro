let ctx = null;

function getCtx() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Gọi trong một thao tác click để trình duyệt cho phép phát âm thanh về sau. */
export function unlockAudio() {
  try {
    getCtx();
  } catch {
    /* ignore */
  }
}

/** Một tiếng chuông: âm cơ bản + các hoạ âm kiểu chuông, tắt dần. */
function strike(ac, out, freq, t, length = 1.8) {
  const partials = [
    [1, 1],
    [2, 0.5],
    [2.76, 0.35],
    [5.4, 0.18],
  ];
  for (const [ratio, amp] of partials) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    const decay = length / (1 + ratio * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }
}

/**
 * Chuông báo hết phiên.
 * kind = 'focus' (hết giờ tập trung, giai điệu đi xuống) | 'break' (hết giờ nghỉ, đi lên)
 * volume: 0..1
 */
export function playChime(kind = 'focus', volume = 0.9) {
  try {
    const ac = getCtx();
    const master = ac.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume)) * 1.2;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp).connect(ac.destination);

    // E6 C6 G6 / C6 E6 G6 C7
    const melody = kind === 'focus' ? [1318.5, 1046.5, 1568, 1046.5] : [1046.5, 1318.5, 1568, 2093];
    const start = ac.currentTime + 0.05;
    // Lặp 2 lượt cho rõ
    for (let r = 0; r < 2; r++) {
      melody.forEach((f, i) => strike(ac, master, f, start + r * 1.6 + i * 0.28, i === melody.length - 1 ? 2.2 : 1.4));
    }
    return 3.6; // thời lượng (giây)
  } catch {
    return 0;
  }
}
