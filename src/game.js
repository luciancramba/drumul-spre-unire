(()=>{
const W=1600,H=1067,BGS=1.4;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString('ro-RO');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let seed=1918;const sr=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
const pick=(a,r=Math.random)=>a[Math.floor(r()*a.length)];

/* ---------- geometry ---------- */
function mkPath(pts){const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return{pts,L,len:L[L.length-1]}}
function at(p,d){d=clamp(d,0,p.len);let i=1;while(i<p.L.length-1&&p.L[i]<d)i++;const a=p.pts[i-1],b=p.pts[i],s=(p.L[i]-p.L[i-1])||1,t=(d-p.L[i-1])/s;return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,ang:Math.atan2(b[1]-a[1],b[0]-a[0])}}
function distSeg(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1;let t=((x-a[0])*dx+(y-a[1])*dy)/l;t=clamp(t,0,1);return Math.hypot(x-(a[0]+dx*t),y-(a[1]+dy*t))}
function distPoly(x,y,pts){let m=1e9;for(let i=1;i<pts.length;i++)m=Math.min(m,distSeg(x,y,pts[i-1],pts[i]));return m}
function bez(p0,p1,p2,p3,n){const o=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push([u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]])}return o}

const CIT=[[958,505],[885,490],[760,485],[645,480],[520,480],[395,478],[330,495]];
const P={
  roadMM:mkPath([[1180,-10],[1172,110],[1150,230],[1140,270],[1080,370],[1010,450],[975,495],...CIT]),
  roadCR:mkPath([[-10,425],[150,440],[300,470],[330,492]]),
  roadBN:mkPath([[-10,1012],[110,935],[200,780],[250,660],[300,560],[322,505]]),
  roadTR:mkPath([[1010,1080],[1005,900],[990,720],[985,600],[972,540],...CIT]),
  walk:mkPath([[1284,575],[1200,600],[1100,580],[1000,545],...CIT]),
  railW:mkPath([[1282,1100],[1287,900],[1293,700],[1297,610]]),
  railE:mkPath([[1310,-40],[1303,300],[1299,520]]),
};
const F={x:645,y:500,R:258,sq:.8};
const FIELD={x:235,y:585,rx:135,ry:165};
const TRIB={x:243,y:465};
const TRIBS=[[298,432],[243,465],[163,512],[213,555],[265,613]];
const STATION={x:1325,y:555};

const PROV={
  MM:{name:'Maramureș',quota:140,road:'roadMM',rail:'E',col:'#5b86d6',via:'Baia Mare · Dej · Cluj · Teiuș'},
  CR:{name:'Crișana',quota:260,road:'roadCR',rail:'E',col:'#e2b21f',via:'Oradea · Munții Apuseni · Zlatna'},
  BN:{name:'Banat',quota:300,road:'roadBN',rail:'W',col:'#d4574c',via:'Timișoara · Arad · Deva · Vințu de Jos'},
  TR:{name:'Transilvania',quota:528,road:'roadTR',rail:'W',col:'#7fb069',via:'Brașov · Sibiu · Sebeș'},
};
const PKEYS=['MM','CR','BN','TR'];
const TOTAL=1228;
const RATE=7; // game minutes per real second
const DEADLINE=1680; // 1 Dec 10:00 measured from 30 Nov 06:00

/* ---------- canvas ---------- */
const canvas=$('scene'),ctx=canvas.getContext('2d');
const bg=document.createElement('canvas');
const crowdL=document.createElement('canvas');
const cg=crowdL.getContext('2d');
let vw=0,vh=0,dpr=1;
const cam={x:760,y:470,z:1,minZ:1,anim:null};
let camInit=false;
function resize(){
  dpr=Math.min(2,window.devicePixelRatio||1);
  vw=canvas.clientWidth;vh=canvas.clientHeight;
  canvas.width=Math.round(vw*dpr);canvas.height=Math.round(vh*dpr);
  cam.minZ=Math.max(vw/W,vh/H);
  if(!camInit){cam.z=cam.minZ*(vw>vh?1.3:1.1);cam.x=vw>vh?700:560;cam.y=540;camInit=true}
  cam.z=clamp(cam.z,cam.minZ,cam.minZ*3.4);
  clampCam();
}
function clampCam(){const m=90/cam.z,hw=vw/2/cam.z,hh=vh/2/cam.z;cam.x=clamp(cam.x,hw-m,W-hw+m);cam.y=clamp(cam.y,hh-m*1.4,H-hh+m*1.4)}
function zoomAt(sx,sy,f){const wx=cam.x+(sx-vw/2)/cam.z,wy=cam.y+(sy-vh/2)/cam.z;cam.z=clamp(cam.z*f,cam.minZ,cam.minZ*3.4);cam.x=wx-(sx-vw/2)/cam.z;cam.y=wy-(sy-vh/2)/cam.z;clampCam()}
const ptrs=new Map();let pinchD=0;
let tap=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});cam.anim=null;tap=ptrs.size===1?{x:e.clientX,y:e.clientY}:null});
canvas.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId);if(!p)return;
  if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>=7)tap=null;
  if(ptrs.size===1){cam.x-=(e.clientX-p.x)/cam.z;cam.y-=(e.clientY-p.y)/cam.z;clampCam()}
  p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchD)zoomAt((a.x+b.x)/2,(a.y+b.y)/2,d/pinchD);pinchD=d}
});
const up=e=>{ptrs.delete(e.pointerId);pinchD=0;if(tap&&e.type==='pointerup'&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<7&&!modalOpen){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const h=labelHits.slice().reverse().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(h)showLandmark(h.l)}tap=null};
canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015))},{passive:false});

/* ---------- background painting ---------- */
function poly(g,pts){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath()}
function line(g,pts,w,col,dash){g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.strokeStyle=col;g.lineWidth=w;g.setLineDash(dash||[]);g.stroke();g.setLineDash([])}
function star(scale,dy=0){const o=[];for(let i=0;i<7;i++){const a=-Math.PI/2+i*2*Math.PI/7;for(const [da,r] of [[-.30,.66],[-.215,.78],[0,1],[.215,.78],[.30,.66]])o.push([F.x+Math.cos(a+da)*F.R*r*scale,F.y+Math.sin(a+da)*F.R*r*scale*F.sq+dy])}return o}
function inFort(x,y,s=1){return Math.hypot((x-F.x)/(F.R*s),(y-F.y)/(F.R*F.sq*s))<1}
function inField(x,y,s=1.45){return Math.hypot((x-FIELD.x)/(FIELD.rx*s),(y-FIELD.y)/(FIELD.ry*s))<1}

const MAP_SRC='assets/map-1918.jpg';
const mapImg=new Image();
function renderBG(){
  bg.width=Math.round(W*BGS);bg.height=Math.round(H*BGS);
  const g=bg.getContext('2d');g.setTransform(BGS,0,0,BGS,0,0);
  g.drawImage(mapImg,0,0,W,H);
  // soft wash so figures and roads read over the snow
  g.fillStyle='rgba(60,48,32,.06)';g.fillRect(0,0,W,H);
}
const ch_list=[[1050,420],[1120,520],[980,640],[1080,700],[1180,760],[900,860],[1060,960],[620,380],[560,560]];

