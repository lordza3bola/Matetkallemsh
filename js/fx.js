// Sounds (generated with WebAudio, no files), confetti and screen wake lock.

// Sounds: every effect is synthesized once into a short WAV clip (OfflineAudioContext) and played
// through <audio> elements. No looping silent track (that was what showed up as "now playing" and
// kept real sounds from playing). <audio> also plays on iPhone with the silent switch on.

const prefs = { sound: true };
export function setPrefs(p) { Object.assign(prefs, p); if (!prefs.sound) stopMusic(); }
export function getPrefs() { return { ...prefs }; }

// Fadil's picks per moment (A/B/C). Set after he chooses on the V4 picks page.
export const PICKS = { start: 'A', tick: 'A', last: 'A', correct: 'A', skip: 'A', foul: 'A', help: 'A', timeup: 'A', win: 'A', tap: 'A', music: 'C' };

// Each def: [seconds, (T) => draws with T.tone / T.noise / T.seq]
const seqOf = T => (ns, step, type, v, len) => ns.forEach((f, i) => f && T.tone(f, i * step, len || step * 1.4, type, v));
const DEFS = {
  start: { A: [1, T => { T.tone(180, 0, .35, 'sine', .3, 700); T.tone(900, .33, .12, 'square', .12); }],
           B: [0.6, T => T.tone(500, 0, .5, 'sine', .25, 1800, [7, 30])],
           C: [0.7, T => { T.noise(0, .08, .6, 3000); T.seq([0, 0, 784, 1046], .12, 'triangle', .2); }] },
  tick: { A: [0.15, T => T.tone(1000, 0, .06, 'sine', .3)], B: [0.15, T => T.tone(650, 0, .05, 'triangle', .3)], C: [0.15, T => T.tone(400, 0, .07, 'sine', .3, 1100)] },
  last: { A: [0.2, T => T.tone(1500, 0, .09, 'sine', .35)], B: [0.25, T => { T.tone(800, 0, .05, 'triangle', .3); T.tone(800, .1, .05, 'triangle', .3); }], C: [0.2, T => T.tone(600, 0, .1, 'sine', .35, 1800)] },
  correct: { A: [0.5, T => { T.tone(988, 0, .08, 'square', .15); T.tone(1319, .08, .35, 'square', .15); }],
             B: [0.6, T => T.seq([523, 659, 784, 1046, 1319], .07, 'triangle', .22)],
             C: [0.8, T => { T.tone(600, 0, .25, 'sine', .2, 1600); T.seq([0, 0, 0, 0, 1568, 2093], .06, 'sine', .2, .4); }] },
  skip: { A: [0.4, T => T.noise(0, .35, .5, 400, 4000, 2)], B: [0.5, T => T.tone(700, 0, .4, 'sine', .3, 140, [18, 40])],
          C: [0.6, T => { T.tone(330, 0, .18, 'sawtooth', .12, 300); T.tone(260, .2, .3, 'sawtooth', .12, 200); }] },
  foul: { A: [0.7, T => { T.tone(2800, 0, .18, 'sine', .2, null, [60, 250]); T.tone(2800, .24, .4, 'sine', .2, null, [60, 250]); }],
          B: [0.5, T => { T.tone(220, 0, .18, 'sawtooth', .2); T.tone(277, 0, .18, 'square', .1); T.tone(220, .24, .22, 'sawtooth', .2); }],
          C: [0.6, T => { T.tone(660, 0, .18, 'triangle', .25); T.tone(494, .2, .35, 'triangle', .25); }] },
  help: { A: [0.4, T => T.seq([1568, 2093, 2637, 3136], .05, 'triangle', .12)], B: [0.6, T => T.seq([523, 587, 659, 784, 880, 1046, 1175, 1319], .035, 'sine', .15, .3)],
          C: [0.7, T => { T.tone(1760, 0, .6, 'sine', .2); T.tone(2637, 0, .4, 'sine', .08); }] },
  timeup: { A: [2, T => [392, 370, 349, 330].forEach((f, i) => T.tone(f, i * .32, i < 3 ? .3 : .9, 'sawtooth', .13, i < 3 ? null : 300, i < 3 ? null : [6, 10]))],
            B: [1, T => T.tone(1000, 0, .9, 'square', .12, null, [25, 200])],
            C: [1, T => { T.tone(130, 0, .5, 'sawtooth', .2); T.tone(500, .5, .4, 'sine', .25, 120); }] },
  win: { A: [1.3, T => T.seq([523, 523, 523, 659, 0, 784, 0, 1046], .13, 'triangle', .2)],
         B: [1.2, T => { T.seq([392, 440, 494, 523, 494, 523, 659], .14, 'sawtooth', .1); [0, .28, .56, .84].forEach(t => T.noise(t, .06, .5, 3000)); }],
         C: [1.4, T => T.seq([784, 659, 784, 880, 784, 659, 523, 659, 784, 1046], .11, 'square', .1)] },
  tap: { A: [0.1, T => T.tone(500, 0, .06, 'sine', .2, 900)], B: [0.06, T => T.noise(0, .025, .4, 4000, null, 3)], C: [0.08, T => T.tone(880, 0, .05, 'square', .08)] },
  music: { A: [1.44, T => { [131, 0, 196, 0, 165, 0, 196, 0].forEach((f, i) => { f && T.tone(f, i * .18, .18, 'triangle', .18); i % 2 || T.noise(i * .18, .03, .2, 5000); }); }],
           B: [2.4, T => { for (let i = 0; i < 8; i++) { T.tone(i % 2 ? 650 : 900, i * .3, .05, 'triangle', .25); if (!i) T.tone(98, 0, .4, 'sine', .3); } }],
           C: null },
};

