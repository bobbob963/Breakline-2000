import { sanitizeTournamentProgress,TOURNAMENT_LADDERS } from './tournament-progress.js';

const descriptors=[
  ['first-light','FIRST LIGHT','surf',780,43],
  ['salt-sprint','SALT SPRINT','surf',900,47],
  ['blue-hour','BLUE HOUR','surf',1040,52],
  ['coast-runner','COAST RUNNER','surf',1180,56],
  ['reef-line','REEF LINE','surf',1320,61],
  ['outfall-run','OUTFALL RUN','park',1593.6514249542115,94],
  ['tidal-shift','TIDAL SHIFT','surf',1460,65],
  ['deep-cut','DEEP CUT','surf',1600,69],
  ['whitewater','WHITEWATER','surf',1740,73],
  ['redline-swell','REDLINE SWELL','surf',1880,77],
  ['last-break','LAST BREAK','surf',2000,80],
  ['final-discharge','FINAL DISCHARGE','park',1939.141337137472,98],
];

export const TIME_TRIALS=Object.freeze(descriptors.map(([id,name,venue,courseLength,timeLimit],index)=>Object.freeze({
  id,name,venue,courseLength,length:courseLength,timeLimit,index,number:index+1,stage:index===11?1:0,
  description:venue==='park'?'An extended factory circuit. Clear every sun ring before the clock expires.':'Hold the wave, thread every sun ring and land tricks for extra speed.',
})));
const fresh=()=>({version:1,completedTrials:0,selectedTrial:0,bestTimes:Array(TIME_TRIALS.length).fill(null)});

export function sanitizeTimeTrialProgress(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(value,'version')||value.version!==1||
    !Object.hasOwn(value,'completedTrials')||!Number.isInteger(value.completedTrials)||value.completedTrials<0||value.completedTrials>TIME_TRIALS.length)return fresh();
  const completedTrials=value.completedTrials,maxIndex=Math.min(completedTrials,TIME_TRIALS.length-1);
  const selectedTrial=Object.hasOwn(value,'selectedTrial')&&Number.isInteger(value.selectedTrial)&&value.selectedTrial>=0&&value.selectedTrial<=maxIndex?value.selectedTrial:maxIndex;
  const times=Object.hasOwn(value,'bestTimes')&&Array.isArray(value.bestTimes)?value.bestTimes:[];
  const bestTimes=TIME_TRIALS.map((trial,index)=>index<completedTrials&&Number.isFinite(times[index])&&times[index]>0&&times[index]<=trial.timeLimit?times[index]:null);
  return {version:1,completedTrials,selectedTrial,bestTimes};
}

export function timeTrialsUnlocked(tournamentProgress) {
  // completedLadders is permanent even when the player replays or resets a ladder.
  return sanitizeTournamentProgress(tournamentProgress).completedLadders===TOURNAMENT_LADDERS.length;
}

export function selectTimeTrial(progress,index) {
  const safe=sanitizeTimeTrialProgress(progress);
  if(!Number.isInteger(index)||index<0||index>=TIME_TRIALS.length||index>safe.completedTrials)return null;
  return {...safe,selectedTrial:index};
}

export function recordTimeTrialWin(progress,index,time) {
  const safe=sanitizeTimeTrialProgress(progress),trial=TIME_TRIALS[index];
  if(!Number.isInteger(index)||!trial||index>safe.completedTrials||!Number.isFinite(time)||time<=0||time>trial.timeLimit+1e-9)return safe;
  const bestTimes=[...safe.bestTimes];
  bestTimes[index]=Math.min(bestTimes[index]??Infinity,time,trial.timeLimit);
  const firstClear=index===safe.completedTrials;
  return {...safe,completedTrials:Math.max(safe.completedTrials,index+1),selectedTrial:firstClear?Math.min(index+1,TIME_TRIALS.length-1):safe.selectedTrial,bestTimes};
}
