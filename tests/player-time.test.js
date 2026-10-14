import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame } from '../src/game.js';
import { WaveParkGame } from '../src/park.js';
import { SurfRaceGame } from '../src/surf-race.js';
import { ParkRaceGame } from '../src/park-race.js';
import { SewerRaceGame,SewerRider } from '../src/sewer-race.js';
import { sewerWaterHeight } from '../src/sewer-course.js';
import { createTimeTrialGame } from '../src/time-trials.js';
import { TournamentGame } from '../src/tournament.js';

const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} should equal ${b}`);
const trial=index=>createTimeTrialGame(()=>{},{version:1,completedTrials:index,selectedTrial:index,bestTimes:[]});
const modes=[()=>new SurfGame(),()=>new SurfGame(()=>{},'storm'),()=>new SurfGame(()=>{},'rush'),()=>new WaveParkGame(),
  ()=>new SurfRaceGame(),()=>new ParkRaceGame(),()=>new SewerRaceGame(),()=>trial(0),()=>trial(5),()=>new TournamentGame()];
function running(create){const game=create();game.start();game.countdownRemaining=0;return game;}
function snapshot(game){return Object.fromEntries(['elapsed','playerElapsed','time','distance','x','y','z','vx','vy','vz','speed','heading','airtime','charge','popRecovery','wipeouts','nextCheckpoint'].map(key=>[key,game[key]]));}
function timeFrame(game,realDt,input={}){const worldDt=game.updateTimePower(realDt);game.update(game.timePowerPlayerDelta,input,worldDt);}

test('explicit equal clocks preserve ordinary and fast-forward physics across every playable controller',()=>{
  for(const create of modes)for(const dt of [1/120,1/60]){
    const old=running(create),split=running(create);
    for(let frame=0;frame<30;frame++){old.update(dt,{pump:true});split.update(dt,{pump:true},dt);}
    assert.deepEqual(snapshot(split),snapshot(old));
    if(old.opponent)assert.deepEqual(snapshot(split.opponent),snapshot(old.opponent));
  }
});

test('the power preserves ordinary player acceleration while every mode advances only its slowed world clock',()=>{
  for(const create of modes){
    const game=running(create),normal=running(create);game.setRewardBoard('deadtime');assert.equal(game.toggleTimePower(),true);
    for(let frame=0;frame<60;frame++){timeFrame(game,1/120,{pump:true});normal.update(1/120,{pump:true});}
    near(game.playerElapsed,.5);near(game.elapsed,.2);near(game.timePowerCharge,5.5);
    // Storm difficulty itself advances more slowly; the rider's acceleration
    // remains normal while the environmental speed increase is correspondingly lower.
    if(game.rulesId!=='storm')near(game.speed,normal.speed,1e-6);
    else assert.ok(Math.abs(game.speed-normal.speed)<.01);
    if(game.isTimeTrial)near(game.time,game.trial.timeLimit-.2);
    if(game.opponent){near(game.opponent.elapsed,.2);near(game.opponent.playerElapsed,.2);}
  }
});

test('slow time leaves player steering, charged jumps, airborne tricks and pop recovery at normal pace',()=>{
  for(const create of [()=>new SurfGame(),()=>new WaveParkGame(),()=>new SewerRider()]){
    const normal=running(create),slow=running(create);
    for(const game of [normal,slow]){game.rules={...game.rules,currentStrength:0};game.charge=.5;game.cutbackLaunchTime=1;assert.equal(game.jump(),true);assert.equal(game.doTrick('spin'),true);}
    for(let frame=0;frame<30;frame++){
      normal.update(1/120,{right:true});slow.update(1/120,{right:true},.4/120);
    }
    near(slow.airtime,normal.airtime);near(slow.trick.age,normal.trick.age);near(slow.vy,normal.vy);near(slow.popRecovery,normal.popRecovery);
    near(slow.vx,normal.vx);near(slow.x,normal.x);if(normal.heading!==undefined)near(slow.heading,normal.heading);
    near(slow.playerElapsed,.25);near(slow.elapsed,.1);
  }
});

test('each real rival follows exactly the slowed world physics while the player gains ground',()=>{
  for(const create of [()=>new SurfRaceGame(),()=>new ParkRaceGame(),()=>new SewerRaceGame()]){
    const powered=running(create),worldReference=running(create),normal=running(create);
    powered.setRewardBoard('deadtime');powered.toggleTimePower();
    for(let frame=0;frame<120;frame++){
      timeFrame(powered,1/120,{pump:true});worldReference.update(.4/120,{pump:true});normal.update(1/120,{pump:true});
    }
    assert.deepEqual(snapshot(powered.opponent),snapshot(worldReference.opponent));
    const travel=game=>game.mode==='park'?Math.hypot(game.x-game.course.start.x,game.z-game.course.start.z):game.distance;
    assert.ok(travel(powered)>travel(worldReference)*1.8,'the player keeps moving through the slowed course');
    near(powered.speed,normal.speed,1e-6);
  }
});

test('sewer flood deadlines slow while ordinary player travel remains responsive',()=>{
  for(const trackId of ['sewer-run','sewer-depths']){
    const create=()=>{const rider=new SewerRider();rider.trackId=trackId;return rider;},normal=running(create),slow=running(create);
    const hazard=normal.course.hazards.find(item=>item.type==='barrel');
    for(const rider of [normal,slow])Object.assign(rider,{distance:hazard.startDistance-.01,x:0,speed:10,y:sewerWaterHeight(0,hazard.startDistance-.01,0,trackId)});
    for(let frame=0;frame<360;frame++){normal.update(1/120,{brake:true});slow.update(1/120,{brake:true},.4/120);}
    assert.equal(normal.wipeouts,1);assert.equal(slow.wipeouts,0);
    near(slow.elapsed,1.2);near(slow.playerElapsed,3);
    const timing=slow.hazardStates.get(hazard.id);near(timing.deadline-timing.enteredAt,hazard.closeDuration);
    assert.ok(timing.deadline>slow.elapsed,'the environmental close deadline has not arrived');
  }
});

test('trial deadline clipping preserves the player/world ratio and pause freezes both clocks',()=>{
  for(const index of [0,5]){
    const game=running(()=>trial(index));game.elapsed=game.trial.timeLimit-.002;
    game.update(.01,{pump:true},.004);
    assert.equal(game.result,'loss');near(game.elapsed,game.trial.timeLimit);near(game.playerElapsed,.005);
  }
  for(const create of modes){
    const game=running(create);game.update(.01,{pump:true},.004);game.pause();const before=snapshot(game);
    game.update(.05,{pump:true,right:true},.02);assert.deepEqual(snapshot(game),before);
    game.start();near(game.elapsed,0);near(game.playerElapsed,0);
  }
});

test('a frozen world cannot launch a new rival trick while the rider still moves',()=>{
  for(const create of [()=>new SurfRaceGame(),()=>new ParkRaceGame(),()=>new SewerRaceGame()]){
    const game=running(create);game.opponent.charge=.7;game.opponent._nextRaceAir=0;
    const before=snapshot(game.opponent);game.update(.02,{pump:true},0);
    assert.deepEqual(snapshot(game.opponent),before);assert.equal(game.opponent.airborne,false);assert.equal(game.opponent.trick,null);
    near(game.elapsed,0);near(game.playerElapsed,.02);
  }
});
