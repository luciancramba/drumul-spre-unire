/* Progresul salvat: cel mai bun rezultat, paginile din Cronică, sunetul. O singură cheie în localStorage. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const core=DSU.core||require('./core.js');
const KEY='dsu.v1';

// getStorage may throw (blocked site data), and so may every call on what it returns (private mode, quota).
// When storage is unusable, progress lives in memory for this visit only.
function createSave(getStorage){
  let mem=null,data=core.emptySave();
  const storage=()=>{try{return getStorage()||null}catch{return null}};
  function read(){const s=storage();if(s){try{return s.getItem(KEY)}catch{/* fall back to memory */}}return mem}
  function write(){mem=JSON.stringify(data);const s=storage();if(s){try{s.setItem(KEY,mem)}catch{/* keep the in-memory copy */}}}
  return{
    KEY,
    get data(){return data},
    load(){data=core.parseSave(read());return data},
    // returns true when this run is the new best result
    recordResult({delegates,crowd,medals}){
      const run={delegates:Math.round(delegates),crowd:Math.round(crowd),medals};
      data.plays++;
      const best=core.isBetter(run,data.best);
      if(best)data.best={...run,date:new Date().toISOString().slice(0,10)};
      write();return best;
    },
    unlockFact(id){if(data.facts.includes(id))return;data.facts.push(id);write()},
    setSound(on){data.sound=!!on;write()},
  };
}

DSU.save=createSave(()=>root.localStorage);
if(typeof module!=='undefined'&&module.exports)module.exports={createSave,KEY};
})(typeof window!=='undefined'?window:globalThis);
