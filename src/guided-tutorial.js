import { remapControlText, remapKeyLabel } from './control-labels.js';

// Lessons consume the real simulation's input and events. Starting a trick,
// waiting, or crashing can never stand in for completing and landing it.
export const GUIDED_LESSONS = Object.freeze([
  { id:'steer', venue:'surf', title:'FIND YOUR LINE.', objective:'Turn left, then right across the wave.',
    detail:'You are riding Surf Session. Make a short turn each way, then release the keys to settle your board.',
    keys:['A / D'], labels:['Steer'], tip:'Short turns are enough. Stay away from the outside edges.' },
  { id:'speed', venue:'surf', title:'CONTROL YOUR SPEED.', objective:'Pump for speed, then try the brake.',
    detail:'Hold W to accelerate. Release it and hold S briefly to slow down. Keep riding as you learn.',
    keys:['W','S'], labels:['Pump','Brake'], tip:'A little brake also settles sideways movement before landing.' },
  { id:'hop', venue:'surf', title:'LOAD. RELEASE. HOP.', objective:'Make a small flat hop and land it.',
    detail:'Stay on the low part of the wave, away from the lip. Hold Space briefly, then release to pop.',
    keys:['SPACE'], labels:['Hold → release'], tip:'Flat hops clear driftwood in Survival. They do not give trick height. Wait for pop recovery before jumping again.' },
  { id:'cutback', venue:'surf', title:'MAKE YOUR OWN AIR.', objective:'Finish a cutback on the wave.',
    detail:'Hold Shift while you turn, or press C. Let the turn finish before you pop.',
    keys:['SHIFT + A / D','C'], labels:['Cutback','Also works'], tip:'A completed cutback gives you a brief launch window. You can also get height from the high lip on the left.' },
  { id:'trick', venue:'surf', title:'TAKE IT ABOVE THE LIP.', objective:'Finish an airborne trick, then land.',
    detail:'Press C, let the cutback finish, then hold and release Space. Press J early in the air and let the spin finish.',
    keys:['C','SPACE','J'], labels:['Cutback','Pop','180 spin'], tip:'Only cutback or wave-lip airs allow tricks here. Release steering or use S to settle your landing.' },
  { id:'combo', venue:'surf', title:'LINK IT. BANK IT.', objective:'Complete two tricks in one combo and bank it.',
    detail:'Get cutback air. Press J, wait for the spin, then press L. Land. Enter banks your combo.',
    keys:['C','SPACE','J','L','ENTER'], labels:['Cutback','Pop','Spin','Grab','Bank'], tip:'You can also link two separate airs before the combo meter empties. Surf Session gives combo points, without a speed boost.' },
  { id:'special', venue:'surf', title:'YOUR SIGNATURE MOVE.', objective:'Use your full Special meter in the air and land.',
    detail:'Your practice meter is charged. Finish a cutback, charge your pop, then press I early in the air.',
    keys:['C','SPACE','I'], labels:['Cutback','Charged pop','Special'], tip:'Each surfer has a different special. A full meter stays ready until used. Allow the whole move to finish before landing.' },
  { id:'barrel', venue:'storm', title:'RIDE THE HOLLOW.', objective:'Enter a barrel and escape before it shuts.',
    detail:'This is real Storm Survival. Steer gently left towards the hollow opening and hold W to pump all the way through.',
    keys:['A / D','W','SPACE'], labels:['Line up','Pump through','Hop driftwood'], tip:'Watch the closing-wave countdown. Hop driftwood and steer clear of whirlpools. There is no run timer; the storm gets harder as you ride.' },
  { id:'boost', venue:'storm', title:'TRICKS ARE YOUR ENGINE.', objective:'Land a trick to earn a Survival speed boost.',
    detail:'Find clear water. Finish a cutback, pop, press J and land. Watch your speed burst when you touch down.',
    keys:['C','SPACE','J'], labels:['Cutback','Pop','Spin'], tip:'A landed combo gives a stronger boost. Carry that speed through closing barrels. Normal runs give you three lives; practice lets you retry.' },
].map(lesson=>Object.freeze(lesson)));

