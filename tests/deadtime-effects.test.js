import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBoardEffects,CLOCK_EFFECT_LIFETIME,BOARD_EFFECT_POOL_SIZE } from '../src/board-effects.js';
import { createSurfer,disposeSurfer } from '../src/appearance.js';
import { TimePowerScreen,TIME_PULSE_SECONDS,TIME_TINT_OPACITY } from '../src/time-power-screen.js';

const context=new Proxy({}, {get:(_,key)=>['createLinearGradient','createRadialGradient'].includes(key)?()=>({addColorStop(){}}):()=>{},set:()=>true});
function withCanvas(run){const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>context})};try{return run();}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}}
const camera=new THREE.PerspectiveCamera();
function advance(effects,surfer,seconds,options={}){for(let remaining=seconds;remaining>1e-8;remaining-=.05)effects.update(Math.min(.05,remaining),surfer,camera,options);}
function activeClocks(effects){return effects.group.children.filter(root=>root.visible).map(root=>root.getObjectByName('spiralling-clock-hands')).filter(clock=>clock?.visible);}

test('DEADTIME has its own original chronometer deck and emits hands only for its completed tricks',()=>withCanvas(()=>{
  const surfer=createSurfer({rewardBoard:'deadtime'}),effects=createBoardEffects();effects.setProfile({rewardBoard:'deadtime'});
  assert.equal(surfer.board.material.map.name,'reward-deck-deadtime');
  for(const event of [{type:'trickStart'},{type:'jump'},{type:'airJump'},{type:'raceBoost'},{type:'trick',opponent:true}])assert.equal(effects.trigger(event),false);
  effects.trigger({type:'trick'});effects.update(.1,surfer,camera);
  const clock=activeClocks(effects)[0];assert.ok(clock);assert.equal(clock.children.length,8);
  for(const hands of clock.children){assert.ok(hands.getObjectByName('minute-hand').isMesh);assert.ok(hands.getObjectByName('hour-hand').isMesh);assert.equal(hands.children.length,3,'separate hands and centre, no clock-face sprite');}
  assert.equal(clock.parent.children.some(object=>object.isSprite&&object.visible),false);
  for(const id of [null,'guitar','lightning','sky']){effects.setProfile({rewardBoard:id});effects.trigger({type:'trick'});effects.update(.1,surfer,camera);assert.equal(activeClocks(effects).length,0);}
  effects.dispose();disposeSurfer(surfer);
}));

test('clock hands spiral from the animated board, freeze on pause, expire and reuse their bounded pool',()=>withCanvas(()=>{
  const scene=new THREE.Group(),surfer=createSurfer({rewardBoard:'deadtime'}),effects=createBoardEffects();scene.add(surfer.rig,effects.group);
  scene.position.set(9,-2,3);scene.rotation.y=.4;surfer.rig.position.set(2,7,-20);surfer.boardPivot.position.set(.2,.4,.1);surfer.boardPivot.rotation.set(.35,.7,-.28);
  effects.setProfile({rewardBoard:'deadtime'});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);
  const clock=activeClocks(effects)[0],hand=clock.children[0],before=hand.position.toArray();
  scene.updateMatrixWorld(true);const boardPosition=surfer.board.getWorldPosition(new THREE.Vector3()),origin=clock.parent.getWorldPosition(new THREE.Vector3());
  assert.ok(boardPosition.distanceTo(origin)<1e-7,'effect starts at actual deck, not generic torso height');
  effects.update(.1,surfer,camera);assert.notDeepEqual(hand.position.toArray(),before);const pose=clock.children.map(h=>[...h.position.toArray(),h.children[0].rotation.z]);
  advance(effects,surfer,2,{paused:true});assert.deepEqual(clock.children.map(h=>[...h.position.toArray(),h.children[0].rotation.z]),pose);
  advance(effects,surfer,CLOCK_EFFECT_LIFETIME);assert.equal(effects.activeCount,0);
  const objects=effects.group.getObjectsByProperty('isObject3D',true).length;
  for(let i=0;i<100;i++)effects.trigger({type:'trick'});
  assert.equal(effects.activeCount,BOARD_EFFECT_POOL_SIZE);assert.equal(effects.group.getObjectsByProperty('isObject3D',true).length,objects);
  effects.reset();assert.equal(activeClocks(effects).length,0);effects.dispose();disposeSurfer(surfer);
}));

test('DEADTIME activation ring follows deck orientation, pauses and never appears on other boards',()=>withCanvas(()=>{
  const surfer=createSurfer({rewardBoard:'deadtime'}),effects=createBoardEffects();effects.setProfile({rewardBoard:'deadtime'});
  assert.equal(effects.trigger({type:'timePower',active:true,opponent:true}),false);
  assert.equal(effects.trigger({type:'timePower',active:true}),true);effects.update(.1,surfer,camera);
  const pulse=effects.group.getObjectByName('deadtime-board-pulse');assert.equal(pulse.visible,true);assert.equal(effects.activeCount,0);
  const scale=pulse.children[0].scale.toArray(),opacity=pulse.children[0].material.opacity;advance(effects,surfer,1,{paused:true});assert.deepEqual(pulse.children[0].scale.toArray(),scale);assert.equal(pulse.children[0].material.opacity,opacity);
  advance(effects,surfer,1);assert.equal(pulse.visible,false);
  effects.trigger({type:'timePower',active:true});effects.trigger({type:'timePower',active:false});assert.equal(pulse.visible,false);
  effects.setProfile({rewardBoard:'guitar'});assert.equal(effects.trigger({type:'timePower',active:true}),false);assert.equal(pulse.visible,false);
  effects.dispose();disposeSurfer(surfer);
}));

