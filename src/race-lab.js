import { SurfGame, courseItem } from './game.js';
import { WaveParkGame } from './park.js';
import { parkRaceOpponentInput } from './park-race.js';
import { raceOpponentInput } from './surf-race.js';
import { createTournamentGame, TOURNAMENT_RIVALS } from './tournament.js';
import { SurfWorld } from './world.js';
import { validateProfile } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';
import { CONTROL_KEYS, createKeydownHandler } from './keyboard.js';

const STEP=1/120;
const RIVAL_IDS=TOURNAMENT_RIVALS.map(rival=>rival.id);
const raceDistance=rider=>rider.raceProgress??rider.distance;

// Deterministic review playback through the same public controls as a player.
// Every run waits for GO, cuts back, charges a real pop and lands its tricks.
export function createRaceBoostDemo(kind='single') {
  return {kind:kind==='combo'?'combo':'single',stage:'countdown',chargeTime:0,trickIndex:0,landed:false,failed:false};
}

export function raceBoostDemoControls(game,demo,dt=STEP) {
  const controls={pump:true};
  if(game.countdownRemaining>0)return controls;
  if(game.bailTime>0){demo.failed=true;return controls;}
  if(demo.stage==='countdown')demo.stage='cutback';
  if(demo.stage==='cutback') {
    if(!game.cutbackActive&&game.cutbackLaunchTime>0)demo.stage='charge';
    else return {...controls,right:true,grind:true};
  }
  if(demo.stage==='charge') {
    demo.chargeTime+=dt;
    if(demo.chargeTime<.64)return {...controls,jump:true};
    if(game.jump())demo.stage='air';
  }
  if(demo.stage==='air') {
    const tricks=demo.kind==='combo'?['spin','tweak']:['tweak'];
    if(game.airborne&&!game.trick&&demo.trickIndex<tricks.length&&game.airtime>.04) {
      if(game.doTrick(tricks[demo.trickIndex]))demo.trickIndex++;
    }
    if(!game.airborne){demo.landed=game.launchTricks===tricks.length;demo.failed=!demo.landed;demo.stage='done';}
  }
  return controls;
}

// A review-only route follower: it can press ordinary controls but cannot
// grant checkpoint credit, set positions or alter either racer's physics.
export function raceLabControls(game) {
  if(game.mode==='park')return game.isRace?parkRaceOpponentInput(game,game.course,1):{pump:true};
  const checkpoint=game.course?.checkpoints[game.nextCheckpoint];
  let target=checkpoint?.x??0;
  const targets=[];
  if(checkpoint&&checkpoint.distance>=game.distance)targets.push({distance:checkpoint.distance,x:target});
  const current=Math.max(0,Math.floor((game.distance-game.rules.firstGate)/game.rules.spacing));
  for(let i=Math.max(0,current-1);i<=current+2;i++) {
    const item=courseItem(i,game.rulesId),ahead=item.hazardDistance-game.distance;
    if(!game.isRace&&!game.processed.has('g'+i)&&item.distance>=game.distance)targets.push({distance:item.distance,x:item.x});
    if(ahead>=-3&&ahead<55&&!game.processed.has('h'+i)) {
      const options=[item.hazardX-item.hazardRadius-1.1,item.hazardX+item.hazardRadius+1.1].filter(x=>Math.abs(x)<13);
      const nearest=options.sort((a,b)=>Math.abs(a-game.x)+Math.abs(a-target)*.2-Math.abs(b-game.x)-Math.abs(b-target)*.2)[0];
      if(Math.abs(game.x-item.hazardX)<item.hazardRadius+1.1||Math.abs(target-item.hazardX)<item.hazardRadius+1.1)targets.push({distance:item.hazardDistance+3,x:nearest??0});
    }
  }
  targets.sort((a,b)=>a.distance-b.distance);
  target=targets[0]?.x??target;
  const error=target-game.x-game.vx*.23;
  return {pump:true,left:error<-.32,right:error>.32};
}

// A review uses the ordinary steering policy to keep the player near the
// rival. It observes the rival's real simulation; it never supplies a pose,
// changes positions or awards a boost to either competitor.
export function rivalReviewControls(game) {
  return game.mode === 'park'
    ? parkRaceOpponentInput(game,game.course,game.rival.pace)
    : raceOpponentInput(game,game.course,game.rival.pace);
}

export function rivalReviewReady(game,kind) {
  const rival=game.opponent;
  if(!rival || game.countdownRemaining>0 || rival.bailTime>0)return false;
  return kind==='boost'
    ? rival.boostTime>0 && rival.boostLevel==='combo' && rival.boostDuration-rival.boostTime>=.55
    : !!rival.trick?.grab && rival.trick.age/rival.trick.duration>=.4;
}

