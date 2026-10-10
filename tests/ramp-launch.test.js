import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveParkGame, PARK_RAMPS, PARK_COPINGS, parkHeight, parkLocal } from '../src/park.js';

const progress=(ramp,game)=>parkLocal(ramp,game.x,game.z).v/ramp.length+.5;

function runToLanding(game,input,events,hz=120) {
  let startedTrick=false,maximumY=game.y,maximumProgress=0;
  const ramp=PARK_RAMPS.find(item=>item.id==='west-pipe-north');
  for(let i=0;i<hz*8;i++) {
    game.update(1/hz,input);
    if(game.airborne&&!startedTrick) {
      assert.equal(game.doTrick('flip'),true,'the ramp must provide a real trick opportunity');
      startedTrick=true;
    }
    maximumY=Math.max(maximumY,game.y);maximumProgress=Math.max(maximumProgress,progress(ramp,game));
    assert.ok(game.y>=parkHeight(game.x,game.z)-.0001,'board must stay outside the ramp');
    if(events.some(event=>event.type==='land'))break;
  }
  assert.equal(game.wipeouts,0);
  assert.equal(game.airborne,false,'the air must land');
  assert.equal(events.filter(event=>event.type==='jump').length,1,'no tiny failed hop followed by an edge relaunch');
  assert.equal(events.filter(event=>event.type==='land').length,1);
  assert.equal(game.bank(),true);
  assert.equal(game.landedTricks,1,'the original trick survives the quarter turn and scores once');
  return {maximumY,maximumProgress};
}

test('charged pops from the legal halfpipe start clear the upper face and coping at cruise and pump speed',()=>{
  const ramp=PARK_RAMPS.find(item=>item.id==='west-pipe-north');
  for(const pump of[false,true])for(const releaseAt of[.60,.78,.866])for(const hz of[30,120]) {
    const events=[];
    const game=new WaveParkGame();game.onEvent=event=>events.push({...event,time:game.elapsed});game.start('filters');
    for(let i=0;i<hz*6&&progress(ramp,game)<releaseAt;i++)game.update(1/hz,{pump,jump:true});
    assert.equal(game.airborne,false,'the release takes place on the uphill face');
    assert.ok(game.charge>.9,'approach holds the actual pop input long enough to charge');
    assert.equal(game.jump(),true);
    const heading=game.heading,launchTime=game.elapsed;
    const result=runToLanding(game,{pump},events,hz);
    const landing=events.find(event=>event.type==='land');
    assert.ok(landing.time-launchTime>1.7,'the charged air is sustained rather than cancelled by the rising face');
    assert.ok(result.maximumProgress>=.96&&result.maximumProgress<1,'quarter airs reach the lip and stay on the bowl side');
    assert.ok(result.maximumY<22,'the air stays beneath the factory roof');
    assert.ok(Math.cos(game.heading-heading)<-.95,'the completed air points back into the bowl');
  }
});

test('automatic halfpipe takeoff waits until the lip, then rises before turning back',()=>{
  const ramp=PARK_RAMPS.find(item=>item.id==='west-pipe-north');
  for(const pump of[false,true]) {
    const events=[];
    const game=new WaveParkGame();game.onEvent=event=>events.push({...event,time:game.elapsed});game.start('filters');
    while(!game.airborne&&game.elapsed<6)game.update(1/120,{pump});
    assert.ok(progress(ramp,game)>=.96&&progress(ramp,game)<.98);
    assert.ok(game.vz<0&&game.vz>-3);
    assert.ok(Math.abs(game.heading)<.001);
    const launchTime=game.elapsed,launchHeight=game.y;
    for(let i=0;i<12;i++)game.update(1/120,{pump});
    assert.ok(game.y>launchHeight+.8,'the first tenth of a second is an upward launch');
    assert.ok(game.vz<0,'no immediate horizontal bounce');
    const result=runToLanding(game,{pump},events);
    assert.ok(events.find(event=>event.type==='land').time-launchTime>1.8);
    assert.ok(result.maximumY<20);
  }
});

