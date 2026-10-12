import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBoardEffects,BOARD_EFFECT_POOL_SIZE,BOARD_EFFECT_LIFETIME } from '../src/board-effects.js';
import { REWARD_BOARD_ORDER,REWARD_BOARDS } from '../src/board-rewards.js';
import { validateProfile,createSurfer,disposeSurfer,rewardBoardTexture } from '../src/appearance.js';
import { SurfRaceGame } from '../src/surf-race.js';
import { rewardDemoInput } from '../src/reward-lab.js';

const context=new Proxy({}, {get:(_,key)=>['createLinearGradient','createRadialGradient'].includes(key)?()=>({addColorStop(){}}):()=>{},set:()=>true});
function withCanvas(run){const saved=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>context})};try{return run();}finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}}
const surfer={rig:new THREE.Group()},camera=new THREE.PerspectiveCamera();

test('reward selection preserves standard customization and rejects unknown reward IDs',()=>{
  for(const rewardBoard of REWARD_BOARD_ORDER){const profile=validateProfile({character:'jax',outfit:'suncrew',boardColor:'#24c5ba',boardDesign:'flames',rewardBoard});assert.equal(profile.rewardBoard,rewardBoard);assert.equal(profile.boardColor,'#24c5ba');assert.equal(profile.boardDesign,'flames');}
  assert.equal(validateProfile({rewardBoard:'__proto__'}).rewardBoard,null);
  assert.equal(validateProfile(null).rewardBoard,null);
});

test('every reward uses original named deck art while retaining physical grab targets',()=>withCanvas(()=>{
  for(const rewardBoard of REWARD_BOARD_ORDER){const s=createSurfer({rewardBoard});assert.equal(s.board.material.map.name,'reward-deck-'+rewardBoard);assert.equal(s.board.userData.rewardBoard,rewardBoard);assert.ok(s.board.userData.grabRailLocal.length()>0);assert.ok(s.board.geometry.attributes.position.count>20);disposeSurfer(s);}
  assert.equal(rewardBoardTexture('invalid'),null);
}));

test('reward burst comes only from actual completed tricks, never trick starts or rival events',()=>withCanvas(()=>{
  const effects=createBoardEffects();effects.setProfile({rewardBoard:'guitar'});
  for(const event of [{type:'trickStart'},{type:'jump'},{type:'raceBoost'},{type:'trick',opponent:true}])assert.equal(effects.trigger(event),false);
  const events=[],demo={stage:'charge',charge:0,started:false};let game;
  game=new SurfRaceGame(event=>{events.push(event);if(!event.opponent)effects.trigger(event);});game.setRewardBoard('guitar');game.start();
  for(let i=0;i<900&&!events.some(e=>e.type==='trick'&&!e.opponent);i++)game.update(1/120,rewardDemoInput(game,demo,1/120));
  assert.ok(events.some(e=>e.type==='trickStart'&&!e.opponent));assert.ok(events.some(e=>e.type==='trick'&&!e.opponent));assert.equal(effects.activeCount,1);assert.equal(game.launchTricks,1);effects.dispose();
}));

test('all five motifs stay local, freeze when paused and expire without resource growth',()=>withCanvas(()=>{
  const effects=createBoardEffects();surfer.rig.position.set(100,7,-240);
  const objectCount=effects.group.getObjectsByProperty('isObject3D',true).length;
  for(const id of REWARD_BOARD_ORDER){effects.setProfile({rewardBoard:id});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);const burst=effects.group.children.find(x=>x.visible);assert.equal(burst.userData.effect,REWARD_BOARDS[id].vfx);assert.deepEqual(burst.position.toArray(),[100,7.75,-240]);const position=burst.children[0].position.toArray();effects.update(.1,surfer,camera,{paused:true});assert.deepEqual(burst.children[0].position.toArray(),position);for(let t=0;t<BOARD_EFFECT_LIFETIME+.1;t+=.05)effects.update(.05,surfer,camera);assert.equal(effects.activeCount,0);}
  for(let i=0;i<200;i++)effects.trigger({type:'trick'});
  assert.equal(effects.activeCount,BOARD_EFFECT_POOL_SIZE);assert.equal(effects.group.getObjectsByProperty('isObject3D',true).length,objectCount);
  effects.update(.01,surfer,camera,{finished:true});assert.equal(effects.activeCount,0);effects.dispose();
}));

test('reduced motion omits impact flash and uses four static accents',()=>withCanvas(()=>{
  const effects=createBoardEffects({reducedMotion:true});effects.setProfile({rewardBoard:'lightning'});effects.trigger({type:'trick'});effects.update(.01,surfer,camera);
  const burst=effects.group.children.find(x=>x.visible),sprites=burst.children.filter(o=>o.isSprite&&o.visible);
  assert.equal(sprites.length,4);assert.equal(burst.getObjectByName('local-impact-frame').visible,false);assert.equal(burst.children.filter(o=>o.isMesh&&o.visible).length,0);
  const positions=sprites.map(o=>o.position.toArray());effects.update(.1,surfer,camera);assert.deepEqual(sprites.map(o=>o.position.toArray()),positions);effects.dispose();
}));

test('equip clears previous effects and SKY second jump has its own small wind burst',()=>withCanvas(()=>{
  const effects=createBoardEffects();effects.setProfile({rewardBoard:'guitar'});assert.equal(effects.trigger({type:'airJump'}),false);effects.trigger({type:'trick'});effects.setProfile({rewardBoard:'sky'});assert.equal(effects.activeCount,0);assert.equal(effects.trigger({type:'airJump'}),true);effects.setProfile({rewardBoard:null});assert.equal(effects.activeCount,0);assert.equal(effects.trigger({type:'trick'}),false);effects.dispose();assert.equal(effects.trigger({type:'trick'}),false);
}));

test('pooled effect materials textures and geometry release once on disposal',()=>withCanvas(()=>{
  const effects=createBoardEffects(),resources=new Set();
  for(const id of REWARD_BOARD_ORDER){effects.setProfile({rewardBoard:id});effects.trigger({type:'trick'});effects.group.traverse(o=>{if(o.isMesh)resources.add(o.geometry);if(o.material){resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});}
  let disposed=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);effects.dispose();effects.dispose();assert.equal(disposed,resources.size);assert.equal(effects.group.children.length,0);
}));