const finishLesson=Object.freeze({id:'finish',venue:'storm',title:'READY FOR THE REST.',objective:'Your ride, your setup.',
  detail:'Keep riding, or open the final guide for Waterworks, rival ladders, Time Trials and your character, board and outfit. Then choose your rider name.',keys:[],labels:[],tip:''});

function attemptState() { return {left:0,right:0,pump:0,brake:0,flatJump:false,tricks:0,landed:false,specialStarted:false,specialCompleted:false,barrelEntered:false}; }

/** Rendering-free progression model; useful for verification with real games. */
export function createGuidedTutorialProgress(onChange=()=>{}) {
  let active=false,index=0,evidence=attemptState(),hint='',results=[],lastDistance=null;
  const lesson=()=>GUIDED_LESSONS[index]||finishLesson;
  const change=kind=>onChange(kind);
  function setHint(value) { if(hint!==value){hint=value;change('hint');} }
  function advance(status) {
    if(!active||index>=GUIDED_LESSONS.length)return;
    results.push({id:lesson().id,status});index++;evidence=attemptState();lastDistance=null;
    hint=status==='skipped'?'Previous lesson skipped. You can replay practice from Admin.':'';change('step');
  }
  function clearAttempt(message) {
    evidence=attemptState();lastDistance=null;setHint(message);change('progress');
  }
  function allowed(game) {
    return active&&game?.phase==='running'&&game.mode==='surf'&&game.rulesId===lesson().venue;
  }
  return {
    get active(){return active;},get stepId(){return lesson().id;},get venue(){return lesson().venue;},
    get lesson(){return lesson();},get index(){return index;},get total(){return GUIDED_LESSONS.length;},
    get hint(){return hint;},get results(){return results.map(result=>({...result}));},
    get skipped(){return results.filter(result=>result.status==='skipped').length;},
    get completed(){return results.filter(result=>result.status==='completed').length;},
    get progressText(){
      if(index===0)return `LEFT ${evidence.left>=.35?'✓':'○'}  /  RIGHT ${evidence.right>=.35?'✓':'○'}`;
      if(index===1)return `PUMP ${evidence.pump>=.7?'✓':'○'}  /  BRAKE ${evidence.brake>=.7?'✓':'○'}`;
      if(lesson().id==='combo')return `${Math.min(2,evidence.tricks)} / 2 TRICKS${evidence.tricks>=2?' · LAND + BANK':''}`;
      if(lesson().id==='barrel'&&evidence.barrelEntered)return 'INSIDE THE CURL · KEEP PUMPING';
      if(lesson().id==='finish')return `${results.filter(result=>result.status==='completed').length} PRACTISED · ${results.filter(result=>result.status==='skipped').length} SKIPPED`;
      return 'REAL RIDING · NO POINTS OR PROGRESS SAVED';
    },
    start(){active=true;index=0;results=[];evidence=attemptState();lastDistance=null;hint='';change('step');},
    stop(){active=false;change('stop');},
    skipLesson(){advance('skipped');},
    restartStep(){if(active)clearAttempt('Fresh start for this lesson. Earlier lessons are kept.');},
    update(dt,input={},game){
      if(!allowed(game)){lastDistance=null;return;}
      if(game.bailTime>0){lastDistance=null;return;}
      const distance=Number.isFinite(game.distance)?game.distance:null;
      const moved=distance!==null&&lastDistance!==null&&distance>lastDistance;
      lastDistance=distance;
      // Count held controls only while the rider is genuinely moving. Clamping
      // also prevents a background tab's long frame completing an exercise.
      const seconds=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
      if(!moved||game.airborne)return;
      const before=this.progressText;
      if(lesson().id==='steer'){
        if(input.left&&!input.right&&game.vx<-.2)evidence.left+=seconds;
        if(input.right&&!input.left&&game.vx>.2)evidence.right+=seconds;
        if(evidence.left>=.35&&evidence.right>=.35){advance('completed');return;}
      } else if(lesson().id==='speed'){
        if(input.pump&&!input.brake)evidence.pump+=seconds;
        if(input.brake&&!input.pump)evidence.brake+=seconds;
        if(evidence.pump>=.7&&evidence.brake>=.7){advance('completed');return;}
      }
      if(this.progressText!==before)change('progress');
    },
    onEvent(event,game){
      if(!allowed(game)||event?.opponent)return;
      const id=lesson().id;
      if(event.type==='bail'){
        clearAttempt(id==='barrel'?'Missed that opening. Aim for the hollow part and pump; the next barrel is another attempt.':
          id==='combo'?'That combo was lost. Earlier lessons are safe. Finish two moves, land, then bank.':
          'Try again. Release steering before landing, and finish your move before touching the water. Earlier lessons are safe.');return;
      }
      if(game.bailTime>0)return;
      if(event.type==='jump'){
        evidence.landed=false;
        if(id==='hop'){
          evidence.flatJump=event.source==='flat';
          if(!evidence.flatJump)setHint('That was a high launch. For this lesson, move away from the left lip and let the cutback window expire before hopping.');
        }else if(['trick','combo','special','boost'].includes(id)&&event.source==='flat'){
          setHint('That is a low flat hop. Land, finish a cutback, then pop again for trick height.');
        }
      }
      if(id==='hop'&&event.type==='land'&&evidence.flatJump){advance('completed');return;}
      if(id==='cutback'&&event.type==='cutback'){advance('completed');return;}
      if(event.type==='trick'&&['trick','combo','boost'].includes(id)){
        evidence.tricks++;setHint('Move finished. Settle the board and land.');change('progress');
      }
      if(id==='special'){
        if(event.type==='specialStart'||event.type==='trickStart'&&event.trick==='special')evidence.specialStarted=true;
        if(event.type==='trick'&&evidence.specialStarted&&event.specialId)evidence.specialCompleted=true;
      }
      if(event.type==='land'){
        evidence.landed=true;
        if(id==='trick'&&evidence.tricks>0){advance('completed');return;}
        if(id==='special'&&evidence.specialStarted&&evidence.specialCompleted){advance('completed');return;}
        if(id==='combo'&&evidence.tricks>=2)setHint('Clean landing. Enter banks your linked tricks.');
      }
      if(id==='combo'&&event.type==='bank'){
        if(evidence.tricks>=2&&evidence.landed){advance('completed');return;}
        clearAttempt('That combo banked. For this lesson, link two completed tricks before the combo meter empties, then bank.');
      }
      if(id==='barrel'&&event.type==='barrelEnter'){evidence.barrelEntered=true;change('progress');}
      if(id==='barrel'&&event.type==='barrelExit'&&evidence.barrelEntered){advance('completed');return;}
      if(id==='boost'&&event.type==='surfBoost'&&evidence.tricks>0&&evidence.landed){advance('completed');}
    },
  };
}

