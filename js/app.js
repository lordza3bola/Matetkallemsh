// Matetkallemsh — app (UI, one-phone and multi-phone flows).
import * as E from './engine.js';
import { TITLES } from './titles.js';
import * as C from './cloud.js';
import { FIREBASE_CONFIG } from './firebase-config.js';
import { sfx, unlockAudio, confetti, keepAwake, setPrefs, getPrefs } from './fx.js';
import { shareGame } from './share.js';
import { I } from './icons.js';

export const APP_VERSION = 'V1';

// ---------- small helpers ----------
const $ = sel => document.querySelector(sel);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const uid8 = () => Math.random().toString(36).slice(2, 10);
const COLORS = ['#C8321F', '#1F5F7A', '#F3B62E', '#5B8C3A', '#7A4E9C', '#E07A2E'];
const onColor = c => (['#F3B62E', '#E07A2E'].includes(c) ? '#1F1410' : '#FFF8EA');
const initial = n => (String(n || '?').trim()[0] || '?').toUpperCase();
const av = (name, color, cls = '') => `<span class="av ${cls}" style="background:${color || '#1F5F7A'};color:${onColor(color || '#1F5F7A')}">${esc(initial(name))}</span>`;
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const titleSize = t => (t.length > 22 ? 'xl' : t.length > 12 ? 'l' : '');
const typeLabel = k => E.TYPE_LABEL[k] || k || '';
const meta = t => [typeLabel(t.k), t.y || '', t.d || ''].filter(Boolean).join(' · ');

// ---------- state ----------
const S = {
  screen: 'boot',
  cloud: false,
  user: null,                 // signed-in account {uid, name, color, username, email, stats, account:true}
  authUid: null,              // any Firebase uid (account or anonymous guest)
  guest: load('mk_guest'),    // {name, color}
  prefs: load('mk_prefs', { sound: true, vibrate: true }),
  setup: null,
  game: load('mk_game'),      // local (one-phone) game in progress
  mode: 'local',
  room: null, roomCode: load('mk_room'), unsubRoom: null,
  pick: null,
  ui: { reveal: null, sheet: null, readyShown: false, loginTab: 'in', err: '', busy: false },
  friends: { list: [], players: {}, unsub: null, q: '', found: null, msg: '' },
  invites: [], unsubInvites: null, unsubPlayer: null,
  recent: [],
  lastSig: '',
  joinCode: '',
};
setPrefs(S.prefs);

function me() {
  if (S.user) return { id: S.user.uid, name: S.user.name, color: S.user.color, account: true };
  if (S.guest) return { id: S.authUid || 'guest', name: S.guest.name, color: S.guest.color, account: false };
  return null;
}
function myId() { return S.user ? S.user.uid : S.authUid; }

// ---------- rendering ----------
const app = $('#app');

function render() {
  const a = document.activeElement;
  const focusId = a && a.id && (a.tagName === 'INPUT') ? a.id : null;
  const selStart = focusId ? a.selectionStart : 0;
  const fn = SCREENS[S.screen] || SCREENS.home;
  app.innerHTML = fn() + overlays();
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); try { el.setSelectionRange(selStart, selStart); } catch {} }
  }
  afterRender();
}

function go(screen) {
  S.screen = screen;
  S.ui.err = '';
  render();
  window.scrollTo(0, 0);
}

