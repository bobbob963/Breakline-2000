import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame } from '../src/game.js';
import { WaveParkGame, PARK_PIPES, PARK_RAILS } from '../src/park.js';
import { createTournamentGame } from '../src/tournament.js';
import { createTimeTrialGame } from '../src/time-trials.js';
import { createKeydownHandler } from '../src/keyboard.js';
import { TimePower } from '../src/time-power.js';

const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} should equal ${expected}`);
function fixture(create=onEvent=>new SurfGame(onEvent)) {
  const events=[],game=create(event=>events.push(event));game.setRewardBoard('deadtime');game.start();
  return {game,events};
}
function exhaust(game) {assert.equal(game.toggleTimePower(),true);near(game.updateTimePower(6),2.4);}

test('the hidden board gates Q, consumes six real seconds and gives exactly one full-use speed burst',()=>{
  const {game,events}=fixture();assert.equal(game.timePowerEnabled,true);
  assert.equal(game.toggleTimePower(),true);assert.equal(game.timeScale,.4);
  near(game.updateTimePower(5.75),2.3);near(game.timePowerCharge,.25);assert.equal(game.timePowerBurstTime,0);
  near(game.updateTimePower(.25),.1);assert.equal(game.timePowerActive,false);assert.equal(game.timeScale,1);
  assert.equal(game.timePowerBurstTime,3);assert.equal(game.timePowerSpeedMultiplier,1.5);assert.equal(game.timePowerCooldown,12);
  assert.equal(game.toggleTimePower(),false);
  near(game.updateTimePower(2.99),2.99);near(game.timePowerBurstTime,.01);
  game.updateTimePower(.01);assert.equal(game.timePowerSpeedMultiplier,1);
  game.updateTimePower(9);assert.equal(game.timePowerCharge,6);assert.equal(game.timePowerCooldown,0);
  assert.equal(events.filter(event=>event.type==='timePowerBurst').length,1);
  assert.equal(events.filter(event=>event.type==='timePowerReady').length,1);
});

test('early toggles retain remaining charge without granting, resetting or stacking speed boosts',()=>{
  const {game,events}=fixture();game.toggleTimePower();game.updateTimePower(2);
  assert.equal(game.toggleTimePower(),true);assert.equal(game.timePowerCharge,4);assert.equal(game.timePowerSpeedMultiplier,1);
  game.updateTimePower(50);assert.equal(game.timePowerCharge,4);
  game.toggleTimePower();game.updateTimePower(4);
  for(let i=0;i<20;i++)assert.equal(game.toggleTimePower(),false);
  assert.equal(game.timePowerSpeedMultiplier,1.5);assert.equal(game.timePowerBurstTime,3);
  assert.equal(events.filter(event=>event.type==='timePowerBurst').length,1);
});

test('pausing freezes active charge, recovery and speed burst instead of consuming real wall time',()=>{
  const {game}=fixture();game.toggleTimePower();game.updateTimePower(2);game.pause();
  game.updateTimePower(100);assert.equal(game.timePowerCharge,4);assert.equal(game.toggleTimePower(),false);
  game.resume();game.updateTimePower(4);game.pause();game.updateTimePower(100);
  assert.equal(game.timePowerBurstTime,3);assert.equal(game.timePowerCooldown,12);
  game.resume();game.updateTimePower(1);assert.equal(game.timePowerBurstTime,2);assert.equal(game.timePowerCooldown,11);
});

test('frame crossings integrate slow and ordinary time exactly and do not extend the three second burst',()=>{
  const totals=[];
  for(const frames of [[7],[6,1],[5.99,.51,.5],Array.from({length:420},()=>1/60)]) {
    const power=new TimePower(),state={playing:true,equipped:true};power.toggle(true);
    const simulated=frames.reduce((sum,dt)=>sum+power.update(dt,state),0);
    near(simulated,3.4);near(power.burst,2);near(power.cooldown,11);totals.push(simulated);
  }
  assert.ok(totals.every(total=>Math.abs(total-totals[0])<1e-8));
  const power=new TimePower();power.toggle(true);power.update(19,{playing:true,equipped:true});
  assert.equal(power.active,false);assert.equal(power.charge,6);assert.equal(power.burst,0);assert.equal(power.cooldown,0);
});

test('wipeout and unequip retract the effect, preserve spent charge and cannot farm a refill',()=>{
  const {game}=fixture();game.toggleTimePower();game.updateTimePower(2);game.bail();
  assert.equal(game.timePowerActive,false);assert.equal(game.timePowerCharge,4);assert.equal(game.toggleTimePower(),false);
  game.bailTime=0;game.toggleTimePower();game.updateTimePower(1);game.setRewardBoard('guitar');
  assert.equal(game.timePowerActive,false);assert.equal(game.timePowerSpeedMultiplier,1);assert.equal(game.timePowerCharge,3);
  game.setRewardBoard('deadtime');assert.equal(game.timePowerCharge,3);game.toggleTimePower();game.updateTimePower(3);
  game.setRewardBoard(null);assert.equal(game.timePowerBurstTime,0);assert.equal(game.timePowerCooldown,12);
  game.setRewardBoard('deadtime');assert.equal(game.toggleTimePower(),false);assert.equal(game.timePowerCharge,0);
});

test('restart and finish clean the visual state without awarding an unused speed burst',()=>{
  for(const create of [on=>new SurfGame(on),on=>new WaveParkGame(on),on=>createTournamentGame(on),on=>createTimeTrialGame(on)]) {
    const {game,events}=fixture(create);game.countdownRemaining=0;game.toggleTimePower();game.updateTimePower(1);
    game.finish('loss');assert.equal(game.timePowerActive,false);assert.equal(game.timePowerBurstTime,0);assert.equal(game.timeScale,1);
    game.updateTimePower(10);assert.equal(events.filter(event=>event.type==='timePowerBurst').length,0);
    game.start();assert.equal(game.timePowerActive,false);assert.equal(game.timePowerCharge,6);assert.equal(game.timePowerCooldown,0);
  }
});

test('a physics wipeout or session finish interrupts a running charge without completing it',()=>{
  for(const outcome of ['wipeout','finish']) {
    const {game,events}=fixture();game.toggleTimePower();game.updateTimePower(1);
    if(outcome==='wipeout')game.x=17;
    else game.time=.001;
    game.update(game.updateTimePower(1/60),outcome==='wipeout'?{right:true}:{});
    assert.equal(game.timePowerActive,false,outcome);assert.equal(game.timePowerBurstTime,0,outcome);
    if(outcome==='wipeout')assert.equal(game.wipeouts,1);else assert.equal(game.phase,'finished');
    game.updateTimePower(6);
    assert.ok(game.timePowerCharge>4.9);assert.equal(events.filter(event=>event.type==='timePowerBurst').length,0,outcome);
  }
});

test('countdown continues at normal speed but cannot activate or recharge power',()=>{
  const {game}=fixture(on=>createTournamentGame(on));assert.equal(game.countdownRemaining,3);
  assert.equal(game.toggleTimePower(),false);near(game.updateTimePower(.05),.05);
  game.update(game.updateTimePower(.05),{});near(game.countdownRemaining,2.95);
  assert.equal(game.timePowerCharge,6);assert.equal(game.timePowerActive,false);
});

test('split clocks keep the player responsive while the rival and course clock slow down',()=>{
  const {game}=fixture(on=>createTournamentGame(on,{completedRounds:1}));game.countdownRemaining=0;
  game.toggleTimePower();
  for(let frame=0;frame<120;frame++){
    const worldDt=game.updateTimePower(1/60);
    game.update(game.timePowerPlayerDelta,{pump:true},worldDt);
  }
  near(game.elapsed,.8);near(game.opponent.elapsed,.8);near(game.timePowerCharge,4);
  near(game.playerElapsed,2);near(game.opponent.playerElapsed,.8);
  assert.equal(game.opponent.timePowerActive,false);assert.equal(game.opponent.timeScale,1);
});

test('custom slow duration survives resets and recharge while fast-forward keeps six seconds',()=>{
  const {game}=fixture();game.setAdminStats({active:false,cheats:{timePowerDuration:15}});
  assert.equal(game.timePowerDuration,15);assert.equal(game.timePowerCapacity,15);near(game.timePowerCharge,15);
  game.toggleTimePower();near(game.updateTimePower(5),2);near(game.timePowerPlayerDelta,5);near(game.timePowerCharge,10);
  game.fastForwardTimePower();assert.equal(game.timePowerCapacity,6);near(game.timePowerCharge,4);
  near(game.updateTimePower(1),2);near(game.timePowerPlayerDelta,2);
  game.toggleTimePower();game.toggleTimePower();near(game.timePowerCharge,7.5);
  near(game.updateTimePower(7.5),3);assert.equal(game.timePowerActive,false);near(game.timePowerBurstTime,3);
  game.updateTimePower(12);near(game.timePowerCharge,15);
  game.start();near(game.timePowerCharge,15);assert.equal(game.timePowerDuration,15);
});

test('editing duration preserves charge fraction and cannot bypass recharge or refill with repeated switches',()=>{
  const p=new TimePower(),state={playing:true,equipped:true};
  p.toggle(true);p.update(3,state);p.setDuration(20);near(p.charge,10);
  p.setDuration(10);near(p.charge,5);p.fastForward(true);near(p.charge,3);
  p.setDuration(60);near(p.charge,3);p.toggle(true);p.toggle(true);near(p.charge,30);
  p.update(30,state);assert.equal(p.cooldown,12);p.setDuration(1);assert.equal(p.charge,0);
  assert.equal(p.toggle(true),false);p.update(12,state);near(p.charge,1);
  for(const [input,expected] of [[0,1],[70,60],[12.34,12.3],[NaN,6],[Infinity,6],['10',6]]){
    p.setDuration(input);assert.equal(p.duration,expected);
  }
});

test('player clock integrates normal slow motion and scaled fast-forward exactly across expiry',()=>{
  for(const mode of ['slow','fast'])for(const fps of [30,60,144]){
    const p=new TimePower(),state={playing:true,equipped:true};p.setDuration(1.3);
    mode==='slow'?p.toggle(true):p.fastForward(true);
    let world=0,player=0;
    for(let i=0;i<fps*7;i++){world+=p.update(1/fps,state);player+=p.lastPlayerDelta;}
    near(world,mode==='slow'?7-1.3*.6:13);near(player,mode==='slow'?7:13);
  }
  const p=new TimePower();p.toggle(true);p.update(1,{playing:true,equipped:true});
  for(const invalid of [NaN,Infinity,-1,0]){assert.equal(p.update(invalid,{playing:true,equipped:true}),0);assert.equal(p.lastPlayerDelta,0);}
});

test('the independent admin cheat works on a standard board with custom stats disabled',()=>{
  const game=new SurfGame();game.start();assert.equal(game.toggleTimePower(),false);
  game.setAdminStats({active:false,cheats:{slowMotion:true}});assert.equal(game.timePowerEnabled,true);
  game.toggleTimePower();game.updateTimePower(1);game.setAdminStats({active:false,cheats:{slowMotion:false}});
  assert.equal(game.timePowerActive,false);assert.equal(game.timePowerCharge,5);assert.equal(game.toggleTimePower(),false);
  game.setAdminStats({active:false,cheats:{slowMotion:true}});assert.equal(game.timePowerCharge,5);
});

test('Q routes once per press and stays inert in forms, menus, repeat, countdown and paused states',()=>{
  for(const blocked of ['none','form','repeat','home','modal','workshop','admin','boot','paused','countdown','bail']) {
    const {game}=fixture();
    const state={bootReady:true,game,input:{},homeScreen:false,modalMode:null,workshopMode:null,adminOpen:false};
    if(blocked==='home')state.homeScreen=true;
    if(blocked==='modal')state.modalMode='help';
    if(blocked==='workshop')state.workshopMode='board';
    if(blocked==='admin')state.adminOpen=true;
    if(blocked==='boot')state.bootReady=false;
    if(blocked==='paused')game.pause();
    if(blocked==='countdown')game.countdownRemaining=1;
    if(blocked==='bail')game.bail();
    const handler=createKeydownHandler(()=>state,{});
    handler({code:'KeyQ',repeat:blocked==='repeat',target:{closest:selector=>blocked==='form'&&selector.includes('input')?{}:null},preventDefault(){}});
    assert.equal(game.timePowerActive,blocked==='none',blocked);
  }
});

test('all ocean, Waterworks, rival and trial speed targets gain exactly 50 percent and rivals have no power of their own',()=>{
  const creators=[on=>new SurfGame(on),on=>new SurfGame(on,'storm'),on=>new SurfGame(on,'rush'),on=>new WaveParkGame(on),
    on=>createTournamentGame(on,{completedRounds:0}),on=>createTournamentGame(on,{completedRounds:1}),
    on=>createTimeTrialGame(on),on=>createTimeTrialGame(on,{completedTrials:5,selectedTrial:5})];
  for(const create of creators) {
    const normal=fixture(create).game,boosted=fixture(create).game;
    normal.countdownRemaining=boosted.countdownRemaining=0;exhaust(boosted);
    // Start both with zero longitudinal velocity. The first acceleration step
    // reveals the actual physics target before any terrain or obstacle contact.
    normal.speed=boosted.speed=0;
    normal.update(1/120,{pump:true});boosted.update(1/120,{pump:true});
    near(boosted.speed,normal.speed*1.5,1e-6);
    if(boosted.opponent){assert.equal(boosted.opponent.timePowerEnabled,false);assert.equal(boosted.opponent.timePowerSpeedMultiplier,1);}
  }
});

test('Waterworks pipe and rail travel receives the burst while brake speed remains controllable',()=>{
  for(const path of ['pipe','rail']) {
    const games=[fixture(on=>new WaveParkGame(on)).game,fixture(on=>new WaveParkGame(on)).game];exhaust(games[1]);
    for(const game of games) {
      game.speed=0;
      if(path==='pipe') {
        game.pipeRide={pipe:PARK_PIPES[0],angle:.5,local:0,dir:1,age:0,cycleStart:0,releasePending:false};
        game.updatePipeRide(1/120,{pump:true,action:true});
      } else {game.catchRail(PARK_RAILS[0],0,1);game.updateRail(1/120,{pump:true,grind:true});}
    }
    near(games[1].speed,games[0].speed*1.5);
  }
  for(const create of [on=>new SurfGame(on),on=>new WaveParkGame(on)]) {
    const normal=fixture(create).game,boosted=fixture(create).game;exhaust(boosted);normal.speed=boosted.speed=0;
    normal.update(1/120,{brake:true});boosted.update(1/120,{brake:true});near(boosted.speed,normal.speed);
  }
});

test('invalid real deltas never corrupt the charge or emit a spurious burst',()=>{
  const {game,events}=fixture();game.toggleTimePower();
  for(const dt of [NaN,Infinity,-1,0])assert.equal(game.updateTimePower(dt),0);
  assert.equal(game.timePowerCharge,6);assert.equal(game.timePowerBurstTime,0);
  assert.equal(events.filter(event=>event.type==='timePowerBurst').length,0);
});

test('fast forward runs the whole clock at twice speed for six real seconds then grants one burst',()=>{
  const {game,events}=fixture();
  assert.equal(game.fastForwardTimePower(),true);assert.equal(game.timePowerMode,'fast');assert.equal(game.timeScale,2);
  near(game.updateTimePower(5.75),11.5);near(game.timePowerCharge,.25);assert.equal(game.timePowerBurstTime,0);
  near(game.updateTimePower(.25),.5);assert.equal(game.timePowerActive,false);assert.equal(game.timeScale,1);
  assert.equal(game.timePowerBurstTime,3);assert.equal(game.timePowerSpeedMultiplier,1.5);assert.equal(game.timePowerCooldown,12);
  assert.equal(game.fastForwardTimePower(),false);assert.equal(game.toggleTimePower(),false);
  game.updateTimePower(3);assert.equal(game.timePowerSpeedMultiplier,1);
  game.updateTimePower(9);assert.equal(game.timePowerCharge,6);assert.equal(game.timePowerCooldown,0);
  const activation=events.find(event=>event.type==='timePower'&&event.active);
  assert.equal(activation.mode,'fast');assert.equal(activation.timeScale,2);assert.equal(activation.charge,6);
  const ending=events.find(event=>event.type==='timePower'&&!event.active);
  assert.equal(ending.mode,'fast');assert.equal(ending.timeScale,1);assert.equal(ending.reason,'spent');
  assert.equal(events.filter(event=>event.type==='timePowerBurst').length,1);
});

test('slow and fast share remaining charge and repeated fast-forward presses cannot refill or extend it',()=>{
  const {game,events}=fixture();game.toggleTimePower();near(game.updateTimePower(2),.8);
  assert.equal(game.fastForwardTimePower(),true);assert.equal(game.timeScale,2);assert.equal(game.timePowerCharge,4);
  for(let i=0;i<20;i++)assert.equal(game.fastForwardTimePower(),false);
  assert.equal(game.timePowerCharge,4);near(game.updateTimePower(1),2);
  assert.equal(game.toggleTimePower(),true);assert.equal(game.timeScale,1);assert.equal(game.timePowerCharge,3);
  game.updateTimePower(100);assert.equal(game.timePowerCharge,3);
  assert.equal(game.toggleTimePower(),true);assert.equal(game.timePowerMode,'slow');assert.equal(game.timeScale,.4);
  near(game.updateTimePower(1),.4);assert.equal(game.fastForwardTimePower(),true);
  near(game.updateTimePower(2),4);assert.equal(game.timePowerBurstTime,3);
  assert.equal(events.filter(event=>event.type==='timePowerBurst').length,1);
  const switches=events.filter(event=>event.type==='timePower'&&event.reason==='switch');
  assert.equal(switches.length,2);assert.ok(switches.every(event=>event.mode==='fast'&&event.timeScale===2));
});

test('fast forward pauses without spending charge, advancing cooldown or allowing another activation',()=>{
  const {game}=fixture();game.fastForwardTimePower();game.updateTimePower(2);game.pause();
  game.updateTimePower(100);assert.equal(game.timePowerCharge,4);assert.equal(game.timePowerMode,'fast');
  assert.equal(game.fastForwardTimePower(),false);assert.equal(game.toggleTimePower(),false);
  game.resume();near(game.updateTimePower(4),8);game.pause();game.updateTimePower(100);
  assert.equal(game.timePowerBurstTime,3);assert.equal(game.timePowerCooldown,12);
  game.resume();game.updateTimePower(1);assert.equal(game.timePowerBurstTime,2);assert.equal(game.timePowerCooldown,11);
});

test('fast-forward expiry integrates identically at 30, 60, 144 fps and across a long frame',()=>{
  const framesets=[[7],[6,1],[5.99,.51,.5],...[30,60,144].map(fps=>Array.from({length:fps*7},()=>1/fps))];
  for(const frames of framesets){
    const power=new TimePower(),state={playing:true,equipped:true};power.fastForward(true);
    const simulated=frames.reduce((sum,dt)=>sum+power.update(dt,state),0);
    near(simulated,13);near(power.burst,2);near(power.cooldown,11);assert.equal(power.active,false);
  }
});

test('every venue advances gameplay, race opponents and course clocks together in fast forward',()=>{
  const creators=[on=>new SurfGame(on),on=>new SurfGame(on,'storm'),on=>new SurfGame(on,'rush'),on=>new WaveParkGame(on),
    on=>createTournamentGame(on,{completedRounds:0}),on=>createTournamentGame(on,{completedRounds:1}),
    on=>createTimeTrialGame(on),on=>createTimeTrialGame(on,{completedTrials:5,selectedTrial:5})];
  for(const create of creators){
    const {game}=fixture(create);game.countdownRemaining=0;assert.equal(game.fastForwardTimePower(),true);
    // Use bounded simulation steps: the ordinary physics frame cap must never
    // discard a fast-forward slice when the real frame was already near it.
    for(let frame=0;frame<15;frame++){
      let simulation=game.updateTimePower(1/60);
      while(simulation>1e-10){const dt=Math.min(1/120,simulation);game.update(dt,{pump:true});simulation-=dt;}
    }
    near(game.elapsed,.5);near(game.timePowerCharge,5.75);assert.equal(game.timePowerActive,true);
    if(game.opponent){near(game.opponent.elapsed,.5);assert.equal(game.opponent.timePowerEnabled,false);assert.equal(game.opponent.timeScale,1);}
  }
});

test('fast forward respects board and admin eligibility, countdown, cancellation and restart',()=>{
  const game=new SurfGame();game.start();assert.equal(game.fastForwardTimePower(),false);
  game.setAdminStats({active:false,cheats:{slowMotion:true}});assert.equal(game.fastForwardTimePower(),true);
  game.updateTimePower(1);game.setAdminStats({active:false,cheats:{slowMotion:false}});
  assert.equal(game.timePowerActive,false);assert.equal(game.timePowerCharge,5);assert.equal(game.fastForwardTimePower(),false);
  for(const outcome of ['bail','unequip','finish']){
    const {game:active,events}=fixture();active.fastForwardTimePower();active.updateTimePower(2);
    if(outcome==='bail')active.bail();else if(outcome==='unequip')active.setRewardBoard('guitar');else active.finish();
    assert.equal(active.timePowerActive,false);assert.equal(active.timeScale,1);assert.equal(active.timePowerBurstTime,0);
    assert.equal(active.timePowerCharge,4);assert.equal(events.filter(event=>event.type==='timePowerBurst').length,0);
    active.start();assert.equal(active.timePowerCharge,6);assert.equal(active.timePowerMode,'slow');assert.equal(active.timePowerActive,false);
  }
  const {game:race}=fixture(on=>createTournamentGame(on));
  assert.equal(race.fastForwardTimePower(),false);near(race.updateTimePower(.05),.05);assert.equal(race.timePowerCharge,6);
});

test('lifecycle revisions invalidate a delayed tap across restart, activation and cancellation',()=>{
  const {game}=fixture();let revision=game.timePowerRevision;
  const changed=()=>{assert.ok(game.timePowerRevision>revision);revision=game.timePowerRevision;};
  game.start();changed();assert.equal(game.elapsed,0);
  game.fastForwardTimePower();changed();
  game.fastForwardTimePower();assert.equal(game.timePowerRevision,revision);
  game.toggleTimePower();changed();
  game.bail();changed();
  game.setRewardBoard('guitar');changed();
});
