// "Riptide Radio '99" — original mellow coastal instrumental.
// 64 bars / 108 BPM. Clean physical-model strings, warm bass and soft brushes.
// All sounds are generated locally. No recordings or borrowed melodies.
export const SURF_TRACK = "Riptide Radio '99";
export const MUSIC_BPM = 108;
const STEP = 60 / MUSIC_BPM / 4;
const TOTAL_STEPS = 64 * 16;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

const CHORDS = {
  G: { root: 43, notes: [55,59,62,66] },  // Gmaj7
  D: { root: 38, notes: [54,57,62,64] },  // Dadd9
  E: { root: 40, notes: [55,59,62,64] },  // Em7
  C: { root: 36, notes: [55,59,60,64] },  // Cmaj7
  B: { root: 35, notes: [54,57,59,62] },  // Bm7
  A: { root: 45, notes: [55,60,64,69] },  // Am7
  S: { root: 38, notes: [57,62,64,69] },  // Dsus2
  F: { root: 38, notes: [54,59,62,66] },  // D6
};
const VERSE_CHORDS = 'G D E C G B C S A F G E C A S D'.split(' ');
const BRIDGE_CHORDS = 'A E C F A B C S C G A E C A S D'.split(' ');
const CHORUS_CHORDS = 'G D C E G B C S A F G E C A S G'.split(' ');
const PROGRESSION = [...VERSE_CHORDS, ...VERSE_CHORDS, ...BRIDGE_CHORDS, ...CHORUS_CHORDS];

// Each original melody event is [sixteenth position, MIDI note, held length].
// Phrases have rests and long releases; the second verse answers the first.
const VERSE = [
  [[0,71,4],[6,69,2],[8,67,6]],
  [[2,66,3],[6,69,3],[10,64,5]],
  [[0,67,4],[6,71,2],[8,74,3],[12,71,3]],
  [[0,72,5],[7,71,2],[10,67,5]],
  [[0,67,3],[4,69,2],[8,71,5],[14,69,2]],
  [[2,66,4],[8,69,3],[12,71,3]],
  [[0,72,4],[6,71,2],[8,67,4],[14,64,2]],
  [[0,69,5],[8,66,3],[12,64,3]],
  [[0,69,4],[6,72,2],[8,76,5]],
  [[0,74,4],[6,71,2],[10,69,5]],
  [[2,71,4],[8,67,5],[14,66,2]],
  [[0,64,5],[8,67,3],[12,71,3]],
  [[0,72,5],[7,71,2],[10,67,4]],
  [[2,69,4],[8,64,3],[12,67,3]],
  [[0,69,4],[6,67,2],[8,66,4],[14,64,2]],
  [[0,66,5],[8,69,3],[12,67,3]],
];
const BRIDGE = [
  [[0,64,6],[8,67,3],[12,69,3]],
  [[2,71,5],[10,67,5]],
  [[0,64,4],[6,67,2],[8,72,6]],
  [[2,71,4],[8,69,3],[12,66,3]],
  [[0,69,6],[8,72,4]],
  [[2,71,4],[8,66,6]],
  [[0,67,4],[6,64,3],[12,72,3]],
  [[0,69,5],[8,64,5]],
  [[2,72,4],[8,71,2],[12,67,3]],
  [[0,71,5],[8,74,5]],
  [[0,72,4],[6,69,3],[12,64,3]],
  [[2,67,4],[8,71,5]],
  [[0,72,5],[8,76,5]],
  [[0,76,4],[6,72,3],[12,69,3]],
  [[0,74,4],[6,69,3],[10,64,4]],
  [[2,66,4],[8,69,4],[14,71,2]],
];
const CHORUS = [
  [[0,74,4],[6,71,2],[8,67,5]],
  [[0,69,3],[4,66,2],[8,64,5],[14,66,2]],
  [[0,67,4],[6,71,2],[8,72,5]],
  [[2,71,4],[8,67,3],[12,64,3]],
  [[0,71,4],[6,74,2],[8,79,5]],
  [[0,78,4],[6,74,2],[10,71,5]],
  [[0,76,4],[6,72,2],[8,71,3],[12,67,3]],
  [[0,69,6],[8,74,4]],
  [[0,76,4],[6,72,2],[8,69,5]],
  [[2,74,4],[8,71,3],[12,69,3]],
  [[0,71,4],[6,69,2],[8,67,5]],
  [[0,64,4],[6,67,2],[8,71,4],[14,74,2]],
  [[0,72,5],[8,71,2],[12,67,3]],
  [[2,69,4],[8,67,3],[12,64,3]],
  [[0,66,4],[6,69,2],[8,74,4],[14,71,2]],
  [[0,67,10]],
];

