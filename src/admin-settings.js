import { ALL_REWARD_BOARD_ORDER, getRewardBoard } from './board-rewards.js';

export const ADMIN_STORAGE_KEY = 'breakline99-admin-v1';
export const ADMIN_SURF_WEATHER_OPTIONS = Object.freeze([
  Object.freeze({ value: 'random', label: 'Random each session' }),
  Object.freeze({ value: 'dawn', label: 'Dawn / first light' }),
  Object.freeze({ value: 'noon', label: 'Noon / clear skies' }),
  Object.freeze({ value: 'sunset', label: 'Sunset / golden hour' }),
  Object.freeze({ value: 'dusk', label: 'Dusk / blue hour' }),
]);
const field = (key, label, min, max, step, initial, unit, description) => Object.freeze({ key, label, min, max, step, default: initial, unit, description });
export const ADMIN_CHARACTER_FIELDS = Object.freeze([
  field('jumpPower', 'Jump power', .25, 3, .05, 1, '×', 'Height from pops, ramps and extra air jumps.'),
  field('gravity', 'Gravity', .25, 2.5, .05, 1, '×', 'Lower values keep your rider in the air longer.'),
  field('trickSpeed', 'Trick speed', .25, 3, .05, 1, '×', 'Higher values finish trick animations faster.'),
  field('landingGrace', 'Landing forgiveness', 0, 1, .01, .16, 'seconds', 'Time allowed to finish a late trick when you touch down.'),
  field('comboWindow', 'Combo link window', .1, 30, .1, 3.8, 'seconds', 'Time on the ground before your combo banks automatically.'),
  field('scoreMultiplier', 'Trick points', 0, 10, .05, 1, '×', 'Multiplier for completed trick points.'),
  field('steering', 'Ground steering', .25, 3, .05, 1, '×', 'Turning response on the wave and factory floor.'),
  field('airControl', 'Air control', .25, 3, .05, 1, '×', 'Steering response while airborne.'),
  field('specialGain', 'Special charge', 0, 5, .1, 1, '×', 'How quickly tricks and banked points fill SPECIAL.'),
]);
export const ADMIN_BOARD_FIELDS = Object.freeze([
  field('baseSpeed', 'Base speed', .25, 3, .05, 1, '×', 'Riding speed before earned trick boosts.'),
  field('acceleration', 'Acceleration', .25, 4, .05, 1, '×', 'How quickly the board reaches its riding speed.'),
  field('boostPower', 'Bonus boost speed', 0, 4, .05, 1, '×', 'Extra speed from landed tricks and combos, including Waterworks.'),
  field('boostDuration', 'Boost duration', .1, 5, .05, 1, '×', 'How long earned trick boosts last.'),
  field('popRecovery', 'Pop cooldown', 0, 3, .05, 1, '×', 'Lower values recover faster. Zero removes the cooldown.'),
  field('extraJumps', 'Extra air jumps', 0, 5, 1, 0, 'jumps', 'Additional Space press-and-release jumps before landing.'),
  field('glideGravity', 'Glide gravity', .1, 1, .01, 1, '×', 'Gravity during descent when a glide fall speed is set.'),
  field('glideFallSpeed', 'Glide fall speed', 0, 12, .1, 0, 'm/s', 'Maximum downward glide speed. Zero switches glide off.'),
]);

