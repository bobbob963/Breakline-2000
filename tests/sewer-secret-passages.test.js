import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SEWER_TRACKS,createSewerCourse,sewerBranches,sewerPoint,sewerPathScale,sewerWaterHeight} from '../src/sewer-course.js';
import {SewerRider,SewerRaceGame} from '../src/sewer-race.js';
import {createSewerWorld} from '../src/sewer-world.js';
import {createSewerCameraState,stepSewerCamera,sewerCameraSection} from '../src/sewer-camera-rig.js';

function fixture(trackId='sewer-run',distance=null){
  const events=[],rider=new SewerRider(event=>events.push(event));rider.trackId=trackId;rider.reset();rider.phase='running';rider.lives=null;
  const branch=rider.course.secretPassages[0];
  Object.assign(rider,{distance:distance??branch.start-.01,x:branch.entryX,y:0,vx:0,speed:rider.course.pumpSpeed,charge:0});
  rider.y=sewerWaterHeight(rider.x,rider.distance,0,trackId);
  return {rider,branch,events};
}
const inputFor=rider=>({pump:true,left:rider.x>rider.course.secretPassages[0].entryX+.18,right:rider.x<rider.course.secretPassages[0].entryX-.18});

test('each sewer has an unmarked physically shorter passage between consecutive mandatory rings',()=>{
  for(const track of SEWER_TRACKS){
    const course=createSewerCourse(track.id),[branch]=course.secretPassages;
    assert.equal(course.shortcuts.length,3,'existing signed bypasses stay available');
    assert.equal(sewerBranches(course).length,4);assert.equal(branch.secret,true);
    assert.ok(!course.checkpoints.some(gate=>gate.distance>branch.start&&gate.distance<branch.end));
    const next=course.checkpoints.find(gate=>gate.distance>branch.end);assert.ok(next.distance-branch.end>=25,'room to steer back to the mandatory ring');
    let main=0,secret=0;
    for(let d=branch.start;d<branch.end;d+=.25){main+=sewerPathScale(d,track.id,null,branch.entryX)*.25;secret+=sewerPathScale(d,track.id,branch,branch.entryX)*.25;}
    assert.ok(secret<main*.85,'at least 15% less real travel around the bend');
    for(const d of [branch.start,branch.end]){
      for(const lane of [branch.entryX-1.4,branch.entryX,branch.entryX+1.4]){
        const a=sewerPoint(d-.0001,lane,0,track.id,branch),b=sewerPoint(d+.0001,lane,0,track.id,branch);
        assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.002);assert.ok(Math.abs(a.heading-b.heading)<.001);
        assert.ok(Math.abs(sewerWaterHeight(lane,d-.0001,0,track.id,branch)-sewerWaterHeight(lane,d+.0001,0,track.id,branch))<.001);
      }
    }
  }
});

test('walking into or merely jumping alongside the hidden wall cannot enter or phase through it',()=>{
  for(const track of SEWER_TRACKS)for(const approach of ['grounded','too-low','not-into-wall','recovering']){
    const {rider,branch,events}=fixture(track.id);
    if(approach!=='grounded'){rider.airborne=true;rider.airtime=.3;rider.y+=approach==='too-low'?.1:1.4;rider.vy=0;}
    if(approach==='recovering')rider.bailTime=.7;
    rider.update(1/120,{pump:true,left:approach!=='not-into-wall'});
    assert.equal(rider.activeShortcut,null,approach);assert.equal(rider.shortcutsTaken,0);
    if(approach!=='recovering')assert.ok(rider.distance<branch.start,'infill blocks the failed approach');
    assert.ok(!events.some(event=>event.type==='sewerShortcut'));
  }
});

