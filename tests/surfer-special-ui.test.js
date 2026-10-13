import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {SurfGame} from '../src/game.js';
import {WaveParkGame} from '../src/park.js';
import {SpecialMeter} from '../src/special.js';
import {SURFER_SPECIALS} from '../src/surfer-specials.js';
import {sanitizeAdminSettings,resolveAdminStats} from '../src/admin-settings.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const block=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)+from.length));
function controls(game){
  const messages=[],special=new SpecialMeter();
  const context={game,special,toast:message=>messages.push(message)};
  vm.runInNewContext(block('function tryTrick(', 'function tryPop('),context);
  return {...context,messages};
}

test('production player settings assign the selected surfer special independently of clothes and board perks',()=>{
  for(const Game of [SurfGame,WaveParkGame])for(const character of Object.keys(SURFER_SPECIALS)){
    const game=new Game(),profile={character,outfit:'yardcrew',rewardBoard:'lightning'};
    const context={game,profile,adminSettings:sanitizeAdminSettings(null),resolveAdminStats};
    vm.runInNewContext(block('function applyPlayerSettings(', 'function adminHomeScreen('),context);
    context.applyPlayerSettings();game.start();
    assert.equal(game.characterSpecial.specialId,SURFER_SPECIALS[character].specialId);
    profile.outfit='suncrew';profile.rewardBoard='sky';context.applyPlayerSettings();
    assert.equal(game.characterSpecial.specialId,SURFER_SPECIALS[character].specialId);
    assert.equal(game.rewardBoard,'sky');
  }
});

test('the actual I-key action starts each chosen special and consumes exactly one full charge in coast and Waterworks',()=>{
  for(const Game of [SurfGame,WaveParkGame])for(const character of Object.keys(SURFER_SPECIALS)){
    const game=new Game();game.setCharacter(character);game.start();
    const c=controls(game);c.special.gain(1);
    c.tryTrick('special');assert.equal(c.special.ready,true,'grounded attempt retains the full charge');
    game.airborne=true;game.airLaunchSource='lip';
    c.tryTrick('special');
    assert.equal(game.trick.specialId,SURFER_SPECIALS[character].specialId);
    assert.equal(c.special.value,0);assert.equal(c.messages.at(-1),`${SURFER_SPECIALS[character].name}!`);
    c.special.gain(1);const active=game.trick;c.tryTrick('special');
    assert.equal(game.trick,active);assert.equal(c.special.ready,true,'a busy attempt does not spend the next charge');
  }
});

test('partial charge and forbidden flat-hop attempts never start or spend a signature special',()=>{
  const game=new SurfGame();game.setCharacter('jax');game.start();game.airborne=true;game.airLaunchSource='lip';
  const c=controls(game);c.special.gain(.9);c.tryTrick('special');
  assert.equal(game.trick,null);assert.equal(c.special.value,.9);assert.match(c.messages.at(-1),/BUILD YOUR SPECIAL/);
  c.special.gain(.1);game.airLaunchSource='flat';c.tryTrick('special');
  assert.equal(game.trick,null);assert.equal(c.special.ready,true);assert.match(c.messages.at(-1),/NEED AIR/);
});
