# Region map, PR 3: portal.js — continuous zoom between the region and the city — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game starts on the region with all four provinces in view. Zooming in past the region's limit near Alba Iulia dives into the city, and zooming out past the city's limit climbs back. The „Oraș / Regiune" button flies the same way, and at 10:00 a player on the region is flown to the city before the cinematic.

**Architecture:** A new classic-script IIFE, `src/portal.js` (`DSU.portal.create`), is a pure state machine without DOM. A position `u` goes from 0 (region) to 1 (city), with a direction and a "push" that collects zoom beyond a map's limit. It returns the region opacity (`alpha`) and the region camera along the flight (`pose`). `game.js` replaces PR 2's `level` / `setLevel` with this portal: it routes the zoom overshoot into `overscroll`, starts flights, applies the pose to `DSU.region.cam`, and delays the cinematic until the flight lands. `region.js` gains `home()`.

**Tech Stack:** Plain ES2020 classic scripts, Canvas 2D, `node:test` + `node:assert/strict`, ESLint 9 flat config. No new dependencies.

Spec: `docs/superpowers/specs/2026-09-30-region-map-design.md`, sections 1, 5 and 6.3. PR 2 (`region.js`, the „Regiune / Oraș" button with a fade) is merged.

## Decisions in this PR

- **One number for where the player is.** `u` runs from 0 (region) to 1 (city). Opacity and camera are functions of `u`, not of elapsed time, so a flight turned around halfway (button pressed again, or the deadline during a climb) goes back from where it is, with no jump.
- **Hysteresis is a push threshold.** Zoom the camera could not take at its limit adds `log(f)` to `push`, and zooming back takes it away. The level changes when `push` reaches `PUSH = log 1.5`: about three wheel notches, or spreading the fingers 1.5× further at the limit. `push` fades in 0.6 s, so a slow wiggle at the limit never switches. After a switch it starts again from 0, so the other direction needs a full threshold too.
- **"Near Alba Iulia" is measured to the zoom point or to the centre.** Zooming keeps the point under the cursor or fingers fixed, so a player zooming *at* Alba Iulia keeps it off-centre. The dive therefore starts when Alba Iulia is within 30% of the smaller screen side of the zoom point or of the screen centre. Zooming at Brașov stops at 6× and nothing happens.
- **The flight.** Diving, the region camera flies from the player's view to a close-up on Alba Iulia (2.5× past the region's limit), and the city opens in its home view (`cityHome`, the same view the game used to open on). The region stays fully drawn for the first 30% of the way, then the city takes over. Climbing, the camera flies out from that close-up and lands with Alba Iulia centred at 3×. Reduced motion: a 0.2 s crossfade and the region camera does not move.
- **During a flight (0.8 s), drag, zoom and taps are ignored.** Pause does not stop a flight; the button, the zoom and the cards still work while paused.
- **Start, replay, ending.** `begin()` puts every game (including „Joacă din nou") on the region at `R.home()`. At 10:00, `endGame` finishes the score and the save as before. Then, if the player is not in the city, it flies there and starts the cinematic only when the flight lands (`afterFlight` → `playEnding`). This was measured at about 0.74 s.
- **Not in this PR:** the attention dot on the button and anything moving on the region (PR 4).

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/portal.js` | create | Level, flight position, push/hysteresis, region opacity and camera pose; no DOM |
| `tests/portal.test.js` | create | Flights, turnaround, pose, threshold, band, decay, the "near Alba Iulia" rule |
| `src/region.js` | modify | `home()`; the Alba Iulia card mentions zooming in |
| `tests/region.test.js` | modify | `home()` test; the card hint |
| `index.html` | modify | Load `src/portal.js` between `region.js` and `game.js` |
| `src/game.js` | modify | Replace `level`/`setLevel` with the portal; overscroll routing; flights; start on the region; flight before the cinematic |
| `CLAUDE.md` | modify | Describe `portal.js`, the levels and the load order |

---

### Task 1: Branch and portal.js

**Files:**
- Create: `src/portal.js`
- Create: `tests/portal.test.js`

- [ ] **Step 1: Create the branch from main**

```bash
git switch main && git pull --ff-only origin main
git switch -c feature/region-portal
```

(In a worktree where `main` is checked out elsewhere: `git fetch origin && git switch -c feature/region-portal origin/main`.)

- [ ] **Step 2: Write the failing tests**

Create `tests/portal.test.js`:

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const portal=require('../src/portal.js');
const {create,FLIGHT,FLIGHT_REDUCED,PUSH}=portal;

const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;
// runs the flight frame by frame; returns how many frames said 'arrived' and the opacity at each frame
function fly(p,seconds,dt=1/60){
  let arrived=0;const alphas=[];
  for(let t=0;t<seconds;t+=dt){if(p.update(dt)==='arrived')arrived++;alphas.push(p.alpha())}
  return{arrived,alphas};
}

test('portal attaches itself to the DSU namespace',()=>{
  assert.equal(globalThis.DSU.portal,portal);
});

test('the game starts on the region, fully visible and still',()=>{
  const p=create();
  assert.equal(p.level,'region');assert.equal(p.target,'region');
  assert.equal(p.busy,false);assert.equal(p.alpha(),1);
  assert.equal(p.update(1),null);
});

test('a dive into the city lands once, after the flight, with the region fading out',()=>{
  const p=create();
  assert.equal(p.go('city'),true);
  assert.equal(p.busy,true);assert.equal(p.target,'city');assert.equal(p.level,'region');
  const {arrived,alphas}=fly(p,FLIGHT+.2);
  assert.equal(arrived,1);
  assert.equal(p.level,'city');assert.equal(p.busy,false);assert.equal(p.alpha(),0);
  for(let i=1;i<alphas.length;i++)assert.ok(alphas[i]<=alphas[i-1]+1e-12,`opacity rises at frame ${i}`);
  // the region stays fully drawn for the first part of the dive, while the camera flies in
  const p2=create();p2.go('city');p2.update(FLIGHT*.25);assert.equal(p2.alpha(),1);
});

test('with reduced motion the switch is a 0.2 s crossfade and the camera does not move',()=>{
  const p=create({reduceMotion:true});
  p.go('city');
  assert.equal(p.update(FLIGHT_REDUCED/2),null);
  assert.equal(p.update(FLIGHT_REDUCED/2+1e-6),'arrived');
  const a={x:100,y:200,z:.5},b={x:900,y:800,z:5};
  p.go('region');p.update(.05);
  assert.deepEqual(p.pose(a,b),a);
});

test('going where you already are, or are already going, does nothing',()=>{
  const p=create();
  assert.equal(p.go('region'),false);assert.equal(p.busy,false);
  p.go('city');p.update(.1);
  assert.equal(p.go('city'),false);
  const city=create({level:'city'});
  assert.equal(city.go('city'),false);assert.equal(city.alpha(),0);
});

test('a flight can turn around halfway without a jump',()=>{
  const p=create();
  p.go('city');p.update(FLIGHT*.6);
  const before=p.alpha(),a={x:0,y:0,z:1},b={x:100,y:50,z:8},pose=p.pose(a,b);
  assert.equal(p.go('region'),true);
  assert.equal(p.alpha(),before);assert.deepEqual(p.pose(a,b),pose);
  const {arrived}=fly(p,FLIGHT);
  assert.equal(arrived,1);assert.equal(p.level,'region');assert.equal(p.alpha(),1);
});

test('the camera pose goes from the region view to the close-up, zooming on a log scale',()=>{
  const p=create(),a={x:0,y:0,z:1},b={x:100,y:40,z:16};
  p.go('city');
  assert.deepEqual(p.pose(a,b),{x:0,y:0,z:1});
  p.update(FLIGHT/2);
  const mid=p.pose(a,b);
  assert.ok(near(mid.x,50)&&near(mid.y,20)&&near(mid.z,4),JSON.stringify(mid));
  p.update(FLIGHT);
  const end=p.pose(a,b);
  assert.ok(near(end.x,100)&&near(end.y,40)&&near(end.z,16,1e-9),JSON.stringify(end));
});

test('zooming past the limit dives once the push crosses the threshold, and only once',()=>{
  const p=create(),step=Math.exp(PUSH/3)*1.0001;
  assert.equal(p.overscroll(step),false);
  assert.equal(p.overscroll(step),false);
  assert.equal(p.overscroll(step),true);
  assert.equal(p.target,'city');
  // more pushing during the flight is ignored
  assert.equal(p.overscroll(step),false);assert.equal(p.overscroll(1/step),false);
  fly(p,FLIGHT+.1);
  assert.equal(p.level,'city');assert.equal(p.push,0);
});

test('wiggling inside the band never switches level',()=>{
  const p=create(),step=Math.exp(PUSH*.6);
  for(let i=0;i<50;i++){assert.equal(p.overscroll(step),false);assert.equal(p.overscroll(1/step),false)}
  assert.equal(p.level,'region');assert.equal(p.busy,false);
});

test('pushing out of the city climbs back to the region',()=>{
  const p=create({level:'city'}),out=Math.exp(-PUSH*.6);
  assert.equal(p.overscroll(1/out),false); // zooming in at the city limit does not push anywhere
  assert.equal(p.push,0);
  assert.equal(p.overscroll(out),false);
  assert.equal(p.overscroll(out),true);
  assert.equal(p.target,'region');
});

test('the region only dives when Alba Iulia is near the zoom',()=>{
  const p=create(),step=Math.exp(PUSH);
  assert.equal(p.overscroll(step,false),false);assert.equal(p.push,0);
  assert.equal(p.overscroll(step,true),true);
});

test('the push fades when the player stops zooming',()=>{
  const p=create(),step=Math.exp(PUSH*.6);
  p.overscroll(step);
  p.update(1);
  assert.equal(p.push,0);
  assert.equal(p.overscroll(step),false);
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `node --test tests/portal.test.js`
Expected: FAIL with `Cannot find module '../src/portal.js'`

- [ ] **Step 4: Write portal.js**

Create `src/portal.js`:

```js
/* Portalul dintre hărți: pe ce nivel e jucătorul (regiunea sau orașul) și zborul dintre ele.
   u merge de la 0 (regiunea) la 1 (orașul); un zbor întors la jumătate pornește înapoi de unde a rămas.
   Logică pură, fără DOM: game.js aplică opacitatea și camera pe care le calculează portalul. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const core=DSU.core||require('./core.js');
const {clamp}=core;

const FLIGHT=.8,FLIGHT_REDUCED=.2; // seconds
const PUSH=Math.log(1.5); // how far past the zoom limit the player must push to change level
const DECAY=PUSH/.6;      // the push fades in 0.6 s once the player stops zooming
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const smooth=(a,b,t)=>{const s=clamp((t-a)/(b-a),0,1);return s*s*(3-2*s)};

function create({reduceMotion=false,level='region'}={}){
  const dur=reduceMotion?FLIGHT_REDUCED:FLIGHT;
  const p={u:level==='city'?1:0,dir:0,push:0,
    get level(){return p.u>=1?'city':'region'},
    get busy(){return p.dir!==0},
    // where the player is going, or where they are when nothing moves
    get target(){return p.dir>0?'city':p.dir<0?'region':p.level},
    // region opacity: the city takes over in the last 70 % of the way down
    alpha(){return 1-smooth(.3,1,p.u)},
    reset(l){p.u=l==='city'?1:0;p.dir=0;p.push=0},
    // starts a flight, or turns one around; false when already there or already going there
    go(to){const d=to==='city'?1:-1;if(p.dir===d||(!p.dir&&p.target===to))return false;p.dir=d;p.push=0;return true},
    // f: the part of a zoom step the camera could not take at its limit (>1 in, <1 out)
    // near: on the region, whether Alba Iulia is close to where the player zooms
    overscroll(f,near=true){
      if(p.dir||!(f>0))return false;
      const toward=p.level==='region'?Math.log(f):-Math.log(f); // > 0 pushes toward the other level
      if(toward>0&&p.level==='region'&&!near)return false;
      p.push=Math.max(0,p.push+toward);
      return p.push>=PUSH&&p.go(p.level==='region'?'city':'region');
    },
    // advances the flight; returns 'arrived' on the frame it lands
    update(dt){
      p.push=Math.max(0,p.push-DECAY*dt);
      if(!p.dir)return null;
      p.u=clamp(p.u+p.dir*dt/dur,0,1);
      if(p.u>0&&p.u<1)return null;
      p.dir=0;return 'arrived';
    },
    // region camera along the way: a is the view on the region, b the close-up on Alba Iulia; zoom moves on a log scale
    pose(a,b){
      if(reduceMotion)return{x:a.x,y:a.y,z:a.z};
      const e=ease(p.u);
      return{x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,z:Math.exp(Math.log(a.z)+(Math.log(b.z)-Math.log(a.z))*e)};
    },
  };
  return p;
}

DSU.portal={create,FLIGHT,FLIGHT_REDUCED,PUSH};
if(typeof module!=='undefined'&&module.exports)module.exports=DSU.portal;
})(typeof window!=='undefined'?window:globalThis);
```

The `level` getter is `'region'` until `u` reaches 1, so during any flight the level is the region side and `busy` is true. Code that must act only when standing still checks `busy`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test tests/portal.test.js && npx eslint src/portal.js tests/portal.test.js`
Expected: `# pass 12`, `# fail 0`, then no ESLint output

- [ ] **Step 6: Commit**

```bash
git add src/portal.js tests/portal.test.js
git commit -m "feat: add portal.js, the flight between region and city"
```

---

### Task 2: region.js home() and the Alba Iulia hint

**Files:**
- Modify: `src/region.js`
- Modify: `tests/region.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/region.test.js`, insert this test, followed by one blank line, right before `test('panning never loses the map: at most 90 px past its edge',`:

```js
test('home goes back to the widest view, centred',()=>{
  resize(1440,900);cam.z=cam.minZ*4;cam.x=300;cam.y=300;
  region.home();
  assert.ok(near(cam.z,cam.minZ)&&near(cam.x,RW/2)&&near(cam.y,RH/2));
});
```

and in the test `'info cards give the official 1918 name and say the outlines are approximate'`, after the line `  assert.match(ai.text,/Marea Adunare/);` add:

```js
  assert.match(ai.text,/Apropie-te de oraș/);
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/region.test.js`
Expected: 2 failures: `region.home is not a function`, and the `Apropie-te de oraș` match in the info card test

- [ ] **Step 3: Add home() and change the hint**

In `src/region.js`, change:

```js
const toScreen=(x,y)=>[(x-cam.x)*cam.z+vw/2,(y-cam.y)*cam.z+vh/2];
```

to:

```js
// back to the widest view, with all four provinces
function home(){cam.z=cam.minZ;cam.x=RW/2;cam.y=RH/2;clampCam()}
const toScreen=(x,y)=>[(x-cam.x)*cam.z+vw/2,(y-cam.y)*cam.z+vh/2];
```

In `info()`, change ` Atinge „Oraș” ca să vezi cetatea.` to ` Apropie-te de oraș sau atinge „Oraș” ca să intri în cetate.` (keep the Romanian quotes „ U+201E and ” U+201D).

Change the export line to:

```js
const region={cam,resize,pan,zoomAt,home,toScreen,MAXK,ROADS,RAILS,init,draw,visibleTowns,TIER2,hit,info};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/region.test.js && npx eslint src/region.js tests/region.test.js`
Expected: `# pass 11`, `# fail 0`, then no ESLint output

- [ ] **Step 5: Commit**

```bash
git add src/region.js tests/region.test.js
git commit -m "feat: add region home view and the zoom-in hint"
```

---

### Task 3: Wire the portal into the game

**Files:**
- Modify: `index.html` (script list)
- Modify: `src/game.js` (10 edits, listed below)

This is DOM glue; it is checked in the browser in Task 4. Every "change X to Y" replaces text that appears exactly once.

- [ ] **Step 1: Load portal.js**

In `index.html`, change:

```html
<script src="src/region.js"></script>
<script src="src/game.js"></script>
```

to:

```html
<script src="src/region.js"></script>
<script src="src/portal.js"></script>
<script src="src/game.js"></script>
```

- [ ] **Step 2: Give the city's opening view a name**

In `resize()`, change:

```js
  if(!camInit){cam.z=cam.minZ*(vw>vh?1.3:1.1);cam.x=vw>vh?700:560;cam.y=540;camInit=true}
```

to:

```js
  if(!camInit){cityHome();camInit=true}
```

and change the line that starts `function zoomAt(sx,sy,f){const wx=` by inserting two lines before it, so it reads:

```js
// the view the city opens on: the fortress and the station
function cityHome(){cam.z=cam.minZ*(vw>vh?1.3:1.1);cam.x=vw>vh?700:560;cam.y=540;clampCam()}
function zoomAt(sx,sy,f){const wx=cam.x+(sx-vw/2)/cam.z,wy=cam.y+(sy-vh/2)/cam.z;cam.z=clamp(cam.z*f,cam.minZ,cam.minZ*3.4);cam.x=wx-(sx-vw/2)/cam.z;cam.y=wy-(sy-vh/2)/cam.z;clampCam()}
```

(the `zoomAt` line itself is unchanged).

- [ ] **Step 3: Ignore drag and taps during a flight; read the level from the portal**

Change:

```js
  if(ptrs.size===1){if(level==='region')R.pan(
```

to:

```js
  if(ptrs.size===1&&!portal.busy){if(portal.level==='region')R.pan(
```

(the rest of that line is unchanged). In the `const up=e=>{...` line, change `Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<7&&!modalOpen){` to `Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<7&&!modalOpen&&!portal.busy){`. On the next line, change `  if(level==='region'){const h=R.hit(x,y);` to `  if(portal.level==='region'){const h=R.hit(x,y);`.

- [ ] **Step 4: Replace the level block**

Replace everything from `/* ---------- levels ---------- */` down to and including the closing `}` of `setLevel` (the line after `canvas.setAttribute('aria-label',...)`) with:

```js
/* ---------- levels ---------- */
// the region and the city; portal.js runs the flight between them: a dive onto Alba Iulia and the climb back out
const portal=DSU.portal.create({reduceMotion});
let regionA=1,flight=null,afterFlight=null;
const ALBA=DSU.geo.townXY('albaIulia');
// zooming past a map's limit pushes toward the other level; on the region only when Alba Iulia is near the zoom
function zoomActive(sx,sy,f){
  if(portal.busy)return;
  if(portal.level==='region'){
    const z=R.cam.z;R.zoomAt(sx,sy,f);
    const [ax,ay]=R.toScreen(...ALBA),r=Math.min(vw,vh)*.3;
    const near=Math.hypot(ax-sx,ay-sy)<r||Math.hypot(ax-vw/2,ay-vh/2)<r;
    if(portal.overscroll(f*z/R.cam.z,near))startFlight();
  }else{const z=cam.z;zoomAt(sx,sy,f);if(portal.overscroll(f*z/cam.z))startFlight()}
}
// the region camera flies between the player's view and a close-up of Alba Iulia; the city waits in its home view
function startFlight(){
  if(!flight){const close={x:ALBA[0],y:ALBA[1],z:R.cam.minZ*R.MAXK*2.5};
    if(portal.target==='city'){flight={a:{x:R.cam.x,y:R.cam.y,z:R.cam.z},b:close};cityHome()}
    else flight={a:{x:ALBA[0],y:ALBA[1],z:R.cam.minZ*3},b:close}}
  levelUI();
}
// moves the flight on; runs even when the game is paused, so the player can still look around
function stepLevel(dt){
  const landed=portal.update(dt)==='arrived';
  if(flight){const q=portal.pose(flight.a,flight.b);R.cam.x=q.x;R.cam.y=q.y;R.cam.z=q.z}
  regionA=portal.alpha();
  if(landed){if(portal.level==='region')R.resize(vw,vh);flight=null;if(afterFlight){const f=afterFlight;afterFlight=null;f()}}
}
// the button and the canvas name follow where the player is going
function levelUI(){
  const city=portal.target==='city',b=$('btnLevel');
  b.querySelector('span').textContent=city?'Regiune':'Oraș';
  b.setAttribute('aria-label',city?'Arată harta regiunii':'Arată orașul Alba Iulia');
  canvas.setAttribute('aria-label',city?'Harta Alba Iulia, 30 noiembrie 1918':'Harta regiunii, 30 noiembrie 1918');
}
levelUI();
```

The pointer handlers above use `portal` only when events fire, after the whole script has run, so declaring it below them is safe. `levelUI()` runs once at load, so the start screen already says „Oraș" and names the canvas as the region map.

- [ ] **Step 5: Update the help text**

In `HOW_HTML`, change:

```
Butonul <b>Regiune</b> arată drumurile din cele patru provincii.</div></li>
```

to:

```
Pe harta regiunii, apropie-te de Alba Iulia ca să intri în oraș și depărtează-te ca să revii, sau folosește butonul <b>Oraș / Regiune</b>.</div></li>
```

- [ ] **Step 6: Start every game on the region**

In `begin()`, change:

```js
  S.running=true;buildProvs();hud();unlock('conv');
