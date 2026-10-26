// Avatars: big-head stickers for players (presets or a photo cut out on the phone)
// and cinema-stamp badges for teams (presets or a halftone photo).

// ---------- preset sticker heads ----------
const SKIN = ['#E9B48F', '#D9A07A', '#F0C29E', '#C98B62', '#E8B08A', '#B9774F', '#F3CFAF', '#D49A72'];
const HAIR = ['#4A2A1A', '#1F1410', '#2E1A12', '#3A2216', '#1F1410', '#6B3B1F', '#8A5A2B', '#1F1410'];
const LOOK = [
  { curly: 1, glasses: '#7A3E22', beard: 1 }, { wink: 1, beard: 1 }, { long: 1 }, { glasses: '#1F1410', beard: 1 },
  { bald: 1, mus: 1 }, { long: 1, glasses: '#C8321F' }, { curly: 1 }, { mus: 1, wink: 1 },
];
export const HEADS = LOOK.map((_, i) => 'h' + i);

function headSvg(i) {
  const p = { ...LOOK[i % 8], skin: SKIN[i % 8], hair: HAIR[i % 8] };
  const g = p.glasses ? `<circle cx="24" cy="31" r="7" fill="none" stroke="${p.glasses}" stroke-width="2.6"/><circle cx="40" cy="31" r="7" fill="none" stroke="${p.glasses}" stroke-width="2.6"/><path d="M31 31h2" stroke="${p.glasses}" stroke-width="2.4"/>` : '';
  const hair = p.bald ? `<path d="M14 26 C14 22 16 20 17 22 M50 26 C50 22 48 20 47 22" stroke="${p.hair}" stroke-width="4" fill="none"/>`
    : p.curly ? `<g fill="${p.hair}">${[[16, 16], [24, 11], [33, 9], [42, 12], [48, 19], [13, 24], [51, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5"/>`).join('')}</g>`
    : p.long ? `<path d="M10 30 C8 6 56 6 54 30 L56 58 L46 56 L46 26 L18 26 L18 56 L8 58Z" fill="${p.hair}"/>`
    : `<path d="M13 26 C12 6 52 6 51 26 C46 17 20 17 13 26Z" fill="${p.hair}"/>`;
  const eyes = p.wink ? `<circle cx="24" cy="32" r="2.2" fill="#1F1410"/><path d="M37 32q3 -2 6 0" stroke="#1F1410" stroke-width="2" fill="none"/>`
    : `<circle cx="24" cy="32" r="2.2" fill="#1F1410"/><circle cx="40" cy="32" r="2.2" fill="#1F1410"/>`;
  const beard = p.beard ? `<path d="M15 38 C16 56 48 56 49 38 C45 46 40 44 32 44 C24 44 19 46 15 38Z" fill="${p.hair}"/>` : '';
  const mus = p.mus ? `<path d="M24 42 q8 -5 16 0 q-8 2 -16 0Z" fill="${p.hair}"/>` : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="34" rx="18" ry="21" fill="${p.skin}"/>${hair}${eyes}<path d="M32 33 l-2 7 h4" stroke="#B5785A" stroke-width="1.6" fill="none"/><path d="M26 46 q6 4 12 0" stroke="#7A2A1A" stroke-width="2" fill="none"/>${beard}${mus}${g}</svg>`;
}

export function randomHead() { return HEADS[Math.floor(Math.random() * HEADS.length)]; }
const tilt = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return ((Math.abs(h) % 17) - 8); };

// Inner HTML of a player avatar ('' when none).
export function avatarInner(a, key = '') {
  if (!a) return '';
  const r = tilt(key || a.slice(-12));
  if (a.startsWith('data:image')) return `<img class="stk photo" style="transform:rotate(${r}deg)" src="${a}" alt="">`;
  const i = HEADS.indexOf(a);
  return i < 0 ? '' : `<span class="stk" style="transform:rotate(${r}deg)">${headSvg(i)}</span>`;
}

