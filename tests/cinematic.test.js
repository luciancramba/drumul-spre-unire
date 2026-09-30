const test=require('node:test');
const assert=require('node:assert/strict');
const {play,pose,captionAt,LEN,WIDE_PORTRAIT}=require('../src/cinematic.js');

const from={x:900,y:500,k:1.3};
const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;
const at=(p,x,y,k)=>assert.ok(near(p.x,x)&&near(p.y,y)&&near(p.k,k),JSON.stringify(p));

test('the flight starts at the current view and hits every keyframe',()=>{
  assert.deepEqual(pose(0,from),from);
  const sala=pose(2.999999,from);assert.ok(near(sala.x,664,1e-3)&&near(sala.y,410,1e-3)&&near(sala.k,3,1e-3));
  at(pose(3,from),664,410,3);
  at(pose(7,from),235,585,2.4);
  at(pose(11,from),450,540,1.15);
  at(pose(LEN,from),450,540,1.15);
});

test('the glide passes close to Poarta a IV-a',()=>{
  const mid=pose(5,from);
  assert.ok(Math.hypot(mid.x-395,mid.y-478)<40,JSON.stringify(mid));
});

test('the camera never jumps between frames',()=>{
  let prev=pose(0,from);
  for(let t=.05;t<=LEN;t+=.05){const p=pose(t,from);assert.ok(Math.hypot(p.x-prev.x,p.y-prev.y)<25,`jump at ${t}`);prev=p}
});

test('captions fade in and out inside their windows',()=>{
  assert.deepEqual(captionAt(0),{text:'10:00 · Sala Unirii',alpha:0});
  assert.equal(captionAt(.2).alpha,.5);
  assert.equal(captionAt(1.5).alpha,1);
  assert.equal(captionAt(4.2),null);
  assert.equal(captionAt(6).text,'Câmpul lui Horea');
  assert.equal(captionAt(10).text,'Peste 100.000 de oameni');
  assert.ok(near(captionAt(11.8).alpha,.5,1e-9));
  assert.equal(captionAt(LEN),null);
});

function fakeCam(){return{x:900,y:500,z:1.3,minZ:1}}

test('play drives the camera and calls onDone once at the end',()=>{
  const cam=fakeCam();let calls=0;
  const c=play(cam,{onDone:()=>calls++});
  for(let i=0;i<130;i++)c.update(.1);
  assert.equal(calls,1);assert.equal(c.done,true);
  assert.deepEqual([cam.x,cam.y,cam.z],[450,540,1.15]);
  c.skip();assert.equal(calls,1);
});

test('keyframes scale with minZ, so a resize mid-flight stays valid',()=>{
  const cam=fakeCam();const c=play(cam);
  c.update(3);assert.ok(near(cam.z,3));
  cam.minZ=.5;c.update(0);assert.ok(near(cam.z,1.5));
});

test('skip jumps to the final view and finishes',()=>{
  const cam=fakeCam();let calls=0;
  const c=play(cam,{onDone:()=>calls++});
  c.update(1);c.skip();
  assert.equal(calls,1);assert.deepEqual([cam.x,cam.y,cam.z],[450,540,1.15]);
});

test('reduced motion cuts to the final view and finishes after half a second',()=>{
  const cam=fakeCam();let calls=0;
  const c=play(cam,{reduceMotion:true,onDone:()=>calls++});
  assert.deepEqual([cam.x,cam.y,cam.z],[450,540,1.15]);
  c.update(.3);assert.equal(calls,0);
  c.update(.3);assert.equal(calls,1);
});

test('on a portrait phone the last view keeps the whole crowd in frame',()=>{
  // 375×812 portrait: minZ is bound by height
  const vw=375,vh=812,minZ=Math.max(vw/1600,vh/1067);
  const cam={x:900,y:500,z:minZ*1.1,minZ};let done=false;
  const c=play(cam,{portrait:true,onDone:()=>done=true});c.skip();
  assert.ok(done);
  assert.equal(cam.x,WIDE_PORTRAIT.x);
  const half=vw/2/cam.z;
  // the crowd spans about x 100–370 on the field
  assert.ok(cam.x-half<=100&&cam.x+half>=370,`visible ${cam.x-half}–${cam.x+half}`);
});
