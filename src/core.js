/* Logică pură, fără DOM. În browser se atașează la DSU.core; în Node se exportă prin module.exports. */
(function(root){
const W=1600,H=1067;
const RATE=7; // game minutes per real second
const DEADLINE=1680; // 1 Dec 10:00 measured from 30 Nov 06:00
const QUOTAS={MM:140,CR:260,BN:300,TR:528};
const TOTAL=1228;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString('ro-RO');

/* ---------- geometry ---------- */
function mkPath(pts){const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return{pts,L,len:L[L.length-1]}}
function at(p,d){d=clamp(d,0,p.len);let i=1;while(i<p.L.length-1&&p.L[i]<d)i++;const a=p.pts[i-1],b=p.pts[i],s=(p.L[i]-p.L[i-1])||1,t=(d-p.L[i-1])/s;return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,ang:Math.atan2(b[1]-a[1],b[0]-a[0])}}

/* ---------- time ---------- */
// t = game minutes since 30 Nov 06:00
function clockParts(t){const m=6*60+Math.floor(t||0);const day=m<1440?30:1;const hm=m%1440;const hh=String(Math.floor(hm/60)).padStart(2,'0'),mm=String(hm%60).padStart(2,'0');return{day,hh,mm}}
function clockText(t){const c=clockParts(t);return `${c.day===30?'30 noiembrie':'1 decembrie'} 1918 · ${c.hh}:${c.mm}`}

/* ---------- score ---------- */
function scoreFor(total){
  const medals=total>=TOTAL?3:total>=900?2:1;
  const verdict=total>=TOTAL?'Toți delegații au ajuns la timp. Sala Unirii e plină.':total>=900?'Majoritatea delegaților au ajuns la timp. Câțiva încă sunt pe drum.':'Prea mulți delegați au rămas pe drum. Încearcă din nou să-i aduci pe toți.';
  return{medals,verdict};
}

/* ---------- save schema ---------- */
// {v:1, best:{delegates,crowd,medals,date}|null, facts:string[], sound:boolean, plays:number}
const SAVE_VERSION=1;
function emptySave(){return{v:SAVE_VERSION,best:null,facts:[],sound:true,plays:0}}
const isCount=n=>Number.isInteger(n)&&n>=0;
function validBest(b){return b===null||(!!b&&typeof b==='object'&&isCount(b.delegates)&&b.delegates<=TOTAL&&isCount(b.crowd)&&[1,2,3].includes(b.medals)&&typeof b.date==='string')}
function parseSave(raw){
  let d;try{d=JSON.parse(raw)}catch{return emptySave()}
  if(!d||typeof d!=='object'||d.v!==SAVE_VERSION)return emptySave();
  if(!validBest(d.best)||!Array.isArray(d.facts)||!d.facts.every(f=>typeof f==='string')||typeof d.sound!=='boolean'||!isCount(d.plays))return emptySave();
  return{v:SAVE_VERSION,best:d.best&&{delegates:d.best.delegates,crowd:d.best.crowd,medals:d.best.medals,date:d.best.date},facts:[...new Set(d.facts)],sound:d.sound,plays:d.plays};
}
// a run beats the best one with more delegates, or the same delegates and a bigger crowd
function isBetter(run,best){return !best||run.delegates>best.delegates||(run.delegates===best.delegates&&run.crowd>best.crowd)}

const core={W,H,RATE,DEADLINE,QUOTAS,TOTAL,clamp,fmt,mkPath,at,clockParts,clockText,scoreFor,emptySave,parseSave,isBetter};
const DSU=root.DSU||(root.DSU={});
DSU.core=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
})(typeof window!=='undefined'?window:globalThis);
