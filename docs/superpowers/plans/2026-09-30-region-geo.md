# Region map, PR 1: geo.js Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/geo.js`, the pure data and math behind the regional map (towns, rivers,
the 1918 border, the four historical regions, road and rail routes per province, regional
speeds and located events), fully covered by Node tests. Nothing visible changes in the game.

**Architecture:** One classic-script IIFE that attaches to `DSU.geo` in the browser and
exports through `module.exports` in Node, exactly like `src/core.js` and `src/save.js`. All
coordinates are real latitude/longitude; `project(lat, lon)` maps them to a region world of
2000 × 1740 units (equirectangular, longitude scaled by cos 46.4°). Later PRs
(`region.js`, `portal.js`, journeys in `game.js`) only read from this module.

**Tech Stack:** Plain ES2020 classic scripts, `node:test` + `node:assert/strict`, ESLint 9
flat config. No new dependencies.

Spec: `docs/superpowers/specs/2026-09-30-region-map-design.md`, sections 2–4 and 6.1.
This plan covers PR 1 only. PRs 2–5 get their own plans once this one is merged, because
they build on the lengths and names defined here.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/geo.js` | create | Projection, towns, rivers, border, regions, routes, speeds, event places |
| `tests/geo.test.js` | create | Everything above, checked in Node |
| `index.html` | modify | Load `src/geo.js` right after `src/core.js` |
| `CLAUDE.md` | modify | Describe `geo.js` and the historical caveats |

`geo.js` depends only on `DSU.core` (`mkPath`). Nothing reads `DSU.geo` yet in this PR.

---

### Task 1: Branch and projection

**Files:**
- Create: `src/geo.js`
- Create: `tests/geo.test.js`

- [ ] **Step 1: Create the branch from main**

```bash
git switch main && git pull --ff-only origin main
git switch -c feature/region-geo
```

- [ ] **Step 2: Write the failing test**

Create `tests/geo.test.js`:

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const geo=require('../src/geo.js');
const {project,unproject,BOUNDS,RW,RH}=geo;

const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

test('the region world is 2000 units wide and keeps the map proportions',()=>{
  assert.equal(RW,2000);
  assert.equal(RH,1740);
});

test('project maps the corners of the bounds to the corners of the world',()=>{
  const nw=project(BOUNDS.latMax,BOUNDS.lonMin),se=project(BOUNDS.latMin,BOUNDS.lonMax);
  assert.ok(near(nw[0],0)&&near(nw[1],0),String(nw));
  assert.ok(near(se[0],RW)&&near(se[1],RH,1),String(se));
});

test('unproject inverts project',()=>{
  const [x,y]=project(46.0667,23.57);
  const [lat,lon]=unproject(x,y);
  assert.ok(near(lat,46.0667)&&near(lon,23.57));
});

test('geo attaches itself to the DSU namespace',()=>{
  assert.equal(globalThis.DSU.geo,geo);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test tests/geo.test.js`
Expected: FAIL with `Cannot find module '../src/geo.js'`

- [ ] **Step 4: Write the minimal implementation**

Create `src/geo.js`:

```js
/* Harta regiunii la 30 noiembrie 1918: orașe, râuri, granița, provinciile istorice, drumuri și căi ferate,
   în coordonate reale (lat/lon) proiectate pe lumea regiunii. Date pure, fără DOM.
   În browser se atașează la DSU.geo; în Node se exportă prin module.exports. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const core=DSU.core||require('./core.js');

/* ---------- projection ---------- */
// equirectangular; longitude is scaled by cos(46.4°), the latitude of the middle of the map
const BOUNDS={latMin:44.6,latMax:48.2,lonMin:20.3,lonMax:26.3};
const COS=Math.cos(46.4*Math.PI/180);
const RW=2000;
const K=RW/((BOUNDS.lonMax-BOUNDS.lonMin)*COS);
const RH=Math.round((BOUNDS.latMax-BOUNDS.latMin)*K);
function project(lat,lon){return[(lon-BOUNDS.lonMin)*COS*K,(BOUNDS.latMax-lat)*K]}
function unproject(x,y){return[BOUNDS.latMax-y/K,x/(COS*K)+BOUNDS.lonMin]}

/* ---------- export ---------- */
const geo={BOUNDS,RW,RH,project,unproject};
DSU.geo=geo;
if(typeof module!=='undefined'&&module.exports)module.exports=geo;
})(typeof window!=='undefined'?window:globalThis);
```

