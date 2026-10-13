import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createLoadingScreen, paintLoadingStage } from '../src/loading-screen.js';
import { createKeydownHandler } from '../src/keyboard.js';

function fakeDocument() {
  const elements = new Map(), events = [];
  function element(id) {
    if (!elements.has(id)) {
      const attributes = new Map(), classes = new Set();
      elements.set(id, {
        style: {}, textContent: '', hidden: false, focused: false,
        setAttribute(name, value) { attributes.set(name, String(value)); },
        removeAttribute(name) { attributes.delete(name); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        hasAttribute(name) { return attributes.has(name); },
        classList: {
          add(name) { classes.add(name); },
          remove(name) { classes.delete(name); },
          contains(name) { return classes.has(name); },
        },
        focus() { this.focused = true; },
      });
    }
    return elements.get(id);
  }
  const doc = { getElementById: element, dispatchEvent(event) { events.push(event.type); return true; } };
  element('app').setAttribute('inert', '');
  element('app').setAttribute('aria-busy', 'true');
  element('loading-retry').hidden = true;
  return { doc, element, events };
}

function assertLocked(element) {
  assert.equal(element('app').hasAttribute('inert'), true);
  assert.equal(element('app').getAttribute('aria-busy'), 'true');
  assert.equal(element('loading').hidden, false);
}

test('startup stage updates remain accessible while the application stays locked', () => {
  const { doc, element } = fakeDocument();
  const loading = createLoadingScreen(doc);
  loading.set(40, 'BUILDING YOUR SESSION', 'Preparing the coast.');
  assertLocked(element);
  assert.equal(element('loading-fill').style.width, '40%');
  assert.equal(element('loading-bar').getAttribute('aria-valuenow'), '40');
  assert.equal(element('loading-bar').getAttribute('aria-valuetext'), 'BUILDING YOUR SESSION');
  assert.equal(element('loading-status').textContent, 'BUILDING YOUR SESSION');
});

test('a completed first frame unlocks the application and hides the overlay', async () => {
  const { doc, element, events } = fakeDocument();
  const pending = createLoadingScreen(doc).finish();
  assertLocked(element);
  assert.equal(await pending, true);
  assert.equal(element('app').hasAttribute('inert'), false);
  assert.equal(element('app').getAttribute('aria-busy'), 'false');
  assert.equal(element('loading').hidden, true);
  assert.equal(element('loading-percent').textContent, '100%');
  assert.deepEqual(events, ['breakline-ready']);
});

test('failed startup keeps the app locked and exposes a focused retry action', async () => {
  const { doc, element } = fakeDocument();
  const loading = createLoadingScreen(doc);
  loading.fail();
  loading.set(92, 'WARMING UP', 'Should not replace the failure.');
  assert.equal(await loading.finish(), false);
  assertLocked(element);
  assert.equal(element('loading-percent').textContent, 'STOPPED');
  assert.equal(element('loading-retry').hidden, false);
  assert.equal(element('loading-retry').focused, true);
});

test('a failure during ready hold prevents unlocking the app', async () => {
  const { doc, element } = fakeDocument();
  const loading = createLoadingScreen(doc);
  const pending = loading.finish();
  loading.fail();
  assert.equal(await pending, false);
  assertLocked(element);
});

test('a failure during the fade restores the locked error screen', async () => {
  const { doc, element, events } = fakeDocument();
  const loading = createLoadingScreen(doc);
  const pending = loading.finish();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(element('loading').classList.contains('is-leaving'), true);
  assert.equal(element('app').hasAttribute('inert'), true, 'controls stay locked throughout the fade');
  loading.fail();
  assert.equal(await pending, false);
  assertLocked(element);
  assert.equal(element('loading').classList.contains('is-leaving'), false);
  assert.equal(element('loading-percent').textContent, 'STOPPED');
  assert.deepEqual(events, [], 'failed startup does not announce readiness');
});

test('an early module error recorded by the inline fallback prevents readiness', async () => {
  const { doc, element, events } = fakeDocument();
  const loading = createLoadingScreen(doc);
  const pending = loading.finish();
  element('loading').classList.add('has-error');
  assert.equal(await pending, false);
  assertLocked(element);
  assert.deepEqual(events, []);
});

test('paint scheduling finishes even when a background tab suspends animation frames', async () => {
  const previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  try {
    await paintLoadingStage();
  } finally {
    if (previous === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previous;
  }
});

test('production global input callbacks ignore keys before game construction', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('keydownHandler=createKeydownHandler(');
  const end = source.indexOf("$('start').addEventListener", start);
  assert.ok(start >= 0 && end > start, 'the production input registration block exists');
  const callbacks = new Map();
  const register = (name, callback) => callbacks.set(name, callback);
  const bootAction = () => { throw new Error('boot input reached an application action'); };
  const context = {
    window: { addEventListener: register },
    document: { addEventListener: register, hidden: true },
    createKeydownHandler,
    keydownHandler:null,wasted:{active:false},adminPanel:{isOpen:false},adminHomeScreen:()=>false,openAdmin:bootAction,
    bootReady: false, game: undefined, workshopMode: null, modalMode: null, input: {}, clearInput() {},
    toggleSound:bootAction,closeWorkshop:bootAction,cycleCharacter:bootAction,closeModal:bootAction,
    startRun:bootAction,restartRun:bootAction,pause:bootAction,tryTrick:bootAction,toast:bootAction,
  };
  vm.runInNewContext(source.slice(start, end), context);
  for (const code of ['Enter', 'Space', 'KeyP', 'Escape', 'KeyR', 'KeyM', 'KeyC', 'KeyA', 'ShiftLeft', 'KeyJ', 'KeyB']) {
    const event = { code, preventDefault() { throw new Error('boot input reached game handling'); } };
    assert.doesNotThrow(() => callbacks.get('keydown')(event), code);
    assert.doesNotThrow(() => callbacks.get('keyup')(event), code);
  }
  assert.doesNotThrow(() => callbacks.get('blur')());
  assert.doesNotThrow(() => callbacks.get('visibilitychange')());
  assert.doesNotThrow(() => callbacks.get('pointerdown')({ target: undefined }));
});
