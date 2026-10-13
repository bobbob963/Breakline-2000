import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_KEYBINDS, rebindKey } from '../src/key-bindings.js';
import { remapControlText, remapControlsElement, remapKeyLabel } from '../src/control-labels.js';

function custom(){
  let bindings={...DEFAULT_KEYBINDS};
  for(const [action,code] of [['left','KeyT'],['right','KeyY'],['jump','KeyZ'],['grind','KeyG'],['special','Digit1'],['spin','Digit2'],['grab','Digit3'],['tweak','Digit4'],['bank','Digit5'],['cutback','Digit6'],['timePower','Digit7']])bindings=rebindKey(bindings,action,code);
  return bindings;
}

test('control badges display remapped single keys and chords without cascading swaps',()=>{
  const bindings=custom();
  assert.equal(remapKeyLabel('SHIFT + A/D',bindings),'G + T/Y');
  assert.equal(remapKeyLabel('J → B',bindings),'2 → 4');
  assert.equal(remapKeyLabel('I',bindings),'1');assert.equal(remapKeyLabel('ENTER',bindings),'5');
  assert.equal(remapKeyLabel('ESC'),'ESC');
  const swapped=rebindKey(DEFAULT_KEYBINDS,'jump','KeyJ');
  assert.equal(remapKeyLabel('SPACE + J',swapped),'J + SPACE');
});

test('instruction remapping covers tutorial, powers and race HUD while protecting ordinary prose and fixed menu shortcuts',()=>{
  const bindings=custom();
  assert.equal(remapControlText('A different sky. Enter a rider name. Press ENTER TO RIDE. Rotate with X / C.',bindings),'A different sky. Enter a rider name. Press ENTER TO RIDE. Rotate with X / C.');
  assert.equal(remapControlText('Hold Space, release, press J. Follow J with L. Try J, then B.',bindings),'Hold Z, release, press 2. Follow 2 with 3. Try 2, then 4.');
  assert.equal(remapControlText('Use I in the air. Enter banks a landed combo. DEADTIME uses Q. C also works.',bindings),'Use 1 in the air. 5 banks a landed combo. DEADTIME uses 7. 6 also works.');
  assert.equal(remapControlText('Q TO SLOW TIME · HOLD SPACE · RELEASE · J · LAND',bindings),'7 TO SLOW TIME · HOLD Z · RELEASE · 2 · LAND');
  assert.equal(remapControlText('Tap Q for slow motion; double-tap Q for 2× fast-forward.',bindings),'Tap 7 for slow motion; double-tap 7 for 2× fast-forward.');
  assert.equal(remapControlText('Q TO SLOW · DOUBLE-TAP Q TO FAST-FORWARD · 6.0s',bindings),'7 TO SLOW · DOUBLE-TAP 7 TO FAST-FORWARD · 6.0s');
  assert.equal(remapControlText('100% READY · I',bindings),'100% READY · 1');
  assert.equal(remapControlText('NEXT: L / B · COMBO MOVES',bindings),'NEXT: 3 / 4 · COMBO MOVES');
  assert.equal(remapControlText('SPACE TO LINK · ENTER TO BANK',bindings),'Z TO LINK · 5 TO BANK');
  assert.equal(remapControlText('SHIFT + A / D · CUTBACK',bindings),'G + T / Y · CUTBACK');
  assert.equal(remapControlText('A low hop. Use a board. I like the coast.',bindings),'A low hop. Use a board. I like the coast.');
});

test('reassigned arrow aliases no longer claim to perform their old movement action',()=>{
  let bindings=rebindKey(DEFAULT_KEYBINDS,'grab','ArrowLeft');
  bindings=rebindKey(bindings,'flip','ArrowUp');
  assert.equal(remapKeyLabel('←',bindings),'A');assert.equal(remapKeyLabel('↑',bindings),'W');
  assert.equal(remapControlText('Left and right arrows work too. The up arrow also pumps.',bindings),'The right arrow also turns right. Use your chosen pump key.');
  bindings=rebindKey(bindings,'method','ArrowRight');
  assert.equal(remapControlText('Left and right arrows work too.',bindings),'Use your chosen turning keys.');
  assert.equal(remapKeyLabel('J → B',bindings),'J → B','combo sequence arrow is punctuation, not a turn alias');
});

test('existing help elements update repeatedly from their authored controls and accept fresh dynamic text',()=>{
  const badge={nodeType:1,tagName:'KBD',textContent:'SPACE',childNodes:[]};
  const prose={nodeType:3,nodeValue:'Hold Space, then press J.'};
  const input={nodeType:1,tagName:'INPUT',childNodes:[{nodeType:3,nodeValue:'Space'}]};
  const root={nodeType:1,tagName:'DIV',childNodes:[badge,prose,input]};
  remapControlsElement(root,custom());assert.equal(badge.textContent,'Z');assert.equal(prose.nodeValue,'Hold Z, then press 2.');
  remapControlsElement(root,custom());assert.equal(badge.textContent,'Z');assert.equal(prose.nodeValue,'Hold Z, then press 2.');
  remapControlsElement(root,DEFAULT_KEYBINDS);assert.equal(badge.textContent,'SPACE');assert.equal(prose.nodeValue,'Hold Space, then press J.');
  prose.nodeValue='Q TO SLOW TIME';remapControlsElement(root,custom());assert.equal(prose.nodeValue,'7 TO SLOW TIME');
  assert.equal(input.childNodes[0].nodeValue,'Space');
});
