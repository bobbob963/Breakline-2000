import test from 'node:test';
import assert from 'node:assert/strict';
import { SEWER_TRACKS,createSewerCourse,sewerPoint,sewerPathScale,sewerWaterHeight,sewerBarrelState,sewerTunnelProfile } from '../src/sewer-course.js';
import { SewerRaceGame,SewerRider,sewerOpponentInput } from '../src/sewer-race.js';

const advance=(game,seconds,input={},hz=120)=>{for(let i=0;i<Math.round(seconds*hz);i++)game.update(1/hz,typeof input==='function'?input(game):input);};
function riderFor(trackId='sewer-run'){
  const events=[],rider=new SewerRider(event=>events.push(event));rider.trackId=trackId;rider.reset();rider.phase='running';rider.lives=null;
  return {rider,events};
}
function placeAt(rider,distance,x=0){Object.assign(rider,{distance,x,vx:0,vy:0,speed:30,airborne:false,bailTime:0,y:sewerWaterHeight(x,distance,rider.elapsed,rider.trackId,rider.activeShortcut)});}

test('two sewer routes share finite physical descriptors and ordered reachable rings',()=>{
  assert.deepEqual(SEWER_TRACKS.map(track=>track.id),['sewer-run','sewer-depths']);
  for(const track of SEWER_TRACKS){
    const course=createSewerCourse(track.id);assert.equal(course.name,track.name);assert.ok(course.length>1300);assert.equal(course.shortcuts.length,3);
    assert.deepEqual(new Set(course.hazards.map(hazard=>hazard.type)),new Set(['whirlpool','driftwood','barrel']));
    for(const [index,gate] of course.checkpoints.entries()){
      assert.equal(gate.index,index);assert.ok(gate.distance>0&&gate.distance<course.length);
      assert.ok(gate.distance>(course.checkpoints[index-1]?.distance||0));
      assert.ok(Math.abs(gate.x)+gate.radius<course.halfWidth);
      assert.ok(!course.shortcuts.some(branch=>gate.distance>branch.start&&gate.distance<branch.end),'both paths rejoin before each mandatory ring');
    }
    for(const hazard of course.hazards)assert.ok(hazard.path==='main'||course.shortcuts.some(branch=>branch.id===hazard.path));
  }
});

test('bypasses join the visible pipe mouths continuously and are physically shorter',()=>{
  for(const track of SEWER_TRACKS)for(const branch of createSewerCourse(track.id).shortcuts){
    for(const distance of [branch.start,branch.end]){
      const main=sewerPoint(distance,branch.entryX,0,track.id),shortcut=sewerPoint(distance,branch.entryX,0,track.id,branch);
      assert.ok(Math.hypot(main.x-shortcut.x,main.z-shortcut.z)<1e-8);
    }
    let mainLength=0,branchLength=0;for(let d=branch.start;d<branch.end;d+=.25){mainLength+=sewerPathScale(d,track.id,null,branch.entryX)*.25;branchLength+=sewerPathScale(d,track.id,branch,branch.entryX)*.25;}
    assert.ok(branchLength<mainLength*.94,'shortcut saves real distance');
    const halfway=(branch.start+branch.end)/2,main=sewerPoint(halfway,0,0,track.id),shortcut=sewerPoint(halfway,branch.entryX,0,track.id,branch);
    assert.ok(Math.hypot(main.x-shortcut.x,main.z-shortcut.z)>20,'branch is separate from the main pipe');
  }
});

test('shortcut joins preserve every legal lane, heading, water height and camera continuation',()=>{
  for(const track of SEWER_TRACKS)for(const branch of createSewerCourse(track.id).shortcuts)for(const offset of [-branch.width*.43,0,branch.width*.43]){
    const x=branch.entryX+offset;
    for(const distance of [branch.start,branch.end]){
      const before=sewerPoint(distance-.0001,x,0,track.id,branch),after=sewerPoint(distance+.0001,x,0,track.id,branch);
      assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<.002,'no lateral teleport at either mouth');
      assert.ok(Math.abs(before.heading-after.heading)<.001,'no abrupt heading rotation');
      const beforeWater=sewerWaterHeight(x,distance-.0001,12,track.id,branch),afterWater=sewerWaterHeight(x,distance+.0001,12,track.id,branch);
      assert.ok(Math.abs(beforeWater-afterWater)<.001,'waterline stays continuous');
    }
    for(const distance of [branch.start-15,branch.end+15]){
      assert.deepEqual(sewerPoint(distance,x,2,track.id,branch),sewerPoint(distance,x,2,track.id));
      assert.deepEqual(sewerTunnelProfile(distance,track.id,branch),sewerTunnelProfile(distance,track.id));
    }
  }
});

