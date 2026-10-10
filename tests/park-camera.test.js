import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveParkCamera } from '../src/park-camera.js';
import { createParkCameraState, stepParkCamera } from '../src/park-camera-rig.js';
import { PARK_BOUNDS, PARK_RAMPS, PARK_PIPES, WaveParkGame, parkHeight, pipeSurfaceHeight, pipeRideFrame, parkPointBlocked } from '../src/park.js';

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

test('loop camera and its head ray remain inside the pipe through every wall and ceiling angle',()=>{
  for(const pipe of PARK_PIPES)for(const dir of [-1,1])for(const local of [-pipe.length/2+2.1,0,pipe.length/2-2.1]) {
    for(let degrees=0;degrees<360;degrees+=10) {
      const rider=pipeRideFrame(pipe,degrees*Math.PI/180,local,dir),up=rider.up;
      const desired={x:rider.x+up.x*2.6+Math.sin(pipe.rotation)*dir*4.5,y:rider.y+up.y*2.6,z:rider.z+up.z*2.6+Math.cos(pipe.rotation)*dir*4.5};
      const camera=resolveParkCamera(rider.x,rider.y,rider.z,desired,up);
      const head={x:rider.x+up.x*1.3,y:rider.y+up.y*1.3,z:rider.z+up.z*1.3};
      for(let i=0;i<=400;i++) {
        const t=i/400,x=head.x+(camera.x-head.x)*t,y=head.y+(camera.y-head.y)*t,z=head.z+(camera.z-head.z)*t;
        assert.ok(y>=parkHeight(x,z)+.245);
        assert.equal(parkPointBlocked(x,y,z,.08),false,'inverted camera ray must not cross the shell');
      }
      assert.ok(Math.hypot(camera.x-pipe.x,camera.y-pipe.centerY)<pipe.radius-pipe.thickness);
    }
  }
});

function assertTemporalView(frame) {
  for(const point of[frame.position,frame.look,frame.up])assert.ok([point.x,point.y,point.z].every(Number.isFinite));
  assert.ok(frame.position.distanceTo(frame.look)>1.2,'camera reaches the subject');
  assert.ok(Math.abs(frame.up.dot(frame.forward))<1e-8,'view/up approaches a lookAt pole');
  assert.ok(Math.abs(frame.up.length()-1)<1e-8);
  const steps=Math.ceil(frame.position.distanceTo(frame.look)/.02);
  for(let i=0;i<=steps;i++) {
    const p=frame.look.clone().lerp(frame.position,i/steps);
    assert.ok(p.y>=parkHeight(p.x,p.z)+.245,'temporal camera looks through terrain');
    assert.equal(parkPointBlocked(p.x,p.y,p.z,.08),false,'temporal camera looks through pipe/rail/column');
  }
}

function exerciseSequence(path,dt=1/60) {
  const state=createParkCameraState();let previous=null,maxStep=0,maxTurn=0,maxUpTurn=0;
  path.forEach((input,index)=>{
    const frame=stepParkCamera(state,input,dt);
    if(previous&&!input.reset){
      maxStep=Math.max(maxStep,frame.offset.distanceTo(previous.offset));
      maxTurn=Math.max(maxTurn,Math.acos(Math.max(-1,Math.min(1,frame.forward.dot(previous.forward)))));
      maxUpTurn=Math.max(maxUpTurn,Math.acos(Math.max(-1,Math.min(1,frame.up.dot(previous.up)))));
    }
    // Independent fine ray sampling across the sequence, not just endpoints.
    if(index%4===0||index===path.length-1)assertTemporalView(frame);
    previous={offset:frame.offset.clone(),forward:frame.forward.clone(),up:frame.up.clone()};
  });
  return {state,maxStep,maxTurn,maxUpTurn};
}

test('subtle side framing reveals more board while pipe views stay centered',()=>{
  const rider={x:0,y:parkHeight(0,75),z:75,heading:0,speed:15};
  const side=stepParkCamera(createParkCameraState(),rider,1/60);
  assert.ok(Math.abs(Math.atan2(side.offset.x,side.offset.z)-.24)<1e-8);
  assert.ok(Math.abs(Math.hypot(side.offset.x,side.offset.z)-5)<1e-8,'follow distance stays unchanged');
  assertTemporalView(side);
  const pipe=PARK_PIPES[0],riding=pipeRideFrame(pipe,0,0,1);
  const centered=stepParkCamera(createParkCameraState(),{...riding,heading:pipe.rotation,rideUp:riding.up,speed:11},1/60);
  assert.ok(Math.abs(centered.offset.x)<1e-8,'pipe view has no side-angle bias');
  assert.equal(centered.fov,50);
  assertTemporalView(centered);
});

