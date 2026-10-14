import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCharacter } from '../src/character-model.js';
import { createCharacter as createPreviousCharacter } from '../src/character-model-v9-reference.js';
import { CHARACTERS, OUTFITS } from '../src/appearance.js';

// A canvas stub permits actual geometry/IK measurements in Node. These checks
// cannot judge visual resemblance, textures or lighting; the comparison page
// and screenshots remain necessary for that part of the review.
const context = new Proxy({}, {
  get: (_, key) => ['createLinearGradient', 'createRadialGradient'].includes(key) ? () => ({ addColorStop() {} }) : () => {},
  set: () => true,
});
const canvasDocument = { createElement: () => ({ width: 1, height: 1, getContext: () => context }) };
const sides = ['left', 'right'];
const bones = [['Shoulder', 'Elbow'], ['Elbow', 'Wrist'], ['Wrist', 'Fingertip'], ['Hip', 'Knee'], ['Knee', 'Ankle']];
const angle = (a, b, c) => THREE.MathUtils.radToDeg(a.clone().sub(b).angleTo(c.clone().sub(b)));

function make(character, outfit, builder = createCharacter) {
  const saved = globalThis.document;
  globalThis.document = canvasDocument;
  try { return builder({ id: character, character: CHARACTERS[character], outfit: OUTFITS[outfit], fabricTexture: () => new THREE.Texture() }); }
  finally { if (saved === undefined) delete globalThis.document; else globalThis.document = saved; }
}

function dispose(model) {
  const resources = new Set();
  model.rider.traverse(object => {
    if (!object.isMesh) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material); if (material.map) resources.add(material.map);
    }
  });
  for (const resource of resources) resource.dispose();
}

function points(model) {
  model.rider.updateMatrixWorld(true);
  return Object.fromEntries(Object.entries(model.landmarks).map(([name, point]) => [name, model.rider.worldToLocal(point.clone())]));
}

function surfaces(model) {
  const result = new Map();
  model.rider.traverseVisible(mesh => {
    if (!mesh.isMesh) return;
    const attribute = mesh.geometry.attributes.position;
    result.set(mesh.name, { mesh, points: Array.from({ length: attribute.count }, (_, i) => mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(attribute, i))) });
  });
  return result;
}

function distanceToVisibleFoot(model, side) {
  const target = model.landmarks[side + 'Toe'], closest = new THREE.Vector3();
  let distance = Infinity;
  model.rider.traverseVisible(mesh => {
    if (!mesh.isMesh || ![side + '-foot', 'shoe'].includes(mesh.name)) return;
    const attribute = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const vertices = Array.from({ length: attribute.count }, (_, i) => mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(attribute, i)));
    for (let i = 0; i < (index ? index.count : vertices.length); i += 3) {
      const tri = [0, 1, 2].map(k => vertices[index ? index.getX(i + k) : i + k]);
      new THREE.Triangle(...tri).closestPointToPoint(target, closest);
      distance = Math.min(distance, closest.distanceTo(target));
    }
  });
  return distance;
}

test('ordinary riding has a flexed, upright stance rather than the previous wide seated crouch', t => {
  const knees = [], stances = [], hipLifts = [];
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    const model = make(character, outfit), old = make(character, outfit, createPreviousCharacter), label = `${character}/${outfit}`;
    try {
      model.pose({ mode: 'park' }); old.pose({ mode: 'park' });
      const p = points(model), previous = points(old);
      const stance = Math.abs(p.rightAnkle.x - p.leftAnkle.x);
      assert.ok(stance > .58 && stance < .62, `${label}: ordinary stance is too wide or too narrow (${stance}m)`);
      assert.ok(stance < Math.abs(previous.rightAnkle.x - previous.leftAnkle.x) - .07, `${label}: stance did not visibly narrow`);
      stances.push(stance);
      for (const side of sides) {
        const knee = angle(p[side + 'Hip'], p[side + 'Knee'], p[side + 'Ankle']);
        assert.ok(knee > 114 && knee < 136, `${label}: ${side} knee should be flexed but not seated (${knee} degrees)`);
        assert.ok(p[side + 'Hip'].y - p[side + 'Knee'].y > .30, `${label}: ${side} hip should remain visibly above the knee`);
        const lift = p[side + 'Hip'].y - previous[side + 'Hip'].y;
        assert.ok(lift > .055, `${label}: hips did not rise clearly from the previous crouch`);
        knees.push(knee); hipLifts.push(lift);
      }
      assert.ok(Math.abs(p.leftAnkle.z - p.rightAnkle.z) > .05, `${label}: feet lost their staggered placement`);
    } finally { dispose(model); dispose(old); }
  }
  const range = values => `${Math.min(...values).toFixed(3)}–${Math.max(...values).toFixed(3)}`;
  t.diagnostic(`Measured ordinary stance ${range(stances)}m; knee angles ${range(knees)} degrees; hip lift from v9 ${range(hipLifts)}m.`);
});

