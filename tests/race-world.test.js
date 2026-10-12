import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRaceWorld, rivalProfile } from '../src/race-world.js';
import { SurfGame, waveHeight } from '../src/game.js';
import { OCEAN_MESH, renderedWaveHeight, alignRiderToOcean } from '../src/ocean-surface.js';
import { surfRaceRingY } from '../src/surf-race.js';
import { WaveParkGame } from '../src/park.js';
import { ParkMap } from '../src/park-map.js';

const canvasContext = new Proxy({}, {
  get: (_, key) => ['createLinearGradient', 'createRadialGradient'].includes(key) ? () => ({ addColorStop() {} }) : () => {},
  set: () => true,
});

function withWorld(run) {
  const saved = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => canvasContext }) };
  const world = createRaceWorld({ boardColor: '#f5d329' });
  try { run(world); } finally { world.dispose(); if (saved === undefined) delete globalThis.document; else globalThis.document = saved; }
}

function raceState() {
  const game = new SurfGame(), opponent = new SurfGame();
  game.start(); opponent.start();
  Object.assign(game, { isRace: true, opponent, rival: { id: 'rivet', name: 'RIVET' }, nextCheckpoint: 0,
    course: { length: 960, checkpoints: [{ index: 0, distance: 150, x: -4, radius: 5.7 }, { index: 1, distance: 330, x: 5, radius: 5.7 }] } });
  return game;
}

test('rival geometry follows actual simulation position and supports the existing grab pose', () => withWorld(world => {
  const game = raceState();
  Object.assign(game.opponent, { x: -5, distance: 170, y: 6, airborne: true, trick: { duration: .78, age: .4, grab: 1, tweak: 1 } });
  world.update(game, 5);
  const rider = world.group.getObjectByName('race-opponent');
  assert.deepEqual(rider.position.toArray(), [-5, 6.055, -170]);
  assert.equal(rider.userData.profile.character, 'reef');
  assert.ok(rider.getObjectsByProperty('isMesh', true).length > 20, 'Rival is a full body and surfboard');
  const name = world.group.getObjectByName('race-opponent-name');
  assert.equal(name.visible, false, 'Offscreen name is not a misleading camera-locked target');
  Object.assign(game.opponent, { x: 3, distance: 9, y: waveHeight(3,-9,6), airborne: false, trick: null });
  world.update(game, 6);
  assert.deepEqual(rider.position.toArray(), [3, renderedWaveHeight(3,-9,6,-90)+.055, -9]);
  assert.equal(name.visible, true);
  assert.ok(rider.matrixWorld.elements.every(Number.isFinite));
}));

test('hollow sun rings match the required checkpoint aperture and actual finish distance', () => withWorld(world => {
  const game = raceState(); world.update(game, 2);
  const first = world.group.children.find(child => child.position.x === -4 && child.position.z === -150);
  assert.ok(first?.visible);
  assert.equal(first.position.y, surfRaceRingY(game.course.checkpoints[0],2));
  const ring=first.getObjectByName('race-ring-aperture');
  assert.equal(ring.geometry.type,'TorusGeometry');
  assert.ok(Math.abs(ring.geometry.parameters.radius-ring.geometry.parameters.tube-5.7)<1e-9);
  assert.equal(first.getObjectByName('race-ring-sun-rays').children.length,12);
  world.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(-4,first.position.y,-140),new THREE.Vector3(0,0,-1));
  assert.equal(ray.intersectObject(ring).length,0,'The centre is a real open aperture, not a filled target');
  assert.equal(ring.material.color.getHex(),0xffd457);
  const finish = world.group.getObjectByName('race-finish-banner').parent;
  assert.equal(finish.position.z, -960); assert.equal(finish.visible, false);
  game.distance = 800; game.nextCheckpoint=2; world.update(game, 35);
  assert.equal(first.visible, false); assert.equal(finish.visible, true);
}));

