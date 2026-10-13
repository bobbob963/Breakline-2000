import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWastedEyeAnchor, sampleWastedCamera } from '../src/wasted-camera.js';
import { SurfWorld } from '../src/world.js';

function worldFixture() {
  const world = Object.create(SurfWorld.prototype);
  world.camera = new THREE.PerspectiveCamera(52, 1.6, .18, 750);
  world.camera.position.set(12, 8, -15); world.camera.up.set(.1, 1, 0).normalize();
  world.lookAt = new THREE.Vector3(2, 1, -22); world.camera.lookAt(world.lookAt);
  const rig = new THREE.Group(), rider = new THREE.Group(), head = new THREE.Group();
  rig.add(rider); rider.add(head); head.position.set(0, 1.35, 0); rig.position.set(2, .7, -22);
  world.surfer = { rig, rider, head }; world.reducedMotion = false;
  return world;
}

test('a rider-eye cut looks down the surf course and holds before the eyelids begin to close', () => {
  const anchor = createWastedEyeAnchor({ eye: { x: 4, y: 2, z: -73 } });
  const first = sampleWastedCamera(anchor, { elapsed: 0 });
  assert.deepEqual(first.position.toArray(), [4, 2, -73]);
  assert.ok(first.look.z < first.position.z);
  assert.deepEqual(sampleWastedCamera(anchor, { elapsed: .5 }).position, first.position);
  const middle = sampleWastedCamera(anchor, { elapsed: 1 });
  const closed = sampleWastedCamera(anchor, { elapsed: 1.5 });
  assert.ok(middle.position.y < first.position.y && middle.position.y > closed.position.y);
  assert.ok(first.position.y - closed.position.y <= .261);
  assert.deepEqual(sampleWastedCamera(anchor, { elapsed: 10 }), closed);
  assert.equal(first.fov, closed.fov);
});

test('every park heading and vertical pipe orientation produces a finite normalized camera', () => {
  for (let heading = 0; heading <= Math.PI * 2; heading += .1) {
    for (const up of [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: -1, z: 0 }]) {
      const anchor = createWastedEyeAnchor({ forward: { x: -Math.sin(heading), y: 0, z: -Math.cos(heading) }, up });
      const frame = sampleWastedCamera(anchor, { elapsed: 1.25 });
      for (const vector of [frame.position, frame.look, frame.up]) assert.ok(vector.toArray().every(Number.isFinite));
      assert.ok(Math.abs(frame.up.length() - 1) < 1e-10);
      assert.ok(frame.look.distanceTo(frame.position) > 7);
    }
  }
  const fallback = createWastedEyeAnchor({ eye: { x: NaN, y: Infinity }, up: { x: 0, y: 0, z: 0 }, fov: NaN });
  assert.deepEqual(fallback.eye, [0, 1.5, 0]);
  assert.ok(sampleWastedCamera(fallback, { elapsed: NaN }).position.toArray().every(Number.isFinite));
});

test('reduced motion preserves a stationary eye view and lens throughout the entire sequence', () => {
  const anchor = createWastedEyeAnchor({ eye: { x: 2, y: 1.9, z: -70 }, fov: 54 });
  const options = { reducedMotion: true };
  assert.deepEqual(sampleWastedCamera(anchor, { elapsed: 3 }, options), sampleWastedCamera(anchor, { elapsed: 0 }, options));
});

test('the final camera uses the last healthy rendered eye and ignores the wipeout pose', () => {
  const world = worldFixture(), game = { phase: 'running', mode: 'surf', bailTime: 0 };
  world.captureLiveEye(game);
  const healthyEye = [...world.lastLiveEye.eye];
  world.surfer.rig.rotation.z = -1.8; world.surfer.head.position.y = .2;
  world.captureLiveEye({ ...game, bailTime: 1.5 });
  assert.deepEqual(world.lastLiveEye.eye, healthyEye);
  world.captureLiveEye({ ...game, phase: 'finished' });
  assert.equal(world.startWastedView({ ...game, phase: 'finished', x: 9, y: -2, distance: 300 }), true);
  assert.deepEqual(world.camera.position.toArray(), healthyEye);
  assert.equal(world.surfer.rig.visible, false);
  assert.equal(world.startWastedView(game), false, 'duplicate final events do not overwrite the chase-camera snapshot');
});

test('ending or cancelling restores the exact prior camera, lens, aim and player visibility', () => {
  const world = worldFixture(); world.surfer.rider.visible = false;
  const saved = { position: world.camera.position.clone(), quaternion: world.camera.quaternion.clone(),
    up: world.camera.up.clone(), look: world.lookAt.clone(), fov: world.camera.fov, near: world.camera.near };
  world.captureLiveEye({ phase: 'running', mode: 'surf' }); world.startWastedView();
  world.updateWastedView({ elapsed: 1.3, phase: 'eyes-closing' });
  world.camera.position.set(99, 99, 99); world.applyWastedView();
  assert.ok(world.camera.position.distanceTo(new THREE.Vector3(99, 99, 99)) > 50);
  world.endWastedView();
  assert.deepEqual(world.camera.position, saved.position); assert.deepEqual(world.camera.quaternion.toArray(), saved.quaternion.toArray());
  assert.deepEqual(world.camera.up, saved.up); assert.deepEqual(world.lookAt, saved.look);
  assert.equal(world.camera.fov, saved.fov); assert.equal(world.camera.near, saved.near);
  assert.equal(world.surfer.rig.visible, true); assert.equal(world.surfer.rider.visible, false);
  assert.equal(world.endWastedView(), false); assert.equal(world.wastedView, null);
});

test('normal bails never enter the presentation camera and mode changes reset any active view', () => {
  const world = worldFixture();
  world.boardEffects = { reset() {} }; world.raceWorld = { reset() {} };
  world.surfStage = {}; world.parkStage = {}; world.sky = {};
  world.scene = new THREE.Scene(); world.scene.background = new THREE.Color(); world.scene.fog = new THREE.Fog(0, 1, 2);
  world.ambientLight = new THREE.HemisphereLight(); world.keyLight = new THREE.DirectionalLight();
  world.shadow = { material: { color: new THREE.Color() } }; world.spray = () => {};
  world.captureLiveEye({ phase: 'running', mode: 'surf' });
  world.onEvent({ type: 'bail' }, { mode: 'surf', x: 0, y: 0, distance: 20 });
  assert.equal(world.wastedView, undefined); assert.equal(world.surfer.rig.visible, true);
  world.startWastedView(); world.setMode('park');
  assert.equal(world.wastedView, null); assert.equal(world.lastLiveEye, null); assert.equal(world.surfer.rig.visible, true);
});
