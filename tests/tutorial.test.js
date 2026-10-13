import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { TUTORIAL_STEPS } from '../src/tutorial-content.js';
import { sanitizeRiderName } from '../src/rider-identity.js';
import { TRICK_KEYS } from '../src/keyboard.js';

const source = readFileSync(new URL('../src/tutorial.js', import.meta.url), 'utf8');
const noOp = () => {};

function tutorialFixture({ name = '', save = noOp, initiallyInert = false } = {}) {
  const calls = { saved: [], closed: 0 }, events = new Map();
  let overlay;
  const document = {
    activeElement: null, body: { append: noOp },
    createElement: () => (overlay = new Element('overlay')),
    getElementById: () => app,
    addEventListener: (type, fn) => events.set(`document:${type}`, fn),
    removeEventListener: type => events.delete(`document:${type}`),
    defaultView: { addEventListener: (type, fn) => events.set(type, fn), removeEventListener: type => events.delete(type) },
  };
  class Element {
    constructor(selector = '') {
      this.selector = selector; this.hidden = false; this.disabled = false; this.value = '';
      this.isConnected = true; this.nodes = new Map(); this.events = new Map(); this.attributes = new Map();
      this.dataset = {}; this.style = {}; this.classList = { toggle: noOp };
      const action = selector.match(/^\[data-tutorial-action="(.*?)"\]$/);
      if (action) this.dataset.tutorialAction = action[1];
    }
    querySelector(selector) {
      if (!this.nodes.has(selector)) this.nodes.set(selector, new Element(selector));
      return this.nodes.get(selector);
    }
    querySelectorAll(selector) {
      if (selector === '[data-tutorial-step]') return chapters;
      const button = action => this.querySelector(`[data-tutorial-action="${action}"]`);
      const buttons = [button('close'), ...chapters, this.querySelector('.tutorial-finish'), button('session'), button('back'), button('skip'), button('next')];
      if (selector === 'button') return buttons;
      if (selector === 'button:not(:disabled),input:not(:disabled)') return [buttons[0], ...chapters, this.querySelector('#tutorial-rider-name'), ...buttons.slice(chapters.length + 1)].filter(element => !element.disabled);
      return [];
    }
    closest(selector) {
      if (selector === '[data-tutorial-step]') return this.dataset.tutorialStep !== undefined ? this : null;
      if (selector === '[data-tutorial-action]') return this.dataset.tutorialAction ? this : null;
      if (selector === '[inert]') return this.attributes.has('inert') ? this : null;
      if (selector === '[hidden]') {
        if (this.hidden) return this;
        if (['#tutorial-rider-name', '.tutorial-finish', '[data-tutorial-action="session"]'].includes(this.selector) && overlay.querySelector('.tutorial-name-form').hidden) return overlay.querySelector('.tutorial-name-form');
      }
      if (selector === 'button') return this.dataset.tutorialStep !== undefined || this.dataset.tutorialAction || this.selector === '.tutorial-finish' ? this : null;
      return null;
    }
    contains(element) { return this === overlay && (element === overlay || element === overlay.querySelector('.tutorial-dialog') || [...this.nodes.values(), ...chapters].includes(element)); }
    addEventListener(type, fn) { this.events.set(type, fn); }
    removeEventListener(type) { this.events.delete(type); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    hasAttribute(key) { return this.attributes.has(key); }
    removeAttribute(key) { this.attributes.delete(key); }
    focus() { document.activeElement = this; }
    remove() { this.isConnected = false; }
    async dispatch(type, event = {}) { return this.events.get(type)?.({ type, preventDefault: noOp, stopPropagation: noOp, ...event }); }
  }
  const chapters = TUTORIAL_STEPS.map((_, i) => { const element = new Element(`chapter:${i}`); element.dataset.tutorialStep = String(i); return element; });
  const app = new Element('app'); if (initiallyInert) app.setAttribute('inert', '');
  const previousFocus = new Element('old-focus'); previousFocus.focus();
  const context = { document, TUTORIAL_STEPS, sanitizeRiderName };
  vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, '').replace('export function createTutorial', 'function createTutorial'), context);
  const tutorial = context.createTutorial({
    getName: () => name,
    onComplete: async (value, options) => { calls.saved.push({ value, ...options }); return save(value, options); },
    onClose: () => calls.closed++,
  });
  const query = selector => overlay.querySelector(selector);
  return { tutorial, query, calls, app, previousFocus, document, events,
    get overlay() { return overlay; },
    async click(action) { return overlay.dispatch('click', { target: query(`[data-tutorial-action="${action}"]`) }); },
    async chapter(index) { return overlay.dispatch('click', { target: chapters[index] }); },
    async input(value) { query('#tutorial-rider-name').value = value; return query('#tutorial-rider-name').dispatch('input'); },
    async submit() { return query('.tutorial-name-form').dispatch('submit'); },
    key(key, rest = {}) {
      const capture = { prevented: 0, stopped: 0 };
      events.get(rest.type || 'keydown')?.({ type: 'keydown', key, target: document.activeElement, preventDefault: () => capture.prevented++, stopImmediatePropagation: () => capture.stopped++, ...rest });
      return capture;
    },
  };
}

