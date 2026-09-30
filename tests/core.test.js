const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const {mkPath,at,clamp,fmt,clockParts,clockText,scoreFor,QUOTAS,TOTAL,DEADLINE,RATE}=core;

test('quotas add up to the 1.228 accredited delegates',()=>{
  assert.equal(Object.values(QUOTAS).reduce((a,b)=>a+b,0),TOTAL);
  assert.equal(TOTAL,1228);
});

test('the game lasts about four real minutes',()=>{
  assert.equal(DEADLINE/RATE,240);
});

test('clamp and fmt',()=>{
  assert.equal(clamp(5,0,3),3);
  assert.equal(clamp(-1,0,3),0);
  assert.equal(fmt(1228),'1.228');
  assert.equal(fmt(99.6),'100');
});

test('mkPath measures cumulative length',()=>{
  const p=mkPath([[0,0],[3,4],[3,10]]);
  assert.deepEqual(p.L,[0,5,11]);
  assert.equal(p.len,11);
});

test('at interpolates by distance and clamps to the ends',()=>{
  const p=mkPath([[0,0],[10,0],[10,10]]);
  assert.deepEqual(at(p,5),{x:5,y:0,ang:0});
  const q=at(p,15);
  assert.equal(q.x,10);assert.equal(q.y,5);assert.equal(q.ang,Math.PI/2);
  assert.deepEqual([at(p,-3).x,at(p,-3).y],[0,0]);
  assert.deepEqual([at(p,99).x,at(p,99).y],[10,10]);
});

test('at copes with zero-length segments',()=>{
  const p=mkPath([[0,0],[0,0],[4,0]]);
  const q=at(p,2);
  assert.equal(q.x,2);assert.ok(Number.isFinite(q.y));
});

test('clock starts on 30 November at 06:00',()=>{
  assert.deepEqual(clockParts(0),{day:30,hh:'06',mm:'00'});
  assert.equal(clockText(0),'30 noiembrie 1918 · 06:00');
});

test('clock crosses midnight into 1 December',()=>{
  assert.deepEqual(clockParts(1079),{day:30,hh:'23',mm:'59'});
  assert.deepEqual(clockParts(1080),{day:1,hh:'00',mm:'00'});
  assert.equal(clockText(DEADLINE),'1 decembrie 1918 · 10:00');
});

test('clock floors fractional minutes',()=>{
  assert.deepEqual(clockParts(61.9),{day:30,hh:'07',mm:'01'});
});

test('medal thresholds',()=>{
  assert.equal(scoreFor(0).medals,1);
  assert.equal(scoreFor(899).medals,1);
  assert.equal(scoreFor(900).medals,2);
  assert.equal(scoreFor(1227).medals,2);
  assert.equal(scoreFor(1228).medals,3);
  assert.match(scoreFor(1228).verdict,/Sala Unirii e plină/);
});

test('core attaches itself to the DSU namespace',()=>{
  assert.equal(globalThis.DSU.core,core);
});
