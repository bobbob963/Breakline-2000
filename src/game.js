// Rendering-independent arcade simulation. Units are metres and seconds.
export const RUN_SECONDS = 120;
export const COMBO_WINDOW = 3.8;
export const MIN_X = -16;
export const MAX_X = 17;
export const TRICKS = {
  spin: { name: '180 SPIN', points: 300, duration: 0.43, spin: Math.PI },
  flip: { name: 'KICKFLIP', points: 550, duration: 0.62, flip: Math.PI * 2 },
  grab: { name: 'INDY GRAB', points: 220, duration: 0.34, grab: 1 },
  shuvit: { name: 'SHUV-IT', points: 450, duration: 0.48, boardSpin: Math.PI * 2 },
  heelflip: { name: 'HEELFLIP', points: 650, duration: 0.65, flip: -Math.PI * 2 },
  method: { name: 'METHOD AIR', points: 400, duration: 0.52, grab: 1.2 },
  spin360: { name: '360 AIR', points: 700, duration: 0.7, spin: Math.PI * 2 },
  special: { name: 'RODEO AIR', points: 1200, duration: 0.82, spin: Math.PI * 2, flip: Math.PI * 2, grab: .45 },
};
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function waveHeight(x, z, t) {
  const crest = -9 + Math.sin(z * 0.026 + t * 0.38) * 1.1;
  return 3.9 * Math.exp(-(((x - crest) / 5.4) ** 2))
    + Math.sin(z * 0.07 + t * 1.2) * 0.32
    + Math.sin(z * 0.34 + x * 0.45 + t * 2) * 0.1;
}
export function courseItem(index) {
  const pattern = [-3, 5, -8, 2, 10, -5];
  return { index, distance: 70 + index * 72, x: pattern[index % pattern.length], hazardX: index % 2 ? -12 : 13 };
}

