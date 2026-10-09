import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveParkGame, PARK_RAMPS, PARK_RAILS, PARK_BOUNDS, PARK_SPAWN, PARK_STARTS, PARK_PIPES, PARK_SOLIDS, parkHeight, parkTerrainHeight, parkRideSurface, pipeSurfaceHeight, parkSurface, rampHeight, parkLocal, parkPointBlocked, railSupports } from '../src/park.js';

function advance(game, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 120); i++) game.update(1 / 120, input);
}

test('park reset, steering, pause and restart keep a finite two-minute arena', () => {
  const game = new WaveParkGame();
  game.start();
  assert.equal(game.mode, 'park');
  assert.equal(game.z, PARK_SPAWN.z);
  advance(game, 0.7, { left: true, pump: true });
  assert.ok(game.heading > 0 && game.x < 0 && game.z < PARK_SPAWN.z);
  assert.equal(game.distance, -game.z);
  game.pause();
  const before = [game.x, game.z, game.time];
  advance(game, 2);
  assert.deepEqual([game.x, game.z, game.time], before);
  game.resume(); advance(game, 0.5);
  assert.ok(game.time < before[2]);
  game.start();
  assert.equal(game.time, 120);
  assert.equal(game.heading, 0);
  assert.equal(game.score, 0);
  assert.equal(game.visitedRamps.size, 0);
});

test('renderable ramp profiles match the physical surface at every orientation', () => {
  for (const ramp of PARK_RAMPS) {
    for (const t of [0.2, 0.5, 0.8]) {
      const u = 0, v = (t - 0.5) * ramp.length;
      const x = ramp.x + Math.cos(ramp.rotation) * u - Math.sin(ramp.rotation) * v;
      const z = ramp.z - Math.sin(ramp.rotation) * u - Math.cos(ramp.rotation) * v;
      const expected=Math.max(parkTerrainHeight(x,z),(ramp.baseY??parkTerrainHeight(x,z))+rampHeight(ramp,u,v));
      assert.ok(Math.abs(parkHeight(x,z)-expected)<1e-8);
      const surface = parkSurface(x, z);
      if(expected>parkTerrainHeight(x,z)+.0001) assert.equal(surface.ramp.id,ramp.id);
      assert.ok(Number.isFinite(surface.dx) && Number.isFinite(surface.dz));
    }
  }
  assert.equal(parkHeight(115,150),0);
});

test('initial straight run launches over central spine and lands a trick', () => {
  const game = new WaveParkGame(); game.start();
  for (let i = 0; i < 500 && !game.airborne; i++) game.update(1 / 120, { pump: true });
  assert.ok(game.airborne);
  assert.equal(game.visitedRamps.has('spine'), true);
  assert.equal(game.doTrick('flip'), true);
  for (let i = 0; i < 500 && game.airborne; i++) game.update(1 / 120);
  assert.equal(game.airborne, false);
  assert.equal(game.wipeouts, 0);
  assert.equal(game.bank(), true);
  assert.ok(game.score > 1000);
  assert.equal(game.landedTricks, 1);
});

test('quarter-pipe lip launches and returns the rider into the park', () => {
  const game = new WaveParkGame(); game.start();
  const ramp = PARK_RAMPS.find(r => r.id === 'north');
  game.x = ramp.x; game.z = ramp.z + ramp.length / 2 - 1; game.y = parkHeight(game.x, game.z); game.surface = parkSurface(game.x, game.z);
  game.heading = 0; game.vx = 0; game.vz = -18; game.speed = 18;
  for (let i = 0; i < 300 && !game.airborne; i++) game.update(1 / 120, { pump: true });
  assert.equal(game.airborne, true);
  assert.equal(game.visitedRamps.has('north'), true);
  assert.ok(game.vz > 0);
  const launchZ = game.z;
  advance(game, 0.5);
  assert.ok(game.z > launchZ);
});