test('an ordinary uncharged jump aimed into each cracked wall enters and drives through the full hidden tunnel',()=>{
  for(const track of SEWER_TRACKS)for(const hz of [30,60,144]){
    const {rider,branch,events}=fixture(track.id);
    // Forty centimetres of airtime is reached while covering roughly six
    // progress metres. Start eight progress metres out with an ordinary pop.
    rider.distance=branch.start-8;rider.x=branch.entryX;rider.y=sewerWaterHeight(rider.x,rider.distance,0,track.id);
    assert.equal(rider.jump(),true);let entered=false,lastPoint=sewerPoint(rider.distance,rider.x,rider.y,track.id),maxStep=0;
    for(let i=0;i<hz*20&&rider.distance<branch.end+2;i++){
      const input=rider.distance<branch.start?{pump:true,left:true}:inputFor(rider);
      // Approach the wall from its inner edge so steering still points into it
      // when the board reaches the cracked panel.
      if(i===0)rider.x=branch.entryX+1.15;
      rider.update(1/hz,input);if(rider.activeShortcut===branch.id)entered=true;
      const point=sewerPoint(rider.distance,rider.x,rider.y,track.id,rider.activeShortcut);maxStep=Math.max(maxStep,Math.hypot(point.x-lastPoint.x,point.z-lastPoint.z));lastPoint=point;
    }
    assert.ok(entered,`${track.id} ${hz}Hz entrance is reachable with ordinary jump controls`);
    assert.ok(rider.distance>branch.end);assert.equal(rider.activeShortcut,null);assert.equal(rider.wipeouts,0);assert.equal(rider.shortcutsTaken,1);
    assert.ok(maxStep<2.4,'no forward teleport at either seam');
    assert.equal(events.filter(event=>event.type==='sewerShortcut'&&event.secret).length,1);
  }
});

test('the secret rejoins before the next gate and cannot grant or skip a checkpoint',()=>{
  for(const track of SEWER_TRACKS){
    const game=new SewerRaceGame(()=>{},{trackId:track.id});game.start();game.countdownRemaining=0;
    const branch=game.course.secretPassages[0],next=game.course.checkpoints.findIndex(gate=>gate.distance>branch.end);
    Object.assign(game,{distance:branch.end-.01,x:branch.entryX,y:0,speed:31,activeShortcut:branch.id,nextCheckpoint:next,airborne:false});
    game.y=sewerWaterHeight(game.x,game.distance,0,track.id,branch);game.update(1/120,{pump:true});
    assert.equal(game.activeShortcut,null);assert.equal(game.nextCheckpoint,next,'the exit does not award a gate');
    const gate=game.course.checkpoints[next];game.distance=gate.distance-.01;game.x=gate.x;game.y=sewerWaterHeight(gate.x,game.distance,game.elapsed,track.id);game.update(1/120,{pump:true});
    assert.equal(game.nextCheckpoint,next+1,'next ring still requires a real crossing');
  }
});

test('secret tunnels have continuous enclosed shells, opaque beds and water along their rideable width',()=>{
  const world=createSewerWorld();
  for(const track of SEWER_TRACKS){
    const {rider,branch}=fixture(track.id);world.update(rider,0);world.group.updateMatrixWorld(true);
    const shell=[world.group.getObjectByName('sewer-main-pipe'),...sewerBranches(rider.course).map(path=>world.group.getObjectByName(`shortcut-pipe-${path.id}`))];
    const bed=world.group.getObjectByName(`sewer-channel-bed-${branch.id}`);assert.ok(bed);
    for(const fraction of [.04,.2,.5,.8,.96]){
      rider.distance=branch.start+(branch.end-branch.start)*fraction;rider.activeShortcut=branch.id;world.update(rider,0);world.group.updateMatrixWorld(true);
      for(const lane of [branch.entryX-2.8,branch.entryX,branch.entryX+2.8]){
        const point=sewerPoint(rider.distance,lane,.4,track.id,branch),origin=new THREE.Vector3(point.x,point.y,point.z);
        assert.ok(new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,20).intersectObjects(shell,false).length,'closed structural shell beneath route');
        assert.ok(new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,1).intersectObjects(world.waters,false).length,'connected water covers the rider lane');
      }
      const centre=sewerPoint(rider.distance,branch.entryX,3,track.id,branch),origin=new THREE.Vector3(centre.x,3,centre.z);
      assert.ok(new THREE.Raycaster(origin,new THREE.Vector3(0,1,0),0,30).intersectObjects(shell,false).length,'solid roof');
    }
    const panel=world.group.getObjectByName(`sewer-secret-wall-${branch.id}`);assert.ok(panel);
    rider.activeShortcut=null;rider.distance=branch.start-12;world.update(rider,0);assert.equal(panel.visible,true);
    rider.activeShortcut=branch.id;rider.distance=branch.start+.1;world.update(rider,0);assert.equal(panel.visible,false,'rider and follow camera pass through the false wall');
  }
  world.dispose();
});

