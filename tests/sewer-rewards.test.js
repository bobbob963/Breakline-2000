import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SEWER_RACES,freshSewerProgress,sanitizeSewerProgress,recordSewerResult,resetSewerLadder,unlockAllSewerRewards,sewerOutfitUnlocked,sewerBoardUnlocked,sewerLadderComplete } from '../src/sewer-progress.js';
import { SewerPower } from '../src/sewer-power.js';
import { SurfGame,courseItem,waveHeight } from '../src/game.js';
import { WaveParkGame } from '../src/park.js';
import { SurfRaceGame } from '../src/surf-race.js';
import { ParkRaceGame } from '../src/park-race.js';
import { SewerRaceGame } from '../src/sewer-race.js';
import { rewardBoardUnlocked } from '../src/board-rewards.js';
import { OUTFITS,validateProfile,rewardBoardTexture,createSurfer,disposeSurfer } from '../src/appearance.js';
import { createBoardEffects } from '../src/board-effects.js';
import { surfHazardsNear } from '../src/surf-hazards.js';
import { stormBarrel,barrelCrossSection } from '../src/storm-waves.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} = ${b}`);
const win=(progress,index,time=50)=>recordSewerResult(progress,SEWER_RACES[index].id,{result:'win',elapsed:time});
const context=new Proxy({}, {get:(_,key)=>['createLinearGradient','createRadialGradient'].includes(key)?()=>({addColorStop(){}}):()=>{},set:()=>true});
function withCanvas(run){const saved=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>context})};try{return run();}finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}}

test('the two sewer routes form five ordered races with independent permanent outfit and board rewards',()=>{
  assert.deepEqual([...new Set(SEWER_RACES.map(race=>race.trackId))],['sewer-run','sewer-depths']);
  let progress=freshSewerProgress();
  for(let i=0;i<5;i++){
    assert.equal(sewerOutfitUnlocked('draincrew',progress),i>=2);
    assert.equal(sewerOutfitUnlocked('nightshift',progress),i>=4);
    assert.equal(sewerBoardUnlocked('sludge',progress),false);
    progress=win(progress,i,65-i);
    assert.equal(progress.completedRaces,i+1);assert.equal(progress.earnedWins,i+1);
  }
  assert.equal(sewerLadderComplete(progress),true);assert.equal(sewerBoardUnlocked('sludge',progress),true);
  assert.equal(rewardBoardUnlocked('sludge',null,null,null,progress),true);
  assert.equal(rewardBoardUnlocked('sludge',{completedLadders:5},{completedTrials:12},{deadtimeUnlocked:true}),false);
  assert.equal(rewardBoardUnlocked('afterburner',{completedLadders:0},{completedTrials:12},null,progress),false,'sewer clears cannot qualify for original Time Trials rewards');
});

test('losses duplicate results and out-of-order races cannot skip the sewer ladder',()=>{
  const empty=freshSewerProgress();
  for(const result of [{result:'loss',elapsed:50},{result:'win',elapsed:NaN},{result:'win',elapsed:0},{result:'win',elapsed:-1}])assert.deepEqual(recordSewerResult(empty,SEWER_RACES[0].id,result),empty);
  assert.deepEqual(win(empty,4),empty);
  const first=win(empty,0);assert.deepEqual(win(first,0),first);
  assert.equal(sewerOutfitUnlocked('__proto__',first),false);assert.equal(sewerBoardUnlocked('deadtime',unlockAllSewerRewards()),false);
});

test('replay reset retains prizes and best times while full reset removes them',()=>{
  let progress=freshSewerProgress();for(let i=0;i<5;i++)progress=win(progress,i);
  const replay=resetSewerLadder(progress);assert.equal(replay.completedRaces,0);assert.equal(replay.earnedWins,5);
  assert.equal(sewerBoardUnlocked('sludge',replay),true);assert.equal(sewerOutfitUnlocked('nightshift',replay),true);
  assert.equal(win(replay,0,55).bestTimes[0],50);assert.equal(win(replay,0,40).bestTimes[0],40);
  assert.deepEqual(unlockAllSewerRewards(replay).bestTimes,progress.bestTimes);
  assert.equal(sewerBoardUnlocked('sludge',freshSewerProgress()),false);
  assert.equal(sewerOutfitUnlocked('draincrew',freshSewerProgress()),false);
});

test('sewer saves reject invalid counts and inherited properties, and normalize best-time records',()=>{
  for(const value of [null,[],{},Object.create({version:1,completedRaces:5,earnedWins:5}),{version:1,completedRaces:4,earnedWins:3},...[-1,6,NaN,Infinity,'5'].map(earnedWins=>({version:1,completedRaces:0,earnedWins}))])assert.deepEqual(sanitizeSewerProgress(value),freshSewerProgress());
  assert.deepEqual(sanitizeSewerProgress({version:1,completedRaces:2,earnedWins:2,bestTimes:[40,-1,30,Infinity,null]}).bestTimes,[40,null,null,null,null]);
  assert.deepEqual(sanitizeSewerProgress(JSON.parse(JSON.stringify(unlockAllSewerRewards()))),unlockAllSewerRewards());
});

