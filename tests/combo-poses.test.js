import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CHARACTERS, OUTFITS, createSurfer, disposeSurfer } from '../src/appearance.js';
import { sampleRiderTrick } from '../src/rider-pose.js';
import { TRICKS } from '../src/game.js';

const MOVES={crosswind:'grab',flipcatch:'grab',decksweep:'method',coil360:'spin360',crosscut:'tweak'};
const BOARD_FIELDS=['boardBank','boardPitch','boardLift','boardSide','boardBack'];
const ctx=new Proxy({}, {get:(_,k)=>k.includes('Gradient')?()=>({addColorStop(){}}):()=>{},set:()=>true});
function make(character='jax',outfit='yardcrew'){
  const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{return createSurfer({character,outfit,boardDesign:'tribal',boardColor:'#24c5ba'});}
  finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
}
function sample(id,p,tag=true){
  const type=MOVES[id];
  return sampleRiderTrick({airborne:true,rotation:Math.PI,flipRotation:Math.PI*2,boardRotation:-Math.PI*2,trick:{...TRICKS[type],type,age:p*TRICKS[type].duration,...(tag?{comboAnimation:id}:{})}});
}
function pose(s,id,p,tag=true,mode='surf'){
  const a=sample(id,p,tag);
  s.rig.position.set(-4,2.2,8);s.rig.rotation.order='YXZ';s.rig.rotation.set(-.12,.63,.24);
  s.yaw.rotation.y=a.spin;s.boardPivot.rotation.order='YXZ';
  s.boardPivot.rotation.set(a.boardPitch,a.boardSpin,a.flip+a.boardBank);
  s.boardPivot.position.set(a.boardSide,.12+a.boardLift,a.boardBack);
  s.pose({air:true,grab:a.grab,tweak:a.tweak,comboPose:a.comboPose,mode,time:.4,lean:.12});
  s.rig.updateWorldMatrix(true,true);return a;
}
function meshes(s){const result=[];s.rider.traverseVisible(o=>{if(o.isMesh)result.push(o);});return result;}
function points(o){const p=o.geometry.attributes.position;return Array.from({length:p.count},(_,i)=>o.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));}
function vertices(s){return meshes(s).flatMap(points);}
function deckDistance(s,p){
  const geometry=s.board.geometry,positions=geometry.attributes.position,index=geometry.index;
  const triangle=new THREE.Triangle(),closest=new THREE.Vector3();let best=Infinity;
  for(let i=0;i<(index?.count||positions.count);i+=3){
    for(const [j,v]of [[0,triangle.a],[1,triangle.b],[2,triangle.c]])v.fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(s.board.matrixWorld);
    triangle.closestPointToPoint(p,closest);best=Math.min(best,p.distanceTo(closest));
  }return best;
}
function checkBones(s,label){
  const lm=s.landmarks;
  for(const side of ['left','right'])for(const [a,b,length]of [['Shoulder','Elbow',.32],['Elbow','Wrist',.29],['Wrist','Fingertip',.15],['Hip','Knee',.478],['Knee','Ankle',.45]]){
    assert.ok(Math.abs(lm[side+a].distanceTo(lm[side+b])-length)<.003,`${label}: ${side} ${a}-${b} stretched`);
  }
}

test('combo choreography preserves the ordinary sampler and exact move endpoints',()=>{
  for(const id of Object.keys(MOVES))for(const p of [0,.01,.15,.22,.5,.8,.99,1]){
    const ordinary=sample(id,p,false),combo=sample(id,p);
    for(const key of ['spin','flip','boardSpin','grab','lipGrab','tweak','holdingGrab','progress'])assert.equal(combo[key],ordinary[key],`${id}: changed existing ${key}`);
    if(p===0||p===1)assert.deepEqual(combo,ordinary,`${id}: endpoint did not return to the ordinary move`);
    else assert.equal(combo.comboPose.id,id);
  }
  for(const invalid of ['unknown','constructor','__proto__',null]){
    const state={airborne:true,trick:{...TRICKS.grab,age:.3}};
    assert.deepEqual(sampleRiderTrick({...state,trick:{...state.trick,comboAnimation:invalid}}),sampleRiderTrick(state));
  }
  assert.equal(sample('coil360',.5).holdingGrab,false,'a compact spin must not invent a grab');
  assert.ok(sample('flipcatch',.17).boardPitch>sample('flipcatch',.5).boardPitch+.2,'the nose-up catch must settle visibly into its hold');
});

