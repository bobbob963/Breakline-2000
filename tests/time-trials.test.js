import test from 'node:test';
import assert from 'node:assert/strict';
import { TIME_TRIALS,createTimeTrialGame,sanitizeTimeTrialProgress,timeTrialsUnlocked,selectTimeTrial,recordTimeTrialWin } from '../src/time-trials.js';
import { SurfGame,waveHeight } from '../src/game.js';
import { WaveParkGame,parkHeight,parkRideSurface } from '../src/park.js';
import { surfRaceTrickInput,raceOpponentInput,RACE_COUNTDOWN } from '../src/surf-race.js';
import { parkRaceTrickInput,parkRaceOpponentInput } from '../src/park-race.js';
import { selectTournamentLadder } from '../src/tournament-progress.js';
import { TRIAL_COSMETIC_SETS } from '../src/trial-cosmetics.js';

const save=(index=0)=>({version:1,completedTrials:index,selectedTrial:index,bestTimes:[]});
const controls=game=>game.mode==='surf'?surfRaceTrickInput(game,game.course,1):parkRaceTrickInput(game,game.course,1);
const steering=game=>game.mode==='surf'?raceOpponentInput(game,game.course,1):parkRaceOpponentInput(game,game.course,1);
function fixture(index=0) {const events=[],game=createTimeTrialGame(event=>events.push(event),save(index));game.start();return {game,events};}
function advance(game,seconds,input={},hz=120) {for(let n=0;n<Math.round(seconds*hz);n++)game.update(1/hz,typeof input==='function'?input(game):input);}
function complete(game,input=controls,hz=120) {
  for(let n=0;n<hz*(game.trial.timeLimit+RACE_COUNTDOWN+2)&&game.phase==='running';n++)game.update(1/hz,input(game));
  assert.equal(game.phase,'finished');
}

test('time trials stay unlocked after all five ladders, including resetting an earlier ladder',()=>{
  assert.equal(timeTrialsUnlocked(null),false);
  assert.equal(timeTrialsUnlocked({version:1,completedRounds:5}),false);
  for(let cleared=0;cleared<5;cleared++)assert.equal(timeTrialsUnlocked({version:2,ladderIndex:Math.min(4,cleared),completedRounds:0,completedLadders:cleared}),false);
  const champion={version:2,ladderIndex:4,completedRounds:5,completedLadders:5};
  assert.equal(timeTrialsUnlocked(champion),true);
  for(let ladder=0;ladder<5;ladder++)assert.equal(timeTrialsUnlocked(selectTournamentLadder(champion,ladder)),true);
});

test('twelve ordered solo trials are predominantly waves and grow within each venue',()=>{
  assert.equal(TIME_TRIALS.length,12);
  assert.deepEqual(TIME_TRIALS.filter(trial=>trial.venue==='park').map(trial=>trial.index),[5,11]);
  for(const venue of ['surf','park']) {
    const group=TIME_TRIALS.filter(trial=>trial.venue===venue);
    for(let index=1;index<group.length;index++) {
      assert.ok(group[index].length>group[index-1].length);
      assert.ok(group[index].timeLimit/group[index].length<group[index-1].timeLimit/group[index-1].length);
    }
  }
  for(const trial of TIME_TRIALS) {
    const game=createTimeTrialGame(()=>{},save(trial.index));
    assert.equal(game.trial,trial);assert.equal(game.trialIndex,trial.index);
    assert.equal(game.mode,trial.venue);assert.equal(game.isTimeTrial,true);assert.equal(game.isRace,true);assert.equal(game.isTournament,false);
    assert.equal(game.opponent,undefined);assert.ok(game instanceof (trial.venue==='park'?WaveParkGame:SurfGame));
    assert.equal(game.course.length,trial.length);assert.equal(game.time,trial.timeLimit);
  }
});

test('saved progress sanitizes hostile or partial input and never retains locked event PBs',()=>{
  const fresh=sanitizeTimeTrialProgress(null);
  for(const bad of [null,[],{},'champion',{version:2,completedTrials:12},{version:1,completedTrials:13},{version:1,completedTrials:NaN},Object.create({version:1,completedTrials:12})])assert.deepEqual(sanitizeTimeTrialProgress(bad),fresh);
  const dirty={version:1,completedTrials:4,selectedTrial:11,bestTimes:[21,Infinity,-1,999,20,...Array(7).fill(25)]};
  const safe=sanitizeTimeTrialProgress(dirty);
  assert.equal(safe.selectedTrial,4);assert.deepEqual(safe.bestTimes,[21,...Array(11).fill(null)]);
  safe.bestTimes[0]=15;assert.equal(dirty.bestTimes[0],21,'returned array does not alias saved input');
  const mutated=createTimeTrialGame(()=>{},save(2));const output=mutated.getProgress();output.bestTimes[0]=1;output.completedTrials=12;
  assert.equal(mutated.getProgress().completedTrials,2);assert.equal(mutated.getProgress().bestTimes[0],null);
});

