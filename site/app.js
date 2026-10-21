/* Pagina de așteptare: countdown, numărul de oameni pe listă, formularul și drumul spre jocul beta.
   Logica pură e în landing.js. */
(()=>{
const L=window.Landing,$=id=>document.getElementById(id);
const STORE='dsu.waitlist.v1',POLL=10000;

// storage can be blocked (private mode): the page works without remembering the visitor
const remember=v=>{try{localStorage.setItem(STORE,JSON.stringify(v))}catch{/* optional */}};
const recall=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};

/* ---------- countdown ---------- */
const pad=n=>String(n).padStart(2,'0');
function tick(){
  const t=L.timeLeft(Date.now());
  $('cd-d').textContent=t.days;$('cd-h').textContent=pad(t.hours);$('cd-m').textContent=pad(t.minutes);$('cd-s').textContent=pad(t.seconds);
  $('countdown').hidden=t.done;$('launched').hidden=!t.done;
}
tick();setInterval(tick,1000);

/* ---------- people waiting ---------- */
function showCount(n){
  const el=$('waiting');
  el.innerHTML=n>0?`<b>${L.formatCount(n)}</b> așteaptă lansarea`:'Lista de așteptare e deschisă. <b>Fii primul înscris.</b>';
}
async function refreshCount(){
  if(document.hidden)return;
  try{showCount(await L.fetchCount())}catch{/* keep the last number */}
}
refreshCount();setInterval(refreshCount,POLL);
document.addEventListener('visibilitychange',refreshCount);

/* ---------- form ---------- */
const form=$('joinForm'),email=$('email'),msg=$('msg');
let mode='notify';
for(const b of form.querySelectorAll('button[type=submit]'))b.addEventListener('click',()=>{mode=b.dataset.mode});
const say=(text,kind='')=>{msg.textContent=text;msg.className='msg '+kind};
const setBusy=busy=>{for(const b of form.querySelectorAll('button'))b.disabled=busy};

function showJoined(beta){
  $('joinBox').hidden=true;$('joinedBox').hidden=false;
  if(beta)$('playLink').focus();
}
const saved=recall();
if(saved&&saved.joined)showJoined(false);

form.addEventListener('submit',async e=>{
  e.preventDefault();
  if($('website').value)return; // a bot filled the hidden field: pretend it worked
  email.removeAttribute('aria-invalid');
  if(!L.validEmail(email.value)){email.setAttribute('aria-invalid','true');say(L.errorText({code:'invalid_email'}),'err');email.focus();return}
  if(!$('consent').checked){say(L.errorText({code:'consent_required'}),'err');$('consent').focus();return}
  const beta=mode==='beta';
  setBusy(true);say('Se salvează…');
  try{
    const n=await L.join({email:email.value,consent:true,beta,utm:L.utmFrom(location.search)});
    showCount(n);remember({joined:true,beta});
    if(beta){showJoined(true);setTimeout(()=>{location.href=L.GAME_URL},700)}
    else{showJoined(false);say('')}
  }catch(err){say(L.errorText(err),'err');setBusy(false)}
});
})();
