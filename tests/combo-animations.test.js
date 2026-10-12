import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBO_ANIMATIONS, findComboAnimation } from '../src/combo-animations.js';
import { SurfGame, TRICKS, COMBO_WINDOW, waveHeight, waveCrest } from '../src/game.js';
import { WaveParkGame } from '../src/park.js';

const modes = ['surf', 'rush', 'storm', 'park'];
const dt = 1 / 120;
function make(mode, events = []) {
  const game = mode === 'park' ? new WaveParkGame(event => events.push(event)) : new SurfGame(event => events.push(event), mode);
  game.start(); return game;
}
function launch(game) {
  if (game.mode === 'surf') {
    game.x = waveCrest(-game.distance, game.elapsed);
    game.y = waveHeight(game.x, -game.distance, game.elapsed);
  }
  game.charge = 1;
  assert.equal(game.jump(), true, 'the next launch must be legal');
  if (game.mode === 'surf') assert.notEqual(game.airLaunchSource, 'flat');
}
function completeInFlight(game) {
  for (let i = 0; i < 240 && game.trick; i++) game.update(dt, { brake: true });
  assert.equal(game.trick, null); assert.equal(game.wipeouts, 0);
}
function land(game) {
  for (let i = 0; i < 600 && game.airborne; i++) game.update(dt, { brake: true });
  assert.equal(game.airborne, false); assert.equal(game.wipeouts, 0);
}
function recover(game) {
  for (let i = 0; i < 600 && !game.popReady; i++) game.update(dt);
  assert.equal(game.popReady, true);
}
function completeWithoutTravel(game, type) {
  assert.equal(game.doTrick(type), true);
  game.updateAirTrick(TRICKS[type].duration);
  assert.equal(game.trick, null);
}

test('the catalog names exactly five ordered aerial pairs without changing trick definitions', () => {
  assert.deepEqual(COMBO_ANIMATIONS.map(item => [item.id, ...item.sequence]), [
    ['crosswind', 'spin', 'grab'], ['flipcatch', 'flip', 'grab'],
    ['decksweep', 'shuvit', 'method'], ['coil360', 'grab', 'spin360'],
    ['crosscut', 'spin', 'tweak'],
  ]);
  for (const item of COMBO_ANIMATIONS) {
    assert.equal(item.keys.length, 2); assert.ok(item.name && item.description);
    assert.equal(findComboAnimation(...item.sequence), item);
    assert.equal(Object.hasOwn(item, 'points'), false);
    assert.equal(Object.hasOwn(item, 'duration'), false);
  }
  assert.equal(findComboAnimation(null, 'grab'), null);
  assert.equal(findComboAnimation('180 SPIN', 'INDY GRAB'), null);
  assert.equal(findComboAnimation('grab', 'spin'), null);
  assert.deepEqual(findComboAnimation('spin', 'tweak').keys, ['J', 'B']);
  assert.equal(findComboAnimation('tweak', 'spin'), null);
  assert.equal(findComboAnimation('__proto__', 'grab'), null);
});

test('J then B requires a completed unbanked spin and does not tag an ordinary tweak', () => {
  for (const mode of modes) {
    const game = make(mode); launch(game);
    assert.equal(game.doTrick('spin'), true);
    game.updateAirTrick(TRICKS.spin.duration * .5);
    assert.equal(game.doTrick('tweak'), false);
    assert.equal(game.lastCompletedTrickType, null);
    game.updateAirTrick(TRICKS.spin.duration);
    assert.equal(game.doTrick('tweak'), true);
    assert.equal(game.trick.comboAnimation, 'crosscut');
    completeWithoutTravelAfterActive(game); land(game);
    assert.equal(game.bank(), true); recover(game); launch(game);
    assert.equal(game.doTrick('tweak'), true);
    assert.equal(game.trick.comboAnimation, undefined, 'a banked spin cannot seed the next line');
  }
});

