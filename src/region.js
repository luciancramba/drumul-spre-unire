/* Harta regiunii: camera, stratul static (hârtia și provinciile) și desenul de pe fiecare cadru
   (granița, râurile, drumurile, căile ferate, orașele, traseele provinciei alese).
   Coordonatele vin din DSU.geo. Liniile se desenează la fiecare cadru, ca să rămână clare și la zoom mare. */
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

/* ---------- export ---------- */
const region={cam,resize,pan,zoomAt,toScreen,MAXK};
DSU.region=region;
if(typeof module!=='undefined'&&module.exports)module.exports=region;
})(typeof window!=='undefined'?window:globalThis);