function painter(c) {
  const out = c.destination;
  const T = {
    tone(f, t, d, type = 'triangle', v = .2, f2, vib) {
      const o = c.createOscillator(), g = c.createGain(), s = c.currentTime + t;
      o.type = type; o.frequency.setValueAtTime(f, s);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, s + d);
      if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib[0]; lg.gain.value = vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(s); l.stop(s + d + .05); }
      g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(v * 2, s + .01); g.gain.exponentialRampToValueAtTime(.0001, s + d);
      o.connect(g); g.connect(out); o.start(s); o.stop(s + d + .05);
    },
    noise(t, d, v = .3, ff = 2000, ff2, q = 1) {
      const n = Math.max(1, Math.floor(c.sampleRate * d)), b = c.createBuffer(1, n, c.sampleRate), x = b.getChannelData(0);
      for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), st = c.currentTime + t;
      src.buffer = b; fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(ff, st);
      if (ff2) fl.frequency.exponentialRampToValueAtTime(ff2, st + d);
      g.gain.setValueAtTime(v * 2, st); g.gain.exponentialRampToValueAtTime(.0001, st + d);
      src.connect(fl); fl.connect(g); g.connect(out); src.start(st);
    },
  };
  T.seq = seqOf(T);
  return T;
}

function wavUrl(buf) {
  const d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
  return URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }));
}

const clips = {}; // name -> { els: [Audio, Audio], i }
let built = null;
function build() {
  if (built) return built;
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Off) return (built = Promise.resolve());
  built = Promise.all(Object.keys(DEFS).map(async name => {
    const def = DEFS[name][PICKS[name]]; if (!def) return;
    const [sec, draw] = def, rate = 22050;
    const c = new Off(1, Math.ceil(rate * (sec + 0.1)), rate);
    draw(painter(c));
    const buf = await new Promise((res, rej) => { const p = c.startRendering(); if (p && p.then) p.then(res, rej); else c.oncomplete = e => res(e.renderedBuffer); });
    const url = wavUrl(buf), n = name === 'tick' || name === 'tap' ? 3 : 1;
    clips[name] = { i: 0, els: Array.from({ length: n }, () => { const a = new Audio(url); a.preload = 'auto'; a.setAttribute('playsinline', ''); if (name === 'music') { a.loop = true; a.volume = 0.35; } return a; }) };
  })).catch(() => {});
  return built;
}
build();

// Phones only allow audio after a tap: play every clip muted once inside the first taps.
let unlocked = false;
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  build().then(() => Object.values(clips).forEach(c => c.els.forEach(a => {
    a.muted = true;
    const p = a.play();
    const done = () => { a.pause(); a.currentTime = 0; a.muted = false; };
    if (p && p.then) p.then(done, () => { a.muted = false; unlocked = false; }); else done();
  })));
}

function play(name) {
  if (!prefs.sound) return;
  const c = clips[name]; if (!c) return;
  const a = c.els[c.i++ % c.els.length];
  try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch {}
}

export function startMusic() { if (prefs.sound && clips.music) play('music'); }
export function stopMusic() { const c = clips.music; if (c) c.els.forEach(a => { a.pause(); a.currentTime = 0; }); }

export const sfx = {
  tap: () => play('tap'), clap: () => play('start'), start: () => play('start'),
  tick: () => play('tick'), lastTick: () => play('last'),
  correct: () => play('correct'), skip: () => play('skip'), buzzer: () => play('timeup'),
  foul: () => play('foul'), help: () => play('help'), win: () => play('win'),
};


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
