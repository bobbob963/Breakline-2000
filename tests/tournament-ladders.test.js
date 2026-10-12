import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournamentGame,TOURNAMENT_LADDERS,TOURNAMENT_RIVALS,sanitizeTournamentProgress,
  tournamentRivalsForLadder,selectTournamentLadder,nextTournamentLadder } from '../src/tournament.js';
import { recordTournamentWin } from '../src/tournament-progress.js';
import { surfRaceTrickInput } from '../src/surf-race.js';
import { parkRaceTrickInput } from '../src/park-race.js';

const state=(ladderIndex=0,completedRounds=0,completedLadders=ladderIndex)=>({version:2,ladderIndex,completedRounds,completedLadders});
const boostedLine=game=>(game.mode==='park'?parkRaceTrickInput:surfRaceTrickInput)(game,game.course,1);
function runToFinish(game,input,hz=30) {
  game.start();
  for(let frame=0;frame<hz*110&&game.phase==='running';frame++)game.update(1/hz,typeof input==='function'?input(game):input);
  assert.equal(game.phase,'finished',`${game.ladder.name} / ${game.rival.name} reaches a real finish`);
}

test('old saves keep their current rival and old champions receive exactly the first reward',()=>{
  for(let rank=0;rank<=5;rank++) {
    const save=sanitizeTournamentProgress({version:1,completedRounds:rank});
    assert.deepEqual(save,state(0,rank,rank===5?1:0));
    assert.deepEqual(sanitizeTournamentProgress(save),save,'migration is idempotent');
    const game=createTournamentGame(()=>{},save);
    assert.equal(game.roundIndex,Math.min(rank,4));assert.equal(game.complete,rank===5);
    assert.equal(game.allLaddersComplete,false);assert.equal(game.unlockedBoardId,null);
  }
});

test('invalid, inherited and contradictory v2 saves cannot unlock higher ladders or rewards',()=>{
  for(const save of [
    {},{version:2,completedRounds:4},{...state(),ladderIndex:5},{...state(),completedRounds:6},
    {...state(),completedLadders:6},{...state(),completedLadders:'5'},
    {...state(),completedLadders:1.5},{...state(),completedRounds:Infinity},
    state(2,0,1),state(1,5,1),Object.create(state(4,5,5)),
  ])assert.deepEqual(sanitizeTournamentProgress(save),state());
  const save={...state(3,2,4),unlockedBoards:['sky'],extra:true};
  assert.deepEqual(sanitizeTournamentProgress(save),state(3,2,4),'only completed ladder count controls rewards');
  const detached=sanitizeTournamentProgress(save);detached.completedLadders=5;
  assert.equal(save.completedLadders,4);
});

test('five ladders have five fixed rivals each with gradual bounded difficulty and distinct rewards',()=>{
  assert.equal(TOURNAMENT_LADDERS.length,5);
  assert.deepEqual(TOURNAMENT_LADDERS.map(ladder=>ladder.rewardId),['guitar','lightning','vortex','solar','sky']);
  assert.equal(new Set(TOURNAMENT_LADDERS.map(ladder=>ladder.id)).size,5);
  for(let ladder=0;ladder<5;ladder++) {
    const rivals=tournamentRivalsForLadder(ladder);assert.equal(rivals.length,5);
    assert.deepEqual(rivals.map(rival=>rival.id),TOURNAMENT_RIVALS.map(rival=>rival.id));
    for(let rank=0;rank<5;rank++) {
      assert.ok(rivals[rank].pace<=.98);
      if(ladder>0)assert.ok(rivals[rank].pace>tournamentRivalsForLadder(ladder-1)[rank].pace);
      assert.equal(rivals[rank].profile,TOURNAMENT_RIVALS[rank].profile);
    }
  }
});