export class ArcadeAudio {
  constructor() {
    this.enabled = false; this.ctx = null; this.mode = 'surf';
    this.trackName = SURF_TRACK; this.beat = 0; this.nextBeat = 0;
    this.active = false; this.voices = new Set(); this._token = 0; this._enabling = false;
    this._strings = new Map(); this._persistent = []; this._persistentSources = [];
  }

  _build() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    const c = this.ctx = new Audio();
    this._strings.clear();
    this.master = c.createGain(); this.master.gain.value = 0;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -12; this.limiter.knee.value = 12;
    this.limiter.ratio.value = 5; this.limiter.attack.value = .005; this.limiter.release.value = .25;
    this.music = c.createGain(); this.music.gain.value = .82;
    this.effects = c.createGain(); this.effects.gain.value = .64;
    this.music.connect(this.limiter); this.effects.connect(this.limiter);
    this.limiter.connect(this.master); this.master.connect(c.destination);

    // A clean, gently rolled-off guitar bus: no distortion or hard-edged leads.
    this.guitarAmp = c.createBiquadFilter();
    this.guitarAmp.type = 'lowpass'; this.guitarAmp.frequency.value = 4300; this.guitarAmp.Q.value = .45;
    this.guitarAmp.connect(this.music);
    this.slap = c.createDelay(.5); this.slap.delayTime.value = .135;
    this.slapSend = c.createGain(); this.slapSend.gain.value = .19;
    this.slapFeedback = c.createGain(); this.slapFeedback.gain.value = .15;
    const echoTone = c.createBiquadFilter(); echoTone.type = 'lowpass'; echoTone.frequency.value = 2300;
    this.guitarAmp.connect(this.slapSend); this.slapSend.connect(this.slap);
    this.slap.connect(echoTone); echoTone.connect(this.music);
    echoTone.connect(this.slapFeedback); this.slapFeedback.connect(this.slap);

    // Slow, shallow chorus widens sustained notes without an obvious wobble.
    const chorus = c.createDelay(.1); chorus.delayTime.value = .019;
    const chorusSend = c.createGain(); chorusSend.gain.value = .13;
    const chorusPan = c.createStereoPanner(); chorusPan.pan.value = .55;
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .27;
    const depth = c.createGain(); depth.gain.value = .0013;
    lfo.connect(depth); depth.connect(chorus.delayTime);
    this.guitarAmp.connect(chorus); chorus.connect(chorusSend); chorusSend.connect(chorusPan); chorusPan.connect(this.music);
    lfo.start(); this._persistentSources = [lfo];

