/**
 * Breakline's independent art-direction guardrails.
 * These ranges are estimates from the user's supplied, posed reference images.
 * They are NOT a recovered THPS2 model specification or historical poly budget.
 * Coordinates must be measured from a standing model, in one upright space.
 * Height is measured crown-to-lowest-sole; no declared model-height setting is used.
 */
export const CHARACTER_TARGETS = Object.freeze({
  headHeight:      { min: .122, max: .143, label: 'Crown to chin / height' },
  headWidth:       { min: .074, max: .102, label: 'Head width / height' },
  shoulderWidth:   { min: .252, max: .305, label: 'Garment shoulder width / height, excluding elbows' },
  shoulderJointWidth: { min: .200, max: .262, label: 'Shoulder joint separation / height' },
  chestWidth:      { min: .215, max: .279, label: 'Garment chest width / height' },
  hipWidth:        { min: .185, max: .255, label: 'Garment hip width / height' },
  chinY:          { min: .857, max: .878, label: 'Chin height above soles' },
  shoulderY:      { min: .790, max: .837, label: 'Shoulder joint height above soles' },
  hipY:           { min: .485, max: .565, label: 'Hip joint height above soles' },
  kneeY:          { min: .245, max: .320, label: 'Knee joint height above soles' },
  ankleY:         { min: .030, max: .085, label: 'Ankle joint height above soles' },
  wristY:         { min: .425, max: .525, label: 'Wrist height in relaxed standing pose' },
  upperArm:       { min: .158, max: .205, label: 'Shoulder to elbow length / height' },
  forearm:        { min: .135, max: .185, label: 'Elbow to wrist length / height' },
  thigh:          { min: .220, max: .302, label: 'Hip to knee length / height' },
  shin:           { min: .205, max: .282, label: 'Knee to ankle length / height' },
  handLength:     { min: .073, max: .110, label: 'Wrist to middle fingertip / height' },
  handWidth:      { min: .035, max: .061, label: 'Palm width / height' },
  shirtHemY:      { min: .485, max: .560, label: 'Baggy shirt hem height above soles' },
  trouserCrotchY: { min: .365, max: .460, label: 'Visible baggy trouser crotch height, not anatomical hips' },
  trouserKneeWidth: { min: .086, max: .143, label: 'Width of one baggy trouser leg at knee / height' },
  trouserCuffWidth: { min: .078, max: .134, label: 'Width of one baggy trouser cuff / height' },
  cuffToKnee:     { min: .640, max: 1.030, label: 'Baggy trouser cuff width / knee width' },
  exposedNeck:    { min: .006, max: .040, label: 'Visible collar to jaw distance / height' },
  maxClothGap:    { min: 0, max: .006, label: 'Maximum measured cloth seam separation / height' },
});

export const CHARACTER_VISUAL_CHECKS = Object.freeze([
  'Front silhouette: sloping trapezius, rounded angular shoulders, a defined chest, and a waist; not stacked boxes or constant-radius tubes.',
  'Three-quarter silhouette: chest and back have different contours, the face has a projecting nose and a jaw, and hands are flatter than forearms.',
  'Baggy clothing: shirt overlaps waistband; trouser cloth stays continuous across bent knees; sleeves narrow toward cuffs without spherical elbow pods.',
  'Standing pose: slight weight shift, non-identical arms, unlocked knees, and both shoe soles at floor; no rigid T-pose.',
  'Riding pose: feet remain attached to the surfboard; elbows and knees bend without visible gaps or imploding cloth.',
  'Face texture: brow, eyelids, nose bridge/side plane, cheek light/shadow, mouth, and jaw remain identifiable at a 30-pixel-high head.',
  'Cloth texture: large-value folds, neckline, hem, cuffs, and pockets describe shape; random speckle never replaces those features.',
  'Check 0, 45, 90 and 180 degrees at the actual game resolution as well as a neutral lit close-up; numerical compliance alone is not visual approval.',
]);

const point = p => Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p;
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const average = values => values.reduce((a, b) => a + b, 0) / values.length;

/** Measure axis extents from actual vertices, optionally after their model transform. */
export function measurePointBounds(points) {
  const bounds = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
  let count = 0;
  for (const value of points) {
    const p = point(value);
    if (!finitePoint(p)) throw new TypeError('Geometry contains a non-finite vertex.');
    for (const axis of ['x', 'y', 'z']) {
      bounds.min[axis] = Math.min(bounds.min[axis], p[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], p[axis]);
    }
    count++;
  }
  if (!count) throw new TypeError('Cannot measure empty geometry.');
  return { ...bounds, width: bounds.max.x - bounds.min.x, height: bounds.max.y - bounds.min.y, depth: bounds.max.z - bounds.min.z, count };
}

/**
 * Landmarks accept THREE.Vector3s, {x,y,z}, or [x,y,z].
 * Required: crown, chin, leftSole/rightSole (one sole suffices).
 * Optional pairs: left/right Shoulder, Elbow, Wrist, Hip, Knee, Ankle,
 * HeadEdge, ShoulderOuter, HandTip; optional collar, shirtHem, trouserCrotch.
 * Dimensions are raw distances from actual vertices/bounds, in the same units:
 * headWidth, shoulderWidth, chestWidth, hipWidth, handLength, handWidth,
 * trouserKneeWidth, trouserCuffWidth, exposedNeck, maxClothGap.
 */