test('only first clears of each sequential trial progress and every third clear earns one permanent set',()=>{
  let progress=sanitizeTimeTrialProgress(null);const sets=[];
  for(let index=0;index<12;index++) {
    assert.equal(selectTimeTrial(progress,index+1),null);
    assert.deepEqual(recordTimeTrialWin(progress,index+1,25),progress);
    const before=progress.completedTrials;
    progress=recordTimeTrialWin(progress,index,25);
    assert.equal(progress.completedTrials,index+1);assert.equal(progress.selectedTrial,Math.min(index+1,11));
    sets.push(...TRIAL_COSMETIC_SETS.filter(set=>set.requiredClears>before&&set.requiredClears<=progress.completedTrials));
    const repeated=recordTimeTrialWin(selectTimeTrial(progress,index),index,30);
    assert.equal(repeated.completedTrials,index+1);assert.equal(repeated.selectedTrial,index);assert.equal(repeated.bestTimes[index],25);
    const improved=recordTimeTrialWin(repeated,index,24);assert.equal(improved.bestTimes[index],24);
    assert.deepEqual(recordTimeTrialWin(improved,index,Infinity),improved);
    assert.deepEqual(recordTimeTrialWin(improved,index,TIME_TRIALS[index].timeLimit+1),improved);
  }
  assert.deepEqual(sets.map(set=>set.requiredClears),[3,6,9,12]);
  assert.equal(sanitizeTimeTrialProgress(JSON.parse(JSON.stringify(progress))).completedTrials,12);
});

test('all twelve courses are winnable using only public steering, pumping, jumps and landed tricks',()=>{
  const margins=[];
  for(const trial of TIME_TRIALS) {
    const {game,events}=fixture(trial.index);
    complete(game);
    assert.equal(game.result,'win',trial.name);assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
    assert.equal(game.raceMisses,0);assert.equal(game.wipeouts,0);
    assert.equal(events.filter(event=>event.type==='wall').length,0);
    assert.deepEqual(events.filter(event=>event.type==='raceGate').map(event=>event.index),game.course.checkpoints.map(gate=>gate.index));
    assert.ok(events.some(event=>event.type==='raceBoost'),'clean tricks yield physical boosts');
    assert.ok(game.finishTime>0&&game.finishTime<trial.timeLimit);
    assert.equal(game.time,trial.timeLimit-game.finishTime);assert.equal(game.getProgress().completedTrials,trial.index+1);
    const result=events.find(event=>event.type==='finish');assert.equal(result.timeTrial,true);assert.equal(result.trialIndex,trial.index);
    assert.equal(result.progress.selectedTrial,Math.min(trial.index+1,11));
    assert.equal(result.unlockedSet?.requiredClears??null,(trial.index+1)%3===0?trial.index+1:null);
    assert.equal(game.complete,trial.index===11);
    margins.push(trial.timeLimit/game.finishTime);
  }
  for(let index=1;index<margins.length;index++)assert.ok(margins[index]<margins[index-1],`trial ${index+1} has less proportional spare time than trial ${index}`);
});

test('countdown rejects movement and pause freezes clocks, including a countdown frame remainder',()=>{
  for(const index of [0,5]) {
    const {game,events}=fixture(index);
    const initial=[game.x,game.y,game.z,game.distance,game.elapsed,game.time];
    assert.equal(game.jump(),false);assert.equal(game.doCutback(1),false);
    advance(game,2,{pump:true,jump:true,right:true});
    assert.deepEqual([game.x,game.y,game.z,game.distance,game.elapsed,game.time],initial);
    game.pause();const frozenCountdown=game.countdownRemaining;advance(game,3,controls);assert.equal(game.countdownRemaining,frozenCountdown);
    game.resume();game.countdownRemaining=.003;game.update(.008,{});
    assert.equal(game.countdownRemaining,0);assert.ok(Math.abs(game.elapsed-.005)<1e-12);
    assert.equal(events.filter(event=>event.type==='raceGo').length,1);
    advance(game,3,controls);game.pause();const paused=[game.elapsed,game.time,game.x,game.z,game.distance,game.boostTime];
    advance(game,2,controls);assert.deepEqual([game.elapsed,game.time,game.x,game.z,game.distance,game.boostTime],paused);
  }
});

