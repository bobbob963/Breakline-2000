import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeAudio, RADIO_TRACKS} from '../src/audio.js';

function parameter(value=0) {
  return {value,calls:[],cancelScheduledValues(at){this.calls.push(['cancel',at]);},
    setTargetAtTime(value,at,time){this.value=value;this.calls.push(['target',value,at,time]);}};
}
function running() {
  const synth=new ArcadeAudio(),events=[];
  synth.ctx={currentTime:0,state:'running',resume:async()=>{}};synth.enabled=true;
  for(const bus of ['music','menuMusic','raceMusic','master'])synth[bus]={gain:parameter()};
  for(const [method,track] of [['_scheduleStep','surf'],['_scheduleMenuStep','menu'],['_scheduleRaceStep','race'],
    ['_scheduleSunsetStep','sunset'],['_scheduleSurvivalStep','survival']])
    synth[method]=(step,at)=>events.push({track,step,at});
  return {synth,events};
}

test('radio exposes all five existing songs and station choices never unlock audio or accept unknown IDs',()=>{
  const synth=new ArcadeAudio();assert.equal(synth.selection,'auto');assert.equal(synth.currentTrackId,'surf');
  assert.deepEqual(RADIO_TRACKS.map(track=>track.id),['surf','menu','race','sunset','survival']);
  for(const track of RADIO_TRACKS){
    assert.ok(track.title.length>0&&track.bpm>0);
    assert.equal(synth.selectTrack(track.id),true);assert.equal(synth.selection,track.id);
    assert.equal(synth.currentTrackId,track.id);assert.equal(synth.trackName,track.title);
    assert.equal(synth.ctx,null);assert.equal(synth.enabled,false);
  }
  for(const bad of ['unknown','constructor','__proto__',null,{},12])assert.equal(synth.selectTrack(bad),false);
  assert.equal(synth.currentTrackId,'survival');assert.equal(synth.selectTrack('auto'),true);
  assert.equal(synth.currentTrackId,'surf');
});

test('each manual song keeps its own scheduler and tempo through repeated scene and weather updates',()=>{
  for(const track of RADIO_TRACKS){
    const {synth,events}=running();synth.selectTrack(track.id);
    for(let frame=0;frame<120;frame++){
      synth.ctx.currentTime+=.02;
      synth.setScene(['menu','race','ride'][frame%3]);
      synth.setRideContext({rulesId:frame%2?'storm':'surf',weatherId:'sunset',elapsed:frame*.02});
      synth.update(true);
    }
    assert.equal(synth.selection,track.id);assert.equal(synth.trackName,track.title);
    assert.ok(events.length>10);assert.ok(events.every(event=>event.track===track.id));
    for(let i=1;i<events.length;i++)assert.ok(Math.abs(events[i].at-events[i-1].at-60/track.bpm/4)<1e-8);
    const bus=track.id==='menu'?'menuMusic':track.id==='race'?'raceMusic':'music';
    // Surf is initially selected, so its test fixture starts with the proper bus.
    if(track.id!=='surf'){
      assert.ok(synth[bus].gain.value>0);
      for(const other of ['music','menuMusic','raceMusic'].filter(id=>id!==bus))assert.equal(synth[other].gain.value,0);
    }
  }
});

test('Auto restores the latest mode and weather rather than the context before manual tuning',()=>{
  const synth=new ArcadeAudio();synth.selectTrack('sunset');
  synth.setScene('race');synth.selectTrack('auto');assert.equal(synth.currentTrackId,'race');
  synth.selectTrack('menu');synth.setScene('ride');synth.setRideContext({rulesId:'storm'});
  synth.selectTrack('auto');assert.equal(synth.currentTrackId,'survival');
  synth.selectTrack('race');synth.setRideContext({rulesId:'surf',weatherId:'sunset'});
  synth.selectTrack('auto');assert.equal(synth.currentTrackId,'sunset');
  synth.selectTrack('surf');synth.setScene('menu');synth.selectTrack('auto');assert.equal(synth.currentTrackId,'menu');
});

