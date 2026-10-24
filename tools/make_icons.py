"""Draw the Matetkallemsh app icon: a cream speech bubble with a zipped mouth on a red poster sunburst."""
import math
import sys
from PIL import Image, ImageDraw

RED, RED2, INK, CREAM, MUST = (200, 50, 31), (169, 38, 26), (31, 20, 16), (255, 248, 234), (243, 182, 46)
S = 1024


def draw(safe=1.0):
    im = Image.new('RGB', (S, S), RED)
    d = ImageDraw.Draw(im)
    cx, cy = S / 2, S * 0.62
    # sunburst rays
    n = 28
    for i in range(n):
        if i % 2:
            continue
        a0 = 2 * math.pi * i / n
        a1 = 2 * math.pi * (i + 1) / n
        d.polygon([(cx, cy), (cx + 2000 * math.cos(a0), cy + 2000 * math.sin(a0)), (cx + 2000 * math.cos(a1), cy + 2000 * math.sin(a1))], fill=RED2)

    k = safe
    def P(x, y):
        return (S / 2 + (x - S / 2) * k, S / 2 + (y - S / 2) * k)

    # bubble (ellipse + tail) with ink outline and offset shadow
    bx0, by0, bx1, by1 = 170, 230, 854, 760
    tail = [(330, 700), (250, 880), (470, 740)]
    for off, col in ((36, INK), (0, None)):
        e = [P(bx0 + off, by0 + off), P(bx1 + off, by1 + off)]
        tl = [P(x + off, y + off) for x, y in tail]
        if col:
            d.ellipse(e, fill=INK)
            d.polygon(tl, fill=INK)
    # outline then fill
    w = 26 * k
    e = [P(bx0, by0), P(bx1, by1)]
    d.ellipse([(e[0][0] - w, e[0][1] - w), (e[1][0] + w, e[1][1] + w)], fill=INK)
    d.polygon([P(310, 690), P(230, 905), P(500, 735)], fill=INK)
    d.ellipse(e, fill=CREAM)
    d.polygon([P(338, 700), P(268, 850), P(470, 730)], fill=CREAM)

    # zipper mouth
    y = 500
    x0, x1 = 320, 704
    d.line([P(x0, y), P(x1, y)], fill=INK, width=int(34 * k))
    teeth = 9
    for i in range(teeth + 1):
        x = x0 + (x1 - x0) * i / teeth
        d.line([P(x, y - 40), P(x, y + 40)], fill=INK, width=int(22 * k))
    # zipper pull
    px = x1 + 10
    d.rounded_rectangle([P(px - 6, y - 34), P(px + 64, y + 34)], radius=int(18 * k), fill=MUST, outline=INK, width=int(16 * k))
    d.ellipse([P(px + 18, y - 10), P(px + 40, y + 10)], fill=INK)
    # eyes
    for ex in (400, 624):
        d.ellipse([P(ex - 34, 360 - 34), P(ex + 34, 360 + 34)], fill=INK)
    return im


out = sys.argv[1]
base = draw(1.0)
for size, name in ((180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png'), (64, 'favicon.png')):
    base.resize((size, size), Image.LANCZOS).save(f'{out}/{name}')
draw(0.72).resize((512, 512), Image.LANCZOS).save(f'{out}/icon-maskable-512.png')
print('icons written')
