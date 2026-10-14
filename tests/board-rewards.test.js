import test from 'node:test';
import assert from 'node:assert/strict';
import { REWARD_BOARDS, REWARD_BOARD_ORDER, ALL_REWARD_BOARD_ORDER, TRIAL_REWARD_BOARD_ORDER, getRewardBoard, rewardBoardUnlocked } from '../src/board-rewards.js';
import { SurfGame, TRICKS } from '../src/game.js';
import { WaveParkGame, PARK_PIPES, parkPointBlocked } from '../src/park.js';
import { SurfRaceGame } from '../src/surf-race.js';
import { ParkRaceGame } from '../src/park-race.js';

const factories = [
  ['surf', events => new SurfGame(e => events.push(e))],
  ['rush', events => new SurfGame(e => events.push(e), 'rush')],
  ['storm', events => new SurfGame(e => events.push(e), 'storm')],
  ['park', events => new WaveParkGame(e => events.push(e))],
  ['surf race', events => new SurfRaceGame(e => events.push(e))],
  ['park race', events => new ParkRaceGame(e => events.push(e))],
];
function advance(game, seconds, input = {}, hz = 120) {
  for (let i = 0; i < Math.round(seconds * hz); i++) game.update(1 / hz, input);
}
function until(game, condition, input = {}, seconds = 5, hz = 120) {
  for (let i = 0; i < seconds * hz && !condition(); i++) game.update(1 / hz, input);
  assert.ok(condition(), 'condition reached through ordinary simulation');
}
function fixture(make, reward = null) {
  const events = [], game = make(events);
  game.setRewardBoard(reward); game.start();
  if (game.isRace) advance(game, 3);
  return { game, events };
}
function trickLaunch(game) {
  if (game.mode === 'surf' && !game.isRace) {
    assert.ok(game.doCutback(1)); until(game, () => !game.cutbackActive);
  }
  advance(game, .35, { jump: true }); assert.ok(game.jump());
}
function finishSpin(game) {
  assert.ok(game.doTrick('spin')); until(game, () => !game.trick);
  assert.equal(game.wipeouts, 0);
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} equals ${expected}`);

test('five ladder prizes unlock permanently in order and reject invalid IDs or progress', () => {
  assert.deepEqual(REWARD_BOARD_ORDER, ['guitar', 'lightning', 'vortex', 'solar', 'sky']);
  for (let completed = 0; completed <= 5; completed++) {
    REWARD_BOARD_ORDER.forEach((id, index) => {
      assert.equal(rewardBoardUnlocked(id, { completedLadders: completed }), index < completed);
      assert.equal(getRewardBoard(id), REWARD_BOARDS[id]);
      assert.ok(REWARD_BOARDS[id].description.length > 40);
    });
  }
  for (const id of ['unknown', '__proto__', 'constructor', null, {}]) {
    assert.equal(getRewardBoard(id), null); assert.equal(rewardBoardUnlocked(id, { completedLadders: 5 }), false);
  }
  for (const completedLadders of [-1, 6, Infinity, NaN, '5', 2.5, undefined]) {
    assert.equal(rewardBoardUnlocked('guitar', { completedLadders }), false);
  }
});

test('Afterburner is an additional trial prize with a permanent third-clear unlock, not a sixth ladder', () => {
  assert.deepEqual(TRIAL_REWARD_BOARD_ORDER, ['afterburner']);
  assert.deepEqual(ALL_REWARD_BOARD_ORDER, [...REWARD_BOARD_ORDER, 'afterburner', 'deadtime', 'sludge']);
  assert.deepEqual(Object.keys(REWARD_BOARDS), ALL_REWARD_BOARD_ORDER);
  const reward = getRewardBoard('afterburner');
  assert.equal(reward.name, 'AFTERBURNER'); assert.equal(reward.trialClears, 3);
  assert.equal(reward.baseSpeedMultiplier, 1.25); assert.equal(reward.boostPowerMultiplier, 1.5);
  assert.equal(reward.boostDurationMultiplier, 1, 'the requested bonus affects power, not duration');
  for (let ladders = 0; ladders <= 5; ladders++) for (let trials = 0; trials <= 12; trials++) {
    assert.equal(rewardBoardUnlocked('afterburner', { completedLadders: ladders }, { completedTrials: trials }), ladders === 5 && trials >= 3);
  }
  for (const invalid of [-1, 2, 13, Infinity, NaN, '3', 3.5, undefined, null]) {
    assert.equal(rewardBoardUnlocked('afterburner', { completedLadders: 5 }, { completedTrials: invalid }), false);
  }
  for (const invalid of [-1, 4, 6, Infinity, NaN, '5', 5.5, undefined, null]) {
    assert.equal(rewardBoardUnlocked('afterburner', { completedLadders: invalid }, { completedTrials: 3 }), false);
  }
  assert.equal(rewardBoardUnlocked('afterburner', { completedLadders: 5 }), false);
  assert.equal(rewardBoardUnlocked('afterburner', null, { completedTrials: 3 }), false);
  assert.equal(rewardBoardUnlocked('afterburner', { completedLadders: 5 }, null), false);
});

test('stock boards retain normal physics and equipment survives resets without leaking to opponents', () => {
  for (const [name, make] of factories) {
    const { game } = fixture(make);
    assert.equal(game.rewardBoardDefinition, null, name);
    assert.equal(game.popRecoveryDuration, game.isRace ? 1 : 1.4);
    assert.equal(game.forwardSpeedBonus, 0);
    assert.ok(game.jump()); advance(game, .15);
    assert.equal(game.airJumpReady, false); assert.equal(game.jump(), false);
    game.setRewardBoard('guitar'); game.start();
    assert.equal(game.rewardBoard, 'guitar');
    assert.equal(game.airJumpsUsed, 0); assert.equal(game.score, 0);
    if (game.opponent) assert.equal(game.opponent.rewardBoardDefinition, null);
    assert.equal(game.setRewardBoard('invalid'), null);
  }
});

test('Amplifier increases completed trick points only and still needs a clean landing and bank', () => {
  for (const [name, make] of factories) {
    const { game, events } = fixture(make, 'guitar');
    trickLaunch(game); finishSpin(game);
    assert.equal(game.score, 0, name);
    assert.equal(game.comboBase, Math.round(TRICKS.spin.points * 1.25));
    assert.equal(game.bank(), false);
    until(game, () => !game.airborne);
    assert.equal(game.wipeouts, 0);
    assert.equal(game.comboBase, 375 + 120, 'clean landing gets no multiplier');
    assert.ok(game.bank()); assert.equal(game.score, (375 + 120) * 2);
    const completed = events.find(event => event.type === 'trick' && !event.opponent);
    assert.equal(completed.rewardBoard, 'guitar'); assert.equal(completed.vfx, 'notes');
    game.addCombo('GATE-LIKE BONUS', 250); assert.equal(game.comboBase, 250);
    game.addCombo('180 SPIN', 300, true); game.addCombo('180 SPIN', 300, true);
    assert.equal(game.comboBase, 250 + 375 + 300, 'repeat penalty applies before the point buff');
    game.bail(); assert.equal(game.comboBase, 0); assert.equal(game.score, 990);
  }
});

test('Live Wire and Undertow modify actual landed race rewards, never empty pops or the opponent', () => {
  for (const [, make] of factories.filter(([name]) => name.includes('race'))) {
    for (const id of ['lightning', 'vortex']) {
      const { game, events } = fixture(make, id);
      trickLaunch(game); finishSpin(game);
      assert.equal(game.boostSpeed, 0); until(game, () => !game.airborne);
      assert.equal(game.wipeouts, 0);
      close(game.boostSpeed, id === 'lightning' ? 7.5 : 6);
      close(game.boostDuration, id === 'vortex' ? 2.7 : 2);
      assert.equal(game.opponent.rewardBoardDefinition, null);
      assert.equal(events.filter(event => event.type === 'raceBoost' && !event.opponent).length, 1);
      game.pause(); const remaining = game.boostTime; advance(game, 1); assert.equal(game.boostTime, remaining);
      game.resume(); game.bail(); assert.equal(game.boostTime, 0);
      game.start(); advance(game, 3); assert.ok(game.jump()); until(game, () => !game.airborne);
      assert.equal(game.boostSpeed, 0, 'empty pop gets no reward');
    }
  }
});

test('Solar Flare shortens grounded pop recovery by 25 percent in every mode, without paying it off in air', () => {
  for (const [name, make] of factories) {
    const { game } = fixture(make, 'solar'), duration = game.isRace ? .75 : 1.05;
    close(game.popRecoveryDuration, duration); assert.ok(game.jump(), name);
    until(game, () => !game.airborne); close(game.popCooldown, duration);
    advance(game, duration - .1, { brake: true }); assert.equal(game.popReady, false);
    advance(game, .12, { brake: true }); assert.equal(game.popReady, true);
    assert.ok(game.jump()); assert.equal(game.rewardBoard, 'solar');
  }
});

test('Skybound permits one real second jump in every mode, preserving the current combo and rewarding one landing', () => {
  for (const [name, make] of factories) {
    const { game, events } = fixture(make, 'sky');
    assert.ok(game.jump()); assert.equal(game.jump(), false, 'immediate repeated release cannot jump twice');
    advance(game, .15); assert.equal(game.airJumpReady, true, name);
    const source = game.airLaunchSource, airtime = game.airtime, recovery = game.popCooldown, risingSpeed = game.vy;
    assert.ok(game.jump()); assert.equal(game.airtime, airtime); assert.equal(game.popCooldown, recovery);
    assert.ok(game.vy > risingSpeed, 'the second jump adds lift even while still rising');
    assert.equal(game.airLaunchSource, game.mode === 'surf' && source === 'flat' ? 'sky' : source);
    assert.equal(game.airJumpsUsed, 1); assert.equal(game.airJumpReady, false); assert.equal(game.jump(), false);
    finishSpin(game); assert.equal(game.launchTricks, 1);
    assert.equal(game.jump(), false, 'completing another trick never refills the jump');
    until(game, () => !game.airborne); assert.equal(game.wipeouts, 0); assert.equal(game.airJumpsUsed, 0);
    assert.equal(events.filter(event => event.type === 'airJump' && !event.opponent).length, 1);
    if (game.isRace) assert.equal(events.filter(event => event.type === 'raceBoost' && !event.opponent).length, 1);
    assert.equal(game.bank(), true); assert.equal(game.bank(), false);
  }
});

test('Skybound cannot erase an unfinished trick, jump while paused, refill through equipment or survive a bail', () => {
  for (const [, make] of factories) {
    const { game } = fixture(make, 'sky'); trickLaunch(game);
    assert.ok(game.doTrick('grab')); advance(game, .15);
    const trick = { ...game.trick }; assert.equal(game.jump(), false); assert.deepEqual(game.trick, trick);
    until(game, () => !game.trick); assert.equal(game.airJumpReady, true);
    const combo = game.comboBase, count = game.launchTricks;
    game.pause(); assert.equal(game.jump(), false); game.resume();
    assert.ok(game.jump()); assert.equal(game.comboBase, combo); assert.equal(game.launchTricks, count);
    game.setRewardBoard(null); game.setRewardBoard('sky'); assert.equal(game.jump(), false);
    game.bail(); assert.equal(game.airJumpsUsed, 0); assert.equal(game.airJumpReady, false); assert.equal(game.comboBase, 0);
    game.start(); assert.equal(game.rewardBoard, 'sky'); assert.equal(game.airJumpsUsed, 0);
    if (game.isRace) { assert.equal(game.jump(), false); assert.equal(game.airJumpReady, false); }
  }
});

test('Skybound second jump still collides with the solid Waterworks pipe ceiling', () => {
  const { game } = fixture(factories.find(([name]) => name === 'park')[1], 'sky');
  const pipe = PARK_PIPES[1], ceiling = pipe.centerY + pipe.radius - pipe.thickness;
  Object.assign(game, { x: pipe.x, z: pipe.z, y: ceiling - 2.35, vx: 0, vz: 0, speed: 0, airborne: true, airtime: .5, vy: -1 });
  assert.ok(game.jump());
  advance(game, .15, { brake: true });
  assert.ok(game.y + 2.1 <= ceiling + .02); assert.ok(game.vy < 0);
  assert.equal(parkPointBlocked(game.x, game.y + 1.9, game.z, .2), false);
});

test('Skybound empty double hops cannot farm points or race boosts', () => {
  for (const [, make] of factories) {
    const { game, events } = fixture(make, 'sky');
    assert.ok(game.jump()); advance(game, .15); assert.ok(game.jump());
    until(game, () => !game.airborne);
    assert.equal(game.comboBase, 0); assert.equal(game.score, 0); assert.equal(game.bank(), false);
    assert.equal(events.filter(event => event.type === 'raceBoost' && !event.opponent).length, 0);
  }
});

test('Skybound flight and the same earned reward agree at 30, 60 and 120 frames per second', () => {
  for (const [, make] of factories.filter(([name]) => name.includes('race'))) {
    const results = [];
    for (const hz of [30, 60, 120]) {
      const { game, events } = fixture(make, 'sky');
      assert.ok(game.jump()); advance(game, .2, {}, hz); assert.ok(game.jump());
      assert.ok(game.doTrick('spin')); advance(game, 4, {}, hz);
      assert.equal(game.wipeouts, 0); assert.equal(game.airborne, false);
      assert.equal(events.filter(event => event.type === 'raceBoost' && !event.opponent).length, 1);
      results.push([game.x, game.y, game.distance, game.boostSpeed, game.boostTime, game.comboBase]);
    }
    for (const result of results.slice(1)) result.forEach((value, i) => close(value, results[0][i]));
  }
});