test('follow camera stays inside the concealed pipe and its connected entrance/exit',()=>{
  for(const track of SEWER_TRACKS){
    const branch=createSewerCourse(track.id).secretPassages[0],state=createSewerCameraState();let last=null;
    for(let distance=branch.start-12;distance<=branch.end+12;distance+=.25){
      const shortcut=distance>=branch.start&&distance<branch.end?branch.id:null,point=sewerPoint(distance,branch.entryX,.8,track.id,shortcut);
      const camera=stepSewerCamera(state,{...point,trackId:track.id,shortcut,distance,lane:branch.entryX,phase:'running'},1/120);
      const section=sewerCameraSection(camera.position,distance,track.id,shortcut);
      assert.ok(Math.hypot(section.lane,section.height)<=section.profile.radius-.79,'lens and near plane remain inside the bore');
      if(last)assert.ok(camera.position.distanceTo(last)<2,'no camera snap at the passage mouth');last=camera.position.clone();
    }
  }
});

test('outer shortcut lanes converge smoothly before the exit instead of snapping sideways',()=>{
  for(const track of SEWER_TRACKS)for(const branch of sewerBranches(createSewerCourse(track.id))){
    const {rider}=fixture(track.id);rider.activeShortcut=branch.id;rider.distance=branch.end-47;rider.x=branch.entryX-branch.width*.49;rider.speed=31;
    rider.y=sewerWaterHeight(rider.x,rider.distance,0,track.id,branch);
    let previous=sewerPoint(rider.distance,rider.x,0,track.id,branch),crossed=false;
    for(let i=0;i<120*8&&!crossed;i++){
      const wasActive=rider.activeShortcut;rider.update(1/120,{pump:true,left:true});
      const point=sewerPoint(rider.distance,rider.x,0,track.id,rider.activeShortcut),metres=Math.hypot(point.x-previous.x,point.z-previous.z);
      assert.ok(metres<.31,`${branch.id}: lateral handoff moved ${metres}m in one frame`);previous=point;
      if(wasActive&&!rider.activeShortcut){crossed=true;assert.ok(rider.x>=-track.halfWidth);}
    }
    assert.ok(crossed,branch.id);
  }
});

test('the exposed edge of each hidden mouth is capped behind low and airborne chase views',()=>{
  for(const track of SEWER_TRACKS){
    const {rider,branch}=fixture(track.id),world=createSewerWorld();rider.distance=branch.end;world.update(rider,0);world.group.updateMatrixWorld(true);
    const solid=[];world.group.traverse(object=>{if(object.name==='sewer-main-pipe'||object.name.startsWith('shortcut-pipe-')||object.name.startsWith('sewer-channel-bed-'))solid.push(object);});
    for(const distance of [branch.end-4,branch.end+.25,branch.end+4])for(const height of [0,4.5]){
      const active=distance<branch.end?branch:null,y=sewerWaterHeight(branch.entryX,distance,0,track.id,active)+height,point=sewerPoint(distance,branch.entryX,y,track.id,active);
      const state=stepSewerCamera(createSewerCameraState(),{...point,distance,trackId:track.id,shortcut:active,lane:branch.entryX,settings:{camera:'wide',cameraHeight:3}},1/60);
      const camera=new THREE.PerspectiveCamera(state.fov,16/9,.1,350);camera.position.copy(state.position);camera.lookAt(state.look);camera.updateMatrixWorld(true);
      for(const x of [-.85,-.4,0,.4,.85])for(const y of [-.92,-.6,-.3]){
        const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),camera);ray.far=350;
        assert.ok(ray.intersectObjects(solid,false).length,`${track.id} open mouth at ${distance}m / jump ${height} / screen ${x},${y}`);
      }
    }
    world.dispose();
  }
});
