// Rendering-independent arcade simulation. Units are metres and seconds.
import { surfRules } from './session-modes.js';
import { findComboAnimation } from './combo-animations.js';
import { getRewardBoard } from './board-rewards.js';
import { sanitizeResolvedAdminStats } from './admin-settings.js';
import { waveHeight,waveCrest,stormDifficulty,stormBarrel,barrelCrossSection,sampleStormBarrel,sweepStormBarrel,STORM_BARREL_FIRST,STORM_BARREL_SPACING } from './storm-waves.js';
export { SURF_RULES } from './session-modes.js';
export { waveHeight,waveCrest } from './storm-waves.js';
export const RUN_SECONDS = 120;
export const COMBO_WINDOW = 3.8;
export const POP_COOLDOWN = 1.4;
export const CUTBACK_LAUNCH_WINDOW = 2.2;
export const LANDING_GRACE = .16;
export const MIN_X = -16;
export const MAX_X = 17;
export const TRICKS = {
  spin: { name: '180 SPIN', points: 300, duration: 0.43, spin: Math.PI },
  flip: { name: 'KICKFLIP', points: 550, duration: 0.62, flip: Math.PI * 2 },
  grab: { name: 'INDY GRAB', points: 220, duration: 0.68, grab: 1 },
  shuvit: { name: 'SHUV-IT', points: 450, duration: 0.48, boardSpin: Math.PI * 2 },
  heelflip: { name: 'HEELFLIP', points: 650, duration: 0.65, flip: -Math.PI * 2 },
  method: { name: 'METHOD AIR', points: 400, duration: 0.80, grab: 1.2 },
  spin360: { name: '360 AIR', points: 700, duration: 0.7, spin: Math.PI * 2 },
  special: { name: 'RODEO AIR', points: 1200, duration: 0.82, spin: Math.PI * 2, flip: Math.PI * 2, grab: .45 },
  tweak: { name: 'TWEAKED GRAB', points: 650, duration: 0.78, grab: 1, tweak: 1 },
};
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function courseItem(index,rulesId='surf') {
  const rules=surfRules(rulesId);
  const gates=rules.id==='rush'?[-7,7,-3,10,-9,3]:rules.id==='storm'?[-6,5,-9,8,0,10]:[-3,5,-8,2,10,-5];
  const reefs=rules.id==='storm'?[1,-8,7,-2,11,-11]:rules.id==='rush'?[3,-5,8,-9,0,11]:[6,-4,10,-11,2,-7];
  const slot=((index%gates.length)+gates.length)%gates.length,distance=rules.firstGate+index*rules.spacing;
  return {index,distance,x:gates[slot],ringRadius:rules.ringRadius,hazardX:reefs[slot],hazardDistance:distance+rules.hazardOffset,hazardRadius:rules.hazardRadius,hazardHeight:1.7};
}

