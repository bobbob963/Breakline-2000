import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createKeydownHandler, CONTROL_KEYS } from '../src/keyboard.js';
import { WaveParkGame } from '../src/park.js';
import { SurfGame, TRICKS, waveCrest, waveHeight } from '../src/game.js';
import { createTournamentGame, sanitizeTournamentProgress, TOURNAMENT_RIVALS,nextTournamentLadder,selectTournamentLadder } from '../src/tournament.js';
import { getRewardBoard } from '../src/board-rewards.js';
import { surfRaceTrickInput } from '../src/surf-race.js';
import { sanitizeAdminSettings,resolveAdminStats } from '../src/admin-settings.js';

function inputRoute(game) {
  const calls = [], state = { bootReady:true, workshopMode:null, modalMode:null, game, input:{} };
  let wardrobeOpen = false;
  const actions = Object.fromEntries(['toggleSound','closeWorkshop','cycleCharacter','closeModal','startRun','pause','toast','rotatePreview'].map(name => [name, (...args) => calls.push([name,...args])]));
  actions.isWardrobeOpen = () => wardrobeOpen;
  actions.hideWardrobe = () => { wardrobeOpen = false; calls.push(['hideWardrobe']); };
  actions.pressControl = code => { state.input[CONTROL_KEYS[code]] = true; calls.push(['pressControl',code]); };
  // The real game remains responsible for airborne, busy and bail eligibility.
  actions.tryTrick = type => { calls.push(['tryTrick',type]); return game.doTrick(type); };
  const handler = createKeydownHandler(() => state, actions);
  return { state, calls, wardrobe:()=>{wardrobeOpen=true;},
    press(code, repeat=false, target) { const event={code,repeat,target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};handler(event);return event; } };
}
function naturalParkLaunch() {
  const events=[],game=new WaveParkGame(event=>events.push(event));game.start('filters');
  for(let i=0;i<800&&!game.airborne;i++)game.update(1/120,{pump:true});
  assert.equal(game.airborne,true);assert.ok(game.visitedRamps.has('west-pipe-north'));
  return {game,events};
}

test('production B-key route starts and completes Tweaked Grab after a Waterworks ramp launch',()=>{
  const {game,events}=naturalParkLaunch(),route=inputRoute(game);
  assert.equal(route.press('KeyB').defaultPrevented,true);
  assert.equal(game.trick?.type,'tweak');assert.equal(game.trick.duration,TRICKS.tweak.duration);
  assert.deepEqual(route.calls,[['tryTrick','tweak']]);
  for(let i=0;i<200&&game.trick;i++)game.update(1/120);
  assert.equal(game.trick,null);assert.equal(game.wipeouts,0);
  assert.ok(game.comboNames.includes('TWEAKED GRAB'));
  assert.equal(events.filter(event=>event.type==='trickStart'&&event.trick==='tweak').length,1);
  assert.equal(events.filter(event=>event.type==='trick'&&event.name==='TWEAKED GRAB').length,1);
});

test('B uses the same aerial route in every ocean mode',()=>{
  for(const mode of ['surf','rush','storm']) {
    const game=new SurfGame(()=>{},mode);game.start();game.x=waveCrest(0,0);game.y=waveHeight(game.x,0,0);game.charge=1;assert.ok(game.jump());
    inputRoute(game).press('KeyB');assert.equal(game.trick?.type,'tweak',mode);
  }
});

test('grounded, busy and recovering Waterworks riders still cannot start a second or illegal trick',()=>{
  const grounded=new WaveParkGame();grounded.start('filters');
  inputRoute(grounded).press('KeyB');assert.equal(grounded.trick,null);
  const {game}=naturalParkLaunch();assert.ok(game.doTrick('flip'));
  const active=game.trick;inputRoute(game).press('KeyB');assert.equal(game.trick,active);
  game.bail();inputRoute(game).press('KeyB');assert.equal(game.trick,null);assert.ok(game.bailTime>0);
});

test('boot, modal, phase and key-repeat guards block B before dispatching a trick',()=>{
  for(const blocked of ['boot','modal','paused','finished','ready','repeat']) {
    const {game}=naturalParkLaunch(),route=inputRoute(game);
    if(blocked==='boot')route.state.bootReady=false;
    if(blocked==='modal')route.state.modalMode='help';
    if(['paused','finished','ready'].includes(blocked))game.phase=blocked;
    route.press('KeyB',blocked==='repeat');
    assert.equal(game.trick,null,blocked);assert.deepEqual(route.calls,[],blocked);
  }
});

