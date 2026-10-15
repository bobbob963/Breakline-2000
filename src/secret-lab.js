import {WaveParkGame,parkHeight} from './park.js';
import {SewerRaceGame} from './sewer-race.js';
import {sewerWaterHeight} from './sewer-course.js';
import {SurfWorld} from './world.js';
import {validateProfile} from './appearance.js';
import {loadCharacterTextures} from './character-textures.js';

const $=id=>document.getElementById(id),STEP=1/120,keys=new Set();
let game,world,kind='park',running=false,overview=false,events=[],input={pump:true};
function event(e){if(!e.opponent){world?.onEvent(e,game);events.unshift(e.type+(e.name?' · '+e.name:''));events=events.slice(0,12);}}
function setup(next){
  kind=next;running=false;events=[];overview=false;keys.clear();
  game=kind==='park'?new WaveParkGame():new SewerRaceGame(()=>{},{trackId:kind==='runoff'?'sewer-run':'sewer-depths'});
  game.start();game.onEvent=event;
  if(kind==='park')Object.assign(game,{x:112,z:-10,y:parkHeight(112,-10),heading:-Math.PI/2,speed:18,vx:18,vz:0,charge:0});
  else{
    const branch=game.course.secretPassages[0];
    if(!branch)throw new Error('Secret course branch is not ready');
    Object.assign(game,{countdownRemaining:0,distance:branch.start-8,x:branch.entryX+1.15,speed:game.course.pumpSpeed,vx:0,charge:0});
    game.y=sewerWaterHeight(game.x,game.distance,0,game.trackId);
    game.nextCheckpoint=game.course.checkpoints.filter(p=>p.distance<game.distance).length;
    game.opponent.distance=game.distance-35;
  }
  world.parkCamera.initialized=false;world.sewerCamera.initialized=false;
  $('status').textContent='Paused before the wall. Pop, then ride forward to test the entrance.';
  paint();
}
function controls(){
  const branch=game.course?.secretPassages?.[0];
  const aim=game.activeShortcut&&branch?branch.entryX-game.x-game.vx*.16:0;
  return {pump:!keys.has('s'),brake:keys.has('s'),left:keys.has('a')||(kind!=='park'&&(game.distance<branch.start||aim<-.18)),right:keys.has('d')||aim>.18,jump:keys.has(' '),grind:keys.has('shift')};
}
function tick(){input=controls();game.update(STEP,input);}
function advance(seconds){for(let i=0;i<Math.round(seconds/STEP)&&game.phase==='running';i++)tick();paint();}
function paint(dt=1/60){
  if(!game)return;
  world.update(dt,game);
  if(overview&&kind==='park'){
    world.camera.up.set(0,1,0);world.camera.position.set(178,18,57);world.camera.lookAt(221,1,-10);world.renderer.render(world.scene,world.camera);
  }
  $('stats').textContent=JSON.stringify({mode:kind,position:[game.x,game.y,game.z??game.distance].map(n=>+n.toFixed(2)),airborne:game.airborne,speed:+game.speed.toFixed(2),maintenance:!!game.maintenanceAccess,path:game.activeShortcut||'main',wipeouts:game.wipeouts,phase:game.phase},null,2);
  $('events').textContent=events.join('\n');
}
try{
  await loadCharacterTextures();world=new SurfWorld($('viewport'),validateProfile({character:'jax',outfit:'yardcrew',boardDesign:'tribal'}));
  for(const id of ['park','runoff','deep'])$(id).onclick=()=>setup(id);
  $('jump').onclick=()=>{game.jump();paint();};$('step').onclick=()=>advance(.25);$('second').onclick=()=>advance(1);
  $('play').onclick=()=>{running=!running;$('status').textContent=running?'Playing with ordinary movement.':'Paused.';};
  $('overview').onclick=()=>{overview=!overview;paint();};
  window.addEventListener('keydown',e=>{if([' ','a','s','d','w','Shift'].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());const trick={j:'spin',k:'grab',b:'tweak',l:'flip'}[e.key];if(trick)game.doTrick(trick);});
  window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key===' ')game.jump();});
  window.addEventListener('blur',()=>{keys.clear();running=false;});
  let before=performance.now(),acc=0;
  function frame(now){const dt=Math.min(.05,(now-before)/1000);before=now;if(running){acc+=dt;while(acc>=STEP){tick();acc-=STEP;}}else acc=0;paint(dt);requestAnimationFrame(frame);}
  setup('park');requestAnimationFrame(frame);
}catch(error){$('status').textContent=error.message;console.error(error);}
