# Region map, PR 2: region.js and the „Regiune / Oraș" button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the 1918 regional map from `DSU.geo` on a plain paper background with its own
camera (pan, pinch, wheel, tap for info cards), and add a „Regiune / Oraș" button in the HUD
that crossfades between the region and the city.

**Architecture:** A new classic-script IIFE, `src/region.js`, attaches to `DSU.region` in the
browser and exports through `module.exports` in Node, like `geo.js`. It owns the region camera,
an off-screen paper layer, the per-frame drawing and the label hit boxes. `game.js` keeps a
small `level` / `regionA` state, routes input to the active map and draws the region on top
of the city with `regionA` as opacity. Journeys still run only in the city.

**Tech Stack:** Plain ES2020 classic scripts, Canvas 2D, `node:test` + `node:assert/strict`,
ESLint 9 flat config. No new dependencies.

Spec: `docs/superpowers/specs/2026-09-30-region-map-design.md`, sections 1, 2, 5 and 6.2.
PR 1 (`geo.js`) is merged; this plan uses `RW`, `RH`, `TOWNS`, `RIVERS`, `BORDER_1918`,
`REGIONS`, `LABELS`, `ROUTES`, `project`, `townXY` and `routePath` from it.

## Decisions in this PR

- **Lines are drawn every frame, not in the off-screen layer.** The layer holds only the paper
  and the province washes. Rivers, the border, roads, railways and towns are a few hundred
  points, cheap to stroke, and stay crisp at the 6× zoom the spec asks for.
- **The level state lives in `game.js` for now** (`level`, `regionA`, `setLevel`). PR 3 moves it
  to `portal.js`, adds the continuous zoom and starts the game on the region. Until then the
  game starts in the city, as today.
- **Nothing moves on the region yet.** Markers, blocks, guards and located events arrive in PR 4.
  The region only highlights the selected province's road and railway.
- **The tap card reuses `showLandmark`** with a new optional `eyebrow` argument.
- **Narrow phones:** with a sixth button the tools row is too wide at 360–390 px. Below 400 px
  the tool buttons get 6 px padding. Below 380 px the Chronicle button keeps only its icon and
  its yellow dot. Measured in the browser: 360 px → right edge 318 of 344, 390 px → 363 of 374.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/region.js` | create | Region camera, paper layer, per-frame drawing, labels, hit test, info card text |
| `tests/region.test.js` | create | Camera limits, segments, label tiers, drawing with a fake context, taps, card text |
| `index.html` | modify | `btnLevel` in the tools panel; load `src/region.js` after `src/cinematic.js` |
| `src/game.js` | modify | `level` / `regionA`, input routing, `setLevel`, crossfade in `draw`, `R.init` |
| `src/style.css` | modify | Tool buttons on phones narrower than 400 and 380 px |
| `CLAUDE.md` | modify | Describe `region.js`, the levels and the narrow-phone rule |

---

### Task 1: Branch and region camera

**Files:**
- Create: `src/region.js`
- Create: `tests/region.test.js`

- [ ] **Step 1: Create the branch from main**

```bash
git switch main && git pull --ff-only origin main
git switch -c feature/region-view
```

(In a worktree where `main` is checked out elsewhere: `git fetch origin && git switch -c feature/region-view origin/main`.)

- [ ] **Step 2: Write the failing tests**

Create `tests/region.test.js`:

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const geo=require('../src/geo.js');
const region=require('../src/region.js');
const {cam,resize,pan,zoomAt,toScreen,MAXK}=region;
const {RW,RH}=geo;

const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

test('region attaches itself to the DSU namespace',()=>{
  assert.equal(globalThis.DSU.region,region);
});

test('the widest view shows the whole region on a phone and on a desktop',()=>{
  for(const [w,h] of [[390,844],[1440,900],[780,360]]){
    resize(w,h);cam.z=0;resize(w,h);
    assert.ok(RW*cam.z<=w+1e-9&&RH*cam.z<=h+1e-9,`${w}×${h}`);
    assert.ok(near(RW*cam.z,w)||near(RH*cam.z,h),`${w}×${h} fills one side`);
    assert.ok(near(cam.x,RW/2)&&near(cam.y,RH/2),`${w}×${h} is centred`);
  }
});

test('zoom stops at 6× the widest view and keeps the point under the cursor',()=>{
  resize(1440,900);cam.z=cam.minZ;
  zoomAt(720,450,1000);
  assert.ok(near(cam.z,cam.minZ*MAXK));
  resize(1440,900);cam.z=cam.minZ*2;cam.x=RW/2;cam.y=RH/2;
  const [sx,sy]=[900,300],before=[cam.x+(sx-720)/cam.z,cam.y+(sy-450)/cam.z];
  zoomAt(sx,sy,1.5);
  const after=[cam.x+(sx-720)/cam.z,cam.y+(sy-450)/cam.z];
  assert.ok(near(before[0],after[0])&&near(before[1],after[1]));
  zoomAt(720,450,.0001);
  assert.ok(near(cam.z,cam.minZ));
});

test('panning never loses the map: at most 90 px past its edge',()=>{
  resize(1440,900);cam.z=cam.minZ*3;
  pan(1e6,1e6);
  const [lx,ty]=toScreen(0,0);
  assert.ok(near(lx,90)&&near(ty,90),`${lx},${ty}`);
  pan(-1e7,-1e7);
  const [rx,by]=toScreen(RW,RH);
  assert.ok(near(rx,1440-90)&&near(by,900-90),`${rx},${by}`);
});
```