test('shuffle can reach every other song from every station with no immediate repeats',()=>{
  const synth=new ArcadeAudio();
  for(const current of RADIO_TRACKS){
    const heard=new Set();
    for(const random of [0,.25,.5,.75]){
      synth.selectTrack(current.id);const chosen=synth.shuffleTrack(()=>random);
      assert.notEqual(chosen,current.id);assert.equal(chosen,synth.selection);heard.add(chosen);
      assert.equal(synth.ctx,null);assert.equal(synth.enabled,false);
    }
    assert.deepEqual([...heard].sort(),RADIO_TRACKS.filter(track=>track.id!==current.id).map(track=>track.id).sort());
  }
  synth.selectTrack('auto');synth.setScene('race');assert.notEqual(synth.shuffleTrack(()=>.5),'race');
  for(const value of [NaN,Infinity,-1,1,9]){
    const chosen=synth.shuffleTrack(()=>value);assert.ok(RADIO_TRACKS.some(track=>track.id===chosen));
  }
});

test('tuning stops the old music before scheduling the new song and leaves effects alone',()=>{
  const {synth,events}=running();synth.setScene('menu');synth.selectTrack('sunset');synth.update(true);
  const stopped=[],oldVoice={stop:at=>stopped.push(at)},effect={stop:()=>assert.fail('song change stopped an effect')};
  synth._track(oldVoice,[]);synth._track(effect,[],'effects');synth.ctx.currentTime=1;
  synth.selectTrack('race');assert.deepEqual(stopped,[1.06]);assert.ok(synth.nextBeat>stopped[0]);
  events.length=0;synth.update(true);
  assert.ok(events.length>0);assert.ok(events.every(event=>event.track==='race'&&event.at>stopped[0]));
  assert.equal(synth.music.gain.value,0);assert.equal(synth.menuMusic.gain.value,0);assert.equal(synth.raceMusic.gain.value,.84);
});

test('selecting the current song does not restart it and revisiting songs resumes their retained phrase',()=>{
  const {synth}=running();synth.selectTrack('sunset');synth.beat=47;synth.nextBeat=3;
  synth.selectTrack('sunset');assert.equal(synth.beat,47);assert.equal(synth.nextBeat,3);
  synth.selectTrack('race');synth.beat=75;synth.selectTrack('sunset');assert.equal(synth.beat,32);
  synth.setScene('menu');synth.setRideContext({rulesId:'storm'});assert.equal(synth.beat,32);
  synth.selectTrack('race');assert.equal(synth.beat,64);
});

test('tuning and shuffling stay silent while paused or muted, and resume without a backlog',async()=>{
  const {synth,events}=running();synth.update(true);synth.update(false);const paused=events.length;
  synth.selectTrack('menu');synth.ctx.currentTime=20;synth.update(false);assert.equal(events.length,paused);
  synth.update(true);assert.ok(events.length-paused<=2);assert.ok(events.slice(paused).every(event=>event.track==='menu'&&event.at>=20));
  await synth.toggle();const muted=events.length;synth.shuffleTrack(()=>.99);synth.ctx.currentTime=40;synth.update(true);
  assert.equal(events.length,muted);assert.equal(synth.enabled,false);
  await synth.enable();synth.update(true);assert.ok(events.length-muted<=2);
  assert.ok(events.slice(muted).every(event=>event.track===synth.currentTrackId&&event.at>=40));
});

test('the wasted sequence keeps tuned music ducked and restores the chosen station afterwards',()=>{
  const {synth,events}=running();synth._wasted=true;
  synth.selectTrack('menu');synth.setScene('race');synth.selectTrack('sunset');synth.setRideContext({rulesId:'storm'});
  synth.update(true);assert.equal(events.length,0);
  for(const bus of ['music','menuMusic','raceMusic'])assert.equal(synth[bus].gain.value,0);
  synth.endWastedSequence();assert.equal(synth.currentTrackId,'sunset');
  assert.equal(synth.music.gain.value,.82);assert.equal(synth.menuMusic.gain.value,0);assert.equal(synth.raceMusic.gain.value,0);
  synth.update(false);assert.equal(events.length,0);synth.update(true);
  assert.ok(events.length>0);assert.ok(events.every(event=>event.track==='sunset'));
});
