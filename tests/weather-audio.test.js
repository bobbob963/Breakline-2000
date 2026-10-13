import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ArcadeAudio, resolveRideTrack, SURF_TRACK, MENU_TRACK, RACE_TRACK, SUNSET_TRACK, SURVIVAL_TRACK, SUNSET_BPM, SURVIVAL_BPM } from '../src/audio.js';
import { SurfGame } from '../src/game.js';

function param(value=0){return{value,calls:[],cancelScheduledValues(at){this.calls.push(['cancel',at]);},setTargetAtTime(value,at,time){this.value=value;this.calls.push(['target',value,at,time]);}};}
function running(){
  const synth=new ArcadeAudio(),events=[];synth.ctx={currentTime:0,state:'running'};synth.enabled=true;
  for(const bus of ['music','menuMusic','raceMusic','master'])synth[bus]={gain:param()};
  for(const [method,track] of [['_scheduleStep','surf'],['_scheduleSunsetStep','sunset'],['_scheduleSurvivalStep','survival'],['_scheduleMenuStep','menu'],['_scheduleRaceStep','race']])
    synth[method]=(step,at)=>events.push({track,step,at});
  return{synth,events};
}

test('weather soundtrack routing keeps Survival fast and reserves sunset for ordinary sunset Surf Sessions',()=>{
  for(const weatherId of ['dawn','noon','sunset','dusk','storm']) {
    assert.equal(resolveRideTrack({mode:'surf',rulesId:'storm',weatherId}),'survival');
    assert.equal(resolveRideTrack({mode:'surf',rulesId:'surf',weatherId}),weatherId==='sunset'?'sunset':'surf');
  }
  for(const extra of [{mode:'park'},{mode:'wavepark'},{rulesId:'rush'},{isRace:true},{isTimeTrial:true}])
    assert.equal(resolveRideTrack({mode:'surf',rulesId:'surf',weatherId:'sunset',...extra}),'surf');
  const synth=new ArcadeAudio();synth.setRideContext({rulesId:'storm'});
  assert.equal(synth.trackName,SURVIVAL_TRACK);assert.equal(synth.enabled,false);assert.equal(synth.ctx,null);
  synth.setScene('menu');assert.equal(synth.trackName,MENU_TRACK);
  synth.setRideContext({rulesId:'surf',weatherId:'sunset'});assert.equal(synth.trackName,MENU_TRACK);
  synth.setScene('race');assert.equal(synth.trackName,RACE_TRACK);
  synth.setScene('ride');assert.equal(synth.trackName,SUNSET_TRACK);
  synth.setRideContext({rulesId:'surf',weatherId:'noon'});assert.equal(synth.trackName,SURF_TRACK);
});

test('new ride tracks schedule at their own tempo, preserve phrases, and do not restart on each context update',()=>{
  const {synth,events}=running();
  for(const [rulesId,weatherId,track,bpm] of [['surf','sunset','sunset',SUNSET_BPM],['storm','storm','survival',SURVIVAL_BPM]]) {
    synth.setRideContext({rulesId,weatherId});events.length=0;
    for(let frame=0;frame<80;frame++) {
      synth.ctx.currentTime+=.02;synth.setRideContext({rulesId,weatherId,elapsed:frame*.02});synth.update(true);
    }
    assert.ok(events.length>=8);assert.ok(events.every(event=>event.track===track));
    for(let i=1;i<events.length;i++)assert.ok(Math.abs(events[i].at-events[i-1].at-60/bpm/4)<1e-8);
    synth.beat=75;synth.setScene('menu');synth.setScene('ride');assert.equal(synth.beat,64);
  }
  synth.beat=47;synth.setRideContext({rulesId:'surf',weatherId:'sunset'});assert.equal(synth.beat,64);
  synth.setRideContext({rulesId:'storm'});assert.equal(synth.beat,32);
});

test('sunset and Survival stop scheduling during pause or mute and resume without a backlog',async()=>{
  for(const context of [{rulesId:'surf',weatherId:'sunset'},{rulesId:'storm'}]) {
    const {synth,events}=running();synth.setRideContext(context);synth.update(true);
    const stops=[],voice={stop:at=>stops.push(at)};synth.voices.add(voice);
    synth.ctx.currentTime=1;synth.update(false);const count=events.length,beat=synth.beat;
    synth.ctx.currentTime=30;synth.setRideContext(context);synth.update(false);
    assert.equal(events.length,count);assert.equal(synth.beat,beat);assert.equal(stops.length,1);
    synth.update(true);assert.ok(events.length-count<=2);assert.ok(events.slice(count).every(event=>event.at>=30));
    await synth.toggle();const muted=events.length;synth.ctx.currentTime=31;synth.update(true);
    assert.equal(events.length,muted);assert.equal(synth.enabled,false);
  }
});

