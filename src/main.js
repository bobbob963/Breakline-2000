import './style.css';
import './selection.css';
import './factory.css';
import './summer99.css';
import './survival.css';
import './classic-logo.css';
import './tournament.css';
import './wasted.css';
import './rewards.css';
import './menu-surfer.css';
import './time-trials.css';
import { createTimeTrialGame, TIME_TRIALS } from './time-trials.js';
import { sanitizeTimeTrialProgress, timeTrialsUnlocked, selectTimeTrial } from './time-trial-progress.js';
import { TRIAL_COSMETIC_SETS, getTrialCosmeticSet, trialCosmeticUnlocked } from './trial-cosmetics.js';
import { trialTime, trialListMarkup, trialRewardCards } from './time-trial-ui.js';
import { createTournamentGame, TOURNAMENT_RIVALS, TOURNAMENT_LADDERS, sanitizeTournamentProgress, tournamentCourseLength, tournamentRivalsForLadder, selectTournamentLadder, nextTournamentLadder } from './tournament.js';
import { ALL_REWARD_BOARD_ORDER, TRIAL_REWARD_BOARD_ORDER, getRewardBoard, rewardBoardUnlocked } from './board-rewards.js';
import { createWastedSequence } from './wasted.js';
import { createClassicLogoCanvas } from './classic-logo.js';
import { brandLogo } from './brand-art.js';
import { SurfGame, MIN_X, MAX_X, waveCrest } from './game.js';
import { WaveParkGame, PARK_BOUNDS } from './park.js';
import { SpecialMeter } from './special.js';
import { COMBO_ANIMATIONS } from './combo-animations.js';
import { ParkMap } from './park-map.js';
import { SurfWorld } from './world.js';
import { ArcadeAudio } from './audio.js';
import { CHARACTERS, OUTFITS, BOARD_DESIGNS, validateProfile, CustomizationPreview } from './appearance.js';
import { MenuSurferPreview } from './menu-surfer.js';
import { loadCharacterTextures } from './character-textures.js';
import { createLoadingScreen, paintLoadingStage } from './loading-screen.js';
import { CONTROL_KEYS as keyMap, createKeydownHandler } from './keyboard.js';
import { createAdminPanel } from './admin-panel.js';
import { ADMIN_STORAGE_KEY, sanitizeAdminSettings, resolveAdminStats } from './admin-settings.js';
import { everythingUnlocked, persistAdminEntries, resetBreaklineSave } from './admin-save.js';
import { chooseSurfWeather, getSurfWeather } from './surf-weather.js';

