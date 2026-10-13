import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ArcadeAudio, RADIO_TRACKS } from '../src/audio.js';

const source=readFileSync(new URL('../src/radio.js',import.meta.url),'utf8');

// Exercise the real controller and audio selection state. This DOM adapter covers
// control events; the chrome artwork and hover reveal are checked in the browser.
function radioFixture() {
  const calls={saved:[],interactions:0,exits:0,toggles:0};
  const document={activeElement:null};
  class Element {
    constructor(id='',tagName='DIV',parentElement=null){
      this.id=id;this.tagName=tagName;this.parentElement=parentElement;this.value='';
      this.textContent='';this.innerHTML='';this.children=[];this.attributes=new Map();
      this.events=new Map();this.dataset={};this.disabled=false;this.hidden=false;
      this.classList={toggle(){},add(){},remove(){}};
    }
    querySelector(selector){return elements.get(selector);}
    querySelectorAll(selector){return [...elements.values()].filter(element=>element.matches(selector));}
    matches(selector){return selector.split(',').some(part=>{part=part.trim();return part===`#${this.id}`||part.toUpperCase()===this.tagName||part===':focus-visible'&&this.keyboardFocused;});}
    closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)??null;}
    contains(element){return element===this||element?.parentElement&&this.contains(element.parentElement);}
    addEventListener(type,handler){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(handler);}
    removeEventListener(type,handler){this.events.get(type)?.delete(handler);}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name)??null;}
    append(...children){this.children.push(...children);}
    appendChild(child){this.append(child);return child;}
    replaceChildren(...children){this.children=children;}
    focus(){document.activeElement=this;}
    blur(){if(document.activeElement===this)document.activeElement=null;}
    async dispatch(type,details={}){
      const event={type,target:this,currentTarget:this,key:'',code:'',repeat:false,defaultPrevented:false,stopped:false,
        preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...details};
      for(let current=this;current;current=event.stopped?null:current.parentElement){
        event.currentTarget=current;
        for(const handler of current.events.get(type)??[])await handler(event);
      }
      return event;
    }
  }
  const root=new Element('radio');root.ownerDocument=document;
  const elements=new Map([
    ['#radio-track',new Element('radio-track','SELECT',root)],
    ...['radio-shuffle','radio-auto','sound','help'].map(id=>[`#${id}`,new Element(id,'BUTTON',root)]),
    ...['music-track','radio-status','radio-sound-label'].map(id=>[`#${id}`,new Element(id,'SPAN',root)]),
  ]);
  document.createElement=tag=>new Element('',tag.toUpperCase());
  const context={document,RADIO_TRACKS};
  vm.runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace('export function createRadio','function createRadio'),context);
  const audio=new ArcadeAudio();
  const radio=context.createRadio({element:root,audio,
    onSelection:value=>calls.saved.push(value),onInteract:()=>calls.interactions++,onExit:()=>calls.exits++,
    onToggleSound:()=>{calls.toggles++;audio.enabled=!audio.enabled;},
  });
  const query=selector=>elements.get(selector);
  return {root,radio,audio,calls,query,document,
    click:id=>query(id).dispatch('click'),
    change:async value=>{const select=query('#radio-track');select.value=value;await select.dispatch('change');},
    key:(type,key,selector='#radio-shuffle',details={})=>query(selector).dispatch(type,{key,code:key.toLowerCase()==='m'?'KeyM':key,...details}),
  };
}

test('radio lists automatic mode and all five available songs without granting audio permission',()=>{
  const f=radioFixture(),select=f.query('#radio-track');
  const options=select.innerHTML||select.children.map(option=>`value="${option.value}" ${option.textContent}`).join(' ');
  for(const id of ['auto',...RADIO_TRACKS.map(track=>track.id)])assert.match(options,new RegExp(`value=["']${id}["']`));
  assert.equal(f.audio.selection,'auto');assert.equal(f.audio.ctx,null);assert.equal(f.audio.enabled,false);
});

test('manual selection and shuffle persist the chosen song while muted and shuffle never repeats the current track',async()=>{
  const f=radioFixture();await f.change('sunset');
  assert.equal(f.audio.selection,'sunset');assert.equal(f.calls.saved.at(-1),'sunset');
  assert.equal(f.query('#radio-track').value,'sunset');
  assert.equal(f.query('#music-track').textContent,f.audio.trackName.toUpperCase());
  for(let count=0;count<12;count++){
    const previous=f.audio.currentTrackId;
    await f.click('#radio-shuffle');
    assert.notEqual(f.audio.currentTrackId,previous);assert.equal(f.calls.saved.at(-1),f.audio.selection);
    assert.equal(f.query('#radio-track').value,f.audio.selection);
  }
  assert.equal(f.audio.ctx,null);assert.equal(f.audio.enabled,false);assert.equal(f.calls.toggles,0);
});

