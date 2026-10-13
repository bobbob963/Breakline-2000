import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame,waveHeight } from '../src/game.js';
import { surfHazardsNear } from '../src/surf-hazards.js';
import { surfLabRouteControls,surfLabClosingControls,surfLabDriftwoodControls,applySurfLabControls } from '../src/surf-lab.js';

test('Surf Lab reaches and exits two real barrels using its displayed pump and steering controls',()=>{
  const events=[],game=new SurfGame(event=>events.push(event),'storm');game.start();
  let insideCheckpoint=false,hopCount=0;
  for(let step=0;step<120*24&&game.barrelsSurvived<2;step++){
    const input=surfLabRouteControls(game);if(input.jump)hopCount++;
    applySurfLabControls(game,input);
    if(game.barrel?.inside&&game.barrel.progress>=.4)insideCheckpoint=true;
  }
  assert.ok(insideCheckpoint);assert.equal(game.barrelsSurvived,2);assert.equal(game.wipeouts,0);assert.equal(game.lives,3);
  assert.equal(events.filter(event=>event.type==='barrelExit').length,2);
  assert.ok(game.elapsed>10&&game.distance>450,'preview did not run the full route');
});

test('Closing wave preview brakes inside a real barrel until visible water hits the rider',()=>{
  const events=[],game=new SurfGame(event=>events.push(event),'storm');game.start();let braking=false,checkpoint=false;
  for(let step=0;step<120*14&&!game.wipeouts;step++){
    const input=surfLabClosingControls(game);braking||=!!input.brake;
    applySurfLabControls(game,input);
    if(game.barrel?.inside&&game.barrel.progress>=.27)checkpoint=true;
  }
  assert.ok(braking&&checkpoint);assert.equal(game.lives,2);assert.equal(game.wipeouts,1);
  assert.equal(events.find(event=>event.type==='bail')?.reason,'CAUGHT BY THE CLOSING WAVE');
  assert.ok(game.barrelClosingProgress>0);assert.ok(game.distance>190&&game.distance<232);
});

test('Driftwood hop preview drives from the Survival start and clears its first branch without trick points',()=>{
  const game=new SurfGame(()=>{},'storm');game.start();let hopped=false,peak=0,checkpoint=false;
  const branch=surfHazardsNear(0,'storm',0,0,180).find(item=>item.type==='driftwood');
  assert.equal(branch.distance,135);
  for(let step=0;step<120*7&&game.distance<branch.distance+20;step++){
    const input=surfLabDriftwoodControls(game);hopped||=input.jump;
    applySurfLabControls(game,input);
    peak=Math.max(peak,game.y-waveHeight(game.x,-game.distance,game.elapsed));
    if(game.airborne&&game.distance>=branch.distance-1.5)checkpoint=true;
  }
  assert.ok(hopped&&checkpoint);assert.ok(peak>.25&&peak<.6);assert.equal(game.wipeouts,0);
  assert.equal(game.airborne,false);assert.equal(game.lives,3);
  assert.equal(game.landedTricks,0);assert.equal(game.surfBoostTime,0);assert.equal(game.comboBase,0);
  assert.ok(game.hazardProcessed.has(branch.id));
});

test('Whirlpool preview reaches its approach checkpoint and steers outside the real funnel',()=>{
  const events=[],game=new SurfGame(event=>events.push(event),'storm');game.start();
  const pool=surfHazardsNear(300,'storm').find(item=>item.type==='whirlpool');
  let paused=false,passedWide=false;
  for(let step=0;step<120*16&&game.distance<312;step++){
    applySurfLabControls(game,surfLabRouteControls(game));
    if(!paused&&game.distance>=275){
      assert.equal(game.barrelsSurvived,1);assert.equal(game.wipeouts,0);
      game.pause();const distance=game.distance;game.update(1);assert.equal(game.distance,distance);game.resume();paused=true;
    }
    if(Math.abs(game.distance-pool.distance)<.3)passedWide=Math.abs(game.x-pool.x)>pool.radiusX+1;
  }
  assert.ok(paused&&passedWide);assert.ok(game.distance>=312);assert.equal(game.wipeouts,0);assert.equal(game.lives,3);
  assert.ok(game.hazardProcessed.has(pool.id));assert.equal(events.filter(event=>event.type==='surfHazardHit').length,0);
});
