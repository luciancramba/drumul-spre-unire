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

const core={W,H,RATE,DEADLINE,QUOTAS,TOTAL,clamp,fmt,mkPath,at,clockParts,clockText,scoreFor};
const DSU=root.DSU||(root.DSU={});
DSU.core=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
})(typeof window!=='undefined'?window:globalThis);
