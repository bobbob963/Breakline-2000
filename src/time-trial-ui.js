import { TIME_TRIALS } from './time-trials.js';
import { TRIAL_COSMETIC_SETS } from './trial-cosmetics.js';

export function trialTime(seconds) {
  if(!Number.isFinite(seconds))return '—';
  const centiseconds=Math.max(0,Math.round(seconds*100));
  return `${Math.floor(centiseconds/6000)}:${String(Math.floor(centiseconds/100)%60).padStart(2,'0')}.${String(centiseconds%100).padStart(2,'0')}`;
}
export function trialRewardCards(progress,{equip=false}={}) {
  return `<div class="trial-rewards">${TRIAL_COSMETIC_SETS.map(set=>{
    const earned=progress.completedTrials>=set.requiredClears;
    return `<article class="${earned?'earned':''}"><small>${earned?'UNLOCKED':`CLEAR ${set.requiredClears} TRIALS`}</small><b>${set.name}</b><span>OUTFIT + DECK GRAPHIC</span>${equip&&earned?`<button type="button" data-trial-equip="${set.id}">EQUIP SET</button>`:''}</article>`;
  }).join('')}</div>`;
}
export function trialListMarkup(progress) {
  return `<p>Ten wave runs. Two full-plant Waterworks circuits. Pass every sun ring and beat the target. Land tricks for boosts.</p><p class="trial-total">${progress.completedTrials} / ${TIME_TRIALS.length} CLEARED · REWARDS EVERY 3 FIRST-TIME CLEARS</p>${trialRewardCards(progress,{equip:true})}<div class="trial-list">${TIME_TRIALS.map((trial,index)=>{
    const locked=index>progress.completedTrials,cleared=index<progress.completedTrials,selected=index===progress.selectedTrial;
    const best=progress.bestTimes?.[index];
    return `<button type="button" data-trial="${index}" ${locked?'disabled':''} class="${selected?'selected':''}"><b>${String(index+1).padStart(2,'0')}</b><span><strong>${trial.name}</strong><small>${trial.venue==='park'?'WATERWORKS / LONG CIRCUIT':'WAVE RUN'} · TARGET ${trialTime(trial.timeLimit)}</small><small>${best!=null?`BEST ${trialTime(best)}`:cleared?'CLEARED':locked?'CLEAR PREVIOUS TRIAL':'READY TO RIDE'}</small></span><em>${locked?'LOCKED':selected?'SELECTED':cleared?'REPLAY':'SELECT'}</em></button>`;
  }).join('')}</div>`;
}
