import { WaveParkGame } from './park.js';
import { SurfRaceGame } from './surf-race.js';
import { ParkRaceGame, createParkRaceCourse } from './park-race.js';
import { TOURNAMENT_LADDERS,sanitizeTournamentProgress,tournamentLadder,recordTournamentWin } from './tournament-progress.js';
export { TOURNAMENT_LADDERS,sanitizeTournamentProgress,tournamentLadder,selectTournamentLadder,nextTournamentLadder } from './tournament-progress.js';

export const TOURNAMENT_SECONDS=90;
export const TOURNAMENT_RIVALS=Object.freeze([
  Object.freeze({id:'moxie',name:'MOXIE',subtitle:'THE LOCAL UPSTART',style:'Through the rust tunnel. Chase the sun rings.',event:'race',venue:'park',pace:.55,profile:Object.freeze({character:'kai',outfit:'sunset',boardColor:'#f5d329',boardDesign:'sunburst'}),rank:5,target:1800,startId:'filters'}),
  Object.freeze({id:'rivet',name:'RIVET',subtitle:'THE POINT BREAK CHARGER',style:'Thread the sun rings. Beat him to the beach.',event:'race',venue:'surf',courseLength:960,pace:.6,profile:Object.freeze({character:'reef',outfit:'neon',boardColor:'#e95b39',boardDesign:'flames'}),rank:4,target:3500,startId:'west'}),
  Object.freeze({id:'undertow',name:'UNDERTOW',subtitle:'THE DRAINAGE RUNNER',style:'Follow the pipes. Boost out of the corners.',event:'race',venue:'park',pace:.72,profile:Object.freeze({character:'jax',outfit:'yardcrew',boardColor:'#f5ede0',boardDesign:'tribal'}),rank:3,target:6000,startId:'filters'}),
  Object.freeze({id:'static',name:'STATIC',subtitle:'THE OPEN WATER ACE',style:'A longer break. A faster rival. Hold your line.',event:'race',venue:'surf',courseLength:1280,pace:.86,profile:Object.freeze({character:'nova',outfit:'static',boardColor:'#24c5ba',boardDesign:'checker'}),rank:2,target:9000,startId:'basin'}),
  Object.freeze({id:'kingtide',name:'KINGTIDE',subtitle:'THE WATERWORKS CHAMPION',style:'One final circuit. Own the whole plant.',event:'race',venue:'park',pace:.9,profile:Object.freeze({character:'jax',outfit:'suncrew',boardColor:'#8755bb',boardDesign:'flames'}),rank:1,target:13000,startId:'filters'}),
]);

export function tournamentCourseLength(rival) {
  return rival.venue==='park'?createParkRaceCourse(rival.id).length:rival.courseLength;
}

export function tournamentRivalsForLadder(progressOrIndex=0) {
  const ladder=tournamentLadder(progressOrIndex);
  if(ladder===TOURNAMENT_LADDERS[0])return TOURNAMENT_RIVALS;
  return Object.freeze(TOURNAMENT_RIVALS.map(rival=>Object.freeze({...rival,
    pace:Math.min(.98,rival.pace+ladder.paceOffset),
    subtitle:`${ladder.name} · ${rival.subtitle}`,
  })));
}

// Recreate the scene at each rank so its real rival and ordered race course
// share that venue's ordinary movement, collisions and trick controls.
export function createTournamentGame(onEvent=()=>{},progress=null) {
  const safe=sanitizeTournamentProgress(progress);
  const roundIndex=Math.min(safe.completedRounds,TOURNAMENT_RIVALS.length-1);
  const rival=tournamentRivalsForLadder(safe)[roundIndex];
  return rival.venue==='surf'
    ?new SurfRaceGame(onEvent,{progress:safe,roundIndex,rival,roundCount:TOURNAMENT_RIVALS.length})
    :new ParkRaceGame(onEvent,{progress:safe,roundIndex,rival,roundCount:TOURNAMENT_RIVALS.length});
}

// Rivals bank at fixed moments. Neither the schedule nor the final target can
// react to the player's points, tricks, wipeouts, position or input.
const RIVAL_BANKS=Object.freeze([
  [.10,.07],[.24,.17],[.41,.31],[.58,.46],[.76,.65],[.90,.84],[1,1],
]);
export function rivalScoreAt(roundIndex,elapsed) {
  const rival=TOURNAMENT_RIVALS[Number.isInteger(roundIndex)&&roundIndex>=0&&roundIndex<TOURNAMENT_RIVALS.length?roundIndex:0];
  const progress=Number.isFinite(elapsed)?Math.max(0,Math.min(1,elapsed/TOURNAMENT_SECONDS)):0;
  let fraction=0;
  for(const[time,points]of RIVAL_BANKS)if(progress+1e-10>=time)fraction=points;
  return Math.floor(rival.target*fraction);
}

