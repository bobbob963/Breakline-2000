import test from 'node:test';
import assert from 'node:assert/strict';
import {SurfGame,SURF_RULES,TRICKS,courseItem,waveHeight} from '../src/game.js';
import {WaveParkGame} from '../src/park.js';

function advance(game,seconds,input={}){for(let i=0;i<Math.round(seconds*120);i++)game.update(1/120,input);}
function crossGate(game,index,hit=true) {
  const gate=courseItem(index,game.rulesId);
  Object.assign(game,{distance:gate.distance-.1,x:hit?gate.x:16,vx:0,speed:20,y:waveHeight(hit?gate.x:16,-gate.distance,game.elapsed),airborne:false,bailTime:0});
  game.update(1/120);
}

test('session modes retain the surf environment and reset their distinct objectives',()=>{
  for(const id of ['surf','rush','storm']) {
    const game=new SurfGame(()=>{},id);game.start();
    assert.equal(game.mode,'surf');assert.equal(game.rulesId,id);assert.equal(game.rules,SURF_RULES[id]);
    assert.equal(game.time,SURF_RULES[id].startTime);assert.equal(game.lives,SURF_RULES[id].startingLives);
    assert.ok(game.objectiveText.length>15);
    advance(game,.5);game.pause();const before=[game.distance,game.time];advance(game,1);
    assert.deepEqual([game.distance,game.time],before);
    game.start();assert.equal(game.resultReason,'');assert.equal(game.danger,0);assert.equal(game.gates,0);
  }
  assert.equal(new SurfGame(()=>{},'__proto__').rulesId,'surf');
});

test('Reef Rush adds time exactly once per ring and completes on the twelfth caught checkpoint',()=>{
  const events=[],game=new SurfGame(event=>events.push(event),'rush');game.start();
  const before=game.time;crossGate(game,0);
  assert.equal(game.gates,1);assert.ok(Math.abs(game.time-(before+8-1/120))<1e-8);
  crossGate(game,0);assert.equal(game.gates,1);
  crossGate(game,1,false);assert.equal(game.gates,1);assert.equal(game.phase,'running','a missed checkpoint can be recovered at a later ring');
  for(let i=2;i<13;i++)crossGate(game,i);
  assert.equal(game.gates,12);assert.equal(game.phase,'finished');assert.equal(game.resultReason,'RACE COMPLETE');
  assert.equal(events.filter(event=>event.type==='gate').length,12);assert.equal(events.filter(event=>event.type==='finish').length,1);
  assert.equal(game.score,3000);const finalTime=game.time;advance(game,1);assert.equal(game.time,finalTime);
});

test('Reef Rush expires independently of the classic two-minute duration',()=>{
  const game=new SurfGame(()=>{},'rush');game.start();game.time=.04;
  advance(game,.1);assert.equal(game.phase,'finished');assert.equal(game.time,0);assert.equal(game.resultReason,'TIME EXPIRED');
  game.start();assert.equal(game.time,35);assert.equal(game.resultReason,'');
});

test('Storm Survival loses one life per wipeout and ends on the third without double damage',()=>{
  const events=[],game=new SurfGame(event=>events.push(event),'storm');game.start();
  for(let remaining=2;remaining>=0;remaining--) {
    game.bail('REEF COLLISION');assert.equal(game.lives,remaining);
    game.bail('REEF COLLISION');assert.equal(game.lives,remaining,'recovery immunity prevents repeated damage');
    if(remaining)advance(game,1.4,{brake:true});
  }
  assert.equal(game.phase,'finished');assert.equal(game.resultReason,'OUT OF LIVES');assert.equal(game.wipeouts,3);
  assert.equal(events.filter(event=>event.type==='finish').length,1);
  game.start();assert.equal(game.lives,3);assert.equal(game.wipeouts,0);
});

