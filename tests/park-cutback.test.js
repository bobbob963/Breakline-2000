import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveParkGame, PARK_RAMPS, PARK_BOUNDS, parkHeight, parkLocal } from '../src/park.js';

function fixture(start='basin') {
  const events=[],game=new WaveParkGame(event=>events.push(event));game.start(start);
  return {game,events};
}
function advance(game,seconds,input={},hz=120) {
  for(let i=0;i<Math.round(seconds*hz);i++)game.update(1/hz,input);
}
const starts=events=>events.filter(event=>event.type==='cutbackStart');
const progress=(ramp,game)=>parkLocal(ramp,game.x,game.z).v/ramp.length+.5;

test('Shift and either turn key start a physical sharp carve in either key order',()=>{
  for(const side of['left','right'])for(const first of['shift','turn']) {
    const {game,events}=fixture(),normal=new WaveParkGame();normal.start();
    const turn={[side]:true};
    advance(game,.1,first==='shift'?{grind:true}:turn);
    assert.equal(game.cutbackActive,false);
    const heading=game.heading;
    advance(game,.725,{grind:true,...turn});advance(normal,.725,turn);
    const change=game.heading-heading;
    assert.ok(side==='left'?change>2.5:change< -2.5,'cutback turns about145 degrees');
    assert.ok(Math.abs(change)>Math.abs(normal.heading)*2,'the turn is meaningfully sharper than normal steering');
    assert.ok(side==='left'?game.x< -4:game.x>4,'board trajectory follows the chosen direction');
    assert.ok(game.vz>3,'the board is travelling back toward its approach');
    assert.equal(game.cutbackDirection,side==='left'?-1:1);
    assert.equal(starts(events).length,1);
    assert.equal(game.cutbackActive,false);assert.equal(game.cutback,0);
    assert.deepEqual(events.find(event=>event.type==='cutback'),{type:'cutback',mode:'park',direction:side==='left'?-1:1,launchTime:0});
    assert.equal(game.wipeouts,0);assert.equal(game.airborne,false);
  }
});

test('held Shift-turn gives one cutback and cannot farm points or a launch boost',()=>{
  const {game,events}=fixture();advance(game,3,{grind:true,left:true});
  assert.equal(starts(events).length,1);
  assert.equal(events.filter(event=>event.type==='cutback').length,1);
  assert.equal(events.filter(event=>['bank','trick'].includes(event.type)).length,0);
  assert.equal(game.score,0);assert.equal(game.comboBase,0);assert.equal(game.pendingTricks,0);
  assert.equal(game.cutbackLaunchTime,0);assert.equal(game.launchSource,'flat');
});

test('release, opposite direction and neutral steering rearm the chord without bypassing cooldown',()=>{
  for(const release of['shift','turn','direction','neutral']) {
    const {game,events}=fixture();advance(game,.8,{grind:true,left:true});
    const next=release==='direction'?{grind:true,right:true}:{grind:true,left:true};
    game.update(1/120,release==='shift'?{left:true}:release==='turn'?{grind:true}:release==='neutral'?{grind:true,left:true,right:true}:next);
    advance(game,.25,next);assert.equal(starts(events).length,1);
    advance(game,.5,next);assert.equal(starts(events).length,2);
    assert.equal(game.cutbackDirection,release==='direction'?1:-1);
  }
});

test('an airborne chord preserves normal air steering and waits for a grounded cutback',()=>{
  const {game,events}=fixture();assert.equal(game.jump(),true);
  advance(game,.4,{grind:true,right:true});
  assert.equal(starts(events).length,0);assert.equal(game.cutbackActive,false);
  assert.ok(Math.abs(game.heading+.88*.4)<1e-8,'air steering rate is unchanged');
  for(let i=0;i<300&&game.airborne;i++)game.update(1/120,{grind:true,right:true});
  assert.equal(starts(events).length,0);
  const recovery=game.popCooldown;
  game.update(1/120,{grind:true,right:true});assert.equal(game.cutbackActive,true);
  assert.equal(game.jump(),false,'cutback cannot bypass grounded pop recovery');
  advance(game,.73,{grind:true,right:true});
  assert.ok(game.popCooldown>0&&game.popCooldown<recovery);
  assert.equal(game.cutbackLaunchTime,0);assert.equal(game.wipeouts,0);
});