export class TournamentGame extends WaveParkGame {
  constructor(onEvent=()=>{},progress=null) {
    // SurfGame calls virtual reset() in its constructor. Keep that first reset
    // private so the application cannot read a half-constructed tournament.
    super(()=>{});
    this.onEvent=onEvent;
    this._tournamentProgress=sanitizeTournamentProgress(progress);
    this.roundIndex=Math.min(this._tournamentProgress.completedRounds,TOURNAMENT_RIVALS.length-1);
    this.reset();
  }

  get rival() {return tournamentRivalsForLadder(this._tournamentProgress)[this.roundIndex]||TOURNAMENT_RIVALS[0];}
  get ladder() {return tournamentLadder(this._tournamentProgress);}
  get ladderIndex() {return this._tournamentProgress?.ladderIndex||0;}
  get allLaddersComplete() {return this._tournamentProgress?.completedLadders===TOURNAMENT_LADDERS.length;}
  get target() {return this.rival.target;}
  get roundNumber() {return this.roundIndex+1;}
  get complete() {return this._tournamentProgress?.completedRounds===TOURNAMENT_RIVALS.length;}
  getProgress() {return {...this._tournamentProgress};}

  reset() {
    const callback=this.onEvent;
    this.onEvent=()=>{};
    try {super.reset();} finally {this.onEvent=callback;}
    this.roundIndex=Number.isInteger(this.roundIndex)&&this.roundIndex>=0&&this.roundIndex<TOURNAMENT_RIVALS.length?this.roundIndex:0;
    this._tournamentProgress??=sanitizeTournamentProgress(null);
    this.isTournament=true;
    this.time=TOURNAMENT_SECONDS;
    this.rivalScore=0;
    this.result=null;
    this.unlockedBoardId=null;
    this._finishing=false;
    this.updateObjective();
    this.onEvent({type:'reset',tournament:true,roundIndex:this.roundIndex});
  }

  updateObjective() {
    this.objectiveText=`HEAT ${this.roundNumber}/5 · BEAT ${this.rival.name} · BANK MORE THAN ${this.target.toLocaleString('en-GB')}`;
  }

  start(startId=this.rival.startId) {super.start(startId);return true;}
  retry(startId=this.rival.startId) {return this.start(startId);}
  restart(startId=this.rival.startId) {return this.retry(startId);}
  nextRound(startId) {
    if(this.phase!=='finished'||this.result!=='win'||this.roundIndex>=TOURNAMENT_RIVALS.length-1)return false;
    this.roundIndex++;
    return this.start(startId??this.rival.startId);
  }

  stepPark(dt,input,worldDt=dt) {
    if(this.phase!=='running')return;
    const remaining=TOURNAMENT_SECONDS-this.elapsed;
    // Reuse every collision/control substep, but stop at this heat's buzzer.
    // The superclass's 120-second finish branch is never reached.
    if(remaining>1e-9){const fraction=worldDt>0?Math.min(1,remaining/worldDt):1;super.stepPark(dt*fraction,input,worldDt*fraction);}
    this.time=Math.max(0,TOURNAMENT_SECONDS-this.elapsed);
    this.rivalScore=rivalScoreAt(this.roundIndex,this.elapsed);
    if(this.time<=1e-9) {
      this.elapsed=TOURNAMENT_SECONDS;this.time=0;this.rivalScore=this.target;
      this.finish();
    }
  }

  finish(reason) {
    if(this.phase!=='running'||this._finishing)return false;
    this._finishing=true;
    if(this.airborne||this.bailTime>0||this.grinding||this.pipeRide||this.lipMove||this.cutbackActive)this.clearCombo();
    else this.bank();
    this.cancelCutback();
    this.grinding=null;
    this.rampReturn=null;
    this.trick=null;
    this.lastCompletedTrickType=null;
    this.result=this.lives!==0&&this.score>this.target?'win':'loss';
    if(this.result==='win') {
      const before=this._tournamentProgress.completedLadders;
      this._tournamentProgress=recordTournamentWin(this._tournamentProgress,this.roundIndex);
      this.unlockedBoardId=this._tournamentProgress.completedLadders>before?this.ladder.rewardId:null;
    }
    this.resultReason=reason==='OUT OF LIVES'?reason:this.result==='win'?(this.complete?'CHAMPION':'RIVAL BEATEN'):this.score===this.target?'TIE - RIVAL HOLDS RANK':'TARGET NOT BEATEN';
    this.phase='finished';
    this.onEvent({type:'finish',tournament:true,reason:this.resultReason,result:this.result,roundIndex:this.roundIndex,roundNumber:this.roundNumber,rival:this.rival,target:this.target,score:this.score,complete:this.complete,progress:this.getProgress(),ladderIndex:this.ladderIndex,ladder:this.ladder,allLaddersComplete:this.allLaddersComplete,unlockedBoardId:this.unlockedBoardId});
    return true;
  }
}
