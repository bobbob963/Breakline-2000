import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame,POP_COOLDOWN,waveHeight } from '../src/game.js';
import { WaveParkGame,parkRideSurface,parkHeight } from '../src/park.js';
import { createTournamentGame } from '../src/tournament.js';
import { surfRaceTrickInput } from '../src/surf-race.js';
import { parkRaceTrickInput,parkRaceOpponentInput } from '../src/park-race.js';
import { RACE_POP_RECOVERY } from '../src/race-rider.js';

function fixture(rank=0){
  const events=[],game=createTournamentGame(event=>events.push(event),{version:1,completedRounds:rank});
  game.start();advance(game,3);return {game,events};
}
function advance(game,seconds,input={},hz=120){
  for(let frame=0;frame<Math.round(seconds*hz);frame++)game.update(1/hz,typeof input==='function'?input(game):input);
}
function until(game,done,input={},limit=100,hz=120){
  for(let frame=0;frame<limit*hz&&!done()&&game.phase==='running';frame++)game.update(1/hz,typeof input==='function'?input(game):input);
  assert.ok(done(),'condition reached using the real simulation');
}
const boostedLine=rider=>(rider.mode==='park'?parkRaceTrickInput:surfRaceTrickInput)(rider,rider.course,1);

test('every rival performs and lands real combos, earns the shared reward and clears every ring at 30/60/120Hz',()=>{
  for(let rank=0;rank<5;rank++){
    const times=[];
    for(const hz of [30,60,120]){
      const {game,events}=fixture(rank);
      assert.equal(game.opponent.opponent,undefined,'a rival has no nested race controller');
      until(game,()=>game.phase==='finished',{brake:true},100,hz);
      assert.equal(game.result,'loss');assert.equal(game.opponent.raceMisses,0);assert.equal(game.opponent.wipeouts,0);
      assert.equal(game.opponent.nextCheckpoint,game.course.checkpoints.length);
      const opponentEvents=events.filter(event=>event.opponent);
      assert.ok(opponentEvents.some(event=>event.type==='trickStart'&&event.trick==='grab'));
      assert.ok(opponentEvents.filter(event=>event.type==='raceBoost'&&event.combo).length>=2);
      let landed=false,completed=0;
      for(const event of opponentEvents){
        if(event.type==='jump'){landed=false;completed=0;}
        if(event.type==='trick')completed++;
        if(event.type==='land')landed=true;
        if(event.type==='raceBoost'){
          assert.ok(landed&&completed>0,'no opponent reward before actual trick completion and clean landing');
          assert.equal(event.speed,9);assert.equal(event.duration,2.6);
          landed=false;
        }
      }
      assert.equal(game.opponent.boostTime,0,'finish clears opponent boost');
      assert.equal(game.opponent.trick,null);times.push(game.opponentFinishTime);
    }
    assert.ok(Math.max(...times)-Math.min(...times)<1e-7,'the fixed policy has no rendering-rate advantage');
  }
});

test('short charged pops can land a basic grab or a two-trick combo on either race surface',()=>{
  for(const rank of [0,1])for(const tricks of [['grab'],['spin','grab']]){
    const {game,events}=fixture(rank);
    advance(game,.35,{jump:true});assert.equal(game.jump(),true);
    assert.equal(game.popCooldown,RACE_POP_RECOVERY);
    for(const trick of tricks){
      assert.equal(game.doTrick(trick),true);
      until(game,()=>!game.trick,{},3);
    }
    until(game,()=>!game.airborne,{},3);
    assert.equal(game.wipeouts,0);
    const rewards=events.filter(event=>event.type==='raceBoost'&&!event.opponent);
    assert.equal(rewards.length,1);assert.equal(rewards[0].tricks,tricks.length);
    assert.equal(game.boostSpeed,tricks.length===1?6:9);assert.equal(game.boostDuration,tricks.length===1?2:2.6);
    until(game,()=>game.popReady,{},1.1);assert.equal(game.bank(),true);assert.equal(game.bank(),false);
    assert.equal(events.filter(event=>event.type==='raceBoost'&&!event.opponent).length,1,'banking never re-awards boost');
  }
  const normal=new SurfGame();normal.start();normal.jump();
  assert.equal(normal.airLaunchSource,'flat');assert.equal(normal.doTrick('spin'),false);assert.equal(normal.popCooldown,POP_COOLDOWN);
  const park=new WaveParkGame();park.start();park.jump();assert.equal(park.popCooldown,POP_COOLDOWN);
});

test('Moxie stays approachable and a legal boosted line can beat all five roster rivals',()=>{
  const easy=fixture(0);until(easy.game,()=>easy.game.phase==='finished',rider=>parkRaceOpponentInput(rider,rider.course,1));
  assert.equal(easy.game.result,'win','first rank is still beatable by clean pumping without perfect combos');
  for(let rank=0;rank<5;rank++){
    const {game,events}=fixture(rank);until(game,()=>game.phase==='finished',boostedLine);
    assert.equal(game.result,'win');assert.equal(game.raceMisses,0);assert.equal(game.wipeouts,0);
    assert.ok(events.some(event=>event.type==='raceBoost'&&!event.opponent&&event.combo));
    assert.equal(game.nextCheckpoint,game.course.checkpoints.length);
  }
});

test('rival boost freezes with pause and cancels on bail, retry and finish',()=>{
  for(const rank of [0,1]){
    const {game}=fixture(rank);
    until(game,()=>game.opponent.boostTime>0,{brake:true});
    const rival=game.opponent,before=[rival.boostTime,rival.speed,rival.x,rival.distance,rival.elapsed];
    game.pause();advance(game,3);assert.deepEqual([rival.boostTime,rival.speed,rival.x,rival.distance,rival.elapsed],before);
    game.resume();rival.bail();assert.equal(rival.boostTime,0);assert.equal(rival.boostSpeed,0);
    game.retry();assert.equal(game.opponent.boostTime,0);assert.equal(game.opponent.nextCheckpoint,0);
    advance(game,3);until(game,()=>game.opponent.boostTime>0,{brake:true});
    game.finish('loss');assert.equal(game.opponent.boostTime,0);assert.equal(game.opponent.boostLabel,'');
  }
});

test('an opponent that misses a mandatory ring loses its earned boost under the same gate checks',()=>{
  for(const rank of [0,1]){
    const {game}=fixture(rank);until(game,()=>game.opponent.boostTime>0,{brake:true});
    const rival=game.opponent,gate=game.course.checkpoints[rival.nextCheckpoint];
    if(game.mode==='surf'){
      rival.distance=gate.distance-.01;rival.x=gate.x+gate.radius+1;rival.vx=0;
      rival.y=waveHeight(rival.x,-rival.distance,rival.elapsed);
    }else{
      const n={x:-Math.sin(gate.rotation),z:-Math.cos(gate.rotation)};
      rival.x=gate.x-n.x*.01-n.z*(gate.radius+1);rival.z=gate.z-n.z*.01+n.x*(gate.radius+1);
      rival.heading=gate.rotation;rival.vx=n.x*20;rival.vz=n.z*20;rival.speed=20;
      rival.y=parkHeight(rival.x,rival.z);rival.surface=parkRideSurface(rival.x,rival.z,rival.y);
    }
    const required=rival.nextCheckpoint;game.update(1/120,{brake:true});
    assert.equal(rival.raceMisses,1);assert.equal(rival.nextCheckpoint,required);
    assert.equal(rival.boostTime,0);assert.equal(rival.boostSpeed,0);
  }
});
