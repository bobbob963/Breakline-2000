import { SurfGame, courseItem, waveHeight, clamp } from './game.js';

export const RACE_COUNTDOWN=3;
export const RACE_GATE_RADIUS=5.7;
export const RACE_BOOST_MAX_SPEED=13;
export const RACE_BOOST_MAX_DURATION=3;
const RACE_RESET_DISTANCE=14;
const FALLBACK_RIVAL=Object.freeze({id:'rivet',name:'RIVET',courseLength:960,pace:.6,target:3500});

// The visible ring and the swept board/rider crossing share this moving centre.
export function surfRaceRingY(checkpoint,time) {
  return waveHeight(checkpoint.x,-checkpoint.distance,time)+2.8;
}

export function createRaceCourse(length=960) {
  length=Number.isFinite(length)?clamp(length,600,2000):960;
  const lanes=[-4,5,-5,3,0,-4,4],checkpoints=[];
  for(let distance=150;distance<length-60;distance+=180) {
    const index=checkpoints.length;
    checkpoints.push(Object.freeze({index,distance,x:lanes[index%lanes.length],radius:RACE_GATE_RADIUS}));
  }
  return Object.freeze({length,checkpoints:Object.freeze(checkpoints)});
}

// The opponent reads only its own position, the public course and its own
// clock. Player position, score and inputs cannot make it catch up or slow down.
export function raceOpponentInput(rider,course,pace=.6) {
  const checkpoint=course.checkpoints[rider.nextCheckpoint];
  const gateAhead=checkpoint?checkpoint.distance-rider.distance:Infinity;
  let target=gateAhead<115?checkpoint.x:Math.sin(rider.distance*.012)*2;
  const first=Math.max(0,Math.floor((rider.distance-rider.rules.firstGate)/rider.rules.spacing)-1);
  for(let index=first;index<=first+3;index++) {
    const reef=courseItem(index,'surf'),ahead=reef.hazardDistance-rider.distance;
    if(ahead< -4||ahead>66)continue;
    const clearance=reef.hazardRadius+1.8;
    if(Math.abs(target-reef.hazardX)<clearance) {
      const left=reef.hazardX-clearance,right=reef.hazardX+clearance;
      target=Math.abs(left-target)<Math.abs(right-target)?left:right;
      if(target< -12)target=right;if(target>12)target=left;
    }
    // Only the closest reef should influence the immediate line.
    break;
  }
  target=clamp(target,-11.5,12.5);
  const error=target-rider.x-rider.vx*.13;
  return {left:error<-.2,right:error>.2,pump:(rider.elapsed%5)<5*clamp(pace,0,1)};
}

function prepareRacer(rider,x) {
  // An ocean race ends at the finish, never at Surf Session's time limit.
  // Retain all surf speeds, currents, reef footprints and landing rules.
  rider.rules={...rider.rules,endless:true};
  rider.x=x;rider.y=waveHeight(x,0,0);rider.nextCheckpoint=0;
  rider.raceMisses=0;rider.finishTime=null;
}

function suppressScoreRings(rider) {
  // Race flags replace the ordinary point rings. Keep the matching reef
  // descriptors active, but do not award invisible ring bonuses or sounds.
  const index=Math.max(0,Math.floor((rider.distance-rider.rules.firstGate)/rider.rules.spacing));
  rider.processed.add(`g${index}`);rider.processed.add(`g${index+1}`);
}

function resolveRaceMovement(rider,previous,course,emit) {
  const checkpoint=course.checkpoints[rider.nextCheckpoint];
  if(checkpoint&&previous.distance<=checkpoint.distance&&rider.distance>=checkpoint.distance) {
    const fraction=clamp((checkpoint.distance-previous.distance)/(rider.distance-previous.distance||1),0,1);
    const crossingX=previous.x+(rider.x-previous.x)*fraction;
    const crossingY=previous.y+(rider.y-previous.y)*fraction+1;
    const crossingTime=previous.elapsed+(rider.elapsed-previous.elapsed)*fraction;
    const ringY=surfRaceRingY(checkpoint,crossingTime);
    const inside=Math.hypot(crossingX-checkpoint.x,crossingY-ringY)<=checkpoint.radius;
    if(inside&&rider.bailTime<=0) {
      rider.nextCheckpoint++;
      emit({type:'raceGate',index:checkpoint.index,total:course.checkpoints.length});
    } else {
      rider.distance=checkpoint.distance-RACE_RESET_DISTANCE;
      rider.speed=8;rider.vx=0;rider.vy=0;rider.airborne=false;rider.trick=null;
      rider.charge=0;rider.cutbackActive=false;rider.cutback=0;
      rider.cutbackLaunchTime=0;rider.popRecovery=1.4;
      rider.rotation=0;rider.flipRotation=0;rider.boardRotation=0;rider.rollRotation=0;
      rider.y=waveHeight(rider.x,-rider.distance,rider.elapsed);
      rider.clearCombo();rider.raceMisses++;
      rider.clearRaceBoost?.();
      emit({type:'raceMiss',index:checkpoint.index,distance:checkpoint.distance});
    }
  }
  if(rider.nextCheckpoint===course.checkpoints.length&&rider.distance>=course.length&&rider.bailTime<=0) {
    return previous.distance>=course.length?0:clamp((course.length-previous.distance)/(rider.distance-previous.distance||1),0,1);
  }
  return null;
}