```

to:

```js
  S.running=true;buildProvs();hud();unlock('conv');
  // every game starts on the region, with all four provinces in view
  portal.reset('region');flight=null;afterFlight=null;regionA=1;R.home();levelUI();
```

- [ ] **Step 7: Fly to the city before the cinematic**

In `endGame()`, delete these two lines:

```js
  // the cinematic flies over the city, so a player on the region is brought back first
  setLevel('city',true);
```

and change:

```js
  save.recordResult({delegates:tot,crowd:S.crowd,medals});audio.bells('ending');
  document.body.classList.add('cinematic');
```

to:

```js
  save.recordResult({delegates:tot,crowd:S.crowd,medals});audio.bells('ending');
  // the cinematic flies over the city, so a player on the region is flown there first
  if(portal.level==='city'&&!portal.busy)playEnding();
  else{afterFlight=playEnding;if(portal.go('city'))startFlight()}
}
function playEnding(){
  document.body.classList.add('cinematic');
```

(the `cine=DSU.cinematic.play(...)` line and the closing `}` that follow stay as they are; they are now the body of `playEnding`).

- [ ] **Step 8: The button flies**

Change:

```js
$('btnLevel').onclick=()=>S&&S.running&&setLevel(level==='city'?'region':'city');
```

to:

```js
$('btnLevel').onclick=()=>{if(S&&S.running&&portal.go(portal.target==='city'?'region':'city'))startFlight()};
```

- [ ] **Step 9: Step the flight every frame**

In `loop()`, change:

```js
  regionA=clamp(regionA+(level==='region'?1:-1)*dt/LEVEL_FADE,0,1);