test('Storm passes the old deadline and counts upward until lives run out',()=>{
  const game=new SurfGame(()=>{},'storm');game.start();game.time=.1;game.elapsed=119.9;
  advance(game,.2);assert.equal(game.phase,'running');assert.equal(game.resultReason,'');assert.equal(game.lives,3);
  assert.ok(Math.abs(game.time-120.1)<1e-8);assert.equal(game.stormStage,5);
  assert.ok(game.danger>=0&&game.danger<=1);
});

test('ground cutbacks reverse the carve and earn a launch window without farmable points',()=>{
  const events=[],game=new SurfGame(event=>events.push(event));game.start();
  advance(game,.4,{right:true});const startX=game.x,startSpeed=game.speed;
  assert.ok(game.vx>7);assert.equal(game.doCutback(),true);assert.equal(game.cutbackDirection,-1);
  assert.equal(game.doCutback(),false);assert.equal(game.jump(),false);
  advance(game,.35);assert.ok(game.cutback>.99);assert.ok(game.vx<-7);assert.ok(game.speed<startSpeed);
  assert.equal(game.comboNames.includes('ROUNDHOUSE CUTBACK'),false);assert.equal(game.bank(),false);
  advance(game,.4);assert.equal(game.cutbackActive,false);assert.equal(game.cutback,0);assert.ok(game.x<startX-3);
  assert.equal(game.comboBase,0);assert.equal(game.bank(),false);assert.equal(game.landedTricks,0);
  assert.equal(game.launchSource,'cutback');assert.ok(game.cutbackLaunchTime>2);
  assert.equal(events.filter(event=>event.type==='trick').length,0,'setup cannot farm SPECIAL');
  assert.equal(game.doCutback(),false,'the cooldown prevents repeated instant carves');
  advance(game,.8);assert.equal(game.doCutback(1),true);game.bail();
  assert.equal(game.cutbackActive,false);assert.equal(game.cutback,0);
  assert.equal(events.filter(event=>event.type==='cutback').length,1);
});

test('B trick is a tweaked grab that holds the board without a rider roll and must land',()=>{
  const game=new SurfGame();game.start();assert.equal(game.doTrick('tweak'),false);game.x=-9;game.y=waveHeight(-9,0,0);game.charge=1;game.jump();
  assert.equal(game.doTrick('barrel'),false,'barrel refers to a wave tunnel, not a rider roll');
  assert.equal(game.doCutback(),false);assert.equal(game.doTrick('tweak'),true);
  assert.equal(game.trick.grab,1);assert.equal(game.trick.tweak,1);assert.equal(game.trick.roll,undefined);advance(game,TRICKS.tweak.duration+.02);
  assert.equal(game.rollRotation,0);assert.equal(game.flipRotation,0);assert.equal(game.boardRotation,0);
  assert.equal(game.bank(),false);
  for(let i=0;i<500&&game.airborne;i++)game.update(1/120);
  assert.equal(game.wipeouts,0);assert.ok(game.bank());assert.equal(game.landedTricks,1);
  for(let i=0;i<200&&!game.popReady;i++)game.update(1/120);assert.equal(game.jump(),true);assert.equal(game.rollRotation,0);
});

test('normal aerial steering can land cleanly, with braking reducing the control warning',()=>{
  for(const brake of [false,true]) {
    const game=new SurfGame();game.start();game.x=-9;game.y=waveHeight(-9,0,0);game.charge=1;game.jump();game.doTrick('spin');
    advance(game,1.1,{right:true});assert.ok(game.vy<0);assert.ok(game.vx>7);
    let warned=false;
    for(let i=0;i<200&&game.airborne;i++) {
      game.update(1/120,brake?{brake:true}:{right:true});
      if(game.landingWarning){warned=true;assert.ok(game.danger>.8);}
    }
    assert.equal(game.wipeouts,0);assert.ok(game.comboNames.includes('CLEAN LANDING'));
    if(!brake)assert.equal(warned,true,'strong drift still gives a helpful warning without demanding a perfect landing');
  }
});