`resize(w,h);cam.z=0;resize(w,h)` forces the widest view: the second `resize` clamps `z` up to
`minZ`. The tests share one module, so each test sets the camera it needs.

- [ ] **Step 3: Run them to see them fail**

Run: `node --test tests/region.test.js`
Expected: FAIL with `Cannot find module '../src/region.js'`

- [ ] **Step 4: Write the camera**

Create `src/region.js`:

```js
/* Harta regiunii: camera, stratul static (hârtia și provinciile) și desenul de pe fiecare cadru
   (granița, râurile, drumurile, căile ferate, orașele, traseele provinciei alese).
   Coordonatele vin din DSU.geo. Liniile se desenează la fiecare cadru, ca să rămână clare și la zoom mare. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const core=DSU.core||require('./core.js');
const geo=DSU.geo||require('./geo.js');
const {clamp}=core;
const {RW,RH}=geo;

/* ---------- camera ---------- */
const MAXK=6; // closest zoom, as a multiple of the zoom that shows all four provinces
const cam={x:RW/2,y:RH/2,z:1,minZ:1};
let vw=0,vh=0,placed=false;
function resize(w,h){
  vw=w;vh=h;cam.minZ=Math.min(vw/RW,vh/RH);
  if(!placed){cam.z=cam.minZ;placed=true}
  cam.z=clamp(cam.z,cam.minZ,cam.minZ*MAXK);clampCam();
}
// margin: how far past the map edge the view may go, in screen pixels (lets towns come out from under the HUD)
function clampCam(margin=90){
  const m=margin/cam.z,hw=vw/2/cam.z,hh=vh/2/cam.z;
  const fit=(v,half,size)=>{const lo=half-m,hi=size-half+m;return lo<=hi?clamp(v,lo,hi):size/2};
  cam.x=fit(cam.x,hw,RW);cam.y=fit(cam.y,hh,RH);
}
function pan(dx,dy){cam.x-=dx/cam.z;cam.y-=dy/cam.z;clampCam()}
function zoomAt(sx,sy,f){
  const wx=cam.x+(sx-vw/2)/cam.z,wy=cam.y+(sy-vh/2)/cam.z;
  cam.z=clamp(cam.z*f,cam.minZ,cam.minZ*MAXK);
  cam.x=wx-(sx-vw/2)/cam.z;cam.y=wy-(sy-vh/2)/cam.z;clampCam();
}
const toScreen=(x,y)=>[(x-cam.x)*cam.z+vw/2,(y-cam.y)*cam.z+vh/2];

/* ---------- export ---------- */
const region={cam,resize,pan,zoomAt,toScreen,MAXK};
DSU.region=region;
if(typeof module!=='undefined'&&module.exports)module.exports=region;
})(typeof window!=='undefined'?window:globalThis);
```

Unlike the city (`Math.max`, the map covers the screen), the region uses `Math.min`, so the
widest view contains all four provinces. On the letterboxed axis `fit` centres the map, and
still lets it move up to 90 px so towns can come out from under the HUD.

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test tests/region.test.js`
Expected: `# pass 4`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add src/region.js tests/region.test.js
git commit -m "feat: add region.js camera for the regional map"
```

---

### Task 2: Paper layer, map drawing, labels and taps

**Files:**
- Modify: `src/region.js` (insert above `/* ---------- export ---------- */`, extend the export)
- Modify: `tests/region.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/region.test.js`:

```js

