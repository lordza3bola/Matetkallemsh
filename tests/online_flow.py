"""Multi-phone game with 3 simulated phones and a stand-in Firebase (tests/fakefb)."""
import os, sys, subprocess, time, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'tests', 'shots')
os.makedirs(SHOTS, exist_ok=True)
FAKE = open(os.path.join(ROOT, 'tests', 'fakefb', 'fake-firebase.js'), encoding='utf-8').read()
PORT = 8766
srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'tests', 'fakefb', 'server.py'), ROOT, str(PORT)])
time.sleep(0.8)
BASE = f'http://localhost:{PORT}'
errors, problems = [], []

def phone(b, name, W=390):
    ctx = b.new_context(viewport={'width': W, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
    ctx.route('**/firebasejs/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=FAKE))
    ctx.route('**/js/firebase-config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body="export const FIREBASE_CONFIG = { apiKey: 'fake' };"))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    pg.on('console', lambda m: m.type == 'error' and not any(x in m.text for x in ('fonts.g', 'cdnjs', 'ERR_', 'Failed to load resource')) and errors.append(f'{name}: {m.text}'))
    pg.name = name
    return pg

def click(pg, sel, timeout=4000):
    pg.locator(sel).first.click(timeout=timeout)
    pg.wait_for_timeout(150)

def wait(pg, js, timeout=6000):
    pg.wait_for_function(js, timeout=timeout)

def shot(pg, label):
    pg.wait_for_timeout(250)
    pg.screenshot(path=f'{SHOTS}/online-{pg.name}-{label}.png', full_page=True)
    if pg.evaluate('document.documentElement.scrollWidth') > 391:
        problems.append(f'{pg.name} {label}: sideways scroll')

def signup(pg, name, user, email):
    pg.goto(BASE + '/index.html'); pg.wait_for_timeout(1500)
    click(pg, '[data-act=loginTab][data-v=up]')
    pg.fill('#u-name', name); pg.fill('#u-user', user); pg.fill('#u-email', email); pg.fill('#u-pass', 'secret12')
    click(pg, '[data-act=signUp]')
    wait(pg, "window.__mk.S.screen === 'home' && window.__mk.S.user && window.__mk.S.user.username")

def guest(pg, name, url='/index.html'):
    pg.goto(BASE + url); pg.wait_for_timeout(1500)
    if pg.evaluate("window.__mk.S.screen") == 'login':
        if pg.locator('#g-name').count() == 0:
            click(pg, '[data-act=loginTab][data-v=guest]')
        pg.fill('#g-name', name)
        click(pg, '[data-act=guestGo]')

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        A, C, K = phone(b, 'omar'), phone(b, 'nour'), phone(b, 'karim')
        # accounts
        signup(A, 'Omar', 'omar', 'omar@test.com')
        signup(C, 'Nour', 'nour', 'nour@test.com')
        # friends: Nour finds @omar and sends a request; Omar accepts
        click(C, '[data-act=profile]'); click(C, '[data-act=friends]')
        C.fill('#fq', 'omar'); click(C, '[data-act=findFriend]')
        wait(C, "!!document.querySelector('[data-act=addFriend]')")
        click(C, '[data-act=addFriend]')
        click(A, '[data-act=profile]'); click(A, '[data-act=friends]')
        wait(A, "!!document.querySelector('[data-act=acceptFriend]')")
        shot(A, 'friends-request')
        click(A, '[data-act=acceptFriend]')
        wait(A, "window.__mk.S.friends.list.some(f => f.status === 'accepted')")
        # Omar creates a room
        click(A, '.top [data-act=profile]'); click(A, '.top [data-act=home]')
        click(A, '[data-act=newOnline]')
        A.evaluate("window.__mk.S.setup.settings.score = 2; window.__mk.S.setup.settings.turnSec = 60")
        click(A, '[data-act=startSetup]')
        wait(A, "window.__mk.S.screen === 'lobby' && !!window.__mk.S.room")
        code = A.evaluate('window.__mk.S.roomCode')
        # invite Nour from the friends screen
        A.evaluate("window.__mk.A.friends()")
        wait(A, "!!document.querySelector('[data-act=invite]')")
        click(A, '[data-act=invite]')
        wait(C, "!!document.querySelector('.toast [data-act=acceptInvite]')", 8000)
        shot(C, 'invite-toast')
        click(C, '.toast [data-act=acceptInvite]')
        wait(C, "window.__mk.S.screen === 'lobby' && !!window.__mk.S.room")
        # Karim joins as a guest through the link
        guest(K, 'Karim', f'/index.html?room={code}')
        wait(K, "window.__mk.S.screen === 'lobby' && !!window.__mk.S.room")
        A.evaluate("window.__mk.A.backToRoom()")
        wait(A, "Object.keys(window.__mk.S.room.players).length === 3")
        # teams: Nour -> team 0 (with Omar), Karim -> team 1
        click(C, '[data-act=joinTeam][data-i="0"]')
        click(K, '[data-act=joinTeam][data-i="1"]')
        wait(A, "Object.values(window.__mk.S.room.players).filter(p => p.team === 1).length === 1 && Object.values(window.__mk.S.room.players).filter(p => p.team === 0).length === 2")
        shot(A, 'lobby'); shot(K, 'lobby')
        click(A, '[data-act=roomStart]')
        for pg in (A, C, K):
            wait(pg, "window.__mk.S.screen === 'game' && window.__mk.S.room.game.phase === 'pick'")
        # Karim (team 1) picks for Omar; Omar and Nour wait
        shot(A, 'pick-wait'); shot(K, 'pick')
        assert K.locator('[data-act=selTitle]').count() > 0, 'picker sees titles'
        assert A.locator('[data-act=selTitle]').count() == 0, 'actor must not see titles'
        click(K, '[data-act=selTitle]'); click(K, '[data-act=confirmPick]')
        wait(A, "window.__mk.S.room.game.phase === 'ready'")
        shot(A, 'ready'); shot(C, 'ready-wait')
        click(A, '[data-act=startTurn]')
        for pg in (A, C, K):
            wait(pg, "window.__mk.S.room.game.phase === 'acting'")
        shot(A, 'acting-actor'); shot(C, 'acting-mate'); shot(K, 'acting-opp')
        assert C.locator('.hidden-title').count() == 1, 'teammate sees hidden title'
        assert K.locator('.titlecard').count() == 1, 'opponent sees the title'
        # Nour asks for a help on her phone; it shows on Omar's phone as used
        C.locator('.helpbtn:not([disabled])').first.click(); C.wait_for_timeout(200)
        wait(A, "window.__mk.S.room.game.turn.helps.length === 1")
        wait(C, "!!document.querySelector('.hint')")
        shot(C, 'mate-hint')
        # Nour presses Sa7
        click(C, '[data-act=correct]')
        for pg in (A, C, K):
            wait(pg, "window.__mk.S.room.game.phase === 'result'")
        g = A.evaluate('window.__mk.S.room.game')
        assert g['history'][0]['by'] == C.evaluate('window.__mk.S.user.uid'), 'guess credited to Nour'
        shot(K, 'result')
        click(K, '[data-act=nextTurn]')
        # turn 2: Karim acts, Omar or Nour pick
        wait(A, "window.__mk.S.room.game.phase === 'pick'")
        click(A, '[data-act=selTitle]'); click(A, '[data-act=confirmPick]')
        wait(K, "window.__mk.S.room.game.phase === 'ready'")
        click(K, '[data-act=startTurn]')
        wait(C, "window.__mk.S.room.game.phase === 'acting'")
        # Nour (opponent now) calls a foul
        click(C, '[data-act=foulAsk]'); click(C, '[data-act=foul]')
        wait(K, "window.__mk.S.room.game.phase === 'result'")
        click(A, '[data-act=nextTurn]')
        # turn 3: Nour acts (rotation), Karim picks; time runs out -> timeout from her phone
        wait(K, "window.__mk.S.room.game.phase === 'pick'")
        actor = A.evaluate("window.__mk.S.room.game.turn.actorId")
        assert actor == C.evaluate('window.__mk.S.user.uid'), 'rotation: Nour acts third'
        click(K, '[data-act=selTitle]'); click(K, '[data-act=confirmPick]')
        wait(C, "window.__mk.S.room.game.phase === 'ready'")
        click(C, '[data-act=startTurn]')
        wait(C, "window.__mk.S.room.game.phase === 'acting'")
        # jump the clock on everyone by rewriting endsAt through the shared store
        C.evaluate("""(async () => { const r = window.__mk.S.room; const code = window.__mk.S.roomCode;
          const cur = await (await fetch('/__db/get?path=rooms/' + code)).json();
          cur.data.game.turn.endsAt = Date.now() - 50;
          await fetch('/__db/commit', {method:'POST', body: JSON.stringify({writes:[{path:'rooms/'+code, expect: cur.v, data: cur.data}]})}); })()""")
        for pg in (A, C, K):
            wait(pg, "window.__mk.S.room.game.phase === 'result'", 8000)
        assert A.evaluate("window.__mk.S.room.game.history[2].result") == 'timeout'
        # end the game manually
        click(K, '[data-act=endAsk]'); click(K, '[data-act=endGame]')
        for pg in (A, C, K):
            wait(pg, "window.__mk.S.room.game.phase === 'over'")
        shot(A, 'over'); shot(K, 'over')
        # stats recorded for both accounts
        A.wait_for_timeout(1200)
        dump = json.loads(A.evaluate("fetch('/__db/dump').then(r => r.text())"))
        stats = {v['username']: v['stats'] for k, v in dump.items() if k.startswith('players/') and k.count('/') == 1}
        assert stats['omar']['games'] == 1 and stats['nour']['games'] == 1, stats
        assert stats['nour']['guessed'] == 1, stats
        # host starts another game -> everyone back to the lobby
        click(A, '[data-act=playAgain]')
        for pg in (A, C, K):
            wait(pg, "window.__mk.S.screen === 'lobby'")
        # Karim leaves
        click(K, '.foot [data-act=leaveRoom]')
        wait(A, "Object.keys(window.__mk.S.room.players).length === 2")
        # profile shows stats and recent game
        A.evaluate("window.__mk.A.profile()")
        wait(A, "window.__mk.S.recent.length === 1")
        shot(A, 'profile')
        b.close()
finally:
    srv.terminate()

print(json.dumps({'errors': errors, 'problems': problems}, indent=1, ensure_ascii=False))
