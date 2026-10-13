import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveParkGame, PARK_RAILS, PARK_PIPES, parkRideSurface, pipeSurfaceHeight } from '../src/park.js';
import { SurfGame } from '../src/game.js';
import { RaceRider } from '../src/race-rider.js';
import { resolveAdminStats } from '../src/admin-settings.js';

function advance(game,seconds,input={}) {for(let i=0;i<Math.round(seconds*120);i++)game.update(1/120,input);}
function chargedFlight(game,tricks=['spin']) {
  advance(game,.625,{jump:true});assert.equal(game.jump(),true);
  for(const type of tricks) {
    assert.equal(game.doTrick(type),true);
    for(let i=0;i<240&&game.trick&&game.airborne;i++)game.update(1/120);
    assert.equal(game.trick,null);assert.equal(game.airborne,true,'the trick completes before landing');
  }
  assert.equal(game.surfBoostTime,0,'no speed is awarded in mid-air');
  for(let i=0;i<600&&game.airborne;i++)game.update(1/120);
  assert.equal(game.airborne,false);assert.equal(game.wipeouts,0);
}

test('Waterworks awards one single or stronger combo boost only after a completed flight lands',()=>{
  for(const tricks of [['spin'],['spin','grab']]) {
    const events=[],game=new WaveParkGame(event=>events.push(event));game.start();chargedFlight(game,tricks);
    const combo=tricks.length>1;
    assert.equal(game.trickBoostEnabled,true);assert.equal(game.surfAdventureEnabled,false);
    assert.equal(game.surfBoostSpeed,combo?10:7);assert.equal(game.surfBoostDuration,combo?3.2:2.6);
    assert.equal(game.surfBoostCombo,combo);assert.equal(game.forwardSpeedBonus,game.surfBoostSpeed);
    assert.equal(events.filter(event=>event.type==='surfBoost').length,1);
    advance(game,.4);assert.equal(events.filter(event=>event.type==='surfBoost').length,1);
    assert.equal(game.hazardProcessed.size,0);assert.equal(game.barrelTimings.size,0);
  }
});

test('a flat hop and a ramp transfer without completed tricks cannot farm boosts',()=>{
  const events=[],game=new WaveParkGame(event=>events.push(event));game.start();chargedFlight(game,[]);
  advance(game,3,{pump:true});
  assert.ok(game.rampHits>0,'the normal starting run also crosses the spine');
  assert.equal(game.surfBoostTime,0);assert.equal(game.launchTricks,0);
  assert.equal(events.filter(event=>event.type==='surfBoost').length,0);
});

test('a late unfinished second move loses the first trick and grants no landing boost',()=>{
  const events=[],game=new WaveParkGame(event=>events.push(event));game.start();
  advance(game,.625,{jump:true});game.jump();game.doTrick('spin');
  while(game.trick)game.update(1/120);
  while(game.airborne&&game.vy>-6.5)game.update(1/120);
  assert.equal(game.doTrick('grab'),true);
  while(game.airborne)game.update(1/120);
  assert.equal(game.wipeouts,1);assert.equal(game.pendingTricks,0);assert.equal(game.surfBoostTime,0);
  assert.equal(events.filter(event=>event.type==='surfBoost').length,0);
});

test('earned Waterworks boosts produce real extra travel and stronger linked combos travel farther',()=>{
  const riders=[[],['spin'],['spin','grab']].map(tricks=>{
    const game=new WaveParkGame();game.start();chargedFlight(game,tricks);return game;
  });
  const [plain,single,combo]=riders;
  assert.equal(plain.z,single.z);assert.equal(single.z,combo.z,'flights receive no advance speed');
  for(const rider of riders)advance(rider,1,{pump:true});
  assert.ok(plain.z-single.z>2.5,'a landed trick gains metres before and over the next ramp');
  assert.ok(single.z-combo.z>1,'a two-trick combo gains more travel');
  assert.ok(combo.speed>single.speed&&single.speed>plain.speed);
  assert.equal(riders.reduce((sum,rider)=>sum+rider.wipeouts,0),0);
});