test('B retains its workshop-back function instead of reaching gameplay',()=>{
  for(const mode of ['character','board']) {
    const {game}=naturalParkLaunch(),route=inputRoute(game);route.state.workshopMode=mode;
    route.press('KeyB');assert.deepEqual(route.calls,[['closeWorkshop']]);assert.equal(game.trick,null);
  }
});

test('focused workshop buttons keep native Enter and Space without closing or steering',()=>{
  for(const mode of ['character','board']){
    const game=new WaveParkGame();game.start();const route=inputRoute(game);route.state.workshopMode=mode;route.wardrobe();
    const button={closest:selector=>selector==='button'?button:null};
    for(const code of ['Enter','Space'])for(const repeat of [false,true]){
      assert.equal(route.press(code,repeat,button).defaultPrevented,false,`${mode}: ${code} repeat=${repeat}`);
      assert.deepEqual(route.calls,[]);assert.deepEqual(route.state.input,{});
    }
    route.press('Escape',false,button);assert.deepEqual(route.calls,[['hideWardrobe']]);
    route.press('Escape',false,button);assert.deepEqual(route.calls,[['hideWardrobe'],['closeWorkshop']]);
  }
});

test('workshop background retains Enter accept and A/B back shortcuts',()=>{
  for(const code of ['Enter','KeyA','KeyB']){
    const game=new WaveParkGame();game.start();const route=inputRoute(game);route.state.workshopMode='character';
    const background={closest:()=>null};
    assert.equal(route.press(code,false,background).defaultPrevented,true);
    assert.deepEqual(route.calls,[['closeWorkshop']]);assert.deepEqual(route.state.input,{});
  }
});

test('the shared router preserves movement, session shortcuts and workshop focus',()=>{
  const game=new WaveParkGame();game.start();const route=inputRoute(game);
  route.press('KeyA');route.press('ShiftLeft');assert.deepEqual(route.state.input,{left:true,grind:true});
  route.press('KeyP');route.press('KeyR');route.press('KeyM');
  assert.deepEqual(route.calls.slice(2),[['pause'],['startRun'],['toggleSound']]);
  route.calls.length=0;route.state.workshopMode='character';route.wardrobe();
  route.press('Escape');route.press('ArrowLeft');route.press('KeyX');route.press('KeyC');
  assert.deepEqual(route.calls,[['hideWardrobe'],['cycleCharacter',-1],['rotatePreview',-.5],['rotatePreview',.5]]);
  route.calls.length=0;route.state.workshopMode=null;route.state.modalMode='help';route.press('Enter');
  assert.deepEqual(route.calls,[['closeModal']]);route.calls.length=0;route.state.modalMode='results';route.press('Enter');
  assert.deepEqual(route.calls,[['startRun']]);
  route.calls.length=0;route.state.modalMode='trials';route.press('Enter');
  assert.deepEqual(route.calls,[['startRun']], 'Enter starts a selected solo trial as it does a ladder');
});

