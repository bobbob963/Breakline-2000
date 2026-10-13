import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBoardEffects,BOARD_EFFECT_POOL_SIZE,BOARD_EFFECT_LIFETIME,GRAFFITI_EFFECT_LIFETIME } from '../src/board-effects.js';
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
  for(const id of REWARD_BOARD_ORDER){effects.setProfile({rewardBoard:id});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);const burst=effects.group.children.find(x=>x.visible);assert.equal(burst.userData.effect,REWARD_BOARDS[id].vfx);assert.deepEqual(burst.position.toArray(),[100,7.75,-240]);const position=burst.children[0].position.toArray();effects.update(.1,surfer,camera,{paused:true});assert.deepEqual(burst.children[0].position.toArray(),position);for(let t=0;t<(id==='lightning'?GRAFFITI_EFFECT_LIFETIME:BOARD_EFFECT_LIFETIME)+.1;t+=.05)effects.update(.05,surfer,camera);assert.equal(effects.activeCount,0);}
  for(let i=0;i<200;i++)effects.trigger({type:'trick'});
  assert.equal(effects.activeCount,BOARD_EFFECT_POOL_SIZE);assert.equal(effects.group.getObjectsByProperty('isObject3D',true).length,objectCount);
  effects.update(.01,surfer,camera,{finished:true});assert.equal(effects.activeCount,0);effects.dispose();
}));

