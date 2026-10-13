import test from 'node:test';
import assert from 'node:assert/strict';
import { PARK_BOUNDS,parkHeight,parkRideSurface } from '../src/park.js';
import { createParkTrialCourse,createParkRaceCourse,parkRaceOpponentInput,parkRaceTrickInput } from '../src/park-race.js';
import { ParkTimeTrialGame } from '../src/time-trials.js';

const trialIndices=[5,11];
function runTrial(stage,hz=120,{reward=null,tricks=false}={}) {
  const events=[],trialIndex=trialIndices[stage];
  const game=new ParkTimeTrialGame(event=>events.push(event),{version:1,completedTrials:trialIndex,selectedTrial:trialIndex});
  game.setRewardBoard(reward);game.start();
  for(let step=0;step<(game.target+4)*hz&&game.phase==='running';step++) {
    const controls=tricks?parkRaceTrickInput(game,game.course,1):parkRaceOpponentInput(game,game.course,1);
    game.update(1/hz,controls);
  }
  return {game,events};
}
const footprint=course=>{
  const xs=course.checkpoints.map(gate=>gate.x),zs=course.checkpoints.map(gate=>gate.z);
  return (Math.max(...xs)-Math.min(...xs))*(Math.max(...zs)-Math.min(...zs));
};

test('Waterworks solo trials extend across the whole plant with unique grounded mandatory rings',()=>{
  const first=createParkTrialCourse(),final=createParkTrialCourse(1),rival=createParkRaceCourse('kingtide');
  assert.ok(first.length>1500&&final.length>1900);
  assert.ok(final.length>first.length+300,'finale adds a distinct collection-bowl section');
  assert.ok(footprint(first)>footprint(rival)*4,'larger physical route area, not just more laps');
  for(const course of[first,final]) {
    assert.equal(course.laps,1);
    assert.equal(new Set(course.checkpoints.map(gate=>`${gate.x}/${gate.z}`)).size,course.checkpoints.length,'no recycled laps');
    assert.equal(course.checkpoints.filter(gate=>gate.finish).length,1);
    assert.equal(course.finish,course.checkpoints.at(-1));
    let distance=0;
    for(const gate of course.checkpoints) {
      assert.ok(gate.x>PARK_BOUNDS.minX+8&&gate.x<PARK_BOUNDS.maxX-8);
      assert.ok(gate.z>PARK_BOUNDS.minZ+8&&gate.z<PARK_BOUNDS.maxZ-8);
      assert.equal(gate.y,parkRideSurface(gate.x,gate.z,parkHeight(gate.x,gate.z)).height+1.5);
      assert.ok(gate.radius>=3.8&&gate.radius<=5.5);
      assert.ok(gate.distance>distance);distance=gate.distance;
    }
    assert.equal(distance,course.length);
  }
  assert.ok(final.checkpoints.some(gate=>gate.x===0&&gate.z===-140));
  assert.notEqual(first.start.x,final.start.x,'different rusty pipe starts');
});

test('both extended factory trials finish with normal controls at 30, 60 and 120 Hz',()=>{
  for(const stage of[0,1]) {
    const times=[];
    for(const hz of[30,60,120]) {
      const {game,events}=runTrial(stage,hz);
      assert.equal(game.result,'win',`stage ${stage} at ${hz} Hz`);
      assert.equal(game.raceMisses,0);assert.equal(game.wipeouts,0);
      assert.equal(events.filter(event=>event.type==='wall').length,0);
      assert.deepEqual(events.filter(event=>event.type==='raceGate').map(event=>event.index),game.course.checkpoints.map(gate=>gate.index));
      assert.ok(game.visitedRamps.has('spine'),'natural ramp air through the central return');
      assert.ok(game.finishTime<game.course.recommendedTime);
      times.push(game.finishTime);
    }
    // The control policy chooses a new turn once per displayed frame, so the
    // 47/58 corners have a small accumulated reaction difference at 30 Hz.
    assert.ok(Math.max(...times)-Math.min(...times)<1.5,'consistent steering and finish at ordinary refresh rates');
  }
});

test('Skybound glide and landed trick boosts still fit through both full-plant courses',()=>{
  for(const stage of[0,1]) {
    const {game,events}=runTrial(stage,120,{reward:'sky',tricks:true});
    assert.equal(game.result,'win');assert.equal(game.wipeouts,0);assert.equal(game.raceMisses,0);
    assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
    assert.ok(events.some(event=>event.type==='raceBoost'),'real completed tricks provide a physical speed boost');
    assert.equal(events.filter(event=>event.type==='wall').length,0);
  }
});
