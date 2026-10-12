import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveParkGame, PARK_STARTS } from '../src/park.js';
import { TournamentGame, TOURNAMENT_RIVALS, TOURNAMENT_SECONDS, rivalScoreAt, sanitizeTournamentProgress } from '../src/tournament.js';

function fixture(progress) {
  const events=[],game=new TournamentGame(event=>events.push(event),progress);
  game.start();return {game,events};
}
function advance(game,seconds,input={},hz=120) {
  for(let i=0;i<Math.round(seconds*hz);i++)game.update(1/hz,input);
}
// A clock fixture isolates the few milliseconds around the buzzer without
// pretending the points came from a rendered route. Real-route coverage below
// separately earns and banks an actual airborne trick sequence.
function buzzer(game) {
  game.elapsed=TOURNAMENT_SECONDS-.004;
  game.update(.05,{brake:true});
}
function bankPoints(game,points) {
  game.addCombo('SCORE FIXTURE',points);assert.equal(game.bank(),true);
}

test('five original rivals form an increasing ninety-second score ladder with safe drop-ins',()=>{
  assert.equal(TOURNAMENT_SECONDS,90);assert.equal(TOURNAMENT_RIVALS.length,5);
  assert.deepEqual(TOURNAMENT_RIVALS.map(rival=>rival.target),[1800,3500,6000,9000,13000]);
  assert.deepEqual(TOURNAMENT_RIVALS.map(rival=>rival.rank),[5,4,3,2,1]);
  assert.equal(new Set(TOURNAMENT_RIVALS.map(rival=>rival.id)).size,5);
  for(const rival of TOURNAMENT_RIVALS) {
    assert.ok(Object.hasOwn(PARK_STARTS,rival.startId));
    assert.ok(rival.name&&rival.subtitle&&rival.style);
    assert.equal(Object.isFrozen(rival),true);
  }
});

test('corrupt or inherited save fields cannot unlock rounds and returned progress is detached',()=>{
  for(const value of[
    null,undefined,0,'5',[],{}, {version:2,completedRounds:5},
    {version:1,completedRounds:'5'}, {version:1,completedRounds:NaN},
    {version:1,completedRounds:Infinity}, {version:1,completedRounds:-1},
    {version:1,completedRounds:6}, {version:1,completedRounds:2.5},
    Object.create({version:1,completedRounds:5}), {version:1,constructor:5},
  ])assert.deepEqual(sanitizeTournamentProgress(value),{version:2,ladderIndex:0,completedRounds:0,completedLadders:0});
  for(let completedRounds=0;completedRounds<=5;completedRounds++) {
    const value={version:1,completedRounds,extra:'discard'};
    assert.deepEqual(sanitizeTournamentProgress(value),{version:2,ladderIndex:0,completedRounds,completedLadders:completedRounds===5?1:0});
  }
  const source={version:1,completedRounds:2},game=new TournamentGame(()=>{},source);
  source.completedRounds=5;const copy=game.getProgress();copy.completedRounds=5;
  assert.deepEqual(game.getProgress(),{version:2,ladderIndex:0,completedRounds:2,completedLadders:0});
  assert.equal(game.roundIndex,2);assert.equal(game.complete,false);
});

test('construction emits one coherent reset and start uses the current rival while keeping park mechanics',()=>{
  const events=[],game=new TournamentGame(event=>events.push(event),{version:1,completedRounds:1});
  assert.deepEqual(events,[{type:'reset',tournament:true,roundIndex:1}]);
  assert.equal(game.phase,'ready');assert.equal(game.time,90);
  assert.equal(game.mode,'park');assert.equal(game.rulesId,'surf');assert.equal(game.isTournament,true);
  assert.equal(game.roundNumber,2);assert.equal(game.rival.name,'RIVET');assert.equal(game.target,3500);
  assert.match(game.objectiveText,/HEAT 2\/5.*RIVET.*3,500/);
  assert.equal(game.start(),true);assert.equal(game.z,PARK_STARTS.west.z);assert.equal(game.x,PARK_STARTS.west.x);
  const plain=new WaveParkGame();plain.start('west');
  advance(game,1,{jump:true,left:true});advance(plain,1,{jump:true,left:true});
  for(const key of['x','y','z','heading','speed','vx','vz','charge','score','airborne'])assert.equal(game[key],plain[key],key);
  assert.ok(Math.abs(plain.time-game.time-30)<1e-8);
});