test('all ramp orientations support automatic and charged takeoff without solid-wall reflections',()=>{
  for(const ramp of PARK_RAMPS.filter(item=>['quarter','kicker','spine'].includes(item.type))) {
    for(const speed of[15,23.5])for(const releaseAt of[null,...(ramp.type==='spine'?[.20,.30,.42]:[.60,.78,.86])]) {
      const manual=releaseAt!==null;
      const events=[],game=new WaveParkGame();game.onEvent=event=>events.push({...event,time:game.elapsed});game.start();
      const s=Math.sin(ramp.rotation),c=Math.cos(ramp.rotation),v=-ramp.length/2-4;
      Object.assign(game,{x:ramp.x-s*v,z:ramp.z-c*v,heading:ramp.rotation,speed,vx:-s*speed,vz:-c*speed});
      game.y=parkHeight(game.x,game.z);
      let popped=false,reflections=0,maximumY=game.y,firstLaunch=null;
      const reflect=game.reflectWall.bind(game);game.reflectWall=normal=>{
        // Some straight return lines eventually meet a different rail/deck.
        // Keep those real obstacles; this assertion targets the ramp itself.
        if(progress(ramp,game)>-.05&&progress(ramp,game)<1.05)reflections++;
        reflect(normal);
      };
      for(let i=0;i<120*8;i++) {
        if(manual&&!popped&&progress(ramp,game)>=releaseAt)popped=game.jump();
        game.update(1/120,{pump:speed>20,jump:manual&&!popped});
        if(game.airborne&&!firstLaunch)firstLaunch={time:game.elapsed,progress:progress(ramp,game)};
        maximumY=Math.max(maximumY,game.y);
        assert.ok(game.y>=parkHeight(game.x,game.z)-.0001,ramp.id+' cannot penetrate its ramp');
        if(events.some(event=>event.type==='land'))break;
      }
      const label=`${ramp.id} / ${speed} / ${manual?'manual at '+releaseAt:'automatic'}`;
      if(manual)assert.equal(popped,true,label+' releases the pop before automatic takeoff');
      assert.ok(firstLaunch,label+' takes off');
      assert.equal(reflections,0,label+' must not bounce off the face or coping');
      assert.equal(events.filter(event=>event.type==='jump').length,1,label+' has one sustained air');
      assert.equal(game.wipeouts,0,label+' lands safely');
      const land=events.find(event=>event.type==='land');
      assert.ok(land&&land.time-firstLaunch.time>1.3,label+' has useful airtime');
      assert.ok(maximumY<23,label+' stays beneath the factory roof');
      if(!manual)assert.ok(firstLaunch.progress>=(ramp.type==='spine'?.49:ramp.type==='quarter'?.96:.97),label+' reaches its crest');
    }
  }
});

test('braking on the upper quarter still returns over the lip instead of crossing its solid back',()=>{
  const ramp=PARK_RAMPS.find(item=>item.id==='west-pipe-north');
  for(const releaseAt of[0,.78,.86]) {
    const game=new WaveParkGame();game.start('filters');
    let popped=false,returned=false,airtime=0;
    for(let i=0;i<120*18;i++) {
      if(releaseAt&&!popped&&progress(ramp,game)>=releaseAt)popped=game.jump();
      game.update(1/120,{brake:true,jump:releaseAt>0&&!popped});
      if(game.rampReturn)returned=true;
      if(game.airborne)airtime+=1/120;
      assert.ok(progress(ramp,game)<1,'the slow air must stay inside the quarter');
      assert.ok(game.y>=parkHeight(game.x,game.z)-.0001);
      if(returned&&!game.airborne)break;
    }
    assert.equal(returned,true);
    assert.ok(airtime>.7);
    assert.equal(game.wipeouts,0);
    assert.ok(game.vz>0,'braking-speed air ends toward the bowl');
  }
});

test('ongoing steering gently moves the board during the assisted quarter turn',()=>{
  const games=[new WaveParkGame(),new WaveParkGame()];
  for(const game of games) {
    game.start('filters');
    while(!game.airborne&&game.elapsed<6)game.update(1/120,{pump:true});
  }
  for(let i=0;i<48;i++) {
    games[0].update(1/120,{pump:true,left:true});
    games[1].update(1/120,{pump:true,right:true});
    for(const game of games)assert.ok(game.y>parkHeight(game.x,game.z)+.1);
  }
  assert.ok(games[0].rampReturn&&games[1].rampReturn,'check responsiveness during the assist itself');
  assert.ok(games[1].x-games[0].x>.6,'held steering changes the airborne line');
  assert.ok(Math.abs(games[1].heading-games[0].heading)>.1,'the rider follows that slight lateral adjustment');
});

test('relocated copings remain on the actual upper lip for direct grind and grab entries',()=>{
  for(const rail of PARK_COPINGS) {
    const ramp=PARK_RAMPS.find(item=>item.id===rail.rampId);
    assert.ok(Math.abs(progress(ramp,rail)-.985)<1e-9);
  }
  for(const action of['grind','action']) {
    const game=new WaveParkGame();game.start('filters');
    for(let i=0;i<600&&!game.grinding&&!game.lipMove;i++)game.update(1/120,{pump:true,[action]:true});
    assert.ok(action==='grind'?game.grinding?.kind==='coping':game.lipMove);
    assert.equal(game.airborne,false,'the lip action remains available directly from the ramp');
  }
});
