// Sounds (generated with WebAudio, no files), vibration, confetti and screen wake lock.

let ctx = null;
const prefs = { sound: true, vibrate: true };

export function setPrefs(p) { Object.assign(prefs, p); }
export function getPrefs() { return { ...prefs }; }

function ac() {
  if (!prefs.sound) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

// iOS only allows audio after a tap: call once from any tap handler.
export function unlockAudio() { ac(); }

function tone(freq, start, dur, type = 'square', vol = 0.12) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g); g.connect(c.destination);
  o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.02);
}

export const sfx = {
  tap() { tone(660, 0, 0.05, 'triangle', 0.06); },
  clap() { // clapboard "klak"
    const c = ac(); if (!c) return;
    const len = 0.08, buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = c.createBufferSource(), g = c.createGain(); g.gain.value = 0.5;
    s.buffer = buf; s.connect(g); g.connect(c.destination); s.start();
  },
  tick() { tone(1200, 0, 0.04, 'square', 0.05); },
  lastTick() { tone(1500, 0, 0.07, 'square', 0.08); },
  correct() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.14)); vibrate([40, 40, 80]); },
  buzzer() { tone(140, 0, 0.6, 'sawtooth', 0.16); tone(110, 0.05, 0.6, 'sawtooth', 0.12); vibrate([300]); },
  foul() { [0, 0.18, 0.36].forEach(t => tone(880, t, 0.12, 'square', 0.14)); vibrate([80, 60, 80, 60, 80]); },
  help() { tone(880, 0, 0.08, 'triangle', 0.1); tone(1320, 0.08, 0.12, 'triangle', 0.1); },
  win() {
    const notes = [523, 523, 523, 659, 784, 659, 784, 1046];
    notes.forEach((f, i) => tone(f, i * 0.13, 0.2, 'triangle', 0.14));
    vibrate([60, 40, 60, 40, 160]);
  },
};

export function vibrate(p) {
  if (!prefs.vibrate) return;
  try { navigator.vibrate && navigator.vibrate(p); } catch {}
}

// ---------- confetti ----------
export function confetti(colors = ['#C8321F', '#F3B62E', '#1F5F7A', '#5B8C3A', '#FFF8EA']) {
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const dpr = window.devicePixelRatio || 1;
  const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const g = cv.getContext('2d');
  const bits = Array.from({ length: 140 }, () => ({
    x: Math.random() * W, y: -Math.random() * H * 0.6, w: (6 + Math.random() * 8) * dpr, h: (8 + Math.random() * 10) * dpr,
    vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  (function frame(t) {
    g.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vy += 0.03 * dpr;
      g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.c; g.strokeStyle = '#1F1410'; g.lineWidth = dpr;
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); g.restore();
    }
    if (t - t0 < 4200) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

// ---------- wake lock (keep the screen on during a game) ----------
let lock = null;
export async function keepAwake(on) {
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}