/* ---------- people ---------- */
const CLOTH=['#2b2520','#3a332b','#e8e0cc','#6b4a2e','#1e2a3a','#151311','#4a3b2b','#e3dac4','#5a2a22','#2f3a2c'];
function person(g,x,y,col,hat,flag,s=1.3){
  g.fillStyle='rgba(40,32,24,.22)';g.fillRect(x-1.2*s,y-.3*s,3*s,1*s);
  g.fillStyle=col;g.fillRect(x-.95*s,y-4.2*s,1.9*s,4.2*s);
  g.fillStyle='#c9a07c';g.fillRect(x-.65*s,y-5.5*s,1.3*s,1.3*s);
  if(hat){g.fillStyle='#1b1714';g.fillRect(x-1*s,y-6*s,2*s,.8*s)}
  if(flag){g.fillStyle='#3a2c1e';g.fillRect(x+.9*s,y-11*s,.4*s,8*s);g.fillStyle='#2c4d9c';g.fillRect(x+1.3*s,y-11*s,1.4*s,2.9*s);g.fillStyle='#e2b21f';g.fillRect(x+2.7*s,y-11*s,1.4*s,2.9*s);g.fillStyle='#b3302a';g.fillRect(x+4.1*s,y-11*s,1.4*s,2.9*s)}
}
function cart(g,x,y,dir,t){
  g.save();g.translate(x,y);g.scale(dir*1.35,1.35);
  g.fillStyle='rgba(40,32,24,.25)';g.beginPath();g.ellipse(0,.5,11,2,0,0,7);g.fill();
  const b=Math.sin(t*9)*.4;
  g.fillStyle='#4a3322';g.fillRect(4,-5.5+b,7,3.4);g.fillRect(10,-7.5+b,2.4,3.2);
  g.strokeStyle='#3a281a';g.lineWidth=.8;g.beginPath();g.moveTo(5,-2);g.lineTo(5,0);g.moveTo(10,-2);g.lineTo(10,0);g.stroke();
  g.fillStyle='#6b4a2e';g.fillRect(-10,-4.5,12,3);
  g.fillStyle='#e6dfcf';g.beginPath();g.moveTo(-10,-4.5);g.quadraticCurveTo(-4,-11,2,-4.5);g.fill();
  g.fillStyle='#2c4d9c';g.fillRect(-6,-8.2,1.2,2);g.fillStyle='#e2b21f';g.fillRect(-4.8,-8.2,1.2,2);g.fillStyle='#b3302a';g.fillRect(-3.6,-8.2,1.2,2);
  g.fillStyle='#2a211a';g.beginPath();g.arc(-7,-.8,1.8,0,7);g.arc(0,-.8,1.8,0,7);g.fill();
  g.restore();
}

/* ---------- crowd field spots ---------- */
let spots=[];let spotIdx=0;
function makeSpots(){spots=[];let s2=77;const r=()=>{s2=(s2*16807)%2147483647;return (s2-1)/2147483646};
  for(let i=0;i<9000;i++){const a=r()*Math.PI*2,rr=Math.sqrt(r())*1.18;const x=FIELD.x+Math.cos(a)*rr*FIELD.rx,y=FIELD.y+Math.sin(a)*rr*FIELD.ry;
    if(x<92||x>420||inFort(x,y,1.12))continue;if(TRIBS.some(t=>Math.hypot(x-t[0],(y-t[1])*1.6)<16))continue;spots.push({x,y,k:rr+r()*.14,c:pick(CLOTH,r),h:r()<.45,f:r()<.035})}
  spots.sort((a,b)=>a.k-b.k);}
function resetCrowdLayer(){crowdL.width=Math.round(W*BGS);crowdL.height=Math.round(H*BGS);cg.setTransform(BGS,0,0,BGS,0,0);spotIdx=0}
const PER_STAMP=25;
function stamp(n){for(let i=0;i<n&&spotIdx<spots.length;i++){const s=spots[spotIdx++];person(cg,s.x,s.y,s.c,s.h,s.f,1.15)}}

/* ---------- game state ---------- */
let S,rt=0,speed=1,paused=false,modalOpen=false;
function newState(){
  const s={t:0,prov:120,infl:60,moral:70,del:{MM:0,CR:0,BN:0,TR:0},sent:{MM:0,CR:0,BN:0,TR:0},crowd:0,
    walkers:[],trains:[],blocks:{},guards:{},sel:'TR',nextEvent:16,running:false,over:false,facts:[],recent:[],spont:0,firstTrain:false,negotiated:false,half:false,trainBonus:{}};
  return s;
}
const smoke=[];const flakes=[];
for(let i=0;i<150;i++)flakes.push({x:Math.random(),y:Math.random(),v:.02+Math.random()*.05,r:.6+Math.random()*1.6,p:Math.random()*6});

function blockKeyRoad(p){return 'road:'+p}
function blockKeyRail(p){return 'rail:'+PROV[p].rail}
function isBlocked(k){return !!S.blocks[k]}
function isGuarded(k){return (S.guards[k]||0)>rt}

function addWalker(path,opts){S.walkers.push(Object.assign({path,d:0,lat:(Math.random()-.5)*7,sp:21+Math.random()*6,col:pick(CLOTH),hat:Math.random()<.45,flag:Math.random()<.07,people:100,del:0,prov:null,kind:'p',block:null,state:'walk'},opts))}

