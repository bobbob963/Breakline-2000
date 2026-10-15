import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARK_MAINTENANCE, MAINTENANCE_SOLIDS } from './park-maintenance.js';
import { parkHeight } from './park.js';

const mesh=(group,geometry,material,x=0,y=0,z=0)=>{
  const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);group.add(object);return object;
};
const box=(group,material,x,y,z,w,h,d)=>mesh(group,new THREE.BoxGeometry(w,h,d),material,x,y,z);
function beam(group,material,a,b,radius=.12){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const object=mesh(group,new THREE.CylinderGeometry(radius,radius,delta.length(),6),material);
  object.position.copy(start.add(end).multiplyScalar(.5));object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return object;
}
function staticBatches(group,preserve){
  const batches=new Map();
  for(const object of [...group.children]){
    if(!object.isMesh||preserve.has(object))continue;
    object.updateMatrix();const geometry=object.geometry.clone().applyMatrix4(object.matrix),key=object.material.uuid;
    if(!batches.has(key))batches.set(key,{material:object.material,geometries:[]});
    batches.get(key).geometries.push(geometry);object.geometry.dispose();group.remove(object);
  }
  for(const {material,geometries} of batches.values()){
    const geometry=mergeGeometries(geometries,false);
    if(geometry){const object=mesh(group,geometry,material);object.name='maintenance-construction-batch';}
    for(const source of geometries)source.dispose();
  }
}

