import { SurfGame,clamp } from './game.js';
import { RaceRider,drainRaceBoost,raceTrickInput } from './race-rider.js';
import { createSewerCourse,getSewerTrack,sewerWaterHeight,sewerPoint,sewerPathScale,sewerBarrelState,sewerTunnelProfile } from './sewer-course.js';

const COUNTDOWN=3;
const FALLBACK_RIVAL=Object.freeze({id:'drainrat',name:'DRAIN RAT',rank:5,pace:.65,
  profile:Object.freeze({character:'reef',outfit:'yardcrew',boardColor:'#c9e640',boardDesign:'tribal'})});
const pathOf=rider=>rider.activeShortcut||'main';
const water=rider=>sewerWaterHeight(rider.x,rider.distance,rider.elapsed,rider.trackId,rider.activeShortcut);
const snapshot=rider=>({distance:rider.distance,x:rider.x,y:rider.y,elapsed:rider.elapsed});

// A branch uses a different progress-to-metres scale. A step across its mouth
// must include both sides of that seam, rather than spending the entire step
// at the old scale. The substep is short enough that its world chord and arc
// differ by less than a millimetre, even on the tightest bypass bend.
function advanceAcrossSeam(distance,travel,lane,trackId,shortcut){
  const origin=sewerPoint(distance,lane,0,trackId,shortcut);
  let next=distance+travel/sewerPathScale(distance,trackId,shortcut,lane);
  for(let i=0;i<5;i++){
    const point=sewerPoint(next,lane,0,trackId,shortcut),actual=Math.hypot(point.x-origin.x,point.z-origin.z);
    if(Math.abs(actual-travel)<1e-7)break;
    next=Math.max(distance,next+(travel-actual)/sewerPathScale(next,trackId,shortcut,lane));
  }
  return next;
}

