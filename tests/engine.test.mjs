import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

const T = (id, extra = {}) => ({ id, t: 'الكيف ' + id, k: 'Film', y: 1985, e: '70s-90s', d: 'Sahl', g: 'Comedy', l: 'محمود عبد العزيز', c: '', q: '', ...extra });
const titles = [T('a'), T('b'), T('c', { k: 'Masra7eya' }), T('d', { y: 1960, e: 'Abyad w eswed', d: 'Sa3b' })];

let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok -', name); };

const teams = () => [
  { name: 'El Asad', color: '#C8321F', players: [{ id: 'omar', name: 'Omar' }, { id: 'nour', name: 'Nour' }] },
  { name: 'El Nesr', color: '#1F5F7A', players: [{ id: 'karim', name: 'Karim' }] },
];

test('firstLetter skips ال', () => {
  assert.equal(E.firstLetter('الكيف'), 'ك');
  assert.equal(E.firstLetter('عسل إسود'), 'ع');
});

test('filterPool respects types, eras, diff and used', () => {
  const s = E.defaultSettings();
  assert.equal(E.filterPool(titles, s).length, 4);
  assert.equal(E.filterPool(titles, { ...s, types: ['Film'] }).length, 3);
  assert.equal(E.filterPool(titles, { ...s, eras: ['Abyad w eswed'] }).length, 1);
  assert.equal(E.filterPool(titles, { ...s, diff: 'Sa3b' }).length, 1);
  assert.equal(E.filterPool(titles, s, ['a', 'b']).length, 2);
});

test('full correct turn with a help', () => {
  let g = E.newGame(E.defaultSettings(), teams(), 1000);
  assert.equal(g.phase, 'pick');
  assert.equal(E.actorOf(g).name, 'Omar');
  assert.equal(E.pickingTeam(g), 1);
  g = E.apply(g, { type: 'pick', title: titles[0] });
  g = E.apply(g, { type: 'start', now: 2000 });
  assert.equal(E.timeLeft(g, 2000), 90000);
  g = E.apply(g, { type: 'help', helpId: 'lead', now: 3000 });
  assert.throws(() => E.apply(g, { type: 'help', helpId: 'lead' }), /2abl/);
  assert.throws(() => E.apply(g, { type: 'help', helpId: 'quote' }), /Mafeesh/);
  g = E.apply(g, { type: 'correct', now: 32000, by: 'nour' });
  assert.equal(g.phase, 'result');
  assert.equal(g.turn.points, 0); // +1 -1 help
  assert.equal(g.turn.secs, 30);
  assert.equal(g.teams[0].score, 0);
  g = E.apply(g, { type: 'next', now: 33000 });
  assert.equal(g.phase, 'pick');
  assert.equal(E.actorOf(g).name, 'Karim');
  assert.deepEqual(g.used, ['a']);
});

test('max helps enforced', () => {
  let g = E.newGame({ ...E.defaultSettings(), maxHelps: 1 }, teams(), 0);
  g = E.apply(g, { type: 'pick', title: titles[0] });
  g = E.apply(g, { type: 'start', now: 0 });
  g = E.apply(g, { type: 'help', helpId: 'genre', now: 1 });
  assert.throws(() => E.apply(g, { type: 'help', helpId: 'letter' }), /Khalast/);
});

test('unused helps carry over per team', () => {
  let g = E.newGame({ ...E.defaultSettings(), maxHelps: 2 }, teams(), 0);
  const play = (helps) => {
    g = E.apply(g, { type: 'pick', title: titles[0] });
    g = E.apply(g, { type: 'start', now: 0 });
    helps.forEach(h => { g = E.apply(g, { type: 'help', helpId: h, now: 1 }); });
    g = E.apply(g, { type: 'correct', now: 2 });
    g = E.apply(g, { type: 'next', now: 3 });
  };
  play([]);                 // team 0 saves 2
  play(['genre']);          // team 1 uses 1, keeps 1
  assert.equal(E.helpsLeft(g), 4);      // team 0: 2 saved + 2 new
  play(['genre', 'lead', 'letter']);    // team 0 can use 3 now
  assert.equal(E.helpsLeft(g), 3);      // team 1: 1 left + 2 new
});

