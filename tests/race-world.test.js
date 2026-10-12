import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRaceWorld, rivalProfile } from '../src/race-world.js';
import { SurfGame, waveHeight } from '../src/game.js';
import { OCEAN_MESH, renderedWaveHeight, alignRiderToOcean } from '../src/ocean-surface.js';

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

test('course markers match finite checkpoints and the actual finish distance', () => withWorld(world => {
  const game = raceState(); world.update(game, 2);
  const first = world.group.children.find(child => child.position.x === -4 && child.position.z === -150);
  assert.ok(first?.visible);
  assert.equal(first.position.y, renderedWaveHeight(-4, -150, 2,-90));
  const finish = world.group.getObjectByName('race-finish-banner').parent;
  assert.equal(finish.position.z, -960); assert.equal(finish.visible, false);
  game.distance = 800; world.update(game, 35);
  assert.equal(first.visible, false); assert.equal(finish.visible, true);
}));

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
  assert.deepEqual(profile, { character: 'jax', outfit: 'yardcrew', boardColor: '#f5ede0', boardDesign: 'tribal' });
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
