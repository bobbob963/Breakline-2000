import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SurfGame } from '../src/game.js';
import { createKeydownHandler } from '../src/keyboard.js';
import { IDENTITY_KEY, loadRiderIdentity, saveRiderIdentity, sanitizeRiderName } from '../src/rider-identity.js';
import { resetBreaklineSave } from '../src/admin-save.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const noOp=()=>{};
function block(first,last) {
  const start=source.indexOf(first),end=source.indexOf(last,start+first.length);
  assert.ok(start>=0&&end>start,`production block ${first} exists`);
  return source.slice(start,end);
}
function storage(initial=[]) {
  const data=new Map(initial);
  return {data,get length(){return data.size;},key:index=>[...data.keys()][index]??null,
    getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
function fixture(saved=storage()) {
  const calls={names:[],opens:[],admin:0,clear:0,reloads:0},classes=new Set();
  const element={classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)},focus:noOp};
  const context={
    localStorage:saved,riderIdentity:loadRiderIdentity(saved),sanitizeRiderName,saveRiderIdentity,resetBreaklineSave,
    menuSurfer:{setName:name=>calls.names.push(name)},tutorial:{isOpen:false,open:options=>calls.opens.push(options)},
    settingsPanel:{isOpen:false},playerSettings:{keybinds:{}},adminPanel:{isOpen:false,open:()=>calls.admin++},game:new SurfGame(noOp,'storm'),bootReady:true,modalMode:null,workshopMode:null,
    clearInput:()=>calls.clear++,$:()=>element,document:{body:element},window:{location:{reload:()=>calls.reloads++}},
    selectedMode:'storm',wasted:{active:false,reset:noOp},timePowerScreen:{reset:noOp},closeWorkshop:noOp,closeModal:noOp,
    special:{reset:noOp},soundPreference:'off',audio:{setMode:noOp,setRideContext:noOp,setScene:noOp},applyPlayerSettings:noOp,
    world:{setMode:noOp},updateModeMenu:noOp,updateSoundLabel:noOp,
  };
  vm.runInNewContext(block('function adminHomeScreen(','function applyAdminSettings('),context);
  vm.runInNewContext(block('function fullReset(','function syncInput('),context);
  vm.runInNewContext(block('function startRun(','function goHome('),context);
  return {context,calls,saved,classes};
}

test('tutorial completion atomically saves the normalized rider name and updates the lobby tag',()=>{
  const {context:c,calls,saved}=fixture();
  c.completeTutorial('  Nova \n Rider  ');
  assert.deepEqual(loadRiderIdentity(saved),{name:'Nova Rider',tutorialComplete:true});
  assert.deepEqual(c.riderIdentity,{name:'Nova Rider',tutorialComplete:true});
  assert.deepEqual(calls.names,['Nova Rider']);
  assert.equal(saved.data.size,1,'name and tutorial completion use one save record');
});

test('a failed tutorial save keeps the previous identity and lobby name intact for a retry',()=>{
  const saved=storage();saveRiderIdentity(saved,'Original Rider');
  const {context:c,calls}=fixture(saved),before=c.riderIdentity,stored=saved.getItem(IDENTITY_KEY),set=saved.setItem;
  saved.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>c.completeTutorial('New Rider'),/could not save/);
  assert.equal(c.riderIdentity,before);assert.equal(saved.getItem(IDENTITY_KEY),stored);assert.deepEqual(calls.names,[]);
  saved.setItem=set;c.completeTutorial('New Rider');
  assert.equal(c.riderIdentity.name,'New Rider');assert.equal(loadRiderIdentity(saved).name,'New Rider');
  assert.deepEqual(calls.names,['New Rider']);
});

test('the explicit session-only fallback updates this lobby without attempting another blocked write',()=>{
  const saved=storage(),{context:c,calls}=fixture(saved);
  saved.setItem=()=>{throw new Error('session fallback must not write storage');};
  c.completeTutorial('  Wave Rider ',{persist:false});
  assert.equal(c.riderIdentity.name,'Wave Rider');assert.equal(c.riderIdentity.tutorialComplete,true);
  assert.deepEqual(calls.names,['Wave Rider']);assert.equal(saved.getItem(IDENTITY_KEY),null);
  assert.equal(loadRiderIdentity(saved).tutorialComplete,false,'a future visit still needs completion if storage stays blocked');
  assert.throws(()=>c.completeTutorial('  ',{persist:false}),/Enter a name/);
  assert.equal(c.riderIdentity.name,'Wave Rider');
});

