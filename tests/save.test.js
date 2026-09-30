const test=require('node:test');
const assert=require('node:assert/strict');
const {createSave,KEY}=require('../src/save.js');

function fakeStorage(){const m=new Map();return{m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))}}
const throwing={getItem(){throw new Error('SecurityError')},setItem(){throw new Error('QuotaExceededError')}};

test('a fresh save is empty',()=>{
  const s=createSave(()=>fakeStorage());
  assert.deepEqual(s.load(),{v:1,best:null,facts:[],sound:true,plays:0});
});

test('progress survives a reload',()=>{
  const st=fakeStorage();
  const a=createSave(()=>st);a.load();
  assert.equal(a.recordResult({delegates:1100,crowd:90000.4,medals:2}),true);
  a.unlockFact('conv');a.unlockFact('conv');a.unlockFact('train');
  a.setSound(false);
  const b=createSave(()=>st);const d=b.load();
  assert.equal(d.plays,1);
  assert.deepEqual({...d.best,date:'x'},{delegates:1100,crowd:90000,medals:2,date:'x'});
  assert.match(d.best.date,/^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(d.facts,['conv','train']);
  assert.equal(d.sound,false);
  assert.ok(st.m.has(KEY));
});

test('a worse run counts as a play but keeps the best result',()=>{
  const s=createSave(()=>fakeStorage());s.load();
  s.recordResult({delegates:1228,crowd:100000,medals:3});
  assert.equal(s.recordResult({delegates:900,crowd:200000,medals:2}),false);
  assert.equal(s.data.plays,2);
  assert.equal(s.data.best.delegates,1228);
});

test('a corrupt save is replaced on the next write',()=>{
  const st=fakeStorage();st.setItem(KEY,'{not json');
  const s=createSave(()=>st);
  assert.equal(s.load().plays,0);
  s.unlockFact('dawn');
  assert.deepEqual(JSON.parse(st.getItem(KEY)).facts,['dawn']);
});

test('throwing storage falls back to memory without throwing',()=>{
  const s=createSave(()=>throwing);
  s.load();
  s.unlockFact('conv');
  s.recordResult({delegates:10,crowd:10,medals:1});
  assert.deepEqual(s.load().facts,['conv']);
  assert.equal(s.data.plays,1);
});

test('a storage getter that throws also falls back to memory',()=>{
  const s=createSave(()=>{throw new Error('blocked')});
  s.load();s.setSound(false);
  assert.equal(s.load().sound,false);
});
