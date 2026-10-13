import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_SETTINGS_KEY, sanitizePlayerSettings, loadPlayerSettings, savePlayerSettings } from '../src/player-settings.js';
import { DEFAULT_KEYBINDS, rebindKey } from '../src/key-bindings.js';

test('a fresh or broken save gets a complete independent playable setup', () => {
  for (const value of [null, undefined, false, 'bad', [], 99]) {
    assert.deepEqual(sanitizePlayerSettings(value), {
      quality: 'retro', camera: 'classic', cameraHeight: 0, cameraFov: 64, cameraShake: true,
      musicVolume: 100, effectsVolume: 100, keybinds: { ...DEFAULT_KEYBINDS },
    });
  }
  const a = sanitizePlayerSettings(null), b = sanitizePlayerSettings(null);
  a.keybinds.jump = 'KeyX'; a.cameraHeight = 3;
  assert.equal(b.keybinds.jump, 'Space'); assert.equal(b.cameraHeight, 0);
});

test('corrupt, inherited and nonfinite settings cannot escape the supported camera and sound ranges', () => {
  assert.deepEqual(sanitizePlayerSettings({
    quality: 'ultra', camera: 'inside-head', cameraHeight: Infinity, cameraFov: NaN,
    cameraShake: 'false', musicVolume: '0', effectsVolume: null,
  }), sanitizePlayerSettings(null));
  const settings = sanitizePlayerSettings({
    quality: 'clean', camera: 'wide', cameraHeight: 900, cameraFov: -50,
    cameraShake: false, musicVolume: -5, effectsVolume: 400,
  });
  assert.equal(settings.cameraHeight, 3); assert.equal(settings.cameraFov, 50);
  assert.equal(settings.musicVolume, 0); assert.equal(settings.effectsVolume, 100);
  assert.equal(settings.cameraShake, false);
  assert.deepEqual(sanitizePlayerSettings(Object.create({ quality: 'clean', cameraFov: 90, keybinds: { jump: 'KeyX' } })), sanitizePlayerSettings(null));
});

test('saving and reopening keeps personal camera, volume and swapped controls exactly', () => {
  const records = new Map(), storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const selected = sanitizePlayerSettings({
    quality: 'clean', camera: 'close', cameraHeight: -.7, cameraFov: 78,
    cameraShake: false, musicVolume: 24, effectsVolume: 86,
    keybinds: rebindKey(DEFAULT_KEYBINDS, 'jump', 'KeyJ'),
  });
  assert.deepEqual(savePlayerSettings(storage, selected), selected);
  assert.ok(records.has(PLAYER_SETTINGS_KEY));
  assert.deepEqual(loadPlayerSettings(storage), selected);
  assert.equal(loadPlayerSettings(storage).keybinds.spin, 'Space');
  selected.keybinds.jump = 'KeyZ';
  assert.equal(loadPlayerSettings(storage).keybinds.jump, 'KeyJ', 'saving must not retain a live draft reference');
});

test('reading blocked or malformed storage is safe while failed saves are reported', () => {
  for (const storage of [{ getItem: () => '{broken' }, { getItem() { throw new Error('Denied'); } }, {}]) {
    assert.deepEqual(loadPlayerSettings(storage), sanitizePlayerSettings(null));
  }
  const denied = new Error('Quota exceeded');
  assert.throws(() => savePlayerSettings({ setItem() { throw denied; } }, null), error => {
    assert.match(error.message, /could not save the settings/);
    assert.equal(error.cause, denied); return true;
  });
});
