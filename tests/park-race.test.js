import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveParkGame,parkRideSurface,parkHeight } from '../src/park.js';
import { ParkRaceGame,createParkRaceCourse,parkRaceOpponentInput,sweepParkRaceGate,parkRaceProgress } from '../src/park-race.js';

const ids=['moxie','undertow','kingtide'];
function fixture(id='moxie',Game=ParkRaceGame) {
  const events=[],game=new Game(event=>events.push(event),{rival:{id,name:id.toUpperCase(),pace:.45},roundIndex:ids.indexOf(id)*2,roundCount:5});
  game.start();advance(game,3);return {game,events};
}
function advance(game,seconds,input={},hz=120) {
  for(let i=0;i<Math.round(seconds*hz);i++)game.update(1/hz,typeof input==='function'?input(game):input);
}
const route=rider=>parkRaceOpponentInput(rider,rider.course,1);
function until(game,condition,input=route,limit=120,hz=120) {
  for(let i=0;i<limit*hz&&!condition()&&game.phase==='running';i++)game.update(1/hz,typeof input==='function'?input(game):input);
  assert.ok(condition(),'condition reached through real park simulation');
}
function firstSpineLanding(game,tricks=['spin']) {
  until(game,()=>game.airborne);
  assert.equal(game.airLaunchSource,'ramp');
  for(const trick of tricks) {
    assert.equal(game.doTrick(trick),true);
    until(game,()=>!game.trick);assert.equal(game.bailTime,0);
  }
  until(game,()=>!game.airborne);assert.equal(game.wipeouts,0);
}

test('factory circuits have ordered finite grounded rings and a mandatory final ring',()=>{
  for(const id of ids) {
    const course=createParkRaceCourse(id);let distance=0;
    assert.equal(course.checkpoints.length,id==='moxie'?19:38);
    for(const gate of course.checkpoints) {
      assert.ok(gate.distance>distance);distance=gate.distance;
      assert.ok(gate.radius>=3.8&&gate.radius<=5.5);
      assert.equal(gate.y,parkRideSurface(gate.x,gate.z,parkHeight(gate.x,gate.z)).height+1.5);
      assert.ok(Number.isFinite(gate.rotation));
    }
    assert.equal(course.finish,course.checkpoints.at(-1));assert.equal(course.finish.finish,true);
    assert.equal(course.length,distance);
    assert.equal(course.checkpoints.filter(gate=>gate.finish).length,1);
  }
  assert.notDeepEqual(createParkRaceCourse('moxie').start,createParkRaceCourse('undertow').start);
  const king=createParkRaceCourse('kingtide');
  assert.ok(king.checkpoints.some(gate=>gate.x===-52&&gate.z===30));
  assert.ok(king.checkpoints.some(gate=>gate.x===52&&gate.z===30));
});

test('sun rings require forward swept entry within both horizontal and vertical radius',()=>{
  const gate={x:3,y:2,z:10,rotation:0,radius:4};
  const from={x:3,y:2,z:15},to={x:3,y:2,z:5};
  assert.deepEqual(sweepParkRaceGate(from,to,gate),{fraction:.5,inside:true});
  assert.equal(sweepParkRaceGate(to,from,gate),null,'reverse entry earns nothing');
  assert.equal(sweepParkRaceGate({...from,x:8},{...to,x:8},gate).inside,false,'cannot bypass ring sideways');
  assert.equal(sweepParkRaceGate({...from,y:7},{...to,y:7},gate).inside,false,'cannot fly above ring');
  assert.equal(sweepParkRaceGate({...from,x:6,y:5},{...to,x:6,y:5},gate).inside,false,'finite circle rather than a square');
  assert.equal(sweepParkRaceGate({...from,z:16},from,gate),null);
});

test('every rival naturally completes its route through real ramps and pipes',()=>{
  for(const id of ids) {
    const {game,events}=fixture(id);
    until(game,()=>game.phase==='finished',{brake:true},100);
    assert.equal(game.result,'loss');assert.equal(game.opponent.nextCheckpoint,game.course.checkpoints.length);
    assert.equal(game.opponent.raceMisses,0);assert.equal(game.opponent.wipeouts,0);
    assert.ok(game.opponent.visitedRamps.has('spine'),'rival physically clears the central spine');
    assert.ok(game.opponentFinishTime>30&&game.opponentFinishTime<90);
    const passes=events.filter(event=>event.type==='raceGate'&&event.opponent);
    assert.deepEqual(passes.map(event=>event.index),game.course.checkpoints.map(gate=>gate.index));
    assert.equal(game.getProgress().completedRounds,0,'loss preserves rank');
  }
});

