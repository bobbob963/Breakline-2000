import test from 'node:test';
import assert from 'node:assert/strict';
import {SURFER_SPECIALS,getSurferSpecial} from '../src/surfer-specials.js';
import {SurfGame,TRICKS,waveHeight} from '../src/game.js';
import {WaveParkGame} from '../src/park.js';
import {SurfRaceGame} from '../src/surf-race.js';
import {ParkRaceGame} from '../src/park-race.js';

const dt=1/120;
const characters=Object.keys(SURFER_SPECIALS);
const advance=(game,seconds)=>{for(let i=0;i<Math.ceil(seconds/dt);i++)game.update(dt,{brake:true});};
function launch(Game,characterId,events=[]){
  const game=new Game(event=>events.push(event));game.setCharacter(characterId);game.start();
  if(game.mode==='surf'){game.x=-9;game.y=waveHeight(-9,0,0);}
  game.charge=1;assert.ok(game.jump());return game;
}
function land(game){
  for(let i=0;i<600&&game.airborne;i++)game.update(dt,{brake:true});
  assert.equal(game.airborne,false);assert.equal(game.wipeouts,0);
}

test('all four signatures have distinct motion, fixed scoring and immutable definitions',()=>{
  assert.deepEqual(characters,['kai','nova','reef','jax']);
  assert.ok(Object.isFrozen(SURFER_SPECIALS));
  assert.equal(new Set(Object.values(SURFER_SPECIALS).map(s=>s.specialId)).size,4);
  const motions=new Set();
  for(const characterId of characters){
    const special=getSurferSpecial(characterId);
    assert.ok(Object.isFrozen(special));assert.equal(special.characterId,characterId);
    assert.equal(special.points,1200);assert.equal(special.duration,.82);
    assert.ok(special.description.length>20);
    motions.add(JSON.stringify([special.spin,special.flip,special.boardSpin,special.grab,special.tweak]));
  }
  assert.equal(motions.size,4);
  for(const bad of [null,undefined,{},'unknown','__proto__','toString'])assert.equal(getSurferSpecial(bad),SURFER_SPECIALS.kai);
  assert.equal(TRICKS.special,SURFER_SPECIALS.kai);
});

test('every surfer completes their own special and lands equal points on wave and Waterworks',()=>{
  for(const Game of [SurfGame,WaveParkGame])for(const characterId of characters){
    const events=[],game=launch(Game,characterId,events),special=getSurferSpecial(characterId);
    assert.ok(game.doTrick('special'));
    assert.equal(game.trick.specialId,special.specialId);assert.equal(game.trick.duration,.82);
    const start=events.find(event=>event.type==='trickStart');
    assert.deepEqual(start,{type:'trickStart',trick:'special',specialId:special.specialId,characterId,name:special.name});
    advance(game,.85);assert.equal(game.trick,null);assert.equal(game.pendingTricks,1);
    assert.equal(game.score,0);assert.equal(game.bank(),false,'airborne points still need a landing');
    assert.ok(game.comboNames.includes(special.name));
    assert.equal(events.filter(e=>e.type==='trick'&&e.specialId===special.specialId).length,1);
    const completed=events.find(e=>e.type==='trick');assert.equal(completed.characterId,characterId);assert.equal(completed.name,special.name);
    land(game);assert.ok(game.bank());assert.equal(game.score,2640);assert.equal(game.landedTricks,1);
  }
});

test('switching characters snapshots the running move and changes only the next special',()=>{
  for(const Game of [SurfGame,WaveParkGame]){
    const events=[],game=launch(Game,'nova',events);assert.ok(game.doTrick('special'));
    const first={...game.trick};game.setCharacter('jax');
    assert.deepEqual(game.trick,first);assert.equal(game.characterSpecial,SURFER_SPECIALS.jax);
    game.updateAirTrick(first.duration);assert.ok(game.comboNames.includes('ORBITAL 720'));
    assert.equal(events.find(e=>e.type==='trick').characterId,'nova');
    assert.ok(game.doTrick('special'));assert.equal(game.trick.specialId,'dockside-flip');
    game.reset();assert.equal(game.characterId,'jax');assert.equal(game.trick,null);
    game.start();assert.equal(game.characterId,'jax');assert.equal(game.characterSpecial,SURFER_SPECIALS.jax);
    assert.equal(game.setCharacter('constructor'),'kai');assert.equal(game.characterSpecial,SURFER_SPECIALS.kai);
  }
});

