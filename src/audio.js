/* Sunetul jocului, sintetizat cu Web Audio: vânt, murmurul mulțimii, trenuri, clopote și semnale de interfață.
   Fără AudioContext (sau dacă pornirea eșuează) toate apelurile devin no-op. */
(function(root){
const DSU=root.DSU||(root.DSU={});
const AC=root.AudioContext||root.webkitAudioContext;
const MASTER=.5;
const BED=4; // make-up gain: filtered noise is quiet, this lifts wind and crowd to about 20 dB under the cues
let ctx=null,master=null,noise=null,enabled=true;
let windG=null,crowdG=null,chuffTimer=null;

function makeNoise(){const n=ctx.sampleRate*2,b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
function noiseSrc(){const s=ctx.createBufferSource();s.buffer=noise;s.loop=true;return s}
function filter(type,freq,q=1){const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;return f}
function gain(v=0){const g=ctx.createGain();g.gain.value=v;return g}
// attack-decay envelope on a fresh gain node, connected to the master bus
function env(t,peak,attack,decay){const g=gain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+attack+decay);g.connect(master);return g}
function tone(type,freq,t,peak,attack,decay,to=null){const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+attack+decay);o.connect(env(t,peak,attack,decay));o.start(t);o.stop(t+attack+decay+.05)}
function burst(t,type,freq,peak,decay){const s=ctx.createBufferSource();s.buffer=noise;const f=filter(type,freq);s.connect(f);f.connect(env(t,peak,.004,decay));s.start(t,Math.random()*1.5);s.stop(t+decay+.05)}

function startBeds(){
  // wind: low-passed noise whose level drifts between about 0.02 and 0.06
  windG=gain(0);const w=noiseSrc(),wf=filter('lowpass',400,.7),wl=gain(.04);
  const lfo=ctx.createOscillator(),depth=gain(.02);lfo.frequency.value=.07;lfo.connect(depth);depth.connect(wl.gain);
  w.connect(wf);wf.connect(wl);wl.connect(windG);windG.connect(master);w.start();lfo.start();
  // crowd murmur: band-passed noise with a slow wobble, level follows the crowd on the field
  crowdG=gain(0);const c=noiseSrc(),cf=filter('bandpass',250,.8),cl=gain(.8);
  const wob=ctx.createOscillator(),wd=gain(.2);wob.frequency.value=2.7;wob.connect(wd);wd.connect(cl.gain);
  c.connect(cf);cf.connect(cl);cl.connect(crowdG);crowdG.connect(master);c.start();wob.start();
}

const ready=()=>!!ctx&&audio.available;
const audio={
  available:!!AC,
  get state(){return ctx?ctx.state:'none'},
  // must run inside a user gesture, or the browser keeps the context suspended
  init(){
    if(!AC||ctx)return;
    try{ctx=new AC();master=gain(enabled?MASTER:0);master.connect(ctx.destination);noise=makeNoise();startBeds();audio.resume()}
    catch{ctx=null;audio.available=false}
  },
  setEnabled(on){enabled=!!on;if(!ctx)return;master.gain.setTargetAtTime(enabled?MASTER:0,ctx.currentTime,.05);if(enabled)audio.resume()},
  suspend(){if(ctx&&ctx.state==='running')ctx.suspend().catch(()=>{})},
  resume(){if(!ctx||!enabled||ctx.state==='running')return;ctx.resume().catch(()=>{audio.available=false})},
  // crowd: people on Câmpul lui Horea; running: false silences the beds (pause, start screen)
  ambience({crowd,running}){
    if(!ready())return;const t=ctx.currentTime;
    windG.gain.setTargetAtTime(running?BED:0,t,.6);
    crowdG.gain.setTargetAtTime(running?BED*Math.min(1,crowd/100000)*.12/.8:0,t,.8);
  },
  click(){if(ready())burst(ctx.currentTime,'highpass',2000,.15,.03)},
  // dot-dot-dash, like a telegraph key
  telegram(){if(!ready())return;let t=ctx.currentTime+.02;for(const d of [.06,.06,.18]){tone('sine',880,t,.07,.005,d);t+=d+.08}},
  good(){if(!ready())return;const t=ctx.currentTime;tone('triangle',660,t,.09,.01,.35);tone('triangle',880,t+.12,.09,.01,.45)},
  bad(){if(ready())tone('sine',90,ctx.currentTime,.3,.005,.3,55)},
  whistle(){
    // held for half a second, then released, like a steam whistle
    if(!ready())return;const t=ctx.currentTime,f=filter('lowpass',1800),g=gain();
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.1,t+.05);g.gain.setValueAtTime(.1,t+.5);g.gain.exponentialRampToValueAtTime(.0001,t+.7);
    f.connect(g);g.connect(master);
    for(const hz of [440,554]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz;o.connect(f);o.start(t);o.stop(t+.75)}
  },
  // idempotent: call every tick with whether any train is moving
  chuff(on){
    if(on&&ready()&&!chuffTimer)chuffTimer=setInterval(()=>{if(ready())burst(ctx.currentTime,'lowpass',600,.08,.09)},333);
    else if(!on&&chuffTimer){clearInterval(chuffTimer);chuffTimer=null}
  },
  // dawn: three strikes on 1 December 06:00; ending: a peal of ten across the finale
  bells(kind){
    if(!ready())return;const t=ctx.currentTime+.05;
    const strikes=kind==='ending'?[392,330,294,392,330,294,262,392,330,262].map((f,i)=>[f,i*1.15]):[[392,0],[392,1.4],[392,2.8]];
    for(const [f,dt] of strikes)for(const [m,p] of [[1,.14],[2.76,.05],[5.4,.02]])tone('sine',f*m,t+dt,p,.005,2);
  },
};

DSU.audio=audio;
if(typeof module!=='undefined'&&module.exports)module.exports=audio;
})(typeof window!=='undefined'?window:globalThis);