- [ ] **Step 5: Run the test to see it pass**

Run: `node --test tests/geo.test.js`
Expected: `# pass 4`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add src/geo.js tests/geo.test.js
git commit -m "feat: add geo.js projection for the regional map"
```

---

### Task 2: Towns

**Files:**
- Modify: `src/geo.js` (insert above `/* ---------- export ---------- */`, extend the export)
- Modify: `tests/geo.test.js` (append)

`tier` 1 = always labelled, 2 = labelled when zoomed in, 3 = route waypoint only (not drawn).
`official` is the name used by the state in 1918, shown in the town's info card (PR 2).

- [ ] **Step 1: Write the failing tests**

Append to `tests/geo.test.js`:

```js
const {TOWNS,townXY}=geo;

test('every town has a name, an official 1918 name, a tier and a place inside the map',()=>{
  for(const [k,t] of Object.entries(TOWNS)){
    assert.equal(typeof t.name,'string',k);
    assert.equal(typeof t.official,'string',k);
    assert.ok([1,2,3].includes(t.tier),k);
    assert.ok(t.lat>BOUNDS.latMin&&t.lat<BOUNDS.latMax&&t.lon>BOUNDS.lonMin&&t.lon<BOUNDS.lonMax,k);
  }
});

test('towns sit where they are in reality, relative to each other',()=>{
  const [ax,ay]=townXY('albaIulia');
  assert.ok(townXY('cluj')[1]<ay,'Cluj is north of Alba Iulia');
  assert.ok(townXY('arad')[0]<townXY('deva')[0],'Arad is west of Deva');
  assert.ok(townXY('brasov')[0]>townXY('sibiu')[0],'Brașov is east of Sibiu');
  const [ox,oy]=townXY('oradea');assert.ok(ox<ax&&oy<ay,'Oradea is north-west of Alba Iulia');
  assert.ok(townXY('timisoara')[1]>oy,'Timișoara is south of Oradea');
});