test('upper-quarter Shift with A or D selects coping direction instead of cutting back',()=>{
  const ramp=PARK_RAMPS.find(item=>item.id==='west-pipe-north');
  for(const side of[null,'left','right'])for(const brake of[false,true]) {
    const {game,events}=fixture('filters');
    while(progress(ramp,game)<.76)game.update(1/120,{pump:true});
    const heading=game.heading,input={grind:true,brake,pump:!brake,...(side?{[side]:true}:{})};
    for(let i=0;i<120*3&&!game.grinding;i++) {
      game.update(1/120,input);
      if(!game.grinding)assert.ok(Math.abs(game.heading-heading)<1e-8,'direction choice keeps the approach aligned');
    }
    assert.equal(game.grinding?.kind,'coping');
    assert.equal(game.grinding.dir,side==='left'?-1:1);
    assert.equal(starts(events).length,0);assert.equal(game.cutbackActive,false);
    assert.equal(game.doCutback(-1),false,'C also respects an attached rail');
    assert.equal(game.airborne,false);assert.equal(game.wipeouts,0);
  }
});

test('E pipe controls and attached lip grabs retain priority over the Shift chord',()=>{
  const pipe=fixture('west');
  for(let i=0;i<120*3;i++)pipe.game.update(1/120,{pump:true,action:true,grind:true,left:true});
  assert.ok(pipe.game.pipeRide);assert.equal(starts(pipe.events).length,0);
  assert.equal(pipe.game.doCutback(-1),false);
  const lip=fixture('filters');
  while(!lip.game.lipMove&&lip.game.elapsed<6)lip.game.update(1/120,{pump:true,action:true});
  assert.ok(lip.game.lipMove);
  advance(lip.game,.3,{action:true,grind:true,left:true});
  assert.ok(lip.game.lipMove);assert.equal(starts(lip.events).length,0);
  assert.equal(lip.game.cutbackActive,false);
});

test('pause freezes the carve and a wipeout or restart clears its active pose',()=>{
  const {game,events}=fixture();advance(game,.25,{grind:true,left:true});
  const before=[game.x,game.z,game.heading,game.cutbackAge,game.cutbackCooldown];
  game.pause();advance(game,2,{grind:true,right:true});
  assert.deepEqual([game.x,game.z,game.heading,game.cutbackAge,game.cutbackCooldown],before);
  assert.equal(game.doCutback(1),false);
  game.resume();game.bail('TEST');
  assert.equal(game.cutbackActive,false);assert.equal(game.cutback,0);
  advance(game,1.5,{grind:true,left:true});assert.equal(starts(events).length,1);
  game.start();game.update(1/120,{grind:true,left:true});
  assert.equal(starts(events).length,2);assert.equal(game.cutbackActive,true);
});

test('solid boundaries and a natural ramp launch cancel a cutback cleanly',()=>{
  const border=fixture();
  Object.assign(border.game,{x:PARK_BOUNDS.maxX-.02,z:145,y:0,heading:-Math.PI/2,vx:15,vz:0,speed:15});
  assert.equal(border.game.doCutback(1),true);border.game.update(1/60);
  assert.equal(border.game.cutbackActive,false);assert.equal(border.game.cutback,0);
  assert.ok(border.game.x<=PARK_BOUNDS.maxX&&border.game.vx<0);
  assert.equal(border.events.filter(event=>event.type==='cutback').length,0);
  const ramp=PARK_RAMPS.find(item=>item.id==='west-pipe-north'),air=fixture('filters');
  while(progress(ramp,air.game)<.94)air.game.update(1/120,{pump:true});
  assert.equal(air.game.doCutback(-1),true);
  for(let i=0;i<30&&!air.game.airborne;i++)air.game.update(1/120,{pump:true});
  assert.equal(air.game.airborne,true);assert.equal(air.game.cutbackActive,false);assert.equal(air.game.cutback,0);
  assert.equal(air.events.filter(event=>event.type==='cutback').length,0);
  assert.ok(air.game.y>=parkHeight(air.game.x,air.game.z));
});

test('C uses the same park cutback, while slow movement and opposed keys do not trigger one',()=>{
  const {game,events}=fixture();advance(game,.2,{grind:true,left:true,right:true});
  assert.equal(starts(events).length,0);assert.equal(game.doCutback(-1),true);
  advance(game,.73);assert.equal(game.cutbackActive,false);assert.ok(game.heading>2.5);
  assert.equal(game.score,0);assert.equal(game.cutbackLaunchTime,0);
  const slow=fixture();advance(slow.game,1.2,{brake:true});
  assert.ok(slow.game.speed<8);assert.equal(slow.game.doCutback(-1),false);
});