test('all four modes trigger every animation through actual airborne completion and bank only base points', () => {
  for (const mode of modes) for (const variation of COMBO_ANIMATIONS) {
    const events = [], game = make(mode, events), [first, second] = variation.sequence;
    launch(game); assert.equal(game.doTrick(first), true);
    assert.equal(game.trick.comboAnimation, undefined);
    completeInFlight(game); assert.equal(game.lastCompletedTrickType, first);
    assert.equal(game.doTrick(second), true, `${mode}/${variation.id}`);
    assert.equal(game.trick.comboAnimation, variation.id);
    assert.equal(game.trick.comboAnimationName, variation.name);
    for (const [key, value] of Object.entries(TRICKS[second])) assert.equal(game.trick[key], value, `${mode}/${key}`);
    assert.deepEqual(events.filter(event => event.type === 'trickStart').at(-1), {
      type:'trickStart', trick:second, comboAnimation:variation.id, comboAnimationName:variation.name,
    });
    completeInFlight(game); land(game);
    assert.deepEqual(game.comboNames, [TRICKS[first].name, TRICKS[second].name, 'CLEAN LANDING']);
    assert.equal(game.comboBase, TRICKS[first].points + TRICKS[second].points + 120);
    assert.equal(game.multiplier, 3); assert.equal(game.pendingTricks, 2); assert.equal(game.score, 0);
    assert.deepEqual(events.filter(event => event.type === 'trick').map(event => event.name), [TRICKS[first].name, TRICKS[second].name], 'SPECIAL receives exactly the two ordinary completion events');
    assert.equal(game.bank(), true);
    assert.equal(game.score, (TRICKS[first].points + TRICKS[second].points + 120) * 3);
    assert.equal(game.lastCompletedTrickType, null);
  }
});

test('unfinished, rejected and display-only tricks cannot seed a combo animation', () => {
  for (const mode of modes) {
    const events = [], game = make(mode, events);
    assert.equal(game.doTrick('spin'), false); assert.equal(game.lastCompletedTrickType, null);
    launch(game); assert.equal(game.doTrick('spin'), true);
    game.updateAirTrick(TRICKS.spin.duration * .4);
    assert.equal(game.doTrick('grab'), false); assert.equal(game.lastCompletedTrickType, null);
    assert.equal(events.some(event => event.comboAnimation), false);
    game.bail('UNFINISHED TEST'); assert.equal(game.lastCompletedTrickType, null);
    game.start(); launch(game);
    game.addCombo('180 SPIN', 300, true);
    assert.equal(game.doTrick('grab'), true); assert.equal(game.trick.comboAnimation, undefined);
    completeWithoutTravelAfterActive(game);
    game.clearCombo(); completeWithoutTravel(game, 'spin');
    assert.equal(game.doTrick('__proto__'), false);
    assert.equal(game.doTrick('not-a-trick'), false);
    assert.equal(game.lastCompletedTrickType, 'spin', 'rejected input is not a completed trick');
    assert.equal(game.doTrick('grab'), true); assert.equal(game.trick.comboAnimation, 'crosswind');
  }
});
function completeWithoutTravelAfterActive(game) { game.updateAirTrick(game.trick.duration); }

test('only the immediately preceding completed aerial trick determines the variation', () => {
  for (const mode of modes) {
    const game = make(mode); launch(game);
    completeWithoutTravel(game, 'spin'); completeWithoutTravel(game, 'heelflip');
    assert.equal(game.doTrick('grab'), true); assert.equal(game.trick.comboAnimation, undefined);
    completeWithoutTravelAfterActive(game);
    assert.equal(game.doTrick('spin360'), true); assert.equal(game.trick.comboAnimation, 'coil360');
  }
});

test('a landed but unbanked sequence carries across a legal recovered launch in every mode', () => {
  for (const mode of modes) {
    const game = make(mode); launch(game); assert.equal(game.doTrick('flip'), true);
    completeInFlight(game); land(game); const base = game.comboBase;
    recover(game); assert.equal(game.comboBase, base); assert.equal(game.lastCompletedTrickType, 'flip');
    launch(game); assert.equal(game.doTrick('grab'), true);
    assert.equal(game.trick.comboAnimation, 'flipcatch'); assert.equal(game.comboBase, base);
  }
});