export class SurfRaceGame extends SurfGame {
  constructor(onEvent=()=>{},options={}) {
    super(()=>{});
    this.onEvent=onEvent;
    this.roundIndex=Number.isInteger(options.roundIndex)?options.roundIndex:1;
    this.roundCount=options.roundCount||5;
    this._rival=options.rival||FALLBACK_RIVAL;
    this._tournamentProgress={version:1,completedRounds:options.progress?.completedRounds||0};
    this.reset();
  }
  get rival(){return this._rival||FALLBACK_RIVAL;}
  get target(){return this.rival.target;}
  get roundNumber(){return (this.roundIndex??1)+1;}
  get complete(){return this._tournamentProgress?.completedRounds===this.roundCount;}
  getProgress(){return {...this._tournamentProgress};}
  get raceProgress(){return this.distance;}
  get opponentRaceProgress(){return this.opponent?.distance??0;}
  get racePosition(){return this.result?(this.result==='win'?1:2):this.distance>=(this.opponent?.distance??0)?1:2;}
  get lead(){return this.distance-(this.opponent?.distance??0);}
  get distanceRemaining(){return Math.max(0,this.course.length-this.distance);}
  get forwardSpeedBonus(){return this.boostTime>0?this.boostSpeed:0;}
  get popReady(){return this.countdownRemaining<=0&&super.popReady;}
  doCutback(direction=0){return this.countdownRemaining<=0&&super.doCutback(direction);}
  clearRaceBoost() {
    this.boostTime=0;this.boostDuration=0;this.boostSpeed=0;
    this.boostLevel=null;this.boostLabel='';this._pendingRaceBoost=null;
  }
  jump() {
    const launched=super.jump();
    if(launched)this._boostAwardedForAir=false;
    return launched;
  }
  resolveLandingTrick() {
    const landing=super.resolveLandingTrick();
    // Existing unbanked tricks strengthen a fresh landing, but cannot make
    // an empty hop refresh boost. A particular air can award at most once.
    if(landing.landed&&!this._boostAwardedForAir&&this.launchTricks>0&&this.airLaunchSource!=='flat'&&this.bailTime<=0) {
      this._boostAwardedForAir=true;
      this._pendingRaceBoost={tricks:this.pendingTricks};
    }
    return landing;
  }
  awardRaceBoost({tricks}) {
    const combo=tricks>1;
    const speed=combo?Math.min(RACE_BOOST_MAX_SPEED,9+(tricks-2)*2):6;
    const duration=combo?Math.min(RACE_BOOST_MAX_DURATION,2+(tricks-2)*.5):1.4;
    // Refresh a finite reward; never stack speed or an unlimited timer.
    this.boostSpeed=speed;this.boostTime=this.boostDuration=duration;
    this.boostLevel=combo?'combo':'trick';this.boostLabel=combo?'COMBO BOOST':'TRICK BOOST';
    this._pendingRaceBoost=null;
    this.onEvent({type:'raceBoost',tricks,combo,speed,duration});
  }
  clearCombo(){super.clearCombo();this._pendingRaceBoost=null;}
  bail(reason) {
    if(this.bailTime<=0&&this.phase==='running')this.clearRaceBoost();
    return super.bail(reason);
  }
  reset() {
    const callback=this.onEvent;this.onEvent=()=>{};
    try{super.reset();}finally{this.onEvent=callback;}
    this.isTournament=true;this.isRace=true;
    this.course=createRaceCourse(this.rival.courseLength);
    this.countdownRemaining=RACE_COUNTDOWN;
    this.result=null;this.resultReason='';this.rivalScore=0;this._finishing=false;
    this.finishTime=null;this.opponentFinishTime=null;this.time=0;
    this.clearRaceBoost();this._boostAwardedForAir=true;
    prepareRacer(this,-2.4);
    this.opponent=new SurfGame(()=>{});this.opponent.start();
    this.opponent.profile=this.rival.profile;prepareRacer(this.opponent,2.4);
    this.updateObjective();
    this.onEvent({type:'reset',tournament:true,race:true,roundIndex:this.roundIndex});
  }
  start(){this.reset();this.phase='running';this.onEvent({type:'start',tournament:true,race:true});return true;}
  retry(){return this.start();}
  restart(){return this.start();}
  updateObjective() {
    if(!this.course)return;
    const next=this.course.checkpoints[this.nextCheckpoint];
    this.objectiveText=next
      ?`RACE ${this.roundNumber}/${this.roundCount||5} · BEAT ${this.rival.name} · GATE ${this.nextCheckpoint+1}/${this.course.checkpoints.length}`
      :`BEAT ${this.rival.name} · FINISH ${Math.ceil(this.distanceRemaining)}m`;
  }
  stepSurf(dt,input) {
    if(this.phase!=='running')return;
    if(this.countdownRemaining>0) {
      this.countdownRemaining=Math.max(0,this.countdownRemaining-dt);
      if(this.countdownRemaining<1e-9){this.countdownRemaining=0;this.onEvent({type:'raceGo'});}
      return;
    }
    const previous={distance:this.distance,x:this.x,y:this.y,elapsed:this.elapsed};
    const rivalPrevious={distance:this.opponent.distance,x:this.opponent.x,y:this.opponent.y,elapsed:this.opponent.elapsed};
    const previousElapsed=this.elapsed;
    this._pendingRaceBoost=null;
    suppressScoreRings(this);suppressScoreRings(this.opponent);
    super.stepSurf(dt,input);
    if(this.boostTime>0) {
      this.boostTime=Math.max(0,this.boostTime-dt);
      if(this.boostTime<1e-9) {
        const landing=this._pendingRaceBoost;
        this.clearRaceBoost();this._pendingRaceBoost=landing;
      }
    }
    this.opponent.stepSurf(dt,raceOpponentInput(this.opponent,this.course,this.rival.pace));
    const playerCross=resolveRaceMovement(this,previous,this.course,event=>this.onEvent({...event,opponent:false}));
    const rivalCross=resolveRaceMovement(this.opponent,rivalPrevious,this.course,event=>this.onEvent({...event,opponent:true}));
    this.time=this.elapsed;this.updateObjective();
    if(playerCross!==null||rivalCross!==null) {
      this.finishTime=playerCross===null?null:previousElapsed+dt*playerCross;
      this.opponentFinishTime=rivalCross===null?null:previousElapsed+dt*rivalCross;
      const win=playerCross!==null&&(rivalCross===null||playerCross<rivalCross-1e-9);
      this.finish(win?'win':'loss',playerCross!==null&&rivalCross!==null&&Math.abs(playerCross-rivalCross)<1e-9?'PHOTO FINISH - RIVAL HOLDS RANK':undefined);
    }
    // Land/gate/reef resolution happens before the announcement so a crash
    // on the landing step cannot briefly award a boost or hide its feedback.
    if(this.phase==='running'&&this._pendingRaceBoost)this.awardRaceBoost(this._pendingRaceBoost);
  }
  finish(result='loss',reason) {
    if(this.phase!=='running'||this._finishing)return false;
    this._finishing=true;
    this.result=result==='win'?'win':'loss';
    if(this.result==='win')this._tournamentProgress.completedRounds=Math.max(this._tournamentProgress.completedRounds,this.roundIndex+1);
    this.resultReason=reason||(this.result==='win'?'FIRST ACROSS THE LINE':`${this.rival.name} FINISHED FIRST`);
    const crossingTimes=[this.finishTime,this.opponentFinishTime].filter(Number.isFinite);
    if(crossingTimes.length)this.elapsed=this.time=this.opponent.elapsed=Math.min(...crossingTimes);
    this.clearCombo();this.trick=null;this.cutbackActive=false;this.cutback=0;
    this.clearRaceBoost();
    this.phase='finished';this.opponent.phase='finished';
    this.onEvent({type:'finish',tournament:true,race:true,reason:this.resultReason,result:this.result,
      roundIndex:this.roundIndex,roundNumber:this.roundNumber,rival:this.rival,target:this.target,
      score:this.score,complete:this.complete,progress:this.getProgress(),finishTime:this.finishTime,
      opponentFinishTime:this.opponentFinishTime});
    return true;
  }
}