let toastTimer = null;
function toast(msg, opts = {}) {
  const old = $('.toast'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${opts.actions ? `<span class="acts">${opts.actions}</span>` : ''}`;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), opts.ms || 3200);
}

function top(title, backAct = 'home', extra = '') {
  return `<div class="top">${backAct ? `<button class="iconbtn" data-act="${backAct}" aria-label="Rage3">${I.back}</button>` : ''}<h1>${title}</h1>${extra}</div>`;
}

// ---------- screens ----------
const SCREENS = {};

SCREENS.boot = () => `<div class="screen"></div>`;

SCREENS.home = () => {
  const m = me();
  const resume = S.game && S.game.phase !== 'over';
  const last = load('mk_last');
  return `<div class="screen"><div class="body" style="gap:18px;padding-top:20px">
    <div class="hrow" style="align-items:center">
      <button class="btn" style="border-radius:999px;padding:6px 14px 6px 6px;gap:10px" data-act="${m ? 'profile' : 'login'}">
        ${m ? av(m.name, m.color) : av('?', '#6B5444')}<span>${m ? 'Ahlan, ' + esc(m.name) : 'Da5ol aw el3ab ka guest'}</span>
      </button>
      <button class="iconbtn" data-act="profile" aria-label="El e3dadat">${I.gear}</button>
    </div>
    <div class="poster">
      <span class="stamp">Le3bet el aflam el masreya</span>
      <h1 class="wordmark">MATETKALLEMSH!</h1>
      <p style="margin:0;font:500 15px/1.4 var(--body)">Etkallem bi2eedak… bas mat2olsh wala kelma</p>
      <div class="chips" style="justify-content:center;margin-top:6px">
        <span class="chip" style="min-height:0;padding:4px 10px;font-size:12px">${TITLES.length}+ 3onwan</span>
        <span class="chip" style="min-height:0;padding:4px 10px;font-size:12px">Aflam · Mosalsalat · Masra7</span>
      </div>
    </div>
    ${resume ? `<button class="btn must cta" data-act="resume">Kammel el le3ba (${esc(S.game.teams[0].score)} – ${esc(S.game.teams[1].score)})</button>` : ''}
    ${S.room && S.room.status !== 'over' ? `<button class="btn teal cta" data-act="backToRoom">Rage3 lel oda ${esc(S.roomCode)}</button>` : ''}
    <button class="mode" style="background:var(--must)" data-act="newLocal">
      ${I.phone.replace('<svg', '<svg width="40" height="40"')}
      <span style="flex:1"><span class="t">TELEFON WA7ED</span><span class="s">Kollena 3ala telefon wa7ed, bendawwar 3aleh</span></span>
    </button>
    <button class="mode" style="background:var(--teal);color:var(--cream)" data-act="newOnline">
      ${I.phones.replace('<svg', '<svg width="40" height="40"')}
      <span style="flex:1"><span class="t">KAZA TELEFON</span><span class="s">Kol wa7ed men telefono, fe nafs el oda</span></span>
    </button>
    <div class="field">
      <label for="joincode" class="lbl" style="text-transform:uppercase;letter-spacing:1px">Od5ol oda ma3 so7abak</label>
      <div class="inrow">
        <input id="joincode" class="input code" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="4K7Q" value="${esc(S.joinCode)}" data-model="joinCode">
        <button class="btn ink" data-act="join">Od5ol</button>
      </div>
      <p class="note">Aw scan el QR men camera el telefon.</p>
    </div>
    ${last ? `<div class="hrow" style="margin-top:auto;border-top:2px dashed var(--ink);padding-top:12px;font:500 14px var(--body)">
      <span>Akher le3ba: <b>${esc(last.a)} ${esc(last.as)}</b> – ${esc(last.bs)} ${esc(last.b)}</span></div>` : ''}
  </div></div>`;
};

// ----- login -----
SCREENS.login = () => {
  const up = S.ui.loginTab === 'up';
  const guestMode = S.ui.loginTab === 'guest';
  const color = S.ui.color || COLORS[0];
  return `<div class="screen"><div class="body" style="padding-top:20px">
    <div class="poster" style="padding:22px 16px 18px">
      <span class="wordmark" style="font-size:42px;margin:0">MATETKALLEMSH!</span>
      <span style="font:500 14px var(--body)">${guestMode ? 'Ekteb esmak w yalla' : 'Da5al 3ashan el stats w el so7ab yetsagelo'}</span>
    </div>
    ${S.ui.err ? `<div class="err" role="alert">${esc(S.ui.err)}</div>` : ''}
    ${guestMode ? `
      <div class="field"><label for="g-name">Esmak</label><input id="g-name" class="input" maxlength="16" placeholder="Omar" value="${esc(S.ui.gname || (S.guest && S.guest.name) || '')}" data-model="ui.gname"></div>
      <div class="field"><span class="lbl">El lon bta3ak</span>${swatches('ui.color', color)}</div>
      <button class="btn must cta" data-act="guestGo">EL3AB</button>
      <button class="link" data-act="loginTab" data-v="in">Rage3 — 3andi 7esab</button>
    ` : `
      <div class="seg" role="tablist">
        <button class="${!up ? 'on' : ''}" data-act="loginTab" data-v="in">Da5ol</button>
        <button class="${up ? 'on' : ''}" data-act="loginTab" data-v="up">7esab gedeed</button>
      </div>
      ${!S.cloud ? `<div class="err">El 7esabat me7taga Firebase — lessa mesh mazboota. El3ab ka guest dlwa2ty.</div>` : ''}
      ${up ? `
        <div class="field"><label for="u-name">Esmak</label><input id="u-name" class="input" maxlength="16" placeholder="Omar Hassan" value="${esc(S.ui.name || '')}" data-model="ui.name"></div>
        <div class="field"><label for="u-user">Username</label><input id="u-user" class="input" maxlength="20" autocapitalize="off" placeholder="omar" value="${esc(S.ui.username || '')}" data-model="ui.username"></div>` : ''}
      <div class="field"><label for="u-email">El email</label><input id="u-email" class="input" type="email" autocapitalize="off" placeholder="omar@mail.com" value="${esc(S.ui.email || '')}" data-model="ui.email"></div>
      <div class="field"><label for="u-pass">El password</label><input id="u-pass" class="input" type="password" value="${esc(S.ui.pass || '')}" data-model="ui.pass">
        ${!up ? `<button class="link" style="align-self:flex-end" data-act="forgot">Nseet el password?</button>` : ''}</div>
      ${up ? `<div class="field"><span class="lbl">El lon bta3ak</span>${swatches('ui.color', color)}</div>` : ''}
      <button class="btn red cta" data-act="${up ? 'signUp' : 'signIn'}" ${S.ui.busy || !S.cloud ? 'disabled' : ''}>${up ? 'E3mel 7esab' : 'Da5ol'}</button>
      <div style="display:flex;align-items:center;gap:10px;font:600 13px var(--body)"><span style="flex:1;border-top:2px dashed var(--ink)"></span>aw<span style="flex:1;border-top:2px dashed var(--ink)"></span></div>
      <button class="btn must cta" style="flex-direction:column;gap:0;min-height:66px" data-act="loginTab" data-v="guest">EL3AB KA GUEST<span style="font:500 12px var(--body);letter-spacing:0;text-transform:none">Esmak bas · mafeesh stats wala so7ab</span></button>
      ${S.user || S.guest ? `<button class="link" data-act="home">Rage3</button>` : ''}
    `}
  </div></div>`;
};

function swatches(model, cur) {
  return `<div class="swatches">${COLORS.map(c => `<button class="sw ${c === cur ? 'on' : ''}" style="background:${c}" data-act="setModel" data-model="${model}" data-v="${c}" aria-label="Lon ${c}"></button>`).join('')}</div>`;
}

// ----- setup -----
function newSetup(online) {
  const last = load('mk_setup');
  const settings = { ...E.defaultSettings(), ...(last && last.settings) };
  const m = me();
  let teams = last && last.teams ? last.teams : [
    { name: 'El Asad', color: COLORS[0], players: [] },
    { name: 'El Nesr', color: COLORS[1], players: [] },
  ];
  teams = teams.map(t => ({ ...t, players: online ? [] : (t.players || []) }));
  if (!online && m && !teams.some(t => t.players.some(p => p.id === m.id))) {
    teams.forEach(t => { t.players = t.players.filter(p => !p.me); });
    teams[0].players.unshift({ id: m.id, name: m.name, me: true });
  }
  S.setup = { online, settings, teams, add: ['', ''] };
}

SCREENS.setup = () => {
  const st = S.setup, s = st.settings;
  const pool = E.filterPool(TITLES, s).length;
  return `<div class="screen">${top('Le3ba gedeeda', 'home')}
  <div class="body">
    <div class="seg">
      <button class="${!st.online ? 'on' : ''}" data-act="setupMode" data-v="local">Telefon wa7ed</button>
      <button class="${st.online ? 'on' : ''}" data-act="setupMode" data-v="online">Kaza telefon</button>
    </div>
    <div class="hrow"><span class="h">El fera2</span>
      ${!st.online ? `<span class="chips"><button class="chip on must" data-act="randomTeams">Wazza3 3ashwa2y</button></span>` : `<span class="note">El la3eeba yedkhalo men telefonathom</span>`}
    </div>
    <div class="grid2">${st.teams.map((t, i) => teamCard(t, i, st)).join('')}</div>

    <span class="h">El anwa3</span>
    <div class="chips">${E.TYPES.map(k => `<button class="chip ${s.types.includes(k) ? 'on' : ''}" data-act="toggleArr" data-k="types" data-v="${k}">${esc(typeLabel(k))}</button>`).join('')}</div>
    <span class="h">El zaman · El mostawa</span>
    <div class="chips">${E.ERAS.map(k => `<button class="chip teal ${s.eras.includes(k) ? 'on' : ''}" data-act="toggleArr" data-k="eras" data-v="${k}">${esc(k)}</button>`).join('')}</div>
    <div class="seg must">${['Sahl', 'Wasat', 'Sa3b', 'all'].map(d => `<button class="${s.diff === d ? 'on' : ''}" data-act="setSetting" data-k="diff" data-v="${d}">${d === 'all' ? 'El kol' : d}</button>`).join('')}</div>
    <p class="note" style="margin-top:-6px">${pool} 3onwan mota7 bel e5tiyarat di</p>

    <div class="grid2">
      <div class="field"><span class="h" style="font-size:16px">Wa2t el dor</span>
        <div class="seg">${[60, 90, 120].map(n => `<button class="${s.turnSec === n ? 'on' : ''}" data-act="setSetting" data-k="turnSec" data-v="${n}" data-num="1">${n}s</button>`).join('')}</div></div>
      <div class="field"><span class="h" style="font-size:16px">Tentehy emta</span>
        <select class="input" style="height:46px;font-size:14px" data-model="setup.settings.endType" aria-label="Tentehy emta">${E.END_TYPES.map(o => `<option value="${o.id}" ${s.endType === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
    </div>
    ${s.endType !== 'manual' ? `<div class="card opt"><span>${s.endType === 'score' ? 'El no2at elly bnewsallaha' : s.endType === 'rounds' ? 'Adwar lekol fare2' : 'Wa2t el le3ba (d2aye2)'}</span>
      ${stepper(s.endType === 'score' ? 'score' : s.endType === 'rounds' ? 'rounds' : 'minutes', s[s.endType === 'score' ? 'score' : s.endType === 'rounds' ? 'rounds' : 'minutes'])}</div>` : ''}

    <div class="card list">
      <div class="opt"><span><b>Skip</b> masmoo7 · beyekhsar ${s.skipCost} no2ta</span>${tog('skipOn', s.skipOn)}</div>
      <div class="opt"><span><b>El momassel</b> bel dor (msh be2idak)</span>${tog('rotate', s.rotate)}</div>
    </div>

    <div class="hrow"><span class="h">El mosa3dat</span><span class="note">Kol wa7da −${s.helpCost} · ${s.helps.length} men ${E.HELPS.length}</span></div>
    <div class="chips">${E.HELPS.map(h => `<button class="chip must ${s.helps.includes(h.id) ? 'on' : ''}" data-act="toggleArr" data-k="helps" data-v="${h.id}">${h.label}</button>`).join('')}</div>
    <div class="card opt"><span>A2sa mosa3dat fel dor</span>${stepper('maxHelps', s.maxHelps, 0, 5)}</div>
    ${S.ui.err ? `<div class="err" role="alert">${esc(S.ui.err)}</div>` : ''}
  </div>
  <div class="foot"><button class="btn red cta" data-act="startSetup" ${S.ui.busy ? 'disabled' : ''}>${st.online ? 'E3mel el oda' : 'Yalla nebda2!'}</button></div>
  </div>`;
};

function teamCard(t, i, st) {
  return `<div class="team" style="box-shadow:3px 3px 0 ${t.color}">
    <div class="tname"><span class="dot" style="background:${t.color}"></span><input id="tname${i}" value="${esc(t.name)}" maxlength="14" data-model="setup.teams.${i}.name" aria-label="Esm el fare2"></div>
    <div class="tbody">
      <div class="swatches">${COLORS.map(c => `<button class="sw ${c === t.color ? 'on' : ''}" style="background:${c}" data-act="teamColor" data-i="${i}" data-v="${c}" aria-label="Lon el fare2"></button>`).join('')}</div>
      ${!st.online ? `
        <div class="chips" style="gap:4px">${t.players.map(p => `<span class="pchip">${esc(p.name)}<button data-act="removePlayer" data-i="${i}" data-id="${esc(p.id)}" aria-label="Shil ${esc(p.name)}">×</button></span>`).join('') || '<span class="note">Mafeesh la3eeba lessa</span>'}</div>
        <div class="inrow"><input id="add${i}" class="input" style="height:38px;font-size:14px;padding:0 10px" maxlength="14" placeholder="+ La3eb" value="${esc(st.add[i])}" data-model="setup.add.${i}" data-enter="addPlayer" data-i="${i}">
        <button class="btn sm" data-act="addPlayer" data-i="${i}" aria-label="Zawwed">+</button></div>` : `<p class="note">Hayetmeli fel oda</p>`}
    </div></div>`;
}
const tog = (k, on) => `<button class="tog ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="toggleSetting" data-k="${k}" aria-label="${k}"></button>`;
const stepper = (k, v, min = 1, max = 99) => `<span class="step"><button data-act="stepSetting" data-k="${k}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="A2al">−</button><b>${v}</b><button data-act="stepSetting" data-k="${k}" data-d="1" data-min="${min}" data-max="${max}" aria-label="Aktar">+</button></span>`;

// ----- lobby (online) -----
SCREENS.lobby = () => {
  const r = S.room;
  if (!r) return `<div class="screen">${top('El oda', 'leaveRoom')}<div class="body"><p class="note">Bet7ammel…</p></div></div>`;
  const uid = myId(), host = r.host === uid;
  const players = roomPlayers(r);
  const link = `${location.origin}${location.pathname}?room=${S.roomCode}`;
  const qr = qrSvg(link);
  const unassigned = players.filter(p => p.team !== 0 && p.team !== 1);
  const can = r.teams.every((t, i) => players.some(p => p.team === i));
  return `<div class="screen">${top('El oda', 'leaveRoom', `<span class="stamp" style="background:var(--green);color:var(--cream)">${players.length} gom</span>`)}
  <div class="body">
    <div class="card shadow" style="border-width:3px;border-radius:20px;padding:16px;display:flex;gap:14px;align-items:center">
      ${qr ? `<div class="qr" role="img" aria-label="QR code el oda">${qr}</div>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <span class="lbl" style="text-transform:uppercase;letter-spacing:1px;font-size:12px">Code el oda</span>
        <span style="font:400 48px/1 var(--display);letter-spacing:4px;color:var(--red)">${esc(S.roomCode)}</span>
        <button class="btn must sm" data-act="shareRoom">Ib3at el link</button>
      </div>
    </div>
    <p class="note">Kol wa7ed yescan el QR aw yekteb el code · lazem kollo 3ando internet.</p>
    <div class="hrow"><span class="h">El la3eeba</span>${host ? `<button class="chip on must" data-act="roomRandom">Wazza3 3ashwa2y</button>` : ''}</div>
    <div class="grid2">${r.teams.map((t, i) => `
      <div class="team">
        <button class="tname" style="background:${t.color};color:${onColor(t.color)};border:none;border-bottom:2px solid var(--ink);text-align:left;width:100%" data-act="joinTeam" data-i="${i}">${esc(t.name)}<span style="margin-left:auto;font:600 11px var(--body)">${players.find(p => p.id === uid && p.team === i) ? 'enta hena' : 'od5ol'}</span></button>
        <div class="tbody">${players.filter(p => p.team === i).map(p => `<span style="display:flex;align-items:center;gap:8px;font-size:14px">${av(p.name, p.color)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</span>${p.id === r.host ? '<span class="stamp ink" style="font-size:10px;padding:1px 4px">HOST</span>' : ''}${host && p.id !== uid ? `<button class="btn sm" style="min-height:30px;padding:0 6px" data-act="movePlayer" data-id="${esc(p.id)}" data-i="${1 - i}" aria-label="Na2alo">⇄</button>` : ''}</span>`).join('') || '<span class="note">Fadi</span>'}</div>
      </div>`).join('')}</div>
    ${unassigned.map(p => `<div class="card" style="border-style:dashed;display:flex;align-items:center;gap:10px;padding:10px 12px">${av(p.name, p.color)}<span style="flex:1;font-size:14px"><b>${esc(p.name)}</b> men gher fare2</span>
      ${host || p.id === uid ? r.teams.map((t, i) => `<button class="btn sm" style="background:${t.color};color:${onColor(t.color)}" data-act="movePlayer" data-id="${esc(p.id)}" data-i="${i}">→ ${esc(t.name)}</button>`).join('') : ''}</div>`).join('')}
    <p class="note center">${esc(roomSummary(r.settings))}</p>
  </div>
  <div class="foot">${host
    ? `<button class="btn red cta" data-act="roomStart" ${can ? '' : 'disabled'}>Ebda2 el le3ba</button>${can ? '' : '<p class="note center" style="margin:0">Lazem la3eb wa7ed 3al a2al fe kol fare2</p>'}`
    : `<p class="note center" style="margin:0">Estanna el host yebda2 el le3ba…</p><button class="btn ghost" data-act="leaveRoom">Ekhrog men el oda</button>`}</div>
  </div>`;
};

function roomSummary(s) {
  return `${s.turnSec}s · ${E.endLabel(s)} · ${s.types.map(typeLabel).join(', ')}`;
}
function roomPlayers(r) {
  return Object.entries(r.players || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => (a.at || 0) - (b.at || 0));
}
function qrSvg(text) {
  try {
    if (!window.qrcode) return '';
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  } catch { return ''; }
}

// ----- game -----
function G() { return S.mode === 'online' ? (S.room && S.room.game) : S.game; }
function myTeam() {
  const g = G(); if (!g) return -1;
  if (S.mode === 'local') return -1;
  const uid = myId();
  return g.teams.findIndex(t => t.players.some(p => p.id === uid));
}

SCREENS.game = () => {
  const g = G();
  if (!g) return `<div class="screen">${top('', 'home')}<div class="body"><p class="note">Mafeesh le3ba.</p></div></div>`;
  switch (g.phase) {
    case 'chooseActor': return gChooseActor(g);
    case 'pick': return gPick(g);
    case 'ready': return gReady(g);
    case 'acting': return gActing(g);
    case 'result': return gResult(g);
    case 'over': return gOver(g);
  }
  return '';
};

function scoreStrip(g) {
  return `<div class="scorebar">${g.teams.map((t, i) => `<div class="s" style="${g.turn && g.turn.team === i && g.phase !== 'over' ? 'box-shadow:3px 3px 0 ' + t.color : ''}"><span class="dot" style="background:${t.color}"></span>${esc(t.name)}<b>${t.score}</b></div>`).join('')}</div>`;
}
function gameTop(g, label) {
  return `<div class="top" style="padding-bottom:0">
    <button class="iconbtn" data-act="gameMenu" aria-label="El menu">${I.gear}</button>
    <span style="flex:1;font:600 13px var(--body)">${label || `Dor ${g.turnNo} · ${esc(E.endLabel(g.settings))}`}</span>
  </div>`;
}

function gChooseActor(g) {
  const t = g.teams[g.turn.team];
  const mine = S.mode === 'local' || myTeam() === g.turn.team;
  return `<div class="screen">${gameTop(g)}<div class="body">
    ${scoreStrip(g)}
    <div class="poster" style="padding:20px 16px"><span class="stamp">Dor ${esc(t.name)}</span><span class="big" style="font-size:36px;text-shadow:3px 3px 0 var(--ink)">MEEN HAYEMASSEL?</span></div>
    ${mine ? `<div class="card list">${t.players.map(p => `<button class="row" style="width:100%;border:none;background:none;text-align:left" data-act="chooseActor" data-id="${esc(p.id)}">${av(p.name, t.color)}<span class="grow"><b>${esc(p.name)}</b><span class="sub">${g.history.filter(h => h.actorId === p.id).length} adwar</span></span>${I.back.replace('M15 18l-6-6 6-6', 'M9 6l6 6-6 6')}</button>`).join('')}</div>`
      : `<p class="note center">Fare2 ${esc(t.name)} beyekhtaro meen hayemassel…</p>`}
  </div></div>`;
}

function ensurePick(g) {
  const key = `${g.startedAt}:${g.turnNo}:${g.turn.skips}`;
  if (!S.pick || S.pick.key !== key) {
    const pool = E.filterPool(TITLES, g.settings, g.used);
    S.pick = { key, sel: null, sug: E.suggestions(pool, 4), q: '', type: 'all', custom: '', showCustom: false };
  }
  return S.pick;
}

function gPick(g) {
  const actor = E.actorOf(g), at = g.teams[g.turn.team], pt = g.teams[1 - g.turn.team];
  const local = S.mode === 'local';
  const picker = local || myTeam() === 1 - g.turn.team;
  if (!picker) {
    const isActor = actor && actor.id === myId();
    return `<div class="screen">${gameTop(g)}<div class="body">${scoreStrip(g)}
      <div class="poster" style="background:var(--teal);padding:26px 16px"><span class="stamp">Dor ${esc(at.name)}</span>
      <span class="big" style="font-size:34px;text-shadow:3px 3px 0 var(--ink)">${isActor ? 'ENTA HATEMASSEL!' : `${esc(actor.name).toUpperCase()} HAYEMASSEL`}</span>
      <span style="font:500 14px var(--body)">${esc(pt.name)} beyekhtaro el 3onwan dlwa2ty…</span></div>
      <p class="note center">Matbossosh 3ala telefonathom!</p></div></div>`;
  }
  const p = ensurePick(g);
  return `<div class="screen">
    <div style="background:var(--teal);color:var(--cream);padding:16px 20px 14px;border-bottom:3px solid var(--ink);display:flex;flex-direction:column;gap:6px">
      <div class="hrow" style="font:600 13px var(--body)"><span>Dor ${g.turnNo} · ${esc(g.teams[0].name)} ${g.teams[0].score} – ${g.teams[1].score} ${esc(g.teams[1].name)}</span><span class="stamp" style="font-size:11px">${esc(pt.name)}</span></div>
      <h1 style="margin:0;font:400 30px/1.05 var(--display);text-transform:uppercase">E5taro le ${esc(actor.name)}!</h1>
      <p style="margin:0;font:500 14px var(--body)">${esc(actor.name)} (${esc(at.name)}) hayemassel — ${local ? '5abbo el telefon 3anno' : 'howa mesh shayef'}</p>
    </div>
    <div class="body">
      <div class="chips scroll">${['all', ...g.settings.types].map(k => `<button class="chip ink ${p.type === k ? 'on' : ''}" data-act="pickType" data-v="${k}">${k === 'all' ? 'El kol' : esc(typeLabel(k))}</button>`).join('')}</div>
      <label class="card" style="display:flex;align-items:center;gap:8px;height:48px;padding:0 12px;border-radius:12px">${I.search.replace('<svg', '<svg width="18" height="18"')}
        <input id="pickq" style="flex:1;min-width:0;border:none;background:none;font:500 15px var(--body)" placeholder="Dawwar 3ala film aw mosalsal…" value="${esc(p.q)}" data-model="pick.q" data-live="pickList" aria-label="Dawwar"></label>
      <div class="hrow"><span class="h" style="font-size:16px">${p.q ? 'Nata2eg el ba7th' : 'E5tiyarat lekom'}</span></div>
      <div id="pickList" style="display:flex;flex-direction:column;gap:10px">${pickList(g)}</div>
      <div class="grid2">
        <button class="btn" data-act="reshuffle">${I.refresh.replace('<svg', '<svg width="16" height="16"')} Ghayyar</button>
        <button class="btn dashed" data-act="toggleCustom">+ Men 3andena</button>
      </div>
      ${p.showCustom ? `<div class="card pad" style="display:flex;flex-direction:column;gap:8px">
        <label class="lbl" for="customt">Ekteb el 3onwan bel 3arabi</label>
        <input id="customt" class="input" dir="rtl" style="font-family:var(--ar);font-size:22px" placeholder="مثلاً: الكيف" value="${esc(p.custom)}" data-model="pick.custom">
        <div class="chips">${E.TYPES.map(k => `<button class="chip ${p.ctype === k || (!p.ctype && k === 'Film') ? 'on' : ''}" data-act="customType" data-v="${k}">${esc(typeLabel(k))}</button>`).join('')}</div>
        <button class="btn must" data-act="useCustom">E5taro da</button></div>` : ''}
    </div>
    <div class="foot"><button class="btn red cta" data-act="confirmPick" ${p.sel ? '' : 'disabled'}>${local ? 'Eddoh el telefon' : 'Ib3atoh le ' + esc(actor.name)}</button></div>
  </div>`;
}

function pickList(g) {
  const p = S.pick;
  let list;
  if (p.q.trim()) {
    const q = p.q.trim().toLowerCase();
    list = E.filterPool(TITLES, { ...g.settings, types: E.TYPES, eras: E.ERAS, diff: 'all' }, g.used)
      .filter(t => t.t.includes(p.q.trim()) || (t.f || '').toLowerCase().includes(q)).slice(0, 12);
  } else {
    list = p.sug;
  }
  if (p.type !== 'all') list = list.filter(t => t.k === p.type);
  if (p.sel && p.sel.custom && !list.some(t => t.id === p.sel.id)) list = [p.sel, ...list];
  if (!list.length) return `<p class="note">Mafeesh nata2eg${p.type !== 'all' ? ' fel no3 da — dous Ghayyar' : ''}.</p>`;
  return list.map(t => `<button class="pick ${p.sel && p.sel.id === t.id ? 'on' : ''}" data-act="selTitle" data-id="${esc(t.id)}">
    <span class="radio">${p.sel && p.sel.id === t.id ? `<span style="color:var(--must);display:flex">${I.check.replace('<svg', '<svg width="12" height="12"')}</span>` : ''}</span>
    <span style="flex:1;display:flex;flex-direction:column;gap:2px"><span class="meta">${esc(t.custom ? 'Men 3andena · ' + typeLabel(t.k) : meta(t))}</span><span class="ar">${esc(t.t)}</span></span></button>`).join('');
}

function gReady(g) {
  const actor = E.actorOf(g), local = S.mode === 'local';
  const isActor = local || actor.id === myId();
  if (!isActor) {
    return `<div class="screen">${gameTop(g)}<div class="body">${scoreStrip(g)}
      <div class="poster"><span class="stamp">Estaedo</span><span class="big" style="font-size:34px;text-shadow:3px 3px 0 var(--ink)">${esc(actor.name).toUpperCase()} BEYESHOOF EL 3ONWAN</span>
      <span style="font:500 14px var(--body)">El wa2t hayebda2 awel ma yedous Ebda2</span></div>
      ${myTeam() !== g.turn.team ? `<div class="card pad"><span class="lbl">El 3onwan elly e5tartoh</span><div class="ar" style="font-size:30px;text-align:right">${esc(g.turn.title.t)}</div></div>` : `<p class="note center">Gahhezo nafsokom te5ammeno!</p>`}
    </div></div>`;
  }
  if (local && !S.ui.readyShown) {
    return `<div class="screen dark"><div class="body" style="justify-content:center;gap:22px;text-align:center">
      <span class="stamp" style="align-self:center">Dor ${esc(g.teams[g.turn.team].name)}</span>
      <h1 style="margin:0;font:400 46px/1.05 var(--display)">EDDO EL TELEFON<br>LE ${esc(actor.name).toUpperCase()}</h1>
      <p class="note">Mat2orsh el shasha 2abl ma yemsek el telefon.</p>
      <button class="btn must cta" data-act="showTitle">Ana ${esc(actor.name)} — warrini</button>
    </div></div>`;
  }
  const t = g.turn.title;
  return `<div class="screen dark"><div class="body" style="justify-content:center;gap:18px">
    <p class="note center">${esc(actor.name)}, da el 3onwan bta3ak. El wa2t ${g.settings.turnSec} sanya.</p>
    <div class="poster titlecard"><span class="stamp">${esc(t.custom ? typeLabel(t.k) : typeLabel(t.k))}</span>
      <span class="ar ${titleSize(t.t)}">${esc(t.t)}</span></div>
    <p class="note center">Awel ma tedous, ebda2 bel esharat: no3 el 3onwan w 3adad el kalemat.</p>
    <button class="btn must cta" data-act="startTurn">Ebda2!</button>
  </div></div>`;
}

function timerHtml(g) {
  const left = E.timeLeft(g), tot = g.settings.turnSec * 1000, c = 251.3;
  const off = c * (1 - left / tot);
  return `<div class="timer ${left < 10500 ? 'warn' : ''}" data-timer-ring><svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="40" fill="none" stroke="#3A2A22" stroke-width="9"/><circle data-ring cx="48" cy="48" r="40" fill="none" stroke="${left < 10500 ? '#FF7B5C' : '#F3B62E'}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 48 48)"/></svg><span data-timer>${fmt(left)}</span></div>`;
}

function gActing(g) {
  const local = S.mode === 'local';
  const actor = E.actorOf(g);
  const role = local ? 'actor' : actor.id === myId() ? 'actor' : myTeam() === g.turn.team ? 'mate' : 'opp';
  if (role === 'mate') return gGuess(g);
  if (role === 'opp') return gOpp(g);
  const t = g.turn.title, helps = E.availableHelps(g), left = E.helpsLeft(g);
  const at = g.teams[g.turn.team];
  return `<div class="screen dark"><div class="body">
    <div style="display:flex;align-items:center;gap:16px">
      ${timerHtml(g)}
      <div style="flex:1;display:flex;flex-direction:column;gap:4px">
        <span style="display:flex;align-items:center;gap:8px;font:600 15px var(--body)"><span class="dot" style="background:${at.color};border-color:var(--cream)"></span>Dor ${esc(actor.name)} · ${esc(at.name)}</span>
        <span class="note">${esc(g.teams[0].name)} ${g.teams[0].score} – ${g.teams[1].score} ${esc(g.teams[1].name)} · dor ${g.turnNo}</span>
      </div>
      <button class="iconbtn" data-act="gameMenu" aria-label="El menu">${I.gear}</button>
    </div>
    <div class="poster titlecard ${S.ui.shake ? 'shake' : ''}"><span class="stamp">${esc(typeLabel(t.k))}${g.turn.skips ? ' · skip ' + g.turn.skips : ''}</span>
      <span class="ar ${titleSize(t.t)}">${esc(t.t)}</span>
      <span style="font:500 13px var(--body)">${local ? `${esc(g.teams[1 - g.turn.team].name)} e5tarooh` : 'Mat2olsh wala kelma!'}</span></div>
    ${g.settings.helps.length && g.settings.maxHelps ? `<div style="display:flex;flex-direction:column;gap:8px">
      <div class="hrow"><span class="h" style="font-size:16px">Mosa3dat · −${g.settings.helpCost}</span><button class="link" data-act="signs">Esharat el aflam</button></div>
      <div class="helpgrid">${helps.map((h, i) => `<button class="helpbtn ${h.used ? 'used' : ''}" ${!h.used && (!h.value || !left) ? 'disabled' : ''} data-act="useHelp" data-v="${h.id}" style="${helps.length === 5 && i === 4 ? 'grid-column:span 2' : ''}">${h.label}${h.used ? ' ✓' : ''}${!h.value && !h.used ? '<br><small>mafeesh</small>' : ''}</button>`).join('')}</div>
      <span class="note">${left ? `Fadel ${left} mosa3d${left === 1 ? 'a' : 'at'}.` : 'Khalast el mosa3dat.'} ${local ? 'El mosa3da betetla3 lewa7daha — laff el telefon le fare2ak.' : 'Fare2ak beyshoofha 3and telefonathom.'}</span>
    </div>` : `<div class="hrow"><span></span><button class="link" data-act="signs">Esharat el aflam</button></div>`}
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">
      <button class="sa7" data-act="correct">SA7! +${g.settings.points}</button>
      <div class="grid2">
        ${g.settings.skipOn ? `<button class="btn ghost" data-act="skip">Skip −${g.settings.skipCost}</button>` : '<span></span>'}
        <button class="btn must" data-act="foulAsk">Faul! Etkallem</button>
      </div>
    </div>
  </div></div>`;
}

function revealedHints(g) {
  const hs = E.availableHelps(g).filter(h => h.used);
  if (!hs.length) return '';
  return `<div class="chips">${hs.map(h => `<span class="hint">${esc(h.label.replace('El ', ''))}: ${/[؀-ۿ]/.test(h.value) ? `<span class="ar">${esc(h.value)}</span>` : esc(h.value)}</span>`).join('')}</div>`;
}

function gGuess(g) {
  const actor = E.actorOf(g), m = me();
  const helps = E.availableHelps(g), left = E.helpsLeft(g);
  const words = g.turn.title.t.trim().split(/\s+/);
  const tot = g.settings.turnSec * 1000;
  return `<div class="screen"><div class="body">
    <div class="hrow" style="align-items:center"><span style="display:flex;align-items:center;gap:8px;font:600 14px var(--body)">${av(m.name, g.teams[g.turn.team].color)}${esc(m.name)} · ${esc(g.teams[g.turn.team].name)}</span>
      <span data-timer style="font:400 30px var(--display);color:var(--red)">${fmt(E.timeLeft(g))}</span></div>
    <div class="bar"><i data-bar style="width:${(E.timeLeft(g) / tot) * 100}%"></i></div>
    <div class="card shadow" style="border-width:3px;border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:10px">
      <span style="font:400 22px/1 var(--display);text-transform:uppercase">${esc(actor.name)} beymassel… 5ammeno!</span>
      <div class="hidden-title">${words.map(w => `<span style="width:${Math.min(140, 26 + w.length * 16)}px"></span>`).join('')}</div>
      ${revealedHints(g)}
    </div>
    ${g.settings.helps.length && g.settings.maxHelps ? `<div class="hrow"><span class="h" style="font-size:16px">Etlob mosa3da · −${g.settings.helpCost}</span><span class="note">${g.turn.helps.length} men ${g.settings.maxHelps}</span></div>
    <div class="grid3 light">${helps.filter(h => !h.used).map(h => `<button class="helpbtn" ${!h.value || !left ? 'disabled' : ''} data-act="useHelp" data-v="${h.id}">${h.label}</button>`).join('') || '<span class="note">Kollaha est5demet</span>'}</div>` : ''}
    <span class="h" style="font-size:16px">Esharat el aflam</span>
    ${signsGrid()}
    <div style="margin-top:auto"><button class="sa7" data-act="correct">SA7! 3ERFNAHA</button></div>
  </div></div>`;
}

function gOpp(g) {
  const actor = E.actorOf(g);
  return `<div class="screen"><div class="body">
    <div class="hrow" style="align-items:center"><span style="font:600 14px var(--body)">${esc(actor.name)} beymassel · ${esc(g.teams[g.turn.team].name)}</span>
      <span data-timer style="font:400 30px var(--display);color:var(--red)">${fmt(E.timeLeft(g))}</span></div>
    <div class="bar"><i data-bar style="width:${(E.timeLeft(g) / (g.settings.turnSec * 1000)) * 100}%"></i></div>
    <div class="poster titlecard" style="background:var(--teal)"><span class="stamp">El 3onwan elly e5tartoh</span><span class="ar ${titleSize(g.turn.title.t)}">${esc(g.turn.title.t)}</span></div>
    ${revealedHints(g)}
    <p class="note">Ra2bo ${esc(actor.name)}: law etkallem aw 2al kelma, dousso Faul.</p>
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">
      <button class="btn must cta" data-act="foulAsk">FAUL! ETKALLEM</button>
      <button class="btn green" data-act="correct">Sa7 — 3erfooha</button>
    </div>
  </div></div>`;
}

function signsGrid() {
  const sg = [[I.film, 'Film', 'laff el kamera'], [I.tv, 'Mosalsal', 'ersem shasha'], [I.curtain, 'Masra7eya', 'efta7 el setara'],
    [I.hand, 'Kam kelma', 'swabe3'], [I.ear, 'Shabah', 'shad wednak'], [I.arrow, 'El kelma', 'el tanya…']];
  return `<div class="signs">${sg.map(([ic, a, b]) => `<div class="sign">${ic}<span><b>${a}</b><br>${b}</span></div>`).join('')}</div>`;
}

function gResult(g) {
  const h = g.history[g.history.length - 1];
  const t = g.teams[h.team];
  const R = { correct: ['SA7!', 'var(--green)', 'var(--cream)'], foul: ['FAUL!', 'var(--must)', 'var(--ink)'], timeout: ['EL WA2T 5ELES', 'var(--red)', 'var(--cream)'] }[h.result];
  const pen = h.helps.length * g.settings.helpCost + h.skips * (g.settings.skipOn ? g.settings.skipCost : 0);
  const end = E.shouldEnd(g);
  return `<div class="screen">${gameTop(g)}<div class="body">
    <div class="poster" style="background:${R[1]};color:${R[2]}">
      <span class="stamp ink">${esc(h.actor)} · ${esc(t.name)}</span>
      <span class="big" style="font-size:52px;${R[2] === 'var(--cream)' ? 'text-shadow:3px 3px 0 var(--ink)' : ''}">${R[0]}</span>
      <span class="ar" style="font-size:34px">${esc(h.title)}</span>
      <span style="font:600 15px var(--body)">${h.points > 0 ? '+' : ''}${h.points} no2ta${h.result === 'correct' ? ` · fe ${h.secs} sanya` : ''}</span>
    </div>
    ${pen ? `<div class="card pad note" style="color:var(--ink)">${h.result === 'correct' ? `+${g.settings.points} sa7` : '0'}${h.helps.length ? ` · −${h.helps.length * g.settings.helpCost} mosa3dat` : ''}${h.skips ? ` · −${h.skips * g.settings.skipCost} skip` : ''}</div>` : ''}
    ${scoreStrip(g)}
    ${end ? `<p class="note center"><b>El le3ba 5elset!</b> Dous 3ashan teshoof el natiga.</p>` : `<p class="note center">El dor elly ba3do: <b>${esc(g.teams[1 - h.team].name)}</b>${g.settings.rotate ? ` · ${esc(nextActorName(g))} hayemassel` : ''}</p>`}
  </div>
  <div class="foot">
    <button class="btn red cta" data-act="nextTurn">${end ? 'El natiga' : 'El dor elly ba3do'}</button>
    ${!end ? `<button class="btn ${g.settings.endType === 'manual' ? 'must' : 'ghost'}" data-act="endAsk">5alas — ne2fel el le3ba</button>` : ''}
  </div></div>`;
}
function nextActorName(g) {
  const nt = g.teams[1 - g.turn.team];
  const p = nt.players[nt.actorIdx % nt.players.length];
  return p ? p.name : '';
}

function gOver(g) {
  const aw = E.awards(g);
  const w = g.winner;
  const order = w === 1 ? [1, 0] : [0, 1];
  const heights = w === -1 ? [170, 170] : [186, 140];
  const label = { score: `Awel ${g.settings.score} no2ta`, rounds: `${g.settings.rounds} adwar`, time: `${g.settings.minutes} d2ee2a`, manual: 'Wa2afnaha' }[g.settings.endType];
  const host = S.mode === 'local' || (S.room && S.room.host === myId());
  return `<div class="screen"><div class="body">
    <div class="poster must" style="padding:18px 16px 0;gap:6px">
      <span class="stamp ink">5alas · ${esc(label)}</span>
      <span style="font:400 42px/1 var(--display);text-align:center">${w === -1 ? 'TA3ADOL!' : esc(g.teams[w].name).toUpperCase() + ' KESBO!'}</span>
      <div class="podium">${order.map((ti, k) => {
        const t = g.teams[ti];
        return `<div class="col" style="height:${heights[k]}px;background:${t.color};color:${onColor(t.color)}">${k === 0 && w !== -1 ? `<span style="width:26px;height:26px;display:flex">${I.crown}</span>` : ''}<span class="n" style="${onColor(t.color) === '#1F1410' ? 'text-shadow:none' : ''}">${t.score}</span><span class="nm">${esc(t.name)}</span></div>`;
      }).join('')}</div>
    </div>
    <span class="h">Gawayez el leila</span>
    <div class="grid2">
      <div class="stat"><span style="color:var(--muted)">A7san momassel</span><b style="font:700 18px var(--body)">${aw.best ? esc(aw.best.name) : '—'}</b><span>${aw.best ? `${aw.best.correct} ${aw.best.correct === 1 ? '3onwan' : '3anaween'}` : 'Mafeesh'}</span></div>
      <div class="stat"><span style="color:var(--muted)">Asra3 ta5meen</span><b style="font:700 18px var(--body)">${aw.fastest ? esc(aw.fastest.actor) : '—'}</b><span>${aw.fastest ? `<span class="ar" style="font-size:15px">${esc(aw.fastest.title)}</span> fe ${aw.fastest.secs}s` : 'Mafeesh'}</span></div>
    </div>
    <span class="h">El adwar</span>
    <div class="card list">${g.history.slice().reverse().map(h => `<div class="row" style="min-height:44px;padding:8px 12px"><span class="dot" style="width:10px;height:10px;background:${g.teams[h.team].color}"></span>
      <span class="grow" style="flex-direction:row;align-items:center;gap:4px;font-size:14px">${esc(h.actor)} · <span class="ar" style="font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.title)}</span></span>
      <b style="color:${h.points > 0 ? 'var(--green-ink)' : h.points < 0 ? 'var(--red2)' : 'var(--muted)'}">${h.points > 0 ? '+' : ''}${h.points}${h.result === 'foul' ? ' faul' : h.result === 'timeout' ? ' wa2t' : ''}</b><span class="sub">${h.result === 'correct' ? fmt(h.secs * 1000) : '—'}</span></div>`).join('') || '<div class="row note">Mafeesh adwar</div>'}</div>
  </div>
  <div class="foot">
    <button class="btn green" style="border-width:3px;box-shadow:4px 4px 0 var(--ink)" data-act="shareGame">${I.share.replace('<svg', '<svg width="18" height="18"')} Share 3al WhatsApp / Story</button>
    <div class="grid2">
      ${host ? `<button class="btn red cta" style="font-size:18px;padding:0 8px" data-act="playAgain">Le3ba tanya</button>` : `<span class="note center" style="align-self:center">Estanna el host</span>`}
      <button class="btn" data-act="${S.mode === 'online' ? 'leaveRoom' : 'home'}">El bedaya</button>
    </div>
  </div></div>`;
}

// ----- profile -----
SCREENS.profile = () => {
  const u = S.user, m = me();
  const p = S.prefs;
  if (!u) {
    return `<div class="screen">${top('El profile', 'home')}<div class="body">
      <div class="card shadow" style="border-width:3px;border-radius:20px;background:var(--teal);color:var(--cream);padding:16px;display:flex;align-items:center;gap:14px">
        ${av(m ? m.name : '?', m ? m.color : '#6B5444', 'lg')}<div style="flex:1"><span style="font:400 28px/1 var(--display)">${esc(m ? m.name : 'Guest').toUpperCase()}</span><br><span style="font:500 13px var(--body)">Guest · el stats mesh betetsagel</span></div></div>
      <button class="btn red cta" data-act="login">E3mel 7esab aw da5ol</button>
      ${m ? `<button class="btn" data-act="editGuest">Ghayyar esmak aw lonak</button>` : ''}
      ${prefsCard(p)}
      <p class="note center">Matetkallemsh ${APP_VERSION}</p>
    </div></div>`;
  }
  const st = u.stats || {};
  const avg = st.actedCorrect ? Math.round(st.actSecs / st.actedCorrect) : 0;
  return `<div class="screen">${top('El profile', 'home', `<button class="btn sm" data-act="signOut">5orog</button>`)}<div class="body">
    <div class="card shadow" style="border-width:3px;border-radius:20px;background:var(--teal);color:var(--cream);padding:16px;display:flex;align-items:center;gap:14px">
      ${av(u.name, u.color, 'lg')}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font:400 28px/1 var(--display)">${esc(u.name).toUpperCase()}</span>
        <span style="font:500 13px var(--body)">@${esc(u.username || '')}</span>
        <span class="stamp" style="align-self:flex-start;margin-top:4px;font-size:11px">${st.games || 0} le3ba · ${st.wins || 0} kesb</span>
      </div>
    </div>
    ${S.ui.editProfile ? `<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
      <div class="field"><label for="p-name">Esmak</label><input id="p-name" class="input" maxlength="16" value="${esc(S.ui.pname ?? u.name)}" data-model="ui.pname"></div>
      ${swatches('ui.pcolor', S.ui.pcolor || u.color)}
      <button class="btn must" data-act="saveProfile">Save</button></div>`
      : `<button class="btn" data-act="editProfile">${I.pencil.replace('<svg', '<svg width="16" height="16"')} Ghayyar el esm aw el lon</button>`}
    <span class="h">El arqam</span>
    <div class="grid3">
      <div class="stat"><b>${st.games || 0}</b><span>Le3ba</span></div>
      <div class="stat"><b style="color:var(--green-ink)">${st.wins || 0}</b><span>Kesb</span></div>
      <div class="stat"><b>${st.actedCorrect || 0}</b><span>Massalt sa7</span></div>
      <div class="stat"><b>${avg ? fmt(avg * 1000) : '—'}</b><span>Motawasset</span></div>
      <div class="stat"><b>${st.guessed || 0}</b><span>5ammant</span></div>
      <div class="stat"><b style="color:var(--red2)">${st.fouls || 0}</b><span>Faul</span></div>
    </div>
    <span class="h">El gawayez</span>
    <div style="display:flex;gap:8px">
      ${badge(I.trophy, `A7san momassel ×${st.bestActor || 0}`, st.bestActor)}
      ${badge(I.bolt, `Asra3 ta5meen ×${st.fastest || 0}`, st.fastest)}
      ${badge(I.lock, '10 le3ab', (st.games || 0) >= 10)}
    </div>
    <div class="hrow"><span class="h">Akher le3ab</span><button class="btn sm" data-act="friends">${I.users.replace('<svg', '<svg width="16" height="16"')} El so7ab</button></div>
    <div class="card list">${S.recent.map(r => `<div class="row" style="font-size:14px"><b style="width:44px;color:${r.won === true ? 'var(--green-ink)' : r.won === false ? 'var(--red2)' : 'var(--muted)'}">${r.won === true ? 'KESB' : r.won === false ? '5ESR' : '='}</b><span class="grow">${esc(r.teams[0].name)} ${r.teams[0].score} – ${r.teams[1].score} ${esc(r.teams[1].name)}</span><span class="sub">${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>`).join('') || '<div class="row note">Lessa mal3ebtesh</div>'}</div>
    ${prefsCard(p)}
    <p class="note center">Matetkallemsh ${APP_VERSION}</p>
  </div></div>`;
};
function badge(ic, txt, on) {
  return `<div style="flex:1;border:2px ${on ? 'solid' : 'dashed'} ${on ? 'var(--ink)' : 'var(--muted)'};border-radius:14px;background:${on ? 'var(--must)' : 'transparent'};padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;color:${on ? 'var(--ink)' : 'var(--muted)'}"><span style="width:28px;height:28px;display:flex">${ic}</span><span style="font:700 12px/1.2 var(--body)">${txt}</span></div>`;
}
function prefsCard(p) {
  return `<div class="card list">
    <div class="opt"><span>Sot</span><button class="tog ${p.sound ? 'on' : ''}" role="switch" aria-checked="${p.sound}" data-act="pref" data-k="sound" aria-label="Sot"></button></div>
    <div class="opt"><span>Hazzaz <span class="note">(Android)</span></span><button class="tog ${p.vibrate ? 'on' : ''}" role="switch" aria-checked="${p.vibrate}" data-act="pref" data-k="vibrate" aria-label="Hazzaz"></button></div>
  </div>`;
}

// ----- friends -----
SCREENS.friends = () => {
  const F = S.friends, uid = myId();
  const reqs = F.list.filter(f => f.status === 'pending' && f.to === uid);
  const sent = F.list.filter(f => f.status === 'pending' && f.from === uid);
  const fr = F.list.filter(f => f.status === 'accepted');
  const other = f => f.users.find(x => x !== uid);
  const P = id => F.players[id] || { name: '…', color: '#6B5444' };
  const online = p => p.lastSeen && Date.now() - p.lastSeen < 150000;
  return `<div class="screen">${top('El so7ab', 'profile')}<div class="body">
    <div class="inrow">
      <label class="card" style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:48px;padding:0 12px;border-radius:12px">${I.search.replace('<svg', '<svg width="18" height="18"')}
        <input id="fq" style="flex:1;min-width:0;border:none;background:none;font:500 15px var(--body)" autocapitalize="off" placeholder="@username" value="${esc(F.q)}" data-model="friends.q" data-enter="findFriend" aria-label="Dawwar 3ala sa7bak"></label>
      <button class="btn ink" data-act="findFriend">Dawwar</button>
    </div>
    ${F.msg ? `<p class="note">${esc(F.msg)}</p>` : ''}
    ${F.found ? `<div class="card row">${av(F.found.name, F.found.color)}<span class="grow"><b>${esc(F.found.name)}</b><span class="sub">@${esc(F.found.username)}</span></span><button class="btn must sm" data-act="addFriend" data-id="${esc(F.found.uid)}">Zawwed</button></div>` : ''}
    ${reqs.length ? `<span class="h">Talabat (${reqs.length})</span><div class="card list">${reqs.map(f => { const p = P(other(f)); return `<div class="row">${av(p.name, p.color)}<span class="grow"><b>${esc(p.name)}</b><span class="sub">@${esc(p.username || '')}</span></span>
      <button class="iconbtn" style="border-radius:10px;background:var(--green);color:var(--cream);width:40px;height:40px" data-act="acceptFriend" data-id="${f.id}" aria-label="Ewafe2">${I.check}</button>
      <button class="iconbtn" style="border-radius:10px;width:40px;height:40px" data-act="removeFriend" data-id="${f.id}" aria-label="Arfod">${I.x}</button></div>`; }).join('')}</div>` : ''}
    <span class="h">So7abak (${fr.length})</span>
    <div class="card list">${fr.map(f => { const id = other(f), p = P(id), on = online(p); return `<div class="row">
      <span style="position:relative">${av(p.name, p.color)}${on ? '<span style="position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:50%;background:var(--green);border:2px solid var(--cream)"></span>' : ''}</span>
      <span class="grow"><b>${esc(p.name)}</b><span class="sub" style="${on ? 'color:var(--green-ink)' : ''}">${on ? (p.room ? 'Online · fe oda ' + esc(p.room) : 'Online') : 'Mesh mawgood'}</span></span>
      ${S.roomCode && S.room ? `<button class="btn must sm" data-act="invite" data-id="${esc(id)}">E3zemo</button>` : on && p.room ? `<button class="btn teal sm" data-act="joinCode" data-v="${esc(p.room)}">Od5ol</button>` : ''}
    </div>`; }).join('') || '<div class="row note">Lessa mafeesh so7ab — dawwar bel username.</div>'}</div>
    ${sent.length ? `<p class="note">Mestanni ${sent.length} ${sent.length === 1 ? 'talab' : 'talabat'} yetwaf2 3aleihom.</p>` : ''}
    <div class="card" style="border-style:dashed;display:flex;align-items:center;gap:10px;padding:12px;margin-top:auto"><span style="flex:1;font:500 13px/1.4 var(--body)">Ib3at link el app le so7abak 3al WhatsApp</span><button class="btn green sm" data-act="shareApp">Share</button></div>
  </div></div>`;
};

// ----- overlays -----
function overlays() {
  let h = '';
  const g = G();
  if (S.ui.reveal && g && g.turn) {
    const help = E.HELPS.find(x => x.id === S.ui.reveal);
    const val = E.helpValue(g.turn.title, S.ui.reveal);
    const arabic = /[؀-ۿ]/.test(val);
    h += `<div class="reveal" role="dialog" aria-label="Mosa3da"><span class="stamp ink">Mosa3da · ${esc(help.label)}</span>
      <div class="card"><div class="val ${arabic ? '' : 'lat'}">${esc(val)}</div></div>
      <p style="margin:0;font:600 15px var(--body)">Laff el telefon le fare2ak — el 3onwan mestakhabba</p>
      <button class="btn ink cta" data-act="closeReveal">Rage3 lel 3onwan</button></div>`;
  }
  if (S.ui.sheet === 'signs') {
    h += `<div class="overlay" data-act="closeSheet"><div class="sheet" data-stop>
      <div class="hrow"><span class="h">Esharat el aflam</span><button class="iconbtn" data-act="closeSheet" aria-label="E2fel">${I.x}</button></div>
      ${signsGrid()}<p class="note">Ebda2 dayman bel no3 (film, mosalsal, masra7eya) w 3adad el kalemat.</p></div></div>`;
  }
  if (S.ui.sheet === 'foul') {
    h += `<div class="overlay" data-act="closeSheet"><div class="sheet" data-stop>
      <span class="h">Faul?</span><p class="note" style="color:var(--ink)">El momassel etkallem aw 2al kelma — el dor hayekhlas men gher no2ta.</p>
      <button class="btn must cta" data-act="foul">Aywa, faul</button><button class="btn" data-act="closeSheet">La2, kammel</button></div></div>`;
  }
  if (S.ui.sheet === 'end') {
    h += `<div class="overlay" data-act="closeSheet"><div class="sheet" data-stop>
      <span class="h">Ne2fel el le3ba?</span><p class="note" style="color:var(--ink)">Hanshoof el natiga b el no2at elly ma3ana dlwa2ty.</p>
      <button class="btn red cta" data-act="endGame">Aywa, el natiga</button><button class="btn" data-act="closeSheet">La2, kammel</button></div></div>`;
  }
  if (S.ui.sheet === 'menu') {
    h += `<div class="overlay" data-act="closeSheet"><div class="sheet" data-stop>
      <span class="h">El le3ba</span>
      ${prefsCard(S.prefs)}
      <button class="btn" data-act="signs">Esharat el aflam</button>
      <button class="btn must" data-act="endAsk">5alas — ne2fel el le3ba</button>
      <button class="btn ghost" data-act="${S.mode === 'online' ? 'leaveRoom' : 'pauseHome'}">${S.mode === 'online' ? 'Ekhrog men el oda' : 'Rage3 lel bedaya (el le3ba mesagala)'}</button>
      <button class="btn" data-act="closeSheet">Kammel</button></div></div>`;
  }
  return h;
}

// ---------- after render: timers ----------
let tickTimer = null, lastSec = -1, timeoutSent = 0;
function afterRender() {
  const g = G();
  clearInterval(tickTimer);
  if (S.screen === 'game' && g && g.phase === 'acting') {
    keepAwake(true);
    tickTimer = setInterval(tick, 200);
    tick();
  } else {
    keepAwake(S.screen === 'game' && g && g.phase !== 'over');
  }
}
function tick() {
  const g = G();
  if (!g || g.phase !== 'acting') { clearInterval(tickTimer); return; }
  const left = E.timeLeft(g), tot = g.settings.turnSec * 1000;
  document.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmt(left); });
  const ring = document.querySelector('[data-ring]');
  if (ring) { ring.setAttribute('stroke-dashoffset', 251.3 * (1 - left / tot)); if (left < 10500) { ring.setAttribute('stroke', '#FF7B5C'); ring.closest('.timer').classList.add('warn'); } }
  const bar = document.querySelector('[data-bar]'); if (bar) bar.style.width = (left / tot) * 100 + '%';
  const sec = Math.ceil(left / 1000);
  const actorHere = S.mode === 'local' || (E.actorOf(g) || {}).id === myId();
  if (sec !== lastSec) {
    lastSec = sec;
    if (actorHere && sec <= 10 && sec > 0) (sec <= 3 ? sfx.lastTick : sfx.tick)();
  }
  if (left <= 0 && Date.now() - timeoutSent > 1500) {
    // the actor's phone ends the turn; other phones step in after a short grace period
    const late = Date.now() - g.turn.endsAt;
    if (actorHere || late > 2500) { timeoutSent = Date.now(); act({ type: 'timeout' }); }
  }
}

// ---------- game actions (local and online share the engine) ----------
async function act(action) {
  action.now = action.now ?? Date.now();
  if (S.mode === 'local') {
    try {
      S.game = E.apply(S.game, action);
    } catch (e) { toast(e.message); return; }
    save('mk_game', S.game);
    onGameChange();
    render();
    return true;
  }
  try {
    await C.roomTx(S.roomCode, room => {
      if (!room.game) throw new Error('Mafeesh le3ba');
      const game = E.apply(room.game, action);
      return { ...room, game, status: game.phase === 'over' ? 'over' : 'playing', updatedAt: Date.now() };
    });
    return true;
  } catch (e) {
    if (action.type !== 'timeout') toast(e.message || C.friendlyError(e));
    return false;
  }
}

// Sounds & side effects when the game moves on (works for local and for room snapshots).
function onGameChange() {
  const g = G();
  if (!g) return;
  const t = g.turn || {};
  const sig = `${g.startedAt}|${g.turnNo}|${g.phase}|${(t.helps || []).length}|${t.skips || 0}`;
  if (sig === S.lastSig) return;
  const prev = S.lastSig.split('|');
  S.lastSig = sig;
  if (prev[0] !== String(g.startedAt)) return; // first load: no sounds
  if (g.phase === 'acting' && prev[2] === 'ready') sfx.clap();
  if (g.phase === 'acting' && prev[2] === 'acting' && prev[3] !== String(t.helps.length)) sfx.help();
  if (g.phase === 'result') {
    const h = g.history[g.history.length - 1];
    ({ correct: sfx.correct, foul: sfx.foul, timeout: sfx.buzzer }[h.result] || (() => {}))();
  }
  if (g.phase === 'over' && prev[2] !== 'over') {
    sfx.win(); setTimeout(() => confetti(g.teams.map(x => x.color).concat(['#F3B62E', '#FFF8EA'])), 150);
    recordGame(g);
  }
  if (g.phase !== 'ready') S.ui.readyShown = false;
  if (g.phase !== 'acting') S.ui.reveal = null;
}

async function recordGame(g) {
  save('mk_last', { a: g.teams[0].name, b: g.teams[1].name, as: g.teams[0].score, bs: g.teams[1].score });
  if (!S.user || !S.cloud) return;
  const uid = S.user.uid;
  const team = g.teams.findIndex(t => t.players.some(p => p.id === uid));
  if (team < 0) return;
  const key = `mk_saved_${g.startedAt}_${uid}`;
  if (load(key)) return;
  save(key, 1);
  try {
    await C.addGameStats(uid, E.playerStats(g, uid), {
      at: Date.now(), mode: S.mode, teams: g.teams.map(t => ({ name: t.name, score: t.score })),
      won: g.winner === -1 ? null : g.winner === team, myTeam: team,
    });
  } catch (e) { save(key, null); }
}

// ---------- event handling ----------
const A = {}; // actions by name

A.home = () => go('home');
A.login = () => { S.ui.loginTab = S.cloud ? 'in' : 'guest'; go('login'); };
A.profile = async () => {
  if (!me()) return A.login();
  go('profile');
  if (S.user && S.cloud) { try { S.recent = await C.recentGames(S.user.uid, 5); render(); } catch {} }
};
A.friends = () => { if (!S.user) return A.login(); go('friends'); };
A.loginTab = d => { S.ui.loginTab = d.v; S.ui.err = ''; render(); };
A.setModel = d => { setPath(d.model, d.v); render(); };
A.editGuest = () => { S.ui.loginTab = 'guest'; S.ui.gname = S.guest && S.guest.name; S.ui.color = S.guest && S.guest.color; go('login'); };
A.guestGo = () => {
  const name = (S.ui.gname || '').trim();
  if (!name) { S.ui.err = 'Ekteb esmak.'; return render(); }
  S.guest = { name, color: S.ui.color || COLORS[0] };
  save('mk_guest', S.guest);
  afterLogin();
};
A.signIn = async () => {
  S.ui.busy = true; S.ui.err = ''; render();
  try { await C.signIn(S.ui.email || '', S.ui.pass || ''); S.ui.pass = ''; }
  catch (e) { S.ui.err = C.friendlyError(e); }
  S.ui.busy = false; render();
};
A.signUp = async () => {
  if (!(S.ui.name || '').trim()) { S.ui.err = 'Ekteb esmak.'; return render(); }
  S.ui.busy = true; S.ui.err = ''; render();
  try {
    await C.signUp({ email: S.ui.email || '', password: S.ui.pass || '', name: S.ui.name, username: S.ui.username, color: S.ui.color || COLORS[0] });
    S.ui.pass = '';
  } catch (e) { S.ui.err = C.friendlyError(e); }
  S.ui.busy = false; render();
};
A.forgot = async () => {
  if (!S.ui.email) { S.ui.err = 'Ekteb el email el awel.'; return render(); }
  try { await C.resetPassword(S.ui.email); toast('Ba3atna link le el email — bos fel spam kaman.'); } catch (e) { S.ui.err = C.friendlyError(e); render(); }
};
A.signOut = async () => { await C.signOutUser(); S.user = null; toast('5aragt.'); go('home'); };
A.editProfile = () => { S.ui.editProfile = true; S.ui.pname = S.user.name; S.ui.pcolor = S.user.color; render(); };
A.saveProfile = async () => {
  const name = (S.ui.pname || '').trim(); if (!name) return;
  try { await C.updatePlayer(S.user.uid, { name, color: S.ui.pcolor || S.user.color }); S.ui.editProfile = false; } catch (e) { toast(C.friendlyError(e)); }
};
A.pref = d => { S.prefs[d.k] = !S.prefs[d.k]; save('mk_prefs', S.prefs); setPrefs(S.prefs); render(); };

// setup
A.newLocal = () => { if (!me()) return A.login(); newSetup(false); go('setup'); };
A.newOnline = () => {
  if (!S.cloud) return toast('El le3b men kaza telefon me7tag Firebase setup — el3abo 3ala telefon wa7ed dlwa2ty.', { ms: 4500 });
  if (!me()) return A.login();
  newSetup(true); go('setup');
};
A.setupMode = d => {
  if (d.v === 'online' && !S.cloud) return toast('Kaza telefon me7tag Firebase setup.');
  const keep = S.setup; newSetup(d.v === 'online'); S.setup.settings = keep.settings; render();
};
A.toggleArr = d => {
  const arr = S.setup.settings[d.k];
  const i = arr.indexOf(d.v);
  if (i >= 0) { if (arr.length === 1 && d.k !== 'helps') return toast('Lazem wa7ed 3al a2al'); arr.splice(i, 1); } else arr.push(d.v);
  render();
};
A.setSetting = d => { S.setup.settings[d.k] = d.num ? Number(d.v) : d.v; render(); };
A.toggleSetting = d => { S.setup.settings[d.k] = !S.setup.settings[d.k]; render(); };
A.stepSetting = d => {
  const s = S.setup.settings, step = d.k === 'minutes' ? 5 : d.k === 'score' ? 1 : 1;
  s[d.k] = Math.max(Number(d.min), Math.min(Number(d.max), (s[d.k] || 0) + Number(d.d) * step));
  render();
};
A.teamColor = d => { S.setup.teams[d.i].color = d.v; render(); };
A.addPlayer = d => {
  const i = Number(d.i), name = (S.setup.add[i] || '').trim();
  if (!name) return;
  S.setup.teams[i].players.push({ id: 'p' + uid8(), name });
  S.setup.add[i] = '';
  render();
  const el = document.getElementById('add' + i); if (el) el.focus();
};
A.removePlayer = d => { const t = S.setup.teams[d.i]; t.players = t.players.filter(p => p.id !== d.id); render(); };
A.randomTeams = () => {
  const all = S.setup.teams.flatMap(t => t.players);
  if (all.length < 2) return toast('Zawwed la3eeba el awel');
  const [a, b] = E.splitRandom(all);
  S.setup.teams[0].players = a; S.setup.teams[1].players = b;
  sfx.tap(); render();
};
A.startSetup = async () => {
  const st = S.setup, s = st.settings;
  st.teams.forEach((t, i) => { t.name = (t.name || '').trim() || (i ? 'El Nesr' : 'El Asad'); });
  if (E.filterPool(TITLES, s).length < 4) { S.ui.err = 'El e5tiyarat di feha 3anaween olayela — zawwed anwa3 aw azmena.'; return render(); }
  save('mk_setup', { settings: s, teams: st.teams.map(t => ({ name: t.name, color: t.color, players: st.online ? [] : t.players })) });
  if (!st.online) {
    if (st.teams.some(t => !t.players.length)) { S.ui.err = 'Kol fare2 me7tag la3eb wa7ed 3al a2al.'; return render(); }
    S.mode = 'local';
    S.game = E.newGame(s, st.teams);
    S.lastSig = '';
    save('mk_game', S.game);
    onGameChange();
    go('game');
    return;
  }
  await createOnlineRoom(st);
};

// pick
A.pickType = d => { S.pick.type = d.v; render(); };
A.reshuffle = () => {
  const g = G(); const pool = E.filterPool(TITLES, g.settings, g.used);
  S.pick.sug = E.suggestions(pool, 4); S.pick.sel = null; S.pick.q = ''; sfx.tap(); render();
};
A.selTitle = d => {
  const t = TITLES.find(x => x.id === d.id) || (S.pick.sel && S.pick.sel.id === d.id ? S.pick.sel : null);
  S.pick.sel = t; render();
};
A.toggleCustom = () => { S.pick.showCustom = !S.pick.showCustom; render(); };
A.customType = d => { S.pick.ctype = d.v; render(); };
A.useCustom = () => {
  const txt = (S.pick.custom || '').trim();
  if (!txt) return toast('Ekteb el 3onwan');
  S.pick.sel = E.makeCustomTitle(txt, S.pick.ctype || 'Film'); S.pick.showCustom = false; render();
};
A.confirmPick = () => { if (S.pick && S.pick.sel) act({ type: 'pick', title: S.pick.sel }); };
A.chooseActor = d => act({ type: 'chooseActor', playerId: d.id });
A.showTitle = () => { S.ui.readyShown = true; unlockAudio(); render(); };
A.startTurn = () => { unlockAudio(); act({ type: 'start' }); };
A.useHelp = async d => {
  const g = G();
  if (g.turn.helps.includes(d.v)) { if (S.mode === 'local') { S.ui.reveal = d.v; render(); } return; }
  const ok = await act({ type: 'help', helpId: d.v });
  if (ok && S.mode === 'local') { S.ui.reveal = d.v; render(); }
};
A.closeReveal = () => { S.ui.reveal = null; render(); };
A.correct = () => act({ type: 'correct', by: S.mode === 'online' ? myId() : null });
A.skip = () => {
  const g = G();
  const pool = E.filterPool(TITLES, g.settings, g.used.concat([g.turn.title.id]));
  if (!pool.length) return toast('Mafeesh 3anaween tanya');
  S.ui.shake = true; setTimeout(() => { S.ui.shake = false; }, 500);
  act({ type: 'skip', title: E.suggestions(pool, 1)[0] });
};
A.foulAsk = () => { S.ui.sheet = 'foul'; render(); };
A.foul = () => { S.ui.sheet = null; act({ type: 'foul', by: S.mode === 'online' ? myId() : null }); };
A.nextTurn = () => act({ type: 'next' });
A.endAsk = () => { S.ui.sheet = 'end'; render(); };
A.endGame = () => { S.ui.sheet = null; act({ type: 'end' }); };
A.signs = () => { S.ui.sheet = 'signs'; render(); };
A.gameMenu = () => { S.ui.sheet = 'menu'; render(); };
A.closeSheet = () => { S.ui.sheet = null; render(); };
A.resume = () => { S.mode = 'local'; S.lastSig = ''; onGameChange(); go('game'); };
A.pauseHome = () => { S.ui.sheet = null; go('home'); };
A.shareGame = () => { const g = G(); shareGame(g, E.awards(g)); };
A.playAgain = async () => {
  const g = G();
  if (S.mode === 'local') {
    newSetup(false);
    S.setup.teams = g.teams.map(t => ({ name: t.name, color: t.color, players: t.players.map(p => ({ ...p })) }));
    S.setup.settings = { ...g.settings };
    S.game = null; save('mk_game', null);
    return go('setup');
  }
  try {
    await C.roomTx(S.roomCode, room => ({ ...room, status: 'lobby', game: null, updatedAt: Date.now() }));
  } catch (e) { toast(C.friendlyError(e)); }
};

// online room
async function ensureAuthUid() {
  if (S.authUid) return S.authUid;
  const u = await C.signInGuest();
  S.authUid = u.uid;
  return u.uid;
}

async function createOnlineRoom(st) {
  S.ui.busy = true; render();
  try {
    const uid = await ensureAuthUid();
    const m = me();
    let code = null;
    for (let i = 0; i < 6 && !code; i++) {
      const c = E.roomCode();
      try {
        await C.createRoom(c, {
          code: c, host: uid, status: 'lobby', createdAt: Date.now(), updatedAt: Date.now(),
          settings: st.settings, teams: st.teams.map(t => ({ name: t.name, color: t.color })),
          players: { [uid]: { name: m.name, color: m.color, team: 0, at: Date.now() } }, game: null,
        });
        code = c;
      } catch (e) { if (e.message !== 'taken') throw e; }
    }
    if (!code) throw new Error('Garrab tany');
    openRoom(code);
  } catch (e) { S.ui.err = C.friendlyError(e); }
  S.ui.busy = false;
  render();
}

function openRoom(code) {
  if (S.unsubRoom) S.unsubRoom();
  S.mode = 'online';
  S.roomCode = code; save('mk_room', code);
  S.room = null; S.lastSig = '';
  S.screen = 'lobby';
  S.unsubRoom = C.watchRoom(code, room => {
    const uid = myId();
    if (!room || !room.players || !room.players[uid]) {
      if (S.roomCode === code) { closeRoom(); toast(room ? 'Etshalt men el oda.' : 'El oda et2aflet.'); go('home'); }
      return;
    }
    S.room = room;
    if (room.game && (room.status === 'playing' || room.status === 'over')) {
      onGameChange();
      if (S.screen === 'lobby') S.screen = 'game';
    } else if (S.screen === 'game') {
      S.screen = 'lobby'; S.lastSig = '';
    }
    if (['lobby', 'game'].includes(S.screen)) render();
  }, e => toast(C.friendlyError(e)));
  if (S.user) C.heartbeat(S.user.uid, code);
  render();
}

function closeRoom() {
  if (S.unsubRoom) S.unsubRoom();
  S.unsubRoom = null; S.room = null; S.roomCode = null; save('mk_room', null);
  S.mode = 'local';
  if (S.user) C.heartbeat(S.user.uid, null);
}

A.backToRoom = () => { S.screen = S.room && S.room.game && S.room.status !== 'lobby' ? 'game' : 'lobby'; render(); };
A.join = () => joinRoom(S.joinCode);
A.joinCode = d => { S.joinCode = d.v; joinRoom(d.v); };
async function joinRoom(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (code.length !== 4) return toast('El code 4 7roof');
  if (!S.cloud) return toast('El le3b men kaza telefon me7tag Firebase setup.');
  if (!me()) { S.pendingJoin = code; return A.login(); }
  try {
    const uid = await ensureAuthUid();
    const m = me();
    await C.roomTx(code, room => {
      if (room.players && room.players[uid]) return { ...room, players: { ...room.players, [uid]: { ...room.players[uid], name: m.name, color: m.color } } };
      if (room.status !== 'lobby') throw new Error('El le3ba bada2et — estanna lamma te5las.');
      return { ...room, players: { ...room.players, [uid]: { name: m.name, color: m.color, team: null, at: Date.now() } }, updatedAt: Date.now() };
    });
    S.joinCode = '';
    openRoom(code);
  } catch (e) { toast(C.friendlyError(e)); }
}
A.leaveRoom = async () => {
  S.ui.sheet = null;
  const code = S.roomCode, uid = myId(), r = S.room;
  closeRoom();
  go('home');
  if (code && uid && r && r.status === 'lobby') {
    try { await C.roomTx(code, room => { const p = { ...room.players }; delete p[uid]; return { ...room, players: p, host: room.host === uid ? (Object.keys(p)[0] || room.host) : room.host }; }); } catch {}
  }
};
A.joinTeam = d => roomUpdate(room => { const uid = myId(); room.players[uid] = { ...room.players[uid], team: Number(d.i) }; return room; });
A.movePlayer = d => roomUpdate(room => { if (room.players[d.id]) room.players[d.id].team = Number(d.i); return room; });
A.roomRandom = () => roomUpdate(room => {
  const ids = Object.keys(room.players);
  const [a, b] = E.splitRandom(ids);
  a.forEach(id => { room.players[id].team = 0; }); b.forEach(id => { room.players[id].team = 1; });
  return room;
});
A.roomStart = () => roomUpdate(room => {
  const ps = roomPlayers(room);
  const teams = room.teams.map((t, i) => ({ ...t, players: ps.filter(p => p.team === i).map(p => ({ id: p.id, name: p.name })) }));
  const game = E.newGame(room.settings, teams);
  return { ...room, game, status: 'playing' };
});
A.shareRoom = async () => {
  const link = `${location.origin}${location.pathname}?room=${S.roomCode}`;
  const text = `Ta3ala el3ab Matetkallemsh! Code el oda: ${S.roomCode}`;
  try { if (navigator.share) return await navigator.share({ text, url: link }); } catch { return; }
  window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + link), '_blank');
};
async function roomUpdate(fn) {
  try { await C.roomTx(S.roomCode, room => ({ ...fn(JSON.parse(JSON.stringify(room))), updatedAt: Date.now() })); }
  catch (e) { toast(C.friendlyError(e)); }
}

// friends
A.findFriend = async () => {
  const F = S.friends; F.found = null; F.msg = '';
  try {
    const p = await C.findByUsername(F.q);
    if (!p) F.msg = 'Mala2enash 7ad bel username da.';
    else if (p.uid === S.user.uid) F.msg = 'Da enta :)';
    else F.found = p;
  } catch (e) { F.msg = C.friendlyError(e); }
  render();
};
A.addFriend = async d => {
  try { const r = await C.requestFriend(S.user.uid, d.id); S.friends.found = null; S.friends.msg = r === 'accepted' ? 'Ba2eto so7ab!' : 'Ba3atna el talab.'; }
  catch (e) { S.friends.msg = C.friendlyError(e); }
  render();
};
A.acceptFriend = async d => { try { await C.acceptFriend(d.id); } catch (e) { toast(C.friendlyError(e)); } };
A.removeFriend = async d => { try { await C.removeFriend(d.id); } catch (e) { toast(C.friendlyError(e)); } };
A.invite = async d => {
  try { await C.sendInvite(d.id, { code: S.roomCode, fromUid: S.user.uid, fromName: S.user.name }); toast('Ba3atna el da3wa.'); }
  catch (e) { toast(C.friendlyError(e)); }
};
A.shareApp = async () => {
  const text = 'Ta3ala el3ab Matetkallemsh — le3bet el aflam el masreya!';
  try { if (navigator.share) return await navigator.share({ text, url: location.origin }); } catch { return; }
  window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + location.origin), '_blank');
};
A.acceptInvite = d => { C.clearInvite(S.user.uid, d.id); $('.toast')?.remove(); joinRoom(d.code); };
A.dismissInvite = d => { C.clearInvite(S.user.uid, d.id); $('.toast')?.remove(); };

// generic
function setPath(path, value) {
  const parts = path.split('.');
  let o = S;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.classList.contains('overlay') && e.target.closest('[data-stop]')) return;
  e.preventDefault();
  unlockAudio();
  const fn = A[el.dataset.act];
  if (fn) fn(el.dataset, el);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset || !el.dataset.model) return;
  let v = el.value;
  if (el.dataset.model === 'joinCode') { v = v.toUpperCase(); el.value = v; }
  setPath(el.dataset.model, v);
  if (el.dataset.live === 'pickList') { const box = $('#pickList'); if (box) box.innerHTML = pickList(G()); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.tagName === 'SELECT' && el.dataset.model) { setPath(el.dataset.model, el.value); render(); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (el.dataset && el.dataset.enter) { e.preventDefault(); A[el.dataset.enter] && A[el.dataset.enter](el.dataset); }
  else if (el.id === 'joincode') { e.preventDefault(); A.join(); }
});

// ---------- auth / boot ----------
function afterLogin() {
  if (S.pendingJoin) { const c = S.pendingJoin; S.pendingJoin = null; go('home'); joinRoom(c); return; }
  go('home');
}

function watchUserData(uid) {
  if (S.unsubPlayer) S.unsubPlayer();
  S.unsubPlayer = C.watchPlayer(uid, p => {
    if (!p) return;
    S.user = { ...S.user, ...p, uid, account: true };
    if (['home', 'profile'].includes(S.screen)) render();
  });
  if (S.friends.unsub) S.friends.unsub();
  S.friends.unsub = C.watchFriendships(uid, async list => {
    S.friends.list = list;
    const ids = [...new Set(list.flatMap(f => f.users).filter(x => x !== uid))];
    await Promise.all(ids.map(async id => { try { S.friends.players[id] = await C.getPlayer(id); } catch {} }));
    if (S.screen === 'friends') render();
  });
  if (S.unsubInvites) S.unsubInvites();
  S.unsubInvites = C.watchInvites(uid, list => {
    const fresh = list.filter(i => Date.now() - i.at < 30 * 60000 && i.code !== S.roomCode);
    if (fresh.length) {
      const i = fresh[0];
      toast(`${i.fromName} 3azamak le oda ${i.code}`, { ms: 15000, actions: `<button class="btn must sm" data-act="acceptInvite" data-id="${esc(i.id)}" data-code="${esc(i.code)}">Od5ol</button><button class="btn sm" data-act="dismissInvite" data-id="${esc(i.id)}">La2</button>` });
    }
  });
}

async function boot() {
  const splash = $('#splash');
  const minShow = new Promise(r => setTimeout(r, 1100));
  const params = new URLSearchParams(location.search);
  const roomParam = (params.get('room') || '').toUpperCase();
  if (roomParam) history.replaceState(null, '', location.pathname);

  let authResolved = Promise.resolve();
  try {
    S.cloud = await C.init(FIREBASE_CONFIG);
  } catch (e) { S.cloud = false; console.warn('Firebase init failed', e); }
  if (S.cloud) {
    authResolved = new Promise(resolve => {
      let first = true;
      C.onAuth(async u => {
        S.authUid = u ? u.uid : null;
        if (u && !u.isAnonymous) {
          let p = null;
          try { p = await C.getPlayer(u.uid); } catch {}
          S.user = { uid: u.uid, email: u.email, name: (p && p.name) || u.displayName || 'La3eb', color: (p && p.color) || COLORS[0], username: p && p.username, stats: p && p.stats, account: true };
          watchUserData(u.uid);
          if (!first && S.screen === 'login') afterLogin();
        } else {
          S.user = null;
        }
        if (first) { first = false; resolve(); }
        else if (S.screen !== 'game') render();
      });
    });
  }
  await Promise.race([authResolved, new Promise(r => setTimeout(r, 4000))]);
  await minShow;

  if (roomParam) S.joinCode = roomParam;
  if (!me()) { S.ui.loginTab = S.cloud ? 'in' : 'guest'; S.pendingJoin = roomParam || null; go('login'); }
  else if (roomParam) { go('home'); joinRoom(roomParam); }
  else if (S.roomCode && S.cloud) { go('home'); reopenRoom(S.roomCode); }
  else go('home');

  splash.classList.add('out');
  setTimeout(() => splash.remove(), 400);
  setInterval(() => { if (S.user && S.cloud) C.heartbeat(S.user.uid, S.roomCode); }, 60000);
  if (S.user && S.cloud) C.heartbeat(S.user.uid, S.roomCode);
}

async function reopenRoom(code) {
  try {
    await ensureAuthUid();
    const r = await C.getRoom(code);
    if (r && r.players && r.players[myId()] && r.status !== 'over') openRoom(code);
    else { S.roomCode = null; save('mk_room', null); }
  } catch { S.roomCode = null; save('mk_room', null); }
}

boot();

// expose for tests
window.__mk = { S, A, E, render };
