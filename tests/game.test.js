import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame, RUN_SECONDS, COMBO_WINDOW, TRICKS, waveHeight, courseItem } from '../src/game.js';

function advance(g, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 120); i++) g.update(1 / 120, input);
}

test('every trick finishes, rotates the intended body or board and banks after landing', () => {
  assert.equal(Object.keys(TRICKS).length, 8);
  for (const [key, trick] of Object.entries(TRICKS)) {
    const g = new SurfGame(); g.start(); g.x=-9; g.y=waveHeight(-9,0,0); g.charge=1; g.jump();
    assert.equal(g.doTrick(key),true,key);
    advance(g,trick.duration+.08);
    assert.equal(g.trick,null,key);
    assert.equal(g.rotation,trick.spin||0,key);
    assert.equal(g.flipRotation,trick.flip||0,key);
    assert.equal(g.boardRotation,trick.boardSpin||0,key);
    assert.equal(g.bank(),false,key);
    for(let i=0;i<500&&g.airborne;i++)g.update(1/120);
    assert.equal(g.wipeouts,0,key);
    assert.equal(g.bank(),true,key);
    assert.ok(g.score>trick.points,key);
  }
});
test('run clock, pause, resume and restart', () => {
  const g = new SurfGame(); g.start(); advance(g, 10);
  assert.ok(Math.abs(g.time - 110) < .01);
  g.pause(); const distance = g.distance; advance(g, 5);
  assert.equal(g.distance, distance); assert.ok(Math.abs(g.time - 110) < .01);
  g.resume(); advance(g, 1); assert.ok(g.distance > distance);
  g.start(); assert.equal(g.score, 0); assert.equal(g.time, RUN_SECONDS); assert.equal(g.phase, 'running');
});
test('charged lip launches give extra airtime', () => {
  const a = new SurfGame(), b = new SurfGame(); a.start(); b.start();
  b.x = -9; b.y = waveHeight(-9, 0, 0); b.charge = 1;
  a.jump(); b.jump(); assert.ok(b.vy > a.vy + 4);
  advance(a, .9); advance(b, .9); assert.ok(b.y > a.y + 2);
});
test('completed tricks score only after a landing and banking', () => {
  const g = new SurfGame(); g.start(); g.charge = 1; g.jump();
  assert.equal(g.bank(), false); assert.equal(g.doTrick('flip'), true);
  advance(g, .7); assert.equal(g.trick, null); assert.equal(g.multiplier, 2);
  assert.equal(g.score, 0); advance(g, 1.4);
  assert.equal(g.airborne, false); assert.equal(g.wipeouts, 0);
  assert.equal(g.bank(), true); assert.ok(g.score >= 1500); assert.equal(g.landedTricks, 1);
});
test('a trick unfinished on landing loses the active combo', () => {
  const g = new SurfGame(); g.start(); g.jump(); advance(g, .95);
  assert.equal(g.doTrick('flip'), true); advance(g, .55);
  assert.equal(g.wipeouts, 1); assert.equal(g.comboBase, 0); assert.equal(g.score, 0);
});
test('a grounded combo banks automatically; re-launching links it', () => {
  const g = new SurfGame(); g.start(); g.jump(); advance(g, 1.5);
  const base = g.comboBase; assert.ok(base > 0); g.jump(); assert.ok(g.comboBase > base);
  advance(g, 1.5 + COMBO_WINDOW + .2); assert.ok(g.score > base); assert.equal(g.comboBase, 0);
});
test('repeated moves diminish and multiplier caps at eight', () => {
  const g = new SurfGame(); g.start();
  g.addCombo('INDY GRAB', 220, true); const first = g.comboBase;
  g.addCombo('INDY GRAB', 220, true); assert.ok(g.comboBase - first < first);
  for (let i = 0; i < 20; i++) g.addCombo('INDY GRAB', 220, true);
  assert.equal(g.multiplier, 8);
});
test('sun rings are awarded once; reefs can be cleared in the air', () => {
  const g = new SurfGame(); g.start(); const item = courseItem(0);
  g.x = item.x; g.distance = item.distance - 1; advance(g, .1);
  assert.equal(g.gates, 1); assert.equal(g.score, 250);
  g.distance = item.distance - 1; advance(g, .1); assert.equal(g.gates, 1);
  g.x = item.hazardX; g.distance = item.distance + 29; g.y = 8; g.airborne = true; g.vy = 3;
  advance(g, .1); assert.equal(g.wipeouts, 0);
});
test('ground-level reef collision causes a recoverable wipeout', () => {
  const g = new SurfGame(); g.start(); const item = courseItem(0);
  g.x = item.hazardX; g.distance = item.distance + 29; advance(g, .1);
  assert.equal(g.wipeouts, 1); assert.ok(g.bailTime > 0);
  advance(g, 1.5); assert.equal(g.bailTime, 0); assert.equal(g.phase, 'running');
});
test('two-minute session finishes and settles only grounded points', () => {
  const events = []; const g = new SurfGame(e => events.push(e)); g.start();
  advance(g, 119.9); g.addCombo('INDY GRAB', 220, true); advance(g, .2);
  assert.equal(g.phase, 'finished'); assert.equal(g.time, 0); assert.ok(g.score > 0);
  assert.equal(events.filter(e => e.type === 'finish').length, 1);
  const score = g.score; advance(g, 5); assert.equal(g.score, score);
  const a = new SurfGame(); a.start(); advance(a, 119.9); a.jump(); advance(a, .2);
  assert.equal(a.phase, 'finished'); assert.equal(a.comboBase, 0);
});
test('simulation produces equivalent outcomes at 30 and 120 Hz', () => {
  const a = new SurfGame(), b = new SurfGame(); a.start(); b.start();
  for (let i = 0; i < 300; i++) a.update(1 / 30, { pump: true });
  advance(b, 10, { pump: true });
  assert.ok(Math.abs(a.distance - b.distance) < .1);
  assert.ok(Math.abs(a.time - b.time) < .001);
});