test('rival scores follow fixed monotonic banks independent of player points and inputs',()=>{
  for(let round=0;round<5;round++) {
    let previous=0;
    for(let elapsed=0;elapsed<=90;elapsed+=.25) {
      const score=rivalScoreAt(round,elapsed);
      assert.ok(Number.isInteger(score)&&score>=previous&&score<=TOURNAMENT_RIVALS[round].target);
      previous=score;
    }
    assert.equal(rivalScoreAt(round,90),TOURNAMENT_RIVALS[round].target);
    assert.equal(rivalScoreAt(round,900),TOURNAMENT_RIVALS[round].target);
    assert.equal(rivalScoreAt(round,-1),0);
  }
  const first=fixture().game,second=fixture().game;
  bankPoints(second,500000);
  for(const game of[first,second])game.elapsed=38;
  first.update(.05,{left:true});second.update(.05,{right:true,pump:true});
  assert.equal(first.rivalScore,second.rivalScore);
  assert.equal(first.rivalScore,rivalScoreAt(0,first.elapsed));
});

test('only a strict banked-score lead wins; ties and lower scores retry the same rival',()=>{
  for(const difference of[-1,0,1]) {
    const {game,events}=fixture();bankPoints(game,game.target+difference);buzzer(game);
    assert.equal(game.result,difference>0?'win':'loss');assert.equal(game.phase,'finished');
    assert.equal(game.roundIndex,0);assert.equal(game.rivalScore,game.target);
    assert.equal(game.getProgress().completedRounds,difference>0?1:0);
    if(difference===0)assert.match(game.resultReason,/TIE/);
    const finish=events.filter(event=>event.type==='finish');assert.equal(finish.length,1);
    assert.equal(finish[0].result,game.result);assert.equal(finish[0].score,game.score);
    assert.equal(finish[0].tournament,true);assert.equal(finish[0].roundNumber,1);
    if(difference<=0)assert.equal(game.nextRound(),false);
    assert.equal(game.retry(),true);assert.equal(game.phase,'running');assert.equal(game.roundIndex,0);
    assert.equal(game.score,0);assert.equal(game.time,90);assert.equal(game.rivalScore,0);assert.equal(game.result,null);
  }
});

test('a grounded clean combo banks at the buzzer before the result is emitted',()=>{
  const {game,events}=fixture();game.addCombo('LANDED COMBO',game.target+1);
  assert.equal(game.score,0);buzzer(game);
  assert.equal(game.result,'win');assert.equal(game.comboBase,0);assert.equal(game.score,1801);
  const bank=events.findIndex(event=>event.type==='bank'),finish=events.findIndex(event=>event.type==='finish');
  assert.ok(bank>=0&&finish>bank);assert.equal(events[finish].score,events[bank].points);
});

test('an airborne combo at the buzzer cannot win, bank afterward or complete an unfinished trick',()=>{
  const {game,events}=fixture();bankPoints(game,game.target-1);
  assert.equal(game.jump(),true);game.addCombo('UNLANDED COMBO',50000,true);
  assert.equal(game.doTrick('flip'),true);buzzer(game);
  assert.equal(game.result,'loss');assert.equal(game.score,1799);assert.equal(game.comboBase,0);
  assert.equal(game.pendingTricks,0);assert.equal(game.trick,null);assert.equal(game.bank(),false);
  assert.equal(events.filter(event=>event.type==='trick').length,0);
  assert.equal(events.filter(event=>event.type==='finish').length,1);
});

test('attached, bailing or cutting-back riders discard pending points at the buzzer',()=>{
  for(const state of['grinding','pipeRide','lipMove','bailTime','cutbackActive']) {
    const {game}=fixture();game.addCombo('STILL IN PROGRESS',game.target+100);
    // This unit checks the finish boundary, not the attachment's movement solver.
    game[state]=state==='bailTime'?1:state==='cutbackActive'?true:{};
    assert.equal(game.finish(),true);assert.equal(game.result,'loss');
    assert.equal(game.score,0);assert.equal(game.comboBase,0);assert.equal(game.bank(),false);
    game.restart();assert.equal(game.grinding,null);assert.equal(game.pipeRide,null);assert.equal(game.lipMove,null);
    assert.equal(game.bailTime,0);assert.equal(game.cutbackActive,false);
  }
});

