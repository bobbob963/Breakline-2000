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
const modeCases=[
  ['Surf Session',()=>new SurfGame(),false],['Storm Rider',()=>new SurfGame(()=>{},'storm'),false],
  ['free Waterworks',()=>new WaveParkGame(),false],['score tournament',()=>new TournamentGame(),false],
  ['free sewer rider',()=>new SewerRider(),false],['Reef Rush',()=>new SurfGame(()=>{},'rush'),true],
  ['surf rival',()=>new SurfRaceGame(),true],['Waterworks rival',()=>new ParkRaceGame(),true],
  ['Runoff rival',()=>new SewerRaceGame(),true],
  ['Deep End rival',()=>new SewerRaceGame(()=>{},{trackId:'sewer-depths'}),true],
  ['surf time trial',()=>trial(0),true],['Waterworks time trial',()=>trial(5),true],
];
const modes=modeCases.map(([,create])=>create);
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

test('slow time preserves rider speed only in real race modes and slows the entire non-race session',()=>{
  for(const [name,create,preservesSpeed] of modeCases){
    const game=running(create),reference=running(create);game.setRewardBoard('deadtime');assert.equal(game.toggleTimePower(),true);
    assert.equal(game.timePowerKeepsPlayerSpeed,preservesSpeed,name);
    for(let frame=0;frame<60;frame++){
      timeFrame(game,1/120,{pump:true});reference.update((preservesSpeed?1:.4)/120,{pump:true});
    }
    near(game.playerElapsed,preservesSpeed?.5:.2);near(game.elapsed,.2);near(game.timePowerCharge,5.5);
    near(game.speed,reference.speed,1e-6);
    if(!preservesSpeed)assert.deepEqual(snapshot(game),snapshot(reference),name);
    if(game.isTimeTrial)near(game.time,game.trial.timeLimit-.2);
    if(game.opponent){near(game.opponent.elapsed,.2);near(game.opponent.playerElapsed,.2);}
  }
});

test('actual slow-time activation slows session steering and tricks while race jumps stay at normal pace',()=>{
  for(const [name,create,preservesSpeed] of modeCases){
    const reference=running(create),powered=running(create);
    for(const game of [reference,powered]){
      game.rules={...game.rules,currentStrength:0};game.charge=.5;game.cutbackLaunchTime=1;
      assert.equal(game.jump(),true,name);assert.equal(game.doTrick('spin'),true,name);
    }
    powered.setRewardBoard('deadtime');assert.equal(powered.toggleTimePower(),true,name);
    for(let frame=0;frame<30;frame++){
      reference.update((preservesSpeed?1:.4)/120,{right:true});timeFrame(powered,1/120,{right:true});
    }
    near(powered.airtime,reference.airtime);near(powered.trick.age,reference.trick.age);
    near(powered.vy,reference.vy);near(powered.popRecovery,reference.popRecovery);
    near(powered.vx,reference.vx);near(powered.x,reference.x);
    if(reference.heading!==undefined)near(powered.heading,reference.heading);
    near(powered.playerElapsed,preservesSpeed?.25:.1);near(powered.elapsed,.1);
    near(powered.timePowerCharge,5.75);
  }
});

test('custom-duration expiry restores ordinary clocks in every mode and grants the same real-time burst',()=>{
  for(const [name,create,preservesSpeed] of modeCases){
    const game=running(create);game.setRewardBoard('deadtime');
    game.setAdminStats({active:false,cheats:{timePowerDuration:1}});game.toggleTimePower();
    for(let frame=0;frame<180;frame++)timeFrame(game,1/120,{pump:true});
    assert.equal(game.timePowerActive,false,name);near(game.timePowerCharge,0);
    near(game.elapsed,.9);near(game.playerElapsed,preservesSpeed?1.5:.9);
    near(game.timePowerBurstTime,2.5);near(game.timePowerCooldown,11.5);
    near(game.timePowerSpeedMultiplier,1.5);
    const before=snapshot(game);timeFrame(game,.01,{pump:true});
    near(game.elapsed-before.elapsed,.01);near(game.playerElapsed-before.playerElapsed,.01);
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