test('twenty-five wins award one new board after each fifth win without skipping result screens',()=>{
  let progress=state();
  const rewards=[];
  for(let ladderIndex=0;ladderIndex<5;ladderIndex++) {
    for(let rank=0;rank<5;rank++) {
      const events=[],game=createTournamentGame(event=>events.push(event),progress);game.start();
      assert.equal(game.ladderIndex,ladderIndex);assert.equal(game.roundIndex,rank);
      assert.equal(game.finish('win'),true);assert.equal(game.finish('win'),false);
      assert.equal(game.roundIndex,rank,'finishing does not start the next race');
      progress=game.getProgress();
      assert.deepEqual(progress,state(ladderIndex,rank+1,rank===4?ladderIndex+1:ladderIndex));
      assert.equal(game.complete,rank===4);assert.equal(game.allLaddersComplete,ladderIndex===4&&rank===4);
      const event=events.find(event=>event.type==='finish');
      assert.equal(event.unlockedBoardId,rank===4?TOURNAMENT_LADDERS[ladderIndex].rewardId:null);
      assert.deepEqual(event.progress,progress);assert.equal(event.ladder,TOURNAMENT_LADDERS[ladderIndex]);
      if(game.unlockedBoardId)rewards.push(game.unlockedBoardId);
    }
    const next=nextTournamentLadder(progress);
    if(ladderIndex<4) {assert.deepEqual(next,state(ladderIndex+1,0,ladderIndex+1));progress=next;}
    else assert.equal(next,null,'there is no phantom sixth ladder');
  }
  assert.deepEqual(rewards,['guitar','lightning','vortex','solar','sky']);
});

test('retrying or losing after a ladder clear preserves the board and cannot award it twice',()=>{
  for(let ladderIndex=0;ladderIndex<5;ladderIndex++) {
    const events=[],game=createTournamentGame(event=>events.push(event),state(ladderIndex,4));game.start();game.finish('win');
    const permanent=game.getProgress();assert.equal(game.unlockedBoardId,TOURNAMENT_LADDERS[ladderIndex].rewardId);
    game.retry();assert.equal(game.unlockedBoardId,null);assert.equal(game.roundIndex,4);game.finish('loss');
    assert.deepEqual(game.getProgress(),permanent);assert.equal(game.unlockedBoardId,null);
    game.retry();game.finish('win');assert.deepEqual(game.getProgress(),permanent);assert.equal(game.unlockedBoardId,null);
    assert.equal(events.filter(event=>event.type==='finish'&&event.unlockedBoardId).length,1);
  }
});

test('ladder selection locks future tiers and every replay keeps all previously earned boards',()=>{
  const midway=state(2,3,2);
  assert.equal(selectTournamentLadder(midway,3),null);assert.equal(selectTournamentLadder(midway,-1),null);
  assert.equal(selectTournamentLadder(midway,'1'),null);assert.equal(nextTournamentLadder(midway),null);
  assert.deepEqual(selectTournamentLadder(midway,1),state(1,0,2));
  for(let index=0;index<5;index++) {
    const replay=selectTournamentLadder(state(4,5,5),index);
    assert.deepEqual(replay,state(index,0,5));
    const finished=recordTournamentWin(replay,4);assert.deepEqual(finished,state(index,5,5));
    const restored=createTournamentGame(()=>{},finished);
    assert.equal(restored.complete,true);assert.equal(restored.allLaddersComplete,true);
    assert.equal(restored.unlockedBoardId,null);
  }
});

test('all twenty-five races remain winnable with ordinary steering, charged pops and completed combos',()=>{
  for(let ladder=0;ladder<5;ladder++)for(let rank=0;rank<5;rank++) {
    const game=createTournamentGame(()=>{},state(ladder,rank));
    // Control decisions run at the physics rate, just like the rival policy.
    runToFinish(game,boostedLine,120);
    assert.equal(game.result,'win',`${game.ladder.name} / ${game.rival.name} is beatable without reward perks`);
    assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
    assert.equal(game.raceMisses,0);assert.equal(game.wipeouts,0);
  }
});

test('all twenty-five opponents clear the compulsory course using real movement and actual combo boosts',()=>{
  for(let ladder=0;ladder<5;ladder++)for(let rank=0;rank<5;rank++) {
    let boosts=0;
    const game=createTournamentGame(event=>{if(event.type==='raceBoost'&&event.opponent&&event.combo)boosts++;},state(ladder,rank));
    runToFinish(game,{brake:true});
    assert.equal(game.result,'loss');assert.equal(game.opponent.nextCheckpoint,game.course.checkpoints.length);
    assert.equal(game.opponent.raceMisses,0,`${game.ladder.name} / ${game.rival.name} stays in the rings`);
    assert.equal(game.opponent.wipeouts,0);assert.ok(boosts>=2);
    assert.deepEqual(game.getProgress(),state(ladder,rank),'a loss cannot award progress');
  }
});