test('a better pump and steering line wins all factory circuits without teleporting or missing rings',()=>{
  for(const id of ids) {
    const {game,events}=fixture(id);
    until(game,()=>game.phase==='finished',route,100);
    assert.equal(game.result,'win');assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
    assert.equal(game.raceMisses,0);assert.equal(game.wipeouts,0);
    assert.equal(events.filter(event=>event.type==='wall').length,0);
    assert.ok(game.visitedRamps.has('spine'));assert.equal(game.raceProgress,game.course.length);
    assert.equal(game.racePosition,1);assert.equal(game.distanceRemaining,0);
    assert.equal(game.getProgress().completedRounds,game.roundIndex+1);
  }
});

test('course progress is ordered and cannot be advanced by a shortcut to the final ring',()=>{
  const course=createParkRaceCourse('kingtide'),finish=course.finish;
  const rider={...finish,nextCheckpoint:0};
  assert.ok(parkRaceProgress(rider,course)<course.checkpoints[0].distance);
  rider.nextCheckpoint=course.checkpoints.length;
  assert.equal(parkRaceProgress(rider,course),course.length);
  const {game}=fixture();game.x=95;game.z=-150;
  advance(game,.1,{brake:true});assert.equal(game.nextCheckpoint,0);assert.equal(game.result,null);
});

test('factory countdown and pause freeze both riders, and restart resets gates without losing rank',()=>{
  const game=new ParkRaceGame(()=>{},{progress:{version:1,completedRounds:2},roundIndex:2});game.start();
  const initial=[game.x,game.z,game.opponent.x,game.opponent.z];
  assert.equal(game.jump(),false);assert.equal(game.doCutback(1),false);
  advance(game,2,{pump:true,left:true});assert.deepEqual([game.x,game.z,game.opponent.x,game.opponent.z],initial);
  game.pause();const countdown=game.countdownRemaining;advance(game,3,route);assert.equal(game.countdownRemaining,countdown);
  game.resume();advance(game,2,route);assert.ok(game.elapsed>0);
  game.pause();const snapshot=[game.x,game.z,game.opponent.x,game.opponent.z,game.elapsed];advance(game,3,route);
  assert.deepEqual([game.x,game.z,game.opponent.x,game.opponent.z,game.elapsed],snapshot);
  game.retry();assert.equal(game.nextCheckpoint,0);assert.equal(game.opponent.nextCheckpoint,0);
  assert.equal(game.countdownRemaining,3);assert.equal(game.getProgress().completedRounds,2);
});

test('factory races have no time limit while ordinary Waterworks retains its session timer',()=>{
  const {game}=fixture();game.elapsed=200;game.opponent.elapsed=200;
  advance(game,.1,{brake:true});assert.equal(game.phase,'running');assert.ok(game.time>200);
  assert.equal(game.opponent.phase,'running');
  const normal=new WaveParkGame();normal.start();normal.elapsed=121;normal.update(1/120,{});
  assert.equal(normal.phase,'finished');assert.equal(normal.forwardSpeedBonus,0);
});

class UnboostedParkRace extends ParkRaceGame {get forwardSpeedBonus(){return 0;}}
test('natural spine tricks reward only a clean landing and produce a stronger combo boost',()=>{
  const single=fixture(),combo=fixture(),control=fixture('moxie',UnboostedParkRace);
  firstSpineLanding(single.game,['spin']);firstSpineLanding(combo.game,['spin','tweak']);firstSpineLanding(control.game,['spin','tweak']);
  assert.equal(single.game.boostSpeed,6);assert.equal(single.game.boostDuration,2);
  assert.equal(combo.game.boostSpeed,9);assert.equal(combo.game.boostDuration,2.6);
  assert.equal(combo.game.boostLevel,'combo');assert.equal(combo.events.filter(event=>event.type==='raceBoost'&&!event.opponent).length,1);
  assert.equal(combo.events.at(-1).type,'raceBoost');assert.equal(combo.game.z,control.game.z);
  advance(combo.game,.5,{pump:true});advance(control.game,.5,{pump:true});
  assert.ok(combo.game.speed-control.game.speed>4,'landed combo provides physical thrust');
  assert.ok(control.game.z-combo.game.z>1,'boost moves the board farther');
  for(const key of ['x','z','elapsed','nextCheckpoint'])assert.equal(combo.game.opponent[key],control.game.opponent[key]);
});

