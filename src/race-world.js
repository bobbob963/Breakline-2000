import * as THREE from 'three';
import { createSurfer, disposeSurfer, validateProfile } from './appearance.js';
import { sampleRiderTrick } from './rider-pose.js';
import { renderedWaveHeight, alignRiderToOcean } from './ocean-surface.js';
import { parkHeight, parkSurface } from './park.js';
import { surfRaceRingY } from './surf-race.js';

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
  function paint(value, colour) {
    context.fillStyle = '#141e28'; context.fillRect(0, 0, width, 64);
    context.fillStyle = colour; context.fillRect(0, 0, width, 5); context.fillRect(0, 59, width, 5);
    context.font = 'italic 900 33px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillStyle = '#f2ead8'; context.fillText(value, width / 2, 34, width - 18);
  }
  paint(text, accent);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.6, .9, 1);
  sprite.userData.setText = (value, colour = accent) => {
    if (sprite.userData.text === value && sprite.userData.accent === colour) return;
    sprite.userData.text = value; sprite.userData.accent = colour;
    paint(value, colour); texture.needsUpdate = true;
  };
  sprite.userData.text = text; sprite.userData.accent = accent;
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

function makeSunRing(checkpoint) {
  const group = new THREE.Group(), radius = checkpoint.radius, thickness = .18;
  group.name = `race-sun-ring-${checkpoint.index}`;
  group.userData = { checkpointIndex: checkpoint.index, innerRadius: radius };
  const material = new THREE.MeshBasicMaterial({color:0xffd457});
  const ring = addMesh(group, new THREE.TorusGeometry(radius + thickness, thickness, 6, 32), material);
  ring.name = 'race-ring-aperture';
  const glowMaterial = new THREE.MeshBasicMaterial({color:0xffb32c, transparent:true, opacity:.18, depthWrite:false});
  const glow = addMesh(group, new THREE.TorusGeometry(radius + thickness * 2.1, thickness * 1.05, 4, 32), glowMaterial);
  const rays = new THREE.Group(); rays.name = 'race-ring-sun-rays'; group.add(rays);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, root = radius + thickness * 2.9, tip = root + (i % 2 ? .50 : .82);
    const points = [
      Math.cos(angle - .045) * root, Math.sin(angle - .045) * root, 0,
      Math.cos(angle) * tip, Math.sin(angle) * tip, 0,
      Math.cos(angle + .045) * root, Math.sin(angle + .045) * root, 0,
    ];
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const ray = addMesh(rays, geometry, material); ray.material.side = THREE.DoubleSide;
  }
  const text = label(checkpoint.finish ? 'FINISH' : `${String(checkpoint.index + 1).padStart(2, '0')}  SUN RING`, '#ffc95c');
  text.position.y = radius + 1.6; text.scale.set(4.6, 1.15, 1); group.add(text);
  return {group, ring, rays, glow, text, material, checkpoint, finish:!!checkpoint.finish, radius, sunRing:true};
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
  const group = new THREE.Group(); group.name = 'hit-list-race'; group.visible = false;
  let player = playerProfile, race = null, surfer = null, name = null, action = null, shadow = null, wake = [], boostTrail = [], gates = [];

  function clear() {
    if (surfer) { group.remove(surfer.rig); disposeSurfer(surfer); }
    disposeGroup(group);
    surfer = null; name = null; action = null; shadow = null; wake = []; boostTrail = []; gates = []; race = null; group.visible = false;
  }

  function prepare(game) {
    clear(); race = game;
    surfer = createSurfer(rivalProfile(game.rival, player)); surfer.rig.name = 'race-opponent'; group.add(surfer.rig);
    name = label(game.rival?.name || 'RIVAL'); name.name = 'race-opponent-name'; name.scale.set(1.35,.3375,1); group.add(name);
    action = label('', '#ffc95c'); action.name = 'race-opponent-action'; action.scale.set(1.7,.34,1); group.add(action);
    shadow = addMesh(group, new THREE.CircleGeometry(.72, 12), new THREE.MeshBasicMaterial({ color: 0x153844, transparent: true, opacity: .32, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    const foam = new THREE.MeshBasicMaterial({ color: 0xeaeedc, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(.16, .65);
    for (let i = 0; i < 18; i++) {
      const spray = addMesh(group, geometry, foam); spray.rotation.x = -Math.PI / 2; wake.push(spray);
    }
    const streakGeometry = new THREE.PlaneGeometry(.095, 1.2);
    const streakMaterial = new THREE.MeshBasicMaterial({color:0xffcb55, transparent:true, opacity:.78, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending});
    for (let i = 0; i < 12; i++) {
      const streak = addMesh(group, streakGeometry, streakMaterial); streak.name = `race-opponent-boost-${i}`;
      streak.rotation.x = -Math.PI / 2; boostTrail.push(streak);
    }
    gates = game.course.checkpoints.map(makeSunRing);
    if (game.mode !== 'park') gates.push(makeGate({ index: game.course.checkpoints.length, distance: game.course.length, x: .5 }, true));
    for (const gate of gates) group.add(gate.group);
  }

  function update(game, time, oceanZ = Math.floor(-game.distance / 30) * 30 - 90) {
    if (!game.isRace || game.phase === 'ready' || !game.opponent || !game.course) {
      if (race) clear();
      return;
    }
    if (race !== game) prepare(game);
    group.visible = true;
    const park = game.mode === 'park', opponent = game.opponent, air = !!opponent.airborne, bail = opponent.bailTime > 0;
    const x = opponent.x, z = park ? opponent.z : -opponent.distance, heading = park ? opponent.heading || 0 : 0;
    const terrain = park ? opponent.surface || parkSurface(x,z) : null;
    const surface = park ? terrain.height : renderedWaveHeight(x, z, time, oceanZ);
    const y = park ? opponent.y : alignRiderToOcean(x,opponent.y,z,time,oceanZ);
    const lean = park ? -(opponent.steering || 0) * .16 : -(opponent.vx || 0) * .024;
    const cutback = opponent.cutback || 0, turn = (opponent.cutbackDirection || 1) * cutback;
    const boosting = opponent.boostTime > 0 && !bail && game.phase !== 'finished';
    const pose = sampleRiderTrick(opponent, { air });
    const rideUp = opponent.pipeRide ? opponent.rideUp : {x:0,y:1,z:0};
    surfer.rig.position.set(x + rideUp.x * .055, y + rideUp.y * .055, z + rideUp.z * .055); surfer.rig.rotation.order = 'YXZ';
    const slope = terrain ? Math.atan(terrain.dx * -Math.sin(heading) + terrain.dz * -Math.cos(heading)) : 0;
    const crossSlope = terrain ? Math.atan(terrain.dx * Math.cos(heading) - terrain.dz * Math.sin(heading)) : 0;
    const clampSlope = value => Math.max(-1.1, Math.min(1.1, value));
    let pitch = opponent.pipeRide ? 0 : bail ? -.45 : air ? -.09 : opponent.grinding ? 0 : park ? clampSlope(slope) : .045 + Math.sin(time * 3.3) * .035;
    let roll = opponent.pipeRide ? opponent.rideRoll : bail ? -1.8 : park && !air && !opponent.grinding ? clampSlope(crossSlope) + lean * .3 : lean;
    if (opponent.lipMove) { pitch *= 1 - pose.lipGrab; roll *= 1 - pose.lipGrab; }
    surfer.rig.rotation.set(pitch - cutback * .1, heading - (park ? 0 : turn * 1.05), roll - turn * (park ? .32 : .48));
    surfer.yaw.rotation.y = pose.spin - (park ? opponent.grinding ? Math.PI / 2 : 0 : (opponent.vx || 0) * .035);
    surfer.boardPivot.rotation.order = 'YXZ';
    surfer.boardPivot.rotation.set(pose.boardPitch, pose.boardSpin, pose.flip + pose.boardBank);
    surfer.boardPivot.position.set(pose.boardSide, (air ? .12 : 0) + pose.boardLift, pose.boardBack);
    surfer.pose({ charge: opponent.charge || 0, grab: pose.grab, air, time, lean, mode: game.mode, lipGrab: pose.lipGrab, tweak: pose.tweak, comboPose: pose.comboPose, cutback, cutbackDirection: opponent.cutbackDirection || 1 });
    surfer.rider.visible = !bail || Math.floor(time * 12) % 2 === 0;
    shadow.position.set(x, surface + .06, z); shadow.visible = !bail && !opponent.pipeRide;
    shadow.scale.setScalar(air ? Math.max(.4, 1 - (y - surface) * .07) : 1);
    name.position.set(x, y + 2.85, z); name.visible = park ? Math.hypot(game.x - x, game.z - z) < 95 : Math.abs(game.distance - opponent.distance) < 95;
    name.userData.setText(`${game.rival?.name || 'RIVAL'}${boosting ? ' • BOOST' : ''}`, boosting ? '#ffca50' : '#eab351');
    const actionText = opponent.trick?.name || (boosting ? opponent.boostLabel || 'TRICK BOOST' : '');
    action.userData.setText(actionText, boosting ? '#ffca50' : '#9cdbdf');
    action.position.set(x, y + 2.42, z); action.visible = name.visible && !!actionText && !bail && game.phase !== 'finished';
    action.material.opacity = boosting ? .84 + Math.sin(time * 17) * .16 : 1;
    for (let i = 0; i < wake.length; i++) {
      const phase = ((time * 2.8 + i / wake.length) % 1), spread = phase * (cutback > .2 ? 2.7 : .72);
      const behind = .8 + phase * 4.5, side = (i % 2 ? 1 : -1) * spread;
      const sx = x + Math.cos(heading) * side + Math.sin(heading) * behind;
      const sz = z - Math.sin(heading) * side + Math.cos(heading) * behind;
      const ground = park ? parkHeight(sx,sz) : renderedWaveHeight(sx, sz, time, oceanZ);
      wake[i].position.set(sx, ground + .08 + Math.sin(phase * Math.PI) * cutback * .65, sz);
      wake[i].rotation.z = -heading;
      wake[i].scale.setScalar((1 - phase) * 1.4 + .2); wake[i].visible = !air && !bail && !opponent.pipeRide && !opponent.grinding && opponent.speed > 2;
    }
    for (let i = 0; i < boostTrail.length; i++) {
      const streak = boostTrail[i], phase = (time * 3.7 + i / boostTrail.length) % 1;
      const side = (i % 2 ? 1 : -1) * (.34 + phase * .8), behind = .85 + phase * 6;
      const sx = x + Math.cos(heading) * side + Math.sin(heading) * behind;
      const sz = z - Math.sin(heading) * side + Math.cos(heading) * behind;
      const ground = park ? parkHeight(sx,sz) : renderedWaveHeight(sx,sz,time,oceanZ);
      streak.position.set(sx, air ? y + .1 : ground + .12, sz); streak.rotation.z = -heading;
      streak.scale.set(1 - phase * .5, .5 + phase * 1.7, 1);
      streak.visible = boosting && !opponent.pipeRide && opponent.speed > 2;
    }
    for (const gate of gates) {
      const checkpoint = gate.checkpoint, gz = park ? checkpoint.z : -checkpoint.distance;
      const ground = park ? parkHeight(checkpoint.x,gz) : renderedWaveHeight(checkpoint.x, gz, time, oceanZ);
      const ahead = checkpoint.distance - game.distance;
      const next = checkpoint.index === game.nextCheckpoint;
      gate.group.visible = gate.sunRing
        ? checkpoint.index >= game.nextCheckpoint && (next || (park ? checkpoint.index < game.nextCheckpoint + 3 : ahead < 245))
        : ahead > -35 && ahead < 245;
      gate.group.position.set(checkpoint.x, gate.sunRing ? park ? checkpoint.y : surfRaceRingY(checkpoint,time) : ground, gz);
      gate.group.rotation.y = park ? checkpoint.rotation || 0 : 0;
      for (const pylon of gate.pylons || []) pylon.position.y = renderedWaveHeight(checkpoint.x + pylon.position.x, gz, time, oceanZ) - ground;
      gate.material.color.set(next ? 0xffd457 : gate.sunRing ? 0x87968c : 0xf5e7bd);
      gate.text.material.opacity = next || !gate.sunRing ? 1 : .48;
      if (gate.sunRing) {
        gate.rays.rotation.z = time * .12;
        gate.glow.visible = next;
        gate.glow.material.opacity = .15 + Math.sin(time * 4) * .055;
      }
    }
  }
  return { group, update, reset: clear, setProfile(profile) { player = profile; clear(); }, dispose: clear };
}
