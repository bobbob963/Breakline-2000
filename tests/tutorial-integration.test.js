import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SurfGame } from '../src/game.js';
import { createKeydownHandler } from '../src/keyboard.js';
import { IDENTITY_KEY, loadRiderIdentity, saveRiderIdentity, sanitizeRiderName } from '../src/rider-identity.js';
import { resetBreaklineSave } from '../src/admin-save.js';
import { awardSurvivalSecret, SECRET_STORAGE_KEY } from '../src/secret-progress.js';

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
  const calls={names:[],opens:[],guides:[],admin:0,clear:0,reloads:0,restarts:0,results:0,wasted:0,tricks:[],events:[]};
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id)){
      const classes=new Set();
      elements.set(id,{classes,classList:{contains:name=>classes.has(name),add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name))},focus:noOp});
    }
    return elements.get(id);
  };
  element('hud').classes.add('hidden');
  const context={
    SurfGame,localStorage:saved,riderIdentity:loadRiderIdentity(saved),sanitizeRiderName,saveRiderIdentity,resetBreaklineSave,
    awardSurvivalSecret,SECRET_STORAGE_KEY,secretProgress:{version:1,deadtimeUnlocked:false},secretUnlockedThisRun:false,
    best:100,bestSurvival:10,newBest:false,challengeFlags:[],profile:{character:'nova',rewardBoard:'deadtime'},
    adminSettings:{enabled:true,environment:{surfWeather:'sunset'}},lastSurfWeather:'dusk',
    menuSurfer:{setName:name=>calls.names.push(name)},
    tutorial:{isOpen:false,open:options=>{calls.opens.push(options);context.tutorial.isOpen=true;}},
    settingsPanel:{isOpen:false},playerSettings:{keybinds:{}},adminPanel:{isOpen:false,open:()=>calls.admin++},game:new SurfGame(noOp,'storm'),bootReady:true,modalMode:null,workshopMode:null,
    clearInput:()=>calls.clear++,$:element,document:{body:element('body')},window:{location:{reload:()=>calls.reloads++}},
    selectedMode:'storm',practiceSession:false,practiceReturnMode:'surf',practiceReplay:false,
    wasted:{active:false,reset:noOp,start:()=>calls.wasted++},timePowerScreen:{reset:noOp},closeWorkshop:noOp,closeModal:noOp,
    special:{reset:noOp,gain:noOp,bail:noOp},soundPreference:'off',audio:{setMode:noOp,setRideContext:noOp,setScene:noOp,event:noOp},applyPlayerSettings:noOp,
    world:{setMode:noOp,onEvent:event=>calls.events.push(event)},updateModeMenu:noOp,updateSoundLabel:noOp,updateHud:noOp,
    updateCustomizationChoices:noOp,toast:noOp,fmt:value=>String(value),isParkMode:()=>false,showResults:()=>calls.results++,
    write:(key,value)=>saved.setItem(key,value),
  };
  context.makeGame=()=>{context.game=new SurfGame(context.onEvent,context.selectedMode);};
  context.guidedTutorial={active:false,currentStep:{id:'steer'},
    start:options=>{calls.guides.push(options);context.guidedTutorial.active=true;context.startPracticeMode('surf');},
    restartStep:()=>{calls.restarts++;context.startPracticeMode(context.game.rulesId);},
    skip:()=>{context.guidedTutorial.active=false;context.finishPractice();},onEvent:noOp,
  };
  vm.runInNewContext(block('function adminHomeScreen(','function applyAdminSettings('),context);
  vm.runInNewContext(block('function fullReset(','function syncInput('),context);
  vm.runInNewContext(block('function saveBest(','function completedGoals('),context);
  vm.runInNewContext(block('function onEvent(','function makeGame('),context);
  vm.runInNewContext(block('function startRun(','function openModal('),context);
  return {context,calls,saved,elements,classes:element('intro').classes};
}
function installKeyboard(c,calls){
  Object.assign(c,{createKeydownHandler,keydownHandler:null,input:{},pressed:new Set(),
    syncInput:()=>{c.input.jump=c.pressed.has('Space');c.input.left=c.pressed.has('ArrowLeft');},
    toggleSound:noOp,closeWardrobe:noOp,cycleCharacter:noOp,pause:noOp,tryTrick:type=>calls.tricks.push(type),preview:null});
  vm.runInNewContext(block('keydownHandler=createKeydownHandler(','window.addEventListener(\'keydown\''),c);
  return code=>c.keydownHandler({code,repeat:false,timeStamp:100,preventDefault:noOp});
}

test('tutorial completion atomically saves the normalized rider name and updates the lobby tag',()=>{
  const {context:c,calls,saved}=fixture();
  c.completeTutorial('  Nova \n Rider  ');
  assert.deepEqual(loadRiderIdentity(saved),{name:'Nova Rider',tutorialComplete:true});
  assert.deepEqual(c.riderIdentity,{name:'Nova Rider',tutorialComplete:true});
  assert.deepEqual(calls.names,['Nova Rider']);assert.equal(saved.data.size,1);
});