test('skip costs a point and swaps the title', () => {
  let g = E.newGame(E.defaultSettings(), teams(), 0);
  g = E.apply(g, { type: 'pick', title: titles[0] });
  g = E.apply(g, { type: 'start', now: 0 });
  g = E.apply(g, { type: 'skip', title: titles[1], now: 1000 });
  assert.equal(g.turn.title.id, 'b');
  g = E.apply(g, { type: 'correct', now: 5000 });
  assert.equal(g.turn.points, 0);
  assert.deepEqual(g.used.sort(), ['a', 'b']);
});

test('timeout only after time is up', () => {
  let g = E.newGame(E.defaultSettings(), teams(), 0);
  g = E.apply(g, { type: 'pick', title: titles[0] });
  g = E.apply(g, { type: 'start', now: 0 });
  assert.throws(() => E.apply(g, { type: 'timeout', now: 10000 }), /wa2t/);
  g = E.apply(g, { type: 'timeout', now: 90000 });
  assert.equal(g.turn.result, 'timeout');
  assert.equal(g.turn.points, 0);
});

test('score end condition and winner', () => {
  let g = E.newGame({ ...E.defaultSettings(), score: 2 }, teams(), 0);
  const play = (res) => {
    g = E.apply(g, { type: 'pick', title: E.makeCustomTitle('فيلم ' + g.turnNo) });
    g = E.apply(g, { type: 'start', now: 0 });
    g = E.apply(g, { type: res, now: 1000 });
    g = E.apply(g, { type: 'next', now: 2000 });
  };
  play('correct'); play('foul'); play('correct');
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
  const aw = E.awards(g);
  assert.ok(aw.best);
});

test('rounds end condition waits for both teams', () => {
  let g = E.newGame({ ...E.defaultSettings(), endType: 'rounds', rounds: 1 }, teams(), 0);
  g = E.apply(g, { type: 'pick', title: titles[0] });
  g = E.apply(g, { type: 'start', now: 0 });
  g = E.apply(g, { type: 'correct', now: 1 });
  g = E.apply(g, { type: 'next', now: 2 });
  assert.equal(g.phase, 'pick');
  g = E.apply(g, { type: 'pick', title: titles[1] });
  g = E.apply(g, { type: 'start', now: 0 });
  g = E.apply(g, { type: 'timeout', now: 99999 });
  g = E.apply(g, { type: 'next', now: 100000 });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
});

test('manual actor choice and manual end', () => {
  let g = E.newGame({ ...E.defaultSettings(), rotate: false, endType: 'manual' }, teams(), 0);
  assert.equal(g.phase, 'chooseActor');
  g = E.apply(g, { type: 'chooseActor', playerId: 'nour' });
  assert.equal(E.actorOf(g).name, 'Nour');
  g = E.apply(g, { type: 'end' });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, -1);
});

test('player stats', () => {
  let g = E.newGame({ ...E.defaultSettings(), score: 1 }, teams(), 0);
  g = E.apply(g, { type: 'pick', title: titles[0] });
  g = E.apply(g, { type: 'start', now: 0 });
  g = E.apply(g, { type: 'correct', now: 12000, by: 'nour' });
  g = E.apply(g, { type: 'next', now: 13000 });
  const s = E.playerStats(g, 'omar');
  assert.equal(s.wins, 1); assert.equal(s.actedCorrect, 1); assert.equal(s.actSecs, 12); assert.equal(s.bestActor, 1);
  assert.equal(E.playerStats(g, 'nour').guessed, 1);
  assert.equal(E.playerStats(g, 'karim').wins, 0);
});

test('shared suggestions: first writer wins, reroll replaces, pick clears', () => {
  let g = E.newGame(E.defaultSettings(), teams(), 1000);
  g = E.apply(g, { type: 'suggest', ids: ['a', 'b'], ifEmpty: true });
  g = E.apply(g, { type: 'suggest', ids: ['c', 'd'], ifEmpty: true });
  assert.deepEqual(g.turn.sug, ['a', 'b']);
  g = E.apply(g, { type: 'suggest', ids: ['e', 'f'] });
  assert.deepEqual(g.turn.sug, ['e', 'f']);
  g = E.apply(g, { type: 'pick', title: titles[0] });
  assert.equal(g.turn.sug, undefined);
});

console.log(`\n${pass} tests passed`);
