import { SurfRaceGame } from './surf-race.js';
import { SurfWorld } from './world.js';
import { CustomizationPreview,validateProfile } from './appearance.js';
import { ALL_REWARD_BOARD_ORDER,REWARD_BOARDS } from './board-rewards.js';
import { loadCharacterTextures } from './character-textures.js';

// The review presses the real charge/pop/trick controls. It never supplies a
// trick event, applies a pose, awards points or writes progress to storage.
export function rewardDemoInput(game,demo,dt) {
  if(game.countdownRemaining>0)return {pump:true};
  if(demo.stage==='charge') {
    demo.charge+=dt;
    if(demo.charge<.65)return {pump:true,jump:true};
    if(game.jump())demo.stage='air';
  }
  if(demo.stage==='air'&&game.airborne&&!demo.started)demo.started=game.doTrick('spin');
  return {pump:true};
}

async function boot() {
  const $=id=>document.getElementById(id),requested=new URLSearchParams(location.search).get('board');let world,preview,game,demo,id=ALL_REWARD_BOARD_ORDER.includes(requested)?requested:'guitar',accumulator=0;
  function start(nextId=id,mode='trick') {
    id=nextId;const board=REWARD_BOARDS[id],profile=validateProfile({character:'jax',outfit:'yardcrew',rewardBoard:id});
    const url=new URL(location.href);url.searchParams.set('board',id);history.replaceState(null,'',url);
    demo={stage:'charge',charge:0,started:false,completedAt:null,mode,glideTime:0};accumulator=0;
    world.setProfile(profile);preview.setProfile(profile);
    game=new SurfRaceGame(event=>{if(!game||event.opponent)return;world.onEvent(event,game);if(event.type==='trick')demo.completedAt=game.elapsed;});
    game.setRewardBoard(id);game.start();
    $('title').textContent=board.name;$('buff').textContent=board.buffLabel;$('hud').replaceChildren(document.createTextNode(board.name));
    const sub=document.createElement('small');sub.textContent=mode==='glide'?'CHARGED POP → SPIN → WINGED DESCENT':'CHARGED POP → 180 SPIN';$('hud').append(sub);
    $('details').textContent=board.description;$('status').textContent=mode==='glide'?'Countdown, then a real jump and spin. The wings open automatically on descent; the review pauses during the glide.':'Countdown, then a charged pop and a real completed spin. The review pauses just after the effect appears.';
    $('glide').hidden=id!=='sky';
    for(const button of $('boards').children)button.setAttribute('aria-pressed',String(button.dataset.board===id));
  }
  try {
    await loadCharacterTextures();world=new SurfWorld($('viewport'));preview=new CustomizationPreview($('board-preview'),validateProfile({rewardBoard:id}));
    for(const key of ALL_REWARD_BOARD_ORDER){const button=document.createElement('button');button.dataset.board=key;button.textContent=REWARD_BOARDS[key].name;button.addEventListener('click',()=>start(key));$('boards').append(button);}
    $('replay').addEventListener('click',()=>start());$('pause').addEventListener('click',()=>{if(game.phase==='paused'){demo.completedAt=null;game.resume();}else game.pause();});
    $('glide').addEventListener('click',()=>start('sky','glide'));
    $('loading').remove();start();let previous=performance.now();
    function frame(now){const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
      if(game.phase==='running'){
        accumulator+=dt;
        while(accumulator>=1/120&&game.phase==='running'){
          game.update(1/120,rewardDemoInput(game,demo,1/120));accumulator-=1/120;
          if(demo.mode==='glide'&&game.gliding){demo.glideTime+=1/120;if(demo.glideTime>=.24){game.pause();demo.mode='free';$('status').textContent='SKYBOUND: gliding down after a real jump. Angel wings follow the board. Resume to land; the extra air jump is still available during normal play.';}}
          else if(demo.mode==='trick'&&demo.completedAt!==null&&game.elapsed-demo.completedAt>=.085){game.pause();$('status').textContent=`${REWARD_BOARDS[id].name}: a real 180 spin completed. Paused on its ${REWARD_BOARDS[id].vfx} effect. Resume to finish the landing or choose another board.`;}
        }
      }else accumulator=0;
      world.update(dt,game);preview.update(dt,'board');$('pause').textContent=game.phase==='paused'?'Resume':'Pause';requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.addEventListener('pagehide',()=>{world.dispose();preview.dispose();},{once:true});
  }catch(error){console.error(error);$('status').textContent=error.message;const loading=$('loading');if(loading)loading.textContent='Board review could not load: '+error.message;}
}
if(typeof document!=='undefined'&&document.getElementById('board-preview'))boot();
