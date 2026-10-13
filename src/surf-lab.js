import { SurfGame,courseItem } from './game.js';
import { SurfWorld } from './world.js';
import { validateProfile } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';
import { sampleRiderTrick } from './rider-pose.js';
import { barrelCrossSection,stormBarrel } from './storm-waves.js';
import { surfHazardsNear } from './surf-hazards.js';
import { chooseSurfWeather,resolveWorldWeather } from './surf-weather.js';

const $=id=>document.getElementById(id);
const names={session:'WEATHER RIDE',grab:'INDY GRAB',tweak:'TWEAKED GRAB',cutback:'ROUNDHOUSE CUTBACK',rush:'REEF RUSH',storm:'ENDLESS STORM',barrel:'CURLING WAVE',closing:'CLOSING WAVE',driftwood:'DRIFTWOOD HOP',whirlpool:'WHIRLPOOL APPROACH'};
let world,game,scenario=null,stage='ready',setupAt=0,checkpoint=false,passedCheckpoint=false,completed=false,input={},events=[],previousWeather=null;
const stormScenarios=['storm','barrel','closing','whirlpool'];

function onEvent(event) {
  world.onEvent(event,game);
  if(event.type!=='reset')events.unshift(`${game.elapsed.toFixed(3)} · ${event.type}${event.name?' · '+event.name:''}${event.reason?' · '+event.reason:''}`);
  events=events.slice(0,9);
  if(event.type==='finish'){completed=true;$('status').textContent=game.resultReason;}
}

function start(kind) {
  scenario=kind;stage='approach';setupAt=0;checkpoint=false;passedCheckpoint=false;completed=false;input={};events=[];
  game=new SurfGame(()=>{},stormScenarios.includes(kind)?'storm':kind==='rush'?'rush':'surf');game.onEvent=onEvent;game.start();
  applyLabWeather();
  $('rate').value=['rush','storm','barrel','closing','driftwood','whirlpool'].includes(kind)?'4':'1';
  $('status').textContent=kind==='rush'?'Following the visible race course using steering and pump controls.':kind==='closing'?'Pumping into the first barrel, then braking beneath the lip to demonstrate its real closing impact.':kind==='whirlpool'?'Riding through the first barrel toward the swirling current. The preview pauses 25 metres before the whirlpool.':stormScenarios.includes(kind)?'Pumping through the storm, hopping driftwood and steering around whirlpools toward the curling wave.':kind==='driftwood'?'Lining up the first driftwood branch, then tapping Space for a small flat hop.':kind==='session'?'A real surf run with the selected weather. This selector belongs only to the preview; the game chooses a different sky each run.':kind==='cutback'?'Building a right-hand carve, then holding Shift and turning left.':'Earning a cutback boost with Shift + turn, then charging and popping into the trick.';
  updateCounters();
}

function applyLabWeather(){
  const choice=$('weather').value;
  const id=game.rulesId==='storm'?'storm':choice==='random'?chooseSurfWeather(previousWeather):choice;
  game.weatherId=id;previousWeather=id;
  $('weather').disabled=game.rulesId==='storm';
}

