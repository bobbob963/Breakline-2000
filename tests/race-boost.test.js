import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame,waveHeight } from '../src/game.js';
import { SurfRaceGame,RACE_BOOST_MAX_SPEED,RACE_BOOST_MAX_DURATION,raceOpponentInput } from '../src/surf-race.js';
import { TournamentGame } from '../src/tournament.js';

function fixture(Game=SurfRaceGame) {
  const events=[],game=new Game(event=>events.push(event));
  game.start();advance(game,3);assert.equal(game.countdownRemaining,0);
  return {game,events};
}
function advance(game,seconds,input={},hz=120) {
  for(let step=0;step<Math.round(seconds*hz);step++)game.update(1/hz,typeof input==='function'?input(game):input);
}
function until(game,condition,input={},limit=5,hz=120) {
  for(let step=0;step<limit*hz&&!condition();step++)game.update(1/hz,typeof input==='function'?input(game):input);
  assert.ok(condition(),'condition reached through simulation');
}
function air(game,tricks=['spin'],hz=120,direction=game.x>0?-1:1) {
  assert.equal(game.doCutback(direction),true);
  until(game,()=>!game.cutbackActive,{},2,hz);
  advance(game,.7,{jump:true},hz);
  assert.equal(game.jump(),true);assert.equal(game.airLaunchSource,'cutback');
  for(const trick of tricks) {
    assert.equal(game.doTrick(trick),true,trick);
    until(game,()=>!game.trick,{},2,hz);
    assert.equal(game.bailTime,0);
  }
  until(game,()=>!game.airborne,{},3,hz);
  assert.equal(game.bailTime,0,'clean landing');
}
const boosts=events=>events.filter(event=>event.type==='raceBoost');
const cleanLine=game=>raceOpponentInput(game,game.course,0);
class UnboostedRace extends SurfRaceGame {get forwardSpeedBonus(){return 0;}}

test('a legal cutback trick awards only on landing and earns real forward distance',()=>{
  const {game,events}=fixture(),control=fixture(UnboostedRace).game;
  assert.equal(game.doCutback(1),true);until(game,()=>!game.cutbackActive);
  advance(game,.7,{jump:true});assert.equal(game.jump(),true);assert.equal(game.doTrick('spin'),true);
  until(game,()=>!game.trick);assert.equal(game.airborne,true);assert.equal(boosts(events).length,0);
  until(game,()=>!game.airborne);air(control);
  assert.equal(game.wipeouts,0);assert.equal(boosts(events).length,1);
  assert.equal(game.boostLevel,'trick');assert.equal(game.boostSpeed,6);assert.equal(game.boostDuration,1.4);
  assert.equal(events.at(-1).type,'raceBoost');
  assert.ok(events.findIndex(event=>event.type==='land')<events.findIndex(event=>event.type==='raceBoost'));
  assert.equal(game.distance,control.distance);
  advance(game,2,cleanLine,120);advance(control,2,cleanLine,120);
  assert.ok(game.distance-control.distance>7,'a single landed trick adds several metres');
  assert.equal(game.boostTime,0);assert.equal(game.boostSpeed,0);assert.equal(game.boostLevel,null);
  for(const key of ['distance','speed','x','elapsed','nextCheckpoint'])assert.equal(game.opponent[key],control.opponent[key],key);
});

test('two genuinely completed tricks land a stronger longer combo boost than one',()=>{
  const single=fixture(),combo=fixture(),control=fixture(UnboostedRace);
  air(single.game,['spin']);air(combo.game,['spin','tweak']);air(control.game,['spin','tweak']);
  assert.equal(boosts(combo.events).length,1);assert.equal(boosts(combo.events)[0].tricks,2);
  assert.equal(combo.game.boostLabel,'COMBO BOOST');assert.equal(combo.game.boostLevel,'combo');
  assert.ok(combo.game.boostSpeed>single.game.boostSpeed);assert.ok(combo.game.boostDuration>single.game.boostDuration);
  advance(combo.game,2,cleanLine,120);advance(control.game,2,cleanLine,120);
  assert.ok(combo.game.distance-control.game.distance>12,'combo gain is worth linking tricks');
});

test('empty and flat hops never refresh boost or reuse an unbanked trick',()=>{
  const {game,events}=fixture();assert.equal(game.jump(),true);assert.equal(game.airLaunchSource,'flat');
  assert.equal(game.doTrick('spin'),false);until(game,()=>!game.airborne);assert.equal(boosts(events).length,0);
  until(game,()=>game.popReady);air(game,['spin']);assert.equal(boosts(events).length,1);
  assert.equal(game.pendingTricks,1,'the old trick remains unbanked');
  until(game,()=>game.popReady);assert.equal(game.jump(),true);until(game,()=>!game.airborne);
  assert.equal(boosts(events).length,1);
});

