import test from 'node:test';
import { getSurfWeather } from '../src/surf-weather.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validateProfile, OUTFITS, BOARD_DESIGNS } from '../src/appearance.js';
import { getRewardBoard, rewardBoardUnlocked } from '../src/board-rewards.js';
import { SurfGame, COMBO_WINDOW, MIN_X, MAX_X, waveCrest } from '../src/game.js';
import { WaveParkGame, PARK_BOUNDS } from '../src/park.js';
import { createTournamentGame, sanitizeTournamentProgress, nextTournamentLadder, selectTournamentLadder } from '../src/tournament.js';
import { COMBO_ANIMATIONS } from '../src/combo-animations.js';
import { sanitizeTimeTrialProgress,timeTrialsUnlocked } from '../src/time-trial-progress.js';
import { trialCosmeticUnlocked } from '../src/trial-cosmetics.js';
import { ADMIN_STORAGE_KEY,sanitizeAdminSettings,resolveAdminStats } from '../src/admin-settings.js';
import { SECRET_STORAGE_KEY,sanitizeSecretProgress } from '../src/secret-progress.js';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const noOp = () => {};
function block(first, last) {
  const start = source.indexOf(first), end = source.indexOf(last, start + first.length);
  assert.ok(start >= 0 && end > start, `production block ${first} exists`);
  return source.slice(start, end);
}
function equipFixture(progress = { version: 2, ladderIndex: 1, completedRounds: 0, completedLadders: 1 }, trials = null) {
  const writes = [], visual = [], previews = [], menuPreviews = [], updates = [];
  const context = {
    adminSettings:sanitizeAdminSettings(null),resolveAdminStats,adminPanel:null,
    secretProgress:sanitizeSecretProgress(null),secretUnlockedThisRun:false,timePowerScreen:{reset:noOp,onEvent:noOp,update:noOp},
    profile: validateProfile({ character: 'reef', outfit: 'raglan', boardColor: '#24c5ba', boardDesign: 'tribal' }),
    tournamentProgress: sanitizeTournamentProgress(progress), validateProfile, rewardBoardUnlocked,
    trialProgress:sanitizeTimeTrialProgress(trials),OUTFITS,BOARD_DESIGNS,timeTrialsUnlocked,trialCosmeticUnlocked,
    game: new SurfGame(), write: (key, value) => writes.push([key, JSON.parse(value)]),
    world: { setProfile: profile => visual.push({ ...profile }) },
    preview: { setProfile: profile => previews.push({ ...profile }) },
    menuSurfer: { setProfile: profile => menuPreviews.push({ ...profile }) },
    updateCustomizationChoices: () => updates.push(true),
  };
  vm.runInNewContext(block('function applyPlayerSettings(', 'function adminHomeScreen('), context);
  vm.runInNewContext(block('function cosmeticAvailable(', 'if(!cosmeticAvailable(OUTFITS'), context);
  vm.runInNewContext(block('function setProfile(', 'function openWorkshop('), context);
  return { context, writes, visual, previews, menuPreviews, updates };
}

test('the actual board-shop action rejects locked rewards and applies the setup to save, physics, world, workshop and menu', () => {
  const { context, writes, visual, previews, menuPreviews, updates } = equipFixture();
  const original = { ...context.profile };
  assert.equal(context.setProfile({ rewardBoard: 'lightning' }), false);
  assert.deepEqual(context.profile, original); assert.equal(writes.length, 0); assert.equal(visual.length, 0); assert.equal(menuPreviews.length, 0);
  assert.equal(context.setProfile({ rewardBoard: 'guitar' }), true);
  assert.equal(context.game.rewardBoard, 'guitar'); assert.equal(context.game.rewardBoardDefinition.trickPointsMultiplier, 1.25);
  assert.equal(writes.at(-1)[0], 'breakline99-profile');
  assert.deepEqual(writes.at(-1)[1], { ...original, rewardBoard: 'guitar' });
  assert.deepEqual(visual.at(-1), context.profile); assert.deepEqual(previews.at(-1), context.profile); assert.equal(updates.length, 1);
  assert.deepEqual(menuPreviews.at(-1), context.profile); assert.equal(menuPreviews.length, 1);
  context.setProfile({ outfit: 'blackout' }); assert.equal(context.profile.rewardBoard, 'guitar', 'changing clothes preserves the prize deck');
  assert.deepEqual(menuPreviews.at(-1), { ...original, outfit: 'blackout', rewardBoard: 'guitar' });
  context.setProfile({ rewardBoard: null }); assert.equal(context.game.rewardBoardDefinition, null);
  assert.equal(context.profile.boardDesign, 'tribal'); assert.equal(context.profile.boardColor, '#24c5ba');
  assert.deepEqual(menuPreviews.at(-1), context.profile); assert.equal(menuPreviews.at(-1).rewardBoard, null); assert.equal(menuPreviews.length, 3);
});