/** An unobtrusive coach over the actual game, without intercepting game keys. */
export function createGuidedTutorial({getGame,getKeybinds=()=>undefined,onStartMode=()=>{},onFinish=()=>{},onSkip=()=>{},document:doc=globalThis.document}={}) {
  let disposed=false,pendingVenue=null,currentVenue=null,replay=false,lastBindings='';
  const overlay=doc?.createElement('aside');
  if(overlay){
    overlay.id='guided-tutorial';overlay.className='guided-tutorial';overlay.hidden=true;
    overlay.setAttribute('aria-labelledby','guided-title');
    overlay.innerHTML=`<div class="guided-topline"><span data-guided="venue"></span><span data-guided="count"></span></div>
      <div class="guided-track" aria-hidden="true"><i data-guided="fill"></i></div>
      <h2 id="guided-title"></h2><p class="guided-objective" data-guided="objective"></p>
      <p class="guided-detail" data-guided="detail"></p><div class="guided-controls" data-guided="controls"></div>
      <p class="guided-progress" data-guided="progress"></p><p class="guided-tip" data-guided="tip"></p>
      <p class="guided-feedback" data-guided="feedback"></p>
      <div class="guided-actions"><button type="button" data-action="retry">RESTART LESSON</button><button type="button" data-action="next">SKIP THIS LESSON →</button><button type="button" data-action="finish" hidden>FINISH GUIDE →</button></div>
      <button type="button" class="guided-exit" data-action="skip">SKIP PRACTICE</button>
      <span class="guided-announcement" role="status" aria-live="polite" aria-atomic="true" data-guided="announcement"></span>`;
    (doc.getElementById('stage')||doc.body).append(overlay);
  }
  const query=selector=>overlay?.querySelector(selector);
  const node=name=>query(`[data-guided="${name}"]`);
  const text=(name,value)=>{const element=node(name);if(element&&element.textContent!==value)element.textContent=value;};
  const refocus=()=>doc?.getElementById('stage')?.focus({preventScroll:true});
  const progress=createGuidedTutorialProgress(kind=>{
    if(kind==='step'&&progress.venue!==currentVenue)pendingVenue=progress.venue;
    render(kind==='step');
  });
  function render(announce=false){
    if(!overlay)return;
    overlay.hidden=!progress.active;
    if(!progress.active)return;
    const lesson=progress.lesson,bindings=getKeybinds();lastBindings=JSON.stringify(bindings??{});
    overlay.dataset.lesson=lesson.id;
    text('venue',`${replay?'PRACTICE REPLAY':'LEARN AS YOU RIDE'} / ${lesson.venue==='storm'?'SURVIVAL':'SURF SESSION'}`);
    text('count',lesson.id==='finish'?'RIDE COMPLETE':`${Math.min(progress.index+1,progress.total)} / ${progress.total}`);
    query('#guided-title').textContent=lesson.title;
    text('objective',lesson.objective);text('detail',remapControlText(lesson.detail,bindings));
    text('progress',progress.progressText);text('tip',remapControlText(lesson.tip,bindings));
    text('feedback',remapControlText(progress.hint,bindings));
    const controls=node('controls');controls.replaceChildren();
    lesson.keys.forEach((key,index)=>{
      const item=doc.createElement('span'),badge=doc.createElement('kbd'),label=doc.createElement('small');
      badge.textContent=remapKeyLabel(key,bindings);label.textContent=lesson.labels[index];item.append(badge,label);controls.append(item);
    });
    node('fill').style.width=`${progress.index/progress.total*100}%`;
    query('[data-action="finish"]').hidden=lesson.id!=='finish';
    query('[data-action="retry"]').hidden=lesson.id==='finish';
    query('[data-action="next"]').hidden=lesson.id==='finish';
    query('[data-action="skip"]').hidden=lesson.id==='finish';
    if(announce)text('announcement',`${lesson.id==='finish'?'Practice complete':`Lesson ${progress.index+1} of ${progress.total}`}. ${lesson.objective}${progress.skipped?` ${progress.skipped} ${progress.skipped===1?'lesson':'lessons'} skipped.`:''}`);
  }
  function startMode(venue){pendingVenue=null;currentVenue=venue;onStartMode(venue);}
  function stop(){pendingVenue=null;currentVenue=null;progress.stop();}
  function end(callback){if(!progress.active||disposed)return;const summary={results:progress.results,skipped:progress.skipped,completed:progress.completed,replay};stop();callback(summary);}
  function handleClick(event){
    const button=event.target.closest?.('[data-action]');if(!button||!overlay.contains(button))return;
    if(button.dataset.action==='next'){progress.skipLesson();refocus();}
    if(button.dataset.action==='retry'){api.restartStep();refocus();}
    if(button.dataset.action==='skip')api.skip();
    if(button.dataset.action==='finish'&&progress.stepId==='finish')end(onFinish);
  }
  overlay?.addEventListener('click',handleClick);
  const api={
    get active(){return progress.active;},get stepId(){return progress.stepId;},get venue(){return progress.venue;},
    get summary(){return {results:progress.results,skipped:progress.skipped,completed:progress.completed};},
    start(options={}){if(disposed)return;replay=!!options.replay;currentVenue=null;progress.start();startMode(progress.venue);refocus();},
    update(dt,input={}){
      if(disposed||!progress.active)return;
      if(pendingVenue){if(getGame?.()?.phase==='running')startMode(pendingVenue);return;}
      progress.update(dt,input,getGame?.());
      if(JSON.stringify(getKeybinds()??{})!==lastBindings)render();
    },
    onEvent(event){if(!disposed)progress.onEvent(event,getGame?.());},
    restartStep(){if(!progress.active||disposed)return;progress.restartStep();startMode(progress.venue);},
    skip(){end(onSkip);},stop,
    dispose(){stop();disposed=true;overlay?.removeEventListener('click',handleClick);overlay?.remove();},
  };
  return api;
}
