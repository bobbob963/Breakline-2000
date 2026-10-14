import test from 'node:test';
import assert from 'node:assert/strict';
import { measurePointBounds, measureCharacterLandmarks, auditCharacterProportions } from '../src/character-spec.js';

// This fixture tests the measuring tool, not the shipped character artwork.
// The app's generated model must be measured separately before visual approval.
function standingPoints() {
  return {
    crown: [0, 1.8, 0], chin: [0, 1.56, 0], collar: [0, 1.53, 0],
    leftSole: [-.14, 0, 0], rightSole: [.14, 0, 0],
    leftHeadEdge: [-.078, 1.68, 0], rightHeadEdge: [.078, 1.68, 0],
    leftShoulderOuter: [-.252, 1.45, 0], rightShoulderOuter: [.252, 1.45, 0],
    leftShoulder: [-.20, 1.47, 0], rightShoulder: [.20, 1.47, 0],
    leftElbow: [-.24, 1.14, 0], rightElbow: [.24, 1.14, 0],
    leftWrist: [-.25, .87, 0], rightWrist: [.25, .87, 0],
    leftHandTip: [-.25, .705, 0], rightHandTip: [.25, .705, 0],
    leftHip: [-.11, .98, 0], rightHip: [.11, .98, 0],
    leftKnee: [-.13, .49, 0], rightKnee: [.13, .49, 0],
    leftAnkle: [-.14, .065, 0], rightAnkle: [.14, .065, 0],
    shirtHem: [0, .95, 0], trouserCrotch: [0, .745, 0],
  };
}

test('standing landmark checks measure actual distances independently of scale and translation', () => {
  const base = measureCharacterLandmarks(standingPoints(), { chestWidth: .455, trouserKneeWidth: .22, trouserCuffWidth: .18 });
  assert.ok(auditCharacterProportions(base).pass);
  assert.equal(base.height, 1.8);
  assert.ok(Math.abs(base.heads - 7.5) < 1e-10);
  assert.ok(Math.abs(base.ratios.cuffToKnee - .18 / .22) < 1e-10);
  const moved = Object.fromEntries(Object.entries(standingPoints()).map(([key, [x, y, z]]) => [key, { x: x * 3 + 21, y: y * 3 - 8, z: z * 3 + 40 }]));
  const measured = measureCharacterLandmarks(moved);
  for (const key of Object.keys(measured.ratios)) assert.ok(Math.abs(measured.ratios[key] - base.ratios[key]) < 1e-12, key);
});

test('shoulder garment width uses silhouette edges rather than just skeletal pivots', () => {
  const points = standingPoints();
  points.leftShoulderOuter[0] = -.34;
  points.rightShoulderOuter[0] = .34;
  const checked = auditCharacterProportions(measureCharacterLandmarks(points));
  assert.equal(checked.pass, false);
  assert.ok(checked.issues.some(check => check.key === 'shoulderWidth'));
  assert.ok(!checked.issues.some(check => check.key === 'shoulderJointWidth'));
});

test('tee and sweatshirt envelopes remain distinct without relaxing anatomical checks', () => {
  const base = measureCharacterLandmarks(standingPoints());
  const slimTee = { ...base, ratios: { ...base.ratios, shoulderWidth: .240 } };
  assert.equal(auditCharacterProportions(slimTee, { garment: 'tee' }).pass, true);
  for (const options of [{}, { garment: 'sweatshirt' }]) {
    assert.ok(auditCharacterProportions(slimTee, options).issues.some(check => check.key === 'shoulderWidth'), 'sweatshirt must retain its existing minimum breadth');
  }
  const bulkySweatshirt = { ...base, ratios: { ...base.ratios, shoulderWidth: .300 } };
  assert.equal(auditCharacterProportions(bulkySweatshirt, { garment: 'sweatshirt' }).pass, true);
  assert.ok(auditCharacterProportions(bulkySweatshirt, { garment: 'tee' }).issues.some(check => check.key === 'shoulderWidth'), 'tee selection must also reject an excessively broad shoulder crest');
  for (const garment of ['tee', 'sweatshirt']) {
    const malformed = { ...base, ratios: { ...base.ratios, shoulderWidth: .210, headHeight: .20, shin: .15 } };
    const issues = auditCharacterProportions(malformed, { garment }).issues.map(check => check.key);
    for (const key of ['shoulderWidth', 'headHeight', 'shin']) assert.ok(issues.includes(key), `${garment}: ${key} guardrail was relaxed`);
  }
});

test('a large toy head and shortened lower limbs cannot pass proportion checks', () => {
  const points = standingPoints();
  points.chin[1] = 1.39;
  points.leftKnee[1] = points.rightKnee[1] = .31;
  const checked = auditCharacterProportions(measureCharacterLandmarks(points));
  assert.equal(checked.pass, false);
  assert.ok(checked.issues.some(check => check.key === 'headHeight'));
  assert.ok(checked.issues.some(check => check.key === 'kneeY'));
  assert.ok(checked.issues.some(check => check.key === 'shin'));
});

test('wide baggy pants cannot silently regress to skinny cuffs or open knee seams', () => {
  const checked = auditCharacterProportions(measureCharacterLandmarks(standingPoints(), { trouserKneeWidth: .225, trouserCuffWidth: .09, maxClothGap: .025 }));
  assert.equal(checked.pass, false);
  for (const key of ['trouserCuffWidth', 'cuffToKnee', 'maxClothGap']) assert.ok(checked.issues.some(check => check.key === key), key);
});

test('missing measurements and non-finite coordinates never count as evidence of a good model', () => {
  assert.equal(auditCharacterProportions({ ratios: {} }).pass, false);
  const measured = measureCharacterLandmarks({ crown: [0, 2, 0], chin: [0, 1.73, 0], leftSole: [0, 0, 0] });
  const checked = auditCharacterProportions(measured);
  assert.equal(checked.pass, false);
  assert.ok(checked.missing.includes('shoulderWidth'));
  assert.ok(checked.coverage < 1);
  assert.throws(() => measureCharacterLandmarks({ ...standingPoints(), leftKnee: [0, NaN, 0] }), /Invalid character landmark/);
  assert.throws(() => measureCharacterLandmarks(standingPoints(), { handWidth: Infinity }), /Invalid measured character dimension/);
});

test('vertex bounds catch deformed geometry instead of reading authored size labels', () => {
  const vertices = [[-.2, .5, -.1], [.25, 1.5, .13], [0, .9, .05]];
  const bounds = measurePointBounds(vertices);
  assert.equal(bounds.width, .45);
  assert.equal(bounds.height, 1);
  vertices[1][0] = .7;
  assert.ok(measurePointBounds(vertices).width > .89);
  assert.throws(() => measurePointBounds([]), /empty geometry/);
  assert.throws(() => measurePointBounds([[0, Infinity, 0]]), /non-finite/);
});
