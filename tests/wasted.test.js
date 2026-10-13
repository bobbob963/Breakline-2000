import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createWastedSequence, sampleWastedFrame, WASTED_SECONDS, WASTED_REVEAL_AT, WASTED_SKIP_AFTER } from '../src/wasted.js';
import { SurfGame } from '../src/game.js';
import { WaveParkGame } from '../src/park.js';
import { TournamentGame } from '../src/tournament.js';

class Events {
  listeners = new Map();
  addEventListener(type, callback) { if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(callback); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatch(type, extra = {}) {
    const event={type,target:this,defaultPrevented:false,immediateStopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},stopImmediatePropagation(){this.immediateStopped=true;},...extra};
    for(const callback of this.listeners.get(type)||[]){callback(event);if(event.immediateStopped)break;}
    return event;
  }
}
class Element extends Events {
  constructor(tag, doc) {
    super(); this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes=new Map();this.classes=new Set();this.hidden=false;this.parentNode=null;
    this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),contains:name=>this.classes.has(name)};
    const properties=new Map();this.style={setProperty:(key,value)=>properties.set(key,value),getPropertyValue:key=>properties.get(key)||'',removeProperty:key=>properties.delete(key)};
  }
  set className(value) { this.classes=new Set(value.split(/\s+/)); }
  get className() { return [...this.classes].join(' '); }
  get isConnected() { return this===this.ownerDocument.body||!!this.parentNode?.isConnected; }
  append(...nodes) { for(const node of nodes){node.parentNode=this;this.children.push(node);} }
  remove() { if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null; }
  setAttribute(key,value) { this.attributes.set(key,String(value)); }
  hasAttribute(key) { return this.attributes.has(key); }
  getAttribute(key) { return this.attributes.get(key)??null; }
  removeAttribute(key) { this.attributes.delete(key); }
  contains(node) { return node===this||this.children.some(child=>child.contains(node)); }
  matches(selector) { return selector==='[inert]'?this.hasAttribute('inert'):selector[0]==='#'?this.id===selector.slice(1):selector[0]==='.'?this.classes.has(selector.slice(1)):this.tagName.toLowerCase()===selector; }
  closest(selector) { for(let node=this;node;node=node.parentNode)if(node.matches(selector))return node;return null; }
  querySelector(selector) {
    const [first,...rest]=selector.split(' ');
    for(const child of this.children){if(child.matches(first)){if(!rest.length)return child;const nested=child.querySelector(rest.join(' '));if(nested)return nested;}const found=child.querySelector(selector);if(found)return found;}return null;
  }
  focus() { this.ownerDocument.activeElement=this;this.ownerDocument.dispatch('focusin',{target:this}); }
}
function setup({ originalInert=false, lateCanvas=false }={}) {
  const doc=new Events();doc.defaultView=new Events();doc.createElement=tag=>new Element(tag,doc);doc.body=doc.createElement('body');
  const app=doc.createElement('main');app.id='app';doc.body.append(app);
  const opener=doc.createElement('button');app.append(opener);opener.focus();
  const stage=doc.createElement('div');stage.id='stage';app.append(stage);
  const viewport=doc.createElement('div');viewport.id='viewport';stage.append(viewport);
  const canvas=doc.createElement('canvas');if(!lateCanvas)viewport.append(canvas);
  const map=doc.createElement('canvas');stage.append(map);
  if(originalInert)app.setAttribute('inert','');
  const callbacks=[],frames=[],reveals=[];
  const sequence=createWastedSequence({stage,onStart:()=>callbacks.push('start'),onEnd:({cancelled})=>callbacks.push(cancelled?'cancel':'end'),onComplete:()=>callbacks.push('complete'),onFrame:frame=>frames.push(frame),onReveal:()=>reveals.push(frames.at(-1))});
  const overlay=doc.body.querySelector('.wasted-overlay'),button=overlay.querySelector('button');
  return {doc,app,opener,stage,viewport,canvas,map,sequence,callbacks,overlay,button,frames,reveals};
}

