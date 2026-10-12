import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeAudio, SURF_TRACK, MENU_TRACK, RACE_TRACK, MUSIC_BPM, MENU_BPM, RACE_BPM } from '../src/audio.js';

function parameter(value = 0) {
  return {value,calls:[],cancelScheduledValues(at){this.calls.push(['cancel',at]);},
    setTargetAtTime(value,at,time){this.value=value;this.calls.push(['target',value,at,time]);}};
}
function runningSynth() {
  const synth = new ArcadeAudio();
  synth.ctx = {currentTime:0,state:'running'};
  synth.enabled = true;
  for(const name of ['music','menuMusic','raceMusic','master'])synth[name]={gain:parameter()};
  synth.raceTone = {frequency:parameter(4300)};
  const score=[];
  synth._scheduleStep=(step,at)=>score.push({scene:'ride',step,at});
  synth._scheduleMenuStep=(step,at)=>score.push({scene:'menu',step,at});
  synth._scheduleRaceStep=(step,at)=>score.push({scene:'race',step,at});
  return {synth,score};
}

test('selecting any soundtrack does not create or unlock an audio context',()=>{
  const synth=new ArcadeAudio();
  for(const [scene,title] of [['race',RACE_TRACK],['menu',MENU_TRACK],['ride',SURF_TRACK]]){
    synth.setScene(scene);assert.equal(synth.scene,scene);assert.equal(synth.trackName,title);
    assert.equal(synth.ctx,null);assert.equal(synth.enabled,false);
  }
});

test('race scene crossfades exclusively to its bus and clears stale race intensity',()=>{
  const {synth}=runningSynth();
  synth.setRaceState({progress:.9,boost:1});synth.setScene('race');
  assert.equal(synth.music.gain.value,0);assert.equal(synth.menuMusic.gain.value,0);
  assert.equal(synth.raceMusic.gain.value,.84);assert.equal(synth.raceBoost,0);assert.equal(synth.raceProgress,0);
  synth.setScene('menu');
  assert.equal(synth.raceMusic.gain.value,0);assert.equal(synth.menuMusic.gain.value,.88);
  synth.setScene('ride');assert.equal(synth.music.gain.value,.82);assert.equal(synth.menuMusic.gain.value,0);
});

test('each soundtrack is scheduled at its own tempo and retains its own phrase position',()=>{
  const {synth,score}=runningSynth();
  for(const [scene,bpm] of [['race',RACE_BPM],['menu',MENU_BPM],['ride',MUSIC_BPM]]){
    synth.setScene(scene);score.length=0;
    for(let frame=0;frame<50;frame++){synth.ctx.currentTime+=.02;synth.update(true);}
    assert.ok(score.length>5);assert.ok(score.every(event=>event.scene===scene));
    for(let i=1;i<score.length;i++)assert.ok(Math.abs(score[i].at-score[i-1].at-60/bpm/4)<1e-8);
    synth.beat=37;synth.setScene(scene==='menu'?'ride':'menu');synth.setScene(scene);
    assert.equal(synth.beat,32);
  }
});

test('pausing or muting stops voices without scheduling new race music; resuming avoids a backlog',async()=>{
  const {synth,score}=runningSynth();synth.setScene('race');synth.update(true);
  const stops=[];const voice={stop(at){stops.push(at);}};synth.voices.add(voice);
  synth.ctx.currentTime=1;synth.update(false);const before=score.length,beat=synth.beat;
  synth.ctx.currentTime=20;synth.update(false);
  assert.equal(score.length,before);assert.equal(synth.beat,beat);assert.equal(stops.length,1);
  synth.update(true);assert.ok(score.length-before<=2);assert.ok(score.slice(before).every(e=>e.at>=20));
  await synth.toggle();const mutedCount=score.length;synth.ctx.currentTime=21;synth.update(true);
  assert.equal(synth.enabled,false);assert.equal(score.length,mutedCount);assert.equal(stops.length,2);
});