test('authored chambers have smoothly varying shell clearance around a continuous central canal',()=>{
  for(const track of SEWER_TRACKS){
    const course=createSewerCourse(track.id);assert.equal(course.sections[0].start,0);assert.equal(course.sections.at(-1).end,course.length);
    assert.ok(new Set(course.sections.map(section=>section.kind)).size>=4);
    for(const [index,section] of course.sections.entries()){
      if(index)assert.equal(section.start,course.sections[index-1].end);
      const middle=sewerTunnelProfile((section.start+section.end)/2,track.id);
      assert.equal(middle.halfWidth,track.halfWidth);assert.equal(middle.radius,section.chamber?22:14);
      const a=sewerTunnelProfile(section.start-.001,track.id),b=sewerTunnelProfile(section.start+.001,track.id);
      assert.ok(Math.abs(a.radius-b.radius)<.001);
    }
  }
});

test('countdown, pause and retry hold both racers and preserve selected track',()=>{
  const events=[],game=new SewerRaceGame(event=>events.push(event),{trackId:'sewer-depths',isSewerLadder:true,roundIndex:2});game.start();
  assert.equal(game.mode,'sewer');assert.equal(game.isTournament,false);assert.equal(game.isSewerLadder,true);
  assert.equal(game.jump(),false);assert.equal(game.doCutback(1),false);advance(game,2,{pump:true,right:true});
  assert.equal(game.distance,0);assert.equal(game.opponent.distance,0);assert.equal(game.elapsed,0);
  game.pause();advance(game,2);assert.ok(Math.abs(game.countdownRemaining-1)<1e-8);game.resume();advance(game,1);
  assert.equal(game.countdownRemaining,0);assert.equal(events.filter(event=>event.type==='raceGo').length,1);
  advance(game,2,{pump:true});assert.ok(game.distance>0&&game.opponent.distance>0);game.retry();
  assert.equal(game.trackId,'sewer-depths');assert.equal(game.opponent.trackId,'sewer-depths');assert.equal(game.roundIndex,2);assert.equal(game.countdownRemaining,3);
});

test('only crossing a bypass mouth on its lane selects the branch; it rejoins at the end',()=>{
  for(const entered of [false,true]){
    const {rider,events}=riderFor(),branch=rider.course.shortcuts[0];placeAt(rider,branch.start-.01,entered?branch.entryX:0);
    rider.update(1/120,{pump:true});assert.equal(rider.activeShortcut,entered?branch.id:null);assert.equal(rider.shortcutsTaken,entered?1:0);
    if(entered){placeAt(rider,branch.end-.01,branch.entryX);rider.update(1/120,{pump:true});assert.equal(rider.activeShortcut,null);assert.equal(events.filter(e=>e.type==='sewerShortcutExit').length,1);}
    placeAt(rider,branch.start-.01,branch.entryX);rider.update(1/120,{pump:true});assert.equal(rider.activeShortcut,null,'repeated crossing cannot create another shortcut reward');
  }
});

test('crossing either bypass mouth preserves physical forward speed',()=>{
  for(const track of SEWER_TRACKS)for(const branch of createSewerCourse(track.id).shortcuts)for(const exiting of [false,true])for(const offset of [-1.5,0,1.5]){
    const {rider}=riderFor(track.id);rider.activeShortcut=exiting?branch.id:null;
    placeAt(rider,(exiting?branch.end:branch.start)-.01,branch.entryX+offset);
    rider.speed=track.pumpSpeed*rider.baseSpeedMultiplier;
    const before=sewerPoint(rider.distance,rider.x,0,track.id,rider.activeShortcut),expected=rider.speed/120;
    rider.update(1/120,{pump:true});
    const after=sewerPoint(rider.distance,rider.x,0,track.id,rider.activeShortcut),actual=Math.hypot(after.x-before.x,after.z-before.z);
    assert.equal(rider.activeShortcut,exiting?null:branch.id);
    assert.ok(Math.abs(actual-expected)<.001,`${track.id} ${branch.id} ${exiting?'exit':'entry'}: ${actual}m instead of ${expected}m`);
  }
});

