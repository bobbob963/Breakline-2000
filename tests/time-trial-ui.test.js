import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { validateProfile, OUTFITS, BOARD_DESIGNS } from '../src/appearance.js';
import { rewardBoardUnlocked,getRewardBoard,TRIAL_REWARD_BOARD_ORDER } from '../src/board-rewards.js';
import { sanitizeTournamentProgress,selectTournamentLadder } from '../src/tournament-progress.js';
import { sanitizeTimeTrialProgress,timeTrialsUnlocked,recordTimeTrialWin,selectTimeTrial,TIME_TRIALS } from '../src/time-trial-progress.js';
import { getTrialCosmeticSet,trialCosmeticUnlocked } from '../src/trial-cosmetics.js';
import { createTimeTrialGame } from '../src/time-trials.js';
import { trialTime,trialListMarkup,trialRewardCards } from '../src/time-trial-ui.js';
import { ADMIN_STORAGE_KEY,sanitizeAdminSettings,resolveAdminStats } from '../src/admin-settings.js';
import { SECRET_STORAGE_KEY,sanitizeSecretProgress } from '../src/secret-progress.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),noop=()=>{};
function block(first,last){const a=source.indexOf(first),b=source.indexOf(last,a+first.length);assert.ok(a>=0&&b>a,`production block ${first} exists`);return source.slice(a,b);}
function progress(n){return sanitizeTimeTrialProgress({version:1,completedTrials:n,selectedTrial:Math.min(n,11),bestTimes:TIME_TRIALS.map((t,i)=>i<n?t.timeLimit-5:null)});}
function tournament(n){return sanitizeTournamentProgress({version:2,ladderIndex:Math.min(n,4),completedRounds:0,completedLadders:n});}
const dependencies={SECRET_STORAGE_KEY,sanitizeSecretProgress,ADMIN_STORAGE_KEY,sanitizeAdminSettings,resolveAdminStats,validateProfile,OUTFITS,BOARD_DESIGNS,rewardBoardUnlocked,getRewardBoard,TRIAL_REWARD_BOARD_ORDER,sanitizeTournamentProgress,sanitizeTimeTrialProgress,timeTrialsUnlocked,getTrialCosmeticSet,trialCosmeticUnlocked};

test('real boot restoration gates Time Trials behind all five ladders and strips only locked cosmetics',()=>{
  for(const scenario of [
    {ladders:4,clears:12,mode:'tournament',outfit:'riptide',boardDesign:'bolt'},
    {ladders:5,clears:2,mode:'trials',outfit:'riptide',boardDesign:'bolt'},
    {ladders:5,clears:3,mode:'trials',outfit:'afterhours',boardDesign:'afterhours'},
  ]){
    const saved=new Map([['breakline99-mode','trials'],['breakline99-profile',JSON.stringify({character:'nova',outfit:'afterhours',boardDesign:'afterhours',boardColor:'#8755bb'})],['breakline99-trials-v1',JSON.stringify(progress(scenario.clears))],['breakline99-tournament-v2',JSON.stringify(tournament(scenario.ladders))]]);
    const context={...dependencies,read:(key,fallback)=>saved.get(key)??fallback};
    vm.runInNewContext(`${block('let profile;try','const isParkMode=')}\nglobalThis.restored={profile,selectedMode,trialProgress};`,context);
    assert.equal(context.restored.selectedMode,scenario.mode);assert.equal(context.restored.profile.outfit,scenario.outfit);assert.equal(context.restored.profile.boardDesign,scenario.boardDesign);
    assert.equal(context.restored.profile.character,'nova');assert.equal(context.restored.profile.boardColor,'#8755bb');
    assert.equal(context.restored.trialProgress.completedTrials,scenario.clears);
  }
});

test('actual mode selection cannot enter locked trials and ladder resets keep the championship unlock',()=>{
  const writes=[],context={...dependencies,selectedMode:'surf',modeInfo:{surf:{},trials:{}},tournamentProgress:tournament(4),write:(...args)=>writes.push(args),clearInput:noop,makeGame:noop,updateModeMenu:noop,updateSoundLabel:noop};
  vm.runInNewContext(block('function selectMode(','function updateSoundLabel('),context);
  context.selectMode('trials');assert.equal(context.selectedMode,'surf');assert.equal(writes.length,0);
  context.tournamentProgress=selectTournamentLadder(tournament(5),0);
  context.selectMode('trials');assert.equal(context.selectedMode,'trials');assert.deepEqual(writes,[['breakline99-mode','trials']]);
});

