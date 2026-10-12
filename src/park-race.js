import { clamp } from './game.js';
import { WaveParkGame,parkRideSurface,parkHeight,PARK_PIPES } from './park.js';
import { RACE_COUNTDOWN,RACE_BOOST_MAX_SPEED,RACE_BOOST_MAX_DURATION } from './surf-race.js';

const FALLBACK_RIVAL=Object.freeze({id:'moxie',name:'MOXIE',pace:.36,target:1800});
const WEST=[[-52,30],[-52,-10],[-48,-34],[-24,-56],[-2,-73],[24,-67],[35,-42],[35,-8],[35,30],[39,61],[22,78],[0,71],[0,55],[0,-9],[-25,-25],[-38,0],[-34,40],[-40,72],[-52,58]];
const EAST=WEST.map(([x,z])=>[-x,z]);
const KING=[[-52,30],[-52,-10],[-48,-34],[-24,-56],[0,-72],[25,-57],[48,-34],[52,-10],[52,30],[50,58],[33,75],[0,73],[0,55],[0,-9],[-25,-25],[-38,0],[-34,40],[-40,72],[-52,58]];

export function createParkRaceCourse(id='moxie') {
  const key=['moxie','undertow','kingtide'].includes(id)?id:'moxie';
  const laps=key==='moxie'?1:2;
  const coordinates=key==='undertow'?[...EAST,...EAST]:key==='kingtide'?[...KING,...KING]:WEST;
  const start=Object.freeze({x:key==='undertow'?52:-52,z:58,heading:0});
  let previous=start,distance=0;
  const checkpoints=coordinates.map(([x,z],index)=>{
    distance+=Math.hypot(x-previous.x,z-previous.z);
    const rotation=Math.atan2(previous.x-x,previous.z-z);
    const inPipe=Math.abs(x)===52&&z>=-10&&z<=30;
    const gate=Object.freeze({index,x,z,y:parkRideSurface(x,z,parkHeight(x,z)).height+1.5,
      radius:inPipe?3.8:5.5,rotation,distance,finish:index===coordinates.length-1});
    previous=gate;return gate;
  });
  return Object.freeze({id:key,name:key==='undertow'?'EAST OUTFALL CIRCUIT':key==='kingtide'?'TWIN PIPE CIRCUIT':'WEST OUTFALL CIRCUIT',
    laps,start,checkpoints:Object.freeze(checkpoints),finish:checkpoints.at(-1),length:distance});
}

const normal=gate=>({x:-Math.sin(gate.rotation),z:-Math.cos(gate.rotation)});
const signedDistance=(point,gate)=>{const n=normal(gate);return (point.x-gate.x)*n.x+(point.z-gate.z)*n.z;};
const gatePipe=gate=>PARK_PIPES.find(pipe=>Math.abs(gate.x-pipe.x)<.01&&Math.abs(gate.z-pipe.z)<pipe.length/2);

function recoveryTarget(rider,gate) {
  const pipe=gatePipe(gate),n=normal(gate);
  if(!pipe)return {x:gate.x-n.x*14,z:gate.z-n.z*14};
  // A missed pipe ring must be approached through the open mouth. A direct
  // diagonal to the ring would steer into the solid cylinder's side wall.
  const direction=Math.sign(n.z)||-1,mouth=pipe.z-direction*(pipe.length/2+12);
  const outsideMouth=direction*(rider.z-mouth)<3;
  return {x:outsideMouth?gate.x:rider.x,z:mouth};
}

// Both riders use the same finite upright gate, including its vertical extent.
// Crossing a later gate, passing behind the ring or jumping over it earns nothing.
export function sweepParkRaceGate(from,to,gate) {
  const before=signedDistance(from,gate),after=signedDistance(to,gate);
  if(before>1e-8||after<0||after-before<=1e-9)return null;
  const fraction=clamp(-before/(after-before),0,1),x=from.x+(to.x-from.x)*fraction,
    y=from.y+(to.y-from.y)*fraction,z=from.z+(to.z-from.z)*fraction;
  const n=normal(gate),side=(x-gate.x)*n.z-(z-gate.z)*n.x;
  return {fraction,inside:side*side+(y-gate.y)**2<=gate.radius**2+1e-8};
}

export function parkRaceProgress(rider,course) {
  if(rider.nextCheckpoint>=course.checkpoints.length)return course.length;
  const gate=course.checkpoints[rider.nextCheckpoint],previous=course.checkpoints[rider.nextCheckpoint-1]||course.start;
  const dx=gate.x-previous.x,dz=gate.z-previous.z,length=Math.hypot(dx,dz);
  const fraction=clamp(((rider.x-previous.x)*dx+(rider.z-previous.z)*dz)/(length*length),0,.999);
  return (previous.distance||0)+fraction*length;
}

