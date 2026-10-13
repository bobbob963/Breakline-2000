import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { waveHeight,stormBarrel,barrelCrossSection,barrelClosureProgress,barrelSurfacePoint,barrelShellDistance,sampleStormBarrel,sweepStormBarrel } from '../src/storm-waves.js';
import { renderedWaveHeight } from '../src/ocean-surface.js';
import { BARREL_ARC_SEGMENTS,BARREL_LENGTH_SEGMENTS,createBarrelGeometry,updateBarrelGeometry,createStormBarrels,resolveBarrelCamera } from '../src/barrel-wave.js';

test('both barrel skins meet the real wave at every foot throughout opening and collapse',()=>{
  let checked=0;
  for(const index of [0,3,26])for(const time of [0,14,120,1200])for(const progress of [0,.25,.5,.8,1]){
    const barrel=stormBarrel(index),run={index,deadline:time-progress*1.2,closeDuration:1.2};
    for(const fraction of [0,.03,.18,.5,.84,.97,1])for(const outer of [false,true]){
      const z=-barrel.startDistance-barrel.length*fraction,point=barrelSurfacePoint(barrel,z,1,time,outer,run);
      assert.ok(Math.abs(point.y-waveHeight(point.x,z,time))<1e-12,`floating foot at ${index}/${time}/${progress}/${fraction}/${outer}`);checked++;
    }
  }
  assert.equal(checked,840);
});

test('visible feet attach to coarse ocean triangles across moving ocean chunks',()=>{
  const geometry=createBarrelGeometry(),columns=BARREL_ARC_SEGMENTS+1,layerSize=(BARREL_LENGTH_SEGMENTS+1)*columns;
  for(const time of [3,29,115])for(const index of [0,5])for(const closingProgress of [0,.5,1]){
    const barrel=stormBarrel(index),oceanZ=Math.floor(-barrel.centerDistance/30)*30-90;
    updateBarrelGeometry(geometry,barrel,time,{index,deadline:time-closingProgress*1.2},oceanZ);
    const points=geometry.attributes.position;
    for(let row=0;row<=BARREL_LENGTH_SEGMENTS;row++)for(const layer of [0,1]){
      const i=layer*layerSize+row*columns+BARREL_ARC_SEGMENTS;
      const x=points.getX(i),z=points.getZ(i),y=points.getY(i);
      assert.ok(Math.abs(y-renderedWaveHeight(x,z,time,oceanZ))<2e-6,'drawn foot floats above the polygonal ocean');
    }
  }
  geometry.dispose();
});

test('timing stays open until its own deadline and supports render/game collections consistently',()=>{
  const barrel=stormBarrel(2),run={index:2,deadline:20,closeDuration:2};
  for(const input of [run,[run],new Map([[2,run]]),{2:run},index=>index===2?run:null]){
    assert.equal(barrelClosureProgress(barrel,19,input),0);
    assert.equal(barrelClosureProgress(barrel,20,input),0);
    assert.equal(barrelClosureProgress(barrel,21,input),.5);
    assert.equal(barrelClosureProgress(barrel,22,input),1);
    assert.equal(barrelClosureProgress(stormBarrel(3),25,input),0);
  }
  assert.equal(barrelClosureProgress(barrel,100),0,'untriggered distant barrels must not close');
});

test('multiple view rays hit exactly the falling visible sheet used by collision',()=>{
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});let checked=0;
  for(const index of [0,4])for(const time of [12,200])for(const progress of [0,.35,.7,.93]){
    const barrel=stormBarrel(index),run={index,deadline:time-progress*1.2};
    const geometry=updateBarrelGeometry(createBarrelGeometry(),barrel,time,run),mesh=new THREE.Mesh(geometry,material);
    mesh.updateMatrixWorld(true);
    for(const fraction of [.25,.5,.75]){
      const z=-barrel.startDistance-barrel.length*fraction,s=barrelCrossSection(barrel,z,time,run);
      for(const x of [s.centerX-2,s.centerX,s.centerX+2]){
        const hits=new THREE.Raycaster(new THREE.Vector3(x,14,z),new THREE.Vector3(0,-1,0),0,16).intersectObject(mesh,false);
        assert.ok(hits.length,'the collapsing roof disappeared');
        for(const hit of hits)assert.ok(barrelShellDistance(s,hit.point.x,hit.point.y)<1e-5,'drawn and physical sheet disagree');
        checked++;
      }
    }
    geometry.dispose();
  }
  material.dispose();assert.equal(checked,144);
});

test('deadline alone never kills but physical collapse hits a slow rider in the tube',()=>{
  const barrel=stormBarrel(0),run={index:0,deadline:10,closeDuration:1.2},z=-barrel.centerDistance;
  const s=barrelCrossSection(barrel,z,10),position={x:s.centerX,y:waveHeight(s.centerX,z,10),z};
  assert.equal(sampleStormBarrel(position.x,position.y,z,10,run).colliding,false,'deadline caused invisible damage');
  const impact=sweepStormBarrel(position,position,10,11.2,run);
  assert.ok(impact?.colliding,'closing water missed a rider standing beneath it');
  assert.ok(impact.section.closingProgress>0&&impact.section.closingProgress<1,'physical impact must occur during the visible fall');
  for(const safe of [{x:12,y:waveHeight(12,z,10),z},{x:s.centerX,y:14,z},{x:s.centerX,y:1,z:-barrel.endDistance-2}]){
    assert.equal(sweepStormBarrel(safe,safe,10,12,run),null,'escaping the visible sheet should remain safe');
  }
});

test('camera follows the lowering roof and barrel resources dispose cleanly',()=>{
  const barrel=stormBarrel(0),time=11,run={index:0,deadline:10,closeDuration:2},z=-barrel.centerDistance;
  const s=barrelCrossSection(barrel,z,time,run),camera=new THREE.Vector3(s.centerX,s.centerY+2,z);
  const before=camera.y;resolveBarrelCamera(camera,barrel.centerDistance,time,run);
  assert.ok(camera.y<before);assert.ok(camera.y>waveHeight(camera.x,z,time));
  const render=createStormBarrels();render.update(barrel.centerDistance,time,.7,true,run,-300);
  let disposed=0;for(const mesh of render.group.children)mesh.geometry.addEventListener('dispose',()=>disposed++);
  const count=render.group.children.length;render.dispose();
  assert.equal(disposed,count);assert.equal(render.group.children.length,0);
});
