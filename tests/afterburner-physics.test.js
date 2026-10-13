import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame,waveHeight } from '../src/game.js';
import { WaveParkGame,parkHeight,parkRideSurface,PARK_PIPES,PARK_RAILS } from '../src/park.js';
import { SurfRaceGame,surfRaceTrickInput } from '../src/surf-race.js';
import { ParkRaceGame,parkRaceOpponentInput,parkRaceTrickInput } from '../src/park-race.js';
import { TIME_TRIALS,createTimeTrialGame } from '../src/time-trials.js';

const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} should equal ${expected}`);
function advance(game,seconds,input={},hz=120) {
  for(let frame=0;frame<Math.round(seconds*hz);frame++)game.update(1/hz,typeof input==='function'?input(game):input);
}
function until(game,predicate,input={},seconds=5) {
  for(let frame=0;frame<seconds*120&&!predicate()&&game.phase==='running';frame++)game.update(1/120,typeof input==='function'?input(game):input);
  assert.ok(predicate(),'condition reached through the actual simulation');
}
function fixture(Game=SurfGame,board='afterburner') {
  const events=[],game=new Game(event=>events.push(event));game.setRewardBoard(board);game.start();
  if(game.isRace)advance(game,3);
  return {game,events};
}
function openPark(board='afterburner') {
  const {game,events}=fixture(WaveParkGame,board);
  // One starting fixture on the open service strip; subsequent travel is all
  // ordinary simulation, including terrain and obstacle collision checks.
  Object.assign(game,{x:-30,z:80,y:parkHeight(-30,80),speed:12,vx:0,vz:-12});
  game.surface=parkRideSurface(game.x,game.z,game.y);
  return {game,events};
}
// The quicker deck coasts for the last half-second of each five-second pump
// cycle in the factory. Its existing brake/steer driver still makes every turn.
const route=game=>game.mode==='surf'?surfRaceTrickInput(game,game.course,1):parkRaceTrickInput(game,game.course,.9);

test('Afterburner reaches exactly 25 percent higher cruise and pump speeds in ocean and Waterworks',()=>{
  for(const pump of [false,true]) {
    const stock=fixture(SurfGame,null).game,fast=fixture().game;
    for(const game of [stock,fast]) {
      // Isolate cruise acceleration along the clear shoulder. Adventure
      // driftwood and whirlpool avoidance have their own control tests.
      game.x=14.8;game.y=waveHeight(game.x,0,0);
      advance(game,8,rider=>{const error=14.8-rider.x-rider.vx*.22;return {left:error<-.2,right:error>.2,pump};});
      assert.equal(game.wipeouts,0);assert.equal(game.phase,'running');
      close(game.speed,(pump?26:19)*(game===fast?1.25:1),.0001);
    }
    close(fast.speed/stock.speed,1.25,.00001);
    assert.ok(fast.distance>stock.distance);
    for(const board of [null,'afterburner']) {
      const {game,events}=openPark(board);advance(game,8,{pump});
      close(game.speed,(pump?23.5:15)*(board?1.25:1),.0002);
      assert.equal(game.wipeouts,0);assert.equal(events.filter(event=>event.type==='wall').length,0);
    }
  }
});

test('stronger boost adds 9, 13.5 or 19.5 m/s on top of the faster base without multiplying twice',()=>{
  for(const Game of [SurfRaceGame,ParkRaceGame]) {
    const {game}=fixture(Game);
    for(const [tricks,expected] of [[1,9],[2,13.5],[4,19.5],[999,19.5]]) {
      game.awardRaceBoost({tricks});close(game.boostSpeed,expected);close(game.forwardSpeedBonus,expected);
      const before=game.speed,dt=1/120,target=(game.mode==='surf'?26:23.5)*1.25+expected;
      game.update(dt,{pump:true});
      close(game.speed,target+(before-target)*Math.exp(-dt*(game.mode==='surf'?1.7:1.5)));
    }
  }
});

test('actual landed tricks earn the stronger boost, empty jumps do not, and pause/retry/equipment remain sound',()=>{
  for(const Game of [SurfRaceGame,ParkRaceGame]) {
    const {game,events}=fixture(Game);advance(game,.35,{jump:true});assert.ok(game.jump());
    assert.ok(game.doTrick('spin'));until(game,()=>!game.trick);
    assert.equal(game.boostSpeed,0,'the board still requires a clean landing');
    until(game,()=>!game.airborne);assert.equal(game.wipeouts,0);close(game.boostSpeed,9);
    assert.equal(events.filter(event=>event.type==='raceBoost'&&!event.opponent).length,1);
    assert.equal(game.opponent.baseSpeedMultiplier,1,'equipping the player never changes a rival');
    game.pause();const snapshot=[game.speed,game.distance,game.x,game.z,game.boostTime];advance(game,1,{pump:true});
    assert.deepEqual([game.speed,game.distance,game.x,game.z,game.boostTime],snapshot);
    game.resume();game.retry();assert.equal(game.rewardBoard,'afterburner');assert.equal(game.baseSpeedMultiplier,1.25);
    assert.equal(game.boostTime,0);advance(game,3);assert.ok(game.jump());until(game,()=>!game.airborne);assert.equal(game.boostSpeed,0);
    game.setRewardBoard(null);assert.equal(game.baseSpeedMultiplier,1);game.setRewardBoard('lightning');assert.equal(game.baseSpeedMultiplier,1);
    game.setRewardBoard('afterburner');game.start();assert.equal(game.baseSpeedMultiplier,1.25);
  }
});

test('braking and wipeout recovery are unchanged and never amplified by the faster board',()=>{
  for(const Game of [SurfRaceGame,ParkRaceGame]) {
    const stock=fixture(Game,null).game,fast=fixture(Game).game;
    for(const game of [stock,fast])game.awardRaceBoost({tricks:4});
    advance(stock,.65,{brake:true});advance(fast,.65,{brake:true});
    close(fast.speed,stock.speed);close(fast.distance,stock.distance);
    fast.bail();stock.bail();assert.equal(fast.boostTime,0);
    advance(stock,.6,{pump:true});advance(fast,.6,{pump:true});close(fast.speed,stock.speed);close(fast.distance,stock.distance);
  }
});

test('pipe and rail cruise use the same base buff while safe pipe braking remains available',()=>{
  for(const board of [null,'afterburner']) {
    const multiplier=board?1.25:1,{game}=fixture(WaveParkGame,board),pipe=PARK_PIPES[0];
    Object.assign(game,{x:pipe.x,z:pipe.z+20,y:pipe.centerY-pipe.radius+pipe.thickness,vx:0,vz:-10,speed:10});
    assert.ok(game.tryPipeRide());const before=game.speed;advance(game,.1,{action:true,pump:true});
    close(game.speed,11*multiplier+(before-11*multiplier)*Math.exp(-.4));
    const speed=game.speed;advance(game,.1,{action:true,brake:true});close(game.speed,3+(speed-3)*Math.exp(-.4));
    game.start();const rail=PARK_RAILS.find(item=>item.id==='west-channel');
    game.catchRail(rail,-15,12);const entry=game.speed;advance(game,.2,{pump:true,grind:true});
    assert.ok(game.grinding);close(game.speed,17*multiplier+(entry-17*multiplier)*Math.exp(-.4));
  }
});

test('all twelve Time Trials remain physically finishable with the faster board and actual landed boosts',()=>{
  for(const trial of TIME_TRIALS) {
    const events=[],game=createTimeTrialGame(event=>events.push(event),{version:1,completedTrials:trial.index,selectedTrial:trial.index});
    game.setRewardBoard('afterburner');game.start();
    for(let frame=0;frame<(trial.timeLimit+4)*120&&game.phase==='running';frame++)game.update(1/120,route(game));
    assert.equal(game.result,'win',`${trial.name}: ${game.resultReason}, checkpoint ${game.nextCheckpoint}, misses ${game.raceMisses}`);
    assert.equal(game.nextCheckpoint,game.course.checkpoints.length);assert.equal(game.wipeouts,0,trial.name);
    assert.equal(game.raceMisses,0,trial.name);assert.ok(events.some(event=>event.type==='raceBoost'));
    assert.equal(events.filter(event=>event.type==='wall').length,0,trial.name);
    assert.ok(game.finishTime<trial.timeLimit);
  }
});

test('the faster board can win all three Waterworks rival layouts through normal controls',()=>{
  for(const id of ['moxie','undertow','kingtide']) {
    const events=[],game=new ParkRaceGame(event=>events.push(event),{rival:{id,name:id.toUpperCase(),pace:.45}});
    game.setRewardBoard('afterburner');game.start();
    for(let frame=0;frame<120*150&&game.phase==='running';frame++)game.update(1/120,route(game));
    assert.equal(game.result,'win',id);assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
    assert.equal(game.wipeouts,0,id);assert.equal(game.raceMisses,0,id);
    assert.equal(events.filter(event=>event.type==='wall'&&!event.opponent).length,0,id);
  }
});