test('a renderer created after the controller is resolved at start without ever selecting the minimap',()=>{
  const {doc,viewport,canvas,map,sequence}=setup({lateCanvas:true});
  sequence.start();
  assert.equal(map.classList.contains('wasted-scene-canvas'),false,'an empty viewport cannot fall back to the HUD map');
  sequence.reset();viewport.append(canvas);sequence.start();
  assert.equal(canvas.classList.contains('wasted-scene-canvas'),true,'late scene construction must receive the effect');
  assert.equal(map.classList.contains('wasted-scene-canvas'),false);
  sequence.update(.9);assert.ok(Number(canvas.style.getPropertyValue('--wasted-progress'))>0);
  sequence.reset();assert.equal(canvas.classList.contains('wasted-scene-canvas'),false);
  canvas.remove();const replacement=doc.createElement('canvas');viewport.append(replacement);sequence.start();
  assert.equal(replacement.classList.contains('wasted-scene-canvas'),true,'a replaced renderer is re-resolved for a subsequent run');
  assert.equal(canvas.classList.contains('wasted-scene-canvas'),false);sequence.destroy();
});

test('sequence locks the app, treats only the game canvas, then restores focus after the full presentation',()=>{
  const {doc,app,opener,canvas,map,sequence,callbacks,overlay,button}=setup();
  assert.equal(sequence.active,false);assert.equal(overlay.hidden,true);sequence.update(10);assert.deepEqual(callbacks,[]);
  assert.equal(sequence.start(),true);assert.equal(sequence.start(),false);
  assert.equal(sequence.active,true);assert.equal(app.hasAttribute('inert'),true);
  assert.equal(canvas.classList.contains('wasted-scene-canvas'),true);assert.equal(map.classList.contains('wasted-scene-canvas'),false);
  assert.equal(overlay.parentNode,doc.body);assert.equal(app.contains(overlay),false,'the title must not inherit the scene filter or inert state');
  assert.equal(overlay.getAttribute('aria-modal'),'true');assert.equal(doc.activeElement,overlay);
  sequence.update(WASTED_SKIP_AFTER-.01);assert.equal(button.hidden,true);assert.equal(sequence.skip(),false);
  sequence.update(.01);assert.equal(button.hidden,false);assert.equal(doc.activeElement,button);
  sequence.update(WASTED_SECONDS-WASTED_SKIP_AFTER-.01);assert.equal(sequence.active,true);assert.equal(callbacks.includes('complete'),false);
  sequence.update(.011);assert.equal(sequence.active,false);assert.equal(overlay.hidden,true);
  assert.equal(app.hasAttribute('inert'),false);assert.equal(canvas.classList.contains('wasted-scene-canvas'),false);
  assert.equal(canvas.style.getPropertyValue('--wasted-progress'),'');assert.equal(doc.activeElement,opener);
  assert.deepEqual(callbacks,['start','end','complete']);sequence.update(100);assert.equal(sequence.skip(),false);assert.equal(sequence.start(),false);
  assert.deepEqual(callbacks,['start','end','complete'],'one finish signal cannot show results twice');
});

test('skip is unavailable until after title reveal and its button completes exactly once',()=>{
  const {sequence,button,callbacks}=setup();sequence.start();button.dispatch('click');assert.equal(sequence.active,true);
  sequence.update(WASTED_SKIP_AFTER);assert.equal(button.hidden,false);button.dispatch('click');button.dispatch('click');sequence.update(20);
  assert.equal(sequence.active,false);assert.deepEqual(callbacks,['start','end','complete']);
});

