import test from 'node:test';
import assert from 'node:assert/strict';
import { everythingUnlocked, persistAdminEntries, resetBreaklineSave } from '../src/admin-save.js';
import { ALL_REWARD_BOARD_ORDER, rewardBoardUnlocked } from '../src/board-rewards.js';
import { TRIAL_COSMETIC_SETS, trialCosmeticUnlocked } from '../src/trial-cosmetics.js';
import { TOURNAMENT_LADDERS, selectTournamentLadder, sanitizeTournamentProgress } from '../src/tournament-progress.js';
import { TIME_TRIALS, timeTrialsUnlocked, selectTimeTrial, sanitizeTimeTrialProgress } from '../src/time-trial-progress.js';
import { unlockAllSewerRewards,sewerOutfitUnlocked } from '../src/sewer-progress.js';

function fakeStorage(initial={}) {
  const values=new Map(Object.entries(initial));
  let failure=null;
  const check=(operation,key)=>{
    if(failure?.operation===operation && (!failure.key || failure.key===key)) {
      const error=failure.error;failure=null;throw error;
    }
  };
  return {
    get length(){return values.size;},
    key(index){return [...values.keys()][index]??null;},
    getItem(key){check('get',key);return values.get(key)??null;},
    setItem(key,value){check('set',key);values.set(key,String(value));},
    removeItem(key){check('remove',key);values.delete(key);},
    failOnce(operation,key){const error=new Error(`${operation} failed for ${key}`);failure={operation,key,error};return error;},
    snapshot(){return Object.fromEntries(values);},
  };
}

test('Give Me Everything unlocks every prize, ladder and trial without inventing any personal bests',()=>{
  const unlocked=everythingUnlocked(),sewer=unlockAllSewerRewards();
  assert.equal(timeTrialsUnlocked(unlocked.tournament),true);
  for(const id of ALL_REWARD_BOARD_ORDER) assert.equal(rewardBoardUnlocked(id,unlocked.tournament,unlocked.trials,unlocked.secrets,sewer),true,id);
  for(const outfit of ['draincrew','nightshift'])assert.equal(sewerOutfitUnlocked(outfit,sewer),true);
  assert.deepEqual(sewer.bestTimes,Array(5).fill(null));
  for(const set of TRIAL_COSMETIC_SETS) assert.equal(trialCosmeticUnlocked(set.id,unlocked.trials.completedTrials),true,set.name);
  for(let index=0;index<TOURNAMENT_LADDERS.length;index++) assert.notEqual(selectTournamentLadder(unlocked.tournament,index),null);
  for(let index=0;index<TIME_TRIALS.length;index++) assert.notEqual(selectTimeTrial(unlocked.trials,index),null);
  assert.deepEqual(unlocked.trials.bestTimes,Array(TIME_TRIALS.length).fill(null));
  assert.deepEqual(sanitizeTournamentProgress(unlocked.tournament),unlocked.tournament);
  assert.deepEqual(sanitizeTimeTrialProgress(unlocked.trials),unlocked.trials);
  assert.deepEqual(unlocked.secrets,{version:1,deadtimeUnlocked:true});
  assert.equal(Object.hasOwn(unlocked.secrets,'bestSurvival'),false);
});

test('unlocking preserves the active ladder, partial races, selected trial and genuine best times',()=>{
  const tournament={version:2,ladderIndex:2,completedRounds:3,completedLadders:2};
  const trials={version:1,completedTrials:3,selectedTrial:1,bestTimes:[32.13,35.79,40.25,...Array(9).fill(null)]};
  const source=JSON.stringify({tournament,trials});
  const secrets={version:1,deadtimeUnlocked:false};
  const unlocked=everythingUnlocked(tournament,trials,secrets);
  assert.deepEqual(unlocked.tournament,{...tournament,completedLadders:5});
  assert.deepEqual(unlocked.trials,{...trials,completedTrials:12});
  assert.equal(JSON.stringify({tournament,trials}),source);
  unlocked.trials.bestTimes[0]=1;
  assert.equal(trials.bestTimes[0],32.13);
  assert.deepEqual(secrets,{version:1,deadtimeUnlocked:false});
  assert.deepEqual(unlocked.secrets,{version:1,deadtimeUnlocked:true});
});

