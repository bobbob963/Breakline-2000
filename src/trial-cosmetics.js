// Time Trials award paired clothes and printed deck art. These are cosmetics;
// the five ladder prize boards remain the only equipment with riding perks.
export const TRIAL_COSMETIC_SETS = Object.freeze([
  Object.freeze({ id: 'afterhours', name: 'AFTERHOURS', requiredClears: 3, outfit: 'afterhours', boardDesign: 'afterhours', description: 'Ink-black surf tee, violet panels and a neon-night deck.' }),
  Object.freeze({ id: 'ripcurrent', name: 'RIP CURRENT', requiredClears: 6, outfit: 'ripcurrent', boardDesign: 'ripcurrent', description: 'Seafoam rashguard, deep teal shorts and a breaking-wave deck.' }),
  Object.freeze({ id: 'furnace', name: 'FURNACE', requiredClears: 9, outfit: 'furnace', boardDesign: 'furnace', description: 'Rust-red work crew layers, charcoal cargos and a pressure-gauge deck.' }),
  Object.freeze({ id: 'chronocrew', name: 'CHRONO CREW', requiredClears: 12, outfit: 'chronocrew', boardDesign: 'chronocrew', description: 'Cream racing raglan, checked shorts and a stopwatch championship deck.' }),
]);

export function getTrialCosmeticSet(id) {
  return TRIAL_COSMETIC_SETS.find(set => set.id === id) ?? null;
}

export function trialCosmeticUnlocked(id, completedCount = 0) {
  const set = getTrialCosmeticSet(id);
  return Boolean(set && Number.isFinite(completedCount) && completedCount >= set.requiredClears);
}
