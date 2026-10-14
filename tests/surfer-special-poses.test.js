import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSurfer, disposeSurfer } from '../src/appearance.js';
import { SURFER_SPECIALS } from '../src/surfer-specials.js';
import { sampleRiderTrick } from '../src/rider-pose.js';

const context=new Proxy({}, {get:(_,key)=>key.includes('Gradient')?()=>({addColorStop(){}}):()=>{},set:()=>true});
function make(character='kai',outfit='riptide'){
  const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>context})};
  try{return createSurfer({character,outfit,boardDesign:'tribal',boardColor:'#24c5ba'});}
  finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
}
function sample(character,p,signature=true){
  const move=SURFER_SPECIALS[character];
  return sampleRiderTrick({airborne:true,rotation:Math.PI,flipRotation:Math.PI*2,boardRotation:-Math.PI*2,trick:{...move,specialId:signature?move.specialId:null,age:p*move.duration}});
}
function pose(s,character,p,signature=true,mode='surf'){
  const a=sample(character,p,signature);
  s.rig.position.set(-4,2.2,8);s.rig.rotation.set(-.12,.63,.24,'YXZ');
  s.yaw.rotation.set(a.bodyPitch,a.spin,a.bodyRoll,'YXZ');
  s.boardPivot.rotation.set(a.boardPitch,a.boardSpin,a.flip+a.boardBank,'YXZ');
  s.boardPivot.position.set(a.boardSide,.12+a.boardLift,a.boardBack);
  s.pose({air:true,grab:a.grab,tweak:a.tweak,comboPose:a.comboPose,mode,time:.4,lean:.12});
  s.rig.updateWorldMatrix(true,true);return a;
}
function meshes(s){const rows=[];s.rider.traverseVisible(o=>{if(o.isMesh)rows.push(o);});return rows;}
function points(o){const p=o.geometry.attributes.position;return Array.from({length:p.count},(_,i)=>o.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));}
function vertices(s){return meshes(s).flatMap(points);}
function deckDistance(s,point){
  const p=s.board.geometry.attributes.position,index=s.board.geometry.index,triangle=new THREE.Triangle(),near=new THREE.Vector3();let best=Infinity;
  for(let i=0;i<(index?.count||p.count);i+=3){
    for(const[j,v]of[[0,triangle.a],[1,triangle.b],[2,triangle.c]])v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(s.board.matrixWorld);
    triangle.closestPointToPoint(point,near);best=Math.min(best,point.distanceTo(near));
  }return best;
}

test('signature choreography visibly distinguishes four real rider silhouettes',()=>{
  const s=make(),shapes=[];
  try{
    for(const character of Object.keys(SURFER_SPECIALS)){
      const a=pose(s,character,.5),inverse=s.rig.matrixWorld.clone().invert();
      shapes.push({character,points:['crown','leftWrist','rightWrist','leftKnee','rightKnee'].map(key=>s.landmarks[key].clone().applyMatrix4(inverse))});
      assert.equal(a.comboPose.id,SURFER_SPECIALS[character].specialId);
      assert.equal(a.holdingGrab,true);
    }
    for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){
      const a=shapes[i],b=shapes[j];
      assert.ok(a.points.filter((point,k)=>point.distanceTo(b.points[k])>.13).length>=3,`${a.character}/${b.character}: too few visible pose differences`);
    }
    assert.ok(sample('kai',.5).bodyRoll>3,'Kai rotates rider and held deck together');
    assert.equal(sample('nova',.5).bodyRoll,0,'Nova remains a tight yaw spin');
    assert.ok(sample('reef',.5).boardBank>1,'Reef lays the held board over');
    assert.equal(sample('jax',.1).comboPose.plantFeet,0,'Jax leaves the flipping deck loose before catch');
    assert.ok(Math.abs(sample('jax',.22).flip)<1e-10,'Jax completes reverse deck flip before full hand contact');
  }finally{disposeSurfer(s);}
});

