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

test('home goes back to the widest view with the whole region in sight, on a phone and on a desktop',()=>{
  for(const [w,h] of [[390,844],[1440,900],[780,360]]){
    resize(w,h);cam.z=cam.minZ*4;cam.x=300;cam.y=300;
    region.home();
    assert.ok(near(cam.z,cam.minZ),`${w}×${h} zoom`);
    assert.ok(RW*cam.z<=w+1e-9&&RH*cam.z<=h+1e-9,`${w}×${h} shows it all`);
    assert.ok(near(cam.x,RW/2)&&near(cam.y,RH/2),`${w}×${h} centred`);
  }
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

test('info cards give the official 1918 name and say the outlines are approximate',()=>{
  const ai=region.info({kind:'town',key:'albaIulia'});
  assert.equal(ai.title,'Alba Iulia');
  assert.match(ai.text,/Gyulafehérvár/);
  assert.match(ai.text,/Marea Adunare/);
  assert.match(ai.text,/Apropie-te de oraș/);
  assert.match(region.info({kind:'town',key:'arad'}).text,/tot Arad/);
  const tm=region.info({kind:'town',key:'timisoara'}).text;
  assert.match(tm,/cel maghiar, Temesvár/);
  assert.doesNotMatch(tm,/Oraș/);
  const bn=region.info({kind:'prov',key:'BN'});
  assert.equal(bn.title,'Banat');
  assert.match(bn.text,/300 de delegați/);
  assert.match(bn.text,/aproximativ/);
});

test('every town and province has a complete card',()=>{
  const cards=[...Object.keys(geo.TOWNS).map(key=>region.info({kind:'town',key})),
    ...geo.LABELS.filter(l=>l.prov).map(l=>region.info({kind:'prov',key:l.prov}))];
  for(const c of cards)for(const f of ['eyebrow','title','text'])assert.ok(c[f]&&!c[f].includes('undefined'),`${c.title} ${f}`);
});

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

test('a cart follows the road and a train the rail, even where the two differ',()=>{
  const cart=region.unitWorld({kind:'cart',prov:'BN',d:300}),train=region.unitWorld({kind:'train',prov:'BN',d:300});
  assert.ok(geo.distToPath(cart.x,cart.y,geo.routePath('BN','road').pts)<1e-6);
  assert.ok(geo.distToPath(cart.x,cart.y,geo.routePath('BN','rail').pts)>5);
  assert.ok(geo.distToPath(train.x,train.y,geo.routePath('BN','rail').pts)<1e-6);
});

// a context that counts every call, so a test can tell what was drawn
function countingCtx(){
  const calls={},target={measureText:t=>({width:String(t).length*7}),globalAlpha:1};
  const g=new Proxy(target,{get:(o,k)=>k in o?o[k]:(()=>{calls[k]=(calls[k]||0)+1}),set:(o,k,v)=>{o[k]=v;return true}});
  return{g,calls};
}

test('guards, carts, trains and blocks each leave their marks, and the canvas is left as it was found',()=>{
  resize(1440,900);cam.z=cam.minZ;cam.x=RW/2;cam.y=RH/2;
  const draw=opts=>{const {g,calls}=countingCtx();g.globalAlpha=.4;region.draw(g,{sel:'BN',...opts});return{g,calls}};
  const bare=draw({}).calls;
  assert.equal(draw({guards:[{prov:'CR',kind:'road'}]}).calls.stroke,bare.stroke+1);
  const cart=draw({units:[{kind:'cart',prov:'BN',d:300,n:30}]}).calls;
  assert.ok(cart.fillRect>bare.fillRect&&cart.fill>bare.fill);
  const train=draw({units:[{kind:'train',prov:'TR',d:400,n:120}]}).calls;
  assert.ok(train.fillRect>bare.fillRect&&train.arc>=bare.arc+4,'a locomotive and four puffs of smoke');
  const block=draw({blocks:[{id:'coalE',label:'fără cărbune'}]}).calls;
  assert.ok(block.arc>bare.arc&&block.stroke>bare.stroke);
  const all=draw({units:[{kind:'cart',prov:'MM',d:100,n:30},{kind:'train',prov:'CR',d:100,n:120}],blocks:[{id:'snowMM',label:'viscol'}],guards:[{prov:'MM',kind:'rail'}]});
  assert.equal(all.calls.save,all.calls.restore);
  assert.equal(all.g.globalAlpha,.4);
});

test('a block marker is drawn on top of the unit that stopped at it',()=>{
  resize(1440,900);cam.z=cam.minZ;cam.x=RW/2;cam.y=RH/2;
  const texts=[],g=fakeCtx();g.fillText=function(t){texts.push(t)};
  const stop=geo.stopDistance('snowMM','CR','road');
  region.draw(g,{units:[{kind:'cart',prov:'CR',d:stop,n:77}],blocks:[{id:'snowMM',label:'viscol'}]});
  assert.ok(texts.indexOf('77')>=0&&texts.indexOf('viscol')>texts.indexOf('77'),texts.join('|'));
});

test('a block for an event with no place on the region is skipped, not drawn',()=>{
  const {g}=countingCtx();
  assert.doesNotThrow(()=>region.draw(g,{blocks:[{id:'bridgeTR',label:'pod aglomerat'}]}));
});

test('the smoke trail keeps its size on the screen at every zoom',()=>{
  for(const k of [1,6]){
    resize(1440,900);cam.z=cam.minZ*k;
    const u={kind:'train',prov:'TR',d:500,n:120},q=region.unitWorld(u);
    cam.x=q.x;cam.y=q.y;
    const puffs=[],g=fakeCtx();
    g.arc=(x,y,r)=>{if([1,2,3,4].some(i=>Math.abs(r-(2.4+i*1.1))<1e-9))puffs.push([x,y])};
    region.draw(g,{units:[u]});
    assert.equal(puffs.length,4,`${k}× puffs`);
    const [ux,uy]=toScreen(q.x,q.y);
    for(const [x,y] of puffs)assert.ok(Math.hypot(x-ux,y-uy)<70,`${k}×: ${Math.hypot(x-ux,y-uy)}`);
  }
});

// a layer canvas that records every call made on it
function recordingLayer(){
  const calls=[],g=new Proxy({},{get:(o,k)=>k in o?o[k]:((...a)=>{calls.push([k,...a])}),set:(o,k,v)=>{o[k]=v;return true}});
  return{calls,makeCanvas:()=>({getContext:()=>g})};
}
const COLS={MM:'#5b86d6',CR:'#e2b21f',BN:'#d4574c',TR:'#7fb069'};

test('a painted background is drawn over the whole world, under the washes of the provinces',()=>{
  const image={naturalWidth:100,width:100,height:87},L=recordingLayer();
  region.init({cols:COLS,makeCanvas:L.makeCanvas,image});
  const at=L.calls.findIndex(c=>c[0]==='drawImage');
  assert.ok(at>=0,'no drawImage');
  assert.deepEqual(L.calls[at].slice(1),[image,0,0,RW,RH]);
  assert.equal(L.calls.filter(c=>c[0]==='drawImage').length,1);
  assert.ok(L.calls.slice(at).filter(c=>c[0]==='fill').length>=5,'the Kingdom and the four provinces are washed over it');
});

test('without an image, or with one that failed to load, the paper stays',()=>{
  for(const image of [undefined,null,{naturalWidth:0}]){
    const L=recordingLayer();
    region.init({cols:COLS,makeCanvas:L.makeCanvas,image});
    assert.equal(L.calls.filter(c=>c[0]==='drawImage').length,0);
    assert.ok(L.calls.filter(c=>c[0]==='fillRect').length>2000,'the paper grain is drawn');
  }
});

test('on a painted background the roads get a halo, and the paper needs none',()=>{
  const strokes=image=>{
    region.init({cols:COLS,makeCanvas:recordingLayer().makeCanvas,image});
    resize(1440,900);cam.z=cam.minZ;cam.x=RW/2;cam.y=RH/2;
    const {g,calls}=countingCtx();region.draw(g,{});return calls.stroke;
  };
  const paper=strokes(null),painted=strokes({naturalWidth:100});
  assert.equal(painted,paper+region.ROADS.length);
  region.init({cols:COLS,makeCanvas:recordingLayer().makeCanvas});  // leave the module as the other tests expect it
});