export class SurfGame {
  constructor(onEvent = () => {},rulesId='surf') { this.onEvent = onEvent;this.rulesId=surfRules(rulesId).id; this.reset(); }
  reset() {
    this.rules=surfRules(this.rulesId);this.rulesId=this.rules.id;
    Object.assign(this, {
      mode: 'surf', phase: 'ready', time: this.rules.startTime, elapsed: 0, distance: 0,
      x: 1, vx: 0, speed: 16, y: waveHeight(1, 0, 0), vy: 0,
      airborne: false, airtime: 0, charge: 0, trick: null,
      comboBase: 0, multiplier: 1, comboTime: 0, comboNames: [], repetitions: {}, lastCompletedTrickType: null,
      score: 0, bestCombo: 0, landedTricks: 0, pendingTricks: 0,
      gates: 0, wipeouts: 0, bailTime: 0, carveTime: 0,
      processed: new Set(), lastJump: -10, rotation: 0, flipRotation: 0, boardRotation: 0,rollRotation:0,
      lives:this.rules.startingLives,resultReason:'',danger:0,current:0,landingWarning:'',landingControl:0,
      cutback:0,cutbackAge:0,cutbackProgress:0,cutbackDirection:0,cutbackActive:false,cutbackCooldown:0,
      cutbackChord:0,cutbackChordArmed:true,
      popRecovery:0,cutbackLaunchTime:0,airLaunchSource:'flat',launchTricks:0,airJumpsUsed:0,
      stormStage:1,stormDifficulty:0,barrel:null,barrelTime:0,barrelsSurvived:0,barrelRun:null,lastBarrelAward:-1,lastPrunedCourse:-1,nextBarrelDistance:STORM_BARREL_FIRST,
    });
    this.updateObjective();
    this.onEvent({ type: 'reset' });
  }
  start() { this.reset(); this.phase = 'running'; this.onEvent({ type: 'start' }); }
  pause() { if (this.phase === 'running') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'running'; }
  setAdminStats(value) {
    this.adminStats=sanitizeResolvedAdminStats(value);
    this.refreshAdminBoard();
    // Editing stats/equipment during a flight never refills extra jumps.
    if(this.airborne)this.airJumpsUsed=Math.max(this.airJumpsUsed,this.rewardBoardDefinition?.airJumps||0);
    return this.adminStats;
  }
  get characterStats() {return this.adminStats?.active?this.adminStats.character:null;}
  get jumpPowerMultiplier() {return this.characterStats?.jumpPower??1;}
  get accelerationMultiplier() {return this.adminStats?.active?this.adminStats.board.acceleration:1;}
  get comboWindow() {return this.characterStats?.comboWindow??COMBO_WINDOW;}
  refreshAdminBoard() {
    if(!this.adminStats?.active){this._adminBoardDefinition=null;return;}
    const board=this.adminStats.board;
    this._adminBoardDefinition={...getRewardBoard(this.rewardBoard),
      baseSpeedMultiplier:board.baseSpeed,trickPointsMultiplier:this.adminStats.character.scoreMultiplier,
      boostPowerMultiplier:board.boostPower,boostDurationMultiplier:board.boostDuration,
      popRecoveryMultiplier:board.popRecovery,airJumps:board.extraJumps,
      glideGravityMultiplier:board.glideGravity,glideFallSpeed:board.glideFallSpeed};
  }
  setRewardBoard(id) {
    this.rewardBoard=getRewardBoard(id)?.id||null;
    this.refreshAdminBoard();
    // Changing equipment cannot refill an extra jump during an existing flight.
    if(this.airborne)this.airJumpsUsed=Math.max(this.airJumpsUsed,this.rewardBoardDefinition?.airJumps||0);
    return this.rewardBoard;
  }
  get rewardBoardDefinition() {return this.adminStats?.active?this._adminBoardDefinition:getRewardBoard(this.rewardBoard);}
  get baseSpeedMultiplier() {return this.rewardBoardDefinition?.baseSpeedMultiplier??1;}
  get glideEligible() {
    return (this.phase==='running'||this.phase==='paused')&&this.airborne&&this.bailTime<=0&&
      !this.pipeRide&&!this.grinding&&!this.lipMove&&(this.rewardBoardDefinition?.glideFallSpeed||0)>0;
  }
  // Derived rather than latched: landing, bailing, changing boards and the
  // second jump immediately retract the wings, including between render frames.
  get gliding() {return this.glideEligible&&this.vy<0;}
  stepAirVertical(dt,gravity) {
    gravity*=this.characterStats?.gravity??1;
    if(!this.glideEligible){this.vy-=gravity*dt;return this.vy*dt;}
    let travel=0;
    if(this.vy>0){
      const toApex=this.vy/gravity;
      // Preserve the ordinary take-off arc; the perk only changes descent.
      if(toApex>=dt){this.vy-=gravity*dt;return this.vy*dt;}
      travel=this.vy*toApex-.5*gravity*toApex*toApex;
      dt-=toApex;this.vy=0;
    }
    const board=this.rewardBoardDefinition,fallGravity=gravity*board.glideGravityMultiplier;
    const terminal=board.glideFallSpeed,velocity=Math.max(-terminal,this.vy);
    const accelerating=Math.min(dt,Math.max(0,(velocity+terminal)/fallGravity));
    // Integrate both the accelerating and terminal-speed portions exactly,
    // so a slower render frame cannot make the glide float or fall faster.
    travel+=velocity*accelerating-.5*fallGravity*accelerating*accelerating-terminal*(dt-accelerating);
    this.vy=Math.max(-terminal,velocity-fallGravity*dt);
    return travel;
  }
  get popRecoveryDuration() {return POP_COOLDOWN*(this.rewardBoardDefinition?.popRecoveryMultiplier??1);}
  get popCooldown() {return this.popRecovery;}
  get airJumpReady() {
    return this.phase==='running'&&!(this.countdownRemaining>0)&&this.airborne&&this.airtime>=.12&&
      this.bailTime<=0&&!this.trick&&!this.pipeRide&&!this.grinding&&!this.lipMove&&
      this.airJumpsUsed<(this.rewardBoardDefinition?.airJumps||0);
  }
  tryAirJump() {
    if(!this.airJumpReady)return false;
    this.airJumpsUsed++;
    // Add lift in the same flight: never erase an unfinished trick, reset its
    // combo or turn this into another race-boost award opportunity.
    this.vy=Math.min(18*this.jumpPowerMultiplier,Math.max(6.2*this.jumpPowerMultiplier,this.vy+2.2*this.jumpPowerMultiplier));this.charge=0;
    if(this.mode==='surf'&&this.airLaunchSource==='flat')this.airLaunchSource='sky';
    this.onEvent({type:'airJump',rewardBoard:this.rewardBoard,vfx:'wind'});
    return true;
  }
  // Race subclasses can reward a landed trick without changing ordinary surf speeds.
  get forwardSpeedBonus() {return 0;}
  get popReady() {
    const pipeFloor=!this.pipeRide||Math.abs(Math.atan2(Math.sin(this.pipeRide.angle),Math.cos(this.pipeRide.angle)))<.12;
    return this.phase==='running'&&!this.airborne&&this.bailTime<=0&&!this.cutbackActive&&!this.lipMove&&pipeFloor&&this.popCooldown===0;
  }
  get launchSource() {
    if(this.cutbackLaunchTime>0)return 'cutback';
    const crest=waveCrest(-this.distance,this.elapsed);
    return this.mode==='surf'&&Math.abs(this.x-crest)<2.6&&this.speed>=12?'lip':'flat';
  }
  recoverPop(dt) {
    if(!this.airborne&&this.bailTime<=0&&!this.pipeRide&&!this.lipMove)this.popRecovery=Math.max(0,this.popRecovery-dt);
  }
  addCombo(name, points, isTrick = false) {
    const repeats = this.repetitions[name] || 0;
    this.repetitions[name] = repeats + 1;
    const rewardMultiplier=isTrick?(this.rewardBoardDefinition?.trickPointsMultiplier??1):1;
    this.comboBase += Math.round(points * Math.max(0.25, 1 - repeats * 0.2)*rewardMultiplier);
    if (isTrick) { this.multiplier = Math.min(8, this.multiplier + 1); this.pendingTricks++; }
    this.comboNames.push(name);
    this.comboTime = this.comboWindow;
  }
  bank() {
    // Airborne points must be landed before they can be banked.
    if (!this.comboBase || this.airborne || this.bailTime > 0 ||this.cutbackActive) return false;
    const points = this.comboBase * this.multiplier;
    this.score += points; this.bestCombo = Math.max(this.bestCombo, points);
    this.landedTricks += this.pendingTricks;
    this.clearCombo(); this.onEvent({ type: 'bank', points }); return true;
  }
  clearCombo() {
    this.comboBase = 0; this.multiplier = 1; this.comboTime = 0;
    this.comboNames = []; this.repetitions = {}; this.pendingTricks = 0;
    this.lastCompletedTrickType = null;
  }
  bail(reason = 'WIPEOUT') {
    if (this.bailTime > 0 || this.phase !== 'running') return;
    const lost = this.comboBase * this.multiplier;
    this.clearCombo(); this.trick = null; this.airborne = false;
    this.charge = 0; this.vy = 0; this.bailTime = 1.35; this.speed = 8;
    this.popRecovery=POP_COOLDOWN*(this.rewardBoardDefinition?.popRecoveryMultiplier??1);this.cutbackLaunchTime=0;this.airJumpsUsed=0;
    if(this.barrelRun)this.barrelRun.bailed=true;
    if(this.barrel)this.barrel.inside=false;
    this.rotation = 0; this.flipRotation = 0; this.boardRotation = 0;this.rollRotation=0;this.cutback=0;this.cutbackActive=false; this.wipeouts++;
    if(this.mode==='surf'&&this.rulesId==='storm')this.lives=Math.max(0,this.lives-1);
    this.updateObjective();this.onEvent({ type: 'bail', reason, lost,lives:this.lives });
    if(this.mode==='surf'&&this.rulesId==='storm'&&this.lives===0)this.finish('OUT OF LIVES');
  }
  jump() {
    if(this.airborne)return this.tryAirJump();
    if(!this.popReady)return false;
    this.lastJump = this.elapsed;
    this.airLaunchSource=this.launchSource;this.launchTricks=0;this.popRecovery=this.popRecoveryDuration;this.airJumpsUsed=0;
    this.airborne = true; this.airtime = 0; this.trick = null;
    this.vy=(this.airLaunchSource==='flat'?2.2+this.charge*.4:(this.airLaunchSource==='lip'?8.2:7.6)+this.charge*2.5)*this.jumpPowerMultiplier;
    this.cutbackLaunchTime=0;
    this.y += 0.06; this.charge = 0; this.rotation = 0; this.flipRotation = 0; this.boardRotation = 0;this.rollRotation=0;
    this.onEvent({ type: 'jump',source:this.airLaunchSource }); return true;
  }
  doTrick(type) {
    if (!Object.hasOwn(TRICKS,type) || this.phase !== 'running' || !this.airborne || this.trick || this.bailTime > 0) return false;
    if(this.mode==='surf'&&this.airLaunchSource==='flat')return false;
    this.trick = { type, age: 0, ...TRICKS[type] };
    this.trick.duration/=this.characterStats?.trickSpeed??1;
    const animation = this.comboBase > 0 ? findComboAnimation(this.lastCompletedTrickType, type) : null;
    const variation = animation ? { comboAnimation:animation.id, comboAnimationName:animation.name } : {};
    Object.assign(this.trick, variation);
    this.onEvent({ type: 'trickStart', trick: type, ...variation }); return true;
  }
  completeTrick() {
    if(!this.trick)return false;
    const t=this.trick;
    this.rotation+=t.spin||0;this.flipRotation+=t.flip||0;
    this.boardRotation+=t.boardSpin||0;this.rollRotation+=t.roll||0;
    this.launchTricks++;this.addCombo(t.name,t.points,true);this.lastCompletedTrickType=t.type;this.trick=null;
    this.onEvent({type:'trick',name:t.name,rewardBoard:this.rewardBoard||null,vfx:this.rewardBoardDefinition?.vfx||null});return true;
  }
  updateAirTrick(dt) {
    if(!this.trick)return;
    this.trick.age+=dt;
    if(this.trick.age>=this.trick.duration)this.completeTrick();
  }
  resolveLandingTrick() {
    this.airJumpsUsed=0;
    if(!this.trick)return {landed:true,assisted:false};
    const grace=this.characterStats?this.characterStats.landingGrace:Math.min(LANDING_GRACE,this.trick.duration*.2);
    if(this.trick.duration-this.trick.age>grace+1e-8){this.bail('UNFINISHED TRICK');return {landed:false,assisted:false};}
    // Finish one nearly complete move exactly once. It is never banked in air
    // and a grossly incomplete move still loses the active combo.
    this.completeTrick();return {landed:true,assisted:true};
  }
  doCutback(direction=0) {
    if(this.mode!=='surf'||this.phase!=='running'||this.airborne||this.bailTime>0||this.cutbackActive||this.cutbackCooldown>0||this.speed<8)return false;
    this.cutbackDirection=Number.isFinite(direction)&&direction!==0?Math.sign(direction):Math.abs(this.vx)>.8?-Math.sign(this.vx):this.x>0?-1:1;
    this.cutbackActive=true;this.cutbackAge=0;this.cutbackProgress=0;this.cutback=.001;this.cutbackCooldown=1.5;
    this.charge=0;this.onEvent({type:'cutbackStart',direction:this.cutbackDirection});return true;
  }
  updateObjective() {
    this.objectiveText=this.rulesId==='rush'?`CATCH 12 CHECKPOINTS · ${this.gates}/12 · +8s PER RING`:this.rulesId==='storm'?`ENDLESS STORM · STAGE ${this.stormStage} · ${this.lives} ${this.lives===1?'LIFE':'LIVES'} · RIDE THE BARRELS`:'LAND CLEAN · LINK TRICKS · SCORE BIG';
  }
  finish(reason) {
    if(this.phase!=='running')return;
    if(this.airborne||this.bailTime>0||this.cutbackActive)this.clearCombo();else this.bank();
    this.lastCompletedTrickType = null;
    this.resultReason=reason;this.phase='finished';this.onEvent({type:'finish',reason});
  }
  update(dt, input = {}) {
    if (this.phase !== 'running') return;
    dt=clamp(dt,0,.05);if(dt===0)return;
    const steps=Math.max(1,Math.ceil(dt*120-1e-8));
    for(let i=0;i<steps&&this.phase==='running';i++)this.stepSurf(dt/steps,input);
  }
  stepSurf(dt,input) {
    const previousDistance=this.distance,previousX=this.x,previousY=this.y;
    this.elapsed += dt; this.time = this.rules.endless?this.elapsed:Math.max(0,this.time-dt);
    if(this.rulesId==='storm') {
      this.stormDifficulty=stormDifficulty(this.elapsed);
      const stage=1+Math.floor(this.elapsed/30);
      if(stage!==this.stormStage){this.stormStage=stage;this.updateObjective();this.onEvent({type:'stormStage',stage});}
    }
    this.recoverPop(dt);this.cutbackLaunchTime=Math.max(0,this.cutbackLaunchTime-dt);
    this.cutbackCooldown=Math.max(0,this.cutbackCooldown-dt);
    const steering = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const chord=input.grind?steering:0;
    if(chord!==this.cutbackChord){this.cutbackChord=chord;this.cutbackChordArmed=true;}
    // Consume only a successful chord. A held airborne/cooldown attempt can
    // start when it becomes legal, but continued holding cannot repeat it.
    if(chord&&this.cutbackChordArmed&&this.doCutback(chord))this.cutbackChordArmed=false;
    this.current=(1.35*Math.sin(this.distance*.022+this.elapsed*.5)+.7*Math.sin(this.elapsed*1.1))*this.rules.currentStrength*(1+this.stormDifficulty*.8);
    if(this.cutbackActive){this.cutbackAge+=dt;this.cutbackProgress=clamp(this.cutbackAge/.72,0,1);this.cutback=Math.sin(this.cutbackProgress*Math.PI);}
    // Board cruise speed and earned bursts are separate: a 25% faster deck
    // with a 50% stronger boost never multiplies that boost a second time.
    const baseSpeed=((input.pump ? this.rules.pumpSpeed : this.rules.normalSpeed)+this.stormDifficulty*5)*this.baseSpeedMultiplier;
    const targetSpeed = this.bailTime > 0 ? 8 : (input.brake ? this.rules.brakeSpeed : baseSpeed+this.forwardSpeedBonus)*(this.cutbackActive?.72:1);
    const acceleration=1.7*this.accelerationMultiplier;
    const previousSpeed = this.speed, decay = Math.exp(-dt * acceleration);
    this.speed = targetSpeed + (previousSpeed - targetSpeed) * decay;
    this.distance += targetSpeed * dt + (previousSpeed - targetSpeed) * (1 - decay) / acceleration;
    const control=steering*(this.airborne?(this.characterStats?.airControl??1):(this.characterStats?.steering??1));
    const lateral=this.bailTime>0?0:this.cutbackActive?this.cutbackDirection*(6+7*this.cutback)+control*2:this.airborne?control*(input.brake?3.2:8)+this.current*.3:control*10+this.current;
    this.vx += (lateral-this.vx)*(1-Math.exp(-dt*(this.airborne?4:7)));
    this.x += this.vx * dt;
    if (this.x < MIN_X || this.x > MAX_X) {
      this.x = clamp(this.x, MIN_X, MAX_X); this.vx = 0;
      if (!this.airborne) this.bail('OFF THE WAVE');
    }
    if(this.phase!=='running')return;
    const ground = waveHeight(this.x, -this.distance, this.elapsed);
    if (this.bailTime > 0) {
      this.bailTime = Math.max(0, this.bailTime - dt); this.y = ground;
      if (this.bailTime === 0) { this.x = clamp(this.x, -12, 13); this.onEvent({ type: 'recover' }); }
    } else if (this.airborne) {
      this.airtime += dt; this.y += this.stepAirVertical(dt,10.5);
      this.updateAirTrick(dt);
      if (this.y <= ground && this.vy < 0 && this.airtime > 0.12) {
        this.y = ground; this.airborne = false; this.vy = 0;
        if(Math.abs(this.vx)>this.rules.landingTolerance)this.bail('SIDEWAYS LANDING — RELEASE STEER OR BRAKE');
        else {
          const landing=this.resolveLandingTrick();
          if(landing.landed){
            if(this.launchTricks>0)this.addCombo('CLEAN LANDING',120);
            this.onEvent({type:'land',points:this.comboBase*this.multiplier,assisted:landing.assisted});
          }
        }
      }
    } else {
      this.y = ground;
      if(this.cutbackActive&&this.cutbackProgress>=1) {
        this.cutbackActive=false;this.cutback=0;this.cutbackLaunchTime=CUTBACK_LAUNCH_WINDOW;
        this.onEvent({type:'cutback',direction:this.cutbackDirection,launchTime:this.cutbackLaunchTime});
      }
      if (input.jump) this.charge = clamp(this.charge + dt * 1.3, 0, 1);
      else this.charge = Math.max(0, this.charge - dt * 3);
      // Strong carving on the wave face earns small, banked style points.
      if (!this.cutbackActive&&Math.abs(this.vx) > 5 && this.x < 8 && !input.brake) {
        this.carveTime += dt;
        if (this.carveTime >= 0.8) { this.score += 35; this.carveTime = 0; }
      } else this.carveTime = 0;
      if (this.comboBase&&!this.cutbackActive) { this.comboTime -= dt; if (this.comboTime <= 0) this.bank(); }
    }
    if(this.phase!=='running')return;
    if(this.rulesId==='storm')this.updateStormBarrel(dt,{x:previousX,y:previousY,z:-previousDistance});
    if(this.phase!=='running')return;
    // Course objects are generated deterministically; each can trigger once.
    const current = Math.floor((this.distance-this.rules.firstGate)/this.rules.spacing);
    const first=Math.max(0,Math.floor((previousDistance-this.rules.firstGate)/this.rules.spacing)-1);
    for (let i=first;i<=current+1;i++) {
      const item = courseItem(i,this.rulesId);
      if (previousDistance<=item.distance&&this.distance>=item.distance&&!this.processed.has(`g${i}`)) {
        this.processed.add(`g${i}`);
        const fraction=clamp((item.distance-previousDistance)/(this.distance-previousDistance||1),0,1),crossX=previousX+(this.x-previousX)*fraction,crossY=previousY+(this.y-previousY)*fraction;
        const ringY = waveHeight(item.x, -item.distance, this.elapsed) + 1.6;
        if (Math.abs(crossX-item.x)<item.ringRadius&&Math.abs(crossY+.9-ringY)<item.ringRadius&&this.bailTime<=0) {
          this.gates++;this.score+=250;this.time+=this.rules.checkpointBonus;this.updateObjective();
          this.onEvent({type:'gate',index:i,bonus:this.rules.checkpointBonus,gates:this.gates});
          if(this.rules.targetGates&&this.gates>=this.rules.targetGates){this.finish('RACE COMPLETE');return;}
        }else this.onEvent({type:'missedGate',index:i});
      }
      if (previousDistance<=item.hazardDistance+2.2&&this.distance>=item.hazardDistance-2.2&&!this.processed.has(`h${i}`)) {
        // Sweep the board through the reef footprint. Checking only the first
        // approach frame lets a rider enter its side after being marked clear.
        const ax=(previousX-item.hazardX)/item.hazardRadius,az=(previousDistance-item.hazardDistance)/2.2;
        const dx=(this.x-previousX)/item.hazardRadius,dz=(this.distance-previousDistance)/2.2;
        const fraction=clamp(-(ax*dx+az*dz)/(dx*dx+dz*dz||1),0,1),crossY=previousY+(this.y-previousY)*fraction;
        const reefTop=waveHeight(item.hazardX,-item.hazardDistance,this.elapsed)+item.hazardHeight;
        if((ax+dx*fraction)**2+(az+dz*fraction)**2<1&&crossY<reefTop&&this.bailTime<=0) {
          this.processed.add(`h${i}`);this.bail('REEF COLLISION');
          if(this.phase!=='running')return;
        }
      }
      if(this.distance>item.hazardDistance+2.2)this.processed.add(`h${i}`);
    }
    this.landingControl=clamp(Math.abs(this.vx)/this.rules.landingTolerance,0,1);
    this.landingWarning=this.airborne&&this.vy<0&&this.y-ground<3&&this.landingControl>.8?'RELEASE STEER / BRAKE TO LAND':'';
    this.danger=Math.max(clamp((Math.abs(this.x)-11)/5,0,1),this.landingWarning?this.landingControl:0,this.bailTime>0?1:0);
    for(let i=Math.max(0,current);i<=current+2;i++) {
      const item=courseItem(i,this.rulesId),ahead=item.hazardDistance-this.distance;
      if(ahead>=0&&ahead<48&&Math.abs(this.x-item.hazardX)<item.hazardRadius+1)this.danger=Math.max(this.danger,1-ahead/48);
    }
    if(this.rules.endless&&current>this.lastPrunedCourse) {
      this.lastPrunedCourse=current;
      for(const key of this.processed)if(Number(key.slice(1))<current-8)this.processed.delete(key);
    }
    if (!this.rules.endless&&this.time <= 0) {
      this.finish(this.rulesId==='rush'?'TIME EXPIRED':'SESSION COMPLETE');
    }
  }
  updateStormBarrel(dt,previous) {
    const contact=this.bailTime<=0?sweepStormBarrel(previous,{x:this.x,y:this.y,z:-this.distance},this.elapsed-dt,this.elapsed):null;
    if(contact)this.bail('CAUGHT BY THE WAVE LIP');
    if(this.phase!=='running')return;
    const sample=sampleStormBarrel(this.x,this.y,-this.distance,this.elapsed);
    if(sample) {
      const {barrel,section}=sample;
      if(this.barrelRun?.id!==barrel.id)this.barrelRun={id:barrel.id,index:barrel.index,time:0,insideDistance:0,bailed:this.bailTime>0,entered:false};
      const run=this.barrelRun,inside=sample.inside&&this.bailTime<=0;
      if(inside){
        if(!run.entered){run.entered=true;this.onEvent({type:'barrelEnter',index:barrel.index});}
        run.time+=dt;run.insideDistance+=Math.max(0,this.distance+previous.z);this.barrelTime+=dt;
      }
      this.barrel={id:barrel.id,index:barrel.index,inside,time:run.time,progress:section.progress,x:section.centerX,startDistance:barrel.startDistance,endDistance:barrel.endDistance};
    } else {
      this.barrel=null;
      const run=this.barrelRun;
      if(run&&this.distance>stormBarrel(run.index).endDistance) {
        if(!run.bailed&&run.time>=.7&&run.insideDistance>=20&&run.index>this.lastBarrelAward&&this.bailTime<=0) {
          const points=600+Math.min(400,Math.floor(run.time*100));
          this.score+=points;this.barrelsSurvived++;this.lastBarrelAward=run.index;
          this.onEvent({type:'barrelExit',index:run.index,points,rideTime:run.time});
        }
        this.barrelRun=null;
      }
    }
    const nextIndex=Math.max(0,Math.floor((this.distance-STORM_BARREL_FIRST)/STORM_BARREL_SPACING)+1);
    const next=stormBarrel(nextIndex);
    this.nextBarrelDistance=sample?0:next.startDistance-this.distance;
    if(!sample&&this.nextBarrelDistance<=90) {
      const section=barrelCrossSection(next,-next.centerDistance,this.elapsed);
      this.barrel={id:next.id,index:next.index,inside:false,time:0,progress:0,x:section.centerX,startDistance:next.startDistance,endDistance:next.endDistance};
    }
  }
}