test('road and rail segments are drawn once, even where provinces share them',()=>{
  assert.equal(region.ROADS.length,27);
  assert.equal(region.RAILS.length,26);
});

test('small towns get a label only when zoomed in; waypoints never do',()=>{
  const far=region.visibleTowns(1),close=region.visibleTowns(region.TIER2);
  assert.ok(far.includes('albaIulia')&&far.includes('cluj'));
  assert.ok(!far.includes('teius')&&close.includes('teius'));
  assert.ok(!close.includes('campeni'));
});

// a 2D context that accepts every call; measureText gives 7 px per letter
function fakeCtx(){
  const target={measureText:t=>({width:String(t).length*7})};
  return new Proxy(target,{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>{o[k]=v;return true}});
}

test('the map draws without a browser, and a tap on a label finds the place',()=>{
  region.init({cols:{MM:'#5b86d6',CR:'#e2b21f',BN:'#d4574c',TR:'#7fb069'},makeCanvas:()=>({getContext:fakeCtx})});
  resize(1440,900);cam.z=cam.minZ*2;cam.x=RW/2;cam.y=RH/2;
  region.draw(fakeCtx(),{sel:'TR',clock:1.5});
  const [ax,ay]=toScreen(...geo.townXY('albaIulia'));
  assert.deepEqual(region.hit(ax+20,ay),{kind:'town',key:'albaIulia'});
  assert.equal(region.hit(-50,-50),null);
  cam.z=cam.minZ;cam.x=RW/2;cam.y=RH/2;
  region.draw(fakeCtx());
  const l=geo.LABELS.find(x=>x.prov==='BN'),[bx,by]=toScreen(...geo.project(l.lat,l.lon));
  assert.deepEqual(region.hit(bx,by),{kind:'prov',key:'BN'});
});
```

Why 27 and 26: the four roads share no segment (8 + 6 + 7 + 6 = 27). The railways of Maramureș
and Crișana share Cluj → Câmpia Turzii → Aiud → Teiuș → Alba Iulia, and Banat and Transilvania
share Vințu de Jos → Alba Iulia, so 6 + 4 + 9 + 7 = 26 unique rail segments.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/region.test.js`
Expected: FAIL, 3 failures: `Cannot read properties of undefined (reading 'length')`,
`region.visibleTowns is not a function`, `region.init is not a function`

- [ ] **Step 3: Add the drawing**

Insert into `src/region.js` above `/* ---------- export ---------- */`:

