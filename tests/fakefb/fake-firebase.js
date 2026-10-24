// Stand-in for the Firebase modular SDK (app + auth + firestore), backed by tests/fakefb/server.py.
// Only what js/cloud.js uses. Shared state lives on globalThis so the 3 SDK URLs act as one SDK.
const G = globalThis.__fakefb || (globalThis.__fakefb = { authCbs: [], user: null, booted: false });
const api = (p, o) => fetch(p, o).then(r => r.json());
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));

// ---------- app ----------
export function initializeApp(cfg) { return { cfg }; }

// ---------- auth ----------
export const browserLocalPersistence = 'local';
export function getAuth() {
  if (!G.booted) {
    G.booted = true;
    try { G.user = JSON.parse(localStorage.getItem('__fake_user') || 'null'); } catch { G.user = null; }
  }
  return { get currentUser() { return G.user ? userObj(G.user) : null; } };
}
export async function setPersistence() {}
function userObj(u) {
  return { uid: u.uid, email: u.email || null, displayName: u.displayName || null, isAnonymous: !!u.anon,
    async delete() { await commit([{ path: 'auth/' + u.email, expect: null, data: null }]); setUser(null); } };
}
function setUser(u) {
  G.user = u;
  localStorage.setItem('__fake_user', JSON.stringify(u));
  const uo = u ? userObj(u) : null;
  G.authCbs.forEach(cb => setTimeout(() => cb(uo), 0));
}
export function onAuthStateChanged(auth, cb) {
  G.authCbs.push(cb);
  setTimeout(() => cb(G.user ? userObj(G.user) : null), 10);
  return () => { G.authCbs = G.authCbs.filter(x => x !== cb); };
}
const err = (code) => { const e = new Error(code); e.code = code; return e; };
export async function createUserWithEmailAndPassword(auth, email, password) {
  if (!/@/.test(email)) throw err('auth/invalid-email');
  if ((password || '').length < 6) throw err('auth/weak-password');
  const cur = await api('/__db/get?path=' + encodeURIComponent('auth/' + email));
  if (cur.data) throw err('auth/email-already-in-use');
  const u = { uid: 'u_' + Math.random().toString(36).slice(2, 9), email, password };
  await commit([{ path: 'auth/' + email, expect: cur.v, data: u }]);
  setUser({ uid: u.uid, email });
  return { user: userObj(G.user) };
}
export async function signInWithEmailAndPassword(auth, email, password) {
  const cur = await api('/__db/get?path=' + encodeURIComponent('auth/' + email));
  if (!cur.data || cur.data.password !== password) throw err('auth/invalid-credential');
  setUser({ uid: cur.data.uid, email, displayName: cur.data.displayName });
  return { user: userObj(G.user) };
}
export async function signInAnonymously() {
  setUser({ uid: 'anon_' + Math.random().toString(36).slice(2, 9), anon: true });
  return { user: userObj(G.user) };
}
export async function signOut() { setUser(null); }
export async function sendPasswordResetEmail() {}
export async function updateProfile(user, p) { G.user = { ...G.user, ...p }; localStorage.setItem('__fake_user', JSON.stringify(G.user)); }

// ---------- firestore ----------
export function persistentLocalCache() { return {}; }
export function initializeFirestore() { return { db: true }; }
export function getFirestore() { return { db: true }; }
export function doc(db, ...parts) { return { type: 'doc', path: parts.join('/'), id: parts[parts.length - 1] }; }
export function collection(db, ...parts) { return { type: 'col', path: parts.join('/') }; }
export function where(field, op, value) { return { kind: 'where', field, op, value }; }
export function orderBy(field, dir = 'asc') { return { kind: 'order', field, dir }; }
export function limit(n) { return { kind: 'limit', n }; }
export function query(col, ...cs) { return { type: 'query', path: col.path, cs }; }
export function increment(n) { return { __inc: n }; }