test('water rail catches an aligned landing and adds a bankable slide', () => {
  const game = new WaveParkGame(); game.start();
  const rail = PARK_RAILS[0];
  game.x = rail.x; game.z = rail.z + 6;
  game.heading = 0; game.vx = 0; game.vz = -12; game.speed = 12;
  game.y = rail.height + 0.15; game.vy = -1; game.airborne = true; game.airtime = 0.5;
  game.update(1 / 120);
  assert.ok(game.grinding);
  assert.equal(game.grindCount, 1);
  assert.equal(game.bank(), false);
  advance(game, 0.45);
  assert.ok(game.comboBase > 350);
  assert.equal(game.jump(), true);
  assert.equal(game.grinding, null);
  for(let i=0;i<600&&(game.airborne||game.grinding);i++)game.update(1/120);
  assert.equal(game.wipeouts, 0);
  assert.ok(game.bank());
  assert.ok(game.score > 900);
});

test('late tricks bail and recover without leaving the park', () => {
  const game = new WaveParkGame(); game.start();
  game.x = 30; game.z = 30; game.y = 0; game.heading = 0;
  game.jump();
  advance(game, 1);
  assert.equal(game.doTrick('flip'), true);
  advance(game, 0.4);
  assert.equal(game.wipeouts, 1);
  assert.equal(game.comboBase, 0);
  advance(game, 1.5);
  assert.equal(game.bailTime, 0);
});

test('arena borders rebound and full run terminates once without invalid coordinates', () => {
  const events = [];
  const game = new WaveParkGame(e => events.push(e)); game.start();
  game.x = PARK_BOUNDS.maxX - .1; game.z = 25; game.heading = -Math.PI / 2; game.vx = 22; game.vz = 0;
  advance(game, 0.1, { pump: true });
  assert.ok(game.vx < 0);
  for (let i = 0; i < 120 * 120; i++) {
    game.update(1 / 120, { pump: true, left: i % 600 > 410 });
    assert.ok(game.x >= PARK_BOUNDS.minX && game.x <= PARK_BOUNDS.maxX);
    assert.ok(game.z >= PARK_BOUNDS.minZ && game.z <= PARK_BOUNDS.maxZ);
    assert.ok(Number.isFinite(game.y) && Number.isFinite(game.heading));
    assert.ok(game.y >= parkHeight(game.x,game.z)-.0001, 'rider underside stays outside ramp solids');
  }
  assert.equal(game.phase, 'finished');
  assert.equal(events.filter(e => e.type === 'finish').length, 1);
});

test('same inputs at 30 and 120 Hz produce matching park trajectories and scores', () => {
  const slow = new WaveParkGame(), fast = new WaveParkGame(); slow.start(); fast.start();
  for (let i = 0; i < 600; i++) slow.update(1 / 30, { pump: true });
  advance(fast, 20, { pump: true });
  assert.ok(Math.abs(slow.x - fast.x) < 0.001 && Math.abs(slow.z - fast.z) < 0.001);
  assert.equal(slow.rampHits, fast.rampHits);
  assert.equal(slow.score, fast.score);
});

test('industrial park has connected terrain, separate halfpipes, pipe routes and ten rails', () => {
  assert.ok((PARK_BOUNDS.maxX-PARK_BOUNDS.minX)*(PARK_BOUNDS.maxZ-PARK_BOUNDS.minZ) > 72*104*6);
  assert.equal(PARK_RAMPS.length,18);
  assert.equal(PARK_RAILS.length,10);
  assert.equal(PARK_PIPES.length,2);
  assert.equal(PARK_RAMPS.filter(ramp => ramp.zone === 'west-halfpipe').length,2);
  assert.equal(PARK_RAMPS.filter(ramp => ramp.zone === 'east-halfpipe').length,2);
  assert.equal(PARK_RAMPS.filter(ramp => ramp.type === 'bank').length,2);
  assert.equal(PARK_RAMPS.filter(ramp => ramp.type === 'access').length,2);
  for (const rail of PARK_RAILS) {
    for (let local = -rail.length/2; local <= rail.length/2; local += .25) {
      const x = rail.x-Math.sin(rail.rotation)*local, z = rail.z-Math.cos(rail.rotation)*local;
      assert.ok(rail.height > parkHeight(x,z)+.1, `${rail.id} is accessible above its supporting surface`);
    }
  }
});

