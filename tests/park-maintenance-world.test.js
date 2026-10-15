import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWaterworks } from '../src/waterworks.js';
import { parkHeight, PARK_BOUNDS, parkPointBlocked } from '../src/park.js';
import { PARK_MAINTENANCE, maintenanceContains, maintenanceCeilingAt, rectangleContains } from '../src/park-maintenance.js';
import { resolveParkCamera } from '../src/park-camera.js';
import { createParkCameraState, stepParkCamera } from '../src/park-camera-rig.js';
import { ParkMap } from '../src/park-map.js';

const context=new Proxy({}, {get:(_,key)=>key==='measureText'?()=>({width:120}):key.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:()=>true});
function withCanvas(run){const previous=globalThis.document;globalThis.document={createElement:()=>({width:128,height:184,getContext:()=>context})};try{return run();}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}}
function dispose(group){const materials=new Set(),textures=new Set();group.traverse(item=>{item.geometry?.dispose();if(item.material)for(const material of [item.material].flat()){materials.add(material);if(material.map)textures.add(material.map);}});for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();}

test('maintenance room, tunnel and main terrain meet at closed matching floor seams',()=>withCanvas(()=>{
  const world=createWaterworks(),{maintenance}=world;world.group.updateMatrixWorld(true);
  try{
    const ray=new THREE.Raycaster(),floors=[world.group.getObjectByName('unified-collision-terrain'),maintenance.tunnelFloor,maintenance.bayFloor];
    // Exact joins and a grid on both sides prove actual triangles cover each
    // ground contact, rather than merely checking exported rectangle bounds.
    for(const x of [119.999,120,120.001,140,165.999,166,166.001,167.999,168.001,190,218,240,261.99])for(const z of [-17.9,-10,-2.1]){
      ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));const hits=ray.intersectObjects(floors,false);
      assert.ok(hits.length,`no rendered floor at ${x}, ${z}`);
      assert.ok(Math.abs(hits[0].point.y-parkHeight(x,z))<.026,`rendered floor disagrees with riding surface at ${x}, ${z}`);
    }
    assert.equal(maintenance.group.userData.maintenance.sealedFloor,true);
    assert.equal(maintenance.group.userData.maintenance.bayCeiling,PARK_MAINTENANCE.bayCeilingY);
    assert.ok(maintenance.lights.length>=6);
    assert.ok(maintenance.water.length>=4);
    assert.ok(maintenance.group.children.filter(item=>item.isMesh).length<35,'construction detail should be batched');
  }finally{dispose(world.group);}
}));

test('flat riding floors have one visible surface, without a coplanar foundation competing for depth',()=>withCanvas(()=>{
  const world=createWaterworks();world.group.updateMatrixWorld(true);
  try{
    const surfaces=[];world.group.traverse(object=>{if(object.isMesh&&object.visible)surfaces.push(object);});
    const points=[[108.3,-9.1],[88.9,4.1],[115.4,12.7],[119.8,-10]];
    for(const x of [124.7,139.3,157.1,165.8,167.2,177.3,204.7,238.2])for(const z of [-14.3,-8.1,-3.2])points.push([x,z]);
    const ray=new THREE.Raycaster();
    for(const [x,z] of points){
      const height=parkHeight(x,z);ray.set(new THREE.Vector3(x,height+.2,z),new THREE.Vector3(0,-1,0));ray.far=.4;
      const floor=ray.intersectObjects(surfaces.filter(object=>object.userData.terrain),false)[0];
      assert.ok(floor,`missing riding floor at ${x}, ${z}`);
      assert.ok(Math.abs(floor.point.y-height)<.026,`floor differs from collision at ${x}, ${z}`);
      const hits=ray.intersectObjects(surfaces,false).filter(hit=>Math.abs(hit.point.y-floor.point.y)<.002);
      // Adjacent triangles of one floor may both contain an edge. Distinct
      // overlapping meshes are the problem: their colours can alternate per pixel.
      const layers=new Set(hits.map(hit=>hit.object.uuid));
      assert.equal(layers.size,1,`competing floor surfaces at ${x}, ${z}: ${hits.map(hit=>hit.object.name||hit.object.material.color?.getHexString()).join(', ')}`);
    }
  }finally{dispose(world.group);}
}));