    let seed = 199909;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    this.noise = c.createBuffer(1, Math.ceil(c.sampleRate), c.sampleRate);
    const noiseData = this.noise.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = random();
    const room = c.createConvolver();
    const impulse = c.createBuffer(2, Math.ceil(c.sampleRate * 2.1), c.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel); let smooth = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / c.sampleRate;
        smooth += (random() - smooth) * .19;
        data[i] = smooth * Math.exp(-t * 3.1) * Math.min(1, t / .025);
      }
    }
    room.buffer = impulse;
    const roomSend = c.createGain(); roomSend.gain.value = .28;
    const roomTone = c.createBiquadFilter(); roomTone.type = 'lowpass'; roomTone.frequency.value = 2600;
    this.guitarAmp.connect(roomSend); roomSend.connect(room); room.connect(roomTone); roomTone.connect(this.music);
    this._persistent = [this.music, this.effects, this.limiter, this.master, this.guitarAmp, this.slap,
      this.slapSend, this.slapFeedback, echoTone, chorus, chorusSend, chorusPan, lfo, depth, roomSend, room, roomTone];

    // Cache physical-model string samples once. Playback uses only buffer voices,
    // rather than recalculating a pluck every frame or downloading sample files.
    const notes = new Set(Object.values(CHORDS).flatMap(chord => chord.notes));
    for (const phrase of [...VERSE, ...BRIDGE, ...CHORUS]) for (const note of phrase) notes.add(note[1]);
    for (const midi of notes) this._string(midi);
  }

  _string(midi) {
    if (this._strings.has(midi)) return this._strings.get(midi);
    const c = this.ctx, hz = frequency(midi), period = Math.max(8, Math.round(c.sampleRate / hz + .5));
    const line = new Float32Array(period);
    let seed = midi * 7919 + 108, mean = 0;
    for (let i = 0; i < period; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      // A soft pick excites a rounded fundamental and a little string noise.
      const phase = i / period * Math.PI * 2;
      line[i] = Math.sin(phase) * .68 + Math.sin(phase * 2) * .16 + Math.sin(phase * 3) * .09
        + (seed / 4294967296 * 2 - 1) * .19;
      mean += line[i] / period;
    }
    for (let i = 0; i < period; i++) line[i] -= mean;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 3), c.sampleRate);
    const data = buffer.getChannelData(0); let cursor = 0, peak = 0;
    for (let i = 0; i < data.length; i++) {
      const next = (cursor + 1) % period, value = line[cursor];
      // Karplus–Strong feedback: upper harmonics fade before the fundamental.
      line[cursor] = (value + line[next]) * .49935;
      data[i] = value * Math.min(1, i / (c.sampleRate * .003))
        * Math.min(1, (data.length - i) / (c.sampleRate * .15));
      peak = Math.max(peak, Math.abs(data[i])); cursor = next;
    }
    for (let i = 0; i < data.length; i++) data[i] *= .86 / Math.max(.86, peak);
    // Averaging with the next ring cell makes the effective delay period - 0.5.
    // Correct that fractional sample so high strings stay in tune with the bass.
    const result = { buffer, rate: hz / (c.sampleRate / (period - .5)) };
    this._strings.set(midi, result); return result;
  }

  async enable() {
    const token = ++this._token; this._enabling = true;
    try {
      if (!this.ctx || this.ctx.state === 'closed') this._build();
      await this.ctx.resume();
      if (token !== this._token) return false;
      this.enabled = true; this._enabling = false; this.active = false;
      this.nextBeat = this.ctx.currentTime + .04; return true;
    } catch {
      if (token === this._token) { this.enabled = false; this._enabling = false; }
      return false;
    }
  }

  toggle() {
    if (!this.enabled && !this._enabling) return this.enable();
    this._token++; this.enabled = false; this._enabling = false; this.active = false;
    this._fade(false); this._stopVoices(); return Promise.resolve(false);
  }

  _fade(on) {
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(on ? .76 : 0, this.ctx.currentTime, on ? .05 : .007);
  }

  _stopVoices() {
    if (!this.ctx) return;
    for (const source of this.voices) {
      try { source.stop(this.ctx.currentTime + .03); } catch { /* already ended */ }
    }
  }

  _track(source, nodes) {
    this.voices.add(source);
    source.onended = () => {
      source.disconnect(); for (const node of nodes) node.disconnect(); this.voices.delete(source);
    };
  }

  _note(freq, at, duration, type, volume, output, endFreq) {
    const c = this.ctx, oscillator = c.createOscillator(), envelope = c.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, at);
    if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(endFreq, at + duration);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + .012);
    envelope.gain.exponentialRampToValueAtTime(volume * .48, at + duration * .5);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(output);
    this._track(oscillator, [envelope]); oscillator.start(at); oscillator.stop(at + duration + .035);
  }

  _guitar(midi, at, duration, volume, rhythm = false, pan = rhythm ? -.32 : .12) {
    const c = this.ctx, source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    const stereo = c.createStereoPanner(), string = this._string(midi);
    source.buffer = string.buffer; source.playbackRate.value = string.rate;
    filter.type = 'lowpass'; filter.Q.value = .45;
    filter.frequency.setValueAtTime(rhythm ? 2200 : 4200, at);
    filter.frequency.exponentialRampToValueAtTime(rhythm ? 1300 : 2400, at + duration);
    const length = Math.min(2.5, Math.max(.18, duration));
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + .012);
    gain.gain.exponentialRampToValueAtTime(volume * .72, at + length * .65);
    gain.gain.exponentialRampToValueAtTime(.0001, at + length + .16);
    stereo.pan.value = pan;
    source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(this.guitarAmp);
    this._track(source, [filter, gain, stereo]); source.start(at); source.stop(at + length + .18);
  }

  _noiseHit(at, duration, volume, freq, kind = 'bandpass', pan = 0) {
    const c = this.ctx, source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain(), stereo = c.createStereoPanner();
    source.buffer = this.noise; filter.type = kind; filter.frequency.value = freq; filter.Q.value = .55;
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    stereo.pan.value = pan;
    source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(this.music);
    this._track(source, [filter, gain, stereo]);
    source.start(at, (this.beat * .029) % .4); source.stop(at + duration + .025);
  }

  _kick(at, weight = 1) { this._note(84, at, .22, 'sine', .09 * weight, this.music, 48); }
  _snare(at, weight = 1) {
    this._noiseHit(at, .18, .028 * weight, 1550, 'bandpass', -.08);
    this._note(175, at, .08, 'sine', .013 * weight, this.music, 145);
  }

  setMode(mode = 'surf') {
    this.mode = mode;
    if (this.ctx && this.slapSend) this.slapSend.gain.setTargetAtTime(
      mode === 'park' || mode === 'wavepark' ? .21 : .19, this.ctx.currentTime, .3);
  }

  _scheduleStep(step, at) {
    const bar = Math.floor(step / 16) % 64, s = step % 16;
    const chord = CHORDS[PROGRESSION[bar]], park = this.mode === 'park' || this.mode === 'wavepark';
    const bridge = bar >= 32 && bar < 48, secondVerse = bar >= 16 && bar < 32;
    const finalBar = bar % 16 === 15;
    // The backbeat sits slightly late. Quiet shaker alternates weight and side.
    if (s === 0 || (s === 8 && !bridge)) this._kick(at, s === 0 ? .9 : .68);
    if (s === 4 || s === 12) this._snare(at + .012, bridge ? .68 : .85);
    if (s % 2 === 0 && !(finalBar && s > 11)) {
      this._noiseHit(at + (s % 4 ? .016 : 0), .075, s % 4 ? .009 : .013, 4700, 'bandpass', s % 4 ? .35 : -.22);
    }
    if (finalBar && s === 14) this._snare(at + .018, .38);
    if (park && s === 10 && !bridge) this._noiseHit(at, .06, .008, 2800, 'bandpass', .35);

    // Open seventh/add-nine voicings gently strummed, then a quiet offbeat answer.
    if (s === 0 || s === 10) {
      const notes = s === 0 ? chord.notes : [...chord.notes].reverse();
      notes.forEach((midi, index) => this._guitar(midi, at + index * .021,
        s === 0 ? .94 : .62, (s === 0 ? .029 : .017) * (bridge ? .85 : 1), true));
    }
    if (secondVerse && s === 6) this._guitar(chord.notes[2], at, .42, .021, true, .3);
    if (s === 0 || s === 6 || s === 8 || (!finalBar && s === 14)) {
      let midi = chord.root;
      if (s === 6) midi += 7;
      if (s === 14) {
        const next = CHORDS[PROGRESSION[(bar + 1) % 64]].root;
        midi = next > chord.root ? next - 2 : next + 2;
      }
      this._note(frequency(midi), at, s === 0 || s === 8 ? .59 : .30,
        'triangle', s === 0 || s === 8 ? .088 : .052, this.music);
    }

    const phrase = bridge ? BRIDGE[bar - 32] : bar >= 48 ? CHORUS[bar - 48] : VERSE[bar % 16];
    for (const [position, midi, length] of phrase) {
      if (position !== s) continue;
      // Slightly laid-back attacks and varied dynamics keep the line unhurried.
      const volume = (bridge ? .139 : bar >= 48 ? .172 : .16) * (position % 4 === 0 ? 1 : .88);
      this._guitar(midi, at + (position % 4 ? .019 : .005), length * STEP * .94 + .08, volume);
      if (secondVerse && position === phrase[phrase.length - 1][0] && length >= 4) {
        this._guitar(chord.notes[3], at + STEP * 2, .45, .030, true, -.2);
      }
    }
  }

  tone(freq, duration, type = 'sine', volume = .035, endFreq) {
    if (!this.enabled || !this.ctx || !this.active) return;
    this._note(freq, this.ctx.currentTime, duration, type === 'square' || type === 'sawtooth' ? 'sine' : type,
      Math.min(.07, volume), this.effects, endFreq);
  }

  event(type) {
    if (type === 'jump') this.tone(294, .19, 'sine', .035, 440);
    if (type === 'trick') this.tone(659, .16, 'sine', .030, 784);
    if (type === 'land') this.tone(96, .13, 'sine', .05, 58);
    if (type === 'bank' || type === 'gate') { this.tone(523.25, .30, 'sine', .040); this.tone(783.99, .36, 'sine', .027); }
    if (type === 'bail') this.tone(196, .30, 'triangle', .030, 98);
    if (type === 'finish') { this.tone(392, .7, 'sine', .040); this.tone(493.88, .6, 'sine', .025); }
  }

  update(active, mode = this.mode) {
    if (mode !== this.mode) this.setMode(mode);
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (Boolean(active) !== this.active) {
      this.active = Boolean(active); this._fade(this.active); this.nextBeat = now + .04;
      if (!this.active) this._stopVoices();
    }
    if (!this.active) return;
    if (this.nextBeat < now - .2) this.nextBeat = now + .04;
    while (this.nextBeat < now + .18) {
      this._scheduleStep(this.beat % TOTAL_STEPS, this.nextBeat);
      this.beat = (this.beat + 1) % TOTAL_STEPS; this.nextBeat += STEP;
    }
  }

  async dispose() {
    this._token++; this.enabled = false; this._enabling = false; this.active = false;
    this._stopVoices();
    for (const source of this._persistentSources) { try { source.stop(); } catch { /* already stopped */ } }
    for (const node of this._persistent) node.disconnect();
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close();
    this.ctx = null; this.voices.clear(); this._strings.clear(); this._persistent = []; this._persistentSources = [];
  }
}
