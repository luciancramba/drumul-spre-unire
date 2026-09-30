const test=require('node:test');
const assert=require('node:assert/strict');
const audio=require('../src/audio.js');

test('without an AudioContext the sound module is silent and never throws',()=>{
  assert.equal(audio.available,false);
  assert.equal(audio.state,'none');
  audio.init();audio.setEnabled(true);audio.resume();audio.suspend();
  audio.ambience({crowd:50000,running:true});
  audio.click();audio.telegram();audio.good();audio.bad();audio.whistle();
  audio.chuff(true);audio.chuff(false);
  audio.bells('dawn');audio.bells('ending');
  assert.equal(audio.state,'none');
});