test('rising jump contacts a sloped ramp instead of clipping underneath until descent', () => {
  const game = new WaveParkGame(); game.start();
  const ramp=PARK_RAMPS.find(r=>r.id==='north');
  game.x = 0; game.z = ramp.z+3; game.y = parkHeight(game.x,game.z)+.035;
  game.airborne = true; game.airtime = .25; game.vy = .6;
  game.heading = 0; game.speed = 22; game.vx = 0; game.vz = -22;
  const initialY = game.y;
  game.update(.025,{pump:true});
  assert.equal(game.airborne,false);
  assert.equal(game.y,parkHeight(game.x,game.z));
  assert.ok(game.y > initialY && game.y < initialY+.5);
});

test('grounded rear entry into a quarter pipe blocks without teleporting up its solid back', () => {
  const game = new WaveParkGame(); game.start();
  const ramp=PARK_RAMPS.find(r=>r.id==='north'),back=ramp.z-ramp.length/2;
  game.x = 0; game.z = back-.2; game.y = parkHeight(game.x,game.z);
  game.heading = Math.PI; game.speed = 22; game.vx = 0; game.vz = 22;
  advance(game,.15,{pump:true});
  assert.ok(game.z < back);
  assert.ok(game.y < .01,'solid back must not snap rider nine metres upwards');
  assert.ok(game.vz < 0,'solid back turns the rider away');
});

test('airborne rising rear entry is swept against the vertical quarter-pipe back', () => {
  const game = new WaveParkGame(); game.start();
  const ramp=PARK_RAMPS.find(r=>r.id==='north'),back=ramp.z-ramp.length/2;
  game.x = 0; game.z = back-.2; game.y = 3;
  game.airborne = true; game.airtime = .2; game.vy = 4;
  game.heading = Math.PI; game.speed = 180; game.vx = 0; game.vz = 180;
  game.update(.025,{pump:true});
  assert.ok(game.z < back);
  assert.ok(game.y >= 3 && game.y < 3.3);
  assert.ok(game.vz < 0);
  assert.equal(game.airborne,true);
});

test('high-speed diagonal motion cannot cross a kicker from back to front in one update', () => {
  const game = new WaveParkGame(); game.start();
  const ramp = PARK_RAMPS.find(r => r.id === 'left-kicker');
  const c = Math.cos(ramp.rotation), s = Math.sin(ramp.rotation);
  const u = -2, v = ramp.length/2+.3;
  game.x=ramp.x+c*u-s*v; game.z=ramp.z-s*u-c*v; game.y=0;
  const du=140,dv=-460;
  game.vx=c*du-s*dv; game.vz=-s*du-c*dv;
  game.speed=Math.hypot(game.vx,game.vz); game.heading=Math.atan2(-game.vx,-game.vz);
  game.update(.05,{pump:true});
  const local=parkLocal(ramp,game.x,game.z);
  assert.ok(local.v > ramp.length/2,'sweep stops at the first solid intersection');
  assert.ok(game.y < .01,'diagonal contact cannot promote the rider onto the lip');
  assert.ok(game.vx*(-s)+game.vz*(-c) > 0,'motion reflects outward from the ramp back');
});

test('steep ramp sides block low riders while decks remain reachable from their approach', () => {
  const game = new WaveParkGame(); game.start();
  const deck = PARK_RAMPS.find(r => r.id === 'west-deck');
  game.x=deck.x+deck.width/2+.15; game.z=deck.z; game.y=0;
  game.heading=Math.PI/2; game.speed=22; game.vx=-22; game.vz=0;
  advance(game,.2,{pump:true});
  assert.ok(game.x > deck.x+deck.width/2-.2);
  assert.ok(game.y < .1);
  game.x=deck.x; game.z=deck.z+deck.length/2+1; game.y=0;
  game.heading=0; game.speed=14; game.vx=0; game.vz=-14;
  for(let i=0;i<300&&!game.visitedRamps.has(deck.id);i++)game.update(1/120,{pump:true});
  assert.ok(game.y > parkTerrainHeight(game.x,game.z)+deck.height-.01);
  assert.equal(game.visitedRamps.has(deck.id),true);
});

