// A full charge is latched: only using the special or starting a new run clears it.
export class SpecialMeter {
  constructor() { this.value = 0; }
  get ready() { return this.value >= 1; }
  reset() { this.value = 0; }
  gain(amount) { this.value = Math.min(1, this.value + Math.max(0, amount)); }
  update(dt) { if (!this.ready) this.value = Math.max(0, this.value - Math.max(0, dt) * .006); }
  bail() { if (!this.ready) this.value *= .4; }
  consume() { if (!this.ready) return false; this.value = 0; return true; }
}