test('reduced motion omits Lightning impact flash and uses two static accents',()=>withCanvas(()=>{
  const effects=createBoardEffects({reducedMotion:true});effects.setProfile({rewardBoard:'lightning'});effects.trigger({type:'trick'});effects.update(.01,surfer,camera);
  const burst=effects.group.children.find(x=>x.visible),sprites=burst.children.filter(o=>o.isSprite&&o.visible);
  assert.equal(sprites.length,2);assert.equal(burst.getObjectByName('local-impact-frame').visible,false);assert.equal(burst.children.filter(o=>o.isMesh&&o.visible).length,0);
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

test('Skybound unfolds two feather wings around the real animated board throughout descent',()=>withCanvas(()=>{
  const scene=new THREE.Group(),effects=createBoardEffects(),s=createSurfer({rewardBoard:'sky'});
  scene.position.set(9,-2,3);scene.rotation.y=.6;scene.scale.setScalar(1.2);scene.add(s.rig,effects.group);
  s.rig.position.set(4,8,-12);s.yaw.rotation.y=1.1;s.boardPivot.position.set(.2,.4,.1);s.boardPivot.rotation.set(.35,.7,-.28);
  effects.setProfile({rewardBoard:'sky'});
  for(let i=0;i<40;i++)effects.update(.05,s,camera,{gliding:true});
  const wings=effects.group.getObjectByName('skybound-angel-wings');
  assert.equal(wings.visible,true);assert.equal(effects.activeCount,0,'glide needs no trick event or burst slot');
  assert.equal(wings.children.length,2);assert.equal(wings.userData.gliding,true);
  scene.updateMatrixWorld(true);
  for(let i=0;i<16;i++)assert.ok(Math.abs(wings.matrixWorld.elements[i]-s.board.matrixWorld.elements[i])<1e-6,'wings retain the complete deck transform');
  for(const side of wings.children){const mesh=side.children[0];assert.ok(mesh.geometry.attributes.position.count>140,'individually modelled feather fan');assert.ok(mesh.geometry.attributes.color);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,false);}
  assert.ok(wings.children[0].position.x<0&&wings.children[1].position.x>0,'wings sit on opposite rails');
  assert.equal(wings.children[0].children[0].scale.x,-1);assert.equal(wings.children[1].children[0].scale.x,1);
  effects.dispose();disposeSurfer(s);
}));

test('Skybound wings pause cleanly, fold after gliding and clear on equipment, finish and reset',()=>withCanvas(()=>{
  const effects=createBoardEffects();effects.setProfile({rewardBoard:'sky'});effects.update(.1,surfer,camera,{gliding:true});
  const wings=effects.group.getObjectByName('skybound-angel-wings'),left=wings.children[0];
  const pose=left.rotation.toArray(),opacity=left.children[0].material.opacity;
  effects.update(.1,surfer,camera,{paused:true,gliding:false});
  assert.deepEqual(left.rotation.toArray(),pose);assert.equal(left.children[0].material.opacity,opacity);
  effects.update(.05,surfer,camera,{gliding:false});assert.equal(wings.visible,true,'fold is a transition, not an instant disappearance');
  assert.ok(left.children[0].material.opacity<opacity);
  for(let i=0;i<20;i++)effects.update(.05,surfer,camera,{gliding:false});assert.equal(wings.visible,false);
  for(const clear of [()=>effects.reset(),()=>effects.update(.01,surfer,camera,{finished:true}),()=>effects.setProfile({rewardBoard:'guitar'})]){
    effects.setProfile({rewardBoard:'sky'});effects.update(.1,surfer,camera,{gliding:true});assert.equal(wings.visible,true);clear();assert.equal(wings.visible,false);
  }
  effects.update(.1,surfer,camera,{gliding:true});assert.equal(wings.visible,false,'other equipment cannot show angel wings');effects.dispose();
}));

test('Skybound completed tricks briefly spread wings without requiring an active glide',()=>withCanvas(()=>{
  const effects=createBoardEffects();effects.setProfile({rewardBoard:'sky'});
  const wings=effects.group.getObjectByName('skybound-angel-wings');
  for(const type of ['trick','airJump']){
    effects.reset();effects.trigger({type});effects.update(.05,surfer,camera);assert.equal(wings.visible,true);
    for(let i=0;i<40;i++)effects.update(.05,surfer,camera);assert.equal(wings.visible,false);
  }
  effects.dispose();
}));

test('Undertow and Solar have distinct layered geometry and remain depth-tested, bounded bursts',()=>withCanvas(()=>{
  const effects=createBoardEffects();
  for(const id of ['vortex','solar']){
    effects.setProfile({rewardBoard:id});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);
    const burst=effects.group.children.find(o=>o.visible),sculpted=burst.getObjectByName('sculpted-reward-burst');assert.equal(sculpted.visible,true);
    assert.equal(burst.children.some(o=>o.isSprite&&o.visible),false,'new motifs are modelled, not icon rings');
    assert.equal(burst.getObjectByName('local-impact-frame').visible,false);
    assert.equal(sculpted.children.filter(o=>o.visible&&o.name.startsWith('water-ribbon')).length,id==='vortex'?3:0);
    assert.equal(sculpted.children.filter(o=>o.visible&&o.name.startsWith('solar-corona')).length,id==='solar'?2:0);
    assert.equal(sculpted.children.filter(o=>o.visible&&o.name.startsWith('solar-flame')).length,id==='solar'?10:0);
    for(const mesh of sculpted.children.filter(o=>o.visible)){assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.depthWrite,false);assert.ok(mesh.position.length()<2.2);}
    const transforms=sculpted.children.map(o=>[...o.position.toArray(),...o.rotation.toArray()]);effects.update(.1,surfer,camera,{paused:true});assert.deepEqual(sculpted.children.map(o=>[...o.position.toArray(),...o.rotation.toArray()]),transforms);
  }
  effects.dispose();
}));

test('reduced motion keeps new motifs and wings static with no extra impact frame',()=>withCanvas(()=>{
  const effects=createBoardEffects({reducedMotion:true});
  for(const id of ['vortex','solar']){
    effects.setProfile({rewardBoard:id});effects.trigger({type:'trick'});effects.update(.02,surfer,camera);
    const burst=effects.group.children.find(o=>o.visible),sculpted=burst.getObjectByName('sculpted-reward-burst');
    const pose=sculpted.children.map(o=>[...o.position.toArray(),...o.rotation.toArray(),...o.scale.toArray()]);
    effects.update(.1,surfer,camera);assert.deepEqual(sculpted.children.map(o=>[...o.position.toArray(),...o.rotation.toArray(),...o.scale.toArray()]),pose);assert.equal(burst.getObjectByName('local-impact-frame').visible,false);
  }
  effects.setProfile({rewardBoard:'sky'});effects.update(.1,surfer,camera,{gliding:true});
  const wings=effects.group.getObjectByName('skybound-angel-wings'),pose=wings.children.map(o=>o.rotation.toArray());
  effects.update(.1,surfer,camera,{gliding:true});assert.deepEqual(wings.children.map(o=>o.rotation.toArray()),pose);effects.update(.01,surfer,camera,{gliding:false});assert.equal(wings.visible,false);effects.dispose();
}));