/* ---------- actions ---------- */
function remaining(p){return PROV[p].quota-S.sent[p]}
function sendDelegation(){
  const p=S.sel,pr=PROV[p];
  if(remaining(p)<=0)return toast(`Toți delegații din ${pr.name} sunt deja pe drum.`,'bad');
  if(isBlocked(blockKeyRoad(p)))return toast(`Drumul din ${pr.name} e blocat. Negociază sau protejează traseul.`,'bad');
  if(S.infl<12)return toast('Nu ai destulă Influență. Așteaptă sau adu delegați ca să crească moralul.','bad');
  S.infl-=12;const n=Math.min(30,remaining(p));S.sent[p]+=n;
  const path=P[pr.road],key=blockKeyRoad(p);
  addWalker(path,{kind:'cart',d:0,lat:0,sp:20,del:n,people:0,prov:p,block:key});
  const k=24;for(let i=0;i<k;i++)addWalker(path,{d:-8-i*7-Math.random()*4,prov:p,block:key,people:100,flag:Math.random()<.14});
  toast(`O delegație de <b>${n}</b> pleacă din ${pr.name}.`);
  flash('aDel');
}
function organizeTrain(){
  const p=S.sel,pr=PROV[p],side=pr.rail;
  if(remaining(p)<=0)return toast(`Toți delegații din ${pr.name} sunt deja pe drum.`,'bad');
  if(S.trains.some(t=>t.side===side))return toast(`Linia ${side==='W'?'Vințu de Jos – Alba Iulia':'Teiuș – Alba Iulia'} e ocupată. Așteaptă să ajungă trenul.`,'bad');
  if(isBlocked('rail:'+side))return toast('Calea ferată e blocată. Rezolvă problema mai întâi.','bad');
  if(S.prov<45)return toast('Nu ai destule Provizii pentru un tren special.','bad');
  S.prov-=45;const n=Math.min(120,remaining(p));S.sent[p]+=n;
  const bonus=S.trainBonus[side]||0;S.trainBonus[side]=0;
  S.trains.push({side,path:side==='W'?P.railW:P.railE,d:0,state:'run',n,people:6500+bonus,prov:p,unload:0,alpha:1,cars:6,smokeT:0});
  toast(`Tren special cu <b>${n}</b> delegați din ${pr.name} pe ruta ${pr.via}.`);
  flash('aTrain');
}
function protect(){
  const p=S.sel,pr=PROV[p];
  if(S.prov<25)return toast('Nu ai destule Provizii pentru gărzi.','bad');
  S.prov-=25;const until=rt+45;S.guards[blockKeyRoad(p)]=until;S.guards[blockKeyRail(p)]=until;S.moral=Math.min(100,S.moral+4);
  toast(`Gărzile Naționale păzesc traseele din ${pr.name} pentru 45 de secunde.`,'good');
  flash('aGuard');
}
function negotiate(){
  const p=S.sel,pr=PROV[p];
  if(S.infl<20)return toast('Nu ai destulă Influență pentru negocieri.','bad');
  S.infl-=20;
  const keys=[blockKeyRoad(p),blockKeyRail(p)].filter(isBlocked);
  if(keys.length){keys.forEach(k=>delete S.blocks[k]);toast(`Negociere reușită: traseele din ${pr.name} sunt libere.`,'good')}
  else{S.moral=Math.min(100,S.moral+10);toast(`Ai vorbit cu preoții, învățătorii și primarii din ${pr.name}. Moral +10.`,'good')}
  if(!S.negotiated){S.negotiated=true;unlock('arad')}
  flash('aNeg');
}
function flash(id){const b=$(id);b.classList.remove('flash');void b.offsetWidth;b.classList.add('flash')}

/* ---------- events ---------- */
const EVENTS=[
 {id:'snowMM',target:'road:CR',short:'viscol',stamp:'Telegramă · Zlatna',title:'Viscol în Munții Apuseni',text:'Zăpada a acoperit drumul prin Munții Apuseni. Căruțele moților și ale delegaților din Crișana s-au oprit în troiene.',
  choices:[{t:'Trimite oameni cu lopeți',cost:{prov:25},unblock:1,after:'Drumul prin Apuseni e deszăpezit.'},{t:'Așteaptă să se oprească ninsoarea',blockFor:28,moral:-4,after:'Coloanele așteaptă în sate.'}]},
 {id:'coalE',target:'rail:E',short:'fără cărbune',stamp:'Telegramă · gara Teiuș',title:'Locomotiva a rămas fără cărbune',text:'La Teiuș, trenurile dinspre Cluj și Oradea stau pe linie. Mecanicii cer cărbune ca să ajungă la Alba Iulia.',
  choices:[{t:'Folosește cărbunele armatei',cost:{prov:40},unblock:1,after:'Trenurile pornesc din Teiuș.'},{t:'Negociază cu ceferiștii',cost:{infl:15},unblockAfter:8,after:'Ceferiștii aduc cărbune în câteva minute.'},{t:'Așteaptă cărbune de la Cluj',blockFor:30,moral:-4,after:'Trenurile așteaptă în gara Teiuș.'}]},
 {id:'bridgeTR',target:'road:MM',short:'pod aglomerat',stamp:'Raport · Garda Națională',title:'Podul de peste Ampoi',text:'Mii de oameni și căruțe venite dinspre Teiuș se înghesuie pe podul de lemn peste Ampoi. Podul trebuie eliberat înainte să cedeze.',
  choices:[{t:'Gărzile dirijează trecerea',cost:{prov:20},unblock:1,moral:3,after:'Trecerea peste Ampoi e organizată.'},{t:'Coloanele ocolesc prin vad',blockFor:24,after:'Ocolul prin vad durează.'}]},
 {id:'gardaW',target:'rail:W',short:'oprire la Deva',stamp:'Telegramă · gara Deva',title:'Oprire la Deva',text:'Garda Națională din Deva cere hrană pentru oamenii din trenurile venite de la Arad și Timișoara.',
  choices:[{t:'Împarte provizii',cost:{prov:30},unblock:1,moral:3,after:'Trenul din Deva își continuă drumul.'},{t:'Trenul pleacă fără oprire',unblock:1,moral:-9,after:'Oamenii din tren sunt flămânzi și obosiți.'}]},
 {id:'jamBN',target:'road:BN',short:'blocaj',stamp:'Raport · drumul Vințului',title:'Blocaj pe drumul dinspre Vințu',text:'Drumul dinspre Banat e plin de căruțe. La urcarea spre platou s-a format un șir lung care nu mai înaintează.',
  choices:[{t:'Deschide un drum ocolitor pe sub cetate',cost:{infl:15},unblock:1,after:'Coloanele din Banat urcă pe drumul ocolitor.'},{t:'Așteaptă să se descongestioneze',blockFor:20,after:'Șirul de căruțe înaintează încet.'}]},
 {id:'rumor',target:null,stamp:'Știre · din sate',title:'Un zvon fals',text:'În câteva sate circulă zvonul că Adunarea ar fi fost amânată. Unii oameni vor să se întoarcă acasă.',
  choices:[{t:'Trimite curieri cu vestea corectă',cost:{infl:12},moral:6,after:'Curierii confirmă: Adunarea are loc mâine.'},{t:'Ignoră zvonul',moral:-12,after:'Moralul scade în sate.'}]},
 {id:'lodging',target:null,stamp:'Mesaj · Primăria',title:'Cazare pentru delegați',text:'Localnicii din Alba Iulia și din Maieri își deschid casele pentru oamenii veniți de departe.',
  choices:[{t:'Organizează cazarea și masa',cost:{prov:10},moral:10,after:'Oaspeții au unde să doarmă. Moral +10.'},{t:'Lasă-i să se descurce singuri',moral:3,after:'Oamenii își găsesc singuri adăpost.'}]},
 {id:'neighbors',target:null,stamp:'Întâlnire · în oraș',title:'Vecinii întreabă',text:'Vecini sași și maghiari din oraș vor să știe ce se va hotărî la Adunare și ce se întâmplă cu drepturile lor.',
  choices:[{t:'Explică-le principiile rezoluției',cost:{infl:5},infl:20,moral:3,fact:'art3',after:'Discuția aduce încredere. Influență +20.'},{t:'Nu e timp de explicații',infl:-5,after:'Neîncrederea rămâne.'}]},
 {id:'overfull',target:null,stamp:'Telegramă · gara Arad',title:'Trenurile sunt supraaglomerate',text:'La Arad, oamenii urcă și pe acoperișurile vagoanelor ca să prindă trenul spre Alba Iulia.',
  choices:[{t:'Adaugă vagoane la următorul tren',cost:{prov:20},bonusW:3000,after:'Următorul tren dinspre Deva aduce 3.000 de oameni în plus.'},{t:'Oprește urcarea pe acoperiș',moral:-3,after:'Trenul pleacă mai sigur, dar cu mai puțini oameni.'}]},
];
function eligible(ev){
  if(S.recent.includes(ev.id))return false;
  if(!ev.target)return true;
  if(isBlocked(ev.target)||isGuarded(ev.target))return false;
  return true;
}
function triggerEvent(){
  const list=EVENTS.filter(eligible);if(!list.length)return;
  const ev=pick(list);S.recent.push(ev.id);if(S.recent.length>4)S.recent.shift();
  if(ev.target)S.blocks[ev.target]={until:Infinity,label:ev.short};
  showEvent(ev);
}
function canPay(c){return !c||((c.prov||0)<=S.prov&&(c.infl||0)<=S.infl)}
function showEvent(ev){
  const card=$('card');
  card.innerHTML=`<span class="telegram">${ev.stamp} · ${clockText().split(' · ')[1]}</span><h2>${ev.title}</h2><p>${ev.text}</p><div class="choices"></div>`;
  const box=card.querySelector('.choices');
  ev.choices.forEach((ch,i)=>{const b=document.createElement('button');b.className='choice';
    const costs=[];if(ch.cost?.prov)costs.push(`−${ch.cost.prov} Provizii`);if(ch.cost?.infl)costs.push(`−${ch.cost.infl} Influență`);if(ch.moral<0)costs.push(`${ch.moral} Moral`);if(ch.blockFor)costs.push(`blocat ${ch.blockFor} s`);if(!costs.length)costs.push('gratuit');
    b.innerHTML=`<span>${ch.t}</span><span class="cost">${costs.join(' · ')}</span>`;
    if(!canPay(ch.cost))b.disabled=true;
    b.onclick=()=>{resolve(ev,ch);closeModal()};box.appendChild(b)});
  openModal();
  setTimeout(()=>box.querySelector('button:not([disabled])')?.focus(),50);
}
function resolve(ev,ch){
  if(ch.cost){S.prov-=ch.cost.prov||0;S.infl-=ch.cost.infl||0}
  if(ch.moral)S.moral=clamp(S.moral+ch.moral,0,100);
  if(ch.infl)S.infl=Math.max(0,S.infl+ch.infl);
  if(ev.target){if(ch.unblock)delete S.blocks[ev.target];else if(ch.blockFor)S.blocks[ev.target].until=rt+ch.blockFor;else if(ch.unblockAfter)S.blocks[ev.target].until=rt+ch.unblockAfter}
  if(ch.bonusW)S.trainBonus.W=(S.trainBonus.W||0)+ch.bonusW;
  if(ch.fact)unlock(ch.fact);
  toast(ch.after,ch.moral<0||ch.blockFor?'bad':'good');
}