// A fixed control policy, using the rival's own state and the public route.
// No position writes, catch-up speed or knowledge of the player's progress.
export function parkRaceOpponentInput(rider,course,pace=.45) {
  const gate=course.checkpoints[rider.nextCheckpoint];
  if(!gate)return {brake:true};
  const n=normal(gate);
  const returning=rider._raceGateMissed;
  const ahead=2;
  const lane=rider.raceLane||0;
  const target=returning?recoveryTarget(rider,gate):{x:gate.x+n.x*ahead-n.z*lane,z:gate.z+n.z*ahead+n.x*lane};
  const aim=Math.atan2(rider.x-target.x,rider.z-target.z);
  const error=Math.atan2(Math.sin(aim-rider.heading),Math.cos(aim-rider.heading));
  // Slow for tight corners before steering across the next ring's face.
  const brake=Math.abs(error)>.68;
  return {left:error>.025,right:error<-.025,brake,
    pump:!brake&&(rider.elapsed%5)<5*clamp(pace,0,1)};
}

function prepareRacer(rider,course,offset=0) {
  const start=course.start;
  rider.rules={...rider.rules,endless:true};
  rider.x=start.x+Math.cos(start.heading)*offset;rider.z=start.z-Math.sin(start.heading)*offset;
  rider.heading=start.heading;rider.y=parkRideSurface(rider.x,rider.z,parkHeight(rider.x,rider.z)).height;
  rider.vx=-Math.sin(start.heading)*12;rider.vz=-Math.cos(start.heading)*12;rider.speed=12;
  rider.surface=parkRideSurface(rider.x,rider.z,rider.y);rider.distance=-rider.z;
  rider.raceLane=offset;
  rider.nextCheckpoint=0;rider.raceMisses=0;rider._raceGateMissed=false;rider.raceProgress=0;rider.finishTime=null;
}

function resolveMovement(rider,from,course,emit) {
  const gate=course.checkpoints[rider.nextCheckpoint];
  if(!gate)return null;
  if(rider._raceGateMissed&&signedDistance(rider,gate)<-9) {
    const pipe=gatePipe(gate),target=recoveryTarget(rider,gate);
    if(!pipe||Math.abs(rider.x-gate.x)<2&&Math.abs(rider.z-target.z)<4)rider._raceGateMissed=false;
  }
  const crossing=sweepParkRaceGate(from,rider,gate);
  if(!crossing)return null;
  if(crossing.inside&&rider.bailTime<=0) {
    rider.nextCheckpoint++;rider._raceGateMissed=false;
    emit({type:'raceGate',index:gate.index,total:course.checkpoints.length});
    return gate.finish?crossing.fraction:null;
  }
  rider._raceGateMissed=true;rider.raceMisses++;rider.clearRaceBoost?.();
  emit({type:'raceMiss',index:gate.index,distance:gate.distance});return null;
}

