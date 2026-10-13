import test from 'node:test';
import assert from 'node:assert/strict';
import { SpecialPlayback } from '../src/special-lab.js';
import { SURFER_SPECIALS } from '../src/surfer-specials.js';

test('all four signature replays naturally launch, pause in the real special, then land once',()=>{
  const playback=new SpecialPlayback();
  for(const [id,special]of Object.entries(SURFER_SPECIALS)){
    const events=[];playback.onEvent=event=>events.push(event);playback.start(id);
    assert.equal(playback.meter.ready,true);assert.equal(playback.game.airborne,false);
    for(let i=0;i<1200&&playback.game.phase==='running';i++)playback.tick();
    assert.equal(playback.atCheckpoint,true,`${id}: must pause at the held pose`);
    assert.equal(playback.done,false);assert.equal(playback.game.phase,'paused');
    assert.equal(playback.game.airborne,true);assert.ok(playback.launchTime>0);
    assert.equal(playback.game.trick.specialId,special.specialId);
    assert.equal(playback.game.trick.name,special.name);
    assert.ok(playback.game.trick.age/playback.game.trick.duration>=.5);
    assert.equal(playback.game.launchTricks,0);assert.equal(playback.meter.value,0);
    assert.equal(events.filter(event=>event.type==='trickStart').length,1);
    const elapsed=playback.game.elapsed;playback.tick();assert.equal(playback.game.elapsed,elapsed,'paused replay cannot advance');
    playback.resume();
    for(let i=0;i<1200&&!playback.done;i++)playback.tick();
    assert.equal(playback.landed,true,`${id}: ${playback.message}`);
    assert.equal(playback.game.airborne,false);assert.equal(playback.game.wipeouts,0);
    assert.equal(playback.game.launchTricks,1);
    assert.equal(playback.game.comboNames.filter(name=>name===special.name).length,1);
    assert.equal(playback.game.comboNames.at(-1),'CLEAN LANDING');
    assert.ok(playback.game.comboBase>=special.points+120,'the natural route may also award its ramp and lip bonuses');
    assert.equal(events.filter(event=>event.type==='trick'&&event.name===special.name).length,1);
    assert.equal(events.filter(event=>event.type==='land').length,1);
  }
});