test('pause freezes the heat and rival clock, while the final partial step finishes exactly once',()=>{
  const {game,events}=fixture();advance(game,1,{brake:true});game.pause();
  const before=[game.x,game.z,game.elapsed,game.time,game.rivalScore];advance(game,2,{pump:true});
  assert.deepEqual([game.x,game.z,game.elapsed,game.time,game.rivalScore],before);
  game.resume();buzzer(game);
  assert.equal(game.elapsed,90);assert.equal(game.time,0);assert.equal(game.rivalScore,1800);
  const position=[game.x,game.y,game.z];advance(game,2,{pump:true});
  assert.equal(game.finish(),false);assert.deepEqual([game.x,game.y,game.z],position);
  assert.equal(events.filter(event=>event.type==='finish').length,1);
});

test('five wins advance only on request, preserve progress, and end in a championship',()=>{
  const {game,events}=fixture();assert.equal(game.nextRound(),false);
  for(let round=0;round<5;round++) {
    assert.equal(game.roundIndex,round);assert.equal(game.score,0);assert.equal(game.complete,false);
    bankPoints(game,game.target+1);buzzer(game);
    assert.equal(game.roundIndex,round,'winning does not skip the result screen');
    assert.equal(game.getProgress().completedRounds,round+1);assert.equal(game.result,'win');
    if(round<4) {
      assert.equal(game.nextRound(),true);assert.equal(game.phase,'running');
      assert.equal(game.elapsed,0);assert.equal(game.time,90);assert.equal(game.result,null);
      assert.equal(game.x,PARK_STARTS[game.rival.startId].x);assert.equal(game.z,PARK_STARTS[game.rival.startId].z);
    }
  }
  assert.equal(game.complete,true);assert.equal(game.resultReason,'CHAMPION');assert.equal(game.nextRound(),false);
  assert.equal(events.filter(event=>event.type==='finish').length,5);
  const restored=new TournamentGame(()=>{},game.getProgress());
  assert.equal(restored.complete,true);assert.equal(restored.roundIndex,4);assert.equal(restored.phase,'ready');
  const fresh=new TournamentGame(()=>{},sanitizeTournamentProgress(null));
  assert.equal(fresh.complete,false);assert.equal(fresh.roundIndex,0);
});

test('a real legal halfpipe sequence earns enough banked points to beat the opening rival',()=>{
  const {game}=fixture();
  while(!game.airborne&&game.elapsed<5)game.update(1/120,{pump:true});
  assert.equal(game.airborne,true);assert.equal(game.doTrick('spin'),true);
  while(game.trick&&game.airborne)game.update(1/120,{pump:true});
  assert.equal(game.doTrick('grab'),true);
  while(game.airborne&&game.elapsed<8)game.update(1/120,{pump:true});
  assert.equal(game.wipeouts,0);assert.equal(game.airborne,false);assert.equal(game.bank(),true);
  assert.equal(game.landedTricks,2);assert.ok(game.score>game.target);
  assert.equal(game.phase,'running','beating the target early still leaves the full heat to ride');
  assert.equal(game.result,null);
});

test('a full unshortened heat expires at ninety seconds at30 and120Hz without continuing to120',()=>{
  const games=[];
  for(const hz of[30,120]) {
    const {game,events}=fixture();game.start('basin');
    advance(game,90.1,{brake:true},hz);
    assert.equal(game.phase,'finished');assert.equal(game.elapsed,90);assert.equal(game.time,0);
    assert.equal(events.filter(event=>event.type==='finish').length,1);
    assert.equal(game.rivalScore,game.target);games.push(game);
  }
  for(const key of['x','y','z','vx','vz','heading','score','wipeouts'])assert.ok(Math.abs(games[0][key]-games[1][key])<1e-8,key);
  assert.equal(games[0].result,games[1].result);
});
