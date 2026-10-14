import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SurfWorld } from '../src/world.js';
import { COAST_SCENERY_BEHIND, coastSceneryZ } from '../src/coast-scenery.js';
import { WEATHER_PRESETS, LEGACY_SURF_WEATHER } from '../src/surf-weather.js';

function makeCoast() {
  const world = Object.create(SurfWorld.prototype);
  world.scene = new THREE.Scene();
  world.createCoast();
  return world;
}

function positionScenery(world, distance) {
  for (const item of world.scenery) {
    item.mesh.position.z = coastSceneryZ(item.initialZ, distance, item.length);
  }
  world.scene.updateMatrixWorld(true);
}

test('the beach hut and nearby palms are already ahead at the start of a surf run', () => {
  const world = makeCoast();
  positionScenery(world, 0);
  assert.equal(world.hut.position.z, -125, 'the hut must not wrap 499m behind the starting rider');
  const nearPalms = world.scenery.filter(item => item.initialZ <= -96 && item.initialZ >= -288 && item.mesh.isGroup && item.mesh !== world.hut);
  assert.ok(nearPalms.length >= 8, 'the real beach includes a populated approach to the hut');
  for (const item of nearPalms) assert.equal(item.mesh.position.z, item.initialZ);
  assert.ok(world.scenery.some(item => item.mesh.position.x > 30 && item.mesh.position.z < -300), 'beach scenery continues beyond the clearest weather horizon');
});

test('every actual coast object stays fixed in world space until it has passed safely behind', () => {
  const world = makeCoast();
  for (const item of world.scenery) {
    const startZ = coastSceneryZ(item.initialZ, 0, item.length);
    const recycleDistance = COAST_SCENERY_BEHIND - startZ;
    for (const fraction of [0, .001, .1, .5, .9, .999, 1]) {
      assert.ok(coastSceneryZ(item.initialZ, recycleDistance * fraction, item.length) === startZ,
        `scenery at ${item.initialZ} must not drift or disappear while the rider approaches`);
    }
    assert.equal(coastSceneryZ(item.initialZ, recycleDistance + .01, item.length), startZ - item.length,
      'recycling moves one entire strip forward only after the rear boundary');
  }
});

test('recycled trees, rocks, islands and hut are wholly beyond every weather fog horizon', () => {
  const world = makeCoast();
  const farthestFog = Math.max(...Object.values(WEATHER_PRESETS).map(weather => weather.fogFar), LEGACY_SURF_WEATHER.fogFar);
  for (const item of world.scenery) {
    const startZ = coastSceneryZ(item.initialZ, 0, item.length);
    const recycleDistance = COAST_SCENERY_BEHIND - startZ;
    item.mesh.position.z = startZ;
    const before = new THREE.Box3().setFromObject(item.mesh, true);
    assert.ok(before.min.z + recycleDistance > 45, 'even the back edge of the largest object has passed behind the chase camera');
    const distance = recycleDistance + .01;
    item.mesh.position.z = coastSceneryZ(item.initialZ, distance, item.length);
    const after = new THREE.Box3().setFromObject(item.mesh, true);
    assert.ok(after.max.z + distance < -farthestFog,
      `the nearest vertex of scenery at ${item.initialZ} must remain hidden beyond the ${farthestFog}m fog range`);
  }
});

test('the existing coast pool stays bounded and reuses its geometry through long survival runs', () => {
  const world = makeCoast();
  const children = [...world.scene.children], objects = world.scenery.map(item => item.mesh);
  const geometry = [];
  world.scene.traverse(object => { if (object.geometry) geometry.push(object.geometry); });
  for (const distance of [0, .01, 90, 215, 534, 624, 720, 3000, 18000, 100000, 1000000, 10000000]) {
    positionScenery(world, distance);
    for (const item of world.scenery) {
      const relative = item.mesh.position.z + distance;
      assert.ok(relative <= COAST_SCENERY_BEHIND && relative > COAST_SCENERY_BEHIND - item.length,
        'the object stays within its forward scenery strip after any number of laps');
    }
  }
  assert.deepEqual(world.scene.children, children);
  assert.deepEqual(world.scenery.map(item => item.mesh), objects);
  const finalGeometry = [];
  world.scene.traverse(object => { if (object.geometry) finalGeometry.push(object.geometry); });
  assert.deepEqual(finalGeometry, geometry, 'earlier visibility does not allocate an ever-growing coast');
});
