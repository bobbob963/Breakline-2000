import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeAudio} from '../src/audio.js';

function param(value=0){
  return {value,calls:[],cancelScheduledValues(at){this.calls.push(['cancel',at]);},
    setValueAtTime(value,at){this.value=value;this.calls.push(['set',value,at]);},
    setTargetAtTime(value,at,constant){this.value=value;this.calls.push(['target',value,at,constant]);},
    exponentialRampToValueAtTime(value,at){this.value=value;this.calls.push(['ramp',value,at]);}};
}
function running(){
  const nodes=[],sources=[],scheduled=[];
  const node=kind=>{
    const value={kind,disconnected:false,connections:[],gain:param(),frequency:param(),Q:param(),pan:param(),
      connect(output){this.connections.push(output);},disconnect(){this.disconnected=true;},
      start(at){this.started=at;},stop(at){this.stops??=[];this.stops.push(at);}};
    nodes.push(value);if(kind==='oscillator'||kind==='buffer')sources.push(value);return value;
  };
  const synth=new ArcadeAudio();synth.ctx={state:'running',currentTime:5,
    createGain:()=>node('gain'),createOscillator:()=>node('oscillator'),createBiquadFilter:()=>node('filter'),
    createStereoPanner:()=>node('pan'),createBufferSource:()=>node('buffer'),async close(){this.state='closed';}};
  for(const bus of ['master','music','menuMusic','raceMusic','effects'])synth[bus]=node(bus);
  synth.noise={};synth.enabled=true;synth.active=true;synth.nextBeat=5;
  for(const method of ['_scheduleStep','_scheduleMenuStep','_scheduleRaceStep','_scheduleSunsetStep','_scheduleSurvivalStep'])
    synth[method]=(step,at)=>scheduled.push({step,at});
  return {synth,nodes,sources,scheduled};
}

test('final wipeout has an immediate muffled rush and delayed heartbeats, followed by one separate reveal impact',()=>{
  const {synth,sources,nodes}=running();
  assert.equal(synth.startWastedSequence(),true);assert.equal(sources.length,5);
  assert.ok(sources.some(source=>source.kind==='buffer'&&source.loop));
  assert.ok(sources.filter(source=>source.kind==='oscillator').some(source=>source.started>6),'a later heartbeat is scheduled');
  assert.equal(synth.startWastedSequence(),false);assert.equal(sources.length,5);
  synth.ctx.currentTime=6.85;assert.equal(synth.revealWasted(),true);assert.equal(sources.length,9);
  assert.ok(sources.slice(5).every(source=>source.started>=6.85));
  assert.equal(synth.revealWasted(),false);assert.equal(sources.length,9);
  for(const source of sources){assert.ok(Number.isFinite(source.started));assert.ok(source.stops[0]>source.started);}
  for(const node of nodes)for(const parameter of ['frequency','gain'])for(const call of node[parameter].calls){
    assert.ok(call.slice(1).every(Number.isFinite),`${parameter} uses finite automation`);
    if(parameter==='gain'&&call[0]==='ramp')assert.ok(call[1]>0&&call[1]<=.3,'bounded original SFX envelopes');
  }
  const rushFilter=nodes.find(node=>node.kind==='filter'&&node.frequency.calls[0]?.[1]===2900);
  assert.deepEqual(rushFilter.frequency.calls.at(-1),['ramp',145,6.58]);
});

test('cinematic suppresses music and normal effects across menu, ride and weather changes, then restores the selected scene',()=>{
  const {synth,sources,scheduled}=running();synth.startWastedSequence();
  for(const scene of ['menu','race','ride']){
    synth.setScene(scene);synth.setRideContext({rulesId:'surf',weatherId:'sunset'});
    synth.ctx.currentTime+=.25;synth.update(false);synth.update(true);
    synth.event('finish');synth.event('bail');
    for(const bus of ['music','menuMusic','raceMusic'])assert.equal(synth[bus].gain.value,0);
  }
  assert.equal(scheduled.length,0);assert.equal(sources.length,5);
  synth.setScene('menu');synth.endWastedSequence();
  assert.equal(synth.menuMusic.gain.value,.88);assert.equal(synth.music.gain.value,0);
  assert.equal(synth.active,false);synth.update(false);assert.equal(scheduled.length,0);
  synth.update(true);assert.ok(scheduled.length>0);assert.ok(scheduled.every(event=>event.at>=synth.ctx.currentTime));
});

test('skipping disconnects every scheduled cinematic source and node immediately, including future heartbeats',()=>{
  const {synth,sources}=running();synth.startWastedSequence();
  const owned=[...synth._wastedVoices].flatMap(([source,nodes])=>[source,...nodes]);
  const bus=synth._wastedBus;synth.endWastedSequence();
  assert.ok(owned.every(node=>node.disconnected));assert.ok(bus.disconnected);
  assert.ok(sources.every(source=>source.stops.at(-1)===undefined),'stop now rather than at a future frame');
  assert.equal(synth.voices.size,0);assert.equal(synth._wastedVoices.size,0);
  assert.equal(synth.revealWasted(),false);assert.equal(sources.length,5);
  synth.startWastedSequence();assert.equal(synth._wastedVoices.size,5,'next wipeout may play afresh');
});

test('mute cancels cinematic tails and never replays the introduction or title on unmute',async()=>{
  const {synth,sources}=running();synth.startWastedSequence();synth.revealWasted();
  const owned=[...synth._wastedVoices].flatMap(([source,nodes])=>[source,...nodes]);
  await synth.toggle();assert.equal(synth.enabled,false);assert.equal(synth._wastedVoices.size,0);
  assert.ok(owned.every(node=>node.disconnected));const count=sources.length;
  synth.enabled=true;synth.update(true);assert.equal(synth.revealWasted(),false);assert.equal(sources.length,count);
  synth.endWastedSequence();assert.equal(synth._wasted,false);
});

test('muted, unavailable and suspended audio stay silent without constructing or unlocking a context',()=>{
  const unavailable=new ArcadeAudio();assert.equal(unavailable.startWastedSequence(),false);
  assert.equal(unavailable.revealWasted(),false);assert.equal(unavailable.ctx,null);assert.equal(unavailable.enabled,false);
  unavailable.endWastedSequence();
  for(const muted of [true,false]){
    const {synth,sources}=running();if(muted)synth.enabled=false;else synth.ctx.state='suspended';
    assert.equal(synth.startWastedSequence(),false);assert.equal(synth.revealWasted(),false);
    assert.equal(sources.length,0);synth.endWastedSequence();assert.equal(synth._wasted,false);
  }
});

test('ended cinematic voices release their nodes and disposal releases the remaining effect graph',async()=>{
  const {synth,sources}=running();synth.startWastedSequence();
  const first=sources[0],firstNodes=synth._wastedVoices.get(first);first.onended();
  assert.ok(first.disconnected);assert.ok(firstNodes.every(node=>node.disconnected));assert.equal(synth._wastedVoices.size,4);
  const remainder=[...synth._wastedVoices].flatMap(([source,nodes])=>[source,...nodes]);
  const bus=synth._wastedBus;await synth.dispose();assert.ok(remainder.every(node=>node.disconnected));assert.ok(bus.disconnected);
  assert.equal(synth.ctx,null);assert.equal(synth.voices.size,0);assert.equal(synth._wasted,false);
});
