import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuidedTutorialProgress, createGuidedTutorial, GUIDED_LESSONS } from '../src/guided-tutorial.js';
import { SurfGame } from '../src/game.js';

function gameState(extra={}) {return {phase:'running',mode:'surf',rulesId:'surf',bailTime:0,distance:0,vx:0,airborne:false,...extra};}
function atStep(id){const model=createGuidedTutorialProgress();model.start();while(model.stepId!==id)model.skipLesson();return model;}
function hold(model,game,input,seconds,vx=0){for(let time=0;time<seconds;time+=.02){game.distance+=.4;game.vx=vx;model.update(.02,input,game);}}
function event(model,game,type,extra={}){model.onEvent({type,...extra},game);}

test('movement advances only with held steering and actual travel in both directions',()=>{
  const model=createGuidedTutorialProgress(),game=gameState();model.start();
  model.update(90,{left:true,right:true},game);
  for(let i=0;i<30;i++)model.update(.02,{left:true},game);
  assert.equal(model.stepId,'steer');
  hold(model,game,{left:true},.5,-5);
  assert.match(model.progressText,/LEFT ✓/);
  assert.equal(model.stepId,'steer');
  game.phase='paused';hold(model,game,{right:true},1,5);assert.equal(model.stepId,'steer');
  game.phase='running';hold(model,game,{right:true},.5,5);
  assert.equal(model.stepId,'speed');assert.equal(model.completed,1);
});

test('pump and brake must each be used in real movement without opposing controls',()=>{
  const model=atStep('speed'),game=gameState();
  hold(model,game,{pump:true,brake:true},2);assert.equal(model.stepId,'speed');
  hold(model,game,{pump:true},1);assert.match(model.progressText,/PUMP ✓/);
  hold(model,game,{brake:true},1);assert.equal(model.stepId,'hop');
});

test('flat hop waits for a clean landing and resets its pending evidence on a bail',()=>{
  const model=atStep('hop'),game=gameState();
  event(model,game,'land');assert.equal(model.stepId,'hop');
  event(model,game,'jump',{source:'lip'});event(model,game,'land');assert.equal(model.stepId,'hop');
  event(model,game,'jump',{source:'flat'});event(model,game,'bail');event(model,game,'land');assert.equal(model.stepId,'hop');
  event(model,game,'jump',{source:'flat'});event(model,game,'land');assert.equal(model.stepId,'cutback');
});

test('starting a cutback or trick never counts as completing one',()=>{
  const model=atStep('cutback'),game=gameState();
  event(model,game,'cutbackStart');assert.equal(model.stepId,'cutback');
  event(model,game,'cutback');assert.equal(model.stepId,'trick');
  event(model,game,'trickStart',{trick:'spin'});event(model,game,'land');assert.equal(model.stepId,'trick');
  event(model,game,'trick',{name:'180 SPIN'});assert.equal(model.stepId,'trick');
  event(model,game,'land');assert.equal(model.stepId,'combo');
});

test('combo can span airs but requires two finished moves and a landed bank',()=>{
  const model=atStep('combo'),game=gameState();
  event(model,game,'jump',{source:'cutback'});event(model,game,'trick');event(model,game,'land');
  event(model,game,'jump',{source:'cutback'});event(model,game,'trick');
  assert.equal(model.stepId,'combo');
  event(model,game,'land');event(model,game,'bank',{points:1000});assert.equal(model.stepId,'special');
});

test('banked single tricks and a lost combo cannot accumulate into the combo lesson',()=>{
  const model=atStep('combo'),game=gameState();
  for(let i=0;i<3;i++){event(model,game,'trick');event(model,game,'land');event(model,game,'bank');}
  assert.equal(model.stepId,'combo');assert.match(model.progressText,/0 \/ 2/);
  event(model,game,'trick');event(model,game,'trick');event(model,game,'bail');event(model,game,'land');event(model,game,'bank');
  assert.equal(model.stepId,'combo');assert.match(model.progressText,/0 \/ 2/);
});

test('special needs the real signature to finish and land; bail cancels it',()=>{
  const model=atStep('special'),game=gameState();
  event(model,game,'trickStart',{trick:'special'});event(model,game,'trick',{specialId:'tidal-rodeo'});event(model,game,'bail');event(model,game,'land');
  assert.equal(model.stepId,'special');
  event(model,game,'trickStart',{trick:'spin'});event(model,game,'trick');event(model,game,'land');assert.equal(model.stepId,'special');
  event(model,game,'trickStart',{trick:'special'});event(model,game,'trick',{specialId:'tidal-rodeo'});event(model,game,'land');
  assert.equal(model.stepId,'barrel');assert.equal(model.venue,'storm');
});

