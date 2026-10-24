# Matetkallemsh!

Le3bet el aflam el masreya — an Egyptian charades (Aflam) party game as a PWA. Franco-Arabic UI, Egyptian titles only (films, series, Ramadan series, sitcoms, plays).

## What's in it

- **One phone (Telefon wa7ed):** works fully offline, guests only need a name.
- **Several phones (Kaza telefon):** room code + QR, every phone equal; the actor sees the title, teammates see the timer, hints and a "Sa7" button, the other team sees the title and a "Faul" button. Needs internet and Firebase.
- **Rules per game:** title types, eras, difficulty, 60/90/120 s turns, 4 ways to end (points, rounds, time, manual), skip for −1, actor rotation or manual choice, which of the 5 helps are allowed and how many per turn (−1 each).
- **Accounts:** email/password (Firebase Auth), username, avatar colour, stats, awards, recent games, friends (requests, online status, room invites). Guests can play without an account.
- Sounds, vibration (Android), confetti, screen kept awake during a game, share card for WhatsApp / Story.

## Files

| Path | What |
|---|---|
| `index.html`, `css/app.css` | Shell and the design A ("Afeesh") styles |
| `js/app.js` | All screens and the one-phone / multi-phone flows |
| `js/engine.js` | Game rules (pure functions, shared by both modes) |
| `js/cloud.js` | Firebase: auth, rooms, presence, friends, invites, stats |
| `js/firebase-config.js` | **Paste the Firebase web config here** |
| `js/titles.js` | Generated from `data/Matetkallemsh-Titles.xlsx` |
| `js/fx.js`, `js/share.js`, `js/icons.js` | Sounds/confetti/wake lock, share card, icons |
| `sw.js`, `manifest.json`, `icons/` | PWA: offline cache, install, icons |
| `firestore.rules` | Security rules to publish in the Firebase console |
| `tools/xlsx_to_titles.py` | Rebuild `js/titles.js` after editing the sheet |
| `tests/` | Engine tests, one-phone browser test, 3-phone test with a stand-in Firebase |

## Editing the titles

1. Edit `data/Matetkallemsh-Titles.xlsx` (sheet `3anaween`). Status `Shilo` removes a title.
2. `python3 tools/xlsx_to_titles.py data/Matetkallemsh-Titles.xlsx js/titles.js`
3. Commit and push.

## Firebase setup (once)

1. Firebase console → **Add project** (e.g. `matetkallemsh`). Analytics not needed.
2. **Build → Authentication → Sign-in method:** enable **Email/Password** and **Anonymous** (guests use Anonymous to join rooms).
3. **Build → Firestore Database → Create database** (production mode, a nearby location such as `europe-west`).
4. **Firestore → Rules:** paste `firestore.rules`, Publish.
5. **Project settings → Your apps → Web (</>)**: register the app, copy the `firebaseConfig` object into `js/firebase-config.js`.
6. **Authentication → Settings → Authorized domains:** add the hosting domain if it isn't listed (`<project>.web.app` is added automatically).
7. Put the project id in `.firebaserc`.

## Publishing (GitHub → Firebase Hosting)

Same as Kashu: every push to `main` runs `.github/workflows/firebase-hosting.yml`.

1. Google Cloud console (same project) → IAM → Service accounts → create `github-deploy` with roles **Firebase Hosting Admin** and **API Keys Viewer** → Keys → Add key → JSON.
2. GitHub repo → Settings → Secrets and variables → Actions → New secret `FIREBASE_SERVICE_ACCOUNT` = the JSON file contents.
3. Push to `main`. The site appears at `https://<project>.web.app`.

## Tests

```
node tests/engine.test.mjs
python3 tests/local_flow.py 390      # one-phone game, headless Chromium
python3 tests/online_flow.py         # 3 phones + stand-in Firebase
```
