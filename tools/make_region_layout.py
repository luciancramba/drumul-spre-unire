"""Schița de teren pentru fundalul pictat al hărții regiunii (nord sus) și uneltele de aliniere.
  python3 tools/make_region_layout.py                        -> reference/region-layout-sketch.png (1984×1728)
  python3 tools/make_region_layout.py --overlay IMG [OUT]    -> IMG cu râurile, granița, drumurile și orașele din src/geo.js deasupra
  python3 tools/make_region_layout.py --finish IN OUT        -> IN redimensionat la lumea regiunii (2000×1740), JPEG q80
  python3 tools/make_region_layout.py --check                -> niciun oraș din joc nu cade într-un contur de munți (cod de ieșire 1 dacă da)
Coordonatele (lat/lon) vin din src/geo.js, proiectate de node, deci schița și harta jocului folosesc aceeași proiecție."""
import json, random, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
GEN = (1984, 1728)  # mărimea trimisă modelului: multipli de 16, aceeași formă ca lumea regiunii (2000×1740) la 0,1 %

# Relieful fizic, ca contururi [lat, lon] trasate din ochi după hărți fizice. Aproximativ intenționat:
# schița arată modelului unde sunt munții, nu o hartă topografică.
RELIEF = {
    'munti': {
        'apuseni':    [(47.00, 22.50), (46.95, 23.00), (46.75, 23.25), (46.50, 23.45), (46.30, 23.60), (46.10, 23.45), (46.05, 23.00), (46.15, 22.55), (46.45, 22.30), (46.75, 22.40)],
        'gutai':      [(47.85, 23.25), (47.85, 23.80), (47.65, 24.30), (47.55, 24.55), (47.40, 24.40), (47.50, 23.90), (47.70, 23.60), (47.70, 23.30)],
        'maramures':  [(48.20, 24.20), (48.20, 25.00), (47.90, 25.10), (47.80, 24.60), (47.95, 24.20)],
        'carpatiEst': [(47.90, 24.55), (47.60, 25.30), (47.00, 25.70), (46.30, 26.00), (45.70, 26.30), (45.78, 25.90), (45.80, 25.50), (46.00, 25.40), (46.60, 25.00), (47.20, 24.70)],
        'carpatiSud': [(45.62, 26.30), (45.52, 25.85), (45.55, 25.50), (45.62, 25.20), (45.60, 24.30), (45.55, 23.50), (45.45, 22.70), (45.25, 22.30), (45.15, 22.90), (45.20, 23.70), (45.30, 24.50), (45.40, 25.30), (45.45, 26.30)],
        'banat':      [(45.97, 22.45), (45.88, 22.82), (45.72, 22.95), (45.50, 22.70), (45.25, 22.35), (45.05, 22.15), (45.10, 21.85), (45.40, 21.85), (45.60, 21.95), (45.85, 22.05)],
        'almaj':      [(45.20, 22.00), (45.05, 21.70), (44.85, 21.60), (44.65, 21.90), (44.60, 22.50), (44.80, 22.70), (45.05, 22.50), (45.20, 22.30)],
    },
    'dealuri': {
        'podis':      [(47.20, 23.20), (47.10, 24.40), (46.60, 25.00), (46.00, 25.40), (45.85, 24.60), (45.90, 23.70), (46.30, 23.50), (46.80, 23.20)],
        'vest':       [(46.70, 22.40), (46.20, 22.20), (45.95, 22.40), (46.10, 22.90), (46.50, 22.80)],
        'subcarpati': [(47.30, 25.30), (46.80, 25.90), (46.10, 26.30), (45.80, 26.30), (45.90, 25.60), (46.50, 25.40), (47.00, 25.20)],
        'getic':      [(45.25, 22.90), (45.20, 24.00), (45.30, 25.00), (45.40, 26.30), (45.05, 26.30), (44.95, 25.00), (44.85, 23.80), (44.95, 22.90)],
    },
}
COL = dict(plain=(224, 216, 192), hill=(190, 192, 152), mountain=(150, 148, 138), ridge=(118, 116, 108),
           light=(172, 170, 160), forest=(86, 110, 76), sparse=(124, 142, 102), snow=(240, 240, 237))

# proiectează totul cu src/geo.js; node citește conturile reliefului pe stdin și scrie JSON pe stdout
NODE = r'''
const fs=require('fs'),g=require('./src/geo.js');
const inp=JSON.parse(fs.readFileSync(0,'utf8')),proj=a=>a.map(([lat,lon])=>g.project(lat,lon));
const out={w:g.RW,h:g.RH,relief:{},rivers:g.RIVERS.map(r=>proj(r.pts)),border:proj(g.BORDER_1918),
  towns:Object.fromEntries(Object.entries(g.TOWNS).filter(([k,t])=>t.tier<3).map(([k,t])=>[k,g.project(t.lat,t.lon)])),roads:[],rails:[]};
for(const k in inp.relief)out.relief[k]=proj(inp.relief[k]);
for(const p of Object.keys(g.ROUTES))for(const kind of ['road','rail'])out[kind+'s'].push(g.routePath(p,kind).pts);
process.stdout.write(JSON.stringify(out));
'''