/* ---------- chronicle ---------- */
const FACTS={
  conv:{title:'20 noiembrie 1918 · Convocarea',text:'Consiliul Național Român Central, cu sediul la Arad, convoacă Marea Adunare Națională la Alba Iulia pentru 1 decembrie. În fiecare cerc electoral se aleg câte cinci delegați.'},
  bucovina:{title:'28 noiembrie 1918 · Cernăuți',text:'Congresul General al Bucovinei votează unirea cu România, cu trei zile înainte de Adunarea de la Alba Iulia.'},
  basarabia:{title:'27 martie 1918 · Chișinău',text:'Sfatul Țării votează unirea Basarabiei cu România. Alba Iulia completează un proces început în primăvară.'},
  train:{title:'Trenurile Unirii',text:'Cei mai mulți participanți au ajuns cu trenuri speciale. Gărzile Naționale române au păzit gările și drumurile și au ținut ordinea.'},
  arad:{title:'13–14 noiembrie · Tratativele de la Arad',text:'Consiliul Național Român a cerut întreaga putere de guvernare în ținuturile locuite de români. Guvernul de la Budapesta, reprezentat de Jászi Oszkár, a oferit doar o autonomie limitată. Tratativele au eșuat.'},
  night:{title:'Noaptea de 30 noiembrie',text:'Trenurile sosesc toată noaptea. Oamenii dorm în gări, în vagoane și în casele localnicilor din Alba Iulia.'},
  half:{title:'Cine sunt delegații',text:'Pe lângă cei aleși în cercurile electorale, au venit delegați ai bisericilor, ai asociațiilor culturale, ai școlilor, ai Gărzilor Naționale și ai tineretului.'},
  art3:{title:'Rezoluția, punctul III',text:'Rezoluția promitea deplină libertate națională pentru toate popoarele conlocuitoare, egalitate pentru toate confesiunile, vot universal și reformă agrară.'},
  dawn:{title:'1 Decembrie, dimineața',text:'Coloanele urcă spre Câmpul lui Horea cu steaguri tricolore și cu table pe care sunt scrise numele satelor din care vin.'},
};
const FACT_ORDER=['conv','basarabia','bucovina','arad','train','night','half','art3','dawn'];
function unlock(id){if(S.facts.includes(id))return;S.facts.push(id);$('btnChron').classList.add('new');
  const el=toast(`<b>Cronica:</b> ${FACTS[id].title}`,'fact');if(el)el.onclick=()=>showChronicle()}
function showChronicle(){
  $('btnChron').classList.remove('new');
  const got=FACT_ORDER.filter(k=>S.facts.includes(k));
  $('card').innerHTML=`<div class="eyebrow">Cronica Unirii</div><h2>Ce s-a întâmplat de fapt</h2>
  <div class="facts">${got.map(k=>`<div class="fact"><h3>${FACTS[k].title}</h3><p>${FACTS[k].text}</p></div>`).join('')}</div>
  ${got.length<FACT_ORDER.length?`<p class="locked">Mai ai ${FACT_ORDER.length-got.length} pagini de descoperit jucând.</p>`:''}
  <div class="row"><button class="btn" id="cClose">Înapoi la joc</button></div>`;
  $('cClose').onclick=closeModal;openModal();
}

/* ---------- modal & toasts ---------- */
function openModal(){$('modal').hidden=false;modalOpen=true}
function closeModal(){$('modal').hidden=true;modalOpen=false}
function toast(html,kind=''){const box=$('toasts');const d=document.createElement('div');d.className='toast '+kind;d.innerHTML=html;box.appendChild(d);
  while(box.children.length>3)box.firstChild.remove();setTimeout(()=>d.remove(),kind==='fact'?6000:3800);return d}

/* ---------- time ---------- */
function clockParts(){const m=6*60+Math.floor(S?S.t:0);const day=m<1440?30:1;const hm=m%1440;const hh=String(Math.floor(hm/60)).padStart(2,'0'),mm=String(hm%60).padStart(2,'0');return{day,hh,mm}}
function clockText(){const c=clockParts();return `${c.day===30?'30 noiembrie':'1 decembrie'} 1918 · ${c.hh}:${c.mm}`}