test('a failed tutorial save keeps the previous identity and lobby name intact for a retry',()=>{
  const saved=storage();saveRiderIdentity(saved,'Original Rider');
  const {context:c,calls}=fixture(saved),before=c.riderIdentity,stored=saved.getItem(IDENTITY_KEY),set=saved.setItem;
  saved.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>c.completeTutorial('New Rider'),/could not save/);
  assert.equal(c.riderIdentity,before);assert.equal(saved.getItem(IDENTITY_KEY),stored);assert.deepEqual(calls.names,[]);
  saved.setItem=set;c.completeTutorial('New Rider');
  assert.equal(c.riderIdentity.name,'New Rider');assert.equal(loadRiderIdentity(saved).name,'New Rider');assert.deepEqual(calls.names,['New Rider']);
});

test('session-only naming updates this lobby without attempting another blocked write',()=>{
  const saved=storage(),{context:c,calls}=fixture(saved);
  saved.setItem=()=>{throw new Error('session fallback must not write storage');};
  c.completeTutorial('  Wave Rider ',{persist:false});
  assert.equal(c.riderIdentity.name,'Wave Rider');assert.equal(c.riderIdentity.tutorialComplete,true);
  assert.deepEqual(calls.names,['Wave Rider']);assert.equal(saved.getItem(IDENTITY_KEY),null);
  assert.equal(loadRiderIdentity(saved).tutorialComplete,false);
  assert.throws(()=>c.completeTutorial('  ',{persist:false}),/Enter a name/);assert.equal(c.riderIdentity.name,'Wave Rider');
});

test('first visit starts a real Surf Session with live controls, an endless clock and no modal',()=>{
  const saved=storage([['breakline99-mode','storm'],['breakline99-weather','dusk'],['breakline99-best-surf','5000']]);
  const before=[...saved.data],{context:c,calls,elements}=fixture(saved);
  vm.runInNewContext(block('  if(!riderIdentity.tutorialComplete)openTutorial(false);','  let previous=performance.now()'),c);
  assert.equal(calls.guides.length,1);assert.equal(calls.guides[0].replay,false);
  assert.equal(calls.opens.length,0,'the old handbook does not interrupt the initial drop-in');
  assert.ok(c.game instanceof SurfGame);assert.equal(c.game.rulesId,'surf');assert.equal(c.game.phase,'running');
  assert.equal(c.game.rules.endless,true);assert.equal(c.game.lives,null);assert.equal(c.game.isTutorial,true);
  assert.equal(c.game.characterId,'nova');assert.equal(c.game.rewardBoard,null);assert.equal(c.game.adminStats?.active,false);
  assert.equal(c.game.weatherId,'noon');assert.equal(c.practiceSession,true);assert.equal(c.practiceReturnMode,'storm');
  assert.equal(elements.get('intro').classes.has('hidden'),true);assert.equal(elements.get('hud').classes.has('hidden'),false);
  assert.equal(elements.get('body').classes.has('playing'),true);
  assert.deepEqual([...saved.data],before,'practice must not overwrite the saved mode, weather or scores');
  const press=installKeyboard(c,calls);press('ArrowLeft');press('Space');press('KeyJ');
  assert.equal(c.input.left,true);assert.equal(c.input.jump,true);assert.deepEqual(calls.tricks,['spin']);
});

test('practice restart keeps the current lesson and does not start or save a normal run',()=>{
  const {context:c,calls,saved}=fixture();c.openTutorial(false);c.startPracticeMode('storm');const previous=c.game;
  const press=installKeyboard(c,calls);press('KeyR');
  assert.equal(calls.restarts,1);assert.notEqual(c.game,previous);assert.equal(c.game.rulesId,'storm');
  assert.equal(c.game.lives,null);assert.equal(c.game.rules.endless,true);assert.equal(c.game.weatherId,'storm');
  assert.equal(c.practiceSession,true);assert.equal(c.game.phase,'running');assert.equal(saved.length,0);
});

test('five practice wipeouts remain recoverable instead of playing Wasted or ending the lesson',()=>{
  const {context:c,calls,saved}=fixture();c.openTutorial(false);
  for(let index=0;index<5;index++){c.game.bailTime=0;c.game.bail('PRACTICE WIPEOUT');}
  assert.equal(c.game.wipeouts,5);assert.equal(c.game.lives,null);assert.equal(c.game.phase,'running');
  assert.equal(calls.wasted,0);assert.equal(calls.results,0);assert.equal(c.practiceSession,true);assert.equal(saved.length,0);
});