// ---------- team stamps ----------
export const TEAM_ICONS = {
  tarb: `<svg viewBox="0 0 40 40"><path d="M9 32 L12 10 Q20 6 28 10 L31 32 Z" fill="#C8321F" stroke="#1F1410" stroke-width="2"/><ellipse cx="20" cy="32" rx="11" ry="3" fill="#A9261A" stroke="#1F1410" stroke-width="2"/><path d="M20 8 q8 6 6 16" stroke="#1F1410" stroke-width="2" fill="none"/><circle cx="26" cy="25" r="2.4" fill="#1F1410"/></svg>`,
  reel: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#1F1410"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="${(20 + 9 * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(20 + 9 * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="4" fill="#FFF8EA"/>`).join('')}<circle cx="20" cy="20" r="2.5" fill="#FFF8EA"/></svg>`,
  clap: `<svg viewBox="0 0 40 40"><rect x="5" y="16" width="30" height="18" rx="2" fill="#1F1410"/><path d="M5 9 l29 -5 l2 8 l-29 5z" fill="#FFF8EA" stroke="#1F1410" stroke-width="2"/><path d="M11 8 l5 7 M19 7 l5 7 M27 5 l5 7" stroke="#1F1410" stroke-width="3"/></svg>`,
  mic: `<svg viewBox="0 0 40 40"><rect x="14" y="5" width="12" height="20" rx="6" fill="#1F1410"/><path d="M10 20 q10 12 20 0 M20 31 v5 M14 36 h12" stroke="#1F1410" stroke-width="2.5" fill="none"/></svg>`,
  pop: `<svg viewBox="0 0 40 40"><path d="M10 14 L13 36 H27 L30 14Z" fill="#FFF8EA" stroke="#1F1410" stroke-width="2"/><path d="M15 14 L16 36 M20 14 V36 M25 14 L24 36" stroke="#C8321F" stroke-width="3"/>${[[12, 12], [18, 9], [24, 10], [29, 12], [21, 5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#F3B62E" stroke="#1F1410" stroke-width="1.5"/>`).join('')}</svg>`,
  mask: `<svg viewBox="0 0 40 40"><path d="M7 9 Q20 4 33 9 Q34 28 20 34 Q6 28 7 9Z" fill="#FFF8EA" stroke="#1F1410" stroke-width="2"/><path d="M12 16 q3 -3 6 0 M22 16 q3 -3 6 0" stroke="#1F1410" stroke-width="2.5" fill="none"/><path d="M13 23 q7 7 14 0" stroke="#1F1410" stroke-width="2.5" fill="none"/></svg>`,
};
export const TEAM_DEFAULT = ['tarb', 'reel'];

export function teamBadge(icon, color = '#F3B62E', cls = '') {
  const ic = icon || 'reel';
  const inner = ic.startsWith('data:image') ? `<img src="${ic}" alt=""><i class="ht"></i>` : (TEAM_ICONS[ic] || TEAM_ICONS.reel);
  return `<span class="tb ${cls} ${ic.startsWith('data:') ? 'photo' : ''}" style="background:${ic.startsWith('data:') ? '#FFF8EA' : color}">${inner}</span>`;
}

// ---------- image processing ----------
function loadImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => rej(new Error('Mesh 3arfeen nefta7 el sora di.'));
    img.src = url;
  });
}
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function scaled(img, max) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = canvasOf(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
function exportSmall(c) {
  const w = c.toDataURL('image/webp', 0.86);
  return w.startsWith('data:image/webp') ? w : c.toDataURL('image/png');
}

// Team photo: square center crop, small JPEG (the halftone look is CSS).
export async function teamPhoto(file) {
  const img = await loadImg(file);
  const s = Math.min(img.naturalWidth, img.naturalHeight), c = canvasOf(120, 120);
  c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 120, 120);
  return c.toDataURL('image/jpeg', 0.8);
}

// MediaPipe multiclass selfie segmenter, loaded only when someone uploads a photo.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
let segP = null;
function segmenter() {
  if (!segP) segP = (async () => {
    const v = await import(/* @vite-ignore */ MP + '/vision_bundle.mjs');
    const files = await v.FilesetResolver.forVisionTasks(MP + '/wasm');
    return v.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
    });
  })().catch(e => { segP = null; throw e; });
  return segP;
}

// Head mask: hair (1) + face skin (3), plus accessories (5) only near the head.
async function headMask(c) {
  const seg = await segmenter();
  let cats = null, mw = 0, mh = 0;
  seg.segment(c, r => { const m = r.categoryMask; mw = m.width; mh = m.height; cats = m.getAsUint8Array().slice(); m.close && m.close(); });
  if (!cats) throw new Error('no mask');
  let x0 = mw, y0 = mh, x1 = -1, y1 = -1;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const k = cats[y * mw + x];
    if (k === 1 || k === 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0 || (x1 - x0) * (y1 - y0) < mw * mh * 0.01) throw new Error('no head');
  const a = new Float32Array(mw * mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const k = cats[y * mw + x];
    a[y * mw + x] = (k === 1 || k === 3 || (k === 5 && x >= x0 && x <= x1 && y >= y0 && y <= y1)) ? 1 : 0;
  }
  return { a: blur(blur(a, mw, mh, 2), mw, mh, 2), mw, mh, box: [x0, y0, x1, y1] };
}
function blur(a, w, h, r) { // separable box blur
  const t = new Float32Array(a.length), o = new Float32Array(a.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let d = -r; d <= r; d++) s += a[y * w + Math.min(w - 1, Math.max(0, x + d))]; t[y * w + x] = s / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let d = -r; d <= r; d++) s += t[Math.min(h - 1, Math.max(0, y + d)) * w + x]; o[y * w + x] = s / n; }
  return o;
}

// Photo -> big-head sticker (transparent PNG/WebP with a thick white border).
// Returns { av, cut } — cut=false means we fell back to an oval crop.
export async function makeSticker(file) {
  const src = scaled(await loadImg(file), 640);
  const W = src.width, H = src.height;
  let cut = canvasOf(W, H), ok = true, box;
  const cx = cut.getContext('2d');
  cx.drawImage(src, 0, 0);
  try {
    const m = await headMask(src);
    const id = cx.getImageData(0, 0, W, H), d = id.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = m.a[Math.min(m.mh - 1, Math.floor(y * m.mh / H)) * m.mw + Math.min(m.mw - 1, Math.floor(x * m.mw / W))];
      d[(y * W + x) * 4 + 3] = Math.max(0, Math.min(255, (v - 0.3) / 0.4 * 255));
    }
    cx.putImageData(id, 0, 0);
    const [x0, y0, x1, y1] = m.box, sx = W / m.mw, sy = H / m.mh;
    box = [x0 * sx, y0 * sy, (x1 + 1) * sx, (y1 + 1) * sy];
  } catch (e) {
    ok = false; // oval crop around the upper middle of the photo
    const bw = Math.min(W, H) * 0.7, bh = bw * 1.2, bx = (W - bw) / 2, by = Math.max(0, H * 0.42 - bh / 2);
    cx.globalCompositeOperation = 'destination-in';
    cx.beginPath(); cx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2); cx.fill();
    cx.globalCompositeOperation = 'source-over';
    box = [bx, by, bx + bw, by + bh];
  }
  // fit head into a square with room for the border
  const S = 176, pad = 14, [bx0, by0, bx1, by1] = box, bw = bx1 - bx0, bh = by1 - by0;
  const k = (S - pad * 2) / Math.max(bw, bh), dw = bw * k, dh = bh * k;
  const head = canvasOf(S, S), hx = head.getContext('2d');
  hx.drawImage(cut, bx0, by0, bw, bh, (S - dw) / 2, (S - dh) / 2, dw, dh);
  const white = canvasOf(S, S), wx = white.getContext('2d');
  wx.drawImage(head, 0, 0); wx.globalCompositeOperation = 'source-in'; wx.fillStyle = '#fff'; wx.fillRect(0, 0, S, S);
  const out = canvasOf(S, S), ox = out.getContext('2d'), r = 7;
  for (let t = 0; t < 360; t += 20) ox.drawImage(white, r * Math.cos(t * Math.PI / 180), r * Math.sin(t * Math.PI / 180));
  ox.drawImage(white, 0, 0); ox.drawImage(head, 0, 0);
  return { av: exportSmall(out), cut: ok };
}