test('reduced-motion DEADTIME keeps three static hand accents and omits expanding board pulse',()=>withCanvas(()=>{
  const surfer={rig:new THREE.Group()},effects=createBoardEffects({reducedMotion:true});effects.setProfile({rewardBoard:'deadtime'});effects.trigger({type:'trick'});effects.update(.05,surfer,camera);
  const hands=activeClocks(effects)[0].children.filter(h=>h.visible);assert.equal(hands.length,3);
  const pose=hands.map(h=>[...h.position.toArray(),...h.scale.toArray(),h.children[0].rotation.z]);advance(effects,surfer,.3);assert.deepEqual(hands.map(h=>[...h.position.toArray(),...h.scale.toArray(),h.children[0].rotation.z]),pose);
  effects.trigger({type:'timePower',active:true});effects.update(.05,surfer,camera);assert.equal(effects.group.getObjectByName('deadtime-board-pulse').visible,false);
  effects.dispose();
}));

test('clock and pulse GPU resources dispose exactly once',()=>withCanvas(()=>{
  const effects=createBoardEffects(),resources=new Set();effects.group.traverse(o=>{if(o.isMesh)resources.add(o.geometry);if(o.material)resources.add(o.material);});
  const counts=new Map([...resources].map(r=>[r,0]));for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
  effects.dispose();effects.dispose();for(const count of counts.values())assert.equal(count,1);assert.equal(effects.group.children.length,0);
}));

function screenFixture(reducedMotion=false){
  const doc={createElement:()=>({style:{},dataset:{},children:[],setAttribute(){},append(...items){for(const item of items){item.parent=this;this.children.push(item);}},remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}})};
  const mount=doc.createElement();mount.ownerDocument=doc;
  const screen=new TimePowerScreen({mount,reducedMotion,viewport:()=>({width:1200,height:700})});return {screen,mount};
}
function screenAdvance(screen,seconds,options){for(let left=seconds;left>1e-8;left-=.05)screen.update(Math.min(.05,left),options);}

test('screen tint expands from projected board across full viewport and remains green until disabled',()=>{
  const {screen,mount}=screenFixture();assert.equal(mount.children.length,1);assert.equal(screen.element.hidden,true);
  screen.update(.05,{active:true,origin:{x:245,y:530}});assert.equal(screen.element.hidden,false);assert.equal(screen.ring.hidden,false);assert.match(screen.tint.style.clipPath,/at 245\.00px 530\.00px/);
  screenAdvance(screen,TIME_PULSE_SECONDS+.1,{active:true,origin:{x:500,y:400}});assert.equal(screen.ring.hidden,true);assert.equal(screen.tint.style.clipPath,'none');assert.equal(Number(screen.tint.style.opacity),TIME_TINT_OPACITY);
  screen.update(.05,{active:false});assert.ok(Number(screen.tint.style.opacity)<TIME_TINT_OPACITY);screenAdvance(screen,.4,{active:false});assert.equal(screen.element.hidden,true);
  screen.dispose();assert.equal(mount.children.length,0);
});

test('screen pulse freezes with pause, is resettable and ignores updates after disposal',()=>{
  const {screen,mount}=screenFixture();screen.update(.1,{active:true,origin:{x:600,y:600}});
  const state={...screen.tint.style},ring={...screen.ring.style};screenAdvance(screen,2,{active:true,paused:true});assert.deepEqual(screen.tint.style,state);assert.deepEqual(screen.ring.style,ring);
  screen.reset();assert.equal(screen.element.hidden,true);assert.equal(screen.tint.style.opacity,'0');screen.update(.1,{active:true,origin:{x:300,y:200}});assert.match(screen.tint.style.clipPath,/at 300\.00px 200\.00px/);
  screen.dispose();screen.dispose();screen.update(.1,{active:true});assert.equal(screen.element.hidden,true);assert.equal(mount.children.length,0);
});

test('reduced-motion power uses gentle full-screen tint without ring or expanding mask',()=>{
  const {screen}=screenFixture(true);screen.update(.05,{active:true,origin:{x:50,y:600}});
  assert.equal(screen.ring.hidden,true);assert.equal(screen.tint.style.clipPath,'none');assert.ok(Number(screen.tint.style.opacity)>0&&Number(screen.tint.style.opacity)<TIME_TINT_OPACITY);
  screenAdvance(screen,.5,{active:true});assert.equal(Number(screen.tint.style.opacity),TIME_TINT_OPACITY);screen.dispose();
});
