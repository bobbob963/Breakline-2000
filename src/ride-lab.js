import * as THREE from 'three';
import { WaveParkGame, parkSurface } from './park.js';
import { SurfWorld } from './world.js';
import { validateProfile } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';

const $=id=>document.getElementById(id),degrees=value=>(value*180/Math.PI).toFixed(1)+'°';
const names={pipe:'WEST PIPE LOOP',lip:'LIP GRAB TURNBACK',coping:'DIRECT COPING ENTRY',air:'QUARTERPIPE AIR',pop:'CHARGED RAMP POP',left:'SHIFT + A CUTBACK',right:'SHIFT + D CUTBACK'};
let world,game,scenario=null,checkpoint=0,atCheckpoint=false,completed=false,attached=false,input={},events=[];
let popReleased=false,airStarted=false,longestAir=0,highestY=0;
const headPosition=new THREE.Vector3();

function onEvent(event) {
  if(!game)return;
  world?.onEvent(event,game);
  if(!['reset','wall'].includes(event.type))events.unshift(`${game.elapsed.toFixed(3)} · ${event.type}${event.name?' · '+event.name:''}${event.id?' · '+event.id:''}`);
  events=events.slice(0,8);
}

function start(kind) {
  scenario=kind;checkpoint=0;atCheckpoint=false;completed=false;attached=false;events=[];
  popReleased=false;airStarted=false;longestAir=0;highestY=0;
  game.start(kind==='pipe'?'west':['left','right'].includes(kind)?'basin':'filters');
  $('status').textContent={pipe:'Approaching the west tunnel. The first stop is a wall ride.',lip:'Pumping up the filter halfpipe with E held.',coping:'Pumping up the filter halfpipe with Shift held. No jump input.',air:'Pumping up the filter halfpipe. No jump input; the ramp should carry the rider into the air.',pop:'Holding Space on the approach, then releasing it at 78% of the ramp.',left:'Holding Shift + A from the South Canal drop-in.',right:'Holding Shift + D from the South Canal drop-in.'}[kind];
  updateCounters();
}

function controls() {
  if(scenario==='left'||scenario==='right')return {grind:true,[scenario]:true};
  if(scenario==='pipe') {
    if(game.pipeRide)attached=true;
    return attached?{action:checkpoint<3,right:checkpoint<3,brake:true}:{action:true,pump:true};
  }
  if(scenario==='lip')return {action:true,pump:true};
  if(scenario==='air'||scenario==='pop')return {pump:true,jump:scenario==='pop'&&!popReleased};
  return {grind:checkpoint<1,pump:checkpoint<1,brake:checkpoint>=1};
}

function stop(message,done=false) {
  game.pause();atCheckpoint=true;completed=done;$('status').textContent=message;
}

function detectCheckpoint() {
  if(scenario==='pipe') {
    const angle=Math.abs(game.pipeRide?.angle||0);
    if(checkpoint===0&&angle>=Math.PI/2)stop('Wall checkpoint: the whole surfer follows the inside wall. Continue to the ceiling.');
    else if(checkpoint===1&&angle>=Math.PI)stop('Ceiling checkpoint: the surfer is inverted inside the pipe. Continue through the full loop.');
    else if(checkpoint===2&&game.pipeLoops>=1)stop('Full loop completed. Continue to release E and settle upright.');
    else if(checkpoint===3&&attached&&!game.pipeRide){game.bank();stop('Sequence complete: one full pipe loop, released safely and banked.',true);}
  } else if(scenario==='lip') {
    if(checkpoint===0&&game.lipMove?.progress>=.5)stop('Grab checkpoint: the hand reaches the board during the turnback. Continue to finish.');
    else if(checkpoint===1&&!game.lipMove&&game.comboNames.includes('LIP GRAB 180')){game.bank();stop('Sequence complete: lip grab, 180° reversal, and return to the ramp.',true);}
  } else if(scenario==='coping') {
    if(game.grinding)attached=true;
    if(checkpoint===0&&game.grinding?.age>=.5)stop('Coping checkpoint: entered directly from the ramp with Shift held. Continue to drop back in.');
    else if(checkpoint===1&&attached&&!game.grinding&&!game.airborne){game.bank();stop('Sequence complete: coping grind, release, and landed drop-in.',true);}
  } else if(scenario==='air'||scenario==='pop') {
    if(game.airborne){airStarted=true;longestAir=Math.max(longestAir,game.airtime);highestY=Math.max(highestY,game.y);}
    if(game.wipeouts>0)stop('Sequence ended in a wipeout. Inspect the position and recent events.',true);
    else if(checkpoint===0&&game.airborne&&game.vy<=0)stop('Apex checkpoint: the rider cleared the lip and is turning back into the halfpipe. Continue to land.');
    else if(checkpoint===1&&airStarted&&!game.airborne){game.bank();stop('Sequence complete: ramp air, return to the bowl, and landed safely.',true);}
    else if(game.elapsed>9)stop('Sequence did not complete. Inspect the position and recent events.',true);
  } else if(scenario==='left'||scenario==='right') {
    if(game.cutbackActive)attached=true;
    if(checkpoint===0&&game.cutbackActive&&game.cutbackProgress>=.5)stop('Cutback checkpoint: the surfer banks into the sharp turn. Continue to finish.');
    else if(checkpoint===1&&attached&&!game.cutbackActive)stop('Sequence complete: a sharp grounded cutback. No trick points or extra pop boost.',true);
    else if(game.elapsed>4)stop('Cutback did not complete. Inspect the recent events.',true);
  }
}

