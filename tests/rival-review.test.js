import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournamentGame,TOURNAMENT_RIVALS} from '../src/tournament.js';
import {rivalReviewControls,rivalReviewReady} from '../src/race-lab.js';

for(const id of ['moxie','rivet'])test(`${id} rival review reaches a real grab and landed combo through ordinary simulation`,()=>{
  const events=[],game=createTournamentGame(event=>events.push(event),{version:1,completedRounds:TOURNAMENT_RIVALS.findIndex(rival=>rival.id===id)});
  game.start();let sawGrab=false,sawBoost=false;
  for(let step=0;step<45*120 && game.phase==='running' && !sawBoost;step++){
    game.update(1/120,rivalReviewControls(game));
    sawGrab ||= rivalReviewReady(game,'trick');
    sawBoost ||= rivalReviewReady(game,'boost');
  }
  assert.equal(sawGrab,true,'A genuine held grab is observable');
  assert.equal(sawBoost,true,'The completed combo awards a visible boost');
  const rivalEvents=events.filter(event=>event.opponent),boost=rivalEvents.find(event=>event.type==='raceBoost'&&event.combo);
  assert.ok(boost);assert.ok(boost.tricks>=2);
  assert.ok(rivalEvents.filter(event=>event.type==='trick').length>=2);
  assert.ok(rivalEvents.findIndex(event=>event.type==='land')<rivalEvents.indexOf(boost));
  assert.equal(game.opponent.wipeouts,0);
  const state=[game.opponent.boostTime,game.opponent.speed,game.opponent.distance];game.pause();game.update(2,rivalReviewControls(game));
  assert.deepEqual([game.opponent.boostTime,game.opponent.speed,game.opponent.distance],state,'Pausing the review freezes the actual rival burst');
});
