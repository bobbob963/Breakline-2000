import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, OUTFITS, BOARD_DESIGNS, DEFAULT_PROFILE, validateProfile } from '../src/appearance.js';

test('corrupt saved profiles fall back to usable defaults without throwing', () => {
  for (const value of [undefined, null, 0, false, 'broken JSON value', [], {}]) {
    assert.deepEqual(validateProfile(value), DEFAULT_PROFILE);
  }
  for (const value of [null, false, 7, {}, [], 'missing-choice', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.deepEqual(validateProfile({ character: value, outfit: value, boardDesign: value, boardColor: value }), DEFAULT_PROFILE);
  }
});

test('all four characters can independently select seventeen outfits and twelve board designs', () => {
  assert.equal(Object.keys(CHARACTERS).length, 4);
  assert.equal(Object.keys(OUTFITS).length, 17);
  assert.equal(Object.keys(BOARD_DESIGNS).length, 12);
  for (const character of Object.keys(CHARACTERS)) {
    for (const outfit of Object.keys(OUTFITS)) {
      for (const boardDesign of Object.keys(BOARD_DESIGNS)) {
        const selected = Object.freeze({ character, outfit, boardDesign, boardColor: '#24c5ba' });
        const validated = validateProfile(selected);
        assert.deepEqual(validated, { ...selected, rewardBoard: null });
        assert.notEqual(validated, selected, 'validation must return an independent profile');
      }
    }
  }
});

test('every rider has a usable default outfit and Jax keeps his two complete crew looks', () => {
  for (const character of Object.values(CHARACTERS)) {
    assert.ok(Object.hasOwn(OUTFITS, character.defaultOutfit));
    assert.equal(character.stats.length, 10);
  }
  assert.equal(CHARACTERS.jax.dreads, true);
  assert.equal(CHARACTERS.jax.defaultOutfit, 'yardcrew');
  for (const id of ['yardcrew', 'suncrew']) {
    const outfit = OUTFITS[id];
    assert.equal(outfit.top, 'sweatshirt');
    assert.equal(outfit.bottom, 'trousers');
    assert.equal(outfit.hat, 'whitecap');
    assert.equal(outfit.footwear, 'trainers');
    assert.equal(outfit.sleeves, 'long');
    assert.equal(validateProfile({character:'jax',outfit:id}).outfit, id);
  }
});

test('old saved profiles keep character and board while acquiring the default outfit', () => {
  const legacy = { character: 'reef', boardColor: '#8755bb', boardDesign: 'flames' };
  const validated = validateProfile(legacy);
  assert.deepEqual(validated, { ...legacy, outfit: 'riptide', rewardBoard: null });
  assert.equal(Object.hasOwn(legacy, 'outfit'), false);
});

test('invalid fields reset individually without discarding other customization choices', () => {
  const selected = { character: 'nova', outfit: 'castaway', boardDesign: 'hibiscus', boardColor: '#e95b39' };
  for (const field of Object.keys(DEFAULT_PROFILE)) {
    assert.deepEqual(validateProfile({ ...selected, [field]: 'bad-choice' }), { ...selected, rewardBoard: null, [field]: DEFAULT_PROFILE[field] });
  }
});