test('capture blocks gameplay keys and keeps keyboard focus inside the overlay',()=>{
  const {doc,sequence,button,overlay,opener,callbacks}=setup();let leaked=0;
  doc.defaultView.addEventListener('keydown',()=>leaked++);doc.defaultView.addEventListener('keyup',()=>leaked++);
  sequence.start();
  for(const type of ['keydown','keyup'])for(const code of ['KeyR','KeyB','KeyM','Enter','Space','Escape']) {
    const event=doc.defaultView.dispatch(type,{code,repeat:false});assert.equal(event.defaultPrevented,true);assert.equal(event.immediateStopped,true);
  }
  assert.equal(sequence.active,true);assert.equal(leaked,0);
  opener.focus();assert.equal(doc.activeElement,overlay,'programmatic outside focus is returned to the dialog');
  sequence.update(WASTED_SKIP_AFTER);doc.defaultView.dispatch('keydown',{code:'Tab'});assert.equal(doc.activeElement,button);
  doc.defaultView.dispatch('keydown',{code:'Enter',repeat:true});assert.equal(sequence.active,true);
  doc.defaultView.dispatch('keydown',{code:'Enter',repeat:false});assert.equal(sequence.active,false);assert.equal(leaked,0,'the skip key cannot also restart the game');
  assert.deepEqual(callbacks,['start','end','complete']);doc.defaultView.dispatch('keydown',{code:'KeyB'});assert.equal(leaked,1,'normal input is released after cleanup');
});

test('reset cancels pending results and permits a fresh sequence without a late callback',()=>{
  const {sequence,callbacks,app,overlay}=setup();sequence.start();sequence.update(1.5);sequence.reset();
  assert.equal(sequence.active,false);assert.equal(app.hasAttribute('inert'),false);assert.equal(overlay.hidden,true);
  sequence.update(30);assert.deepEqual(callbacks,['start','cancel']);
  assert.equal(sequence.start(),true);sequence.update(WASTED_SECONDS);
  assert.deepEqual(callbacks,['start','cancel','start','end','complete']);sequence.reset();assert.deepEqual(callbacks,['start','cancel','start','end','complete']);
});

test('invalid deltas are ignored and a long background-frame delta settles the sequence once',()=>{
  const {sequence,callbacks,button}=setup();sequence.start();
  for(const dt of [undefined,NaN,Infinity,-Infinity,-3,0])sequence.update(dt);
  assert.equal(sequence.active,true);assert.equal(button.hidden,true);assert.equal(sequence.skip(),false);
  sequence.update(120);sequence.update(120);assert.equal(sequence.active,false);assert.deepEqual(callbacks,['start','end','complete']);
});

test('cleanup preserves pre-existing inert state and canvas properties',()=>{
  const {sequence,app,canvas,callbacks}=setup({originalInert:true});canvas.style.setProperty('--wasted-progress','.25');
  sequence.start();sequence.update(.5);sequence.reset();
  assert.equal(app.hasAttribute('inert'),true);assert.equal(canvas.style.getPropertyValue('--wasted-progress'),'.25');assert.deepEqual(callbacks,['start','cancel']);
});

test('destroy cancels the presentation and removes listeners and DOM permanently',()=>{
  const {sequence,doc,overlay,callbacks}=setup();sequence.start();sequence.update(.9);sequence.destroy();sequence.destroy();sequence.update(10);sequence.reset();
  assert.equal(sequence.start(),false);assert.equal(overlay.isConnected,false);
  assert.equal(doc.defaultView.listeners.get('keydown').size,0);assert.equal(doc.defaultView.listeners.get('keyup').size,0);assert.equal(doc.listeners.get('focusin').size,0);
  assert.deepEqual(callbacks,['start','cancel']);
});

test('the timeline separates first-person, closing eyes, full blackout and the WASTED reveal',()=>{
  assert.deepEqual(sampleWastedFrame(0),{elapsed:0,phase:'first-person',cameraProgress:0,eyeClosure:0,titleVisible:false});
  const halfway=sampleWastedFrame(.14);assert.ok(Math.abs(halfway.cameraProgress-.5)<1e-8);assert.equal(halfway.eyeClosure,0);
  assert.equal(sampleWastedFrame(.28).cameraProgress,1);
  assert.equal(sampleWastedFrame(.55).phase,'eyes-closing');assert.equal(sampleWastedFrame(.55).eyeClosure,0);
  const closing=sampleWastedFrame(1.025);assert.ok(Math.abs(closing.eyeClosure-.5)<1e-8);assert.equal(closing.titleVisible,false);
  assert.deepEqual(sampleWastedFrame(1.5),{elapsed:1.5,phase:'blackout',cameraProgress:1,eyeClosure:1,titleVisible:false});
  assert.equal(sampleWastedFrame(WASTED_REVEAL_AT-.001).phase,'blackout');
  assert.equal(sampleWastedFrame(WASTED_REVEAL_AT).phase,'wasted');assert.equal(sampleWastedFrame(WASTED_REVEAL_AT).titleVisible,true);
  assert.equal(sampleWastedFrame(100).elapsed,WASTED_SECONDS);
  for(const value of [-1,undefined,NaN,Infinity])assert.deepEqual(sampleWastedFrame(value),sampleWastedFrame(0));
});