test('charged launch gives the Rodeo Air time to finish and score after landing', () => {
  const events = [];
  const g = new SurfGame(event => events.push(event)); g.start();
  assert.equal(g.doTrick('special'), false, 'special requires a launch');
  g.charge = 1;
  assert.equal(g.jump(), true);
  assert.equal(g.doTrick('special'), true);
  advance(g, .9);
  assert.equal(g.trick, null);
  assert.ok(g.comboNames.includes('RODEO AIR'));
  assert.equal(g.airborne, true);
  assert.equal(g.score, 0);
  assert.equal(g.bank(), false);
  advance(g, 1.2);
  assert.equal(g.airborne, false);
  assert.equal(g.wipeouts, 0);
  assert.equal(g.bank(), true);
  assert.equal(g.score, 2840);
  assert.equal(g.landedTricks, 1);
  assert.equal(events.filter(event => event.type === 'trick' && event.name === 'RODEO AIR').length, 1);
});

test('starting a Rodeo Air too close to landing loses the combo and recovers', () => {
  const events = [];
  const g = new SurfGame(event => events.push(event)); g.start(); g.jump();
  advance(g, .9);
  assert.equal(g.doTrick('special'), true);
  advance(g, .6);
  assert.equal(g.wipeouts, 1);
  assert.equal(g.comboBase, 0);
  assert.equal(g.pendingTricks, 0);
  assert.equal(g.score, 0);
  assert.equal(g.landedTricks, 0);
  assert.equal(g.trick, null);
  assert.equal(events.filter(event => event.type === 'trick' && event.name === 'RODEO AIR').length, 0);
  advance(g, 1.4);
  assert.equal(g.bailTime, 0);
  assert.equal(g.phase, 'running');
});
