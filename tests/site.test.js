const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,existsSync,statSync}=require('node:fs');
const {join}=require('node:path');
const L=require('../site/landing.js');

const root=join(__dirname,'..'),out=join(root,'dist-site');

test('the countdown ends on 1 December 2026, midnight in Romania',()=>{
  assert.equal(new Date(L.LAUNCH).toISOString(),'2026-11-30T22:00:00.000Z');
  assert.equal(L.timeLeft(Date.UTC(2026,10,30,22,0,0)-90061000).days,1);
  assert.deepEqual(L.timeLeft(Date.UTC(2026,10,30,22,0,0)-90061000),{days:1,hours:1,minutes:1,seconds:1,done:false});
});

test('the countdown stops at zero and stays there after the launch',()=>{
  assert.deepEqual(L.timeLeft(L.LAUNCH),{days:0,hours:0,minutes:0,seconds:0,done:true});
  assert.equal(L.timeLeft(L.LAUNCH+86400000).done,true);
  assert.equal(L.timeLeft(L.LAUNCH+86400000).days,0);
});

test('the number of people waiting is worded in Romanian',()=>{
  const nb=s=>s.split(String.fromCharCode(160)).join(String.fromCharCode(32));
  assert.equal(L.formatCount(0),'0 de persoane');
  assert.equal(L.formatCount(1),'o persoană');
  assert.equal(L.formatCount(2),'2 persoane');
  assert.equal(L.formatCount(19),'19 persoane');
  assert.equal(L.formatCount(20),'20 de persoane');
  assert.equal(L.formatCount(100),'100 de persoane');
  assert.equal(L.formatCount(101),'101 persoane');
  assert.equal(L.formatCount(119),'119 persoane');
  assert.equal(L.formatCount(120),'120 de persoane');
  assert.equal(nb(L.formatCount(1234)),'1.234 de persoane');
  assert.equal(L.formatCount(undefined),'0 de persoane');
  assert.equal(L.formatCount(-5),'0 de persoane');
});

test('e-mails are checked before they are sent',()=>{
  for(const ok of ['a@b.ro','nume.prenume+joc@exemplu.com',' a@b.ro '])assert.equal(L.validEmail(ok),true,ok);
  for(const bad of ['','a','a@b','a b@c.ro','@b.ro','a@@b.ro',null,undefined,'x'.repeat(250)+'@b.ro'])assert.equal(L.validEmail(bad),false,String(bad));
});

test('only known campaign tags are kept, and short',()=>{
  assert.deepEqual(L.utmFrom('?utm_source=fb&x=1&ref='+'a'.repeat(100)),{utm_source:'fb',ref:'a'.repeat(60)});
  assert.deepEqual(L.utmFrom(''),{});
  assert.deepEqual(L.utmFrom(undefined),{});
});

test('join sends the sign-up to the public function and returns the count',async()=>{
  let seen;
  const fake=async(url,opts)=>{seen={url,opts};return{ok:true,json:async()=>7}};
  const n=await L.join({email:' A@b.ro ',consent:true,beta:true,utm:{ref:'x'}},fake);
  assert.equal(n,7);
  assert.ok(seen.url.endsWith('/rest/v1/rpc/dsu_waitlist_join'));
  assert.equal(seen.opts.headers.apikey,L.KEY);
  assert.ok(!('Authorization' in seen.opts.headers));
  assert.deepEqual(JSON.parse(seen.opts.body),{p_email:'A@b.ro',p_consent:true,p_beta:true,p_utm:{ref:'x'}});
});

test('a refused sign-up keeps the reason, and the visitor gets a clear message',async()=>{
  const fake=async()=>({ok:false,status:400,json:async()=>({code:'22023',message:'invalid_email'})});
  await assert.rejects(L.join({email:'x',consent:true},fake),e=>e.code==='invalid_email'&&/nu pare corectă/.test(L.errorText(e)));
  assert.match(L.errorText({code:'consent_required'}),/acordul/);
  assert.match(L.errorText(new Error('boom')),/Încearcă din nou/);
});

test('the site build holds the landing page and the game under /joaca/',()=>{
  const r=spawnSync(process.execPath,[join(root,'tools','build-single.mjs')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const b=spawnSync(process.execPath,[join(root,'tools','build-site.mjs')],{encoding:'utf8'});
  assert.equal(b.status,0,b.stderr);
  for(const f of ['index.html','landing.js','app.js','region.jpg','joaca/index.html','_headers'])assert.ok(existsSync(join(out,f)),f);
  const page=readFileSync(join(out,'index.html'),'utf8');
  assert.match(page,/<script src="landing\.js">/);
  assert.match(page,/<script src="app\.js">/);
  assert.ok(!page.includes('http://'),'no plain http link on a page that collects e-mails');
  const game=readFileSync(join(out,'joaca','index.html'),'utf8');
  assert.equal(game.split('data:image/jpeg;base64,').length-1,2,'the game keeps its two maps');
  assert.ok(statSync(join(out,'joaca','index.html')).size<16*1024*1024);
});
