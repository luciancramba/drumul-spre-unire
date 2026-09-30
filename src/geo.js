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

/* ---------- rivers ---------- */
// [lat, lon] polylines, simplified; source to the edge of the map
const RIVERS=[
  {name:'Mureș',major:1,pts:[[46.60,25.60],[46.92,25.35],[46.78,24.70],[46.54,24.56],[46.48,24.10],[46.39,23.86],[46.30,23.75],[46.20,23.69],[46.07,23.60],[45.99,23.49],[45.87,23.20],[45.89,22.90],[45.93,22.65],[46.01,22.24],[46.09,21.69],[46.17,21.30],[46.17,21.07],[46.22,20.30]]},
  {name:'Someș',major:1,pts:[[46.77,23.60],[47.03,23.91],[47.14,23.87],[47.26,23.26],[47.47,23.30],[47.79,22.88],[47.95,22.40]]},
  {name:'Olt',major:1,pts:[[46.65,25.81],[45.86,25.79],[45.82,25.60],[45.98,25.28],[45.84,24.97],[45.72,24.38],[45.66,24.26],[45.55,24.28],[45.30,24.30]]},
  {name:'Crișul Repede',pts:[[46.87,23.03],[46.95,22.82],[47.06,22.40],[47.05,21.92],[47.02,21.20],[46.95,20.60]]},
  {name:'Crișul Negru',pts:[[46.67,22.35],[46.77,21.94],[46.80,21.30],[46.75,20.80]]},
  {name:'Crișul Alb',pts:[[46.13,22.79],[46.27,22.34],[46.43,21.84],[46.53,21.52],[46.60,21.00]]},
  {name:'Timiș',pts:[[45.42,22.22],[45.69,21.90],[45.70,21.60],[45.64,21.18],[45.45,20.75]]},
  {name:'Ampoi',pts:[[46.11,23.22],[46.06,23.57]]},
];

/* ---------- border and regions ---------- */
// the 1918 border between Austria-Hungary and the Kingdom of Romania, along the Carpathians to Orșova
const BORDER_1918=[[47.10,25.85],[46.70,26.00],[46.30,26.25],[45.95,26.25],[45.62,26.10],[45.50,25.85],[45.48,25.55],[45.45,25.25],[45.48,24.85],[45.50,24.40],[45.45,24.05],[45.38,23.60],[45.35,23.25],[45.25,22.95],[45.05,22.70],[44.85,22.50],[44.70,22.40]];
// historical regions, approximate outlines; keys match PROV in game.js
const REGIONS={
  MM:[[48.05,22.95],[48.10,24.20],[47.80,24.90],[47.45,24.55],[47.35,23.60],[47.45,22.95]],
  CR:[[47.80,21.95],[47.45,22.95],[46.95,22.80],[46.40,22.75],[46.10,22.35],[46.12,21.60],[46.15,20.75],[46.75,20.75],[47.40,21.30]],
  BN:[[46.15,20.75],[46.12,21.60],[46.10,22.35],[45.80,22.60],[45.40,22.75],[45.25,22.95],[45.05,22.70],[44.85,22.50],[44.70,22.40],[44.62,22.00],[44.80,21.40],[45.20,20.75]],
  TR:[[47.45,22.95],[47.35,23.60],[47.45,24.55],[47.10,25.85],[46.70,26.00],[46.30,26.25],[45.95,26.25],[45.62,26.10],[45.50,25.85],[45.48,25.55],[45.45,25.25],[45.48,24.85],[45.50,24.40],[45.45,24.05],[45.38,23.60],[45.35,23.25],[45.25,22.95],[45.40,22.75],[45.80,22.60],[46.10,22.35],[46.40,22.75],[46.95,22.80]],
};
// big labels: the four regions and the far side of the border
const LABELS=[
  {name:'Maramureș',prov:'MM',lat:47.85,lon:23.95},
  {name:'Crișana',prov:'CR',lat:46.95,lon:21.55},
  {name:'Banat',prov:'BN',lat:45.35,lon:21.60},
  {name:'Transilvania',prov:'TR',lat:46.45,lon:24.70},
  {name:'Regatul României',lat:45.05,lon:24.60},
];

/* ---------- export ---------- */
const geo={BOUNDS,RW,RH,project,unproject,TOWNS,townXY,RIVERS,BORDER_1918,REGIONS,LABELS};
DSU.geo=geo;
if(typeof module!=='undefined'&&module.exports)module.exports=geo;
})(typeof window!=='undefined'?window:globalThis);