// Exported for headless verification of these exact preview controls. This
// function only returns ordinary input buttons; it never changes game state.
export function surfLabRouteControls(game) {
  if(game.rulesId==='storm') {
    const tube=game.barrel;
    let target=tube?barrelCrossSection(stormBarrel(tube.index),-Math.max(game.distance,tube.startDistance+8),game.elapsed).centerX:0;
    const index=Math.max(0,Math.floor((game.distance-game.rules.firstGate)/game.rules.spacing));
    for(let i=Math.max(0,index-1);i<=index+2;i++) {
      const item=courseItem(i,'storm'),ahead=item.hazardDistance-game.distance;
      if(ahead> -3&&ahead<32&&Math.abs(target-item.hazardX)<item.hazardRadius+1.3) {
        const choices=[item.hazardX-item.hazardRadius-1.5,item.hazardX+item.hazardRadius+1.5]
          .filter(x=>Math.abs(x)<13&&(!tube||Math.abs(x-target)<3));
        if(choices.length)target=choices.sort((a,b)=>Math.abs(a-game.x)-Math.abs(b-game.x))[0];
      }
    }
    let jump=false;
    for(const item of surfHazardsNear(game.distance,'storm',game.elapsed,8,40)) {
      const ahead=item.distance-game.distance;
      if(item.type==='driftwood'&&ahead>3&&ahead<6&&Math.abs(game.x-item.x)<item.radiusX+.5&&game.popReady)jump=true;
      if(item.type==='whirlpool'&&ahead>-4&&ahead<28&&Math.abs(target-item.x)<5.5)target=item.x+(game.x<item.x?-6:6);
    }
    const error=target-game.x-game.vx*.24;
    return {left:error<-.22,right:error>.22,pump:true,jump};
  }
  const index=Math.max(0,Math.floor((game.distance-game.rules.firstGate)/game.rules.spacing)),targets=[];
  for(let i=Math.max(0,index-1);i<index+3;i++) {
    const item=courseItem(i,game.rulesId);
    if(!game.processed.has('g'+i)&&item.distance>=game.distance)targets.push({distance:item.distance,x:item.x});
    if(!game.processed.has('h'+i)&&item.hazardDistance+2.2>=game.distance)targets.push({distance:item.hazardDistance+2.2,x:Math.max(-10,Math.min(10,item.hazardX+(item.hazardX>0?-6:6)))});
  }
  targets.sort((a,b)=>a.distance-b.distance);
  const error=(targets[0]?.x??0)-game.x-game.vx*.22;
  const jump=game.surfAdventureEnabled&&game.popReady&&surfHazardsNear(game.distance,game.rulesId,game.elapsed,0,7).some(item=>item.type==='driftwood'&&item.distance-game.distance>3&&Math.abs(game.x-item.x)<item.radiusX+.5);
  return {pump:true,left:error<-.35,right:error>.35,jump};
}

export function surfLabDriftwoodControls(game){
  const item=surfHazardsNear(0,'surf',0,0,90).find(hazard=>hazard.type==='driftwood');
  const error=item.x-game.x-game.vx*.24,ahead=item.distance-game.distance;
  return {pump:true,left:error<-.2,right:error>.2,jump:ahead>3&&ahead<6&&game.popReady};
}

export function surfLabClosingControls(game){
  const route=surfLabRouteControls(game);
  if(game.barrel?.inside&&game.barrel.progress>.22){route.pump=false;route.brake=true;route.jump=false;}
  return route;
}

export function applySurfLabControls(game,buttons){
  if(buttons.jump&&game.popReady)game.jump();
  game.update(1/120,buttons);
}

function controls() {
  if(['session','rush','storm','barrel','whirlpool'].includes(scenario))return surfLabRouteControls(game);
  if(scenario==='closing')return surfLabClosingControls(game);
  if(scenario==='driftwood')return surfLabDriftwoodControls(game);
  if(scenario==='cutback') {
    if(stage==='approach'&&game.elapsed>=.65)stage='cutback';
    return stage==='approach'?{pump:true,right:true}:{grind:true,left:true};
  }
  if(stage==='approach'&&game.elapsed>=.35)stage='setup';
  if(stage==='setup'&&!game.cutbackActive&&game.cutbackLaunchTime>0){stage='charge';setupAt=game.elapsed;}
  if(stage==='charge'&&game.elapsed-setupAt>=.3) {
    if(game.jump()&&game.doTrick(scenario==='grab'?'grab':'tweak'))stage='air';
  }
  return stage==='approach'?{pump:true,right:true}:stage==='setup'?{grind:true,left:true,jump:true}:stage==='charge'?{jump:true,pump:true}:{};
}

function stop(message,done=false) {
  game.pause();checkpoint=!done;completed=done;$('status').textContent=message;
}

