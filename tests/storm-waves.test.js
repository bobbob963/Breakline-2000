import test from 'node:test';
import assert from 'node:assert/strict';
import {SurfGame,courseItem,waveHeight} from '../src/game.js';
import {stormBarrel,stormBarrelsNear,barrelCrossSection,barrelSurfacePoint,barrelShellDistance,sampleStormBarrel,sweepStormBarrel,stormDifficulty} from '../src/storm-waves.js';

function routeInput(game) {
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

test('barrel descriptors repeat along the real course and taper into the existing wave at open mouths',()=>{
  for(const index of [0,1,20,500]) {
    const barrel=stormBarrel(index);
    assert.equal(barrel.startDistance,180+index*230);assert.equal(barrel.endDistance-barrel.startDistance,52);
    for(const distance of [barrel.startDistance,barrel.endDistance]) {
      const s=barrelCrossSection(barrel,-distance,30);
      assert.equal(s.envelope,0);assert.equal(s.startAngle,s.endAngle);
    }
    assert.equal(sampleStormBarrel(0,0,-barrel.startDistance+1,30),null);
    assert.equal(sampleStormBarrel(0,0,-barrel.endDistance-1,30),null);
    assert.ok(stormBarrelsNear(barrel.startDistance).some(item=>item.id===barrel.id));
  }
});

test('render surface points and shell collision agree while the floor remains open',()=>{
  for(const time of [0,45,180,10000])for(const index of [0,4]) {
    const barrel=stormBarrel(index),z=-barrel.centerDistance,s=barrelCrossSection(barrel,z,time);
    assert.equal(s.envelope,1);
    for(const arc of [0,.1,.25,.5,.75,1])for(const outer of [false,true]) {
      const point=barrelSurfacePoint(barrel,z,arc,time,outer);
      assert.ok(barrelShellDistance(s,point.x,point.y)<1e-9);
    }
    assert.ok(barrelShellDistance(s,s.centerX,s.centerY-s.innerRadius)>1,'no invisible lower semicircle');
    const ground=waveHeight(s.centerX,z,time),sample=sampleStormBarrel(s.centerX,ground,z,time);
    assert.equal(sample.inside,true);assert.equal(sample.colliding,false);
    const roof=sampleStormBarrel(s.centerX,s.centerY+s.innerRadius-1.5,z,time);
    assert.equal(roof.colliding,true,'rider head contacts the visible roof');
  }
});

test('fast upward and lateral sweeps cannot skip the visible falling lip or roof',()=>{
  const barrel=stormBarrel(0),z=-barrel.centerDistance,s=barrelCrossSection(barrel,z,10);
  const floor=waveHeight(s.centerX,z,10);
  assert.ok(sweepStormBarrel({x:s.centerX,y:floor,z},{x:s.centerX,y:12,z},10,10.01));
  assert.ok(sweepStormBarrel({x:s.centerX,y:s.centerY-.5,z},{x:s.centerX+8,y:s.centerY-.5,z},10,10.01));
  assert.equal(sweepStormBarrel({x:s.centerX,y:floor,z:-barrel.startDistance+5},{x:s.centerX,y:floor,z:-barrel.startDistance+1},10,10.01),null);
});

test('Storm difficulty keeps rising toward safe bounds while stage and survival time keep increasing',()=>{
  assert.equal(stormDifficulty(0),0);assert.equal(stormDifficulty(120),.5);
  assert.equal(stormDifficulty(180),.6);assert.ok(stormDifficulty(240)>stormDifficulty(180));
  assert.ok(stormDifficulty(100000)<1);assert.ok(stormDifficulty(100000)>.99);
  const game=new SurfGame(()=>{},'storm');game.start();
  for(const elapsed of [29.99,60,180,1000]) {
    game.elapsed=elapsed;game.update(1/120,{brake:true});
    assert.equal(game.stormStage,1+Math.floor(game.elapsed/30));assert.equal(game.time,game.elapsed);
    assert.ok(game.stormDifficulty>=0&&game.stormDifficulty<=1);assert.equal(game.phase,'running');
    assert.ok(Math.abs(game.current)<=7.38+1e-8);
  }
  game.pause();const frozen=[game.time,game.elapsed,game.stormStage,game.stormDifficulty];
  game.update(.05);assert.deepEqual([game.time,game.elapsed,game.stormStage,game.stormDifficulty],frozen);
  game.start();assert.equal(game.time,0);assert.equal(game.elapsed,0);assert.equal(game.stormStage,1);assert.equal(game.stormDifficulty,0);
  assert.equal(game.lives,3);assert.equal(game.barrel,null);assert.equal(game.barrelRun,null);assert.equal(game.barrelTime,0);assert.equal(game.barrelsSurvived,0);
});

test('late Storm runs move faster without growing reef collision boxes',()=>{
  const early=new SurfGame(()=>{},'storm'),late=new SurfGame(()=>{},'storm');early.start();late.start();late.elapsed=100000;
  for(let tick=0;tick<240;tick++){early.update(1/120);late.update(1/120);}
  assert.equal(early.wipeouts,0);assert.equal(late.wipeouts,0);assert.ok(late.speed>early.speed+4);
  assert.ok(late.speed<=27);assert.ok(late.stormDifficulty>.99&&late.stormDifficulty<1);
  assert.equal(courseItem(0,'storm').hazardRadius,3,'difficulty must not enlarge a reef beyond its rendered descriptor');
});

test('a real Storm update collides with the visible roof and consumes only one life during recovery',()=>{
  const events=[],game=new SurfGame(event=>events.push(event),'storm');game.start();
  const barrel=stormBarrel(0),z=-barrel.centerDistance,s=barrelCrossSection(barrel,z,10);
  Object.assign(game,{elapsed:10,distance:barrel.centerDistance,x:s.centerX,y:s.centerY+s.innerRadius-1.9,airborne:true,airtime:.4,vy:12,vx:0});
  game.update(.05);
  assert.equal(game.lives,2);assert.equal(game.wipeouts,1);assert.equal(events.filter(event=>event.type==='bail')[0].reason,'CAUGHT BY THE WAVE LIP');
  game.update(.05);assert.equal(game.lives,2);assert.equal(game.wipeouts,1);
  assert.equal(game.barrelRun.bailed,true,'a hit on first entry cannot later masquerade as a clean ride');
});

test('ordinary steering traverses two barrels from the normal start and rewards each clean exit once',()=>{
  const events=[],game=new SurfGame(event=>events.push(event),'storm');game.start();let approached=false;
  for(let tick=0;tick<22*120;tick++) {
    if(game.barrel&&game.distance<game.barrel.startDistance){approached=true;assert.equal(game.barrel.inside,false);}
    game.update(1/120,routeInput(game));
  }
  assert.equal(approached,true,'the rider gets a usable advance lineup target');
  assert.equal(game.lives,3);assert.equal(game.wipeouts,0);assert.equal(game.barrelsSurvived,2);assert.ok(game.barrelTime>3.5);
  const exits=events.filter(event=>event.type==='barrelExit');assert.equal(exits.length,2);
  assert.deepEqual(exits.map(event=>event.index),[0,1]);assert.ok(exits.every(event=>event.points>=600&&event.rideTime>=.7));
  assert.ok(game.score>=exits.reduce((sum,event)=>sum+event.points,0));
});

test('a wipeout inside a barrel loses its clean-exit reward and pause cannot advance tube time',()=>{
  const events=[],game=new SurfGame(event=>events.push(event),'storm');game.start();
  for(let i=0;i<120*12&&!game.barrel?.inside;i++)game.update(1/120,routeInput(game));
  assert.equal(game.barrel?.inside,true);
  game.pause();const before=[game.elapsed,game.barrelTime,game.barrel.time];for(let i=0;i<120;i++)game.update(1/120);
  assert.deepEqual([game.elapsed,game.barrelTime,game.barrel.time],before);game.resume();game.bail('TEST WIPEOUT');
  while(game.distance<240&&game.phase==='running')game.update(1/120,routeInput(game));
  assert.equal(game.barrelsSurvived,0);assert.equal(events.filter(event=>event.type==='barrelExit').length,0);
  game.start();assert.equal(game.barrelTime,0);assert.equal(game.barrelRun,null);assert.equal(game.lives,3);
});

test('barrel collisions and progress agree at 30 and 120 Hz',()=>{
  const a=new SurfGame(()=>{},'storm'),b=new SurfGame(()=>{},'storm');a.start();b.start();
  for(let tick=0;tick<22*30;tick++) {
    const input=routeInput(a);a.update(1/30,input);for(let sub=0;sub<4;sub++)b.update(1/120,input);
  }
  assert.ok(Math.abs(a.x-b.x)<1e-8);assert.ok(Math.abs(a.distance-b.distance)<1e-8);
  assert.ok(Math.abs(a.barrelTime-b.barrelTime)<1e-8);assert.equal(a.score,b.score);assert.equal(a.lives,b.lives);assert.equal(a.barrelsSurvived,b.barrelsSurvived);
});