// The same physical rider is used for the human and rival: no rubber banding,
// free tricks or immunity for the AI. Renderers consume the same course hazards.
export class SewerRider extends RaceRider(SurfGame){
  reset(){
    super.reset();this.mode='sewer';this.isSewer=true;
    this.trackId=getSewerTrack(this.trackId).id;this.course=createSewerCourse(this.trackId);
    this.rules={...this.rules,endless:true,normalSpeed:this.course.normalSpeed,pumpSpeed:this.course.pumpSpeed,landingTolerance:11.5};
    Object.assign(this,{time:0,elapsed:0,x:0,y:0,speed:18,nextCheckpoint:0,raceMisses:0,finishTime:null,activeShortcut:null,shortcutsTaken:0});
    this.hazardStates=new Map();this.shortcutProcessed=new Set();this.hazardProcessed=new Set();
  }
  get surface(){return {height:water(this)};}
  get popReady(){return !(this.countdownRemaining>0)&&super.popReady;}
  get launchSource(){return this.cutbackLaunchTime>0?'cutback':'race-pop';}
  jump(){const charge=this.charge,grounded=!this.airborne,launched=super.jump();if(launched&&grounded)this.vy=(6.3+charge*2.4)*this.jumpPowerMultiplier;return launched;}
  doCutback(direction=0){
    if(this.countdownRemaining>0||this.phase!=='running'||this.airborne||this.bailTime>0||this.cutbackActive||this.cutbackCooldown>0||this.speed<8)return false;
    this.cutbackDirection=Math.sign(direction)||Math.sign(-this.vx)||1;
    this.cutbackActive=true;this.cutbackAge=0;this.cutbackProgress=0;this.cutback=.001;this.cutbackCooldown=1.5;this.charge=0;
    this.onEvent({type:'cutbackStart',direction:this.cutbackDirection});return true;
  }
  stepSurf(dt,input={},worldDt=dt){
    if(this.phase!=='running')return;
    const previous=snapshot(this);this.playerElapsed+=dt;this.elapsed+=worldDt;this.time=this.elapsed;
    this._pendingRaceBoost=null;drainRaceBoost(this,dt);this.recoverPop(dt);
    this.cutbackCooldown=Math.max(0,this.cutbackCooldown-dt);this.cutbackLaunchTime=Math.max(0,this.cutbackLaunchTime-dt);
    const steering=(input.right?1:0)-(input.left?1:0),chord=input.grind?steering:0;
    if(chord!==this.cutbackChord){this.cutbackChord=chord;this.cutbackChordArmed=true;}
    if(chord&&this.cutbackChordArmed&&this.doCutback(chord))this.cutbackChordArmed=false;
    if(this.cutbackActive){this.cutbackAge+=dt;this.cutbackProgress=clamp(this.cutbackAge/.65,0,1);this.cutback=Math.sin(this.cutbackProgress*Math.PI);}
    const base=(input.pump?this.rules.pumpSpeed:this.rules.normalSpeed)*this.baseSpeedMultiplier;
    const target=this.bailTime>0?7:input.brake?10:(base+this.forwardSpeedBonus)*this.timePowerSpeedMultiplier*(this.cutbackActive?.86:1);
    const acceleration=1.8*this.accelerationMultiplier,decay=Math.exp(-acceleration*dt),oldSpeed=this.speed;
    this.speed=target+(oldSpeed-target)*decay;
    const travel=target*dt+(oldSpeed-target)*(1-decay)/acceleration;
    const initialScale=sewerPathScale(this.distance,this.trackId,this.activeShortcut,this.x);
    this.distance+=travel/sewerPathScale(this.distance+travel/initialScale*.5,this.trackId,this.activeShortcut,this.x);
    this.current=0;
    if(!this.airborne&&this.bailTime<=0&&!this.hazardShieldActive)for(const hazard of this.course.hazards){
      if(hazard.type!=='whirlpool'||hazard.path!==pathOf(this))continue;
      const ahead=hazard.distance-this.distance,side=hazard.x-this.x;
      if(Math.abs(ahead)<14&&Math.abs(side)<hazard.radiusX+4)this.current+=Math.sign(side)*3*(1-Math.abs(ahead)/14);
    }
    const control=steering*(this.airborne?(this.characterStats?.airControl??1):(this.characterStats?.steering??1));
    const lateral=this.bailTime>0?0:(this.airborne?control*7:control*9)+this.current*(dt>0?worldDt/dt:0)+(this.cutbackActive?this.cutbackDirection*3*this.cutback:0);
    this.vx+=(lateral-this.vx)*(1-Math.exp(-dt*(this.airborne?4:8)));this.x+=this.vx*dt;
    this.updateShortcut(previous,travel);
    const branch=this.course.shortcuts.find(item=>item.id===this.activeShortcut),center=branch?.entryX||0,halfWidth=branch?branch.width/2:this.course.halfWidth;
    if(Math.abs(this.x-center)>halfWidth){this.x=clamp(this.x,center-halfWidth,center+halfWidth);this.vx=0;this.speed*=Math.exp(-dt*.7);}
    const ground=water(this);
    if(this.bailTime>0){this.bailTime=Math.max(0,this.bailTime-dt);this.y=ground;if(this.bailTime===0)this.onEvent({type:'recover'});}
    else if(this.airborne){
      this.airtime+=dt;this.y+=this.stepAirVertical(dt,11.2);this.updateAirTrick(dt);
      const tunnel=sewerTunnelProfile(this.distance,this.trackId,this.activeShortcut),side=this.x-tunnel.centreX;
      const headroom=tunnel.centerY+Math.sqrt(Math.max(0,tunnel.radius*tunnel.radius-side*side))-1.9;
      // Ordinary race airs fit inside the pipe. Extra/admin jumps meet its
      // visible roof gently rather than carrying the rider through the shell.
      if(this.y>headroom){this.y=headroom;this.vy=Math.min(0,this.vy);}
      if(this.y<=ground&&this.vy<0&&this.airtime>.12){
        this.y=ground;this.airborne=false;this.vy=0;
        if(Math.abs(this.vx)>this.rules.landingTolerance)this.bail('SIDEWAYS LANDING');
        else {const landing=this.resolveLandingTrick();if(landing.landed){if(this.launchTricks>0)this.addCombo('CLEAN LANDING',120);this.onEvent({type:'land',points:this.comboBase*this.multiplier,assisted:landing.assisted});}}
      }
    }else{
      this.y=ground;
      if(this.cutbackActive&&this.cutbackProgress>=1){this.cutbackActive=false;this.cutback=0;this.cutbackLaunchTime=2.2;this.onEvent({type:'cutback',direction:this.cutbackDirection,launchTime:2.2});}
      this.charge=input.jump?clamp(this.charge+dt*1.3,0,1):Math.max(0,this.charge-dt*3);
      if(this.comboBase&&!this.cutbackActive){this.comboTime-=dt;if(this.comboTime<=0)this.bank();}
    }
    if(this.phase!=='running')return;
    this.updateHazards(previous,worldDt);this.landingControl=clamp(Math.abs(this.vx)/this.rules.landingTolerance,0,1);
    this.landingWarning='';this.danger=Math.max(this.hazardDanger,this.bailTime>0?1:0);
    if(this.phase==='running'&&this._pendingRaceBoost)this.awardRaceBoost(this._pendingRaceBoost);
  }
  updateShortcut(previous,travel){
    const active=this.course.shortcuts.find(item=>item.id===this.activeShortcut);
    if(active&&this.distance>=active.end&&Number.isFinite(travel))this.distance=advanceAcrossSeam(previous.distance,travel,this.x,this.trackId,active);
    if(active&&this.distance>=active.end){this.activeShortcut=null;this.onEvent({type:'sewerShortcutExit',id:active.id});}
    if(this.activeShortcut)return;
    for(const branch of this.course.shortcuts){
      if(previous.distance<branch.start&&this.distance>=branch.start&&!this.shortcutProcessed.has(branch.id)){
        const fraction=(branch.start-previous.distance)/(this.distance-previous.distance||1),crossX=previous.x+(this.x-previous.x)*fraction;
        if(Math.abs(crossX-branch.entryX)<branch.width*.43&&this.bailTime<=0&&!this.airborne){
          if(Number.isFinite(travel))this.distance=advanceAcrossSeam(previous.distance,travel,this.x,this.trackId,branch);
          if(this.distance<branch.start)continue;
          this.activeShortcut=branch.id;this.shortcutsTaken++;this.onEvent({type:'sewerShortcut',id:branch.id,name:branch.name});
        }
        this.shortcutProcessed.add(branch.id);
      }
    }
  }
  updateHazards(previous,dt){
    this.hazardWarning='';this.hazardDanger=0;this.barrelWarning='';this.barrelClosingProgress=0;this.barrelRemaining=0;this.barrel=null;
    for(const hazard of this.course.hazards){
      if(hazard.path!==pathOf(this))continue;
      const ahead=hazard.distance-this.distance;
      if(hazard.type==='barrel'){
        if(this.distance<hazard.approachDistance||previous.distance>hazard.endDistance)continue;
        let timing=this.hazardStates.get(hazard.id);
        if(!timing){timing={approachedAt:this.elapsed,enteredAt:null,deadline:null,cleared:false};this.hazardStates.set(hazard.id,timing);this.onEvent({type:'barrelWarning',seconds:hazard.closeDuration});}
        if(timing.enteredAt===null&&this.distance>=hazard.startDistance){const f=clamp((hazard.startDistance-previous.distance)/(this.distance-previous.distance||1),0,1);timing.enteredAt=previous.elapsed+dt*f;timing.deadline=timing.enteredAt+hazard.closeDuration;}
        const state=sewerBarrelState(hazard,this.elapsed,timing);
        this.barrelClosingProgress=state.closure;this.barrelRemaining=state.timeLeft;this.barrelWarning='FLOOD BARREL · PUMP OR BOOST THROUGH';
        this.barrel={id:hazard.id,index:this.course.hazards.indexOf(hazard),inside:this.distance>=hazard.startDistance&&this.distance<=hazard.endDistance,startDistance:hazard.startDistance,endDistance:hazard.endDistance,closingProgress:state.closure,timeRemaining:state.timeLeft};
        if(timing.enteredAt!==null&&!timing.cleared&&this.elapsed>=timing.deadline&&this.distance<hazard.endDistance&&!this.hazardProcessed.has(hazard.id)&&this.bailTime<=0&&!this.hazardShieldActive){this.hazardProcessed.add(hazard.id);this.bail('CAUGHT IN THE FLOOD BARREL');this.onEvent({type:'surfHazardHit',hazard:'barrel',id:hazard.id});}
        if(this.distance>=hazard.endDistance&&!timing.cleared){timing.cleared=true;if(!this.hazardProcessed.has(hazard.id)){this.barrelsSurvived++;this.score+=400;this.onEvent({type:'barrelExit',points:400,index:this.course.hazards.indexOf(hazard)});}}
        this.hazardDanger=Math.max(this.hazardDanger,state.closure*.8);continue;
      }
      if(this.hazardProcessed.has(hazard.id))continue;
      const inPath=Math.abs(this.x-hazard.x)<hazard.radiusX+1;
      if(ahead<60&&ahead>0&&inPath){this.hazardWarning=hazard.type==='driftwood'?'DRIFTWOOD · HOP OVER':'WHIRLPOOL · STEER WIDE OR JUMP';this.hazardDanger=Math.max(this.hazardDanger,(1-ahead/60)*.8);}
      if(previous.distance<=hazard.distance+hazard.radiusZ&&this.distance>=hazard.distance-hazard.radiusZ){
        const ax=(previous.x-hazard.x)/hazard.radiusX,az=(previous.distance-hazard.distance)/hazard.radiusZ;
        const dx=(this.x-previous.x)/hazard.radiusX,dz=(this.distance-previous.distance)/hazard.radiusZ,f=clamp(-(ax*dx+az*dz)/(dx*dx+dz*dz||1),0,1);
        const crossY=previous.y+(this.y-previous.y)*f,ground=sewerWaterHeight(hazard.x,hazard.distance,this.elapsed,this.trackId,this.activeShortcut);
        if((ax+dx*f)**2+(az+dz*f)**2<1&&crossY<ground+hazard.height&&this.bailTime<=0&&!this.hazardShieldActive){this.hazardProcessed.add(hazard.id);this.bail(hazard.type==='whirlpool'?'PULLED INTO A WHIRLPOOL':'CAUGHT ON DRIFTWOOD');this.onEvent({type:'surfHazardHit',hazard:hazard.type,id:hazard.id});}
      }
      if(this.distance>hazard.distance+hazard.radiusZ)this.hazardProcessed.add(hazard.id);
    }
  }
}

