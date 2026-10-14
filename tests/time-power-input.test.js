import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame } from '../src/game.js';
import { createTimePowerInput } from '../src/time-power-input.js';
import { createKeydownHandler } from '../src/keyboard.js';
import { DEFAULT_KEYBINDS, rebindKey } from '../src/key-bindings.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} should equal ${expected}`);
function fixture() {
  const events=[],game=new SurfGame(event=>events.push(event));
  game.setRewardBoard('deadtime');game.start();
  const state={bootReady:true,homeScreen:false,game,input:{},keybinds:DEFAULT_KEYBINDS};
  const input=createTimePowerInput(()=>state.game);
  const handler=createKeydownHandler(()=>state,{
    pressTimePower:stamp=>input.press(stamp),cancelPowerInput:()=>input.cancel(),
    pause(){input.cancel();game.pause();},
  });
  const press=(code='KeyQ',options={})=>handler({code,timeStamp:0,repeat:false,preventDefault(){},...options});
  return {game,events,state,input,handler,press};
}

test('two distinct power presses start six full seconds of fast-forward without starting slow motion',()=>{
  const {game,events,input,press}=fixture();
  press();near(input.update(.12),.12);assert.equal(game.timePowerActive,false);
  press('KeyQ',{timeStamp:120});assert.equal(game.timePowerMode,'fast');near(game.timePowerCharge,6);
  near(input.update(6),12);assert.equal(game.timePowerActive,false);
  assert.equal(game.timePowerBurstTime,3);
  assert.deepEqual(events.filter(event=>event.type==='timePower'&&event.active).map(event=>event.mode),['fast']);
});

test('a single press resolves at 280 ms and integrates the crossing at every frame size',()=>{
  for(const frames of [[1],[.28,.72],[.279,.001,.72],Array.from({length:60},()=>1/60)]) {
    const {game,input}=fixture();input.press();
    let player=0;
    const simulated=frames.reduce((total,dt)=>{const world=input.update(dt);player+=input.playerDelta;return total+world;},0);
    near(simulated,.28+.72*.4);near(game.timePowerCharge,5.28);
    near(player,1);
    assert.equal(game.timePowerMode,'slow');assert.equal(game.timePowerActive,true);
  }
});

test('a held key triggers only single-press slow motion and a remapped double press starts fast-forward',()=>{
  const held=fixture();held.press();held.input.update(.1);
  held.press('KeyQ',{timeStamp:100,repeat:true});held.input.update(.18);
  assert.equal(held.game.timePowerMode,'slow');assert.equal(held.game.timePowerActive,true);
  const mapped=fixture();mapped.state.keybinds=rebindKey(DEFAULT_KEYBINDS,'timePower','Digit2');
  mapped.press();mapped.input.update(1);assert.equal(mapped.game.timePowerActive,false);
  mapped.press('Digit2',{timeStamp:1000});mapped.input.update(.1);
  mapped.press('Digit2',{timeStamp:1100});assert.equal(mapped.game.timePowerMode,'fast');
  assert.equal(mapped.game.timePowerActive,true);
});

test('pausing, bailing, resetting, switching boards or switching games discard a pending single press',()=>{
  for(const transition of ['pause','bail','reset','board','game','mode']) {
    const f=fixture();f.input.press();f.input.update(.1);
    if(transition==='pause')f.game.pause();
    if(transition==='bail'){f.game.bail();f.game.bailTime=0;}
    if(transition==='reset')f.game.start();
    if(transition==='board'){f.game.setRewardBoard('guitar');f.game.setRewardBoard('deadtime');}
    if(transition==='game')f.state.game=fixture().game;
    if(transition==='mode')f.game.fastForwardTimePower();
    f.input.update(.2);
    if(transition==='pause'){f.game.resume();f.input.update(1);}
    assert.equal(f.state.game.timePowerActive,transition==='mode',transition);
    if(transition==='mode')assert.equal(f.game.timePowerMode,'fast');
  }
});

test('menu cancellation prevents a queued activation after settings, modal, workshop or admin closes',()=>{
  for(const overlay of ['settingsOpen','modalMode','workshopMode','adminOpen']) {
    const f=fixture();f.press();f.input.update(.1);
    f.state[overlay]=overlay.endsWith('Mode')?'board':true;f.handler.cancelPendingPower();
    f.press('KeyQ',{timeStamp:150});f.input.update(.1);
    f.state[overlay]=false;f.input.update(1);
    assert.equal(f.game.timePowerActive,false,overlay);assert.equal(f.game.timePowerCharge,6,overlay);
  }
  const f=fixture();f.press();f.press('Escape',{timeStamp:100});f.game.resume();f.input.update(1);
  assert.equal(f.game.timePowerActive,false);
});

test('forms, home, readiness and cooldown never turn double presses into an eligible power',()=>{
  for(const blocked of ['form','home','boot','countdown','unequipped','cooldown']) {
    const f=fixture();
    if(blocked==='home')f.state.homeScreen=true;
    if(blocked==='boot')f.state.bootReady=false;
    if(blocked==='countdown')f.game.countdownRemaining=2;
    if(blocked==='unequipped')f.game.setRewardBoard('guitar');
    if(blocked==='cooldown'){f.game.fastForwardTimePower();f.game.updateTimePower(6);}
    const options=blocked==='form'?{target:{closest:()=>({})}}:{};
    f.press('KeyQ',options);f.press('KeyQ',{...options,timeStamp:100});f.input.update(.3);
    assert.equal(f.game.timePowerActive,false,blocked);
  }
});

test('extra double taps cannot refill or extend a running six-second charge',()=>{
  const f=fixture();f.input.press(0);f.input.press(100);near(f.input.update(2),4);
  assert.equal(f.input.press(2100),true);assert.equal(f.input.press(2200),false);
  near(f.game.timePowerCharge,4);near(f.input.update(4),8);
  assert.equal(f.game.timePowerActive,false);assert.equal(f.game.timePowerCharge,0);
  assert.equal(f.events.filter(event=>event.type==='timePowerBurst').length,1);
});

test('timestamps outside the double-tap window stay separate and invalid frame deltas do not advance a press',()=>{
  const f=fixture();f.input.press(100);f.input.press(500);
  assert.equal(f.game.timePowerMode,'slow');assert.equal(f.game.timePowerActive,true);
  for(const dt of [NaN,Infinity,-1,0])assert.equal(f.input.update(dt),0);
  near(f.game.timePowerCharge,6);f.input.update(.28);assert.equal(f.game.timePowerActive,false);
  assert.equal(f.events.some(event=>event.type==='timePower'&&event.mode==='fast'),false);
});