test('surge lasts exactly five active seconds, never stacks, and charges for fifteen more',()=>{
  const events=[],power=new SewerPower(event=>events.push(event)),state={playing:true,equipped:true};
  assert.equal(power.activate(false),false);assert.equal(power.activate(true),true);
  for(let i=0;i<12;i++)assert.equal(power.activate(true),false);
  power.update(4.75,state);near(power.remaining,.25);assert.equal(power.cooldown,0);
  power.update(.25,state);assert.equal(power.active,false);near(power.cooldown,15);
  assert.equal(power.activate(true),false);power.update(14.9,state);assert.equal(power.activate(true),false);
  power.update(.1,state);assert.equal(power.cooldown,0);assert.equal(power.activate(true),true);
  assert.equal(events.filter(event=>event.type==='sewerPowerReady').length,1);
});

test('surge cooldown crosses frames consistently and pauses freeze all timers',()=>{
  for(const frames of [[8],[5,3],Array(480).fill(1/60)]){
    const power=new SewerPower(),state={playing:true,equipped:true};power.activate(true);frames.forEach(dt=>power.update(dt,state));near(power.cooldown,12);assert.equal(power.active,false);
  }
  const power=new SewerPower();power.activate(true);power.update(2,{playing:true,equipped:true});
  power.update(100,{playing:false,equipped:true});assert.equal(power.remaining,3);
  for(const dt of [-1,NaN,Infinity,0])power.update(dt,{playing:true,equipped:true});assert.equal(power.remaining,3);
  power.update(3,{playing:true,equipped:true});power.update(100,{playing:false,equipped:true});assert.equal(power.cooldown,15);
});

test('all existing modes receive 35 percent base speed with surge, while brakes and rival equipment stay ordinary',()=>{
  for(const create of [()=>new SurfGame(),()=>new SurfGame(()=>{},'storm'),()=>new SurfGame(()=>{},'rush'),()=>new WaveParkGame(),()=>new SurfRaceGame(),()=>new ParkRaceGame(),()=>new SewerRaceGame(),()=>new SewerRaceGame(()=>{},{trackId:'sewer-depths'})]){
    const normal=create(),boosted=create();for(const game of [normal,boosted]){game.setRewardBoard('sludge');game.start();game.countdownRemaining=0;game.speed=0;}
    assert.equal(boosted.activateSewerPower(),true);assert.equal(boosted.hazardShieldActive,true);
    normal.update(1/120,{pump:true});boosted.update(1/120,{pump:true});near(boosted.speed,normal.speed*1.35);
    if(boosted.opponent)assert.equal(boosted.opponent.sewerPowerEnabled,false);
    normal.speed=boosted.speed=0;normal.update(1/120,{brake:true});boosted.update(1/120,{brake:true});near(boosted.speed,normal.speed);
  }
});

test('surge cannot start before a race, through pause or while bailing, and unequip cannot refill it',()=>{
  const game=new SurfRaceGame();game.setRewardBoard('sludge');game.start();assert.equal(game.activateSewerPower(),false);
  game.countdownRemaining=0;assert.equal(game.activateSewerPower(),true);game.updateTimePower(2);
  game.pause();game.updateTimePower(100);assert.equal(game.sewerPowerRemaining,3);assert.equal(game.activateSewerPower(),false);
  game.resume();game.setRewardBoard('deadtime');assert.equal(game.hazardShieldActive,false);assert.equal(game.sewerPowerCooldown,15);
  game.setRewardBoard('sludge');assert.equal(game.activateSewerPower(),false);
  game.updateTimePower(15);assert.equal(game.activateSewerPower(),true);
  game.bail('BAD LANDING');assert.equal(game.sewerPowerActive,false);assert.equal(game.activateSewerPower(),false);
  game.start();assert.equal(game.sewerPowerCooldown,0);assert.equal(game.sewerPowerRemaining,0);
});

test('surge shields a real swept reef crossing but does not excuse a bad landing',()=>{
  const results=[];
  for(const powered of [false,true]){
    const game=new SurfGame(),reef=courseItem(0);game.setRewardBoard('sludge');game.start();
    if(powered)game.activateSewerPower();
    Object.assign(game,{x:reef.hazardX,distance:reef.hazardDistance-.2,speed:26,y:waveHeight(reef.hazardX,-reef.hazardDistance,0)});
    game.update(1/60,{pump:true});results.push(game.wipeouts);
    if(powered){game.bail('UNFINISHED TRICK');assert.equal(game.wipeouts,1);assert.equal(game.hazardShieldActive,false);}
  }
  assert.deepEqual(results,[1,0]);
});

