import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame, TRICKS } from '../src/game.js';
import { WaveParkGame } from '../src/park.js';
import { SurfRaceGame } from '../src/surf-race.js';
import { ParkRaceGame } from '../src/park-race.js';
import { createTimeTrialGame } from '../src/time-trials.js';

const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} should equal ${expected}`);
const stats=(character={},board={})=>({active:true,
  character:{jumpPower:1,gravity:1,trickSpeed:1,landingGrace:.16,comboWindow:3.8,scoreMultiplier:1,steering:1,airControl:1,specialGain:1,...character},
  board:{baseSpeed:1,acceleration:1,boostPower:1,boostDuration:1,popRecovery:1,extraJumps:0,glideGravity:1,glideFallSpeed:0,...board}});
function advance(game,seconds,input={},hz=120) {
  for(let i=0;i<Math.round(seconds*hz);i++)game.update(1/hz,input);
}
function until(game,predicate,input={},seconds=6) {
  for(let i=0;i<seconds*120&&!predicate();i++)game.update(1/120,input);
  assert.ok(predicate(),'condition reached through ordinary simulation');
}
const factories=[
  ['surf',()=>new SurfGame()],['rush',()=>new SurfGame(()=>{},'rush')],['storm',()=>new SurfGame(()=>{},'storm')],
  ['park',()=>new WaveParkGame()],['surf race',()=>new SurfRaceGame()],['park race',()=>new ParkRaceGame()],
  ['surf trial',()=>createTimeTrialGame(()=>{},{completedTrials:0,selectedTrial:0})],
  ['park trial',()=>createTimeTrialGame(()=>{},{completedTrials:5,selectedTrial:5})],
];
function fixture(make,custom=null,board=null) {
  const game=make();game.setRewardBoard(board);if(custom)game.setAdminStats(custom);game.start();
  if(game.isRace)advance(game,3);
  return game;
}

test('disabled admin settings leave normal board buffs, movements and opponents unchanged',()=>{
  for(const [name,make] of factories) {
    const control=fixture(make,null,'afterburner'),disabled=fixture(make,{...stats({jumpPower:3},{baseSpeed:4}),active:false},'afterburner');
    advance(control,.25,{pump:true,right:true});advance(disabled,.25,{pump:true,right:true});
    for(const key of ['x','y','distance','speed','vy'])close(disabled[key],control[key]);
    assert.equal(disabled.baseSpeedMultiplier,1.25,name);
    assert.equal(disabled.rewardBoardDefinition.id,'afterburner');
    if(disabled.opponent)assert.equal(disabled.opponent.adminStats,undefined);
  }
});

test('custom values replace reward perks, survive retry and never apply to a rival',()=>{
  for(const [name,make] of factories) {
    const game=fixture(make,stats({scoreMultiplier:2},{baseSpeed:1.5,boostPower:2,boostDuration:3,popRecovery:.4,extraJumps:2}), 'afterburner');
    assert.equal(game.baseSpeedMultiplier,1.5,name);
    assert.equal(game.rewardBoardDefinition.boostPowerMultiplier,2);
    assert.equal(game.rewardBoardDefinition.trickPointsMultiplier,2);
    close(game.popRecoveryDuration,(game.isRace?1:1.4)*.4);
    game.start();assert.equal(game.baseSpeedMultiplier,1.5);assert.equal(game.rewardBoardDefinition.airJumps,2);
    if(game.opponent){assert.equal(game.opponent.baseSpeedMultiplier,1);assert.equal(game.opponent.characterStats,null);}
    game.setRewardBoard('sky');assert.equal(game.rewardBoardDefinition.glideFallSpeed,0,'overrides replace Skybound glide');
    assert.equal(game.rewardBoardDefinition.airJumps,2);assert.equal(game.rewardBoardDefinition.vfx,'wind','board appearance stays selected');
    game.setAdminStats(null);assert.equal(game.rewardBoardDefinition.airJumps,1);assert.equal(game.rewardBoardDefinition.glideFallSpeed,3.6);
  }
});

test('custom base speed and acceleration affect real wave and factory movement separately',()=>{
  for(const Game of [SurfGame,WaveParkGame]) {
    const game=fixture(()=>new Game(),stats({}, {baseSpeed:1.8,acceleration:2})),before=game.speed;
    game.update(1/120,{pump:true});
    const target=(game.mode==='surf'?26:23.5)*1.8,acceleration=(game.mode==='surf'?1.7:1.5)*2;
    close(game.speed,target+(before-target)*Math.exp(-acceleration/120));
    const slow=fixture(()=>new Game(),stats({}, {baseSpeed:1.8,acceleration:.25}));slow.update(1/120,{pump:true});
    assert.ok(game.speed>slow.speed);assert.ok(game.distance!==0||game.z!==0);
  }
});

test('jump power changes every normal launch including race pops and trial launches once',()=>{
  for(const [name,make] of factories) {
    const stock=fixture(make),custom=fixture(make,stats({jumpPower:1.75}));
    advance(stock,.2,{jump:true});advance(custom,.2,{jump:true});
    assert.ok(stock.jump(),name);assert.ok(custom.jump(),name);close(custom.vy,stock.vy*1.75);
  }
  const park=fixture(()=>new WaveParkGame(),stats({jumpPower:2}));park.launch(9,'RAMP POP',0);close(park.vy,18);
});

test('gravity changes actual airborne descent in both venues without changing jump impulse',()=>{
  for(const Game of [SurfGame,WaveParkGame]) {
    const stock=fixture(()=>new Game()),custom=fixture(()=>new Game(),stats({gravity:.4}));
    stock.jump();custom.jump();const velocity=stock.vy;close(custom.vy,velocity);
    stock.update(1/120);custom.update(1/120);
    const gravity=custom.mode==='surf'?10.5:11.2;
    close(custom.vy,velocity-gravity*.4/120);assert.ok(custom.y>stock.y);
  }
});

test('faster tricks keep their full animation rotation, score once and require landing',()=>{
  const events=[],game=fixture(()=>new WaveParkGame(event=>events.push(event)),stats({trickSpeed:2,scoreMultiplier:3}),'guitar');
  assert.ok(game.jump());assert.ok(game.doTrick('spin'));close(game.trick.duration,TRICKS.spin.duration/2);
  advance(game,.2);assert.ok(game.trick);assert.equal(game.score,0);
  advance(game,.025);assert.equal(game.trick,null);close(game.rotation,Math.PI);
  assert.equal(game.comboBase,900);assert.equal(game.bank(),false);
  until(game,()=>!game.airborne);assert.equal(game.wipeouts,0);assert.equal(game.bank(),true);
  assert.equal(game.score,(900+120)*2,'landing bonus is not a trick point modifier');
  assert.equal(events.filter(event=>event.type==='trick').length,1);
});

test('custom landing grace completes a late grab after real contact but does not double-score',()=>{
  const reference=fixture(()=>new WaveParkGame());reference.jump();until(reference,()=>!reference.airborne);
  const startAt=Math.floor((reference.elapsed-TRICKS.grab.duration+.27)*120)/120;
  for(const grace of [0,.35]) {
    const events=[],game=fixture(()=>new WaveParkGame(event=>events.push(event)),stats({landingGrace:grace}));
    assert.ok(game.jump());advance(game,startAt);assert.ok(game.doTrick('grab'));until(game,()=>!game.airborne);
    assert.equal(game.wipeouts,grace===0?1:0);
    assert.equal(events.filter(event=>event.type==='trick').length,grace===0?0:1);
    if(grace>0){assert.ok(game.bank());assert.equal(game.score,(TRICKS.grab.points+120)*2);}
  }
});

test('custom combo window controls banking while the player rides on the ground',()=>{
  for(const Game of [SurfGame,WaveParkGame]) {
    const game=fixture(()=>new Game(),stats({comboWindow:.5}));game.addCombo('TEST LINE',100,true);
    advance(game,.4,{brake:true});assert.equal(game.score,0);assert.ok(game.comboTime>0);
    advance(game,.12,{brake:true});assert.equal(game.score,200);assert.equal(game.comboBase,0);
  }
});

test('ground steering and airborne control are independent in both venues',()=>{
  for(const Game of [SurfGame,WaveParkGame]) {
    const normal=fixture(()=>new Game()),strong=fixture(()=>new Game(),stats({steering:2,airControl:.5}));
    const normalHeading=normal.heading,strongHeading=strong.heading;
    normal.update(1/120,{left:true});strong.update(1/120,{left:true});
    if(normal.mode==='surf')assert.ok(Math.abs(strong.vx)>Math.abs(normal.vx));
    else close(strong.heading-strongHeading,2*(normal.heading-normalHeading));
    const a=fixture(()=>new Game()),b=fixture(()=>new Game(),stats({steering:2,airControl:.5}));a.jump();b.jump();
    const aHeading=a.heading,bHeading=b.heading;a.update(1/120,{left:true});b.update(1/120,{left:true});
    if(a.mode==='surf')assert.ok(Math.abs(b.vx)<Math.abs(a.vx));else close(b.heading-bHeading,.5*(a.heading-aHeading));
  }
});

test('custom trick boosts come from clean landings and replace the selected board multiplier',()=>{
  for(const Game of [SurfRaceGame,ParkRaceGame]) {
    const game=fixture(()=>new Game(),stats({}, {boostPower:2,boostDuration:1.5}),'afterburner');
    assert.ok(game.jump());assert.ok(game.doTrick('spin'));until(game,()=>!game.trick);
    assert.equal(game.boostTime,0);until(game,()=>!game.airborne);
    assert.equal(game.wipeouts,0);close(game.boostSpeed,12);close(game.boostDuration,3);
    assert.equal(game.opponent.boostSpeed,0);
  }
});

test('custom extra jumps and glide work with a stock deck and cannot be refilled mid-flight',()=>{
  for(const Game of [SurfGame,WaveParkGame]) {
    const custom=stats({jumpPower:1.2},{extraJumps:2,glideGravity:.3,glideFallSpeed:2.8});
    const game=fixture(()=>new Game(),custom);assert.ok(game.jump());advance(game,.15);
    assert.ok(game.jump());assert.equal(game.airJumpsUsed,1);assert.ok(game.jump());assert.equal(game.airJumpsUsed,2);
    assert.equal(game.jump(),false);game.setAdminStats(custom);assert.equal(game.jump(),false);
    until(game,()=>game.gliding);advance(game,.2);assert.ok(game.vy>=-2.8);assert.ok(game.gliding);
    game.bail();assert.equal(game.gliding,false);game.start();assert.equal(game.rewardBoardDefinition.airJumps,2);
  }
});

test('zero points, bonus boost and pop cooldown are intentional valid values',()=>{
  const game=fixture(()=>new SurfRaceGame(),stats({scoreMultiplier:0},{boostPower:0,popRecovery:0}),'afterburner');
  assert.equal(game.popRecoveryDuration,0);game.addCombo('180 SPIN',300,true);assert.equal(game.comboBase,0);
  game.awardRaceBoost({tricks:3});assert.equal(game.boostSpeed,0);
});

test('editing the supplied settings object cannot silently change an existing rider',()=>{
  const custom=stats({jumpPower:1.8},{baseSpeed:1.3}),game=fixture(()=>new SurfGame(),custom);
  custom.character.jumpPower=50;custom.board.baseSpeed=50;assert.equal(game.baseSpeedMultiplier,1.3);assert.equal(game.jumpPowerMultiplier,1.8);
  game.setAdminStats({active:true,character:{jumpPower:Infinity},board:{baseSpeed:NaN,acceleration:0}});
  game.update(1/120,{pump:true});assert.ok(Number.isFinite(game.speed));assert.ok(Number.isFinite(game.distance));
});
