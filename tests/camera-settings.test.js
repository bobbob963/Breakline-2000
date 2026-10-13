import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEW_SETTINGS, normalizeViewSettings, viewCameraTarget, viewFieldOfView, viewRenderSize } from '../src/camera-settings.js';
import { createParkCameraState, stepParkCamera } from '../src/park-camera-rig.js';
import { PARK_RAMPS, PARK_PIPES, parkHeight, parkPointBlocked, pipeRideFrame } from '../src/park.js';
import { SurfWorld } from '../src/world.js';

test('saved view settings validate unexpected values and bound sliders',()=>{
  assert.deepEqual(normalizeViewSettings(null),DEFAULT_VIEW_SETTINGS);
  assert.deepEqual(normalizeViewSettings({quality:'ultra',camera:'constructor',cameraHeight:Infinity,cameraFov:NaN,cameraShake:'false'}),DEFAULT_VIEW_SETTINGS);
  assert.deepEqual(normalizeViewSettings({quality:'clean',camera:'close',cameraHeight:-10,cameraFov:100,cameraShake:false}),
    {quality:'clean',camera:'close',cameraHeight:-1,cameraFov:90,cameraShake:false});
});

test('classic defaults preserve every existing context lens and camera position',()=>{
  for (const base of [50,51.25,52.5,53,54]) assert.equal(viewFieldOfView(base,{}),base);
  const anchor=Object.freeze({x:3,y:4,z:-90}),target=Object.freeze({x:4,y:6.6,z:-85.3});
  for (const park of [false,true]) assert.deepEqual(viewCameraTarget({}, {anchor,target,park}),target);
  const changed={camera:'wide',cameraHeight:3,cameraFov:90};
  for(const context of [{active:false},{firstPerson:true}]) {
    assert.deepEqual(viewCameraTarget(changed,{anchor,target,...context}),target);
    assert.equal(viewFieldOfView(50,changed,context),50,'attract and first-person scenes keep their own framing');
  }
});

test('camera preset distance and height are rider-relative',()=>{
  const anchor={x:3,y:5,z:70},target={x:4,y:7.6,z:75};
  const close=viewCameraTarget({camera:'close'},{anchor,target});
  const wide=viewCameraTarget({camera:'wide',cameraHeight:1},{anchor,target});
  assert.ok(Math.hypot(close.x-anchor.x,close.z-anchor.z)<Math.hypot(target.x-anchor.x,target.z-anchor.z));
  assert.ok(Math.hypot(wide.x-anchor.x,wide.z-anchor.z)>Math.hypot(target.x-anchor.x,target.z-anchor.z));
  assert.ok(Math.abs(wide.y-9.2)<1e-10);
  assert.equal(viewFieldOfView(54,{cameraFov:74}),64);
  assert.equal(viewFieldOfView(50,{cameraFov:54}),40);
});

function assertSightline(anchor,target,focus) {
  for (const origin of [{x:anchor.x,y:anchor.y+1.3,z:anchor.z},focus]) {
    const count=Math.ceil(Math.hypot(target.x-origin.x,target.y-origin.y,target.z-origin.z)/.018);
    for (let i=0;i<=count;i++) {
      const t=i/count,x=origin.x+(target.x-origin.x)*t,y=origin.y+(target.y-origin.y)*t,z=origin.z+(target.z-origin.z)*t;
      assert.ok(y>=parkHeight(x,z)+.245,'settings camera ray intersects a ramp');
      assert.equal(parkPointBlocked(x,y,z,.08),false,'settings camera ray intersects a rail, pipe or column');
    }
  }
}

test('close and wide custom views remain collision-safe around Waterworks ramps',()=>{
  for(const ramp of PARK_RAMPS.filter(item=>item.zone)) {
    for(const [u,v] of [[0,-ramp.length*.4],[0,ramp.length/2+.6],[ramp.width/2+.5,0]]) {
      const c=Math.cos(ramp.rotation),s=Math.sin(ramp.rotation),x=ramp.x+c*u-s*v,z=ramp.z-s*u-c*v;
      const anchor={x,y:parkHeight(x,z),z};
      for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
        const frame=stepParkCamera(createParkCameraState(),{...anchor,heading},1/60);
        for(const camera of ['close','wide']) for(const cameraHeight of [-1,3]) {
          const target=viewCameraTarget({camera,cameraHeight},{anchor,target:frame.position,focus:frame.look,park:true});
          assertSightline(anchor,target,frame.look);
        }
      }
    }
  }
});

test('custom boom remains inside rusty pipes through full inversions',()=>{
  for(const pipe of PARK_PIPES) for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12) {
    const rider=pipeRideFrame(pipe,angle,0,1),up=rider.up;
    const frame=stepParkCamera(createParkCameraState(),{...rider,heading:pipe.rotation,rideUp:up},1/60);
    for(const camera of ['close','wide']) for(const cameraHeight of [-1,3]) {
      const target=viewCameraTarget({camera,cameraHeight},{anchor:rider,target:frame.position,focus:frame.look,park:true,rideUp:up});
      const head={x:rider.x+up.x*1.3,y:rider.y+up.y*1.3,z:rider.z+up.z*1.3};
      for(let i=0;i<=200;i++) {
        const t=i/200,x=head.x+(target.x-head.x)*t,y=head.y+(target.y-head.y)*t,z=head.z+(target.z-head.z)*t;
        assert.ok(y>=parkHeight(x,z)+.245);
        assert.equal(parkPointBlocked(x,y,z,.08),false,'custom camera crosses a pipe shell');
      }
    }
  }
});

test('graphics resolution preserves retro/race detail and supports bounded clean resolution',()=>{
  assert.deepEqual(viewRenderSize(1920,1080),{width:640,height:360});
  assert.deepEqual(viewRenderSize(1920,1080,{oceanRaceView:true}),{width:960,height:540});
  assert.deepEqual(viewRenderSize(1920,1080,{quality:'clean',pixelRatio:2}),{width:2880,height:1620});
  assert.deepEqual(viewRenderSize(500,300),{width:500,height:300});
});

test('world application and legacy quality toggle keep one deterministic settings state',()=>{
  let resized=0;
  const world={viewSettings:normalizeViewSettings(),retro:true,resize(){resized++;},applyViewSettings:SurfWorld.prototype.applyViewSettings};
  const updated=world.applyViewSettings({quality:'clean',camera:'wide',cameraHeight:2,cameraShake:false});
  assert.equal(world.retro,false);assert.equal(resized,1);
  updated.camera='close';assert.equal(world.viewSettings.camera,'wide','callers cannot mutate applied state');
  assert.equal(SurfWorld.prototype.toggleQuality.call(world),true);
  assert.equal(world.viewSettings.quality,'retro');assert.equal(world.viewSettings.camera,'wide');
  assert.equal(world.viewSettings.cameraShake,false);assert.equal(resized,2);
});