test('surge passes Survival driftwood, whirlpool cores and the physical wave lip without awarding trick points',()=>{
  for(const type of ['driftwood','whirlpool','barrel'])for(const powered of [false,true]){
    const game=new SurfGame(()=>{},'storm');game.setRewardBoard('sludge');game.start();if(powered)game.activateSewerPower();
    if(type==='barrel'){
      const barrel=stormBarrel(0),section=barrelCrossSection(barrel,-barrel.centerDistance,10);
      Object.assign(game,{elapsed:10,distance:barrel.centerDistance,x:section.centerX,y:section.centerY+section.innerRadius-1.9,airborne:true,airtime:.4,vy:12,vx:0});
      game.barrelTimings.set(0,{index:0,deadline:20,closeDuration:1.2});
    }else{
      const item=surfHazardsNear(type==='whirlpool'?300:0,'storm').find(item=>item.type===type);
      Object.assign(game,{distance:item.distance-.2,x:item.x,vx:0,speed:26,y:waveHeight(item.x,-item.distance,0)});
    }
    game.update(.05,{pump:true});assert.equal(game.wipeouts,powered?0:1,type);
    assert.equal(game.pendingTricks,0);assert.equal(game.comboBase,0);assert.equal(game.landedTricks,0);
  }
});

test('finish cancels the shield immediately and cannot spend a charge or manufacture a boost afterwards',()=>{
  for(const create of [emit=>new SurfGame(emit),emit=>new SewerRaceGame(emit)]){
  const events=[],game=create(event=>events.push(event));game.setRewardBoard('sludge');game.start();game.countdownRemaining=0;game.activateSewerPower();game.updateTimePower(2);
  game.finish('SESSION COMPLETE');assert.equal(game.sewerPowerActive,false);assert.equal(game.sewerPowerRemaining,0);assert.equal(game.activateSewerPower(),false);
  game.updateTimePower(100);assert.equal(game.sewerPowerCooldown,15);assert.equal(game.baseSpeedMultiplier,1);
  assert.ok(events.some(event=>event.type==='sewerPower'&&!event.active&&event.reason==='finish'));assert.equal(events.some(event=>event.type==='timePowerBurst'),false);
  }
});

test('sewer clothes and deck use their own low-poly art with the existing physical board geometry',()=>withCanvas(()=>{
  for(const id of ['draincrew','nightshift']){
    assert.equal(validateProfile({outfit:id}).outfit,id);assert.ok([2,4].includes(OUTFITS[id].sewerWins));
    const surfer=createSurfer({outfit:id,rewardBoard:'sludge'});assert.equal(surfer.board.material.map.name,'reward-deck-sludge');assert.ok(surfer.board.userData.grabRailLocal.length()>0);disposeSurfer(surfer);
  }
  const texture=rewardBoardTexture('sludge');assert.equal(texture.image.width,64);assert.equal(texture.image.height,256);texture.dispose();
}));

test('sludge splashes follow the board and its shield freezes, cancels, and disposes without new per-frame objects',()=>withCanvas(()=>{
  const effects=createBoardEffects(),surfer=createSurfer({rewardBoard:'sludge'}),camera=new THREE.PerspectiveCamera();
  effects.setProfile({rewardBoard:'sludge'});surfer.rig.position.set(10,2,-20);
  const objectCount=effects.group.getObjectsByProperty('isObject3D',true).length;
  assert.equal(effects.trigger({type:'trickStart'}),false);assert.equal(effects.trigger({type:'trick',opponent:true}),false);
  assert.equal(effects.trigger({type:'trick'}),true);assert.equal(effects.trigger({type:'sewerPower',active:true,duration:5}),true);
  effects.update(.05,surfer,camera);const shield=effects.group.getObjectByName('sludge-surge-shield');assert.equal(shield.visible,true);assert.deepEqual(shield.position.toArray(),[10,2.95,-20]);
  const rotation=shield.children[0].rotation.y;effects.update(.1,surfer,camera,{paused:true});assert.equal(shield.children[0].rotation.y,rotation);
  for(let i=0;i<20;i++){effects.trigger({type:'trick'});effects.update(.05,surfer,camera);}assert.equal(effects.group.getObjectsByProperty('isObject3D',true).length,objectCount);
  effects.trigger({type:'sewerPower',active:false,reason:'bail'});assert.equal(shield.visible,false);
  effects.trigger({type:'sewerPower',active:true,duration:5});effects.setProfile({rewardBoard:'guitar'});assert.equal(shield.visible,false);
  effects.dispose();effects.dispose();disposeSurfer(surfer);
}));