function equipmentFixture(clears=0){
  const writes=[],renders=[],context={...dependencies,profile:validateProfile({character:'jax',outfit:'yardcrew',rewardBoard:'sky'}),tournamentProgress:tournament(5),trialProgress:progress(clears),
    adminSettings:sanitizeAdminSettings(null),adminPanel:null,selectedMode:'trials',secretProgress:sanitizeSecretProgress(null),secretUnlockedThisRun:false,timePowerScreen:{reset:noop,onEvent:noop,update:noop},
    game:createTimeTrialGame(),write:(key,value)=>writes.push([key,JSON.parse(value)]),world:{setProfile:value=>renders.push(value),onEvent:noop},preview:{setProfile:noop},menuSurfer:{setProfile:noop},updateCustomizationChoices:noop,modalMode:null};
  vm.runInNewContext(block('function applyPlayerSettings(','function adminHomeScreen('),context);
  vm.runInNewContext(block('function cosmeticAvailable(','if(!cosmeticAvailable(OUTFITS'),context);
  vm.runInNewContext(block('function setProfile(','function openWorkshop('),context);
  vm.runInNewContext(block('function equipTrialSet(','const rewardIcons='),context);
  vm.runInNewContext(block('const rewardIcons=','function ladderRows('),context);
  return {context,writes,renders};
}

test('actual equipment actions reject locked sets atomically and save earned clothes/deck graphics',()=>{
  const {context,writes,renders}=equipmentFixture(2),original={...context.profile};
  assert.equal(context.setProfile({outfit:'afterhours'}),false);assert.equal(context.setProfile({boardDesign:'afterhours',rewardBoard:null}),false);
  assert.equal(context.equipTrialSet('afterhours'),false);assert.equal(writes.length,0);assert.equal(renders.length,0);assert.deepEqual(context.profile,original);
  context.trialProgress=progress(3);assert.equal(context.equipTrialSet('afterhours'),true);
  assert.equal(context.profile.outfit,'afterhours');assert.equal(context.profile.boardDesign,'afterhours');assert.equal(context.profile.character,'jax');assert.equal(context.profile.rewardBoard,null);
  assert.equal(writes.at(-1)[0],'breakline99-profile');assert.deepEqual(writes.at(-1)[1],context.profile);assert.equal(renders.length,1);
  assert.equal(context.equipTrialSet('ripcurrent'),false);assert.equal(context.profile.outfit,'afterhours');
  context.trialProgress=progress(12);assert.equal(context.equipTrialSet('chronocrew'),true);
  context.tournamentProgress=tournament(4);assert.equal(context.equipTrialSet('afterhours'),false,'a corrupt trial save cannot bypass the championship gate');
});

test('actual finish handler persists the third clear before refreshing unlocks or presenting equipment',()=>{
  const {context,writes}=equipmentFixture(2),sequence=[];
  const earned=recordTimeTrialWin(context.trialProgress,2,TIME_TRIALS[2].timeLimit-1);
  Object.assign(context,{selectedMode:'trials',audio:{event:noop},saveBest:()=>sequence.push('best'),updateCustomizationChoices:()=>{assert.equal(context.trialProgress.completedTrials,3);sequence.push('unlock');},showResults:()=>{assert.equal(writes.at(-1)[0],'breakline99-trials-v1');sequence.push('results');}});
  context.game={isTimeTrial:true,getProgress:()=>earned};
  vm.runInNewContext(block('function onEvent(','function makeGame('),context);
  context.onEvent({type:'finish',timeTrial:true,result:'win'});
  assert.deepEqual(writes.at(-1),['breakline99-trials-v1',earned]);assert.deepEqual(sequence,['best','unlock','results']);
  context.game=createTimeTrialGame();assert.equal(context.equipTrialSet('afterhours'),true);
});

