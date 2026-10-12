import { TRICKS, waveHeight } from './game.js';

export const RACE_BOOST_MAX_SPEED=13;
export const RACE_BOOST_MAX_DURATION=3.6;
export const RACE_POP_RECOVERY=1;

// Both competitors use these exact rules. The mixin is also usable without a
// race controller, so an opponent never recursively creates more opponents.
export const RaceRider=Base=>class extends Base {
  reset(){super.reset();this.clearRaceBoost();this._boostAwardedForAir=true;this._nextRaceAir=2;}
  get forwardSpeedBonus(){return this.boostTime>0?this.boostSpeed:0;}
  clearRaceBoost(){this.boostTime=0;this.boostDuration=0;this.boostSpeed=0;this.boostLevel=null;this.boostLabel='';this._pendingRaceBoost=null;}
  launch(...args){super.launch(...args);this.popRecovery=RACE_POP_RECOVERY;this._boostAwardedForAir=false;}
  jump(){
    const charge=this.charge,launched=super.jump();
    if(launched){
      this.popRecovery=RACE_POP_RECOVERY;this._boostAwardedForAir=false;
      // Race water has enough lift for a basic trick from a short charged pop.
      // Ordinary Surf Session keeps its original lip/cutback requirement.
      if(this.mode==='surf'&&this.airLaunchSource==='flat'){
        this.airLaunchSource='race-pop';this.vy=6.4+charge*2;
      }
    }
    return launched;
  }
  resolveLandingTrick(){
    const landing=super.resolveLandingTrick();
    if(landing.landed&&!this._boostAwardedForAir&&this.launchTricks>0&&this.bailTime<=0){
      this._boostAwardedForAir=true;this._pendingRaceBoost={tricks:this.pendingTricks};
    }
    return landing;
  }
  awardRaceBoost({tricks}){
    const combo=tricks>1,speed=combo?Math.min(RACE_BOOST_MAX_SPEED,9+(tricks-2)*2):6,
      duration=combo?Math.min(RACE_BOOST_MAX_DURATION,2.6+(tricks-2)*.5):2;
    this.boostSpeed=speed;this.boostTime=this.boostDuration=duration;
    this.boostLevel=combo?'combo':'trick';this.boostLabel=combo?'COMBO BOOST':'TRICK BOOST';this._pendingRaceBoost=null;
    this.onEvent({type:'raceBoost',tricks,combo,speed,duration});
  }
  clearCombo(){super.clearCombo();this._pendingRaceBoost=null;}
  bail(reason){if(this.bailTime<=0&&this.phase==='running')this.clearRaceBoost();return super.bail(reason);}
};

export function drainRaceBoost(rider,dt){
  if(rider.boostTime<=0)return;
  rider.boostTime=Math.max(0,rider.boostTime-dt);
  if(rider.boostTime<1e-9){const pending=rider._pendingRaceBoost;rider.clearRaceBoost();rider._pendingRaceBoost=pending;}
}

// This policy asks for moves through the same public controls as a human.
// It reads only the rival's own state and route; no catch-up or free rewards.
export function raceTrickInput(rider,input,{safePop=false}={}){
  if(rider.bailTime>0||rider.phase!=='running')return input;
  if(rider.airborne){
    if(!rider.trick&&rider.launchTricks<2){
      const ground=rider.mode==='surf'?waveHeight(rider.x,-rider.distance,rider.elapsed):rider.surface.height;
      const gravity=rider.mode==='surf'?10.5:11.2;
      const flight=(rider.vy+Math.sqrt(Math.max(0,rider.vy*rider.vy+2*gravity*Math.max(0,rider.y-ground))))/gravity;
      const type=rider.launchTricks===0?'spin':rider.lastCompletedTrickType==='spin'?'grab':'shuvit';
      // Keep extra time for a rising surface and the full grab release.
      if(flight>TRICKS[type].duration+.19)rider.doTrick(type);
    }
    return input;
  }
  if(rider.popReady&&rider.elapsed>=rider._nextRaceAir&&safePop){
    if(rider.charge>=.45){
      if(rider.jump())rider._nextRaceAir=rider.elapsed+6.5;
    }else return {...input,jump:true};
  }
  return input;
}