test('a halfpipe supports repeated transfers between both lips without penetration', () => {
  const game = new WaveParkGame(); game.start();
  const ramp=PARK_RAMPS.find(r=>r.id==='west-pipe-north');
  game.x=ramp.x; game.z=ramp.z+24; game.y=parkHeight(game.x,game.z); game.heading=0; game.vx=0; game.vz=-14;
  for(let i=0;i<120*14;i++) {
    game.update(1/120,{pump:true});
    assert.ok(game.y >= parkHeight(game.x,game.z)-.0001);
    assert.ok(Math.abs(game.x-ramp.x)<.01);
  }
  assert.ok(game.visitedRamps.has('west-pipe-north'));
  assert.ok(game.visitedRamps.has('west-pipe-south'));
  assert.ok(game.rampHits >= 3);
});

test('rail bodies stop grounded and very fast crossing riders instead of phasing through',()=>{
  const rail=PARK_RAILS[0];
  for(const speed of [22,450]) {
    const game=new WaveParkGame();game.start();
    game.x=rail.x-(speed>100?8:2);game.z=rail.z+3;game.y=parkHeight(game.x,game.z);
    game.heading=-Math.PI/2;game.speed=speed;game.vx=speed;game.vz=0;
    advance(game,speed>100?.05:.25,{pump:true});
    assert.ok(game.x<rail.x-.2,'rider remains on the approach side');
    assert.ok(game.vx<0,'solid rail reflects the rider');
    assert.equal(game.grindCount,0);
  }
});

test('rail supports block body entry while a safely elevated board clears the same rail',()=>{
  const rail=PARK_RAILS.find(item=>item.id==='south-crossing'),support=railSupports(rail)[2];
  const game=new WaveParkGame();game.start();
  game.x=support.x;game.z=support.z+2;game.y=parkHeight(game.x,game.z);
  game.heading=0;game.vx=0;game.vz=-22;game.speed=22;
  advance(game,.2,{pump:true});
  assert.ok(game.z>support.z+.2);
  const air=new WaveParkGame();air.start();
  Object.assign(air,{x:rail.x,z:rail.z+3,y:rail.height+3,heading:0,vx:0,vz:-160,speed:160,airborne:true,airtime:.5,vy:0});
  air.update(.05);
  assert.ok(air.z<rail.z-.5);
  assert.equal(air.grindCount,0);
});

test('a pipe crest can be caught, ridden, and popped off as a rail',()=>{
  const rail=PARK_RAILS.find(item=>item.pipeId);
  const game=new WaveParkGame();game.start();
  Object.assign(game,{x:rail.x,z:rail.z+6,y:rail.height+.16,heading:0,vx:0,vz:-14,speed:14,vy:-1,airborne:true,airtime:.5});
  game.update(1/120);
  assert.equal(game.grinding?.rail.id,rail.id);
  advance(game,.5);
  assert.equal(game.surface.pipeSide,'outside');
  assert.ok(game.comboBase>350);
  assert.equal(game.jump(),true);
  assert.equal(game.grinding,null);
  assert.equal(game.airborne,true);
});

test('both hollow pipes are traversable in either direction with twelve metres of clear runout',()=>{
  for(const pipe of PARK_PIPES) for(const direction of [-1,1]) {
    const game=new WaveParkGame();game.start();
    const startZ=pipe.z+direction*(pipe.length/2+6),endZ=pipe.z-direction*(pipe.length/2+12);
    Object.assign(game,{x:pipe.x,z:startZ,y:parkHeight(pipe.x,startZ),heading:direction===1?0:Math.PI,vx:0,vz:-direction*14,speed:14});
    let insideFrames=0;
    for(let i=0;i<120*8&&direction*(game.z-endZ)>0;i++) {
      game.update(1/120,{pump:true});
      assert.ok(Math.abs(game.x-pipe.x)<.01);
      assert.ok(game.vz*direction<0,'pipe route does not hit a hidden end cap');
      if(Math.abs(game.z-pipe.z)<pipe.length/2-1) {
        insideFrames++;
        assert.equal(game.surface.pipe?.id,pipe.id);
        assert.equal(game.surface.pipeSide,'inside');
        assert.ok(Math.abs(game.y-pipeSurfaceHeight(pipe,0))<.025);
      }
    }
    assert.ok(direction*(game.z-endZ)<=0);
    assert.ok(insideFrames>100);
    assert.equal(game.wipeouts,0);
  }
});

