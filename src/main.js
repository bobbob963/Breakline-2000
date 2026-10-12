import './style.css';
import './selection.css';
import './factory.css';
import './summer99.css';
import './survival.css';
import './classic-logo.css';
import './tournament.css';
import './wasted.css';
import { createTournamentGame, TOURNAMENT_RIVALS, sanitizeTournamentProgress } from './tournament.js';
import { createWastedSequence } from './wasted.js';
import { createClassicLogoCanvas } from './classic-logo.js';
import { brandLogo } from './brand-art.js';
import { SurfGame, COMBO_WINDOW, MIN_X, MAX_X, POP_COOLDOWN, waveCrest } from './game.js';
import { WaveParkGame, PARK_BOUNDS } from './park.js';
import { SpecialMeter } from './special.js';
import { COMBO_ANIMATIONS } from './combo-animations.js';
import { ParkMap } from './park-map.js';
import { SurfWorld } from './world.js';
import { ArcadeAudio } from './audio.js';
import { CHARACTERS, OUTFITS, BOARD_DESIGNS, validateProfile, CustomizationPreview } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';
import { createLoadingScreen, paintLoadingStage } from './loading-screen.js';
import { CONTROL_KEYS as keyMap, createKeydownHandler } from './keyboard.js';

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
let selectedMode=read('breakline99-mode','surf');
if(!['surf','park','rush','storm','tournament'].includes(selectedMode))selectedMode='surf';
let tournamentProgress;try{tournamentProgress=sanitizeTournamentProgress(JSON.parse(read('breakline99-tournament-v1','null')));}catch{tournamentProgress=sanitizeTournamentProgress(null);}
const isParkMode=()=>game?.mode==='park';
$('loading-tip').textContent={
  surf:'Hold SHIFT while turning to cut back. Earn air at the lip, then stick the landing.',
  park:'Hold SHIFT while turning for a sharp cutback. At a ramp lip, SHIFT catches the coping. E rides pipe walls.',
  rush:'Every checkpoint adds eight seconds. Keep your line and leave room to turn.',
  tournament:'Race RIVET and STATIC on the swell. Beat the other three rivals in Waterworks score battles.',
  storm:'Stay beneath the curling lip and ride out cleanly. Three lives. The swell keeps building.',
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
let world,game,preview,parkMap,modalMode=null,resumeAfterModal=false,workshopMode=null,toastTime=0;
let best=0,bestSurvival=Math.max(0,Number(read('breakline99-survival-time','0'))||0),newBest=false,challengeFlags=[false,false,false],soundPreference=read('breakline99-sound','auto');
let portraitKey='';
const wasted=createWastedSequence({stage:$('stage'),onStart:clearInput,onComplete:()=>{if(game?.phase==='finished'&&selectedMode==='storm')showResults();}});
const modeInfo={
  tournament:{name:'THE HIT LIST',level:'COAST + FACTORY / RIVAL CIRCUIT',description:'Five rivals. Three score battles. Two head-to-head surf races. Take every rank to own the circuit.'},
  rush:{name:'REEF RUSH',level:'CHECKPOINT COAST',description:'35 seconds to start. Every sun ring adds 8 seconds. Catch 12 to finish; a wipeout costs precious time.'},
  storm:{name:'STORM RIDER',level:'SQUALL POINT',description:'Three lives. No time limit. Ride inside curling barrels as the swell builds, the current strengthens and the storm closes in.'},
  surf:{name:'SURF SESSION',level:'SUNSET POINT',description:'Two minutes on the swell. Carve, launch off the lip and link tricks with more forgiving landings.'},
  park:{name:'THE WATERWORKS',level:'LOWER SEWAGE WORKS',description:'Deep beneath an abandoned factory. Ride the drainage canals, thread the rust tunnels and grind the old pipework.'},
};
function toast(text,bail=false){$('toast').textContent=text;$('toast').classList.toggle('bail',bail);$('toast').classList.add('visible');toastTime=2;}
function clearInput(){pressed.clear();for(const k in input)input[k]=false;}
function syncInput(){for(const name in input)input[name]=[...pressed].some(code=>keyMap[code]===name);}
function loadBest(){best=Math.max(0,Number(read(`breakline99-best-${selectedMode}`,selectedMode==='surf'?read('breakline99-best','0'):'0'))||0);}
function saveBest(){if(!game)return;if(selectedMode==='storm'&&game.elapsed>bestSurvival){bestSurvival=game.elapsed;write('breakline99-survival-time',String(bestSurvival));}if(game.score<=best)return;best=game.score;newBest=true;write(`breakline99-best-${selectedMode}`,String(best));}
function completedGoals(){return [game.score>=5000,game.bestCombo>=1500,isParkMode()?game.visitedRamps.size>=5:selectedMode==='rush'?game.gates>=12:selectedMode==='storm'?game.barrelsSurvived>=3:game.gates>=6];}
function goalNames(){return ['Score 5,000','Bank a 1,500 combo',isParkMode()?'Ride 5 different ramps':selectedMode==='rush'?'Finish 12 checkpoints':selectedMode==='storm'?'Ride through 3 barrels':'Catch 6 sun rings'];}
function onEvent(e){
  world?.onEvent(e,game);if(!(e.type==='finish'&&selectedMode==='storm'&&game?.lives===0))audio.event(e.type);
  if(e.type==='bank'){toast(`+${fmt(e.points)}  BANKED`);special.gain(e.points/12000);saveBest();}
  if(e.type==='trick')special.gain(.22);
  if(e.type==='trickStart'&&e.comboAnimationName)toast(e.comboAnimationName);
  if(e.type==='bail'){special.bail();toast(e.lost?`WIPEOUT! ${fmt(e.lost)} LOST`:e.reason,true);}
  if(e.type==='gate')toast(selectedMode==='rush'?`CHECKPOINT ${game.gates}/12 · +8 SEC`:'SUN RING +250');
  if(e.type==='raceGate'&&!e.opponent)toast(`CHECKPOINT ${game.nextCheckpoint}/${game.course.checkpoints.length}`);
  if(e.type==='raceMiss'&&!e.opponent)toast('MISSED CHECKPOINT · LINE UP BETWEEN THE FLAGS',true);
  if(e.type==='raceGo')toast('GO! · W TO PUMP');
  if(e.type==='cutback')toast(isParkMode()?'SHARP CUTBACK':'CUTBACK SET · POP FOR AIR!');
  if(e.type==='grind')toast('WATER SLIDE!');
  if(e.type==='land')toast(e.assisted?'SAVED LANDING!':game.mode==='surf'&&game.airLaunchSource==='flat'?'BACK ON THE FACE':'LANDED! KEEP IT GOING');
  if(e.type==='barrelExit'){toast(`BARREL RIDE · +${fmt(e.points||0)}`);saveBest();}
  if(e.type==='start')toast(game?.isRace?`${game.rival.name} · FIRST TO THE FINISH`:isParkMode()?'THE WATERWORKS · DROP IN':'DROP IN!');
  if(e.type==='finish'){saveBest();if(game.isTournament){tournamentProgress=game.getProgress();write('breakline99-tournament-v1',JSON.stringify(tournamentProgress));showResults();}else if(selectedMode==='storm'&&game.lives===0&&game.wipeouts>=3){clearInput();wasted.start();}else showResults();}
}
function makeGame(){game=selectedMode==='tournament'?createTournamentGame(onEvent,tournamentProgress):selectedMode==='park'?new WaveParkGame(onEvent):new SurfGame(onEvent,selectedMode);world.setMode(game.mode);audio.setMode(game.mode);audio.setScene('menu');loadBest();}
function updateModeMenu(){
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===selectedMode;b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));const label=b.querySelector('.mode-status');if(label)label.textContent=active?'▶ SELECTED':'▶ SELECT MODE';});
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
  $('timer-label').textContent=game.isRace?'RACE TIME':selectedMode==='storm'?'SURVIVED':'TIME';
  $('surf-condition').classList.toggle('hidden',isParkMode());
  $('rival-hud').classList.toggle('hidden',!game.isTournament);
  document.querySelector('.goals').classList.toggle('hidden',game.isTournament);
  $('ladder-button').classList.toggle('hidden',!game.isTournament);
  $('start').querySelector('span').textContent=game.isTournament?(game.complete?'NEW LADDER':`CHALLENGE ${game.rival.name}`):'DROP IN';
  $('rival-hud').classList.toggle('race-hud',!!game.isRace);
  $('rival-hud').querySelector('small').textContent=game.isRace?'THE HIT LIST / HEAD-TO-HEAD RACE':'THE HIT LIST / RECORDED RIVAL RUN';
  $('race-progress').classList.toggle('hidden',!game.isRace);
  if(game.isTournament){
    $('session-badge').textContent=`${game.complete?'CHAMPION':`RANK #${game.rival.rank}`} / ${game.isRace?'SURF RACE':'90 SEC SCORE BATTLE'}`;
    $('level-name').textContent=game.isRace?'SUNSET POINT / RIVAL RACE':'WATERWORKS / SCORE BATTLE';
    $('mode-description').textContent=game.complete?'The circuit is yours. Start a new ladder or inspect the rivals you defeated.':game.isRace?`${game.rival.name} is riding beside you. Pump with W, steer through every flagged checkpoint and reach the ${fmt(game.course.length)}m finish first.`:`${game.rival.name} · ${game.rival.subtitle}. Bank more than ${fmt(game.target)} points in 90 seconds to take their rank.`;
  }

}
function selectMode(mode){if(!modeInfo[mode])return;selectedMode=mode;write('breakline99-mode',mode);clearInput();makeGame();updateModeMenu();updateSoundLabel();}
function updateSoundLabel(){
  $('sound').textContent=audio.enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-label',audio.enabled?'Mute audio':'Enable audio');
  if($('music-track'))$('music-track').textContent=audio.enabled?`♫ ${audio.trackName.toUpperCase()}`:'M · TURN UP THE RADIO';
}
async function toggleSound(){await audio.toggle();soundPreference=audio.enabled?'on':'off';write('breakline99-sound',soundPreference);updateSoundLabel();}
function startRun(kind='default'){
  wasted.reset();closeWorkshop();closeModal(false);clearInput();newBest=false;challengeFlags=[false,false,false];special.reset();
  if(soundPreference!=='off'&&!audio.enabled)audio.enable().then(updateSoundLabel);
  audio.setScene('ride');
  if(game.isTournament){
    if(kind!=='retry'&&game.complete&&(game.phase==='ready'||game.result==='win')){tournamentProgress=sanitizeTournamentProgress(null);write('breakline99-tournament-v1',JSON.stringify(tournamentProgress));game=createTournamentGame(onEvent,tournamentProgress);game.start();}
    else if(kind!=='retry'&&game.phase==='finished'&&game.result==='win'){game=createTournamentGame(onEvent,game.getProgress());game.start();}
    else game.retry();
  }else game.start(selectedMode==='park'?selectedParkStart:undefined);
  world.setMode(game.mode);audio.setMode(game.mode);updateModeMenu();updateSoundLabel();$('intro').classList.add('hidden');$('hud').classList.remove('hidden');document.body.classList.add('playing');$('stage').focus({preventScroll:true});
}
function restartRun(){startRun('retry');}
function goHome(){
  wasted.reset();saveBest();closeWorkshop();closeModal(false);clearInput();special.reset();makeGame();
  $('hud').classList.add('hidden');$('intro').classList.remove('hidden');document.body.classList.remove('playing');updateModeMenu();updateSoundLabel();$('start').focus({preventScroll:true});
}
function openModal(mode,title,content,action,kicker='BREAKLINE ’99'){
  $('modal').dataset.mode=mode;
  const active=game.phase==='running';if(active){game.pause();clearInput();}if(!modalMode)resumeAfterModal=active;
  modalMode=mode;$('modal-title').textContent=title;$('modal-kicker').textContent=kicker;$('modal-content').innerHTML=content;$('modal-action').textContent=action;
  $('modal').classList.remove('hidden');$('modal-action').focus({preventScroll:true});
}
function closeModal(resume=true){$('modal').classList.add('hidden');modalMode=null;if(resume&&resumeAfterModal)game.resume();resumeAfterModal=false;$('stage').focus({preventScroll:true});}
function pause(){if(workshopMode){closeWorkshop();return;}if(modalMode==='pause'||modalMode==='help'){closeModal();return;}if(game.phase!=='running')return;openModal('pause','PAUSED','<p>The clock is stopped. Your line is waiting.</p><p><kbd>P</kbd> / <kbd>ESC</kbd> resume · <kbd>R</kbd> restart</p>','KEEP RIDING','TIME OUT');}
function showHelp(){
  if(modalMode==='help'){closeModal();return;}
  openModal('help','HOW TO RIDE',`<div class="controls-grid">
  <span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></span><span>${isParkMode()?'Steer around the park.':'Carve across the wave. The high lip is left.'}</span>
  <span><kbd>W</kbd> / <kbd>↑</kbd></span><span>${isParkMode()?'Pump to build speed.':'Pump for more speed.'} <kbd>S</kbd> / <kbd>↓</kbd> slows down.</span>
  <span><kbd>SPACE</kbd></span><span>${isParkMode()?'Hold to crouch and build speed, then release to pop.':'Hold, then release to pop.'} Recover on the water for 1.4 seconds between pops. ${isParkMode()?'Ride the ramps for bigger airs; wave lips also launch you automatically.':'Flat hops earn no points. Reach the wave lip or finish a cutback, then pop for trick height.'}</span>
  ${isParkMode()?'<span><kbd>E</kbd> + <kbd>A</kbd> / <kbd>D</kbd></span><span>Hold E inside a tunnel; steer around its walls for a full pipe loop. Release E to return to the floor.</span><span><kbd>E</kbd> / <kbd>SHIFT</kbd></span><span>Hold E as you ride up a quarterpipe to grab the board and turn back. Hold SHIFT instead to grind the coping directly—no jump needed. A/D chooses the grind direction.</span>':''}
  <span><kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd></span><span>180 spin / kickflip / Indy grab. One trick at a time, in the air.</span>
  <span><kbd>U</kbd> <kbd>O</kbd></span><span>Shuv-it / heelflip.</span>
  <span><kbd>H</kbd> <kbd>F</kbd></span><span>Method air / 360 air.</span>
  <span><kbd>B</kbd></span><span>Tweaked grab: tuck your knees, pull the surfboard to your side and raise the free arm.</span>
  <span><kbd>SHIFT</kbd> + <kbd>A</kbd> / <kbd>D</kbd></span><span>${isParkMode()?'Make a sharp cutback while riding. Near the top of a quarterpipe, Shift catches the coping instead.':'Turn while holding Shift to snap a cutback on the wave face.'} Release and turn again for another cutback. C also works.</span>
  <span><kbd>I</kbd></span><span>Rodeo Air at 100% SPECIAL. Once full, it stays ready until used—even through a wipeout.</span>
  <span><kbd>ENTER</kbd></span><span>Bank a landed combo. Pop again within 3.8 seconds to link another air.</span>
  <span><kbd>P</kbd> <kbd>R</kbd> <kbd>M</kbd></span><span>Pause / restart / music. ESC also pauses.</span></div>
  <section class="combo-guide"><h3>CUSTOM COMBO MOVES</h3><p>Finish the first trick, then press the second key while airborne. Keep the combo unbanked to link them across separate jumps.</p><dl>${COMBO_ANIMATIONS.map(combo=>`<div><dt>${combo.keys.map(key=>`<kbd>${key}</kbd>`).join(' → ')} <strong>${combo.name}</strong></dt><dd>${combo.description}</dd></div>`).join('')}</dl></section>
  <p class="help-tip">Landings allow small sideways drifts and a short grace period for almost-finished tricks. Start your moves early; a badly unfinished trick still loses the combo. ${isParkMode()?'Jump onto a pipe or rail along its length to grind. Rail sides are solid. Ride through the open rust tunnels, or use their approach ramps to reach the top.':'Use A/D to hold your line and S to settle a rough landing. In Storm Rider, follow the opening under a curling wave to ride the barrel. You have three lives and no time limit; stronger currents, faster riding and tighter barrels build as you survive.'}</p>
`,'GOT IT','CONTROLS');
}
function showResults(){
  if(game.isTournament){showTournamentResults();return;}
  clearInput();const complete=completedGoals(),stars=complete.filter(Boolean).length;const rank=['GROM','LOCAL','LINEUP LEGEND','COAST ROYALTY'][stars];
  openModal('results',game.resultReason||'SESSION OVER',`<div class="results-score">${fmt(game.score)}</div><p>${newBest?'NEW RECORD! · ':''}${rank} · ${stars}/3 CHALLENGES</p>
  <div class="results-stats"><span>BEST COMBO<b>${fmt(game.bestCombo)}</b></span><span>TRICKS BANKED<b>${game.landedTricks}</b></span><span>${isParkMode()?'RAMPS / SLIDES':'SUN RINGS'}<b>${isParkMode()?`${game.visitedRamps.size} / ${game.grindCount}`:game.gates}</b></span><span>WIPEOUTS<b>${game.wipeouts}</b></span></div>
  <div class="result-goals">${goalNames().map((name,i)=>`${complete[i]?'◆':'◇'} ${name}`).join('<br>')}</div>${selectedMode==='storm'?`<p class="survival-result">SURVIVED <b>${clockText(game.elapsed)}</b> · SWELL ${game.stormStage||1}<br>BEST SURVIVAL: ${clockText(bestSurvival)} · BARRELS: ${game.barrelsSurvived||0}</p>`:''}<p>PERSONAL BEST SCORE: ${fmt(best)}</p>`,'RIDE AGAIN',modeInfo[selectedMode].name);
}

