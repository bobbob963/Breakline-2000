import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIAL_COSMETIC_SETS, getTrialCosmeticSet, trialCosmeticUnlocked } from '../src/trial-cosmetics.js';
import { OUTFITS, BOARD_DESIGNS, validateProfile, createSurfer, disposeSurfer, trialBoardTexture } from '../src/appearance.js';
import { getRewardBoard } from '../src/board-rewards.js';
import * as THREE from 'three';

// Records real drawing operations to catch a missing graphics branch, fallback
// to the default lightning deck, or an accidental recolour-only implementation.
// Visual appearance itself is reviewed in the browser, not inferred from this.
function withCanvas(run) {
  const previous=globalThis.document,canvases=[];
  globalThis.document={createElement:()=>{
    const calls=[],ctx=new Proxy({}, {
      get:(_,key)=>['createLinearGradient','createRadialGradient'].includes(key)?()=>({addColorStop(){}}):(...args)=>calls.push([key,...args]),
      set:()=>true,
    });
    const canvas={width:1,height:1,getContext:()=>ctx,calls};canvases.push(canvas);return canvas;
  }};
  try{return run(canvases);}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}

test('a new outfit and deck unlock at every third unique Time Trial, without adding a riding perk',()=>{
  assert.equal(TRIAL_COSMETIC_SETS.length,4);
  for(const set of TRIAL_COSMETIC_SETS){
    assert.equal(OUTFITS[set.outfit].trialReward,set.id);
    assert.equal(BOARD_DESIGNS[set.boardDesign].trialReward,set.id);
    assert.equal(trialCosmeticUnlocked(set.id,set.requiredClears-1),false);
    assert.equal(trialCosmeticUnlocked(set.id,set.requiredClears),true);
    assert.equal(trialCosmeticUnlocked(set.id,12),true);
    assert.equal(getRewardBoard(set.boardDesign),null,'cosmetic decks cannot grant prize-board physics');
    const profile=validateProfile({outfit:set.outfit,boardDesign:set.boardDesign});
    assert.equal(profile.outfit,set.outfit);assert.equal(profile.boardDesign,set.boardDesign);assert.equal(profile.rewardBoard,null);
  }
  assert.deepEqual(TRIAL_COSMETIC_SETS.map(set=>set.requiredClears),[3,6,9,12]);
  for(const malformed of [null,NaN,Infinity,-1,'12',{},[]])assert.equal(trialCosmeticUnlocked('afterhours',malformed),false);
  assert.equal(trialCosmeticUnlocked('unknown',12),false);assert.equal(getTrialCosmeticSet('__proto__'),null);
});

test('Time Trials decks have distinct authored graphics and keep the same nearest-filter texture density',()=>withCanvas(()=>{
  const geometrySignatures=new Set();
  for(const set of TRIAL_COSMETIC_SETS){
    const texture=trialBoardTexture(set.boardDesign);
    assert.equal(texture.image.width,64);assert.equal(texture.image.height,256);
    assert.equal(texture.magFilter,THREE.NearestFilter);assert.equal(texture.minFilter,THREE.NearestFilter);assert.equal(texture.generateMipmaps,false);
    assert.equal(texture.name,'trial-deck-'+set.boardDesign);
    // Ignore labels and paint colours: each design must author different shapes.
    geometrySignatures.add(JSON.stringify(texture.image.calls.filter(([type])=>['moveTo','lineTo','arc','ellipse','bezierCurveTo'].includes(type))));
    texture.dispose();
  }
  assert.equal(geometrySignatures.size,4);
  assert.equal(trialBoardTexture('unknown'),null);
}));

test('actual surfer construction uses earned deck art while equipped ladder boards keep their art and perk identity',()=>withCanvas(()=>{
  for(const set of TRIAL_COSMETIC_SETS){
    const style=createSurfer({outfit:set.outfit,boardDesign:set.boardDesign});
    assert.equal(style.board.material.map.name,'trial-deck-'+set.boardDesign);
    assert.equal(style.rig.userData.profile.rewardBoard,null);
    style.pose({standing:true});style.rider.traverseVisible(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
    disposeSurfer(style);
    const prize=createSurfer({outfit:set.outfit,boardDesign:set.boardDesign,rewardBoard:'sky'});
    assert.equal(prize.board.material.map.name,'reward-deck-sky');
    assert.equal(prize.rig.userData.profile.rewardBoard,'sky');disposeSurfer(prize);
  }
}));
