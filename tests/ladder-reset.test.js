import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SurfGame } from '../src/game.js';
import { WaveParkGame } from '../src/park.js';
import { SpecialMeter } from '../src/special.js';
import { createKeydownHandler } from '../src/keyboard.js';
import { validateProfile } from '../src/appearance.js';
import { getRewardBoard, rewardBoardUnlocked, REWARD_BOARD_ORDER } from '../src/board-rewards.js';
import { sanitizeAdminSettings,resolveAdminStats } from '../src/admin-settings.js';
import { chooseSurfWeather,getSurfWeather,getSurfSessionWeather } from '../src/surf-weather.js';
import { SECRET_STORAGE_KEY,sanitizeSecretProgress,awardSurvivalSecret } from '../src/secret-progress.js';
import {
  createTournamentGame, sanitizeTournamentProgress, selectTournamentLadder, nextTournamentLadder,
  TOURNAMENT_LADDERS, TOURNAMENT_RIVALS, tournamentRivalsForLadder, tournamentCourseLength,
} from '../src/tournament.js';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const noOp = () => {};
function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `production ${name} function exists`);
  const end = source.indexOf('\nfunction ', start + 1);
  assert.ok(end > start, `production ${name} has a following function boundary`);
  return source.slice(start, end);
}
function fixture(progress = { version: 2, ladderIndex: 2, completedRounds: 3, completedLadders: 3 }, rewardBoard = 'vortex') {
  const saved = [], elements = new Map(), scenes = [];
  const $ = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      const element = {
        dataset: {}, innerHTML: '', textContent: '', focus: noOp,
        classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
      };
      elements.set(id, element);
    }
    return elements.get(id);
  };
  const context = {
    secretUnlockedThisRun:false,timePowerScreen:{reset:noOp,onEvent:noOp,update:noOp},
    SECRET_STORAGE_KEY,awardSurvivalSecret,secretProgress:sanitizeSecretProgress(null),updateCustomizationChoices:noOp,
    adminSettings:sanitizeAdminSettings(null),resolveAdminStats,adminPanel:null,keydownHandler:null,lastSurfWeather:'sunset',chooseSurfWeather,getSurfWeather,getSurfSessionWeather,
    $, saved, createTournamentGame, sanitizeTournamentProgress, selectTournamentLadder, nextTournamentLadder,
    TOURNAMENT_LADDERS, TOURNAMENT_RIVALS, tournamentRivalsForLadder, tournamentCourseLength, getRewardBoard,
    SurfGame, WaveParkGame, tournamentProgress: sanitizeTournamentProgress(progress),
    selectedMode: 'tournament', selectedParkStart: 'basin', game: null,
    profile: validateProfile({ rewardBoard, character: 'reef', outfit: 'raglan' }),
    modalMode: null, resumeAfterModal: false, workshopMode: null, pressed: new Set(),
    input: { left: false, right: false, jump: false, pump: false }, special: new SpecialMeter(),
    world: { setMode: noOp, onEvent: noOp }, audio: { enabled: true, setMode: noOp, setRideContext: noOp, setScene: scene => scenes.push(scene), event: noOp },
    wasted: { reset: noOp }, soundPreference: 'off', document: { body: $('body') },
    write: (key, value) => saved.push([key, JSON.parse(value)]), saveBest: noOp, loadBest: noOp,
    updateModeMenu: noOp, updateSoundLabel: noOp, fmt: n => String(Math.round(n)), toast: noOp,
    isParkMode: () => context.game.mode === 'park', showResults: () => { context.modalMode = 'results'; },
  };
  vm.runInNewContext([
    'clearInput', 'applyPlayerSettings', 'onEvent', 'makeGame', 'startRun', 'checkSurvivalSecret', 'goHome', 'openModal', 'closeModal',
    'pause', 'ladderRows', 'resetCurrentLadder', 'showLadder', 'closeWorkshop',
  ].map(productionFunction).join('\n'), context);
  context.makeGame();
  return { context, saved, elements, scenes };
}
function advance(game, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 120); i++) game.update(1 / 120, input);
}

test('resetting a live ladder clears the old race, controls and special, and cannot accidentally resume the replacement', () => {
  const { context, saved, elements, scenes } = fixture();
  context.startRun(); const previous = context.game, opponent = previous.opponent;
  advance(previous, 3); advance(previous, .35, { jump: true }); assert.ok(previous.jump());
  assert.ok(previous.doTrick('spin'));
  for (let i = 0; i < 360 && previous.airborne; i++) previous.update(1 / 120);
  assert.ok(previous.boostTime > 0); assert.ok(previous.comboBase > 0);
  context.special.gain(1); context.pressed.add('Space'); context.input.jump = true;
  context.pause(); context.showLadder();
  assert.equal(context.resumeAfterModal, true); assert.equal(previous.phase, 'paused');

  context.resetCurrentLadder();
  const reset = context.game;
  assert.notEqual(reset, previous); assert.notEqual(reset.opponent, opponent);
  assert.equal(reset.ladderIndex, 2); assert.equal(reset.roundIndex, 0); assert.equal(reset.rival.id, 'moxie');
  assert.equal(reset.phase, 'ready'); assert.equal(reset.score, 0); assert.equal(reset.comboBase, 0);
  assert.equal(reset.boostTime, 0); assert.equal(reset.nextCheckpoint, 0); assert.equal(reset.opponent.nextCheckpoint, 0);
  assert.equal(context.special.value, 0); assert.equal(context.pressed.size, 0); assert.ok(Object.values(context.input).every(value => value === false));
  assert.equal(reset.rewardBoard, 'vortex'); assert.equal(context.profile.rewardBoard, 'vortex');
  assert.equal(context.tournamentProgress.completedLadders, 3);
  assert.deepEqual(saved.at(-1), ['breakline99-tournament-v2', { version: 2, ladderIndex: 2, completedRounds: 0, completedLadders: 3 }]);
  assert.equal(context.modalMode, 'ladder'); assert.equal(context.resumeAfterModal, false);
  assert.equal(scenes.at(-1), 'menu'); assert.equal(elements.get('intro').classList.contains('hidden'), false);
  context.closeModal(); assert.equal(reset.phase, 'ready', 'closing the reset ladder must not restart a race behind the menu');
  context.startRun(); assert.equal(context.game.phase, 'running'); assert.equal(context.game.countdownRemaining, 3);
  assert.equal(context.game.roundIndex, 0); assert.equal(context.game.rewardBoard, 'vortex');
});

