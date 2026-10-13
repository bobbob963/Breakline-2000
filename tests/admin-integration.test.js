import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SurfGame } from '../src/game.js';
import { WaveParkGame } from '../src/park.js';
import { SpecialMeter } from '../src/special.js';
import { validateProfile,OUTFITS,BOARD_DESIGNS } from '../src/appearance.js';
import { createTournamentGame,sanitizeTournamentProgress,nextTournamentLadder,selectTournamentLadder } from '../src/tournament.js';
import { createTimeTrialGame } from '../src/time-trials.js';
import { sanitizeTimeTrialProgress,timeTrialsUnlocked } from '../src/time-trial-progress.js';
import { getRewardBoard,rewardBoardUnlocked,ALL_REWARD_BOARD_ORDER } from '../src/board-rewards.js';
import { trialCosmeticUnlocked } from '../src/trial-cosmetics.js';
import { ADMIN_STORAGE_KEY,sanitizeAdminSettings,resolveAdminStats,updateAdminScope } from '../src/admin-settings.js';
import { everythingUnlocked,persistAdminEntries,resetBreaklineSave } from '../src/admin-save.js';
import { chooseSurfWeather,getSurfWeather } from '../src/surf-weather.js';
import { SECRET_STORAGE_KEY,sanitizeSecretProgress,awardSurvivalSecret } from '../src/secret-progress.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const noOp=()=>{};
function block(first,last){const start=source.indexOf(first),end=source.indexOf(last,start+first.length);assert.ok(start>=0&&end>start);return source.slice(start,end);}
function storage(initial=[]) {
  const data=new Map(initial);return {data,get length(){return data.size;},key:index=>[...data.keys()][index]??null,
    getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
function fixture() {
  const saved=storage(),calls={hud:0,mode:0,choices:0,reloads:0,clear:0,opened:0};
  const introClasses=new Set(),element={classList:{add:noOp,remove:noOp,toggle:noOp,contains:value=>introClasses.has(value)},focus:noOp};
  const context={
    SurfGame,WaveParkGame,createTournamentGame,createTimeTrialGame,nextTournamentLadder,selectTournamentLadder,
    ADMIN_STORAGE_KEY,sanitizeAdminSettings,resolveAdminStats,everythingUnlocked,persistAdminEntries,resetBreaklineSave,
    SECRET_STORAGE_KEY,sanitizeSecretProgress,awardSurvivalSecret,secretProgress:sanitizeSecretProgress(null),secretUnlockedThisRun:false,
    timePowerScreen:{reset:noOp,onEvent:noOp,update:noOp},
    validateProfile,rewardBoardUnlocked,OUTFITS,BOARD_DESIGNS,timeTrialsUnlocked,trialCosmeticUnlocked,
    profile:validateProfile(),adminSettings:sanitizeAdminSettings(null),lastSurfWeather:'sunset',chooseSurfWeather,getSurfWeather,
    tournamentProgress:sanitizeTournamentProgress(null),trialProgress:sanitizeTimeTrialProgress(null),
    selectedMode:'surf',selectedParkStart:'basin',localStorage:saved,
    window:{location:{reload:()=>calls.reloads++}},world:{setMode:noOp,setProfile:noOp,onEvent:noOp},
    audio:{enabled:false,setMode:noOp,setScene:noOp,event:noOp},preview:null,menuSurfer:null,
    loadBest:noOp,updateHud:()=>calls.hud++,updateModeMenu:()=>calls.mode++,updateCustomizationChoices:()=>calls.choices++,
    clearInput:()=>calls.clear++,bootReady:true,modalMode:null,workshopMode:null,
    adminPanel:{isOpen:false,open:()=>calls.opened++},$:()=>element,document:{body:element},
    special:new SpecialMeter(),toast:noOp,fmt:String,saveBest:noOp,showResults:noOp,
    isParkMode:()=>context.game.mode==='park',trialTime:String,
    wasted:{reset:noOp},closeWorkshop:noOp,closeModal:noOp,soundPreference:'off',updateSoundLabel:noOp,
    write:(key,value)=>saved.setItem(key,value),onEvent:noOp,
  };
  vm.runInNewContext(block('function applyPlayerSettings(', 'function syncInput('),context);
  vm.runInNewContext(block('function makeGame(', 'function updateModeMenu('),context);
  vm.runInNewContext(block('function startRun(', 'function goHome('),context);
  vm.runInNewContext(block('function cosmeticAvailable(', 'if(!cosmeticAvailable(OUTFITS'),context);
  vm.runInNewContext(block('function setProfile(', 'function openWorkshop('),context);
  context.makeGame();return {context,saved,calls,introClasses};
}
function customSettings(profile) {
  let settings=sanitizeAdminSettings({enabled:true});
  settings=updateAdminScope(settings,profile,'character',{jumpPower:1.7,specialGain:2,scoreMultiplier:2});
  return updateAdminScope(settings,profile,'board',{baseSpeed:1.5,boostPower:2,popRecovery:0});
}

test('actual Apply saves validated tuning before updating the selected rider and reports storage failure without partial state',()=>{
  const {context:c,saved,calls}=fixture(),custom=customSettings(c.profile);
  c.applyAdminSettings(custom);assert.equal(c.game.baseSpeedMultiplier,1.5);assert.equal(c.game.jumpPowerMultiplier,1.7);
  assert.equal(c.game.popRecoveryDuration,0);assert.equal(calls.hud,1);
  assert.deepEqual(JSON.parse(saved.getItem(ADMIN_STORAGE_KEY)),custom);
  const previous=c.adminSettings,previousSave=saved.getItem(ADMIN_STORAGE_KEY),set=saved.setItem;
  saved.setItem=(key,value)=>{if(key===ADMIN_STORAGE_KEY&&value!==previousSave)throw new Error('quota');set(key,value);};
  assert.throws(()=>c.applyAdminSettings(sanitizeAdminSettings(null)),/could not save/);
  assert.equal(c.adminSettings,previous);assert.equal(c.game.baseSpeedMultiplier,1.5);assert.equal(calls.hud,1);
  assert.equal(saved.getItem(ADMIN_STORAGE_KEY),previousSave);
});

test('actual constructors and retry actions apply custom settings in every session and isolate race opponents',()=>{
  for(const mode of ['surf','rush','storm','park','tournament','trials']) {
    const {context:c}=fixture();c.adminSettings=customSettings(c.profile);c.selectedMode=mode;
    if(mode==='trials')c.trialProgress=sanitizeTimeTrialProgress({version:1,completedTrials:5,selectedTrial:5});
    c.makeGame();assert.equal(c.game.baseSpeedMultiplier,1.5,mode);assert.equal(c.game.jumpPowerMultiplier,1.7);
    c.startRun();assert.equal(c.game.phase,'running');assert.equal(c.game.baseSpeedMultiplier,1.5);
    c.restartRun();assert.equal(c.game.baseSpeedMultiplier,1.5);assert.equal(c.game.popRecoveryDuration,0);
    if(c.game.opponent){assert.equal(c.game.opponent.baseSpeedMultiplier,1);assert.equal(c.game.opponent.characterStats,null);}
    c.adminPanel.isOpen=true;c.game.pause();c.startRun();assert.equal(c.game.phase,'paused','open admin panel cannot accidentally launch a run');
  }
});

test('next trial and next ladder replace the game without dropping customized equipment',()=>{
  for(const mode of ['tournament','trials']) {
    const {context:c}=fixture();c.adminSettings=customSettings(c.profile);c.selectedMode=mode;
    if(mode==='tournament')c.tournamentProgress=sanitizeTournamentProgress({version:2,ladderIndex:0,completedRounds:5,completedLadders:1});
    else c.trialProgress=sanitizeTimeTrialProgress({version:1,completedTrials:3,selectedTrial:3});
    c.makeGame();const previous=c.game;
    if(mode==='trials'){c.game.phase='finished';c.game.result='win';}
    c.startRun();assert.notEqual(c.game,previous);assert.equal(c.game.baseSpeedMultiplier,1.5);assert.equal(c.game.jumpPowerMultiplier,1.7);
    assert.equal(c.game.phase,'running');if(mode==='tournament')assert.equal(c.game.ladderIndex,1);
  }
});

test('character and board selections restore their own independent custom setups immediately',()=>{
  const {context:c}=fixture();c.giveEverything();
  c.adminSettings=customSettings(c.profile);
  c.adminSettings=updateAdminScope(c.adminSettings,{character:'reef',rewardBoard:'lightning'},'character',{jumpPower:2.2,specialGain:.5});
  c.adminSettings=updateAdminScope(c.adminSettings,{character:'reef',rewardBoard:'lightning'},'board',{baseSpeed:1.9,boostPower:2.5});
  c.applyPlayerSettings();const original={...c.profile};
  assert.ok(c.setProfile({character:'reef',rewardBoard:'lightning'}));assert.equal(c.game.jumpPowerMultiplier,2.2);assert.equal(c.game.baseSpeedMultiplier,1.9);
  assert.equal(c.game.rewardBoardDefinition.boostPowerMultiplier,2.5);assert.equal(c.game.rewardBoardDefinition.vfx,'graffiti');
  assert.ok(c.setProfile(original));assert.equal(c.game.jumpPowerMultiplier,1.7);assert.equal(c.game.baseSpeedMultiplier,1.5);
});

test('special charge uses the current character multiplier for actual trick and bank events while rejecting opponent events',()=>{
  const {context:c}=fixture();vm.runInNewContext(block('function onEvent(', 'function makeGame('),c);
  for(const gain of [0,.5,2]) {
    c.adminSettings=updateAdminScope(customSettings(c.profile),c.profile,'character',{specialGain:gain});c.applyPlayerSettings();c.special.reset();
    c.onEvent({type:'trick',opponent:true});c.onEvent({type:'bank',points:12000,opponent:true});assert.equal(c.special.value,0);
    c.onEvent({type:'trick'});assert.equal(c.special.value,.22*gain);
    c.onEvent({type:'bank',points:600});assert.equal(c.special.value,.27*gain);
  }
  c.adminSettings=sanitizeAdminSettings(null);c.applyPlayerSettings();c.special.reset();c.onEvent({type:'trick'});assert.equal(c.special.value,.22);
});

test('Give Me Everything opens every reward and course without inventing personal bests or erasing custom stats',()=>{
  const {context:c,saved,calls}=fixture();c.applyAdminSettings(customSettings(c.profile));
  c.trialProgress=sanitizeTimeTrialProgress({version:1,completedTrials:3,selectedTrial:2,bestTimes:[31,35,40]});
  saved.setItem('breakline99-best-surf','12000');const beforeProfile={...c.profile},beforeSettings=c.adminSettings;
  c.giveEverything();assert.equal(c.tournamentProgress.completedLadders,5);assert.equal(c.trialProgress.completedTrials,12);
  assert.ok(timeTrialsUnlocked(c.tournamentProgress));assert.equal(c.game.phase,'ready');assert.equal(c.game.baseSpeedMultiplier,1.5);
  for(const id of ALL_REWARD_BOARD_ORDER)assert.ok(rewardBoardUnlocked(id,c.tournamentProgress,c.trialProgress,c.secretProgress));
  for(const entry of [...Object.values(OUTFITS),...Object.values(BOARD_DESIGNS)])assert.ok(c.cosmeticAvailable(entry));
  assert.deepEqual(c.trialProgress.bestTimes.slice(0,3),[31,35,40]);assert.ok(c.trialProgress.bestTimes.slice(3).every(time=>time===null));
  assert.deepEqual(c.profile,beforeProfile);assert.equal(c.adminSettings,beforeSettings);assert.equal(saved.getItem('breakline99-best-surf'),'12000');
  assert.equal(JSON.parse(saved.getItem('breakline99-trials-v1')).completedTrials,12);assert.equal(calls.mode,1);assert.equal(calls.choices,1);
  assert.equal(c.secretProgress.deadtimeUnlocked,true);assert.equal(JSON.parse(saved.getItem(SECRET_STORAGE_KEY)).deadtimeUnlocked,true);
  assert.equal(saved.getItem('breakline99-survival-time'),null,'unlock-all does not fabricate a five-minute record');
  c.giveEverything();assert.deepEqual(c.trialProgress.bestTimes.slice(0,3),[31,35,40],'repeating unlock does not change earned times');
});

test('Apply persists the slow-motion cheat independently of stat tuning and passes it to each new session',()=>{
  const {context:c,saved}=fixture();
  c.applyAdminSettings(sanitizeAdminSettings({enabled:false,cheats:{slowMotion:true}}));
  assert.equal(c.game.timePowerEnabled,true);assert.equal(c.game.baseSpeedMultiplier,1);
  assert.equal(JSON.parse(saved.getItem(ADMIN_STORAGE_KEY)).cheats.slowMotion,true);
  c.startRun();assert.equal(c.game.toggleTimePower(),true);assert.equal(c.game.timePowerActive,true);
  c.selectedMode='park';c.makeGame();c.startRun();
  assert.equal(c.game.timePowerEnabled,true);assert.equal(c.game.toggleTimePower(),true);
  c.applyAdminSettings(sanitizeAdminSettings({enabled:false,cheats:{slowMotion:false}}));
  assert.equal(c.game.timePowerEnabled,false);assert.equal(c.game.timePowerActive,false);
  assert.equal(c.game.toggleTimePower(),false);
});

test('a failed secret-board unlock rolls back all three saved progress records',()=>{
  const {context:c,saved,calls}=fixture();
  const entries=[['breakline99-tournament-v2',c.tournamentProgress],['breakline99-trials-v1',c.trialProgress],[SECRET_STORAGE_KEY,c.secretProgress]];
  for(const [key,value] of entries)saved.setItem(key,JSON.stringify(value));
  saved.setItem('breakline99-survival-time','42');
  const before=[...saved.data],secrets=c.secretProgress,tournament=c.tournamentProgress,trials=c.trialProgress,set=saved.setItem;
  saved.setItem=(key,value)=>{if(key===SECRET_STORAGE_KEY&&JSON.parse(value).deadtimeUnlocked)throw new Error('quota');set(key,value);};
  assert.throws(()=>c.giveEverything(),/could not save/);
  assert.deepEqual([...saved.data],before);assert.equal(c.secretProgress,secrets);
  assert.equal(c.tournamentProgress,tournament);assert.equal(c.trialProgress,trials);assert.equal(calls.mode,0);
});

test('a failed multi-save unlock keeps both live progression and stored progression unchanged',()=>{
  const {context:c,saved,calls}=fixture();
  saved.setItem('breakline99-tournament-v2',JSON.stringify(c.tournamentProgress));saved.setItem('breakline99-trials-v1',JSON.stringify(c.trialProgress));
  const beforeTournament=c.tournamentProgress,beforeTrials=c.trialProgress,beforeGame=c.game;
  const trialSave=saved.getItem('breakline99-trials-v1'),set=saved.setItem;
  saved.setItem=(key,value)=>{if(key==='breakline99-trials-v1'&&value!==trialSave)throw new Error('quota');set(key,value);};
  assert.throws(()=>c.giveEverything(),/could not save/);assert.equal(c.tournamentProgress,beforeTournament);assert.equal(c.trialProgress,beforeTrials);
  assert.equal(c.game,beforeGame);assert.equal(calls.mode,0);assert.equal(calls.choices,0);
  assert.equal(JSON.parse(saved.getItem('breakline99-tournament-v2')).completedLadders,0);
});

test('the secret panel opens only on the visible ready home screen, never in a workshop or active session',()=>{
  const {context:c,introClasses,calls}=fixture();assert.equal(c.adminHomeScreen(),true);c.openAdmin();assert.equal(calls.opened,1);
  for(const phase of ['running','paused','finished']){c.game.phase=phase;c.openAdmin();assert.equal(calls.opened,1);}
  c.game.phase='ready';c.workshopMode='board';c.openAdmin();assert.equal(calls.opened,1);c.workshopMode=null;
  c.modalMode='ladder';c.openAdmin();assert.equal(calls.opened,1);c.modalMode=null;
  introClasses.add('hidden');c.openAdmin();assert.equal(calls.opened,1);introClasses.clear();
  c.bootReady=false;c.openAdmin();assert.equal(calls.opened,1);c.bootReady=true;c.openAdmin();assert.equal(calls.opened,2);
});

test('actual Full Reset removes only Breakline save data and reloads only after successful deletion',()=>{
  const {context:c,saved,calls}=fixture();c.applyAdminSettings(customSettings(c.profile));c.giveEverything();
  saved.setItem('breakline99-best-surf','20000');saved.setItem('breakline99-profile',JSON.stringify(c.profile));saved.setItem('another-game','keep');
  c.fullReset();assert.equal(calls.reloads,1);assert.deepEqual([...saved.data],[['another-game','keep']]);
  const failure=fixture();failure.saved.setItem('breakline99-best-surf','9');failure.saved.removeItem=()=>{throw new Error('blocked');};
  assert.throws(()=>failure.context.fullReset(),/could not reset/);assert.equal(failure.calls.reloads,0);assert.equal(failure.saved.getItem('breakline99-best-surf'),'9');
});