```js
/* ---------- projected shapes ---------- */
const {TOWNS,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,project,townXY,routePath}=geo;
const proj=pts=>pts.map(([lat,lon])=>project(lat,lon));
const RIV=RIVERS.map(r=>({major:!!r.major,pts:proj(r.pts)}));
const BORDER=proj(BORDER_1918);
// the Kingdom of Romania: from the border to the map edge, closed along the Danube below Orșova
const KINGDOM=proj([...BORDER_1918,[44.63,22.66],[44.60,22.70],[44.60,26.30],[47.10,26.30]]);
const REG=Object.fromEntries(Object.entries(REGIONS).map(([k,v])=>[k,proj(v)]));
const LAB=LABELS.map(l=>{const [x,y]=project(l.lat,l.lon);return{...l,x,y}});
// every road and rail segment once, even where two provinces share it
function edges(kind){
  const seen=new Set(),out=[];
  for(const p in ROUTES){const r=ROUTES[p][kind];
    for(let i=1;i<r.length;i++){const k=[r[i-1],r[i]].sort().join('-');if(!seen.has(k)){seen.add(k);out.push([townXY(r[i-1]),townXY(r[i])])}}}
  return out;
}
const ROADS=edges('road'),RAILS=edges('rail');

/* ---------- static layer ---------- */
const RS=.8; // static layer resolution, in pixels per world unit
let layer=null,cols={};
function poly(g,pts,close=true){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);if(close)g.closePath()}
// cols: province colours by key; makeCanvas lets Node tests pass a fake canvas
function init({cols:c,makeCanvas=()=>document.createElement('canvas')}){
  cols=c;layer=makeCanvas();
  layer.width=Math.round(RW*RS);layer.height=Math.round(RH*RS);
  const g=layer.getContext('2d');g.setTransform(RS,0,0,RS,0,0);
  g.fillStyle='#e9dcbc';g.fillRect(0,0,RW,RH);
  // paper grain, seeded so it is the same on every load
  let s=11;const r=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646};
  for(let i=0;i<2600;i++){g.fillStyle=`rgba(120,90,50,${.03+r()*.05})`;g.fillRect(r()*RW,r()*RH,1+r()*3,1+r()*3)}
  poly(g,KINGDOM);g.fillStyle='rgba(90,110,70,.12)';g.fill();
  // the four regions: a wash in the province colour; the wide stroke blurs the approximate edges
  g.lineJoin='round';
  for(const k in REG){poly(g,REG[k]);g.globalAlpha=.16;g.fillStyle=cols[k];g.fill();g.globalAlpha=.3;g.strokeStyle=cols[k];g.lineWidth=14;g.stroke()}
  g.globalAlpha=1;
}

/* ---------- per frame ---------- */
function line(g,pts,w,col,dash,off){poly(g,pts,false);g.strokeStyle=col;g.lineWidth=w;g.setLineDash(dash||[]);g.lineDashOffset=off||0;g.stroke();g.setLineDash([])}
// sel: the selected province key or null; clock: seconds, animates the dashes
function draw(g,{sel=null,clock=0}={}){
  g.fillStyle='#2a261f';g.fillRect(0,0,vw,vh);
  g.save();g.translate(vw/2,vh/2);g.scale(cam.z,cam.z);g.translate(-cam.x,-cam.y);
  if(layer)g.drawImage(layer,0,0,RW,RH);
  // widths are in screen pixels, so lines stay crisp at every zoom
  const px=1/cam.z;g.lineCap='round';g.lineJoin='round';
  for(const r of RIV)line(g,r.pts,(r.major?2.4:1.5)*px,'#6f93b0');
  line(g,BORDER,2.2*px,'#7a2a20',[8*px,4*px,1.5*px,4*px]);
  for(const e of ROADS)line(g,e,1.6*px,'rgba(122,92,48,.8)');
  for(const e of RAILS){line(g,e,3.2*px,'#2a2018');line(g,e,1.4*px,'#efe3c6',[5*px,5*px])}
  if(sel)for(const kind of ['road','rail'])line(g,routePath(sel,kind).pts,(kind==='rail'?5:6)*px,cols[sel],[10*px,7*px],-clock*28*px);
  g.restore();
  labels(g);
}

/* ---------- labels and taps ---------- */
const TIER2=1.8; // tier 2 towns get a label from this zoom multiple on
let hits=[];
const zoomK=()=>cam.z/cam.minZ;
function visibleTowns(k){return Object.keys(TOWNS).filter(t=>TOWNS[t].tier===1||(TOWNS[t].tier===2&&k>=TIER2))}
function labels(g){
  hits=[];const k=zoomK();
  g.save();g.textBaseline='middle';
  // region names: large and faint; they fade out between 2.5× and 4×
  const a=clamp((4-k)/1.5,0,1);
  if(a>0){g.textAlign='center';
    for(const l of LAB){const [sx,sy]=toScreen(l.x,l.y),fs=l.prov?26:18,text=l.prov?l.name.toUpperCase():l.name;
      g.globalAlpha=a*(l.prov?.75:.6);g.font=`${l.prov?'700':'italic 600'} ${fs}px "Cormorant SC",Georgia,serif`;
      g.fillStyle=l.prov?'#3a2a14':'#4a5a3a';g.fillText(text,sx,sy);
      if(l.prov){const w=g.measureText(text).width;hits.push({kind:'prov',key:l.prov,x:sx-w/2,y:sy-fs/2,w,h:fs})}}
    g.globalAlpha=1}
  g.textAlign='left';
  for(const t of visibleTowns(k)){const T=TOWNS[t],[sx,sy]=toScreen(...townXY(t));
    if(sx<-100||sx>vw+100||sy<-30||sy>vh+30)continue;
    const main=t==='albaIulia',r=main?6:T.tier===1?4:3,fs=main?17:T.tier===1?14:12;
    g.fillStyle=main?'#7a2a20':'#2a2018';g.beginPath();g.arc(sx,sy,r,0,7);g.fill();
    if(main){g.strokeStyle='#7a2a20';g.lineWidth=1.5;g.beginPath();g.arc(sx,sy,r+3.5,0,7);g.stroke()}
    g.font=`700 ${fs}px "Cormorant SC",Georgia,serif`;
    const tx=sx+r+5;g.lineWidth=3.5;g.strokeStyle='rgba(233,220,188,.9)';g.strokeText(T.name,tx,sy);
    g.fillStyle=main?'#7a2a20':'#2a2018';g.fillText(T.name,tx,sy);
    const w=g.measureText(T.name).width;hits.push({kind:'town',key:t,x:sx-r-6,y:sy-11,w:w+2*r+17,h:22});
  }
  g.restore();
}
// screen point → {kind:'town'|'prov', key} of the label under it, or null; towns win over region names
function hit(x,y){
  const h=hits.slice().reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
  return h?{kind:h.kind,key:h.key}:null;
}
```