function ladderRows(){return `<ol class="rival-ladder">${TOURNAMENT_RIVALS.map((r,i)=>`<li class="${i<tournamentProgress.completedRounds?'beaten':i===game.roundIndex?'current':'locked'}"><b>#${r.rank}</b><div><strong>${r.name}</strong><span>${r.event==='race'?'SURF SESSION · HEAD-TO-HEAD':'WATERWORKS · SCORE BATTLE'}</span></div><div class="rival-target"><strong>${r.event==='race'?`${fmt(r.courseLength)}m`:fmt(r.target)}</strong><span>${i<tournamentProgress.completedRounds?'DEFEATED':i===game.roundIndex?'YOUR NEXT RIVAL':'LOCKED'}</span></div></li>`).join('')}</ol>`;}
function showLadder(){openModal('ladder','THE HIT LIST',`<p class="rival-intro">Take on RIVET and STATIC in live Surf Session races. Beat MOXIE, UNDERTOW and KINGTIDE in 90-second Waterworks score battles.</p>${ladderRows()}<p class="rival-footnote">Races: pass every flagged checkpoint and finish first. Score battles: bank more points than the rival. Your ranks save automatically.</p>`,game.complete?'NEW LADDER':`CHALLENGE ${game.rival.name}`,'COAST + FACTORY / RIVAL CIRCUIT');}
function showTournamentResults(){
  clearInput();const win=game.result==='win';
  if(game.isRace){
    const finished=game.finishTime!=null,opponentFinished=game.opponentFinishTime!=null;
    openModal('results',game.resultReason,`<div class="showdown-result ${win?'won':'lost'}"><span>RANK #${game.rival.rank} / ${game.rival.name} · SURF RACE</span><div><section><small>YOU</small><strong>${win?'1ST':'2ND'}</strong><small>${finished?clockText(game.finishTime):`${fmt(game.distanceRemaining)}m TO FINISH`}</small></section><b>VS</b><section><small>${game.rival.name}</small><strong>${win?'2ND':'1ST'}</strong><small>${opponentFinished?clockText(game.opponentFinishTime):`${fmt(Math.max(0,game.course.length-game.opponent.distance))}m TO FINISH`}</small></section></div><p>${win?`RANK CLAIMED. NEXT UP: ${TOURNAMENT_RIVALS[game.roundIndex+1].name}.`:'PUMP WITH W, KEEP A CLEAN LINE AND PASS EVERY CHECKPOINT.'}</p></div><div class="results-stats"><span>COURSE<b>${fmt(game.course.length)}m</b></span><span>CHECKPOINTS<b>${game.nextCheckpoint} / ${game.course.checkpoints.length}</b></span><span>WIPEOUTS<b>${game.wipeouts}</b></span><span>RIVALS BEATEN<b>${tournamentProgress.completedRounds} / 5</b></span></div><p class="rival-footnote">Head-to-head Surf Session race · First across the finish wins.</p>`,win?'NEXT RIVAL':'RETRY RIVAL','THE HIT LIST / SURF RACE');return;
  }
  openModal('results',game.resultReason,`<div class="showdown-result ${win?'won':'lost'}"><span>RANK #${game.rival.rank} / ${game.rival.name}</span><div><section><small>YOUR BANKED SCORE</small><strong>${fmt(game.score)}</strong></section><b>VS</b><section><small>${game.rival.name}</small><strong>${fmt(game.target)}</strong></section></div><p>${win?(game.complete?'ALL FIVE RIVALS DEFEATED. THE CIRCUIT IS YOURS.':`RANK CLAIMED. NEXT UP: ${TOURNAMENT_RIVALS[game.roundIndex+1].name}.`):game.score===game.target?'TIED SCORE. THE RIVAL KEEPS THEIR RANK.':'BANK A BIGGER SCORE TO TAKE THIS RANK.'}</p></div><div class="results-stats"><span>BEST COMBO<b>${fmt(game.bestCombo)}</b></span><span>TRICKS BANKED<b>${game.landedTricks}</b></span><span>WIPEOUTS<b>${game.wipeouts}</b></span><span>RIVALS BEATEN<b>${tournamentProgress.completedRounds} / 5</b></span></div><p class="rival-footnote">Recorded rival score · 90-second heat · Unlanded combos do not count.</p>`,win?(game.complete?'NEW LADDER':'NEXT RIVAL'):'RETRY RIVAL','THE HIT LIST / SHOWDOWN');
}

function renderCustomizationChoices(){
  $('outfit-options').innerHTML=Object.entries(OUTFITS).map(([key,v])=>`<button class="outfit-button" data-outfit="${key}" aria-pressed="false"><strong>${v.name}</strong><span>${v.description}</span></button>`).join('');
  const icons={bolt:'ϟ',checker:'▦',flames:'♨',tribal:'≋',hibiscus:'✿',skull:'☠',sunburst:'✺',pinstripe:'///'};
  $('board-design-options').innerHTML=Object.entries(BOARD_DESIGNS).map(([key,v])=>`<button class="design-button" data-board-design="${key}" aria-pressed="false"><span class="design-symbol">${icons[key]}</span><strong>${v.name}</strong></button>`).join('');
  updateCustomizationChoices();
}
function updateCustomizationChoices(){
  for(const [selector,field] of [['[data-character]','character'],['[data-outfit]','outfit'],['[data-board-color]','boardColor'],['[data-board-design]','boardDesign']]){
    document.querySelectorAll(selector).forEach(b=>{const active=b.getAttribute(selector.slice(1,-1))===profile[field];b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));});
  }
  $('character-name').textContent=`${CHARACTERS[profile.character].name} / ${OUTFITS[profile.outfit].name}`;
  $('board-name').textContent=BOARD_DESIGNS[profile.boardDesign].name;
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
function setProfile(patch){profile=validateProfile({...profile,...patch});write('breakline99-profile',JSON.stringify(profile));world.setProfile(profile);preview?.setProfile(profile);updateCustomizationChoices();}
function openWorkshop(mode){
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
function tryTrick(type){if(game.mode==='surf'&&game.airborne&&game.airLaunchSource==='flat'){toast('NEED AIR · CUT BACK OR RIDE THE LIP');return;}if(type==='special'&&!special.ready){if(game.airborne)toast('BUILD YOUR SPECIAL METER');return;}if(game.doTrick(type)&&type==='special'){special.consume();toast('RODEO AIR!');}}
function tryPop(){if(!game.jump()&&!game.airborne&&game.bailTime<=0&&game.popCooldown>0)toast(`POP RECOVERING · ${game.popCooldown.toFixed(1)}s`);}
function updateHud(){
  $('score').textContent=pad(game.score);$('best').textContent=pad(best);
  $('timer').textContent=clockText(selectedMode==='storm'||game.isRace?game.elapsed:Math.ceil(game.time));$('timer').parentElement.classList.toggle('urgent',selectedMode!=='storm'&&!game.isRace&&game.time<=20);
  const counting=game.isRace&&game.phase==='running'&&game.countdownRemaining>0;
  $('race-countdown').classList.toggle('hidden',!counting);
  if(counting)$('race-countdown-number').textContent=Math.ceil(game.countdownRemaining);
  $('speed').textContent=Math.round(game.speed*3.6);$('speed-bar').style.width=`${Math.min(100,game.speed/25*100)}%`;
  $('wave-dot').style.left=`${isParkMode()?(game.x-PARK_BOUNDS.minX)/(PARK_BOUNDS.maxX-PARK_BOUNDS.minX)*96:(game.x-MIN_X)/(MAX_X-MIN_X)*96}%`;
  $('wave-dot').parentElement.style.setProperty('--crest-position',`${(waveCrest(-game.distance,game.elapsed)-MIN_X)/(MAX_X-MIN_X)*96}%`);
  const surface=isParkMode()?(game.surface?.pipe?.name||game.surface?.ramp?.name):null;
  $('ride-state').textContent=game.bailTime>0?'WIPEOUT':game.pipeRide?'PIPE WALL RIDE':game.lipMove?'LIP GRAB 180':game.grinding?(game.grinding.kind==='coping'?'COPING GRIND':'WATER SLIDE'):game.airborne?'AIRBORNE':game.barrel?.inside?'IN THE BARREL':game.cutback>0?'SNAP CUTBACK':isParkMode()?(surface||'WATERWORKS'):game.launchSource==='lip'?'AT THE WAVE LIP':'ON THE FACE';
  const popCooldown=game.popCooldown||0,powered=!isParkMode()&&game.launchSource!=='flat';
  $('pop-label').textContent=game.bailTime>0?'RECOVERING':game.airborne?'LAND TO RECOVER POP':game.lipMove?'FINISH LIP TURN':game.pipeRide&&!game.popReady?'RETURN TO PIPE FLOOR':popCooldown>0?`POP RECOVERY · ${popCooldown.toFixed(1)}s`:game.cutbackActive?(isParkMode()?'CUTBACK · TURNING':'CUTBACK · SETTING UP AIR'):isParkMode()?'POP READY':game.launchSource==='cutback'?`CUTBACK AIR · ${game.cutbackLaunchTime.toFixed(1)}s`:game.launchSource==='lip'?'LIP LAUNCH READY':'FIND LIP / CUT BACK';
  $('pop-ready-bar').style.width=`${Math.max(0,1-popCooldown/POP_COOLDOWN)*100}%`;
  $('pop-status').classList.toggle('cooling',popCooldown>0);$('pop-status').classList.toggle('powered',powered&&game.popReady);
  $('charge-label').textContent=isParkMode()?'LOAD THE POP':game.launchSource==='cutback'?'LOAD CUTBACK AIR':game.launchSource==='lip'?'LOAD LIP LAUNCH':'FLAT HOP · FIND THE LIP';
  $('charge-wrap').classList.toggle('hidden',game.charge<=.01||game.airborne||game.bailTime>0||popCooldown>0);$('charge-bar').style.width=`${game.charge*100}%`;
  $('combo').classList.toggle('hidden',!game.comboBase);$('combo-base').textContent=fmt(game.comboBase);$('multiplier').textContent=`×${game.multiplier}`;
  $('tricks').textContent=game.comboNames.slice(-4).join(' + ')+(game.trick?` + ${game.trick.name}…`:'');
  $('combo-time').style.width=`${game.airborne||game.grinding||game.pipeRide||game.lipMove?100:Math.max(0,game.comboTime/COMBO_WINDOW*100)}%`;
  $('combo-caption').textContent=game.pipeRide?'A / D TO LOOP · RELEASE E TO EXIT':game.lipMove?'GRAB · TURN · DROP BACK IN':game.airborne?'LAND IT!':game.grinding?'SPACE TO POP OUT':'SPACE TO LINK · ENTER TO BANK';
  const followups=COMBO_ANIMATIONS.filter(combo=>combo.sequence[0]===game.lastCompletedTrickType);
  if(game.trick?.comboAnimationName)$('combo-caption').textContent=`${game.trick.comboAnimationName} · LAND IT!`;
  else if(followups.length&&!game.trick&&!game.pipeRide&&!game.lipMove&&!game.grinding)$('combo-caption').textContent=`${game.airborne?'NEXT':'NEXT AIR'}: ${followups.map(combo=>combo.keys[1]).join(' / ')} · ${followups.length===1?followups[0].name:'COMBO MOVES'}`;
  $('special-fill').style.width=`${special.value*100}%`;$('special-fill').parentElement.classList.toggle('is-full',special.ready);
  if($('special-label'))$('special-label').textContent=special.ready?'100% READY · I':`SPECIAL ${Math.floor(special.value*100)}%`;
  const complete=completedGoals();['goal-score','goal-combo','goal-gates'].forEach((id,i)=>{$(id).classList.toggle('complete',complete[i]);if(!game.isTournament&&complete[i]&&!challengeFlags[i]){challengeFlags[i]=true;toast('CHALLENGE COMPLETE!');}});
  $('goal-gates').querySelector('span').textContent=isParkMode()?`Hit 5 ramps (${Math.min(5,game.visitedRamps.size)}/5)`:selectedMode==='rush'?`Checkpoints (${Math.min(12,game.gates)}/12)`:selectedMode==='storm'?`Barrel rides (${Math.min(3,game.barrelsSurvived||0)}/3)`:`Sun rings (${Math.min(6,game.gates)}/6)`;
  if(game.isTournament){
    $('rival-name').textContent=`#${game.rival.rank} ${game.rival.name}`;
    const gap=game.isRace?game.lead:game.score-game.rivalScore;
    $('rival-score').textContent=game.isRace?`${game.racePosition===1?'1ST':'2ND'} / 2`:fmt(game.rivalScore);
    $('rival-target').textContent=game.isRace?`${fmt(game.distanceRemaining)}m TO FINISH · CHECKPOINTS ${game.nextCheckpoint}/${game.course.checkpoints.length}`:`FINAL SCORE ${fmt(game.target)} · HEAT ${game.roundNumber}/5`;
    $('rival-gap').textContent=Math.abs(gap)<.5?(game.isRace?'SIDE BY SIDE':'LEVEL SCORES'):gap>0?`LEADING BY ${fmt(gap)}${game.isRace?'m':''}`:`${fmt(-gap)}${game.isRace?'m':''} BEHIND`;
    $('rival-hud').classList.toggle('ahead',gap>0);
    if(game.isRace){$('race-player-progress').style.width=`${Math.max(0,Math.min(100,game.distance/game.course.length*100))}%`;$('race-rival-progress').style.width=`${Math.max(0,Math.min(100,game.opponent.distance/game.course.length*100))}%`;}
  }
  if(isParkMode())parkMap?.update(game);
  else {
    $('surf-objective').textContent=game.isRace?`${game.racePosition===1?'1ST':'2ND'} PLACE · BEAT ${game.rival.name} TO THE FINISH`:selectedMode==='storm'?`${'◆'.repeat(Math.max(0,game.lives))}${'◇'.repeat(3-Math.max(0,game.lives))} LIVES · SWELL ${game.stormStage||1} · ENDLESS`:selectedMode==='rush'?`CHECKPOINTS ${game.gates} / 12 · +8 SEC EACH`:'SURF SESSION · KEEP YOUR LINE';
    const tube=game.barrel,barrelHint=tube?.inside?'BARREL RIDE · HOLD THE OPEN LINE':tube&&tube.startDistance-game.distance<70?(game.x>tube.x+1.5?'BARREL AHEAD · CARVE LEFT':game.x<tube.x-1.5?'BARREL AHEAD · CARVE RIGHT':'BARREL AHEAD · HOLD YOUR LINE'):'';
    const nextGate=game.isRace?game.course.checkpoints[game.nextCheckpoint]:null;
    const raceHint=nextGate?`GATE ${game.nextCheckpoint+1} · ${fmt(Math.max(0,nextGate.distance-game.distance))}m · ${game.x<nextGate.x-nextGate.radius*.6?'STEER RIGHT':game.x>nextGate.x+nextGate.radius*.6?'STEER LEFT':'HOLD YOUR LINE'}`:game.isRace?'FINISH AHEAD · W TO PUMP':'';
    $('surf-warning').textContent=game.bailTime>0?'RECOVERING…':game.landingWarning||barrelHint||((game.danger||0)>.6?(Math.abs(game.x)>13?'WAVE EDGE · STEER BACK IN':'REEF AHEAD · CHANGE YOUR LINE'):raceHint||'SHIFT + A / D · CUTBACK');
    $('risk-fill').style.width=`${(game.danger||0)*100}%`;
    $('surf-condition').classList.toggle('danger',(game.danger||0)>.65);
  }
}

window.addEventListener('keydown',createKeydownHandler(
  ()=>({bootReady:bootReady&&!wasted.active,workshopMode,modalMode,game,input}),
  {toggleSound,closeWorkshop,cycleCharacter,closeModal,startRun,restartRun,pause,tryTrick,toast,
    isWardrobeOpen:()=>!$('wardrobe').classList.contains('hidden'),
    hideWardrobe:()=>$('wardrobe').classList.add('hidden'),
    rotatePreview:delta=>preview?.rotate(delta),
    pressControl:code=>{pressed.add(code);syncInput();}}
));
window.addEventListener('keyup',e=>{if(!bootReady||wasted.active||!keyMap[e.code])return;const wasJump=input.jump;pressed.delete(e.code);syncInput();if(e.code==='Space'&&wasJump&&!input.jump&&game.phase==='running')tryPop();});
window.addEventListener('blur',()=>{clearInput();if(game?.phase==='running')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(game?.phase==='running')pause();}});
document.addEventListener('pointerdown',event=>{if(!bootReady||event.target.closest('#sound'))return;if(game?.phase==='ready'&&soundPreference!=='off'&&!audio.enabled){audio.setScene('menu');audio.enable().then(updateSoundLabel);}},{capture:true});
$('start').addEventListener('click',startRun);$('restart').addEventListener('click',restartRun);$('pause').addEventListener('click',pause);$('help').addEventListener('click',showHelp);$('sound').addEventListener('click',toggleSound);
$('ladder-button').addEventListener('click',showLadder);
$('modal-home').addEventListener('click',goHome);
$('modal-action').addEventListener('click',()=>['results','ladder'].includes(modalMode)?startRun():modalMode==='graphics'?location.reload():closeModal());
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
$('workshop').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.character)setProfile({character:b.dataset.character});if(b.dataset.outfit)setProfile({outfit:b.dataset.outfit});if(b.dataset.boardColor)setProfile({boardColor:b.dataset.boardColor});if(b.dataset.boardDesign)setProfile({boardDesign:b.dataset.boardDesign});});