const $=id=>document.getElementById(id);
const loading=createLoadingScreen();
let bootReady=false;
loading.set(15,'PREPARING THE CREW','Loading the original rider textures.');
const fmt=n=>Math.round(n).toLocaleString('en-US');
const pad=n=>Math.round(n).toString().padStart(6,'0');
const clockText=n=>{const seconds=Math.max(0,Math.floor(Number.isFinite(n)?n:0));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* Storage is optional. */}};
let profile;try{profile=validateProfile(JSON.parse(read('breakline99-profile','{}')));}catch{profile=validateProfile();}
let adminSettings;try{adminSettings=sanitizeAdminSettings(JSON.parse(read(ADMIN_STORAGE_KEY,'null')));}catch{adminSettings=sanitizeAdminSettings(null);}
let lastSurfWeather=read('breakline99-weather','');
let selectedMode=read('breakline99-mode','surf');
if(!['surf','park','rush','storm','tournament','trials'].includes(selectedMode))selectedMode='surf';
let tournamentProgress;try{tournamentProgress=sanitizeTournamentProgress(JSON.parse(read('breakline99-tournament-v2',read('breakline99-tournament-v1','null'))));}catch{tournamentProgress=sanitizeTournamentProgress(null);}
let trialProgress;try{trialProgress=sanitizeTimeTrialProgress(JSON.parse(read('breakline99-trials-v1','null')));}catch{trialProgress=sanitizeTimeTrialProgress(null);}
if(!rewardBoardUnlocked(profile.rewardBoard,tournamentProgress,trialProgress))profile.rewardBoard=null;
if(selectedMode==='trials'&&!timeTrialsUnlocked(tournamentProgress))selectedMode='tournament';
function cosmeticAvailable(entry){return !entry?.trialReward||(timeTrialsUnlocked(tournamentProgress)&&trialCosmeticUnlocked(entry.trialReward,trialProgress.completedTrials));}
if(!cosmeticAvailable(OUTFITS[profile.outfit]))profile.outfit='riptide';
if(!cosmeticAvailable(BOARD_DESIGNS[profile.boardDesign]))profile.boardDesign='bolt';
const isParkMode=()=>game?.mode==='park';
$('loading-tip').textContent={
  surf:'A different sky every session. Hop driftwood with Space; land lip or cutback tricks for a speed boost.',
  park:'Hold SHIFT while turning for a sharp cutback. At a ramp lip, SHIFT catches the coping. E rides pipe walls.',
  rush:'Every checkpoint adds eight seconds. Keep your line and leave room to turn.',
  tournament:'Five ladders. Five prize boards. Beat every rival in a ladder to unlock its board and perk.',
  trials:'Beat the clock through every sun ring. Three new clears unlock a matching outfit and board graphic.',
  storm:'Escape before the barrel closes. Land tricks to boost, hop driftwood and steer clear of whirlpools.',
}[selectedMode];
document.querySelectorAll('[data-brand-art]').forEach(img=>img.src=brandLogo);
const classicLogo=createClassicLogoCanvas().toDataURL('image/png');
document.querySelectorAll('[data-classic-logo]').forEach(img=>img.src=classicLogo);
$('loading').querySelector('img').decode().then(()=>$('loading').classList.add('has-logo')).catch(()=>{/* Keep the native logo fallback. */});
let selectedParkStart=read('breakline99-park-start','basin');
if(!['basin','west','east','filters'].includes(selectedParkStart))selectedParkStart='basin';
$('park-start').value=selectedParkStart;
const audio=new ArcadeAudio();
const input={left:false,right:false,pump:false,brake:false,jump:false,action:false,grind:false};
const special=new SpecialMeter();
const pressed=new Set();
let world,game,preview,menuSurfer,parkMap,adminPanel,keydownHandler,modalMode=null,resumeAfterModal=false,workshopMode=null,toastTime=0;
let best=0,bestSurvival=Math.max(0,Number(read('breakline99-survival-time','0'))||0),newBest=false,challengeFlags=[false,false,false],soundPreference=read('breakline99-sound','auto');
let portraitKey='';
const wasted=createWastedSequence({stage:$('stage'),onStart:clearInput,onComplete:()=>{if(game?.phase==='finished'&&selectedMode==='storm')showResults();}});
const modeInfo={
  trials:{name:'TIME TRIALS',level:'CHAMPION CIRCUIT',description:'Twelve solo runs against the clock. Ten wave courses, two extended Waterworks tracks. New clothes and deck graphics every three clears. Clear three to earn the Afterburner speed board.'},
  tournament:{name:'THE HIT LIST',level:'COAST + FACTORY / RIVAL CIRCUIT',description:'Five ladders. Twenty-five rival races. Clear each ladder to win an exclusive board, trick effects and a new perk.'},
  rush:{name:'REEF RUSH',level:'CHECKPOINT COAST',description:'35 seconds to start. Every sun ring adds 8 seconds. Catch 12 to finish; a wipeout costs precious time.'},
  storm:{name:'STORM RIDER',level:'SQUALL POINT',description:'Always a storm. Three lives, no time limit. Escape closing barrels, dodge whirlpools and hop driftwood. Land tricks for the boost you need to get clear.'},
  surf:{name:'SURF SESSION',level:'OPEN COAST',description:'A new sky every run: dawn, midday, sunset, dusk or storm. Hop driftwood, carve for air and land trick combos for a burst of speed.'},
  park:{name:'THE WATERWORKS',level:'LOWER SEWAGE WORKS',description:'Deep beneath an abandoned factory. Ride the drainage canals, thread the rust tunnels and grind the old pipework.'},
};
function toast(text,bail=false){$('toast').textContent=text;$('toast').classList.toggle('bail',bail);$('toast').classList.add('visible');toastTime=2;}
function clearInput(){pressed.clear();for(const k in input)input[k]=false;keydownHandler?.resetAdminSequence();}
function applyPlayerSettings(){game.setRewardBoard(profile.rewardBoard);game.setAdminStats(resolveAdminStats(adminSettings,profile));}
function adminHomeScreen(){return bootReady&&game?.phase==='ready'&&!modalMode&&!workshopMode&&!$('intro').classList.contains('hidden');}
function openAdmin(){if(!adminHomeScreen())return;clearInput();adminPanel.open();}
function applyAdminSettings(next){
  const safe=sanitizeAdminSettings(next);
  persistAdminEntries(localStorage,[[ADMIN_STORAGE_KEY,JSON.stringify(safe)]]);
  adminSettings=safe;applyPlayerSettings();updateHud();
}
function giveEverything(){
  const unlocked=everythingUnlocked(tournamentProgress,trialProgress);
  persistAdminEntries(localStorage,[['breakline99-tournament-v2',JSON.stringify(unlocked.tournament)],['breakline99-trials-v1',JSON.stringify(unlocked.trials)]]);
  tournamentProgress=unlocked.tournament;trialProgress=unlocked.trials;
  clearInput();makeGame();updateModeMenu();updateCustomizationChoices();updateHud();
}
function fullReset(){resetBreaklineSave(localStorage);window.location.reload();}
function syncInput(){for(const name in input)input[name]=[...pressed].some(code=>keyMap[code]===name);}
function loadBest(){best=Math.max(0,Number(read(`breakline99-best-${selectedMode}`,selectedMode==='surf'?read('breakline99-best','0'):'0'))||0);}
function saveBest(){if(!game)return;if(selectedMode==='storm'&&game.elapsed>bestSurvival){bestSurvival=game.elapsed;write('breakline99-survival-time',String(bestSurvival));}if(game.score<=best)return;best=game.score;newBest=true;write(`breakline99-best-${selectedMode}`,String(best));}
function completedGoals(){return [game.score>=5000,game.bestCombo>=1500,isParkMode()?game.visitedRamps.size>=5:selectedMode==='rush'?game.gates>=12:selectedMode==='storm'?game.barrelsSurvived>=3:game.gates>=6];}
function goalNames(){return ['Score 5,000','Bank a 1,500 combo',isParkMode()?'Ride 5 different ramps':selectedMode==='rush'?'Finish 12 checkpoints':selectedMode==='storm'?'Ride through 3 barrels':'Catch 6 sun rings'];}
function onEvent(e){
  // Rival actions are shown beside their name and on their rider. They must
  // never award the player special, replace player toasts or reset the camera.
  if(e.opponent)return;
  world?.onEvent(e,game);if(!(e.type==='finish'&&selectedMode==='storm'&&game?.lives===0))audio.event(e.type==='surfBoost'?'raceBoost':e.type);
  if(e.type==='bank'){toast(`+${fmt(e.points)}  BANKED`);special.gain(e.points/12000*(game.characterStats?.specialGain??1));saveBest();}
  if(e.type==='trick')special.gain(.22*(game.characterStats?.specialGain??1));
  if(e.type==='trickStart'&&e.comboAnimationName)toast(e.comboAnimationName);
  if(e.type==='bail'){special.bail();toast(e.lost?`WIPEOUT! ${fmt(e.lost)} LOST`:e.reason,true);}
  if(e.type==='gate')toast(selectedMode==='rush'?`CHECKPOINT ${game.gates}/12 · +8 SEC`:'SUN RING +250');
  if(e.type==='raceGate'&&!e.opponent)toast(`SUN RING ${game.nextCheckpoint}/${game.course.checkpoints.length}`);
  if(e.type==='raceMiss'&&!e.opponent)toast(isParkMode()?'MISSED SUN RING · TURN BACK AND PASS THROUGH':'MISSED SUN RING · LINE UP WITH THE OPENING',true);
  if(e.type==='raceGo')toast('GO! · W TO PUMP');
  if(e.type==='raceBoost')toast(`${e.combo?'COMBO':'TRICK'} BOOST! · +${Math.round(e.speed*3.6)} KM/H`);
  if(e.type==='surfBoost')toast(`${e.combo?'COMBO':'TRICK'} BOOST! · +${Math.round(e.speed*3.6)} KM/H`);
  if(e.type==='cutback')toast(isParkMode()?'SHARP CUTBACK':'CUTBACK SET · POP FOR AIR!');
  if(e.type==='grind')toast('WATER SLIDE!');
  if(e.type==='land')toast(e.assisted?'SAVED LANDING!':game.mode==='surf'&&game.airLaunchSource==='flat'?'BACK ON THE FACE':'LANDED! KEEP IT GOING');
  if(e.type==='barrelExit'){toast(`BARREL RIDE · +${fmt(e.points||0)}`);saveBest();}
  if(e.type==='start')toast(game?.isTimeTrial?`${game.trial.name} · BEAT ${trialTime(game.trial.timeLimit)}`:game?.isRace?`${game.rival.name} · FIRST TO THE FINISH`:isParkMode()?'THE WATERWORKS · DROP IN':'DROP IN!');
  if(e.type==='airJump')toast(adminSettings.enabled?'CUSTOM AIR JUMP!':'SKYBOUND · SECOND AIR!');
  if(e.type==='finish'){saveBest();if(game.isTimeTrial){trialProgress=game.getProgress();write('breakline99-trials-v1',JSON.stringify(trialProgress));updateCustomizationChoices();showResults();}else if(game.isTournament){tournamentProgress=game.getProgress();write('breakline99-tournament-v2',JSON.stringify(tournamentProgress));showResults();}else if(selectedMode==='storm'&&game.lives===0&&game.wipeouts>=3){clearInput();wasted.start();}else showResults();}
}
function makeGame(){game=selectedMode==='trials'?createTimeTrialGame(onEvent,trialProgress):selectedMode==='tournament'?createTournamentGame(onEvent,tournamentProgress):selectedMode==='park'?new WaveParkGame(onEvent):new SurfGame(onEvent,selectedMode);applyPlayerSettings();game.weatherId=selectedMode==='storm'?'storm':getSurfWeather(lastSurfWeather).id;world.setMode(game.mode);audio.setMode(game.mode);audio.setScene('menu');loadBest();}
function updateModeMenu(){
  $('mode-trials').disabled=!timeTrialsUnlocked(tournamentProgress);
  $('trial-lock').textContent=timeTrialsUnlocked(tournamentProgress)?`${trialProgress.completedTrials}/12 cleared. Rewards every three.`:'Clear all five Rival ladders to unlock.';
  $('trial-button').classList.toggle('hidden',selectedMode!=='trials');
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===selectedMode;b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));const label=b.querySelector('.mode-status');if(label)label.textContent=b.disabled?'LOCKED':active?'▶ SELECTED':'▶ SELECT MODE';});
  if($('selected-mode-name'))$('selected-mode-name').textContent=modeInfo[selectedMode].name;
  if($('mode-description'))$('mode-description').textContent=modeInfo[selectedMode].description;
  if($('level-name'))$('level-name').textContent=modeInfo[selectedMode].level;
  if($('mode-hud'))$('mode-hud').textContent=modeInfo[selectedMode].name;
  $('goal-gates').querySelector('span').textContent=goalNames()[2];
  $('park-map').classList.toggle('hidden',!isParkMode());
  $('park-start-wrap').classList.toggle('hidden',selectedMode!=='park');
  document.body.classList.toggle('park-mode',isParkMode());
  document.body.dataset.session=selectedMode;
  $('session-badge').textContent={surf:'2 MIN. / SCORE ATTACK',park:'2 MIN. / FREESTYLE',rush:'12 CHECKPOINTS / +8 SEC',storm:'ENDLESS / 3 LIVES'}[selectedMode];
  $('timer-label').textContent=game.isTimeTrial?'TIME LEFT':game.isRace?'RACE TIME':selectedMode==='storm'?'SURVIVED':'TIME';
  $('surf-condition').classList.toggle('hidden',isParkMode()&&!game.isRace);
  $('rival-hud').classList.toggle('hidden',!game.isTournament&&!game.isTimeTrial);
  document.querySelector('.goals').classList.toggle('hidden',game.isTournament||game.isTimeTrial);
  $('ladder-button').classList.toggle('hidden',!game.isTournament);
  $('start').querySelector('span').textContent=game.isTimeTrial?`START ${game.trial.name}`:game.isTournament?(game.complete?(nextTournamentLadder(tournamentProgress)?'NEXT LADDER':'REPLAY LADDER'):`CHALLENGE ${game.rival.name}`):'DROP IN';
  $('rival-hud').classList.toggle('race-hud',!!game.isRace);
  $('rival-hud').querySelector('small').textContent=game.isTimeTrial?'TIME TRIAL / SOLO AGAINST THE CLOCK':game.isRace?'THE HIT LIST / HEAD-TO-HEAD RACE':'THE HIT LIST / RECORDED RIVAL RUN';
  $('race-progress').classList.toggle('hidden',!game.isRace);
  $('rival-action').classList.toggle('hidden',!game.isRace||game.isTimeTrial);
  $('race-boost').classList.toggle('hidden',!game.isRace&&!game.surfAdventureEnabled);
  if(game.isTimeTrial){
    $('session-badge').textContent=`TRIAL ${game.trialIndex+1}/12 · ${trialProgress.completedTrials} CLEARED`;
    $('level-name').textContent=isParkMode()?`WATERWORKS / ${game.course.name}`:'CHAMPION COAST / TIME TRIAL';
    $('mode-description').textContent=`${game.trial.name} · ${fmt(game.course.length)}m · Target ${trialTime(game.trial.timeLimit)}. Pass every sun ring. Land tricks for boosts. ${Math.min(3,3-trialProgress.completedTrials%3)} new clears to the next outfit and deck set.`;
    if(trialProgress.completedTrials===TIME_TRIALS.length)$('mode-description').textContent=`ALL TRIALS CLEARED · All four outfit and deck sets unlocked. Replay ${game.trial.name} and improve your best time.`;
  }
  if(game.isTournament){
    $('session-badge').textContent=`LADDER ${game.ladderIndex+1}/5 · ${game.complete?'CLEARED':`RANK #${game.rival.rank}`}`;
    $('level-name').textContent=isParkMode()?`WATERWORKS / ${game.course.name}`:'SUNSET POINT / RIVAL RACE';
    $('mode-description').textContent=game.complete?`${game.ladder.name} cleared. ${getRewardBoard(game.ladder.rewardId).name} is yours. ${game.allLaddersComplete?'All five boards unlocked. TIME TRIALS are now open: race the clock for exclusive clothes and board styles.':'Equip it in the board shop, then take on the next ladder.'}`:`${game.ladder.name} · Beat all five rivals to unlock ${getRewardBoard(game.ladder.rewardId).name}. Race ${game.rival.name} through every sun ring to the ${fmt(game.course.length)}m finish.`;
  }

}
function selectMode(mode){if(!modeInfo[mode]||(mode==='trials'&&!timeTrialsUnlocked(tournamentProgress)))return;selectedMode=mode;write('breakline99-mode',mode);clearInput();makeGame();updateModeMenu();updateSoundLabel();}
function updateSoundLabel(){
  $('sound').textContent=audio.enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-label',audio.enabled?'Mute audio':'Enable audio');
  if($('music-track'))$('music-track').textContent=audio.enabled?`♫ ${audio.trackName.toUpperCase()}`:'M · TURN UP THE RADIO';
}
async function toggleSound(){await audio.toggle();soundPreference=audio.enabled?'on':'off';write('breakline99-sound',soundPreference);updateSoundLabel();}
function startRun(kind='default'){
  if(adminPanel?.isOpen)return;
  wasted.reset();closeWorkshop();closeModal(false);clearInput();newBest=false;challengeFlags=[false,false,false];special.reset();
  if(soundPreference!=='off'&&!audio.enabled)audio.enable().then(updateSoundLabel);
  if(game.isTimeTrial){
    if(kind!=='retry'&&game.phase==='finished'&&game.result==='win')game=createTimeTrialGame(onEvent,trialProgress);
    applyPlayerSettings();game.retry();
  }else if(game.isTournament){
    if(kind!=='retry'&&game.complete&&(game.phase==='ready'||game.result==='win')){
      tournamentProgress=nextTournamentLadder(game.getProgress())||selectTournamentLadder(game.getProgress(),game.ladderIndex);
      write('breakline99-tournament-v2',JSON.stringify(tournamentProgress));game=createTournamentGame(onEvent,tournamentProgress);
    }else if(kind!=='retry'&&game.phase==='finished'&&game.result==='win')game=createTournamentGame(onEvent,game.getProgress());
    applyPlayerSettings();game.retry();
  }else{applyPlayerSettings();game.start(selectedMode==='park'?selectedParkStart:undefined);}
  if(selectedMode==='surf'){lastSurfWeather=chooseSurfWeather(lastSurfWeather);game.weatherId=lastSurfWeather;write('breakline99-weather',lastSurfWeather);}
  else if(selectedMode==='storm')game.weatherId='storm';
  world.setMode(game.mode);audio.setMode(game.mode);audio.setScene(game.isRace?'race':'ride');updateModeMenu();updateSoundLabel();$('intro').classList.add('hidden');$('hud').classList.remove('hidden');document.body.classList.add('playing');$('stage').focus({preventScroll:true});
}
function restartRun(){startRun('retry');}
function goHome(){
  wasted.reset();saveBest();closeWorkshop();closeModal(false);clearInput();special.reset();makeGame();
  $('hud').classList.add('hidden');$('intro').classList.remove('hidden');document.body.classList.remove('playing');updateModeMenu();updateSoundLabel();$('start').focus({preventScroll:true});
}
function openModal(mode,title,content,action,kicker='BREAKLINE ’99'){
  keydownHandler?.resetAdminSequence();
  $('modal').dataset.mode=mode;
  $('race-trials').classList.toggle('hidden',!game.isTimeTrial||!['pause','results'].includes(mode));
  $('race-ladders').classList.toggle('hidden',!game.isTournament||!['pause','results'].includes(mode));
  const active=game.phase==='running';if(active){game.pause();clearInput();}if(!modalMode)resumeAfterModal=active;
  modalMode=mode;$('modal-title').textContent=title;$('modal-kicker').textContent=kicker;$('modal-content').innerHTML=content;$('modal-action').textContent=action;
  $('modal').classList.remove('hidden');$('modal-action').focus({preventScroll:true});
}
function closeModal(resume=true){$('modal').classList.add('hidden');modalMode=null;if(resume&&resumeAfterModal)game.resume();resumeAfterModal=false;$('stage').focus({preventScroll:true});}
function pause(){if(workshopMode){closeWorkshop();return;}if(modalMode==='ladder'||modalMode==='trials'){if(game.phase==='finished')goHome();else closeModal();return;}if(modalMode==='pause'||modalMode==='help'){closeModal();return;}if(game.phase!=='running')return;openModal('pause','PAUSED','<p>The clock is stopped. Your line is waiting.</p><p><kbd>P</kbd> / <kbd>ESC</kbd> resume · <kbd>R</kbd> restart</p>','KEEP RIDING','TIME OUT');}
function showHelp(){
  if(modalMode==='help'){closeModal();return;}
  openModal('help','HOW TO RIDE',`<div class="controls-grid">
  <span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></span><span>${isParkMode()?'Steer around the park.':'Carve across the wave. The high lip is left.'}</span>
  <span><kbd>W</kbd> / <kbd>↑</kbd></span><span>${isParkMode()?'Pump to build speed.':'Pump for more speed.'} <kbd>S</kbd> / <kbd>↓</kbd> slows down.</span>
  <span><kbd>SPACE</kbd></span><span>${isParkMode()?'Hold to crouch and build speed, then release to pop.':'Hold, then release to pop.'} Recover on the water for ${Number(game.popRecoveryDuration.toFixed(2))} ${game.popRecoveryDuration===1?'second':'seconds'} between pops. ${game.isRace?'Race pops have enough air for a basic trick. Hold Space briefly, release, press J and land for a boost. Charge longer and follow J with L after the spin finishes for a combo.':isParkMode()?'Ride the ramps for bigger airs; wave lips also launch you automatically.':'Flat hops earn no points. Reach the wave lip or finish a cutback, then pop for trick height.'}</span>
  ${isParkMode()?'<span><kbd>E</kbd> + <kbd>A</kbd> / <kbd>D</kbd></span><span>Hold E inside a tunnel; steer around its walls for a full pipe loop. Release E to return to the floor.</span><span><kbd>E</kbd> / <kbd>SHIFT</kbd></span><span>Hold E as you ride up a quarterpipe to grab the board and turn back. Hold SHIFT instead to grind the coping directly—no jump needed. A/D chooses the grind direction.</span>':''}
  <span><kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd></span><span>180 spin / kickflip / Indy grab. One trick at a time, in the air.</span>
  <span><kbd>U</kbd> <kbd>O</kbd></span><span>Shuv-it / heelflip.</span>
  <span><kbd>H</kbd> <kbd>F</kbd></span><span>Method air / 360 air.</span>
  <span><kbd>B</kbd></span><span>Tweaked grab: tuck your knees, pull the surfboard to your side and raise the free arm.</span>
  <span><kbd>SHIFT</kbd> + <kbd>A</kbd> / <kbd>D</kbd></span><span>${isParkMode()?'Make a sharp cutback while riding. Near the top of a quarterpipe, Shift catches the coping instead.':'Turn while holding Shift to snap a cutback on the wave face.'} Release and turn again for another cutback. C also works.</span>
  <span><kbd>I</kbd></span><span>Rodeo Air at 100% SPECIAL. Once full, it stays ready until used—even through a wipeout.</span>
  <span><kbd>ENTER</kbd></span><span>Bank a landed combo. Pop again within ${game.comboWindow} seconds to link another air.</span>
  ${game.surfAdventureEnabled?`<span>TRICK BOOST</span><span>Land a completed trick from the lip or a cutback for an automatic speed burst. Link tricks in an unbanked combo for more speed and a longer boost. Flat hops are for clearing driftwood; they do not earn a boost.</span><span>DRIFTWOOD</span><span>Tap and release Space before a low branch to hop over it. You can also steer around it. Watch the water ahead.</span>${selectedMode==='storm'?'<span>WHIRLPOOLS</span><span>The foam spiral pulls you toward its dark centre. Steer clear, or cross above it with enough air. The storm becomes harder the longer you survive.</span><span>CLOSING BARRELS</span><span>A countdown starts as you approach. Line up with the hollow wave, pump with W and use earned trick boosts to get out before the lip crashes down. The collapsing water can hit you; you can also stay outside the barrel.</span>':'<span>WEATHER + TIME</span><span>Each new Surf Session rolls a different sky and time of day. Pausing keeps the current conditions. Storm Rider always stays stormy.</span>'}`:''}
  ${game.isRace?`<span>SUN RINGS</span><span>Pass through each gold ring in order, then ${game.isTimeTrial?'beat the target time':'finish before your rival'}. Skipping a ring or flying over it does not count. In Waterworks, follow the route on the map and turn back for missed rings. ${game.isTimeTrial?'Missed ocean rings end the attempt. The timer stops while paused.':'There is no time limit.'}</span><span>RACE BOOST</span><span>Land a completed aerial trick for an automatic speed burst. Link more tricks in an unbanked combo for a stronger, longer boost. ${game.isTimeTrial?'':'Rivals earn boosts with the same rules, so watch their tricks and boost trails. '}No extra boost key. Braking eases off the boost; a wipeout or missed checkpoint clears it.</span>`:''}
  <span>PRIZE BOARDS</span><span>Clear each of the five Rival ladders to unlock a board with its own perk and trick burst. Equip one in Board Shop; perks do not stack. SKYBOUND grants one extra airborne Space press-and-release after your current trick finishes. Land to recharge it.</span>
  <span><kbd>P</kbd> <kbd>R</kbd> <kbd>M</kbd></span><span>Pause / restart / music. ESC also pauses.</span></div>
  <section class="combo-guide"><h3>CUSTOM COMBO MOVES</h3><p>Finish the first trick, then press the second key while airborne. Keep the combo unbanked to link them across separate jumps.</p><dl>${COMBO_ANIMATIONS.map(combo=>`<div><dt>${combo.keys.map(key=>`<kbd>${key}</kbd>`).join(' → ')} <strong>${combo.name}</strong></dt><dd>${combo.description}</dd></div>`).join('')}</dl></section>
  <p class="help-tip">Landings allow small sideways drifts and a short grace period for almost-finished tricks. Start your moves early; a badly unfinished trick still loses the combo. ${isParkMode()?'Jump onto a pipe or rail along its length to grind. Rail sides are solid. Ride through the open rust tunnels, or use their approach ramps to reach the top.':'Use A/D to hold your line and S to settle a rough landing. In Storm Rider, follow the opening under a curling wave to ride the barrel. You have three lives and no time limit; stronger currents, faster riding and tighter barrels build as you survive.'}</p>
`,'GOT IT','CONTROLS');
}
function showResults(){
  if(game.isTimeTrial){showTrialResults();return;}
  if(game.isTournament){showTournamentResults();return;}
  clearInput();const complete=completedGoals(),stars=complete.filter(Boolean).length;const rank=['GROM','LOCAL','LINEUP LEGEND','COAST ROYALTY'][stars];
  openModal('results',game.resultReason||'SESSION OVER',`<div class="results-score">${fmt(game.score)}</div><p>${newBest?'NEW RECORD! · ':''}${rank} · ${stars}/3 CHALLENGES</p>
  <div class="results-stats"><span>BEST COMBO<b>${fmt(game.bestCombo)}</b></span><span>TRICKS BANKED<b>${game.landedTricks}</b></span><span>${isParkMode()?'RAMPS / SLIDES':'SUN RINGS'}<b>${isParkMode()?`${game.visitedRamps.size} / ${game.grindCount}`:game.gates}</b></span><span>WIPEOUTS<b>${game.wipeouts}</b></span></div>
  <div class="result-goals">${goalNames().map((name,i)=>`${complete[i]?'◆':'◇'} ${name}`).join('<br>')}</div>${selectedMode==='storm'?`<p class="survival-result">SURVIVED <b>${clockText(game.elapsed)}</b> · SWELL ${game.stormStage||1}<br>BEST SURVIVAL: ${clockText(bestSurvival)} · BARRELS: ${game.barrelsSurvived||0}</p>`:''}<p>PERSONAL BEST SCORE: ${fmt(best)}</p>`,'RIDE AGAIN',modeInfo[selectedMode].name);
}