test('first visit walks through chapters and naming, trapping the background until completion', async () => {
  const f = tutorialFixture();
  assert.equal(f.tutorial.open(), true); assert.equal(f.tutorial.open(), false);
  assert.equal(f.app.hasAttribute('inert'), true); assert.equal(f.tutorial.isOpen, true);
  assert.equal(f.query('[data-tutorial-action="close"]').hidden, true);
  assert.equal(f.query('[data-tutorial-action="back"]').disabled, true);
  assert.match(f.query('#tutorial-progress').textContent, /^01 \/ 11/);
  await f.click('next'); assert.match(f.query('#tutorial-progress').textContent, /^02 \/ 11/);
  await f.click('back'); assert.match(f.query('#tutorial-progress').textContent, /^01 \/ 11/);
  await f.click('skip'); assert.equal(f.query('.tutorial-name-form').hidden, false);
  assert.equal(f.query('[data-tutorial-action="next"]').hidden, true);
  assert.equal(f.document.activeElement, f.query('#tutorial-rider-name'));
  await f.input('  Reef   Rider  '); await f.submit();
  assert.deepEqual(f.calls.saved, [{ value: 'Reef Rider', persist: true }]);
  assert.equal(f.tutorial.isOpen, false); assert.equal(f.app.hasAttribute('inert'), false);
  assert.equal(f.calls.closed, 1); assert.equal(f.document.activeElement, f.previousFocus);
});

test('empty names stay in the form and Unicode names use a twenty-codepoint limit', async () => {
  const f = tutorialFixture(); f.tutorial.open(); await f.click('skip');
  await f.input('  \n\t '); assert.equal(await f.submit(), false);
  assert.equal(f.calls.saved.length, 0); assert.equal(f.tutorial.isOpen, true);
  assert.equal(f.query('#tutorial-rider-name').hasAttribute('aria-invalid'), true);
  assert.match(f.query('#tutorial-status').textContent, /Enter a rider name/);
  const longName = '🏄'.repeat(21); await f.input(longName);
  assert.equal(f.query('#tutorial-rider-name').value, '🏄'.repeat(20));
  await f.submit(); assert.equal(f.calls.saved[0].value, '🏄'.repeat(20));
  assert.equal(f.tutorial.isOpen, false);
});

test('saved name prepopulates replay and closing a replay never rewrites the save', async () => {
  const f = tutorialFixture({ name: 'PIPER' }); f.tutorial.open({ replay: true });
  assert.equal(f.query('[data-tutorial-action="close"]').hidden, false);
  await f.click('skip'); assert.equal(f.query('#tutorial-rider-name').value, 'PIPER');
  assert.equal(f.query('#tutorial-name-preview').textContent, 'PIPER');
  await f.input('NEW NAME'); await f.click('close');
  assert.equal(f.calls.saved.length, 0); assert.equal(f.tutorial.isOpen, false);
  f.tutorial.open({ replay: true }); await f.click('skip');
  assert.equal(f.query('#tutorial-rider-name').value, 'PIPER');
  f.key('Escape'); assert.equal(f.tutorial.isOpen, false);
});