test('charging and raised-arm balance preserve physical limbs, real foot contacts and sewn cloth boundaries', t => {
  let poses = 0, seams = 0;
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    const model = make(character, outfit), label = `${character}/${outfit}`;
    try {
      model.pose({ mode: 'park' });
      const rest = points(model);
      for (const charge of [0, .25, .5, .75, 1]) for (const balance of [0, .5, 1]) {
        model.pose({ mode: 'park', charge, balance, time: .7 });
        const p = points(model), meshes = surfaces(model), poseLabel = `${label} charge=${charge}, balance=${balance}`;
        for (const side of sides) {
          for (const key of ['Ankle', 'Toe']) assert.ok(p[side + key].distanceTo(rest[side + key]) < 1e-8, `${poseLabel}: ${side} planted ${key} slid`);
          for (const [a, b] of bones) assert.ok(Math.abs(p[side + a].distanceTo(p[side + b]) - rest[side + a].distanceTo(rest[side + b])) < 1e-6, `${poseLabel}: ${side} ${a}-${b} stretched`);
          // Bare feet and trainers share planted anatomical toe targets. A
          // trainer surrounds that target, so measure its actual triangles
          // rather than requiring a hidden barefoot vertex to be rendered.
          assert.ok(distanceToVisibleFoot(model, side) < .04, `${poseLabel}: planted toe has no nearby visible foot/shoe surface`);
          const torso = meshes.get('torso'), sleeve = meshes.get(side + '-sleeve');
          if (torso && sleeve) for (const [i, index] of torso.mesh.userData.armholes[side].entries()) {
            assert.ok(torso.points[index].distanceTo(sleeve.points[i]) < 1e-6, `${poseLabel}: ${side} balance arm opened its sleeve seam`); seams++;
          }
          const leg = meshes.get(side + '-trousers') || meshes.get(side + '-shorts');
          const opposite = meshes.get((side === 'left' ? 'right' : 'left') + (OUTFITS[outfit].bottom === 'trousers' ? '-trousers' : '-shorts'));
          const seat = meshes.get('trouser-yoke');
          if (leg && opposite && seat) for (const point of leg.points.slice(0, 8)) {
            assert.ok(Math.min(...[...opposite.points.slice(0, 8), ...seat.points].map(other => point.distanceTo(other))) < 1e-6, `${poseLabel}: ${side} leg opened the seat seam`); seams++;
          }
        }
        for (const { mesh, points: vertices } of meshes.values()) {
          assert.ok(vertices.every(point => [point.x, point.y, point.z].every(Number.isFinite)), `${poseLabel}: non-finite visible vertices`);
          assert.ok([...mesh.geometry.attributes.normal.array].every(Number.isFinite), `${poseLabel}: non-finite visible normals`);
        }
        poses++;
      }
    } finally { dispose(model); }
  }
  assert.equal(poses, Object.keys(CHARACTERS).length * Object.keys(OUTFITS).length * 15);
  t.diagnostic(`${poses} actual charge/balance poses retain limb lengths and planted foot vertices; ${seams} sewn cloth boundary vertices checked.`);
});

test('the grind balance pose raises both hands while keeping a stable ordinary riding base', () => {
  for (const character of Object.keys(CHARACTERS)) {
    const model = make(character, CHARACTERS[character].defaultOutfit);
    try {
      model.pose({ mode: 'park', balance: 0 }); const rest = points(model);
      model.pose({ mode: 'park', balance: 1 }); const raised = points(model);
      for (const side of sides) {
        assert.ok(raised[side + 'Wrist'].y > rest[side + 'Wrist'].y + .15, `${character}: ${side} hand did not rise visibly for balancing`);
        assert.ok(raised[side + 'Ankle'].distanceTo(rest[side + 'Ankle']) < 1e-8, `${character}: balance moved the ${side} foot`);
        assert.ok(raised[side + 'Hip'].y - raised[side + 'Knee'].y > .24, `${character}: balancing collapsed the grounded stance`);
      }
      assert.ok(Math.abs(raised.leftWrist.y - raised.rightWrist.y) > .03, `${character}: balance arms should have asymmetric heights`);
    } finally { dispose(model); }
  }
});