function showTrials(){
  if(!game.isTimeTrial)return;
  openModal('trials','BEAT THE CLOCK',trialListMarkup(trialProgress),`START ${TIME_TRIALS[trialProgress.selectedTrial].name}`,'CHAMPION CIRCUIT / TIME TRIALS');
}
function showTrialResults(){
  clearInput();const win=game.result==='win',earned=game.unlockedSet;
  const set=typeof earned==='string'?getTrialCosmeticSet(earned):earned;
  const unlockedBoards=win&&set?TRIAL_REWARD_BOARD_ORDER.filter(id=>getRewardBoard(id).trialClears===set.requiredClears):[];
  const best=trialProgress.bestTimes?.[game.trial.id]??trialProgress.bestTimes?.[game.trialIndex];
  openModal('results',win?'TIME BEATEN':game.resultReason||'TIME UP',`<p>TRIAL ${game.trialIndex+1} / 12 · ${game.trial.name}</p><div class="trial-result-time">${trialTime(game.finishTime??game.elapsed)}</div><p>TARGET ${trialTime(game.trial.timeLimit)} · BEST ${trialTime(best)}</p><div class="results-stats"><span>SUN RINGS<b>${game.nextCheckpoint} / ${game.course.checkpoints.length}</b></span><span>TRIALS CLEARED<b>${trialProgress.completedTrials} / 12</b></span></div>${unlockedBoards.map(id=>`<p class="trial-board-award">NEW SPEED BOARD UNLOCKED</p>${rewardCard(id,{unlocked:true,equipped:profile.rewardBoard===id,result:true})}`).join('')}${set?`<div class="trial-unlock"><strong>NEW SET: ${set.name}</strong><p>Outfit and deck graphic unlocked. Equip them here or in the wardrobe and board shop.</p><button type="button" data-trial-equip="${set.id}">EQUIP ${set.name}</button></div>`:''}<p>${win?(trialProgress.completedTrials===12?'ALL TRIALS CLEARED. FOUR COMPLETE COSMETIC SETS EARNED.':'CLEARED. The next run demands a faster line. Replays improve your best time without awarding duplicate clears.'):'Pass every sun ring before the target time. Land tricks for boosts and keep a clean line.'}</p>`,win&&trialProgress.selectedTrial!==game.trialIndex?'NEXT TIME TRIAL':'RETRY TIME TRIAL','CHAMPION CIRCUIT / SOLO RUN');
}
function equipTrialSet(id){
  const set=getTrialCosmeticSet(id);if(!set||!timeTrialsUnlocked(tournamentProgress)||!trialCosmeticUnlocked(id,trialProgress.completedTrials))return false;
  if(!setProfile({outfit:set.outfit,boardDesign:set.boardDesign,rewardBoard:null}))return false;
  if(modalMode==='results')showTrialResults();else if(modalMode==='trials')showTrials();
  return true;
}

