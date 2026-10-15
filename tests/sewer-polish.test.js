import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSewerCourse, sewerBranches, sewerPoint, sewerWaterHeight } from '../src/sewer-course.js';
import { createSewerWorld } from '../src/sewer-world.js';
import { createSewerCameraState, stepSewerCamera } from '../src/sewer-camera-rig.js';

const vector = point => new THREE.Vector3(point.x, point.y, point.z);
function gameFixture(trackId) {
  return {isSewer:true, trackId, course:createSewerCourse(trackId), distance:0,
    elapsed:0, x:0, y:0, nextCheckpoint:0, phase:'running', hazardStates:new Map()};
}
function resources(group) {
  const objects = new Set(), geometries = new Set(), materials = new Set();
  group.traverse(object => {
    objects.add(object);
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) materials.add(material);
  });
  return {objects, geometries, materials};
}
function shells(world) {
  const result = [];
  world.group.traverse(object => {
    if (object.isMesh && (object.name === 'sewer-main-pipe' || object.name.startsWith('shortcut-pipe-'))) result.push(object);
  });
  world.group.updateMatrixWorld(true);
  return result;
}
function wallBetween(start, end, walls) {
  const direction = end.clone().sub(start), length = direction.length();
  if (length < .001) return null;
  return new THREE.Raycaster(start, direction.normalize(), .002, length - .002).intersectObjects(walls, false)[0];
}
function visibleDraws(group, state) {
  const camera = new THREE.PerspectiveCamera(state.fov, 16 / 9, .1, 310);
  camera.position.copy(state.position); camera.lookAt(state.look); camera.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let draws = 0;
  group.updateMatrixWorld(true);
  group.traverseVisible(object => {
    if ((!object.isMesh && !object.isLine && !object.isPoints) || (object.frustumCulled && !frustum.intersectsObject(object))) return;
    draws += Array.isArray(object.material) ? object.geometry.groups.filter(part => part.count > 0 && object.material[part.materialIndex]?.visible).length : object.material?.visible ? 1 : 0;
  });
  return draws;
}
// Use the published GPU mask coordinates as geometric segments. A CPU mesh
// raycast alone sees discarded water triangles and cannot spot a drowned board.
function waterMaskContains(material, point) {
  const uniforms = material.uniforms;
  for (let i = 0; i < (uniforms.cutCount?.value || 0); i++) {
    const cut = uniforms.cuts.value[i];
    const start = new THREE.Vector2(cut.x, cut.y), end = new THREE.Vector2(cut.z, cut.w);
    const delta = end.clone().sub(start), relative = new THREE.Vector2(point.x, point.z).sub(start);
    const projection = relative.dot(delta) / delta.lengthSq(), ends = uniforms.cutEnds.value[i];
    if ((projection < 0 && ends.x) || (projection > 1 && ends.y)) continue;
    if (relative.distanceTo(delta.multiplyScalar(Math.max(0, Math.min(1, projection)))) < uniforms.cutWidth.value) return true;
  }
  return false;
}