const characterIds = ['kai', 'nova', 'reef', 'jax'];
const boardIds = ['standard', ...ALL_REWARD_BOARD_ORDER];
const defaults = fields => Object.fromEntries(fields.map(item => [item.key, item.default]));
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const cleanCheats = value => ({ slowMotion: plain(value) && Object.hasOwn(value, 'slowMotion') && value.slowMotion === true });
const ownCheats = value => plain(value) && Object.hasOwn(value, 'cheats') ? value.cheats : null;
function cleanEnvironment(value) {
  const environment = plain(value) && Object.hasOwn(value, 'environment') ? value.environment : null;
  const candidate = plain(environment) && Object.hasOwn(environment, 'surfWeather') ? environment.surfWeather : null;
  return { surfWeather: ADMIN_SURF_WEATHER_OPTIONS.some(option => option.value === candidate) ? candidate : 'random' };
}
function cleanScope(value, fields, fill = false) {
  const result = fill ? defaults(fields) : {};
  if (!plain(value)) return result;
  for (const item of fields) {
    if (!Object.hasOwn(value, item.key) || typeof value[item.key] !== 'number' || !Number.isFinite(value[item.key])) continue;
    let number = Math.min(item.max, Math.max(item.min, value[item.key]));
    if (item.key === 'extraJumps') number = Math.floor(number);
    result[item.key] = number;
  }
  return result;
}
function cleanMap(value, ids, fields) {
  return Object.fromEntries(ids.filter(id => plain(value) && Object.hasOwn(value, id) && plain(value[id]))
    .map(id => [id, cleanScope(value[id], fields)]));
}
export function sanitizeAdminSettings(value) {
  return {
    version: 1, enabled: value?.enabled === true,
    characters: cleanMap(value?.characters, characterIds, ADMIN_CHARACTER_FIELDS),
    boards: cleanMap(value?.boards, boardIds, ADMIN_BOARD_FIELDS),
    cheats: cleanCheats(ownCheats(value)),
    environment: cleanEnvironment(value),
  };
}
function scopeIds(profile) {
  return {
    character: characterIds.includes(profile?.character) ? profile.character : 'kai',
    board: ALL_REWARD_BOARD_ORDER.includes(profile?.rewardBoard) ? profile.rewardBoard : 'standard',
  };
}
export function getAdminScope(settings, profile) {
  const saved = sanitizeAdminSettings(settings), ids = scopeIds(profile), reward = getRewardBoard(ids.board);
  const boardDefaults = defaults(ADMIN_BOARD_FIELDS);
  if (reward) Object.assign(boardDefaults, {
    baseSpeed: reward.baseSpeedMultiplier, boostPower: reward.boostPowerMultiplier,
    boostDuration: reward.boostDurationMultiplier, popRecovery: reward.popRecoveryMultiplier,
    extraJumps: reward.airJumps, glideGravity: reward.glideGravityMultiplier, glideFallSpeed: reward.glideFallSpeed,
  });
  return {
    character: { ...defaults(ADMIN_CHARACTER_FIELDS), scoreMultiplier: reward?.trickPointsMultiplier ?? 1, ...saved.characters[ids.character] },
    board: { ...boardDefaults, ...saved.boards[ids.board] },
  };
}
export function updateAdminScope(settings, profile, scope, patch) {
  const next = sanitizeAdminSettings(settings), ids = scopeIds(profile);
  const map = scope === 'character' ? 'characters' : scope === 'board' ? 'boards' : null;
  if (map) next[map][ids[scope]] = { ...next[map][ids[scope]], ...cleanScope(patch, scope === 'character' ? ADMIN_CHARACTER_FIELDS : ADMIN_BOARD_FIELDS) };
  return next;
}
export function resetAdminScope(settings, profile) {
  const next = sanitizeAdminSettings(settings), ids = scopeIds(profile);
  delete next.characters[ids.character]; delete next.boards[ids.board];
  return next;
}
export function sanitizeResolvedAdminStats(value) {
  return {
    active: plain(value) && value.active === true,
    character: cleanScope(value?.character, ADMIN_CHARACTER_FIELDS, true),
    board: cleanScope(value?.board, ADMIN_BOARD_FIELDS, true),
    cheats: cleanCheats(ownCheats(value)),
  };
}
export function resolveAdminStats(settings, profile) {
  const saved = sanitizeAdminSettings(settings);
  return sanitizeResolvedAdminStats({ active: saved.enabled, ...getAdminScope(saved, profile), cheats: saved.cheats });
}