const rewardIcons={guitar:'♫',lightning:'ϟ',vortex:'◎',solar:'☀',sky:'↟',afterburner:'»'};
function rewardCard(id,{unlocked=false,equipped=false,result=false}={}){
  const board=getRewardBoard(id);
  return `<article class="reward-card ${unlocked?'unlocked':'locked'} ${equipped?'equipped':''}" data-reward-theme="${id}"><span class="reward-icon" aria-hidden="true">${rewardIcons[id]}</span><div><small>${equipped?'EQUIPPED':unlocked?'UNLOCKED':board.trialClears?`CLEAR ${board.trialClears} TIME TRIALS`:`CLEAR LADDER ${board.ladderIndex+1}`}</small><strong>${board.name}</strong><p>${board.buffLabel}</p><span>${board.description}</span></div><button type="button" data-reward-board="${id}" ${unlocked?'':'disabled'} aria-pressed="${equipped}">${equipped?'EQUIPPED':unlocked?'EQUIP BOARD':'LOCKED'}</button></article>`;
}
function ladderRows(){return `<ol class="rival-ladder">${tournamentRivalsForLadder(tournamentProgress).map((r,i)=>`<li class="${i<tournamentProgress.completedRounds?'beaten':i===game.roundIndex?'current':'locked'}"><b>#${r.rank}</b><div><strong>${r.name}</strong><span>${r.venue==='park'?'WATERWORKS CIRCUIT':'SURF SESSION'} · RACE</span></div><div class="rival-target"><strong>${fmt(tournamentCourseLength(r))}m</strong><span>${i<tournamentProgress.completedRounds?'DEFEATED':i===game.roundIndex?'YOUR NEXT RIVAL':'LOCKED'}</span></div></li>`).join('')}</ol>`;}
function showLadder(){
  if(!game.isTournament)return;
  const ladder=game.ladder,reward=getRewardBoard(ladder.rewardId);
  openModal('ladder',ladder.name,`<p class="rival-intro">Five ladders. Five exclusive boards. Each ladder has five head-to-head races across the coast and Waterworks.</p><div class="ladder-tabs" role="group" aria-label="Rival ladders">${TOURNAMENT_LADDERS.map((entry,i)=>`<button data-ladder="${i}" ${i>tournamentProgress.completedLadders||i===game.ladderIndex?'disabled':''} class="${i===game.ladderIndex?'selected':''}"><b>${String(i+1).padStart(2,'0')} ${entry.name}</b><span>${i<tournamentProgress.completedLadders?'CLEARED · REPLAY':i===game.ladderIndex?`${tournamentProgress.completedRounds}/5 RIVALS`:i===tournamentProgress.completedLadders?'ENTER LADDER':'LOCKED'}</span></button>`).join('')}</div><p class="ladder-prize">PRIZE: <b>${reward.name}</b> · ${reward.buffLabel}</p><div class="ladder-reset-row"><button type="button" data-reset-ladder>RESET THIS LADDER</button><p>Start this ladder again from race 1.<br>Your prize boards and unlocked ladders stay available.</p></div>${ladderRows()}<p class="rival-footnote">Pass every sun ring and finish first. Switching ladders starts at race 1. Your prize boards stay unlocked. ${tournamentProgress.completedLadders}/5 prize boards earned.</p>`,game.complete?(nextTournamentLadder(tournamentProgress)?'NEXT LADDER':'REPLAY LADDER'):`CHALLENGE ${game.rival.name}`,`THE HIT LIST / LADDER ${game.ladderIndex+1} OF 5`);
}
function resetCurrentLadder(){
  if(!game.isTournament)return;
  const next=selectTournamentLadder(tournamentProgress,game.ladderIndex);
  if(!next)return;
  tournamentProgress=next;write('breakline99-tournament-v2',JSON.stringify(next));
  goHome();showLadder();
}
function showTournamentResults(){
  clearInput();const win=game.result==='win',venue=isParkMode()?'WATERWORKS RACE':'SURF RACE';
  const finished=game.finishTime!=null,opponentFinished=game.opponentFinishTime!=null;
  const message=win?(game.complete?(game.allLaddersComplete?'ALL FIVE LADDERS CLEARED. TIME TRIALS UNLOCKED — NEW OUTFITS AND DECK STYLES TO WIN.':'ALL FIVE RIVALS DEFEATED. LADDER CLEARED.'):`RANK CLAIMED. NEXT UP: ${TOURNAMENT_RIVALS[game.roundIndex+1].name}.`):'FOLLOW THE SUN RINGS. LAND TRICKS TO BOOST. FINISH FIRST.';
  const reward=win&&game.complete?getRewardBoard(game.ladder.rewardId):null;
  openModal('results',game.unlockedBoardId?'NEW BOARD UNLOCKED':game.resultReason,`<div class="showdown-result ${win?'won':'lost'}"><span>RANK #${game.rival.rank} / ${game.rival.name} · ${venue}</span><div><section><small>YOU</small><strong>${win?'1ST':'2ND'}</strong><small>${finished?clockText(game.finishTime):`${fmt(game.distanceRemaining)}m TO FINISH`}</small></section><b>VS</b><section><small>${game.rival.name}</small><strong>${win?'2ND':'1ST'}</strong><small>${opponentFinished?clockText(game.opponentFinishTime):`${fmt(Math.max(0,game.course.length-game.opponentRaceProgress))}m TO FINISH`}</small></section></div><p>${message}</p></div>${reward?rewardCard(reward.id,{unlocked:true,equipped:profile.rewardBoard===reward.id,result:true}):''}${win&&game.allLaddersComplete?'<button type="button" class="trial-menu-button secondary-button" data-open-trials>ENTER TIME TRIALS</button>':''}<div class="results-stats"><span>COURSE<b>${fmt(game.course.length)}m</b></span><span>SUN RINGS<b>${game.nextCheckpoint} / ${game.course.checkpoints.length}</b></span><span>LADDER<b>${game.ladderIndex+1} / 5</b></span><span>BOARDS WON<b>${tournamentProgress.completedLadders} / 5</b></span></div><p class="rival-footnote">Every ring is required · First across the finish wins.</p>`,win?(game.complete?(nextTournamentLadder(tournamentProgress)?'NEXT LADDER':'REPLAY LADDER'):'NEXT RIVAL'):'RETRY RIVAL',`THE HIT LIST / ${game.ladder.name}`);
}

function renderCustomizationChoices(){
  $('outfit-options').innerHTML=Object.entries(OUTFITS).map(([key,v])=>`<button class="outfit-button" data-outfit="${key}" aria-pressed="false"><strong>${v.name}</strong><span>${v.description}</span>${v.trialReward?`<small class="cosmetic-lock">CLEAR ${getTrialCosmeticSet(v.trialReward).requiredClears} TIME TRIALS</small>`:''}</button>`).join('');
  const icons={bolt:'ϟ',checker:'▦',flames:'♨',tribal:'≋',hibiscus:'✿',skull:'☠',sunburst:'✺',pinstripe:'///'};
  $('board-design-options').innerHTML=Object.entries(BOARD_DESIGNS).map(([key,v])=>`<button class="design-button" data-board-design="${key}" aria-pressed="false"><span class="design-symbol">${icons[key]||'◈'}</span><strong>${v.name}</strong>${v.trialReward?`<small class="cosmetic-lock">CLEAR ${getTrialCosmeticSet(v.trialReward).requiredClears} TIME TRIALS</small>`:''}</button>`).join('');
  updateCustomizationChoices();
}
function updateCustomizationChoices(){
  for(const [selector,field] of [['[data-character]','character'],['[data-outfit]','outfit'],['[data-board-color]','boardColor'],['[data-board-design]','boardDesign']]){
    document.querySelectorAll(selector).forEach(b=>{const active=b.getAttribute(selector.slice(1,-1))===profile[field];b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));});
  }
  for(const [selector,catalog]of [['[data-outfit]',OUTFITS],['[data-board-design]',BOARD_DESIGNS]])document.querySelectorAll(selector).forEach(button=>{
    const key=button.getAttribute(selector.slice(1,-1)),entry=catalog[key];button.disabled=!cosmeticAvailable(entry);
    const note=button.querySelector('.cosmetic-lock');if(note)note.textContent=button.disabled?`CLEAR ${getTrialCosmeticSet(entry.trialReward).requiredClears} TIME TRIALS`:'TIME TRIAL REWARD · UNLOCKED';
  });
  $('character-name').textContent=`${CHARACTERS[profile.character].name} / ${OUTFITS[profile.outfit].name}`;
  $('board-name').textContent=getRewardBoard(profile.rewardBoard)?.name||BOARD_DESIGNS[profile.boardDesign].name;
  $('home-surfer-name').textContent=CHARACTERS[profile.character].name;
  $('home-surfer-setup').textContent=`${OUTFITS[profile.outfit].name} / ${$('board-name').textContent}`;
  $('home-surfer-preview').setAttribute('aria-label',`${CHARACTERS[profile.character].name} wearing ${OUTFITS[profile.outfit].name}, leaning against their ${$('board-name').textContent} surfboard`);
  $('reward-board-options').innerHTML=ALL_REWARD_BOARD_ORDER.map(id=>rewardCard(id,{unlocked:rewardBoardUnlocked(id,tournamentProgress,trialProgress),equipped:profile.rewardBoard===id})).join('');
  $('standard-board').setAttribute('aria-pressed',String(!profile.rewardBoard));
  $('standard-board').classList.toggle('is-selected',!profile.rewardBoard);
  $('reward-collection-count').textContent=`${ALL_REWARD_BOARD_ORDER.filter(id=>rewardBoardUnlocked(id,tournamentProgress,trialProgress)).length} / ${ALL_REWARD_BOARD_ORDER.length} UNLOCKED`;
  const character=CHARACTERS[profile.character], labels=['AIR','HANG TIME','POP','SPEED','SPIN','LANDING','SWITCH','RAIL BALANCE','LIP BALANCE','FLOW'];
  $('character-stats').innerHTML=labels.map((label,i)=>{const rating=character.stats?.[i]??7;return `<div class="stat-row" aria-label="${label}: ${rating} out of 10"><span>${label}</span><div class="stat-dots" aria-hidden="true">${Array.from({length:10},(_,n)=>`<i class="stat-dot${n<rating?'':' empty'}"></i>`).join('')}</div></div>`;}).join('');
  $('character-bio').textContent=character.bio||'A local with a taste for long lines and late summer swells.';
  $('outfit-name').textContent=OUTFITS[profile.outfit].name;
  $('surfer-role').textContent=character.subtitle;
  $('surfer-stance').textContent=character.stance||'REGULAR';
  $('portrait-fallback').className=`portrait portrait-${profile.character}`;
  if(workshopMode)$('workshop-title').textContent=workshopMode==='board'?'BOARD WORKSHOP':character.name;
  const key=profile.character+profile.outfit;
  if(preview?.portrait&&key!==portraitKey){$('surfer-portrait').src=preview.portrait();$('surfer-portrait').hidden=false;$('portrait-fallback').hidden=true;portraitKey=key;}
}
function cycleCharacter(direction){
  const ids=Object.keys(CHARACTERS),index=ids.indexOf(profile.character),character=ids[(index+direction+ids.length)%ids.length];
  const outfit=CHARACTERS[character].defaultOutfit;
  setProfile(outfit?{character,outfit}:{character});
}
function setProfile(patch){
  const next=validateProfile({...profile,...patch});
  if(next.rewardBoard&&!rewardBoardUnlocked(next.rewardBoard,tournamentProgress,trialProgress))return false;
  if(!cosmeticAvailable(OUTFITS[next.outfit])||!cosmeticAvailable(BOARD_DESIGNS[next.boardDesign]))return false;
  profile=next;write('breakline99-profile',JSON.stringify(profile));applyPlayerSettings();world.setProfile(profile);preview?.setProfile(profile);menuSurfer?.setProfile(profile);updateCustomizationChoices();return true;
}
function openWorkshop(mode){
  keydownHandler?.resetAdminSequence();
  if(game.phase==='running'){game.pause();clearInput();}
  workshopMode=mode==='board'?'board':'character';
  $('workshop').dataset.mode=workshopMode;
  $('workshop').querySelector('.selection-side').textContent=workshopMode==='board'?'BOARD SHOP':'SELECT SURFER';
  $('wardrobe').classList.add('hidden');
  $('workshop').classList.remove('hidden');$('workshop-title').textContent=workshopMode==='board'?'BOARD WORKSHOP':'CHOOSE YOUR STYLE';
  $('character-options').classList.toggle('hidden',workshopMode!=='character');$('board-options').classList.toggle('hidden',workshopMode!=='board');
  document.querySelectorAll('[data-workshop]').forEach(b=>{const on=b.dataset.workshop===workshopMode;b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});
  if(!preview)preview=new CustomizationPreview($('custom-preview'),profile);
  updateCustomizationChoices();$('workshop-close').focus({preventScroll:true});
}
function closeWorkshop(){if(!workshopMode)return;$('workshop').classList.add('hidden');$('wardrobe').classList.add('hidden');workshopMode=null;$('start').focus({preventScroll:true});}
function tryTrick(type){if(!game.isRace&&game.mode==='surf'&&game.airborne&&game.airLaunchSource==='flat'){toast('NEED AIR · CUT BACK OR RIDE THE LIP');return;}if(type==='special'&&!special.ready){if(game.airborne)toast('BUILD YOUR SPECIAL METER');return;}if(game.doTrick(type)&&type==='special'){special.consume();toast('RODEO AIR!');}}
function tryPop(){if(game.jump())return;if(game.rewardBoardDefinition?.airJumps>0&&game.airborne&&game.trick)toast('FINISH YOUR TRICK BEFORE THE EXTRA AIR');else if(!game.airborne&&game.bailTime<=0&&game.popCooldown>0)toast(`POP RECOVERING · ${game.popCooldown.toFixed(1)}s`);}
function updateHud(){
  $('score').textContent=pad(game.score);$('best').textContent=pad(best);
  $('timer').textContent=game.isTimeTrial?trialTime(game.time):clockText(selectedMode==='storm'||game.isRace?game.elapsed:Math.ceil(game.time));$('timer').parentElement.classList.toggle('urgent',selectedMode!=='storm'&&(!game.isRace||game.isTimeTrial)&&game.time<=20);
  const counting=game.isRace&&game.phase==='running'&&game.countdownRemaining>0;
  $('race-countdown').classList.toggle('hidden',!counting);
  if(counting)$('race-countdown-number').textContent=Math.ceil(game.countdownRemaining);
  $('speed').textContent=Math.round(game.speed*3.6);$('speed-bar').style.width=`${Math.min(100,game.speed/25*100)}%`;
  if(game.isRace||game.surfAdventureEnabled){
    const boostTime=game.isRace?game.boostTime:game.surfBoostTime,boostSpeed=game.isRace?game.boostSpeed:game.surfBoostSpeed,boostDuration=game.isRace?game.boostDuration:game.surfBoostDuration;
    const boosting=boostTime>0,comboBoost=game.isRace?game.boostLevel==='combo':game.surfBoostCombo;
    $('race-boost').classList.toggle('active',boosting);
    $('race-boost').classList.toggle('combo-boost',boosting&&comboBoost);
    $('race-boost-label').textContent=boosting?(comboBoost?'COMBO BOOST':'TRICK BOOST'):'TRICK BOOST';
    $('race-boost-detail').textContent=boosting?`${input.brake?'BRAKING':`+${Math.round(boostSpeed*3.6)} KM/H`} · ${boostTime.toFixed(1)}s`:game.isRace?'HOLD SPACE · RELEASE · J · LAND':'LIP / CUTBACK · TRICK · LAND';
    $('race-boost-fill').style.width=`${boosting?Math.min(100,boostTime/boostDuration*100):0}%`;
  }
  const weatherVisible=game.mode==='surf'&&!game.isRace&&['surf','storm'].includes(selectedMode);
  $('surf-weather').classList.toggle('hidden',!weatherVisible);
  if(weatherVisible){const weather=getSurfWeather(selectedMode==='storm'?'storm':game.weatherId);$('surf-weather').textContent=`${weather.label} / ${weather.timeLabel}`;}
  const barrelEvent=selectedMode==='storm'&&!!game.barrelWarning;
  $('barrel-event').classList.toggle('hidden',!barrelEvent);
  if(barrelEvent){$('barrel-countdown').textContent=game.barrelRemaining>0?`BARREL CLOSES IN ${game.barrelRemaining.toFixed(1)}s`:'WAVE CRASHING · GET CLEAR';$('barrel-event-fill').style.width=`${Math.max(0,Math.min(1,game.barrelClosingProgress||0))*100}%`;}
  $('wave-dot').style.left=`${isParkMode()?(game.x-PARK_BOUNDS.minX)/(PARK_BOUNDS.maxX-PARK_BOUNDS.minX)*96:(game.x-MIN_X)/(MAX_X-MIN_X)*96}%`;
  $('wave-dot').parentElement.style.setProperty('--crest-position',`${(waveCrest(-game.distance,game.elapsed)-MIN_X)/(MAX_X-MIN_X)*96}%`);
  const surface=isParkMode()?(game.surface?.pipe?.name||game.surface?.ramp?.name):null;
  $('ride-state').textContent=game.bailTime>0?'WIPEOUT':game.pipeRide?'PIPE WALL RIDE':game.lipMove?'LIP GRAB 180':game.grinding?(game.grinding.kind==='coping'?'COPING GRIND':'WATER SLIDE'):game.airborne?'AIRBORNE':game.barrel?.inside?'IN THE BARREL':game.cutback>0?'SNAP CUTBACK':isParkMode()?(surface||'WATERWORKS'):game.launchSource==='lip'?'AT THE WAVE LIP':'ON THE FACE';
  const popCooldown=game.popCooldown||0,powered=!isParkMode()&&game.launchSource!=='flat';
  $('pop-label').textContent=game.bailTime>0?'RECOVERING':game.airborne?'LAND TO RECOVER POP':game.lipMove?'FINISH LIP TURN':game.pipeRide&&!game.popReady?'RETURN TO PIPE FLOOR':popCooldown>0?`POP RECOVERY · ${popCooldown.toFixed(1)}s`:game.cutbackActive?(isParkMode()?'CUTBACK · TURNING':'CUTBACK · SETTING UP AIR'):isParkMode()?'POP READY':game.launchSource==='cutback'?`CUTBACK AIR · ${game.cutbackLaunchTime.toFixed(1)}s`:game.launchSource==='lip'?'LIP LAUNCH READY':'FIND LIP / CUT BACK';
  if(game.isRace&&game.countdownRemaining>0)$('pop-label').textContent='WAIT FOR GO · HOLD SPACE TO POP';
  else if(game.isRace&&game.popReady&&!game.airborne&&!game.pipeRide&&!game.lipMove&&!game.cutbackActive)$('pop-label').textContent='POP READY · LAND A TRICK TO BOOST';
  $('pop-ready-bar').style.width=`${game.popRecoveryDuration>0?Math.max(0,1-popCooldown/game.popRecoveryDuration)*100:100}%`;
  $('pop-status').classList.toggle('cooling',popCooldown>0);$('pop-status').classList.toggle('powered',powered&&game.popReady);
  if(game.airJumpReady)$('pop-label').textContent=adminSettings.enabled?'SPACE FOR EXTRA AIR JUMP':'SKYBOUND · SPACE FOR SECOND AIR';
  const reward=getRewardBoard(profile.rewardBoard);
  $('reward-ride-status').textContent=adminSettings.enabled?`${reward?.name||'STANDARD BOARD'} · CUSTOM STATS`:reward?`${reward.name} · ${reward.buffLabel}`:'';
  $('reward-ride-status').classList.toggle('hidden',!reward&&!adminSettings.enabled);
  $('charge-label').textContent=isParkMode()?'LOAD THE POP':game.launchSource==='cutback'?'LOAD CUTBACK AIR':game.launchSource==='lip'?'LOAD LIP LAUNCH':'FLAT HOP · FIND THE LIP';
  if(game.isRace)$('charge-label').textContent='LOAD THE POP · J THEN L FOR COMBO';
  $('charge-wrap').classList.toggle('hidden',game.charge<=.01||game.airborne||game.bailTime>0||popCooldown>0);$('charge-bar').style.width=`${game.charge*100}%`;
  $('combo').classList.toggle('hidden',!game.comboBase);$('combo-base').textContent=fmt(game.comboBase);$('multiplier').textContent=`×${game.multiplier}`;
  $('tricks').textContent=game.comboNames.slice(-4).join(' + ')+(game.trick?` + ${game.trick.name}…`:'');
  $('combo-time').style.width=`${game.airborne||game.grinding||game.pipeRide||game.lipMove?100:Math.max(0,game.comboTime/game.comboWindow*100)}%`;
  $('combo-caption').textContent=game.pipeRide?'A / D TO LOOP · RELEASE E TO EXIT':game.lipMove?'GRAB · TURN · DROP BACK IN':game.airborne?'LAND IT!':game.grinding?'SPACE TO POP OUT':'SPACE TO LINK · ENTER TO BANK';
  const followups=COMBO_ANIMATIONS.filter(combo=>combo.sequence[0]===game.lastCompletedTrickType);
  if(game.trick?.comboAnimationName)$('combo-caption').textContent=`${game.trick.comboAnimationName} · LAND IT!`;
  else if(followups.length&&!game.trick&&!game.pipeRide&&!game.lipMove&&!game.grinding)$('combo-caption').textContent=`${game.airborne?'NEXT':'NEXT AIR'}: ${followups.map(combo=>combo.keys[1]).join(' / ')} · ${followups.length===1?followups[0].name:'COMBO MOVES'}`;
  $('special-fill').style.width=`${special.value*100}%`;$('special-fill').parentElement.classList.toggle('is-full',special.ready);
  if($('special-label'))$('special-label').textContent=special.ready?'100% READY · I':`SPECIAL ${Math.floor(special.value*100)}%`;
  const complete=completedGoals();['goal-score','goal-combo','goal-gates'].forEach((id,i)=>{$(id).classList.toggle('complete',complete[i]);if(!game.isTournament&&!game.isTimeTrial&&complete[i]&&!challengeFlags[i]){challengeFlags[i]=true;toast('CHALLENGE COMPLETE!');}});
  $('goal-gates').querySelector('span').textContent=isParkMode()?`Hit 5 ramps (${Math.min(5,game.visitedRamps.size)}/5)`:selectedMode==='rush'?`Checkpoints (${Math.min(12,game.gates)}/12)`:selectedMode==='storm'?`Barrel rides (${Math.min(3,game.barrelsSurvived||0)}/3)`:`Sun rings (${Math.min(6,game.gates)}/6)`;
  if(game.isTimeTrial){
    $('rival-name').textContent=`${String(game.trialIndex+1).padStart(2,'0')} / ${game.trial.name}`;
    $('rival-score').textContent=`TARGET ${trialTime(game.trial.timeLimit)}`;
    $('rival-target').textContent=`${fmt(game.distanceRemaining)}m TO FINISH · SUN RINGS ${game.nextCheckpoint}/${game.course.checkpoints.length}`;
    $('rival-gap').textContent=`ELAPSED ${trialTime(game.elapsed)}`;
    $('rival-hud').classList.toggle('ahead',game.time>0);
    $('race-player-progress').style.width=`${Math.max(0,Math.min(100,game.raceProgress/game.course.length*100))}%`;
  }
  if(game.isTournament){
    $('rival-name').textContent=`L${game.ladderIndex+1} · #${game.rival.rank} ${game.rival.name}`;
    const gap=game.isRace?game.lead:game.score-game.rivalScore;
    $('rival-score').textContent=game.isRace?`${game.racePosition===1?'1ST':'2ND'} / 2`:fmt(game.rivalScore);
    $('rival-target').textContent=game.isRace?`${fmt(game.distanceRemaining)}m TO FINISH · CHECKPOINTS ${game.nextCheckpoint}/${game.course.checkpoints.length}`:`FINAL SCORE ${fmt(game.target)} · HEAT ${game.roundNumber}/5`;
    $('rival-gap').textContent=Math.abs(gap)<.5?(game.isRace?'SIDE BY SIDE':'LEVEL SCORES'):gap>0?`LEADING BY ${fmt(gap)}${game.isRace?'m':''}`:`${fmt(-gap)}${game.isRace?'m':''} BEHIND`;
    $('rival-hud').classList.toggle('ahead',gap>0);
    if(game.isRace){
      $('race-player-progress').style.width=`${Math.max(0,Math.min(100,game.raceProgress/game.course.length*100))}%`;$('race-rival-progress').style.width=`${Math.max(0,Math.min(100,game.opponentRaceProgress/game.course.length*100))}%`;
      const rival=game.opponent,rivalBoost=rival.boostTime>0;
      $('rival-action-label').textContent=rival.bailTime>0?'WIPEOUT':rival.trick?`${rival.trick.comboAnimationName||rival.trick.name}…`:rivalBoost?`${rival.boostLabel} · +${Math.round(rival.boostSpeed*3.6)} KM/H`:rival.airborne?'IN THE AIR':rival.charge>.1?'LOADING A TRICK':'ON THE LINE';
      $('rival-action').classList.toggle('boosting',rivalBoost);
      $('rival-action').classList.toggle('combo-boost',rivalBoost&&rival.boostLevel==='combo');
      $('rival-boost-fill').style.width=`${rivalBoost?Math.min(100,rival.boostTime/rival.boostDuration*100):0}%`;
    }
  }
  if(isParkMode())parkMap?.update(game);
  if(!isParkMode()||game.isRace) {
    $('surf-objective').textContent=game.isTimeTrial?`BEAT ${trialTime(game.trial.timeLimit)} · EVERY SUN RING REQUIRED`:game.isRace?`${game.racePosition===1?'1ST':'2ND'} PLACE · BEAT ${game.rival.name} TO THE FINISH`:selectedMode==='storm'?`${'◆'.repeat(Math.max(0,game.lives))}${'◇'.repeat(3-Math.max(0,game.lives))} LIVES · SWELL ${game.stormStage||1} · ENDLESS`:selectedMode==='rush'?`CHECKPOINTS ${game.gates} / 12 · +8 SEC EACH`:'SURF SESSION · KEEP YOUR LINE';
    const tube=game.barrel,barrelHint=tube?.inside?'BARREL RIDE · HOLD THE OPEN LINE':tube&&tube.startDistance-game.distance<70?(game.x>tube.x+1.5?'BARREL AHEAD · CARVE LEFT':game.x<tube.x-1.5?'BARREL AHEAD · CARVE RIGHT':'BARREL AHEAD · HOLD YOUR LINE'):'';
    const nextGate=game.isRace?game.course.checkpoints[game.nextCheckpoint]:null;
    let raceHint=nextGate?`SUN RING ${game.nextCheckpoint+1} · ${fmt(Math.max(0,nextGate.distance-game.distance))}m · ${game.x<nextGate.x-nextGate.radius*.6?'STEER RIGHT':game.x>nextGate.x+nextGate.radius*.6?'STEER LEFT':'HOLD YOUR LINE'}`:game.isRace?'FINISH AHEAD · W TO PUMP':'';
    if(nextGate&&isParkMode()){
      const dx=nextGate.x-game.x,dz=nextGate.z-game.z,angle=Math.atan2(-dx,-dz)-game.heading;
      const turn=Math.atan2(Math.sin(angle),Math.cos(angle));
      raceHint=`SUN RING ${game.nextCheckpoint+1} · ${fmt(Math.hypot(dx,dz))}m · ${Math.abs(turn)>2?'TURN BACK':turn>.2?'LEFT ◀':turn<-.2?'RIGHT ▶':'STRAIGHT AHEAD'}`;
    }
    $('surf-warning').textContent=game.bailTime>0?'RECOVERING…':game.hazardWarning||game.landingWarning||game.barrelWarning||barrelHint||((game.danger||0)>.6?(Math.abs(game.x)>13?'WAVE EDGE · STEER BACK IN':'REEF AHEAD · CHANGE YOUR LINE'):raceHint||'SHIFT + A / D · CUTBACK');
    $('risk-fill').style.width=`${(game.danger||0)*100}%`;
    $('surf-condition').classList.toggle('danger',(game.danger||0)>.65);
  }
}