test('visible driftwood and whirlpools collide, jumping clears them, and opposite-path hazards do not hit',()=>{
  for(const type of ['driftwood','whirlpool'])for(const airborne of [false,true]){
    const {rider}=riderFor(),hazard=rider.course.hazards.find(item=>item.type===type&&item.path==='main');
    placeAt(rider,hazard.distance-.02,hazard.x);if(airborne){rider.airborne=true;rider.y+=2;rider.vy=0;rider.airtime=.4;}
    rider.update(1/120,{pump:true});assert.equal(rider.wipeouts,airborne?0:1,`${type} collision and clearance`);
  }
  const {rider}=riderFor(),branch=rider.course.shortcuts[0],hazard=rider.course.hazards.find(item=>item.path===branch.id&&item.type==='driftwood');
  placeAt(rider,hazard.distance-.02,branch.entryX);rider.update(1/120,{pump:true});assert.equal(rider.wipeouts,0,'shortcut log is not an invisible main-tunnel collision');
});

test('a normal uncharged jump physically clears a shortcut log on either route',()=>{
  for(const track of SEWER_TRACKS){
    const {rider}=riderFor(track.id),branch=rider.course.shortcuts[0];rider.activeShortcut=branch.id;
    const hazard=rider.course.hazards.find(item=>item.path===branch.id&&item.type==='driftwood');
    const lead=30/sewerPathScale(hazard.distance,track.id,branch)*.52;
    placeAt(rider,hazard.distance-lead,branch.entryX);assert.equal(rider.jump(),true);advance(rider,1.3,{pump:true});
    assert.ok(rider.distance>hazard.distance+hazard.radiusZ);assert.equal(rider.wipeouts,0);assert.equal(rider.charge,0);
  }
});

test('closing flood barrel warns early and catches a slow rider at its published deadline',()=>{
  const {rider,events}=riderFor(),hazard=rider.course.hazards.find(item=>item.type==='barrel');
  placeAt(rider,hazard.startDistance-.02);rider.update(1/120,{brake:true});
  const timing=rider.hazardStates.get(hazard.id);assert.ok(timing);assert.ok(timing.deadline>rider.elapsed);
  assert.ok(Math.abs(timing.deadline-timing.enteredAt-hazard.closeDuration)<1e-8);
  assert.equal(sewerBarrelState(hazard,timing.enteredAt+hazard.closeDuration/2,timing).closure,.5);
  advance(rider,hazard.closeDuration+.2,{brake:true});assert.equal(rider.wipeouts,1);
  assert.ok(events.some(event=>event.type==='bail'&&event.reason==='CAUGHT IN THE FLOOD BARREL'));
});

test('all closing barrels leave enough room for ordinary pumping without tricks or unlocked buffs',()=>{
  for(const track of SEWER_TRACKS)for(const hazard of createSewerCourse(track.id).hazards.filter(item=>item.type==='barrel')){
    const {rider}=riderFor(track.id);placeAt(rider,hazard.startDistance-.01,0);rider.speed=track.pumpSpeed;
    for(let i=0;i<120*8&&rider.distance<hazard.endDistance;i++)rider.update(1/120,{pump:true});
    assert.ok(rider.distance>=hazard.endDistance);assert.equal(rider.wipeouts,0);assert.equal(rider.boostTime,0);
    assert.equal(rider.barrelsSurvived,1);
  }
});

test('boosted extra jumps stop at the actual narrow pipe roof without teleporting through it',()=>{
  for(const track of SEWER_TRACKS){
    const {rider}=riderFor(track.id),branch=rider.course.shortcuts[0];rider.activeShortcut=branch.id;
    placeAt(rider,(branch.start+branch.end)/2,branch.entryX+2);
    const profile=sewerTunnelProfile(rider.distance,track.id,branch),headroom=profile.centerY+Math.sqrt(profile.radius**2-2**2)-1.9;
    Object.assign(rider,{airborne:true,airtime:.4,y:headroom-.01,vy:18});rider.update(1/120,{pump:true});
    assert.ok(rider.y<=headroom+1e-8);assert.equal(rider.vy,0);assert.equal(rider.wipeouts,0);
  }
});

test('Sludge Surge shield bypasses whirlpool pull, floating debris and the closing flood',()=>{
  for(const type of ['whirlpool','driftwood','barrel']){
    const {rider}=riderFor();Object.defineProperty(rider,'hazardShieldActive',{get:()=>true});
    const hazard=rider.course.hazards.find(item=>item.type===type&&item.path==='main');
    placeAt(rider,type==='barrel'?hazard.startDistance-.02:hazard.distance-.02,hazard.x);
    rider.update(1/120,{brake:true});if(type==='barrel')advance(rider,hazard.closeDuration+.2,{brake:true});
    assert.equal(rider.wipeouts,0,type);assert.equal(rider.current,0);
  }
});

