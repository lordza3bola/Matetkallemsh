// Matetkallemsh — game engine.
// Pure functions shared by one-phone (local) and multi-phone (online) games.
// A game is a plain JSON object; every action returns a NEW game object.

export const TYPES = ['Film', 'Mosalsal', 'Ramadan', 'Sitcom', 'Masra7eya'];
export const TYPE_LABEL = { Film: 'Film', Mosalsal: 'Mosalsal', Ramadan: 'Mosalsal Ramadan', Sitcom: 'Sitcom', Masra7eya: 'Masra7eya' };
export const ERAS = ['Abyad w eswed', '70s-90s', '2000s', 'Gedeed'];
export const DIFFS = ['Sahl', 'Wasat', 'Sa3b'];

export const HELPS = [
  { id: 'genre', label: 'El genre' },
  { id: 'lead', label: 'El batal / batala' },
  { id: 'letter', label: 'Awel 7arf' },
  { id: 'character', label: 'Esm sha5seya' },
  { id: 'quote', label: 'Efeh mashhoora' },
];

export const END_TYPES = [
  { id: 'score', label: 'Bel no2at' },
  { id: 'rounds', label: 'Bel adwar' },
  { id: 'time', label: 'Bel wa2t' },
  { id: 'manual', label: 'Lamma ne2ool' },
];

export function eraOf(year) {
  const y = Number(year);
  if (!y) return '';
  if (y < 1970) return 'Abyad w eswed';
  if (y < 2000) return '70s-90s';
  if (y < 2015) return '2000s';
  return 'Gedeed';
}

export function firstLetter(title) {
  const t = String(title || '').trim();
  if (!t) return '';
  if (t.startsWith('ال') && t.length > 2) return t[2];
  return t[0];
}

export function helpValue(title, helpId) {
  if (!title) return '';
  switch (helpId) {
    case 'genre': return title.g || '';
    case 'lead': return title.l || '';
    case 'letter': return firstLetter(title.t);
    case 'character': return title.c || '';
    case 'quote': return title.q || '';
    default: return '';
  }
}

export function defaultSettings() {
  return {
    types: TYPES.slice(),
    eras: ERAS.slice(),
    diff: 'all',            // 'Sahl' | 'Wasat' | 'Sa3b' | 'all'
    turnSec: 90,
    endType: 'score',
    rounds: 5,              // turns per team
    score: 10,
    minutes: 30,
    points: 1,              // points per correct title (flat)
    skipOn: true,
    skipCost: 1,
    rotate: true,           // actor rotates automatically inside each team
    helps: HELPS.map(h => h.id),
    maxHelps: 2,
    helpCost: 1,
  };
}

export function endLabel(s) {
  switch (s.endType) {
    case 'score': return `Awel ${s.score} no2ta`;
    case 'rounds': return `${s.rounds} adwar lekol fare2`;
    case 'time': return `${s.minutes} d2ee2a`;
    default: return 'Lamma ne2ool 5alas';
  }
}

// ---------- titles ----------

export function filterPool(titles, settings, usedIds = []) {
  const used = new Set(usedIds);
  return titles.filter(t =>
    !used.has(t.id) &&
    settings.types.includes(t.k) &&
    settings.eras.includes(t.e || eraOf(t.y)) &&
    (settings.diff === 'all' || t.d === settings.diff));
}