test('hollow pipe side walls stop high-speed exterior and interior crossings',()=>{
  const pipe=PARK_PIPES[0];
  const outside=new WaveParkGame();outside.start();
  Object.assign(outside,{x:pipe.x+pipe.radius+3,z:pipe.z+5,y:pipe.centerY-.8,heading:Math.PI/2,speed:350,vx:-350,vz:0,airborne:true,airtime:.5,vy:0});
  outside.update(.05);
  assert.ok(outside.x>pipe.x+pipe.radius);
  assert.ok(outside.vx>0);
  const inside=new WaveParkGame();inside.start();
  Object.assign(inside,{x:pipe.x,z:pipe.z+5,y:pipeSurfaceHeight(pipe,0),heading:-Math.PI/2,speed:300,vx:300,vz:0});
  inside.update(.05);
  assert.ok(inside.x<pipe.x+pipe.radius-pipe.thickness-.15);
  assert.ok(inside.vx<0);
});

test('pipe ceiling catches a rising rider without ejecting them through the shell',()=>{
  const pipe=PARK_PIPES[1],ceiling=pipe.centerY+pipe.radius-pipe.thickness;
  const game=new WaveParkGame();game.start();
  Object.assign(game,{x:pipe.x,z:pipe.z,y:ceiling-2.5,vx:0,vz:0,speed:0,airborne:true,airtime:.5,vy:20});
  game.update(.05,{brake:true});
  assert.ok(game.y+2.1<=ceiling+.02);
  assert.ok(game.vy<0);
  assert.ok(!parkPointBlocked(game.x,game.y+1.9,game.z,.2));
});

test('shared channels, bowl, pipe mouths and interior columns have matching physical surfaces',()=>{
  assert.ok(parkTerrainHeight(0,88)<-2);
  assert.ok(parkTerrainHeight(0,-125)<-3.5);
  assert.equal(parkTerrainHeight(115,145),0);
  for(const pipe of PARK_PIPES) {
    const edge=pipe.z+pipe.length/2;
    assert.ok(Math.abs(parkHeight(pipe.x,edge+.001)-pipeSurfaceHeight(pipe,0))<.001);
    const interior=parkRideSurface(pipe.x,pipe.z,pipeSurfaceHeight(pipe,0));
    assert.equal(interior.height,pipeSurfaceHeight(pipe,0));
    assert.ok(Number.isFinite(interior.dx)&&Number.isFinite(interior.dz));
    assert.ok(parkRideSurface(pipe.x,pipe.z,pipe.centerY+pipe.radius).height>interior.height+9);
  }
  const column=PARK_SOLIDS[0],game=new WaveParkGame();game.start();
  Object.assign(game,{x:column.x-3,z:column.z,y:0,heading:-Math.PI/2,speed:100,vx:100,vz:0});
  game.update(.05);
  assert.ok(game.x<column.x-column.radius);
  assert.ok(game.vx<0);
});

test('all four drop-in locations start on safe reachable surfaces and reset the run',()=>{
  const game=new WaveParkGame();
  for(const [id,start] of Object.entries(PARK_STARTS)) {
    game.start(id);
    assert.equal(game.x,start.x);assert.equal(game.z,start.z);assert.equal(game.heading,start.heading);
    assert.equal(game.y,parkHeight(start.x,start.z));assert.equal(game.time,120);assert.equal(game.score,0);
    for(const offset of [.35,.85,1.35,1.9]) assert.equal(parkPointBlocked(game.x,game.y+offset,game.z,.22),false);
    advance(game,.2,{pump:true});assert.ok(game.z<start.z);
    game.score=999;
  }
  game.start('__proto__');assert.equal(game.z,PARK_SPAWN.z);assert.equal(game.score,0);
});
