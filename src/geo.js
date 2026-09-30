/* Harta regiunii la 30 noiembrie 1918: orașe, râuri, granița, provinciile istorice, drumuri și căi ferate,
   în coordonate reale (lat/lon) proiectate pe lumea regiunii. Date pure, fără DOM.
   În browser se atașează la DSU.geo; în Node se exportă prin module.exports. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const core=DSU.core||require('./core.js');

/* ---------- projection ---------- */
// equirectangular; longitude is scaled by cos(46.4°), the latitude of the middle of the map
const BOUNDS={latMin:44.6,latMax:48.2,lonMin:20.3,lonMax:26.3};
const COS=Math.cos(46.4*Math.PI/180);
const RW=2000;
const K=RW/((BOUNDS.lonMax-BOUNDS.lonMin)*COS);
const RH=Math.round((BOUNDS.latMax-BOUNDS.latMin)*K);
function project(lat,lon){return[(lon-BOUNDS.lonMin)*COS*K,(BOUNDS.latMax-lat)*K]}
function unproject(x,y){return[BOUNDS.latMax-y/K,x/(COS*K)+BOUNDS.lonMin]}

/* ---------- export ---------- */
const geo={BOUNDS,RW,RH,project,unproject};
DSU.geo=geo;
if(typeof module!=='undefined'&&module.exports)module.exports=geo;
})(typeof window!=='undefined'?window:globalThis);
