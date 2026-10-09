import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveParkCamera } from '../src/park-camera.js';
import { PARK_BOUNDS, PARK_RAMPS, PARK_PIPES, parkHeight, pipeSurfaceHeight, parkPointBlocked } from '../src/park.js';

function assertClear(rider,camera,insidePipe=false) {
  assert.ok(camera.x>=PARK_BOUNDS.minX && camera.x<=PARK_BOUNDS.maxX);
  assert.ok(camera.z>=PARK_BOUNDS.minZ && camera.z<=PARK_BOUNDS.maxZ);
  assert.ok(camera.y>=rider.y+(insidePipe?1.3:2.6)-.000001);
  assert.ok(camera.y>=parkHeight(camera.x,camera.z)+1.5-.000001);
  // Independently use a finer ray sample than the production resolver.
  const steps=Math.max(1,Math.ceil(Math.hypot(camera.x-rider.x,camera.z-rider.z)/.015));
  for(let i=0;i<=steps;i++) {
    const t=i/steps,x=rider.x+(camera.x-rider.x)*t,z=rider.z+(camera.z-rider.z)*t;
    const y=rider.y+1.3+(camera.y-rider.y-1.3)*t;
    assert.ok(y>=parkHeight(x,z)+.245,`camera ray intersects solid at (${x},${y},${z})`);
    assert.ok(!parkPointBlocked(x,y,z,.08),`camera ray intersects a rail, column or pipe at (${x},${y},${z})`);
  }
}

function desiredAt(rider,angle) {
  const x=rider.x+Math.sin(angle+.26)*4.5,z=rider.z+Math.cos(angle+.26)*4.5;
  return {x,y:Math.max(rider.y+2.6,parkHeight(x,z)+1.5),z};
}

test('north spillway back cannot occlude the rider despite a clear camera endpoint',()=>{
  const ramp=PARK_RAMPS.find(item=>item.id==='north'),back=ramp.z-ramp.length/2;
  const rider={x:0,y:0,z:back-.7};
  const desired=desiredAt(rider,326*Math.PI/180);
  const resolved=resolveParkCamera(rider.x,rider.y,rider.z,desired);
  assert.ok(Math.hypot(resolved.x-rider.x,resolved.z-rider.z)<.75);
  assert.ok(resolved.z<back,'camera remains on the rider side of the spillway wall');
  assertClear(rider,resolved);
});

test('an unobstructed chase boom preserves the requested position without mutating it',()=>{
  const rider={x:0,y:0,z:70},desired=Object.freeze({x:2,y:3.4,z:76});
  const resolved=resolveParkCamera(rider.x,rider.y,rider.z,desired);
  assert.deepEqual(resolved,desired);
  assert.notEqual(resolved,desired);
  assertClear(rider,resolved);
});

test('all headings near every perimeter wall keep the camera inside the arena',()=>{
  const xMax=PARK_BOUNDS.maxX-.05,zMax=PARK_BOUNDS.maxZ-.05;
  const points=[[xMax,70],[-xMax,70],[80,zMax],[80,-zMax],[xMax,zMax],[-xMax,-zMax]];
  for(const [x,z] of points) for(let degrees=0;degrees<360;degrees+=10) {
    const rider={x,y:parkHeight(x,z),z};
    const camera=resolveParkCamera(x,rider.y,z,desiredAt(rider,degrees*Math.PI/180));
    assert.ok(camera.x>=PARK_BOUNDS.minX+.799 && camera.x<=PARK_BOUNDS.maxX-.799);
    assert.ok(camera.z>=PARK_BOUNDS.minZ+.799 && camera.z<=PARK_BOUNDS.maxZ-.799);
    assertClear(rider,camera);
  }
});

test('halfpipe approaches, lip reversals, sides and backs have clear views at every heading',()=>{
  for(const ramp of PARK_RAMPS.filter(item=>item.zone)) {
    for(const [u,v] of [[0,-ramp.length*.4],[0,0],[0,ramp.length*.44],[0,ramp.length/2+.6],[ramp.width/2+.5,0]]) {
      const c=Math.cos(ramp.rotation),s=Math.sin(ramp.rotation);
      const x=ramp.x+c*u-s*v,z=ramp.z-s*u-c*v;
      const rider={x,y:parkHeight(x,z),z};
      for(let degrees=0;degrees<360;degrees+=15) {
        const camera=resolveParkCamera(x,rider.y,z,desiredAt(rider,degrees*Math.PI/180));
        assertClear(rider,camera);
      }
    }
  }
});

test('high airborne and zero-boom views stay above the rider and respect desired height',()=>{
  const rider={x:0,y:18,z:-118};
  const desired={x:1.4,y:26,z:-112};
  assert.deepEqual(resolveParkCamera(rider.x,rider.y,rider.z,desired),desired);
  const above=resolveParkCamera(rider.x,rider.y,rider.z,{x:rider.x,y:-3,z:rider.z});
  assert.deepEqual(above,{x:0,y:20.6,z:-118});
  assertClear(rider,above);
});

test('inside both pipes the camera stays in the bore across turns and high jumps',()=>{
  for(const pipe of PARK_PIPES) for(const u of [-3,0,3]) {
    for(const y of [pipeSurfaceHeight(pipe,u),pipe.centerY+Math.sqrt((pipe.radius-pipe.thickness)**2-u*u)-2.3]) {
      const rider={x:pipe.x+u,y,z:pipe.z};
      for(let degrees=0;degrees<360;degrees+=15) {
        const camera=resolveParkCamera(rider.x,y,rider.z,desiredAt(rider,degrees*Math.PI/180));
        assertClear(rider,camera,true);
        assert.ok(Math.hypot(camera.x-pipe.x,camera.y-pipe.centerY)<pipe.radius-pipe.thickness);
      }
    }
  }
});
