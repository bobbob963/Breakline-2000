import { SurfGame,courseItem } from './game.js';
import { SurfWorld } from './world.js';
import { validateProfile } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';
import { sampleRiderTrick } from './rider-pose.js';
import { barrelCrossSection,stormBarrel } from './storm-waves.js';

const $=id=>document.getElementById(id);
const names={grab:'INDY GRAB',tweak:'TWEAKED GRAB',cutback:'ROUNDHOUSE CUTBACK',rush:'REEF RUSH',storm:'ENDLESS STORM',barrel:'CURLING WAVE'};
let world,game,scenario=null,stage='ready',setupAt=0,checkpoint=false,passedCheckpoint=false,completed=false,input={},events=[];

function onEvent(event) {
  world.onEvent(event,game);
  if(event.type!=='reset')events.unshift(`${game.elapsed.toFixed(3)} · ${event.type}${event.name?' · '+event.name:''}${event.reason?' · '+event.reason:''}`);
  events=events.slice(0,9);
  if(event.type==='finish'){completed=true;$('status').textContent=game.resultReason;}
}

function start(kind) {
  scenario=kind;stage='approach';setupAt=0;checkpoint=false;passedCheckpoint=false;completed=false;input={};events=[];
  game=new SurfGame(()=>{},kind==='barrel'?'storm':kind==='rush'||kind==='storm'?kind:'surf');game.onEvent=onEvent;game.start();
  $('rate').value=['rush','storm','barrel'].includes(kind)?'4':'1';
  $('status').textContent=kind==='rush'?'Following the visible race course using steering and pump controls.':['storm','barrel'].includes(kind)?'Steering around visible reefs and lining up the wave tunnels at normal riding speed.':kind==='cutback'?'Building a right-hand carve, then holding Shift and turning left.':'Earning a cutback boost with Shift + turn, then charging and popping into the trick.';
  updateCounters();
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
    const error=target-game.x-game.vx*.24;
    return {left:error<-.22,right:error>.22};
  }
  const index=Math.max(0,Math.floor((game.distance-game.rules.firstGate)/game.rules.spacing)),targets=[];
  for(let i=Math.max(0,index-1);i<index+3;i++) {
    const item=courseItem(i,game.rulesId);
    if(!game.processed.has('g'+i)&&item.distance>=game.distance)targets.push({distance:item.distance,x:item.x});
    if(!game.processed.has('h'+i)&&item.hazardDistance+2.2>=game.distance)targets.push({distance:item.hazardDistance+2.2,x:Math.max(-10,Math.min(10,item.hazardX+(item.hazardX>0?-6:6)))});
  }
  targets.sort((a,b)=>a.distance-b.distance);
  const error=(targets[0]?.x??0)-game.x-game.vx*.22;
  return {pump:true,left:error<-.35,right:error>.35};
}

function controls() {
  if(['rush','storm','barrel'].includes(scenario))return surfLabRouteControls(game);
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
  input=controls();game.update(1/120,input);
  if(scenario==='grab'||scenario==='tweak') {
    if(!passedCheckpoint&&game.trick&&game.trick.age/game.trick.duration>=.5)stop(scenario==='grab'?'Grab hold: the hand is on the real board rail. Continue to finish the trick and land.':'Tweaked grab hold: tucked legs, banked surfboard and a raised free arm. Continue to finish and land.');
    else if(stage==='air'&&passedCheckpoint&&!game.airborne){game.bank();stop(game.wipeouts?'Sequence ended in a wipeout.':'Sequence complete: trick landed and points banked.',true);}
  } else if(scenario==='barrel') {
    if(!passedCheckpoint&&game.barrel?.inside&&game.barrel.progress>=.4)stop('Inside the curling wave. The water rises from the face and curls overhead; follow the opening to the exit.');
    else if(passedCheckpoint&&game.barrelsSurvived>0)stop('Barrel completed through ordinary steering. Exit bonus awarded. Choose Endless storm for the longer survival preview.',true);
  } else if(scenario==='storm'&&!passedCheckpoint&&game.elapsed>=125&&game.phase==='running'){
    stop(`Preview paused at 2:05 with ${game.lives} lives remaining. The run has not ended: there is no time limit. Continue to ride the stronger swell.`);
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
  $('stat-controls').textContent=Object.entries(input).filter(([,held])=>held).map(([name])=>({pump:'W',left:'A',right:'D',jump:'SPACE',grind:'SHIFT'}[name]||name)).join(' + ')||'none';
  $('stat-progress').textContent=game.trick?(pose.progress*100).toFixed(1)+'%':'—';$('stat-tweak').textContent=((pose.tweak||0)*100).toFixed(1)+'%';
  $('stat-storm').textContent=game.rulesId==='storm'?`Swell ${game.stormStage||1} / ${Math.round((game.stormDifficulty||0)*100)}% / ${game.barrelsSurvived||0} barrels`:'—';
  $('stat-barrel').textContent=game.rulesId==='storm'?`${game.barrel?.inside?'INSIDE':game.barrel?'APPROACH':'BETWEEN WAVES'} / ${game.barrelTime.toFixed(2)} s inside${game.barrel?` / ${Math.round(game.barrel.progress*100)}% through`:''}`:'—';
  const landmarks=world.surfer.landmarks;
  $('stat-contact').textContent=pose.holdingGrab&&landmarks.rightFingertip&&landmarks.boardGrabTarget?(landmarks.rightFingertip.distanceTo(landmarks.boardGrabTarget)*1000).toFixed(3)+' mm':'— (not held)';
  $('stat-cutback').textContent=`${(game.cutback*100).toFixed(1)}% lean / ${game.cutbackLaunchTime.toFixed(2)} s boost / ${game.popCooldown.toFixed(2)} s pop recovery`;
  $('stat-danger').textContent=`${Math.round(game.danger*100)}%${game.landingWarning?' · '+game.landingWarning:''}`;
  $('stat-wipeouts').textContent=String(game.wipeouts);$('stat-result').textContent=game.resultReason||(completed?(scenario==='barrel'?'CLEAN BARREL / BONUS AWARDED':game.wipeouts?'WIPEOUT':scenario==='cutback'?'CUTBACK BOOST READY':'LANDED / BANKED'):scenario==='storm'&&game.elapsed>=125?'125s+ / ENDLESS RUN ACTIVE':'—');
  $('events').textContent=events.join('\n');$('pause').textContent=game.phase==='running'?'Pause':'Resume';
  $('continue').disabled=!scenario||completed;$('restart').disabled=!scenario;$('frame').disabled=!scenario||completed;
}

if(typeof document!=='undefined')try {
  await loadCharacterTextures();
  world=new SurfWorld($('viewport'),validateProfile({character:'jax',outfit:'yardcrew',boardDesign:'tribal'}));
  game=new SurfGame();$('loading').remove();
  for(const kind of Object.keys(names))$('run-'+kind).addEventListener('click',()=>start(kind));
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