// Execute the application's real session actions as well as its shared keyboard
// router. UI/audio are inert fixtures; round selection is never reimplemented.
function tournamentRoute(progress={version:1,completedRounds:0}) {
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const first=source.indexOf("function startRun("),last=source.indexOf('function goHome()',first);
  assert.ok(first>=0&&last>first,'the production session actions exist');
  const noOp=()=>{},saved=[],calls=[];
  const element={classList:{add:noOp,remove:noOp},focus:noOp};
  const context={
    adminSettings:sanitizeAdminSettings(null),resolveAdminStats,adminPanel:null,tutorial:null,settingsPanel:{isOpen:false},
    game:null,tournamentProgress:sanitizeTournamentProgress(progress),createTournamentGame,sanitizeTournamentProgress,
    nextTournamentLadder,selectTournamentLadder,profile:{rewardBoard:null},
    selectedMode:'tournament',selectedParkStart:'filters',modalMode:null,workshopMode:null,bootReady:true,input:{},
    soundPreference:'off',audio:{enabled:true,setScene:noOp,setMode:noOp,setRideContext:noOp},world:{setMode:noOp},special:{reset:noOp},wasted:{reset:noOp},timePowerScreen:{reset:noOp},
    closeWorkshop:noOp,closeModal(){context.modalMode=null;},clearInput:noOp,updateModeMenu:noOp,updateSoundLabel:noOp,
    document:{body:element},$:()=>element,write:(key,value)=>saved.push([key,JSON.parse(value)]),
    onEvent(event){if(event.type==='finish'){context.tournamentProgress=context.game.getProgress();context.modalMode='results';}},
  };
  context.game=createTournamentGame(context.onEvent,context.tournamentProgress);
  vm.runInNewContext(source.slice(source.indexOf('function applyPlayerSettings('),source.indexOf('function adminHomeScreen(')),context);
  vm.runInNewContext(source.slice(first,last),context);
  const handler=createKeydownHandler(()=>context,{
    startRun(){calls.push('startRun');context.startRun();},
    restartRun(){calls.push('restartRun');context.restartRun();},
    closeModal(){calls.push('closeModal');context.closeModal();},
  });
  return {context,saved,calls,press(code){handler({code,repeat:false,preventDefault:noOp});}};
}
function finishTournament(route,difference=1) {
  const game=route.context.game;
  assert.equal(game.finish(difference>0?'win':'loss',difference===0?'PHOTO FINISH - RIVAL HOLDS RANK':undefined),true);
  assert.equal(route.context.modalMode,'results');
}

test('Enter from the ladder starts its selected rival through the real application action',()=>{
  const route=tournamentRoute({version:1,completedRounds:2});route.context.modalMode='ladder';
  assert.equal(route.context.game.phase,'ready');route.press('Enter');
  assert.deepEqual(route.calls,['startRun']);assert.equal(route.context.modalMode,null);
  assert.equal(route.context.game.phase,'running');assert.equal(route.context.game.roundIndex,2);
  assert.equal(route.context.game.rival.name,'UNDERTOW');assert.equal(route.context.game.time,0);assert.equal(route.context.game.countdownRemaining,3);
});

test('R retries the winning heat while Enter results advances to the next rival',()=>{
  for(const code of ['KeyR','Enter']) {
    const route=tournamentRoute();route.press('Enter');finishTournament(route);route.calls.length=0;
    const game=route.context.game;assert.equal(game.roundIndex,0);assert.equal(game.result,'win');route.press(code);
    assert.deepEqual(route.calls,[code==='KeyR'?'restartRun':'startRun']);
    const next=route.context.game;
    if(code==='KeyR')assert.equal(next,game);else assert.notEqual(next,game);
    assert.equal(next.phase,'running');assert.equal(next.score,0);
    assert.equal(next.roundIndex,code==='KeyR'?0:1);assert.equal(next.mode,code==='KeyR'?'park':'surf');
    assert.equal(next.time,0);assert.equal(next.countdownRemaining,3);assert.equal(next.result,null);
    assert.equal(next.getProgress().completedRounds,1);
  }
});

test('Enter retries a lost or tied rival rather than advancing the ladder',()=>{
  for(const difference of [-1,0]) {
    const route=tournamentRoute({version:1,completedRounds:2});route.press('Enter');finishTournament(route,difference);
    assert.equal(route.context.game.result,'loss');route.press('Enter');
    assert.equal(route.context.game.roundIndex,2);assert.equal(route.context.game.phase,'running');
    assert.equal(route.context.game.score,0);assert.equal(route.context.game.getProgress().completedRounds,2);
  }
});

test('Enter after a championship starts the next ladder and preserves the earned board',()=>{
  const route=tournamentRoute({version:1,completedRounds:4});route.press('Enter');finishTournament(route);
  const champion=route.context.game;assert.equal(champion.complete,true);route.press('Enter');
  assert.notEqual(route.context.game,champion);assert.equal(route.context.game.roundIndex,0);
  assert.equal(route.context.game.complete,false);assert.equal(route.context.game.phase,'running');
  assert.equal(route.context.game.ladderIndex,1);
  assert.deepEqual(route.saved.at(-1),['breakline99-tournament-v2',{version:2,ladderIndex:1,completedRounds:0,completedLadders:1}]);
});

