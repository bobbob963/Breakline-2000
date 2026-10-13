import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_KEYBINDS, KEY_BINDING_ACTIONS, getControlMap, getTrickMap, keybindFor, keyLabel, rebindKey, sanitizeKeybinds, validateBindingCode } from '../src/key-bindings.js';
import { createKeydownHandler, CONTROL_KEYS, TRICK_KEYS } from '../src/keyboard.js';

test('default bindings preserve the game controls, movement aliases and every trick',()=>{
  assert.equal(KEY_BINDING_ACTIONS.length,22);
  assert.deepEqual(getControlMap(),CONTROL_KEYS);
  assert.deepEqual(getTrickMap(),TRICK_KEYS);
  assert.equal(CONTROL_KEYS.ArrowLeft,'left');assert.equal(CONTROL_KEYS.ShiftRight,'grind');
  assert.equal(keybindFor(null,'special'),'KeyI');assert.equal(keybindFor(null,'unknown'),null);
  assert.equal(keyLabel('KeyB'),'B');assert.equal(keyLabel('Space'),'SPACE');assert.equal(keyLabel('ShiftRight'),'RIGHT SHIFT');assert.equal(keyLabel('Digit2'),'2');assert.equal(keyLabel('Numpad7'),'NUM 7');
});

test('rebind swaps duplicate primary keys and survives saving and reloading without mutation',()=>{
  const custom=rebindKey(DEFAULT_KEYBINDS,'jump','KeyJ');
  assert.equal(custom.jump,'KeyJ');assert.equal(custom.spin,'Space');
  assert.equal(DEFAULT_KEYBINDS.jump,'Space');
  assert.deepEqual(sanitizeKeybinds(JSON.parse(JSON.stringify(custom))),custom);
  assert.equal(new Set(Object.values(custom)).size,KEY_BINDING_ACTIONS.length);
  const enterSwap=rebindKey(custom,'bank','KeyP');
  assert.equal(enterSwap.bank,'KeyP');assert.equal(enterSwap.pause,'Enter');
  assert.deepEqual(sanitizeKeybinds(enterSwap),enterSwap);
});

test('reserved and malformed inputs never become game bindings',()=>{
  for(const code of ['Escape','Tab','ControlLeft','AltRight','MetaLeft','F5',null,17,'KeyAA','click','__proto__']){
    assert.equal(validateBindingCode(code),false,String(code));
    assert.deepEqual(rebindKey(DEFAULT_KEYBINDS,'jump',code),DEFAULT_KEYBINDS);
  }
  for(const raw of [null,undefined,17,'broken',[]])assert.deepEqual(sanitizeKeybinds(raw),DEFAULT_KEYBINDS);
  const dirty=sanitizeKeybinds({jump:'Escape',spin:'KeyT',left:'KeyT',extra:'KeyZ'});
  assert.equal(dirty.jump,'Space');assert.equal(dirty.extra,undefined);
  assert.equal(new Set(Object.values(dirty)).size,KEY_BINDING_ACTIONS.length);
  assert.deepEqual(rebindKey(DEFAULT_KEYBINDS,'unknown','KeyZ'),DEFAULT_KEYBINDS);
});

test('arrow aliases yield to explicit bindings and right Shift only aliases the default grind key',()=>{
  let custom=rebindKey(DEFAULT_KEYBINDS,'grab','ArrowLeft');
  assert.equal(getControlMap(custom).ArrowLeft,undefined);assert.equal(getTrickMap(custom).ArrowLeft,'grab');
  assert.equal(getControlMap(custom).ArrowRight,'right');
  custom=rebindKey(custom,'grind','KeyZ');assert.equal(getControlMap(custom).ShiftRight,undefined);
  custom=rebindKey(DEFAULT_KEYBINDS,'flip','ShiftRight');
  assert.equal(getControlMap(custom).ShiftLeft,'grind');assert.equal(getControlMap(custom).ShiftRight,undefined);assert.equal(getTrickMap(custom).ShiftRight,'flip');
});

function fixture(){
  const calls=[],state={bootReady:true,homeScreen:false,game:{phase:'running',bank:()=>calls.push(['bank']),toggleTimePower:()=>calls.push(['timePower']),doCutback:direction=>{calls.push(['cutback',direction]);return true;}},input:{left:true},keybinds:{...DEFAULT_KEYBINDS}};
  const actions=Object.fromEntries(['pressControl','tryTrick','toggleSound','pause','restartRun','startRun','openAdmin','closeModal','closeWorkshop','cycleCharacter','rotatePreview','toast'].map(name=>[name,(...args)=>calls.push([name,...args])]));
  actions.isWardrobeOpen=()=>false;
  const handler=createKeydownHandler(()=>state,actions);
  return {state,calls,press(code,options={}){const e={code,repeat:false,preventDefault(){this.defaultPrevented=true;},...options};handler(e);return e;}};
}

test('the live router uses remapped held controls, tricks and single-press session actions',()=>{
  const f=fixture();
  for(const [action,code] of [['jump','KeyZ'],['spin','Digit1'],['timePower','Digit2'],['cutback','Digit3'],['bank','Digit4'],['pause','Digit5'],['restart','Digit6'],['sound','Digit7']])f.state.keybinds=rebindKey(f.state.keybinds,action,code);
  for(const code of ['Space','KeyJ','KeyQ','KeyC','Enter','KeyP','KeyR','KeyM'])f.press(code);
  assert.deepEqual(f.calls,[]);
  for(const code of ['KeyZ','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7'])f.press(code);
  assert.deepEqual(f.calls,[['pressControl','KeyZ'],['tryTrick','spin'],['timePower'],['cutback',-1],['bank'],['pause'],['restartRun'],['toggleSound']]);
  f.calls.length=0;f.press('Digit1',{repeat:true});f.press('KeyZ',{repeat:true});assert.deepEqual(f.calls,[]);
  f.press('Escape');assert.deepEqual(f.calls,[['pause']]);
});

test('settings, forms and browser shortcut modifiers suppress all game routes',()=>{
  for(const block of [{settingsOpen:true},{adminOpen:true}]){
    const f=fixture();Object.assign(f.state,block);for(const code of ['KeyJ','Space','Enter','Escape','KeyM'])f.press(code);assert.deepEqual(f.calls,[]);
  }
  for(const options of [{ctrlKey:true},{altKey:true},{metaKey:true},{target:{isContentEditable:true}},{target:{closest:selector=>selector.includes('input')}}]){
    const f=fixture();for(const code of ['KeyJ','Space','Enter','KeyM'])f.press(code,options);assert.deepEqual(f.calls,[]);
  }
});

test('remapped Enter keeps menu acceptance, native buttons and workshop controls while using its game action',()=>{
  const f=fixture();f.state.keybinds=rebindKey(f.state.keybinds,'pause','Enter');
  f.press('Enter');f.press('KeyP');assert.deepEqual(f.calls,[['pause'],['bank']]);f.calls.length=0;
  f.state.game.phase='paused';f.press('Enter');assert.deepEqual(f.calls,[['pause']]);f.calls.length=0;
  f.state.game.phase='ready';f.press('Enter');assert.deepEqual(f.calls,[['startRun']]);f.calls.length=0;
  f.press('Enter',{target:{closest:selector=>selector==='button'}});assert.deepEqual(f.calls,[]);
  f.state.game.phase='running';f.state.workshopMode='character';f.press('Enter');f.press('KeyC');
  assert.deepEqual(f.calls,[['closeWorkshop'],['rotatePreview',.5]]);
});