```

to:

```js
  stepLevel(dt);
```

- [ ] **Step 10: Check tests, lint, build and that nothing still uses the old names**

```bash
grep -nE "\blevel\b|setLevel|LEVEL_FADE" src/game.js | grep -vE "portal\.level|levelUI|stepLevel|other level"
npm test
npm run lint
npm run build
```

Expected: the grep prints nothing; `# pass 85`, `# fail 0` (72 existing + 12 portal + 1 region); lint prints nothing after the command line; build prints `8 scripts` and about `1.06 MB`.

- [ ] **Step 11: Commit**

```bash
git add index.html src/game.js
git commit -m "feat: start on the region and zoom through to the city"
```

---

### Task 4: Document, preflight and check in the browser

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document it in CLAUDE.md**

1. At the end of the `src/region.js` line (after `… cu numele oficial din 1918 sau cota de delegați.`), add ` \`home()\` revine la vederea cu toate provinciile.` Then add this new line right after it:

```markdown
- `src/portal.js`: trecerea dintre regiune și oraș (`DSU.portal.create`), ca mașină de stări fără DOM. `u` merge de la 0 (regiunea) la 1 (orașul) în 0,8 s (0,2 s cu reduced motion); un zbor întors la jumătate pornește înapoi de unde a rămas. `overscroll` adună zoom-ul cerut peste limita unei hărți și schimbă nivelul abia după `PUSH` (×1,5); apăsarea se stinge în 0,6 s, deci tremuratul la prag nu schimbă nivelul. `alpha()` dă opacitatea regiunii, iar `pose()` camera regiunii în timpul zborului.
```

