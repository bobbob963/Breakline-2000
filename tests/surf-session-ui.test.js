import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { SurfGame } from '../src/game.js';
import { chooseSurfWeather, getSurfWeather, WEATHER_IDS } from '../src/surf-weather.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const startCode=source.slice(source.indexOf('function startRun('),source.indexOf('function goHome('));
function fixture(selectedMode='surf',prior='sunset') {
  const noop=()=>{},saved=new Map([['breakline99-weather',prior]]);
  const element={classList:{add:noop,remove:noop},focus:noop};
  const context={selectedMode,lastSurfWeather:saved.get('breakline99-weather'),chooseSurfWeather,getSurfWeather,
    secretUnlockedThisRun:false,timePowerScreen:{reset:noop,onEvent:noop,update:noop},
    game:new SurfGame(noop,selectedMode),adminPanel:{isOpen:false},wasted:{reset:noop},
    closeWorkshop:noop,closeModal:noop,clearInput:noop,applyPlayerSettings:noop,
    special:{reset:noop},soundPreference:'off',audio:{setMode:noop,setScene:noop},world:{setMode:noop},
    updateModeMenu:noop,updateSoundLabel:noop,$:()=>element,document:{body:element},
    write:(key,value)=>saved.set(key,value)};
  vm.runInNewContext(startCode,context);
  return {context,saved};
}

test('actual Surf Session start and restart roll and save a different weather every run',()=>{
  const {context:c,saved}=fixture();let previous='sunset';
  for(let run=0;run<25;run++) {
    if(run===0)c.startRun();else c.restartRun();
    assert.ok(WEATHER_IDS.includes(c.game.weatherId));assert.notEqual(c.game.weatherId,previous);
    assert.equal(saved.get('breakline99-weather'),c.game.weatherId);
    assert.equal(c.lastSurfWeather,c.game.weatherId);assert.equal(c.game.phase,'running');previous=c.game.weatherId;
  }
});

test('saved last weather is honoured on the next page load, pause does not reroll',()=>{
  const first=fixture();first.context.startRun();const weather=first.context.game.weatherId;
  first.context.game.pause();first.context.game.update(.05);first.context.game.resume();
  assert.equal(first.context.game.weatherId,weather);
  const reloaded=fixture('surf',first.saved.get('breakline99-weather'));reloaded.context.startRun();
  assert.notEqual(reloaded.context.game.weatherId,weather);
});

test('Survival starts and retries with storm conditions without changing the last Surf Session weather',()=>{
  const {context:c,saved}=fixture('storm','dawn');
  c.startRun();assert.equal(c.game.weatherId,'storm');assert.equal(saved.get('breakline99-weather'),'dawn');
  c.game.weatherId='sunset';c.restartRun();assert.equal(c.game.weatherId,'storm');
  assert.equal(c.game.rules.endless,true);assert.equal(c.game.lives,3);
});

test('opening admin prevents starting a run or consuming a weather roll',()=>{
  const {context:c,saved}=fixture();c.adminPanel.isOpen=true;c.startRun();
  assert.equal(c.game.phase,'ready');assert.equal(saved.get('breakline99-weather'),'sunset');
});