test('WASTED stays visually and accessibly hidden through a fully black hold, then reveals once',()=>{
  const {sequence,overlay,frames,reveals,button}=setup(),band=overlay.querySelector('.wasted-band');
  sequence.start();assert.equal(frames.length,1);assert.equal(frames[0].phase,'first-person');
  assert.equal(band.hidden,true);assert.equal(band.getAttribute('aria-hidden'),'true');
  assert.equal(overlay.getAttribute('aria-label'),'Final wipeout');assert.equal(overlay.hasAttribute('aria-labelledby'),false);
  sequence.update(1.5);assert.equal(overlay.getAttribute('data-phase'),'blackout');
  assert.equal(overlay.style.getPropertyValue('--wasted-blackout'),'1');assert.equal(band.hidden,true);assert.equal(reveals.length,0);
  sequence.update(.349);assert.equal(band.hidden,true);assert.equal(button.hidden,true);
  sequence.update(.002);assert.equal(band.hidden,false);assert.equal(band.hasAttribute('aria-hidden'),false);
  assert.equal(overlay.getAttribute('aria-labelledby'),band.querySelector('h2').id);assert.equal(overlay.hasAttribute('aria-label'),false);
  assert.equal(reveals.length,1);assert.equal(reveals[0].phase,'wasted');assert.equal(button.hidden,true);
  sequence.update(.1);assert.equal(reveals.length,1);sequence.destroy();
});

test('large frame deltas reveal exactly once before completing and restarting clears the old title',()=>{
  const {sequence,reveals,frames,overlay,callbacks}=setup(),band=overlay.querySelector('.wasted-band');
  sequence.start();sequence.update(100);sequence.update(100);
  assert.equal(reveals.length,1);assert.equal(frames.at(-1).elapsed,WASTED_SECONDS);assert.deepEqual(callbacks,['start','end','complete']);
  sequence.reset();sequence.start();assert.equal(band.hidden,true);assert.equal(overlay.getAttribute('data-phase'),'first-person');
  assert.equal(overlay.style.getPropertyValue('--wasted-blackout'),'0');assert.equal(overlay.style.getPropertyValue('--wasted-eye-closure'),'0');
  sequence.update(WASTED_REVEAL_AT);assert.equal(reveals.length,2);sequence.destroy();
});

test('resetting before reveal cannot play a stale reveal effect',()=>{
  const {sequence,reveals}=setup();sequence.start();sequence.update(1.6);sequence.reset();sequence.update(100);
  assert.equal(reveals.length,0);sequence.start();sequence.update(WASTED_REVEAL_AT);assert.equal(reveals.length,1);sequence.destroy();
});

