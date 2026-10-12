import { WaveParkGame } from './park.js';
import { SurfRaceGame } from './surf-race.js';

export const TOURNAMENT_SECONDS=90;
export const TOURNAMENT_RIVALS=Object.freeze([
  Object.freeze({id:'moxie',name:'MOXIE',subtitle:'THE LOCAL UPSTART',style:'Clean airs. No hesitation.',event:'score',rank:5,target:1800,startId:'filters'}),
  Object.freeze({id:'rivet',name:'RIVET',subtitle:'THE POINT BREAK CHARGER',style:'Thread the buoys. Beat him to the beach.',event:'race',courseLength:960,pace:.6,profile:Object.freeze({character:'reef',outfit:'neon',boardColor:'#e95b39',boardDesign:'flames'}),rank:4,target:3500,startId:'west'}),
  Object.freeze({id:'undertow',name:'UNDERTOW',subtitle:'THE BOWL REGULAR',style:'Deep transitions. Heavy scores.',event:'score',rank:3,target:6000,startId:'filters'}),
  Object.freeze({id:'static',name:'STATIC',subtitle:'THE OPEN WATER ACE',style:'A longer break. A faster rival. Hold your line.',event:'race',courseLength:1280,pace:.86,profile:Object.freeze({character:'nova',outfit:'static',boardColor:'#24c5ba',boardDesign:'checker'}),rank:2,target:9000,startId:'basin'}),
  Object.freeze({id:'kingtide',name:'KINGTIDE',subtitle:'THE WATERWORKS CHAMPION',style:'One final heat. Own the whole park.',event:'score',rank:1,target:13000,startId:'filters'}),
]);

// Recreate the scene when a ladder rung changes: score heats use Waterworks,
// while the two ocean rounds share Surf Session's controls and wave physics.
export function createTournamentGame(onEvent=()=>{},progress=null) {
  const safe=sanitizeTournamentProgress(progress);
  const roundIndex=Math.min(safe.completedRounds,TOURNAMENT_RIVALS.length-1);
  const rival=TOURNAMENT_RIVALS[roundIndex];
  return rival.event==='race'
    ?new SurfRaceGame(onEvent,{progress:safe,roundIndex,rival,roundCount:TOURNAMENT_RIVALS.length})
    :new TournamentGame(onEvent,safe);
}

// Saved data can unlock only an existing rung; strings, inherited fields and
// out-of-range values must not quietly turn a corrupt save into a championship.
export function sanitizeTournamentProgress(value) {
  const valid=value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.hasOwn(value,'version')&&value.version===1&&
    Object.hasOwn(value,'completedRounds')&&Number.isInteger(value.completedRounds)&&
    value.completedRounds>=0&&value.completedRounds<=TOURNAMENT_RIVALS.length;
  return {version:1,completedRounds:valid?value.completedRounds:0};
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

  get rival() {return TOURNAMENT_RIVALS[this.roundIndex]||TOURNAMENT_RIVALS[0];}
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

  stepPark(dt,input) {
    if(this.phase!=='running')return;
    const remaining=TOURNAMENT_SECONDS-this.elapsed;
    // Reuse every collision/control substep, but stop at this heat's buzzer.
    // The superclass's 120-second finish branch is never reached.
    if(remaining>1e-9)super.stepPark(Math.min(dt,remaining),input);
    this.time=Math.max(0,TOURNAMENT_SECONDS-this.elapsed);
    this.rivalScore=rivalScoreAt(this.roundIndex,this.elapsed);
    if(this.time<=1e-9) {
      this.elapsed=TOURNAMENT_SECONDS;this.time=0;this.rivalScore=this.target;
      this.finish();
    }
  }

  finish() {
    if(this.phase!=='running'||this._finishing)return false;
    this._finishing=true;
    if(this.airborne||this.bailTime>0||this.grinding||this.pipeRide||this.lipMove||this.cutbackActive)this.clearCombo();
    else this.bank();
    this.cancelCutback();
    this.grinding=null;
    this.rampReturn=null;
    this.trick=null;
    this.lastCompletedTrickType=null;
    this.result=this.score>this.target?'win':'loss';
    if(this.result==='win')this._tournamentProgress.completedRounds=Math.max(this._tournamentProgress.completedRounds,this.roundIndex+1);
    this.resultReason=this.result==='win'?(this.complete?'CHAMPION':'RIVAL BEATEN'):this.score===this.target?'TIE - RIVAL HOLDS RANK':'TARGET NOT BEATEN';
    this.phase='finished';
    this.onEvent({type:'finish',tournament:true,reason:this.resultReason,result:this.result,roundIndex:this.roundIndex,roundNumber:this.roundNumber,rival:this.rival,target:this.target,score:this.score,complete:this.complete,progress:this.getProgress()});
    return true;
  }
}
