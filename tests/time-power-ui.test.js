import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SurfWorld} from '../src/world.js';
import {SurfGame} from '../src/game.js';
import {SECRET_STORAGE_KEY,sanitizeSecretProgress,awardSurvivalSecret} from '../src/secret-progress.js';
import {getRewardBoard} from '../src/board-rewards.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const block=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)+from.length));
const noop=()=>{};

test('production unlock saves immediately at five minutes, announces once and offers an equip card only after discovery',()=>{
  const saved=new Map(),messages=[];let choices=0,bests=0;
  const c={secretProgress:sanitizeSecretProgress(null),secretUnlockedThisRun:false,game:{mode:'surf',rulesId:'storm',phase:'running',elapsed:299.99},SECRET_STORAGE_KEY,awardSurvivalSecret,
    write:(key,value)=>saved.set(key,value),saveBest:()=>bests++,updateCustomizationChoices:()=>choices++,toast:text=>messages.push(text),toastTime:0,getRewardBoard};
  vm.runInNewContext(block('function checkSurvivalSecret(', 'function completedGoals('),c);
  assert.equal(c.checkSurvivalSecret(),false);assert.equal(saved.size,0);
  c.game.elapsed=300;assert.equal(c.checkSurvivalSecret(),true);assert.equal(c.secretUnlockedThisRun,true);
  assert.equal(JSON.parse(saved.get(SECRET_STORAGE_KEY)).deadtimeUnlocked,true);assert.equal(bests,1);assert.equal(choices,1);
  assert.match(messages[0],/DEADTIME/);assert.equal(c.checkSurvivalSecret(),false);assert.equal(messages.length,1);
  vm.runInNewContext(block('const rewardIcons=', 'function ladderRows('),c);
  assert.equal(c.rewardCard('deadtime'),'');
  assert.match(c.rewardCard('deadtime',{unlocked:true}),/data-reward-board="deadtime"/);
  assert.match(c.rewardCard('deadtime',{unlocked:true,equipped:true}),/EQUIPPED/);
});

test('main animation loop passes the same slowed delta to simulation, special meter and world while screen pulse uses real time',()=>{
  const game=new SurfGame();game.setRewardBoard('deadtime');game.start();game.toggleTimePower();
  const draws=[],screens=[],specials=[];
  const c={game,previous:0,accumulator:0,hudTime:0,animationId:0,workshopMode:null,modalMode:null,input:{pump:true},special:{update:dt=>specials.push(dt)},
    world:{update:dt=>draws.push(dt),boardScreenOrigin:()=>({x:100,y:200})},timePowerScreen:{update:(dt,state)=>screens.push({dt,state})},wasted:{active:false,update:noop},
    preview:null,menuSurfer:{update:noop},document:{hidden:false},$ :()=>({classList:{contains:()=>true,remove:noop}}),audio:{update:noop,setRaceState:noop,setRideContext:noop},
    updateHud:noop,checkSurvivalSecret:noop,toastTime:0,requestAnimationFrame:()=>1};
  vm.runInNewContext(block('const frame=now=>{',';animationId=requestAnimationFrame(frame);')+';globalThis.runFrame=frame;',c);
  for(let i=1;i<=60;i++)c.runFrame(i*1000/60);
  assert.ok(Math.abs(game.elapsed-.4)<1/120+.00001);
  assert.ok(Math.abs(draws.reduce((a,b)=>a+b,0)-.4)<1e-8);
  assert.ok(Math.abs(specials.reduce((a,b)=>a+b,0)-.4)<1e-8);
  assert.ok(Math.abs(screens.reduce((sum,row)=>sum+row.dt,0)-1)<1e-8);
  assert.deepEqual(screens.at(-1).state.origin,{x:100,y:200});assert.equal(screens.at(-1).state.active,true);
  game.pause();const elapsed=game.elapsed,charge=game.timePowerCharge;c.runFrame(1016.667);
  assert.equal(game.elapsed,elapsed);assert.equal(game.timePowerCharge,charge);assert.equal(screens.at(-1).state.paused,true);
});

test('activation screen origin follows the actual board through camera and canvas viewport coordinates',()=>{
  const board=new THREE.Object3D(),camera=new THREE.PerspectiveCamera(50,2,.1,100);
  camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const world={surfer:{board},camera,renderer:{domElement:{getBoundingClientRect:()=>({left:20,top:50,width:800,height:400})}}};
  const origin=()=>SurfWorld.prototype.boardScreenOrigin.call(world);
  assert.deepEqual(origin(),{x:420,y:250});board.position.set(2,1,0);
  const moved=origin();assert.ok(moved.x>420);assert.ok(moved.y<250);
  board.position.set(0,0,12);assert.equal(origin(),undefined,'behind-camera board uses safe fallback');
});