function applicationDeathRoute(mode) {
  const ui=setup();ui.sequence.destroy();
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const creation=source.indexOf('const wasted=createWastedSequence('),creationEnd=source.indexOf('const modeInfo=',creation);
  const eventStart=source.indexOf('function onEvent(e)'),eventEnd=source.indexOf('function makeGame()',eventStart);
  assert.ok(creation>=0&&creationEnd>creation&&eventStart>=0&&eventEnd>eventStart,'production finish routing exists');
  const calls={results:0,cleared:0,saves:0,audio:[],progress:[],camera:[],deathAudio:[]},noOp=()=>{};
  const context={
    createWastedSequence,$:id=>id==='stage'?ui.stage:null,selectedMode:mode,game:undefined,
    world:{onEvent:noOp,startWastedView:()=>calls.camera.push('start'),updateWastedView:frame=>calls.camera.push(frame.phase),endWastedView:()=>calls.camera.push('end')},
    audio:{event:type=>calls.audio.push(type),startWastedSequence:()=>calls.deathAudio.push('start'),revealWasted:()=>calls.deathAudio.push('reveal'),endWastedSequence:()=>calls.deathAudio.push('end')},
    timePowerScreen:{reset:noOp},special:{gain:noOp,bail:noOp},toast:noOp,fmt:String,
    isParkMode:()=>mode==='park'||mode==='tournament',
    clearInput:()=>calls.cleared++,showResults:()=>calls.results++,saveBest:()=>calls.saves++,
    write:(key,value)=>calls.progress.push([key,JSON.parse(value)]),tournamentProgress:null,
  };
  vm.runInNewContext(`${source.slice(creation,creationEnd)}\n${source.slice(eventStart,eventEnd)}\nglobalThis.sequence=wasted;`,context);
  context.game=mode==='tournament'?new TournamentGame(context.onEvent):mode==='park'?new WaveParkGame(context.onEvent):new SurfGame(context.onEvent,mode);
  context.game.start();
  return {ui,context,calls,game:context.game,sequence:context.sequence};
}

test('the actual application routes only the third Storm wipeout through WASTED before one result',()=>{
  const {game,sequence,calls,ui}=applicationDeathRoute('storm');
  for(let wipeout=1;wipeout<=3;wipeout++) {
    game.bail('DEATH ROUTE FIXTURE');
    assert.equal(game.wipeouts,wipeout);assert.equal(game.lives,3-wipeout);
    assert.equal(sequence.active,wipeout===3);assert.equal(calls.results,0);
    if(wipeout<3) {
      assert.equal(game.phase,'running');
      for(let frame=0;frame<250&&game.bailTime>0;frame++)game.update(1/120);
      assert.equal(game.bailTime,0);
    }
  }
  assert.equal(game.phase,'finished');assert.equal(ui.canvas.classList.contains('wasted-scene-canvas'),true);
  assert.equal(calls.audio.filter(type=>type==='finish').length,0,'the normal finish sound does not play over the death presentation');
  assert.equal(calls.audio.filter(type=>type==='bail').length,2,'only recoverable wipeouts use the regular bail sound');
  assert.deepEqual(calls.camera,['start','first-person']);assert.deepEqual(calls.deathAudio,['start']);
  sequence.update(1.1);assert.equal(calls.camera.at(-1),'eyes-closing');assert.deepEqual(calls.deathAudio,['start']);
  sequence.update(.5);assert.equal(calls.camera.at(-1),'blackout');assert.deepEqual(calls.deathAudio,['start']);
  sequence.update(.4);assert.equal(calls.camera.at(-1),'wasted');assert.deepEqual(calls.deathAudio,['start','reveal']);
  sequence.update(WASTED_SECONDS-2-.01);assert.equal(calls.results,0);
  sequence.update(.02);assert.equal(calls.results,1);assert.equal(sequence.active,false);
  assert.equal(calls.camera.at(-1),'end');assert.deepEqual(calls.deathAudio,['start','reveal','end']);
  game.bail();game.finish();sequence.update(20);assert.equal(calls.results,1);
  assert.equal(game.wipeouts,3);assert.equal(game.lives,0);sequence.destroy();
});

test('other modes and non-death Storm finishes open results directly through production routing',()=>{
  for(const mode of ['surf','rush','park','tournament','storm']) {
    const {game,sequence,calls}=applicationDeathRoute(mode);
    game.finish('SESSION FIXTURE');
    assert.equal(game.phase,'finished',mode);assert.equal(sequence.active,false,mode);
    assert.equal(calls.results,1,mode);assert.equal(calls.audio.filter(type=>type==='finish').length,1,mode);
    assert.deepEqual(calls.camera,[]);assert.deepEqual(calls.deathAudio,[]);
    sequence.update(10);assert.equal(calls.results,1,mode);
    if(mode==='tournament')assert.deepEqual(calls.progress,[['breakline99-tournament-v2',{version:2,ladderIndex:0,completedRounds:0,completedLadders:0}]]);
    sequence.destroy();
  }
});
