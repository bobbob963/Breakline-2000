import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame,waveHeight } from '../src/game.js';
import { RaceRider } from '../src/race-rider.js';
import { surfHazardsNear,sweepSurfHazard,whirlpoolPull } from '../src/surf-hazards.js';
import { resolveAdminStats } from '../src/admin-settings.js';
import { stormBarrelsNear } from '../src/storm-waves.js';

function advance(game,seconds,input={}) {for(let i=0;i<Math.round(seconds*120);i++)game.update(1/120,input);}
function place(game,distance,x) {Object.assign(game,{distance,x,vx:0,y:waveHeight(x,-distance,game.elapsed)});}
function lipFlight(game,tricks=['spin']) {
  place(game,0,-9);game.charge=1;assert.equal(game.jump(),true);
  for(const trick of tricks){assert.equal(game.doTrick(trick),true);while(game.trick&&game.airborne)game.update(1/120);}
  assert.equal(game.surfBoostTime,0,'an airborne trick cannot grant speed');
  while(game.airborne)game.update(1/120);
}

test('driftwood and whirlpools are deterministic Survival-only obstacles',()=>{
  for(const mode of ['surf','rush','park'])for(const distance of [0,72,135,300,5000])
    assert.deepEqual(surfHazardsNear(distance,mode,900),[]);
  assert.deepEqual(surfHazardsNear(200),[]);
  const a=surfHazardsNear(200,'storm',30),b=surfHazardsNear(200,'storm',30);
  assert.deepEqual(a,b);assert.ok(a.some(item=>item.type==='driftwood'));
  assert.ok(a.some(item=>item.type==='whirlpool'));
  assert.ok(a.every(item=>item.z===-item.distance&&item.height>0));
});

test('Surf Session crosses former driftwood and Survival hazard positions without collisions or warnings',()=>{
  const positions=[{distance:72,x:1},...surfHazardsNear(0,'storm',0,0,350)];
  for(const item of positions){
    const events=[],game=new SurfGame(e=>events.push(e),'surf');game.start();place(game,item.distance-4,item.x);
    advance(game,.5,{pump:true});
    assert.ok(game.distance>item.distance);assert.equal(game.wipeouts,0);
    assert.equal(game.hazardWarning,'');assert.equal(game.hazardDanger,0);assert.equal(game.hazardProcessed.size,0);
    assert.equal(events.some(e=>e.type==='surfHazardHit'),false);
  }
});

test('storm driftwood leaves at least 15 metres clear around every curling wave',()=>{
  for(const distance of [0,500,5000,100000]) {
    const logs=surfHazardsNear(distance,'storm',900,0,1000).filter(item=>item.type==='driftwood');
    for(const item of logs)for(const barrel of stormBarrelsNear(item.distance,100,100))
      assert.ok(item.distance+item.radiusZ<barrel.startDistance-15||item.distance-item.radiusZ>barrel.endDistance+15,`${item.id} overlaps ${barrel.id}`);
  }
});

test('a low flat hop clears visible driftwood without becoming a trick or boost farm',()=>{
  const item=surfHazardsNear(0,'storm')[0];
  for(const hop of [false,true]) {
    const game=new SurfGame(()=>{},'storm');game.start();place(game,item.distance-4,item.x);
    if(hop){assert.equal(game.launchSource,'flat');assert.equal(game.jump(),true);assert.equal(game.doTrick('spin'),false);}
    let peak=0;
    for(let i=0;i<100;i++){game.update(1/120);peak=Math.max(peak,game.y-waveHeight(game.x,-game.distance,game.elapsed));}
    assert.equal(game.wipeouts,hop?0:1);assert.equal(game.surfBoostTime,0);assert.equal(game.launchTricks,0);
    if(hop)assert.ok(peak>.25&&peak<.6,`flat hop should stay small: ${peak}`);
  }
});

test('boost-speed swept driftwood contact cannot tunnel and air clears the same footprint',()=>{
  const item=surfHazardsNear(0,'storm')[0],from={x:item.x,distance:item.distance-12,y:0},to={x:item.x,distance:item.distance+12,y:0};
  from.y=waveHeight(from.x,-from.distance,0);to.y=waveHeight(to.x,-to.distance,.05);
  assert.ok(sweepSurfHazard(item,from,to,0,.05));
  assert.equal(sweepSurfHazard(item,{...from,y:from.y+3},{...to,y:to.y+3},0,.05),null);
});

test('whirlpool visibly bounded pull affects water only, can be steered around and jumped over',()=>{
  const pool=surfHazardsNear(300,'storm').find(item=>item.type==='whirlpool');
  assert.ok(whirlpoolPull([pool],pool.x+3,pool.distance)<0);
  assert.equal(whirlpoolPull([pool],pool.x+3,pool.distance,true),0);
  assert.equal(whirlpoolPull([pool],pool.x+12,pool.distance),0);
  for(const route of ['core','wide','air']) {
    const events=[],game=new SurfGame(e=>events.push(e),'storm');game.start();place(game,pool.distance-8,pool.x+(route==='wide'?6:0));
    if(route==='air'){game.cutbackLaunchTime=2;game.charge=1;assert.equal(game.jump(),true);}
    for(let i=0;i<90;i++)game.update(1/120,route==='wide'?{right:true}:{pump:true});
    assert.equal(events.filter(e=>e.type==='surfHazardHit'&&e.hazard==='whirlpool').length,route==='core'?1:0);
    assert.equal(game.lives,route==='core'?2:3);
  }
});

