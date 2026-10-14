import { SurfGame,waveHeight,clamp } from './game.js';
import { WaveParkGame,parkRideSurface,parkHeight,PARK_PIPES } from './park.js';
import { RaceRider,drainRaceBoost } from './race-rider.js';
import { createRaceCourse,surfRaceRingY,RACE_COUNTDOWN } from './surf-race.js';
import { createParkTrialCourse,sweepParkRaceGate,parkRaceProgress } from './park-race.js';
import { TIME_TRIALS,sanitizeTimeTrialProgress,recordTimeTrialWin } from './time-trial-progress.js';
import { TRIAL_COSMETIC_SETS } from './trial-cosmetics.js';
export { TIME_TRIALS,sanitizeTimeTrialProgress,timeTrialsUnlocked,selectTimeTrial,recordTimeTrialWin } from './time-trial-progress.js';

// A solo rider has the same pumps, charged pops, collision surfaces and landed
// trick boosts as the Hit List. No invisible opponent drives the clock.
const TimeTrialRider=Base=>class extends RaceRider(Base) {
  constructor(onEvent=()=>{},progress=null) {
    super(()=>{});
    this.onEvent=onEvent;
    this._trialProgress=sanitizeTimeTrialProgress(progress);
    this._trialIndex=this._trialProgress.selectedTrial;
    this.reset();
  }
  get trialIndex(){return this._trialIndex??this._trialProgress?.selectedTrial??0;}
  get trial(){return TIME_TRIALS[this.trialIndex];}
  get target(){return this.trial.timeLimit;}
  get complete(){return this._trialProgress?.completedTrials===TIME_TRIALS.length;}
  get raceProgress(){return this.mode==='park'?parkRaceProgress(this,this.course):this.distance;}
  get distanceRemaining(){return Math.max(0,this.course.length-this.raceProgress);}
  get nextWaypoint(){return this.mode==='park'?this.course.checkpoints[this.nextCheckpoint]||null:null;}
  get popReady(){return this.countdownRemaining<=0&&super.popReady;}
  doCutback(direction=0){return this.countdownRemaining<=0&&super.doCutback(direction);}
  getProgress(){return sanitizeTimeTrialProgress(this._trialProgress);}
  reset() {
    const callback=this.onEvent;this.onEvent=()=>{};
    try{super.reset();}finally{this.onEvent=callback;}
    this._trialProgress??=sanitizeTimeTrialProgress(null);
    this.isTimeTrial=true;this.isRace=true;this.isTournament=false;
    this.rules={...this.rules,endless:true};
    this.course=this.mode==='park'?createParkTrialCourse(this.trial.stage):createRaceCourse(this.trial.courseLength);
    this.countdownRemaining=RACE_COUNTDOWN;this.result=null;this.resultReason='';this._finishing=false;
    this.finishTime=null;this.time=this.trial.timeLimit;this.elapsed=0;this.unlockedSet=null;
    this.nextCheckpoint=0;this.raceMisses=0;this._raceGateMissed=false;
    this.clearRaceBoost();this._boostAwardedForAir=true;
    if(this.mode==='park') {
      const start=this.course.start;
      this.x=start.x;this.z=start.z;this.heading=start.heading;
      this.y=parkRideSurface(this.x,this.z,parkHeight(this.x,this.z)).height;
      this.vx=-Math.sin(this.heading)*12;this.vz=-Math.cos(this.heading)*12;this.speed=12;
      this.surface=parkRideSurface(this.x,this.z,this.y);this.distance=-this.z;this.raceLane=0;
    }else {this.x=-2.4;this.y=waveHeight(this.x,0,0);}
    this.updateObjective();
    this.onEvent({type:'reset',timeTrial:true,race:true,trialIndex:this.trialIndex});
  }
  start(){this.reset();this.phase='running';this.onEvent({type:'start',timeTrial:true,race:true});return true;}
  retry(){return this.start();}
  restart(){return this.start();}
  updateObjective() {
    if(!this.course||!this.trial)return;
    this.objectiveText=`TIME TRIAL ${this.trial.number}/${TIME_TRIALS.length} · ${this.trial.name} · ${this.nextCheckpoint<this.course.checkpoints.length?`SUN RING ${this.nextCheckpoint+1}/${this.course.checkpoints.length}`:`FINISH ${Math.ceil(this.distanceRemaining)}m`}`;
  }
  stepSurf(dt,input) {this.stepTrial(dt,input,(step,controls)=>super.stepSurf(step,controls));}
  stepPark(dt,input) {this.stepTrial(dt,input,(step,controls)=>super.stepPark(step,controls));}
  stepTrial(dt,input,stepPhysics) {
    if(this.phase!=='running'||!Number.isFinite(dt)||dt<=0)return;
    if(this.countdownRemaining>0) {
      const countdownStep=Math.min(dt,this.countdownRemaining);
      this.countdownRemaining=Math.max(0,this.countdownRemaining-countdownStep);dt-=countdownStep;
      if(this.countdownRemaining<1e-9){this.countdownRemaining=0;this.onEvent({type:'raceGo',timeTrial:true});}
      if(dt<1e-9)return;
    }
    const remaining=this.trial.timeLimit-this.elapsed;
    if(remaining<=1e-9){this.time=0;this.elapsed=this.trial.timeLimit;this.finish('loss','TIME EXPIRED');return;}
    dt=Math.min(dt,remaining);
    const from={x:this.x,y:this.y,z:this.z,distance:this.distance,elapsed:this.elapsed};
    this._pendingRaceBoost=null;
    if(this.mode==='surf') {
      const index=Math.max(0,Math.floor((this.distance-this.rules.firstGate)/this.rules.spacing));
      this.processed.add(`g${index}`);this.processed.add(`g${index+1}`);
    }
    stepPhysics(dt,input);
    if(this.phase!=='running')return;
    drainRaceBoost(this,dt);
    this.time=Math.max(0,this.trial.timeLimit-this.elapsed);
    const crossing=this.mode==='park'?this.resolveParkGate(from):this.resolveSurfGate(from);
    this.updateObjective();
    if(this.phase!=='running')return;
    if(crossing!==null) {
      this.finishTime=from.elapsed+dt*crossing;
      this.finish('win');return;
    }
    if(this.time<=1e-9){this.elapsed=this.trial.timeLimit;this.time=0;this.finish('loss','TIME EXPIRED');return;}
    if(this._pendingRaceBoost)this.awardRaceBoost(this._pendingRaceBoost);
  }
  passGate(gate) {
    this.nextCheckpoint++;this._raceGateMissed=false;
    this.onEvent({type:'raceGate',timeTrial:true,index:gate.index,total:this.course.checkpoints.length});
  }
  missGate(gate) {
    this._raceGateMissed=true;this.raceMisses++;this.clearRaceBoost();
    this.onEvent({type:'raceMiss',timeTrial:true,index:gate.index,distance:gate.distance});
  }
  resolveSurfGate(from) {
    const gate=this.course.checkpoints[this.nextCheckpoint];
    if(gate&&from.distance<=gate.distance&&this.distance>=gate.distance) {
      const fraction=clamp((gate.distance-from.distance)/(this.distance-from.distance||1),0,1);
      const x=from.x+(this.x-from.x)*fraction,y=from.y+(this.y-from.y)*fraction+1;
      const time=from.elapsed+(this.elapsed-from.elapsed)*fraction;
      if(Math.hypot(x-gate.x,y-surfRaceRingY(gate,time))<=gate.radius&&this.bailTime<=0)this.passGate(gate);
      else {this.missGate(gate);this.finish('loss','SUN RING MISSED — RETRY THE RUN');return null;}
    }
    return this.nextCheckpoint===this.course.checkpoints.length&&this.distance>=this.course.length&&this.bailTime<=0
      ?clamp((this.course.length-from.distance)/(this.distance-from.distance||1),0,1):null;
  }
  resolveParkGate(from) {
    const gate=this.course.checkpoints[this.nextCheckpoint];if(!gate)return null;
    const nx=-Math.sin(gate.rotation),nz=-Math.cos(gate.rotation);
    if(this._raceGateMissed&&(this.x-gate.x)*nx+(this.z-gate.z)*nz< -9) {
      const pipe=PARK_PIPES.find(item=>Math.abs(gate.x-item.x)<.01&&Math.abs(gate.z-item.z)<item.length/2);
      const mouth=pipe?pipe.z-(Math.sign(nz)||-1)*(pipe.length/2+12):0;
      if(!pipe||Math.abs(this.x-gate.x)<2&&Math.abs(this.z-mouth)<4)this._raceGateMissed=false;
    }
    const crossing=sweepParkRaceGate(from,this,gate);if(!crossing)return null;
    if(crossing.inside&&this.bailTime<=0){this.passGate(gate);return gate.finish?crossing.fraction:null;}
    this.missGate(gate);return null;
  }
  finish(result='loss',reason) {
    if(this.phase!=='running'||this._finishing)return false;
    this._finishing=true;
    const validFinish=Number.isFinite(this.finishTime)&&this.finishTime>0&&this.finishTime<=this.trial.timeLimit+1e-9&&this.nextCheckpoint===this.course.checkpoints.length;
    this.result=result==='win'&&validFinish?'win':'loss';
    if(this.result==='win') {
      const before=this._trialProgress.completedTrials;
      this.elapsed=Math.min(this.trial.timeLimit,this.finishTime);this.time=Math.max(0,this.trial.timeLimit-this.elapsed);
      this._trialProgress=recordTimeTrialWin(this._trialProgress,this.trialIndex,this.finishTime);
      this.unlockedSet=TRIAL_COSMETIC_SETS.find(set=>set.requiredClears>before&&set.requiredClears<=this._trialProgress.completedTrials)||null;
    }
    this.resultReason=reason||(this.result==='win'?'TARGET TIME BEATEN':'TIME TRIAL FAILED');
    this.clearCombo();this.clearRaceBoost();this.trick=null;this.lastCompletedTrickType=null;
    this.cutbackActive=false;this.cutback=0;this.grinding=null;this.pipeRide=null;this.lipMove=null;
    this.phase='finished';
    this.onEvent({type:'finish',timeTrial:true,race:true,reason:this.resultReason,result:this.result,
      trialIndex:this.trialIndex,trial:this.trial,score:this.score,finishTime:this.finishTime,
      elapsed:this.elapsed,time:this.time,complete:this.complete,progress:this.getProgress(),unlockedSet:this.unlockedSet});
    return true;
  }
};

export class SurfTimeTrialGame extends TimeTrialRider(SurfGame) {}
export class ParkTimeTrialGame extends TimeTrialRider(WaveParkGame) {}

export function createTimeTrialGame(onEvent=()=>{},progress=null) {
  const safe=sanitizeTimeTrialProgress(progress);
  return TIME_TRIALS[safe.selectedTrial].venue==='park'
    ?new ParkTimeTrialGame(onEvent,safe):new SurfTimeTrialGame(onEvent,safe);
}
