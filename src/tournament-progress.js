// Permanent rewards and the selected ladder are separate: replaying a clear
// never takes away a board or grants it twice.
export const TOURNAMENT_ROUNDS=5;
export const TOURNAMENT_LADDERS=Object.freeze([
  Object.freeze({id:'amplifier',name:'AMPLIFIER',rewardId:'guitar',paceOffset:0,description:'Turn up the coast. Earn the guitar board.'}),
  Object.freeze({id:'live-wire',name:'LIVE WIRE',rewardId:'lightning',paceOffset:.02,description:'A faster current. Earn the lightning board.'}),
  Object.freeze({id:'undertow',name:'UNDERTOW',rewardId:'vortex',paceOffset:.04,description:'Own the deep line. Earn the vortex board.'}),
  Object.freeze({id:'solar-flare',name:'SOLAR FLARE',rewardId:'solar',paceOffset:.06,description:'Ride the heat. Earn the solar board.'}),
  Object.freeze({id:'skybound',name:'SKYBOUND',rewardId:'sky',paceOffset:.08,description:'The final five. Earn the double-jump board.'}),
]);
const fresh=()=>({version:2,ladderIndex:0,completedRounds:0,completedLadders:0});
const ownInt=(value,key,min,max)=>Object.hasOwn(value,key)&&Number.isInteger(value[key])&&value[key]>=min&&value[key]<=max;

export function sanitizeTournamentProgress(value) {
  if(value===null||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(value,'version'))return fresh();
  // Existing champions keep their win and receive their first board. Other
  // legacy saves resume the same rival in the first ladder.
  if(value.version===1&&ownInt(value,'completedRounds',0,TOURNAMENT_ROUNDS))return {
    version:2,ladderIndex:0,completedRounds:value.completedRounds,completedLadders:value.completedRounds===TOURNAMENT_ROUNDS?1:0,
  };
  if(value.version!==2||!ownInt(value,'ladderIndex',0,TOURNAMENT_LADDERS.length-1)||
    !ownInt(value,'completedRounds',0,TOURNAMENT_ROUNDS)||!ownInt(value,'completedLadders',0,TOURNAMENT_LADDERS.length))return fresh();
  const {ladderIndex,completedRounds,completedLadders}=value;
  if(ladderIndex>completedLadders||completedRounds===TOURNAMENT_ROUNDS&&completedLadders<=ladderIndex)return fresh();
  return {version:2,ladderIndex,completedRounds,completedLadders};
}

export function tournamentLadder(value) {
  const index=Number.isInteger(value)?value:sanitizeTournamentProgress(value).ladderIndex;
  return TOURNAMENT_LADDERS[index]||TOURNAMENT_LADDERS[0];
}

// Selecting an unlocked ladder deliberately starts its five-race replay.
// Passing the currently active save straight to the factory resumes its rank.
export function selectTournamentLadder(progress,index) {
  const safe=sanitizeTournamentProgress(progress);
  if(!Number.isInteger(index)||index<0||index>=TOURNAMENT_LADDERS.length||index>safe.completedLadders)return null;
  return {...safe,ladderIndex:index,completedRounds:0};
}

export function nextTournamentLadder(progress) {
  const safe=sanitizeTournamentProgress(progress);
  if(safe.completedRounds!==TOURNAMENT_ROUNDS)return null;
  return selectTournamentLadder(safe,safe.ladderIndex+1);
}

export function recordTournamentWin(progress,roundIndex) {
  const safe=sanitizeTournamentProgress(progress);
  if(!Number.isInteger(roundIndex)||roundIndex<0||roundIndex>=TOURNAMENT_ROUNDS)return safe;
  const completedRounds=Math.max(safe.completedRounds,roundIndex+1);
  const completedLadders=completedRounds===TOURNAMENT_ROUNDS?Math.max(safe.completedLadders,safe.ladderIndex+1):safe.completedLadders;
  return {...safe,completedRounds,completedLadders};
}
