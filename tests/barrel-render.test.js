import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stormBarrel, barrelCrossSection } from '../src/storm-waves.js';
import { createBarrelGeometry, updateBarrelGeometry, createStormBarrels, resolveBarrelCamera } from '../src/barrel-wave.js';

test('visible inner water sheet follows physical barrel radius at early and late difficulty', () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
  let checked = 0;
  for (const time of [0, 95, 240, 1500]) for (const index of [0, 3, 20]) {
    const barrel = stormBarrel(index), geometry = updateBarrelGeometry(createBarrelGeometry(), barrel, time);
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    const mesh = new THREE.Mesh(geometry, material);mesh.updateMatrixWorld(true);
    for (const fraction of [.3125, .4375, .5625, .6875]) {
      const z=-(barrel.startDistance+barrel.length*fraction),s=barrelCrossSection(barrel,z,time);
      for (const angle of [.16,.63,1.12,1.72,2.29,2.85]) {
        const origin=new THREE.Vector3(s.centerX,s.centerY,z),direction=new THREE.Vector3(Math.cos(angle),Math.sin(angle),0);
        const hit=new THREE.Raycaster(origin,direction,0,10).intersectObject(mesh,false)[0];
        assert.ok(hit,`visible inner wall missing at time ${time}, index ${index}, angle ${angle}`);
        assert.ok(Math.abs(hit.distance-s.innerRadius)<.02,`render/physics radius mismatch: ${hit.distance} vs ${s.innerRadius}`);
        checked++;
      }
    }
    geometry.dispose();
  }
  material.dispose();assert.equal(checked,288);
});

test('barrel retains open water floor and unobstructed entry and exit', () => {
  const barrel=stormBarrel(0),time=12,geometry=updateBarrelGeometry(createBarrelGeometry(),barrel,time);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
  const s=barrelCrossSection(barrel,-barrel.centerDistance,time),origin=new THREE.Vector3(s.centerX,s.centerY,-barrel.centerDistance);
  for(const direction of [new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]){
    assert.equal(new THREE.Raycaster(origin,direction,0,barrel.length+10).intersectObject(mesh,false).length,0,'a cap or bottom closes the barrel');
  }
  mesh.geometry.dispose();mesh.material.dispose();
});

test('chase camera is held inside visible roof without moving a clear camera', () => {
  const barrel=stormBarrel(0),time=40,z=-barrel.centerDistance,s=barrelCrossSection(barrel,z,time);
  const clear=new THREE.Vector3(s.centerX+.6,s.centerY-.5,z),before=clear.clone();
  resolveBarrelCamera(clear,barrel.centerDistance,time);assert.ok(clear.distanceTo(before)<1e-10);
  const roof=new THREE.Vector3(s.centerX+.1,s.centerY+s.innerRadius+1,z);
  resolveBarrelCamera(roof,barrel.centerDistance,time);
  assert.ok(Math.hypot(roof.x-s.centerX,roof.y-s.centerY)<s.innerRadius-.5);
});

test('endless barrel renderer recycles passed sections and disables outside Storm', () => {
  const barrels=createStormBarrels();
  for(const distance of [0,180,950,7500,100000]){
    barrels.update(distance,100,.5,true);
    assert.ok(barrels.group.children.length<=6,'endless run retained old geometry');
    assert.ok(barrels.group.children.length>=2,'upcoming breaking wave is missing');
  }
  barrels.update(100000,100,.5,false);assert.equal(barrels.group.visible,false);
  barrels.group.traverse(o=>o.geometry?.dispose());
  const materials=new Set(barrels.group.children.map(o=>o.material));materials.forEach(m=>m.dispose());
});