function upperShortsRise(model, side) {
  const mesh = model.rider.getObjectByName(side + '-shorts');
  if (!mesh) return null;
  const attribute = mesh.geometry.attributes.position, index = mesh.geometry.index;
  const vertices = Array.from({ length: attribute.count }, (_, i) => mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(attribute, i)));
  const roots = mesh.userData.rootIndices.map(i => vertices[i]);
  const isRoot = i => roots.some(point => point.distanceTo(vertices[i]) < 1e-7);
  const adjacent = new Set();
  // Inspect actual triangles adjoining the sewn seat, not the author's ring
  // constants. These are the faces that previously formed an upward hip fin.
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (triangle.some(isRoot)) for (const vertex of triangle) if (!isRoot(vertex)) adjacent.add(vertex);
  }
  assert.ok(adjacent.size >= 8, 'missing actual upper-shorts triangles');
  return Math.max(...[...adjacent].map(i => vertices[i].y)) - model.landmarks[side + 'Hip'].y;
}

test('shorts grow from the sewn seat without protruding above the hip as an upward fin', t => {
  let checked = 0, maximum = -Infinity;
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    if (OUTFITS[outfit].bottom === 'trousers' || OUTFITS[outfit].top === 'wetsuit') continue;
    const model = make(character, outfit);
    try {
      for (const charge of [0, .5, 1]) for (const balance of [0, 1]) {
        model.pose({ mode: 'park', charge, balance }); model.rider.updateMatrixWorld(true);
        for (const side of sides) {
          const rise = upperShortsRise(model, side); maximum = Math.max(maximum, rise); checked++;
          assert.ok(rise < .02, `${character}/${outfit} charge=${charge}, balance=${balance}: ${side} upper shorts project ${(rise * 1000).toFixed(1)}mm above the hip`);
        }
      }
    } finally { dispose(model); }
  }
  const previous = make('reef', 'dockside', createPreviousCharacter);
  try {
    previous.pose({ mode: 'park', charge: 1 }); previous.rider.updateMatrixWorld(true);
    assert.ok(upperShortsRise(previous, 'left') > .025, 'negative control must reproduce the old upward cloth fin');
  } finally { dispose(previous); }
  t.diagnostic(`${checked} real upper-shorts surfaces checked; largest above-hip rise ${(maximum * 1000).toFixed(1)}mm, with the v9 defect reproduced separately.`);
});

test('the body-only changes preserve previous face and scalp geometry, UVs and material settings in every outfit', () => {
  for (const character of Object.keys(CHARACTERS)) for (const outfit of Object.keys(OUTFITS)) {
    const current = make(character, outfit), previous = make(character, outfit, createPreviousCharacter), label = `${character}/${outfit}`;
    try {
      for (const name of ['face', 'scalp']) {
        const a = current.head.getObjectByName(name), b = previous.head.getObjectByName(name);
        assert.ok(a && b, `${label}: missing ${name}`);
        for (const attribute of ['position', 'normal', 'uv']) assert.deepEqual(a.geometry.getAttribute(attribute)?.array, b.geometry.getAttribute(attribute)?.array, `${label}: ${name} ${attribute} changed`);
        assert.deepEqual(a.geometry.index?.array, b.geometry.index?.array, `${label}: ${name} topology changed`);
        assert.deepEqual(a.position.toArray(), b.position.toArray(), `${label}: ${name} local position changed`);
        assert.deepEqual(a.scale.toArray(), b.scale.toArray(), `${label}: ${name} scale changed`);
        assert.deepEqual(a.quaternion.toArray(), b.quaternion.toArray(), `${label}: ${name} orientation changed`);
        for (const key of ['type', 'flatShading', 'side', 'opacity', 'transparent']) assert.equal(a.material[key], b.material[key], `${label}: ${name} material ${key} changed`);
        assert.equal(a.material.color.getHex(), b.material.color.getHex(), `${label}: ${name} colour changed`);
        for (const key of ['minFilter', 'magFilter', 'colorSpace']) assert.equal(a.material.map?.[key], b.material.map?.[key], `${label}: ${name} texture ${key} changed`);
      }
    } finally { dispose(current); dispose(previous); }
  }
});