test('trial menu exposes only unlocked courses, replay, personal bests and earned set controls',()=>{
  const markup=trialListMarkup(progress(3));
  const buttons=[...markup.matchAll(/<button type="button" data-trial="(\d+)"([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length,12);
  for(const [,index,attributes,content]of buttons){
    const n=Number(index);assert.equal(attributes.includes('disabled'),n>3);
    if(n<3){assert.match(content,/REPLAY/);assert.match(content,/BEST \d+:\d{2}\.\d{2}/);}
    if(n===3){assert.match(content,/SELECTED/);assert.match(content,/READY TO RIDE/);}
    if(n>3)assert.match(content,/CLEAR PREVIOUS TRIAL/);
  }
  assert.match(markup,/data-trial-equip="afterhours"/);assert.doesNotMatch(markup,/data-trial-equip="ripcurrent"/);
  assert.match(markup,/AFTERBURNER/);assert.match(markup,/data-reward-board="afterburner"/);
  const lockedReward=trialRewardCards(progress(2),{equip:true});
  assert.match(lockedReward,/AFTERBURNER/);assert.doesNotMatch(lockedReward,/data-reward-board="afterburner"/);
  assert.equal((trialRewardCards(progress(12),{equip:true}).match(/data-trial-equip=/g)||[]).length,4);
  assert.equal(trialTime(59.999),'1:00.00');assert.equal(trialTime(null),'—');
  assert.equal(selectTimeTrial(progress(3),4),null);assert.equal(selectTimeTrial(progress(3),0).completedTrials,3);
});

test('replaying a cleared trial improves the saved time without issuing a third-clear reward',()=>{
  const {context,writes}=equipmentFixture(2),modals=[];
  context.game=createTimeTrialGame(noop,selectTimeTrial(context.trialProgress,0));context.game.start();
  Object.assign(context,{selectedMode:'trials',audio:{event:noop},saveBest:noop,clearInput:noop,trialTime,openModal:(...args)=>modals.push(args)});
  vm.runInNewContext(block('function showTrialResults(','function equipTrialSet('),context);
  context.showResults=()=>context.showTrialResults();
  vm.runInNewContext(block('function onEvent(','function makeGame('),context);
  context.game.onEvent=context.onEvent;
  // Simulate only the finish event boundary here; actual ring crossing and
  // route feasibility are exercised by the time-trial simulation tests.
  context.game.finishTime=TIME_TRIALS[0].timeLimit-10;
  context.game.nextCheckpoint=context.game.course.checkpoints.length;
  context.game.finish('win');
  assert.equal(context.trialProgress.completedTrials,2);assert.equal(context.trialProgress.bestTimes[0],TIME_TRIALS[0].timeLimit-10);
  assert.equal(context.game.unlockedSet,null);assert.equal(context.equipTrialSet('afterhours'),false);
  assert.equal(rewardBoardUnlocked('afterburner',context.tournamentProgress,context.trialProgress),false);
  assert.equal(writes.at(-1)[0],'breakline99-trials-v1');assert.equal(writes.at(-1)[1].completedTrials,2);
  assert.doesNotMatch(modals.at(-1)[2],/NEW SET|data-trial-equip=|data-reward-board="afterburner"/);
});

test('the third unique trial clear offers both the existing cosmetic set and an equippable Afterburner board',()=>{
  const {context,writes}=equipmentFixture(2),modals=[];
  Object.assign(context,{selectedMode:'trials',audio:{event:noop},saveBest:noop,clearInput:noop,toast:noop,trialTime,openModal:(...args)=>{context.modalMode=args[0];modals.push(args);}});
  vm.runInNewContext(block('function showTrialResults(','function equipTrialSet('),context);
  context.showResults=()=>context.showTrialResults();
  vm.runInNewContext(block('function onEvent(','function makeGame('),context);
  context.game=createTimeTrialGame(context.onEvent,context.trialProgress);context.game.start();
  // The route/finish crossing is tested with ordinary controls separately.
  // This boundary specifically verifies the persisted third-clear UI award.
  context.game.finishTime=TIME_TRIALS[2].timeLimit-1;
  context.game.nextCheckpoint=context.game.course.checkpoints.length;context.game.finish('win');
  assert.equal(context.trialProgress.completedTrials,3);
  assert.equal(writes.at(-1)[0],'breakline99-trials-v1');
  assert.match(modals.at(-1)[2],/data-trial-equip="afterhours"/);
  assert.match(modals.at(-1)[2],/data-reward-board="afterburner"/);
  assert.match(modals.at(-1)[2],/AFTERBURNER/);
  assert.equal(context.setProfile({rewardBoard:'afterburner'}),true);
  assert.equal(context.game.rewardBoard,'afterburner');
  context.showTrialResults();assert.match(modals.at(-1)[2],/data-reward-board="afterburner"[^>]*aria-pressed="true"/);
  assert.equal(writes.at(-1)[0],'breakline99-profile');
  assert.equal(context.equipTrialSet('afterhours'),true,'the original third-clear outfit and graphic remain available');
  assert.equal(context.profile.outfit,'afterhours');assert.equal(context.profile.boardDesign,'afterhours');
  assert.equal(context.setProfile({rewardBoard:'afterburner'}),true);
  context.tournamentProgress=selectTournamentLadder(context.tournamentProgress,0);
  assert.equal(rewardBoardUnlocked('afterburner',context.tournamentProgress,context.trialProgress),true);
  context.game=createTimeTrialGame(context.onEvent,selectTimeTrial(context.trialProgress,2));context.game.start();
  context.game.finishTime=TIME_TRIALS[2].timeLimit-2;context.game.nextCheckpoint=context.game.course.checkpoints.length;context.game.finish('win');
  assert.equal(context.trialProgress.completedTrials,3);assert.equal(context.game.unlockedSet,null);
  assert.doesNotMatch(modals.at(-1)[2],/NEW SET|data-reward-board="afterburner"/);
  assert.equal(context.profile.rewardBoard,'afterburner');
  assert.equal(rewardBoardUnlocked('afterburner',context.tournamentProgress,context.trialProgress),true);
});

test('the actual trial prize button equips Afterburner and refreshes the correct screen without a rival result',()=>{
  const {context,writes}=equipmentFixture(3),screens=[];
  let click;
  Object.assign(context,{$:()=>({addEventListener:(type,handler)=>{assert.equal(type,'click');click=handler;}}),showTrials:()=>screens.push('trials'),showTrialResults:()=>screens.push('trial-results'),showTournamentResults:()=>screens.push('rival-results')});
  vm.runInNewContext(block("$('modal-content').addEventListener(","$('modal-home').addEventListener("),context);
  const event=disabled=>({target:{closest:()=>({disabled,dataset:{rewardBoard:'afterburner'}})}});
  click(event(true));assert.equal(writes.length,0);assert.equal(screens.length,0);
  context.modalMode='results';click(event(false));
  assert.equal(context.profile.rewardBoard,'afterburner');assert.equal(context.game.rewardBoard,'afterburner');
  assert.deepEqual(screens,['trial-results']);assert.equal(writes.at(-1)[1].rewardBoard,'afterburner');
  context.modalMode='trials';click(event(false));assert.deepEqual(screens,['trial-results','trials']);
  context.trialProgress=progress(2);const saved=writes.length;click(event(false));
  assert.equal(writes.length,saved);assert.deepEqual(screens,['trial-results','trials']);
});

test('production start/next/retry keeps trial identity correct and preserves equipped board perks',()=>{
  const element={classList:{add:noop,remove:noop},focus:noop},context={...dependencies,createTimeTrialGame,game:createTimeTrialGame(noop,progress(2)),trialProgress:progress(2),profile:validateProfile({rewardBoard:'sky'}),
    adminSettings:sanitizeAdminSettings(null),adminPanel:null,selectedMode:'trials',secretProgress:sanitizeSecretProgress(null),secretUnlockedThisRun:false,timePowerScreen:{reset:noop,onEvent:noop,update:noop},
    wasted:{reset:noop},closeWorkshop:noop,closeModal:noop,clearInput:noop,special:{reset:noop},soundPreference:'off',audio:{enabled:false,setMode:noop,setRideContext:noop,setScene:noop},world:{setMode:noop},updateModeMenu:noop,updateSoundLabel:noop,onEvent:noop,$:()=>element,document:{body:element}};
  vm.runInNewContext(block('function applyPlayerSettings(','function adminHomeScreen('),context);
  vm.runInNewContext(block('function startRun(','function goHome('),context);
  context.startRun();assert.equal(context.game.trialIndex,2);assert.equal(context.game.phase,'running');assert.equal(context.game.rewardBoard,'sky');
  context.game.phase='finished';context.game.result='win';context.trialProgress=progress(3);
  context.restartRun();assert.equal(context.game.trialIndex,2,'retry repeats the just-completed trial');assert.equal(context.game.rewardBoard,'sky');
  context.game.phase='finished';context.game.result='win';context.startRun();assert.equal(context.game.trialIndex,3,'next selects the next unlocked trial');
  context.game.phase='finished';context.game.result='loss';context.startRun();assert.equal(context.game.trialIndex,3,'loss repeats instead of skipping ahead');
  assert.equal(context.game.rewardBoard,'sky');assert.equal(context.game.phase,'running');
});
