export const TIME_POWER_DOUBLE_TAP_SECONDS = .28;

// Resolve a single press on the game clock, so pausing or changing sessions
// cannot leave a browser timer armed behind a menu. A second press consumes
// the pending single press before fast-forward starts.
export function createTimePowerInput(getGame) {
  let pending = null;
  let playerDelta = 0;
  const cancel = () => { pending = null; };
  const valid = game => !!pending && pending.game === game && game.timePowerEligible &&
    pending.revision === game.timePowerRevision && pending.mode === game.timePowerMode &&
    pending.sessionMode === game.mode && pending.rulesId === game.rulesId &&
    !(Number.isFinite(game.elapsed) && game.elapsed < pending.elapsed);
  const single = game => {
    const allowed = valid(game);
    cancel();
    return allowed ? game.toggleTimePower() : false;
  };
  const advance = (game, dt) => {
    if (!(dt > 0)) return 0;
    const worldDelta = game?.updateTimePower?.(dt) ?? dt;
    playerDelta += game?.timePowerPlayerDelta ?? dt;
    return worldDelta;
  };
  return {
    cancel,
    get playerDelta() { return playerDelta; },
    press(timestamp) {
      const game = getGame();
      if (!game?.timePowerEligible) { cancel(); return false; }
      if (pending && !valid(game)) cancel();
      if (pending) {
        const elapsed = Number.isFinite(timestamp) && Number.isFinite(pending.timestamp)
          ? (timestamp - pending.timestamp) / 1000 : TIME_POWER_DOUBLE_TAP_SECONDS - pending.remaining;
        if (elapsed >= 0 && elapsed <= TIME_POWER_DOUBLE_TAP_SECONDS) {
          cancel();
          return game.fastForwardTimePower();
        }
        // A delayed event must not turn two separated presses into a double.
        if (elapsed >= 0) single(game);
        else cancel();
      }
      pending = { game, timestamp, remaining:TIME_POWER_DOUBLE_TAP_SECONDS,
        revision:game.timePowerRevision, mode:game.timePowerMode, elapsed:game.elapsed,
        sessionMode:game.mode, rulesId:game.rulesId };
      return true;
    },
    update(dt) {
      playerDelta = 0;
      if (!Number.isFinite(dt) || dt <= 0) return 0;
      const game = getGame();
      if (!valid(game)) { cancel(); return advance(game,dt); }
      const before = Math.min(dt,pending.remaining);
      const simulatedBefore = advance(game,before);
      pending.remaining -= before;
      if (pending.remaining > 1e-10) return simulatedBefore;
      single(game);
      return simulatedBefore + advance(game,Math.max(0,dt-before));
    },
  };
}