test('signature held frames keep hands on actual deck triangles and feet planted across clothing and modes',t=>{
  let frames=0,contacts=0;
  for(const character of Object.keys(SURFER_SPECIALS))for(const outfit of ['riptide','aloha','reefskin','yardcrew']){
    const s=make(character,outfit),parent=new THREE.Group();parent.position.set(13,3,-27);parent.rotation.set(.18,.71,-.11);parent.add(s.rig);
    try{
      s.pose({mode:'surf'});
      const bindings=['left','right'].map(side=>[side,s.board.worldToLocal(s.landmarks[side+'Ankle'].clone()),s.board.worldToLocal(s.landmarks[side+'Toe'].clone())]);
      for(const mode of ['surf','park'])for(const p of [.01,.1,.20,.22,.5,.8,.9,.99]){
        const a=pose(s,character,p,true,mode),label=`${character}/${outfit}/${mode}/${p}`,rows=meshes(s),lm=s.landmarks;
        for(const side of ['left','right'])for(const [one,two,length]of[['Shoulder','Elbow',.32],['Elbow','Wrist',.29],['Wrist','Fingertip',.15],['Hip','Knee',.478],['Knee','Ankle',.45]]){
          assert.ok(Math.abs(lm[side+one].distanceTo(lm[side+two])-length)<.003,`${label}: stretched ${side} ${one}-${two}`);
        }
        for(const row of rows){assert.ok(points(row).every(v=>[v.x,v.y,v.z].every(Number.isFinite)),`${label}: invalid geometry`);assert.ok([...row.geometry.attributes.normal.array].every(Number.isFinite),`${label}: invalid normals`);}
        if(a.comboPose?.plantFeet>0)for(const[side,ankle,toe]of bindings){
          const expectedAnkle=s.board.localToWorld(ankle.clone()),expectedToe=s.board.localToWorld(toe.clone());
          assert.ok(lm[side+'Ankle'].distanceTo(expectedAnkle)<1e-7,`${label}: foot left board`);
          assert.ok(lm[side+'Toe'].distanceTo(expectedToe)<1e-7,`${label}: toe left board`);
        }
        if(a.holdingGrab){
          const target=s.board.localToWorld(s.board.userData.grabRailLocal.clone()),hand=rows.find(row=>row.name==='right-hand');
          assert.ok(lm.rightFingertip.distanceTo(target)<.003&&deckDistance(s,lm.rightFingertip)<.003,`${label}: hand misses board rail`);
          assert.ok(Math.min(...points(hand).map(v=>v.distanceTo(target)))<.003,`${label}: no visible hand at contact`);contacts++;
        }
        for(const side of ['left','right']){
          const torso=rows.find(row=>row.name==='torso'),sleeve=rows.find(row=>row.name===side+'-sleeve');
          if(torso&&sleeve){const tp=points(torso),sp=points(sleeve);for(const[i,index]of torso.userData.armholes[side].entries())assert.ok(tp[index].distanceTo(sp[i])<1e-6,`${label}: shoulder seam opened`);}
        }
        frames++;
      }
    }finally{disposeSurfer(s);}
  }
  assert.equal(frames,256);assert.equal(contacts,96);t.diagnostic(`${frames} signature poses with ${contacts} actual deck contacts across four clothing constructions and both modes.`);
});

test('signature entry and release restore actual mesh geometry without snapping or leaving roll behind',()=>{
  const s=make();
  try{
    for(const character of Object.keys(SURFER_SPECIALS))for(const mode of ['surf','park'])for(const endpoint of [0,1]){
      pose(s,character,endpoint,false,mode);const base=vertices(s);
      pose(s,character,endpoint,true,mode);assert.ok(vertices(s).every((v,i)=>v.distanceTo(base[i])<1e-7),`${character}: endpoint did not restore body`);
      const nearby=endpoint===0?.000001:.999999;
      pose(s,character,nearby,false,mode);const ordinary=vertices(s);
      pose(s,character,nearby,true,mode);assert.ok(vertices(s).every((v,i)=>v.distanceTo(ordinary[i])<.00001),`${character}: endpoint discontinuity`);
    }
    for(const character of Object.keys(SURFER_SPECIALS))for(const boundary of [.20,.22,.28,.80]){
      pose(s,character,boundary-.000001);const before=vertices(s);
      pose(s,character,boundary+.000001);assert.ok(vertices(s).every((v,i)=>v.distanceTo(before[i])<.0002),`${character}: catch/hold transition snaps`);
    }
    const rest=sampleRiderTrick({airborne:false});assert.equal(rest.bodyRoll,0);assert.equal(rest.bodyPitch,0);assert.equal(rest.comboPose,null);
  }finally{disposeSurfer(s);}
});
