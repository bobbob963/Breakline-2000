import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame } from '../src/game.js';
import { WaveParkGame, PARK_RAILS, railTopHeight } from '../src/park.js';
import { SurfRaceGame } from '../src/surf-race.js';
import { ParkRaceGame } from '../src/park-race.js';

const modes = [
  ['surf', () => new SurfGame()], ['rush', () => new SurfGame(() => {}, 'rush')],
  ['storm', () => new SurfGame(() => {}, 'storm')], ['park', () => new WaveParkGame()],
  ['surf race', () => new SurfRaceGame()], ['park race', () => new ParkRaceGame()],
];
function advance(game, seconds, input = {}, hz = 120) {
  for (let step = 0; step < Math.round(seconds * hz); step++) game.update(1 / hz, input);
}
function ready(make, reward = 'sky') {
  const game = make(); game.setRewardBoard(reward); game.start();
  if (game.isRace) advance(game, 3);
  return game;
}
const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-8, `${value} ~= ${expected}`);

test('Skybound preserves ordinary rising jumps and begins its automatic glide only on descent in every mode', () => {
  for (const [mode, make] of modes) {
    const sky = ready(make), stock = ready(make, null);
    assert.equal(sky.gliding, false);
    assert.ok(sky.jump()); assert.ok(stock.jump());
    for (let step = 0; step < 12; step++) {
      sky.update(1 / 120); stock.update(1 / 120);
      near(sky.y, stock.y); near(sky.vy, stock.vy);
      assert.equal(sky.gliding, false, `${mode}: wings stay folded on ascent`);
    }
    let gliding = false, landed = false;
    for (let step = 0; step < 600; step++) {
      sky.update(1 / 120);
      if (sky.gliding) {
        gliding = true;
        assert.ok(sky.vy < 0 && sky.vy >= -3.6, `${mode}: always descends at bounded speed`);
      }
      if (!sky.airborne) { landed = true; break; }
    }
    assert.ok(gliding, `${mode}: actual jump opens wings`);
    assert.ok(landed, `${mode}: glide still reaches a normal landing`);
    assert.equal(sky.gliding, false); assert.equal(sky.wipeouts, 0);
  }
});

test('Skybound descends more gently without hovering and the extra jump closes then reopens its wings', () => {
  for (const [mode, make] of modes) {
    const sky = ready(make), stock = ready(make, null);
    for (const game of [sky, stock]) {
      assert.ok(game.jump());
      // This fixture represents a high lip launch, not the new low hop that
      // follows the water surface to clear driftwood.
      Object.assign(game, { y: 35, vy: -1, airtime: .5, airLaunchSource:'lip',flatHopActive:false });
    }
    advance(sky, .5); advance(stock, .5);
    assert.ok(sky.y < 35 && sky.y > stock.y, `${mode}: falls slower than the standard board`);
    assert.equal(sky.gliding, true); assert.equal(stock.gliding, false);
    assert.ok(sky.jump(), `${mode}: retained extra jump works during glide`);
    assert.equal(sky.gliding, false); assert.ok(sky.vy > 0);
    assert.equal(sky.jump(), false, 'one extra jump only');
    advance(sky, 1);
    assert.equal(sky.gliding, true, `${mode}: wings reopen after the second apex`);
  }
});

test('descending glide and its terminal speed agree at 30, 60, 120 and 144 Hz', () => {
  const results = [];
  for (const hz of [30, 60, 120, 144]) {
    const game = ready(() => new SurfGame());
    Object.assign(game, { airborne: true, airtime: .5, y: 40, vy: -1 });
    advance(game, 2, {}, hz);
    assert.equal(game.gliding, true); near(game.vy, -3.6);
    results.push(game.y);
  }
  for (const result of results.slice(1)) near(result, results[0]);
});

test('glide retracts immediately on grounding, wipeout, finish, reset, or equipment change and freezes when paused', () => {
  const game = ready(() => new SurfGame());
  const descend = () => Object.assign(game, { airborne: true, airtime: .5, y: 20, vy: -1 });
  descend(); assert.equal(game.gliding, true);
  game.pause(); const height = game.y; advance(game, .5);
  assert.equal(game.y, height); assert.equal(game.gliding, true);
  game.resume(); game.setRewardBoard('guitar'); assert.equal(game.gliding, false);
  game.setRewardBoard('sky'); assert.equal(game.gliding, true);
  game.airborne = false; assert.equal(game.gliding, false);
  descend(); game.bail(); assert.equal(game.gliding, false);
  game.start(); assert.equal(game.gliding, false);
  descend(); game.finish('SESSION COMPLETE'); assert.equal(game.gliding, false);
  game.start(); assert.equal(game.gliding, false);
});

test('Skybound descent still catches a Waterworks rail and retracts wings on contact', () => {
  const game = ready(() => new WaveParkGame());
  const rail = PARK_RAILS.find(value => value.id === 'left-rail');
  assert.ok(rail);
  Object.assign(game, { x: rail.x, z: rail.z + 2, y: railTopHeight(rail, 0) + .8,
    vx: 0, vz: -10, heading: 0, speed: 10, airborne: true, airtime: .5, vy: -1 });
  assert.equal(game.gliding, true);
  for (let step = 0; step < 120 && !game.grinding; step++) game.update(1 / 120, { grind: true });
  assert.ok(game.grinding, 'the existing solid rail catch remains active');
  assert.equal(game.gliding, false); assert.equal(game.airborne, false);
});
