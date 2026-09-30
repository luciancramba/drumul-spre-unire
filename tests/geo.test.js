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
