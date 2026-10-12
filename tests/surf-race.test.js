import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame, waveHeight } from '../src/game.js';
import { TournamentGame,createTournamentGame,TOURNAMENT_RIVALS } from '../src/tournament.js';
import { SurfRaceGame,createRaceCourse,raceOpponentInput,RACE_COUNTDOWN } from '../src/surf-race.js';

function fixture(roundIndex=1){
  const events=[],game=createTournamentGame(event=>events.push(event),{version:1,completedRounds:roundIndex});
  game.start();return {game,events};
}
function advance(game,seconds,input={},hz=120){
  for(let i=0;i<Math.round(seconds*hz);i++)game.update(1/hz,typeof input==='function'?input(game):input);
}
function skipCountdown(game){advance(game,RACE_COUNTDOWN);assert.equal(game.countdownRemaining,0);}
function naturalFinish(game,input={},hz=120){
  for(let i=0;i<hz*100&&game.phase==='running';i++)game.update(1/hz,typeof input==='function'?input(game):input);
  assert.equal(game.phase,'finished');
}
function nearFinish(game,rider,metres){
  rider.distance=game.course.length-metres;rider.nextCheckpoint=game.course.checkpoints.length;
  rider.x=0;rider.vx=0;rider.bailTime=0;rider.y=waveHeight(0,-rider.distance,rider.elapsed);
}

test('the saved Hit List alternates real Surf Session races with the three existing score battles',()=>{
  assert.deepEqual(TOURNAMENT_RIVALS.map(rival=>rival.event),['score','race','score','race','score']);
  for(let index=0;index<5;index++){
    const game=createTournamentGame(()=>{},{version:1,completedRounds:index});
    assert.equal(game.roundIndex,index);assert.equal(game.isTournament,true);
    if(index===1||index===3){
      assert.ok(game instanceof SurfRaceGame);assert.ok(game instanceof SurfGame);
      assert.equal(game.mode,'surf');assert.equal(game.isRace,true);
      assert.equal(game.course.length,index===1?960:1280);
      assert.equal(game.opponent.profile,TOURNAMENT_RIVALS[index].profile);
    }else{assert.ok(game instanceof TournamentGame);assert.equal(game.mode,'park');}
  }
  assert.equal(createTournamentGame(()=>{},{version:1,completedRounds:99}).roundIndex,0);
  assert.equal(createTournamentGame(()=>{},{version:1,completedRounds:5}).complete,true);
});

test('countdown shows both riders at rest and rejects popping and cutbacks until GO',()=>{
  const {game,events}=fixture();
  const start=[game.x,game.distance,game.opponent.x,game.opponent.distance,game.elapsed];
  assert.equal(game.jump(),false);assert.equal(game.doCutback(1),false);
  advance(game,2.5,{pump:true,right:true,jump:true,grind:true});
  assert.deepEqual([game.x,game.distance,game.opponent.x,game.opponent.distance,game.elapsed],start);
  assert.equal(game.charge,0);advance(game,.5);
  assert.equal(game.countdownRemaining,0);assert.equal(game.elapsed,0);
  assert.equal(events.filter(event=>event.type==='raceGo').length,1);
  advance(game,.1,{pump:true});assert.ok(game.distance>0&&game.opponent.distance>0);
  assert.equal(game.jump(),true);
});

test('both racers pause and resume with the same countdown and elapsed clock',()=>{
  const {game}=fixture();advance(game,1);game.pause();
  const frozen=game.countdownRemaining;advance(game,2,{pump:true});assert.equal(game.countdownRemaining,frozen);
  game.resume();advance(game,2);advance(game,5,{pump:true});game.pause();
  const before=[game.elapsed,game.distance,game.x,game.opponent.elapsed,game.opponent.distance,game.opponent.x];
  advance(game,8,{pump:true,right:true});
  assert.deepEqual([game.elapsed,game.distance,game.x,game.opponent.elapsed,game.opponent.distance,game.opponent.x],before);
  game.resume();advance(game,.1,{pump:true});assert.ok(game.elapsed>before[0]&&game.opponent.distance>before[4]);
});

test('race gates use a swept crossing and a miss returns only that rider before the same gate',()=>{
  const {game,events}=fixture();skipCountdown(game);
  const gate=game.course.checkpoints[0];game.distance=gate.distance-.1;game.x=gate.x;game.y=waveHeight(game.x,-game.distance,0);
  game.update(1/30,{pump:true});assert.equal(game.nextCheckpoint,1);
  assert.equal(events.filter(event=>event.type==='raceGate'&&!event.opponent).length,1);
  const second=game.course.checkpoints[1];game.distance=second.distance-.1;game.x=-10;game.vx=0;
  const opponentDistance=game.opponent.distance;game.update(1/120,{pump:true});
  assert.equal(game.nextCheckpoint,1);assert.equal(game.raceMisses,1);
  assert.equal(game.distance,second.distance-14);assert.equal(game.speed,8);assert.equal(game.x< -9,true);
  assert.ok(game.opponent.distance>opponentDistance);assert.equal(game.opponent.raceMisses,0);
  assert.equal(events.filter(event=>event.type==='raceMiss'&&!event.opponent).length,1);
  game.distance=second.distance-.1;game.x=second.x;game.speed=20;game.y=waveHeight(game.x,-game.distance,game.elapsed);
  game.update(1/120,{});assert.equal(game.nextCheckpoint,2);assert.equal(game.raceMisses,1);
});