test('five combos produce distinct actual body and board silhouettes',()=>{
  const s=make(),poses=[];
  try{
    for(const id of Object.keys(MOVES)){
      const a=pose(s,id,.5),worldToYaw=s.yaw.matrixWorld.clone().invert();
      const shape=['leftShoulder','rightShoulder','leftWrist','rightWrist','leftKnee','rightKnee'].map(k=>s.landmarks[k].clone().applyMatrix4(worldToYaw));
      poses.push({id,shape,board:BOARD_FIELDS.map(k=>a[k])});
      checkBones(s,id);
      if(id==='coil360')for(const side of ['left','right'])assert.ok(s.landmarks[side+'Hip'].distanceTo(s.landmarks[side+'Ankle'])<.58,'coil must visibly tuck its knees');
    }
    for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++){
      const a=poses[i],b=poses[j],different=a.shape.filter((p,k)=>p.distanceTo(b.shape[k])>.10).length;
      assert.ok(different>=3,`${a.id}/${b.id}: fewer than three joints visibly differ`);
      assert.ok(Math.hypot(...a.board.map((v,k)=>v-b.board[k]))>.25,`${a.id}/${b.id}: board choreography indistinguishable`);
    }
  }finally{disposeSurfer(s);}
});

test('Crosscut visibly changes the ordinary B hold without adding a body roll or releasing the board',()=>{
  const s=make();
  try{
    const joints=['leftShoulder','rightShoulder','leftWrist','rightWrist','leftKnee','rightKnee'];
    const ordinary=pose(s,'crosscut',.5,false),base=joints.map(key=>s.landmarks[key].clone());
    const combo=pose(s,'crosscut',.5);
    assert.ok(joints.filter((key,i)=>s.landmarks[key].distanceTo(base[i])>.10).length>=3,'at least three actual joints should distinguish the combo from ordinary B');
    assert.ok(Math.hypot(...BOARD_FIELDS.map(key=>combo[key]-ordinary[key]))>.20,'the held board must have a visibly different orientation and offset');
    for(const key of ['spin','flip','boardSpin'])assert.equal(combo[key],ordinary[key],`Crosscut added an unwanted ${key}`);
    assert.equal(combo.holdingGrab,true);assert.equal(combo.tweak,1);
    assert.ok(deckDistance(s,s.landmarks.rightFingertip)<.003,'the different silhouette must retain an actual board hold');
  }finally{disposeSurfer(s);}
});