def geo():
    flat = {name: pts for group in RELIEF.values() for name, pts in group.items()}
    try:
        r = subprocess.run(['node', '-e', NODE], input=json.dumps({'relief': flat}), capture_output=True, text=True, cwd=ROOT)
    except FileNotFoundError:
        sys.exit('node is required: the projection comes from src/geo.js')
    if r.returncode: sys.exit('node failed:\n' + r.stderr)
    return json.loads(r.stdout)

def inside(x, y, poly):  # ray casting
    ok = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            ok = not ok
    return ok

def scatter(d, poly, n, rx, ry, col, rnd, keep=lambda x, y: True):
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    done = 0
    for _ in range(n * 200):  # a degenerate outline, or a `keep` that refuses everything, must not spin forever
        x, y = rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys))
        if inside(x, y, poly) and keep(x, y):
            a, b = rx * rnd.uniform(.6, 1.4), ry * rnd.uniform(.6, 1.4)
            d.ellipse([x - a, y - b, x + a, y + b], fill=col)
            done += 1
            if done == n: return
    sys.exit(f'scatter: placed only {done} of {n} blobs; is the outline degenerate?')

def area(poly):  # shoelace
    return abs(sum(poly[i][0] * poly[i - 1][1] - poly[i - 1][0] * poly[i][1] for i in range(len(poly)))) / 2

def blobs(poly, per100k):  # the same density on a small outline as on a large range, so none turns into solid forest
    return max(6, round(per100k * area(poly) / 1e5))

def sketch():
    G = geo()
    sx, sy = GEN[0] / G['w'], GEN[1] / G['h']
    P = lambda pts: [(x * sx, y * sy) for x, y in pts]
    rnd = random.Random(1918)
    # first the broad areas, blurred so their edges are soft; then the detail on top
    base = Image.new('RGB', GEN, COL['plain'])
    d = ImageDraw.Draw(base)
    for name in RELIEF['dealuri']: d.polygon(P(G['relief'][name]), fill=COL['hill'])
    for name in RELIEF['munti']: d.polygon(P(G['relief'][name]), fill=COL['mountain'])
    im = base.filter(ImageFilter.GaussianBlur(14))
    d = ImageDraw.Draw(im)
    for name in RELIEF['dealuri']:
        poly = P(G['relief'][name])
        scatter(d, poly, blobs(poly, 28), 26, 18, COL['sparse'], rnd)
    for name in RELIEF['munti']:
        poly = P(G['relief'][name])
        scatter(d, poly, blobs(poly, 130), 24, 17, COL['light'], rnd)
        scatter(d, poly, blobs(poly, 100), 20, 14, COL['ridge'], rnd)
        scatter(d, poly, blobs(poly, 45), 22, 16, COL['forest'], rnd, keep=lambda x, y: rnd.random() < .5)
        if name in ('carpatiSud', 'carpatiEst'):  # the high ranges; the Apuseni peak at about 1850 m
            scatter(d, poly, blobs(poly, 18), 12, 9, COL['snow'], rnd)
    im = im.filter(ImageFilter.GaussianBlur(2.5))
    out = ROOT / 'reference' / 'region-layout-sketch.png'
    im.save(out)
    print('wrote', out.relative_to(ROOT), im.size)

def overlay(src, dst):
    G = geo()
    im = Image.open(src).convert('RGB').resize((G['w'], G['h']), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    for pts in G['rivers']: d.line([tuple(p) for p in pts], fill=(40, 100, 220), width=3, joint='curve')
    for pts in G['roads']: d.line([tuple(p) for p in pts], fill=(150, 90, 20), width=2)
    for pts in G['rails']: d.line([tuple(p) for p in pts], fill=(20, 20, 20), width=3)
    d.line([tuple(p) for p in G['border']], fill=(210, 30, 30), width=3, joint='curve')
    for x, y in G['towns'].values(): d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    for name, pts in G['relief'].items(): d.line([tuple(p) for p in pts] + [tuple(pts[0])], fill=(255, 0, 255), width=2)
    im.save(dst, quality=88)  # the quality applies when dst is a .jpg
    print('wrote', dst, im.size)

# the one rule that keeps the painting honest: no town the game labels may sit inside a mountain outline,
# except the two that really are mountain towns (the gold-mining towns of the Apuseni)
MOUNTAIN_TOWNS = {'zlatna', 'abrud'}
def check():
    G = geo()
    bad = [(t, m) for t, (x, y) in G['towns'].items() if t not in MOUNTAIN_TOWNS
           for m in RELIEF['munti'] if inside(x, y, G['relief'][m])]
    for t, m in bad: print(f'{t} is inside the mountains {m}')
    print('ok: every labelled town is on open ground' if not bad else f'{len(bad)} town(s) inside mountains')
    return 1 if bad else 0

def finish(src, dst):
    G = geo()
    im = Image.open(src).convert('RGB').resize((G['w'], G['h']), Image.LANCZOS)
    im.save(dst, quality=80, optimize=True)
    print('wrote', dst, im.size, Path(dst).stat().st_size, 'bytes')

if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['--overlay'] and len(a) in (2, 3): overlay(a[1], a[2] if len(a) > 2 else ROOT / 'reference' / 'region-overlay.jpg')
    elif a[:1] == ['--finish'] and len(a) == 3: finish(a[1], a[2])
    elif a == ['--check']: sys.exit(check())
    elif not a: sketch()
    else: sys.exit(__doc__)