/* ---------- update ---------- */
function arrive(w){
  if(w.kind==='cart'){S.del[w.prov]+=w.del;S.moral=Math.min(100,S.moral+3);toast(`Au sosit <b>${w.del}</b> delegați din ${PROV[w.prov].name}.`,'good');return true}
  if(w.del){S.del[w.prov]+=w.del;S.moral=Math.min(100,S.moral+5);toast(`Trenul a adus <b>${w.del}</b> delegați din ${PROV[w.prov].name}.`,'good')}
  if(w.people>0&&spotIdx<spots.length){const s=spots[Math.min(spotIdx,spots.length-1)];w.state='settle';w.fx=w.x;w.fy=w.y;w.tx=s.x;w.ty=s.y;w.st=0;return false}
  S.crowd+=w.people;return true;
}
function update(dt){
  if(!S.running)return;
  rt+=dt;S.t+=dt*RATE;
  const mf=.55+S.moral/150;
  S.prov=Math.min(400,S.prov+2.1*mf*dt);S.infl=Math.min(250,S.infl+1.05*mf*dt);S.moral=clamp(S.moral-.13*dt,0,100);
  for(const k in S.blocks)if(S.blocks[k].until<=rt){delete S.blocks[k];toast('Un traseu s-a eliberat.','good')}
  // spontaneous crowds
  S.spont+=dt*(.45+S.moral/110);
  while(S.spont>=1){S.spont-=1;const p=pick(PKEYS);const key=blockKeyRoad(p);if(!isBlocked(key))addWalker(P[PROV[p].road],{prov:p,block:key,people:100})}
  const spd=.7+S.moral/250;
  for(let i=S.walkers.length-1;i>=0;i--){const w=S.walkers[i];
    if(w.state==='settle'){w.st+=dt/1.1;w.x=w.fx+(w.tx-w.fx)*Math.min(1,w.st);w.y=w.fy+(w.ty-w.fy)*Math.min(1,w.st);
      if(w.st>=1){S.crowd+=w.people;stamp(Math.round(w.people/PER_STAMP));S.walkers.splice(i,1)}continue}
    const blocked=w.block&&isBlocked(w.block)&&w.d>w.path.len*.04&&w.d<w.path.len*.24;
    if(!blocked){const g=w.block&&isGuarded(w.block)?1.4:1;w.d+=w.sp*spd*g*dt}
    const q=at(w.path,Math.max(0,w.d));w.x=q.x-Math.sin(q.ang)*w.lat;w.y=q.y+Math.cos(q.ang)*w.lat;w.dir=Math.cos(q.ang)>=0?1:-1;
    if(w.d>=w.path.len){if(arrive(w))S.walkers.splice(i,1)}
  }
  for(let i=S.trains.length-1;i>=0;i--){const t=S.trains[i];
    if(t.state==='run'){const blk=isBlocked('rail:'+t.side)&&t.d<t.path.len*.8;if(!blk)t.d+=(isGuarded('rail:'+t.side)?92:70)*dt*spd;
      t.smokeT-=dt;if(t.smokeT<=0&&!blk){t.smokeT=.07;const h=at(t.path,t.d);smoke.push({x:h.x,y:h.y-14,vx:(Math.random()-.5)*6,vy:-10-Math.random()*6,r:2.5,life:1})}
      if(t.d>=t.path.len){t.d=t.path.len;t.state='unload';t.unload=0;t.spawned=0;if(!S.firstTrain){S.firstTrain=true;unlock('train')}}}
    else if(t.state==='unload'){t.unload+=dt;const total=Math.round(t.people/100);const want=Math.min(total,Math.floor(t.unload/2.6*total));
      while(t.spawned<want){t.spawned++;addWalker(P.walk,{d:-Math.random()*10,prov:t.prov,people:100,del:t.spawned===Math.ceil(total*.6)?t.n:0,flag:Math.random()<.1})}
      if(t.unload>2.8){t.state='leave'}}
    else{t.alpha-=dt*.9;if(t.alpha<=0)S.trains.splice(i,1)}
  }
  // milestones
  if(S.t>=360)unlock('basarabia');if(S.t>=150)unlock('bucovina');if(S.t>=720)unlock('night');if(S.t>=1440)unlock('dawn');
  const tot=sumDel();if(!S.half&&tot>=614){S.half=true;unlock('half')}
  if(rt>=S.nextEvent){S.nextEvent=rt+15+Math.random()*9;triggerEvent()}
  if(S.t>=DEADLINE)endGame();
}
function sumDel(){return PKEYS.reduce((a,k)=>a+S.del[k],0)}
function updateSmoke(dt){
  if(Math.random()<dt*6){const c=pick(ch_list.length?ch_list:[[300,660]]);smoke.push({x:c[0],y:c[1],vx:3+Math.random()*3,vy:-5-Math.random()*3,r:1.6,life:1,slow:1})}
  if(Math.random()<dt*3)smoke.push({x:STATION.x+20,y:STATION.y-30,vx:4,vy:-6,r:2,life:1,slow:1});
  for(let i=smoke.length-1;i>=0;i--){const s=smoke[i];s.x+=s.vx*dt;s.y+=s.vy*dt;s.r+=dt*(s.slow?3:6);s.life-=dt*(s.slow?.28:.4);if(s.life<=0)smoke.splice(i,1)}
  if(smoke.length>320)smoke.splice(0,smoke.length-320);
}