test('rival boost feedback follows earned state and clears on expiry, bail and race finish', () => withWorld(world => {
  const game=raceState();Object.assign(game.opponent,{speed:24,distance:5});world.update(game,1);
  const trail=world.group.getObjectByName('race-opponent-boost-0'),name=world.group.getObjectByName('race-opponent-name'),action=world.group.getObjectByName('race-opponent-action');
  assert.equal(trail.visible,false);assert.equal(action.visible,false);
  Object.assign(game.opponent,{boostTime:2,boostDuration:2.6,boostLevel:'combo',boostLabel:'COMBO BOOST',boostSpeed:9});
  world.update(game,2);
  assert.equal(trail.visible,true);assert.equal(name.userData.text,'RIVET • BOOST');assert.equal(action.userData.text,'COMBO BOOST');
  assert.ok(trail.position.z> -game.opponent.distance,'The boost trail stays behind the actual rival');
  Object.assign(game.opponent,{airborne:true,trick:{name:'INDY GRAB',duration:.68,age:.3,grab:1}});world.update(game,2.1);
  assert.equal(action.userData.text,'INDY GRAB','A real held trick remains visible even during a previous earned burst');
  assert.equal(trail.visible,true);
  game.opponent.bailTime=1;world.update(game,2.2);assert.equal(trail.visible,false);assert.equal(action.visible,false);
  Object.assign(game.opponent,{bailTime:0,boostTime:0,trick:null});world.update(game,3);assert.equal(trail.visible,false);assert.equal(name.userData.text,'RIVET');
  game.opponent.boostTime=1;game.phase='finished';world.update(game,4);assert.equal(trail.visible,false);assert.equal(action.visible,false);
}));

test('factory rival uses its own physical position, heading, slope and pipe orientation', () => withWorld(world => {
  const game=new WaveParkGame(),opponent=new WaveParkGame();game.start();opponent.start();
  Object.assign(game,{isRace:true,opponent,rival:{id:'moxie',name:'MOXIE'},nextCheckpoint:0,
    course:{length:400,start:{x:0,z:88},checkpoints:[{index:0,x:28,z:50,y:4.2,radius:5.5,rotation:Math.PI/2,distance:120},{index:1,x:52,z:17,y:1,radius:3.8,rotation:0,distance:400,finish:true}]}});
  Object.assign(opponent,{x:31,y:4,z:55,heading:Math.PI/2,steering:0,surface:{height:4,dx:.25,dz:0}});
  world.update(game,2);
  const rider=world.group.getObjectByName('race-opponent'),gate=world.group.getObjectByName('race-sun-ring-0');
  assert.deepEqual(rider.position.toArray(),[31,4.055,55]);
  assert.equal(rider.rotation.y,Math.PI/2);
  assert.ok(Math.abs(rider.rotation.x+Math.atan(.25))<1e-9,'Slope pitch uses park terrain rather than wave pitch');
  assert.deepEqual(gate.position.toArray(),[28,4.2,50]);assert.equal(gate.rotation.y,Math.PI/2);
  assert.equal(world.group.getObjectByName('race-finish-banner'),undefined,'Last park ring is itself the finish');
  Object.assign(opponent,{pipeRide:{},rideUp:{x:1,y:0,z:0},rideRoll:Math.PI/2});world.update(game,3);
  assert.deepEqual(rider.position.toArray(),[31.055,4,55]);assert.equal(rider.rotation.z,Math.PI/2);
  game.nextCheckpoint=1;world.update(game,4);assert.equal(gate.visible,false);
  assert.equal(world.group.getObjectByName('race-sun-ring-1').getObjectByName('race-ring-aperture').material.color.getHex(),0xffd457);
}));

