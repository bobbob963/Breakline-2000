import test from 'node:test';
import assert from 'node:assert/strict';
import { IDENTITY_KEY, RIDER_NAME_LIMIT, sanitizeRiderName, loadRiderIdentity, saveRiderIdentity } from '../src/rider-identity.js';
import { resetBreaklineSave } from '../src/admin-save.js';

function storageWith(raw) {
  const values = new Map(raw === undefined ? [] : [[IDENTITY_KEY, raw]]);
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test('first visit and corrupt or unavailable saves require the tutorial', () => {
  for (const raw of [undefined, 'broken', 'null', '[]', '123', '"name"', '{}', '{"name":42,"tutorialComplete":true}', '{"name":"Kai","tutorialComplete":"true"}', '{"name":"   ","tutorialComplete":true}']) {
    assert.deepEqual(loadRiderIdentity(storageWith(raw)), { name: '', tutorialComplete: false });
  }
  assert.deepEqual(loadRiderIdentity({getItem() { throw new Error('blocked'); }}), { name: '', tutorialComplete: false });
});

test('saving a name completes the tutorial in one write and survives a reload', () => {
  const storage = storageWith();
  let writes = 0;
  const setItem = storage.setItem;
  storage.setItem = (...args) => { writes++; setItem(...args); };
  const identity = saveRiderIdentity(storage, '   Reef  Rider   ');
  assert.deepEqual(identity, { name: 'Reef Rider', tutorialComplete: true });
  assert.equal(writes, 1);
  assert.deepEqual(loadRiderIdentity(storage), identity);
  assert.deepEqual(JSON.parse(storage.getItem(IDENTITY_KEY)), identity);
});

test('name cleanup preserves international names and whole Unicode characters', () => {
  assert.equal(sanitizeRiderName('  José\t\n波  Rider\u0000\u0008  '), 'José 波 Rider');
  assert.equal(sanitizeRiderName('Cafe\u0301'), 'Café');
  assert.equal(sanitizeRiderName('Kai\u202e\u2066'), 'Kai');
  const long = '🏄'.repeat(30);
  assert.equal(sanitizeRiderName(long), '🏄'.repeat(RIDER_NAME_LIMIT));
  assert.equal(Array.from(sanitizeRiderName(long)).length, 20);
  assert.equal(sanitizeRiderName('abcdefghijklmnopqrs xyz'), 'abcdefghijklmnopqrs');
  for (const value of [null, undefined, false, 32, {}]) assert.equal(sanitizeRiderName(value), '');
});

test('empty names fail before any save and leave the previous rider intact', () => {
  const storage = storageWith();
  const previous = saveRiderIdentity(storage, 'Kai');
  for (const value of ['', '   ', '\u0000\u0008', null]) {
    assert.throws(() => saveRiderIdentity(storage, value), /Enter a name/);
    assert.deepEqual(loadRiderIdentity(storage), previous);
  }
});

test('failed persistence reports an actionable error without marking the tutorial complete', () => {
  const storage = storageWith(), cause = new Error('quota');
  storage.setItem = () => { throw cause; };
  assert.throws(() => saveRiderIdentity(storage, 'Kai'), error => {
    assert.match(error.message, /could not save your rider name/);
    assert.equal(error.cause, cause);
    return true;
  });
  assert.deepEqual(loadRiderIdentity(storage), { name: '', tutorialComplete: false });
});

test('replaying and renaming keep tutorial completion and Full Reset restores first visit', () => {
  const storage = storageWith();
  saveRiderIdentity(storage, 'Kai');
  saveRiderIdentity(storage, 'New Wave');
  assert.deepEqual(loadRiderIdentity(storage), { name: 'New Wave', tutorialComplete: true });
  storage.setItem('other-game', 'keep');
  assert.equal(resetBreaklineSave(storage), 1);
  assert.deepEqual(loadRiderIdentity(storage), { name: '', tutorialComplete: false });
  assert.equal(storage.getItem('other-game'), 'keep');
});