// The maintenance geometry uses the same footprint and exact ramp heightfield
// as collision. Props are kept above the riding space or on collidable posts.
export function createParkMaintenance(materials){
  const {concrete,paleConcrete,damp,dark,metal,rust,darkRust,pale,yellow,lamp,flowingWater,addTerrain,sign}=materials;
  const {entrance,tunnel,bay,ceilingY}=PARK_MAINTENANCE;
  const group=new THREE.Group();group.name='waterworks-secret-maintenance-bay';
  const preserve=new Set(),water=[],lights=[],floorY=PARK_MAINTENANCE.floorY;
  const safetyPaint=new THREE.MeshLambertMaterial({color:0xd9b33f,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,side:THREE.DoubleSide});
  const fadedOrange=new THREE.MeshLambertMaterial({color:0xba6e38,side:THREE.DoubleSide});
  const paint=(points,material=safetyPaint)=>{
    const outline=points.map(([x,z])=>new THREE.Vector2(x,z)),geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(([x,z])=>[x,parkHeight(x,z)+.028,z]),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(([x,z])=>[x*.1,z*.1]),2));
    geometry.setIndex(THREE.ShapeUtils.triangulateShape(outline,[]).flat());geometry.computeVertexNormals();
    return mesh(group,geometry,material);
  };
  // Floors abut at x166; their solid foundations overlap underneath the seam.
  // Keep the foundation top below the riding skin. A coplanar top flickers
  // through the textured floor as the camera moves, including at the entrance.
  const foundationTop=floorY-.15;
  const tunnelFloor=addTerrain(group,{minX:entrance.x,maxX:bay.minX,minZ:tunnel.minZ,maxZ:tunnel.maxZ},'maintenance-tunnel-collision-terrain');
  const bayFloor=addTerrain(group,bay,'maintenance-bay-collision-terrain');
  preserve.add(tunnelFloor);preserve.add(bayFloor);
  box(group,damp,(entrance.x+bay.minX)/2,foundationTop-1.6,(tunnel.minZ+tunnel.maxZ)/2,bay.minX-entrance.x+1,3.2,tunnel.maxZ-tunnel.minZ+2);
  box(group,damp,(bay.minX+bay.maxX)/2,foundationTop-1.6,(bay.minZ+bay.maxZ)/2,bay.maxX-bay.minX+2,3.2,bay.maxZ-bay.minZ+2);

  // A regular, stained concrete repair patch hides the entrance from the basin.
  // Its back is open; it also vanishes while the follow camera crosses the wall.
  const patchMaterial=damp.clone();patchMaterial.side=THREE.FrontSide;
  const patch=mesh(group,new THREE.PlaneGeometry(tunnel.maxZ-tunnel.minZ,ceilingY+3),patchMaterial,entrance.x-.018,(ceilingY-3)/2,entrance.z);
  patch.rotation.y=-Math.PI/2;patch.name='maintenance-hidden-wall-patch';preserve.add(patch);
  const seamMaterial=new THREE.MeshLambertMaterial({color:0x555e52,side:THREE.FrontSide});
  const patchSeam=mesh(group,new THREE.PlaneGeometry(entrance.halfWidth*2-.6,.055),seamMaterial,entrance.x-.023,2.15,entrance.z);
  patchSeam.rotation.y=-Math.PI/2;patchSeam.name='maintenance-wall-repair-seam';preserve.add(patchSeam);
  // The small paint mark is a discoverable hint, never a menu marker or portal.
  const hint=sign(group,'M-02',entrance.x-.027,3.9,entrance.z+3.6,2.4,.72,-Math.PI/2,'#9e9d83');preserve.add(hint);

  const tunnelLength=bay.minX-entrance.x,tunnelX=(entrance.x+bay.minX)/2,tunnelZ=(tunnel.minZ+tunnel.maxZ)/2;
  const throatStart=entrance.x,throatLength=bay.minX-throatStart,throatX=(throatStart+bay.minX)/2;
  for(const z of [tunnel.minZ-1,tunnel.maxZ+1])box(group,damp,throatX,ceilingY/2-1,z,throatLength,ceilingY+2,2);
  box(group,damp,throatX,ceilingY+.7,tunnelZ,throatLength,1.4,tunnel.maxZ-tunnel.minZ+4);
  for(let x=entrance.x+10;x<bay.minX;x+=12){
    for(const z of [tunnel.minZ+.18,tunnel.maxZ-.18])box(group,metal,x,ceilingY/2,z,.24,ceilingY,.22);
    box(group,metal,x,ceilingY-.15,tunnelZ,.24,.3,tunnel.maxZ-tunnel.minZ);
    box(group,dark,x,ceilingY-.55,tunnelZ,4.5,.35,1.05);
    const light=box(group,lamp,x,ceilingY-.76,tunnelZ,3.7,.08,.66);lights.push(light);
  }
  // Twin supply lines run continuously through the throat into the bay.
  for(const z of [tunnel.minZ+1.1,tunnel.minZ+2.1])beam(group,darkRust,[entrance.x,10.6,z],[bay.minX+7,10.6,z],.22);
  // Low wall plinths close all shell-to-floor joins without covering the route.
  for(const z of [tunnel.minZ-.2,tunnel.maxZ+.2])box(group,darkRust,throatX,.28,z,throatLength,.56,.4);
  // Broad, worn service markings read at the normal chase-camera distance.
  // They are flush paint, leaving both the board and the camera route clear.
  for(let x=entrance.x+5;x<bay.minX+34;x+=12){
    const z=entrance.z;
    paint([[x-2,z-1.1],[x+.3,z-1.1],[x+.3,z-2.2],[x+3.4,z],[x+.3,z+2.2],[x+.3,z+1.1],[x-2,z+1.1]]);
  }
  for(const z of [entrance.z-4.5,entrance.z+4.5])for(let x=entrance.x+2;x<bay.minX+35;x+=8)paint([[x,z],[x+5,z],[x+5,z+.28],[x,z+.28]]);

  const cx=(bay.minX+bay.maxX)/2,cz=(bay.minZ+bay.maxZ)/2,w=bay.maxX-bay.minX,l=bay.maxZ-bay.minZ;
  const roof=PARK_MAINTENANCE.bayCeilingY;
  box(group,damp,bay.maxX+1,roof/2-1,cz,2,roof+2,l+4);
  for(const z of [bay.minZ-1,bay.maxZ+1])box(group,concrete,cx,roof/2-1,z,w+4,roof+2,2);
  // West wall is genuinely open where the entrance tunnel meets the room.
  for(const [start,end] of [[bay.minZ,tunnel.minZ],[tunnel.maxZ,bay.maxZ]])box(group,damp,bay.minX-1,roof/2-1,(start+end)/2,2,roof+2,end-start);
  box(group,concrete,bay.minX-1,(ceilingY+roof)/2,tunnelZ,2,roof-ceilingY,tunnel.maxZ-tunnel.minZ);
  // A sealed high roof with raised skylight panels gives the secret area a
  // distinct enclosed turbine-hall silhouette, without untextured voids.
  box(group,dark,cx,roof+.45,cz,w+4,.9,l+4);
  for(const z of [bay.minZ+17,bay.minZ+49,bay.maxZ-49,bay.maxZ-17]){
    box(group,darkRust,cx,roof-.85,z,w,.65,.7);
    box(group,metal,cx,roof-2.8,z,w,.28,.32);
    for(let x=bay.minX+2;x<bay.maxX-10;x+=12){
      beam(group,rust,[x,roof-.8,z],[x+12,roof-2.8,z],.1);
      beam(group,rust,[x,roof-2.8,z],[x+12,roof-.8,z],.1);
    }
    box(group,dark,cx,roof-3.1,z,14,.45,1.3);
    const light=box(group,lamp,cx,roof-3.36,z,12,.07,.85);lights.push(light);
    // Painted pale ceiling bays read as warm industrial skylights.
    box(group,paleConcrete,cx,roof-.08,z+7,34,.08,7);
    for(let x=cx-16;x<=cx+16;x+=8)box(group,metal,x,roof-.14,z+7,.12,.12,7);
  }
  for(const z of [bay.minZ+1,bay.maxZ-1]){
    beam(group,darkRust,[bay.minX+2,15,z],[bay.maxX-2,15,z],.55);
    for(let x=bay.minX+8;x<bay.maxX;x+=16){
      const collar=mesh(group,new THREE.TorusGeometry(.58,.09,4,10),metal,x,15,z);collar.rotation.y=Math.PI/2;
    }
  }

  // Scaffolding uses the shared collision posts. The platform and braces stay
  // overhead; the long clear aisle below still admits a board and chase camera.
  for(const solid of MAINTENANCE_SOLIDS){
    if(!solid.id.includes('scaffold'))continue;
    const x=solid.x,z=solid.z,top=solid.baseY+solid.height;
    box(group,darkRust,(bay.minX+x)/2,top+.18,z,x-bay.minX,.35,6.5);
    for(const dz of [-2.9,2.9]){
      beam(group,metal,[bay.minX+.2,top+1.35,z+dz],[x,top+1.35,z+dz],.08);
      beam(group,metal,[x,top,z+dz],[x,top+1.35,z+dz],.08);
    }
    for(let y=top+.5;y<=top+2.2;y+=.45)box(group,yellow,bay.minX+1.3,y,z,1.4,.22,3.2);
    const cone=mesh(group,new THREE.ConeGeometry(.4,1.05,6),yellow,x-1,top+.9,z+1.7);
    cone.name='maintenance-construction-cone';
  }
  // Unfinished shuttering, exposed rebar and work lamps sit above the retaining
  // walls. Their silhouette gives the ramps a construction-site character.
  for(const z of [bay.minZ+.3,bay.maxZ-.3])for(let x=bay.minX+12;x<bay.maxX-4;x+=9){
    box(group,darkRust,x,8.8,z,7.8,1.2,.2);
    beam(group,metal,[x-2,8.2,z],[x-2,11.7,z],.06);
    beam(group,metal,[x+2,8.2,z],[x+2,10.8,z],.06);
  }
  // Stored rusty pipe sections hang from supports on the west wall rather
  // than becoming uncollidable obstacles across the playable floor.
  for(const z of [bay.minZ+10,bay.maxZ-10])for(const y of [10.3,12.3]){
    const stored=mesh(group,new THREE.CylinderGeometry(.65,.65,12,12,1,true),darkRust,bay.minX+1.9,y,z);stored.rotation.x=Math.PI/2;
    for(const dz of [-6,6]){const mouth=mesh(group,new THREE.RingGeometry(.5,.65,12),metal,bay.minX+1.9,y,z+dz);mouth.material.side=THREE.DoubleSide;}
    for(const dz of [-4,4])beam(group,metal,[bay.minX+.1,y-.7,z+dz],[bay.minX+3,y-.7,z+dz],.1);
  }
  sign(group,'MAINTENANCE / PHASE 02',bay.maxX-.08,13.3,cz,45,4,-Math.PI/2,'#d5c37c');
  for(const z of [-48,46]){
    const panel=mesh(group,new THREE.PlaneGeometry(18,5.6),fadedOrange,bay.maxX-.035,12.6,z);panel.rotation.y=-Math.PI/2;
    sign(group,'HARD HAT AREA',bay.maxX-.055,12.6,z,16,2.7,-Math.PI/2,'#e1d5a5');
  }
  // Wall-side construction boards give the room its own warm palette.
  for(const z of [bay.minZ+.04,bay.maxZ-.04]){
    const panel=mesh(group,new THREE.PlaneGeometry(24,3.8),fadedOrange,bay.minX+19,7.3,z);
    panel.rotation.y=z>0?Math.PI:0;
    sign(group,'WORK IN PROGRESS',bay.minX+19,7.3,z+(z>0?-.015:.015),22,2.4,z>0?Math.PI:0,'#ead6ad');
  }
  sign(group,'UNDER CONSTRUCTION',cx,13.2,bay.minZ+.06,37,3.7,0,'#d3c081');
  sign(group,'MAIN BASIN',bay.minX+.06,9.7,tunnelZ,12,1.5,Math.PI/2,'#d5d1aa');

  // Dark drainage strips and a thin continuous flow connect the hall back to
  // the main canal. All water sits over a closed, collision-matched floor.
  for(const z of [tunnel.minZ+.9,tunnel.maxZ-.9]){
    box(group,dark,tunnelX,.012,z,tunnelLength,.022,1.15);
    const flow=box(group,flowingWater,tunnelX,.029,z,tunnelLength,.012,.74);water.push(flow);preserve.add(flow);
    for(let x=entrance.x+3;x<bay.minX;x+=5)box(group,metal,x,.041,z,.12,.025,1.15);
  }
  for(const z of [bay.minZ+1,bay.maxZ-1]){
    box(group,dark,cx,.012,z,w-2,.022,1.3);
    const flow=box(group,flowingWater,cx,.029,z,w-2,.012,.78);water.push(flow);preserve.add(flow);
  }
  for(const light of lights)preserve.add(light);
  staticBatches(group,preserve);
  group.userData.maintenance={footprint:{tunnel:{...tunnel},bay:{...bay}},sealedFloor:true,tunnelCeiling:ceilingY,bayCeiling:roof,entry:'airborne-hidden-wall'};
  return {group,patch,tunnelFloor,bayFloor,water,lights,update(time,game){
    const inPassage=!!game?.maintenanceAccess;
    patch.visible=!inPassage;patchSeam.visible=!inPassage;hint.visible=!inPassage;
  }};
}
