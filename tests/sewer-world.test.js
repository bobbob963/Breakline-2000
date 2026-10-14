import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSewerCourse, sewerPoint, sewerWaterHeight } from '../src/sewer-course.js';
import { createSewerWorld, poseSewerRider, sewerTrackStyle, SEWER_TUNNEL_RADIUS } from '../src/sewer-world.js';

function gameFixture(trackId='sewer-run') {
  return {isSewer:true,trackId,course:createSewerCourse(trackId),distance:0,elapsed:0,x:0,y:0,nextCheckpoint:0,phase:'running',hazardStates:new Map()};
}
function vectorClose(actual,expected) {
  assert.ok(actual.distanceTo(new THREE.Vector3(expected.x,expected.y,expected.z))<1e-5);
}

test('both sewer courses are enclosed full-size pipes with distinct palettes and connected bypass geometry',()=>{
  const renderer=createSewerWorld();
  for(const trackId of ['sewer-run','sewer-depths']){
    const game=gameFixture(trackId);renderer.update(game,0);
    const main=renderer.group.getObjectByName('sewer-main-pipe');
    assert.equal(main.userData.radius,SEWER_TUNNEL_RADIUS);
    assert.ok(main.geometry.attributes.position.count>2000);
    assert.ok(renderer.waters.length>game.course.shortcuts.length+1,'water is split into bounded update chunks');
    for(const shortcut of game.course.shortcuts){
      const pipe=renderer.group.getObjectByName(`shortcut-pipe-${shortcut.id}`);
      assert.ok(pipe,'every playable shortcut has a real pipe mesh');
      assert.equal(pipe.userData.start,shortcut.start);assert.equal(pipe.userData.end,shortcut.end);
      const streams=renderer.waters.filter(stream=>stream.userData.pathId===shortcut.id);
      assert.equal(streams[0].geometry.userData.samples[0].distance,shortcut.start);
      assert.equal(streams.at(-1).geometry.userData.samples.at(-1).distance,shortcut.end);
      for(let i=1;i<streams.length;i++)assert.equal(streams[i-1].userData.end,streams[i].userData.start,'water chunks join without a gap');
    }
    const style=renderer.style;assert.ok(new THREE.Color(style.water).g>new THREE.Color(style.water).r,'sewage stays green');
    renderer.group.traverse(object=>{if(object.geometry)assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));});
  }
  assert.notEqual(sewerTrackStyle('sewer-run').wall,sewerTrackStyle('sewer-depths').wall);
  assert.notEqual(sewerTrackStyle('sewer-run').light,sewerTrackStyle('sewer-depths').light);
  renderer.dispose();
});

test('sewer checkpoint apertures and branch hazards use the collision path and actual water surface',()=>{
  const renderer=createSewerWorld(),game=gameFixture('sewer-depths');renderer.update(game,7);
  for(const {group,checkpoint} of renderer.rings){
    const y=sewerWaterHeight(checkpoint.x,checkpoint.distance,7,game.trackId)+2;
    vectorClose(group.position,sewerPoint(checkpoint.distance,checkpoint.x,y,game.trackId));
    assert.equal(group.userData.radius,checkpoint.radius);
  }
  for(const {mesh,item} of renderer.hazards.filter(hazard=>hazard.item.path!=='main')){
    const height=sewerWaterHeight(item.x,item.distance,7,game.trackId,item.path);
    vectorClose(mesh.position,sewerPoint(item.distance,item.x,height,game.trackId,item.path));
  }
  game.distance=game.course.checkpoints[0].distance+10;game.nextCheckpoint=1;renderer.update(game,8);
  assert.equal(renderer.rings[0].group.visible,false);assert.equal(renderer.rings[1].rays.visible,true);
  renderer.dispose();
});

test('pressure wave spans its full hazard length and closes on the same deadline as the simulation',()=>{
  const renderer=createSewerWorld(),game=gameFixture();
  const hazard=game.course.hazards.find(item=>item.type==='barrel');
  game.distance=hazard.startDistance;game.hazardStates.set(hazard.id,{approachedAt:0,enteredAt:1,deadline:1+hazard.closeDuration,cleared:false});
  renderer.update(game,1);
  const visual=renderer.hazards.find(item=>item.item.id===hazard.id).mesh,geometry=visual.userData.roll.geometry;
  const count=geometry.attributes.position.count,objects=[...renderer.group.children];
  assert.equal(visual.userData.closure,0);assert.equal(visual.userData.crash.visible,false);
  renderer.update(game,1+hazard.closeDuration*.5);assert.ok(visual.userData.closure>.49&&visual.userData.closure<.51);
  renderer.update(game,1+hazard.closeDuration);assert.equal(visual.userData.closure,1);assert.equal(visual.userData.crash.visible,true);
  assert.equal(geometry.attributes.position.count,count);assert.deepEqual(renderer.group.children,objects,'animating pressure reuses the same scene objects');
  const samples=geometry.attributes.position;
  assert.ok(Math.abs(samples.getZ(0)-samples.getZ(samples.count-1))>15,'the wave is a long section of the water, not a detached hoop');
  renderer.dispose();
});