test('speed lens is restrained, smooth and consistent across frame rates',()=>{
  const outcomes=[];
  for(const hz of[30,60,120]) {
    const state=createParkCameraState(),rider={x:0,y:parkHeight(0,75),z:75,heading:0};
    stepParkCamera(state,{...rider,speed:3.5},1/hz);
    assert.equal(state.fov,50);
    let previous=state.fov;
    for(let i=0;i<hz;i++) {
      stepParkCamera(state,{...rider,speed:23.5},1/hz);
      assert.ok(state.fov>=previous&&state.fov<=53,'lens widens without overshoot');
      assert.ok(state.fov-previous<9/hz,'a speed change cannot snap the lens');
      previous=state.fov;
    }
    assert.ok(state.fov>52.8&&state.fov<53);
    outcomes.push(state.fov);
    stepParkCamera(state,{...rider,speed:500},1/hz);
    assert.ok(state.fov<=53,'extreme transient velocities cannot widen the lens further');
    for(let i=0;i<hz*2;i++)stepParkCamera(state,{...rider,speed:3.5},1/hz);
    assert.ok(state.fov>=50&&state.fov<50.01,'braking gently restores the normal lens');
    assertTemporalView(state);
  }
  assert.ok(Math.max(...outcomes)-Math.min(...outcomes)<1e-10);
});

test('instant ramp reversals and rail turns orbit smoothly at 30, 60 and 120 Hz',()=>{
  for(const hz of[30,60,120]){
    const path=Array.from({length:hz*4},(_,i)=>({x:0,y:parkHeight(0,75),z:75,heading:i<hz?0:i<hz*2?Math.PI:Math.PI/2}));
    const result=exerciseSequence(path,1/hz);
    assert.ok(result.maxStep<20/hz,'camera cuts across an instantaneous physics heading change');
    assert.ok(result.maxTurn<6/hz,'view direction snaps at a turn');
    assert.ok(result.maxUpTurn<6/hz,'view rolls abruptly at a turn');
    assert.ok(Math.abs(result.state.heading-Math.PI/2)<.02,'camera never catches the new heading');
  }
});

test('real halfpipe launches and coping transitions retain smooth rider-relative framing',()=>{
  for(const grind of[false,true]){
    const game=new WaveParkGame();game.start('filters');const path=[];let launched=false,caught=false;
    for(let i=0;i<360;i++){
      game.update(1/60,{pump:true,grind});launched ||= game.airborne;caught ||= !!game.grinding;
      path.push({x:game.x,y:game.y,z:game.z,heading:game.heading});
    }
    assert.ok(grind?caught:launched,'fixture must actually exercise the intended transition');
    const result=exerciseSequence(path);
    assert.ok(result.maxStep<.55,'camera jumps during a real halfpipe transition');
    assert.ok(result.maxTurn<.14,'aim lags behind a halfpipe transition');
  }
});

test('ramp backs and columns retract and release the boom without stepped snaps',()=>{
  for(const kind of['back','column']){
    const path=Array.from({length:360},(_,i)=>{
      const a=i/60*.8,x=kind==='back'?18+i/359*24:-98+4*Math.cos(a),z=kind==='back'?-174.7:-38+4*Math.sin(a);
      return {x,y:parkHeight(x,z),z,heading:kind==='back'?326*Math.PI/180:Math.atan2(Math.sin(a),-Math.cos(a))};
    });
    const result=exerciseSequence(path);
    assert.ok(result.maxStep<.24,'collision shortening or extension creates a visible camera pop');
    assert.ok(result.maxTurn<.065,'obstacle avoidance throws the aim away from the rider');
  }
});

test('two complete loops in both pipes keep a continuous horizon and clear moving view',()=>{
  for(const pipe of PARK_PIPES)for(const dir of[-1,1]){
    const path=Array.from({length:360},(_,i)=>{
      const rider=pipeRideFrame(pipe,i/359*Math.PI*4,-18+36*i/359,dir);
      return {...rider,heading:pipe.rotation+(dir<0?Math.PI:0),rideUp:rider.up};
    });
    const result=exerciseSequence(path);
    assert.ok(result.maxStep<.14,'camera teleports across a pipe loop');
    assert.ok(result.maxTurn<.03,'camera direction snaps near an inverted rider');
    assert.ok(result.maxUpTurn<.03,'camera horizon flips during a full loop');
  }
});

test('an inverted bail reseeds at the floor instead of sweeping through the pipe shell',()=>{
  const pipe=PARK_PIPES[0],state=createParkCameraState(),ceiling=pipeRideFrame(pipe,Math.PI,0,1),floor=pipeRideFrame(pipe,0,0,1);
  stepParkCamera(state,{...ceiling,heading:0,rideUp:ceiling.up},1/60);
  const frame=stepParkCamera(state,{...floor,heading:0,reset:true},1/60);
  assertTemporalView(frame);
  assert.ok(frame.position.y<pipe.centerY,'bail camera did not reset to the floor');
});
