import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeAdminSettings, getAdminScope, updateAdminScope, resetAdminScope,
  resolveAdminStats, sanitizeResolvedAdminStats,
} from '../src/admin-settings.js';

test('missing and malformed admin saves start disabled with no overrides',()=>{
  for (const value of [undefined,null,false,[],42,'enabled',{enabled:'true',characters:[],boards:'sky'}]) {
    assert.deepEqual(sanitizeAdminSettings(value),{version:1,enabled:false,characters:{},boards:{}});
  }
  assert.equal(sanitizeAdminSettings({enabled:true}).enabled,true);
});

test('saved stats reject nonfinite values and unknown fields, while clamping safe numerical limits',()=>{
  const saved = sanitizeAdminSettings({version:999,enabled:true,extra:true,
    characters:{kai:{jumpPower:100,gravity:-2,scoreMultiplier:Infinity,landingGrace:NaN,steering:'2',comboWindow:5,evil:5},unknown:{jumpPower:2}},
    boards:{sky:{baseSpeed:-3,boostPower:99,extraJumps:2.9,popRecovery:0,glideGravity:-Infinity,boostDuration:null,unknown:1},unknown:{baseSpeed:3}},
  });
  assert.deepEqual(saved,{
    version:1,enabled:true,
    characters:{kai:{jumpPower:3,gravity:.25,comboWindow:5}},
    boards:{sky:{baseSpeed:.25,boostPower:4,popRecovery:0,extraJumps:2}},
  });
  const inherited = Object.create({kai:{jumpPower:2}});
  const inheritedStats = Object.create({boostPower:4});
  assert.deepEqual(sanitizeAdminSettings({characters:inherited,boards:{standard:inheritedStats}}),{
    version:1,enabled:false,characters:{},boards:{standard:{}},
  });
});

test('equipped reward perks become the untouched admin defaults, preserving all six board rewards',()=>{
  const empty = sanitizeAdminSettings();
  assert.equal(getAdminScope(empty,{character:'kai',rewardBoard:'guitar'}).character.scoreMultiplier,1.25);
  assert.equal(getAdminScope(empty,{character:'kai',rewardBoard:'lightning'}).board.boostPower,1.25);
  assert.equal(getAdminScope(empty,{character:'kai',rewardBoard:'vortex'}).board.boostDuration,1.35);
  assert.equal(getAdminScope(empty,{character:'kai',rewardBoard:'solar'}).board.popRecovery,.75);
  const sky = getAdminScope(empty,{character:'kai',rewardBoard:'sky'});
  assert.equal(sky.board.extraJumps,1);assert.equal(sky.board.glideGravity,.32);assert.equal(sky.board.glideFallSpeed,3.6);
  const afterburner = getAdminScope(empty,{character:'kai',rewardBoard:'afterburner'});
  assert.equal(afterburner.board.baseSpeed,1.25);assert.equal(afterburner.board.boostPower,1.5);
  assert.equal(afterburner.character.jumpPower,1);assert.equal(afterburner.board.acceleration,1);
});

test('edits affect only the chosen character and board and survive changing away and back',()=>{
  const kaiSky={character:'kai',rewardBoard:'sky'},novaSky={character:'nova',rewardBoard:'sky'};
  const kaiStandard={character:'kai',rewardBoard:null};
  let saved=sanitizeAdminSettings({enabled:true});
  saved=updateAdminScope(saved,kaiSky,'character',{jumpPower:1.8,trickSpeed:2});
  saved=updateAdminScope(saved,kaiSky,'board',{baseSpeed:2,extraJumps:3});
  saved=updateAdminScope(saved,novaSky,'character',{gravity:.5});
  saved=updateAdminScope(saved,kaiStandard,'board',{acceleration:2.5});
  const kai=getAdminScope(saved,kaiSky),nova=getAdminScope(saved,novaSky),standard=getAdminScope(saved,kaiStandard);
  assert.equal(kai.character.jumpPower,1.8);assert.equal(kai.character.gravity,1);
  assert.equal(nova.character.jumpPower,1);assert.equal(nova.character.gravity,.5);
  assert.equal(nova.board.baseSpeed,2);assert.equal(kai.board.extraJumps,3);
  assert.equal(standard.board.baseSpeed,1);assert.equal(standard.board.acceleration,2.5);
  assert.equal(standard.character.trickSpeed,2);assert.equal(kai.board.acceleration,1);
  assert.deepEqual(getAdminScope(JSON.parse(JSON.stringify(saved)),kaiSky),kai);
});

test('partial edits preserve other overrides and reject invalid replacements rather than erasing them',()=>{
  const profile={character:'reef',rewardBoard:'afterburner'};
  const saved=updateAdminScope({enabled:true},profile,'board',{baseSpeed:2,boostPower:2.5});
  const next=updateAdminScope(saved,profile,'board',{boostPower:NaN,baseSpeed:'3',extraJumps:99});
  assert.deepEqual(next.boards.afterburner,{baseSpeed:2,boostPower:2.5,extraJumps:5});
  assert.equal(next.enabled,true);assert.deepEqual(saved.boards.afterburner,{baseSpeed:2,boostPower:2.5});
  assert.deepEqual(updateAdminScope(next,profile,'wrong',{baseSpeed:3}),next);
});