2. In the `src/game.js` line, change `Citește din \`DSU.core\` și \`DSU.region\`, deci se încarcă ultimul (ordinea: \`core\`, \`geo\`, \`save\`, \`audio\`, \`cinematic\`, \`region\`, \`game\`).` to:

```markdown
Citește din `DSU.core`, `DSU.region` și `DSU.portal`, deci se încarcă ultimul (ordinea: `core`, `geo`, `save`, `audio`, `cinematic`, `region`, `portal`, `game`).
```

3. In the `tests/` line, change ``(`core`, `geo`, `region`, `save`, `audio`, `cinematic`)`` to ``(`core`, `geo`, `region`, `portal`, `save`, `audio`, `cinematic`)``.

4. Replace the whole **Nivelurile** bullet under `## Cum e organizat game.js` with:

```markdown
- **Nivelurile**: `portal` (din `portal.js`) ține nivelul, iar `regionA` e opacitatea regiunii. Fiecare joc începe pe regiune, cu toate provinciile (`begin` → `R.home()`). Apropierea peste 6× lângă Alba Iulia (la cel mult 30% din ecran de punctul de zoom sau de centru) pornește coborârea în oraș; depărtarea sub zoom-ul minim al orașului pornește urcarea. `startFlight` fixează zborul: camera regiunii merge de la vederea jucătorului la un prim-plan pe Alba Iulia, orașul așteaptă în vederea de start (`cityHome`), iar urcarea aterizează cu Alba Iulia la 3×. Butonul „Oraș / Regiune” face același zbor și îl poate întoarce. În timpul zborului, tragerea, zoom-ul și atingerile sunt ignorate; pauza nu oprește zborul. La 10:00, `endGame` zboară întâi în oraș (`afterFlight`), apoi pornește cinematicul (`playEnding`).
```

