"""One-phone game end to end in headless Chromium at phone width. Screenshots go to tests/shots/."""
import os, sys, subprocess, time, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'tests', 'shots')
os.makedirs(SHOTS, exist_ok=True)
W = int(sys.argv[1]) if len(sys.argv) > 1 else 390

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors = []
problems = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': W, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: m.type == 'error' and not any(x in m.text for x in ('fonts.g', 'cdnjs', 'ERR_', 'Failed to load resource')) and errors.append(m.text))
        n = [0]
        def shot(name):
            n[0] += 1
            page.wait_for_timeout(250)
            page.screenshot(path=f'{SHOTS}/{W}-{n[0]:02d}-{name}.png', full_page=True)
            sw = page.evaluate('document.documentElement.scrollWidth')
            if sw > W + 1:
                problems.append(f'{name}: sideways scroll {sw}px')
            bad = page.evaluate("[...document.querySelectorAll('#app *')].filter(e=>/undefined|NaN|\\[object/.test(e.childNodes[0]&&e.childNodes[0].nodeType===3?e.childNodes[0].textContent:'')).length")
            if bad:
                problems.append(f'{name}: {bad} nodes with undefined/NaN')
        def click(sel):
            page.locator(sel).first.click()
            page.wait_for_timeout(120)

        page.goto('http://localhost:8765/index.html')
        page.wait_for_timeout(1600)
        shot('login-guest')
        page.fill('#g-name', 'Omar')
        click('[data-act=guestGo]')
        shot('home')
        click('[data-act=newLocal]')
        shot('setup')
        for i, names in enumerate([['Nour', 'Hana'], ['Karim', 'Salma']]):
            for nm in names:
                page.fill(f'#add{i}', nm)
                page.press(f'#add{i}', 'Enter')
        click('[data-act=randomTeams]')
        click('[data-act=stepSetting][data-k=score][data-d="-1"]')
        page.evaluate("window.__mk.S.setup.settings.score = 2")
        shot('setup-filled')
        click('[data-act=startSetup]')
        state = page.evaluate('window.__mk.S.game.phase')
        assert state == 'pick', state
        shot('pick')
        click('[data-act=selTitle]')
        shot('pick-selected')
        click('[data-act=confirmPick]')
        shot('handoff')
        click('[data-act=showTitle]')
        shot('ready')
        click('[data-act=startTurn]')
        shot('acting')
        # use a help that has a value
        page.locator('.helpbtn:not([disabled])').first.click()
        page.wait_for_timeout(150)
        shot('reveal')
        click('[data-act=closeReveal]')
        click('[data-act=signs]')
        shot('signs')
        click('.sheet [data-act=closeSheet]')
        click('[data-act=correct]')
        shot('result-correct')
        g = page.evaluate('window.__mk.S.game')
        assert g['history'][0]['result'] == 'correct'
        click('[data-act=nextTurn]')
        # second turn: skip then foul
        click('[data-act=selTitle]'); click('[data-act=confirmPick]'); click('[data-act=showTitle]'); click('[data-act=startTurn]')
        click('[data-act=skip]')
        page.wait_for_timeout(200)
        click('[data-act=foulAsk]')
        shot('foul-sheet')
        click('[data-act=foul]')
        shot('result-foul')
        g = page.evaluate('window.__mk.S.game')
        assert g['history'][1]['result'] == 'foul' and g['history'][1]['points'] == -1, g['history'][1]
        click('[data-act=nextTurn]')
        # third turn: timeout via clock jump
        click('[data-act=selTitle]'); click('[data-act=confirmPick]'); click('[data-act=showTitle]'); click('[data-act=startTurn]')
        page.evaluate("window.__mk.S.game.turn.endsAt = Date.now() - 10")
        page.wait_for_timeout(700)
        shot('result-timeout')
        assert page.evaluate('window.__mk.S.game.history[2].result') == 'timeout'
        click('[data-act=nextTurn]')
        # fourth turn: correct -> second point for the other team? keep playing until over
        for _ in range(6):
            if page.evaluate('window.__mk.S.game.phase') == 'over':
                break
            click('[data-act=selTitle]'); click('[data-act=confirmPick]'); click('[data-act=showTitle]'); click('[data-act=startTurn]')
            click('[data-act=correct]'); click('[data-act=nextTurn]')
        page.wait_for_timeout(500)
        assert page.evaluate('window.__mk.S.game.phase') == 'over'
        shot('over')
        # reload keeps the finished game and last score on home
        click('[data-act=home]')
        shot('home-after')
        # profile (guest)
        click('[data-act=profile]')
        shot('profile-guest')
        b.close()
finally:
    srv.terminate()

print(json.dumps({'width': W, 'errors': errors, 'problems': problems, 'shots': n[0] if 'n' in dir() else 0}, ensure_ascii=False, indent=1))