test('resetting the current setup restores its natural reward defaults and leaves other setups intact',()=>{
  const current={character:'kai',rewardBoard:'sky'},other={character:'jax',rewardBoard:'afterburner'};
  let saved=updateAdminScope({enabled:true},current,'character',{jumpPower:3});
  saved=updateAdminScope(saved,current,'board',{extraJumps:5,glideFallSpeed:8});
  saved=updateAdminScope(saved,other,'character',{scoreMultiplier:4});
  saved=updateAdminScope(saved,other,'board',{baseSpeed:2});
  const reset=resetAdminScope(saved,current);
  assert.deepEqual(reset.characters,{jax:{scoreMultiplier:4}});assert.deepEqual(reset.boards,{afterburner:{baseSpeed:2}});
  assert.equal(reset.enabled,true);
  assert.equal(getAdminScope(reset,current).character.jumpPower,1);
  assert.equal(getAdminScope(reset,current).board.extraJumps,1);
  assert.equal(getAdminScope(reset,current).board.glideFallSpeed,3.6);
  assert.equal(getAdminScope(reset,other).character.scoreMultiplier,4);
  assert.equal(getAdminScope(reset,other).board.baseSpeed,2);
  assert.equal(saved.characters.kai.jumpPower,3);
});

test('unknown profile IDs use the normal fallback setup rather than creating inaccessible entries',()=>{
  const invalid={character:'alien',rewardBoard:'__proto__'};
  let saved=updateAdminScope(undefined,invalid,'character',{steering:1.5});
  saved=updateAdminScope(saved,invalid,'board',{baseSpeed:1.6});
  assert.deepEqual(saved.characters,{kai:{steering:1.5}});assert.deepEqual(saved.boards,{standard:{baseSpeed:1.6}});
  assert.deepEqual(getAdminScope(saved,invalid),getAdminScope(saved,{character:'kai',rewardBoard:null}));
});

test('disabled admin settings resolve inactive without discarding tuned values or equipped board defaults',()=>{
  const profile={character:'reef',rewardBoard:'afterburner'};
  const saved=updateAdminScope({enabled:false},profile,'character',{jumpPower:2.25});
  const inactive=resolveAdminStats(saved,profile);
  assert.equal(inactive.active,false);assert.equal(inactive.character.jumpPower,2.25);
  assert.equal(inactive.board.baseSpeed,1.25);assert.equal(inactive.board.boostPower,1.5);
  const active=resolveAdminStats({...saved,enabled:true},profile);
  assert.equal(active.active,true);assert.deepEqual(active.character,inactive.character);assert.deepEqual(active.board,inactive.board);
  assert.equal(resolveAdminStats({...saved,enabled:1},profile).active,false);
});

test('resolved runtime stats always contain safe complete values and literal booleans',()=>{
  const result=sanitizeResolvedAdminStats({active:true,character:{jumpPower:Infinity,gravity:NaN,scoreMultiplier:-1,landingGrace:5,unknown:3},board:{baseSpeed:3.5,boostPower:0,popRecovery:0,extraJumps:2.8,glideFallSpeed:-4}});
  assert.equal(result.active,true);
  assert.equal(result.character.jumpPower,1);assert.equal(result.character.gravity,1);
  assert.equal(result.character.scoreMultiplier,0);assert.equal(result.character.landingGrace,1);
  assert.equal(result.character.comboWindow,3.8);assert.equal(result.character.unknown,undefined);
  assert.equal(result.board.baseSpeed,3);assert.equal(result.board.boostPower,0);assert.equal(result.board.popRecovery,0);
  assert.equal(result.board.extraJumps,2);assert.equal(result.board.glideFallSpeed,0);
  assert.equal(sanitizeResolvedAdminStats({active:'true'}).active,false);
  assert.equal(sanitizeResolvedAdminStats(null).board.baseSpeed,1);
});

test('saved, resolved and returned setup objects are independent copies',()=>{
  const profile={character:'kai',rewardBoard:'sky'};
  const original={enabled:true,characters:{kai:{jumpPower:1.5}},boards:{sky:{baseSpeed:1.5}}};
  const clean=sanitizeAdminSettings(original),scope=getAdminScope(clean,profile),resolved=resolveAdminStats(clean,profile);
  clean.characters.kai.jumpPower=2;scope.board.baseSpeed=3;scope.character.jumpPower=3;
  resolved.board.baseSpeed=.25;resolved.character.jumpPower=.25;
  assert.equal(original.characters.kai.jumpPower,1.5);assert.equal(original.boards.sky.baseSpeed,1.5);
  assert.equal(clean.boards.sky.baseSpeed,1.5);assert.equal(clean.characters.kai.jumpPower,2);
  assert.equal(getAdminScope(undefined,profile).character.jumpPower,1);
  assert.equal(getAdminScope(undefined,profile).board.baseSpeed,1);
});
