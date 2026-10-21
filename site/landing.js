/* Logica paginii de așteptare, fără DOM: countdown, formularea numărului de oameni, validarea e-mailului și apelurile
   către lista de așteptare (funcțiile publice din Supabase). În browser se atașează la window.Landing; în Node se exportă. */
(function(root){
// 1 December 2026, 00:00 in Romania (UTC+2 in winter)
const LAUNCH=Date.UTC(2026,10,30,22,0,0);
const API='https://xwoxleijmvfoyotgmxch.supabase.co';
// the publishable key is meant to be public: it can only call the two waiting-list functions
const KEY='sb_publishable_GtvGMaFYr_LArlG7v5amiQ_5Z9aZn8A';
const GAME_URL='joaca/';

// time left until `target`, split for the four boxes; done is true from the launch on
function timeLeft(now,target=LAUNCH){
  const ms=Math.max(0,target-now),s=Math.floor(ms/1000);
  return{days:Math.floor(s/86400),hours:Math.floor(s%86400/3600),minutes:Math.floor(s%3600/60),seconds:s%60,done:ms===0};
}
// Romanian plural: 1 persoană, 2–19 persoane, 20 de persoane, 101 persoane, 120 de persoane
function formatCount(n){
  n=Math.max(0,Math.floor(Number(n)||0));
  const num=n.toLocaleString('ro-RO');
  if(n===1)return'o persoană';
  const last=n%100;
  return `${num} ${last>=1&&last<=19?'persoane':'de persoane'}`;
}
const validEmail=e=>typeof e==='string'&&e.length<=254&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());
// only the campaign tags we know, short, so the stored utm stays small
function utmFrom(search){
  const p=new URLSearchParams(search||''),out={};
  for(const k of ['utm_source','utm_medium','utm_campaign','ref']){const v=p.get(k);if(v)out[k]=v.slice(0,60)}
  return out;
}

async function rpc(fn,body,fetchFn=root.fetch,timeoutMs=10000){
  const ctl=typeof AbortController!=='undefined'?new AbortController():null,timer=ctl&&setTimeout(()=>ctl.abort(),timeoutMs);
  try{
    const res=await fetchFn(`${API}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl&&ctl.signal});
    const data=await res.json().catch(()=>null);
    if(!res.ok)throw Object.assign(new Error(data&&data.message||'http_'+res.status),{code:data&&data.message||'http'});
    return data;
  }finally{if(timer)clearTimeout(timer)}
}
const fetchCount=(fetchFn)=>rpc('dsu_waitlist_count',{},fetchFn);
// returns the number of people waiting after this sign-up
const join=({email,consent,beta=false,utm={}},fetchFn)=>rpc('dsu_waitlist_join',{p_email:email.trim(),p_consent:!!consent,p_beta:!!beta,p_utm:utm},fetchFn);
// what to tell the visitor when the call failed
function errorText(err){
  if(err&&err.code==='invalid_email')return'Adresa de e-mail nu pare corectă. Verific-o și încearcă din nou.';
  if(err&&err.code==='consent_required')return'Bifează acordul ca să te putem anunța la lansare.';
  return'Nu am putut salva adresa acum. Încearcă din nou peste câteva secunde.';
}

const Landing={LAUNCH,API,KEY,GAME_URL,timeLeft,formatCount,validEmail,utmFrom,rpc,fetchCount,join,errorText};
root.Landing=Landing;
if(typeof module!=='undefined'&&module.exports)module.exports=Landing;
})(typeof window!=='undefined'?window:globalThis);