export function shuffle(list, rand = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function suggestions(pool, n = 4, rand = Math.random) {
  return shuffle(pool, rand).slice(0, n);
}

export function makeCustomTitle(text, kind = 'Film') {
  const t = String(text || '').trim();
  return { id: 'custom:' + t, t, f: '', k: kind, y: 0, e: '', d: '', g: '', l: '', c: '', q: '', custom: true };
}

// ---------- teams ----------

export function splitRandom(players, rand = Math.random) {
  const s = shuffle(players, rand);
  const a = [], b = [];
  s.forEach((p, i) => (i % 2 === 0 ? a : b).push(p));
  return [a, b];
}

// ---------- game ----------

export function newGame(settings, teams, now = Date.now()) {
  if (!teams || teams.length !== 2) throw new Error('Lazem fare2ein');
  teams.forEach(t => { if (!t.players || !t.players.length) throw new Error(`${t.name} mafeesh fih la3eebeen`); });
  const game = {
    v: 1,
    settings: { ...settings },
    teams: teams.map(t => ({ name: t.name, color: t.color, icon: t.icon || '', players: t.players.map(p => (p.av ? { id: p.id, name: p.name, av: p.av } : { id: p.id, name: p.name })), score: 0, turns: 0, actorIdx: 0, bank: 0 })),
    teamTurn: 0,
    turnNo: 1,
    used: [],
    history: [],
    startedAt: now,
    phase: 'pick',
    turn: null,
    winner: null,
  };
  return startTurn(game);
}

function startTurn(game) {
  const g = clone(game);
  const team = g.teams[g.teamTurn];
  // unused helps carry over: each turn adds maxHelps to the team's own bank
  team.bank = (team.bank || 0) + (g.settings.maxHelps || 0);
  const actor = g.settings.rotate ? team.players[team.actorIdx % team.players.length] : null;
  g.turn = {
    team: g.teamTurn,
    actorId: actor ? actor.id : null,
    title: null,
    helps: [],
    skips: 0,
    startedAt: 0,
    endsAt: 0,
    result: null,
    points: 0,
    secs: 0,
    by: null,
  };
  g.phase = actor ? 'pick' : 'chooseActor';
  return g;
}

export function actorOf(game) {
  if (!game || !game.turn) return null;
  const team = game.teams[game.turn.team];
  return team.players.find(p => p.id === game.turn.actorId) || null;
}

export function pickingTeam(game) { return game.turn ? 1 - game.turn.team : 1; }

export function timeLeft(game, now = Date.now()) {
  if (!game || !game.turn || game.phase !== 'acting') return game && game.turn ? game.settings.turnSec * 1000 : 0;
  return Math.max(0, game.turn.endsAt - now);
}

export function helpsLeft(game) {
  if (!game || !game.turn) return 0;
  return Math.max(0, game.teams[game.turn.team].bank || 0);
}

export function availableHelps(game) {
  const t = game.turn && game.turn.title;
  return HELPS.filter(h => game.settings.helps.includes(h.id)).map(h => ({
    ...h,
    used: game.turn.helps.includes(h.id),
    value: helpValue(t, h.id),
  }));
}

export function turnPenalty(game) {
  const s = game.settings;
  return game.turn.helps.length * s.helpCost + game.turn.skips * (s.skipOn ? s.skipCost : 0);
}

// Every action: apply(game, action) -> new game. Throws Error(message) when not allowed.
export function apply(game, a) {
  const now = a.now ?? Date.now();
  const g = clone(game);
  const t = g.turn;
  switch (a.type) {
    case 'chooseActor': {
      need(g.phase === 'chooseActor', 'Mesh wa2to');
      const team = g.teams[t.team];
      need(team.players.some(p => p.id === a.playerId), 'El la3eb mesh fel fare2');
      t.actorId = a.playerId;
      g.phase = 'pick';
      return g;
    }
    case 'pick': {
      need(g.phase === 'pick', 'Mesh wa2t el e5tiyar');
      need(a.title && a.title.t, 'E5taro 3onwan');
      t.title = slimTitle(a.title);
      g.phase = 'ready';
      return g;
    }
    case 'start': {
      need(g.phase === 'ready', 'Mesh wa2to');
      t.startedAt = now;
      t.endsAt = now + g.settings.turnSec * 1000;
      g.phase = 'acting';
      return g;
    }
    case 'help': {
      need(g.phase === 'acting', 'El dor mesh shaghal');
      need(g.settings.helps.includes(a.helpId), 'El mosa3da di ma2foula');
      need(!t.helps.includes(a.helpId), 'Estakhdemtoha 2abl keda');
      need((g.teams[t.team].bank || 0) > 0, 'Khalast el mosa3dat');
      need(helpValue(t.title, a.helpId), 'Mafeesh mosa3da di lel 3onwan da');
      t.helps.push(a.helpId);
      g.teams[t.team].bank -= 1;
      return g;
    }
    case 'skip': {
      need(g.phase === 'acting', 'El dor mesh shaghal');
      need(g.settings.skipOn, 'El skip ma2foul');
      need(a.title && a.title.t, 'Mafeesh 3onwan tany');
      g.used.push(t.title.id);
      t.skips += 1;
      t.title = slimTitle(a.title);
      t.helps = [];
      return g;
    }
    case 'correct':
    case 'foul':
    case 'timeout': {
      if (a.type === 'timeout') need(g.phase === 'acting' && now >= t.endsAt - 250, 'Lessa fi wa2t');
      else need(g.phase === 'acting', 'El dor mesh shaghal');
      const s = g.settings;
      const pen = t.helps.length * s.helpCost + t.skips * (s.skipOn ? s.skipCost : 0);
      t.result = a.type;
      t.points = (a.type === 'correct' ? s.points : 0) - pen;
      t.secs = Math.round((Math.min(now, t.endsAt) - t.startedAt) / 1000);
      t.by = a.by || null;
      const team = g.teams[t.team];
      team.score += t.points;
      team.turns += 1;
      g.used.push(t.title.id);
      const actor = team.players.find(p => p.id === t.actorId);
      g.history.push({
        n: g.turnNo, team: t.team, actorId: t.actorId, actor: actor ? actor.name : '',
        title: t.title.t, titleId: t.title.id, result: t.result, points: t.points, secs: t.secs,
        helps: t.helps.slice(), skips: t.skips, by: t.by,
      });
      g.phase = 'result';
      return g;
    }
    case 'next': {
      need(g.phase === 'result', 'Mesh wa2to');
      const done = g.teams[t.team];
      if (g.settings.rotate) done.actorIdx = (done.actorIdx + 1) % done.players.length;
      if (shouldEnd(g, now)) return finish(g);
      g.teamTurn = 1 - t.team;
      g.turnNo += 1;
      return startTurn(g);
    }
    case 'end': {
      need(g.phase !== 'over', '5alset');
      if (g.phase === 'result' && g.settings.rotate) {
        const done = g.teams[t.team];
        done.actorIdx = (done.actorIdx + 1) % done.players.length;
      }
      return finish(g);
    }
    default:
      throw new Error('Action mesh ma3roof: ' + a.type);
  }
}

export function shouldEnd(g, now = Date.now()) {
  const s = g.settings;
  const [a, b] = g.teams;
  const evenTurns = a.turns === b.turns;
  switch (s.endType) {
    case 'score': return a.score >= s.score || b.score >= s.score;
    case 'rounds': return a.turns >= s.rounds && b.turns >= s.rounds;
    case 'time': return evenTurns && now - g.startedAt >= s.minutes * 60000;
    default: return false;
  }
}

function finish(g) {
  g.phase = 'over';
  g.endedAt = g.endedAt || Date.now();
  const [a, b] = g.teams;
  g.winner = a.score === b.score ? -1 : (a.score > b.score ? 0 : 1);
  return g;
}

// ---------- awards & stats ----------

export function awards(game) {
  const byActor = {};
  let fastest = null;
  for (const h of game.history) {
    if (!h.actorId) continue;
    const r = byActor[h.actorId] || (byActor[h.actorId] = { id: h.actorId, name: h.actor, team: h.team, acted: 0, correct: 0, fouls: 0, secs: 0 });
    r.acted += 1;
    if (h.result === 'correct') {
      r.correct += 1; r.secs += h.secs;
      if (!fastest || h.secs < fastest.secs) fastest = h;
    }
    if (h.result === 'foul') r.fouls += 1;
  }
  const list = Object.values(byActor);
  const best = list.filter(r => r.correct > 0).sort((x, y) => y.correct - x.correct || x.secs - y.secs)[0] || null;
  return { best, fastest, players: list };
}

export function playerStats(game, playerId) {
  const mine = game.history.filter(h => h.actorId === playerId);
  const team = game.teams.findIndex(t => t.players.some(p => p.id === playerId));
  const correct = mine.filter(h => h.result === 'correct');
  const aw = awards(game);
  return {
    games: 1,
    wins: team >= 0 && game.winner === team ? 1 : 0,
    acted: mine.length,
    actedCorrect: correct.length,
    actSecs: correct.reduce((s, h) => s + h.secs, 0),
    fouls: mine.filter(h => h.result === 'foul').length,
    guessed: game.history.filter(h => h.result === 'correct' && h.by === playerId && h.actorId !== playerId).length,
    bestActor: aw.best && aw.best.id === playerId ? 1 : 0,
    fastest: aw.fastest && aw.fastest.actorId === playerId ? 1 : 0,
    team,
  };
}

// ---------- helpers ----------

function slimTitle(t) {
  return { id: t.id, t: t.t, k: t.k || '', y: t.y || 0, g: t.g || '', l: t.l || '', c: t.c || '', q: t.q || '', custom: !!t.custom };
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

export function roomCode(rand = Math.random) {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(rand() * abc.length)];
  return s;
}
