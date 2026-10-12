import * as THREE from 'three';
import { createSurfer, disposeSurfer, validateProfile } from './appearance.js';
import { sampleRiderTrick } from './rider-pose.js';
import { renderedWaveHeight, alignRiderToOcean } from './ocean-surface.js';

// Rivals use the same body, painted clothing, deck and hand/foot IK as the
// player. Their transform always comes from the race simulation, never from
// camera-relative decoration or a fake distance offset.
export function rivalProfile(rival = {}, player = {}) {
  const staticRival = rival.id === 'static';
  const profile = validateProfile({
    character: rival.riderId || (staticRival ? 'nova' : 'reef'),
    outfit: rival.outfitId || (staticRival ? 'static' : 'neon'),
    boardColor: staticRival ? '#24c5ba' : '#e95b39',
    boardDesign: staticRival ? 'checker' : 'flames',
    ...rival.profile,
  });
  if (profile.boardColor === player.boardColor) profile.boardColor = '#f5ede0';
  return profile;
}

function label(text, accent = '#eab351', width = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#141e28'; context.fillRect(0, 0, width, 64);
  context.fillStyle = accent; context.fillRect(0, 0, width, 5); context.fillRect(0, 59, width, 5);
  context.font = 'italic 900 33px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#f2ead8'; context.fillText(text, width / 2, 34, width - 18);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.6, .9, 1);
  return sprite;
}

function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}

function disposeGroup(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
      materials.add(material); if (material.map) textures.add(material.map);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  group.clear();
}

function makeGate(checkpoint, finish = false) {
  const group = new THREE.Group(), radius = finish ? 16.5 : checkpoint.radius;
  const material = new THREE.MeshLambertMaterial({ color: finish ? 0xf5e7bd : 0xec9c37, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1d2f40, flatShading: true });
  const pylons = [];
  for (const side of [-1, 1]) {
    const pylon = new THREE.Group(); group.add(pylon); pylon.position.x = side * radius;
    addMesh(pylon, new THREE.CylinderGeometry(.24, .53, .85, 6), material, 0, .25);
    addMesh(pylon, new THREE.CylinderGeometry(.055, .055, 3.1, 5), dark, 0, 1.8);
    const flag = addMesh(pylon, new THREE.PlaneGeometry(.75, .85), material, -side * .36, 2.75);
    flag.material.side = THREE.DoubleSide;
    pylons.push(pylon);
  }
  const text = label(finish ? 'FINISH' : `${String(checkpoint.index + 1).padStart(2, '0')}  CHECKPOINT`);
  text.position.y = finish ? 7 : 4.5; text.scale.set(finish ? 9 : 5, finish ? 2.25 : 1.25, 1); group.add(text);
  if (finish) {
    const banner = addMesh(group, new THREE.BoxGeometry(radius * 2, .7, .09), dark, 0, 5.4);
    const checks = new THREE.MeshBasicMaterial({ color: 0xefe9d2 });
    for (let i = 0; i < radius * 2; i++) for (let row = 0; row < 2; row++) {
      if ((i + row) % 2 === 0) addMesh(group, new THREE.BoxGeometry(1, .35, .12), checks, -radius + i + .5, 5.225 + row * .35);
    }
    // Finish masts reach the banner; their base still follows each local wave.
    for (const pylon of pylons) addMesh(pylon, new THREE.CylinderGeometry(.065, .065, 5.5, 5), dark, 0, 2.65);
    banner.name = 'race-finish-banner';
  }
  return { group, pylons, text, material, checkpoint, finish, radius };
}