try{
  await paintLoadingStage();
  await loadCharacterTextures();
  loading.set(40,'BUILDING YOUR SESSION','Preparing the coast, wave ramps and Waterworks.');
  await paintLoadingStage();
  world=new SurfWorld($('viewport'),profile);
  loading.set(78,'SETTING YOUR LINE','Getting your surfer, board and session ready.');
  await paintLoadingStage();
  parkMap=new ParkMap($('park-map-canvas'));makeGame();updateModeMenu();renderCustomizationChoices();updateSoundLabel();
  loading.set(92,'WARMING UP THE WATER','Drawing the first frame. Almost there.');
  await paintLoadingStage();
  world.update(0,game);updateHud();
  await paintLoadingStage();
  bootReady=await loading.finish();
  if(!bootReady)throw new Error('Startup stopped before the menu was ready.');
  let previous=performance.now(),accumulator=0,hudTime=0,animationId;
  const frame=now=>{
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(game.phase==='running'&&!workshopMode){accumulator+=dt;while(accumulator>=1/120){game.update(1/120,input);accumulator-=1/120;}special.update(dt);}else accumulator=0;
    world.update(wasted.active?0:dt,game);wasted.update(dt);if(workshopMode)preview.update(dt,workshopMode);
    audio.update(!document.hidden&&(game.phase==='running'||game.phase==='ready'),game.mode);
    hudTime+=dt;if(hudTime>=.05){updateHud();hudTime=0;}
    if(toastTime>0&&game.phase==='running'){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');}
    animationId=requestAnimationFrame(frame);
  };animationId=requestAnimationFrame(frame);
  world.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();game.pause();clearInput();openModal('graphics','SIGNAL LOST','<p>The graphics connection was interrupted. Reload to start a fresh session.</p>','RELOAD GAME');});
  if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(animationId);wasted.destroy();world.dispose();preview?.dispose();audio.dispose();});
}catch(error){console.error(error);loading.fail();}