test('player and rival poses use identical curved or shortcut path transforms while keeping tricks animated',()=>{
  const surfer={rig:new THREE.Group(),yaw:new THREE.Group(),boardPivot:new THREE.Group(),rider:new THREE.Group(),pose(params){this.lastPose=params;}};
  const trackId='sewer-run',shortcut=createSewerCourse(trackId).shortcuts[0];
  for(const activeShortcut of [null,shortcut.id]){
    const rider={distance:(shortcut.start+shortcut.end)/2,x:shortcut.entryX,y:2.5,activeShortcut,airborne:true,rotation:Math.PI,vx:1.4,bailTime:0,cutback:0};
    const frame=poseSewerRider(surfer,rider,trackId,12);
    const expected=sewerPoint(rider.distance,rider.x,rider.y+.055,trackId,activeShortcut);
    vectorClose(surfer.rig.position,expected);assert.equal(surfer.rig.rotation.y,frame.heading);
    assert.ok(surfer.yaw.rotation.y>3);assert.equal(surfer.lastPose.air,true);
  }
});

test('hiding or disposing a sewer scene leaves no leftover tunnel or rival in other modes',()=>{
  const renderer=createSewerWorld(),game=gameFixture();renderer.update(game,0);assert.equal(renderer.group.visible,true);
  renderer.update({isSewer:false},0);assert.equal(renderer.group.visible,false);
  renderer.dispose();renderer.dispose();assert.equal(renderer.group.children.length,0);
});

test('canal water reaches the maintenance fascia instead of exposing a strip of map underneath',()=>{
  const renderer=createSewerWorld();
  for(const trackId of ['sewer-run','sewer-depths']){
    const game=gameFixture(trackId);
    for(const distance of [0,350,600]){
      game.distance=distance;renderer.update(game,2);renderer.group.updateMatrixWorld(true);
      for(const side of [-1,1]){
        const x=side*(game.course.halfWidth+.78),height=sewerWaterHeight(x,distance,2,trackId);
        const point=sewerPoint(distance,x,height,trackId),origin=new THREE.Vector3(point.x,point.y+.2,point.z);
        const hits=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,.5).intersectObjects(renderer.waters.filter(water=>water.visible),false);
        assert.ok(hits.length,`${trackId} has an uncovered canal edge at ${distance}m, side ${side}`);
      }
    }
  }
  renderer.dispose();
});

test('the former Deep Works junction floor holes are sealed by the pipe shell itself',()=>{
  const renderer=createSewerWorld(),game=gameFixture('sewer-depths');renderer.update(game,0);renderer.group.updateMatrixWorld(true);
  const branch=game.course.shortcuts[0],walls=[];
  renderer.group.traverse(object=>{if(object.name==='sewer-main-pipe'||object.name.startsWith('shortcut-pipe-'))walls.push(object);});
  for(const [distance,offset]of [[95.25,-3.08],[100.25,-2.28]]){
    const lane=branch.entryX+offset,height=sewerWaterHeight(lane,distance,0,game.trackId,branch);
    const point=sewerPoint(distance,lane,height+.1,game.trackId,branch);
    const hits=new THREE.Raycaster(new THREE.Vector3(point.x,point.y,point.z),new THREE.Vector3(0,-1,0),0,40).intersectObjects(walls,false);
    assert.ok(hits.length,`junction lower shell leaks at ${distance}m; an underwater bed must not disguise a missing wall`);
  }
  renderer.dispose();
});

test('course ends and whirlpool drains have an opaque structural bottom',()=>{
  const renderer=createSewerWorld();
  for(const trackId of ['sewer-run','sewer-depths']){
    const game=gameFixture(trackId);renderer.update(game,0);renderer.group.updateMatrixWorld(true);
    const shell=renderer.group.getObjectByName('sewer-main-pipe');
    for(const [from,to]of [[-35,-60],[game.course.length+65,game.course.length+100]]){
      const a=sewerPoint(from,0,7,trackId),b=sewerPoint(to,0,7,trackId),origin=new THREE.Vector3(a.x,a.y,a.z),direction=new THREE.Vector3(b.x-a.x,0,b.z-a.z).normalize();
      assert.ok(new THREE.Raycaster(origin,direction,0,60).intersectObject(shell,false).length,`${trackId} has an open distant tunnel end`);
    }
    for(const {mesh,item}of renderer.hazards.filter(hazard=>hazard.item.type==='whirlpool')){
      game.distance=item.distance;renderer.update(game,1);renderer.group.updateMatrixWorld(true);
      const path=item.path==='main'?null:item.path,point=sewerPoint(item.distance,item.x+.15,sewerWaterHeight(item.x,item.distance,1,trackId,path)+.2,trackId,path);
      const structural=[];renderer.group.traverse(object=>{if(object.isMesh&&(object.name.startsWith('sewer-channel-bed-')||object===shell||object.parent===mesh))structural.push(object);});
      const hits=new THREE.Raycaster(new THREE.Vector3(point.x,point.y,point.z),new THREE.Vector3(0,-1,0),0,8).intersectObjects(structural,false);
      assert.ok(hits.some(hit=>!hit.object.material.transparent),`${item.id} opens into empty background`);
    }
  }
  renderer.dispose();
});

test('sewer water stays a shallow liquid surface across the playable canal rather than rising into metre-high banks',()=>{
  for(const trackId of ['sewer-run','sewer-depths']){
    const course=createSewerCourse(trackId);
    for(let distance=0;distance<=course.length;distance+=23){
      const centre=sewerWaterHeight(0,distance,1.3,trackId);
      for(const side of [-1,1])assert.ok(Math.abs(sewerWaterHeight(side*course.halfWidth,distance,1.3,trackId)-centre)<.35,`${trackId} has a raised liquid ridge at ${distance}m`);
    }
  }
});
