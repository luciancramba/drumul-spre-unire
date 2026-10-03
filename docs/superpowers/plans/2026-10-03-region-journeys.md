# Region map, PR 4: journeys and located events on the region — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delegations and trains cross the regional map on their real routes before they reach Alba Iulia, events happen at their places on it and stop the units on that route, and the „Regiune / Oraș" button shows a dot when something happens on the level the player is not looking at.

**Architecture:** `geo.js` gets the pure journey rules (speeds with the Guards' bonus, where a blocked unit stops, one step along a route). `region.js` draws what `game.js` hands it: carts and trains along their routes, placed blocks and guarded routes. `game.js` keeps a cart on the region as an entry in `S.convoys` and a train as an `S.trains` entry in a new `'region'` state; both move in `update`, stop short of a block placed on their route, and at Alba Iulia become what the city already spawns (the cart and its 24 walkers, or the train at `d = 0`). `portal.js` remembers where something happened while the player looked elsewhere (`attention`), and the button shows it as a dot.

**Tech Stack:** Plain ES2020 classic scripts, Canvas 2D, `node:test` + `node:assert/strict`, ESLint 9 flat config. No new dependencies.

Spec: `docs/superpowers/specs/2026-09-30-region-map-design.md`, sections 3, 4, 5 and 6.4. PR 3 (`portal.js`, the start on the region, the flight) is merged; this plan builds on `DSU.portal`, `R.home()` and `stepLevel`.

## Decisions in this PR

- **Two segments, one hand-off.** A delegation is one marker on the region (a cart with a tricolour, the delegate count under it): an entry `{prov, n, d, people}` in `S.convoys`, with `d` the distance along the province's road in `geo.js`. When `d` reaches the end of the route, `spawnConvoy` does exactly what `sendDelegation` did before: a cart plus 24 walkers at the start of the city road. The city code for walking, unloading and settling is not touched.
- **A train keeps its place in `S.trains`.** It starts in a new state `'region'` with `rd` (distance on the regional route), then becomes `'run'` with `d = 0` on `railW` / `railE`. So „linia ocupată" (one train per line at a time) keeps working across both segments with no change to the two checks that read `S.trains`.
- **Blocks remember their event.** `S.blocks[key]` gets `id: ev.id`. `geo.stopDistance(id, prov, kind)` says where a unit on that route stops: `STOP_GAP = 22` region units before the place of the event; at the line's junction (Vințu or Teiuș) when a railway does not pass the place (a Transilvania train for the Deva event); never when the event has no place on the region. `geo.advance` holds a unit at that stop, but lets a unit that is already past it go on.
- **Only one event stays in the city.** The bridge over the Ampoi (`bridgeTR`, key `road:MM`) has no place in `EVENT_PLACES`, so `cityBlocked(key)` is true for it alone: Maramureș carts are not held on the region, but wait at 4–24 % of the city road, as before. For every other key the old 4–24 % stretch and the 80 % of the train line no longer hold anybody, and their markers are drawn on the region only.
- **A marker only for `overfull`.** The crowded-station event has no target, so it blocks nothing: `S.marks.overfull` shows a marker at Arad for 20 s (it gets a short name, `aglomerat`).
- **The movement runs in `update`, not in `R.draw`.** After a dive `R.draw` does not run while the city is shown and `R.cam` stays at the flight's close-up; the carts and trains still move, and the region just draws them when it is shown again.
- **Guards help on the region too.** `geo.regionSpeed(kind, spd, guarded)` is `SPEED[kind] · spd`, times 1.4 for carts and 92/70 for trains on a guarded route, the same as in the city. Guarded routes glow blue on the region.
- **The deadline.** Carts still on the region at 10:00 join the crowd with their 2.400 people, as the walkers on the city road did. Trains still travelling count for nothing, as before.
- **The dot.** `portal.notify(level)` records `attention` when something happens on a level the player is not heading to; `portal.go` clears it for the level the player goes to. `game.js` notifies `'city'` when a cart or a train reaches the city, and `'region'` when an event with a place on the region appears. The dot sits in the corner of the button, so showing it moves nothing, and the button's `aria-label` says that something happened there.
- **Balance is not settled here.** Every journey now takes the regional segment (about 24–29 s by road and 14–24 s by rail at 70 moral, `geo.regionTime`) on top of the city segment, which is unchanged, and the game still ends at 10:00. Expect fewer deliveries per game than before. The one knob is `SPEED` in `geo.js` (the tests keep road times in 15–30 s and rail times in 10–25 s). Lucian plays it a few times before anything is tuned.
- **Not in this PR:** tapping a cart or a block marker, and the painted background (PR 5).

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/geo.js` | modify | `regionSpeed`, `STOP_GAP`, `alongPath`, `stopDistance`, `advance` |
| `tests/geo.test.js` | modify | Speeds, where a unit stops, advancing |
| `src/portal.js` | modify | `attention` and `notify` |
| `tests/portal.test.js` | modify | The mark and who clears it |
| `src/region.js` | modify | `draw` takes `units`, `blocks`, `guards`; `unitWorld` |
| `tests/region.test.js` | modify | Units on their routes, journeys drawn |
| `src/game.js` | modify | Convoys and trains on the region, city blocks, markers, the dot |
| `index.html` | modify | A dot element in the level button |
| `src/style.css` | modify | The dot in the corner of the button |
| `CLAUDE.md` | modify | Describe journeys, stops and the dot |

---

### Task 1: Branch and journey rules in geo.js

**Files:**
- Modify: `src/geo.js`
- Modify: `tests/geo.test.js`

- [ ] **Step 1: Create the branch from main**

```bash
git switch main && git pull --ff-only origin main
git switch -c feature/region-journeys
```

(In a worktree where `main` is checked out elsewhere: `git fetch origin && git switch -c feature/region-journeys origin/main`.)

- [ ] **Step 2: Write the failing tests**

**1. tests.** Append to `tests/geo.test.js`, after one blank line:

```js
const {GUARD_BOOST,regionSpeed,STOP_GAP,alongPath,stopDistance,advance}=geo;
const idx=(prov,kind,town)=>ROUTES[prov][kind].indexOf(town);

test('regionSpeed matches regionTime, and guards speed units up',()=>{
  for(const p of PROVS)for(const kind of ['road','rail'])
    assert.ok(near(routePath(p,kind).len/regionSpeed(kind,SPD70,false),regionTime(p,kind,SPD70)),`${p} ${kind}`);
  assert.equal(regionSpeed('road',1,true),SPEED.road*1.4);
  assert.ok(near(regionSpeed('rail',1,true),SPEED.rail*92/70));
  assert.equal(GUARD_BOOST.road,1.4);
});

test('alongPath measures where on a route the closest point is',()=>{
  const path=geo.routePath('BN','rail');
  assert.ok(near(alongPath(path,...townXY('arad')),path.L[idx('BN','rail','arad')],1e-6));
  assert.equal(alongPath(path,...townXY('timisoara')),0);
  assert.ok(near(alongPath(path,...townXY('albaIulia')),path.len,1e-6));
  // a point beside the route projects onto it
  const [x,y]=townXY('deva');assert.ok(near(alongPath(path,x,y-30),path.L[idx('BN','rail','deva')],40));
});

test('units stop just before the place of an event on their own route',()=>{
  const at=(prov,kind,town)=>routePath(prov,kind).L[idx(prov,kind,town)];
  assert.ok(near(stopDistance('coalE','MM','rail'),at('MM','rail','teius')-STOP_GAP,1e-6));
  assert.ok(near(stopDistance('coalE','CR','rail'),at('CR','rail','teius')-STOP_GAP,1e-6));
  assert.ok(near(stopDistance('gardaW','BN','rail'),at('BN','rail','deva')-STOP_GAP,1e-6));
  // between two towns: the stop is STOP_GAP before the place, and on the stretch that leads to it
  const snow=stopDistance('snowMM','CR','road'),snowAt=alongPath(routePath('CR','road'),...geo.placeXY('snowMM'));
  assert.ok(near(snow,snowAt-STOP_GAP,1e-6)&&snowAt>at('CR','road','campeni')&&snowAt<at('CR','road','abrud'));
  assert.ok(snow>at('CR','road','vascau'));
  const jam=stopDistance('jamBN','BN','road'),jamAt=alongPath(routePath('BN','road'),...geo.placeXY('jamBN'));
  assert.ok(near(jam,jamAt-STOP_GAP,1e-6)&&jamAt>at('BN','road','orastie')&&jamAt<at('BN','road','vintu'));
  assert.ok(jam>at('BN','road','orastie'));
});

test('a train whose line does not pass the place stops at the junction of the line',()=>{
  const tr=routePath('TR','rail');
  assert.ok(near(stopDistance('gardaW','TR','rail'),tr.L[idx('TR','rail','vintu')]-STOP_GAP,1e-6));
  assert.ok(stopDistance('gardaW','TR','rail')<tr.len);
});

test('events without a place on the region, or off the unit\'s route, never stop it',()=>{
  assert.equal(stopDistance('bridgeTR','MM','road'),Infinity);
  assert.equal(stopDistance('rumor','TR','road'),Infinity);
  assert.equal(stopDistance('snowMM','MM','road'),Infinity);
  assert.equal(stopDistance('jamBN','TR','road'),Infinity);
});

test('every located event stops each of its routes strictly inside the route',()=>{
  for(const [id,pl] of Object.entries(EVENT_PLACES))for(const r of pl.on){
    const [prov,kind]=r.split(':'),s=stopDistance(id,prov,kind);
    assert.ok(s>0&&s<routePath(prov,kind).len,`${id} on ${r}: ${s}`);
  }
});

test('advance holds a unit at its stop, but not one that is already past it',()=>{
  assert.equal(advance(10,5),15);
  assert.equal(advance(10,5,12),12);   // held at the stop
  assert.equal(advance(12,5,12),12);   // waits there
  assert.equal(advance(13,5,12),18);   // already past it
  assert.equal(advance(12,5,Infinity),17); // the block is gone
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `node --test tests/geo.test.js`
Expected: `# pass 22`, `# fail 7` (the new tests fail with `regionSpeed is not a function` and the like)

- [ ] **Step 4: Add the rules**

**1. regionSpeed.** In `src/geo.js`, change:

```js
function regionTime(prov,kind,spd){return routePath(prov,kind).len/(SPEED[kind]*spd)}
```

to:

```js
function regionTime(prov,kind,spd){return routePath(prov,kind).len/(SPEED[kind]*spd)}
// the National Guards speed units up on a guarded route, as they do in the city (carts ×1.4, trains 92 instead of 70)
const GUARD_BOOST={road:1.4,rail:92/70};
function regionSpeed(kind,spd,guarded){return SPEED[kind]*spd*(guarded?GUARD_BOOST[kind]:1)}
```

**2. stops and export.** In `src/geo.js`, change:

```js
/* ---------- export ---------- */
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,RAIL_SIDE,JUNCTIONS,routePath,SPEED,regionTime,EVENT_PLACES,placeXY,distToPath};
```

to:

```js
/* ---------- stops ---------- */
const STOP_GAP=22; // a blocked unit waits this far before the place of the event, in region units
// distance along a mkPath polyline of the point closest to (x, y)
function alongPath(path,x,y){
  let best=Infinity,at=0;
  for(let i=1;i<path.pts.length;i++){
    const [ax,ay]=path.pts[i-1],[bx,by]=path.pts[i],dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy||1;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l)),d=Math.hypot(x-(ax+dx*t),y-(ay+dy*t));
    if(d<best){best=d;at=path.L[i-1]+t*Math.sqrt(l)}
  }
  return at;
}
// where a unit on prov:kind stops for the event id: just before its place; at the junction of the line when a railway
// does not pass it; Infinity when the event has no place on the region (it stays in the city)
function stopDistance(id,prov,kind){
  const pl=EVENT_PLACES[id];if(!pl)return Infinity;
  const path=routePath(prov,kind);
  if(pl.on.includes(prov+':'+kind)){const [x,y]=placeXY(id);return Math.max(0,alongPath(path,x,y)-STOP_GAP)}
  if(kind==='rail')return path.L[ROUTES[prov].rail.indexOf(JUNCTIONS[RAIL_SIDE[prov]])]-STOP_GAP;
  return Infinity;
}
// one step along a route: a unit before its stop cannot pass it, one already past it is not held back
function advance(d,step,stop=Infinity){return d<=stop?Math.min(d+step,stop):d+step}

/* ---------- export ---------- */
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,RAIL_SIDE,JUNCTIONS,routePath,SPEED,regionTime,GUARD_BOOST,regionSpeed,EVENT_PLACES,placeXY,distToPath,STOP_GAP,alongPath,stopDistance,advance};
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test tests/geo.test.js && npx eslint src/geo.js tests/geo.test.js`
Expected: `# pass 29`, `# fail 0`, then no ESLint output

- [ ] **Step 6: Commit**

```bash
git add src/geo.js tests/geo.test.js
git commit -m "feat: add the region journey rules to geo.js"
```

---

### Task 2: The attention mark in portal.js

**Files:**
- Modify: `src/portal.js`
- Modify: `tests/portal.test.js`

- [ ] **Step 1: Write the failing tests**

**1. tests.** Append to `tests/portal.test.js`, after one blank line:

```js
test('something that happens on the level you are not looking at leaves a mark until you go there',()=>{
  const p=create();
  assert.equal(p.attention,null);
  assert.equal(p.notify('region'),false);assert.equal(p.attention,null); // already looking at it
  assert.equal(p.notify('city'),true);assert.equal(p.attention,'city');
  p.go('city');assert.equal(p.attention,null);
});

test('the mark follows where the player is going, not where they are',()=>{
  const p=create();p.go('city');p.update(.1);
  assert.equal(p.notify('city'),false);   // heading there
  assert.equal(p.notify('region'),true);  // leaving it behind
  fly(p,FLIGHT);
  assert.equal(p.level,'city');assert.equal(p.attention,'region');
  p.go('region');assert.equal(p.attention,null);
});

test('a new game clears the mark',()=>{
  const p=create();p.notify('city');p.reset('region');
  assert.equal(p.attention,null);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/portal.test.js`
Expected: `# pass 16`, `# fail 3`

- [ ] **Step 3: Add the mark**

**1. attention field.** In `src/portal.js`, change:

```js
  const p={u:level==='city'?1:0,dir:0,push:0,
```

to:

```js
  const p={u:level==='city'?1:0,dir:0,push:0,attention:null, // attention: the level where something happened while the player looked elsewhere
```

**2. notify.** In `src/portal.js`, change:

```js
    reset(l){p.u=l==='city'?1:0;p.dir=0;p.push=0},
```

to:

```js
    reset(l){p.u=l==='city'?1:0;p.dir=0;p.push=0;p.attention=null},
    // something happened on this level; true when the player is not looking at it (the button shows a dot)
    notify(lv){if(lv===p.target)return false;p.attention=lv;return true},
```

**3. go clears it.** In `src/portal.js`, change:

```js
p.dir=d;p.push=0;return true},
```

to:

```js
p.dir=d;p.push=0;if(p.attention===to)p.attention=null;return true},
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/portal.test.js && npx eslint src/portal.js tests/portal.test.js`
Expected: `# pass 19`, `# fail 0`, then no ESLint output

- [ ] **Step 5: Commit**

```bash
git add src/portal.js tests/portal.test.js
git commit -m "feat: add the attention mark to portal.js"
```

---

### Task 3: Draw the journeys on the region

**Files:**
- Modify: `src/region.js`
- Modify: `tests/region.test.js`

`draw` gets three new options, all optional (so every existing call keeps working): `units` (`{kind: 'cart' | 'train', prov, d, n}`, with `d` the distance along that province's road or rail route in `geo.js`), `blocks` (`{id, label}`, an event id from `EVENT_PLACES`) and `guards` (`{prov, kind}`). The positions come from `geo`, so `game.js` passes distances, not coordinates. Glyphs are sized in screen pixels, like the lines, so they read at every zoom. A train's smoke is four puffs left behind along the line, which needs no state.

- [ ] **Step 1: Write the failing tests**

**1. tests.** Append to `tests/region.test.js`, after one blank line:

```js
test('units sit on their own route, and a unit that went past the end stays on Alba Iulia',()=>{
  const start=region.unitWorld({kind:'cart',prov:'BN',d:0}),[tx,ty]=geo.townXY('timisoara');
  assert.ok(near(start.x,tx)&&near(start.y,ty));
  const end=region.unitWorld({kind:'train',prov:'TR',d:1e6}),[ax,ay]=geo.townXY('albaIulia');
  assert.ok(near(end.x,ax)&&near(end.y,ay));
  const mid=region.unitWorld({kind:'train',prov:'MM',d:geo.routePath('MM','rail').len/2});
  assert.ok(geo.distToPath(mid.x,mid.y,geo.routePath('MM','rail').pts)<1e-6);
});

test('carts, trains, blocks and guards are drawn with their numbers and labels',()=>{
  const texts=[],g=fakeCtx();g.fillText=function(t){texts.push(t)};
  region.init({cols:{MM:'#5b86d6',CR:'#e2b21f',BN:'#d4574c',TR:'#7fb069'},makeCanvas:()=>({getContext:fakeCtx})});
  resize(1440,900);cam.z=cam.minZ;cam.x=RW/2;cam.y=RH/2;
  region.draw(g,{sel:'BN',clock:2,
    units:[{kind:'cart',prov:'BN',d:300,n:30},{kind:'train',prov:'TR',d:400,n:120}],
    blocks:[{id:'snowMM',label:'viscol'}],guards:[{prov:'CR',kind:'road'},{prov:'MM',kind:'rail'}]});
  for(const t of ['30','120','viscol'])assert.ok(texts.includes(t),`${t} in ${texts}`);
  // the same frame without journeys draws none of them
  const bare=[],g2=fakeCtx();g2.fillText=function(t){bare.push(t)};
  region.draw(g2,{sel:'BN'});
  assert.ok(!bare.includes('30')&&!bare.includes('120')&&!bare.includes('viscol'));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/region.test.js`
Expected: `# pass 11`, `# fail 2`

- [ ] **Step 3: Add the drawing**

**1. header.** In `src/region.js`, change:

```js
   atingerile (hit) și textul fișelor (info). Coordonatele vin din DSU.geo.
```

to:

```js
   atingerile (hit) și textul fișelor (info), plus drumurile în curs: căruțele, trenurile, blocajele și gărzile.
   Coordonatele vin din DSU.geo.
```

**2. at.** In `src/region.js`, change:

```js
const {clamp}=core;
```

to:

```js
const {clamp,at}=core;
```

**3. draw signature.** In `src/region.js`, change:

```js
// sel: the selected province key or null; clock: seconds, animates the dashes
function draw(g,{sel=null,clock=0}={}){
```

to:

```js
// sel: the selected province key or null; clock: seconds, animates the dashes
// units: {kind:'cart'|'train', prov, d, n}, with d the distance along that province's road or rail route
// blocks: {id, label} for events placed on the region; guards: {prov, kind} for guarded routes
function draw(g,{sel=null,clock=0,units=[],blocks=[],guards=[]}={}){
```

**4. guards.** In `src/region.js`, change:

```js
  if(sel)for(const kind of ['road','rail'])line(g,routePath(sel,kind).pts,
```

to:

```js
  for(const gd of guards)line(g,routePath(gd.prov,gd.kind).pts,11*px,`rgba(80,130,220,${.28+Math.sin(clock*4)*.1})`);
  if(sel)for(const kind of ['road','rail'])line(g,routePath(sel,kind).pts,
```

**5. journeys.** In `src/region.js`, change:

```js
  g.restore();
  labels(g);
}
```

to:

```js
  g.restore();
  labels(g);
  journeys(g,units,blocks,clock);
}

/* ---------- journeys ---------- */
const routeKind=u=>u.kind==='train'?'rail':'road';
// where a unit is on the world of the region
function unitWorld(u){return at(routePath(u.prov,routeKind(u)),u.d)}
function badge(g,x,y,text,col){
  g.font='700 12px "Alegreya Sans",sans-serif';g.textAlign='center';g.textBaseline='middle';
  const w=g.measureText(text).width+14;
  g.fillStyle='rgba(24,19,13,.9)';g.fillRect(x-w/2,y-8,w,16);g.fillStyle=col;g.fillRect(x-w/2,y-8,4,16);
  g.fillStyle='#ecdfc2';g.fillText(text,x+2,y+.5);
}
// a cart with a tricolour, 18 px wide, facing the way it goes
function cartGlyph(g,x,y,dir){
  g.save();g.translate(x,y);g.scale(dir,1);
  g.fillStyle='rgba(30,22,14,.3)';g.beginPath();g.ellipse(0,5,11,2.5,0,0,7);g.fill();
  g.fillStyle='#4a3322';g.fillRect(-9,-6,18,8);
  g.fillStyle='#e6dfcf';g.beginPath();g.moveTo(-9,-6);g.quadraticCurveTo(0,-15,9,-6);g.fill();
  g.fillStyle='#2a211a';g.beginPath();g.arc(-5,3,3,0,7);g.arc(5,3,3,0,7);g.fill();
  g.fillStyle='#3a2c1e';g.fillRect(9,-17,1.2,13);
  g.fillStyle='#2c4d9c';g.fillRect(10.2,-17,3,3.6);g.fillStyle='#e2b21f';g.fillRect(10.2,-13.4,3,3.6);g.fillStyle='#b3302a';g.fillRect(10.2,-9.8,3,3.6);
  g.restore();
}
// a small locomotive; the smoke is four puffs left behind along the line, so it needs no state
function trainGlyph(g,x,y,dir,u,clock){
  const path=routePath(u.prov,'rail');
  for(let i=4;i>=1;i--){const q=at(path,u.d-i*14),[px,py]=toScreen(q.x,q.y);
    g.fillStyle=`rgba(70,66,62,${.46-i*.08})`;g.beginPath();g.arc(px+Math.sin(clock*5+i)*1.5,py-9-i*3,2.4+i*1.1,0,7);g.fill()}
  g.save();g.translate(x,y);g.scale(dir,1);
  g.fillStyle='rgba(30,22,14,.3)';g.fillRect(-12,4,24,2.5);
  g.fillStyle='#1c1a18';g.fillRect(-12,-6,24,10);g.fillStyle='#2b2724';g.fillRect(-12,-6,8,10);
  g.fillStyle='#7a2a20';g.fillRect(-12,3,24,1.6);g.fillStyle='#111';g.fillRect(5,-10,4,5);
  g.fillStyle='#e8d9a0';g.fillRect(-9,-4,3,3);
  g.restore();
}
// markers of events placed on the region: a red disc with a cross and the short name of the event
function blockMarker(g,id,label){
  const [x,y]=toScreen(...placeXY(id));
  g.fillStyle='rgba(179,48,42,.94)';g.beginPath();g.arc(x,y-12,9,0,7);g.fill();
  g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.moveTo(x-4,y-16);g.lineTo(x+4,y-8);g.moveTo(x+4,y-16);g.lineTo(x-4,y-8);g.stroke();
  g.font='700 11.5px "Cormorant SC",Georgia,serif';g.textAlign='center';g.textBaseline='middle';
  const w=g.measureText(label).width+12;
  g.fillStyle='rgba(24,19,13,.85)';g.fillRect(x-w/2,y-42,w,16);g.fillStyle='#ecdfc2';g.fillText(label,x,y-33.5);
}
function journeys(g,units,blocks,clock){
  g.save();
  for(const b of blocks)blockMarker(g,b.id,b.label);
  for(const u of units){
    const q=unitWorld(u),[x,y]=toScreen(q.x,q.y),dir=Math.cos(q.ang)>=0?1:-1;
    if(x<-60||x>vw+60||y<-60||y>vh+60)continue;
    if(u.kind==='train')trainGlyph(g,x,y,dir,u,clock);else cartGlyph(g,x,y,dir);
    badge(g,x,y+17,String(u.n),cols[u.prov]);
  }
  g.restore();
}
```

**6. placeXY.** In `src/region.js`, change:

```js
const {TOWNS,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,project,townXY,routePath}=geo;
```

to:

```js
const {TOWNS,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,project,townXY,routePath,placeXY}=geo;
```

**7. export.** In `src/region.js`, change:

```js
const region={cam,resize,pan,zoomAt,home,toScreen,MAXK,ROADS,RAILS,init,draw,visibleTowns,TIER2,hit,info};
```

to:

```js
const region={cam,resize,pan,zoomAt,home,toScreen,MAXK,ROADS,RAILS,init,draw,visibleTowns,TIER2,hit,info,unitWorld};
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/region.test.js && npx eslint src/region.js tests/region.test.js`
Expected: `# pass 13`, `# fail 0`, then no ESLint output

- [ ] **Step 5: Commit**

```bash
git add src/region.js tests/region.test.js
git commit -m "feat: draw carts, trains, blocks and guards on the region"
```

---

### Task 4: Journeys cross the region first

**Files:**
- Modify: `src/game.js` (17 edits, listed below)

This is game glue; it is checked in the browser in Task 6. Every "change X to Y" replaces text that appears exactly once in the file, and the edits are independent of each other, so they can be made in any order. The replaced text ends at the line break when the shown text does: keep the line break.

- [ ] **Step 1: Make the edits**

**1. Read the geo helpers.** In `src/game.js`, change:

```js
const save=DSU.save,audio=DSU.audio,R=DSU.region;
```

to:

```js
const save=DSU.save,audio=DSU.audio,R=DSU.region;
const {routePath,EVENT_PLACES,regionSpeed,stopDistance,advance}=DSU.geo;
```

**2. New state: carts on the region.** In `src/game.js`, change:

```js
    walkers:[],trains:[],blocks:{},guards:{},
```

to:

```js
    walkers:[],trains:[],convoys:[],blocks:{},guards:{},
```

**3. Block helpers.** In `src/game.js`, change:

```js
function isGuarded(k){return (S.guards[k]||0)>rt}
```

to:

```js
function isGuarded(k){return (S.guards[k]||0)>rt}
// the stop distance of a unit on prov:kind for the block under this key, or Infinity when nothing holds it on the region
function blockStop(key,prov,kind){const b=S.blocks[key];return b?stopDistance(b.id,prov,kind):Infinity}
// blocks that hold units in the city: the events that have no place on the region (the bridge over the Ampoi)
function cityBlocked(k){const b=S.blocks[k];return !!b&&!EVENT_PLACES[b.id]}
```

**4. spawnConvoy.** In `src/game.js`, change:

```js
/* ---------- actions ---------- */
function remaining(p){return PROV[p].quota-S.sent[p]}
```

to:

```js
/* ---------- actions ---------- */
const CONVOY=24; // walkers (100 people each) that follow a cart once it reaches the city
// what the city sees when a delegation reaches Alba Iulia: a cart and its crowd at the start of the city road
function spawnConvoy(p,n){
  const path=P[PROV[p].road],key=blockKeyRoad(p);
  addWalker(path,{kind:'cart',d:0,lat:0,sp:20,del:n,people:0,prov:p,block:key});
  for(let i=0;i<CONVOY;i++)addWalker(path,{d:-8-i*7-Math.random()*4,prov:p,block:key,people:100,flag:Math.random()<.14});
}
function remaining(p){return PROV[p].quota-S.sent[p]}
```

**5. sendDelegation sends a cart on the region.** In `src/game.js`, change:

```js
  const path=P[pr.road],key=blockKeyRoad(p);
  addWalker(path,{kind:'cart',d:0,lat:0,sp:20,del:n,people:0,prov:p,block:key});
  const k=24;for(let i=0;i<k;i++)addWalker(path,{d:-8-i*7-Math.random()*4,prov:p,block:key,people:100,flag:Math.random()<.14});
```

to:

```js
  S.convoys.push({prov:p,n,d:0,people:CONVOY*100}); // it travels the region first; spawnConvoy takes over at Alba Iulia
```

**6. organizeTrain starts on the region.** In `src/game.js`, change:

```js
  S.trains.push({side,path:side==='W'?P.railW:P.railE,d:0,state:'run',n,
```

to:

```js
  S.trains.push({side,path:side==='W'?P.railW:P.railE,d:0,rd:0,state:'region',n,
```

**7. Blocks remember their event.** In `src/game.js`, change:

```js
  if(ev.target)S.blocks[ev.target]={until:Infinity,label:ev.short};
```

to:

```js
  if(ev.target)S.blocks[ev.target]={until:Infinity,label:ev.short,id:ev.id};
```

**8. Move the carts on the region.** In `src/game.js`, change:

```js
  const spd=.7+S.moral/250;
  for(let i=S.walkers.length-1;i>=0;i--){const w=S.walkers[i];
```

to:

```js
  const spd=.7+S.moral/250;
  // regional segment: carts follow the geo road and stop short of a block placed on it; at Alba Iulia the city takes over
  for(let i=S.convoys.length-1;i>=0;i--){const c=S.convoys[i],key=blockKeyRoad(c.prov);
    c.d=advance(c.d,regionSpeed('road',spd,isGuarded(key))*dt,blockStop(key,c.prov,'road'));
    if(c.d>=routePath(c.prov,'road').len){spawnConvoy(c.prov,c.n);S.convoys.splice(i,1)}}
  for(let i=S.walkers.length-1;i>=0;i--){const w=S.walkers[i];
```

**9. City walkers wait only for city blocks.** In `src/game.js`, change:

```js
    const blocked=w.block&&isBlocked(w.block)&&w.d>w.path.len*.04&&w.d<w.path.len*.24;
```

to:

```js
    const blocked=w.block&&cityBlocked(w.block)&&w.d>w.path.len*.04&&w.d<w.path.len*.24;
```

**10. Move the trains on the region, then hand them to the city line.** In `src/game.js`, change:

```js
    if(t.state==='run'){const blk=isBlocked('rail:'+t.side)&&t.d<t.path.len*.8;
```

to:

```js
    if(t.state==='region'){const key=blockKeyRail(t.prov);
      t.rd=advance(t.rd,regionSpeed('rail',spd,isGuarded(key))*dt,blockStop(key,t.prov,'rail'));
      if(t.rd>=routePath(t.prov,'rail').len){t.state='run';t.d=0}}
    else if(t.state==='run'){const blk=cityBlocked('rail:'+t.side)&&t.d<t.path.len*.8;
```

**11. The city does not draw trains that are still on the region.** In `src/game.js`, change:

```js
    for(const t of S.trains){ctx.globalAlpha=Math.max(0,t.alpha);
```

to:

```js
    for(const t of S.trains){if(t.state==='region')continue;ctx.globalAlpha=Math.max(0,t.alpha);
```

**12. City block markers only for city blocks.** In `src/game.js`, change:

```js
    for(const k in S.blocks){const [kind,id]=k.split(':');let path;
```

to:

```js
    for(const k in S.blocks){if(!cityBlocked(k))continue;const [kind,id]=k.split(':');let path;
```

**13. City block labels only for city blocks.** In `src/game.js`, change:

```js
  if(S&&!cine)for(const k in S.blocks){const [kind,id]=k.split(':');let path;
```

to:

```js
  if(S&&!cine)for(const k in S.blocks){if(!cityBlocked(k))continue;const [kind,id]=k.split(':');let path;
```

**14. Draw the journeys on the region.** In `src/game.js`, change:

```js
  if(regionA>0){ctx.globalAlpha=regionA;R.draw(ctx,{sel:S?S.sel:null,clock});ctx.globalAlpha=1}
```

to:

```js
  if(regionA>0){ctx.globalAlpha=regionA;R.draw(ctx,{sel:S?S.sel:null,clock,...journeyView()});ctx.globalAlpha=1}
```

**15. journeyView.** In `src/game.js`, change:

```js
function drawCity(){
```

to:

```js
// what the region draws of the game: carts and trains on their routes, and the routes the Guards watch
function journeyView(){
  if(!S)return{};
  const units=[],guards=[];
  for(const c of S.convoys)units.push({kind:'cart',prov:c.prov,d:c.d,n:c.n});
  for(const t of S.trains)if(t.state==='region')units.push({kind:'train',prov:t.prov,d:t.rd,n:t.n});
  for(const p of PKEYS){if(isGuarded(blockKeyRoad(p)))guards.push({prov:p,kind:'road'});if(isGuarded(blockKeyRail(p)))guards.push({prov:p,kind:'rail'})}
  return{units,guards};
}
function drawCity(){
```

**16. Carts on the region at the deadline.** In `src/game.js`, change:

```js
  S.walkers=[];
```

to:

```js
  S.walkers=[];
  // carts still on the region join the crowd too, as they did when they were walking the city road
  for(const c of S.convoys){S.crowd+=c.people;stamp(Math.round(c.people/PER_STAMP))}
  S.convoys=[];
```

**17. The train sound also plays on the region.** In `src/game.js`, change:

```js
S.trains.some(t=>t.state==='run'));
```

to:

```js
S.trains.some(t=>t.state==='run'||t.state==='region'));
```

- [ ] **Step 2: Check that nothing still holds units in the city for a block that has a place on the region**

```bash
grep -nE "isBlocked\(w\.block\)|isBlocked\('rail:'\+t\.side\)" src/game.js
```

Expected: no output.

- [ ] **Step 3: Check tests, lint and build**

```bash
npm test
npm run lint
npm run build
node -e "new Function(require('fs').readFileSync('src/game.js','utf8'))" && echo SYNTAX_OK
```

Expected: `# pass 101`, `# fail 0` (89 existing + 7 geo + 3 portal + 2 region); lint prints nothing after the command line; build prints `8 scripts` and about `1.07 MB`; `SYNTAX_OK`.

- [ ] **Step 4: Commit**

```bash
git add src/game.js
git commit -m "feat: send delegations and trains across the region first"
```

---

### Task 5: Markers for placed events, and the attention dot

**Files:**
- Modify: `src/game.js` (9 edits)
- Modify: `index.html` (1 edit)
- Modify: `src/style.css` (1 edit)

The dot reuses the Chronicle button's `.tool .dot` and `.tool.new .dot` rules; the level button only has to be a positioning context. The existing rule that gives the button's label a fixed width is narrowed to `span:not(.dot)`, or the dot would get that width too.

- [ ] **Step 1: Make the edits**

**1. The crowded-station event gets a short name for its marker.** In `src/game.js`, change:

```js
 {id:'overfull',target:null,stamp:
```

to:

```js
 {id:'overfull',target:null,short:'aglomerat',stamp:
```

**2. New state: markers of placed events that block nothing.** In `src/game.js`, change:

```js
    walkers:[],trains:[],convoys:[],blocks:{},guards:{},
```

to:

```js
    walkers:[],trains:[],convoys:[],blocks:{},marks:{},guards:{},
```

**3. A placed event marks the region.** In `src/game.js`, change:

```js
  if(ev.target)S.blocks[ev.target]={until:Infinity,label:ev.short,id:ev.id};
```

to:

```js
  if(ev.target)S.blocks[ev.target]={until:Infinity,label:ev.short,id:ev.id};
  else if(EVENT_PLACES[ev.id])S.marks[ev.id]={until:rt+20,label:ev.short}; // a marker only: it holds nobody up
  // something happened on the region while the player is looking at the city
  if(EVENT_PLACES[ev.id]&&portal.notify('region'))levelUI();
```

**4. Markers fade after 20 s.** In `src/game.js`, change:

```js
  for(const k in S.blocks)if(S.blocks[k].until<=rt){delete S.blocks[k];toast('Un traseu s-a eliberat.','good')}
```

to:

```js
  for(const k in S.blocks)if(S.blocks[k].until<=rt){delete S.blocks[k];toast('Un traseu s-a eliberat.','good')}
  for(const k in S.marks)if(S.marks[k].until<=rt)delete S.marks[k];
```

**5. The region draws the placed blocks and markers.** In `src/game.js`, change:

```js
  return{units,guards};
}
```

to:

```js
  const blocks=[];
  for(const k in S.blocks){const b=S.blocks[k];if(EVENT_PLACES[b.id])blocks.push({id:b.id,label:b.label})}
  for(const id in S.marks)blocks.push({id,label:S.marks[id].label});
  return{units,guards,blocks};
}
```

**6. A cart arrives in the city.** In `src/game.js`, change:

```js
  if(w.kind==='cart'){S.del[w.prov]+=w.del;
```

to:

```js
  if(w.kind==='cart'){noteCity();S.del[w.prov]+=w.del;
```

**7. A train arrives in the city.** In `src/game.js`, change:

```js
      if(t.d>=t.path.len){t.d=t.path.len;t.state='unload';
```

to:

```js
      if(t.d>=t.path.len){noteCity();t.d=t.path.len;t.state='unload';
```

**8. noteCity.** In `src/game.js`, change:

```js
function arrive(w){
```

to:

```js
// something arrived in the city while the player is looking at the region
function noteCity(){if(portal.notify('city'))levelUI()}
function arrive(w){
```

**9. The button shows the attention dot.** In `src/game.js`, change:

```js
  const city=portal.target==='city',b=$('btnLevel');
  b.querySelector('span').textContent=city?'Regiune':'Oraș';
  b.setAttribute('aria-label',city?'Arată harta regiunii':'Arată orașul Alba Iulia');
```

to:

```js
  const city=portal.target==='city',b=$('btnLevel');
  b.querySelector('span:not(.dot)').textContent=city?'Regiune':'Oraș';
  b.classList.toggle('new',!!portal.attention); // the dot: something happened on the level the player is not looking at
  b.setAttribute('aria-label',(city?'Arată harta regiunii':'Arată orașul Alba Iulia')+(portal.attention?' · s-a întâmplat ceva acolo':''));
```

**10. The dot element.** In `index.html`, change:

```html
<span>Regiune</span></button>
```

to:

```html
<span>Regiune</span><span class="dot"></span></button>
```

**11. CSS.** In `src/style.css`, change:

```css
#btnLevel span{min-width:3.4em;text-align:center}
```

to:

```css
#btnLevel span:not(.dot){min-width:3.4em;text-align:center}
#btnLevel{position:relative}
/* the dot sits in the corner, so showing it does not move the buttons next to it */
#btnLevel .dot{position:absolute;top:4px;right:4px}
```

- [ ] **Step 2: Check tests, lint and build**

```bash
npm test
npm run lint
npm run build
node -e "new Function(require('fs').readFileSync('src/game.js','utf8'))" && echo SYNTAX_OK
```

Expected: `# pass 101`, `# fail 0`; no lint output; `8 scripts`, about `1.07 MB`; `SYNTAX_OK`.

- [ ] **Step 3: Commit**

```bash
git add src/game.js index.html src/style.css
git commit -m "feat: mark placed events on the region and add the attention dot"
```

---

### Task 6: Document, preflight and check in the browser

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document it in CLAUDE.md**

Nine edits; the Romanian characters and the „ ” quotes must stay exact.

**1. geo.js.** In `CLAUDE.md`, change:

```markdown
vitezele pe regiune și locurile evenimentelor.
```

to:

```markdown
vitezele pe regiune (`regionSpeed`, cu bonusul gărzilor), locurile evenimentelor și oprirea unităților blocate (`stopDistance`, `advance`).
```

**2. region.js.** In `CLAUDE.md`, change:

```markdown
`home()` revine la vederea cu toate provinciile.
```

to:

```markdown
`home()` revine la vederea cu toate provinciile. Desenează și drumurile în curs, date de `game.js` la fiecare cadru: căruțele și trenurile (`units`, cu `d` = distanța pe traseu), blocajele și semnele evenimentelor (`blocks`) și traseele păzite (`guards`).
```

**3. portal.js.** In `CLAUDE.md`, change:

```markdown
`alpha()` dă opacitatea regiunii, iar `pose()` camera regiunii în timpul zborului.
```

to:

```markdown
`alpha()` dă opacitatea regiunii, iar `pose()` camera regiunii în timpul zborului. `notify(nivel)` ține minte (în `attention`) pe ce nivel s-a întâmplat ceva cât timp jucătorul se uită în altă parte; `go` o șterge.
```

**4. Traseele.** In `CLAUDE.md`, change:

```markdown
`mkPath`/`at` (din `core.js`) fac interpolarea după distanță.
```

to:

```markdown
`mkPath`/`at` (din `core.js`) fac interpolarea după distanță. Pe regiune, drumurile și căile ferate sunt în `geo.js` (`ROUTES`), până la Alba Iulia, unde preiau traseele din oraș.
```

**5. Starea and Călătoriile.** In `CLAUDE.md`, change:

```markdown
`trains`, `blocks` (trasee blocate) și `guards`.
```

to:

```markdown
`trains`, `convoys` (căruțele aflate încă pe regiune), `blocks` (trasee blocate, fiecare cu `id`-ul evenimentului), `marks` (semne fără blocaj, 20 s) și `guards`.
- **Călătoriile** au două segmente. `sendDelegation` pune o căruță pe drumul regiunii (`S.convoys`), iar `organizeTrain` un tren cu `state:'region'`; ambele merg pe traseele din `geo.js` cu `regionSpeed` (moralul și gărzile contează ca în oraș) și se opresc la `stopDistance` înaintea unui blocaj care are loc pe traseul lor (`advance`). La Alba Iulia, căruța devine ce făcea `sendDelegation` înainte (`spawnConvoy`: o căruță și 24 de oameni la începutul drumului din oraș), iar trenul trece în `state:'run'` pe `railW` / `railE`. Linia rămâne ocupată cât trenul e pe oricare dintre segmente. Punctul de pe butonul „Regiune / Oraș” apare când ceva ajunge în oraș cât jucătorul e pe regiune, sau când un eveniment cu loc pe regiune apare cât e în oraș.
```

**6. Evenimentele.** In `CLAUDE.md`, change:

```markdown
iar alegerile pot debloca, bloca temporar, cere costuri sau debloca o pagină din Cronică.
```

to:

```markdown
iar alegerile pot debloca, bloca temporar, cere costuri sau debloca o pagină din Cronică. Evenimentele cu loc pe regiune (`EVENT_PLACES`) opresc unitățile înaintea locului lor, iar `overfull` doar își pune un semn. Singurul rămas în oraș e podul de peste Ampoi (`bridgeTR`), care ține tot căruțele din Maramureș, la 4–24% din drumul din oraș (`cityBlocked`).
```

**7. Nivelurile.** In `CLAUDE.md`, change:

```markdown
Pentru ce urmează: după coborâre, camera regiunii (`R.cam`) rămâne la prim-planul zborului (peste `MAXK`) până la următorul zbor sau resize, iar `R.draw` nu rulează cât `regionA` e 0; ce depinde de regiune (markere, puncte de atenție) se calculează deci în afara lui `R.draw` și fără `R.cam` cât jucătorul e în oraș.
```

to:

```markdown
Atenție: după coborâre, camera regiunii (`R.cam`) rămâne la prim-planul zborului (peste `MAXK`) până la următorul zbor sau resize, iar `R.draw` nu rulează cât `regionA` e 0; de aceea mișcarea căruțelor și a trenurilor se face în `update`, nu în desen.
```

**8. Finalul.** In `CLAUDE.md`, change:

```markdown
trece pe câmp pe toți cei încă pe drum,
```

to:

```markdown
trece pe câmp pe toți cei încă pe drum (și căruțele rămase pe regiune),
```

**9. De verificat.** In `CLAUDE.md`, change:

```markdown
- Numele oficiale din 1918 ale orașelor (`official` în `geo.js`).
```

to:

```markdown
- Numele oficiale din 1918 ale orașelor (`official` în `geo.js`).
- Locurile evenimentelor din `EVENT_PLACES` (Munții Apuseni, Teiuș, Deva, drumul dinspre Vințu, Arad) și traseele pe care au mers delegații din Apuseni și din Maramureș.
```

- [ ] **Step 2: Run the full preflight**

```bash
npm test
npm run lint
npm run build
```

Expected: `# pass 101`, `# fail 0`; no lint output; `8 scripts`, about `1.07 MB`.

- [ ] **Step 3: Check the game in the browser**

Serve the game (`game` in `.claude/launch.json`, or `npx serve . -l 3000`), with the console open. On the region (the game starts there):

1. Pick Crișana and press „Trimite delegați": a cart with a tricolour and „30" under it leaves Oradea and follows the road through Beiuș, Câmpeni and Abrud to Alba Iulia. At the end it disappears from the region and a cart with its crowd appears at the start of the city road (press „Oraș" to see it).
2. Pick Banat and press „Organizează tren": a small locomotive with smoke and „120" runs Timișoara – Arad – … – Vințu de Jos. While it is on the region, a second train on the same line is refused (the line is busy); when it reaches the city the line is free again.
3. When a telegram opens, its marker appears at its place with the short name (Apuseni, Teiuș, Deva, the road from Vințu, Arad). Carts and trains on that route stop short of the marker and go on when the block is lifted (negotiate, or the card's own choice). A Transilvania train stops at Vințu for the event at Deva.
4. „Podul de peste Ampoi": Maramureș carts are not held on the region, and wait in the city.
5. „Protejează traseul": the routes glow blue on the region and the units on them are faster.
6. The dot: on the region, a cart or a train reaching the city lights a dot in the corner of „Oraș"; in the city, an event with a place on the region lights it on „Regiune". Going there clears it. Check the tools row at 360×780: nothing moves when the dot shows.
7. Let a game run to 10:00 from the region: carts still travelling count for the crowd, the view flies to the city, the cinematic plays and the results open. „Joacă din nou" starts on the region again.
8. No console errors.

Optional, to stop a unit at an exact block without waiting for a random event: `dist/` is ignored by git, so this page can stay on your disk. Create `dist/p4.html` and `dist/game.debug.js` with

```bash
python3 - <<'PY'
import os
g=open('src/game.js',encoding='utf-8').read().rstrip()
tail="})();"
assert g.endswith(tail)
hook="window.__g={get S(){return S},get portal(){return portal},sendDelegation,organizeTrain,protect,triggerEvent,EVENTS,setSel:k=>{S.sel=k;hud()},journeyView};\n"
os.makedirs('dist',exist_ok=True)
open('dist/game.debug.js','w',encoding='utf-8').write(g[:-len(tail)]+hook+tail+"\n")
h=open('index.html',encoding='utf-8').read().replace('<meta charset="utf-8">','<meta charset="utf-8"><base href="/">',1).replace('src="src/game.js"','src="dist/game.debug.js"')
open('dist/p4.html','w',encoding='utf-8').write(h)
PY
```

then open `http://localhost:3000/dist/p4` and, in the console, give resources (`__g.S.prov=400;__g.S.infl=250;__g.S.nextEvent=1e9`), send a unit (`__g.setSel('CR');__g.sendDelegation()`), set a block (`__g.S.blocks['road:CR']={until:Infinity,label:'viscol',id:'snowMM'}`) and read where it waits (`__g.S.convoys[0].d`). Measured: a Crișana cart waits at 534 for `snowMM`, a Banat train at 739 for `gardaW` (before Deva), a Transilvania train at 747 (the junction, Vințu de Jos), and a Maramureș cart is not held on the region by `bridgeTR` (it waits at 4 % of the city road).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe journeys on the region and the attention dot"
```

- [ ] **Step 5: Push and open the PR only after Lucian approves in chat**

```bash
git push -u origin feature/region-journeys
gh pr create --base main --title "feat: send delegations and trains across the region" --body-file <body>
```
