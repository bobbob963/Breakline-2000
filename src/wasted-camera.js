import * as THREE from 'three';

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const unit = value => Math.max(0, Math.min(1, finite(value, 0)));
const vector = (value, fallback) => new THREE.Vector3(
  finite(value?.x, fallback.x), finite(value?.y, fallback.y), finite(value?.z, fallback.z));
const smooth = value => value * value * (3 - 2 * value);

// An immutable eye anchor from the last healthy render, before physics applies
// the wipeout pose. Forward follows travel: surf is -Z, independently of the
// sideways surfing stance or an airborne character's spinning head.
export function createWastedEyeAnchor({ eye, forward, up, fov } = {}) {
  const position = vector(eye, { x: 0, y: 1.5, z: 0 });
  const vertical = vector(up, { x: 0, y: 1, z: 0 });
  if (vertical.lengthSq() < .0001) vertical.set(0, 1, 0);
  vertical.normalize();
  const direction = vector(forward, { x: 0, y: 0, z: -1 });
  direction.addScaledVector(vertical, -direction.dot(vertical));
  if (direction.lengthSq() < .0001) {
    direction.set(0, 0, -1).addScaledVector(vertical, vertical.z);
    if (direction.lengthSq() < .0001) direction.set(1, 0, 0).addScaledVector(vertical, -vertical.x);
  }
  direction.normalize();
  return { eye: position.toArray(), forward: direction.toArray(), up: vertical.toArray(), fov: Math.max(35, Math.min(75, finite(fov, 50))) };
}

export function sampleWastedCamera(anchor, frame = {}, { reducedMotion = false } = {}) {
  const position = new THREE.Vector3(...anchor.eye);
  const forward = new THREE.Vector3(...anchor.forward);
  const up = new THREE.Vector3(...anchor.up);
  // Hold the initial cut long enough to read the environment; a small slump
  // follows the eyelid animation. Reduced motion keeps this view stationary.
  const elapsed = finite(frame.elapsed, unit(frame.cameraProgress) * 1.5);
  const slump = reducedMotion ? 0 : smooth(unit((elapsed - .5) / 1));
  position.addScaledVector(forward, slump * .12).addScaledVector(up, -slump * .26);
  const look = position.clone().addScaledVector(forward, 8).addScaledVector(up, -.25 - slump * 1.0);
  if (!reducedMotion) up.applyAxisAngle(forward, slump * .018);
  return { position, look, up, fov: anchor.fov, near: .06 };
}
