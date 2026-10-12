import { SurfGame, courseItem } from './game.js';
import { WaveParkGame } from './park.js';
import { createTournamentGame } from './tournament.js';
import { SurfWorld } from './world.js';
import { validateProfile } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';
import { CONTROL_KEYS, createKeydownHandler } from './keyboard.js';

const STEP=1/120;

// A review-only route follower: it can press ordinary controls but cannot
// grant checkpoint credit, set positions or alter either racer's physics.
export function raceLabControls(game) {
  if(game.mode==='park')return {pump:true};
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

async function boot() {
  const $=id=>document.getElementById(id),pressed=new Set();
  let world,game,scenario=null,input={},actualInput={},events=[],accumulator=0;
  const clearInput=()=>{pressed.clear();input={};};
  function syncInput(){input={};for(const code of pressed)input[CONTROL_KEYS[code]]=true;}
  function onEvent(event) {
    if(!game)return;
    world?.onEvent(event,game);
    if(!['reset','wall'].includes(event.type))events.unshift(`${game.elapsed.toFixed(2)} · ${event.type}${event.reason?' · '+event.reason:''}${event.name?' · '+event.name:''}`);
    events=events.slice(0,11);
    if(event.type==='finish')$('status').textContent=`${game.result?.toUpperCase()||'FINISHED'} · ${game.resultReason}`;
  }
  function start(kind=scenario) {
    if(!kind)return;
    clearInput();accumulator=0;events=[];scenario=kind;
    if(kind==='rivet'||kind==='static')game=createTournamentGame(()=>{},{version:1,completedRounds:kind==='rivet'?1:3});
    else game=kind==='park'?new WaveParkGame():new SurfGame();
    game.onEvent=onEvent;game.start();
    $('status').textContent=game.isRace?`Race ${game.rival.name} through the surf course. Follow the checkpoints and reach the finish first.`:`${kind==='park'?'Waterworks':'Surf Session'}: checking that ocean rivals and race markers are cleared.`;
    counters();
  }
  function pause() {
    clearInput();
    if(game?.phase==='running')game.pause();else if(game?.phase==='paused')game.resume();
  }
  function counters() {
    if(!game)return;
    const rival=game.opponent,race=game.isRace;
    $('hud-position').textContent=game.phase==='finished'?(game.result||'FINISHED').toUpperCase():race&&game.countdownRemaining>0?`${Math.ceil(game.countdownRemaining)}…`:race?`${game.racePosition}/2`:'PRACTICE';
    $('hud-checkpoint').textContent=race&&game.countdownRemaining>0?'HOLD W · GET READY':race?`CHECKPOINT ${game.nextCheckpoint}/${game.course.checkpoints.length} · ${Math.max(0,game.distanceRemaining).toFixed(0)} m TO FINISH`:game.objectiveText;
    $('hud-rival').textContent=race?game.rival.name:game.mode==='park'?'WATERWORKS':'SURF SESSION';
    $('hud-gap').textContent=race?`${Math.abs(game.lead).toFixed(1)} m ${game.lead>=0?'AHEAD':'BEHIND'}`:'Normal controls';
    $('stat-session').textContent=scenario;
    $('stat-phase').textContent=game.phase;
    $('stat-time').textContent=`${game.elapsed.toFixed(2)} s`;
    $('stat-speed').textContent=`${game.speed.toFixed(2)} / ${rival?rival.speed.toFixed(2):'—'} m/s`;
    $('stat-distance').textContent=`${game.distance.toFixed(1)} / ${rival?rival.distance.toFixed(1):'—'} m`;
    $('stat-checkpoints').textContent=race?`${game.nextCheckpoint} / ${rival.nextCheckpoint} of ${game.course.checkpoints.length}`:'—';
    $('stat-remaining').textContent=race?game.distanceRemaining.toFixed(1)+' m':'—';
    $('stat-wipeouts').textContent=`${game.wipeouts} / ${rival?rival.wipeouts:'—'}`;
    $('stat-input').textContent=Object.entries(actualInput).filter(([,value])=>value).map(([key])=>key).join(' + ')||'none';
    $('stat-pop').textContent=`${game.popCooldown.toFixed(2)} s / ${game.launchSource}`;
    $('stat-result').textContent=game.resultReason||'—';
    $('events').textContent=events.join('\n');$('pause').textContent=game.phase==='running'?'Pause':'Resume';
    $('frame').disabled=game.phase==='finished';
    $('track').hidden=!race;
    if(race) {
      $('player-marker').style.left=Math.min(100,game.distance/game.course.length*100)+'%';
      $('rival-marker').style.left=Math.min(100,rival.distance/game.course.length*100)+'%';
    }
  }
  function tick() {
    actualInput=$('autopilot').checked?raceLabControls(game):input;
    game.update(STEP,actualInput);
  }
  try {
    await loadCharacterTextures();
    world=new SurfWorld($('viewport'),validateProfile({character:'jax',outfit:'yardcrew',boardDesign:'tribal'}));
    game=new SurfGame();$('loading').remove();
    for(const kind of ['rivet','static','surf','park'])$('run-'+kind).addEventListener('click',()=>{start(kind);$('run-'+kind).blur();});
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