test('practice scores and long survival cannot save records, award boards or expire the lesson',()=>{
  const saved=storage([['breakline99-best-storm','100'],['breakline99-survival-time','10'],['breakline99-tournament-v2','{"completedLadders":2}'],['breakline99-trials-v1','{"completedTrials":1}']]);
  const before=[...saved.data],{context:c,calls}=fixture(saved);c.openTutorial(false);c.startPracticeMode('storm');
  c.game.score=999999;c.game.elapsed=600;c.game.time=.001;c.onEvent({type:'bank',points:999999});c.saveBest();
  assert.equal(c.checkSurvivalSecret(),false);c.game.update(1/60,{});
  assert.deepEqual([...saved.data],before);assert.equal(c.best,100);assert.equal(c.bestSurvival,10);
  assert.equal(c.secretProgress.deadtimeUnlocked,false);assert.equal(c.secretUnlockedThisRun,false);
  assert.equal(c.game.phase,'running');assert.equal(calls.results,0);assert.equal(calls.wasted,0);
});

test('replayed practice restores the selected mode and keeps the existing name and progression',()=>{
  const saved=storage([['breakline99-mode','storm'],['breakline99-weather','sunset']]);saveRiderIdentity(saved,'Existing Rider');
  const before=[...saved.data],{context:c,calls,classes,elements}=fixture(saved);c.openTutorial();
  assert.equal(calls.guides[0].replay,true);c.game.score=50000;c.game.elapsed=400;c.goHome();
  assert.equal(c.guidedTutorial.active,false);assert.equal(c.practiceSession,false);assert.equal(c.selectedMode,'storm');
  assert.equal(c.game.phase,'ready');assert.equal(classes.has('hidden'),false);assert.equal(elements.get('body').classes.has('playing'),false);
  assert.equal(calls.opens.length,1);assert.equal(calls.opens[0].replay,true);assert.equal(calls.opens[0].startStep,'waterworks');
  assert.equal(c.riderIdentity.name,'Existing Rider');assert.deepEqual([...saved.data],before);
});

test('the final handbook blocks runs, retries and gameplay until it closes',()=>{
  const {context:c,calls}=fixture();c.tutorial.isOpen=true;c.startRun();c.restartRun();
  const press=installKeyboard(c,calls);
  for(const code of ['Enter','Space','KeyJ','ArrowLeft','ArrowLeft','ArrowRight','ArrowUp'])press(code);
  assert.equal(c.game.phase,'ready');assert.equal(calls.clear,0);assert.equal(calls.admin,0);assert.equal(c.pressed.size,0);
  c.tutorial.isOpen=false;c.startRun();assert.equal(c.game.phase,'running');
});

test('admin and guide opening require an unobscured home screen and cannot interrupt live practice',()=>{
  const {context:c,calls,classes}=fixture();
  assert.equal(c.adminHomeScreen(),true);c.openTutorial(false);
  assert.equal(c.adminHomeScreen(),false);c.openAdmin();c.openTutorial();assert.equal(calls.admin,0);assert.equal(calls.guides.length,1);
  c.guidedTutorial.skip();c.tutorial.isOpen=false;
  for(const phase of ['running','paused','finished']){c.game.phase=phase;c.openTutorial();assert.equal(calls.guides.length,1);}
  c.game.phase='ready';classes.add('hidden');c.openTutorial();assert.equal(calls.guides.length,1);
  classes.delete('hidden');c.settingsPanel.isOpen=true;c.openTutorial();assert.equal(calls.guides.length,1);
  c.settingsPanel.isOpen=false;
  const press=installKeyboard(c,calls);for(const code of ['ArrowLeft','ArrowLeft','ArrowRight','ArrowUp'])press(code);
  assert.equal(calls.admin,1,'the existing admin shortcut still works from the home screen');
});

test('saved tutorial completion prevents another automatic practice session on a later visit',()=>{
  const code=block('  if(!riderIdentity.tutorialComplete)openTutorial(false);','  let previous=performance.now()');
  const {context:c,calls}=fixture();vm.runInNewContext(code,c);assert.equal(calls.guides.length,1);
  c.completeTutorial('First Rider');vm.runInNewContext(code,c);assert.equal(calls.guides.length,1);
  const returning=fixture(c.localStorage);vm.runInNewContext(code,returning.context);
  assert.equal(returning.calls.guides.length,0);assert.equal(returning.calls.opens.length,0);
});

test('normal sessions still save scores and award the survival board after practice ends',()=>{
  const {context:c,saved}=fixture();c.game.start();c.game.score=500;c.game.elapsed=301;c.saveBest();
  assert.equal(saved.getItem('breakline99-best-storm'),'500');assert.equal(saved.getItem('breakline99-survival-time'),'301');
  assert.equal(c.checkSurvivalSecret(),true);assert.equal(c.secretProgress.deadtimeUnlocked,true);
  assert.equal(JSON.parse(saved.getItem(SECRET_STORAGE_KEY)).deadtimeUnlocked,true);
});

test('Full Reset removes the tutorial and rider name, preserves unrelated storage, and reloads',()=>{
  const saved=storage([['another-game','keep'],['breakline99-best-surf','300']]);saveRiderIdentity(saved,'Reset Rider');
  const {context:c,calls}=fixture(saved);c.fullReset();
  assert.equal(calls.reloads,1);assert.equal(saved.getItem(IDENTITY_KEY),null);
  assert.deepEqual([...saved.data],[['another-game','keep']]);assert.equal(loadRiderIdentity(saved).tutorialComplete,false);
});
