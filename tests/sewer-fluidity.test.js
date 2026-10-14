import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSewerCourse, sewerPoint, sewerWaterHeight, sewerTunnelProfile } from '../src/sewer-course.js';
import { createSewerWorld } from '../src/sewer-world.js';
import { createSewerCameraState, stepSewerCamera } from '../src/sewer-camera-rig.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const vector = point => new THREE.Vector3(point.x, point.y, point.z);
const uniform = (material, name, fallback) => material.uniforms?.[name]?.value ?? fallback;

function cutAt(material, point) {
  const cuts = uniform(material, 'cuts', []), ends = uniform(material, 'cutEnds', []);
  for (let i = 0; i < uniform(material, 'cutCount', 0); i++) {
    const cut = cuts[i], start = new THREE.Vector2(cut.x, cut.y);
    const delta = new THREE.Vector2(cut.z, cut.w).sub(start);
    if (delta.lengthSq() < 1e-10) continue;
    const offset = new THREE.Vector2(point.x, point.z).sub(start), t = offset.dot(delta) / delta.lengthSq();
    if (t < 0 && ends[i]?.x || t > 1 && ends[i]?.y) continue;
    if (offset.distanceTo(delta.multiplyScalar(THREE.MathUtils.clamp(t, 0, 1))) < uniform(material, 'cutWidth', 0)) return true;
  }
  return false;
}
function whirlpoolAt(material, point) {
  const holes = uniform(material, 'holes', []), angles = uniform(material, 'holeAngles', []);
  for (let i = 0; i < uniform(material, 'holeCount', 0); i++) {
    const hole = holes[i], x = point.x - hole.x, z = point.z - hole.y;
    const c = Math.cos(angles[i]), s = Math.sin(angles[i]);
    if (Math.hypot((c * x - s * z) / hole.z, (s * x + c * z) / hole.w) < .93) return true;
  }
  return false;
}
function visibleHits(ray, meshes) {
  return ray.intersectObjects(meshes, false).filter(hit => !cutAt(hit.object.material, hit.point) && !whirlpoolAt(hit.object.material, hit.point));
}
function sorted(values) { return [...values].sort((a, b) => a - b); }
function range(set, start, end, step) { for (let d = start; d <= end; d += step) set.add(d); }
function failureList(failures) { return failures.slice(0, 8).join('\n'); }