function tick() {
  input=controls();
  if(['session','rush','storm','barrel','closing','driftwood','whirlpool'].includes(scenario))applySurfLabControls(game,input);else game.update(1/120,input);
  if(scenario==='grab'||scenario==='tweak') {
    if(!passedCheckpoint&&game.trick&&game.trick.age/game.trick.duration>=.5)stop(scenario==='grab'?'Grab hold: the hand is on the real board rail. Continue to finish the trick and land.':'Tweaked grab hold: tucked legs, banked surfboard and a raised free arm. Continue to finish and land.');
    else if(stage==='air'&&passedCheckpoint&&!game.airborne){game.bank();stop(game.wipeouts?'Sequence ended in a wipeout.':'Sequence complete: trick landed and points banked.',true);}
  } else if(scenario==='barrel') {
    if(!passedCheckpoint&&game.barrel?.inside&&game.barrel.progress>=.4)stop('Inside the curling wave. The water rises from the face and curls overhead; follow the opening to the exit.');
    else if(passedCheckpoint&&game.barrelsSurvived>0)stop('Barrel completed through ordinary steering. Exit bonus awarded. Choose Endless storm for the longer survival preview.',true);
  } else if(scenario==='closing'){
    if(!passedCheckpoint&&game.barrel?.inside&&game.barrel.progress>=.27)stop('Inside the first barrel. Continue to hold the brake: the visible lip will fall onto the rider if there is no quick escape.');
    else if(passedCheckpoint&&game.bailTime>0){stop('The falling water touched the rider. One life was lost to the closing wave; the deadline itself did no damage.',true);}
  } else if(scenario==='driftwood'){
    if(!passedCheckpoint&&game.airborne&&game.distance>=70.5)stop('Flat hop over driftwood. The board is lifted just enough to clear the branch, without generating trick points.');
    else if(passedCheckpoint&&!game.airborne&&game.distance>75)stop(game.wipeouts?'The branch caught this attempt. Restart to retry.':'Driftwood cleared with a real Space tap. No points or speed boost were awarded for the small hop.',true);
  } else if(scenario==='whirlpool'){
    if(!passedCheckpoint&&game.distance>=275)stop('Whirlpool ahead: the funnel pulls nearby water inward. Continue to pump and steer wide around its centre.');
    else if(passedCheckpoint&&game.distance>=312)stop(game.wipeouts?'The current caught this attempt. Restart to retry.':'Whirlpool avoided by steering wide. The first barrel and the swirling current were passed with ordinary riding controls.',true);
  } else if(scenario==='storm'&&!passedCheckpoint&&game.barrelsSurvived>=2&&game.phase==='running'){
    stop(`Two barrels survived with ${game.lives} lives remaining. Continue into stronger swell, more debris and whirlpools. Survival has no time limit.`);
  } else if(scenario==='cutback') {
    if(!passedCheckpoint&&game.cutbackActive&&game.cutbackProgress>=.5)stop('Peak cutback: the board carves across the face and throws a spray fan. Continue to finish.');
    else if(stage==='cutback'&&passedCheckpoint&&!game.cutbackActive)stop('Sequence complete: cutback boost earned. Pop within 2.2 seconds for trick airtime; the setup itself scores no points.',true);
  }
}

function resume() {
  if(!scenario||completed)return;
  if(checkpoint){checkpoint=false;passedCheckpoint=true;}
  game.resume();$('status').textContent='Playing…';
}

