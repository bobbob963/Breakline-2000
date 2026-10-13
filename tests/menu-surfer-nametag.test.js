import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CHARACTERS, createSurfer, disposeSurfer } from '../src/appearance.js';
import { MenuSurferPreview, arrangeMenuSurfer, poseMenuSurfer, projectMenuNameTag } from '../src/menu-surfer.js';

const ctx = new Proxy({}, {get: (_, key) => ['createLinearGradient', 'createRadialGradient'].includes(key) ? () => ({addColorStop() {}}) : () => {}, set: () => true});
function withSurfer(profile, run) {
  const saved = globalThis.document;
  globalThis.document = {createElement: () => ({getContext: () => ctx})};
  let surfer;
  try { surfer = createSurfer(profile); return run(surfer); }
  finally { if (surfer) disposeSurfer(surfer); if (saved === undefined) delete globalThis.document; else globalThis.document = saved; }
}

test('name follows every posed rider above the real crown across landscape lobby sizes', () => {
  for (const character of Object.keys(CHARACTERS)) withSurfer({character}, surfer => {
    arrangeMenuSurfer(surfer);
    for (const [width, height] of [[340, 310], [460, 380], [700, 550]]) {
      const camera = new THREE.PerspectiveCamera(32, 1, .05, 20);
      const preview = {camera, surfer, container: {getBoundingClientRect: () => ({width, height})}, renderer: {setSize() {}}, updateNameTag() {}};
      MenuSurferPreview.prototype.resize.call(preview);
      for (const time of [0, 1.5, 4]) {
        poseMenuSurfer(surfer, time);
        const anchor = projectMenuNameTag(surfer, camera, width, height);
        const crown = surfer.landmarks.crown.clone().project(camera);
        const crownY = (1 - crown.y) * height * .5;
        assert.equal(anchor.visible, true, `${character} ${width}x${height}`);
        assert.ok(anchor.y < crownY - 7, 'Label bottom stays above the head');
        assert.ok(anchor.y >= 26, 'The complete label fits below the preview top');
        assert.ok(anchor.x > width * .15 && anchor.x < width * .85, 'Name stays within the portrait frame');
      }
    }
  });
});

test('missing, invisible and zero-size projections hide the nametag', () => {
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 20);
  camera.position.set(0, 1, -4);camera.lookAt(0, 1, 0);camera.updateProjectionMatrix();
  assert.equal(projectMenuNameTag(null, camera, 300, 300).visible, false);
  assert.equal(projectMenuNameTag({landmarks: {crown: new THREE.Vector3(0, 1.7, 0)}}, camera, 0, 300).visible, false);
  assert.equal(projectMenuNameTag({landmarks: {crown: new THREE.Vector3(0, 1.7, -10)}}, camera, 300, 300).visible, false);
});

test('setName renders literal text, hides empty names and respects disposed previews', () => {
  const tag = {textContent: '', set innerHTML(_) { throw new Error('HTML is forbidden'); }};
  const preview = {nameTag: tag, updateNameTag() { this.nameTag.hidden = !this.name; }};
  MenuSurferPreview.prototype.setName.call(preview, '<b>Wave</b>');
  assert.equal(tag.textContent, '<b>Wave</b>');
  assert.equal(tag.hidden, false);
  MenuSurferPreview.prototype.setName.call(preview, '  ');
  assert.equal(tag.textContent, '');assert.equal(tag.hidden, true);
  preview.disposed = true;
  MenuSurferPreview.prototype.setName.call(preview, 'New');
  assert.equal(tag.textContent, '');
});
