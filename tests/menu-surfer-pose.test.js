import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CHARACTERS,OUTFITS,createSurfer,disposeSurfer } from '../src/appearance.js';
import { arrangeMenuSurfer,poseMenuSurfer } from '../src/menu-surfer.js';

const ctx=new Proxy({},{get:(_,key)=>['createLinearGradient','createRadialGradient'].includes(key)?()=>({addColorStop(){}}):()=>{},set:()=>true});
function withSurfer(profile,run){const saved=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>ctx})};let surfer;try{surfer=createSurfer(profile);return run(surfer);}finally{if(surfer)disposeSurfer(surfer);if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}}
function points(object){const attribute=object.geometry.attributes.position;return Array.from({length:attribute.count},(_,i)=>object.localToWorld(new THREE.Vector3().fromBufferAttribute(attribute,i)));}

test('all48 menu riders rest actual hands on upright board with fixed limbs and grounded feet',t=>{
  let count=0,maxContact=0,minWristDot=1;
  for(const character of Object.keys(CHARACTERS))for(const outfit of Object.keys(OUTFITS))withSurfer({character,outfit},surfer=>{
    arrangeMenuSurfer(surfer);let feet;
    for(const time of [0,1,2,4]){
      const target=poseMenuSurfer(surfer,time),landmarks=surfer.landmarks;surfer.rig.updateMatrixWorld(true);
      const gap=landmarks.rightFingertip.distanceTo(target);maxContact=Math.max(maxContact,gap);assert.ok(gap<1e-6,`${character}/${outfit}: hand misses board ${gap}`);
      const support=surfer.board.localToWorld(new THREE.Vector3(0,.153,-1.11));support.y+=.024;support.z-=.013;
      assert.ok(landmarks.rightElbow.distanceTo(support)<.0005,`${character}/${outfit}: forearm loses nose support`);
      for(const side of ['left','right'])for(const [a,b,length]of [['Shoulder','Elbow',.32],['Elbow','Wrist',.29],['Hip','Knee',.478],['Knee','Ankle',.45]])assert.ok(Math.abs(landmarks[side+a].distanceTo(landmarks[side+b])-length)<1e-6,`${character}/${outfit}: stretched ${side}${a}`);
      const forearm=landmarks.rightWrist.clone().sub(landmarks.rightElbow).normalize(),hand=landmarks.rightFingertip.clone().sub(landmarks.rightWrist).normalize(),dot=forearm.dot(hand);minWristDot=Math.min(minWristDot,dot);assert.ok(dot>.2,`${character}/${outfit}: wrist doubles back (${dot})`);
      const now=[landmarks.leftAnkle.toArray(),landmarks.rightAnkle.toArray()];if(feet)assert.deepEqual(now,feet,'Breathing never lifts either planted foot');else feet=now;
      assert.ok(Math.abs(landmarks.leftSole.y-.017)<1e-6);assert.ok(Math.abs(landmarks.rightSole.y-.017)<1e-6);
      const bounds=new THREE.Box3().setFromObject(surfer.boardPivot);assert.ok(Math.abs(bounds.min.y-.013)<1e-6,'Upright board tail stays on the floor');count++;
    }
  });
  assert.equal(count,192);t.diagnostic(`192 poses: maximum hand/board target gap ${(maxContact*1000).toFixed(6)}mm; minimum forward wrist alignment ${minWristDot.toFixed(3)}.`);
});

test('menu lean keeps shirt sleeves and trouser seat sewn and all vertices finite',()=>{
  for(const character of Object.keys(CHARACTERS))for(const outfit of Object.keys(OUTFITS))withSurfer({character,outfit},surfer=>{
    arrangeMenuSurfer(surfer);poseMenuSurfer(surfer,1.4);surfer.rig.updateMatrixWorld(true);
    surfer.rider.traverseVisible(object=>{if(object.geometry)for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
    const torso=surfer.rider.getObjectByName('torso');
    for(const side of ['left','right']){
      const sleeve=surfer.rider.getObjectByName(side+'-sleeve');if(sleeve&&torso){const a=points(torso),b=points(sleeve);torso.userData.armholes[side].forEach((index,i)=>assert.ok(a[index].distanceTo(b[i])<1e-6,`${character}/${outfit}: open ${side} sleeve`));}
      const leg=surfer.rider.getObjectByName(side+'-trousers')||surfer.rider.getObjectByName(side+'-shorts'),other=surfer.rider.getObjectByName((side==='left'?'right':'left')+'-trousers')||surfer.rider.getObjectByName((side==='left'?'right':'left')+'-shorts'),seat=surfer.rider.getObjectByName('trouser-yoke');
      if(leg&&other&&seat){const connected=[...points(other).slice(0,8),...points(seat)];for(const p of points(leg).slice(0,8))assert.ok(Math.min(...connected.map(q=>q.distanceTo(p)))<1e-6,`${character}/${outfit}: open trouser seat`);}
    }
  });
});