test('runs and retries cannot start or consume controls while the tutorial is open',()=>{
  const {context:c,calls}=fixture();c.tutorial.isOpen=true;
  c.startRun();c.restartRun();
  assert.equal(c.game.phase,'ready');assert.equal(calls.clear,0);
  c.tutorial.isOpen=false;c.startRun();assert.equal(c.game.phase,'running');
});

test('admin and tutorial opening require an unobscured home screen and cannot nest during the guide',()=>{
  const {context:c,calls,classes}=fixture();
  assert.equal(c.adminHomeScreen(),true);c.openTutorial(false);
  assert.equal(calls.opens.length,1);assert.equal(calls.opens[0].replay,false);
  c.tutorial.isOpen=true;assert.equal(c.adminHomeScreen(),false);c.openAdmin();c.openTutorial();
  assert.equal(calls.admin,0);assert.equal(calls.opens.length,1);
  c.tutorial.isOpen=false;
  for(const phase of ['running','paused','finished']){c.game.phase=phase;c.openTutorial();assert.equal(calls.opens.length,1);}
  c.game.phase='ready';classes.add('hidden');c.openTutorial();assert.equal(calls.opens.length,1);
  classes.delete('hidden');c.openAdmin();c.openTutorial();
  assert.equal(calls.admin,1);assert.equal(calls.opens.length,2);assert.equal(calls.opens[1].replay,true);
});

test('the production keyboard gate blocks gameplay and the admin arrow code during the tutorial',()=>{
  const {context:c,calls}=fixture();
  Object.assign(c,{createKeydownHandler,keydownHandler:null,input:{},pressed:new Set(),syncInput:noOp,
    toggleSound:noOp,closeWardrobe:noOp,cycleCharacter:noOp,pause:noOp,tryTrick:noOp,toast:noOp,preview:null});
  vm.runInNewContext(block('keydownHandler=createKeydownHandler(','window.addEventListener(\'keydown\''),c);
  const press=code=>c.keydownHandler({code,repeat:false,timeStamp:100,preventDefault:noOp});
  c.tutorial.isOpen=true;
  for(const code of ['Enter','Space','KeyJ','ArrowLeft','ArrowLeft','ArrowRight','ArrowUp'])press(code);
  assert.equal(c.game.phase,'ready');assert.equal(calls.admin,0);assert.equal(c.pressed.size,0);
  c.tutorial.isOpen=false;
  for(const code of ['ArrowLeft','ArrowLeft','ArrowRight','ArrowUp'])press(code);
  assert.equal(calls.admin,1,'the same real shortcut remains available after leaving the tutorial');
});

test('the actual post-loading gate opens the guide for a first visit, but not after saved completion',()=>{
  const code=block('  if(!riderIdentity.tutorialComplete)openTutorial(false);','  let previous=performance.now()');
  const {context:c,calls}=fixture();vm.runInNewContext(code,c);
  assert.equal(calls.opens.length,1);assert.equal(calls.opens[0].replay,false);
  c.completeTutorial('First Rider');vm.runInNewContext(code,c);assert.equal(calls.opens.length,1);
  const returning=fixture(c.localStorage);vm.runInNewContext(code,returning.context);
  assert.equal(returning.calls.opens.length,0);
});

test('Full Reset removes the tutorial and rider name, preserves unrelated storage, and reloads',()=>{
  const saved=storage([['another-game','keep'],['breakline99-best-surf','300']]);saveRiderIdentity(saved,'Reset Rider');
  const {context:c,calls}=fixture(saved);c.fullReset();
  assert.equal(calls.reloads,1);assert.equal(saved.getItem(IDENTITY_KEY),null);
  assert.deepEqual([...saved.data],[['another-game','keep']]);assert.equal(loadRiderIdentity(saved).tutorialComplete,false);
});