test('a failed browser save preserves the name and offers an explicit session-only exit', async () => {
  const f = tutorialFixture({ save: (name, { persist }) => { if (persist) throw new Error('Browser storage is unavailable.'); } });
  f.tutorial.open(); await f.click('skip'); await f.input('Jet');
  await f.submit(); assert.equal(f.tutorial.isOpen, true);
  assert.equal(f.query('#tutorial-rider-name').value, 'Jet'); assert.equal(f.calls.closed, 0);
  assert.equal(f.query('[data-tutorial-action="session"]').hidden, false);
  assert.match(f.query('#tutorial-status').textContent, /storage is unavailable/);
  await f.click('session'); assert.equal(f.tutorial.isOpen, false);
  assert.deepEqual(f.calls.saved, [{ value: 'Jet', persist: true }, { value: 'Jet', persist: false }]);
});

test('all tutorial keys stay away from gameplay while text inputs keep native editing', async () => {
  const f = tutorialFixture(); f.tutorial.open();
  const movement = f.key('d'); assert.equal(movement.stopped, 1); assert.equal(movement.prevented, 0);
  const release = f.key('d', { type: 'keyup' }); assert.equal(release.stopped, 1);
  f.key('Escape'); assert.equal(f.tutorial.isOpen, true, 'first visit remains open until naming or completion');
  f.key('ArrowRight'); assert.match(f.query('#tutorial-progress').textContent, /^02 \/ 11/);
  await f.click('skip'); const input = f.query('#tutorial-rider-name'); input.focus();
  assert.equal(f.key('ArrowLeft').prevented, 0); assert.match(f.query('#tutorial-progress').textContent, /^11 \/ 11/);
  assert.equal(f.key('Enter').prevented, 0, 'native Enter submits the name form');
});

test('Tab wraps visible controls and outside focus is returned to the dialog', async () => {
  const f = tutorialFixture(); f.tutorial.open();
  f.document.activeElement = f.query('[data-tutorial-action="next"]');
  const tab = f.key('Tab'); assert.equal(tab.prevented, 1);
  assert.equal(f.document.activeElement.dataset.tutorialStep, '0');
  const backTab = f.key('Tab', { shiftKey: true }); assert.equal(backTab.prevented, 1);
  assert.equal(f.document.activeElement, f.query('[data-tutorial-action="next"]'));
  f.events.get('document:focusin')({ target: f.previousFocus });
  assert.equal(f.document.activeElement, f.query('.tutorial-dialog'));
});

test('existing inert state survives closing; disposal removes listeners and ignores a late save result', async () => {
  let complete;
  const f = tutorialFixture({ initiallyInert: true, save: () => new Promise(resolve => { complete = resolve; }) });
  f.tutorial.open(); await f.click('skip'); await f.input('Pearl');
  const pending = f.submit(); assert.equal(f.overlay.hasAttribute('aria-busy'), true);
  assert.equal(f.tutorial.close(), false, 'do not dismiss in-flight save');
  f.tutorial.dispose(); assert.equal(f.tutorial.isOpen, false); assert.equal(f.app.hasAttribute('inert'), true);
  assert.equal(f.events.size, 0); assert.equal(f.overlay.isConnected, false);
  complete(); await pending; assert.equal(f.calls.closed, 1); assert.equal(f.tutorial.open(), false);
});

test('guide keys cover the actual aerial trick router and all requested modes and selections', () => {
  const tricks = TUTORIAL_STEPS.find(step => step.id === 'tricks').controls.flatMap(control => control.keys);
  for (const code of Object.keys(TRICK_KEYS)) assert.ok(tricks.includes(code.slice(3)), `${code} must appear in the guide`);
  const chapters = new Set(TUTORIAL_STEPS.map(step => step.id));
  for (const id of ['surf', 'survival', 'waterworks', 'rivals', 'time-trials', 'customise', 'name']) assert.ok(chapters.has(id));
  assert.equal(chapters.size, TUTORIAL_STEPS.length);
  const text = JSON.stringify(TUTORIAL_STEPS);
  for (const term of ['Q toggles', 'wardrobe', 'Customise Board', 'Three lives', 'No time limit', 'five rival ladders', 'twelve seconds']) assert.ok(text.includes(term), term);
});