adminPanel=createAdminPanel({getState:()=>({settings:adminSettings,profile}),onApply:applyAdminSettings,onGiveEverything:giveEverything,onFullReset:fullReset,onClose:clearInput});
keydownHandler=createKeydownHandler(
  ()=>({bootReady:bootReady&&!wasted.active,workshopMode,modalMode,game,input,homeScreen:adminHomeScreen(),adminOpen:adminPanel.isOpen}),
  {toggleSound,closeWorkshop,cycleCharacter,closeModal,startRun,restartRun,pause,tryTrick,toast,openAdmin,
    isWardrobeOpen:()=>!$('wardrobe').classList.contains('hidden'),
    hideWardrobe:()=>$('wardrobe').classList.add('hidden'),
    rotatePreview:delta=>preview?.rotate(delta),
    pressControl:code=>{pressed.add(code);syncInput();}}
);
window.addEventListener('keydown',keydownHandler);
window.addEventListener('keyup',e=>{if(!bootReady||wasted.active||adminPanel.isOpen||!keyMap[e.code])return;const wasJump=input.jump;pressed.delete(e.code);syncInput();if(e.code==='Space'&&wasJump&&!input.jump&&game.phase==='running')tryPop();});
window.addEventListener('blur',()=>{clearInput();if(game?.phase==='running')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(game?.phase==='running')pause();}});
document.addEventListener('pointerdown',event=>{if(!bootReady||event.target.closest('#sound'))return;if(game?.phase==='ready'&&soundPreference!=='off'&&!audio.enabled){audio.setScene('menu');audio.enable().then(updateSoundLabel);}},{capture:true});
$('start').addEventListener('click',startRun);$('restart').addEventListener('click',restartRun);$('pause').addEventListener('click',pause);$('help').addEventListener('click',showHelp);$('sound').addEventListener('click',toggleSound);
$('ladder-button').addEventListener('click',showLadder);
$('race-ladders').addEventListener('click',showLadder);
$('trial-button').addEventListener('click',showTrials);
$('race-trials').addEventListener('click',showTrials);
$('standard-board').addEventListener('click',()=>setProfile({rewardBoard:null}));
$('modal-content').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.openTrials!==undefined){selectMode('trials');goHome();showTrials();return;}
  if(button.dataset.trialEquip){equipTrialSet(button.dataset.trialEquip);return;}
  if(button.dataset.trial!==undefined){const next=selectTimeTrial(trialProgress,Number(button.dataset.trial));if(next){trialProgress=next;write('breakline99-trials-v1',JSON.stringify(next));goHome();showTrials();}return;}
  if(button.dataset.resetLadder!==undefined){resetCurrentLadder();return;}
  if(button.dataset.rewardBoard&&setProfile({rewardBoard:button.dataset.rewardBoard})){if(modalMode==='trials')showTrials();else if(game.isTimeTrial)showTrialResults();else showTournamentResults();}
  if(button.dataset.ladder!==undefined){
    const next=selectTournamentLadder(tournamentProgress,Number(button.dataset.ladder));
    if(next){tournamentProgress=next;write('breakline99-tournament-v2',JSON.stringify(next));goHome();showLadder();}
  }
});
$('modal-home').addEventListener('click',goHome);
$('modal-action').addEventListener('click',()=>['results','ladder','trials'].includes(modalMode)?startRun():modalMode==='graphics'?location.reload():closeModal());
$('quality').addEventListener('click',()=>{$('quality').textContent=world.toggleQuality()?'VIDEO: 1999':'VIDEO: CLEAN';});
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();goHome();});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>selectMode(b.dataset.mode)));
$('park-start').addEventListener('change',e=>{selectedParkStart=e.target.value;write('breakline99-park-start',selectedParkStart);});
$('menu-characters').addEventListener('click',()=>openWorkshop('character'));$('menu-board').addEventListener('click',()=>openWorkshop('board'));$('workshop-close').addEventListener('click',closeWorkshop);
$('workshop-accept').addEventListener('click',closeWorkshop);$('workshop-back').addEventListener('click',closeWorkshop);
$('previous-character').addEventListener('click',()=>cycleCharacter(-1));$('next-character').addEventListener('click',()=>cycleCharacter(1));
$('rotate-left').addEventListener('click',()=>preview?.rotate(-.5));$('rotate-right').addEventListener('click',()=>preview?.rotate(.5));
$('wardrobe-toggle').addEventListener('click',()=>$('wardrobe').classList.toggle('hidden'));$('wardrobe-close').addEventListener('click',()=>$('wardrobe').classList.add('hidden'));
document.querySelectorAll('[data-workshop]').forEach(b=>b.addEventListener('click',()=>openWorkshop(b.dataset.workshop)));
$('workshop').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.character)setProfile({character:b.dataset.character});if(b.dataset.outfit)setProfile({outfit:b.dataset.outfit});if(b.dataset.boardColor)setProfile({boardColor:b.dataset.boardColor,rewardBoard:null});if(b.dataset.boardDesign)setProfile({boardDesign:b.dataset.boardDesign,rewardBoard:null});if(b.dataset.rewardBoard)setProfile({rewardBoard:b.dataset.rewardBoard});});