Replace the export line with:

```js
const region={cam,resize,pan,zoomAt,toScreen,MAXK,ROADS,RAILS,init,draw,visibleTowns,TIER2,hit};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/region.test.js`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/region.js tests/region.test.js
git commit -m "feat: draw the 1918 region map with labels and taps"
```

---

### Task 3: Info cards for towns and provinces

**Files:**
- Modify: `src/region.js`
- Modify: `tests/region.test.js`

The map shows the Romanian names; the card gives the official 1918 name, as the city does for
the station (spec, section 2). The province card says the outline is approximate.

- [ ] **Step 1: Write the failing test**

Append to `tests/region.test.js`:

```js

test('info cards give the official 1918 name and say the outlines are approximate',()=>{
  const ai=region.info({kind:'town',key:'albaIulia'});
  assert.equal(ai.title,'Alba Iulia');
  assert.match(ai.text,/Gyulafehérvár/);
  assert.match(ai.text,/Marea Adunare/);
  assert.match(region.info({kind:'town',key:'arad'}).text,/tot Arad/);
  const bn=region.info({kind:'prov',key:'BN'});
  assert.equal(bn.title,'Banat');
  assert.match(bn.text,/300 de delegați/);
  assert.match(bn.text,/aproximativ/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/region.test.js`
Expected: FAIL, `region.info is not a function`

- [ ] **Step 3: Add the card text**

Insert into `src/region.js` above `/* ---------- export ---------- */`:

```js
/* ---------- info cards ---------- */
const {QUOTAS}=core;
// text for the info card of a town or a province; the official 1918 name goes here, not on the map
function info({kind,key}){
  if(kind==='town'){const t=TOWNS[key];
    const name=t.official===t.name?`Numele oficial din 1918 era tot ${t.name}.`:`În 1918, localitatea era în Austro-Ungaria, iar numele ei oficial era ${t.official}.`;
    const extra=key==='albaIulia'?' Aici se ține Marea Adunare Națională, pe 1 decembrie. Apasă „Oraș” ca să vezi cetatea.':'';
    return{eyebrow:'Harta regiunii · noiembrie 1918',title:t.name,text:name+extra}}
  const l=LABELS.find(x=>x.prov===key);
  return{eyebrow:'Provincie istorică',title:l.name,text:`De aici pleacă spre Alba Iulia ${QUOTAS[key]} de delegați. Conturul de pe hartă e aproximativ: arată regiunea istorică, nu o graniță administrativă.`};
}
```

Replace the export line with:

```js
const region={cam,resize,pan,zoomAt,toScreen,MAXK,ROADS,RAILS,init,draw,visibleTowns,TIER2,hit,info};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/region.test.js && npx eslint src/region.js tests/region.test.js`
Expected: `# pass 8`, `# fail 0`, then no ESLint output

- [ ] **Step 5: Commit**

```bash
git add src/region.js tests/region.test.js
git commit -m "feat: add info cards for towns and provinces on the region"
```

---

### Task 4: Wire the region into the game

**Files:**
- Modify: `index.html` (tools panel, script list)
- Modify: `src/game.js` (11 small edits, listed below)

This task is DOM glue; it is checked in the browser in Task 6. Every edit replaces text that
appears exactly once in the file.

- [ ] **Step 1: Add the button and load region.js**

In `index.html`, change:

```html
    <div class="panel tools">
      <button class="tool" id="btnSpeed" aria-label="Viteza jocului">×1</button>
```

to:

```html
    <div class="panel tools">
      <button class="tool" id="btnLevel" aria-label="Arată harta regiunii"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg><span>Regiune</span></button>
      <button class="tool" id="btnSpeed" aria-label="Viteza jocului">×1</button>
```

and change:

```html
<script src="src/cinematic.js"></script>
<script src="src/game.js"></script>
```

to:

```html
<script src="src/cinematic.js"></script>
<script src="src/region.js"></script>
<script src="src/game.js"></script>
```

(The spec's order puts `portal.js` between `region.js` and `game.js`; PR 3 adds it.)

- [ ] **Step 2: Read DSU.region and size its camera**

In `src/game.js`, change:

```js
const save=DSU.save,audio=DSU.audio;
```

to:

```js
const save=DSU.save,audio=DSU.audio,R=DSU.region;
```

and in `resize()`, change:

```js
  if(!vw||!vh)return;
```

to:

```js
  if(!vw||!vh)return;
  R.resize(vw,vh);
```

- [ ] **Step 3: Route drag, pinch, wheel and taps to the active map**

Change the one-finger drag line:

```js
  if(ptrs.size===1){cam.x-=(e.clientX-p.x)/cam.z;cam.y-=(e.clientY-p.y)/cam.z;clampCam()}
```

to:

```js
  if(ptrs.size===1){if(level==='region')R.pan(e.clientX-p.x,e.clientY-p.y);else{cam.x-=(e.clientX-p.x)/cam.z;cam.y-=(e.clientY-p.y)/cam.z;clampCam()}}
```

In the pinch line, change `if(pinchD)zoomAt(` to `if(pinchD)zoomActive(`.

Replace the whole `const up=e=>{...};` line:

```js
const up=e=>{ptrs.delete(e.pointerId);pinchD=0;if(tap&&e.type==='pointerup'&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<7&&!modalOpen){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const h=labelHits.slice().reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(h)showLandmark(h.l)}tap=null};
```

with:

```js
const up=e=>{ptrs.delete(e.pointerId);pinchD=0;if(tap&&e.type==='pointerup'&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<7&&!modalOpen){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  if(level==='region'){const h=R.hit(x,y);if(h){const i=R.info(h);showLandmark({t:i.title,info:i.text},i.eyebrow)}}
  else{const h=labelHits.slice().reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(h)showLandmark(h.l)}}tap=null};
```

In the wheel listener, change `zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015))` to
`zoomActive(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015))`.

- [ ] **Step 4: Add the level state**

Right after the wheel listener line (`canvas.addEventListener('wheel',...,{passive:false});`),
before `/* ---------- background painting ---------- */`, insert:

```js

/* ---------- levels ---------- */
// the region map and the city map; the button crossfades between them (portal.js will add the continuous zoom)
let level='city',regionA=0;
const LEVEL_FADE=reduceMotion?.2:.45;
function zoomActive(sx,sy,f){if(level==='region')R.zoomAt(sx,sy,f);else zoomAt(sx,sy,f)}
// now: skip the fade, as the cinematic ending does
function setLevel(l,now=false){
  level=l;if(now)regionA=l==='region'?1:0;
  const city=l==='city',b=$('btnLevel');
  b.querySelector('span').textContent=city?'Regiune':'Oraș';
  b.setAttribute('aria-label',city?'Arată harta regiunii':'Arată orașul Alba Iulia');
  canvas.setAttribute('aria-label',city?'Harta Alba Iulia, 30 noiembrie 1918':'Harta regiunii, 30 noiembrie 1918');
}
```

The pointer handlers above use `level` and `zoomActive` only when events fire, after the whole
script has run, so declaring them below is safe.

- [ ] **Step 5: Let showLandmark take an eyebrow**

Change:

```js
function showLandmark(l){
  $('card').innerHTML=`<div class="eyebrow">Alba Iulia · noiembrie 1918</div><h2>${l.t}</h2>
```

to:

```js
function showLandmark(l,eyebrow='Alba Iulia · noiembrie 1918'){
  $('card').innerHTML=`<div class="eyebrow">${eyebrow}</div><h2>${l.t}</h2>
```

(the rest of that line, from `<p>${l.info}</p>` on, stays the same).

- [ ] **Step 6: Split draw() into the city and the crossfade**

Change the start of `draw()`:

```js
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#2a261f';ctx.fillRect(0,0,vw,vh);
```

to:

```js
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // mid-fade both maps are drawn; the region goes on top with its opacity
  if(regionA<1)drawCity();
  if(regionA>0){ctx.globalAlpha=regionA;R.draw(ctx,{sel:S?S.sel:null,clock});ctx.globalAlpha=1}
  // snowfall + vignette
  if(!reduceMotion){ctx.fillStyle='rgba(255,255,255,.75)';for(const f of flakes){const x=((f.x+Math.sin(clock*.6+f.p)*.01)%1)*vw,y=f.y*vh;ctx.beginPath();ctx.arc(x,y,f.r,0,7);ctx.fill()}}
  const vg=ctx.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.35,vw/2,vh/2,Math.max(vw,vh)*.75);vg.addColorStop(0,'rgba(20,16,10,0)');vg.addColorStop(1,'rgba(20,16,10,.45)');ctx.fillStyle=vg;ctx.fillRect(0,0,vw,vh);
}
function drawCity(){
  ctx.fillStyle='#2a261f';ctx.fillRect(0,0,vw,vh);
```

and delete the old snowfall and vignette at the end of the function, so that it ends with the
block-label loop. Change:

```js
    drawLabel({t:S.blocks[k].label,x:q.x,y:q.y-34,small:1})}
  // snowfall + vignette
  if(!reduceMotion){ctx.fillStyle='rgba(255,255,255,.75)';for(const f of flakes){const x=((f.x+Math.sin(clock*.6+f.p)*.01)%1)*vw,y=f.y*vh;ctx.beginPath();ctx.arc(x,y,f.r,0,7);ctx.fill()}}
  const vg=ctx.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.35,vw/2,vh/2,Math.max(vw,vh)*.75);vg.addColorStop(0,'rgba(20,16,10,0)');vg.addColorStop(1,'rgba(20,16,10,.45)');ctx.fillStyle=vg;ctx.fillRect(0,0,vw,vh);
}
```

to:

```js
    drawLabel({t:S.blocks[k].label,x:q.x,y:q.y-34,small:1})}
}
```

- [ ] **Step 7: Mention the button in the help**

In `HOW_HTML`, change the end of item 4:

```
Atinge etichetele cu <b>i</b> ca să afli ce era fiecare clădire în 1918.</div></li>
```

to:

```
Atinge etichetele cu <b>i</b> ca să afli ce era fiecare clădire în 1918. Butonul <b>Regiune</b> arată drumurile din cele patru provincii.</div></li>
```

- [ ] **Step 8: Back to the city before the cinematic**

In `endGame()`, change:

```js
  S.running=false;S.over=true;cam.anim=null;audio.chuff(false);
```

to:

```js
  S.running=false;S.over=true;cam.anim=null;audio.chuff(false);
  // the cinematic flies over the city, so a player on the region is brought back first
  setLevel('city',true);
```

- [ ] **Step 9: The button, the fade and init**

After `$('btnHelp').onclick=()=>S&&showHelp();` add:

```js
$('btnLevel').onclick=()=>S&&setLevel(level==='city'?'region':'city');
```

In `loop()`, change:

```js
  if(!paused)updateSmoke(dt);
```

to:

```js
  regionA=clamp(regionA+(level==='region'?1:-1)*dt/LEVEL_FADE,0,1);
  if(!paused)updateSmoke(dt);
```

In the start-up block at the end, change:

```js
  await new Promise(r=>{mapImg.onload=r;mapImg.onerror=r;mapImg.src=MAP_SRC});renderBG();
```

to:

```js
  R.init({cols:Object.fromEntries(PKEYS.map(k=>[k,PROV[k].col]))});
  await new Promise(r=>{mapImg.onload=r;mapImg.onerror=r;mapImg.src=MAP_SRC});renderBG();
```

- [ ] **Step 10: Check tests, lint and build**

```bash
npm test
npm run lint
npm run build
```

Expected: `# pass 70`, `# fail 0` (62 existing + 8 new); lint prints nothing after the command
line; build prints `7 scripts` and about `1.05 MB`.

- [ ] **Step 11: Commit**

```bash
git add index.html src/game.js
git commit -m "feat: add the Regiune / Oraș button with a crossfade"
```

---

### Task 5: Tool buttons on narrow phones

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Tighten the tools row**

In `src/style.css`, in the `@media (max-width:400px)` block, change:

```css
  .act svg{grid-row:1/3;width:24px;height:24px}
}
```

to:

```css
  .act svg{grid-row:1/3;width:24px;height:24px}
  .tool{padding:0 6px}
}
/* 360–380 px: with the „Regiune” button the tools row is too wide, so the Chronicle keeps only its icon and dot */
@media (max-width:380px){
  #btnChron span:not(.dot){display:none}
}
```

- [ ] **Step 2: Measure it in the browser**

Serve the game (`game` entry in `.claude/launch.json`, or `npx serve . -l 3000`), click
„Începe misiunea", then for each viewport 360×780, 390×844 and 780×360 run in the console:

```js
(async()=>{const out={};for(const l of [0,1]){const t=document.querySelector('.tools').getBoundingClientRect();out[document.getElementById('btnLevel').textContent.trim()]=[Math.round(t.right),innerWidth-16];document.getElementById('btnLevel').click();await new Promise(r=>setTimeout(r,600))}return out})()
```

Expected: for both „Regiune" and „Oraș" the first number is at most the second
(measured: 360 → 318 / 344, 390 → 363 / 374, 780×360 → 764 / 764).

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "fix: keep the tools row inside narrow phone screens"
```

---

### Task 6: Document, preflight and check in the browser

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document it in CLAUDE.md**

Under `## Structură`, after the `src/cinematic.js` line, add:

```markdown
- `src/region.js`: harta regiunii (`DSU.region`), desenată din `geo.js` pe un fundal de hârtie: provinciile, granița din 1918, râurile, drumurile, căile ferate, orașele și traseele provinciei alese. Are camera ei (de la „toate provinciile” până la 6× apropiere, `MAXK`), iar orașele mici (`tier` 2) apar de la 1,8× (`TIER2`). Hârtia și provinciile sunt pictate o dată pe un canvas separat; liniile și etichetele se desenează la fiecare cadru, ca să rămână clare la zoom. Atingerea unui oraș sau a unei provincii deschide o fișă (`info`) cu numele oficial din 1918 sau cota de delegați.
```

Change the `tests/` line:

```markdown
- `tests/`: teste unitare pentru `core.js` și `geo.js`.
```

to:

```markdown
- `tests/`: teste unitare pentru modulele fără DOM (`core`, `geo`, `region`, `save`, `audio`, `cinematic`). `region` e testat cu un context 2D fals.
```

At the end of the `src/style.css` line (after `Verificat la 360×780, 390×844 și 780×360.`), add:

```markdown
 Sub 400 px, butoanele de unelte au spațiere mai mică, iar sub 380 px Cronica rămâne doar cu iconița și punctul.
```

Under `## Cum e organizat game.js`, after the **Pe telefon** bullet, add:

```markdown
- **Nivelurile**: `level` (`'city'` sau `'region'`) și `regionA`, opacitatea hărții regiunii. Butonul „Regiune / Oraș” (`setLevel`) face un fade de 0,45 s (0,2 s cu reduced motion). Pe regiune, tragerea, pinch-ul, rotița și atingerile merg la `DSU.region`. `endGame` revine instant în oraș înainte de cinematic. Jocul pornește încă în oraș; pornirea pe regiune și zoom-ul continuu vin cu `portal.js`.
```

- [ ] **Step 2: Run the full preflight**

```bash
npm test
npm run lint
npm run build
```

Expected: `# pass 70`, `# fail 0`; no lint output; `7 scripts`, about `1.05 MB`.

- [ ] **Step 3: Check the game in the browser**

Serve the game and check, with the console open:

1. „Începe misiunea", then „Regiune": the paper map fades in with the four provinces, the
   dashed 1918 border, the rivers, the railways and the selected province's routes animated.
2. Wheel in on Alba Iulia: Teiuș, Aiud, Vințu de Jos and Sebeș get labels; the region names fade.
3. Tap „Alba Iulia": the card says Gyulafehérvár. Close it; tap „CRIȘANA": the card gives 260
   delegates and says the outline is approximate.
4. Pick another province in the list: its routes are highlighted instead.
5. „Oraș": the city fades back, labels and taps work as before.
6. Repeat 1–5 at 360×780, 390×844 and 780×360.
7. No console errors; `Object.keys(DSU)` lists `core`, `geo`, `save`, `audio`, `cinematic`, `region`.
8. The ending: switch to the region, set the speed to ×2 and let the game reach 1 decembrie
   10:00 (about 2 minutes, resolving the telegram cards as they come). The view cuts to the city
   and the cinematic plays as before, then the results card opens.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe region.js and the map levels"
```

- [ ] **Step 5: Push and open the PR only after Lucian approves in chat**

```bash
git push -u origin feature/region-view
gh pr create --base main --title "feat: add the regional map view and the Regiune / Oraș button" --body-file <body>
```
