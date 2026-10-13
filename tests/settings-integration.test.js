import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { PLAYER_SETTINGS_KEY, sanitizePlayerSettings } from '../src/player-settings.js';
import { IDENTITY_KEY, sanitizeRiderName } from '../src/rider-identity.js';
import { persistAdminEntries } from '../src/admin-save.js';
import { getControlMap } from '../src/key-bindings.js';
import { remapControlText, remapKeyLabel } from '../src/control-labels.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),noop=()=>{};
function productionFunction(name) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start,`production ${name} exists`);
  return source.slice(start,end);
}
function fixture(phase='running') {
  const elements=new Map(),calls={pause:0,resume:0,open:0,views:[],volumes:[],names:[],hud:0,pop:0},data=new Map();
  const $=id=>{
    if(!elements.has(id)){
      const classes=new Set();elements.set(id,{textContent:'',innerHTML:'',dataset:{},focus:noop,classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)}});
    }
    return elements.get(id);
  };
  const badges=[{textContent:'SPACE',dataset:{}},{textContent:'J',dataset:{}}];
  const c={PLAYER_SETTINGS_KEY,IDENTITY_KEY,sanitizePlayerSettings,sanitizeRiderName,persistAdminEntries,getControlMap,remapKeyLabel,
    playerSettings:sanitizePlayerSettings(),riderIdentity:{name:'Old Rider',tutorialComplete:true},settingsResume:false,
    localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)},
    game:{phase,pause(){calls.pause++;this.phase='paused';},resume(){calls.resume++;this.phase='running';}},
    settingsPanel:{isOpen:false,open(){calls.open++;this.isOpen=true;}},tutorial:{isOpen:false},adminPanel:{isOpen:false},wasted:{active:false},
    input:{left:false,right:false,jump:false,grind:false},pressed:new Set(),keydownHandler:{resetAdminSequence:noop},
    bootReady:true,workshopMode:null,modalMode:null,world:{applyViewSettings:value=>calls.views.push(value)},
    audio:{setVolumes:(...args)=>calls.volumes.push(args)},menuSurfer:{setName:name=>calls.names.push(name)},
    updateHud:()=>calls.hud++,tryPop:()=>calls.pop++,$,document:{body:$('body'),querySelectorAll:()=>badges},
  };
  c.keyMap=getControlMap(c.playerSettings.keybinds);c.controlHint=text=>remapControlText(text,c.playerSettings.keybinds);
  vm.runInNewContext(['clearInput','openSettings','closeSettings','applyGamePreferences','applySettings','syncInput','adminHomeScreen','startRun'].map(productionFunction).join('\n'),c);
  let keyup;
  c.window={addEventListener:(type,callback)=>{if(type==='keyup')keyup=callback;}};
  const start=source.indexOf("window.addEventListener('keyup'"),end=source.indexOf("window.addEventListener('blur'",start);
  vm.runInNewContext(source.slice(start,end),c);
  return {c,calls,data,elements,badges,keyup};
}

test('opening settings releases held controls and pauses only the live session it will resume',()=>{
  const {c,calls}=fixture();c.pressed.add('Space');c.pressed.add('KeyA');c.syncInput();assert.equal(c.input.jump,true);
  c.openSettings();assert.equal(c.game.phase,'paused');assert.equal(c.settingsResume,true);assert.equal(calls.pause,1);
  assert.equal(c.pressed.size,0);assert.ok(Object.values(c.input).every(value=>value===false));
  c.settingsPanel.isOpen=false;c.closeSettings();assert.equal(c.game.phase,'running');assert.equal(calls.resume,1);assert.equal(c.settingsResume,false);
  for(const phase of ['ready','paused','finished']) {
    const next=fixture(phase);next.c.openSettings();next.c.settingsPanel.isOpen=false;next.c.closeSettings();
    assert.equal(next.c.game.phase,phase);assert.equal(next.calls.pause,0);assert.equal(next.calls.resume,0);
  }
});

test('settings cannot nest under boot, tutorial, admin, workshop or death presentation, and block starting a run',()=>{
  for(const update of [c=>c.bootReady=false,c=>c.tutorial.isOpen=true,c=>c.adminPanel.isOpen=true,c=>c.workshopMode='character',c=>c.wasted.active=true,c=>c.settingsPanel.isOpen=true]) {
    const {c,calls}=fixture('ready');update(c);c.openSettings();assert.equal(calls.open,0);
  }
  const {c}=fixture('ready');assert.equal(c.adminHomeScreen(),true);c.openSettings();assert.equal(c.adminHomeScreen(),false);
  assert.doesNotThrow(()=>c.startRun());assert.equal(c.game.phase,'ready');
});