test('flat-ground tricks now earn boosts but empty airs and incomplete tricks do not',()=>{
  const flat=fixture();assert.equal(flat.game.jump(),true);assert.equal(flat.game.airLaunchSource,'flat');
  assert.equal(flat.game.doTrick('spin'),true);until(flat.game,()=>!flat.game.airborne,{});
  assert.equal(flat.events.filter(event=>event.type==='raceBoost'&&!event.opponent).length,1);
  const empty=fixture();until(empty.game,()=>empty.game.airborne);until(empty.game,()=>!empty.game.airborne);
  assert.equal(empty.events.filter(event=>event.type==='raceBoost'&&!event.opponent).length,0);
  const unfinished=fixture();until(unfinished.game,()=>unfinished.game.airborne&&unfinished.game.vy<0&&unfinished.game.y-unfinished.game.surface.height<1);
  assert.equal(unfinished.game.doTrick('special'),true);until(unfinished.game,()=>!unfinished.game.airborne);
  assert.equal(unfinished.game.wipeouts,1);assert.equal(unfinished.events.filter(event=>event.type==='raceBoost'&&!event.opponent).length,0);
});

test('boost pauses, drains while braking, survives a bank and clears on bail, miss, retry and finish',()=>{
  const {game}=fixture();firstSpineLanding(game,['spin','tweak']);
  const before=game.boostTime;game.pause();advance(game,2,route);assert.equal(game.boostTime,before);game.resume();
  assert.equal(game.bank(),true);assert.equal(game.bank(),false);assert.equal(game.boostTime,before);
  advance(game,.4,{brake:true});assert.ok(game.boostTime<before);assert.ok(game.speed<10);
  game.bail();assert.equal(game.boostTime,0);game.retry();assert.equal(game.boostTime,0);
  advance(game,3);game.awardRaceBoost({tricks:99});assert.equal(game.boostSpeed,13);assert.equal(game.boostTime,3.6);
  const gate=game.course.checkpoints[0];
  game.x=gate.x+8;game.z=gate.z+.05;game.y=parkHeight(game.x,game.z);game.heading=0;game.vx=0;game.vz=-20;
  game.update(1/120,{});assert.equal(game.raceMisses,1);assert.equal(game.nextCheckpoint,0);assert.equal(game.boostTime,0);
  game.awardRaceBoost({tricks:2});game.finish('loss');assert.equal(game.boostTime,0);
});

test('fixed rival driving never changes based on the player and held boost works across frame rates',()=>{
  const a=fixture(),b=fixture();advance(a.game,8,route);advance(b.game,8,{left:true,brake:true});
  for(const key of ['x','z','heading','elapsed','nextCheckpoint'])assert.equal(a.game.opponent[key],b.game.opponent[key]);
  const finishes=[];
  for(const hz of[30,60,120]) {
    const {game}=fixture();until(game,()=>game.phase==='finished',route,100,hz);
    assert.equal(game.raceMisses,0);assert.equal(game.wipeouts,0);assert.equal(game.result,'win');finishes.push(game.finishTime);
  }
  assert.ok(Math.max(...finishes)-Math.min(...finishes)<.5,'ordinary steering stays stable across refresh rates');
});

test('a missed tunnel ring remains required and can be recovered through the open pipe mouth',()=>{
  const {game,events}=fixture(),gate=game.course.checkpoints[0];
  Object.assign(game,{x:gate.x+8,z:gate.z+.05,y:parkHeight(gate.x+8,gate.z),heading:0,vx:0,vz:-20});
  game.update(1/120,{});assert.equal(game.nextCheckpoint,0);assert.equal(game.raceMisses,1);
  until(game,()=>game.nextCheckpoint>0,route,20);
  assert.equal(game.nextCheckpoint,1);assert.equal(game._raceGateMissed,false);
  assert.equal(events.filter(event=>event.type==='raceGate'&&!event.opponent&&event.index===0).length,1);
  assert.equal(game.bailTime,0);
});

test('simultaneous final-ring crossings use swept times and a true tie preserves the rival rank',()=>{
  const {game}=fixture(),gate=game.course.finish,n={x:-Math.sin(gate.rotation),z:-Math.cos(gate.rotation)};
  for(const rider of[game,game.opponent]) {
    const x=gate.x-n.x*.03,z=gate.z-n.z*.03;
    Object.assign(rider,{x,z,y:parkHeight(x,z),heading:gate.rotation,vx:n.x*12,vz:n.z*12,speed:12,
      nextCheckpoint:game.course.checkpoints.length-1,raceLane:0,airborne:false,trick:null});
    rider.surface=parkRideSurface(x,z,rider.y);
  }
  game.update(1/120,parkRaceOpponentInput(game,game.course,game.rival.pace));
  assert.equal(game.phase,'finished');assert.equal(game.result,'loss');
  assert.ok(Math.abs(game.finishTime-game.opponentFinishTime)<1e-9);
  assert.equal(game.resultReason,'PHOTO FINISH - RIVAL HOLDS RANK');
  assert.equal(game.getProgress().completedRounds,0);
});
