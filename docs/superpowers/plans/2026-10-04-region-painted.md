# Region map, PR 5: the painted background — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The regional map gets a painted background (relief, forests, snow; no text and nothing that code draws) generated with GPT Image from a terrain sketch aligned to the `geo.js` projection, with the paper as the fallback when the image does not load, and the single-file build carrying both map images.

**Architecture:** Two tools in one Python script, `tools/make_region_layout.py`, which asks `node` to project everything with `src/geo.js`: it draws the terrain sketch that guides the model, overlays the real rivers, border, roads and towns on a finished image to check the alignment, and finishes an image to the world size. `region.js` gets an optional `image` for `init`: it is painted into the static layer under the province washes, under a veil of paper; the thin roads get a pale halo only on it. `game.js` loads the image next to the city map and hands it over; `tools/build-single.mjs` inlines every image it finds, and a test runs the build.

**Tech Stack:** Python 3 with Pillow (already used by `tools/make_layout.py`), Node `child_process` for the projection, Canvas 2D, `node:test`, ESLint 9 flat config, the `gpt-image` skill (`~/.claude/skills/gpt-image/gen.mjs`, the OpenAI API with Lucian's key). No new dependencies.

Spec: `docs/superpowers/specs/2026-09-30-region-map-design.md`, sections 1 ("Hybrid art"), "Error handling" and 6.5. PR 4 (journeys on the region) is merged; the drawing it added (units, blocks, guards) is untouched.

## Decisions in this PR

- **The painting is terrain only.** Mountains, hills, forests, fields, snow. Rivers, roads, railways, towns, the border and every name stay in code, drawn from `geo.js` over it. A painted river would never lie on the drawn one; a painted mountain a few kilometres off is only a mountain. The prompt says so in capitals, and the overlay check (below) is how an off painting is spotted.
- **The sketch is the control.** `reference/region-layout-sketch.png` (1984×1728) colours the terrain: grey mountains, dark green forest, olive hills, tan plain, white snow caps. The outlines are traced by eye from physical maps and are approximate on purpose; they are in the tool, not in `geo.js`, and CLAUDE.md lists them among the things a historian or geographer may correct. The projection is the game's own (the tool calls `node` and `geo.project`), so the sketch and the map cannot drift apart.
- **Sizes.** GPT Image takes edges that are multiples of 16, so the request is 1984×1728 (the world's 2000×1740 shape to 0.1 %); `--finish` stretches it to exactly 2000×1740 and saves a JPEG at q80, like the city map.
- **Alignment is judged by eye on an overlay.** The model does not follow a sketch to the pixel, and a terrain painting does not need to. `--overlay` draws the real rivers, border, roads, railways and towns, and the sketch's outlines in magenta, over the finished image; the check is regional: the Apuseni between the Crișuri and the Mureș, the Carpathian arc along the east and south, the plain in the west.
- **Lucian approves the image.** Art is his call. Task 2 stops after the draft and the finish and waits for a yes in chat. Each `gen.mjs` call prints its cost; every call and its cost go in the report. Drafts use `-q medium`; one `-q high` render only after he picks a direction.
- **The paper stays as the fallback.** `init({image})` paints the image only when `image.naturalWidth > 0` (a failed load leaves 0); otherwise it paints the paper and its grain, exactly as before. The game waits for both images to settle (`Promise.all`), then initialises the region once.
- **Lines have to read on a painting.** A veil of paper (`VEIL = .18`) over the image calms it, the province washes are lighter on it (.10 and .22 instead of .16 and .30), and the roads get a pale halo under them. These numbers are a first guess; Task 5 checks them on the real painting and may change them.
- **The layer keeps the painting's resolution.** `RS` goes from .8 to 1 pixel per world unit, so the 2000×1740 image is not shrunk to 1600 pixels and then stretched again when the player zooms to 6×. The layer is 3.5 megapixels, about 14 MB, like the city's map.
- **The build carries both images.** `ASSETS` lists them; a script that refers to one gets it inlined as base64; the build fails if a listed image is referenced by no script. A new test runs the build and checks that both are in the file, that no path is left behind and that the file stays under 16 MB.
- **Not in this PR:** tapping a cart or a block marker, any change to the city map.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `tools/make_region_layout.py` | create | Terrain sketch, overlay check, finish to the world size |
| `reference/region-layout-sketch.png` | create (generated) | The control image sent to GPT Image |
| `tools/region-prompt.md` | create | The prompt and the commands |
| `assets/region-1918.jpg` | create (generated) | The painted background, 2000×1740 |
| `src/region.js` | modify | `init({image})`, the veil, lighter washes, the road halo, `RS = 1` |
| `tests/region.test.js` | modify | The painting under the washes, the paper fallback, the halo |
| `src/game.js` | modify | Load the image beside the city map; hand it to the region |
| `tools/build-single.mjs` | modify | Inline every listed image |
| `tests/build.test.js` | create | The build carries both images and stays small |
| `CLAUDE.md` | modify | Describe the image, the tools and the fallback |

---

### Task 1: Branch and the terrain sketch tool

**Files:**
- Create: `tools/make_region_layout.py`
- Create: `reference/region-layout-sketch.png` (generated)

- [ ] **Step 1: Create the branch from main**

```bash
git switch main && git pull --ff-only origin main
git switch -c feature/region-painted
```

(In a worktree where `main` is checked out elsewhere: `git fetch origin && git switch -c feature/region-painted origin/main`.)

- [ ] **Step 2: Write the tool**

**1. The terrain sketch and alignment tool.** Create `tools/make_region_layout.py`:

````python
"""Schița de teren pentru fundalul pictat al hărții regiunii (nord sus) și uneltele de aliniere.
  python3 tools/make_region_layout.py                        -> reference/region-layout-sketch.png (1984×1728)
  python3 tools/make_region_layout.py --overlay IMG [OUT]    -> IMG cu râurile, granița, drumurile și orașele din src/geo.js deasupra
  python3 tools/make_region_layout.py --finish IN OUT        -> IN redimensionat la lumea regiunii (2000×1740), JPEG q80
Coordonatele (lat/lon) vin din src/geo.js, proiectate de node, deci schița și harta jocului folosesc aceeași proiecție."""
import json, math, random, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
GEN = (1984, 1728)  # mărimea trimisă modelului: multipli de 16, aceeași formă ca lumea regiunii (2000×1740) la 0,1 %

# Relieful fizic, ca contururi [lat, lon] trasate din ochi după hărți fizice. Aproximativ intenționat:
# schița arată modelului unde sunt munții, nu o hartă topografică.
RELIEF = {
    'munti': {
        'apuseni':    [(46.85, 22.55), (46.75, 23.05), (46.45, 23.35), (46.10, 23.45), (46.05, 23.00), (46.15, 22.55), (46.45, 22.35)],
        'carpatiEst': [(47.90, 24.55), (47.60, 25.30), (47.00, 25.70), (46.30, 26.00), (45.55, 26.30), (45.45, 25.60), (46.00, 25.40), (46.60, 25.00), (47.20, 24.70)],
        'carpatiSud': [(45.75, 26.30), (45.65, 25.20), (45.60, 24.30), (45.55, 23.50), (45.45, 22.70), (45.25, 22.30), (45.15, 22.90), (45.20, 23.70), (45.30, 24.50), (45.40, 25.30), (45.45, 26.30)],
        'banat':      [(45.95, 22.40), (45.85, 22.00), (45.55, 21.90), (45.30, 22.00), (45.20, 22.30), (45.50, 22.50), (45.80, 22.60)],
        'maramures':  [(48.10, 23.20), (48.15, 24.60), (47.70, 24.90), (47.45, 24.30), (47.50, 23.50)],
    },
    'dealuri': {
        'podis':      [(47.20, 23.20), (47.10, 24.40), (46.60, 25.00), (46.00, 25.40), (45.85, 24.60), (45.90, 23.70), (46.30, 23.50), (46.80, 23.20)],
        'vest':       [(46.70, 22.40), (46.20, 22.20), (45.95, 22.40), (46.10, 22.90), (46.50, 22.80)],
        'subcarpati': [(47.30, 25.30), (46.80, 25.90), (46.10, 26.30), (45.80, 26.30), (45.90, 25.60), (46.50, 25.40), (47.00, 25.20)],
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
    r = subprocess.run(['node', '-e', NODE], input=json.dumps({'relief': flat}), capture_output=True, text=True, cwd=ROOT, check=True)
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
    while done < n:
        x, y = rnd.uniform(min(xs), max(xs)), rnd.uniform(min(ys), max(ys))
        if inside(x, y, poly) and keep(x, y):
            a, b = rx * rnd.uniform(.6, 1.4), ry * rnd.uniform(.6, 1.4)
            d.ellipse([x - a, y - b, x + a, y + b], fill=col)
            done += 1

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
        scatter(d, P(G['relief'][name]), 90, 26, 18, COL['sparse'], rnd)
    for name in RELIEF['munti']:
        poly = P(G['relief'][name])
        scatter(d, poly, 330, 24, 17, COL['light'], rnd)
        scatter(d, poly, 260, 20, 14, COL['ridge'], rnd)
        scatter(d, poly, 110, 22, 16, COL['forest'], rnd, keep=lambda x, y: rnd.random() < .5)
        if name in ('carpatiSud', 'maramures', 'apuseni'):
            scatter(d, poly, 45, 12, 9, COL['snow'], rnd)
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
    b = [tuple(p) for p in G['border']]
    for i in range(0, len(b) - 1): d.line([b[i], b[i + 1]], fill=(210, 30, 30), width=3)
    for x, y in G['towns'].values(): d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    for name, pts in G['relief'].items(): d.line([tuple(p) for p in pts] + [tuple(pts[0])], fill=(255, 0, 255), width=2)
    im.save(dst, quality=88)
    print('wrote', dst, im.size)

def finish(src, dst):
    G = geo()
    im = Image.open(src).convert('RGB').resize((G['w'], G['h']), Image.LANCZOS)
    im.save(dst, quality=80, optimize=True)
    print('wrote', dst, im.size, Path(dst).stat().st_size, 'bytes')

if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['--overlay']: overlay(a[1], a[2] if len(a) > 2 else ROOT / 'reference' / 'region-overlay.jpg')
    elif a[:1] == ['--finish']: finish(a[1], a[2])
    else: sketch()
````

- [ ] **Step 3: Run it and look at the sketch**

```bash
python3 tools/make_region_layout.py
```

Expected: `wrote reference/region-layout-sketch.png (1984, 1728)`. Open the file. It must show, with north up: the Carpathian arc as a grey, green and white band along the east and then the south; the Apuseni as a blob in the west of the olive plateau; the Banat mountains as a dark green blob in the south-west; the Maramureș mountains at the top; the plain (tan) empty across the whole west and south-west.

- [ ] **Step 4: Try the other two modes with the sketch standing in for a painting**

```bash
python3 tools/make_region_layout.py --overlay reference/region-layout-sketch.png /tmp/region-overlay.jpg
python3 tools/make_region_layout.py --finish reference/region-layout-sketch.png /tmp/region-finish.jpg
```

Expected: `wrote /tmp/region-overlay.jpg (2000, 1740)` and `wrote /tmp/region-finish.jpg (2000, 1740) ... bytes`. Open the overlay: blue rivers, black railways, brown roads, white town dots, a red border line and the magenta outlines of the relief, all on the sketch. The Mureș should run along the east of the Apuseni, and the border should follow the south and east edge of the mountains.

- [ ] **Step 5: Commit**

```bash
git add tools/make_region_layout.py reference/region-layout-sketch.png
git commit -m "feat: add the region terrain sketch tool"
```

---

### Task 2: The prompt and the painted background (Lucian approves the image)

**Files:**
- Create: `tools/region-prompt.md`
- Create: `assets/region-1918.jpg` (generated)

This task spends money on the OpenAI API and ends with Lucian's decision. The key is in `~/.config/openai/.env`; never print it. If `gen.mjs` exits with code 2, tell Lucian to run the setup from the `gpt-image` skill in his own terminal.

- [ ] **Step 1: Write the prompt file**

**1. The prompt.** Create `tools/region-prompt.md`:

````markdown
# Prompt pentru fundalul pictat al hărții regiunii (GPT Image · sunburst · 1984×1728)

Referință: `reference/region-layout-sketch.png`, făcută de `python3 tools/make_region_layout.py` (rol: referință la `images/edits`). Fundalul e doar teren: râurile, drumurile, căile ferate, orașele, granița și numele se desenează în cod deasupra, din coordonatele din `src/geo.js`.

Rulare (prompt-ul se extrage din blocul de mai jos într-un fișier):

```bash
python3 - <<'PY'
import re
t=open('tools/region-prompt.md',encoding='utf-8').read()
open('/tmp/region-prompt.txt','w',encoding='utf-8').write(re.search(r"```\n(Turn this.*?)\n```",t,re.S).group(1))
PY
node ~/.claude/skills/gpt-image/gen.mjs -f /tmp/region-prompt.txt -r reference/region-layout-sketch.png -o /tmp/region-draft.png --size 1984x1728 -q medium
```

Ciorne cu `-q medium`, varianta finală cu `-q high`.

```
Turn this color-coded terrain sketch into a hand-painted historical strategy-game map background (Age of Empires III art style, painterly gouache, top-down bird's-eye view). Subject: the Carpathian basin region of Transylvania, Banat, Crisana and Maramures in late November 1918, grey overcast late-autumn day, thin fresh snow on the high mountains only, rust-orange last leaves and bare trees, brown plowed fields. FOLLOW THE SKETCH LAYOUT EXACTLY (north is up; keep every area in the same place and the same size):
- Grey = high mountain ranges (the Carpathian arc along the east and south, the Apuseni Mountains in the west of Transylvania, the Banat and Maramures mountains): rugged ridges and steep valleys, dark pine forest on the lower slopes, bare rock grey on the heights; the white spots in the sketch are snow-capped peaks.
- Dark green = dense forest (spruce and beech).
- Olive = rolling hills of the Transylvanian Plateau and the Subcarpathian hills: a patchwork of fields, orchards and small woods.
- Tan = open plain (the Pannonian plain in the west and south-west): flat plowed fields in muted browns and ochres, hedgerows, a few copses.
TERRAIN ONLY. Absolutely no rivers, no lakes, no streams, no roads, no railways, no towns, no villages, no buildings, no bridges, no borders or border lines, no people, no animals, no vehicles, no flags, no text, no labels, no letters, no numbers, no compass, no legend, no map frame. Keep an even, medium level of detail over the whole image, with no strong focal point, so that lines and labels can be drawn on top of it later. Muted period palette: parchment ochre, umber, olive, pine green, slate grey, snow white.
```

După generare: `python3 tools/make_region_layout.py --finish /tmp/region-draft.png assets/region-1918.jpg` (2000×1740, JPEG q80), apoi `python3 tools/make_region_layout.py --overlay assets/region-1918.jpg /tmp/region-overlay.jpg` și te uiți dacă munții cad unde trebuie în raport cu râurile, granița, drumurile și orașele (contururile magenta sunt reliefului din schiță). AI-ul nu respectă schița la pixel, deci aliniarea se judecă la nivel de regiune: munții Apuseni între Crișuri și Mureș, lanțul Carpaților pe marginea de est și de sud, câmpia în vest.
````

- [ ] **Step 2: Extract the prompt and check the request without calling the API**

```bash
python3 - <<'PY'
import re
t=open('tools/region-prompt.md',encoding='utf-8').read()
open('/tmp/region-prompt.txt','w',encoding='utf-8').write(re.search(r"```\n(Turn this.*?)\n```",t,re.S).group(1))
PY
node ~/.claude/skills/gpt-image/gen.mjs -f /tmp/region-prompt.txt -r reference/region-layout-sketch.png -o /tmp/region-draft.png --size 1984x1728 -q medium --dry-run
```

Expected: JSON with `"url": "https://api.openai.com/v1/images/edits"`, `"size": "1984x1728"`, `"quality": "medium"` and the sketch under `"refs"`. Nothing is sent and nothing is charged.

- [ ] **Step 3: Draft**

```bash
node ~/.claude/skills/gpt-image/gen.mjs -f /tmp/region-prompt.txt -r reference/region-layout-sketch.png -o /tmp/region-draft.png --size 1984x1728 -q medium
```

Read the image yourself before showing it to anybody, and check, one by one: no text, letters or numbers anywhere; no river, lake, road, railway, town, village, building or border line; the mountains where the sketch has them (the same arc, the same Apuseni, the same Banat and Maramureș blocks); snow only on the high ranges; the plain in the west is open fields; an even level of detail with no single focal point. If a rule is broken, change the prompt text (for example, name the offender again in the "no ..." list, or say "empty plain" for an area that came out with villages), write the change into `tools/region-prompt.md`, and draft again. At most three drafts. Report each call's cost line.

- [ ] **Step 4: Finish it and check the alignment**

```bash
python3 tools/make_region_layout.py --finish /tmp/region-draft.png assets/region-1918.jpg
python3 tools/make_region_layout.py --overlay assets/region-1918.jpg /tmp/region-overlay.jpg
```

Expected: `wrote assets/region-1918.jpg (2000, 1740) ... bytes` (about 0.5–1.5 MB; if it is over 2 MB, say so, it is Lucian's call) and `wrote /tmp/region-overlay.jpg (2000, 1740)`. Open the overlay and judge it by region, not by pixel: do the Mureș, the Someș and the Crișuri run through valleys and plains and not over the high grey; do the railways and roads cross mountains only where the real ones do; do Cluj, Alba Iulia, Sibiu and Brașov sit on open ground; is the Carpathian arc under the border line in the east and south.

- [ ] **Step 5: Stop and show Lucian**

Send him the finished image (`assets/region-1918.jpg`) and the overlay (`/tmp/region-overlay.jpg`) with the costs so far, and wait for his answer in chat. Do not commit before he says yes. If he asks for a better render, run Step 3 with `-q high` and the same prompt (one image, report the cost), then Step 4 again, and show him again. If he asks for a change of look, edit the prompt, draft again, and repeat from Step 4.

- [ ] **Step 6: Commit**

```bash
git add tools/region-prompt.md assets/region-1918.jpg
git commit -m "feat: add the painted region background"
```

---

### Task 3: region.js paints the image

**Files:**
- Modify: `src/region.js`
- Modify: `tests/region.test.js`

- [ ] **Step 1: Write the failing tests**

**1. Tests for the painted background.** Append to `tests/region.test.js`, after one blank line:

```js
// a layer canvas that records every call made on it
function recordingLayer(){
  const calls=[],g=new Proxy({},{get:(o,k)=>k in o?o[k]:((...a)=>{calls.push([k,...a])}),set:(o,k,v)=>{o[k]=v;return true}});
  return{calls,makeCanvas:()=>({getContext:()=>g})};
}
const COLS={MM:'#5b86d6',CR:'#e2b21f',BN:'#d4574c',TR:'#7fb069'};

test('a painted background is drawn over the whole world, under the washes of the provinces',()=>{
  const image={naturalWidth:100,width:100,height:87},L=recordingLayer();
  region.init({cols:COLS,makeCanvas:L.makeCanvas,image});
  const at=L.calls.findIndex(c=>c[0]==='drawImage');
  assert.ok(at>=0,'no drawImage');
  assert.deepEqual(L.calls[at].slice(1),[image,0,0,RW,RH]);
  assert.equal(L.calls.filter(c=>c[0]==='drawImage').length,1);
  assert.ok(L.calls.slice(at).filter(c=>c[0]==='fill').length>=5,'the Kingdom and the four provinces are washed over it');
});

test('without an image, or with one that failed to load, the paper stays',()=>{
  for(const image of [undefined,null,{naturalWidth:0}]){
    const L=recordingLayer();
    region.init({cols:COLS,makeCanvas:L.makeCanvas,image});
    assert.equal(L.calls.filter(c=>c[0]==='drawImage').length,0);
    assert.ok(L.calls.filter(c=>c[0]==='fillRect').length>2000,'the paper grain is drawn');
  }
});

test('on a painted background the roads get a halo, and the paper needs none',()=>{
  const strokes=image=>{
    region.init({cols:COLS,makeCanvas:recordingLayer().makeCanvas,image});
    resize(1440,900);cam.z=cam.minZ;cam.x=RW/2;cam.y=RH/2;
    const {g,calls}=countingCtx();region.draw(g,{});return calls.stroke;
  };
  const paper=strokes(null),painted=strokes({naturalWidth:100});
  assert.equal(painted,paper+region.ROADS.length);
  region.init({cols:COLS,makeCanvas:recordingLayer().makeCanvas});  // leave the module as the other tests expect it
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/region.test.js`
Expected: `# pass 19`, `# fail 2` (the painted background and the halo; the paper test already passes, and keeps passing: it protects the fallback)

- [ ] **Step 3: Paint the image**

**1. The layer keeps the painting's own resolution.** In `src/region.js`, change:

```js
const RS=.8; // static layer resolution, in pixels per world unit
```

to:

```js
const RS=1; // static layer resolution, in pixels per world unit: the painting's own, 2000×1740
```

**2. The painted flag and the veil.** In `src/region.js`, change:

```js
let layer=null,cols={};
```

to:

```js
const VEIL=.18; // paper laid over the painting, so that lines and labels read on it
let layer=null,cols={},painted=false;
```

**3. init takes the image.** In `src/region.js`, change:

```js
// cols: province colours by key; makeCanvas lets Node tests pass a fake canvas
function init({cols:c,makeCanvas=()=>document.createElement('canvas')}){
  cols=c;layer=makeCanvas();
```

to:

```js
// cols: province colours by key; makeCanvas lets Node tests pass a fake canvas
// image: the painted background; one that failed to load has naturalWidth 0, and the paper stays
function init({cols:c,makeCanvas=()=>document.createElement('canvas'),image=null}){
  cols=c;layer=makeCanvas();painted=!!image&&image.naturalWidth>0;
```

**4. The painting under the washes, or the paper.** In `src/region.js`, change:

```js
  g.fillStyle='#e9dcbc';g.fillRect(0,0,RW,RH);
  // paper grain, seeded so it is the same on every load
  let s=11;const r=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646};
  for(let i=0;i<2600;i++){g.fillStyle=`rgba(120,90,50,${.03+r()*.05})`;g.fillRect(r()*RW,r()*RH,1+r()*3,1+r()*3)}
```

to:

```js
  g.fillStyle='#e9dcbc';g.fillRect(0,0,RW,RH);
  if(painted){g.drawImage(image,0,0,RW,RH);g.fillStyle=`rgba(233,220,188,${VEIL})`;g.fillRect(0,0,RW,RH)}
  else{
    // paper grain, seeded so it is the same on every load
    let s=11;const r=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646};
    for(let i=0;i<2600;i++){g.fillStyle=`rgba(120,90,50,${.03+r()*.05})`;g.fillRect(r()*RW,r()*RH,1+r()*3,1+r()*3)}
  }
```

**5. Lighter washes on the painting.** In `src/region.js`, change:

```js
for(const k in REG){poly(g,REG[k]);g.globalAlpha=.16;g.fillStyle=cols[k];g.fill();g.globalAlpha=.3;g.strokeStyle=cols[k];g.lineWidth=14;g.stroke()}
```

to:

```js
for(const k in REG){poly(g,REG[k]);g.globalAlpha=painted?.1:.16;g.fillStyle=cols[k];g.fill();g.globalAlpha=painted?.22:.3;g.strokeStyle=cols[k];g.lineWidth=14;g.stroke()}
```

**6. A halo under the roads.** In `src/region.js`, change:

```js
  for(const e of ROADS)line(g,e,1.6*px,'rgba(122,92,48,.8)');
```

to:

```js
  // on a painted ground a pale halo keeps the thin roads readable
  if(painted)for(const e of ROADS)line(g,e,4*px,'rgba(233,220,188,.55)');
  for(const e of ROADS)line(g,e,1.6*px,'rgba(122,92,48,.8)');
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/region.test.js && npx eslint src/region.js tests/region.test.js`
Expected: `# pass 21`, `# fail 0`, then no ESLint output

- [ ] **Step 5: Commit**

```bash
git add src/region.js tests/region.test.js
git commit -m "feat: draw the painted background under the region map"
```

---

### Task 4: Load it in the game and carry it in the build

**Files:**
- Create: `tests/build.test.js`
- Modify: `src/game.js` (2 edits)
- Modify: `tools/build-single.mjs` (5 edits)

- [ ] **Step 1: Write the failing test**

**1. The build test.** Create `tests/build.test.js`:

````js
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,statSync}=require('node:fs');
const {join}=require('node:path');

const root=join(__dirname,'..'),out=join(root,'dist','drumul-spre-unire.html');

test('the single-file build inlines both map images and stays under the artifact limit',()=>{
  const r=spawnSync(process.execPath,[join(root,'tools','build-single.mjs')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const html=readFileSync(out,'utf8');
  assert.equal(html.split('data:image/jpeg;base64,').length-1,2,'the city map and the region map');
  assert.ok(!html.includes('assets/map-1918.jpg')&&!html.includes('assets/region-1918.jpg'),'a map path was left behind');
  assert.ok(statSync(out).size<16*1024*1024);
});
````

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/build.test.js`
Expected: `# fail 1` (the build has one image, not two)

- [ ] **Step 3: Load the image in the game**

**1. Load the region image.** In `src/game.js`, change:

```js
const MAP_SRC='assets/map-1918.jpg';
const mapImg=new Image();
```

to:

```js
const MAP_SRC='assets/map-1918.jpg',REGION_SRC='assets/region-1918.jpg';
const mapImg=new Image(),regionImg=new Image();
// resolves when the image has loaded or failed; a failed one keeps naturalWidth at 0 and the game goes on without it
const loadImage=(img,src)=>new Promise(r=>{img.onload=r;img.onerror=r;img.src=src});
```

**2. Start up with both images.** In `src/game.js`, change:

```js
  R.init({cols:Object.fromEntries(PKEYS.map(k=>[k,PROV[k].col]))});
  await new Promise(r=>{mapImg.onload=r;mapImg.onerror=r;mapImg.src=MAP_SRC});renderBG();makeSpots();resetCrowdLayer();stamp(60);
```

to:

```js
  await Promise.all([loadImage(mapImg,MAP_SRC),loadImage(regionImg,REGION_SRC)]);
  R.init({cols:Object.fromEntries(PKEYS.map(k=>[k,PROV[k].col])),image:regionImg});
  renderBG();makeSpots();resetCrowdLayer();stamp(60);
```

Run `node --test tests/build.test.js` again. Expected: still `# fail 1`: the build leaves the new path in `game.js` as text.

- [ ] **Step 4: Make the build inline every listed image**

**1. Header.** In `tools/build-single.mjs`, change:

```js
// Builds dist/drumul-spre-unire.html: one file with the CSS, the scripts and the map inlined.
```

to:

```js
// Builds dist/drumul-spre-unire.html: one file with the CSS, the scripts and the two map images inlined.
```

**2. Both images.** In `tools/build-single.mjs`, change:

```js
const MAP='assets/map-1918.jpg';
```

to:

```js
const ASSETS=['assets/map-1918.jpg','assets/region-1918.jpg'];
```

**3. Count the inlined images.** In `tools/build-single.mjs`, change:

```js
let styles=0,scripts=0,maps=0;
```

to:

```js
let styles=0,scripts=0;
const inlined=new Set();
```

**4. Inline every image a script refers to.** In `tools/build-single.mjs`, change:

```js
  if(code.includes(MAP)){
    maps++;
    const uri='data:image/jpeg;base64,'+readFileSync(join(root,MAP)).toString('base64');
    code=code.split(MAP).join(uri);
  }
```

to:

```js
  for(const asset of ASSETS)if(code.includes(asset)){
    inlined.add(asset);
    const uri='data:image/jpeg;base64,'+readFileSync(join(root,asset)).toString('base64');
    code=code.split(asset).join(uri);
  }
```

**5. Fail when an image is not referenced.** In `tools/build-single.mjs`, change:

```js
if(!styles||!scripts||!maps){
  console.error(`build: expected a stylesheet, scripts and the map reference (got ${styles}, ${scripts}, ${maps})`);
```

to:

```js
if(!styles||!scripts||inlined.size!==ASSETS.length){
  console.error(`build: expected a stylesheet, scripts and a reference to every map image (got ${styles}, ${scripts}, ${inlined.size} of ${ASSETS.length} images)`);
```

- [ ] **Step 5: Run the checks**

```bash
npm test
npm run lint
npm run build
node -e "new Function(require('fs').readFileSync('src/game.js','utf8'))" && echo SYNTAX_OK
```

Expected: `# pass 110`, `# fail 0` (106 existing + 3 region + 1 build); lint prints nothing after the command line; build prints `8 scripts` and the size of both images plus the code (about 1.2 MB with a 100 KB image; a painted one is larger, and must stay far under 16 MB); `SYNTAX_OK`.

- [ ] **Step 6: Commit**

```bash
git add tests/build.test.js src/game.js tools/build-single.mjs
git commit -m "feat: load the painted region background and inline it in the build"
```

---

### Task 5: Document, check in the browser, tune

**Files:**
- Modify: `CLAUDE.md`
- Maybe modify: `src/region.js` (the numbers in Step 3 only)

- [ ] **Step 1: Document it in CLAUDE.md**

Eight edits; the Romanian characters must stay exact.

**1. build.** In `CLAUDE.md`, change:

```markdown
un singur fișier cu CSS-ul, scripturile și harta în base64.
```

to:

```markdown
un singur fișier cu CSS-ul, scripturile și cele două hărți (orașul și regiunea) în base64.
```

**2. region.js.** In `CLAUDE.md`, change:

```markdown
și traseele păzite (`guards`).
```

to:

```markdown
și traseele păzite (`guards`). Fundalul pictat (`image`, din `assets/region-1918.jpg`) se desenează sub spălările provinciilor, sub un văl de hârtie (`VEIL`), iar drumurile subțiri primesc un halou deschis doar pe el; dacă imaginea nu se încarcă (`naturalWidth` 0), rămâne hârtia cu granulație.
```

**3. assets.** In `CLAUDE.md`, change:

```markdown
- `assets/map-1918.jpg`: harta pictată cu AI (2240×1494), desenată pe lumea jocului de 1600×1067.
```

to:

```markdown
- `assets/map-1918.jpg`: harta pictată cu AI (2240×1494), desenată pe lumea jocului de 1600×1067.
- `assets/region-1918.jpg`: fundalul hărții regiunii, pictat cu GPT Image (2000×1740, doar teren: relief, păduri, zăpadă), desenat pe lumea regiunii din `geo.js`. Râurile, drumurile, orașele, granița și numele se desenează în cod deasupra.
```

**4. tools.** In `CLAUDE.md`, change:

```markdown
- `tools/make_layout.py` + `tools/map-prompt.md`: cum a fost generată harta.
```

to:

```markdown
- `tools/make_layout.py` + `tools/map-prompt.md`: cum a fost generată harta.
- `tools/make_region_layout.py` + `tools/region-prompt.md`: cum a fost generat fundalul regiunii: schița de teren (`reference/region-layout-sketch.png`), promptul pentru GPT Image, `--overlay` (suprapune râurile, granița, drumurile și orașele din `geo.js` peste imagine, ca să verifici alinierea) și `--finish` (2000×1740, JPEG q80).
```

**5. build-single.** In `CLAUDE.md`, change:

```markdown
- `tools/build-single.mjs`: build-ul cu un singur fișier (`npm run build`).
```

to:

```markdown
- `tools/build-single.mjs`: build-ul cu un singur fișier (`npm run build`), cu cele două imagini ale hărților (`ASSETS`); eșuează dacă un script nu o folosește pe vreuna.
```

**6. tests.** In `CLAUDE.md`, change:

```markdown
`region` e testat cu un context 2D fals.
```

to:

```markdown
`region` e testat cu un context 2D fals. `tests/build.test.js` rulează build-ul și verifică că ambele imagini sunt în fișier.
```

**7. regenerate.** In `CLAUDE.md`, change:

```markdown
măsurându-le pe imaginea redimensionată la 1600 px lățime.
```

to:

```markdown
măsurându-le pe imaginea redimensionată la 1600 px lățime.

Pentru harta regiunii nu refaci nimic în cod: orașele, râurile și traseele vin din `geo.js`. După o imagine nouă rulezi `--overlay` și verifici la nivel de regiune că munții cad unde trebuie în raport cu râurile, granița și drumurile.
```

**8. historian.** In `CLAUDE.md`, change:

```markdown
- Numele oficiale din 1918 ale orașelor (`official` în `geo.js`).
```

to:

```markdown
- Numele oficiale din 1918 ale orașelor (`official` în `geo.js`).
- Contururile reliefului din `tools/make_region_layout.py` (Apuseni, Carpații, munții Banatului și ai Maramureșului), trase din ochi, aproximativ.
```

- [ ] **Step 2: Run the full preflight**

```bash
npm test
npm run lint
npm run build
```

Expected: `# pass 110`, `# fail 0`; no lint output; `8 scripts`.

- [ ] **Step 3: Check the game in the browser and tune the numbers on the real painting**

Serve the game (`game` in `.claude/launch.json`, or `npx serve . -l 3000`), with the console open.

1. The start screen sits over the painted region; no console errors; both images load (network tab: `assets/map-1918.jpg` and `assets/region-1918.jpg` answer 200).
2. „Începe misiunea": at the widest view, and zoomed in to about 3× around Alba Iulia, every drawn thing reads on the painting: the thin roads (halo), the railways, the rivers, the dashed border, the town names, the province names (CRIȘANA, TRANSILVANIA, BANAT), the selected province's dashed route, a cart with its badge and a train with its smoke (send a delegation and a train), and the blue glow of the Guards (press „Protejează traseul"). If something is lost, change the numbers in `src/region.js`: `VEIL` (try .25 to .35 if the painting is too busy, .08 to .12 if it looks washed out) and the halo width or opacity in the road halo line (4 and .55); then look again.
3. The provinces still read as four regions: the washes (.10 and .22) are visible but not muddy. If they disappear, raise them toward the paper's .16 and .30.
4. The painted terrain agrees with the drawn rivers and towns (the overlay in Task 2 said so; confirm it on the screen).
5. The fallback: rename `assets/region-1918.jpg` for a minute, reload: the paper and its grain are back, the game works, no console errors. Put the file back.
6. Dive into the city and climb back out a few times: the crossfade over the painting shows no seam or flash.
7. Open `dist/drumul-spre-unire.html` straight from the disk (after `npm run build`): the region is painted there too.
8. At 360×780 and 390×844 the region shows the same painting; nothing stutters while you pan and zoom.

If Step 3 changed a number, run `npm test` and `npm run lint` again.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md src/region.js
git commit -m "docs: describe the painted region background"
```

(If a number changed, commit it first on its own: `git add src/region.js && git commit -m "fix: tune the veil and the road halo on the painted region"`.)

- [ ] **Step 5: Push and open the PR only after Lucian approves in chat**

```bash
git push -u origin feature/region-painted
gh pr create --base main --title "feat: add the painted background of the region map" --body-file <body>
```
