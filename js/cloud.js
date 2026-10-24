// Firebase layer: accounts, rooms (multi-phone), presence, friends, invites and stats.
// Everything here is optional: without a Firebase config the app still plays on one phone as a guest.

const V = '10.12.2';
const BASE = `https://www.gstatic.com/firebasejs/${V}`;

let fb = null;        // loaded SDK functions
let app, auth, db;
let ready = false;

export function isReady() { return ready; }

export async function init(config) {
  if (!config || !config.apiKey) return false;
  if (ready) return true;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${BASE}/firebase-app.js`),
    import(`${BASE}/firebase-auth.js`),
    import(`${BASE}/firebase-firestore.js`),
  ]);
  fb = { ...appMod, ...authMod, ...fsMod };
  app = fb.initializeApp(config);
  auth = fb.getAuth(app);
  try { await fb.setPersistence(auth, fb.browserLocalPersistence); } catch {}
  try {
    db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({}) });
  } catch {
    db = fb.getFirestore(app);
  }
  ready = true;
  return true;
}

// ---------- auth ----------

export function onAuth(cb) { return fb.onAuthStateChanged(auth, cb); }
export function currentUser() { return auth && auth.currentUser; }

export function friendlyError(e) {
  const code = (e && e.code) || '';
  const map = {
    'auth/invalid-email': 'El email mesh mazboot.',
    'auth/missing-password': 'Ekteb el password.',
    'auth/weak-password': 'El password lazem 6 7roof 3al a2al.',
    'auth/email-already-in-use': 'El email da 3ando 7esab — da5al be.',
    'auth/invalid-credential': 'El email aw el password ghalat.',
    'auth/wrong-password': 'El password ghalat.',
    'auth/user-not-found': 'Mafeesh 7esab bel email da.',
    'auth/too-many-requests': 'Mo7awlat ktir — estanna shwaya w garrab tany.',
    'auth/network-request-failed': 'Mafeesh internet.',
    'auth/operation-not-allowed': 'Tare2et el do5ool di mesh mefa3ala fel Firebase console.',
    'permission-denied': 'Mesh masmoo7 — ragga3 Firestore rules.',
    'unavailable': 'Mafeesh internet dlwa2ty.',
  };
  return map[code] || (e && e.message) || 'Fi moshkela, garrab tany.';
}

export async function signUp({ email, password, name, username, color }) {
  const uname = normUsername(username);
  if (!uname) throw new Error('Ekhtar username (7roof englizy w ar2am bas).');
  const cred = await fb.createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;
  try {
    await fb.runTransaction(db, async tx => {
      const ref = fb.doc(db, 'usernames', uname);
      const s = await tx.get(ref);
      if (s.exists()) throw new Error('El username da ma7goz, ekhtar wa7ed tany.');
      tx.set(ref, { uid });
      tx.set(fb.doc(db, 'players', uid), {
        name: name.trim(), username: uname, color, createdAt: Date.now(), lastSeen: Date.now(), room: null,
        stats: { games: 0, wins: 0, acted: 0, actedCorrect: 0, actSecs: 0, fouls: 0, guessed: 0, bestActor: 0, fastest: 0 },
      });
    });
    await fb.updateProfile(cred.user, { displayName: name.trim() });
  } catch (e) {
    // roll back the auth account so the person can retry with another username
    try { await cred.user.delete(); } catch {}
    throw e;
  }
  return cred.user;
}

export async function signIn(email, password) {
  const c = await fb.signInWithEmailAndPassword(auth, email.trim(), password);
  return c.user;
}
export async function signOutUser() { await fb.signOut(auth); }
export async function resetPassword(email) { await fb.sendPasswordResetEmail(auth, email.trim()); }
export async function signInGuest() {
  if (auth.currentUser) return auth.currentUser;
  const c = await fb.signInAnonymously(auth);
  return c.user;
}

export function normUsername(u) {
  const s = String(u || '').trim().toLowerCase().replace(/^@/, '');
  return /^[a-z0-9_.]{3,20}$/.test(s) ? s : '';
}

// ---------- players ----------

export async function getPlayer(uid) {
  const s = await fb.getDoc(fb.doc(db, 'players', uid));
  return s.exists() ? { uid, ...s.data() } : null;
}
export function watchPlayer(uid, cb) {
  return fb.onSnapshot(fb.doc(db, 'players', uid), s => cb(s.exists() ? { uid, ...s.data() } : null), () => {});
}
export async function updatePlayer(uid, data) { await fb.updateDoc(fb.doc(db, 'players', uid), data); }
export async function heartbeat(uid, room) {
  try { await fb.updateDoc(fb.doc(db, 'players', uid), { lastSeen: Date.now(), room: room || null }); } catch {}
}

export async function addGameStats(uid, s, summary) {
  const inc = fb.increment;
  await fb.updateDoc(fb.doc(db, 'players', uid), {
    'stats.games': inc(s.games), 'stats.wins': inc(s.wins), 'stats.acted': inc(s.acted),
    'stats.actedCorrect': inc(s.actedCorrect), 'stats.actSecs': inc(s.actSecs), 'stats.fouls': inc(s.fouls),
    'stats.guessed': inc(s.guessed), 'stats.bestActor': inc(s.bestActor), 'stats.fastest': inc(s.fastest),
  });
  await fb.addDoc(fb.collection(db, 'players', uid, 'games'), summary);
}

export async function recentGames(uid, n = 5) {
  const q = fb.query(fb.collection(db, 'players', uid, 'games'), fb.orderBy('at', 'desc'), fb.limit(n));
  const s = await fb.getDocs(q);
  return s.docs.map(d => d.data());
}

// ---------- rooms ----------

export async function createRoom(code, data) {
  const ref = fb.doc(db, 'rooms', code);
  await fb.runTransaction(db, async tx => {
    const s = await tx.get(ref);
    if (s.exists() && s.data().status !== 'over' && Date.now() - (s.data().createdAt || 0) < 6 * 3600e3) throw new Error('taken');
    tx.set(ref, data);
  });
}

export function watchRoom(code, cb, onErr) {
  return fb.onSnapshot(fb.doc(db, 'rooms', code), s => cb(s.exists() ? s.data() : null, s.metadata.hasPendingWrites), onErr || (() => {}));
}

// fn(room) returns the new room (or throws Error to refuse).
export async function roomTx(code, fn) {
  const ref = fb.doc(db, 'rooms', code);
  return fb.runTransaction(db, async tx => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('El oda di mesh mawgooda.');
    const next = fn(s.data());
    if (next) tx.set(ref, next);
    return next;
  });
}

export async function getRoom(code) {
  const s = await fb.getDoc(fb.doc(db, 'rooms', code));
  return s.exists() ? s.data() : null;
}

// ---------- friends ----------

export async function findByUsername(username) {
  const u = normUsername(username);
  if (!u) return null;
  const s = await fb.getDoc(fb.doc(db, 'usernames', u));
  if (!s.exists()) return null;
  return getPlayer(s.data().uid);
}

const pairId = (a, b) => [a, b].sort().join('_');

export async function requestFriend(me, other) {
  const id = pairId(me, other);
  const ref = fb.doc(db, 'friendships', id);
  const s = await fb.getDoc(ref);
  if (s.exists()) {
    const d = s.data();
    if (d.status === 'pending' && d.from !== me) { await fb.updateDoc(ref, { status: 'accepted', at: Date.now() }); return 'accepted'; }
    return d.status;
  }
  await fb.setDoc(ref, { users: [me, other].sort(), from: me, to: other, status: 'pending', at: Date.now() });
  return 'pending';
}
export async function acceptFriend(id) { await fb.updateDoc(fb.doc(db, 'friendships', id), { status: 'accepted', at: Date.now() }); }
export async function removeFriend(id) { await fb.deleteDoc(fb.doc(db, 'friendships', id)); }
export function watchFriendships(uid, cb) {
  const q = fb.query(fb.collection(db, 'friendships'), fb.where('users', 'array-contains', uid));
  return fb.onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => cb([]));
}

// ---------- invites ----------

export async function sendInvite(toUid, invite) {
  await fb.setDoc(fb.doc(db, 'invites', toUid, 'items', invite.code + '_' + invite.fromUid), { ...invite, at: Date.now() });
}
export function watchInvites(uid, cb) {
  const q = fb.query(fb.collection(db, 'invites', uid, 'items'), fb.orderBy('at', 'desc'), fb.limit(5));
  return fb.onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => cb([]));
}
export async function clearInvite(uid, id) { try { await fb.deleteDoc(fb.doc(db, 'invites', uid, 'items', id)); } catch {} }
