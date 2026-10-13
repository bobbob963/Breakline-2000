import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ALL_REWARD_BOARD_ORDER, REWARD_BOARD_ORDER, TRIAL_REWARD_BOARD_ORDER, getRewardBoard, rewardBoardUnlocked } from '../src/board-rewards.js';
import { createSurfer, disposeSurfer, validateProfile } from '../src/appearance.js';
import { createBoardEffects, BOARD_EFFECT_POOL_SIZE } from '../src/board-effects.js';

function withCanvas(run) {
  const saved=globalThis.document;
  const context=new Proxy({}, {get:(_,key)=>['createLinearGradient','createRadialGradient'].includes(key)?()=>({addColorStop(){}}):()=>{},set:()=>true});
  globalThis.document={createElement:()=>({getContext:()=>context})};
  try{return run();}finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
}

test('Afterburner is an additional three-trial prize, preserving the five-ladder order and old equipment',()=>{
  assert.deepEqual(REWARD_BOARD_ORDER,['guitar','lightning','vortex','solar','sky']);
  assert.deepEqual(TRIAL_REWARD_BOARD_ORDER,['afterburner']);
  assert.deepEqual(ALL_REWARD_BOARD_ORDER,[...REWARD_BOARD_ORDER,'afterburner','deadtime']);
  const reward=getRewardBoard('afterburner');
  assert.equal(reward.ladderIndex,null);assert.equal(reward.trialClears,3);
  assert.equal(reward.baseSpeedMultiplier,1.25);assert.equal(reward.boostPowerMultiplier,1.5);
  for(let clears=0;clears<=12;clears++)assert.equal(rewardBoardUnlocked('afterburner',{completedLadders:5},{completedTrials:clears}),clears>=3);
  for(const completedTrials of [-1,13,Infinity,NaN,'3',3.5,undefined])assert.equal(rewardBoardUnlocked('afterburner',{completedLadders:5},{completedTrials}),false);
  for(const completedLadders of [0,4,6,Infinity,NaN,'5',4.5,undefined])assert.equal(rewardBoardUnlocked('afterburner',{completedLadders},{completedTrials:3}),false);
  assert.equal(rewardBoardUnlocked('afterburner',{completedLadders:5}),false);
  for(const id of REWARD_BOARD_ORDER){assert.equal(getRewardBoard(id).baseSpeedMultiplier,1);assert.equal(rewardBoardUnlocked(id,{completedLadders:5}),true);}
});

test('Afterburner equips its own deck while preserving the rider and actual board grab targets',()=>withCanvas(()=>{
  const profile=validateProfile({character:'jax',outfit:'suncrew',boardDesign:'flames',boardColor:'#24c5ba',rewardBoard:'afterburner'});
  assert.equal(profile.rewardBoard,'afterburner');assert.equal(profile.outfit,'suncrew');assert.equal(profile.boardDesign,'flames');
  const surfer=createSurfer(profile);
  assert.equal(surfer.board.material.map.name,'reward-deck-afterburner');
  assert.equal(surfer.board.userData.rewardBoard,'afterburner');
  assert.ok(surfer.board.userData.grabRailLocal.length()>0);
  assert.ok(surfer.board.geometry.attributes.position.count>20);
  disposeSurfer(surfer);
}));

test('Afterburner uses compact pooled exhaust after a completed trick without wings or graffiti',()=>withCanvas(()=>{
  const effects=createBoardEffects(),surfer={rig:new THREE.Group()},camera=new THREE.PerspectiveCamera();
  effects.setProfile({rewardBoard:'afterburner'});
  for(const event of [{type:'jump'},{type:'trickStart'},{type:'airJump'},{type:'trick',opponent:true}])assert.equal(effects.trigger(event),false);
  const count=effects.group.getObjectsByProperty('isObject3D',true).length;
  assert.equal(effects.trigger({type:'trick'}),true);effects.update(.05,surfer,camera,{gliding:true});
  const burst=effects.group.children.find(o=>o.visible),sculpted=burst.getObjectByName('sculpted-reward-burst');
  assert.equal(burst.userData.effect,'exhaust');assert.equal(sculpted.visible,true);
  assert.equal(burst.getObjectByName('local-impact-frame').visible,false);
  assert.equal(burst.getObjectByName('lightning-graffiti').visible,false);
  assert.equal(effects.group.getObjectByName('skybound-angel-wings').visible,false);
  assert.equal(sculpted.children.filter(o=>o.visible&&o.name.startsWith('solar-flame')).length,6);
  for(const mesh of sculpted.children.filter(o=>o.visible)){assert.ok(mesh.position.length()<1.5);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,false);}
  const pose=sculpted.children.map(o=>[...o.position.toArray(),...o.rotation.toArray(),...o.scale.toArray()]);
  effects.update(.1,surfer,camera,{paused:true});assert.deepEqual(sculpted.children.map(o=>[...o.position.toArray(),...o.rotation.toArray(),...o.scale.toArray()]),pose);
  for(let i=0;i<200;i++)effects.trigger({type:'trick'});
  assert.equal(effects.activeCount,BOARD_EFFECT_POOL_SIZE);assert.equal(effects.group.getObjectsByProperty('isObject3D',true).length,count);
  for(let i=0;i<20;i++)effects.update(.05,surfer,camera);assert.equal(effects.activeCount,0);
  effects.setProfile({rewardBoard:'afterburner'});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);effects.setProfile({rewardBoard:'solar'});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);
  const solar=effects.group.children.find(o=>o.visible).getObjectByName('sculpted-reward-burst');assert.equal(solar.position.y,0,'equipment change restores solar positioning');
  effects.dispose();
}));

test('reduced-motion Afterburner keeps a static, sparse exhaust pose',()=>withCanvas(()=>{
  const effects=createBoardEffects({reducedMotion:true}),surfer={rig:new THREE.Group()},camera=new THREE.PerspectiveCamera();
  effects.setProfile({rewardBoard:'afterburner'});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);
  const sculpted=effects.group.children.find(o=>o.visible).getObjectByName('sculpted-reward-burst');
  assert.equal(sculpted.children.filter(o=>o.visible).length,6);
  const pose=sculpted.children.map(o=>[...o.position.toArray(),...o.rotation.toArray(),...o.scale.toArray()]);
  effects.update(.1,surfer,camera);assert.deepEqual(sculpted.children.map(o=>[...o.position.toArray(),...o.rotation.toArray(),...o.scale.toArray()]),pose);
  effects.dispose();
}));