test('the capitals of the four provinces are on the map',()=>{
  for(const k of ['baiaMare','oradea','timisoara','brasov','albaIulia'])assert.ok(TOWNS[k],k);
  assert.equal(TOWNS.albaIulia.official,'Gyulafehérvár');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/geo.test.js`
Expected: FAIL, `Cannot convert undefined or null to object` (TOWNS is undefined)

- [ ] **Step 3: Add the towns**

Insert into `src/geo.js` above `/* ---------- export ---------- */`:

```js
/* ---------- towns ---------- */
// name: drawn on the map; official: the 1918 state name, for the info card
// tier 1: always labelled · 2: labelled when zoomed in · 3: route waypoint, not drawn
const TOWNS={
  albaIulia:{name:'Alba Iulia',official:'Gyulafehérvár',lat:46.0667,lon:23.5700,tier:1},
  timisoara:{name:'Timișoara',official:'Temesvár',lat:45.7537,lon:21.2257,tier:1},
  arad:{name:'Arad',official:'Arad',lat:46.1866,lon:21.3123,tier:1},
  oradea:{name:'Oradea',official:'Nagyvárad',lat:47.0465,lon:21.9189,tier:1},
  baiaMare:{name:'Baia Mare',official:'Nagybánya',lat:47.6567,lon:23.5850,tier:1},
  cluj:{name:'Cluj',official:'Kolozsvár',lat:46.7712,lon:23.6236,tier:1},
  sibiu:{name:'Sibiu',official:'Nagyszeben',lat:45.7928,lon:24.1521,tier:1},
  brasov:{name:'Brașov',official:'Brassó',lat:45.6427,lon:25.5887,tier:1},
  sighet:{name:'Sighet',official:'Máramarossziget',lat:47.9281,lon:23.8867,tier:2},
  lugoj:{name:'Lugoj',official:'Lugos',lat:45.6886,lon:21.9031,tier:2},
  dej:{name:'Dej',official:'Dés',lat:47.1417,lon:23.8750,tier:2},
  turda:{name:'Turda',official:'Torda',lat:46.5667,lon:23.7833,tier:2},
  aiud:{name:'Aiud',official:'Nagyenyed',lat:46.3122,lon:23.7292,tier:2},
  teius:{name:'Teiuș',official:'Tövis',lat:46.2000,lon:23.6833,tier:2},
  targuMures:{name:'Târgu Mureș',official:'Marosvásárhely',lat:46.5425,lon:24.5575,tier:2},
  deva:{name:'Deva',official:'Déva',lat:45.8833,lon:22.9000,tier:2},
  orastie:{name:'Orăștie',official:'Szászváros',lat:45.8400,lon:23.2000,tier:2},
  vintu:{name:'Vințu de Jos',official:'Alvinc',lat:45.9906,lon:23.4867,tier:2},
  sebes:{name:'Sebeș',official:'Szászsebes',lat:45.9600,lon:23.5700,tier:2},
  fagaras:{name:'Făgăraș',official:'Fogaras',lat:45.8416,lon:24.9731,tier:2},
  zlatna:{name:'Zlatna',official:'Zalatna',lat:46.1083,lon:23.2250,tier:2},
  abrud:{name:'Abrud',official:'Abrudbánya',lat:46.2750,lon:23.0650,tier:2},
  beius:{name:'Beiuș',official:'Belényes',lat:46.6667,lon:22.3500,tier:2},
  campeni:{name:'Câmpeni',official:'Topánfalva',lat:46.3625,lon:23.0450,tier:3},
  vascau:{name:'Vașcău',official:'Vaskoh',lat:46.4700,lon:22.4700,tier:3},
  somcuta:{name:'Șomcuta Mare',official:'Nagysomkút',lat:47.5200,lon:23.4700,tier:3},
  gherla:{name:'Gherla',official:'Szamosújvár',lat:47.0300,lon:23.9100,tier:3},
  campiaTurzii:{name:'Câmpia Turzii',official:'Aranyosgyéres',lat:46.5480,lon:23.8800,tier:3},
  faget:{name:'Făget',official:'Facset',lat:45.8500,lon:22.1800,tier:3},
  dobra:{name:'Dobra',official:'Dobra',lat:45.9000,lon:22.5700,tier:3},
  lipova:{name:'Lipova',official:'Lippa',lat:46.0900,lon:21.6900,tier:3},
  savarsin:{name:'Săvârșin',official:'Soborsin',lat:46.0100,lon:22.2400,tier:3},
  ilia:{name:'Ilia',official:'Marosillye',lat:45.9300,lon:22.6500,tier:3},
  simeria:{name:'Simeria',official:'Piski',lat:45.8500,lon:23.0100,tier:3},
  miercurea:{name:'Miercurea Sibiului',official:'Szerdahely',lat:45.9000,lon:23.8000,tier:3},
  ocnaSibiului:{name:'Ocna Sibiului',official:'Vízakna',lat:45.8800,lon:24.0600,tier:3},
  avrig:{name:'Avrig',official:'Felek',lat:45.7200,lon:24.3800,tier:3},
  alesd:{name:'Aleșd',official:'Élesd',lat:47.0600,lon:22.4000,tier:3},
  ciucea:{name:'Ciucea',official:'Csucsa',lat:46.9500,lon:22.8200,tier:3},
  huedin:{name:'Huedin',official:'Bánffyhunyad',lat:46.8700,lon:23.0300,tier:3},
};
const townXY=k=>project(TOWNS[k].lat,TOWNS[k].lon);
```

Replace the export line with:

```js
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/geo.test.js`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/geo.js tests/geo.test.js
git commit -m "feat: add 1918 towns with official names to geo.js"
```

---

### Task 3: Rivers, the 1918 border and the four regions

**Files:**
- Modify: `src/geo.js`
- Modify: `tests/geo.test.js`

Outlines are approximate on purpose: they draw historical regions, not administrative
boundaries. The border is the 1918 Austro-Hungarian border with the Kingdom of Romania along
the Carpathians, down to Orșova on the Danube. There are no 1920 or modern borders.

- [ ] **Step 1: Write the failing tests**

Append to `tests/geo.test.js`:

```js
const {RIVERS,BORDER_1918,REGIONS,LABELS}=geo;

// ray casting on [lat, lon] pairs
function inPolygon(lat,lon,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [ai,oi]=poly[i],[aj,oj]=poly[j];
    if((oi>lon)!==(oj>lon)&&lat<(aj-ai)*(lon-oi)/(oj-oi)+ai)inside=!inside;
  }
  return inside;
}
const inside=(k,prov)=>inPolygon(TOWNS[k].lat,TOWNS[k].lon,REGIONS[prov]);

test('each historical region contains its own towns',()=>{
  for(const k of ['baiaMare','sighet'])assert.ok(inside(k,'MM'),k);
  for(const k of ['oradea','arad','beius'])assert.ok(inside(k,'CR'),k);
  for(const k of ['timisoara','lugoj'])assert.ok(inside(k,'BN'),k);
  for(const k of ['cluj','sibiu','brasov','albaIulia','deva','teius'])assert.ok(inside(k,'TR'),k);
});

test('no town belongs to two regions',()=>{
  for(const k of Object.keys(TOWNS)){
    const n=['MM','CR','BN','TR'].filter(p=>inside(k,p)).length;
    assert.ok(n<=1,`${k} is in ${n} regions`);
  }
});

test('rivers and the border stay inside the map',()=>{
  const ok=([lat,lon])=>lat>=BOUNDS.latMin&&lat<=BOUNDS.latMax&&lon>=BOUNDS.lonMin&&lon<=BOUNDS.lonMax;
  for(const r of RIVERS){assert.ok(r.pts.length>=2,r.name);assert.ok(r.pts.every(ok),r.name)}
  assert.ok(BORDER_1918.every(ok));
});

test('the Mureș flows past Alba Iulia and Arad',()=>{
  const m=RIVERS.find(r=>r.name==='Mureș');
  const close=(k)=>m.pts.some(([lat,lon])=>Math.hypot(lat-TOWNS[k].lat,lon-TOWNS[k].lon)<.12);
  assert.ok(close('albaIulia')&&close('arad')&&close('deva'));
});

test('the map names the four regions and the Kingdom of Romania',()=>{
  const names=LABELS.map(l=>l.name);
  for(const n of ['Maramureș','Crișana','Banat','Transilvania','Regatul României'])assert.ok(names.includes(n),n);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/geo.test.js`
Expected: FAIL, `Cannot read properties of undefined`

- [ ] **Step 3: Add the data**

Insert into `src/geo.js` above `/* ---------- export ---------- */`:

```js
/* ---------- rivers ---------- */
// [lat, lon] polylines, simplified; source to the edge of the map
const RIVERS=[
  {name:'Mureș',major:1,pts:[[46.60,25.60],[46.92,25.35],[46.78,24.70],[46.54,24.56],[46.48,24.10],[46.39,23.86],[46.30,23.75],[46.20,23.69],[46.07,23.60],[45.99,23.49],[45.87,23.20],[45.89,22.90],[45.93,22.65],[46.01,22.24],[46.09,21.69],[46.17,21.30],[46.17,21.07],[46.22,20.30]]},
  {name:'Someș',major:1,pts:[[46.77,23.60],[47.03,23.91],[47.14,23.87],[47.26,23.26],[47.47,23.30],[47.79,22.88],[47.95,22.40]]},
  {name:'Olt',major:1,pts:[[46.65,25.81],[45.86,25.79],[45.82,25.60],[45.98,25.28],[45.84,24.97],[45.72,24.38],[45.66,24.26],[45.55,24.28],[45.30,24.30]]},
  {name:'Crișul Repede',pts:[[46.87,23.03],[46.95,22.82],[47.06,22.40],[47.05,21.92],[47.02,21.20],[46.95,20.60]]},
  {name:'Crișul Negru',pts:[[46.67,22.35],[46.77,21.94],[46.80,21.30],[46.75,20.80]]},
  {name:'Crișul Alb',pts:[[46.13,22.79],[46.27,22.34],[46.43,21.84],[46.53,21.52],[46.60,21.00]]},
  {name:'Timiș',pts:[[45.42,22.22],[45.69,21.90],[45.70,21.60],[45.64,21.18],[45.45,20.75]]},
  {name:'Ampoi',pts:[[46.11,23.22],[46.06,23.57]]},
];

/* ---------- border and regions ---------- */
// the 1918 border between Austria-Hungary and the Kingdom of Romania, along the Carpathians to Orșova
const BORDER_1918=[[47.10,25.85],[46.70,26.00],[46.30,26.25],[45.95,26.25],[45.62,26.10],[45.50,25.85],[45.48,25.55],[45.45,25.25],[45.48,24.85],[45.50,24.40],[45.45,24.05],[45.38,23.60],[45.35,23.25],[45.25,22.95],[45.05,22.70],[44.85,22.50],[44.70,22.40]];
// historical regions, approximate outlines; keys match PROV in game.js
const REGIONS={
  MM:[[48.05,22.95],[48.10,24.20],[47.80,24.90],[47.45,24.55],[47.35,23.60],[47.45,22.95]],
  CR:[[47.80,21.95],[47.45,22.95],[46.95,22.80],[46.40,22.75],[46.10,22.35],[46.12,21.60],[46.15,20.75],[46.75,20.75],[47.40,21.30]],
  BN:[[46.15,20.75],[46.12,21.60],[46.10,22.35],[45.80,22.60],[45.40,22.75],[45.25,22.95],[45.05,22.70],[44.85,22.50],[44.70,22.40],[44.62,22.00],[44.80,21.40],[45.20,20.75]],
  TR:[[47.45,22.95],[47.35,23.60],[47.45,24.55],[47.10,25.85],[46.70,26.00],[46.30,26.25],[45.95,26.25],[45.62,26.10],[45.50,25.85],[45.48,25.55],[45.45,25.25],[45.48,24.85],[45.50,24.40],[45.45,24.05],[45.38,23.60],[45.35,23.25],[45.25,22.95],[45.40,22.75],[45.80,22.60],[46.10,22.35],[46.40,22.75],[46.95,22.80]],
};
// big labels: the four regions and the far side of the border
const LABELS=[
  {name:'Maramureș',prov:'MM',lat:47.85,lon:23.95},
  {name:'Crișana',prov:'CR',lat:46.95,lon:21.55},
  {name:'Banat',prov:'BN',lat:45.35,lon:21.60},
  {name:'Transilvania',prov:'TR',lat:46.45,lon:24.70},
  {name:'Regatul României',lat:45.05,lon:24.60},
];
```

Replace the export line with:

```js
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY,RIVERS,BORDER_1918,REGIONS,LABELS};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/geo.test.js`
Expected: `# pass 12`, `# fail 0`

If `each historical region contains its own towns` fails, a polygon vertex was mistyped:
compare the failing town's coordinates with the polygon edges listed above, do not move
the town.

- [ ] **Step 5: Commit**

```bash
git add src/geo.js tests/geo.test.js
git commit -m "feat: add rivers, the 1918 border and historical regions"
```

---

### Task 4: Routes

**Files:**
- Modify: `src/geo.js`
- Modify: `tests/geo.test.js`

Routes are lists of town keys, so every point has a name for the info card and the test.
Rail sides match `PROV[...].rail` in `game.js`: E arrives through Teiuș, W through Vințu de Jos.

- [ ] **Step 1: Write the failing tests**

Append to `tests/geo.test.js`:

```js
const {ROUTES,RAIL_SIDE,JUNCTIONS,routePath}=geo;
const PROVS=['MM','CR','BN','TR'];

test('every route starts in its province and ends at Alba Iulia',()=>{
  const start={MM:{road:'baiaMare',rail:'dej'},CR:{road:'oradea',rail:'oradea'},BN:{road:'timisoara',rail:'timisoara'},TR:{road:'brasov',rail:'brasov'}};
  for(const p of PROVS)for(const kind of ['road','rail']){
    const r=ROUTES[p][kind];
    assert.equal(r[0],start[p][kind],`${p} ${kind}`);
    assert.equal(r[r.length-1],'albaIulia',`${p} ${kind}`);
    for(const k of r)assert.ok(TOWNS[k],`${p} ${kind}: unknown town ${k}`);
  }
});

test('routes have no repeated stops and no jumps across the map',()=>{
  for(const p of PROVS)for(const kind of ['road','rail']){
    const path=routePath(p,kind);
    for(let i=1;i<path.pts.length;i++){
      const seg=path.L[i]-path.L[i-1];
      assert.ok(seg>1&&seg<260,`${p} ${kind} segment ${i}: ${seg.toFixed(0)}`);
    }
  }
});

test('trains reach Alba Iulia through the junction of their line',()=>{
  assert.deepEqual(RAIL_SIDE,{MM:'E',CR:'E',BN:'W',TR:'W'});
  assert.deepEqual(JUNCTIONS,{E:'teius',W:'vintu'});
  for(const p of PROVS){
    const r=ROUTES[p].rail;
    assert.equal(r[r.length-2],JUNCTIONS[RAIL_SIDE[p]],p);
  }
});

test('routePath is projected, cached and ends on Alba Iulia',()=>{
  const a=routePath('BN','rail');
  assert.equal(routePath('BN','rail'),a);
  assert.deepEqual(a.pts[a.pts.length-1],townXY('albaIulia'));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/geo.test.js`
Expected: FAIL, `Cannot read properties of undefined (reading 'MM')`

- [ ] **Step 3: Add the routes**

Insert into `src/geo.js` above `/* ---------- export ---------- */`:

```js
/* ---------- routes ---------- */
// town keys from the province to Alba Iulia; the city path in game.js takes over there
const ROUTES={
  MM:{road:['baiaMare','somcuta','dej','gherla','cluj','turda','aiud','teius','albaIulia'],
      rail:['dej','gherla','cluj','campiaTurzii','aiud','teius','albaIulia']},
  CR:{road:['oradea','beius','vascau','campeni','abrud','zlatna','albaIulia'],
      rail:['oradea','alesd','ciucea','huedin','cluj','campiaTurzii','aiud','teius','albaIulia']},
  BN:{road:['timisoara','lugoj','faget','dobra','deva','orastie','vintu','albaIulia'],
      rail:['timisoara','arad','lipova','savarsin','ilia','deva','simeria','orastie','vintu','albaIulia']},
  TR:{road:['brasov','fagaras','avrig','sibiu','miercurea','sebes','albaIulia'],
      rail:['brasov','fagaras','avrig','sibiu','ocnaSibiului','miercurea','sebes','vintu','albaIulia']},
};
// same split as PROV[...].rail in game.js: one train per line at a time
const RAIL_SIDE={MM:'E',CR:'E',BN:'W',TR:'W'};
const JUNCTIONS={E:'teius',W:'vintu'};
const pathCache={};
function routePath(prov,kind){
  const key=prov+':'+kind;
  return pathCache[key]||(pathCache[key]=core.mkPath(ROUTES[prov][kind].map(townXY)));
}
```

Replace the export line with:

```js
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,RAIL_SIDE,JUNCTIONS,routePath};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/geo.test.js`
Expected: `# pass 16`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/geo.js tests/geo.test.js
git commit -m "feat: add 1918 road and rail routes per province"
```

---

### Task 5: Regional speeds and travel times

**Files:**
- Modify: `src/geo.js`
- Modify: `tests/geo.test.js`

Measured lengths (region units): roads about 760–890, railways 606–1031. With the speeds below
and the moral factor used in `game.js` (`spd = .7 + moral/250`, 0.98 at 70 moral), roads take
24–29 s and railways 14–24 s.

- [ ] **Step 1: Write the failing tests**

Append to `tests/geo.test.js`:

```js
const {SPEED,regionTime}=geo;
const SPD70=.7+70/250; // same moral factor as game.js

test('regional segments take 15–30 s by road and 10–25 s by rail at 70 moral',()=>{
  for(const p of PROVS){
    const road=regionTime(p,'road',SPD70),rail=regionTime(p,'rail',SPD70);
    assert.ok(road>=15&&road<=30,`${p} road ${road.toFixed(1)} s`);
    assert.ok(rail>=10&&rail<=25,`${p} rail ${rail.toFixed(1)} s`);
  }
});

test('trains are faster than carts on the region',()=>{
  assert.ok(SPEED.rail>SPEED.road);
});

test('higher moral means a shorter journey',()=>{
  assert.ok(regionTime('MM','road',.7+100/250)<regionTime('MM','road',SPD70));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/geo.test.js`
Expected: FAIL, `regionTime is not a function`

- [ ] **Step 3: Add speeds**

Insert into `src/geo.js` above `/* ---------- export ---------- */`:

```js
/* ---------- speeds ---------- */
// region units per real second at spd = 1; game.js multiplies by its moral factor
const SPEED={road:32,rail:45};
function regionTime(prov,kind,spd){return routePath(prov,kind).len/(SPEED[kind]*spd)}
```

Replace the export line with:

```js
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,RAIL_SIDE,JUNCTIONS,routePath,SPEED,regionTime};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/geo.test.js`
Expected: `# pass 19`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/geo.js tests/geo.test.js
git commit -m "feat: add regional speeds and travel times"
```

---

### Task 6: Event places

**Files:**
- Modify: `src/geo.js`
- Modify: `tests/geo.test.js`

Keys match `EVENTS[].id` in `game.js`. `on` lists the routes the place lies on. Which units
stop is still decided by `EVENTS[].target` in `game.js` (`road:CR`, `rail:E`…); PR 4 turns a
place into a stopping distance on each affected route, or the line's junction when the route
does not pass the place. `overfull` is a marker only. `bridgeTR` stays in the city and is
not listed.

- [ ] **Step 1: Write the failing tests**

Append to `tests/geo.test.js`:

```js
const {EVENT_PLACES,placeXY,distToPath}=geo;

test('distToPath measures the distance from a point to a polyline',()=>{
  assert.equal(distToPath(5,3,[[0,0],[10,0]]),3);
  assert.equal(distToPath(-4,3,[[0,0],[10,0]]),5);
});

test('each located event lies on every route listed for it',()=>{
  for(const [id,pl] of Object.entries(EVENT_PLACES)){
    const [x,y]=placeXY(id);
    for(const r of pl.on){
      const [prov,kind]=r.split(':');
      const d=distToPath(x,y,routePath(prov,kind).pts);
      assert.ok(d<3,`${id} is ${d.toFixed(1)} units off ${r}`);
    }
  }
});

test('the located events are the ones the spec places on the region',()=>{
  assert.deepEqual(Object.keys(EVENT_PLACES).sort(),['coalE','gardaW','jamBN','overfull','snowMM']);
  assert.deepEqual(EVENT_PLACES.coalE.on.slice().sort(),['CR:rail','MM:rail']);
  assert.equal(EVENT_PLACES.coalE.town,'teius');
  assert.equal(EVENT_PLACES.gardaW.town,'deva');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/geo.test.js`
Expected: FAIL, `distToPath is not a function`

- [ ] **Step 3: Add the places and the distance helper**

Insert into `src/geo.js` above `/* ---------- export ---------- */`:

```js
/* ---------- located events ---------- */
// keys match EVENTS[].id in game.js; on: the routes ("PROV:kind") the place lies on
const EVENT_PLACES={
  snowMM:{name:'Munții Apuseni',lat:46.3188,lon:23.0550,on:['CR:road']},
  coalE:{town:'teius',on:['MM:rail','CR:rail']},
  gardaW:{town:'deva',on:['BN:rail']},
  jamBN:{name:'drumul dinspre Vințu',lat:45.9153,lon:23.3434,on:['BN:road']},
  overfull:{town:'arad',on:['BN:rail']},
};
function placeXY(id){const pl=EVENT_PLACES[id];return pl.town?townXY(pl.town):project(pl.lat,pl.lon)}
function distToPath(x,y,pts){
  let m=Infinity;
  for(let i=1;i<pts.length;i++){
    const [ax,ay]=pts[i-1],[bx,by]=pts[i],dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy||1;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l));
    m=Math.min(m,Math.hypot(x-(ax+dx*t),y-(ay+dy*t)));
  }
  return m;
}
```

Replace the export line with:

```js
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,RAIL_SIDE,JUNCTIONS,routePath,SPEED,regionTime,EVENT_PLACES,placeXY,distToPath};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/geo.test.js`
Expected: `# pass 22`, `# fail 0`

`snowMM` sits halfway between Câmpeni and Abrud and `jamBN` halfway between Orăștie and
Vințu de Jos, so both lie exactly on their route segment.

- [ ] **Step 5: Commit**

```bash
git add src/geo.js tests/geo.test.js
git commit -m "feat: place the regional events on their routes"
```

---

### Task 7: Load it, document it, preflight

**Files:**
- Modify: `index.html` (script list at the end of `<body>`)
- Modify: `CLAUDE.md` (Structură and „De verificat cu un istoric")

- [ ] **Step 1: Load geo.js after core.js**

In `index.html`, change:

```html
<script src="src/core.js"></script>
<script src="src/save.js"></script>
```

to:

```html
<script src="src/core.js"></script>
<script src="src/geo.js"></script>
<script src="src/save.js"></script>
```

- [ ] **Step 2: Document it in CLAUDE.md**

Under `## Structură`, after the `src/core.js` line, add:

```markdown
- `src/geo.js`: datele hărții regiunii la 30 noiembrie 1918, în coordonate reale (lat/lon): orașele cu numele oficial din 1918, râurile, granița cu Regatul României, conturul aproximativ al celor patru provincii istorice, drumurile și căile ferate pe provincii, vitezele pe regiune și locurile evenimentelor. `project(lat, lon)` le pune pe o lume de 2000×1740 de unități. Pregătește harta regiunii (spec: `docs/superpowers/specs/2026-09-30-region-map-design.md`); în jocul actual nu e încă folosit.
```

Under `### De verificat cu un istoric (de exemplu Muzeul Național al Unirii)`, add:

```markdown
- Liniile de cale ferată din `geo.js` și dacă erau deschise în 1918 (mai ales Dej–Baia Mare, Sibiu–Vințu de Jos, Brașov–Făgăraș–Sibiu, Oradea–Cluj). Deocamdată delegații din Maramureș iau trenul de la Dej.
- Contururile provinciilor istorice din `geo.js`, care sunt aproximative.
- Numele oficiale din 1918 ale orașelor (`official` în `geo.js`).
```

- [ ] **Step 3: Run the full preflight**

```bash
npm test
npm run lint
npm run build
```

Expected: `# pass 62`, `# fail 0` (40 existing + 22 new); lint prints nothing after the
command line; build prints `6 scripts` and about `1.04 MB`.

- [ ] **Step 4: Check the game still loads with no errors**

Start the dev server (`npx serve . -l 3000`, or the `game` entry in `.claude/launch.json`),
open http://localhost:3000, and confirm in the console: no errors, and
`Object.keys(DSU)` lists `core`, `geo`, `save`, `audio`, `cinematic`.

- [ ] **Step 5: Commit**

```bash
git add index.html CLAUDE.md
git commit -m "docs: describe geo.js and its historical caveats"
```

- [ ] **Step 6: Push and open the PR only after Lucian approves in chat**

```bash
git push -u origin feature/region-geo
gh pr create --base main --title "feat: add geo.js data for the regional map" --body-file <body>
```