test('Enter through all five ladders unlocks every board and final replay keeps the complete collection',()=>{
  const route=tournamentRoute();route.press('Enter');
  const rewards=[];
  for(let ladder=0;ladder<5;ladder++)for(let rank=0;rank<5;rank++) {
    const game=route.context.game;assert.equal(game.ladderIndex,ladder);assert.equal(game.roundIndex,rank);
    finishTournament(route);if(game.unlockedBoardId)rewards.push(game.unlockedBoardId);
    route.press('Enter');
  }
  assert.deepEqual(rewards,['guitar','lightning','vortex','solar','sky']);
  assert.equal(route.context.game.ladderIndex,4);assert.equal(route.context.game.roundIndex,0);
  assert.equal(route.context.game.allLaddersComplete,true);assert.equal(route.context.game.complete,false);
  assert.deepEqual(route.saved.at(-1),['breakline99-tournament-v2',{version:2,ladderIndex:4,completedRounds:0,completedLadders:5}]);
});

test('losing an R-key championship replay makes Enter retry that rival without erasing the title',()=>{
  const route=tournamentRoute({version:1,completedRounds:4});route.press('Enter');finishTournament(route);
  route.press('KeyR');assert.equal(route.context.game.roundIndex,4);assert.equal(route.context.game.complete,true);
  finishTournament(route,-1);const retry=route.context.game;route.press('Enter');
  assert.equal(route.context.game,retry);assert.equal(retry.roundIndex,4);assert.equal(retry.phase,'running');
  assert.equal(retry.complete,true);assert.equal(retry.score,0);assert.deepEqual(route.saved,[]);
});

test('winning either ocean race advances the real Enter action back to the correct Waterworks battle',()=>{
  for(const round of[1,3]){
    const route=tournamentRoute({version:1,completedRounds:round});route.press('Enter');
    const race=route.context.game;
    for(let i=0;i<120*80&&race.phase==='running';i++)race.update(1/120,surfRaceTrickInput(race,race.course,1));
    assert.equal(race.result,'win');assert.equal(route.context.modalMode,'results');
    route.press('Enter');const next=route.context.game;
    assert.notEqual(next,race);assert.equal(next.mode,'park');assert.equal(next.roundIndex,round+1);
    assert.equal(next.time,0);assert.equal(next.countdownRemaining,3);assert.equal(next.phase,'running');assert.equal(next.result,null);
  }
});

test('R after a race win and Enter after a race loss both restart that race with a fresh opponent',()=>{
  for(const win of[true,false]){
    const route=tournamentRoute({version:1,completedRounds:1});route.press('Enter');
    const race=route.context.game,opponent=race.opponent;
    for(let i=0;i<120*80&&race.phase==='running';i++)race.update(1/120,win?surfRaceTrickInput(race,race.course,1):{brake:true});
    assert.equal(race.result,win?'win':'loss');route.press(win?'KeyR':'Enter');
    assert.equal(route.context.game,race);assert.equal(race.roundIndex,1);assert.equal(race.countdownRemaining,3);
    assert.notEqual(race.opponent,opponent);assert.equal(race.opponent.distance,0);assert.equal(race.result,null);
  }
});

test('production race results handle every venue and the final championship without an undefined next rival',()=>{
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const first=source.indexOf('function showTournamentResults()'),last=source.indexOf('function renderCustomizationChoices()',first);
  for(let round=0;round<5;round++)for(const win of[false,true]){
    const game=createTournamentGame(()=>{},{version:1,completedRounds:round});game.start();game.finish(win?'win':'loss');
    let modal;
    const context={game,TOURNAMENT_RIVALS,tournamentProgress:game.getProgress(),clearInput(){},isParkMode:()=>game.mode==='park',
      getRewardBoard,nextTournamentLadder,profile:{rewardBoard:null},rewardCard:()=>'<div>PRIZE BOARD</div>',
      fmt:n=>Math.round(n).toString(),clockText:n=>n.toFixed(1),openModal:(...args)=>{modal=args;}};
    vm.runInNewContext(source.slice(first,last),context);context.showTournamentResults();
    assert.equal(modal[0],'results');assert.equal(modal[3],win?(round===4?'NEXT LADDER':'NEXT RIVAL'):'RETRY RIVAL');
    assert.match(modal[2],game.mode==='park'?/WATERWORKS RACE/:/SURF RACE/);
    assert.doesNotMatch(modal[2],/undefined|NaN|BANKED SCORE/);
    if(round===4&&win)assert.match(modal[2],/ALL FIVE RIVALS DEFEATED/);
  }
});
