import { sanitizeKeybinds } from './key-bindings.js';

export const PLAYER_SETTINGS_KEY = 'breakline99-settings-v1';

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => plain(value) && Object.hasOwn(value, key) ? value[key] : undefined;
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
const number = (value, min, max, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Treat persisted settings as untrusted input; every result is an independent draft. */
export function sanitizePlayerSettings(raw) {
  return {
    quality: choice(own(raw, 'quality'), ['retro', 'clean'], 'retro'),
    camera: choice(own(raw, 'camera'), ['classic', 'close', 'wide'], 'classic'),
    cameraHeight: number(own(raw, 'cameraHeight'), -1, 3, 0),
    cameraFov: number(own(raw, 'cameraFov'), 50, 90, 64),
    cameraShake: typeof own(raw, 'cameraShake') === 'boolean' ? raw.cameraShake : true,
    musicVolume: number(own(raw, 'musicVolume'), 0, 100, 100),
    effectsVolume: number(own(raw, 'effectsVolume'), 0, 100, 100),
    keybinds: sanitizeKeybinds(own(raw, 'keybinds')),
  };
}

export function loadPlayerSettings(storage) {
  try { return sanitizePlayerSettings(JSON.parse(storage.getItem(PLAYER_SETTINGS_KEY))); }
  catch { return sanitizePlayerSettings(null); }
}

export function savePlayerSettings(storage, value) {
  const settings = sanitizePlayerSettings(value);
  try { storage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings)); }
  catch (cause) { throw new Error('Your browser could not save the settings. Allow storage and try again.', { cause }); }
  return settings;
}