test('all riders keep sewn cloth, fixed limbs, real grab contact and planted board feet in combo moves',t=>{
  let frames=0,contacts=0,seams=0;
  for(const character of Object.keys(CHARACTERS))for(const outfit of Object.keys(OUTFITS)){
    const s=make(character,outfit),parent=new THREE.Group();parent.position.set(13,3,-27);parent.rotation.set(.18,.71,-.11);parent.add(s.rig);
    try{
      s.pose({mode:'surf'});
      const bindings=['left','right'].map(side=>[side,s.board.worldToLocal(s.landmarks[side+'Ankle'].clone()),s.board.worldToLocal(s.landmarks[side+'Toe'].clone())]);
      for(const id of Object.keys(MOVES))for(const p of [.01,.1,.219,.22,.5,.8,.801,.9,.99]){
        const label=`${character}/${outfit}/${id}/${p}`,a=pose(s,id,p,true),rows=meshes(s);checkBones(s,label);
        for(const o of rows){assert.ok(points(o).every(v=>[v.x,v.y,v.z].every(Number.isFinite)),`${label}: nonfinite geometry`);assert.ok([...o.geometry.attributes.normal.array].every(Number.isFinite),`${label}: nonfinite normals`);}
        for(const [side,ankle,toe]of bindings){
          const expectedAnkle=s.board.localToWorld(ankle.clone()),expectedToe=s.board.localToWorld(toe.clone());
          assert.ok(s.landmarks[side+'Ankle'].distanceTo(expectedAnkle)<1e-7,`${label}: ${side} ankle left transformed board`);
          assert.ok(s.landmarks[side+'Toe'].distanceTo(expectedToe)<1e-7,`${label}: ${side} toe left transformed board`);
          const foot=rows.find(o=>o.name===side+'-foot');
          assert.ok(Math.min(...points(foot).map(v=>v.distanceTo(expectedToe)))<1e-7,`${label}: actual foot mesh does not reach the planted toe`);
          const torso=rows.find(o=>o.name==='torso'),sleeve=rows.find(o=>o.name===side+'-sleeve');
          if(torso&&sleeve){const tp=points(torso),sp=points(sleeve);for(const[i,index]of torso.userData.armholes[side].entries()){assert.ok(tp[index].distanceTo(sp[i])<1e-6,`${label}: ${side} shoulder seam opened`);seams++;}}
          const leg=rows.find(o=>o.name===side+'-trousers'||o.name===side+'-shorts');
          if(leg){const other=side==='left'?'right':'left',joined=rows.filter(o=>o.name==='trouser-yoke'||o.name===other+'-trousers'||o.name===other+'-shorts').flatMap(points);for(const v of points(leg).slice(0,8)){assert.ok(Math.min(...joined.map(p=>p.distanceTo(v)))<1e-6,`${label}: seat seam opened`);seams++;}}
        }
        if(a.holdingGrab){
          const tip=s.landmarks.rightFingertip,target=s.board.localToWorld(s.board.userData.grabRailLocal.clone());
          assert.ok(tip.distanceTo(target)<.003&&deckDistance(s,tip)<.003,`${label}: hand misses actual board rail`);
          const hand=rows.find(o=>o.name==='right-hand');assert.ok(Math.min(...points(hand).map(v=>v.distanceTo(target)))<.003,`${label}: contact marker has no visible hand vertex`);contacts++;
        }
        frames++;
      }
    }finally{disposeSurfer(s);}
  }
  const riderCount=Object.keys(CHARACTERS).length*Object.keys(OUTFITS).length;
  assert.equal(frames,riderCount*45);assert.equal(contacts,riderCount*12);t.diagnostic(`${frames} combo frames, ${contacts} actual held deck contacts, ${seams} joined cloth vertices and both transformed foot bindings checked.`);
});

test('combo entry and release converge continuously to ordinary geometry including foot orientation',()=>{
  const s=make('kai','riptide');
  try{
    for(const mode of ['surf','park'])for(const id of Object.keys(MOVES))for(const endpoint of [0,1]){
      pose(s,id,endpoint,false,mode);const base=vertices(s);
      pose(s,id,endpoint,true,mode);assert.ok(vertices(s).every((p,i)=>p.distanceTo(base[i])<1e-7),`${id}: endpoint changed actual ${mode} geometry`);
      const nearby=endpoint===0?.00001:.99999;
      pose(s,id,nearby,false,mode);const ordinary=vertices(s);
      pose(s,id,nearby,true,mode);const delta=Math.max(...vertices(s).map((p,i)=>p.distanceTo(ordinary[i])));
      assert.ok(delta<.00001,`${id}: ${mode} endpoint foot/body snap ${delta}m`);
    }
  }finally{disposeSurfer(s);}
});

test('catch staging and hold boundaries have no discontinuous body or deck changes',()=>{
  const s=make();
  try{
    for(const id of Object.keys(MOVES))for(const boundary of [.14,.20,.22,.36,.80]){
      pose(s,id,boundary-.000001);const before=vertices(s),deckBefore=points(s.board);
      pose(s,id,boundary+.000001);const after=vertices(s),deckAfter=points(s.board);
      assert.ok(Math.max(...after.map((p,i)=>p.distanceTo(before[i])))<.0002,`${id}: body jumps across progress ${boundary}`);
      assert.ok(Math.max(...deckAfter.map((p,i)=>p.distanceTo(deckBefore[i])))<.0002,`${id}: board jumps across progress ${boundary}`);
    }
  }finally{disposeSurfer(s);}
});