export function sewerOpponentInput(rider,course,pace=.65){
  const gate=course.checkpoints[rider.nextCheckpoint],gateAhead=gate?gate.distance-rider.distance:Infinity;
  const branch=course.shortcuts.find(item=>item.id===rider.activeShortcut);
  const nextBranch=course.shortcuts.find(item=>item.start>rider.distance&&item.start-rider.distance<105&&(!gate||item.start<gate.distance));
  let target=branch?branch.entryX:nextBranch?nextBranch.entryX:gateAhead<100?gate.x:0;
  let nearHazard=null;
  for(const hazard of course.hazards){
    const ahead=hazard.distance-rider.distance;if(hazard.path!==pathOf(rider)||ahead< -hazard.radiusZ||ahead>65||hazard.type==='barrel')continue;
    nearHazard=hazard;
    if(hazard.type==='whirlpool'){
      const margin=hazard.radiusX+1.5;if(Math.abs(target-hazard.x)<margin||Math.abs(rider.x-hazard.x)<margin){target=hazard.x+(rider.x<=hazard.x?-margin:margin);}
    }else if(!branch){
      const margin=hazard.radiusX+1.5;if(Math.abs(target-hazard.x)<margin)target=hazard.x+(rider.x<=hazard.x?-margin:margin);
    }
    break;
  }
  if(branch)target=clamp(target,branch.entryX-branch.width/2+.5,branch.entryX+branch.width/2-.5);
  else target=clamp(target,-course.halfWidth+.8,course.halfWidth-.8);
  const error=target-rider.x-rider.vx*.17;
  let input={left:error<-.2,right:error>.2,pump:rider.barrel!==null||rider.elapsed%5<5*clamp(pace,0,1)};
  const hopLead=rider.speed/sewerPathScale(rider.distance,rider.trackId,rider.activeShortcut,rider.x)*.52;
  if(nearHazard?.type==='driftwood'&&branch&&nearHazard.distance-rider.distance<hopLead&&nearHazard.distance-rider.distance>2&&rider.popReady){rider.jump();rider._nextRaceAir=rider.elapsed+4;}
  const clear=!branch&&(!nearHazard||nearHazard.distance-rider.distance>48)&&gateAhead>70&&(!nextBranch||nextBranch.start-rider.distance>55);
  return raceTrickInput(rider,input,{safePop:clear&&Math.abs(rider.vx)<2.5});
}