test('every ladder can be reset from ready, running, paused or results without losing any prize board', () => {
  for (let ladderIndex = 0; ladderIndex < 5; ladderIndex++) for (const phase of ['ready', 'running', 'paused', 'finished']) {
    const { context, saved } = fixture({ version: 2, ladderIndex, completedRounds: 4, completedLadders: 5 }, 'sky');
    if (phase !== 'ready') context.startRun();
    if (phase === 'paused') context.pause();
    if (phase === 'finished') context.game.finish('win');
    const previous = context.game;
    context.resetCurrentLadder();
    assert.notEqual(context.game, previous); assert.equal(context.game.phase, 'ready');
    assert.equal(context.game.ladderIndex, ladderIndex); assert.equal(context.game.roundIndex, 0);
    assert.deepEqual(saved.at(-1)[1], { version: 2, ladderIndex, completedRounds: 0, completedLadders: 5 });
    assert.equal(context.game.rewardBoard, 'sky'); assert.equal(context.profile.rewardBoard, 'sky');
    for (const id of REWARD_BOARD_ORDER) assert.equal(rewardBoardUnlocked(id, context.tournamentProgress), true);
    context.resetCurrentLadder();
    assert.equal(context.game.roundIndex, 0); assert.equal(context.tournamentProgress.completedLadders, 5, 'repeated reset is safe');
  }
});

test('a freshly reset save reloads at race one on the chosen ladder and still restores its earned equipment', () => {
  const { context, saved } = fixture({ version: 2, ladderIndex: 3, completedRounds: 2, completedLadders: 3 }, 'lightning');
  context.resetCurrentLadder();
  const persisted = JSON.parse(JSON.stringify(saved.at(-1)[1]));
  const loaded = createTournamentGame(noOp, persisted); loaded.setRewardBoard(context.profile.rewardBoard);
  assert.equal(loaded.ladderIndex, 3); assert.equal(loaded.roundIndex, 0); assert.equal(loaded.rewardBoard, 'lightning');
  assert.equal(loaded.getProgress().completedLadders, 3);
  assert.equal(rewardBoardUnlocked('vortex', persisted), true); assert.equal(rewardBoardUnlocked('solar', persisted), false);
});

test('resetting outside Rival mode is a no-op and never alters its saved progress', () => {
  const { context, saved } = fixture();
  const progress = JSON.stringify(context.tournamentProgress), originalProfile = JSON.stringify(context.profile);
  for (const mode of ['surf', 'park']) {
    context.selectedMode = mode; context.game = mode === 'surf' ? new SurfGame() : new WaveParkGame(); context.game.start();
    const game = context.game;
    context.resetCurrentLadder();
    assert.equal(context.game, game); assert.equal(game.phase, 'running'); assert.equal(saved.length, 0);
    assert.equal(JSON.stringify(context.tournamentProgress), progress); assert.equal(JSON.stringify(context.profile), originalProfile);
  }
});

test('Enter on a focused ladder button keeps native activation instead of starting a race; Enter on the stage still starts', () => {
  const calls = [], game = createTournamentGame(noOp, { version: 1, completedRounds: 2 });
  const state = { bootReady: true, workshopMode: null, modalMode: 'ladder', game, input: {} };
  const handler = createKeydownHandler(() => state, {
    startRun: () => calls.push('startRun'), closeModal: () => calls.push('closeModal'),
  });
  const button = { tagName: 'BUTTON', closest: () => button };
  const target = { tagName: 'SPAN', closest: () => button };
  for (const focused of [button, target]) {
    const event = { code: 'Enter', repeat: false, target: focused, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    handler(event);
    assert.equal(event.defaultPrevented, false, 'native button click remains available');
    assert.deepEqual(calls, [], 'Enter must not race before the reset button receives its click');
  }
  const stageEvent = { code: 'Enter', repeat: false, target: { tagName: 'MAIN', closest: () => null }, preventDefault() {} };
  handler(stageEvent); assert.deepEqual(calls, ['startRun']);
});

test('opening the ladders from a paused race and pressing Escape resumes the same untouched race', () => {
  const { context, saved } = fixture();
  context.startRun(); advance(context.game, 4);
  const game = context.game, distance = game.distance, rank = game.roundIndex;
  context.pause(); context.showLadder(); assert.equal(game.phase, 'paused'); assert.equal(context.modalMode, 'ladder');
  context.pause();
  assert.equal(context.game, game); assert.equal(context.game.phase, 'running'); assert.equal(context.game.distance, distance);
  assert.equal(context.game.roundIndex, rank); assert.equal(context.modalMode, null); assert.equal(saved.length, 0);
});
