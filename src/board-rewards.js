// Permanent ladder and Time Trial prizes. Rendering and physics share one catalogue.
const defaults = Object.freeze({
  baseSpeedMultiplier: 1, trickPointsMultiplier: 1, boostPowerMultiplier: 1,
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
  afterburner: board('afterburner', 'AFTERBURNER', null, '+25% BASE SPEED / +50% BOOST POWER',
    'Clear your first three Time Trials to earn this turbine deck. Ride 25% faster at base speed and get 50% more bonus speed from earned trick boosts. Warm exhaust bursts off completed tricks.',
    'exhaust', { primary: '#fa732f', secondary: '#352048', accent: '#ffebac' }, { trialClears: 3, baseSpeedMultiplier: 1.25, boostPowerMultiplier: 1.5 }),
  deadtime: board('deadtime', 'DEADTIME', null, 'Q TO SLOW · DOUBLE-TAP Q TO FAST-FORWARD',
    'A secret earned by surviving five minutes in Storm Rider. Tap Q for slow motion or double-tap Q for 2× fast-forward, sharing six seconds of charge. Spend the full charge for 50% more speed for three seconds, then recharge. Clock hands spiral off completed tricks; a green pulse spreads from the board when time slows, and a red pulse spreads when time speeds up.',
    'clock', { primary: '#176a45', secondary: '#112923', accent: '#b7ffd0' }, { hidden: true, slowMotion: true, survivalSeconds: 300 }),
});

// Ladder count and progression depend on this fixed list. Trial prizes are separate.
export const REWARD_BOARD_ORDER = Object.freeze(['guitar', 'lightning', 'vortex', 'solar', 'sky']);
export const TRIAL_REWARD_BOARD_ORDER = Object.freeze(['afterburner']);
export const SECRET_REWARD_BOARD_ORDER = Object.freeze(['deadtime']);
export const ALL_REWARD_BOARD_ORDER = Object.freeze([...REWARD_BOARD_ORDER, ...TRIAL_REWARD_BOARD_ORDER, ...SECRET_REWARD_BOARD_ORDER]);
export function getRewardBoard(id) {
  return typeof id === 'string' && Object.hasOwn(REWARD_BOARDS, id) ? REWARD_BOARDS[id] : null;
}
export function rewardBoardUnlocked(id, progress, trialProgress, secretProgress) {
  const reward = getRewardBoard(id), completed = progress?.completedLadders;
  if (reward?.hidden) return !!secretProgress && Object.hasOwn(secretProgress, 'deadtimeUnlocked') && secretProgress.deadtimeUnlocked === true;
  if (reward?.trialClears) {
    const clears = trialProgress?.completedTrials;
    return completed === REWARD_BOARD_ORDER.length && Number.isInteger(clears) && clears >= reward.trialClears && clears <= 12;
  }
  return !!reward && Number.isInteger(completed) && completed > reward.ladderIndex && completed <= REWARD_BOARD_ORDER.length;
}