/* ---------- draw ---------- */
const LANDMARKS=[
  {t:'Cetatea Alba Carolina',x:645,y:292,big:1,info:'Cetate bastionară în formă de stea cu șapte colțuri, ridicată de austrieci între 1715 și 1738 după planurile arhitectului Giovanni Morando Visconti. În 1918 era încă garnizoană a armatei austro-ungare, cu cazărmi, depozite și ateliere.'},
  {t:'Catedrala Sf. Mihail',x:742,y:445,info:'Catedrala romano-catolică, ridicată în secolele XIII–XIV, una dintre cele mai vechi clădiri medievale din Transilvania. Aici se află mormântul atribuit lui Iancu de Hunedoara.'},
  {t:'Casina militară · Sala Unirii',x:664,y:410,info:'Clubul ofițerilor garnizoanei. Pe 1 decembrie 1918, în sala ei mare s-au adunat cei 1.228 de delegați și au votat Rezoluția Unirii. De atunci clădirea se numește Sala Unirii.'},
  {t:'Palatul Principilor',x:620,y:560,info:'Reședința principilor Transilvaniei. Aici a locuit Mihai Viteazul după ce a intrat în Alba Iulia, în 1599. În 1918 clădirea era folosită de armată.'},
  {t:'Batthyaneum',x:500,y:505,info:'Fostă biserică a trinitarienilor, transformată de episcopul Ignác Batthyány la sfârșitul secolului al XVIII-lea în bibliotecă și observator astronomic. Păstrează manuscrise medievale rare.'},
  {t:'Monumentul Losenau',x:640,y:470,info:'În piața cetății stăteau monumente ridicate de armata austriacă, precum cel dedicat colonelului Losenau, căzut în 1849. Obeliscul lui Horea, Cloșca și Crișan va fi ridicat abia în 1937, iar Catedrala Încoronării în 1921–1922, deci nu apar pe hartă.'},
  {t:'Poarta a III-a',x:885,y:490,info:'Intrarea principală a cetății, decorată bogat cu sculpturi baroce. Tradiția spune că deasupra ei a fost închis Horea în 1785. Unii istorici cred însă că celula lui era în Poarta a IV-a.'},
  {t:'Poarta I',x:958,y:505,info:'Primul arc de triumf de pe drumul care urcă din orașul de jos spre cetate. Pe aici au urcat mulți dintre oamenii veniți cu trenul.'},
  {t:'Poarta a IV-a',x:395,y:478,info:'Poarta de pe latura de vest a cetății. Dă spre platoul din spatele cetății, Câmpul lui Horea, unde s-a adunat mulțimea.'},
  {t:'Câmpul lui Horea',x:225,y:735,big:1,info:'Platoul din spatele cetății, numit după Horea, conducătorul răscoalei din 1784, executat la Alba Iulia în 1785. Pe 1 decembrie 1918, oamenii au fost așezați aici după localitățile din care veneau. De la mai multe tribune, vorbitorii au citit Rezoluția Unirii.'},
  {t:'Orașul de jos · Maieri',x:1085,y:800,info:'Orașul de jos, cu cartierul românesc Maieri. În noaptea de 30 noiembrie, localnicii au găzduit în casele lor mii de oameni veniți la Adunare.'},
  {t:'Gara Gyulafehérvár',x:1325,y:520,info:'Gara orașului, pe calea ferată Arad–Alba Iulia deschisă în 1868. În 1918 numele oficial era cel maghiar, Gyulafehérvár. Aici au sosit trenurile speciale cu participanți.'},
  {t:'Mureș',x:1470,y:420,river:1,info:'Râul Mureș. Pe valea lui trece calea ferată care leagă Alba Iulia de Teiuș, spre nord, și de Deva și Arad, spre sud-vest.'},
  {t:'Ampoi',x:520,y:222,river:1},
  {t:'din Maramureș',x:1180,y:24,edge:'MM'},
  {t:'din Crișana · Apuseni',x:92,y:405,edge:'CR'},
  {t:'din Banat',x:76,y:985,edge:'BN'},
  {t:'dinspre Sibiu · Brașov',x:1010,y:1042,edge:'TR'},
  {t:'↑ Teiuș · Cluj',x:1370,y:40,small:1},
  {t:'↓ Vințu · Deva · Arad',x:1370,y:1040,small:1},
];
let labelHits=[];
function drawLabel(l){
  const sx=(l.x-cam.x)*cam.z+vw/2,sy=(l.y-cam.y)*cam.z+vh/2;
  if(sx<-150||sx>vw+150||sy<-40||sy>vh+40)return;
  const detail=cam.z>=cam.minZ*1.25;
  if(l.info&&!l.big&&!l.river&&!detail){ctx.fillStyle='rgba(236,223,194,.95)';ctx.strokeStyle='#7d6230';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(sx,sy,5,0,7);ctx.fill();ctx.stroke();labelHits.push({l,x:sx-14,y:sy-14,w:28,h:28});return}
  const fs=l.big?15:l.small?11.5:12.5;
  ctx.font=l.river?`italic 700 ${fs+3}px "Cormorant SC",Georgia,serif`:`700 ${fs}px "Cormorant SC",Georgia,serif`;
  if(l.river){ctx.fillStyle='rgba(235,242,245,.92)';ctx.textAlign='center';ctx.fillText(l.t,sx,sy);if(l.info)labelHits.push({l,x:sx-30,y:sy-16,w:60,h:22});return}
  const lift=l.info&&!l.big?18:0;const ly=sy-lift;
  if(lift){ctx.strokeStyle='rgba(42,32,24,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx,ly+6);ctx.stroke();ctx.fillStyle='#ecdfc2';ctx.beginPath();ctx.arc(sx,sy,3,0,7);ctx.fill()}
  const extra=l.info?16:0;const w=ctx.measureText(l.t).width+14+extra,h=fs+8;
  ctx.fillStyle=l.edge?'rgba(24,19,13,.82)':'rgba(236,223,194,.93)';
  ctx.beginPath();ctx.roundRect?ctx.roundRect(sx-w/2,ly-h/2,w,h,3):ctx.rect(sx-w/2,ly-h/2,w,h);ctx.fill();
  ctx.strokeStyle=l.edge?PROV[l.edge].col:'rgba(125,98,48,.9)';ctx.lineWidth=l.edge?1.5:1;ctx.stroke();
  ctx.fillStyle=l.edge?'#ecdfc2':'#2a2018';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(l.t,sx-extra/2,ly+.5);
  if(l.info){const ix=sx+w/2-11;ctx.fillStyle='#7a2a20';ctx.beginPath();ctx.arc(ix,ly,6,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.font='italic 700 10px Georgia,serif';ctx.fillText('i',ix,ly+.5);labelHits.push({l,x:sx-w/2,y:ly-h/2,w,h})}
  ctx.textBaseline='alphabetic';
}
function showLandmark(l){
  $('card').innerHTML=`<div class="eyebrow">Alba Iulia · noiembrie 1918</div><h2>${l.t}</h2><p>${l.info}</p><div class="row"><button class="btn" id="lmClose">Înapoi la hartă</button></div>`;
  $('lmClose').onclick=closeModal;openModal();
}
function strokeWorld(pts,w,col,dash,off){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.strokeStyle=col;ctx.lineWidth=w;ctx.setLineDash(dash||[]);ctx.lineDashOffset=off||0;ctx.stroke();ctx.setLineDash([])}
function flagAt(x,y,s,t){ctx.fillStyle='#3a2c1e';ctx.fillRect(x-.5*s,y-16*s,1*s,16*s);const c=['#2c4d9c','#e2b21f','#b3302a'];
  for(let i=0;i<9;i++){const off=Math.sin(t*4+i*.7)*1.1*s*(i/9);ctx.fillStyle=c[Math.floor(i/3)];ctx.fillRect(x+.5*s+i*1.3*s,y-16*s+off,1.35*s,6*s)}}
let clock=0;
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#2a261f';ctx.fillRect(0,0,vw,vh);
  ctx.save();ctx.translate(vw/2,vh/2);ctx.scale(cam.z,cam.z);ctx.translate(-cam.x,-cam.y);
  ctx.drawImage(bg,0,0,W,H);
  if(S){
    ctx.lineCap='round';ctx.lineJoin='round';
    const sel=PROV[S.sel];
    strokeWorld(P[sel.road].pts,6,'rgba(236,208,138,.55)',[8,6],-clock*20);
    strokeWorld((sel.rail==='W'?P.railW:P.railE).pts,4,'rgba(236,208,138,.4)',[8,6],-clock*20);
    for(const p of PKEYS){for(const k of [blockKeyRoad(p),blockKeyRail(p)]){if(isGuarded(k)){const path=k.startsWith('road')?P[PROV[p].road]:(PROV[p].rail==='W'?P.railW:P.railE);strokeWorld(path.pts,10,`rgba(80,130,220,${.28+Math.sin(clock*4)*.1})`)}}}
    ctx.drawImage(crowdL,0,0,W,H);
    for(const t of S.trains){ctx.globalAlpha=Math.max(0,t.alpha);
      for(let c=t.cars;c>=0;c--){const q=at(t.path,t.d-c*21);ctx.save();ctx.translate(q.x,q.y-3);ctx.rotate(q.ang);
        if(c===0){ctx.fillStyle='#1c1a18';ctx.fillRect(-10,-4.5,20,9);ctx.fillStyle='#2b2724';ctx.fillRect(-10,-4.5,7,9);ctx.fillStyle='#7a2a20';ctx.fillRect(-10,3,20,1.5);
          ctx.fillStyle='#111';ctx.fillRect(6,-2,3,4);}
        else{ctx.fillStyle=c===1?'#3a2e24':'#3b4a3a';ctx.fillRect(-9.5,-4.5,19,9);ctx.fillStyle='#262320';ctx.fillRect(-9.5,-4.5,19,2);
          ctx.fillStyle='rgba(232,217,160,.75)';for(let wdw=-7;wdw<8;wdw+=4)ctx.fillRect(wdw,-1,2,2);}
        ctx.restore()}
      const h=at(t.path,t.d);flagAt(h.x-4,h.y-7,.55,clock);
      ctx.globalAlpha=1}
    for(const w of S.walkers){if(w.d<0&&w.state!=='settle')continue;
      if(w.kind==='cart')cart(ctx,w.x,w.y,w.dir,clock);
      else{const bob=w.state==='settle'?0:Math.abs(Math.sin(w.d*.45))*.5;person(ctx,w.x,w.y-bob,w.col,w.hat,w.flag,1.3)}}
    // blocked markers
    for(const k in S.blocks){const [kind,id]=k.split(':');let path;
      if(kind==='road')path=P[PROV[id].road];else path=id==='W'?P.railW:P.railE;
      const q=at(path,path.len*(kind==='road'?.25:.5));const r=9;
      ctx.fillStyle='rgba(179,48,42,.92)';ctx.beginPath();ctx.arc(q.x,q.y-12,r,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(q.x-4,q.y-16);ctx.lineTo(q.x+4,q.y-8);ctx.moveTo(q.x+4,q.y-16);ctx.lineTo(q.x-4,q.y-8);ctx.stroke()}
  }
  for(const s of smoke){ctx.fillStyle=`rgba(${s.slow?'200,198,192':'70,66,62'},${s.life*.45})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill()}
  TRIBS.forEach((t,i)=>flagAt(t[0]+6,t[1]-2,.8,clock+i));flagAt(958,492,.8,clock+1);flagAt(885,478,.7,clock+2);flagAt(STATION.x,STATION.y-40,.7,clock+3);
  ctx.restore();
  // labels (screen size)
  labelHits=[];for(const l of LANDMARKS)drawLabel(l);
  if(S)for(const k in S.blocks){const [kind,id]=k.split(':');let path;if(kind==='road')path=P[PROV[id].road];else path=id==='W'?P.railW:P.railE;const q=at(path,path.len*(kind==='road'?.25:.5));
    drawLabel({t:S.blocks[k].label,x:q.x,y:q.y-34,small:1})}
  // snowfall + vignette
  if(!reduceMotion){ctx.fillStyle='rgba(255,255,255,.75)';for(const f of flakes){const x=((f.x+Math.sin(clock*.6+f.p)*.01)%1)*vw,y=f.y*vh;ctx.beginPath();ctx.arc(x,y,f.r,0,7);ctx.fill()}}
  const vg=ctx.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.35,vw/2,vh/2,Math.max(vw,vh)*.75);vg.addColorStop(0,'rgba(20,16,10,0)');vg.addColorStop(1,'rgba(20,16,10,.45)');ctx.fillStyle=vg;ctx.fillRect(0,0,vw,vh);
}

/* ---------- HUD ---------- */
function buildProvs(){const box=$('provs');box.innerHTML='';
  for(const k of PKEYS){const p=PROV[k];const b=document.createElement('button');b.className='prov';b.id='p'+k;b.setAttribute('aria-pressed','false');
    b.innerHTML=`<span class="pn"><span class="sw" style="background:${p.col}"></span>${p.name}<span class="tag" hidden></span></span><span class="pc"></span><span class="pb"><i style="background:${p.col}"></i></span>`;
    b.onclick=()=>{S.sel=k;hud()};box.appendChild(b)}}
function hud(){
  if(!S)return;
  $('vProv').textContent=fmt(S.prov);$('vInfl').textContent=fmt(S.infl);$('vMoral').textContent=fmt(S.moral);
  const m=$('mMoral');m.style.width=S.moral+'%';m.style.background=S.moral>60?'var(--ok)':S.moral>30?'var(--warn)':'var(--bad)';
  const tot=sumDel();$('delCount').textContent=`${fmt(tot)} / ${fmt(TOTAL)}`;$('delBar').style.width=(tot/TOTAL*100)+'%';
  $('crowdCount').textContent=fmt(S.crowd);
  const c=clockParts();$('dayname').textContent=c.day===30?'Sâmbătă':'Duminică';$('clock').textContent=clockText();
  const left=Math.max(0,DEADLINE-S.t);const lh=Math.floor(left/60),lm=Math.floor(left%60);
  const dl=$('deadline');dl.textContent=left>0?`Adunarea începe peste ${lh} h ${String(lm).padStart(2,'0')} min`:'Adunarea a început';dl.classList.toggle('urgent',left<240);
  for(const k of PKEYS){const p=PROV[k],b=$('p'+k);b.setAttribute('aria-pressed',S.sel===k?'true':'false');
    b.querySelector('.pc').textContent=`${fmt(S.del[k])} / ${fmt(p.quota)} sosiți · ${fmt(remaining(k))} acasă`;
    b.querySelector('.pb i').style.width=(S.del[k]/p.quota*100)+'%';
    const tag=b.querySelector('.tag');const bl=isBlocked(blockKeyRoad(k))||isBlocked(blockKeyRail(k));const gd=isGuarded(blockKeyRoad(k));
    if(S.del[k]>=p.quota){tag.hidden=false;tag.className='tag done';tag.textContent='complet'}
    else if(bl){tag.hidden=false;tag.className='tag blocked';tag.textContent='blocat'}
    else if(gd){tag.hidden=false;tag.className='tag guard';tag.textContent='păzit'}else tag.hidden=true}
  const sel=S.sel,side=PROV[sel].rail;
  $('aDel').setAttribute('aria-disabled',(S.infl<12||remaining(sel)<=0||isBlocked(blockKeyRoad(sel)))+'');
  $('aTrain').setAttribute('aria-disabled',(S.prov<45||remaining(sel)<=0||S.trains.some(t=>t.side===side)||isBlocked('rail:'+side))+'');
  $('aGuard').setAttribute('aria-disabled',(S.prov<25)+'');
  $('aNeg').setAttribute('aria-disabled',(S.infl<20)+'');
  $('aTrain').querySelector('.ac').textContent=`45 Provizii · linia ${side==='W'?'Vințu':'Teiuș'}${S.trains.some(t=>t.side===side)?' ocupată':''}`;
}

/* ---------- flow ---------- */
function startScreen(){
  $('card').innerHTML=`<div class="eyebrow">Capitolul 6 · Alba Iulia · prototip jucabil</div>
  <h1>Drumul spre Unire</h1>
  <p>Sâmbătă, 30 noiembrie 1918. Mâine la ora 10 se deschide Marea Adunare Națională. Tu organizezi drumul celor <b>1.228 de delegați</b> din Transilvania, Banat, Crișana și Maramureș și al zecilor de mii de oameni care vin cu ei.</p>
  <ul class="how">
    <li><span>1</span><div><b>Alege o provincie</b> din lista de jos.</div></li>
    <li><span>2</span><div><b>Trimite delegați</b> cu căruțele (costă Influență) sau <b>organizează un tren</b> special (costă Provizii, aduce mai mulți).</div></li>
    <li><span>3</span><div>Când un traseu se blochează, <b>negociază</b>. Ca să previi problemele, <b>protejează traseul</b> cu Gărzile Naționale.</div></li>
    <li><span>4</span><div>Trage de hartă ca să te miști și apropie cu două degete sau cu rotița. Atinge etichetele cu <b>i</b> ca să afli ce era fiecare clădire în 1918.</div></li>
  </ul>
  <div class="row"><button class="btn" id="go">Începe misiunea</button><span class="locked">Durează cam 4 minute.</span></div>`;
  $('go').onclick=()=>{closeModal();begin()};openModal();
}
function begin(){
  S=newState();rt=0;smoke.length=0;resetCrowdLayer();stamp(Math.round(1500/PER_STAMP));S.crowd=1500;
  S.running=true;buildProvs();hud();unlock('conv');
  setTimeout(()=>toast('Alege o provincie, apoi <b>Organizează tren</b> sau <b>Trimite delegați</b>.'),600);
}
function endGame(){
  S.running=false;S.over=true;
  cam.anim={x:520,y:540,z:cam.minZ*1.25};
  const tot=sumDel(),crowd=S.crowd+S.walkers.reduce((a,w)=>a+(w.people||0),0);
  const medals=tot>=TOTAL?3:tot>=900?2:1;
  const verdict=tot>=TOTAL?'Toți delegații au ajuns la timp. Sala Unirii e plină.':tot>=900?'Majoritatea delegaților au ajuns la timp. Câțiva încă sunt pe drum.':'Prea mulți delegați au rămas pe drum. Încearcă din nou să-i aduci pe toți.';
  setTimeout(()=>{
    $('card').innerHTML=`<div class="ending"><div class="eyebrow">Duminică, 1 decembrie 1918</div><h2>Marea Adunare Națională</h2>
    <p class="line" style="animation-delay:.1s"><time>10:00</time><span>În sala Casinei militare, azi Sala Unirii, Gheorghe Pop de Băsești deschide Adunarea.</span></p>
    <p class="line" style="animation-delay:.9s"><time>discurs</time><span>Vasile Goldiș susține discursul principal și prezintă rezoluția.</span></p>
    <p class="line" style="animation-delay:1.7s"><time>vot</time><span>Delegații votează Rezoluția Unirii cu România.</span></p>
    <p class="line" style="animation-delay:2.5s"><time>afară</time><span>Episcopul Iuliu Hossu citește rezoluția mulțimii adunate pe Câmpul lui Horea.</span></p>
    <div class="rule"></div>
    <div class="medals" aria-label="${medals} din 3">${[0,1,2].map(i=>`<span class="${i<medals?'on':''}">★</span>`).join('')}</div>
    <p><b>${verdict}</b></p>
    <div class="score"><div><span>Delegați aduși</span><b>${fmt(tot)} / ${fmt(TOTAL)}</b></div><div><span>Oameni pe Câmpul lui Horea</span><b>${fmt(crowd)}</b></div></div>
    <p><b>Ce s-a întâmplat de fapt:</b> au fost acreditați 1.228 de delegați, iar la Alba Iulia s-au adunat peste 100.000 de oameni. A doua zi s-a format Consiliul Dirigent, condus de Iuliu Maniu. Pe 14 decembrie, actul Unirii a fost predat Regelui Ferdinand la București.</p>
    <div class="row"><button class="btn" id="again">Joacă din nou</button><button class="btn secondary" id="chron">Deschide Cronica</button></div></div>`;
    $('again').onclick=()=>{closeModal();cam.anim={x:vw>vh?700:560,y:540,z:cam.minZ*(vw>vh?1.3:1.1)};begin()};
    $('chron').onclick=()=>{showChronicle();$('cClose').textContent='Înapoi';$('cClose').onclick=()=>endGameReopen()};
    openModal();
  },1600);
  S._endHTML=null;
}
function endGameReopen(){closeModal();endGame()}

$('aDel').onclick=()=>S&&S.running&&sendDelegation();
$('aTrain').onclick=()=>S&&S.running&&organizeTrain();
$('aGuard').onclick=()=>S&&S.running&&protect();
$('aNeg').onclick=()=>S&&S.running&&negotiate();
$('btnChron').onclick=()=>S&&showChronicle();
$('btnPause').onclick=()=>{paused=!paused;$('icoPause').innerHTML=paused?'<path d="M7 5l12 7-12 7z"/>':'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';toast(paused?'Joc în pauză.':'Jocul continuă.')};
$('btnSpeed').onclick=()=>{speed=speed===1?2:1;$('btnSpeed').textContent='×'+speed};
document.addEventListener('keydown',e=>{if(modalOpen||!S||!S.running)return;const k=e.key;if(k>='1'&&k<='4'){S.sel=PKEYS[+k-1];hud()}else if(k==='d')sendDelegation();else if(k==='t')organizeTrain();else if(k==='p')protect();else if(k==='n')negotiate()});

/* ---------- loop ---------- */
let last=performance.now(),hudT=0;
function loop(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;
  if(cam.anim){const a=cam.anim,k=Math.min(1,dt*1.6);cam.x+=(a.x-cam.x)*k;cam.y+=(a.y-cam.y)*k;cam.z+=(clamp(a.z,cam.minZ,cam.minZ*3.4)-cam.z)*k;clampCam();if(Math.abs(a.z-cam.z)<.002&&Math.abs(a.x-cam.x)<.5)cam.anim=null}
  if(S&&S.running&&!paused&&!modalOpen){for(let i=0;i<speed;i++)update(dt)}
  if(!paused)updateSmoke(dt);
  if(!reduceMotion)for(const f of flakes){f.y+=f.v*dt;if(f.y>1){f.y=0;f.x=Math.random()}}
  hudT-=dt;if(hudT<=0){hudT=.2;hud()}
  draw();requestAnimationFrame(loop);
}

addEventListener('resize',resize);
(async()=>{
  resize();
  try{await Promise.race([Promise.all([document.fonts.load('700 14px "Cormorant SC"'),document.fonts.load('500 14px "Alegreya Sans"')]),new Promise(r=>setTimeout(r,1800))])}catch(e){}
  await new Promise(r=>{mapImg.onload=r;mapImg.onerror=r;mapImg.src=MAP_SRC});renderBG();makeSpots();resetCrowdLayer();stamp(60);
  S=null;requestAnimationFrame(loop);startScreen();
})();
})();