test('clear, bank, automatic banking, wipeout, restart and finish discard remembered sequences', () => {
  for (const mode of modes) for (const action of ['clear', 'bank', 'auto', 'bail', 'restart', 'finish', 'timer']) {
    const game = make(mode); launch(game); completeWithoutTravel(game, 'spin');
    if (action === 'clear') game.clearCombo();
    if (action === 'bank') { land(game); assert.equal(game.bank(), true); }
    if (action === 'auto') { land(game); for (let i = 0; i < Math.ceil((COMBO_WINDOW + .1) / dt); i++) game.update(dt, { brake:true }); }
    if (action === 'bail') game.bail();
    if (action === 'restart') game.start();
    if (action === 'finish') game.finish('TEST FINISH');
    if (action === 'timer') {
      if (mode === 'storm') game.finish('TEST ENDLESS FINISH');
      else { game.elapsed = 120 - dt / 2; game.time = dt / 2; game.update(dt); assert.equal(game.phase, 'finished'); }
    }
    assert.equal(game.lastCompletedTrickType, null, `${mode}/${action}`);
    if (game.phase === 'finished') assert.equal(game.doTrick('grab'), false);
    // A fresh run cannot inherit a remembered first trick or score label.
    game.start(); launch(game); assert.equal(game.doTrick('grab'), true);
    assert.equal(game.trick.comboAnimation, undefined, `${mode}/${action}`);
  }
});

test('finish clears remembered state even when no points remain to bank', () => {
  for (const mode of modes) {
    const game = make(mode); game.lastCompletedTrickType = 'spin';
    assert.equal(game.comboBase, 0); game.finish('EMPTY LINE');
    assert.equal(game.lastCompletedTrickType, null); assert.equal(game.phase, 'finished');
  }
});

test('variants preserve repetition penalties, duration, multiplier and ordinary scoring events', () => {
  for (const mode of modes) {
    const events = [], game = make(mode, events); launch(game);
    let expected = 0;
    for (let repeat = 0; repeat < 3; repeat++) for (const type of ['spin', 'grab']) {
      assert.equal(game.doTrick(type), true);
      assert.equal(game.trick.duration, TRICKS[type].duration);
      assert.equal(game.trick.name, TRICKS[type].name);
      assert.equal(game.trick.comboAnimation, type === 'grab' ? 'crosswind' : undefined);
      game.updateAirTrick(TRICKS[type].duration - .001);
      assert.ok(game.trick, 'the variant cannot finish before the base duration');
      game.updateAirTrick(.002);
      expected += Math.round(TRICKS[type].points * (1 - repeat * .2));
      assert.equal(game.comboBase, expected);
    }
    assert.equal(game.multiplier, 7); assert.equal(game.pendingTricks, 6);
    assert.equal(events.filter(event => event.type === 'trick').length, 6);
    assert.equal(events.filter(event => event.type === 'trickStart' && event.comboAnimation).length, 3);
    assert.deepEqual(game.repetitions, { '180 SPIN':3, 'INDY GRAB':3 });
  }
});

test('a legitimately grace-completed first move counts, while a badly unfinished one does not', () => {
  for (const mode of modes) for (const nearComplete of [false, true]) {
    const game = make(mode); launch(game); assert.equal(game.doTrick('spin'), true);
    game.trick.age = TRICKS.spin.duration - (nearComplete ? .04 : .2);
    game.airborne = false;
    const result = game.resolveLandingTrick();
    assert.equal(result.landed, nearComplete);
    assert.equal(game.lastCompletedTrickType, nearComplete ? 'spin' : null);
    if (nearComplete) { recover(game); launch(game); assert.equal(game.doTrick('grab'), true); assert.equal(game.trick.comboAnimation, 'crosswind'); }
  }
});