test('Survival and Reef Rush award single and combo boosts after landing; bail and reset clear them',()=>{
  for(const mode of ['storm','rush'])for(const tricks of [['spin'],['spin','grab']]) {
    const events=[],game=new SurfGame(e=>events.push(e),mode);game.start();lipFlight(game,tricks);
    assert.equal(game.wipeouts,0);assert.equal(game.surfBoostSpeed,tricks.length===1?7:10);
    assert.equal(game.surfBoostCombo,tricks.length>1);assert.equal(events.filter(e=>e.type==='surfBoost').length,1);
    const bonus=game.forwardSpeedBonus;assert.ok(bonus>0);advance(game,.1);assert.equal(events.filter(e=>e.type==='surfBoost').length,1);
    game.pause();const before=game.surfBoostTime;advance(game,1);assert.equal(game.surfBoostTime,before);game.resume();
    game.bail();assert.equal(game.forwardSpeedBonus,0);game.start();assert.equal(game.surfBoostTime,0);
  }
});

test('reward and admin boost multipliers apply once and races retain their separate boost pipeline',()=>{
  const board=new SurfGame(()=>{},'storm');board.setRewardBoard('afterburner');board.start();lipFlight(board);
  assert.equal(board.surfBoostSpeed,10.5);assert.equal(board.baseSpeedMultiplier,1.25);
  const custom=new SurfGame(()=>{},'storm');custom.setAdminStats(resolveAdminStats({enabled:true,boards:{standard:{boostPower:2,boostDuration:1.5}}},{}));custom.start();lipFlight(custom);
  assert.equal(custom.surfBoostSpeed,14);assert.ok(custom.surfBoostDuration===3.9||Math.abs(custom.surfBoostDuration-3.9)<1e-8);
  const Racer=RaceRider(SurfGame),race=new Racer();race.start();assert.equal(race.surfAdventureEnabled,false);lipFlight(race);
  assert.equal(race.surfBoostTime,0);assert.ok(race._pendingRaceBoost);assert.equal(race.hazardProcessed.size,0);
});

test('Surf Session banks single and combo trick points without any speed boost, including powered boards and admin stats',()=>{
  for(const equipment of ['standard','afterburner','admin'])for(const tricks of [['spin'],['spin','grab']]) {
    const events=[],game=new SurfGame(event=>events.push(event));
    if(equipment==='afterburner')game.setRewardBoard('afterburner');
    if(equipment==='admin')game.setAdminStats(resolveAdminStats({enabled:true,boards:{standard:{boostPower:2,boostDuration:1.5}}},{}));
    game.start();lipFlight(game,tricks);
    assert.equal(game.wipeouts,0);assert.equal(game.trickBoostEnabled,false);
    assert.equal(game.pendingTricks,tricks.length);assert.ok(game.comboBase>0);
    assert.equal(game.surfBoostTime,0);assert.equal(game.surfBoostSpeed,0);assert.equal(game.forwardSpeedBonus,0);
    const earned=game.comboBase*game.multiplier,before=game.score;
    assert.equal(game.bank(),true);assert.equal(game.score,before+earned);
    assert.equal(game.landedTricks,tricks.length);
    advance(game,.1);assert.equal(events.some(event=>event.type==='surfBoost'),false);
    if(equipment==='afterburner')assert.equal(game.baseSpeedMultiplier,1.25);
    game.start();assert.equal(game.trickBoostEnabled,false);assert.equal(game.forwardSpeedBonus,0);
  }
});

test('obstacle collisions and boost drain agree at 30 and 120 Hz, with pause freezing event state',()=>{
  const a=new SurfGame(()=>{},'storm'),b=new SurfGame(()=>{},'storm');a.start();b.start();
  for(let frame=0;frame<30*18;frame++) {
    const input={pump:true,left:frame%150<18,right:frame%150>115};
    a.update(1/30,input);for(let i=0;i<4;i++)b.update(1/120,input);
  }
  for(const key of ['x','y','distance','elapsed','lives','wipeouts','surfBoostTime','barrelRemaining'])assert.ok(Math.abs(a[key]-b[key])<1e-8,key);
  assert.deepEqual([...a.hazardProcessed],[...b.hazardProcessed]);assert.deepEqual([...a.barrelTimings],[...b.barrelTimings]);
  a.pause();const saved=JSON.stringify({timings:[...a.barrelTimings],elapsed:a.elapsed,remaining:a.barrelRemaining});advance(a,1);
  assert.equal(JSON.stringify({timings:[...a.barrelTimings],elapsed:a.elapsed,remaining:a.barrelRemaining}),saved);
  a.start();assert.equal(a.hazardProcessed.size,0);assert.equal(a.barrelTimings.size,0);assert.equal(a.barrelWarning,'');assert.equal(a.hazardWarning,'');
});