test('a fresh air extends an unbanked combo, while banking starts the next reward at one trick',()=>{
  for(const bankFirst of[false,true]) {
    const {game,events}=fixture();air(game,['spin'],120,-1);
    if(bankFirst){assert.equal(game.bank(),true);assert.ok(game.boostTime>0);}
    until(game,()=>game.popReady);
    air(game,['spin'],120,1);
    assert.equal(boosts(events).length,2);
    assert.equal(boosts(events)[1].tricks,bankFirst?1:2);
    assert.equal(boosts(events)[1].combo,!bankFirst);
  }
});

test('bailed and unfinished airs earn no boost and a wipeout removes an active burst',()=>{
  const {game,events}=fixture();air(game,['spin']);assert.ok(game.boostTime>0);
  game.bail();assert.equal(game.boostTime,0);assert.equal(game.boostSpeed,0);
  const other=fixture();assert.equal(other.game.doCutback(1),true);until(other.game,()=>!other.game.cutbackActive);
  assert.equal(other.game.jump(),true);
  until(other.game,()=>other.game.airtime>.95);
  assert.equal(other.game.doTrick('special'),true);until(other.game,()=>!other.game.airborne);
  assert.equal(other.game.wipeouts,1);assert.equal(boosts(other.events).length,0);
});

test('pause freezes the award, braking suppresses thrust and retry/finish clear it',()=>{
  const {game}=fixture(),control=fixture(UnboostedRace).game;air(game);air(control);
  game.pause();const snapshot=[game.boostTime,game.distance,game.speed];advance(game,2,{pump:true});
  assert.deepEqual([game.boostTime,game.distance,game.speed],snapshot);game.resume();
  advance(game,.8,{brake:true});advance(control,.8,{brake:true});assert.equal(game.distance,control.distance);
  assert.ok(game.boostTime>0&&game.boostTime<snapshot[0]);
  game.finish('loss');assert.equal(game.boostTime,0);assert.equal(game.boostLabel,'');
  game.retry();assert.equal(game.boostTime,0);assert.equal(game.boostDuration,0);assert.equal(game.countdownRemaining,3);
});

test('missing a race flag clears boost along with the failed attempt',()=>{
  const {game,events}=fixture();air(game);const gate=game.course.checkpoints[0];
  game.distance=gate.distance-.05;game.x=11;game.vx=0;game.y=waveHeight(game.x,-game.distance,game.elapsed);
  game.update(1/120,{});assert.equal(game.raceMisses,1);assert.equal(game.boostTime,0);assert.equal(game.boostSpeed,0);
  assert.equal(boosts(events).length,1);
});

test('boost strength and lifetime are capped and new rewards refresh rather than stack',()=>{
  const {game}=fixture();game.awardRaceBoost({tricks:999});
  assert.equal(game.boostSpeed,RACE_BOOST_MAX_SPEED);assert.equal(game.boostTime,RACE_BOOST_MAX_DURATION);
  game.awardRaceBoost({tricks:999});assert.equal(game.boostTime,RACE_BOOST_MAX_DURATION);
  advance(game,1,{pump:true});assert.ok(game.speed<=game.rules.pumpSpeed+RACE_BOOST_MAX_SPEED);
});

test('natural trick boost progress is consistent at30,60and120Hz',()=>{
  const states=[];
  for(const hz of[30,60,120]) {
    const {game,events}=fixture();air(game,['spin','tweak']);advance(game,2,cleanLine,hz);
    assert.equal(boosts(events).length,1);states.push(game);
  }
  for(const state of states.slice(1)) {
    assert.ok(Math.abs(state.distance-states[0].distance)<1e-8,'boost distance does not depend on rendering rate');
    assert.ok(Math.abs(state.speed-states[0].speed)<1e-8);
    assert.equal(state.wipeouts,0);
  }
});

test('normal Surf Session, Reef Rush, Storm and Waterworks do not receive a race bonus',()=>{
  for(const id of['surf','rush','storm']) {
    const game=new SurfGame(()=>{},id);assert.equal(game.forwardSpeedBonus,0);
    game.boostTime=99;game.boostSpeed=99;assert.equal(game.forwardSpeedBonus,0);
  }
  assert.equal(new TournamentGame().forwardSpeedBonus,0);
});
