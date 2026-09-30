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