function resolveMovement(rider,previous,course,emit){
  const gate=course.checkpoints[rider.nextCheckpoint];
  if(gate&&previous.distance<=gate.distance&&rider.distance>=gate.distance){
    const f=clamp((gate.distance-previous.distance)/(rider.distance-previous.distance||1),0,1),x=previous.x+(rider.x-previous.x)*f,y=previous.y+(rider.y-previous.y)*f+1;
    const ringY=sewerWaterHeight(gate.x,gate.distance,previous.elapsed+(rider.elapsed-previous.elapsed)*f,rider.trackId)+2;
    if(!rider.activeShortcut&&rider.bailTime<=0&&Math.hypot(x-gate.x,y-ringY)<=gate.radius){rider.nextCheckpoint++;rider.gates++;emit({type:'raceGate',index:gate.index,total:course.checkpoints.length});}
    else{rider.distance=gate.distance-18;rider.speed=8;rider.vx=0;rider.vy=0;rider.airborne=false;rider.trick=null;rider.charge=0;rider.cutbackActive=false;rider.activeShortcut=null;rider.clearCombo();rider.clearRaceBoost();rider.y=water(rider);rider.raceMisses++;emit({type:'raceMiss',index:gate.index,distance:gate.distance});}
  }
  if(rider.nextCheckpoint===course.checkpoints.length&&rider.distance>=course.length&&rider.bailTime<=0)return clamp((course.length-previous.distance)/(rider.distance-previous.distance||1),0,1);
  return null;
}