test('checkpoint crossings use height and width, and missing one cannot win the race',()=>{
  const events=[],game=new SewerRaceGame(event=>events.push(event));game.start();advance(game,3);
  const gate=game.course.checkpoints[0];placeAt(game,gate.distance-.01,gate.x);game.update(1/120,{pump:true});assert.equal(game.nextCheckpoint,1);
  const next=game.course.checkpoints[1];placeAt(game,next.distance-.01,next.x);game.airborne=true;game.y=20;game.airtime=.4;
  game.update(1/120,{pump:true});assert.equal(game.nextCheckpoint,1);assert.equal(game.raceMisses,1);assert.equal(game.distance,next.distance-18);
  placeAt(game,game.course.length-.01);game.update(1/120,{pump:true});assert.equal(game.phase,'running');assert.equal(game.result,null);
  assert.equal(events.filter(e=>e.type==='raceGate'&&!e.opponent).length,1);
});

test('every rival naturally clears both courses, jumps shortcut logs and earns landed-trick boosts',()=>{
  for(const track of SEWER_TRACKS){
    const events=[],game=new SewerRaceGame(event=>events.push(event),{trackId:track.id});game.start();game.lives=null;
    for(let i=0;i<120*120&&game.phase==='running';i++)game.update(1/120,{brake:true});
    assert.equal(game.result,'loss');assert.equal(game.opponent.nextCheckpoint,game.course.checkpoints.length);
    assert.equal(game.opponent.raceMisses,0);assert.equal(game.opponent.wipeouts,0);assert.equal(game.opponent.shortcutsTaken,3);
    assert.ok(events.filter(e=>e.type==='raceBoost'&&e.opponent).length>=5);assert.ok(events.some(e=>e.type==='trick'&&e.opponent));
    assert.ok(game.opponentFinishTime>40&&game.opponentFinishTime<100);
  }
});

test('ordinary player pumping, steering and jump controls can win both courses without a reward board',()=>{
  for(const track of SEWER_TRACKS){
    const events=[],game=new SewerRaceGame(event=>events.push(event),{trackId:track.id,isSewerLadder:true,rival:{pace:.70}});game.start();
    for(let i=0;i<120*120&&game.phase==='running';i++)game.update(1/120,sewerOpponentInput(game,game.course,1));
    assert.equal(game.result,'win');assert.equal(game.wipeouts,0);assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
    const finishes=events.filter(e=>e.type==='finish');assert.equal(finishes.length,1);assert.equal(finishes[0].isSewerLadder,true);assert.equal(finishes[0].sewer,true);
    assert.equal(Object.hasOwn(finishes[0],'progress'),false,'race does not mutate another ladder');assert.equal(game.finish('win'),false);
  }
});

test('the main tunnel remains a clean playable route when a rider ignores all bypasses',()=>{
  for(const track of SEWER_TRACKS){
    const game=new SewerRaceGame(()=>{},{trackId:track.id});game.start();
    const mainRoute={...game.course,shortcuts:[]};
    for(let i=0;i<120*120&&game.phase==='running';i++)game.update(1/120,sewerOpponentInput(game,mainRoute,1));
    assert.equal(game.phase,'finished');assert.ok(game.distanceRemaining<15,'the main route remains competitive');
    assert.equal(game.wipeouts,0);assert.equal(game.raceMisses,0);assert.equal(game.shortcutsTaken,0);
    assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
  }
});

test('rival movement is frame-rate independent and ignores player position or score',()=>{
  const states=[];
  for(const hz of [30,60,120]){
    const game=new SewerRaceGame(()=>{},{trackId:'sewer-depths'});game.start();game.lives=null;game.score=hz*999;game.distance=hz===30?0:20;
    advance(game,24,{brake:true},hz);states.push(game.opponent);
  }
  for(const rider of states.slice(1))for(const key of ['x','y','distance','elapsed','speed','nextCheckpoint','wipeouts','raceMisses','shortcutsTaken'])
    assert.ok(Math.abs(rider[key]-states[0][key])<1e-8,key);
});

test('third player wipeout settles once with the existing out-of-lives race event',()=>{
  const events=[],game=new SewerRaceGame(event=>events.push(event));game.start();advance(game,3);
  for(let i=0;i<3;i++){game.bailTime=0;game.bail('TEST COLLISION');}
  assert.equal(game.phase,'finished');assert.equal(game.opponent.phase,'finished');assert.equal(game.result,'loss');
  assert.equal(game.resultReason,'OUT OF LIVES');assert.equal(events.filter(e=>e.type==='finish').length,1);
});