test('pause freezes Waterworks boosts, braking controls them, and expiry, bail, restart and finish clear them',()=>{
  const game=new WaveParkGame();game.start();chargedFlight(game);
  game.pause();const paused=[game.x,game.z,game.speed,game.surfBoostTime];advance(game,1,{pump:true});
  assert.deepEqual([game.x,game.z,game.speed,game.surfBoostTime],paused);game.resume();
  advance(game,.7,{brake:true});assert.ok(game.speed<5,'braking wins over the earned speed');
  assert.ok(game.surfBoostTime>0);advance(game,2.1,{brake:true});
  assert.equal(game.surfBoostTime,0);assert.equal(game.forwardSpeedBonus,0);
  game.start();chargedFlight(game);game.bail();assert.equal(game.surfBoostTime,0);assert.equal(game.forwardSpeedBonus,0);
  game.start();chargedFlight(game);game.start();assert.equal(game.surfBoostTime,0);assert.equal(game.surfBoostAwarded,true);
  chargedFlight(game);game.elapsed=119.995;game.update(1/120);
  assert.equal(game.phase,'finished');assert.equal(game.surfBoostTime,0);
});

test('reward board and custom admin boost multipliers apply once in Waterworks',()=>{
  const reward=new WaveParkGame();reward.setRewardBoard('afterburner');reward.start();chargedFlight(reward);
  assert.equal(reward.surfBoostSpeed,10.5);assert.equal(reward.baseSpeedMultiplier,1.25);
  const custom=new WaveParkGame();
  custom.setRewardBoard('afterburner');
  custom.setAdminStats(resolveAdminStats({enabled:true,boards:{afterburner:{boostPower:2,boostDuration:1.5}}},{rewardBoard:'afterburner'}));
  custom.start();chargedFlight(custom);
  assert.equal(custom.surfBoostSpeed,14);assert.ok(Math.abs(custom.surfBoostDuration-3.9)<1e-9);
});

test('ordinary boost eligibility does not turn on ocean hazards or duplicate race and time trial boosts',()=>{
  for(const Base of [SurfGame,WaveParkGame]) {
    const Racer=RaceRider(Base),events=[],rider=new Racer(event=>events.push(event));rider.start();
    if(Base===WaveParkGame)chargedFlight(rider);
    else {
      rider.charge=1;rider.jump();rider.doTrick('spin');
      while(rider.airborne)rider.update(1/120);
    }
    assert.equal(rider.trickBoostEnabled,false);assert.equal(rider.surfAdventureEnabled,false);
    assert.equal(rider.surfBoostTime,0);assert.equal(events.filter(event=>event.type==='surfBoost').length,0);
    assert.ok(rider._pendingRaceBoost);rider.awardRaceBoost(rider._pendingRaceBoost);
    assert.equal(rider.boostSpeed,6);assert.equal(events.filter(event=>event.type==='raceBoost').length,1);
  }
});

test('boost drain and boosted collisions are identical at 30 and 120 frames per second',()=>{
  const coarse=new WaveParkGame(),fine=new WaveParkGame();
  for(const game of [coarse,fine]){game.start();chargedFlight(game,['spin','grab']);}
  for(let frame=0;frame<100;frame++) {
    const input={pump:true,left:frame>58&&frame<79};
    coarse.update(1/30,input);for(let i=0;i<4;i++)fine.update(1/120,input);
  }
  for(const key of ['x','z','y','speed','elapsed','surfBoostTime','wipeouts'])assert.ok(Math.abs(coarse[key]-fine[key])<1e-8,key);
});

test('an already earned Waterworks boost carries through grinds and pipe loops while braking takes priority',()=>{
  for(const route of ['rail','pipe']) {
    const game=new WaveParkGame();game.start();chargedFlight(game);
    if(route==='rail') {
      const rail=PARK_RAILS.find(item=>item.id==='west-channel');game.catchRail(rail,-rail.length/2+1,12);
    } else {
      const pipe=PARK_PIPES[0];game.x=pipe.x;game.z=pipe.z+12;game.y=pipeSurfaceHeight(pipe,0);
      game.vx=0;game.vz=-12;game.speed=12;game.surface=parkRideSurface(game.x,game.z,game.y);
      assert.equal(game.tryPipeRide(),true);
    }
    advance(game,.5,{pump:true,action:route==='pipe'});
    assert.ok(game.speed>(route==='rail'?19:16),'the normal rail or pipe speed receives the earned bonus');
    advance(game,.5,{brake:true,action:route==='pipe'});
    assert.ok(game.speed<(route==='rail'?11:6),'braking suppresses boost acceleration');
  }
});