function updateCounters() {
  const pose=sampleRiderTrick(game);
  $('stat-scenario').textContent=scenario?names[scenario]:'—';$('stat-phase').textContent=game.phase;
  $('stat-state').textContent=game.bailTime>0?'WIPEOUT':game.trick?.name|| (game.airborne?'AIRBORNE':game.barrel?.inside?'IN THE BARREL':game.cutbackActive?'CUTBACK':'RIDING');
  $('stat-time').textContent=game.rulesId==='storm'?`${game.elapsed.toFixed(3)} s / ENDLESS`:`${game.elapsed.toFixed(3)} s / ${game.time.toFixed(2)} s`;
  $('stat-lives').textContent=game.lives??'unlimited';$('stat-rings').textContent=String(game.gates)+(game.rulesId==='rush'?' / 12':'');
  $('stat-points').textContent=`${game.score} / ${game.comboBase} × ${game.multiplier}`;
  $('stat-controls').textContent=Object.entries(input).filter(([,held])=>held).map(([name])=>({pump:'W',brake:'S',left:'A',right:'D',jump:'SPACE',grind:'SHIFT'}[name]||name)).join(' + ')||'none';
  $('stat-progress').textContent=game.trick?(pose.progress*100).toFixed(1)+'%':'—';$('stat-tweak').textContent=((pose.tweak||0)*100).toFixed(1)+'%';
  $('stat-storm').textContent=game.rulesId==='storm'?`Swell ${game.stormStage||1} / ${Math.round((game.stormDifficulty||0)*100)}% / ${game.barrelsSurvived||0} barrels`:'—';
  $('stat-barrel').textContent=game.rulesId==='storm'?`${game.barrel?.inside?'INSIDE':game.barrel?'APPROACH':'BETWEEN WAVES'} / ${game.barrelTime.toFixed(2)} s inside${game.barrel?` / ${Math.round(game.barrel.progress*100)}% through`:''}`:'—';
  const weather=resolveWorldWeather(game);
  $('stat-weather').textContent=weather?`${weather.label} / ${weather.timeLabel}`:'—';
  $('stat-boost').textContent=game.surfBoostTime>0?`${game.surfBoostLabel} / +${game.surfBoostSpeed.toFixed(1)} m/s / ${game.surfBoostTime.toFixed(2)} s`:'Land a trick to boost';
  $('stat-hazard').textContent=game.hazardWarning||'Clear water';
  $('stat-deadline').textContent=game.barrelWarning?game.barrelClosingProgress>0?`CLOSING / ${Math.round(game.barrelClosingProgress*100)}%`:`${game.barrelRemaining.toFixed(2)} s before closing`:'—';
  const landmarks=world.surfer.landmarks;
  $('stat-contact').textContent=pose.holdingGrab&&landmarks.rightFingertip&&landmarks.boardGrabTarget?(landmarks.rightFingertip.distanceTo(landmarks.boardGrabTarget)*1000).toFixed(3)+' mm':'— (not held)';
  $('stat-cutback').textContent=`${(game.cutback*100).toFixed(1)}% lean / ${game.cutbackLaunchTime.toFixed(2)} s boost / ${game.popCooldown.toFixed(2)} s pop recovery`;
  $('stat-danger').textContent=`${Math.round(game.danger*100)}%${game.landingWarning?' · '+game.landingWarning:''}`;
  $('stat-wipeouts').textContent=String(game.wipeouts);$('stat-result').textContent=game.resultReason||(completed?(scenario==='barrel'?'CLEAN BARREL / BONUS AWARDED':game.wipeouts?'WIPEOUT':scenario==='cutback'?'CUTBACK BOOST READY':scenario==='driftwood'?'DRIFTWOOD CLEARED':scenario==='whirlpool'?'WHIRLPOOL AVOIDED':'LANDED / BANKED'):'—');
  $('events').textContent=events.join('\n');$('pause').textContent=game.phase==='running'?'Pause':'Resume';
  $('continue').disabled=!scenario||completed;$('restart').disabled=!scenario;$('frame').disabled=!scenario||completed;
}

if(typeof document!=='undefined')try {
  await loadCharacterTextures();
  world=new SurfWorld($('viewport'),validateProfile({character:'jax',outfit:'yardcrew',boardDesign:'tribal'}));
  game=new SurfGame();$('loading').remove();
  for(const kind of Object.keys(names))$('run-'+kind).addEventListener('click',()=>start(kind));
  $('weather').addEventListener('change',()=>{applyLabWeather();updateCounters();});
  $('continue').addEventListener('click',resume);$('restart').addEventListener('click',()=>scenario&&start(scenario));
  $('pause').addEventListener('click',()=>{if(game.phase==='running')game.pause();else resume();});
  $('frame').addEventListener('click',()=>{if(!scenario||completed)return;resume();tick();game.pause();});
  let previous=performance.now(),accumulator=0;
  function frame(now) {
    const dt=Math.min(.05,(now-previous)/1000);previous=now;
    if(game.phase==='running') {
      accumulator+=dt*Number($('rate').value);
      while(accumulator>=1/120&&game.phase==='running'){tick();accumulator-=1/120;}
    }else accumulator=0;
    world.update(dt,game);updateCounters();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}catch(error){console.error(error);const loading=$('loading');if(loading)loading.textContent='Surf Lab could not start: '+error.message;else $('status').textContent=error.message;}