export function measureCharacterLandmarks(landmarks, dimensions = {}) {
  const p = Object.fromEntries(Object.entries(landmarks || {}).map(([key, value]) => [key, point(value)]));
  // Support the model's equivalent names without changing its animation API.
  p.leftShoulderOuter ??= p.shoulderOuterLeft;
  p.rightShoulderOuter ??= p.shoulderOuterRight;
  p.leftHandTip ??= p.leftFingertip;
  p.rightHandTip ??= p.rightFingertip;
  p.trouserCrotch ??= p.crotch;
  for (const key of Object.keys(p)) if (p[key] === undefined) delete p[key];
  for (const [name, value] of Object.entries(p)) {
    if (!finitePoint(value)) throw new TypeError(`Invalid character landmark: ${name}`);
  }
  const soles = [p.leftSole, p.rightSole].filter(Boolean);
  if (!p.crown || !p.chin || !soles.length) throw new TypeError('Crown, chin and a sole are required to measure a standing character.');
  const floorY = Math.min(...soles.map(s => s.y));
  const height = p.crown.y - floorY;
  if (!(height > 0)) throw new RangeError('Measured character height must be positive.');
  const ratios = { headHeight: (p.crown.y - p.chin.y) / height, chinY: (p.chin.y - floorY) / height };
  const segments = {};
  for (const [name, a, b] of [
    ['upperArm', 'Shoulder', 'Elbow'], ['forearm', 'Elbow', 'Wrist'],
    ['thigh', 'Hip', 'Knee'], ['shin', 'Knee', 'Ankle'], ['handLength', 'Wrist', 'HandTip'],
  ]) {
    const lengths = ['left', 'right'].map(side => p[side + a] && p[side + b] ? distance(p[side + a], p[side + b]) : null).filter(v => v !== null);
    if (lengths.length) {
      ratios[name] = average(lengths) / height;
      segments[name] = lengths;
    }
  }
  for (const joint of ['Shoulder', 'Hip', 'Knee', 'Wrist', 'Ankle']) {
    const points = ['left', 'right'].map(side => p[side + joint]).filter(Boolean);
    if (points.length) ratios[joint[0].toLowerCase() + joint.slice(1) + 'Y'] = (average(points.map(v => v.y)) - floorY) / height;
  }
  for (const [name, pair] of [['headWidth', 'HeadEdge'], ['shoulderWidth', 'ShoulderOuter'], ['shoulderJointWidth', 'Shoulder']]) {
    if (p['left' + pair] && p['right' + pair]) ratios[name] = distance(p['left' + pair], p['right' + pair]) / height;
  }
  for (const name of ['shirtHem', 'trouserCrotch']) if (p[name]) ratios[name + 'Y'] = (p[name].y - floorY) / height;
  if (p.collar) ratios.exposedNeck = (p.chin.y - p.collar.y) / height;
  for (const [name, value] of Object.entries(dimensions)) {
    if (!Number.isFinite(value) || value < 0) throw new TypeError(`Invalid measured character dimension: ${name}`);
    if (name in CHARACTER_TARGETS) ratios[name] = value / height;
  }
  if (ratios.trouserKneeWidth > 0 && ratios.trouserCuffWidth !== undefined) ratios.cuffToKnee = ratios.trouserCuffWidth / ratios.trouserKneeWidth;
  const symmetry = Object.fromEntries(Object.entries(segments).filter(([, lengths]) => lengths.length === 2).map(([name, lengths]) => [name, Math.abs(lengths[0] - lengths[1]) / average(lengths)]));
  return { height, floorY, heads: 1 / ratios.headHeight, ratios, symmetry };
}

/** Report evidence and missing measurements; never treat missing evidence as a passed check. */
export function auditCharacterProportions(measurement, options = {}) {
  const required = options.required || ['headHeight', 'shoulderWidth', 'shoulderY', 'kneeY', 'upperArm', 'forearm', 'thigh', 'shin'];
  const strict = options.strict ?? true;
  const ratios = measurement?.ratios || {};
  const checks = [];
  const missing = [];
  for (const [key, target] of Object.entries(CHARACTER_TARGETS)) {
    const value = ratios[key];
    if (value === undefined) {
      if (required.includes(key)) missing.push(key);
      continue;
    }
    checks.push({ key, label: target.label, value, min: target.min, max: target.max, pass: Number.isFinite(value) && value >= target.min - 1e-9 && value <= target.max + 1e-9 });
  }
  for (const [key, value] of Object.entries(measurement?.symmetry || {})) {
    checks.push({ key: `${key}LengthDifference`, label: 'Left/right skeletal length difference (pose may differ)', value, min: 0, max: .12, pass: Number.isFinite(value) && value <= .12 });
  }
  const issues = checks.filter(check => !check.pass);
  return { pass: checks.length > 0 && issues.length === 0 && (!strict || missing.length === 0), checks, issues, missing, coverage: required.length ? required.filter(key => ratios[key] !== undefined).length / required.length : 1 };
}
