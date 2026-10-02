/* Harta regiunii: camera, stratul static (hârtia și provinciile) și desenul de pe fiecare cadru
   (granița, râurile, drumurile, căile ferate, orașele, traseele provinciei alese), plus etichetele pe niveluri,
   atingerile (hit) și textul fișelor (info). Coordonatele vin din DSU.geo.
   Liniile se desenează la fiecare cadru, ca să rămână clare și la zoom mare. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const core=DSU.core||require('./core.js');
const geo=DSU.geo||require('./geo.js');
const {clamp}=core;
const {RW,RH}=geo;

/* ---------- camera ---------- */
const MAXK=6; // closest zoom, as a multiple of the zoom that shows all four provinces
const cam={x:RW/2,y:RH/2,z:1,minZ:1};
let vw=0,vh=0,placed=false;
function resize(w,h){
  vw=w;vh=h;cam.minZ=Math.min(vw/RW,vh/RH);
  if(!placed){cam.z=cam.minZ;placed=true}
  cam.z=clamp(cam.z,cam.minZ,cam.minZ*MAXK);clampCam();
}
// margin: how far past the map edge the view may go, in screen pixels (lets towns come out from under the HUD)
function clampCam(margin=90){
  const m=margin/cam.z,hw=vw/2/cam.z,hh=vh/2/cam.z;
  const fit=(v,half,size)=>{const lo=half-m,hi=size-half+m;return lo<=hi?clamp(v,lo,hi):size/2};
  cam.x=fit(cam.x,hw,RW);cam.y=fit(cam.y,hh,RH);
}
function pan(dx,dy){cam.x-=dx/cam.z;cam.y-=dy/cam.z;clampCam()}
function zoomAt(sx,sy,f){
  const wx=cam.x+(sx-vw/2)/cam.z,wy=cam.y+(sy-vh/2)/cam.z;
  cam.z=clamp(cam.z*f,cam.minZ,cam.minZ*MAXK);
  cam.x=wx-(sx-vw/2)/cam.z;cam.y=wy-(sy-vh/2)/cam.z;clampCam();
}
const toScreen=(x,y)=>[(x-cam.x)*cam.z+vw/2,(y-cam.y)*cam.z+vh/2];

/* ---------- projected shapes ---------- */
const {TOWNS,RIVERS,BORDER_1918,REGIONS,LABELS,ROUTES,project,townXY,routePath}=geo;
const proj=pts=>pts.map(([lat,lon])=>project(lat,lon));
const RIV=RIVERS.map(r=>({major:!!r.major,pts:proj(r.pts)}));
const BORDER=proj(BORDER_1918);
// the Kingdom of Romania: from the border to the map edge, closed along the Danube below Orșova
const KINGDOM=proj([...BORDER_1918,[44.63,22.66],[44.60,22.70],[44.60,26.30],[47.10,26.30]]);
const REG=Object.fromEntries(Object.entries(REGIONS).map(([k,v])=>[k,proj(v)]));
const LAB=LABELS.map(l=>{const [x,y]=project(l.lat,l.lon);return{...l,x,y}});
// every road and rail segment once, even where two provinces share it
function edges(kind){
  const seen=new Set(),out=[];
  for(const p in ROUTES){const r=ROUTES[p][kind];
    for(let i=1;i<r.length;i++){const k=[r[i-1],r[i]].sort().join('-');if(!seen.has(k)){seen.add(k);out.push([townXY(r[i-1]),townXY(r[i])])}}}
  return out;
}
const ROADS=edges('road'),RAILS=edges('rail');

/* ---------- static layer ---------- */
const RS=.8; // static layer resolution, in pixels per world unit
let layer=null,cols={};
function poly(g,pts,close=true){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);if(close)g.closePath()}
// cols: province colours by key; makeCanvas lets Node tests pass a fake canvas
function init({cols:c,makeCanvas=()=>document.createElement('canvas')}){
  cols=c;layer=makeCanvas();
  layer.width=Math.round(RW*RS);layer.height=Math.round(RH*RS);
  const g=layer.getContext('2d');g.setTransform(RS,0,0,RS,0,0);
  g.fillStyle='#e9dcbc';g.fillRect(0,0,RW,RH);
  // paper grain, seeded so it is the same on every load
  let s=11;const r=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646};
  for(let i=0;i<2600;i++){g.fillStyle=`rgba(120,90,50,${.03+r()*.05})`;g.fillRect(r()*RW,r()*RH,1+r()*3,1+r()*3)}
  poly(g,KINGDOM);g.fillStyle='rgba(90,110,70,.12)';g.fill();
  // the four regions: a wash in the province colour; the wide stroke blurs the approximate edges
  g.lineJoin='round';
  for(const k in REG){poly(g,REG[k]);g.globalAlpha=.16;g.fillStyle=cols[k];g.fill();g.globalAlpha=.3;g.strokeStyle=cols[k];g.lineWidth=14;g.stroke()}
  g.globalAlpha=1;
}

