// The underground ladder has its own save. Replaying it never removes prizes
// or changes qualification for the original five ladders and Time Trials.
export const SEWER_STORAGE_KEY = 'breakline99-sewer-v1';
export const SEWER_RACES = Object.freeze([
  ['sluice-intro','SLUICE RUN','sewer-run','DRAIN RAT','reef',0],
  ['low-pressure','LOW PRESSURE','sewer-depths','VALVE','nova',.015],
  ['green-line','GREEN LINE','sewer-run','RUST','jax',.03],
  ['deep-end','DEEP END','sewer-depths','NIGHT SHIFT','kai',.045],
  ['last-flush','LAST FLUSH','sewer-depths','SLUDGE KING','jax',.06],
].map(([id,name,trackId,rivalName,character,paceOffset],index)=>Object.freeze({id,name,trackId,rivalName,character,paceOffset,index})));
export const SEWER_OUTFIT_REWARDS = Object.freeze([
  Object.freeze({id:'draincrew',name:'DRAIN CREW',requiredWins:2}),
  Object.freeze({id:'nightshift',name:'NIGHT SHIFT',requiredWins:4}),
]);
export const SEWER_BOARD_REWARD = 'sludge';
export function freshSewerProgress() {return {version:1,completedRaces:0,earnedWins:0,bestTimes:SEWER_RACES.map(()=>null)};}

export function sanitizeSewerProgress(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(value,'version')||value.version!==1)return freshSewerProgress();
  const validCount=key=>Object.hasOwn(value,key)&&Number.isInteger(value[key])&&value[key]>=0&&value[key]<=SEWER_RACES.length;
  if(!validCount('completedRaces')||!validCount('earnedWins')||value.completedRaces>value.earnedWins)return freshSewerProgress();
  const times=Object.hasOwn(value,'bestTimes')&&Array.isArray(value.bestTimes)?value.bestTimes:[];
  return {version:1,completedRaces:value.completedRaces,earnedWins:value.earnedWins,
    bestTimes:SEWER_RACES.map((_,i)=>i<value.earnedWins&&Number.isFinite(times[i])&&times[i]>0?times[i]:null)};
}
export function currentSewerRace(progress) {return SEWER_RACES[Math.min(sanitizeSewerProgress(progress).completedRaces,SEWER_RACES.length-1)];}
export function sewerLadderComplete(progress) {return sanitizeSewerProgress(progress).completedRaces===SEWER_RACES.length;}
export function sewerOutfitUnlocked(id,progress) {
  const outfit=SEWER_OUTFIT_REWARDS.find(reward=>reward.id===id);
  return !!outfit&&sanitizeSewerProgress(progress).earnedWins>=outfit.requiredWins;
}
export function sewerBoardUnlocked(id,progress) {return id===SEWER_BOARD_REWARD&&sanitizeSewerProgress(progress).earnedWins===SEWER_RACES.length;}
export function resetSewerLadder(progress) {return {...sanitizeSewerProgress(progress),completedRaces:0};}
export function unlockAllSewerRewards(progress) {return {...sanitizeSewerProgress(progress),completedRaces:SEWER_RACES.length,earnedWins:SEWER_RACES.length};}

// A caller cannot skip rivals, count losses or duplicate a finish event. A
// genuine replay improves the best time while retaining permanent unlocks.
export function recordSewerResult(progress,raceId,result) {
  const safe=sanitizeSewerProgress(progress),race=SEWER_RACES[safe.completedRaces];
  if(!race||race.id!==raceId||result?.result!=='win'||!Number.isFinite(result.elapsed)||result.elapsed<=0)return safe;
  const completedRaces=safe.completedRaces+1,bestTimes=[...safe.bestTimes];
  bestTimes[race.index]=Math.min(bestTimes[race.index]??Infinity,result.elapsed);
  return {...safe,completedRaces,earnedWins:Math.max(safe.earnedWins,completedRaces),bestTimes};
}