for (const trackId of ['sewer-run', 'sewer-depths']) {
  test(`${trackId}: physical routes, camera and streamed scene agree`, async t => {
    const game = gameFixture(trackId), world = createSewerWorld();
    world.update(game, 0);
    const walls = shells(world);
    assert.equal(walls.length, sewerBranches(game.course).length + 1);
    try {
      await t.test('legal rider lines pass through both ends of every actual pipe mesh', () => {
        for (const branch of sewerBranches(game.course)) {
          for (const mouth of [branch.start, branch.end]) {
            for (const lateral of [-branch.width * .43, 0, branch.width * .43]) {
              for (const bodyHeight of [.8, 1.85]) {
                let previous;
                for (let distance = mouth - 24; distance <= mouth + 24; distance += 1.5) {
                  const lane = branch.entryX + lateral;
                  const height = sewerWaterHeight(lane, distance, 0, trackId, branch) + bodyHeight;
                  const point = vector(sewerPoint(distance, lane, height, trackId, branch));
                  const hit = previous && wallBetween(previous, point, walls);
                  assert.ok(!hit, `${branch.id}, mouth ${mouth}, lane ${lane.toFixed(2)}, height ${bodyHeight}: wall ${hit?.object.name} blocks the ride at ${distance.toFixed(1)}m`);
                  previous = point;
                }
              }
            }
          }
        }
      });

      await t.test('junction unions retain the outer walls beside the racing lane', () => {
        for (const branch of sewerBranches(game.course)) {
          for (const path of [null, branch]) {
            for (let distance = branch.start + 3; distance < branch.end; distance += 7) {
              const point = sewerPoint(distance, path ? branch.entryX : 0, 3, trackId, path);
              for (const side of [-1, 1]) {
                const direction = new THREE.Vector3(Math.cos(point.heading) * side, 0, -Math.sin(point.heading) * side);
                const hit = new THREE.Raycaster(vector(point), direction, .01, 80).intersectObjects(walls, false)[0];
                assert.ok(hit, `open exterior gap at ${distance}m on ${path?.id || 'main'}, side ${side}`);
              }
            }
          }
        }
      });

      await t.test('the chase lens has an unobstructed view of the rider through shortcut junctions', () => {
        for (const branch of sewerBranches(game.course)) {
          for (const lateral of [-branch.width * .40, branch.width * .40]) {
            for (const camera of ['classic', 'wide']) {
              const state = createSewerCameraState();
              let sample = 0;
              for (let distance = branch.start - 18; distance <= branch.end + 18; distance += .6) {
                const lane = branch.entryX + lateral;
                const active = distance > branch.start && distance < branch.end ? branch.id : null;
                const y = sewerWaterHeight(lane, distance, 0, trackId, active);
                const rider = sewerPoint(distance, lane, y, trackId, active);
                stepSewerCamera(state, {...rider, trackId, shortcut:active, distance, lane,
                  speed:36, boosting:true, motion:true, settings:{camera,cameraHeight:0}}, 1 / 60);
                if (sample++ % 10) continue;
                const head = vector(rider).add(new THREE.Vector3(0, 1.65, 0));
                const hit = wallBetween(state.position, head, walls);
                assert.ok(!hit, `${branch.id}, ${camera} view, lane ${lane.toFixed(2)}: ${hit?.object.name} hides the rider at ${distance.toFixed(1)}m`);
              }
            }
          }
        }
      });

      await t.test('active water remains present and animation reuses its scene resources', () => {
        const before = resources(world.group);
        for (let distance = 0; distance <= game.course.length; distance += 19) {
          game.distance = distance; game.elapsed += .35;
          world.update(game, game.elapsed);
          for (const path of [null, ...sewerBranches(game.course).filter(branch => distance >= branch.start && distance <= branch.end)]) {
            const covering = world.waters.filter(stream => {
              const data = stream.geometry.userData;
              return (data.path?.id || null) === (path?.id || null) && distance >= data.start && distance <= data.end;
            });
            assert.ok(covering.some(stream => stream.visible), `missing active water at ${distance}m on ${path?.id || 'main'}`);
          }
        }
        const after = resources(world.group);
        assert.deepEqual(after.objects, before.objects, 'riding a complete course must not allocate more scene objects');
        assert.deepEqual(after.geometries, before.geometries, 'water/wave animation must reuse buffers');
        assert.deepEqual(after.materials, before.materials, 'animation must reuse materials');
      });

      await t.test('shortcut riders stay on the visible water rather than below overlapping main water', () => {
        for (const branch of sewerBranches(game.course)) {
          for (let distance = branch.start + 1; distance < branch.end; distance += 11) {
            game.distance = distance;
            world.update(game, 2); world.group.updateMatrixWorld(true);
            for (const offset of [-2.6, 0, 2.6]) {
              const lane = branch.entryX + offset;
              const point = vector(sewerPoint(distance, lane, sewerWaterHeight(lane, distance, 2, trackId, branch), trackId, branch));
              const hits = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0), 0, 20)
                .intersectObjects(world.waters.filter(stream => stream.visible), false)
                .filter(hit => !waterMaskContains(hit.object.material, hit.point));
              assert.ok(hits.length, `no water beneath ${branch.id} at ${distance}m, lane ${lane}`);
              assert.ok(hits[0].point.y - point.y < .09, `water hides the board by ${(hits[0].point.y - point.y).toFixed(3)}m in ${branch.id} at ${distance}m, lane ${lane}`);
              assert.ok(world.waters.filter(stream => stream.geometry.userData.path?.id === branch.id).every(stream => stream.material.uniforms.cutCount.value === 0), 'main-water cutouts must never erase the shortcut surface');
            }
          }
        }
      });

      await t.test('whirlpool rims enclose their actual course-space collision footprint', () => {
        for (const {mesh, item} of world.hazards.filter(hazard => hazard.item.type === 'whirlpool')) {
          game.distance = item.distance; world.update(game, 1.7); world.group.updateMatrixWorld(true);
          const path = item.path === 'main' ? null : item.path;
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
            const point = vector(sewerPoint(item.distance + Math.sin(angle) * item.radiusZ * .96,
              item.x + Math.cos(angle) * item.radiusX * .96, mesh.position.y, trackId, path));
            mesh.worldToLocal(point);
            const relativeRadius = Math.hypot(point.x, point.z) / item.radius;
            assert.ok(relativeRadius < 1.04, `${item.id}: collision extends ${(relativeRadius - 1).toFixed(3)} beyond its visible rim`);
          }
        }
      });

      await t.test('tunnel scenery remains within the draw budget from the chase camera', t => {
        let peak = 0;
        for (let distance = 0; distance <= game.course.length; distance += 71) {
          game.distance = distance; world.update(game, game.elapsed);
          const y = sewerWaterHeight(0, distance, game.elapsed, trackId);
          const rider = sewerPoint(distance, 0, y, trackId);
          const camera = stepSewerCamera(createSewerCameraState(), {...rider, trackId,
            distance, lane:0, speed:31, settings:{camera:'classic'}}, 1 / 60);
          peak = Math.max(peak, visibleDraws(world.group, camera));
        }
        t.diagnostic(`Peak visible sewer scenery draws: ${peak} (excluding browser-only labels and the rival model).`);
        assert.ok(peak < 250, `tunnel scenery alone requires ${peak} draws`);
      });

      await t.test('switching tracks releases the previous scene resources', () => {
        const previous = resources(world.group), released = new Set();
        for (const resource of [...previous.geometries, ...previous.materials]) resource.addEventListener('dispose', () => released.add(resource));
        const other = gameFixture(trackId === 'sewer-run' ? 'sewer-depths' : 'sewer-run');
        world.update(other, 0);
        for (const resource of [...previous.geometries, ...previous.materials]) assert.ok(released.has(resource), 'old track resource was retained after a track switch');
        assert.ok(resources(world.group).objects.size < 2500, 'scene size remains bounded after changing tracks');
      });
    } finally {
      world.dispose();
    }
  });
}