test('guitar retains the original icon, impact and ray presentation',()=>withCanvas(()=>{
  const effects=createBoardEffects();
  for(const id of ['guitar']){
    effects.setProfile({rewardBoard:id});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);
    const burst=effects.group.children.find(o=>o.visible),icons=burst.children.filter(o=>o.isSprite&&o.visible),halo=burst.getObjectByName('local-impact-frame');
    assert.equal(icons.length,8);assert.equal(icons[0].material.map.name,'reward-icon-'+id);assert.equal(halo.visible,true);assert.deepEqual(halo.scale.toArray(),[1.1,1.06,1]);
    assert.equal(burst.children.filter(o=>o.isMesh&&o.visible).length,13);assert.equal(burst.getObjectByName('sculpted-reward-burst').visible,false);assert.equal(effects.group.getObjectByName('skybound-angel-wings').visible,false);
  }
  effects.dispose();
}));

function activeGraffiti(effects){
  return effects.group.children.filter(root=>root.visible).map(root=>root.getObjectByName('lightning-graffiti')).filter(tag=>tag?.visible);
}
function advanceEffects(effects,seconds,options={}){
  for(let remaining=seconds;remaining>1e-8;remaining-=.05)effects.update(Math.min(.05,remaining),surfer,camera,options);
}

test('Lightning graffiti appears only when the player completes a real trick',()=>withCanvas(()=>{
  const effects=createBoardEffects();effects.setProfile({rewardBoard:'lightning'});
  for(const event of [{type:'trickStart'},{type:'jump'},{type:'airJump'},{type:'raceBoost'},{type:'trick',opponent:true}]){
    assert.equal(effects.trigger(event),false);effects.update(.01,surfer,camera);assert.equal(activeGraffiti(effects).length,0);
  }
  const events=[],demo={stage:'charge',charge:0,started:false};
  const game=new SurfRaceGame(event=>{
    events.push(event);effects.trigger(event);
    if(event.type==='trickStart'&&!event.opponent)assert.equal(effects.activeCount,0,'the word waits for completion');
  });
  game.setRewardBoard('lightning');game.start();
  for(let i=0;i<900&&!events.some(event=>event.type==='trick'&&!event.opponent);i++){
    game.update(1/120,rewardDemoInput(game,demo,1/120));effects.update(1/120,surfer,camera);
  }
  assert.equal(events.filter(event=>event.type==='trick'&&!event.opponent).length,1);assert.equal(game.launchTricks,1);
  assert.equal(activeGraffiti(effects).length,1);assert.equal(effects.activeCount,1);
  effects.dispose();
}));