test('late completion of audio unlock cannot undo a subsequent mute',async()=>{
  const {synth}=runningSynth();let finishResume;
  synth.enabled=false;synth.ctx.resume=()=>new Promise(resolve=>{finishResume=resolve;});
  const opening=synth.enable();await synth.toggle();finishResume();
  assert.equal(await opening,false);assert.equal(synth.enabled,false);assert.equal(synth.active,false);
});

test('race intensity stays finite and changes tone rather than master loudness',()=>{
  const {synth}=runningSynth(),masterCalls=synth.master.gain.calls.length;
  synth.setRaceState({progress:2,boost:4});
  assert.equal(synth.raceProgress,1);assert.equal(synth.raceBoost,1);assert.equal(synth.raceTone.frequency.value,7500);
  synth.setRaceState({progress:NaN,boost:Infinity});
  assert.equal(synth.raceProgress,0);assert.equal(synth.raceBoost,0);assert.equal(synth.raceTone.frequency.value,4300);
  synth.setRaceState({progress:-1,boost:-3});
  assert.equal(synth.master.gain.calls.length,masterCalls);
});

function raceArrangement(progress,boost) {
  const synth=new ArcadeAudio(),events=[];
  for(const bus of ['raceDrums','raceGuitars','raceBass','raceLead','raceMusic'])synth[bus]=bus==='raceGuitars'?['left','right']:bus;
  synth.setRaceState({progress,boost});
  synth._note=(frequency,at,duration,wave,volume,output,endFrequency)=>events.push({kind:'note',frequency,at,duration,wave,volume,output,endFrequency});
  synth._menuPluck=(midi,at,duration,volume,output,detune)=>events.push({kind:'pluck',midi,at,duration,volume,output,detune});
  synth._noiseHit=(at,duration,volume,frequency,filter,pan,output,attack)=>events.push({kind:'noise',at,duration,volume,frequency,filter,pan,output,attack});
  for(let step=0;step<512;step++)synth._scheduleRaceStep(step,.04+step*60/RACE_BPM/4);
  return events;
}

test('complete race arrangement has finite envelopes, stereo guitars, bass, drums and a hook',()=>{
  const events=raceArrangement(.3,0);
  assert.ok(events.length>1500);
  for(const event of events){
    for(const key of ['at','duration','volume'])assert.ok(Number.isFinite(event[key]),`${key}: ${JSON.stringify(event)}`);
    assert.ok(event.duration>.02);assert.ok(event.volume>0&&event.volume<1);assert.ok(event.at>=.04);
    if(event.frequency!==undefined)assert.ok(event.frequency>0&&event.frequency<24000);
  }
  for(const output of ['left','right','raceBass','raceLead','raceDrums'])assert.ok(events.some(e=>e.output===output));
  const barEvents=bar=>events.filter(e=>e.at>=.04+bar*4*60/RACE_BPM&&e.at<.04+(bar+1)*4*60/RACE_BPM);
  assert.ok(barEvents(8).filter(e=>e.output==='raceLead').length>barEvents(16).filter(e=>e.output==='raceLead').length);
  assert.ok(barEvents(22).filter(e=>e.output==='raceDrums').length>barEvents(16).filter(e=>e.output==='raceDrums').length);
});

test('earned boost adds a distinct hook layer and final stretch adds percussion without raising all instruments',()=>{
  const normal=raceArrangement(.3,0),boost=raceArrangement(.3,1),finish=raceArrangement(.9,1);
  assert.ok(boost.filter(e=>e.output==='raceLead').length>normal.filter(e=>e.output==='raceLead').length);
  assert.ok(finish.filter(e=>e.output==='raceDrums').length>boost.filter(e=>e.output==='raceDrums').length);
  assert.deepEqual(normal.filter(e=>e.kind==='pluck'),boost.filter(e=>e.kind==='pluck'));
  assert.deepEqual(normal.filter(e=>e.output==='raceBass'),finish.filter(e=>e.output==='raceBass'));
});
