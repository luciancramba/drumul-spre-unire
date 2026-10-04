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