test('boot restoration strips a locked board but restores an earned board and migrates the old championship', () => {
  const boot = block('let profile;try', 'const isParkMode=');
  for (const scenario of [
    { reward: 'sky', progress: { version: 2, ladderIndex: 0, completedRounds: 0, completedLadders: 0 }, expected: null },
    { reward: 'guitar', progress: { version: 2, ladderIndex: 1, completedRounds: 0, completedLadders: 1 }, expected: 'guitar' },
    { reward: 'sky', progress: { version: 2, ladderIndex: 4, completedRounds: 5, completedLadders: 5 }, expected: 'sky' },
    { reward: 'guitar', progress: { version: 1, completedRounds: 5 }, expected: 'guitar', legacy: true },
    { reward: 'afterburner', progress: { version: 2, ladderIndex: 4, completedRounds: 5, completedLadders: 5 }, trials: { version: 1, completedTrials: 2, selectedTrial: 2 }, expected: null },
    { reward: 'afterburner', progress: { version: 2, ladderIndex: 4, completedRounds: 5, completedLadders: 5 }, trials: { version: 1, completedTrials: 3, selectedTrial: 3 }, expected: 'afterburner' },
    { reward: 'afterburner', progress: { version: 2, ladderIndex: 3, completedRounds: 0, completedLadders: 4 }, trials: { version: 1, completedTrials: 12, selectedTrial: 11 }, expected: null },
    { reward: 'deadtime', expected:null },
    { reward: 'deadtime', secrets:{version:1,deadtimeUnlocked:true}, expected:'deadtime' },
    { reward: 'deadtime', secrets:{version:1,deadtimeUnlocked:'true'}, survival:299.99, expected:null },
    { reward: 'deadtime', survival:300, expected:'deadtime' },
  ]) {
    const values = new Map([
      ['breakline99-profile', JSON.stringify({ rewardBoard: scenario.reward })],
      [scenario.legacy ? 'breakline99-tournament-v1' : 'breakline99-tournament-v2', JSON.stringify(scenario.progress)],
      ['breakline99-trials-v1', JSON.stringify(scenario.trials ?? null)],
      [SECRET_STORAGE_KEY,JSON.stringify(scenario.secrets??null)],
      ['breakline99-survival-time',String(scenario.survival??0)],
    ]);
    const context = { SECRET_STORAGE_KEY,sanitizeSecretProgress,ADMIN_STORAGE_KEY,sanitizeAdminSettings,validateProfile, sanitizeTournamentProgress, rewardBoardUnlocked, sanitizeTimeTrialProgress,timeTrialsUnlocked,trialCosmeticUnlocked,OUTFITS,BOARD_DESIGNS,read: (key, fallback) => values.get(key) ?? fallback };
    vm.runInNewContext(`${boot}\nglobalThis.restoredProfile=profile;globalThis.restoredProgress=tournamentProgress;`, context);
    assert.equal(context.restoredProfile.rewardBoard, scenario.expected);
    if (scenario.legacy) assert.equal(context.restoredProgress.completedLadders, 1);
  }
});

test('Afterburner equips only after three trial clears, saves its identity and retains the existing outfit and deck setup', () => {
  const championship = { version: 2, ladderIndex: 4, completedRounds: 5, completedLadders: 5 };
  const { context, writes, visual, previews, menuPreviews } = equipFixture(championship, { version: 1, completedTrials: 2, selectedTrial: 2 });
  const original = { ...context.profile };
  assert.equal(context.setProfile({ rewardBoard: 'afterburner' }), false);
  assert.equal(writes.length, 0); assert.equal(visual.length, 0);
  context.trialProgress = sanitizeTimeTrialProgress({ version: 1, completedTrials: 3, selectedTrial: 3 });
  assert.equal(context.setProfile({ rewardBoard: 'afterburner' }), true);
  assert.deepEqual(context.profile, { ...original, rewardBoard: 'afterburner' });
  assert.equal(context.game.rewardBoard, 'afterburner');
  assert.equal(context.game.rewardBoardDefinition.baseSpeedMultiplier, 1.25);
  assert.equal(context.game.rewardBoardDefinition.boostPowerMultiplier, 1.5);
  assert.deepEqual(writes.at(-1), ['breakline99-profile', context.profile]);
  for (const calls of [visual, previews, menuPreviews]) assert.deepEqual(calls.at(-1), context.profile);
  context.tournamentProgress = selectTournamentLadder(context.tournamentProgress, 0);
  context.setProfile({ outfit: 'blackout' });
  assert.equal(context.profile.rewardBoard, 'afterburner', 'resetting a ladder does not revoke the trial board');
  context.game.start(); assert.equal(context.game.rewardBoard, 'afterburner');
  assert.equal(context.setProfile({ rewardBoard: null }), true);
  assert.equal(context.profile.boardDesign, original.boardDesign); assert.equal(context.profile.boardColor, original.boardColor);
});