export class SurfGame {
  constructor(onEvent = () => {}) { this.onEvent = onEvent; this.reset(); }
  reset() {
    Object.assign(this, {
      mode: 'surf', phase: 'ready', time: RUN_SECONDS, elapsed: 0, distance: 0,
      x: 1, vx: 0, speed: 16, y: waveHeight(1, 0, 0), vy: 0,
      airborne: false, airtime: 0, charge: 0, trick: null,
      comboBase: 0, multiplier: 1, comboTime: 0, comboNames: [], repetitions: {},
      score: 0, bestCombo: 0, landedTricks: 0, pendingTricks: 0,
      gates: 0, wipeouts: 0, bailTime: 0, carveTime: 0,
      processed: new Set(), lastJump: -10, rotation: 0, flipRotation: 0, boardRotation: 0,
    });
    this.onEvent({ type: 'reset' });
  }
  start() { this.reset(); this.phase = 'running'; this.onEvent({ type: 'start' }); }
  pause() { if (this.phase === 'running') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'running'; }
  addCombo(name, points, isTrick = false) {
    const repeats = this.repetitions[name] || 0;
    this.repetitions[name] = repeats + 1;
    this.comboBase += Math.round(points * Math.max(0.25, 1 - repeats * 0.2));
    if (isTrick) { this.multiplier = Math.min(8, this.multiplier + 1); this.pendingTricks++; }
    this.comboNames.push(name);
    this.comboTime = COMBO_WINDOW;
  }
  bank() {
    // Airborne points must be landed before they can be banked.
    if (!this.comboBase || this.airborne || this.bailTime > 0) return false;
    const points = this.comboBase * this.multiplier;
    this.score += points; this.bestCombo = Math.max(this.bestCombo, points);
    this.landedTricks += this.pendingTricks;
    this.clearCombo(); this.onEvent({ type: 'bank', points }); return true;
  }
  clearCombo() {
    this.comboBase = 0; this.multiplier = 1; this.comboTime = 0;
    this.comboNames = []; this.repetitions = {}; this.pendingTricks = 0;
  }
  bail(reason = 'WIPEOUT') {
    if (this.bailTime > 0 || this.phase !== 'running') return;
    const lost = this.comboBase * this.multiplier;
    this.clearCombo(); this.trick = null; this.airborne = false;
    this.charge = 0; this.vy = 0; this.bailTime = 1.35; this.speed = 8;
    this.rotation = 0; this.flipRotation = 0; this.boardRotation = 0; this.wipeouts++;
    this.onEvent({ type: 'bail', reason, lost });
  }
  jump() {
    if (this.phase !== 'running' || this.airborne || this.bailTime > 0 || this.elapsed - this.lastJump < 0.3) return false;
    this.lastJump = this.elapsed;
    this.airborne = true; this.airtime = 0; this.trick = null;
    this.vy = 6.6 + this.charge * 3.2 + (this.x < -4 ? 1.8 : 0);
    this.y += 0.06; this.charge = 0; this.rotation = 0; this.flipRotation = 0; this.boardRotation = 0;
    this.addCombo(this.x < -4 ? 'LIP LAUNCH' : 'OLLIE', this.x < -4 ? 180 : 100);
    this.onEvent({ type: 'jump' }); return true;
  }
  doTrick(type) {
    if (!TRICKS[type] || this.phase !== 'running' || !this.airborne || this.trick || this.bailTime > 0) return false;
    this.trick = { type, age: 0, ...TRICKS[type] };
    this.onEvent({ type: 'trickStart', trick: type }); return true;
  }
  update(dt, input = {}) {
    if (this.phase !== 'running') return;
    dt = clamp(dt, 0, 0.05);
    this.elapsed += dt; this.time = Math.max(0, RUN_SECONDS - this.elapsed);
    const steering = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const targetSpeed = this.bailTime > 0 ? 8 : input.brake ? 10 : input.pump ? 25 : 18;
    const previousSpeed = this.speed, decay = Math.exp(-dt * 1.7);
    this.speed = targetSpeed + (previousSpeed - targetSpeed) * decay;
    this.distance += targetSpeed * dt + (previousSpeed - targetSpeed) * (1 - decay) / 1.7;
    this.vx += ((this.bailTime > 0 ? 0 : steering * (this.airborne ? 5.5 : 9)) - this.vx) * (1 - Math.exp(-dt * 6));
    this.x += this.vx * dt;
    if (this.x < MIN_X || this.x > MAX_X) {
      this.x = clamp(this.x, MIN_X, MAX_X); this.vx = 0;
      if (!this.airborne) this.bail('OFF THE WAVE');
    }
    const ground = waveHeight(this.x, -this.distance, this.elapsed);
    if (this.bailTime > 0) {
      this.bailTime = Math.max(0, this.bailTime - dt); this.y = ground;
      if (this.bailTime === 0) { this.x = clamp(this.x, -12, 13); this.onEvent({ type: 'recover' }); }
    } else if (this.airborne) {
      this.airtime += dt; this.vy -= 10.5 * dt; this.y += this.vy * dt;
      if (this.trick) {
        this.trick.age += dt;
        if (this.trick.age >= this.trick.duration) {
          const t = this.trick;
          this.rotation += t.spin || 0;
          this.flipRotation += t.flip || 0;
          this.boardRotation += t.boardSpin || 0;
          this.addCombo(t.name, t.points, true); this.trick = null;
          this.onEvent({ type: 'trick', name: t.name });
        }
      }
      if (this.y <= ground && this.vy < 0 && this.airtime > 0.12) {
        this.y = ground; this.airborne = false; this.vy = 0;
        if (this.trick) this.bail('UNFINISHED TRICK');
        else {
          this.addCombo('CLEAN LANDING', 120);
          this.onEvent({ type: 'land', points: this.comboBase * this.multiplier });
        }
      }
    } else {
      this.y = ground;
      if (input.jump) this.charge = clamp(this.charge + dt * 1.3, 0, 1);
      else this.charge = Math.max(0, this.charge - dt * 3);
      // Strong carving on the wave face earns small, banked style points.
      if (Math.abs(this.vx) > 5 && this.x < 8 && !input.brake) {
        this.carveTime += dt;
        if (this.carveTime >= 0.8) { this.score += 35; this.carveTime = 0; }
      } else this.carveTime = 0;
      if (this.comboBase) { this.comboTime -= dt; if (this.comboTime <= 0) this.bank(); }
    }
    // Course objects are generated deterministically; each can trigger once.
    const current = Math.floor((this.distance - 70) / 72);
    for (let i = Math.max(0, current - 1); i <= current + 1; i++) {
      const item = courseItem(i);
      if (Math.abs(this.distance - item.distance) < 1.2 && !this.processed.has(`g${i}`)) {
        this.processed.add(`g${i}`);
        const ringY = waveHeight(item.x, -item.distance, this.elapsed) + 1.6;
        if (Math.abs(this.x - item.x) < 2.6 && Math.abs(this.y + 0.9 - ringY) < 2.8 && this.bailTime <= 0) {
          this.gates++; this.score += 250; this.onEvent({ type: 'gate' });
        }
      }
      if (Math.abs(this.distance - (item.distance + 30)) < 2 && !this.processed.has(`h${i}`)) {
        this.processed.add(`h${i}`);
        if (Math.abs(this.x - item.hazardX) < 2.6 && this.y < ground + 1.7 && this.bailTime <= 0) this.bail('REEF COLLISION');
      }
    }
    if (this.time <= 0) {
      if (this.airborne) this.clearCombo(); else this.bank();
      this.phase = 'finished'; this.onEvent({ type: 'finish' });
    }
  }
}