test('the line cannot be won while a required checkpoint remains uncleared',()=>{
  const {game}=fixture();skipCountdown(game);nearFinish(game,game,.03);game.nextCheckpoint=0;
  game.update(1/120,{pump:true});assert.equal(game.phase,'running');assert.equal(game.result,null);
});

test('first crossing decides the winner even when both boards cross during the same physics step',()=>{
  for(const playerFirst of[true,false]){
    const {game,events}=fixture();skipCountdown(game);
    nearFinish(game,game,playerFirst?.01:.08);nearFinish(game,game.opponent,playerFirst?.08:.01);
    game.speed=game.opponent.speed=24;game.update(1/120,{pump:true});
    assert.equal(game.result,playerFirst?'win':'loss');assert.equal(game.racePosition,playerFirst?1:2);
    assert.ok(playerFirst?game.finishTime<game.opponentFinishTime:game.opponentFinishTime<game.finishTime);
    assert.equal(game.time,Math.min(game.finishTime,game.opponentFinishTime));
    assert.equal(game.getProgress().completedRounds,playerFirst?2:1);
    assert.equal(events.filter(event=>event.type==='finish').length,1);
    assert.equal(game.finish(),false);advance(game,2,{pump:true});
    assert.equal(events.filter(event=>event.type==='finish').length,1);
  }
});

test('rival AI uses real surf physics and has identical progress at30,60and120Hz',()=>{
  const states=[];
  for(const hz of[30,60,120]){
    const {game}=fixture();advance(game,23,{brake:true},hz);
    assert.equal(game.phase,'running');assert.ok(game.opponent instanceof SurfGame);
    states.push(game.opponent);
  }
  for(const state of states.slice(1))for(const key of['distance','x','y','speed','elapsed','nextCheckpoint','wipeouts','raceMisses'])
    assert.ok(Math.abs(state[key]-states[0][key])<1e-8,key);
});

test('rival pacing ignores player points, place, inputs and wipeouts',()=>{
  const slow=fixture().game,fast=fixture().game;
  fast.score=9999999;fast.wipeouts=99;
  advance(slow,25,{brake:true});advance(fast,25,game=>raceOpponentInput(game,game.course,1));
  assert.ok(Math.abs(fast.distance-slow.distance)>100);
  for(const key of['distance','x','y','speed','elapsed','nextCheckpoint','wipeouts','raceMisses'])assert.equal(fast.opponent[key],slow.opponent[key],key);
});

test('each visible opponent naturally clears every gate and wins against a slower player',()=>{
  for(const round of[1,3]){
    const {game,events}=fixture(round);naturalFinish(game,{brake:true});
    assert.equal(game.result,'loss');assert.equal(game.opponent.nextCheckpoint,game.course.checkpoints.length);
    assert.ok(game.opponent.distance>=game.course.length);assert.ok(game.opponentFinishTime>30&&game.opponentFinishTime<65);
    assert.equal(game.opponent.raceMisses,0);assert.equal(game.getProgress().completedRounds,round);
    assert.equal(events.filter(event=>event.type==='finish').length,1);
  }
});

test('a clean navigated route can actually beat both AI surfers through normal held controls',()=>{
  for(const round of[1,3]){
    const {game}=fixture(round);
    naturalFinish(game,rider=>raceOpponentInput(rider,rider.course,1));
    assert.equal(game.result,'win');assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
    assert.equal(game.raceMisses,0);assert.equal(game.getProgress().completedRounds,round+1);
    const next=createTournamentGame(()=>{},game.getProgress());
    assert.ok(next instanceof TournamentGame);assert.equal(next.roundIndex,round+1);assert.equal(next.mode,'park');
  }
});

test('retry resets both surfers and countdown on the same rung while preserving a earned unlock',()=>{
  const {game}=fixture();naturalFinish(game,rider=>raceOpponentInput(rider,rider.course,1));
  const progress=game.getProgress();progress.completedRounds=5;
  assert.equal(game.retry(),true);assert.equal(game.roundIndex,1);assert.equal(game.rival.name,'RIVET');
  assert.equal(game.result,null);assert.equal(game.countdownRemaining,RACE_COUNTDOWN);assert.equal(game.phase,'running');
  assert.equal(game.elapsed,0);assert.equal(game.distance,0);assert.equal(game.opponent.distance,0);
  assert.equal(game.nextCheckpoint,0);assert.equal(game.opponent.nextCheckpoint,0);assert.equal(game.opponent.wipeouts,0);
  assert.equal(game.getProgress().completedRounds,2);
});

test('course descriptors have ordered reachable gates and a finite finish beyond the last gate',()=>{
  for(const length of[960,1280]){
    const course=createRaceCourse(length);assert.equal(Object.isFrozen(course),true);
    assert.equal(course.length,length);assert.ok(course.checkpoints.length>=5);
    for(const [index,gate]of course.checkpoints.entries()){
      assert.equal(gate.index,index);assert.ok(gate.distance<(course.length-60));
      assert.ok(gate.x-gate.radius>=-16&&gate.x+gate.radius<=17);
      if(index)assert.ok(gate.distance>course.checkpoints[index-1].distance);
    }
  }
});
