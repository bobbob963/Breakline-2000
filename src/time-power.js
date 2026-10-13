export const TIME_POWER_CHARGE = 6;
export const TIME_POWER_SCALE = .4;
export const TIME_POWER_FAST_SCALE = 2;
export const TIME_POWER_RECHARGE = 12;
export const TIME_POWER_BURST_SECONDS = 3;
export const TIME_POWER_BURST_MULTIPLIER = 1.5;

// Real active-play time owns the power. Simulation time, including the opponent,
// waves and tricks, changes speed together; pausing cannot spend or refill a charge.
export class TimePower {
  constructor(emit = () => {}) { this.emit = emit; this.reset(); }
  reset() { this.revision = (this.revision ?? 0) + 1; this.active = false; this.mode = 'slow'; this.charge = TIME_POWER_CHARGE; this.cooldown = 0; this.burst = 0; }
  get timeScale() { return this.active ? (this.mode === 'fast' ? TIME_POWER_FAST_SCALE : TIME_POWER_SCALE) : 1; }
  stop(reason = 'toggle') {
    const wasActive = this.active;
    this.active = false;
    if (wasActive) { this.revision++; this.emit({ type:'timePower', active:false, reason, mode:this.mode, timeScale:1 }); }
    return wasActive;
  }
  cancel(reason) { if (!this.stop(reason)) this.revision++; this.burst = 0; }
  toggle(allowed) {
    if (!allowed) return false;
    if (this.active) return this.stop('toggle');
    return this.activate('slow');
  }
  fastForward(allowed) {
    if (!allowed || (this.active && this.mode === 'fast')) return false;
    return this.activate('fast');
  }
  activate(mode) {
    if (this.charge <= 0 || this.cooldown > 0 || this.burst > 0) return false;
    const reason = this.active ? 'switch' : 'toggle';
    this.active = true;
    this.mode = mode;
    this.revision++;
    this.emit({ type:'timePower', active:true, reason, mode:this.mode, timeScale:this.timeScale, charge:this.charge, duration:TIME_POWER_CHARGE });
    return true;
  }
  update(dt, { playing, equipped, recovering = false, ended = false }) {
    if (!equipped || recovering || ended) this.cancel(!equipped ? 'unequip' : recovering ? 'bail' : 'finish');
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    // The caller still needs ordinary dt to advance a race countdown. Its
    // existing phase guards freeze the simulation and camera while paused.
    if (!playing) return dt;
    let remaining = dt, simulated = 0;
    if (this.active) {
      const activeTime = Math.min(remaining, this.charge);
      this.charge = Math.max(0, this.charge - activeTime);
      remaining -= activeTime; simulated += activeTime * this.timeScale;
      if (this.charge < 1e-9) {
        this.charge = 0; this.stop('spent');
        this.cooldown = TIME_POWER_RECHARGE;
        this.burst = TIME_POWER_BURST_SECONDS;
        this.emit({ type:'timePowerBurst', duration:this.burst, multiplier:TIME_POWER_BURST_MULTIPLIER, mode:this.mode });
      }
    }
    // Only time after the last drop of charge counts toward the burst/recharge.
    if (remaining > 0) {
      this.burst = Math.max(0, this.burst - remaining);
      if (this.cooldown > 0) {
        this.cooldown = Math.max(0, this.cooldown - remaining);
        if (this.cooldown < 1e-9) {
          this.cooldown = 0; this.charge = TIME_POWER_CHARGE;
          this.emit({ type:'timePowerReady' });
        }
      }
      simulated += remaining;
    }
    return simulated;
  }
}
