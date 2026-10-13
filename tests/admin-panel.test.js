import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ADMIN_CHARACTER_FIELDS, ADMIN_BOARD_FIELDS, getAdminScope, updateAdminScope, resetAdminScope, sanitizeAdminSettings } from '../src/admin-settings.js';
import { getRewardBoard } from '../src/board-rewards.js';

const source=readFileSync(new URL('../src/admin-panel.js',import.meta.url),'utf8');
const noOp=()=>{};

// A small DOM adapter exercises the panel's actual event handlers and unsaved draft.
// Browser rendering is checked separately; these tests cover save/cancel semantics.
function panelFixture(initial={}) {
  const calls={applied:[],give:0,reset:0,closed:0};
  let settings=sanitizeAdminSettings(initial),overlay;
  const document={activeElement:null,body:{append:noOp},createElement:()=>overlay=new Element()};
  class Element {
    constructor(selector='') {
      this.selector=selector;this.id=selector.startsWith('#')?selector.slice(1):'';
      this.checked=false;this.hidden=false;this.isConnected=true;this.children=new Map();this.events=new Map();
      this.classList={toggle:noOp};this.dataset={};this.validity={valid:true};
    }
    querySelector(selector) {
      if(!this.children.has(selector))this.children.set(selector,new Element(selector));
      return this.children.get(selector);
    }
    querySelectorAll(){return [];}
    addEventListener(name,handler){this.events.set(name,handler);}
    removeEventListener(name){this.events.delete(name);}
    setAttribute(){} removeAttribute(){} remove(){} scrollIntoView(){}
    focus(){document.activeElement=this;}
    reportValidity(){return true;}
    async dispatch(name,event){await this.events.get(name)?.(event);}
  }
  const context={document,CHARACTERS:{kai:{name:'KAI'}},getRewardBoard,ADMIN_CHARACTER_FIELDS,ADMIN_BOARD_FIELDS,
    getAdminScope,updateAdminScope,resetAdminScope,sanitizeAdminSettings};
  vm.runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace('export function createAdminPanel','function createAdminPanel'),context);
  const panel=context.createAdminPanel({
    getState:()=>({settings,profile:{character:'kai',rewardBoard:null}}),
    onApply:value=>{calls.applied.push(value);settings=value;},
    onGiveEverything:()=>{calls.give++;},onFullReset:()=>{calls.reset++;},onClose:()=>{calls.closed++;},
  });
  const query=selector=>overlay.querySelector(selector);
  return {panel,calls,query,get settings(){return settings;},
    async check(selector,value){const input=query(selector);input.checked=value;await overlay.dispatch('input',{target:input});},
    async click(name){await overlay.dispatch('click',{target:{closest:()=>({dataset:{adminAction:name}})}});},
    async apply(){await query('form').dispatch('submit',{preventDefault:noOp});},
  };
}

test('slow motion checkbox applies without enabling custom stats and opens with the saved value',async()=>{
  const f=panelFixture();f.panel.open();
  assert.equal(f.query('#admin-slow-motion').checked,false);
  await f.check('#admin-slow-motion',true);
  assert.equal(f.settings.cheats.slowMotion,false,'editing is draft-only');
  await f.apply();
  assert.equal(f.calls.applied.length,1);assert.equal(f.settings.enabled,false);
  assert.equal(f.settings.cheats.slowMotion,true);assert.equal(f.panel.isOpen,false);
  f.panel.open();assert.equal(f.query('#admin-slow-motion').checked,true);
  await f.check('#admin-slow-motion',false);await f.apply();
  assert.equal(f.settings.cheats.slowMotion,false);
});

test('cancel drops a cheat change and restoring rider defaults preserves the cheat draft',async()=>{
  const f=panelFixture();f.panel.open();await f.check('#admin-slow-motion',true);
  await f.click('close');assert.equal(f.calls.applied.length,0);
  f.panel.open();assert.equal(f.query('#admin-slow-motion').checked,false);
  await f.check('#admin-slow-motion',true);await f.click('defaults');
  assert.equal(f.query('#admin-slow-motion').checked,true);
  await f.apply();assert.equal(f.settings.cheats.slowMotion,true);
});

test('Give Me Everything leaves the unsaved cheat intact and does not apply it automatically',async()=>{
  const f=panelFixture();f.panel.open();await f.check('#admin-slow-motion',true);await f.click('give');
  assert.equal(f.calls.give,1);assert.equal(f.calls.applied.length,0);
  assert.equal(f.query('#admin-slow-motion').checked,true);
  assert.equal(f.settings.cheats.slowMotion,false);
  await f.apply();assert.equal(f.settings.cheats.slowMotion,true);
});

test('Full Reset remains an explicit two-step action, while the cheat control explains its separate behavior',async()=>{
  const f=panelFixture({cheats:{slowMotion:true}});f.panel.open();await f.click('reset');
  assert.equal(f.calls.reset,0);assert.equal(f.query('.admin-reset-confirm').hidden,false);
  await f.click('cancel-reset');assert.equal(f.query('.admin-reset-confirm').hidden,true);assert.equal(f.calls.reset,0);
  await f.click('reset');await f.click('confirm-reset');assert.equal(f.calls.reset,1);assert.equal(f.panel.isOpen,false);
  assert.match(source,/id="admin-slow-motion" aria-describedby="admin-slow-motion-description"/);
  assert.match(source,/Use slow motion with any board, even with custom stats switched off/);
  assert.match(source,/6-second charge/);assert.match(source,/\+50% speed for 3 seconds/);assert.match(source,/12 seconds/);
});