/* ---------- per frame ---------- */
function line(g,pts,w,col,dash,off){poly(g,pts,false);g.strokeStyle=col;g.lineWidth=w;g.setLineDash(dash||[]);g.lineDashOffset=off||0;g.stroke();g.setLineDash([])}
// sel: the selected province key or null; clock: seconds, animates the dashes
function draw(g,{sel=null,clock=0}={}){
  g.fillStyle='#2a261f';g.fillRect(0,0,vw,vh);
  g.save();g.translate(vw/2,vh/2);g.scale(cam.z,cam.z);g.translate(-cam.x,-cam.y);
  if(layer)g.drawImage(layer,0,0,RW,RH);
  // widths are in screen pixels, so lines stay crisp at every zoom
  const px=1/cam.z;g.lineCap='round';g.lineJoin='round';
  for(const r of RIV)line(g,r.pts,(r.major?2.4:1.5)*px,'#6f93b0');
  line(g,BORDER,2.2*px,'#7a2a20',[8*px,4*px,1.5*px,4*px]);
  for(const e of ROADS)line(g,e,1.6*px,'rgba(122,92,48,.8)');
  for(const e of RAILS){line(g,e,3.2*px,'#2a2018');line(g,e,1.4*px,'#efe3c6',[5*px,5*px])}
  if(sel)for(const kind of ['road','rail'])line(g,routePath(sel,kind).pts,(kind==='rail'?5:6)*px,cols[sel],[10*px,7*px],-clock*28*px);
  g.restore();
  labels(g);
}

/* ---------- labels and taps ---------- */
const TIER2=1.8; // tier 2 towns get a label from this zoom multiple on
let hits=[];
const zoomK=()=>cam.z/cam.minZ;
function visibleTowns(k){return Object.keys(TOWNS).filter(t=>TOWNS[t].tier===1||(TOWNS[t].tier===2&&k>=TIER2))}
function labels(g){
  hits=[];const k=zoomK(),A=g.globalAlpha; // A: the caller's opacity, e.g. mid-crossfade
  g.save();g.textBaseline='middle';g.lineJoin='round';
  // region names: large and faint; they fade out between 2.5× and 4× and stop taking taps once faint
  const a=clamp((4-k)/1.5,0,1);
  if(a>0){g.textAlign='center';
    for(const l of LAB){const [sx,sy]=toScreen(l.x,l.y),fs=l.prov?26:18,text=l.prov?l.name.toUpperCase():l.name;
      g.globalAlpha=A*a*(l.prov?.75:.6);g.font=`${l.prov?'700':'italic 600'} ${fs}px "Cormorant SC",Georgia,serif`;
      g.fillStyle=l.prov?'#3a2a14':'#4a5a3a';g.fillText(text,sx,sy);
      if(l.prov&&a>.3){const w=g.measureText(text).width;hits.push({kind:'prov',key:l.prov,x:sx-w/2,y:sy-fs/2,w,h:fs})}}
    g.globalAlpha=A}
  g.textAlign='left';
  // Alba Iulia last, so it is drawn on top and wins the tap where labels overlap
  for(const t of visibleTowns(k).sort((p,q)=>(p==='albaIulia')-(q==='albaIulia'))){const T=TOWNS[t],[sx,sy]=toScreen(...townXY(t));
    if(sx<-100||sx>vw+100||sy<-30||sy>vh+30)continue;
    const main=t==='albaIulia',r=main?6:T.tier===1?4:3,fs=main?17:T.tier===1?14:12;
    g.fillStyle=main?'#7a2a20':'#2a2018';g.beginPath();g.arc(sx,sy,r,0,7);g.fill();
    if(main){g.strokeStyle='#7a2a20';g.lineWidth=1.5;g.beginPath();g.arc(sx,sy,r+3.5,0,7);g.stroke()}
    g.font=`700 ${fs}px "Cormorant SC",Georgia,serif`;
    const tx=sx+r+5;g.lineWidth=3.5;g.strokeStyle='rgba(233,220,188,.9)';g.strokeText(T.name,tx,sy);
    g.fillStyle=main?'#7a2a20':'#2a2018';g.fillText(T.name,tx,sy);
    const w=g.measureText(T.name).width;hits.push({kind:'town',key:t,x:sx-r-6,y:sy-14,w:w+2*r+17,h:28});
  }
  g.restore();
}
// screen point → {kind:'town'|'prov', key} of the label under it, or null; towns win over region names
function hit(x,y){
  const h=hits.slice().reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
  return h?{kind:h.kind,key:h.key}:null;
}

/* ---------- info cards ---------- */
const {QUOTAS}=core;
// text for the info card of a town or a province; the official 1918 name goes here, not on the map
function info({kind,key}){
  if(kind==='town'){const t=TOWNS[key];
    const name=t.official===t.name?`Numele oficial din 1918 era tot ${t.name}.`:`În 1918, numele oficial era cel maghiar, ${t.official}.`;
    const extra=key==='albaIulia'?' Aici se va ține Marea Adunare Națională, pe 1 decembrie. Atinge „Oraș” ca să vezi cetatea.':'';
    return{eyebrow:'Harta regiunii · noiembrie 1918',title:t.name,text:name+extra}}
  const l=LABELS.find(x=>x.prov===key);
  return{eyebrow:'Provincie istorică',title:l.name,text:`Din ${l.name} vin la Alba Iulia ${QUOTAS[key]} de delegați. Conturul de pe hartă e aproximativ: arată regiunea istorică, nu o graniță administrativă.`};
}

/* ---------- export ---------- */
const region={cam,resize,pan,zoomAt,toScreen,MAXK,ROADS,RAILS,init,draw,visibleTowns,TIER2,hit,info};
DSU.region=region;
if(typeof module!=='undefined'&&module.exports)module.exports=region;
})(typeof window!=='undefined'?window:globalThis);
