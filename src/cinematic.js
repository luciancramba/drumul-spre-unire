/* Finalul cinematic: camera coboară pe Sala Unirii, trece prin Poarta a IV-a pe Câmpul lui Horea și se ridică
   deasupra mulțimii, cu subtitrări. Orice atingere sau tastă sare la final. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const LEN=12,FADE=.4;
// world positions; k is the zoom as a multiple of cam.minZ, so a resize keeps the keyframes valid
const SALA={x:664,y:410,k:3},GATE={x:395,y:478},FIELD={x:235,y:585,k:2.4};
// the last view fits fortress and field; a portrait phone is too narrow for both, so it keeps the whole crowd
const WIDE={x:450,y:540,k:1.15},WIDE_PORTRAIT={x:300,y:560,k:1};
// captions follow what is on screen: the glide reaches the field around 5 s, the pull-back starts at 7 s
const CAPTIONS=[[0,4,'10:00 · Sala Unirii'],[4.5,8.5,'Câmpul lui Horea'],[8.5,12,'Peste 100.000 de oameni']];

const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const lerp=(a,b,s)=>a+(b-a)*s;
const zoom=(a,b,s)=>Math.exp(lerp(Math.log(a),Math.log(b),s));

// camera pose at time t (seconds) for a flight that starts at `from`
function pose(t,from,wide=WIDE){
  if(t<3){const s=ease(t/3);return{x:lerp(from.x,SALA.x,s),y:lerp(from.y,SALA.y,s),k:zoom(from.k,SALA.k,s)}}
  if(t<7){const s=ease((t-3)/4),u=1-s;
    // quadratic curve with the gate as control point: the camera glides out of the fortress through Poarta a IV-a
    return{x:u*u*SALA.x+2*u*s*GATE.x+s*s*FIELD.x,y:u*u*SALA.y+2*u*s*GATE.y+s*s*FIELD.y,k:zoom(SALA.k,FIELD.k,s)}}
  if(t<11){const s=ease((t-7)/4);return{x:lerp(FIELD.x,wide.x,s),y:lerp(FIELD.y,wide.y,s),k:zoom(FIELD.k,wide.k,s)}}
  return{...wide};
}
function captionAt(t){
  for(const [a,b,text] of CAPTIONS)if(t>=a&&t<b)return{text,alpha:Math.max(0,Math.min(1,(t-a)/FADE,(b-t)/FADE))};
  return null;
}

// drives cam.x, cam.y, cam.z until the flight ends, then calls onDone once
function play(cam,{onDone=null,reduceMotion=false,portrait=false}={}){
  const from={x:cam.x,y:cam.y,k:cam.z/cam.minZ},wide=portrait?WIDE_PORTRAIT:WIDE;
  let t=reduceMotion?LEN:0,hold=reduceMotion?.5:0;
  const place=()=>{const p=pose(t,from,wide);cam.x=p.x;cam.y=p.y;cam.z=cam.minZ*p.k};
  const c={
    done:false,onDone,
    update(dt){
      if(c.done)return;
      t=Math.min(LEN,t+dt);place();
      if(t>=LEN){hold-=dt;if(hold<=0)finish()}
    },
    drawOverlay(g,vw,vh){
      if(c.done)return;const cap=captionAt(t);
      g.save();g.textAlign='center';g.textBaseline='middle';
      if(cap){
        const fs=Math.round(Math.max(22,Math.min(40,vw*.05))),y=vh*.72,h=fs*2;
        g.globalAlpha=cap.alpha;g.fillStyle='rgba(20,16,10,.55)';g.fillRect(0,y-h/2,vw,h);
        g.font=`700 ${fs}px "Cormorant SC",Georgia,serif`;g.fillStyle='#ecdfc2';g.fillText(cap.text,vw/2,y+1);
      }
      const hint='Atinge ecranul ca să sari la rezultate';
      g.globalAlpha=.85;g.font='500 13px "Alegreya Sans",sans-serif';
      const hw=g.measureText(hint).width+24,hy=vh-32;
      g.fillStyle='rgba(20,16,10,.6)';g.beginPath();g.roundRect?g.roundRect(vw/2-hw/2,hy-12,hw,24,12):g.rect(vw/2-hw/2,hy-12,hw,24);g.fill();
      g.fillStyle='#ecdfc2';g.fillText(hint,vw/2,hy+1);
      g.restore();
    },
    skip(){if(c.done)return;t=LEN;place();finish()},
  };
  function finish(){if(c.done)return;c.done=true;if(c.onDone)c.onDone()}
  place();
  return c;
}

DSU.cinematic={play,pose,captionAt,LEN,WIDE,WIDE_PORTRAIT};
if(typeof module!=='undefined'&&module.exports)module.exports=DSU.cinematic;
})(typeof window!=='undefined'?window:globalThis);
