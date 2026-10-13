export const TIME_POWER_CHARGE = 6;
export const TIME_POWER_SCALE = .4;
export const TIME_POWER_RECHARGE = 12;
export const TIME_POWER_BURST_SECONDS = 3;
export const TIME_POWER_BURST_MULTIPLIER = 1.5;

// Real active-play time owns the power. Simulation time, including the opponent,
// waves and tricks, is slowed together; pausing cannot spend or refill a charge.
export class TimePower {
  constructor(emit = () => {}) { this.emit = emit; this.reset(); }
  reset() { this.active = false; this.charge = TIME_POWER_CHARGE; this.cooldown = 0; this.burst = 0; }
  stop(reason = 'toggle') {
    const wasActive = this.active;
    this.active = false;
    if (wasActive) this.emit({ type:'timePower', active:false, reason });
    return wasActive;
  }
  cancel(reason) { this.stop(reason); this.burst = 0; }
  toggle(allowed) {
    if (!allowed) return false;
    if (this.active) return this.stop('toggle');
    if (this.charge <= 0 || this.cooldown > 0 || this.burst > 0) return false;
    this.active = true;
    this.emit({ type:'timePower', active:true, reason:'toggle', charge:this.charge, duration:TIME_POWER_CHARGE });
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
      const slow = Math.min(remaining, this.charge);
      this.charge = Math.max(0, this.charge - slow);
      remaining -= slow; simulated += slow * TIME_POWER_SCALE;
      if (this.charge < 1e-9) {
        this.charge = 0; this.stop('spent');
        this.cooldown = TIME_POWER_RECHARGE;
        this.burst = TIME_POWER_BURST_SECONDS;
        this.emit({ type:'timePowerBurst', duration:this.burst, multiplier:TIME_POWER_BURST_MULTIPLIER });
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
