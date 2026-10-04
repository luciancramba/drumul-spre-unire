const test=require('node:test');
const assert=require('node:assert/strict');
const portal=require('../src/portal.js');
const {create,FLIGHT,FLIGHT_REDUCED,PUSH}=portal;

const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;
// runs the flight frame by frame; returns how many frames said 'arrived' and the opacity at each frame
function fly(p,seconds,dt=1/60){
  let arrived=0;const alphas=[];
  for(let t=0;t<seconds;t+=dt){if(p.update(dt)==='arrived')arrived++;alphas.push(p.alpha())}
  return{arrived,alphas};
}

test('portal attaches itself to the DSU namespace',()=>{
  assert.equal(globalThis.DSU.portal,portal);
});

test('the game starts on the region, fully visible and still',()=>{
  const p=create();
  assert.equal(p.level,'region');assert.equal(p.target,'region');
  assert.equal(p.busy,false);assert.equal(p.alpha(),1);
  assert.equal(p.update(1),null);
});

test('a dive into the city lands once, after the flight, with the region fading out',()=>{
  const p=create();
  assert.equal(p.go('city'),true);
  assert.equal(p.busy,true);assert.equal(p.target,'city');assert.equal(p.level,'region');
  const {arrived,alphas}=fly(p,FLIGHT+.2);
  assert.equal(arrived,1);
  assert.equal(p.level,'city');assert.equal(p.busy,false);assert.equal(p.alpha(),0);
  for(let i=1;i<alphas.length;i++)assert.ok(alphas[i]<=alphas[i-1]+1e-12,`opacity rises at frame ${i}`);
  // the region stays fully drawn for the first part of the dive, while the camera flies in
  const p2=create();p2.go('city');p2.update(FLIGHT*.25);assert.equal(p2.alpha(),1);
});

test('with reduced motion the switch is a 0.2 s crossfade and the camera does not move',()=>{
  const p=create({reduceMotion:true});
  p.go('city');
  assert.equal(p.update(FLIGHT_REDUCED/2),null);
  assert.equal(p.update(FLIGHT_REDUCED/2+1e-6),'arrived');
  const a={x:100,y:200,z:.5},b={x:900,y:800,z:5};
  p.go('region');p.update(.05);
  assert.deepEqual(p.pose(a,b),a);
});

test('a frame with no time does not land a flight that has just started',()=>{
  for(const [from,to] of [['region','city'],['city','region']]){
    const p=create({level:from});p.go(to);
    assert.equal(p.update(0),null,`${from} → ${to}`);
    assert.equal(p.busy,true);assert.equal(p.target,to);
  }
});

test('a frame with a broken time step does nothing',()=>{
  const p=create();p.overscroll(Math.exp(PUSH*.5));const push=p.push;
  for(const dt of [NaN,-1,undefined])assert.equal(p.update(dt),null);
  assert.equal(p.push,push);assert.equal(p.alpha(),1);
  p.go('city');
  for(const dt of [NaN,-1])assert.equal(p.update(dt),null);
  assert.equal(p.busy,true);assert.equal(p.u,0);
});

test('a long frame lands a whole climb at once',()=>{
  const p=create({level:'city'});p.go('region');
  assert.equal(p.update(10),'arrived');
  assert.equal(p.level,'region');assert.equal(p.u,0);assert.equal(p.alpha(),1);
});

test('starting a flight clears the push',()=>{
  const p=create({reduceMotion:true});
  p.overscroll(Math.exp(PUSH*.9));assert.ok(p.push>0);
  p.go('city');assert.equal(p.push,0);
});

test('going where you already are, or are already going, does nothing',()=>{
  const p=create();
  assert.equal(p.go('region'),false);assert.equal(p.busy,false);
  p.go('city');p.update(.1);
  assert.equal(p.go('city'),false);
  const city=create({level:'city'});
  assert.equal(city.go('city'),false);assert.equal(city.alpha(),0);
});

test('a flight can turn around halfway without a jump',()=>{
  const p=create();
  p.go('city');p.update(FLIGHT*.6);
  const before=p.alpha(),a={x:0,y:0,z:1},b={x:100,y:50,z:8},pose=p.pose(a,b);
  assert.equal(p.go('region'),true);
  assert.equal(p.alpha(),before);assert.deepEqual(p.pose(a,b),pose);
  const {arrived}=fly(p,FLIGHT);
  assert.equal(arrived,1);assert.equal(p.level,'region');assert.equal(p.alpha(),1);
});

test('the camera pose goes from the region view to the close-up, zooming on a log scale',()=>{
  const p=create(),a={x:0,y:0,z:1},b={x:100,y:40,z:16};
  p.go('city');
  assert.deepEqual(p.pose(a,b),{x:0,y:0,z:1});
  p.update(FLIGHT/2);
  const mid=p.pose(a,b);
  assert.ok(near(mid.x,50)&&near(mid.y,20)&&near(mid.z,4),JSON.stringify(mid));
  p.update(FLIGHT);
  const end=p.pose(a,b);
  assert.ok(near(end.x,100)&&near(end.y,40)&&near(end.z,16,1e-9),JSON.stringify(end));
});

test('zooming past the limit dives once the push crosses the threshold, and only once',()=>{
  const p=create(),step=Math.exp(PUSH/3)*1.0001;
  assert.equal(p.overscroll(step),false);
  assert.equal(p.overscroll(step),false);
  assert.equal(p.overscroll(step),true);
  assert.equal(p.target,'city');
  // more pushing during the flight is ignored
  assert.equal(p.overscroll(step),false);assert.equal(p.overscroll(1/step),false);
  fly(p,FLIGHT+.1);
  assert.equal(p.level,'city');assert.equal(p.push,0);
});

test('wiggling inside the band never switches level',()=>{
  const p=create(),step=Math.exp(PUSH*.6);
  for(let i=0;i<50;i++){assert.equal(p.overscroll(step),false);assert.equal(p.overscroll(1/step),false)}
  assert.equal(p.level,'region');assert.equal(p.busy,false);
});

test('pushing out of the city climbs back to the region',()=>{
  const p=create({level:'city'}),out=Math.exp(-PUSH*.6);
  assert.equal(p.overscroll(1/out),false); // zooming in at the city limit does not push anywhere
  assert.equal(p.push,0);
  assert.equal(p.overscroll(out),false);
  assert.equal(p.overscroll(out),true);
  assert.equal(p.target,'region');
});

test('the region only dives when Alba Iulia is near the zoom',()=>{
  const p=create(),step=Math.exp(PUSH)*1.0001;
  assert.equal(p.overscroll(step,false),false);assert.equal(p.push,0);
  assert.equal(p.overscroll(step,true),true);
});

test('the push fades when the player stops zooming',()=>{
  const p=create(),step=Math.exp(PUSH*.6);
  p.overscroll(step);
  p.update(1);
  assert.equal(p.push,0);
  assert.equal(p.overscroll(step),false);
});

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
