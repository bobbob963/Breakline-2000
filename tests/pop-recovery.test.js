import test from 'node:test';
import assert from 'node:assert/strict';
import {SurfGame,POP_COOLDOWN,CUTBACK_LAUNCH_WINDOW,TRICKS,waveCrest} from '../src/game.js';
import {WaveParkGame} from '../src/park.js';

function advance(game,seconds,input={}){for(let i=0;i<Math.round(seconds*120);i++)game.update(1/120,input);}
function land(game) {
  for(let i=0;i<600&&game.airborne;i++){game.update(1/120);assert.equal(game.popCooldown,POP_COOLDOWN,'airtime cannot pay off recovery');}
  assert.equal(game.airborne,false);
}
function earnCutback(game) {
  advance(game,.3,{right:true,pump:true});
  game.update(1/120,{grind:true,left:true,jump:true});
  assert.equal(game.cutbackActive,true);
  for(let i=0;i<150&&game.cutbackActive;i++)game.update(1/120,{jump:true});
  assert.equal(game.cutbackActive,false);assert.equal(game.launchSource,'cutback');
}

test('every mode requires 1.4 seconds on the ground after a manual pop',()=>{
  for(const mode of ['surf','rush','storm','park']) {
    const game=mode==='park'?new WaveParkGame():new SurfGame(()=>{},mode);game.start();
    assert.equal(game.popReady,true);assert.equal(game.jump(),true);assert.equal(game.popReady,false);
    assert.equal(game.popCooldown,1.4);land(game);
    assert.equal(game.popCooldown,1.4);assert.equal(game.jump(),false);
    advance(game,1.25,{brake:true});assert.ok(game.popCooldown>.14&&game.popCooldown<.16);
    assert.equal(game.jump(),false);
    game.pause();const recovery=game.popCooldown;advance(game,2);assert.equal(game.popCooldown,recovery);game.resume();
    advance(game,.16,{brake:true});assert.equal(game.popCooldown,0);assert.equal(game.popReady,true);assert.equal(game.jump(),true);
    game.start();assert.equal(game.popCooldown,0);assert.equal(game.popReady,true);
  }
});

test('even a fully charged flat ocean hop cannot start any trick or earn empty jump points',()=>{
  for(const id of ['surf','rush','storm']) {
    const events=[],game=new SurfGame(event=>events.push(event),id);game.start();
    advance(game,.8,{jump:true});assert.equal(game.launchSource,'flat');
    assert.equal(game.jump(),true);assert.equal(game.airLaunchSource,'flat');assert.ok(game.vy<=(id==='rush'?2.6:3.2));
    for(const trick of Object.keys(TRICKS))assert.equal(game.doTrick(trick),false);
    land(game);assert.ok(game.airtime<.8);assert.equal(game.comboBase,0);assert.equal(game.pendingTricks,0);
    assert.equal(game.bank(),false);assert.equal(game.score,0);assert.equal(game.wipeouts,0);
    assert.equal(events.filter(event=>event.type==='trick').length,0);
  }
});

test('the actual cutback control earns a consumed power-launch window in every ocean mode',()=>{
  for(const id of ['surf','rush','storm']) {
    const game=new SurfGame(()=>{},id);game.start();earnCutback(game);
    assert.equal(game.comboBase,0);assert.equal(game.score,0);assert.equal(game.bank(),false);
    assert.ok(game.cutbackLaunchTime>2.1&&game.cutbackLaunchTime<=CUTBACK_LAUNCH_WINDOW);
    assert.ok(game.jump());assert.equal(game.airLaunchSource,'cutback');assert.ok(game.vy>9);
    assert.equal(game.cutbackLaunchTime,0);assert.equal(game.doTrick('tweak'),true);
    land(game);assert.equal(game.wipeouts,0);assert.ok(game.bank());assert.equal(game.landedTricks,1);
  }
});

test('cutback setups expire, clear on a wipeout, and never emit trick points or SPECIAL events',()=>{
  const events=[],game=new SurfGame(event=>events.push(event));game.start();earnCutback(game);
  advance(game,CUTBACK_LAUNCH_WINDOW+.1,{brake:true});assert.equal(game.cutbackLaunchTime,0);
  assert.equal(events.filter(event=>event.type==='trick').length,0);assert.equal(game.comboBase,0);
  game.start();earnCutback(game);game.bail();assert.equal(game.cutbackLaunchTime,0);
  assert.equal(game.popCooldown,POP_COOLDOWN);advance(game,1);assert.equal(game.popCooldown,POP_COOLDOWN,'wipeout animation does not count as grounded recovery');
});

test('steering from the normal start to the moving wave lip earns real trick airtime',()=>{
  for(const id of ['surf','rush','storm']) {
    const game=new SurfGame(()=>{},id);game.start();
    for(let i=0;i<360&&game.launchSource!=='lip';i++)game.update(1/120,{left:true,pump:true,jump:true});
    assert.equal(game.launchSource,'lip');assert.ok(Math.abs(game.x-waveCrest(-game.distance,game.elapsed))<2.6);
    assert.ok(game.jump());assert.equal(game.airLaunchSource,'lip');assert.equal(game.doTrick('special'),true);
    land(game);assert.equal(game.wipeouts,0);assert.ok(game.bank());assert.equal(game.landedTricks,1);
    assert.ok(game.score>=2640);
  }
});

test('factory flat hops give no empty pop or landing points, while natural ramp launches still work',()=>{
  const game=new WaveParkGame();game.start();game.jump();assert.equal(game.comboBase,0);land(game);
  assert.equal(game.comboBase,0);assert.equal(game.bank(),false);
  game.start('filters');let automaticDuringRecovery=false;
  for(let i=0;i<120*14;i++) {
    const wasGrounded=!game.airborne,remaining=game.popCooldown;
    game.update(1/120,{pump:true});
    if(wasGrounded&&remaining>0&&game.airborne)automaticDuringRecovery=true;
  }
  assert.ok(game.rampHits>=3);assert.equal(automaticDuringRecovery,true,'physical wave ramps may launch even before manual pop recovers');
});
