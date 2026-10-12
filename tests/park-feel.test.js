import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveParkGame, parkHeight } from '../src/park.js';

function start(where='basin') {
  const game=new WaveParkGame();game.start(where);return game;
}
function advance(game,seconds,input={},hz=120) {
  for(let i=0;i<Math.round(seconds*hz);i++)game.update(1/hz,input);
}
const movement=game=>Object.fromEntries(['x','y','z','vx','vy','vz','speed','heading','airborne','bailTime'].map(key=>[key,game[key]]));

test('holding crouch propels the board like W, without stacking speed or adding a free jump',()=>{
  const idle=start(),crouch=start(),pump=start(),both=start();
  for(let i=0;i<120;i++) {
    idle.update(1/120,{});crouch.update(1/120,{jump:true});
    pump.update(1/120,{pump:true});both.update(1/120,{pump:true,jump:true});
    for(const game of[crouch,pump,both])assert.ok(game.speed<23.5);
  }
  assert.deepEqual(movement(crouch),movement(pump));
  assert.deepEqual(movement(both),movement(pump));
  assert.ok(crouch.speed>20.8&&idle.speed<14.4,'crouching noticeably accelerates the legal starting approach');
  assert.ok(crouch.z<idle.z-3,'the speed gain moves the board, not just the speed counter');
  assert.equal(crouch.charge,1);assert.equal(pump.charge,0);
  assert.equal(crouch.airborne,false);assert.equal(crouch.score,0);assert.equal(crouch.comboBase,0);
});

test('releasing propulsion preserves ground momentum while brakes still override crouching',()=>{
  const coast=start(),brake=start(),crouchedBrake=start();
  for(const game of[coast,brake,crouchedBrake])advance(game,1,{pump:true});
  const releaseSpeed=coast.speed;
  advance(coast,.8);advance(brake,.8,{brake:true});advance(crouchedBrake,.8,{brake:true,jump:true});
  assert.ok(coast.speed>18.7&&coast.speed<releaseSpeed,'coasting sheds speed gently without accelerating');
  assert.ok(Math.hypot(coast.vx,coast.vz)>18.7,'velocity retains the earned momentum');
  assert.ok(brake.speed<4.6,'the brake remains useful after a fast approach');
  assert.deepEqual(movement(brake),movement(crouchedBrake));
  for(const game of[coast,brake,crouchedBrake])assert.equal(game.airborne,false);
});

test('slow turns tighten while cruise-speed yaw stays unchanged and the board follows its heading',()=>{
  for(const side of['left','right']) {
    const slow=start(),fast=start(),direction=side==='left'?1:-1;
    advance(slow,1.5,{brake:true});advance(fast,1.5,{pump:true});
    advance(slow,.5,{brake:true,[side]:true});advance(fast,.5,{pump:true,[side]:true});
    assert.ok(slow.heading*direction>1.09&&slow.heading*direction<1.11,'slow-speed steering turns about63 degrees in half a second');
    assert.ok(Math.abs(fast.heading-direction*.825)<1e-9,'fast steering still turns47.3 degrees in half a second');
    const velocityHeading=Math.atan2(-fast.vx,-fast.vz);
    assert.ok(Math.abs(velocityHeading-fast.heading)<.125,'the visible travel direction responds promptly');
    assert.ok(fast.x*direction< -3,'the board physically follows the curved line');
    assert.equal(slow.wipeouts,0);assert.equal(fast.wipeouts,0);
  }
});

test('Space propulsion does not accelerate an active cutback or an airborne board',()=>{
  for(const airborne of[false,true]) {
    const plain=start(),crouched=start();
    if(airborne){assert.equal(plain.jump(),true);assert.equal(crouched.jump(),true);}
    advance(plain,.5,airborne?{left:true}:{grind:true,left:true});
    advance(crouched,.5,airborne?{left:true,jump:true}:{grind:true,left:true,jump:true});
    assert.deepEqual(movement(plain),movement(crouched));
    assert.equal(plain.cutbackActive,!airborne);
    if(airborne)assert.ok(Math.abs(plain.heading-.44)<1e-9,'air steering retains its existing rate');
  }
});

test('a real halfpipe air carries earned speed through landing after W is released',()=>{
  for(const hz of[30,120]) {
    const game=start('filters'),events=[];
    game.onEvent=event=>events.push({...event,time:game.elapsed});
    while(!game.airborne&&game.elapsed<4)game.update(1/hz,{pump:true});
    assert.equal(game.airborne,true);
    const launchSpeed=game.speed,launchTime=game.elapsed;
    assert.ok(launchSpeed>22.5&&launchSpeed<23.5);
    assert.equal(game.doTrick('grab'),true);
    let maximumY=game.y;
    while(game.airborne&&game.elapsed<8) {
      game.update(1/hz,{});
      maximumY=Math.max(maximumY,game.y);
      assert.ok(game.y>=parkHeight(game.x,game.z)-.0001);
    }
    assert.equal(game.airborne,false);assert.equal(game.wipeouts,0);
    assert.ok(game.elapsed-launchTime>2.6&&game.elapsed-launchTime<3,'the existing useful air duration is retained');
    assert.ok(maximumY<20,'momentum retention does not raise the launch above the roof');
    assert.ok(game.speed>launchSpeed*.90&&game.speed<launchSpeed,'the air carries more than90% of takeoff speed');
    assert.ok(Math.hypot(game.vx,game.vz)>20,'landing travel retains the speed too');
    assert.equal(events.filter(event=>event.type==='jump').length,1);
    assert.equal(events.filter(event=>event.type==='land').length,1);
    assert.ok(game.popCooldown>1.35,'airtime still cannot consume grounded pop recovery');
    assert.equal(game.jump(),false);
    assert.equal(game.bank(),true);assert.equal(game.landedTricks,1);
  }
});

test('mixed crouch, coast, steering, braking and released pop agree at30 and120Hz',()=>{
  const games=[30,120].map(hz=>{
    const game=start();
    for(const[seconds,input]of[
      [.6,{pump:true}],[.4,{jump:true}],[.3,{left:true}],[.5,{brake:true}],[.2,{right:true,jump:true}],
    ])advance(game,seconds,input,hz);
    assert.equal(game.jump(),true);
    advance(game,.4,{right:true,jump:true},hz);
    return game;
  });
  for(const key of['x','y','z','vx','vy','vz','speed','heading','elapsed','popCooldown']) {
    assert.ok(Math.abs(games[0][key]-games[1][key])<1e-8,`${key} must not depend on display frame rate`);
  }
  assert.equal(games[0].airborne,true);assert.equal(games[1].airborne,true);
  assert.equal(games[0].score,0);assert.equal(games[1].score,0);
});