const snapDoc = (path, d) => ({ id: path.split('/').pop(), exists: () => d != null, data: () => clone(d), metadata: { hasPendingWrites: false } });
async function getRaw(path) { return api('/__db/get?path=' + encodeURIComponent(path)); }
async function commit(writes) {
  const r = await fetch('/__db/commit', { method: 'POST', body: JSON.stringify({ writes }) });
  if (r.status === 409) throw err('aborted');
  return r.json();
}
function setDeep(o, dotted, val) {
  const ks = dotted.split('.');
  let x = o;
  for (let i = 0; i < ks.length - 1; i++) { x[ks[i]] = x[ks[i]] && typeof x[ks[i]] === 'object' ? x[ks[i]] : {}; x = x[ks[i]]; }
  const last = ks[ks.length - 1];
  x[last] = val && val.__inc != null ? (Number(x[last]) || 0) + val.__inc : val;
}
function rulesCheck(path, data) {
  // the one rule the app logic depends on: only the owner writes players/{uid}
  const m = path.match(/^players\/([^/]+)$/);
  if (m && G.user && m[1] !== G.user.uid) throw err('permission-denied');
}

export async function getDoc(ref) { const r = await getRaw(ref.path); return snapDoc(ref.path, r.data); }
export async function setDoc(ref, data) { rulesCheck(ref.path, data); await commit([{ path: ref.path, expect: null, data: clone(data) }]); }
export async function deleteDoc(ref) { await commit([{ path: ref.path, expect: null, data: null }]); }
export async function addDoc(col, data) { const p = col.path + '/a' + Date.now() + Math.random().toString(36).slice(2, 6); await commit([{ path: p, expect: null, data: clone(data) }]); return { id: p.split('/').pop() }; }
export async function updateDoc(ref, data) {
  rulesCheck(ref.path, data);
  for (let i = 0; i < 20; i++) {
    const cur = await getRaw(ref.path);
    if (!cur.data) throw err('not-found');
    const next = clone(cur.data);
    for (const [k, v] of Object.entries(data)) setDeep(next, k, v);
    try { await commit([{ path: ref.path, expect: cur.v, data: next }]); return; } catch (e) { if (e.code !== 'aborted') throw e; }
  }
  throw err('aborted');
}

export async function runTransaction(db, fn) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const reads = {}, writes = {};
    const tx = {
      async get(ref) { const r = await getRaw(ref.path); reads[ref.path] = r.v; return snapDoc(ref.path, r.data); },
      set(ref, data) { writes[ref.path] = clone(data); return tx; },
      update(ref, data) { writes[ref.path] = { __merge: clone(data) }; return tx; },
      delete(ref) { writes[ref.path] = null; return tx; },
    };
    const out = await fn(tx);
    const list = Object.entries(writes).map(([path, data]) => ({ path, expect: path in reads ? reads[path] : null, data }));
    for (const w of list) rulesCheck(w.path, w.data);
    try { await commit(list); return out; } catch (e) {
      if (e.code !== 'aborted') throw e;
      await new Promise(r => setTimeout(r, 20 + Math.random() * 60));
    }
  }
  throw err('aborted');
}

async function runQuery(q) {
  let items = await api('/__db/list?prefix=' + encodeURIComponent(q.path));
  for (const c of q.cs || []) {
    if (c.kind === 'where' && c.op === 'array-contains') items = items.filter(i => (i.data[c.field] || []).includes(c.value));
    if (c.kind === 'where' && c.op === '==') items = items.filter(i => i.data[c.field] === c.value);
    if (c.kind === 'order') items.sort((a, b) => (a.data[c.field] > b.data[c.field] ? 1 : -1) * (c.dir === 'desc' ? -1 : 1));
    if (c.kind === 'limit') items = items.slice(0, c.n);
  }
  return { docs: items.map(i => snapDoc(i.path, i.data)) };
}
export async function getDocs(q) { return runQuery(q); }

export function onSnapshot(ref, cb, onErr) {
  let last = undefined, stop = false;
  const poll = async () => {
    if (stop) return;
    try {
      let snap, key;
      if (ref.type === 'doc') { const r = await getRaw(ref.path); key = JSON.stringify(r.data); snap = snapDoc(ref.path, r.data); }
      else { snap = await runQuery(ref); key = JSON.stringify(snap.docs.map(d => [d.id, d.data()])); }
      if (key !== last) { last = key; cb(snap); }
    } catch (e) { onErr && onErr(e); }
    if (!stop) setTimeout(poll, 120);
  };
  poll();
  return () => { stop = true; };
}
