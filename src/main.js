import './style.css';
import './selection.css';
import './factory.css';
import { SurfGame, COMBO_WINDOW, MIN_X, MAX_X } from './game.js';
import { WaveParkGame, PARK_BOUNDS } from './park.js';
import { SpecialMeter } from './special.js';
import { ParkMap } from './park-map.js';
import { SurfWorld } from './world.js';
import { ArcadeAudio } from './audio.js';
import { CHARACTERS, OUTFITS, BOARD_DESIGNS, validateProfile, CustomizationPreview } from './appearance.js';

const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString('en-US');
const pad=n=>Math.round(n).toString().padStart(6,'0');
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* Storage is optional. */}};
let profile;try{profile=validateProfile(JSON.parse(read('breakline99-profile','{}')));}catch{profile=validateProfile();}
let selectedMode=read('breakline99-mode','surf')==='park'?'park':'surf';
let selectedParkStart=read('breakline99-park-start','basin');
if(!['basin','west','east','filters'].includes(selectedParkStart))selectedParkStart='basin';
$('park-start').value=selectedParkStart;
const audio=new ArcadeAudio();
const input={left:false,right:false,pump:false,brake:false,jump:false};
const keyMap={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'pump',ArrowUp:'pump',KeyS:'brake',ArrowDown:'brake',Space:'jump'};
const trickKeys={KeyJ:'spin',KeyK:'flip',KeyL:'grab',KeyU:'shuvit',KeyO:'heelflip',KeyH:'method',KeyF:'spin360',KeyI:'special'};
const special=new SpecialMeter();
const pressed=new Set(),touchPressed=new Set();
let world,game,preview,parkMap,modalMode=null,resumeAfterModal=false,workshopMode=null,toastTime=0;
let best=0,newBest=false,challengeFlags=[false,false,false],soundPreference=read('breakline99-sound','auto');
let touchEnabled=matchMedia('(pointer:coarse)').matches;
let portraitKey='';
document.body.classList.toggle('touch-enabled',touchEnabled);
const modeInfo={
  surf:{name:'SURF SESSION',level:'SUNSET POINT',description:'Two minutes. One endless break. Carve the face, hit the lip and link huge airs.'},
  park:{name:'THE WATERWORKS',level:'LOWER SEWAGE WORKS',description:'Deep beneath an abandoned factory. Ride the drainage canals, thread the rust tunnels and grind the old pipework.'},
};
function toast(text,bail=false){$('toast').textContent=text;$('toast').classList.toggle('bail',bail);$('toast').classList.add('visible');toastTime=2;}
function clearInput(){pressed.clear();touchPressed.clear();for(const k in input)input[k]=false;document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
function syncInput(){for(const name in input)input[name]=touchPressed.has(name)||[...pressed].some(code=>keyMap[code]===name);}
function loadBest(){best=Math.max(0,Number(read(`breakline99-best-${selectedMode}`,selectedMode==='surf'?read('breakline99-best','0'):'0'))||0);}
function saveBest(){if(!game||game.score<=best)return;best=game.score;newBest=true;write(`breakline99-best-${selectedMode}`,String(best));}
function completedGoals(){return [game.score>=5000,game.bestCombo>=1500,selectedMode==='park'?game.visitedRamps.size>=5:game.gates>=6];}
function goalNames(){return ['Score 5,000','Bank a 1,500 combo',selectedMode==='park'?'Ride 5 different ramps':'Catch 6 sun rings'];}
function onEvent(e){
  world?.onEvent(e,game);audio.event(e.type);
  if(e.type==='bank'){toast(`+${fmt(e.points)}  BANKED`);special.gain(e.points/12000);saveBest();}
  if(e.type==='trick')special.gain(.22);
  if(e.type==='bail'){special.bail();toast(e.lost?`WIPEOUT! ${fmt(e.lost)} LOST`:e.reason,true);}
  if(e.type==='gate')toast('SUN RING +250');
  if(e.type==='grind')toast('WATER SLIDE!');
  if(e.type==='land')toast('LANDED! KEEP IT GOING');
  if(e.type==='start')toast(selectedMode==='park'?'THE WATERWORKS · DROP IN':'DROP IN!');
  if(e.type==='finish'){saveBest();showResults();}
}
function makeGame(){game=selectedMode==='park'?new WaveParkGame(onEvent):new SurfGame(onEvent);world.setMode(selectedMode);audio.setMode(selectedMode);loadBest();}
function updateModeMenu(){
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===selectedMode;b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));const label=b.querySelector('.mode-status');if(label)label.textContent=active?'▶ SELECTED':'▶ SELECT MODE';});
  if($('selected-mode-name'))$('selected-mode-name').textContent=modeInfo[selectedMode].name;
  if($('mode-description'))$('mode-description').textContent=modeInfo[selectedMode].description;
  if($('level-name'))$('level-name').textContent=modeInfo[selectedMode].level;
  if($('mode-hud'))$('mode-hud').textContent=modeInfo[selectedMode].name;
  $('goal-gates').querySelector('span').textContent=goalNames()[2];
  $('park-map').classList.toggle('hidden',selectedMode!=='park');
  $('park-start-wrap').classList.toggle('hidden',selectedMode!=='park');
  document.body.classList.toggle('park-mode',selectedMode==='park');
}
function selectMode(mode){if(!modeInfo[mode])return;selectedMode=mode;write('breakline99-mode',mode);clearInput();makeGame();updateModeMenu();}
function updateSoundLabel(){
  $('sound').textContent=audio.enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-label',audio.enabled?'Mute audio':'Enable audio');
  if($('music-track'))$('music-track').textContent=audio.enabled?'♫ RIPTIDE RADIO ’99':'RIPTIDE RADIO ’99 · SOUND OFF';
}
async function toggleSound(){await audio.toggle();soundPreference=audio.enabled?'on':'off';write('breakline99-sound',soundPreference);updateSoundLabel();}
function startRun(){
  closeWorkshop();closeModal(false);clearInput();newBest=false;challengeFlags=[false,false,false];special.reset();
  if(soundPreference!=='off'&&!audio.enabled)audio.enable().then(updateSoundLabel);
  game.start(selectedMode==='park'?selectedParkStart:undefined);$('intro').classList.add('hidden');$('hud').classList.remove('hidden');$('touch').classList.remove('hidden');document.body.classList.add('playing');$('stage').focus({preventScroll:true});
}
function goHome(){
  saveBest();closeWorkshop();closeModal(false);clearInput();special.reset();makeGame();
  $('hud').classList.add('hidden');$('touch').classList.add('hidden');$('intro').classList.remove('hidden');document.body.classList.remove('playing');updateModeMenu();$('start').focus({preventScroll:true});
}
function openModal(mode,title,content,action,kicker='BREAKLINE ’99'){
  const active=game.phase==='running';if(active){game.pause();clearInput();}if(!modalMode)resumeAfterModal=active;
  modalMode=mode;$('modal-title').textContent=title;$('modal-kicker').textContent=kicker;$('modal-content').innerHTML=content;$('modal-action').textContent=action;
  $('modal').classList.remove('hidden');$('touch').classList.add('hidden');$('modal-action').focus({preventScroll:true});
}
function closeModal(resume=true){$('modal').classList.add('hidden');modalMode=null;if(resume&&resumeAfterModal)game.resume();resumeAfterModal=false;if(game?.phase==='running')$('touch').classList.remove('hidden');$('stage').focus({preventScroll:true});}
function pause(){if(workshopMode){closeWorkshop();return;}if(modalMode==='pause'||modalMode==='help'){closeModal();return;}if(game.phase!=='running')return;openModal('pause','PAUSED','<p>The clock is stopped. Your line is waiting.</p><p><kbd>P</kbd> / <kbd>ESC</kbd> resume · <kbd>R</kbd> restart</p>','KEEP RIDING','TIME OUT');}
function showHelp(){
  if(modalMode==='help'){closeModal();return;}
  openModal('help','HOW TO RIDE',`<div class="controls-grid">
  <span><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></span><span>${selectedMode==='park'?'Steer around the park.':'Carve across the wave. The high lip is left.'}</span>
  <span><kbd>W</kbd> / <kbd>↑</kbd></span><span>${selectedMode==='park'?'Pump to build speed.':'Pump for more speed.'} <kbd>S</kbd> / <kbd>↓</kbd> slows down.</span>
  <span><kbd>SPACE</kbd></span><span>Hold, then release to pop. ${selectedMode==='park'?'Wave lips launch you automatically.':'Pop near the lip for more airtime.'}</span>
  <span><kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd></span><span>180 spin / kickflip / Indy grab. One trick at a time, in the air.</span>
  <span><kbd>U</kbd> <kbd>O</kbd></span><span>Shuv-it / heelflip.</span>
  <span><kbd>H</kbd> <kbd>F</kbd></span><span>Method air / 360 air.</span>
  <span><kbd>I</kbd></span><span>Rodeo Air at 100% SPECIAL. Once full, it stays ready until used—even through a wipeout.</span>
  <span><kbd>ENTER</kbd></span><span>Bank a landed combo. Pop again within 3.8 seconds to link another air.</span>
  <span><kbd>P</kbd> <kbd>R</kbd> <kbd>M</kbd></span><span>Pause / restart / music. ESC also pauses.</span></div>
  <p class="help-tip">Finish your trick before touching the water. Wipeouts lose the active combo. ${selectedMode==='park'?'Jump onto a pipe or rail along its length to grind. Rail sides are solid. Ride through the open rust tunnels, or use their approach ramps to reach the top. The plant plan marks tunnels in orange and rails in cream.':'Catch sun rings and avoid the reef rocks.'}</p>
  <button id="toggle-touch" class="input-toggle">ON-SCREEN CONTROLS: ${touchEnabled?'ON':'OFF'}</button>`,'GOT IT','CONTROLS');
}
function showResults(){
  clearInput();const complete=completedGoals(),stars=complete.filter(Boolean).length;const rank=['GROM','LOCAL','LINEUP LEGEND','COAST ROYALTY'][stars];
  openModal('results','SESSION OVER',`<div class="results-score">${fmt(game.score)}</div><p>${newBest?'NEW RECORD! · ':''}${rank} · ${stars}/3 CHALLENGES</p>
  <div class="results-stats"><span>BEST COMBO<b>${fmt(game.bestCombo)}</b></span><span>TRICKS BANKED<b>${game.landedTricks}</b></span><span>${selectedMode==='park'?'RAMPS / SLIDES':'SUN RINGS'}<b>${selectedMode==='park'?`${game.visitedRamps.size} / ${game.grindCount}`:game.gates}</b></span><span>WIPEOUTS<b>${game.wipeouts}</b></span></div>
  <div class="result-goals">${goalNames().map((name,i)=>`${complete[i]?'◆':'◇'} ${name}`).join('<br>')}</div><p>PERSONAL BEST: ${fmt(best)}</p>`,'RIDE AGAIN',modeInfo[selectedMode].name);
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
function tryTrick(type){if(type==='special'&&!special.ready){if(game.airborne)toast('BUILD YOUR SPECIAL METER');return;}if(game.doTrick(type)&&type==='special'){special.consume();toast('RODEO AIR!');}}
function updateHud(){
  $('score').textContent=pad(game.score);$('best').textContent=pad(best);
  const seconds=Math.ceil(game.time);$('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;$('timer').parentElement.classList.toggle('urgent',game.time<=20);
  $('speed').textContent=Math.round(game.speed*3.6);$('speed-bar').style.width=`${Math.min(100,game.speed/25*100)}%`;
  $('wave-dot').style.left=`${selectedMode==='park'?(game.x-PARK_BOUNDS.minX)/(PARK_BOUNDS.maxX-PARK_BOUNDS.minX)*96:(game.x-MIN_X)/(MAX_X-MIN_X)*96}%`;
  const surface=selectedMode==='park'?(game.surface?.pipe?.name||game.surface?.ramp?.name):null;
  $('ride-state').textContent=game.bailTime>0?'WIPEOUT':game.grinding?'WATER SLIDE':game.airborne?'AIRBORNE':selectedMode==='park'?(surface||'WATERWORKS'):game.x<-4?'WAVE LIP':'ON THE FACE';
  $('charge-wrap').classList.toggle('hidden',game.charge<=.01||game.airborne||game.bailTime>0);$('charge-bar').style.width=`${game.charge*100}%`;
  $('combo').classList.toggle('hidden',!game.comboBase);$('combo-base').textContent=fmt(game.comboBase);$('multiplier').textContent=`×${game.multiplier}`;
  $('tricks').textContent=game.comboNames.slice(-4).join(' + ')+(game.trick?` + ${game.trick.name}…`:'');
  $('combo-time').style.width=`${game.airborne||game.grinding?100:Math.max(0,game.comboTime/COMBO_WINDOW*100)}%`;
  $('combo-caption').textContent=game.airborne?'LAND IT!':game.grinding?'SPACE TO POP OUT':'SPACE TO LINK · ENTER TO BANK';
  $('special-fill').style.width=`${special.value*100}%`;$('special-fill').parentElement.classList.toggle('is-full',special.ready);
  if($('special-label'))$('special-label').textContent=special.ready?'100% READY · I':`SPECIAL ${Math.floor(special.value*100)}%`;
  const complete=completedGoals();['goal-score','goal-combo','goal-gates'].forEach((id,i)=>{$(id).classList.toggle('complete',complete[i]);if(complete[i]&&!challengeFlags[i]){challengeFlags[i]=true;toast('CHALLENGE COMPLETE!');}});
  $('goal-gates').querySelector('span').textContent=selectedMode==='park'?`Hit 5 ramps (${Math.min(5,game.visitedRamps.size)}/5)`:`Sun rings (${Math.min(6,game.gates)}/6)`;
  if(selectedMode==='park')parkMap?.update(game);
}

window.addEventListener('keydown',e=>{
  if(keyMap[e.code]||trickKeys[e.code]||['Enter','Escape','KeyP','KeyR','KeyM'].includes(e.code))e.preventDefault();if(e.repeat)return;
  if(e.code==='KeyM'){toggleSound();return;}
  if(workshopMode){
    if(e.code==='Escape'&&!$('wardrobe').classList.contains('hidden'))$('wardrobe').classList.add('hidden');
    else if(['Escape','Enter','KeyA','KeyB'].includes(e.code))closeWorkshop();
    else if(e.code==='ArrowLeft'&&workshopMode==='character')cycleCharacter(-1);
    else if(e.code==='ArrowRight'&&workshopMode==='character')cycleCharacter(1);
    else if(e.code==='KeyX')preview?.rotate(-.5);
    else if(e.code==='KeyC')preview?.rotate(.5);
    return;
  }
  if(e.code==='Enter'){if(modalMode==='results')startRun();else if(modalMode)closeModal();else if(game.phase==='ready'||game.phase==='finished')startRun();else game.bank();return;}
  if(e.code==='Escape'||e.code==='KeyP'){pause();return;}
  if(e.code==='KeyR'&&game.phase!=='ready'){startRun();return;}
  if(game.phase!=='running'||modalMode)return;
  if(keyMap[e.code]){pressed.add(e.code);syncInput();}if(trickKeys[e.code])tryTrick(trickKeys[e.code]);
});
window.addEventListener('keyup',e=>{if(!keyMap[e.code])return;const wasJump=input.jump;pressed.delete(e.code);syncInput();if(e.code==='Space'&&wasJump&&!input.jump&&game.phase==='running')game.jump();});
window.addEventListener('blur',()=>{clearInput();if(game?.phase==='running')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(game?.phase==='running')pause();}});
$('start').addEventListener('click',startRun);$('restart').addEventListener('click',startRun);$('pause').addEventListener('click',pause);$('help').addEventListener('click',showHelp);$('sound').addEventListener('click',toggleSound);
$('home').addEventListener('click',goHome);$('modal-home').addEventListener('click',goHome);
$('modal-action').addEventListener('click',()=>modalMode==='results'?startRun():modalMode==='graphics'?location.reload():closeModal());
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
$('modal-content').addEventListener('click',e=>{if(e.target.id!=='toggle-touch')return;touchEnabled=!touchEnabled;document.body.classList.toggle('touch-enabled',touchEnabled);e.target.textContent=`ON-SCREEN CONTROLS: ${touchEnabled?'ON':'OFF'}`;});
$('touch-bank').addEventListener('click',()=>game.bank());
document.querySelectorAll('[data-hold]').forEach(b=>{
  const name=b.dataset.hold;b.addEventListener('pointerdown',e=>{e.preventDefault();if(game.phase!=='running')return;b.setPointerCapture(e.pointerId);touchPressed.add(name);syncInput();b.classList.add('pressed');});
  const release=e=>{e.preventDefault();const held=touchPressed.has(name);touchPressed.delete(name);syncInput();b.classList.remove('pressed');if(name==='jump'&&held&&!input.jump&&game.phase==='running'&&e.type==='pointerup')game.jump();};
  b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
});
document.querySelectorAll('[data-trick]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();tryTrick(b.dataset.trick);}));

try{
  world=new SurfWorld($('viewport'),profile);parkMap=new ParkMap($('park-map-canvas'));makeGame();updateModeMenu();renderCustomizationChoices();updateSoundLabel();$('loading').classList.add('hidden');
  let previous=performance.now(),accumulator=0,hudTime=0,animationId;
  const frame=now=>{
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(game.phase==='running'&&!workshopMode){accumulator+=dt;while(accumulator>=1/120){game.update(1/120,input);accumulator-=1/120;}special.update(dt);}else accumulator=0;
    world.update(dt,game);if(workshopMode)preview.update(dt,workshopMode);
    audio.update(!document.hidden&&(game.phase==='running'||game.phase==='ready'),selectedMode);
    hudTime+=dt;if(hudTime>=.05){updateHud();hudTime=0;}
    if(toastTime>0&&game.phase==='running'){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');}
    animationId=requestAnimationFrame(frame);
  };animationId=requestAnimationFrame(frame);
  world.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();game.pause();clearInput();openModal('graphics','SIGNAL LOST','<p>The graphics connection was interrupted. Reload to start a fresh session.</p>','RELOAD GAME');});
  if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(animationId);world.dispose();preview?.dispose();audio.dispose();});
}catch(error){console.error(error);$('loading').textContent='COULD NOT START 3D. ENABLE WEBGL 2 / HARDWARE ACCELERATION AND RELOAD.';}