test('hidden wall is concealed outside and clears the follow-camera crossing after entry',()=>withCanvas(()=>{
  const world=createWaterworks();
  try{
    assert.equal(world.maintenance.patch.visible,true);
    assert.equal(world.maintenance.patch.material.side,THREE.FrontSide);
    world.update(1,{maintenanceAccess:true});assert.equal(world.maintenance.patch.visible,false);
    const ray=new THREE.Raycaster(new THREE.Vector3(119,3,-10),new THREE.Vector3(1,0,0),0,46);
    world.group.updateMatrixWorld(true);const visible=[];world.group.traverse(item=>{if(item.isMesh&&item.visible)visible.push(item);});
    assert.equal(ray.intersectObjects(visible,false).length,0,'retaining wall must have a genuine opening through the whole passage');
    // The widened room begins at the shared boundary, not a metre beyond it:
    // leftover tunnel sidewalls/roof here would be invisible to collision.
    ray.set(new THREE.Vector3(PARK_MAINTENANCE.bay.minX+.03,3,-10),new THREE.Vector3(0,0,-1));ray.far=16;
    assert.equal(ray.intersectObjects(visible,false).length,0,'throat wall protrudes into the open room');
    ray.set(new THREE.Vector3(PARK_MAINTENANCE.bay.minX+.03,11,-10),new THREE.Vector3(0,1,0));ray.far=9;
    assert.equal(ray.intersectObjects(visible,false).length,0,'low tunnel roof protrudes into the tall room');
    world.update(2,{maintenanceAccess:false});assert.equal(world.maintenance.patch.visible,true);
  }finally{dispose(world.group);}
}));

function assertMaintenanceRay(rider,camera){
  const head={x:rider.x,y:rider.y+1.3,z:rider.z};
  for(let i=0;i<=250;i++){
    const t=i/250,x=head.x+(camera.x-head.x)*t,y=head.y+(camera.y-head.y)*t,z=head.z+(camera.z-head.z)*t;
    assert.ok(rectangleContains(PARK_BOUNDS,x,z)||maintenanceContains(x,z),`camera ray leaves closed room at ${x}, ${z}`);
    assert.ok(y<=maintenanceCeilingAt(x,z)+.001,'camera pierces the roof');
    assert.ok(y>=parkHeight(x,z)+.25,'camera pierces a rideable surface');
    assert.equal(parkPointBlocked(x,y,z,.08),false,'camera crosses a scaffold or rail');
  }
}
test('all camera headings fit the secret passage, its room junction and upper aerials',()=>{
  for(const [x,z,y] of [[121,-10,0],[142,-10,0],[165.9,-10,0],[168.2,-18.5,0],[168.2,-1.5,0],[185,48,0],[258,45,0],[150,-10,9.8],[205,-40,19.7]]){
    const rider={x,y:Math.max(y,parkHeight(x,z)),z};
    for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){
      const camera=resolveParkCamera(x,rider.y,z,{x:x+Math.sin(angle)*5,y:rider.y+2.6,z:z+Math.cos(angle)*5},null,{maintenanceAccess:true});
      assertMaintenanceRay(rider,camera);
    }
  }
});

test('follow camera travels through entry and tunnel without snapping back to the original arena',()=>{
  const state=createParkCameraState();let previous=null;
  for(let x=112;x<=181;x+=.3){
    const frame=stepParkCamera(state,{x,y:0,z:-10,heading:-Math.PI/2,speed:18,maintenanceAccess:x>120},1/60);
    if(previous)assert.ok(frame.position.distanceTo(previous)<1,'camera jumps at the hidden wall or room junction');
    if(x>121)assertMaintenanceRay({x,y:0,z:-10},frame.position);
    previous=frame.position.clone();
  }
  assert.ok(state.position.x>175,'camera follows the rider into the new room');
});

test('minimap reveals the room only while inside and keeps the rider within its drawing area',()=>withCanvas(()=>{
  const map=new ParkMap({getContext:()=>context});assert.equal(map.maintenancePlan,undefined);
  map.update({x:0,z:0,heading:0});assert.equal(map.maintenancePlan,undefined);
  map.update({x:240,z:45,heading:0,maintenanceAccess:true});
  const point=map.point(240,45,true);assert.ok(point.x>4&&point.x<124&&point.z>4&&point.z<180);
}));