test('Give Me Everything is repeatable and idempotent for current, legacy and damaged saves',()=>{
  for(const [tournament,trials] of [
    [undefined,undefined],
    [{version:1,completedRounds:3},{version:1,completedTrials:1,selectedTrial:0,bestTimes:[29]}],
    [{version:2,ladderIndex:4,completedRounds:5,completedLadders:5},{version:1,completedTrials:12,selectedTrial:11,bestTimes:TIME_TRIALS.map(trial=>trial.timeLimit-5)}],
    [{version:99,completedLadders:999},{version:1,completedTrials:99,bestTimes:[NaN]}],
  ]) {
    const first=everythingUnlocked(tournament,trials);
    assert.deepEqual(everythingUnlocked(first.tournament,first.trials,first.secrets),first);
    assert.equal(first.tournament.completedLadders,5);assert.equal(first.trials.completedTrials,12);
  }
});

test('admin save changes persist together and preserve unrelated browser data',()=>{
  const storage=fakeStorage({'breakline99-tournament-v2':'old tournament','other-app':'keep'});
  const unlocked=everythingUnlocked();
  persistAdminEntries(storage,[['breakline99-tournament-v2',JSON.stringify(unlocked.tournament)],['breakline99-trials-v1',JSON.stringify(unlocked.trials)]]);
  assert.deepEqual(JSON.parse(storage.getItem('breakline99-tournament-v2')),unlocked.tournament);
  assert.deepEqual(JSON.parse(storage.getItem('breakline99-trials-v1')),unlocked.trials);
  assert.equal(storage.getItem('other-app'),'keep');
});

test('a failed multi-save restores overwritten entries and removes any newly created entries',()=>{
  const initial={'breakline99-tournament-v2':'original tournament','breakline99-admin-v1':'original stats','other-app':'keep'};
  const storage=fakeStorage(initial),cause=storage.failOnce('set','breakline99-admin-v1');
  assert.throws(()=>persistAdminEntries(storage,[
    ['breakline99-tournament-v2','new tournament'],['breakline99-trials-v1','new trials'],['breakline99-admin-v1','new stats'],
  ]),error=>{
    assert.match(error.message,/could not save/);assert.equal(error.cause,cause);return true;
  });
  assert.deepEqual(storage.snapshot(),initial);
});

test('a save read failure leaves every existing entry untouched',()=>{
  const initial={'breakline99-tournament-v2':'old','breakline99-admin-v1':'stats'};
  const storage=fakeStorage(initial),cause=storage.failOnce('get','breakline99-admin-v1');
  assert.throws(()=>persistAdminEntries(storage,[['breakline99-tournament-v2','new'],['breakline99-admin-v1','new stats']]),error=>error===cause);
  assert.deepEqual(storage.snapshot(),initial);
});

test('Full Reset removes all and only Breakline saves, including legacy, admin, options and personal bests',()=>{
  const gameEntries={
    'breakline99-tournament-v1':'legacy','breakline99-tournament-v2':'current',
    'breakline99-trials-v1':'PBs','breakline99-admin-v1':'stats',
    'breakline99-secrets-v1':'secret board','breakline99-sewer-v1':'sewer rewards and times',
    'breakline99-profile':'board and outfit','breakline99-sound':'off',
    'breakline99-quality':'high','breakline99-best-surf':'12000',
    'breakline99-future-setting':'future',
  };
  const otherEntries={'other-app':'keep','breakline990-save':'near prefix','prefix-breakline99-save':'embedded prefix','breakline99':'no dash'};
  const storage=fakeStorage({...gameEntries,...otherEntries});
  assert.equal(resetBreaklineSave(storage),Object.keys(gameEntries).length);
  assert.deepEqual(storage.snapshot(),otherEntries);
  assert.equal(resetBreaklineSave(storage),0);
  assert.deepEqual(storage.snapshot(),otherEntries);
});

test('a failed Full Reset restores all original saves and leaves unrelated data alone',()=>{
  const initial={
    'breakline99-profile':'profile','other-app':'keep','breakline99-admin-v1':'stats',
    'breakline99-tournament-v2':'progress','breakline99-trials-v1':'PBs',
  };
  const storage=fakeStorage(initial),cause=storage.failOnce('remove','breakline99-tournament-v2');
  assert.throws(()=>resetBreaklineSave(storage),error=>{
    assert.match(error.message,/could not reset/);assert.equal(error.cause,cause);return true;
  });
  assert.deepEqual(storage.snapshot(),initial);
});

test('a reset inspection failure never starts deleting the save',()=>{
  const initial={'breakline99-profile':'profile','breakline99-trials-v1':'PBs','other-app':'keep'};
  const storage=fakeStorage(initial),cause=storage.failOnce('get','breakline99-trials-v1');
  assert.throws(()=>resetBreaklineSave(storage),error=>error===cause);
  assert.deepEqual(storage.snapshot(),initial);
});
