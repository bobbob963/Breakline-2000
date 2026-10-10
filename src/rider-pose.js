// Shared by the production renderer and the rig regression tests. A grab has
// a deliberate reach, sustained contact, and release instead of a sine peak.
const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

export const GRAB_HOLD_START = .22;
export const GRAB_HOLD_END = .80;

export function grabEnvelope(progress) {
  const t = clamp01(progress);
  if (t < GRAB_HOLD_START) return smooth(t / GRAB_HOLD_START);
  if (t <= GRAB_HOLD_END) return 1;
  return 1 - smooth((t - GRAB_HOLD_END) / (1 - GRAB_HOLD_END));
}

export function sampleRiderTrick(game, { air = !!game.airborne } = {}) {
  const result = {
    spin: air ? game.rotation || 0 : 0,
    flip: air ? game.flipRotation || 0 : 0,
    boardSpin: air ? game.boardRotation || 0 : 0,
    grab: 0, lipGrab: 0, tweak: 0, progress: 0, holdingGrab: false,
    boardBank: 0, boardPitch: 0, boardLift: 0, boardSide: 0, boardBack: 0,
  };
  const trick = air ? game.trick : null;
  if (trick) {
    const progress = clamp01(trick.age / Math.max(.001, trick.duration));
    const bodyProgress = smooth(progress);
    const grabsBoard = trick.grab > 0;
    // Complete a combined flip/shuv before gripping the deck. Independent
    // board rotations during a full grab would twist the feet off the board.
    const boardProgress = grabsBoard ? smooth(progress / .20) : bodyProgress;
    result.spin += bodyProgress * (trick.spin || 0);
    result.flip += boardProgress * (trick.flip || 0);
    result.boardSpin += boardProgress * (trick.boardSpin || 0);
    result.grab = grabsBoard ? grabEnvelope(progress) : 0;
    result.tweak = trick.tweak > 0 ? grabEnvelope(progress) : 0;
    // This is a held, banked surfboard beside a tucked rider. B no longer
    // rotates the whole character through the old barrel-roll animation.
    result.boardBank = .90 * result.tweak;
    result.boardPitch = -.28 * result.tweak;
    result.boardLift = .27 * result.tweak;
    result.boardSide = -.37 * result.tweak;
    result.boardBack = .11 * result.tweak;
    result.progress = progress;
  }
  if (game.lipMove) {
    const progress = Number.isFinite(game.lipMove.progress)
      ? game.lipMove.progress
      : game.lipMove.age / Math.max(.001, game.lipMove.duration);
    result.lipGrab = grabEnvelope(progress);
  } else result.lipGrab = clamp01(game.lipGrab || 0);
  result.holdingGrab = result.grab === 1 || result.lipGrab === 1;
  return result;
}
