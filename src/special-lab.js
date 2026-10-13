import * as THREE from 'three';
import { WaveParkGame } from './park.js';
import { SpecialMeter } from './special.js';
import { SURFER_SPECIALS } from './surfer-specials.js';
import { CHARACTERS, validateProfile } from './appearance.js';
import { SurfWorld } from './world.js';
import { loadCharacterTextures } from './character-textures.js';
import { sampleRiderTrick } from './rider-pose.js';

const STEP=1/120;

// A separate, deterministic replay. It uses normal ramp physics and trick
// requests, and never reads or writes the player's saved profile or progress.
export class SpecialPlayback {
  constructor(onEvent=()=>{}) {
    this.events=[];this.onEvent=onEvent;this.meter=new SpecialMeter();
    this.game=new WaveParkGame(event=>{
      if(!this.game)return;
      if(!['reset','start','wall'].includes(event.type)){
        this.events.unshift(`${this.game.elapsed.toFixed(3)} · ${event.type}${event.name?' · '+event.name:''}`);
        this.events.length=Math.min(this.events.length,8);
      }
      this.onEvent(event,this.game);
    });
  }
  start(characterId='kai') {
    this.game.setCharacter(characterId);
    this.special=this.game.characterSpecial;
    this.characterId=this.special.characterId;
    this.events=[];this.stage='approach';this.done=false;this.landed=false;
    this.atCheckpoint=false;this.checkpointSeen=false;this.launchTime=null;
    this.meter.reset();this.meter.gain(1);
    this.message='Pumping up the filter halfpipe. The replay begins with a full Special meter.';
    this.game.start('filters');
  }
  stop(message,done=false){this.message=message;this.done=done;this.game.pause();}
  pause(){if(this.special&&!this.done)this.stop('Paused. Resume to continue this replay.');}
  resume(){if(!this.special||this.done)return;this.atCheckpoint=false;this.game.resume();this.message=this.checkpointSeen?'Watching the release and landing…':'Replaying the approach and signature move…';}
  tick(){
    const game=this.game;
    if(!this.special||this.done||game.phase!=='running')return;
    game.update(STEP,{pump:true});
    if(game.wipeouts>0||game.bailTime>0){this.stage='wipeout';this.stop('The replay ended in a wipeout. Inspect the event log.',true);return;}
    if(this.launchTime===null&&game.airborne){
      this.launchTime=game.elapsed;
      if(!this.meter.ready||!game.doTrick('special')){this.stop('The special could not start after the ramp launch.',true);return;}
      this.meter.consume();this.stage='special';this.message=`Playing ${this.special.name}.`;
    }
    if(this.launchTime!==null&&!game.airborne){
      this.landed=!game.trick&&game.launchTricks===1;
      this.stage=this.landed?'landed':'incomplete';
      this.stop(this.landed?'Landed cleanly. Choose another surfer or replay the move.':'The rider landed before completing the move.',true);return;
    }
    if(this.stage==='special'&&game.trick&&!this.checkpointSeen&&game.trick.age/game.trick.duration>=.5){
      this.checkpointSeen=true;this.atCheckpoint=true;
      this.stop(`${this.special.name}: held pose. Continue to watch the release and landing.`);
    }else if(this.stage==='special'&&!game.trick){this.stage='landing';this.message='Special completed. Watching the landing…';}
    if(game.elapsed>9&&!this.done)this.stop('Replay timed out before landing. Inspect the event log.',true);
  }
}

export function specialFingertipDeckDistance(surfer){
  const point=surfer.landmarks?.rightFingertip,deck=surfer.board,position=deck?.geometry?.getAttribute('position');
  if(!point||!position)return null;
  deck.updateWorldMatrix(true,false);
  const index=deck.geometry.getIndex(),triangle=new THREE.Triangle(),closest=new THREE.Vector3();
  let distance=Infinity;
  for(let i=0;i<(index?index.count:position.count);i+=3){
    [triangle.a,triangle.b,triangle.c].forEach((vertex,corner)=>vertex.fromBufferAttribute(position,index?index.getX(i+corner):i+corner).applyMatrix4(deck.matrixWorld));
    triangle.closestPointToPoint(point,closest);distance=Math.min(distance,point.distanceTo(closest));
  }
  return Number.isFinite(distance)?distance:null;
}

