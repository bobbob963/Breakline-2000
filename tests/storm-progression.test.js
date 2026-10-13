import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame,courseItem,waveHeight } from '../src/game.js';
import { stormBarrel,barrelClosureProgress } from '../src/storm-waves.js';
import { stormProgression,stormFunnelRows,createStormTiming } from '../src/storm-progression.js';
import { surfHazardsNear,reefBankHeight,sweepSurfHazard } from '../src/surf-hazards.js';
import { surfLabRouteControls,applySurfLabControls } from '../src/surf-lab.js';

test('closures move progressively earlier and cap their mouth escape window at1.3 seconds',()=>{
  let previous=stormProgression(0);
  for(const elapsed of [30,75,150,240,300,600,10000]){
    const next=stormProgression(elapsed);
    assert.ok(next.escapeWindow<=previous.escapeWindow);assert.ok(next.curlDelay<=previous.curlDelay);assert.ok(next.collapseDuration<=previous.collapseDuration);
    assert.ok(next.escapeWindow>=1.3);assert.ok(next.collapseDuration>=.069999);previous=next;
  }
  assert.equal(stormProgression(300).escapeWindow,1.3);assert.equal(stormProgression(10000).escapeWindow,1.3);
  const run=createStormTiming(stormBarrel(0),0,29);
  assert.ok(Math.abs(run.deadline-5.6638)<.001);assert.ok(run.closeStart<1);assert.equal(run.waitingForEntry,true);
});

test('a real mouth crossing starts the full escape allowance once, and pause or bail cannot extend it',()=>{
  const game=new SurfGame(()=>{},'storm');game.start();
  while(!game.barrelTimings.get(0)?.enteredAt&&game.phase==='running')applySurfLabControls(game,surfLabRouteControls(game));
  const run=game.barrelTimings.get(0);assert.ok(run.enteredAt>0);assert.equal(run.waitingForEntry,false);
  assert.ok(Math.abs(run.deadline-run.enteredAt-run.escapeWindow)<1e-9);assert.ok(run.entryClosureProgress>0);
  const deadline=run.deadline,progress=barrelClosureProgress(stormBarrel(0),game.elapsed,game.barrelTimings);
  game.pause();for(let i=0;i<60;i++)game.update(1/30);
  assert.equal(run.deadline,deadline);assert.equal(barrelClosureProgress(stormBarrel(0),game.elapsed,game.barrelTimings),progress);
  game.resume();game.bail();for(let i=0;i<20;i++)game.update(1/120,{pump:true});assert.equal(run.deadline,deadline);
});

test('visible sidebank density rises along the course while the barrel corridor stays open',()=>{
  assert.deepEqual([0,7,19,39].map(stormFunnelRows),[0,1,2,3]);
  for(const index of [0,7,19,39,300]){
    const tube=stormBarrel(index),items=surfHazardsNear(tube.startDistance,'storm',300,25,60).filter(item=>item.type==='reefbank'&&item.barrelIndex===index);
    assert.equal(items.length,stormFunnelRows(index)*4);
    const later=surfHazardsNear(tube.startDistance,'storm',9999,25,60).filter(item=>item.type==='reefbank'&&item.barrelIndex===index);
    assert.deepEqual(items,later,'stage timers cannot spawn a new sidebank under the rider');
    for(const item of items)for(const x of [-8,-6,-4,-2,0])assert.equal(reefBankHeight(item,x,item.distance),0);
    for(const item of items){
      const from={x:item.x,distance:item.distance-8,y:waveHeight(item.x,-item.distance+8,300)},to={x:item.x,distance:item.distance+8,y:waveHeight(item.x,-item.distance-8,300.05)};
      assert.ok(sweepSurfHazard(item,from,to,300,300.05));
      assert.equal(sweepSurfHazard(item,{...from,y:from.y+6},{...to,y:to.y+6},300,300.05),null,'high air clears visible rock');
      assert.equal(sweepSurfHazard(item,{...from,x:-4},{...to,x:-4},300,300.05),null,'open water never has a hidden collision');
    }
  }
  for(let i=0;i<300;i++)assert.ok(courseItem(i,'storm').hazardX-courseItem(i,'storm').hazardRadius>=4,'ordinary reefs cannot obstruct the barrel opening');
});

test('stock-board ordinary controls survive five minutes and clear multiple fully capped curls using earned combo boosts',()=>{
  const caps=[],boosts=[];
  const game=new SurfGame(event=>{
    if(event.type==='surfBoost')boosts.push({time:game.elapsed,...event});
    if(event.type==='barrelExit'){
      const run=game.barrelTimings.get(event.index);
      if(run.escapeWindow===1.3)caps.push({index:event.index,elapsed:game.elapsed,deadline:run.deadline});
    }
  },'storm');game.start();
  for(let tick=0;tick<320*120&&game.phase==='running';tick++)applySurfLabControls(game,surfLabRouteControls(game));
  assert.ok(game.elapsed>319);assert.equal(game.wipeouts,0);assert.equal(game.lives,3);assert.equal(game.rewardBoard,undefined);
  assert.ok(caps.length>=2);assert.ok(caps.every(item=>item.elapsed>300));
  assert.ok(boosts.some(event=>event.time>300&&event.tricks>=2&&event.speed>=10));assert.ok(game.barrelsSurvived>40);
  assert.ok(game.hazardProcessed.size<70);assert.ok(game.barrelTimings.size<=2,'endless progression keeps only nearby timing state');
});
