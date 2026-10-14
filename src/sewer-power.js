export const SEWER_POWER_DURATION = 5;
export const SEWER_POWER_COOLDOWN = 15;
export const SEWER_POWER_SPEED_MULTIPLIER = 1.35;

// Charge uses active real-play seconds, just like Deadtime. Switching boards,
// pausing and repeated Q presses cannot refill or extend an activation.
export class SewerPower {
  constructor(emit=()=>{}) {this.emit=emit;this.reset();}
  reset() {this.remaining=0;this.cooldown=0;}
  get active() {return this.remaining>0;}
  activate(allowed) {
    if(!allowed||this.active||this.cooldown>0)return false;
    this.remaining=SEWER_POWER_DURATION;
    this.emit({type:'sewerPower',active:true,duration:SEWER_POWER_DURATION,multiplier:SEWER_POWER_SPEED_MULTIPLIER});
    return true;
  }
  cancel(reason='unequip') {
    if(!this.active)return false;
    this.remaining=0;this.cooldown=SEWER_POWER_COOLDOWN;
    this.emit({type:'sewerPower',active:false,reason,cooldown:this.cooldown});return true;
  }
  update(dt,{playing,equipped,recovering=false,ended=false}) {
    if(!equipped||recovering||ended)this.cancel(!equipped?'unequip':recovering?'bail':'finish');
    if(!playing||!Number.isFinite(dt)||dt<=0)return;
    let leftover=dt;
    if(this.active) {
      const spent=Math.min(leftover,this.remaining);
      this.remaining=Math.max(0,this.remaining-spent);leftover-=spent;
      if(this.remaining<1e-9){this.remaining=0;this.cooldown=SEWER_POWER_COOLDOWN;this.emit({type:'sewerPower',active:false,reason:'spent',cooldown:this.cooldown});}
    }
    if(leftover>0&&this.cooldown>0){
      this.cooldown=Math.max(0,this.cooldown-leftover);
      if(this.cooldown<1e-9){this.cooldown=0;this.emit({type:'sewerPowerReady'});}
    }
  }
}