export function createRaceWorld(playerProfile) {
  const group = new THREE.Group(); group.name = 'surf-race'; group.visible = false;
  let player = playerProfile, race = null, surfer = null, name = null, shadow = null, wake = [], gates = [];

  function clear() {
    if (surfer) { group.remove(surfer.rig); disposeSurfer(surfer); }
    disposeGroup(group);
    surfer = null; name = null; shadow = null; wake = []; gates = []; race = null; group.visible = false;
  }

  function prepare(game) {
    clear(); race = game;
    surfer = createSurfer(rivalProfile(game.rival, player)); surfer.rig.name = 'race-opponent'; group.add(surfer.rig);
    name = label(game.rival?.name || 'RIVAL'); name.name = 'race-opponent-name'; name.scale.set(1.9,.475,1); group.add(name);
    shadow = addMesh(group, new THREE.CircleGeometry(.72, 12), new THREE.MeshBasicMaterial({ color: 0x153844, transparent: true, opacity: .32, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    const foam = new THREE.MeshBasicMaterial({ color: 0xeaeedc, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(.16, .65);
    for (let i = 0; i < 18; i++) {
      const spray = addMesh(group, geometry, foam); spray.rotation.x = -Math.PI / 2; wake.push(spray);
    }
    gates = [...game.course.checkpoints.map(checkpoint => makeGate(checkpoint)), makeGate({ index: game.course.checkpoints.length, distance: game.course.length, x: .5 }, true)];
    for (const gate of gates) group.add(gate.group);
  }

  function update(game, time, oceanZ = Math.floor(-game.distance / 30) * 30 - 90) {
    if (!game.isRace || game.mode !== 'surf' || game.phase === 'ready' || !game.opponent || !game.course) {
      if (race) clear();
      return;
    }
    if (race !== game) prepare(game);
    group.visible = true;
    const opponent = game.opponent, air = !!opponent.airborne, bail = opponent.bailTime > 0;
    const x = opponent.x, z = -opponent.distance;
    const surface = renderedWaveHeight(x, z, time, oceanZ);
    const y = alignRiderToOcean(x,opponent.y,z,time,oceanZ);
    const lean = -(opponent.vx || 0) * .024, cutback = opponent.cutback || 0, turn = (opponent.cutbackDirection || 1) * cutback;
    const pose = sampleRiderTrick(opponent, { air });
    surfer.rig.position.set(x, y + .055, z); surfer.rig.rotation.order = 'YXZ';
    surfer.rig.rotation.set(bail ? -.45 : (air ? -.09 : .045 + Math.sin(time * 3.3) * .035) - cutback * .1, -turn * 1.05, bail ? -1.8 : lean - turn * .48);
    surfer.yaw.rotation.y = pose.spin - (opponent.vx || 0) * .035;
    surfer.boardPivot.rotation.order = 'YXZ';
    surfer.boardPivot.rotation.set(pose.boardPitch, pose.boardSpin, pose.flip + pose.boardBank);
    surfer.boardPivot.position.set(pose.boardSide, (air ? .12 : 0) + pose.boardLift, pose.boardBack);
    surfer.pose({ charge: opponent.charge || 0, grab: pose.grab, air, time, lean, mode: 'surf', lipGrab: pose.lipGrab, tweak: pose.tweak, comboPose: pose.comboPose, cutback, cutbackDirection: opponent.cutbackDirection || 1 });
    surfer.rider.visible = !bail || Math.floor(time * 12) % 2 === 0;
    shadow.position.set(x, surface + .06, z); shadow.visible = !bail;
    shadow.scale.setScalar(air ? Math.max(.4, 1 - (y - surface) * .07) : 1);
    name.position.set(x, y + 2.85, z); name.visible = Math.abs(game.distance - opponent.distance) < 95;
    for (let i = 0; i < wake.length; i++) {
      const phase = ((time * 2.8 + i / wake.length) % 1), spread = phase * (cutback > .2 ? 2.7 : .72);
      const sx = x + (i % 2 ? 1 : -1) * spread, sz = z + .8 + phase * 4.5;
      wake[i].position.set(sx, renderedWaveHeight(sx, sz, time, oceanZ) + .08 + Math.sin(phase * Math.PI) * cutback * .65, sz);
      wake[i].scale.setScalar((1 - phase) * 1.4 + .2); wake[i].visible = !air && !bail && opponent.speed > 2;
    }
    for (const gate of gates) {
      const checkpoint = gate.checkpoint, ground = renderedWaveHeight(checkpoint.x, -checkpoint.distance, time, oceanZ);
      const ahead = checkpoint.distance - game.distance;
      gate.group.visible = ahead > -35 && ahead < 245;
      gate.group.position.set(checkpoint.x, ground, -checkpoint.distance);
      for (const pylon of gate.pylons) pylon.position.y = renderedWaveHeight(checkpoint.x + pylon.position.x, -checkpoint.distance, time, oceanZ) - ground;
      const next = checkpoint.index === game.nextCheckpoint;
      gate.material.color.set(gate.finish ? 0xf5e7bd : next ? 0xf3ad37 : checkpoint.index < game.nextCheckpoint ? 0x536f70 : 0xb9b99a);
      gate.text.material.opacity = gate.finish || next ? 1 : .60;
    }
  }
  return { group, update, reset: clear, setProfile(profile) { player = profile; clear(); }, dispose: clear };
}
