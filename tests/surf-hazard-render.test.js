import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurfHazardRenderer,SURF_HAZARD_POOL_PER_TYPE} from '../src/surf-hazard-render.js';
import {surfHazardsNear} from '../src/surf-hazards.js';
import {renderedWaveHeight,alignRiderToOcean,alignSurfRiderToOcean} from '../src/ocean-surface.js';
import {waveHeight} from '../src/storm-waves.js';
const game=(distance=240)=>({mode:'surf',rulesId:'storm',distance,surfAdventureEnabled:true});

test('driftwood and whirlpool meshes use physical descriptors and the visible water surface',()=>{
  const renderer=createSurfHazardRenderer(),state=game(),time=12,oceanZ=-330;
  renderer.update(state,time,oceanZ);
  const descriptors=surfHazardsNear(state.distance,state.rulesId,time,28,240);
  assert.equal(renderer.activeCount,descriptors.length);
  for(const item of descriptors){
    const mesh=renderer.group.children.find(mesh=>mesh.visible&&mesh.userData.hazardId===item.id);assert.ok(mesh);assert.equal(mesh.position.x,item.x);assert.equal(mesh.position.z,item.z);assert.equal(mesh.userData.radiusX,item.radiusX);assert.equal(mesh.userData.radiusZ,item.radiusZ);
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
    if(item.type==='driftwood')for(let i=0;i<p.count;i++){const above=p.getY(i)-renderedWaveHeight(item.x+p.getX(i),item.z+p.getZ(i),time,oceanZ);assert.ok(above>=.009&&above<=item.height+.001);}
  }
  const whirl=descriptors.find(item=>item.type==='whirlpool');assert.ok(whirl);assert.equal(renderer.maskCount,1);assert.deepEqual(renderer.masks[0].toArray(),[whirl.x,whirl.z,whirl.radiusX]);
  const mesh=renderer.group.children.find(mesh=>mesh.visible&&mesh.userData.type==='whirlpool');assert.ok(mesh.geometry.attributes.position.getY(0)<renderedWaveHeight(whirl.x,whirl.z,time,oceanZ)-1,'actual recessed core sits in the ocean hole');renderer.dispose();
});
test('Survival hazards and ocean holes disappear on switching to Surf Session in every weather',()=>{
  const renderer=createSurfHazardRenderer();
  for(const weatherId of ['dawn','noon','sunset','dusk','storm']){
    renderer.update(game(),12,-330);assert.ok(renderer.activeCount>0);assert.ok(renderer.maskCount>0);
    renderer.update({...game(),rulesId:'surf',weatherId},12,-330);
    assert.equal(renderer.group.visible,false);assert.equal(renderer.activeCount,0);assert.equal(renderer.maskCount,0);
  }
  renderer.dispose();
});

test('Survival obstacles never appear in races, park, Reef Rush or the home preview',()=>{
  const renderer=createSurfHazardRenderer();
  for(const state of [{...game(),isRace:true},{...game(),mode:'park'},{...game(),surfAdventureEnabled:false}]){renderer.update(state,12,-330);assert.equal(renderer.activeCount,0);assert.equal(renderer.maskCount,0);}
  renderer.update(game(),12,-330,{attract:true});assert.equal(renderer.activeCount,0);assert.equal(renderer.maskCount,0);
  renderer.update({...game(50),rulesId:'rush'},12,-150);assert.equal(renderer.activeCount,0);assert.equal(renderer.maskCount,0);renderer.dispose();
});
test('hazard pools remain bounded over an endless run and dispose every owned resource once',()=>{
  const renderer=createSurfHazardRenderer(),resources=new Set();
  renderer.group.traverse(object=>{if(object.geometry)resources.add(object.geometry);if(object.material)resources.add(object.material);});
  for(let d=0;d<20000;d+=211){renderer.update(game(d),d/24,Math.floor(-d/30)*30-90);assert.equal(renderer.group.children.length,SURF_HAZARD_POOL_PER_TYPE*2);assert.ok(renderer.maskCount<=SURF_HAZARD_POOL_PER_TYPE);assert.ok(renderer.activeCount<=SURF_HAZARD_POOL_PER_TYPE*2);}
  let disposed=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);renderer.dispose();renderer.dispose();assert.equal(disposed,resources.size);assert.equal(renderer.group.children.length,0);renderer.update(game(),12,-330);assert.equal(renderer.activeCount,0);
});
test('hazard animation freezes with gameplay and reduced motion holds the vortex pattern still',()=>{
  const renderer=createSurfHazardRenderer();renderer.update(game(),12,-330);
  const mesh=renderer.group.children.find(mesh=>mesh.visible&&mesh.userData.type==='whirlpool');const positions=[...mesh.geometry.attributes.position.array];const time=mesh.material.uniforms.uTime.value;
  renderer.update(game(),12,-330);assert.deepEqual([...mesh.geometry.attributes.position.array],positions);assert.equal(mesh.material.uniforms.uTime.value,time);renderer.dispose();
  const still=createSurfHazardRenderer({reducedMotion:true});still.update(game(),12,-330);assert.equal(still.group.children.find(mesh=>mesh.visible&&mesh.userData.type==='whirlpool').material.uniforms.uTime.value,0);still.dispose();
});
test('surf riders meet the actual water and driftwood plane, with smooth analytic contact inside barrel mouths',()=>{
  const t=10,oceanZ=-270,x=-2.4,barrel={startDistance:180,endDistance:232};
  for(const distance of [72,98,160,180,232,240,300]){
    const z=-distance,ground=waveHeight(x,z,t);
    assert.equal(alignSurfRiderToOcean(x,ground,z,t,oceanZ,barrel),renderedWaveHeight(x,z,t,oceanZ));
    assert.equal(alignSurfRiderToOcean(x,ground+2.5,z,t,oceanZ,barrel),ground+2.5,'high airborne tricks retain physical height');
  }
  for(const distance of [188,195,214,224]){
    const z=-distance,ground=waveHeight(x,z,t);assert.equal(alignSurfRiderToOcean(x,ground,z,t,oceanZ,barrel),ground,'curl interior preserves real roof contact');
  }
  const z=-184,ground=waveHeight(x,z,t),full=alignRiderToOcean(x,ground,z,t,oceanZ);
  assert.ok(Math.abs(alignSurfRiderToOcean(x,ground,z,t,oceanZ,barrel)-(ground+(full-ground)*.5))<1e-10);
});