test('Lightning words remain legible beyond the electric accent and freeze during pause',()=>withCanvas(()=>{
  const effects=createBoardEffects();effects.setProfile({rewardBoard:'lightning'});effects.trigger({type:'trick'});
  camera.rotation.set(-.35,.7,.08);surfer.rig.position.set(8,4,-42);effects.update(.1,surfer,camera);
  const tag=activeGraffiti(effects)[0],word=tag.getObjectByName('graffiti-word'),root=tag.parent;
  assert.ok(word?.isSprite,'camera-facing lettering');assert.match(word.material.map.name,/^graffiti-word-/);
  assert.equal(word.material.depthTest,true);assert.equal(word.material.depthWrite,false);
  assert.ok(Math.abs(root.quaternion.dot(camera.quaternion))>1-1e-8);
  assert.equal(root.getObjectByName('local-impact-frame').visible,false,'words do not add a full impact flash');
  advanceEffects(effects,BOARD_EFFECT_LIFETIME);
  assert.equal(activeGraffiti(effects).length,1,'lettering lasts long enough to read after the short accent');assert.ok(word.material.opacity>0);
  const pose=[...tag.position.toArray(),...tag.scale.toArray(),...word.position.toArray(),...word.scale.toArray(),word.material.rotation,word.material.opacity];
  advanceEffects(effects,2,{paused:true});
  assert.deepEqual([...tag.position.toArray(),...tag.scale.toArray(),...word.position.toArray(),...word.scale.toArray(),word.material.rotation,word.material.opacity],pose);
  advanceEffects(effects,GRAFFITI_EFFECT_LIFETIME);assert.equal(effects.activeCount,0);assert.equal(activeGraffiti(effects).length,0);
  effects.dispose();camera.rotation.set(0,0,0);
}));

test('rapid Lightning combos reuse the fixed slots, vary words and release all word textures once',()=>withCanvas(()=>{
  const effects=createBoardEffects(),resources=new Set(),words=new Set();effects.setProfile({rewardBoard:'lightning'});
  const objects=effects.group.getObjectsByProperty('isObject3D',true).length;
  for(let i=0;i<200;i++){
    effects.trigger({type:'trick'});effects.update(.001,surfer,camera);
    for(const tag of activeGraffiti(effects)){
      const word=tag.getObjectByName('graffiti-word');words.add(tag.userData.word);resources.add(word.material);resources.add(word.material.map);
    }
  }
  assert.equal(effects.activeCount,BOARD_EFFECT_POOL_SIZE);assert.equal(activeGraffiti(effects).length,BOARD_EFFECT_POOL_SIZE);
  assert.equal(effects.group.getObjectsByProperty('isObject3D',true).length,objects);
  assert.ok(words.has('NICE!'));assert.ok(words.has('WOW!'));assert.ok(words.size>=4,'several distinct graffiti reactions');
  assert.equal(resources.size,words.size+BOARD_EFFECT_POOL_SIZE,'shared prebuilt textures and one material per slot');
  const disposals=new Map([...resources].map(resource=>[resource,0]));
  for(const resource of resources)resource.addEventListener('dispose',()=>disposals.set(resource,disposals.get(resource)+1));
  effects.dispose();effects.dispose();
  for(const disposed of disposals.values())assert.equal(disposed,1);
  assert.equal(effects.group.children.length,0);assert.equal(effects.trigger({type:'trick'}),false);
}));

test('graffiti clears on reset, finish and equipment change and never appears on other decks',()=>withCanvas(()=>{
  const effects=createBoardEffects();
  for(const clear of [()=>effects.reset(),()=>effects.update(.01,surfer,camera,{finished:true}),()=>effects.setProfile({rewardBoard:'guitar'})]){
    effects.setProfile({rewardBoard:'lightning'});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);assert.equal(activeGraffiti(effects).length,1);
    clear();assert.equal(activeGraffiti(effects).length,0);
  }
  for(const rewardBoard of [null,'guitar','vortex','solar','sky']){
    effects.setProfile({rewardBoard});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);assert.equal(activeGraffiti(effects).length,0);
  }
  effects.dispose();
}));

test('reduced-motion graffiti keeps its pose static while retaining readable lettering',()=>withCanvas(()=>{
  const effects=createBoardEffects({reducedMotion:true});effects.setProfile({rewardBoard:'lightning'});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);
  const tag=activeGraffiti(effects)[0],word=tag.getObjectByName('graffiti-word');
  const pose=[...tag.position.toArray(),...tag.rotation.toArray(),...tag.scale.toArray(),...word.position.toArray(),...word.scale.toArray(),word.material.rotation];
  advanceEffects(effects,.5);
  assert.deepEqual([...tag.position.toArray(),...tag.rotation.toArray(),...tag.scale.toArray(),...word.position.toArray(),...word.scale.toArray(),word.material.rotation],pose);
  assert.ok(word.material.opacity>0);effects.dispose();
}));