test('signature identity survives resets and is inherited by both racing modes',()=>{
  for(const Game of [SurfRaceGame,ParkRaceGame])for(const id of characters){
    const game=new Game();game.setCharacter(id);game.start();
    advance(game,3.1);game.airborne=true;game.airLaunchSource='race-pop';
    assert.ok(game.doTrick('special'));assert.equal(game.trick.specialId,getSurferSpecial(id).specialId);
    assert.equal(game.opponent.characterId,'kai','a player profile does not rewrite opponent identity');
    game.start();assert.equal(game.characterId,id);assert.equal(game.trick,null);
  }
});

test('character selection leaves normal tricks, scores and event contracts unchanged',()=>{
  for(const id of characters)for(const [type,trick] of Object.entries(TRICKS)){
    if(type==='special')continue;
    const events=[],game=launch(SurfGame,id,events);assert.ok(game.doTrick(type));
    assert.deepEqual(game.trick,{type,age:0,...trick});
    assert.deepEqual(events.find(e=>e.type==='trickStart'),{type:'trickStart',trick:type});
    game.updateAirTrick(trick.duration);assert.equal(game.comboBase,trick.points);
    assert.deepEqual(events.find(e=>e.type==='trick'),{type:'trick',name:trick.name,rewardBoard:null,vfx:null});
  }
});

test('specials use the same landing grace and fail when started just before touchdown',()=>{
  for(const Game of [SurfGame,WaveParkGame])for(const id of characters){
    const events=[],game=launch(Game,id,events);assert.ok(game.doTrick('special'));
    game.trick.age=.75;game.airborne=false;
    assert.deepEqual(game.resolveLandingTrick(),{landed:true,assisted:true});
    assert.deepEqual(game.resolveLandingTrick(),{landed:true,assisted:false});
    assert.equal(game.pendingTricks,1);assert.equal(events.filter(e=>e.type==='trick').length,1);
    assert.ok(game.bank());assert.equal(game.score,2400);
    const late=launch(Game,id);late.doTrick('special');late.trick.age=.2;late.airborne=false;
    assert.deepEqual(late.resolveLandingTrick(),{landed:false,assisted:false});
    assert.equal(late.wipeouts,1);assert.equal(late.score,0);assert.equal(late.comboBase,0);
  }
});

test('admin trick speed scales a snapshot without mutating any surfer definition',()=>{
  for(const Game of [SurfGame,WaveParkGame])for(const id of characters){
    const game=launch(Game,id);game.setAdminStats({active:true,character:{trickSpeed:2}});
    assert.ok(game.doTrick('special'));assert.equal(game.trick.duration,.41);
    assert.equal(getSurferSpecial(id).duration,.82);
    game.updateAirTrick(.405);assert.ok(game.trick);game.updateAirTrick(.0051);
    assert.equal(game.trick,null);assert.equal(game.comboBase,1200);
  }
});

test('signature tricks retain launch, phase, active-trick and wipeout restrictions',()=>{
  for(const id of characters){
    const game=new SurfGame();game.setCharacter(id);assert.equal(game.doTrick('special'),false);
    game.start();assert.equal(game.doTrick('special'),false);
    game.airborne=true;assert.equal(game.doTrick('special'),false,'flat hops cannot earn a special');
    game.airLaunchSource='lip';game.pause();assert.equal(game.doTrick('special'),false);game.resume();
    assert.ok(game.doTrick('special'));assert.equal(game.doTrick('special'),false);
    game.bail();assert.equal(game.doTrick('special'),false);
  }
});
