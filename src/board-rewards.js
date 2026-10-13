// Permanent ladder prizes. Rendering and physics read the same catalogue.
const defaults = Object.freeze({
  trickPointsMultiplier: 1, boostPowerMultiplier: 1,
  boostDurationMultiplier: 1, popRecoveryMultiplier: 1, airJumps: 0,
  glideGravityMultiplier: 1, glideFallSpeed: 0,
});
const board = (id, name, ladderIndex, buffLabel, description, vfx, colors, buffs) => Object.freeze({
  ...defaults, id, name, ladderIndex, buffLabel, description, vfx,
  colors: Object.freeze(colors), ...buffs,
});

export const REWARD_BOARDS = Object.freeze({
  guitar: board('guitar', 'AMPLIFIER', 0, '+25% TRICK POINTS',
    'Electric-guitar deck. Completed tricks score 25% more; musical notes burst from every trick.',
    'notes', { primary: '#df562d', secondary: '#211829', accent: '#ffcf70' }, { trickPointsMultiplier: 1.25 }),
  lightning: board('lightning', 'LIVE WIRE', 1, '+25% RACE BOOST POWER',
    'Lightning deck. Landed race boosts push 25% harder; painted NICE!, WOW! and other graffiti tags burst off completed tricks with electric sparks.',
    'graffiti', { primary: '#f1e764', secondary: '#171f43', accent: '#8cecff' }, { boostPowerMultiplier: 1.25 }),
  vortex: board('vortex', 'UNDERTOW', 2, '+35% RACE BOOST DURATION',
    'Vortex deck. Landed race boosts last 35% longer; spiralling water curls around completed tricks.',
    'vortex', { primary: '#27bcb5', secondary: '#122443', accent: '#affff0' }, { boostDurationMultiplier: 1.35 }),
  solar: board('solar', 'SOLAR FLARE', 3, '25% FASTER POP RECOVERY',
    'Sunburst deck. Recover between pops 25% sooner; sharp solar flares punctuate every trick.',
    'flare', { primary: '#ef712d', secondary: '#45204a', accent: '#fff4aa' }, { popRecoveryMultiplier: .75 }),
  sky: board('sky', 'SKYBOUND', 4, 'ANGEL GLIDE + EXTRA AIR JUMP',
    'Winged deck. Angel wings open around the board as you glide gently down after each jump. Release Space again after your trick for one extra air jump per flight.',
    'wind', { primary: '#8db5ed', secondary: '#252d5e', accent: '#f3ffff' }, { airJumps: 1, glideGravityMultiplier: .32, glideFallSpeed: 3.6 }),
});

export const REWARD_BOARD_ORDER = Object.freeze(Object.keys(REWARD_BOARDS));
export function getRewardBoard(id) {
  return typeof id === 'string' && Object.hasOwn(REWARD_BOARDS, id) ? REWARD_BOARDS[id] : null;
}
export function rewardBoardUnlocked(id, progress) {
  const reward = getRewardBoard(id), completed = progress?.completedLadders;
  return !!reward && Number.isInteger(completed) && completed > reward.ladderIndex && completed <= REWARD_BOARD_ORDER.length;
}