test('shared reef descriptors drive collision and current difficulty in each mode',()=>{
  for(const id of ['surf','rush','storm']) {
    const game=new SurfGame(()=>{},id);game.start();const item=courseItem(2,id),rules=SURF_RULES[id];
    assert.equal(item.distance,rules.firstGate+rules.spacing*2);assert.equal(item.hazardDistance,item.distance+rules.hazardOffset);
    assert.equal(item.hazardRadius,rules.hazardRadius);assert.equal(item.ringRadius,rules.ringRadius);
    Object.assign(game,{distance:item.hazardDistance-.5,x:item.hazardX,vx:0,y:waveHeight(item.hazardX,-item.hazardDistance,0)});
    advance(game,.1);assert.equal(game.wipeouts,1);
  }
  const mild=new SurfGame(),storm=new SurfGame(()=>{},'storm');mild.start();storm.start();
  for(const game of [mild,storm]){game.distance=20;game.elapsed=1;game.update(1/120,{brake:true});}
  assert.ok(Math.abs(storm.current)>Math.abs(mild.current)*1.9);
});

test('reef side-entry is swept until the rider has actually passed the obstacle',()=>{
  const game=new SurfGame();game.start();const item=courseItem(0);
  Object.assign(game,{x:item.hazardX+item.hazardRadius+.5,distance:item.hazardDistance-2.05,vx:0,speed:9,y:waveHeight(item.hazardX,-item.hazardDistance,0)});
  game.update(1/120,{brake:true});assert.equal(game.wipeouts,0);assert.equal(game.processed.has('h0'),false);
  game.vx=-20;
  advance(game,.15,{left:true,brake:true});assert.equal(game.wipeouts,1);
});

test('mode physics and course rewards match at 30 and 120 frames per second',()=>{
  for(const id of ['rush','storm']) {
    const a=new SurfGame(()=>{},id),b=new SurfGame(()=>{},id);a.start();b.start();
    for(let i=0;i<300;i++)a.update(1/30,{pump:true,left:i%90<8});
    for(let i=0;i<1200;i++)b.update(1/120,{pump:true,left:Math.floor(i/4)%90<8});
    assert.ok(Math.abs(a.x-b.x)<1e-8);assert.ok(Math.abs(a.distance-b.distance)<1e-8);
    assert.equal(a.score,b.score);assert.equal(a.lives,b.lives);assert.equal(a.resultReason,b.resultReason);
  }
});

test('continuous steering can finish Reef Rush and survive endless Storm beyond 120 seconds',()=>{
  for(const id of ['rush','storm']) {
    const game=new SurfGame(()=>{},id);game.start();
    // A simple route follower chooses the next visible ring or a safe side of
    // the next reef. It never edits simulation positions, time, lives or score.
    for(let tick=0;tick<120*150&&game.phase==='running';tick++) {
      const index=Math.max(0,Math.floor((game.distance-game.rules.firstGate)/game.rules.spacing)),targets=[];
      for(let i=Math.max(0,index-1);i<index+3;i++) {
        const item=courseItem(i,id);
        if(!game.processed.has('g'+i)&&item.distance>=game.distance)targets.push({distance:item.distance,x:item.x});
        if(!game.processed.has('h'+i)&&item.hazardDistance+2.2>=game.distance)targets.push({distance:item.hazardDistance+2.2,x:Math.max(-10,Math.min(10,item.hazardX+(item.hazardX>0?-6:6)))});
      }
      targets.sort((a,b)=>a.distance-b.distance);
      // The endless-clock check follows the clear outer shoulder. The timed
      // curl, wood hops and whirlpool routes are exercised independently.
      const error=(id==='storm'?14.8:targets[0]?.x??0)-game.x-game.vx*.22;
      game.update(1/120,{pump:true,left:error<-.35,right:error>.35});
      assert.ok([game.x,game.y,game.time,game.danger].every(Number.isFinite));
    }
    if(id==='rush'){assert.equal(game.phase,'finished');assert.equal(game.resultReason,'RACE COMPLETE');assert.equal(game.gates,12);assert.ok(game.time>0);}
    else {assert.equal(game.phase,'running');assert.equal(game.resultReason,'');assert.ok(game.lives>0);assert.ok(game.elapsed>149.9);assert.equal(game.time,game.elapsed);assert.ok(game.processed.size<30,'an endless run retains only nearby course bookkeeping');}
  }
});

