import { sanitizeTournamentProgress, TOURNAMENT_LADDERS } from './tournament-progress.js';
import { sanitizeTimeTrialProgress, TIME_TRIALS } from './time-trial-progress.js';

export function everythingUnlocked(tournament, trials) {
  const currentTournament = sanitizeTournamentProgress(tournament);
  const currentTrials = sanitizeTimeTrialProgress(trials);
  return {
    tournament: { ...currentTournament, completedLadders: TOURNAMENT_LADDERS.length },
    trials: { ...currentTrials, completedTrials: TIME_TRIALS.length },
  };
}

// Persist a set of changes together, restoring the previous save if a write fails.
export function persistAdminEntries(storage, entries) {
  const previous = entries.map(([key]) => [key, storage.getItem(key)]);
  try {
    for (const [key, value] of entries) storage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of previous) {
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { /* Report the original storage failure. */ }
    }
    throw new Error('Your browser could not save the changes. Please allow storage and try again.', { cause: error });
  }
}

export function resetBreaklineSave(storage) {
  const previous = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith('breakline99-')) previous.push([key, storage.getItem(key)]);
  }
  try {
    for (const [key] of previous) storage.removeItem(key);
  } catch (error) {
    for (const [key, value] of previous) {
      try { storage.setItem(key, value); } catch { /* Report the original storage failure. */ }
    }
    throw new Error('Your browser could not reset the save. Please allow storage and try again.', { cause: error });
  }
  return previous.length;
}