try{
  await paintLoadingStage();
  await loadCharacterTextures();
  loading.set(40,'BUILDING YOUR SESSION','Preparing the coast, wave ramps and Waterworks.');
  await paintLoadingStage();
  world=new SurfWorld($('viewport'),profile);
  menuSurfer=new MenuSurferPreview($('home-surfer-preview'),profile);
  loading.set(78,'SETTING YOUR LINE','Getting your surfer, board and session ready.');
  await paintLoadingStage();
  parkMap=new ParkMap($('park-map-canvas'));makeGame();updateModeMenu();renderCustomizationChoices();updateSoundLabel();
  loading.set(92,'WARMING UP THE WATER','Drawing the first frame. Almost there.');
  await paintLoadingStage();
  world.update(0,game);menuSurfer.update(0);updateHud();
  await paintLoadingStage();
  bootReady=await loading.finish();
  if(!bootReady)throw new Error('Startup stopped before the menu was ready.');
  let previous=performance.now(),accumulator=0,hudTime=0,animationId;
  const frame=now=>{
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(game.phase==='running'&&!workshopMode){accumulator+=dt;while(accumulator>=1/120){game.update(1/120,input);accumulator-=1/120;}special.update(dt);}else accumulator=0;
    world.update(wasted.active?0:dt,game);wasted.update(dt);if(workshopMode)preview.update(dt,workshopMode);
    if(!document.hidden&&!workshopMode&&!modalMode&&!$('intro').classList.contains('hidden'))menuSurfer.update(dt);
    if(game.isRace)audio.setRaceState({progress:game.raceProgress/game.course.length,boost:game.boostTime>0?game.boostSpeed/13:0});
    audio.update(!document.hidden&&(game.phase==='running'||game.phase==='ready'),game.mode);
    hudTime+=dt;if(hudTime>=.05){updateHud();hudTime=0;}
    if(toastTime>0&&game.phase==='running'){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');}
    animationId=requestAnimationFrame(frame);
  };animationId=requestAnimationFrame(frame);
  world.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();game.pause();clearInput();openModal('graphics','SIGNAL LOST','<p>The graphics connection was interrupted. Reload to start a fresh session.</p>','RELOAD GAME');});
  if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(animationId);adminPanel.dispose();wasted.destroy();world.dispose();preview?.dispose();menuSurfer?.dispose();audio.dispose();});
}catch(error){console.error(error);loading.fail();}