function tick() {
  input=controls();
  if(scenario==='pop'&&!popReleased&&parkSurface(game.x,game.z).progress>=.78){
    popReleased=true;input.jump=false;game.jump();
  }
  game.update(1/120,input);detectCheckpoint();
}

function resume() {
  if(!scenario||completed)return;
  if(atCheckpoint){checkpoint++;atCheckpoint=false;}
  game.resume();$('status').textContent='Playing the next part of the sequence…';
}

function step(count) {
  if(!scenario||completed)return;
  if(atCheckpoint){checkpoint++;atCheckpoint=false;}
  game.resume();
  for(let i=0;i<count&&game.phase==='running';i++)tick();
  game.pause();updateCounters();
}

function updateCounters() {
  $('stat-sequence').textContent=scenario?names[scenario]:'—';
  $('stat-time').textContent=game.elapsed.toFixed(3)+' s';
  const action=game.pipeRide?'pipe wall ride':game.lipMove?'lip grab':game.grinding?'coping grind':game.airborne?'airborne':game.cutbackActive?'cutback':'riding';
  $('stat-state').textContent=game.phase+' / '+action;
  $('stat-controls').textContent=Object.entries(input).filter(([,held])=>held).map(([key])=>({action:'E',left:'A',right:'D',pump:'W',brake:'S',grind:'SHIFT',jump:'SPACE'}[key]||key)).join(' + ')||'none';
  $('stat-position').textContent=[game.x,game.y,game.z].map(v=>v.toFixed(2)).join(', ');
  $('stat-heading').textContent=degrees(game.heading);
  $('stat-pipe').textContent=(game.pipeRide?degrees(game.pipeRide.angle):'none')+' / '+game.pipeLoops;
  $('stat-up').textContent=Object.values(game.rideUp).map(v=>v.toFixed(2)).join(', ');
  $('stat-lip').textContent=`${(game.lipGrab*100).toFixed(1)}% grab / ${((game.lipMove?.progress||0)*100).toFixed(1)}% turn`;
  $('stat-grind').textContent=game.grinding?`${game.grinding.rail.id} · ${game.grinding.age.toFixed(2)} s`:'none';
  const surface=parkSurface(game.x,game.z);
  $('stat-ramp').textContent=surface.ramp?`${surface.ramp.id} / ${(surface.progress*100).toFixed(1)}%`:'none';
  $('stat-air').textContent=`${longestAir.toFixed(2)} s / ${highestY.toFixed(2)} m`;
  world.surfer.head.getWorldPosition(headPosition);$('stat-head').textContent=headPosition.toArray().map(v=>v.toFixed(2)).join(', ');
  $('stat-score').textContent=`${game.score} / ${game.comboBase} × ${game.multiplier}`;
  $('stat-wipeouts').textContent=String(game.wipeouts);$('events').textContent=events.join('\n');
  $('pause').textContent=game.phase==='running'?'Pause':'Resume';
  $('continue').disabled=!scenario||completed;$('frame').disabled=!scenario||completed;$('step').disabled=!scenario||completed;
}

try {
  await loadCharacterTextures();
  world=new SurfWorld($('viewport'),validateProfile({character:'jax',outfit:'yardcrew',boardDesign:'tribal'}));world.setMode('park');
  game=new WaveParkGame(onEvent);$('loading').remove();
  for(const kind of ['pipe','lip','coping','air','pop','left','right'])$('run-'+kind).addEventListener('click',()=>start(kind));
  $('continue').addEventListener('click',resume);
  $('pause').addEventListener('click',()=>{if(game.phase==='running')game.pause();else resume();updateCounters();});
  $('frame').addEventListener('click',()=>step(1));$('step').addEventListener('click',()=>step(30));
  let last=performance.now(),accumulator=0;
  function frame(now) {
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(game.phase==='running') {
      accumulator+=dt*Number($('rate').value);
      while(accumulator>=1/120&&game.phase==='running'){tick();accumulator-=1/120;}
    } else accumulator=0;
    world.update(dt,game);updateCounters();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch(error) {
  console.error(error);$('loading').textContent='Unable to start the 3D ride lab: '+error.message;
}
