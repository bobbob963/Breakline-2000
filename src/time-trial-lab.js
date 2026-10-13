import './time-trials.css';
import { createTimeTrialGame,TIME_TRIALS,sanitizeTimeTrialProgress } from './time-trials.js';
import { surfRaceTrickInput } from './surf-race.js';
import { parkRaceTrickInput } from './park-race.js';
import { SurfWorld } from './world.js';
import { CustomizationPreview,validateProfile } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';
import { TRIAL_COSMETIC_SETS,getTrialCosmeticSet } from './trial-cosmetics.js';
import { trialListMarkup,trialTime } from './time-trial-ui.js';
import { CONTROL_KEYS,createKeydownHandler } from './keyboard.js';

const STEP=1/120;
// Review access exists only in this page's memory. No production saves are
// read or written; selection and personal-best timing use the real classes.
export const timeTrialLabControls=game=>game.mode==='park'
  ?parkRaceTrickInput(game,game.course,1):surfRaceTrickInput(game,game.course,1);

async function boot() {
  const $=id=>document.getElementById(id),pressed=new Set(),previews=[];
  let game,world,input={},actualInput={},accumulator=0,events=[],currentSet=TRIAL_COSMETIC_SETS[0];
  let progress=sanitizeTimeTrialProgress({version:1,completedTrials:12,selectedTrial:0,bestTimes:[]});
  const profileFor=set=>validateProfile({character:'jax',outfit:set.outfit,boardDesign:set.boardDesign,rewardBoard:null});
  const clearInput=()=>{pressed.clear();input={};actualInput={};};
  function syncInput(){input={};for(const code of pressed)input[CONTROL_KEYS[code]]=true;}
  function renderList(){ $('trial-list').innerHTML=trialListMarkup(progress); }
  function onEvent(event) {
    if(!game)return;
    world?.onEvent(event,game);
    if(['raceGo','trick','raceBoost','raceMiss','bail','finish'].includes(event.type)) {
      const detail=event.name||event.reason||(event.type==='raceBoost'?`+${event.speed} m/s`:event.type==='raceMiss'?`ring ${event.index+1}`:'');
      events.unshift(`${game.elapsed.toFixed(2)}s · ${event.type}${detail?' · '+detail:''}`);events=events.slice(0,8);
    }
    if(event.type==='finish') {
      progress={...game.getProgress(),selectedTrial:game.trialIndex};renderList();clearInput();
      $('status').textContent=game.result==='win'?`${game.trial.name}: finished in ${trialTime(game.finishTime)} / target ${trialTime(game.target)}. Every required ring passed. This review best time is kept only until the page closes.`:`${game.trial.name}: ${game.resultReason}. Retry to take another line.`;
    }
  }
  function chooseTrial(index) {
    if(!Number.isInteger(index)||index<0||index>=TIME_TRIALS.length)return;
    clearInput();accumulator=0;events=[];progress={...progress,selectedTrial:index};
    game=createTimeTrialGame(()=>{},progress);game.onEvent=onEvent;game.profile=profileFor(currentSet);
    world.setProfile(game.profile);world.onEvent({type:'reset'},game);renderList();
    $('title').textContent=game.trial.name;
    $('status').textContent=`Ready: ${game.trial.name} · ${Math.round(game.course.length).toLocaleString()} m · ${game.course.checkpoints.length} sun rings · target ${trialTime(game.target)}. Press Start trial.`;
    counters();
  }
  function start() {
    clearInput();accumulator=0;events=[];game.start();
    $('status').textContent=$('autopilot').checked?'Auto-driver is pressing normal pump, steering, pop and trick controls. The countdown and target clock are live.':'Manual trial started. Pass every sun ring before the target clock runs out.';
    counters();
  }
  function pause() {
    clearInput();
    if(game.phase==='running')game.pause();else if(game.phase==='paused')game.resume();
    counters();
  }
  function equipSet(id) {
    const set=getTrialCosmeticSet(id);if(!set)return;
    currentSet=set;const profile=profileFor(set);world.setProfile(profile);game.profile=profile;
    for(const card of $('cosmetics').children){const equipped=card.dataset.set===id;card.dataset.equipped=String(equipped);card.querySelector('button').setAttribute('aria-pressed',String(equipped));card.querySelector('button').textContent=equipped?'EQUIPPED FOR REVIEW':'EQUIP FOR REVIEW';}
    $('stat-set').textContent=set.name;
  }
  function counters() {
    if(!game)return;
    $('hud-time').textContent=game.phase==='ready'?'READY':game.countdownRemaining>0?`${Math.ceil(game.countdownRemaining)}…`:trialTime(game.time);
    $('hud-gates').textContent=`SUN RINGS ${game.nextCheckpoint}/${game.course.checkpoints.length} · ${Math.ceil(game.distanceRemaining)} m LEFT`;
    $('hud-target').textContent=trialTime(game.target);$('hud-venue').textContent=game.mode==='park'?'TARGET / WATERWORKS':'TARGET / WAVE RUN';
    $('hud-state').textContent=`${game.phase.toUpperCase()}${game.result?' / '+game.result.toUpperCase():''} · ${$('autopilot').checked?'AUTO-DRIVER':'MANUAL'} · ${$('rate').value}× PLAYBACK${game.boostTime>0?' · '+game.boostLabel:''}`;
    $('player-marker').style.left=Math.min(100,Math.max(0,game.raceProgress/game.course.length*100))+'%';
    $('stat-time').textContent=`${trialTime(game.elapsed)} / ${trialTime(game.time)}`;
    $('stat-rings').textContent=`${game.nextCheckpoint}/${game.course.checkpoints.length} · ${game.raceMisses} missed`;
    $('stat-distance').textContent=`${Math.round(game.course.length)} m / ${Math.ceil(game.distanceRemaining)} m`;
    $('stat-speed').textContent=`${game.speed.toFixed(1)} m/s · ${game.wipeouts} wipeouts`;
    $('stat-trick').textContent=game.trick?.name||(game.boostTime>0?`${game.boostLabel} +${game.boostSpeed.toFixed(1)} m/s`:game.airborne?'In the air':'Riding');
    $('stat-input').textContent=Object.entries(actualInput).filter(([,held])=>held).map(([key])=>key).join(' + ')||'none';
    $('events').textContent=events.join('\n');$('pause').disabled=!['running','paused'].includes(game.phase);
    $('pause').textContent=game.phase==='paused'?'Resume':'Pause';$('start').textContent=game.phase==='ready'?'Start trial':'Retry trial';
  }
  try {
    await loadCharacterTextures();world=new SurfWorld($('viewport'),profileFor(currentSet));
    for(const set of TRIAL_COSMETIC_SETS) {
      const card=document.createElement('article');card.className='cosmetic-card';card.dataset.set=set.id;
      const title=document.createElement('h2');title.textContent=set.name;
      const note=document.createElement('p');note.textContent=`CLEAR ${set.requiredClears} TRIALS · OUTFIT + DECK`;
      const preview=document.createElement('div');preview.className='preview';preview.setAttribute('aria-label',`${set.name}: ${set.description}`);
      const button=document.createElement('button');button.type='button';button.textContent='EQUIP FOR REVIEW';button.addEventListener('click',()=>equipSet(set.id));
      card.append(title,note,preview,button);$('cosmetics').append(card);
      previews.push(new CustomizationPreview(preview,profileFor(set)));
    }
    chooseTrial(0);equipSet(currentSet.id);$('loading').remove();
    $('start').addEventListener('click',()=>{start();$('start').blur();});$('pause').addEventListener('click',pause);
    $('next').addEventListener('click',()=>chooseTrial((game.trialIndex+1)%TIME_TRIALS.length));
    $('autopilot').addEventListener('change',clearInput);
    $('trial-list').addEventListener('click',event=>{
      const choice=event.target.closest('button[data-trial]'),set=event.target.closest('button[data-trial-equip]');
      if(choice)chooseTrial(Number(choice.dataset.trial));else if(set)equipSet(set.dataset.trialEquip);
    });
    const actions={toggleSound(){},closeWorkshop(){},cycleCharacter(){},closeModal(){},rotatePreview(){},isWardrobeOpen:()=>false,hideWardrobe(){},
      startRun:start,restartRun:start,pause,toast:text=>{$('status').textContent=text;},
      pressControl:code=>{pressed.add(code);syncInput();},tryTrick:type=>{if(!$('autopilot').checked)game.doTrick(type);}};
    const keydown=createKeydownHandler(()=>({bootReady:true,workshopMode:null,modalMode:null,game,input}),actions);
    window.addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;keydown(event);});
    window.addEventListener('keyup',event=>{if(!CONTROL_KEYS[event.code])return;const wasJump=input.jump;pressed.delete(event.code);syncInput();if(event.code==='Space'&&wasJump&&!input.jump&&game.phase==='running'&&!$('autopilot').checked)game.jump();});
    window.addEventListener('blur',()=>{clearInput();if(game.phase==='running')game.pause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(game.phase==='running')game.pause();}});
    let previous=performance.now();
    function frame(now) {
      const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
      if(game.phase==='running') {
        accumulator+=dt*Number($('rate').value);
        while(accumulator>=STEP&&game.phase==='running') {
          actualInput=$('autopilot').checked?timeTrialLabControls(game):input;
          game.update(STEP,actualInput);accumulator-=STEP;
        }
      }else accumulator=0;
      world.update(dt,game);for(const preview of previews)preview.update(dt,'character');counters();requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.addEventListener('pagehide',()=>{world.dispose();for(const preview of previews)preview.dispose();},{once:true});
  }catch(error){console.error(error);$('status').textContent=`Time trial review could not load: ${error.message}`;const loading=$('loading');if(loading)loading.textContent=$('status').textContent;}
}
if(typeof document!=='undefined'&&document.getElementById('cosmetics'))boot();