async function boot() {
  const $=id=>document.getElementById(id),pressed=new Set();
  let world,game,scenario=null,input={},actualInput={},events=[],accumulator=0,boostDemo=null,rivalDemo=null;
  const clearInput=()=>{pressed.clear();input={};};
  function syncInput(){input={};for(const code of pressed)input[CONTROL_KEYS[code]]=true;}
  function onEvent(event) {
    if(!game)return;
    if(!event.opponent)world?.onEvent(event,game);
    if(!['reset','wall'].includes(event.type))events.unshift(`${game.elapsed.toFixed(2)} · ${event.opponent?'RIVAL':'PLAYER'} ${event.type}${event.reason?' · '+event.reason:''}${event.name?' · '+event.name:''}${event.type==='raceBoost'?' · '+event.tricks+' tricks · +'+event.speed+' m/s':''}`);
    events=events.slice(0,11);
    if(event.type==='finish')$('status').textContent=`${game.result?.toUpperCase()||'FINISHED'} · ${game.resultReason}`;
  }
  function start(kind=scenario) {
    if(!kind)return;
    clearInput();accumulator=0;events=[];scenario=kind;boostDemo=null;rivalDemo=null;
    if(RIVAL_IDS.includes(kind))game=createTournamentGame(()=>{},{version:1,completedRounds:RIVAL_IDS.indexOf(kind)});
    else game=kind==='park'?new WaveParkGame():new SurfGame();
    game.onEvent=onEvent;game.start();
    $('status').textContent=game.isRace?`Race ${game.rival.name} through ${game.mode==='park'?'Waterworks':'Surf Session'}. Pass through every sun ring in order and reach the finish first.`:`${kind==='park'?'Waterworks':'Surf Session'}: checking that rivals and race markers are cleared.`;
    counters();
  }
  function pause() {
    clearInput();
    if(game?.phase==='running')game.pause();else if(game?.phase==='paused'){boostDemo=null;rivalDemo=null;game.resume();}
  }
  function startBoostDemo(kind) {
    start(scenario==='static'?'static':'rivet');
    boostDemo=createRaceBoostDemo(kind);
    $('status').textContent=`${kind==='combo'?'Spin → Tweaked Grab combo':'Tweaked Grab'}: waiting for GO, then a cutback and charged pop. Playback pauses after the clean landing; resume to feel the boost.`;
  }
  function startRivalDemo(kind) {
    start(RIVAL_IDS.includes(scenario)?scenario:'rivet');
    rivalDemo=kind;
    $('status').textContent=`Following ${game.rival.name}'s real route. Playback pauses ${kind==='boost'?'when a completed combo earns a speed boost':'during a held grab'}.`;
  }
  function counters() {
    if(!game)return;
    const rival=game.opponent,race=game.isRace;
    $('hud-position').textContent=game.phase==='finished'?(game.result||'FINISHED').toUpperCase():race&&game.countdownRemaining>0?`${Math.ceil(game.countdownRemaining)}…`:race?`${game.racePosition}/2`:'PRACTICE';
    $('hud-checkpoint').textContent=race&&game.countdownRemaining>0?'HOLD W · GET READY':race?`SUN RINGS ${game.nextCheckpoint}/${game.course.checkpoints.length} · ${Math.max(0,game.distanceRemaining).toFixed(0)} m TO FINISH`:game.objectiveText;
    $('hud-rival').textContent=race?game.rival.name:game.mode==='park'?'WATERWORKS':'SURF SESSION';
    $('hud-gap').textContent=race?`${Math.abs(game.lead).toFixed(1)} m ${game.lead>=0?'AHEAD':'BEHIND'}`:'Normal controls';
    $('stat-session').textContent=scenario;
    $('stat-phase').textContent=game.phase;
    $('stat-time').textContent=`${game.elapsed.toFixed(2)} s`;
    $('stat-speed').textContent=`${game.speed.toFixed(2)} / ${rival?rival.speed.toFixed(2):'—'} m/s`;
    $('stat-distance').textContent=`${raceDistance(game).toFixed(1)} / ${rival?raceDistance(rival).toFixed(1):'—'} m`;
    $('stat-checkpoints').textContent=race?`${game.nextCheckpoint} / ${rival.nextCheckpoint} of ${game.course.checkpoints.length}`:'—';
    $('stat-misses').textContent=race?`${game.raceMisses} / ${rival.raceMisses}`:'—';
    $('stat-remaining').textContent=race?game.distanceRemaining.toFixed(1)+' m':'—';
    $('stat-wipeouts').textContent=`${game.wipeouts} / ${rival?rival.wipeouts:'—'}`;
    $('stat-input').textContent=Object.entries(actualInput).filter(([,value])=>value).map(([key])=>key).join(' + ')||'none';
    $('stat-pop').textContent=`${game.popCooldown.toFixed(2)} s / ${game.launchSource}`;
    $('stat-boost').textContent=race&&game.boostTime>0?`${game.boostLabel} · +${game.boostSpeed.toFixed(1)} m/s · ${game.boostTime.toFixed(2)} s`:'None';
    $('stat-combo').textContent=`${game.pendingTricks} tricks · ${game.comboBase*game.multiplier} points`;
    $('stat-rival-trick').textContent=rival?.trick?.name || (rival?.airborne?'In the air':'Riding');
    $('stat-rival-boost').textContent=rival?.boostTime>0?`${rival.boostLabel} · +${rival.boostSpeed.toFixed(1)} m/s · ${rival.boostTime.toFixed(2)} s`:'None';
    $('stat-rival-combo').textContent=rival?`${rival.pendingTricks} tricks · ${rival.comboBase*rival.multiplier} points`:'—';
    $('stat-result').textContent=game.resultReason||'—';
    $('events').textContent=events.join('\n');$('pause').textContent=game.phase==='running'?'Pause':'Resume';
    $('hud-boost').textContent=race&&game.boostTime>0?`${game.boostLabel} +${game.boostSpeed.toFixed(0)} m/s`:'LAND TRICKS TO BOOST';
    $('hud-boost').hidden=!race;
    $('hud-rival-action').textContent=rival?.trick?.name || (rival?.boostTime>0?`${rival.boostLabel} +${rival.boostSpeed.toFixed(0)} m/s`:'');
    $('frame').disabled=game.phase==='finished';
    $('track').hidden=!race;
    if(race) {
      $('player-marker').style.left=Math.min(100,raceDistance(game)/game.course.length*100)+'%';
      $('rival-marker').style.left=Math.min(100,raceDistance(rival)/game.course.length*100)+'%';
    }
  }
  function tick() {
    actualInput=boostDemo?raceBoostDemoControls(game,boostDemo):rivalDemo?rivalReviewControls(game):$('autopilot').checked?raceLabControls(game):input;
    game.update(STEP,actualInput);
    if(boostDemo&&(boostDemo.landed||boostDemo.failed)) {
      game.pause();clearInput();
      $('status').textContent=boostDemo.landed?`${boostDemo.kind==='combo'?'Two-trick combo':'Single trick'} landed cleanly. Paused with the earned boost: press Resume to continue.`:'The demonstration wiped out. Restart the demo to retry the same legal input sequence.';
    }
    if(rivalDemo&&rivalReviewReady(game,rivalDemo)) {
      game.pause();clearInput();
      $('status').textContent=rivalDemo==='boost'?`${game.rival.name} landed a real combo and earned +${game.opponent.boostSpeed} m/s. The gold trail shows the active boost. Press Resume to continue.`:`${game.rival.name} is holding ${game.opponent.trick.name}. The hand and board follow the same grab animation as the player. Press Resume to continue.`;
    }
  }
  try {
    await loadCharacterTextures();
    world=new SurfWorld($('viewport'),validateProfile({character:'jax',outfit:'yardcrew',boardDesign:'tribal'}));
    game=new SurfGame();$('loading').remove();
    for(const kind of [...RIVAL_IDS,'surf','park'])$('run-'+kind).addEventListener('click',()=>{start(kind);$('run-'+kind).blur();});
    for(const kind of ['single','combo'])$('boost-'+kind).addEventListener('click',()=>{startBoostDemo(kind);$('boost-'+kind).blur();});
    for(const kind of ['trick','boost'])$('rival-'+kind).addEventListener('click',()=>{startRivalDemo(kind);$('rival-'+kind).blur();});
    $('restart').addEventListener('click',()=>start());
    $('pause').addEventListener('click',pause);
    $('frame').addEventListener('click',()=>{if(!scenario||game.phase==='finished')return;game.resume();tick();game.pause();counters();});
    $('autopilot').addEventListener('change',clearInput);
    const actions={
      toggleSound(){},closeWorkshop(){},cycleCharacter(){},closeModal(){},rotatePreview(){},isWardrobeOpen:()=>false,hideWardrobe(){},
      startRun:()=>start(),restartRun:()=>start(),pause,toast:text=>{$('status').textContent=text;},
      pressControl:code=>{pressed.add(code);syncInput();},tryTrick:type=>game.doTrick(type),
    };
    const keydown=createKeydownHandler(()=>({bootReady:true,workshopMode:null,modalMode:null,game,input}),actions);
    window.addEventListener('keydown',event=>{if(event.target instanceof HTMLSelectElement)return;keydown(event);});
    window.addEventListener('keyup',event=>{
      if(!CONTROL_KEYS[event.code])return;
      const wasJump=input.jump;pressed.delete(event.code);syncInput();
      if(event.code==='Space'&&wasJump&&!input.jump&&game.phase==='running'&&!$('autopilot').checked)game.jump();
    });
    window.addEventListener('blur',()=>{clearInput();if(game.phase==='running')game.pause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();game.pause();}});
    let previous=performance.now();
    function frame(now) {
      const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
      if(game.phase==='running') {
        accumulator+=dt*Number($('rate').value);
        while(accumulator>=STEP&&game.phase==='running'){tick();accumulator-=STEP;}
      } else accumulator=0;
      world.update(dt,game);counters();requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch(error) {
    console.error(error);
    const loading=$('loading');if(loading)loading.textContent='Race Lab could not start: '+error.message;
    $('status').textContent='Race Lab could not start: '+error.message;
  }
}

if(typeof document!=='undefined')boot();
