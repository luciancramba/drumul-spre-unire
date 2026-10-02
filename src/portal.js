/* Portalul dintre hărți: pe ce nivel e jucătorul (regiunea sau orașul) și zborul dintre ele.
   u merge de la 0 (regiunea) la 1 (orașul); un zbor întors la jumătate pornește înapoi de unde a rămas.
   Logică pură, fără DOM: game.js aplică opacitatea și camera pe care le calculează portalul. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const core=DSU.core||require('./core.js');
const {clamp}=core;

const FLIGHT=.8,FLIGHT_REDUCED=.2; // seconds
const PUSH=Math.log(1.5); // how far past the zoom limit the player must push to change level
const DECAY=PUSH/.6;      // the push fades in 0.6 s once the player stops zooming
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const smooth=(a,b,t)=>{const s=clamp((t-a)/(b-a),0,1);return s*s*(3-2*s)};

function create({reduceMotion=false,level='region'}={}){
  const dur=reduceMotion?FLIGHT_REDUCED:FLIGHT;
  const p={u:level==='city'?1:0,dir:0,push:0,
    get level(){return p.u>=1?'city':'region'},
    get busy(){return p.dir!==0},
    // where the player is going, or where they are when nothing moves
    get target(){return p.dir>0?'city':p.dir<0?'region':p.level},
    // region opacity: the city takes over in the last 70 % of the way down
    alpha(){return 1-smooth(.3,1,p.u)},
    reset(l){p.u=l==='city'?1:0;p.dir=0;p.push=0},
    // starts a flight, or turns one around; false when already there or already going there
    go(to){const d=to==='city'?1:-1;if(p.dir===d||(!p.dir&&p.target===to))return false;p.dir=d;p.push=0;return true},
    // f: the part of a zoom step the camera could not take at its limit (>1 in, <1 out)
    // near: on the region, whether Alba Iulia is close to where the player zooms
    overscroll(f,near=true){
      if(p.dir||!(f>0))return false;
      const toward=p.level==='region'?Math.log(f):-Math.log(f); // > 0 pushes toward the other level
      if(toward>0&&p.level==='region'&&!near)return false;
      p.push=Math.max(0,p.push+toward);
      return p.push>=PUSH&&p.go(p.level==='region'?'city':'region');
    },
    // advances the flight; returns 'arrived' on the frame it lands
    update(dt){
      if(!(dt>0))dt=0; // a missing or backwards time step means no time passed
      p.push=Math.max(0,p.push-DECAY*dt);
      if(!p.dir)return null;
      p.u=clamp(p.u+p.dir*dt/dur,0,1);
      if(p.dir>0?p.u<1:p.u>0)return null; // lands only at the end it is heading to
      p.dir=0;return 'arrived';
    },
    // region camera along the way: a is the view on the region, b the close-up on Alba Iulia; zoom moves on a log scale
    pose(a,b){
      if(reduceMotion)return{x:a.x,y:a.y,z:a.z};
      const e=ease(p.u);
      return{x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,z:Math.exp(Math.log(a.z)+(Math.log(b.z)-Math.log(a.z))*e)};
    },
  };
  return p;
}

DSU.portal={create,FLIGHT,FLIGHT_REDUCED,PUSH};
if(typeof module!=='undefined'&&module.exports)module.exports=DSU.portal;
})(typeof window!=='undefined'?window:globalThis);
