import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeAudio } from '../src/audio.js';
import { resetBreaklineProgress } from '../src/admin-save.js';

test('settings music/effects volumes are independent, clamp safely and do not enable sound',()=>{
  const audio=new ArcadeAudio();audio.setVolumes(0,37);
  assert.equal(audio.musicVolume,0);assert.equal(audio.effectsVolume,37);assert.equal(audio.enabled,false);
  const gain=()=>({value:1,cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}});
  audio.ctx={currentTime:10};audio.musicVolumeBus={gain:gain()};audio.effectsVolumeBus={gain:gain()};
  audio.setVolumes(0,37);assert.equal(audio.musicVolumeBus.gain.value,0);assert.equal(audio.effectsVolumeBus.gain.value,.37);
  audio.setVolumes(250,-5);assert.equal(audio.musicVolumeBus.gain.value,1);assert.equal(audio.effectsVolumeBus.gain.value,0);
  audio.setVolumes(NaN,Infinity);assert.equal(audio.musicVolume,100);assert.equal(audio.effectsVolume,100);
  assert.equal(audio.enabled,false);
});

function storageFixture(){
  const entries=new Map(Object.entries({
    'breakline99-rider-identity-v1':'identity','breakline99-settings-v1':'options',
    'breakline99-sound':'off','breakline99-profile':'surfer','breakline99-admin-v1':'custom stats',
    'breakline99-tournament-v1':'legacy','breakline99-tournament-v2':'ladders',
    'breakline99-trials-v1':'trials','breakline99-secrets-v1':'secret',
    'breakline99-best':'legacy best','breakline99-best-surf':'3000','breakline99-best-park':'9000',
    'breakline99-survival-time':'301','other-game':'untouched'
  }));
  return {entries,storage:{get length(){return entries.size;},key:i=>[...entries.keys()][i],getItem:key=>entries.get(key)??null,
    setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)}};
}

test('progress reset clears achievements and legacy scores while retaining preferences, identity and unrelated data',()=>{
  const {entries,storage}=storageFixture();assert.equal(resetBreaklineProgress(storage),8);
  assert.deepEqual([...entries.keys()],['breakline99-rider-identity-v1','breakline99-settings-v1','breakline99-sound','breakline99-profile','breakline99-admin-v1','other-game']);
  assert.equal(resetBreaklineProgress(storage),0);
});

test('a failed progress reset rolls back every removed entry',()=>{
  const {entries,storage}=storageFixture(),before=Object.fromEntries(entries),remove=storage.removeItem;
  storage.removeItem=key=>{if(key==='breakline99-trials-v1')throw new Error('storage unavailable');remove(key);};
  assert.throws(()=>resetBreaklineProgress(storage),/could not reset/);
  assert.deepEqual(Object.fromEntries(entries),before);
});
