import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WEATHER_PRESETS,WEATHER_IDS,getSurfWeather,chooseSurfWeather,resolveWorldWeather,weatherLightning} from '../src/surf-weather.js';
import {SurfWorld} from '../src/world.js';

test('Surf Session rolls five complete weather/time combinations without an immediate repeat',()=>{
  assert.equal(WEATHER_IDS.length,5);
  for(const previous of [...WEATHER_IDS,undefined]){
    const reached=new Set();
    for(let i=0;i<=100;i++){
      const id=chooseSurfWeather(previous,()=>i/100);assert.ok(WEATHER_IDS.includes(id));assert.notEqual(id,previous);reached.add(id);
    }
    assert.equal(reached.size,previous?4:5);
  }
  for(const id of WEATHER_IDS){const preset=getSurfWeather(id);assert.equal(preset.id,id);assert.match(preset.timeLabel,/^[0-9]{2}:[0-9]{2}$/);assert.ok(preset.label.length>3);assert.ok(preset.fogFar>preset.fogNear+100);}
  assert.equal(new Set(WEATHER_IDS.map(id=>getSurfWeather(id).skyTop)).size,5);
  assert.equal(new Set(WEATHER_IDS.map(id=>getSurfWeather(id).water)).size,5);
});

test('weather random boundaries and saved unknown ids always resolve to a valid preset',()=>{
  for(const value of [-1,1,100,NaN,Infinity,undefined])assert.ok(WEATHER_IDS.includes(chooseSurfWeather('sunset',()=>value)));
  for(const id of [undefined,null,'__proto__','constructor','garbage'])assert.equal(getSurfWeather(id).id,'sunset');
});

test('survival remains storm while races, Time Trials, Reef Rush and Waterworks preserve their palette',()=>{
  for(const weatherId of WEATHER_IDS)assert.equal(resolveWorldWeather({mode:'surf',rulesId:'storm',weatherId}).id,'storm');
  assert.equal(resolveWorldWeather({mode:'surf',rulesId:'surf',weatherId:'dawn'}).id,'dawn');
  assert.equal(resolveWorldWeather({mode:'surf',rulesId:'surf',isRace:true,weatherId:'storm'}).id,'legacy');
  assert.equal(resolveWorldWeather({mode:'surf',rulesId:'surf',isTimeTrial:true,weatherId:'storm'}).id,'legacy');
  assert.equal(resolveWorldWeather({mode:'surf',rulesId:'rush',weatherId:'storm'}).id,'legacy');
  assert.equal(resolveWorldWeather({mode:'park',rulesId:'storm',weatherId:'storm'}),null);
});

function weatherWorld(){
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,1,200);
  const uniforms=keys=>Object.fromEntries(keys.map(key=>[key,{value:key.startsWith('u')&&['uTop','uHorizon','uLow','uDeep','uLight','uFoam','uFog','uSun'].includes(key)?new THREE.Color():0}]));
  return {scene,weatherId:null,reducedMotion:false,ambientLight:new THREE.HemisphereLight(),keyLight:new THREE.DirectionalLight(),skyMat:{uniforms:uniforms(['uTop','uHorizon','uLow','uLightning'])},waterMat:{uniforms:uniforms(['uDeep','uLight','uFoam','uFog','uSun','uFogFar','uStorm'])},sun:new THREE.Mesh(new THREE.CircleGeometry(),new THREE.MeshBasicMaterial()),cloudMaterial:new THREE.MeshBasicMaterial(),foam:[{material:new THREE.MeshBasicMaterial()}],rain:new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial()),lightning:new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial()),weatherClouds:[Object.assign(new THREE.Group(),{userData:{x:0,y:50,z:-150,phase:0}})],birds:[new THREE.Group()]};
}
test('weather drives actual sky, water, sun, fog and lamps; rain clears when leaving storm',()=>{
  const world=weatherWorld();
  for(const id of WEATHER_IDS){
    SurfWorld.prototype.updateWeather.call(world,{mode:'surf',rulesId:'surf',weatherId:id},8,0,1,-20,0);
    const p=getSurfWeather(id);assert.equal(world.weatherId,id);assert.equal(world.scene.background.getHex(),p.background);assert.equal(world.scene.fog.far,p.fogFar);assert.equal(world.keyLight.color.getHex(),p.light);assert.equal(world.ambientLight.intensity,p.ambientPower);assert.equal(world.sun.position.y,p.sunY);assert.equal(world.rain.visible,p.rain>0);assert.equal(world.waterMat.uniforms.uLight.value.getHex(THREE.LinearSRGBColorSpace),p.water);
  }
  SurfWorld.prototype.updateWeather.call(world,{mode:'surf',rulesId:'surf',weatherId:'sunset'},20,0,1,-20,0);
  assert.equal(world.rain.visible,false);assert.equal(world.sun.visible,true);assert.equal(world.lightning.visible,false);
});
test('storm motion freezes at the same elapsed time and reduced motion removes lightning and moving rain',()=>{
  const world=weatherWorld(),game={mode:'surf',rulesId:'storm'};
  SurfWorld.prototype.updateWeather.call(world,game,7.3,2,1,-80,.4);
  const position=world.rain.position.toArray(),flash=world.lightning.material.opacity,cloud=world.weatherClouds[0].position.toArray();
  assert.ok(flash>0&&flash<.4);
  SurfWorld.prototype.updateWeather.call(world,game,7.3,2,1,-80,.4);
  assert.deepEqual(world.rain.position.toArray(),position);assert.deepEqual(world.weatherClouds[0].position.toArray(),cloud);assert.equal(world.lightning.material.opacity,flash);
  world.reducedMotion=true;SurfWorld.prototype.updateWeather.call(world,game,7.3,2,1,-80,.4);
  assert.equal(world.lightning.visible,false);assert.equal(world.rain.geometry.drawRange.count,70);assert.equal(world.rain.position.y,1);
  for(const time of [0,7,7.1,7.3,8,20.7]){assert.equal(weatherLightning(time,WEATHER_PRESETS.storm,true),0);assert.equal(weatherLightning(time,WEATHER_PRESETS.sunset),0);}
});
