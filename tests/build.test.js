const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,statSync}=require('node:fs');
const {join}=require('node:path');

const root=join(__dirname,'..'),out=join(root,'dist','drumul-spre-unire.html');

test('the single-file build inlines both map images and stays under the artifact limit',()=>{
  const r=spawnSync(process.execPath,[join(root,'tools','build-single.mjs')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const html=readFileSync(out,'utf8');
  assert.equal(html.split('data:image/jpeg;base64,').length-1,2,'the city map and the region map');
  assert.ok(!html.includes('assets/map-1918.jpg')&&!html.includes('assets/region-1918.jpg'),'a map path was left behind');
  assert.ok(statSync(out).size<16*1024*1024);
});
