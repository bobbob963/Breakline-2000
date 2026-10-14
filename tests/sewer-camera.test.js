import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSewerCourse, sewerPoint, sewerWaterHeight } from '../src/sewer-course.js';
import { createSewerCameraState, stepSewerCamera, sewerCameraSection } from '../src/sewer-camera-rig.js';
import { SurfWorld } from '../src/world.js';

const vector=point=>new THREE.Vector3(point.x,point.y,point.z);
function inputAt(trackId,distance,lane=0,shortcut=null,extra={}) {
  const y=sewerWaterHeight(lane,distance,0,trackId,shortcut)+.055;
  return {...sewerPoint(distance,lane,y,trackId,shortcut),lane,distance,trackId,shortcut,speed:31,motion:true,settings:{},...extra};
}

test('sewer camera initializes even in a paused zero-delta review and resets on a retry',()=>{
  const camera=createSewerCameraState(),input=inputAt('sewer-run',165,-8.2,createSewerCourse().shortcuts[0]);
  stepSewerCamera(camera,input,0);
  assert.ok(camera.position.distanceTo(vector(input))<10);
  assert.ok(camera.position.distanceTo(vector(input))>4);
  const retry=inputAt('sewer-depths',0);stepSewerCamera(camera,retry,0);
  assert.ok(camera.position.distanceTo(vector(retry))<10,'new course never flies across the world from the previous track');
});

test('camera clearance holds around both tracks and side pipes with wide/high settings and airborne riders',()=>{
  for(const trackId of ['sewer-run','sewer-depths']) {
    const course=createSewerCourse(trackId);
    for(const shortcut of [null,...course.shortcuts]) {
      const start=shortcut?.start??0,end=shortcut?.end??course.length,centre=shortcut?.entryX??0,width=shortcut?3:course.halfWidth-1;
      for(const side of [-1,0,1]) {
        const state=createSewerCameraState();
        for(let d=start;d<=end;d+=2.5) {
          const input=inputAt(trackId,d,centre+side*width,shortcut,{settings:{camera:'wide',cameraHeight:3},y:shortcut?5.7:7});
          stepSewerCamera(state,input,1/60);
          const bore=sewerCameraSection(state.position,d,trackId,shortcut);
          assert.ok(Math.hypot(bore.lane,bore.height)<=bore.profile.radius-.76,`${trackId} d=${d}: lens stays inside bore`);
          assert.ok(state.position.y>=.85,'camera does not dive under water');
          assert.ok([...state.position,...state.look].every(Number.isFinite));
        }
      }
    }
  }
});

test('boosted travel keeps a stable boom instead of adding speed-dependent world-space lag',()=>{
  const camera=createSewerCameraState();
  for(let frame=0;frame<1200;frame++) {
    const d=frame/120*55,input=inputAt('sewer-run',d,2,null,{speed:55,boosting:true});
    stepSewerCamera(camera,input,1/120);
    assert.ok(camera.position.distanceTo(vector(input))<9,'surfer remains in the foreground at surge speed');
    assert.equal(camera.up.y,1,'horizon does not roll or flip on bends');
  }
});

test('side-pipe entrance and exit do not cause camera cuts',()=>{
  for(const trackId of ['sewer-run','sewer-depths'])for(const branch of createSewerCourse(trackId).shortcuts) {
    for(const junction of [branch.start,branch.end]) {
      const state=createSewerCameraState();let previous=null;
      for(let i=-45;i<=45;i++) {
        const d=junction+i*.15,active=d>=branch.start&&d<=branch.end?branch:null;
        const input=inputAt(trackId,d,branch.entryX,active);
        stepSewerCamera(state,input,1/120);
        if(previous)assert.ok(state.position.distanceTo(previous)<.85,`${trackId}: smooth camera through ${junction}`);
        previous=state.position.clone();
      }
    }
  }
});

test('boost lens eases in and out while respecting a custom field of view',()=>{
  const state=createSewerCameraState(),input=inputAt('sewer-run',400,0,null,{settings:{cameraFov:74}});
  stepSewerCamera(state,input,0);assert.equal(state.fov,67);
  stepSewerCamera(state,{...input,boosting:true},1/60);
  assert.ok(state.fov>67&&state.fov<68);
  const boosted=state.fov;stepSewerCamera(state,{...input,boosting:false},1/60);
  assert.ok(state.fov<boosted&&state.fov>67);
});

test('actual world trick and hazard events preserve the continuous camera orbit',()=>{
  const state=createSewerCameraState();stepSewerCamera(state,inputAt('sewer-run',200),0);
  const world={sewerCamera:state,boardEffects:{trigger(){},reset(){}},spray(){}};
  const game={isSewer:true,mode:'sewer',trackId:'sewer-run',distance:200,x:0,y:0};
  for(const type of ['trick','raceBoost','land','barrelWarning','sewerShortcut','sewerPower']) {
    SurfWorld.prototype.onEvent.call(world,{type},game);
    assert.equal(world.sewerCamera,state,'events must not cut the camera back to a new state');
    assert.equal(world.sewerCamera.initialized,true);
  }
});
