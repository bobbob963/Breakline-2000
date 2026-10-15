import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveParkGame, PARK_RAMPS, PARK_RAILS, PARK_COPINGS, PARK_BOUNDS, PARK_SPAWN, PARK_STARTS, PARK_PIPES, PARK_SOLIDS, parkHeight, parkTerrainHeight, parkRideSurface, pipeSurfaceHeight, parkSurface, rampHeight, parkLocal, parkPointBlocked, railSupports, railTopHeight } from '../src/park.js';

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

test('Waterworks builds a little more speed while retaining controlled braking', () => {
  const cruise=new WaveParkGame(),pumped=new WaveParkGame();
  cruise.start();pumped.start();
  advance(cruise,2);advance(pumped,2,{pump:true});
  assert.ok(cruise.speed>14.8&&cruise.speed<15,'cruise approaches 15m/s');
  assert.ok(pumped.speed>22.9&&pumped.speed<23.5,'pumping approaches 23.5m/s');
  assert.ok(pumped.z<cruise.z-10,'pumping visibly gains distance on the clear starting run');
  assert.equal(cruise.airborne,false);assert.equal(pumped.airborne,false);
  assert.equal(cruise.wipeouts+pumped.wipeouts,0);
  advance(pumped,.6,{brake:true});
  assert.ok(pumped.speed>3.5&&pumped.speed<6,'braking still settles the faster board promptly');
  assert.equal(pumped.wipeouts,0);
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
  assert.ok(parkLocal(ramp,game.x,game.z).v/ramp.length+.5>=.96,'takeoff reaches the lip');
  assert.ok(game.vz<0&&game.vz>-3,'the board initially rises with a short outward drift');
  assert.ok(Math.abs(game.heading)<.001,'launch does not instantly reverse the rider');
  const launchZ = game.z;
  advance(game, 0.5);
  assert.ok(game.vz>0,'the gradual air turn returns toward the bowl');
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

test('industrial park has connected terrain, pipe routes, ten freestanding rails and eight copings', () => {
  assert.ok((PARK_BOUNDS.maxX-PARK_BOUNDS.minX)*(PARK_BOUNDS.maxZ-PARK_BOUNDS.minZ) > 72*104*6);
  assert.equal(PARK_RAMPS.filter(ramp=>ramp.area!=='maintenance').length,18);
  assert.equal(PARK_RAILS.filter(rail=>rail.kind!=='coping'&&rail.area!=='maintenance').length,10);
  assert.equal(PARK_COPINGS.filter(rail=>rail.area!=='maintenance').length,8);
  assert.equal(PARK_RAILS.filter(rail=>rail.area!=='maintenance').length,18);
  assert.equal(PARK_PIPES.length,2);
  assert.equal(PARK_RAMPS.filter(ramp => ramp.zone === 'west-halfpipe').length,2);
  assert.equal(PARK_RAMPS.filter(ramp => ramp.zone === 'east-halfpipe').length,2);
  assert.equal(PARK_RAMPS.filter(ramp => ramp.type === 'bank').length,2);
  assert.equal(PARK_RAMPS.filter(ramp => ramp.type === 'access').length,2);
  for (const rail of PARK_RAILS) {
    for (let local = -rail.length/2; local <= rail.length/2; local += .25) {
      const x = rail.x-Math.sin(rail.rotation)*local, z = rail.z-Math.cos(rail.rotation)*local;
      assert.ok(railTopHeight(rail,local) > parkHeight(x,z)+.1, `${rail.id} is accessible above its supporting surface`);
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

function enterPipeLoop(pipe,direction=1) {
  const game=new WaveParkGame();game.start();
  const z=pipe.z+direction*(pipe.length/2-5);
  Object.assign(game,{x:pipe.x,z,y:pipeSurfaceHeight(pipe,0),heading:direction===1?0:Math.PI,vx:0,vz:-direction*8,speed:8});
  game.update(1/120,{action:true,brake:true});
  assert.equal(game.pipeRide?.pipe.id,pipe.id);
  return game;
}

function assertPipeBodyClear(game) {
  for(const distance of [.35,.85,1.35,1.9]) {
    const {x,y,z}=game.rideUp;
    assert.equal(parkPointBlocked(game.x+x*distance,game.y+y*distance,game.z+z*distance,.22),false,'rotated rider capsule must stay inside the bore');
  }
}

test('either steering direction completes full pipe loops in both tunnels and travel directions',()=>{
  for(const pipe of PARK_PIPES) for(const direction of [-1,1]) for(const steer of ['left','right']) {
    const game=enterPipeLoop(pipe,direction);
    for(let i=0;i<400&&game.pipeLoops<1;i++) {
      game.update(1/120,{action:true,brake:true,[steer]:true});
      assert.ok(game.pipeRide);
      assertPipeBodyClear(game);
      assert.equal(Math.sign(game.rideRoll),steer==='right'?1:-1,'steering remains relative to the direction the surfer faces');
      assert.equal(game.surface.wallRide,true);
      assert.ok(Math.abs(Math.hypot(game.rideUp.x,game.rideUp.y,game.rideUp.z)-1)<1e-9);
    }
    assert.equal(game.pipeLoops,1);
    assert.ok(game.comboNames.includes('FULL PIPE LOOP'));
    assert.equal(game.bank(),false,'inverted or attached points cannot be banked');
    for(let i=0;i<200&&game.pipeRide;i++){game.update(1/120,{brake:true});assertPipeBodyClear(game);}
    assert.equal(game.pipeRide,null);
    assert.equal(game.rideRoll,0);
    assert.deepEqual(game.rideUp,{x:0,y:1,z:0});
    assert.ok(game.bank());
    assert.ok(game.score>=2100);
    assert.equal(game.landedTricks,1);
  }
});

test('releasing or jumping at the pipe ceiling follows the wall back down before becoming upright',()=>{
  for(const jump of [false,true]) {
    const game=enterPipeLoop(PARK_PIPES[0]);
    advance(game,1.4,{action:true,brake:true,right:true});
    assert.ok(game.rideUp.y<-.99);
    if(jump)assert.equal(game.jump(),false);
    const beforeY=game.y;
    game.update(1/120,{brake:true,action:jump});
    assert.ok(game.pipeRide?.releasePending);
    assert.ok(Math.abs(game.y-beforeY)<.1,'release may not teleport from ceiling to floor');
    for(let i=0;i<200&&game.pipeRide;i++){game.update(1/120,{brake:true,action:jump});assertPipeBodyClear(game);}
    assert.equal(game.pipeRide,null);
    assert.equal(game.airborne,false);
    assert.ok(Math.abs(game.y-pipeSurfaceHeight(PARK_PIPES[0],0))<.0001);
    assert.equal(game.wipeouts,0);
  }
});

test('pipe end automatically returns an inverted rider to the floor before exiting',()=>{
  const pipe=PARK_PIPES[1],game=enterPipeLoop(pipe);
  advance(game,1.3,{action:true,brake:true,right:true});
  assert.ok(game.rideUp.y<-.9);
  game.pipeRide.local=pipe.length/2-3.05;
  game.applyPipeRide();
  for(let i=0;i<250&&game.pipeRide;i++) {
    game.update(1/120,{action:true,pump:true,right:true});
    assertPipeBodyClear(game);
    assert.ok(Math.abs(parkLocal(pipe,game.x,game.z).v)<=pipe.length/2-2.099);
  }
  assert.equal(game.pipeRide,null);
  assert.equal(game.rideRoll,0);
  advance(game,.8,{pump:true});
  assert.ok(game.z<pipe.z-pipe.length/2);
  assert.equal(game.wipeouts,0);
});

test('holding E through either mouth attaches once and releases only near the exit ahead',()=>{
  for(const pipe of PARK_PIPES)for(const direction of [-1,1]) {
    const events=[],game=new WaveParkGame(event=>events.push(event));
    game.start();events.length=0;
    const startZ=pipe.z+direction*(pipe.length/2+6);
    Object.assign(game,{x:pipe.x,z:startZ,y:parkHeight(pipe.x,startZ),heading:direction===1?0:Math.PI,vx:0,vz:-direction*12,speed:12});
    let firstAttach=null,firstRelease=null;
    for(let i=0;i<120*10&&!firstRelease;i++) {
      game.update(1/120,{action:true,pump:true});
      if(game.pipeRide&&firstAttach===null)firstAttach=game.elapsed;
      if(firstAttach!==null&&!game.pipeRide)firstRelease=game.elapsed;
      if(game.pipeRide) {
        assert.equal(game.pipeRide.releasePending,false,'the mouth behind the surfer cannot trigger release');
        assert.equal(events.filter(event=>event.type==='pipeStart').length,1);
      }
    }
    assert.ok(firstAttach!==null&&firstRelease!==null);
    assert.ok(firstRelease-firstAttach>3,'the controlled ride traverses the tunnel instead of releasing on entry');
    assert.ok(direction*parkLocal(pipe,game.x,game.z).v>pipe.length/2-3.2);
    advance(game,.6,{action:true,pump:true});
    assert.equal(events.filter(event=>event.type==='pipeStart').length,1);
    assert.equal(events.filter(event=>event.type==='pipeEnd').length,1);
    assert.deepEqual(game.comboNames,['PIPE WALL RIDE'],'held E cannot farm extra entry points');
    assert.equal(game.comboBase,200);
  }
});

function approachHalfpipe(input) {
  const game=new WaveParkGame();game.start('filters');
  for(let i=0;i<400&&!game.grinding&&!game.lipMove;i++) {
    game.update(1/120,{pump:true,...input});
    assert.equal(game.airborne,false,'lip actions must be reached directly from the ramp');
  }
  return game;
}

test('holding grind while riding up mounts coping directly and follows its rendered top',()=>{
  const game=approachHalfpipe({grind:true});
  assert.equal(game.grinding?.kind,'coping');
  assert.equal(game.grinding.rampId,'west-pipe-north');
  assert.equal(game.grindCount,1);
  for(let i=0;i<75;i++) {
    game.update(1/120,{grind:true});
    assert.ok(game.grinding);
    assert.ok(Math.abs(game.y-railTopHeight(game.grinding.rail,game.grinding.local))<1e-9);
    assert.equal(game.airborne,false);
  }
  assert.equal(game.bank(),false);
  assert.ok(game.comboNames.includes('COPING SLIDE'));
  game.update(1/120);
  assert.equal(game.grinding,null);
  assert.equal(game.airborne,true);
  assert.ok(game.vz>0,'releasing grind drops back into the halfpipe');
  for(let i=0;i<400&&game.airborne;i++)game.update(1/120,{brake:true});
  assert.equal(game.airborne,false);
  assert.equal(game.wipeouts,0);
  assert.ok(game.bank());
});

test('coping jump and automatic end transfer both aim into the ramp',()=>{
  for(const jump of [true,false]) {
    const game=approachHalfpipe({grind:true});
    if(jump)assert.ok(game.jump());
    else for(let i=0;i<400&&game.grinding;i++)game.update(1/120,{grind:true,pump:true});
    assert.equal(game.grinding,null);
    assert.equal(game.airborne,true);
    assert.ok(game.vz>0);
    assert.ok(Math.abs(Math.sin(game.heading))<1e-8);
  }
});

test('context action at the lip holds a board grab, turns 180, and rides back down',()=>{
  const game=approachHalfpipe({action:true});
  assert.ok(game.lipMove);
  const initialHeading=game.heading,startZ=game.z;
  assert.equal(game.jump(),false);
  assert.equal(game.bank(),false);
  advance(game,.375,{action:true});
  assert.ok(game.lipGrab>.99);
  assert.ok(game.heading>initialHeading+1.4&&game.heading<initialHeading+1.7);
  assert.ok(game.y>parkHeight(game.x,game.z)+.6);
  advance(game,.4,{action:true});
  assert.equal(game.lipMove,null);
  assert.equal(game.lipGrab,0);
  assert.ok(Math.abs(game.heading-initialHeading-Math.PI)<1e-8);
  assert.ok(game.comboNames.includes('LIP GRAB 180'));
  advance(game,.4,{pump:true});
  assert.ok(game.z>startZ);
  assert.equal(game.airborne,false);
  assert.equal(game.wipeouts,0);
  assert.ok(game.bank());
});

test('pause, timer and restart preserve or clear controlled pipe and lip states correctly',()=>{
  for(const mode of ['pipe','lip']) {
    const game=mode==='pipe'?enterPipeLoop(PARK_PIPES[0]):approachHalfpipe({action:true});
    advance(game,.2,{action:true,right:mode==='pipe'});
    const before=[game.x,game.y,game.z,game.heading,game.rideRoll,game.lipGrab,game.time];
    game.pause();advance(game,.2,{action:true,right:true});
    assert.equal(game.jump(),false);game.bail();
    assert.deepEqual([game.x,game.y,game.z,game.heading,game.rideRoll,game.lipGrab,game.time],before);
    game.resume();game.elapsed=119.999;game.update(1/120,{action:true});
    assert.equal(game.phase,'finished');assert.equal(game.comboBase,0);
    assert.equal(game.score,0);
    const finished=[game.x,game.y,game.z,game.rideRoll,game.lipGrab];
    assert.equal(game.jump(),false);game.bail();
    assert.deepEqual([game.x,game.y,game.z,game.rideRoll,game.lipGrab],finished);
    game.start();
    assert.equal(game.pipeRide,null);assert.equal(game.lipMove,null);assert.equal(game.pipeLoops,0);
    assert.equal(game.rideRoll,0);assert.equal(game.lipGrab,0);
  }
});

test('a forced wipeout clears pipe, lip or coping attachment and recovers on the reachable floor',()=>{
  for(const mode of ['pipe','lip','coping']) {
    const game=mode==='pipe'?enterPipeLoop(PARK_PIPES[0]):approachHalfpipe(mode==='lip'?{action:true}:{grind:true});
    advance(game,mode==='pipe'?1.4:.35,{action:true,grind:mode==='coping',brake:true,right:mode==='pipe'});
    game.bail('TEST WIPEOUT');
    assert.equal(game.pipeRide,null);assert.equal(game.lipMove,null);
    assert.equal(game.rideRoll,0);assert.equal(game.lipGrab,0);
    assert.equal(game.comboBase,0);assert.equal(game.wipeouts,1);
    advance(game,1.5,{brake:true});
    assert.equal(game.bailTime,0);assert.equal(game.airborne,false);
    assert.ok(Math.abs(game.y-parkRideSurface(game.x,game.z,game.y).height)<.0001);
    assertPipeBodyClear(game);
  }
});