test('Shift and steering trigger the chosen cutback in either key order and every ocean mode',()=>{
  for(const id of ['surf','rush','storm'])for(const direction of [-1,1])for(const first of ['shift','steer']) {
    const events=[],game=new SurfGame(event=>events.push(event),id);game.start();
    const steering=direction<0?{left:true}:{right:true};
    advance(game,.15,first==='shift'?{grind:true}:steering);
    assert.equal(game.cutbackActive,false);
    game.update(1/120,{grind:true,...steering});
    assert.equal(game.cutbackActive,true);assert.equal(game.cutbackDirection,direction);
    assert.equal(events.filter(event=>event.type==='cutbackStart').length,1);
    assert.equal(game.airborne,false);
  }
});

test('holding a Shift-turn chord cannot repeat a cutback after its cooldown',()=>{
  const events=[],game=new SurfGame(event=>events.push(event));game.start();
  advance(game,3,{grind:true,left:true});
  assert.equal(events.filter(event=>event.type==='cutbackStart').length,1);
  game.start();game.update(1/120,{grind:true,left:true});
  assert.equal(events.filter(event=>event.type==='cutbackStart').length,2,'restart rearms held controls');
});

test('releasing Shift, releasing steering, or changing direction rearms the next legal cutback',()=>{
  for(const release of ['shift','steering','direction']) {
    const events=[],game=new SurfGame(event=>events.push(event));game.start();
    game.update(1/120,{grind:true,left:true});
    advance(game,.8,{grind:true,left:true});
    const next=release==='direction'?{grind:true,right:true}:{grind:true,left:true};
    game.update(1/120,release==='shift'?{left:true}:release==='steering'?{grind:true}:next);
    advance(game,.25,next);
    assert.equal(events.filter(event=>event.type==='cutbackStart').length,1,'a rearmed chord still respects cooldown');
    advance(game,.5,next);
    assert.equal(events.filter(event=>event.type==='cutbackStart').length,2);
    assert.equal(game.cutbackDirection,release==='direction'?1:-1);
  }
});

test('Shift-turn held during a controlled air waits until grounded before cutting back',()=>{
  const events=[],game=new SurfGame(event=>events.push(event));game.start();
  advance(game,.8,{jump:true});assert.equal(game.jump(),true);
  for(let i=0;i<400&&game.airborne;i++) {
    assert.equal(events.filter(event=>event.type==='cutbackStart').length,0);
    game.update(1/120,{grind:true,right:true,brake:true});
  }
  assert.equal(game.airborne,false);assert.equal(game.wipeouts,0);
  game.update(1/120,{grind:true,right:true,brake:true});
  assert.equal(game.cutbackActive,true);assert.equal(game.cutbackDirection,1);
  assert.equal(events.filter(event=>event.type==='cutbackStart').length,1);
});

test('opposed steering does not form a chord while Waterworks supports its grounded Shift cutback',()=>{
  const surf=new SurfGame();surf.start();advance(surf,.2,{grind:true,left:true,right:true});
  assert.equal(surf.cutbackActive,false);assert.equal(surf.doCutback(1),true,'C remains a separate cutback action');
  const events=[],park=new WaveParkGame(event=>events.push(event));park.start();
  advance(park,.2,{grind:true,left:true,right:true});assert.equal(park.cutbackActive,false);
  advance(park,.5,{grind:true,left:true});
  assert.ok(park.heading>0);assert.equal(park.cutbackActive,true);assert.equal(park.cutbackDirection,-1);
  assert.equal(events.filter(event=>event.type==='cutbackStart').length,1);
});
