import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SurfWorld } from '../src/world.js';
import { createParkCameraState } from '../src/park-camera-rig.js';
import { createSewerCameraState } from '../src/sewer-camera-rig.js';
import { normalizeViewSettings } from '../src/camera-settings.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function fixture(mode) {
  const world = Object.create(SurfWorld.prototype), observed = {effectsTime:0, environmentDt:0, sprays:0, renders:0};
  const rig = new THREE.Group(), rider = new THREE.Group(), head = new THREE.Group();
  rig.add(rider); rider.add(head); head.position.y = 1.5;
  Object.assign(world, {
    mode, time:0, oceanRaceView:mode === 'sewer', reducedMotion:false, viewSettings:normalizeViewSettings(),
    scene:new THREE.Scene(), keyLight:new THREE.DirectionalLight(), camera:new THREE.PerspectiveCamera(50, 1.6, .18, 750),
    lookAt:new THREE.Vector3(0, 2, 0), parkCamera:createParkCameraState(), sewerCamera:createSewerCameraState(),
    surfer:{rig, rider, head, yaw:new THREE.Group(), boardPivot:new THREE.Group(), pose:value => { observed.pose = value; }},
    stormBarrels:{update:(distance,time) => { observed.barrelTime = time; }},
    surfHazards:{maskCount:0, update:(_game,time) => { observed.hazardTime = time; }},
    waterMat:{uniforms:{uTime:{value:0},uWhirlpoolCount:{value:0}}},
    ocean:new THREE.Group(), coast:new THREE.Group(), sky:new THREE.Group(), rain:new THREE.Group(),
    surfBoost:new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial()),
    shadow:new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial()),
    raceWorld:{group:new THREE.Group(), update:(_game,time) => { observed.rivalTime = time; }},
    sewerWorld:{style:{pressure:false,fog:0x283524}, update:(_game,time,dt) => { observed.rivalTime = time; observed.environmentDt += dt; }},
    boardEffects:{update:(dt,_surfer,_camera,options) => { observed.effectOptions = options; if (!options.paused && !options.finished) observed.effectsTime += dt; }},
    parkUpdate:time => { observed.parkTime = time; }, updateWeather:(_game,time) => { observed.weatherTime = time; },
    parkFoam:[], birds:[], scenery:[], foam:[], course:[], sprayClock:0,
    particles:[{life:10,vy:0,vx:1,vz:0,mesh:new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial())}],
    spray:() => { observed.sprays++; }, cutbackSpray:() => { observed.sprays++; },
    resize() {}, captureLiveEye() {}, applyWastedView() {}, renderer:{render:() => { observed.renders++; }},
  });
  world.scene.background = new THREE.Color(); world.scene.fog = new THREE.Fog(0, 90, 265);
  world.camera.position.set(8, 7, 15); rig.userData.railBalance = .5;
  const game = {mode, isSewer:mode === 'sewer', trackId:'sewer-run', phase:'running', elapsed:0, playerElapsed:0,
    distance:70, x:-1, y:1, z:40, heading:0, steering:.2, vx:1, speed:20, charge:0,
    airborne:false, bailTime:0, grinding:false, rulesId:'surf', processed:new Set(),
    rules:{firstGate:70,spacing:64}};
  return {world, game, observed};
}

for (const mode of ['surf', 'park', 'sewer']) {
  test(`${mode}: the player's animation and camera retain normal pace while the surroundings slow`, () => {
    const ordinary = fixture(mode), slowed = fixture(mode), dt = 1 / 60;
    for (let frame = 0; frame < 120; frame++) {
      for (const [state, scale] of [[ordinary,1],[slowed,.4]]) {
        const {world,game} = state;
        game.elapsed += dt * scale; game.playerElapsed += dt;
        game.distance += .25; game.z -= .15; game.x = Math.sin(frame * .025);
        game.heading = Math.sin(frame * .01) * .4;
        world.update(dt * scale, game, dt);
      }
    }
    near(slowed.world.time, .8); near(slowed.observed.rivalTime, .8);
    near(slowed.observed.pose.time, 2); near(slowed.observed.effectsTime, 2);
    near(slowed.world.surfer.rig.userData.railBalance, ordinary.world.surfer.rig.userData.railBalance);
    near(slowed.world.camera.position.distanceTo(ordinary.world.camera.position), 0);
    near(slowed.world.lookAt.distanceTo(ordinary.world.lookAt), 0);
    assert.equal(slowed.observed.sprays, ordinary.observed.sprays, 'spray emission follows player movement');
    near(slowed.world.particles[0].life, 9.2); near(ordinary.world.particles[0].life, 8);
    if (mode === 'sewer') near(slowed.observed.environmentDt, .8);
    else {
      near(slowed.world.waterMat.uniforms.uTime.value, .8);
      near(slowed.observed.barrelTime, .8); near(slowed.observed.weatherTime, .8); near(slowed.observed.hazardTime, .8);
    }
  });

  test(`${mode}: local recovery flashes use the player clock and paused effects remain frozen`, () => {
    const {world,game,observed} = fixture(mode);
    Object.assign(game, {elapsed:.04, playerElapsed:.1, bailTime:1});
    world.update(.004, game, .01);
    assert.equal(world.surfer.rider.visible, false, 'the normal-speed recovery blink should already be in its off frame');
    near(observed.pose.time, .1);
    const environment = world.time, particles = world.particles[0].life, effects = observed.effectsTime;
    game.phase = 'paused'; world.update(.004, game, .01);
    near(world.time, environment); near(world.particles[0].life, particles); near(observed.effectsTime, effects);
    near(observed.pose.time, .1); assert.equal(observed.effectOptions.paused, true);
  });
}

test('existing two-argument render calls keep the same animation and camera behavior', () => {
  for (const mode of ['surf', 'park', 'sewer']) {
    const legacy = fixture(mode), explicit = fixture(mode);
    delete legacy.game.playerElapsed; delete explicit.game.playerElapsed;
    legacy.game.elapsed = explicit.game.elapsed = 1.25;
    legacy.world.update(.02, legacy.game); explicit.world.update(.02, explicit.game, .02);
    near(legacy.world.camera.position.distanceTo(explicit.world.camera.position), 0);
    near(legacy.observed.pose.time, 1.25); near(legacy.observed.effectsTime, .02);
  }
});