for (const trackId of ['sewer-run', 'sewer-depths']) {
  test(`${trackId}: continuous water and a closed visible basin`, async t => {
    const course = createSewerCourse(trackId), world = createSewerWorld();
    const game = {isSewer:true, trackId, course, distance:0, elapsed:0, nextCheckpoint:0, hazardStates:new Map(), phase:'running'};
    world.update(game, 0);
    const shells = [], decks = [], beds = [];
    world.group.traverse(object => {
      if (!object.isMesh) return;
      if (object.name === 'sewer-main-pipe' || object.name.startsWith('shortcut-pipe-')) shells.push(object);
      if (object.name.startsWith('sewer-maintenance-deck-')) decks.push(object);
      if (object.name.startsWith('sewer-channel-bed-')) beds.push(object);
    });
    const refresh = (distance, time = 2.3) => {
      game.distance = distance; game.elapsed = time; world.update(game, time); world.group.updateMatrixWorld(true);
    };
    try {
      await t.test('water meets every visible side margin, deck edge, shortcut mouth and streamed chunk seam', () => {
        const failures = [];
        for (const path of [null, ...course.shortcuts]) {
          const distances = new Set(), start = path?.start ?? 0, end = path?.end ?? course.length;
          range(distances, start + .25, end - .25, path ? 2.75 : 31);
          for (const stream of world.waters.filter(stream => (stream.geometry.userData.path?.id || null) === (path?.id || null))) {
            for (const seam of [stream.geometry.userData.start, stream.geometry.userData.end]) {
              for (const delta of [-.025, 0, .025]) if (seam + delta > start && seam + delta < end) distances.add(seam + delta);
            }
          }
          for (const branch of path ? [path] : course.shortcuts) {
            for (const mouth of [branch.start, branch.end]) range(distances, Math.max(start, mouth - 12), Math.min(end, mouth + 12), 1);
          }
          for (const distance of sorted(distances)) {
            refresh(distance);
            const profile = sewerTunnelProfile(distance, trackId, path);
            const width = path ? 4.0 : Math.sqrt(profile.radius ** 2 - (1.85 - profile.centerY) ** 2) - .4;
            const center = path?.entryX || 0, meshes = [...world.waters.filter(stream => stream.visible), ...decks];
            for (let offset = -width; offset <= width; offset += .4) {
              const point = vector(sewerPoint(distance, center + offset, 3, trackId, path));
              if (world.waters.some(stream => whirlpoolAt(stream.material, point))) continue;
              const hits = visibleHits(new THREE.Raycaster(point, DOWN, 0, 6), meshes);
              if (!hits.length || hits[0].point.y < -.22) {
                // At a pipe junction the rising solid sidewall can legitimately
                // meet the water before a maintenance deck. Deep basin floors
                // remain excluded: they would expose the underside of the map.
                const bank = new THREE.Raycaster(point, DOWN, 0, 3.22).intersectObjects(shells, false)[0];
                if (bank && bank.point.y >= -.22) continue;
                // Float32 mesh edges and shader coordinates may differ by a
                // fraction of a millimetre. Do not call a subpixel seam a gap.
                const coveredNearby = [[.003,0],[-.003,0],[0,.003],[0,-.003]].some(([dx,dz]) => {
                  const nearby = visibleHits(new THREE.Raycaster(point.clone().add(new THREE.Vector3(dx,0,dz)), DOWN, 0, 6), meshes);
                  return nearby.length && nearby[0].point.y >= -.22;
                });
                if (!coveredNearby) failures.push(`${path?.id || 'main'} ${distance.toFixed(3)}m, lane ${(center + offset).toFixed(3)}: ${hits.length ? `surface ${hits[0].point.y.toFixed(3)}m` : 'open surface gap'}`);
              }
            }
          }
        }
        assert.equal(failures.length, 0, `${failures.length} uncovered water/deck samples:\n${failureList(failures)}`);
      });

      await t.test('original tunnel shells close beneath both sides of every shortcut union', () => {
        const failures = [];
        for (const path of course.shortcuts) {
          const distances = new Set();
          for (const mouth of [path.start, path.end]) range(distances, Math.max(path.start + .25, mouth - 20), Math.min(path.end - .25, mouth + 20), 1.25);
          // Exact exposed-floor regressions found independently before the fix.
          if (trackId === 'sewer-depths' && path === course.shortcuts[0]) { distances.add(95.25); distances.add(100.25); }
          for (const distance of sorted(distances)) {
            for (let offset = -3.2; offset <= 3.2; offset += .4) {
              const lane = path.entryX + offset, height = sewerWaterHeight(lane, distance, 2.3, trackId, path);
              const point = vector(sewerPoint(distance, lane, height + .1, trackId, path));
              if (!new THREE.Raycaster(point, DOWN, 0, 40).intersectObjects(shells, false).length) failures.push(`${path.id} ${distance.toFixed(3)}m, offset ${offset.toFixed(3)}`);
            }
          }
        }
        assert.equal(failures.length, 0, `${failures.length} openings in the lower shell:\n${failureList(failures)}`);
      });

      await t.test('every intentional whirlpool opening has an opaque basin underneath', () => {
        assert.equal(beds.length, course.shortcuts.length + 1, 'each real route has its own basin floor');
        for (const {mesh, item} of world.hazards.filter(entry => entry.item.type === 'whirlpool')) {
          refresh(item.distance);
          const path = item.path === 'main' ? null : item.path;
          for (const radius of [0, .45, .88]) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const distance = item.distance + Math.sin(angle) * item.radiusZ * radius;
            const lane = item.x + Math.cos(angle) * item.radiusX * radius;
            const height = sewerWaterHeight(lane, distance, game.elapsed, trackId, path);
            const origin = vector(sewerPoint(distance, lane, height + .05, trackId, path));
            const hits = new THREE.Raycaster(origin, DOWN, 0, 8).intersectObjects([...beds, ...shells], false);
            assert.ok(hits.length, `${item.id}: the opening exposes empty space at radial fraction ${radius}`);
            assert.ok(hits[0].point.y < height + .05, 'a basin floor must remain below the water');
          }
          assert.ok(mesh.children.some(child => child.isMesh), 'the funnel has visible interior geometry');
        }
      });

      await t.test('jump-height chase views cannot look through the lower map at junctions', () => {
        const failures = [];
        for (const path of course.shortcuts) for (const mouth of [path.start, path.end]) {
          for (const distance of [mouth - 4, mouth + .25, mouth + 4]) for (const jumpHeight of [0, 4.5]) {
            refresh(distance);
            const active = distance > path.start && distance < path.end ? path : null;
            const lane = path.entryX, y = sewerWaterHeight(lane, distance, game.elapsed, trackId, active) + jumpHeight;
            const rider = sewerPoint(distance, lane, y, trackId, active);
            const state = stepSewerCamera(createSewerCameraState(), {...rider, distance, trackId, shortcut:active,
              lane, settings:{camera:'wide', cameraHeight:3}}, 1 / 60);
            const camera = new THREE.PerspectiveCamera(state.fov, 16 / 9, .1, 350);
            camera.position.copy(state.position); camera.lookAt(state.look); camera.updateMatrixWorld(true);
            const meshes = [...world.waters.filter(stream => stream.visible), ...decks, ...shells, ...beds];
            for (const x of [-.85, -.4, 0, .4, .85]) for (const y of [-.92, -.6, -.3]) {
              const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x, y), camera); ray.far = 350;
              if (!visibleHits(ray, meshes).length) failures.push(`${path.id} ${distance}m, jump ${jumpHeight}, screen ${x}/${y}`);
            }
          }
        }
        assert.equal(failures.length, 0, `${failures.length} chase-view rays escape under the map:\n${failureList(failures)}`);
      });
    } finally { world.dispose(); }
  });
}
