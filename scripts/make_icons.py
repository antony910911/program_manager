"""App icon for Mothership, in the style of Beamup's: a pixel mothership in a starry (graphite) sky,
its tractor beam lifting three task cards aboard.

Usage: python3 scripts/make_icons.py   (needs Pillow)
Writes public/apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png.
"""
import math
import random
from PIL import Image, ImageChops, ImageDraw, ImageFilter

S = 1024

# G glass dome, W glint, S silver hull, T dark underside, Y lights, H hatch
SHIP = [
    '......GGGGG......',
    '.....GWGGGGG.....',
    '....GGGGGGGGG....',
    '..TSSSSSSSSSSST..',
    '.SSYSSSSYSSSSYSS.',
    'SSSSSSSSSSSSSSSSS',
    '.TTTTTTTTTTTTTTT.',
    '.....THHHHHT.....',
]
# Cards rising in the beam: (column, row below the ship, color)
CARDS = [(4.5, 6.2, (251, 191, 36)), (8.0, 2.4, (96, 165, 250)), (10.6, 4.6, (248, 113, 113))]
COL = {
    'G': (150, 220, 255), 'W': (255, 255, 255), 'S': (214, 218, 230),
    'T': (140, 146, 168), 'Y': (255, 214, 10), 'H': (255, 236, 160),
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * max(0, min(1, t))) for i in range(3))


def background():
    img = Image.new('RGB', (S, S))
    px = img.load()
    top, mid, bottom = (84, 90, 106), (42, 46, 58), (14, 15, 21)
    cx, cy = S * 0.5, S * 0.3
    for y in range(S):
        for x in range(S):
            t = min(1, math.hypot(x - cx, y - cy) / (S * 0.85))
            px[x, y] = lerp(top, mid, t / 0.5) if t < 0.5 else lerp(mid, bottom, (t - 0.5) / 0.5)
    return img


def cells(draw, rows, ox, oy, u, fill=None):
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != '.':
                x, y = ox + c * u, oy + r * u
                draw.rectangle([round(x), round(y), round(x + u) - 1, round(y + u) - 1], fill=fill or COL[ch])


def render(scale=1.0):
    img = background()
    grid = S / 32
    u = S * 0.7 * scale / len(SHIP[0])
    beam_rows = 9
    w, h = len(SHIP[0]) * u, (len(SHIP) + beam_rows) * u
    ox, oy = (S - w) / 2, (S - h) / 2

    rnd = random.Random(7)
    d = ImageDraw.Draw(img)
    for _ in range(34):
        x, y = rnd.randrange(0, 32) * grid, rnd.randrange(0, 32) * grid
        if ox - u < x < ox + w + u and oy - u < y < oy + h:
            continue
        a = rnd.choice([110, 160, 220])
        d.rectangle([x, y, x + grid / 2 - 1, y + grid / 2 - 1], fill=(a, a, min(255, a + 20)))
    for cx, cy in [(4, 5), (27, 4), (28, 27), (3, 26)]:
        x, y = cx * grid, cy * grid
        for dx, dy in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)]:
            hh = grid / 2
            d.rectangle([x + dx * hh, y + dy * hh, x + dx * hh + hh - 1, y + dy * hh + hh - 1], fill=(255, 236, 160))

    # Tractor beam: stepped pixel trapezoid from the hatch, fading toward the bottom.
    beam = Image.new('RGB', (S, S), (0, 0, 0))
    bd = ImageDraw.Draw(beam)
    top_y = oy + len(SHIP) * u
    for r in range(beam_rows):
        half = 3 + r * 0.55
        x0, x1 = ox + (8.5 - half) * u, ox + (8.5 + half) * u
        k = (1 - r / (beam_rows - 1)) ** 1.2
        bd.rectangle([round(x0), round(top_y + r * u), round(x1), round(top_y + (r + 1) * u) - 1], fill=lerp((0, 0, 0), (150, 128, 52), k))
    img = ImageChops.screen(img, beam)

    # Soft glow behind the ship and from the hatch
    glow = Image.new('RGB', (S, S), (0, 0, 0))
    cells(ImageDraw.Draw(glow), SHIP, ox, oy, u, fill=(110, 110, 140))
    img = ImageChops.screen(img, glow.filter(ImageFilter.GaussianBlur(60 * scale)))
    lights = Image.new('RGB', (S, S), (0, 0, 0))
    cells(ImageDraw.Draw(lights), [''.join(ch if ch in 'YH' else '.' for ch in r) for r in SHIP], ox, oy, u, fill=(255, 170, 40))
    img = ImageChops.screen(img, lights.filter(ImageFilter.GaussianBlur(30 * scale)))

    shadow = Image.new('L', (S, S), 0)
    cells(ImageDraw.Draw(shadow), SHIP, ox + u * 0.35, oy + u * 0.45, u, fill=150)
    img = Image.composite(Image.new('RGB', (S, S), (8, 8, 14)), img, shadow)
    d = ImageDraw.Draw(img)
    cells(d, SHIP, ox, oy, u)

    # Task cards floating up: rounded-ish pixel cards with a white "text" line
    for col, row, color in CARDS:
        x, y = ox + col * u, top_y + row * u
        cw, ch = 2.6 * u, 1.7 * u
        d.rectangle([x + u * 0.25, y + u * 0.3, x + cw + u * 0.25, y + ch + u * 0.3], fill=(10, 10, 16))
        d.rectangle([x, y, x + cw, y + ch], fill=color)
        d.rectangle([x + u * 0.4, y + u * 0.45, x + cw - u * 0.6, y + u * 0.75], fill=(255, 255, 255))
        d.rectangle([x + u * 0.4, y + u * 0.95, x + cw - u * 1.2, y + u * 1.2], fill=lerp(color, (255, 255, 255), 0.55))
    return img


if __name__ == '__main__':
    full = render(1.0)
    for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
        full.resize((size, size), Image.LANCZOS).save(f'public/{name}', optimize=True)
    render(0.8).resize((512, 512), Image.LANCZOS).save('public/icon-maskable-512.png', optimize=True)
    print('ok')
