import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { waveHeight,stormBarrel,barrelCrossSection,barrelClosureProgress,barrelFallProgress,barrelSurfacePoint,barrelShellDistance,sampleStormBarrel,sweepStormBarrel } from '../src/storm-waves.js';
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

test('early curl starts visibly sooner but first wave finishes falling at the previous fully shut time',()=>{
  const barrel=stormBarrel(0),legacy={index:0,deadline:14.45,closeDuration:1.2};
  const run={index:0,triggerTime:10,closeStart:10.65,deadline:15.65,collapseDuration:1.2};
  assert.equal(barrelClosureProgress(barrel,10.65,run),0);
  assert.ok(barrelClosureProgress(barrel,11.1,run)>0);
  assert.equal(barrelClosureProgress(barrel,11.1,legacy),0);
  assert.equal(barrelFallProgress(barrel,14.4,run),0,'early rolling lip does not flatten the clear central roof');
  for(const time of [14.45,14.7,15,15.3,15.65])assert.ok(Math.abs(barrelFallProgress(barrel,time,run)-barrelClosureProgress(barrel,time,legacy))<1e-12);
  assert.equal(barrelClosureProgress(barrel,15.65,run),1);
});

test('untriggered waves have no standing curtain and new curls grow continuously from an anchored foot',()=>{
  const barrel=stormBarrel(0),z=-barrel.centerDistance,run={index:0,triggerTime:10,closeStart:10.65,deadline:15.65,collapseDuration:1.2};
  for(const time of [0,8,10.65]){
    const timings=time===10.65?run:new Map();
    for(const outer of [false,true])for(let i=0;i<=24;i++){
      const p=barrelSurfacePoint(barrel,z,i/24,time,outer,timings);
      assert.ok(Math.abs(p.y-waveHeight(p.x,z,time))<1e-12,'a wall exists before the curl starts');
    }
  }
  let previous=-Infinity;
  for(const elapsed of [.001,.1,.3,.6,1,1.45]){
    const time=run.closeStart+elapsed,section=barrelCrossSection(barrel,z,time,run);
    const top=Math.max(...Array.from({length:25},(_,i)=>{const p=barrelSurfacePoint(barrel,z,i/24,time,false,run);return p.y-waveHeight(p.x,z,time);}));
    assert.ok(top>=previous-.025,'formation snaps backwards');previous=top;
    assert.ok(section.formation>0&&section.formation<=1);
    for(const outer of [false,true]){
      const foot=barrelSurfacePoint(barrel,z,1,time,outer,run);
      assert.ok(Math.abs(foot.y-waveHeight(foot.x,z,time))<1e-12);
    }
  }
  assert.ok(previous>4,'the wave develops a real overhead hollow');
});

test('broad shoulders preserve a clear swept riding line through entry and exit',()=>{
  const barrel=stormBarrel(0),run={index:0,triggerTime:0,closeStart:.5,deadline:20,collapseDuration:1.2},time=6;
  let previous=null;
  for(let distance=barrel.startDistance-1;distance<=barrel.endDistance+1;distance+=.25){
    const z=-distance,s=barrelCrossSection(barrel,z,time,run),p={x:s.centerX,y:waveHeight(s.centerX,z,time),z};
    if(previous)assert.equal(sweepStormBarrel(previous,p,time,time,run),null,'forming mouth acts as a low cap across the lane');
    previous=p;
  }
});

test('slow approach holds an open curl without rewinding when its actual entry starts the escape clock',()=>{
  const barrel=stormBarrel(0),run={index:0,triggerTime:10,closeStart:10.1,deadline:15,collapseDuration:.07,escapeWindow:1.3,waitingForEntry:true};
  assert.equal(barrelClosureProgress(barrel,20,run),.82);assert.equal(barrelFallProgress(barrel,20,run),0);
  run.entryClosureProgress=barrelClosureProgress(barrel,20,run);run.enteredAt=20;run.deadline=21.3;run.waitingForEntry=false;
  assert.equal(barrelClosureProgress(barrel,20,run),.82);
  assert.ok(barrelClosureProgress(barrel,20.6,run)>.82);
  assert.equal(barrelFallProgress(barrel,21.2,run),0);assert.equal(barrelFallProgress(barrel,21.3,run),1);
  const z=-barrel.centerDistance,s=barrelCrossSection(barrel,z,21.2,run),p={x:s.centerX,y:waveHeight(s.centerX,z,21.2),z};
  assert.equal(sampleStormBarrel(p.x,p.y,z,21.2,run).colliding,false);
  const impact=sweepStormBarrel(p,p,21.2,21.3,run);assert.ok(impact?.colliding,'fast final crash remains a real swept contact');
  assert.ok(impact.section.fallProgress>0&&impact.section.fallProgress<1);
});

test('new formation and early rolling lip use the same faceted surfaces for rendering and collision',()=>{
  const barrel=stormBarrel(0),run={index:0,triggerTime:10,closeStart:10.65,deadline:15.65,collapseDuration:1.2};
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});let checked=0;
  for(const time of [10.8,11.1,11.5,12.1,13.5,14.8,15.5]){
    const geometry=updateBarrelGeometry(createBarrelGeometry(),barrel,time,run),mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld(true);
    for(const fraction of [.125,.25,.5,.75,.875]){
      const z=-barrel.startDistance-barrel.length*fraction,s=barrelCrossSection(barrel,z,time,run);
      if(s.growth<.015)continue; // The shallow joining seam is deliberately non-solid.
      for(const arc of [.18,.5,.82]){
        const p=barrelSurfacePoint(barrel,z,arc,time,false,run);
        const hits=new THREE.Raycaster(new THREE.Vector3(p.x,p.y+6,z),new THREE.Vector3(0,-1,0),0,14).intersectObject(mesh,false);
        assert.ok(hits.length,'visible forming curl disappeared');
        for(const hit of hits)assert.ok(barrelShellDistance(s,hit.point.x,hit.point.y)<1e-4,`forming mesh and physical sheet differ: ${time}/${fraction}/${arc}; growth ${s.growth}; distance ${barrelShellDistance(s,hit.point.x,hit.point.y)}`);checked++;
      }
    }
    geometry.dispose();
  }
  material.dispose();assert.equal(checked,99);
});