test('Auto restores mode-based music and sync reflects mode changes without overwriting a manual choice',async()=>{
  const f=radioFixture();f.audio.setScene('menu');await f.change('sunset');
  f.audio.setScene('race');f.radio.sync();assert.equal(f.query('#music-track').textContent,f.audio.trackName.toUpperCase());
  assert.equal(f.audio.currentTrackId,'sunset');
  await f.click('#radio-auto');
  assert.equal(f.audio.selection,'auto');assert.equal(f.audio.currentTrackId,'race');assert.equal(f.calls.saved.at(-1),'auto');
  assert.equal(f.query('#radio-auto').getAttribute('aria-pressed'),'true');
  assert.equal(f.query('#radio-track').value,'auto');
  f.audio.setScene('menu');f.radio.sync();assert.equal(f.query('#music-track').textContent,f.audio.trackName.toUpperCase());
  assert.equal(f.audio.currentTrackId,'menu');
});

test('radio takes held game controls on interaction and keeps control key events out of gameplay',async()=>{
  const f=radioFixture();await f.query('#radio-track').dispatch('pointerdown');
  await f.query('#radio-track').dispatch('focusin');assert.ok(f.calls.interactions>0);
  for(const key of ['j','J','ArrowLeft','ArrowRight',' ','Enter']){
    const down=await f.key('keydown',key),up=await f.key('keyup',key);
    assert.equal(down.stopped,true,`${key} keydown must not reach the game`);
    assert.equal(up.stopped,true,`${key} keyup must not release a game pop`);
    if(key===' '||key==='Enter')assert.equal(down.defaultPrevented,false,'native button activation must work');
  }
});

test('Escape returns focus to gameplay, while M toggles sound except during native song selection',async()=>{
  const f=radioFixture();const escaped=await f.key('keydown','Escape');
  assert.equal(f.calls.exits,1);assert.equal(escaped.stopped,true);assert.equal(escaped.defaultPrevented,true);
  await f.key('keydown','m');assert.equal(f.calls.toggles,1);
  await f.key('keydown','m','#radio-track');assert.equal(f.calls.toggles,1,'typing in the select should keep native song matching');
  await f.key('keydown','M','#radio-shuffle',{repeat:true});assert.equal(f.calls.toggles,1,'a held shortcut toggles only once');
});

test('mouse tuning releases radio focus, while keyboard tuning keeps controls available until Escape',async()=>{
  const f=radioFixture(),shuffle=f.query('#radio-shuffle');
  shuffle.focus();await shuffle.dispatch('pointerdown');await f.click('#radio-shuffle');
  assert.equal(f.calls.exits,1,'a mouse click returns control to the run after tuning');
  await f.key('keydown','Enter');await f.click('#radio-shuffle');
  assert.equal(f.calls.exits,1,'keyboard activation keeps the radio available for another choice');
  await f.key('keydown','Escape');assert.equal(f.calls.exits,2);
  await shuffle.dispatch('pointerdown');await f.root.dispatch('pointerleave');
  assert.equal(f.calls.exits,3,'leaving after mouse focus should not pin the console open');
  await shuffle.dispatch('pointerdown');shuffle.keyboardFocused=true;await shuffle.dispatch('focusin');
  await f.root.dispatch('pointerleave');assert.equal(f.calls.exits,3,'visible keyboard focus survives a pointer leave');
});

test('disposing the controller removes its listeners and no longer changes music or handles keys',async()=>{
  const f=radioFixture();f.radio.dispose();
  const listeners=[f.root,...['#radio-track','#radio-shuffle','#radio-auto','#sound'].map(f.query)].flatMap(element=>[...element.events.values()]);
  assert.ok(listeners.every(handlers=>handlers.size===0));
  await f.change('sunset');await f.click('#radio-shuffle');await f.click('#radio-auto');
  const down=await f.key('keydown','m');
  assert.equal(f.audio.selection,'auto');assert.deepEqual(f.calls.saved,[]);assert.equal(f.calls.toggles,0);assert.equal(down.stopped,false);
});
