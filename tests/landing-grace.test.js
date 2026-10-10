import test from 'node:test';
import assert from 'node:assert/strict';
import {SurfGame,TRICKS,waveHeight,LANDING_GRACE} from '../src/game.js';
import {WaveParkGame} from '../src/park.js';

const dt=1/120;
function launch(mode,events=[]) {
  const game=mode==='park'?new WaveParkGame(event=>events.push(event)):new SurfGame(event=>events.push(event),mode);
  game.start();
  if(mode!=='park'){game.x=-9;game.y=waveHeight(-9,0,0);}
  game.charge=1;assert.equal(game.jump(),true);return game;
}
function land(game){for(let i=0;i<500&&game.airborne;i++)game.update(dt,{brake:true});assert.equal(game.airborne,false);}

test('every mode saves a nearly complete trick once and banks its real points after contact',()=>{
  for(const mode of ['surf','rush','storm','park'])for(const type of ['spin','flip','grab','special','tweak']) {
    const reference=launch(mode);land(reference);assert.equal(reference.wipeouts,0);
    const events=[],game=launch(mode,events),trick=TRICKS[type];
    const grace=Math.min(LANDING_GRACE,trick.duration*.2);
    const beginAt=reference.elapsed-(trick.duration-grace*.65);
    while(game.elapsed+dt<beginAt)game.update(dt,{brake:true});
    assert.equal(game.doTrick(type),true,`${mode}/${type}`);land(game);
    assert.equal(game.wipeouts,0,`${mode}/${type}: reasonable late finish should survive`);
    assert.equal(game.trick,null);assert.equal(game.pendingTricks,1);
    assert.equal(events.filter(event=>event.type==='trick').length,1);
    assert.equal(events.filter(event=>event.type==='land'&&event.assisted).length,1);
    assert.equal(game.bank(),true);assert.equal(game.score,(trick.points+120)*2);
    for(let i=0;i<30;i++)game.update(dt,{brake:true});
    assert.equal(events.filter(event=>event.type==='trick').length,1,'assistance cannot double-award completion');
  }
});

test('every mode still rejects a trick started just before touchdown without granting points',()=>{
  for(const mode of ['surf','rush','storm','park']) {
    const reference=launch(mode);land(reference);
    const events=[],game=launch(mode,events);
    while(game.elapsed<reference.elapsed-.10)game.update(dt,{brake:true});
    assert.equal(game.doTrick('special'),true);land(game);
    assert.equal(game.wipeouts,1);assert.equal(game.comboBase,0);assert.equal(game.pendingTricks,0);
    assert.equal(events.some(event=>event.type==='trick'),false);
    assert.equal(events.some(event=>event.type==='land'),false);
  }
});

test('wider lateral tolerance accepts recoverable drift but gross sideways impacts still bail',()=>{
  for(const mode of ['surf','rush','storm'])for(const velocity of [8,17]) {
    const game=launch(mode);
    game.y=waveHeight(game.x,-game.distance,game.elapsed)+.002;
    game.vy=-4;game.airtime=.7;game.vx=velocity;
    game.addCombo('180 SPIN',300,true);
    game.update(dt,{right:true});
    assert.equal(game.airborne,false);
    assert.equal(game.wipeouts,velocity===8?0:1);
    if(velocity===8)assert.ok(game.bank());else assert.equal(game.comboBase,0);
  }
});

test('landing assistance is deterministic at 30 and 120 Hz',()=>{
  for(const mode of ['surf','rush','storm','park']) {
    const a=launch(mode),b=launch(mode),reference=launch(mode);land(reference);
    const at=Math.floor((reference.elapsed-(TRICKS.flip.duration-.08))*30)/30;
    for(let frame=0;frame<Math.round(at*30);frame++){a.update(1/30,{brake:true});for(let sub=0;sub<4;sub++)b.update(dt,{brake:true});}
    assert.ok(a.doTrick('flip'));assert.ok(b.doTrick('flip'));
    for(let frame=0;frame<60&&(a.airborne||b.airborne);frame++){a.update(1/30,{brake:true});for(let sub=0;sub<4;sub++)b.update(dt,{brake:true});}
    assert.equal(a.wipeouts,b.wipeouts);assert.equal(a.comboBase,b.comboBase);assert.equal(a.pendingTricks,b.pendingTricks);
    assert.ok(Math.abs(a.y-b.y)<1e-8);
  }
});