test('retries keep the original trial while next event uses updated progression and rewards never repeat',()=>{
  const {game,events}=fixture(2);complete(game);
  assert.equal(game.trialIndex,2);assert.equal(game.getProgress().selectedTrial,3);
  const next=createTimeTrialGame(()=>{},game.getProgress());assert.equal(next.trialIndex,3);
  const personalBest=game.finishTime;assert.equal(game.retry(),true);
  assert.equal(game.trialIndex,2);assert.equal(game.time,game.trial.timeLimit);assert.equal(game.countdownRemaining,3);
  assert.equal(game.boostTime,0);assert.equal(game.elapsed,0);assert.equal(game.nextCheckpoint,0);
  complete(game);assert.equal(game.result,'win');assert.equal(game.unlockedSet,null);
  assert.equal(game.getProgress().completedTrials,3);assert.ok(game.getProgress().bestTimes[2]<=personalBest);
  assert.equal(events.filter(event=>event.type==='finish'&&event.unlockedSet).length,1);
});

test('clock expiry is exact, finish is single-shot and losses never unlock an event',()=>{
  for(const hz of [30,60,120])for(const index of [0,5]) {
    const {game,events}=fixture(index);advance(game,3);
    game.elapsed=game.trial.timeLimit-.003;
    game.update(1/hz,{brake:true});
    assert.equal(game.phase,'finished');assert.equal(game.result,'loss');assert.equal(game.time,0);
    assert.equal(game.elapsed,game.trial.timeLimit);assert.equal(game.resultReason,'TIME EXPIRED');
    assert.equal(game.getProgress().completedTrials,index);assert.equal(game.finishTime,null);
    assert.equal(game.finish('win'),false);advance(game,2,controls);
    assert.equal(events.filter(event=>event.type==='finish').length,1);
  }
});

test('a swept finish before the buzzer counts but unfinished gates and a late crossing cannot win',()=>{
  for(const state of ['before','late','gates-left']) {
    const {game}=fixture();advance(game,3);
    game.elapsed=game.trial.timeLimit-(state==='late'?0:.001);
    game.distance=game.course.length-.001;game.x=0;game.speed=26;game.vx=0;
    game.y=waveHeight(game.x,-game.distance,game.elapsed);
    game.nextCheckpoint=state==='gates-left'?0:game.course.checkpoints.length;
    game.update(1/30,{pump:true});
    assert.equal(game.result,state==='before'?'win':'loss');
    assert.equal(game.getProgress().completedTrials,state==='before'?1:0);
    if(state==='before')assert.ok(game.finishTime<game.trial.timeLimit);
  }
  const {game}=fixture();assert.equal(game.finish('win'),true);assert.equal(game.result,'loss');assert.equal(game.getProgress().completedTrials,0);
});

test('ocean trial misses fail at the actual crossing, without rewinding or teleporting the rider',()=>{
  const {game,events}=fixture();advance(game,3);
  const gate=game.course.checkpoints[0];game.distance=gate.distance-.1;game.x=12;game.vx=0;
  game.y=waveHeight(game.x,-game.distance,game.elapsed);
  game.update(1/30,{pump:true});
  assert.equal(game.result,'loss');assert.equal(game.nextCheckpoint,0);assert.equal(game.raceMisses,1);
  assert.ok(game.distance>=gate.distance);assert.ok(game.x>11.9);assert.equal(game.boostTime,0);
  assert.equal(events.filter(event=>event.type==='raceMiss').length,1);assert.equal(game.getProgress().completedTrials,0);
});

test('missed factory rings stay required and can be recovered through the pipe mouth',()=>{
  const {game}=fixture(5);advance(game,3);const gate=game.course.checkpoints[0];
  Object.assign(game,{x:gate.x+8,z:gate.z+.05,y:parkHeight(gate.x+8,gate.z),heading:0,vx:0,vz:-20});
  game.surface=parkRideSurface(game.x,game.z,game.y);game.update(1/120,{});
  assert.equal(game.nextCheckpoint,0);assert.equal(game.raceMisses,1);assert.equal(game.phase,'running');
  for(let n=0;n<120*30&&game.nextCheckpoint===0;n++)game.update(1/120,steering(game));
  assert.equal(game.nextCheckpoint,1);assert.equal(game._raceGateMissed,false);
});

test('ocean timer and clean controls remain stable at30,60and120Hz',()=>{
  const finishes=[];
  for(const hz of [30,60,120]) {
    const {game}=fixture(10);complete(game,controls,hz);
    assert.equal(game.result,'win');assert.equal(game.raceMisses,0);assert.equal(game.wipeouts,0);finishes.push(game.finishTime);
  }
  assert.ok(Math.max(...finishes)-Math.min(...finishes)<.5);
});
