import test from 'node:test';
import assert from 'node:assert/strict';
import {WaveParkGame,PARK_BOUNDS,PARK_RAMPS,PARK_RAILS,parkHeight,parkRideSurface} from '../src/park.js';
import {PARK_MAINTENANCE,MAINTENANCE_RAMPS,MAINTENANCE_RAILS,maintenanceContains,crossesMaintenanceEntrance,sweepMaintenanceBounds} from '../src/park-maintenance.js';

const tick=(game,seconds,input={pump:true},hz=120)=>{for(let i=0;i<Math.round(seconds*hz);i++)game.update(1/hz,input);};
function approaching(events=[]) {
  const game=new WaveParkGame(event=>events.push(event));game.start();
  Object.assign(game,{x:112,z:-10,y:0,heading:-Math.PI/2,vx:18,vz:0,speed:18,charge:0});
  game.surface=parkRideSurface(game.x,game.z,game.y);return game;
}

test('the concealed east entrance opens only on an airborne crossing inside its opening',()=>{
  const from={x:119,y:1.6,z:-10},to={x:122,y:1.8,z:-10};
  assert.equal(crossesMaintenanceEntrance(from,to,true),true);
  assert.equal(crossesMaintenanceEntrance(from,to,false),false);
  assert.equal(crossesMaintenanceEntrance({...from,y:0},{...to,y:0},true),false);
  assert.equal(crossesMaintenanceEntrance({...from,z:0},{...to,z:0},true),false);
  assert.equal(crossesMaintenanceEntrance({...from,y:8},{...to,y:8},true),false);
  assert.equal(crossesMaintenanceEntrance(to,from,true),false);
});

test('a normal charged-free jump discovers a connected tunnel and enters the new bay without teleporting',()=>{
  const events=[],game=approaching(events);assert.equal(game.jump(),true);
  let biggestStep=0;
  for(let i=0;i<330;i++) {
    const x=game.x;game.update(1/120,{pump:true});biggestStep=Math.max(biggestStep,Math.abs(game.x-x));
    assert.ok(game.y>=parkHeight(game.x,game.z)-1e-8);
  }
  assert.equal(game.maintenanceAccess,true);assert.equal(game.maintenanceVisits,1);
  assert.ok(game.x>PARK_MAINTENANCE.bay.minX&&game.x<190);
  assert.ok(biggestStep<.21,'entry preserves ordinary movement, with no position jump');
  assert.equal(game.wipeouts,0);assert.equal(events.filter(e=>e.type==='secretFound').length,1);
});

test('grounded, misplaced and race jumps still collide with the main factory wall',()=>{
  for(const scenario of ['grounded','wrong-height','wrong-turn','race']) {
    const game=approaching();
    if(scenario==='wrong-turn')game.z=-25;
    if(scenario==='race')game.isRace=true;
    if(scenario!=='grounded')game.jump();
    if(scenario==='wrong-height'){game.y=10;game.vy=1;}
    tick(game,1);
    assert.equal(game.maintenanceAccess,false,scenario);assert.ok(game.x<=PARK_BOUNDS.maxX,scenario);
    assert.ok(game.vx<0,scenario);
  }
});

test('the tunnel supports a grounded return, clears access and re-arms the hidden wall',()=>{
  const events=[],game=approaching(events);game.jump();tick(game,2.75);
  Object.assign(game,{heading:Math.PI/2,vx:-22,vz:0,speed:22,airborne:false,vy:0,y:0});
  tick(game,2.8);
  assert.ok(game.x<119.3);assert.equal(game.maintenanceAccess,false);
  assert.equal(events.filter(e=>e.type==='maintenanceExit').length,1);assert.equal(game.wipeouts,0);
  Object.assign(game,{heading:-Math.PI/2,vx:22,vz:0,speed:22});tick(game,1.2);
  assert.ok(game.x<=120);assert.equal(game.maintenanceAccess,false);
  game.start();assert.equal(game.maintenanceVisits,0);assert.equal(game.maintenanceAccess,false);
});

test('passage collision sweeps concave corners, bay walls and tunnel sides instead of leaking outside',()=>{
  for(const [from,to] of [
    [{x:140,z:-10,y:1},{x:140,z:12,y:1}],
    [{x:150,z:-10,y:1},{x:180,z:35,y:1}],
    [{x:260,z:50,y:1},{x:275,z:50,y:1}],
    [{x:200,z:65,y:1},{x:200,z:80,y:1}],
  ]) {
    const hit=sweepMaintenanceBounds(from,to,PARK_BOUNDS);assert.ok(hit);
    assert.ok(maintenanceContains(hit.point.x,hit.point.z));assert.ok(hit.fraction<1);
    assert.ok(Math.hypot(hit.normal.x,hit.normal.z)>0);
  }
  assert.equal(sweepMaintenanceBounds({x:118,z:-10,y:2},{x:175,z:-10,y:0},PARK_BOUNDS),null);
});

test('maintenance ramps and rails use the same physical surface as the rest of Waterworks',()=>{
  assert.equal(MAINTENANCE_RAMPS.length,5);assert.equal(MAINTENANCE_RAILS.length,2);
  for(const ramp of MAINTENANCE_RAMPS) {
    assert.ok(PARK_RAMPS.includes(ramp));assert.ok(maintenanceContains(ramp.x,ramp.z));
    assert.ok(parkHeight(ramp.x,ramp.z)>0);
  }
  for(const rail of MAINTENANCE_RAILS)assert.ok(PARK_RAILS.some(item=>item.id===rail.id));
  for(let x=120;x<168;x+=.25)assert.equal(parkHeight(x,-10),0,'continuous level tunnel floor');
});

test('maintenance entry is stable at 30, 60 and 120 Hz and the ceiling remains solid',()=>{
  const states=[30,60,120].map(hz=>{const game=approaching();game.jump();tick(game,2.5,{},hz);return game;});
  for(const game of states){assert.equal(game.maintenanceAccess,true);assert.equal(game.wipeouts,0);}
  assert.ok(Math.abs(states[0].x-states[2].x)<.01);
  const game=states[2];Object.assign(game,{x:140,z:-10,y:11,airborne:true,vy:4,heading:-Math.PI/2,vx:15,vz:0});
  tick(game,1/120);assert.ok(game.y<=10);assert.ok(game.vy<0);
});
