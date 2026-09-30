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

/* ---------- towns ---------- */
// name: drawn on the map; official: the 1918 state name, for the info card
// tier 1: always labelled · 2: labelled when zoomed in · 3: route waypoint, not drawn
const TOWNS={
  albaIulia:{name:'Alba Iulia',official:'Gyulafehérvár',lat:46.0667,lon:23.5700,tier:1},
  timisoara:{name:'Timișoara',official:'Temesvár',lat:45.7537,lon:21.2257,tier:1},
  arad:{name:'Arad',official:'Arad',lat:46.1866,lon:21.3123,tier:1},
  oradea:{name:'Oradea',official:'Nagyvárad',lat:47.0465,lon:21.9189,tier:1},
  baiaMare:{name:'Baia Mare',official:'Nagybánya',lat:47.6567,lon:23.5850,tier:1},
  cluj:{name:'Cluj',official:'Kolozsvár',lat:46.7712,lon:23.6236,tier:1},
  sibiu:{name:'Sibiu',official:'Nagyszeben',lat:45.7928,lon:24.1521,tier:1},
  brasov:{name:'Brașov',official:'Brassó',lat:45.6427,lon:25.5887,tier:1},
  sighet:{name:'Sighet',official:'Máramarossziget',lat:47.9281,lon:23.8867,tier:2},
  lugoj:{name:'Lugoj',official:'Lugos',lat:45.6886,lon:21.9031,tier:2},
  dej:{name:'Dej',official:'Dés',lat:47.1417,lon:23.8750,tier:2},
  turda:{name:'Turda',official:'Torda',lat:46.5667,lon:23.7833,tier:2},
  aiud:{name:'Aiud',official:'Nagyenyed',lat:46.3122,lon:23.7292,tier:2},
  teius:{name:'Teiuș',official:'Tövis',lat:46.2000,lon:23.6833,tier:2},
  targuMures:{name:'Târgu Mureș',official:'Marosvásárhely',lat:46.5425,lon:24.5575,tier:2},
  deva:{name:'Deva',official:'Déva',lat:45.8833,lon:22.9000,tier:2},
  orastie:{name:'Orăștie',official:'Szászváros',lat:45.8400,lon:23.2000,tier:2},
  vintu:{name:'Vințu de Jos',official:'Alvinc',lat:45.9906,lon:23.4867,tier:2},
  sebes:{name:'Sebeș',official:'Szászsebes',lat:45.9600,lon:23.5700,tier:2},
  fagaras:{name:'Făgăraș',official:'Fogaras',lat:45.8416,lon:24.9731,tier:2},
  zlatna:{name:'Zlatna',official:'Zalatna',lat:46.1083,lon:23.2250,tier:2},
  abrud:{name:'Abrud',official:'Abrudbánya',lat:46.2750,lon:23.0650,tier:2},
  beius:{name:'Beiuș',official:'Belényes',lat:46.6667,lon:22.3500,tier:2},
  campeni:{name:'Câmpeni',official:'Topánfalva',lat:46.3625,lon:23.0450,tier:3},
  vascau:{name:'Vașcău',official:'Vaskoh',lat:46.4700,lon:22.4700,tier:3},
  somcuta:{name:'Șomcuta Mare',official:'Nagysomkút',lat:47.5200,lon:23.4700,tier:3},
  gherla:{name:'Gherla',official:'Szamosújvár',lat:47.0300,lon:23.9100,tier:3},
  campiaTurzii:{name:'Câmpia Turzii',official:'Aranyosgyéres',lat:46.5480,lon:23.8800,tier:3},
  faget:{name:'Făget',official:'Facset',lat:45.8500,lon:22.1800,tier:3},
  dobra:{name:'Dobra',official:'Dobra',lat:45.9000,lon:22.5700,tier:3},
  lipova:{name:'Lipova',official:'Lippa',lat:46.0900,lon:21.6900,tier:3},
  savarsin:{name:'Săvârșin',official:'Soborsin',lat:46.0100,lon:22.2400,tier:3},
  ilia:{name:'Ilia',official:'Marosillye',lat:45.9300,lon:22.6500,tier:3},
  simeria:{name:'Simeria',official:'Piski',lat:45.8500,lon:23.0100,tier:3},
  miercurea:{name:'Miercurea Sibiului',official:'Szerdahely',lat:45.9000,lon:23.8000,tier:3},
  ocnaSibiului:{name:'Ocna Sibiului',official:'Vízakna',lat:45.8800,lon:24.0600,tier:3},
  avrig:{name:'Avrig',official:'Felek',lat:45.7200,lon:24.3800,tier:3},
  alesd:{name:'Aleșd',official:'Élesd',lat:47.0600,lon:22.4000,tier:3},
  ciucea:{name:'Ciucea',official:'Csucsa',lat:46.9500,lon:22.8200,tier:3},
  huedin:{name:'Huedin',official:'Bánffyhunyad',lat:46.8700,lon:23.0300,tier:3},
};
const townXY=k=>project(TOWNS[k].lat,TOWNS[k].lon);

/* ---------- export ---------- */
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY};
DSU.geo=geo;
if(typeof module!=='undefined'&&module.exports)module.exports=geo;
})(typeof window!=='undefined'?window:globalThis);
