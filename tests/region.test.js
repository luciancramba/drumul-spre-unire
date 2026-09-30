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
    const wide=near(RW*cam.z,w); // the map fills the width, so the height is letterboxed
    assert.ok(wide||near(RH*cam.z,h),`${w}×${h} fills one side`);
    // however far the player drags, the letterboxed side stays centred
    pan(1e6,1e6);
    assert.ok(wide?near(cam.y,RH/2):near(cam.x,RW/2),`${w}×${h} stays centred`);
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

test('labels keep the opacity the caller set, so they fade with the map',()=>{
  const alphas=[],g=fakeCtx();
  g.globalAlpha=.4;g.fillText=function(){alphas.push(this.globalAlpha)};
  resize(1440,900);cam.z=cam.minZ;cam.x=RW/2;cam.y=RH/2;
  region.draw(g);
  assert.ok(alphas.length>0);
  assert.ok(alphas.every(a=>a<=.4+1e-9),String(alphas));
  assert.equal(g.globalAlpha,.4);
});
