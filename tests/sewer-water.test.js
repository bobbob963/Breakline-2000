import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SEWER_TRACKS,createSewerCourse,sewerPoint,sewerWaterHeight } from '../src/sewer-course.js';
import { createSewerCameraState,stepSewerCamera } from '../src/sewer-camera-rig.js';
import { waterMaterial,waveMaterial,closingWaveGeometry,updateClosingWave,sampleSewerCurl,createSewerWaveCrash,updateSewerWaveCrash } from '../src/sewer-water.js';

const style={water:0x315f45,foam:0xb6cb91,fog:0x2b372c,light:0xf4c38c};

test('canal and breaking wave use one opaque world-space liquid program and compatible masks',()=>{
  const cuts=[new THREE.Vector4(2,3,7,11)],ends=[new THREE.Vector2(1,0)];
  const canal=waterMaterial(style,cuts,ends),wave=waveMaterial(style);
  assert.equal(canal.vertexShader,wave.vertexShader);assert.equal(canal.fragmentShader,wave.fragmentShader);
  assert.equal(canal.userData.waterCoordinates,'world');assert.deepEqual(canal.uniforms.base.value,wave.uniforms.base.value);
  for(const material of [canal,wave]){
    assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);assert.equal(material.opacity,1);
    assert.equal(material.uniforms.holes.value.length,8);assert.equal(material.uniforms.holeAngles.value.length,8);
    assert.equal(material.uniforms.cuts.value.length,32);assert.equal(material.uniforms.cutEnds.value.length,32);
    assert.equal(material.uniforms.cutWidth.value,3.80);assert.deepEqual(material.defaultAttributeValues.foamWeight,[0]);
  }
  assert.equal(canal.uniforms.cutCount.value,1);assert.deepEqual(canal.uniforms.cuts.value[0],cuts[0]);
  assert.equal(wave.uniforms.cutCount.value,0);canal.uniforms.time.value=3;assert.equal(wave.uniforms.time.value,0);
  canal.dispose();wave.dispose();
});

test('curl starts as a low shoulder, rolls over a hollow opening, then tumbles back into the canal',()=>{
  const peak=phase=>Math.max(...Array.from({length:101},(_,i)=>sampleSewerCurl(.5,i/100,phase).lift));
  assert.ok(peak(0)<.7,'untriggered water is a low swell');
  assert.ok(peak(.15)>peak(0)&&peak(.15)<peak(.4),'shoulder grows progressively');
  assert.ok(peak(.7)>6.4,'the developed curl has a generous hollow roof');
  const openLip=sampleSewerCurl(.5,1,.7),fallingLip=sampleSewerCurl(.5,1,.91);
  assert.ok(openLip.lane<0,'lip rolls past the centre line');assert.ok(fallingLip.lift<openLip.lift,'the lip tumbles down before the deadline');
  assert.ok(peak(1)<.25,'the wave has fallen at the collision deadline');
});

test('wave attachments have exact canal height and zero lift slope at the bank and both ends',()=>{
  for(const phase of [0,.15,.4,.7,.91,1])for(const across of [0,.2,.5,.8,1]){
    assert.equal(sampleSewerCurl(0,across,phase).lift,0);assert.equal(sampleSewerCurl(1,across,phase).lift,0);
    const epsilon=1e-5;
    assert.ok(sampleSewerCurl(epsilon,across,phase).lift/epsilon<.01);
    assert.ok(sampleSewerCurl(1-epsilon,across,phase).lift/epsilon<.01);
    assert.equal(sampleSewerCurl(across,0,phase).lift,0);
    assert.ok(sampleSewerCurl(across,epsilon,phase).lift/epsilon<.01);
  }
});

test('rounded barrels leave the chase camera and a 2.8m-high exit sightline open before their deadline',()=>{
  const geometry=closingWaveGeometry(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
  mesh.updateMatrixWorld(true);
  for(const track of SEWER_TRACKS)for(const item of createSewerCourse(track.id).hazards.filter(hazard=>hazard.type==='barrel'))for(const phase of [.2,.4,.6,.8,.9]){
    updateClosingWave(geometry,item,track.id,10,phase);
    for(const u of [0,.25,.5,.75,.9]){
      const distance=item.startDistance+(item.endDistance-item.startDistance)*u,point=sewerPoint(distance,0,sewerWaterHeight(0,distance,10,track.id),track.id);
      const camera=stepSewerCamera(createSewerCameraState(),{...point,distance,lane:0,trackId:track.id},1/60);
      const exit=sewerPoint(item.endDistance+4,0,2.8,track.id);
      for(const target of [camera.look,new THREE.Vector3(exit.x,exit.y,exit.z)]){
        const delta=target.clone().sub(camera.position),ray=new THREE.Raycaster(camera.position,delta.clone().normalize(),.05,delta.length());
        assert.equal(ray.intersectObject(mesh).length,0,`${track.id} barrel ${item.distance} phase ${phase} position ${u}: curl must not form an end wall`);
      }
    }
  }
  geometry.dispose();material.dispose();
});

test('animated barrel mesh joins the actual curved water surface on both tracks without a raised rim',()=>{
  const geometry=closingWaveGeometry(),count=geometry.attributes.position.count;
  const {rows,sectors}=geometry.userData;
  for(const track of SEWER_TRACKS)for(const item of createSewerCourse(track.id).hazards.filter(hazard=>hazard.type==='barrel'))for(const time of [0,13])for(const phase of [0,.35,.8,1]){
    updateClosingWave(geometry,item,track.id,time,phase);
    assert.equal(geometry.attributes.position.count,count);
    assert.ok([...geometry.attributes.position.array,...geometry.attributes.normal.array].every(Number.isFinite));
    for(let row=0;row<=rows;row++)for(let side=0;side<=sectors;side++){
      if(row!==0&&row!==rows&&side!==0)continue;
      const u=row/rows,distance=item.startDistance+(item.endDistance-item.startDistance)*u,sample=sampleSewerCurl(u,side/sectors,phase);
      const lane=sample.lane*(item.width/2+.6),point=sewerPoint(distance,lane,sewerWaterHeight(lane,distance,time,track.id),track.id);
      const index=row*(sectors+1)+side,actual=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,index);
      assert.ok(actual.distanceTo(new THREE.Vector3(point.x,point.y,point.z))<.00015,'every attachment lies on the shared water, including during animation');
    }
  }
  geometry.dispose();
});

test('collapse stays as low whitewater and soft spray with stable scene resources',()=>{
  const trackId='sewer-run',item=createSewerCourse(trackId).hazards.find(hazard=>hazard.type==='barrel'),group=createSewerWaveCrash(style,item);
  const children=[...group.children],resources=children.map(object=>[object.geometry,object.material]);
  updateSewerWaveCrash(group,item,trackId,10,.99);assert.equal(group.visible,false);
  for(const time of [10,10.3,11,14]){
    updateSewerWaveCrash(group,item,trackId,time,1);assert.equal(group.visible,true);assert.deepEqual(group.children,children);
    for(const [index,object] of group.children.entries()){
      assert.deepEqual([object.geometry,object.material],resources[index]);assert.equal(object.material.transparent,true);assert.equal(object.material.depthWrite,false);
      assert.ok(object.position.y<1.2,'spray stays close to the canal instead of becoming a standing wall');
      assert.ok([...object.position].every(Number.isFinite));
    }
  }
  assert.ok(group.userData.foamMaterial.opacity<.15,'the collapse settles back to a soft wake');
  updateSewerWaveCrash(group,item,trackId,15,0);assert.equal(group.visible,false);assert.equal(group.userData.closedAt,null);
});