test('factory map shows route, ordered ring markers and the actual rival position',()=>{
  const saved=globalThis.document,calls=[];
  const recording=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
  globalThis.document={createElement:()=>({getContext:()=>canvasContext})};
  try{
    const map=new ParkMap({getContext:()=>recording});
    const game={isRace:true,x:0,z:88,heading:0,nextCheckpoint:1,opponent:{x:52,z:20,heading:Math.PI/2},course:{start:{x:0,z:88},checkpoints:[{index:0,x:0,z:40},{index:1,x:52,z:20}]}};
    map.update(game);
    const next=map.point(52,20);
    assert.ok(calls.some(call=>call[0]==='arc'&&call[1]===next.x&&call[2]===next.z&&call[3]===4));
    assert.ok(calls.some(call=>call[0]==='translate'&&call[1]===next.x&&call[2]===next.z));
    assert.ok(calls.some(call=>call[0]==='lineTo'&&call[1]===next.x&&call[2]===next.z));
    const repeated={...game,course:{...game.course,laps:2,checkpoints:[...game.course.checkpoints,...game.course.checkpoints.map(checkpoint=>({...checkpoint,index:checkpoint.index+2}))]}};
    for(const nextCheckpoint of [1,3]){
      calls.length=0;map.update({...repeated,nextCheckpoint});
      const rings=calls.filter(call=>call[0]==='arc');
      assert.equal(rings.length,3,'Two physical markers are drawn once plus the active highlight across both laps');
      assert.equal(rings.at(-1)[3],4,'Gold active marker is always drawn after every muted marker');
      assert.ok(calls.some(call=>call[0]==='fillText'&&call[1]===String(nextCheckpoint+1)),'Label follows the current lap checkpoint');
    }
    calls.length=0;map.update({...game,isRace:false});
    assert.equal(calls.filter(call=>call[0]==='arc').length,0,'Ordinary park mode has no race rings');
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});

test('switching modes and replacing profiles releases owned race resources before rebuilding', () => withWorld(world => {
  const game = raceState(); world.update(game, 0);
  const resources = new Set();
  world.group.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
      resources.add(material); if (material.map) resources.add(material.map);
    }
  });
  let disposed = 0; for (const resource of resources) resource.addEventListener('dispose', () => disposed++);
  world.update(new SurfGame(), 0);
  assert.equal(world.group.children.length, 0); assert.equal(world.group.visible, false);
  assert.equal(disposed, resources.size, 'Every owned geometry, material and texture is released once');
  world.update(game, 0);
  const firstRider = world.group.getObjectByName('race-opponent');
  world.setProfile({ boardColor: '#e95b39' }); world.update(game, 0);
  const replacement = world.group.getObjectByName('race-opponent');
  assert.notEqual(replacement, firstRider); assert.equal(replacement.userData.profile.boardColor, '#f5ede0');
  world.reset(); assert.equal(world.group.children.length, 0);
}));

test('declared rival profile is used while its board stays distinct from the player', () => {
  const profile = rivalProfile({ id: 'static', profile: { character: 'jax', outfit: 'yardcrew', boardColor: '#24c5ba', boardDesign: 'tribal' } }, { boardColor: '#24c5ba' });
  assert.deepEqual(profile, { character: 'jax', outfit: 'yardcrew', boardColor: '#f5ede0', boardDesign: 'tribal', rewardBoard: null });
});

test('grounded board alignment matches actual ocean triangles across both halves of their cells', () => {
  const {width,length,columns,rows}=OCEAN_MESH;
  const geometry = new THREE.PlaneGeometry(width,length,columns,rows); geometry.rotateX(-Math.PI/2);
  const material = new THREE.MeshBasicMaterial({side:THREE.DoubleSide}), mesh=new THREE.Mesh(geometry,material);
  const raycaster = new THREE.Raycaster();
  for (const [oceanZ,time] of [[-90,0],[-150,4.2],[-300,10.7]]) {
    mesh.position.z=oceanZ;
    const vertices=geometry.attributes.position;
    for(let i=0;i<vertices.count;i++)vertices.setY(i,waveHeight(vertices.getX(i),vertices.getZ(i)+oceanZ,time));
    geometry.computeBoundingSphere(); mesh.updateMatrixWorld(true);
    for(const [x,z] of [[-2.4,oceanZ+90],[-8.1,oceanZ+40.7],[3.2,oceanZ-12.8],[-13.7,oceanZ-19.1]]) {
      raycaster.set(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));
      const hit=raycaster.intersectObject(mesh)[0]; assert.ok(hit);
      assert.ok(Math.abs(renderedWaveHeight(x,z,time,oceanZ)-hit.point.y)<1e-6);
    }
  }
  geometry.dispose();material.dispose();
});

test('wave contact alignment eases through takeoff and leaves high airs unchanged', () => {
  for(const x of [-2.4,-8]) {
    const ground=waveHeight(x,0,0), rest=alignRiderToOcean(x,ground,0,0,-90);
    assert.equal(rest,renderedWaveHeight(x,0,0,-90));
    const takeoff=alignRiderToOcean(x,ground+.001,0,0,-90);
    assert.ok(Math.abs(takeoff-rest-.001)<.000002,'No sudden mesh correction jump at takeoff');
    assert.equal(alignRiderToOcean(x,ground+3,0,0,-90),ground+3);
  }
});