async function boot(){
  const $=id=>document.getElementById(id);
  let world,accumulator=0;
  const playback=new SpecialPlayback((event,game)=>world?.onEvent(event,game));
  const buttons=new Map();
  function counters(){
    const game=playback.game,special=playback.special;if(!special)return;
    const pose=sampleRiderTrick(game);
    $('status').textContent=playback.message;
    $('stat-name').textContent=special.name;
    $('stat-id').textContent=game.trick?.specialId||special.specialId;
    $('stat-phase').textContent=`${game.phase} / ${playback.stage}`;
    $('stat-time').textContent=`${game.elapsed.toFixed(3)} s`;
    $('stat-progress').textContent=game.trick?`${(game.trick.age/game.trick.duration*100).toFixed(1)}%`:'—';
    $('stat-pose').textContent=pose.comboPose?.id||'normal riding';
    $('stat-rotation').textContent=`${(pose.bodyPitch||0).toFixed(3)} / ${(pose.bodyRoll||0).toFixed(3)} rad`;
    const distance=pose.holdingGrab?specialFingertipDeckDistance(world.surfer):null;
    $('stat-contact').textContent=distance===null?'not holding':`${(distance*1000).toFixed(2)} mm`;
    $('stat-tricks').textContent=String(game.launchTricks);
    $('stat-landing').textContent=playback.landed?'CLEAN LANDING':game.wipeouts?'WIPEOUT':'pending';
    $('stat-points').textContent=`${game.comboBase} × ${game.multiplier}`;
    $('stat-meter').textContent=`${Math.round(playback.meter.value*100)}%`;
    $('events').textContent=playback.events.join('\n');
    $('pause').textContent=game.phase==='running'?'Pause':'Resume';
    $('pause').disabled=playback.done;$('continue').disabled=playback.done||game.phase!=='paused';
  }
  function start(characterId=playback.characterId||'kai'){
    accumulator=0;playback.start(characterId);
    const character=CHARACTERS[playback.characterId],special=playback.special;
    world.setProfile(validateProfile({character:playback.characterId,outfit:character.defaultOutfit}));
    $('caption-name').textContent=`${character.name} · ${special.name}`;
    $('description').textContent=special.description;
    for(const [id,button]of buttons)button.setAttribute('aria-pressed',String(id===playback.characterId));
    world.update(0,playback.game);counters();
  }
  try{
    await loadCharacterTextures();
    world=new SurfWorld($('viewport'),validateProfile());world.setMode('park');
    for(const [id,special]of Object.entries(SURFER_SPECIALS)){
      const button=document.createElement('button');button.className='choice';button.type='button';button.dataset.character=id;
      const name=document.createElement('strong'),move=document.createElement('span');name.textContent=CHARACTERS[id].name;move.textContent=special.name;
      button.append(name,move);button.addEventListener('click',()=>start(id));buttons.set(id,button);$('choices').append(button);
    }
    $('continue').addEventListener('click',()=>{playback.resume();counters();});
    $('pause').addEventListener('click',()=>{playback.game.phase==='running'?playback.pause():playback.resume();counters();});
    $('restart').addEventListener('click',()=>start());
    $('loading').remove();start();
    let last=performance.now();
    function frame(now){
      const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
      if(playback.game.phase==='running'){
        accumulator+=dt*Number($('rate').value);
        while(accumulator>=STEP&&playback.game.phase==='running'){playback.tick();accumulator-=STEP;}
      }else accumulator=0;
      world.update(dt,playback.game);counters();requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }catch(error){console.error(error);($('loading')||$('status')).textContent=`Unable to load special replay: ${error.message}`;}
}
if(typeof document!=='undefined')boot();
