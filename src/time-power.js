export const TIME_POWER_CHARGE = 6;
export const TIME_POWER_SCALE = .4;
export const TIME_POWER_FAST_SCALE = 2;
export const TIME_POWER_RECHARGE = 12;
export const TIME_POWER_BURST_SECONDS = 3;
export const TIME_POWER_BURST_MULTIPLIER = 1.5;

// Charge uses real active-play seconds. Slow motion scales both clocks in
// regular sessions; races can preserve rider speed. Fast-forward scales both.
export class TimePower {
  constructor(emit = () => {}) { this.emit = emit; this.duration = TIME_POWER_CHARGE; this.reset(); }
  reset() { this.revision = (this.revision ?? 0) + 1; this.active = false; this.mode = 'slow'; this.charge = this.capacity; this.cooldown = 0; this.burst = 0; this.lastPlayerDelta = 0; }
  get capacity() { return this.mode === 'fast' ? TIME_POWER_CHARGE : this.duration; }
  setDuration(value) {
    const duration = typeof value === 'number' && Number.isFinite(value)
      ? Math.round(Math.max(1, Math.min(60, value)) * 10) / 10 : TIME_POWER_CHARGE;
    if (duration === this.duration) return this.duration;
    const remaining = this.charge / this.capacity;
    this.duration = duration;
    this.charge = remaining * this.capacity;
    this.revision++;
    return this.duration;
  }
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
    const remaining = this.charge / this.capacity;
    this.active = true;
    this.mode = mode;
    this.charge = remaining * this.capacity;
    this.revision++;
    this.emit({ type:'timePower', active:true, reason, mode:this.mode, timeScale:this.timeScale, charge:this.charge, duration:this.capacity });
    return true;
  }
  update(dt, { playing, equipped, recovering = false, ended = false, preservePlayerSpeed = false }) {
    this.lastPlayerDelta = 0;
    if (!equipped || recovering || ended) this.cancel(!equipped ? 'unequip' : recovering ? 'bail' : 'finish');
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    // The caller still needs ordinary dt to advance a race countdown. Its
    // existing phase guards freeze the simulation and camera while paused.
    if (!playing) { this.lastPlayerDelta = dt; return dt; }
    let remaining = dt, simulated = 0;
    if (this.active) {
      const activeTime = Math.min(remaining, this.charge);
      this.charge = Math.max(0, this.charge - activeTime);
      remaining -= activeTime; simulated += activeTime * this.timeScale;
      this.lastPlayerDelta += activeTime * (this.mode === 'slow' && preservePlayerSpeed ? 1 : this.timeScale);
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
          this.cooldown = 0; this.charge = this.capacity;
          this.emit({ type:'timePowerReady' });
        }
      }
      simulated += remaining;
      this.lastPlayerDelta += remaining;
    }
    return simulated;
  }
}