test('Apply saves name and preferences together, applies render/audio controls, and releases old bindings',()=>{
  const {c,calls,data,elements,badges}=fixture();c.pressed.add('Space');c.syncInput();
  const next=sanitizePlayerSettings({...c.playerSettings,quality:'clean',camera:'wide',cameraHeight:1.5,musicVolume:30,effectsVolume:60,keybinds:{...c.playerSettings.keybinds,jump:'KeyZ'}});
  c.applySettings(next,{name:'  New   Rider  '});
  assert.equal(c.riderIdentity.name,'New Rider');assert.equal(c.riderIdentity.tutorialComplete,true);assert.deepEqual(calls.names,['New Rider']);
  assert.deepEqual(JSON.parse(data.get(PLAYER_SETTINGS_KEY)),next);assert.equal(JSON.parse(data.get(IDENTITY_KEY)).name,'New Rider');
  assert.equal(calls.views.at(-1).camera,'wide');assert.deepEqual(calls.volumes.at(-1),[30,60]);assert.equal(calls.hud,1);
  assert.equal(elements.get('quality').textContent,'VIDEO: CLEAN');assert.equal(badges[0].textContent,'Z');
  assert.equal(c.keyMap.KeyZ,'jump');assert.equal(c.keyMap.Space,undefined);assert.equal(c.input.jump,false);assert.equal(c.pressed.size,0);
});

test('an invalid name or rejected save leaves live settings, identity, audio and render state unchanged',()=>{
  const {c,calls,data}=fixture(),before=c.playerSettings,identity=c.riderIdentity;
  assert.throws(()=>c.applySettings({...before,quality:'clean'},{name:' '}),/name/);
  data.set(PLAYER_SETTINGS_KEY,JSON.stringify(before));data.set(IDENTITY_KEY,JSON.stringify(identity));
  const set=c.localStorage.setItem;c.localStorage.setItem=(key,value)=>{if(key===IDENTITY_KEY)throw new Error('blocked');return set(key,value);};
  assert.throws(()=>c.applySettings({...before,quality:'clean'},{name:'New Rider'}),/save/i);
  assert.equal(c.playerSettings,before);assert.equal(c.riderIdentity,identity);assert.equal(JSON.parse(data.get(PLAYER_SETTINGS_KEY)).quality,'retro');
  assert.equal(calls.views.length,0);assert.equal(calls.volumes.length,0);assert.equal(calls.names.length,0);
});

test('closing settings cannot pop a held old key; a newly mapped jump releases exactly once',()=>{
  const {c,calls,keyup}=fixture();c.pressed.add('Space');c.syncInput();c.openSettings();
  c.applySettings({...c.playerSettings,keybinds:{...c.playerSettings.keybinds,jump:'KeyZ'}},{name:'Rider'});
  keyup({code:'Space'});assert.equal(calls.pop,0);
  c.settingsPanel.isOpen=false;c.closeSettings();keyup({code:'Space'});assert.equal(calls.pop,0);
  c.pressed.add('KeyZ');c.syncInput();assert.equal(c.input.jump,true);keyup({code:'KeyZ'});keyup({code:'KeyZ'});
  assert.equal(calls.pop,1);assert.equal(c.input.jump,false);assert.equal(c.pressed.size,0);
});

test('saving settings over Help preserves its responsibility to resume the original run',()=>{
  const {c,calls}=fixture();
  Object.assign(c,{resumeAfterModal:false,isParkMode:()=>false,COMBO_ANIMATIONS:[],selectedMode:'surf',remapControlsElement:noop});
  Object.assign(c.game,{popRecoveryDuration:1,comboWindow:2,characterSpecial:{name:'TIDAL RODEO',description:'Corked spin.'}});
  vm.runInNewContext(['openModal','closeModal','showHelp'].map(productionFunction).join('\n'),c);
  c.showHelp();assert.equal(c.game.phase,'paused');assert.equal(c.resumeAfterModal,true);
  c.openSettings();c.applySettings({...c.playerSettings,quality:'clean'},{name:'Rider'});
  assert.equal(c.modalMode,'help');assert.equal(c.resumeAfterModal,true,'rebuilding Help must not drop the original pause owner');
  c.settingsPanel.isOpen=false;c.closeSettings();assert.equal(c.game.phase,'paused');
  c.closeModal();assert.equal(c.game.phase,'running');assert.equal(calls.resume,1);
});