function arrangement(track,elapsed=0){
  const synth=new ArcadeAudio(),events=[];
  synth.setRideContext({rulesId:track==='survival'?'storm':'surf',weatherId:'sunset',elapsed});
  synth.music='music';synth.sunsetKeys='keys';synth.survivalGuitars=['left','right'];synth.survivalLead='lead';synth.survivalDrums='drums';
  synth._note=(frequency,at,duration,wave,volume,output)=>events.push({kind:'note',frequency,at,duration,wave,volume,output});
  synth._noiseHit=(at,duration,volume,frequency,filter,pan,output)=>events.push({kind:'noise',at,duration,volume,frequency,filter,pan,output});
  synth._guitar=(midi,at,duration,volume,rhythm,pan)=>events.push({kind:'guitar',midi,at,duration,volume,rhythm,pan});
  synth._menuPluck=(midi,at,duration,volume,output,detune)=>events.push({kind:'pluck',midi,at,duration,volume,output,detune});
  const bpm=track==='sunset'?SUNSET_BPM:SURVIVAL_BPM;
  for(let step=0;step<512;step++)synth[track==='sunset'?'_scheduleSunsetStep':'_scheduleSurvivalStep'](step,.04+step*60/bpm/4);
  return events;
}

test('complete arrangements have finite envelopes, distinct instrumentation and a substantially more relaxed sunset pulse',()=>{
  const sunset=arrangement('sunset'),survival=arrangement('survival');
  assert.ok(SUNSET_BPM<SURVIVAL_BPM*.6);
  for(const events of [sunset,survival])for(const event of events) {
    for(const key of ['at','duration','volume'])assert.ok(Number.isFinite(event[key]),`${key} ${JSON.stringify(event)}`);
    assert.ok(event.at>=.04);assert.ok(event.duration>.02);assert.ok(event.volume>0&&event.volume<.5);
    if(event.frequency!==undefined)assert.ok(event.frequency>0&&event.frequency<16000);
  }
  assert.ok(sunset.some(event=>event.kind==='guitar'&&event.duration>1));assert.ok(sunset.some(event=>event.output==='keys'));
  for(const output of ['left','right','lead','drums'])assert.ok(survival.some(event=>event.output===output));
  assert.ok(survival.length>sunset.length*1.7,'survival is more rhythmically active');
  assert.ok(sunset.filter(event=>event.kind==='guitar').every(event=>event.rhythm===true),'sunset guitars use the warm rolled-off timbre');
});

test('Survival urgency adds restrained percussion and a lower hook layer without raising the base instruments',()=>{
  const opening=arrangement('survival',0),urgent=arrangement('survival',240);
  assert.ok(urgent.filter(event=>event.output==='drums').length>opening.filter(event=>event.output==='drums').length);
  assert.ok(urgent.filter(event=>event.output==='lead').length>opening.filter(event=>event.output==='lead').length);
  assert.deepEqual(urgent.filter(event=>event.kind==='pluck'),opening.filter(event=>event.kind==='pluck'));
  assert.deepEqual(urgent.filter(event=>event.output==='music'),opening.filter(event=>event.output==='music'));
  const synth=new ArcadeAudio();for(const elapsed of [NaN,Infinity,-1]){synth.setRideContext({rulesId:'storm',elapsed});assert.equal(synth.survivalIntensity,0);}
  synth.setRideContext({rulesId:'storm',elapsed:99999});assert.equal(synth.survivalIntensity,1);
});

test('the production start chooses the correct theme after the run weather is set',()=>{
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function startRun('),source.indexOf('function goHome('));
  const noop=()=>{},element={classList:{add:noop,remove:noop},focus:noop};
  for(const [selectedMode,expected] of [['surf',SUNSET_TRACK],['storm',SURVIVAL_TRACK]]) {
    const audio=new ArcadeAudio(),game=new SurfGame(noop,selectedMode);
    const context={selectedMode,game,audio,adminPanel:null,wasted:{reset:noop},timePowerScreen:{reset:noop},
      closeWorkshop:noop,closeModal:noop,clearInput:noop,special:{reset:noop},soundPreference:'off',
      applyPlayerSettings:noop,chooseSurfWeather:()=>'sunset',lastSurfWeather:'noon',write:noop,
      world:{setMode:noop},updateModeMenu:noop,updateSoundLabel:noop,$:()=>element,document:{body:element}};
    vm.runInNewContext(code,context);context.startRun();
    assert.equal(audio.trackName,expected);assert.equal(audio.ctx,null);assert.equal(audio.enabled,false);
  }
});