export class ParkRaceGame extends WaveParkGame {
  constructor(onEvent=()=>{},options={}) {
    super(()=>{});this.onEvent=onEvent;
    this.roundIndex=Number.isInteger(options.roundIndex)?options.roundIndex:0;this.roundCount=options.roundCount||5;
    this._rival=options.rival||FALLBACK_RIVAL;
    this._tournamentProgress={version:1,completedRounds:options.progress?.completedRounds||0};this.reset();
  }
  get rival(){return this._rival||FALLBACK_RIVAL;}
  get target(){return this.rival.target;}
  get roundNumber(){return (this.roundIndex??0)+1;}
  get complete(){return this._tournamentProgress?.completedRounds===this.roundCount;}
  getProgress(){return {...this._tournamentProgress};}
  get opponentRaceProgress(){return this.opponent?.raceProgress||0;}
  get racePosition(){return this.result?(this.result==='win'?1:2):this.raceProgress>=this.opponentRaceProgress?1:2;}
  get lead(){return this.raceProgress-this.opponentRaceProgress;}
  get distanceRemaining(){return Math.max(0,this.course.length-this.raceProgress);}
  get nextWaypoint(){return this.course.checkpoints[this.nextCheckpoint]||null;}
  get forwardSpeedBonus(){return this.boostTime>0?this.boostSpeed:0;}
  get popReady(){return this.countdownRemaining<=0&&super.popReady;}
  doCutback(direction=0){return this.countdownRemaining<=0&&super.doCutback(direction);}
  clearRaceBoost(){this.boostTime=0;this.boostDuration=0;this.boostSpeed=0;this.boostLevel=null;this.boostLabel='';this._pendingRaceBoost=null;}
  launch(...args){super.launch(...args);this._boostAwardedForAir=false;}
  resolveLandingTrick() {
    const landing=super.resolveLandingTrick();
    if(landing.landed&&!this._boostAwardedForAir&&this.launchTricks>0&&this.airLaunchSource!=='flat'&&this.bailTime<=0) {
      this._boostAwardedForAir=true;this._pendingRaceBoost={tricks:this.pendingTricks};
    }
    return landing;
  }
  awardRaceBoost({tricks}) {
    const combo=tricks>1,speed=combo?Math.min(RACE_BOOST_MAX_SPEED,9+(tricks-2)*2):6,
      duration=combo?Math.min(RACE_BOOST_MAX_DURATION,2+(tricks-2)*.5):1.4;
    this.boostSpeed=speed;this.boostTime=this.boostDuration=duration;
    this.boostLevel=combo?'combo':'trick';this.boostLabel=combo?'COMBO BOOST':'TRICK BOOST';this._pendingRaceBoost=null;
    this.onEvent({type:'raceBoost',tricks,combo,speed,duration});
  }
  clearCombo(){super.clearCombo();this._pendingRaceBoost=null;}
  bail(reason){if(this.phase==='running'&&this.bailTime<=0)this.clearRaceBoost();return super.bail(reason);}
  reset() {
    const callback=this.onEvent;this.onEvent=()=>{};
    try{super.reset();}finally{this.onEvent=callback;}
    this.isTournament=true;this.isRace=true;this.course=createParkRaceCourse(this.rival.id);
    this.countdownRemaining=RACE_COUNTDOWN;this.result=null;this.resultReason='';this.rivalScore=0;this._finishing=false;
    this.finishTime=null;this.opponentFinishTime=null;this.time=0;this.clearRaceBoost();this._boostAwardedForAir=true;
    prepareRacer(this,this.course,-.8);
    this.opponent=new WaveParkGame(()=>{});this.opponent.start();this.opponent.profile=this.rival.profile;
    prepareRacer(this.opponent,this.course,.8);this.updateObjective();
    this.onEvent({type:'reset',tournament:true,race:true,roundIndex:this.roundIndex});
  }
  start(){this.reset();this.phase='running';this.onEvent({type:'start',tournament:true,race:true});return true;}
  retry(){return this.start();}
  restart(){return this.start();}
  updateObjective() {
    if(!this.course)return;
    this.objectiveText=`RACE ${this.roundNumber}/${this.roundCount||5} · BEAT ${this.rival.name} · SUN RING ${Math.min(this.course.checkpoints.length,this.nextCheckpoint+1)}/${this.course.checkpoints.length}`;
  }
  stepPark(dt,input) {
    if(this.phase!=='running')return;
    if(this.countdownRemaining>0) {
      this.countdownRemaining=Math.max(0,this.countdownRemaining-dt);
      if(this.countdownRemaining<1e-9){this.countdownRemaining=0;this.onEvent({type:'raceGo'});}return;
    }
    const from={x:this.x,y:this.y,z:this.z},otherFrom={x:this.opponent.x,y:this.opponent.y,z:this.opponent.z},elapsed=this.elapsed;
    this._pendingRaceBoost=null;super.stepPark(dt,input);
    if(this.boostTime>0) {
      this.boostTime=Math.max(0,this.boostTime-dt);
      if(this.boostTime<1e-9){const pending=this._pendingRaceBoost;this.clearRaceBoost();this._pendingRaceBoost=pending;}
    }
    this.opponent.stepPark(dt,parkRaceOpponentInput(this.opponent,this.course,this.rival.pace));
    const crossing=resolveMovement(this,from,this.course,event=>this.onEvent({...event,opponent:false}));
    const otherCrossing=resolveMovement(this.opponent,otherFrom,this.course,event=>this.onEvent({...event,opponent:true}));
    this.raceProgress=parkRaceProgress(this,this.course);this.opponent.raceProgress=parkRaceProgress(this.opponent,this.course);
    this.time=this.elapsed;this.updateObjective();
    if(crossing!==null||otherCrossing!==null) {
      this.finishTime=crossing===null?null:elapsed+dt*crossing;
      this.opponentFinishTime=otherCrossing===null?null:elapsed+dt*otherCrossing;
      const tie=crossing!==null&&otherCrossing!==null&&Math.abs(crossing-otherCrossing)<1e-9;
      this.finish(crossing!==null&&(otherCrossing===null||crossing<otherCrossing-1e-9)?'win':'loss',tie?'PHOTO FINISH - RIVAL HOLDS RANK':undefined);
    }
    if(this.phase==='running'&&this._pendingRaceBoost)this.awardRaceBoost(this._pendingRaceBoost);
  }
  finish(result='loss',reason) {
    if(this.phase!=='running'||this._finishing)return false;this._finishing=true;this.result=result==='win'?'win':'loss';
    if(this.result==='win')this._tournamentProgress.completedRounds=Math.max(this._tournamentProgress.completedRounds,this.roundIndex+1);
    this.resultReason=reason||(this.result==='win'?'FIRST THROUGH THE FINAL SUN RING':`${this.rival.name} FINISHED FIRST`);
    const times=[this.finishTime,this.opponentFinishTime].filter(Number.isFinite);
    if(times.length)this.elapsed=this.time=this.opponent.elapsed=Math.min(...times);
    this.clearCombo();this.clearRaceBoost();this.trick=null;this.cancelCutback();
    this.phase='finished';this.opponent.phase='finished';
    this.onEvent({type:'finish',tournament:true,race:true,reason:this.resultReason,result:this.result,roundIndex:this.roundIndex,
      roundNumber:this.roundNumber,rival:this.rival,target:this.target,score:this.score,complete:this.complete,
      progress:this.getProgress(),finishTime:this.finishTime,opponentFinishTime:this.opponentFinishTime});return true;
  }
}
