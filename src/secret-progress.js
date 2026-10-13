export const SECRET_STORAGE_KEY = 'breakline99-secrets-v1';
export const DEADTIME_SURVIVAL_SECONDS = 300;

export function sanitizeSecretProgress(value, bestSurvival = 0) {
  const earned = typeof bestSurvival === 'number' && Number.isFinite(bestSurvival) && bestSurvival >= DEADTIME_SURVIVAL_SECONDS;
  return { version: 1, deadtimeUnlocked: earned || (!!value && Object.hasOwn(value, 'deadtimeUnlocked') && value.deadtimeUnlocked === true) };
}

// One continuous Survival run earns the board. Paused time, other modes and
// multiple short runs never accumulate toward the five-minute requirement.
export function awardSurvivalSecret(progress, game) {
  const current = sanitizeSecretProgress(progress);
  const earned = !current.deadtimeUnlocked && game?.mode === 'surf' && game.rulesId === 'storm' &&
    !game.isRace && !game.isTimeTrial && ['running', 'finished'].includes(game.phase) &&
    typeof game.elapsed === 'number' && Number.isFinite(game.elapsed) && game.elapsed >= DEADTIME_SURVIVAL_SECONDS;
  return { progress: earned ? { version: 1, deadtimeUnlocked: true } : current, unlocked: earned };
}