test('Storm tasks require surviving a barrel and then a landed trick boost',()=>{
  const model=atStep('barrel'),game=gameState({rulesId:'storm'});
  event(model,game,'barrelExit');assert.equal(model.stepId,'barrel');
  event(model,game,'barrelEnter');event(model,game,'bail');event(model,game,'barrelExit');assert.equal(model.stepId,'barrel');
  event(model,game,'barrelEnter');event(model,game,'barrelExit');assert.equal(model.stepId,'boost');
  event(model,game,'surfBoost',{tricks:1});assert.equal(model.stepId,'boost');
  event(model,game,'trick');event(model,game,'land');event(model,game,'surfBoost',{tricks:1});assert.equal(model.stepId,'finish');
});

test('paused, wrong venue and opponent events never advance practice',()=>{
  const model=atStep('cutback'),game=gameState({phase:'paused'});
  event(model,game,'cutback');assert.equal(model.stepId,'cutback');
  game.phase='running';game.rulesId='storm';event(model,game,'cutback');assert.equal(model.stepId,'cutback');
  game.rulesId='surf';event(model,game,'cutback',{opponent:true});assert.equal(model.stepId,'cutback');
});

test('skips are recorded honestly and restarting only clears the current attempt',()=>{
  const model=atStep('combo'),game=gameState();
  assert.equal(model.skipped,5);assert.equal(model.completed,0);
  event(model,game,'trick');model.restartStep();assert.equal(model.stepId,'combo');
  assert.match(model.progressText,/0 \/ 2/);assert.equal(model.skipped,5);
  while(model.stepId!=='finish')model.skipLesson();
  assert.equal(model.skipped,GUIDED_LESSONS.length);assert.equal(model.completed,0);
  assert.match(model.progressText,/0 PRACTISED/);
});

test('controller starts actual Surf immediately, keeps lessons on restart and cancels deferred venue on skip',()=>{
  let game=gameState(),coach,skipped=0;const starts=[];
  coach=createGuidedTutorial({document:null,getGame:()=>game,onStartMode:venue=>{assert.equal(coach.active,true);starts.push(venue);game=gameState({rulesId:venue});},onSkip:()=>{assert.equal(coach.active,false);skipped++;}});
  coach.start();assert.deepEqual(starts,['surf']);
  hold(coach,game,{left:true},.5,-5);hold(coach,game,{right:true},.5,5);assert.equal(coach.stepId,'speed');
  coach.restartStep();assert.deepEqual(starts,['surf','surf']);assert.equal(coach.stepId,'speed');
  hold(coach,game,{pump:true},1);hold(coach,game,{brake:true},1);
  coach.onEvent({type:'jump',source:'flat'});coach.onEvent({type:'land'});
  coach.onEvent({type:'cutback'});coach.onEvent({type:'trick'});coach.onEvent({type:'land'});
  coach.onEvent({type:'trick'});coach.onEvent({type:'trick'});coach.onEvent({type:'land'});coach.onEvent({type:'bank'});
  coach.onEvent({type:'trickStart',trick:'special'});coach.onEvent({type:'trick',specialId:'tidal-rodeo'});coach.onEvent({type:'land'});
  assert.equal(coach.venue,'storm');assert.equal(starts.length,2,'scene changes wait until next frame');
  game.phase='paused';coach.update(.1,{});assert.equal(starts.length,2,'tab blur must not resume practice');
  coach.skip();coach.update(.1,{});assert.equal(skipped,1);assert.equal(coach.active,false);
  assert.equal(starts.length,2,'skip cancels deferred Storm transition');
  coach.dispose();coach.start();assert.equal(coach.active,false);
});

test('actual Surf simulation supplies accepted flat hop and cutback completion events',()=>{
  const model=atStep('hop');let game;
  game=new SurfGame(e=>{if(game)model.onEvent(e,game);});game.start();
  assert.equal(game.launchSource,'flat');assert.equal(game.jump(),true);
  for(let i=0;i<180&&game.airborne;i++)game.update(1/120,{});
  assert.equal(model.stepId,'cutback');assert.equal(game.doCutback(1),true);
  for(let i=0;i<100&&model.stepId==='cutback';i++)game.update(1/120,{});
  assert.equal(model.stepId,'trick');
});

test('real cutback air can complete the trick, combo and signature lessons with normal physics',()=>{
  for(const lesson of ['trick','combo','special']){
    const model=atStep(lesson);let game;
    game=new SurfGame(e=>{if(game)model.onEvent(e,game);});game.start();
    assert.equal(game.doCutback(-1),true);
    for(let i=0;i<95;i++)game.update(1/120,{});
    for(let i=0;i<72;i++)game.update(1/120,{jump:true,brake:true});
    assert.equal(game.launchSource,'cutback');assert.equal(game.jump(),true);
    assert.equal(game.doTrick(lesson==='special'?'special':'spin'),true);
    if(lesson==='combo'){
      for(let i=0;i<60;i++)game.update(1/120,{brake:true});
      assert.equal(game.doTrick('grab'),true);
    }
    for(let i=0;i<300&&game.airborne;i++)game.update(1/120,{brake:true});
    if(lesson==='combo')assert.equal(game.bank(),true);
    assert.equal(game.wipeouts,0,lesson);
    assert.equal(model.stepId,{trick:'combo',combo:'special',special:'barrel'}[lesson]);
  }
});