test('the production finish handler saves the newly won board before equipment is offered, and replay keeps it', () => {
  const fixture = equipFixture({ version: 2, ladderIndex: 0, completedRounds: 4, completedLadders: 0 });
  const { context, writes } = fixture;
  let results = 0;
  Object.assign(context, {
    selectedMode: 'tournament', audio: { event: noOp }, special: { gain: noOp, bail: noOp },
    toast: noOp, saveBest: noOp, showResults: () => results++, clearInput: noOp,
    isParkMode: () => context.game.mode === 'park', fmt: n => String(n),
  });
  context.world.onEvent = noOp;
  vm.runInNewContext(block('function onEvent(', 'function makeGame('), context);
  context.game = createTournamentGame(context.onEvent, context.tournamentProgress); context.game.start();
  assert.equal(context.setProfile({ rewardBoard: 'guitar' }), false);
  context.game.finish('win');
  assert.equal(results, 1); assert.equal(context.tournamentProgress.completedLadders, 1);
  assert.deepEqual(writes.at(-1), ['breakline99-tournament-v2', { version: 2, ladderIndex: 0, completedRounds: 5, completedLadders: 1 }]);
  assert.equal(context.setProfile({ rewardBoard: 'guitar' }), true);
  const replay = selectTournamentLadder(context.tournamentProgress, 0);
  context.tournamentProgress = replay; context.game = createTournamentGame(context.onEvent, replay);
  assert.equal(context.setProfile({ rewardBoard: 'guitar' }), true);
  context.game.start(); context.game.finish('loss');
  assert.equal(context.tournamentProgress.completedLadders, 1); assert.equal(context.profile.rewardBoard, 'guitar');
  assert.equal(context.game.rewardBoardDefinition.trickPointsMultiplier, 1.25);
});

test('the actual start and retry actions carry an equipped board into the next ladder without equipping the rival', () => {
  const fixture = equipFixture({ version: 2, ladderIndex: 0, completedRounds: 5, completedLadders: 1 });
  const { context } = fixture;
  context.setProfile({ rewardBoard: 'guitar' });
  const element = { classList: { add: noOp, remove: noOp }, focus: noOp };
  Object.assign(context, {
    createTournamentGame, nextTournamentLadder, selectTournamentLadder, onEvent: noOp,
    selectedMode: 'tournament', selectedParkStart: 'basin', wasted: { reset: noOp }, closeWorkshop: noOp, closeModal: noOp, clearInput: noOp,
    special: { reset: noOp }, soundPreference: 'off', audio: { enabled: false, setMode: noOp, setScene: noOp },
    updateModeMenu: noOp, updateSoundLabel: noOp, document: { body: element }, $: () => element,
  });
  context.world.setMode = noOp;
  context.game = createTournamentGame(context.onEvent, context.tournamentProgress);
  vm.runInNewContext(block('function startRun(', 'function goHome('), context);
  context.startRun(); assert.equal(context.game.ladderIndex, 1); assert.equal(context.game.rewardBoard, 'guitar');
  assert.equal(context.game.opponent.rewardBoardDefinition, null);
  context.restartRun(); assert.equal(context.game.ladderIndex, 1); assert.equal(context.game.rewardBoard, 'guitar');
  context.selectedMode = 'park'; context.game = new WaveParkGame(); context.startRun();
  assert.equal(context.game.rewardBoard, 'guitar'); assert.equal(context.game.mode, 'park');
});

test('the real HUD shows the active perk, only prompts an eligible Skybound jump, and uses Solar recovery duration', () => {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) {
      const classes = new Set(), element = {
        textContent: '', style: { setProperty: noOp }, querySelector: () => ({ textContent: '' }),
        classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) },
      };
      element.parentElement = element; elements.set(id, element);
    }
    return elements.get(id);
  };
  const game = new SurfGame(); game.setRewardBoard('sky'); game.start();
  const context = {
    adminSettings:sanitizeAdminSettings(null),
    $, game, profile: validateProfile({ rewardBoard: 'sky' }), getRewardBoard, getSurfWeather, selectedMode: 'surf', best: 0,
    clockText: String, fmt: String, pad: String, input: {}, isParkMode: () => false, waveCrest, MIN_X, MAX_X, PARK_BOUNDS,
    COMBO_WINDOW, COMBO_ANIMATIONS, special: { value: 0, ready: false }, completedGoals: () => [false, false, false], challengeFlags: [], toast: noOp,
  };
  vm.runInNewContext(block('function updateHud(', 'adminPanel=createAdminPanel('), context);
  context.updateHud(); assert.match($('reward-ride-status').textContent, /SKYBOUND/);
  assert.doesNotMatch($('pop-label').textContent, /SECOND AIR/);
  game.jump(); for (let i = 0; i < 20; i++) game.update(1 / 120);
  context.updateHud(); assert.match($('pop-label').textContent, /SPACE FOR SECOND AIR/);
  game.jump(); context.updateHud(); assert.doesNotMatch($('pop-label').textContent, /SECOND AIR/);
  game.setRewardBoard('solar'); context.profile.rewardBoard = 'solar'; game.start(); game.jump();
  for (let i = 0; i < 100 && game.airborne; i++) game.update(1 / 120);
  context.updateHud(); assert.equal($('pop-ready-bar').style.width, '0%');
  assert.match($('reward-ride-status').textContent, /SOLAR FLARE/);
});