- [ ] **Step 2: Run the full preflight**

```bash
npm test
npm run lint
npm run build
```

Expected: `# pass 85`, `# fail 0`; no lint output; `8 scripts`, about `1.06 MB`.

- [ ] **Step 3: Check the game in the browser**

Serve the game (`game` in `.claude/launch.json`, or `npx serve . -l 3000`), with the console open:

1. The start screen sits over the region map. The button says „Oraș", and the canvas is labelled „Harta regiunii".
2. „Începe misiunea": the game runs on the region, with all four provinces in view.
3. Wheel in on Brașov past 6×: the zoom stops and nothing else happens.
4. Wheel in on Alba Iulia past 6×: after about three more notches, the camera dives onto Alba Iulia and the city fades in, in its opening view. The button now says „Regiune".
5. In the city, two slow wheel notches out at the zoom limit: the player stays in the city. Keep wheeling out: the view climbs to the region, with Alba Iulia centred.
6. Press „Oraș", then press it again within half a second: the flight turns around smoothly and lands back on the region.
7. Let the game reach 1 decembrie 10:00 on the region (at ×2, resolving the cards): the view flies to the city, then the cinematic plays and the results open. „Joacă din nou" starts on the region again.
8. Emulate `prefers-reduced-motion: reduce`: the switch is a short crossfade and the region map does not move.
9. Repeat 2, 4 and 5 at 390×844 with a two-finger pinch if a touch device is available.
10. No console errors; `Object.keys(DSU)` lists `core, geo, save, audio, cinematic, region, portal`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe portal.js and the continuous zoom"
```

- [ ] **Step 5: Push and open the PR only after Lucian approves in chat**

```bash
git push -u origin feature/region-portal
gh pr create --base main --title "feat: start on the region and zoom through to the city" --body-file <body>
```
