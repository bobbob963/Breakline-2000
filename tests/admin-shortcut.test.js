import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeydownHandler } from '../src/keyboard.js';

const code = ['ArrowLeft','ArrowLeft','ArrowRight','ArrowUp'];

function route() {
  const calls = [];
  const state = { bootReady:true, homeScreen:true, adminOpen:false, workshopMode:null, modalMode:null, input:{}, game:{phase:'ready',bank:()=>calls.push('bank')} };
  const actions = Object.fromEntries(['openAdmin','toggleSound','startRun','closeModal','pause','pressControl','tryTrick','closeWorkshop','cycleCharacter'].map(name => [name,(...args)=>calls.push([name,...args])]));
  actions.isWardrobeOpen = () => false;
  const handler = createKeydownHandler(()=>state,actions);
  let time = 0;
  const press = (key,options={}) => {
    time += 100;
    const event = { code:key,timeStamp:time,repeat:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...options };
    handler(event);
    return event;
  };
  return {state,calls,handler,press,sequence:()=>code.map(key=>press(key))};
}

test('the exact home-screen arrow sequence opens admin once and prevents menu scrolling',()=>{
  const r = route();
  for (const key of code.slice(0,3)) {
    assert.equal(r.press(key).defaultPrevented,true);
    assert.deepEqual(r.calls,[]);
  }
  assert.equal(r.press('ArrowUp').defaultPrevented,true);
  assert.deepEqual(r.calls,[['openAdmin']]);
  r.press('ArrowUp');
  assert.deepEqual(r.calls,[['openAdmin']]);
  r.sequence();
  assert.deepEqual(r.calls,[['openAdmin'],['openAdmin']]);
});

test('wrong order cancels the sequence while overlapping Left prefixes remain usable',()=>{
  const r = route();
  for (const key of ['ArrowLeft','ArrowRight','ArrowLeft','ArrowUp','ArrowLeft','ArrowLeft','ArrowDown','ArrowRight','ArrowUp']) r.press(key);
  assert.deepEqual(r.calls,[]);
  for (const key of ['ArrowLeft','ArrowLeft','ArrowLeft','ArrowRight','ArrowUp']) r.press(key);
  assert.deepEqual(r.calls,[['openAdmin']]);
  r.calls.length=0;
  for (const key of ['ArrowLeft','ArrowLeft','KeyQ','ArrowRight','ArrowUp']) r.press(key);
  assert.deepEqual(r.calls,[]);
});

test('held arrow repeats do not count as fresh presses or extend the two-second timeout',()=>{
  const r = route();
  r.press('ArrowLeft',{timeStamp:100});
  r.press('ArrowLeft',{timeStamp:150,repeat:true});
  r.press('ArrowRight',{timeStamp:200});
  r.press('ArrowUp',{timeStamp:300});
  assert.deepEqual(r.calls,[]);
  r.press('ArrowLeft',{timeStamp:1000});
  r.press('ArrowLeft',{timeStamp:1500});
  r.press('ArrowLeft',{timeStamp:3400,repeat:true});
  r.press('ArrowRight',{timeStamp:3601});
  r.press('ArrowUp',{timeStamp:3700});
  assert.deepEqual(r.calls,[]);
  r.sequence();
  assert.deepEqual(r.calls,[['openAdmin']]);
});

test('two seconds between presses is accepted, longer or backwards timestamps restart the code',()=>{
  for (const gap of [2001,-1]) {
    const r = route();
    r.press('ArrowLeft',{timeStamp:100});
    r.press('ArrowLeft',{timeStamp:200});
    r.press('ArrowRight',{timeStamp:200+gap});
    r.press('ArrowUp',{timeStamp:3000});
    assert.deepEqual(r.calls,[],String(gap));
  }
  const r = route();
  code.forEach((key,i)=>r.press(key,{timeStamp:i*2000}));
  assert.deepEqual(r.calls,[['openAdmin']]);
});

test('the shortcut is unavailable outside the home screen, including legacy state without the home flag',()=>{
  for (const patch of [{homeScreen:false},{homeScreen:undefined},{bootReady:false},{workshopMode:'board'},{modalMode:'help'},{adminOpen:true}]) {
    const r = route();Object.assign(r.state,patch);r.sequence();
    assert.equal(r.calls.some(call=>call[0]==='openAdmin'),false,JSON.stringify(patch));
  }
  const r = route();r.state.homeScreen=false;r.state.game.phase='running';r.sequence();
  assert.deepEqual(r.calls,code.map(key=>['pressControl',key]));
});

test('leaving home and explicit blur reset prevent completing a stale partial code',()=>{
  for (const patch of [{homeScreen:false},{bootReady:false},{workshopMode:'board'},{modalMode:'help'},{adminOpen:true}]) {
    const r = route();r.press('ArrowLeft');r.press('ArrowLeft');
    const previous = {...r.state};Object.assign(r.state,patch);r.press('KeyQ');Object.assign(r.state,previous);
    r.press('ArrowRight');r.press('ArrowUp');
    assert.equal(r.calls.some(call=>call[0]==='openAdmin'),false,JSON.stringify(patch));
    r.sequence();assert.equal(r.calls.at(-1)[0],'openAdmin');
  }
  const r = route();r.press('ArrowLeft');r.press('ArrowLeft');r.handler.resetAdminSequence();
  r.press('ArrowRight');r.press('ArrowUp');assert.deepEqual(r.calls,[]);
});

test('admin fields retain native arrows, Enter and Escape without triggering gameplay shortcuts',()=>{
  const r = route();r.state.adminOpen=true;r.state.game.phase='running';
  for (const key of [...code,'Enter','Escape','KeyM','KeyR','KeyJ','Space']) {
    assert.equal(r.press(key).defaultPrevented,false,key);
  }
  assert.deepEqual(r.calls,[]);
});

test('input, textarea, select and contenteditable focus suppress shortcuts and clear pending code',()=>{
  for (const type of ['input','textarea','select','editable','editable-descendant']) {
    const r = route();r.press('ArrowLeft');r.press('ArrowLeft');
    const target = {isContentEditable:type==='editable',closest:selector=>type==='editable-descendant'?selector.includes('contenteditable'):{input:selector.includes('input'),textarea:selector.includes('textarea'),select:selector.includes('select')}[type]};
    for (const key of [...code,'Enter','Space','KeyM','Escape']) assert.equal(r.press(key,{target}).defaultPrevented,false,`${type}: ${key}`);
    assert.deepEqual(r.calls,[],type);
    r.press('ArrowRight');r.press('ArrowUp');assert.deepEqual(r.calls,[],type);
    r.sequence();assert.deepEqual(r.calls,[['openAdmin']],type);
  }
});

test('focused home buttons still receive their native Enter click',()=>{
  const r = route();
  const event=r.press('Enter',{target:{closest:selector=>selector==='button'}});
  assert.equal(event.defaultPrevented,false);assert.deepEqual(r.calls,[]);
});
