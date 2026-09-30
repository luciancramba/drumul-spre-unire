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