export class SewerRaceGame extends SewerRider{
  constructor(onEvent=()=>{},options={}){
    super(()=>{});this.onEvent=onEvent;this.trackId=getSewerTrack(options.trackId).id;this._rival={...FALLBACK_RIVAL,...options.rival};
    this.roundIndex=Number.isInteger(options.roundIndex)?options.roundIndex:0;this.roundCount=options.roundCount||5;this.isSewerLadder=!!options.isSewerLadder;this.reset();
  }
  get rival(){return this._rival||FALLBACK_RIVAL;}
  get roundNumber(){return (this.roundIndex||0)+1;}
  get raceProgress(){return this.distance;}
  get opponentRaceProgress(){return this.opponent?.distance??0;}
  get racePosition(){return this.result?(this.result==='win'?1:2):this.distance>=this.opponentRaceProgress?1:2;}
  get lead(){return this.distance-this.opponentRaceProgress;}
  get distanceRemaining(){return Math.max(0,this.course.length-this.distance);}
  reset(){
    const callback=this.onEvent;this.onEvent=()=>{};try{super.reset();}finally{this.onEvent=callback;}
    this.isRace=true;this.isTournament=false;this.isSewerLadder=!!this.isSewerLadder;this.countdownRemaining=COUNTDOWN;
    this.result=null;this.resultReason='';this.finishTime=null;this.opponentFinishTime=null;this._finishing=false;this.x=-1.5;
    this.unlockedBoardId=null;this.unlockedOutfitIds=[];
    this.opponent=new SewerRider(event=>this.onEvent({...event,opponent:true}));this.opponent.trackId=this.trackId;this.opponent.reset();this.opponent.phase='running';this.opponent.x=1.5;this.opponent.lives=null;
    this.opponent.profile=this.rival.profile;this.opponent.setCharacter(this.rival.character||this.rival.profile?.character||'kai');this.updateObjective();
    this.onEvent({type:'reset',race:true,sewer:true,isSewerLadder:this.isSewerLadder});
  }
  start(){this.reset();this.phase='running';this.onEvent({type:'start',race:true,sewer:true});return true;}
  retry(){return this.start();}
  restart(){return this.start();}
  updateObjective(){if(this.course)this.objectiveText=`${this.course.name} · BEAT ${this.rival?.name||'THE RIVAL'} · GATES ${this.nextCheckpoint||0}/${this.course.checkpoints.length}`;}
  stepSurf(dt,input,worldDt=dt){
    if(this.phase!=='running')return;
    if(this.countdownRemaining>0){this.countdownRemaining=Math.max(0,this.countdownRemaining-worldDt);if(this.countdownRemaining<1e-9){this.countdownRemaining=0;this.onEvent({type:'raceGo'});}return;}
    const previous=snapshot(this),otherPrevious=snapshot(this.opponent);
    super.stepSurf(dt,input,worldDt);if(this.phase!=='running')return;
    if(worldDt>0)this.opponent.stepSurf(worldDt,sewerOpponentInput(this.opponent,this.course,this.rival.pace));
    const playerCross=resolveMovement(this,previous,this.course,event=>this.onEvent({...event,opponent:false}));
    const rivalCross=resolveMovement(this.opponent,otherPrevious,this.course,event=>this.onEvent({...event,opponent:true}));
    this.updateObjective();
    if(playerCross!==null||rivalCross!==null){
      this.finishTime=playerCross===null?null:previous.elapsed+worldDt*playerCross;this.opponentFinishTime=rivalCross===null?null:previous.elapsed+worldDt*rivalCross;
      this.finish(playerCross!==null&&(rivalCross===null||playerCross<rivalCross-1e-9)?'win':'loss');
    }
  }
  finish(result='loss',reason){
    if(this.phase!=='running'||this._finishing)return false;this._finishing=true;this.result=result==='win'?'win':'loss';
    this.resultReason=reason||(this.result==='win'?'FIRST OUT OF THE SEWER':`${this.rival.name} FINISHED FIRST`);
    const times=[this.finishTime,this.opponentFinishTime].filter(Number.isFinite);if(times.length)this.elapsed=this.time=Math.min(...times);
    this._timePower.cancel('finish');this._sewerPower?.cancel('finish');this.clearCombo();this.clearRaceBoost();this.trick=null;this.phase='finished';
    if(this.opponent){this.opponent.phase='finished';this.opponent.clearCombo();this.opponent.clearRaceBoost();this.opponent.trick=null;}
    this.onEvent({type:'finish',race:true,sewer:true,isSewerLadder:this.isSewerLadder,trackId:this.trackId,result:this.result,reason:this.resultReason,roundIndex:this.roundIndex,roundNumber:this.roundNumber,rival:this.rival,score:this.score,elapsed:this.elapsed,finishTime:this.finishTime,opponentFinishTime:this.opponentFinishTime});return true;
  }
}
