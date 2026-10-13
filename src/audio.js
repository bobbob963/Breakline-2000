// Original procedural instrumentals for rides, sunset, Survival, menus and races.
// Riptide Radio: 64 bars / 108 BPM. Afterhours: 32 bars / 138 BPM.
// Overdrive: 32 bars / 152 BPM, with an extra boost layer and final-lap percussion.
// All sounds are generated locally. No recordings or borrowed melodies.
export const SURF_TRACK = "Riptide Radio '99";
export const MENU_TRACK = 'Afterhours / Yard Circuit';
export const RACE_TRACK = 'Overdrive / Sun Circuit';
export const SUNSET_TRACK = 'Golden Hour / Last Light';
export const SURVIVAL_TRACK = 'Undertow / Storm Run';
export const MUSIC_BPM = 108;
export const MENU_BPM = 138;
export const RACE_BPM = 152;
export const SUNSET_BPM = 84;
export const SURVIVAL_BPM = 164;
export const RADIO_TRACKS = Object.freeze([
  {id:'surf',title:SURF_TRACK,bpm:MUSIC_BPM},
  {id:'menu',title:MENU_TRACK,bpm:MENU_BPM},
  {id:'race',title:RACE_TRACK,bpm:RACE_BPM},
  {id:'sunset',title:SUNSET_TRACK,bpm:SUNSET_BPM},
  {id:'survival',title:SURVIVAL_TRACK,bpm:SURVIVAL_BPM},
].map(Object.freeze));
const radioTrack = id => RADIO_TRACKS.find(track => track.id === id);
const musicScene = track => track === 'menu' || track === 'race' ? track : 'ride';
const STEP = 60 / MUSIC_BPM / 4;
const TOTAL_STEPS = 64 * 16;
const MENU_STEP = 60 / MENU_BPM / 4;
const MENU_STEPS = 32 * 16;
const RACE_STEP = 60 / RACE_BPM / 4;
const RACE_STEPS = 32 * 16;
const SUNSET_STEP = 60 / SUNSET_BPM / 4;
const SURVIVAL_STEP = 60 / SURVIVAL_BPM / 4;
const WEATHER_STEPS = 32 * 16;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

export function resolveRideTrack({mode = 'surf', rulesId = 'surf', weatherId, isRace = false, isTimeTrial = false} = {}) {
  if (mode !== 'surf' || isRace || isTimeTrial) return 'surf';
  if (rulesId === 'storm') return 'survival';
  return rulesId === 'surf' && weatherId === 'sunset' ? 'sunset' : 'surf';
}

// Soft ninth/seventh voicings and a spacious melody, written for this score.
const SUNSET_CHORDS = [
  {root:41,notes:[57,60,64,67]}, {root:45,notes:[55,59,60,64]},
  {root:38,notes:[53,57,60,64]}, {root:43,notes:[55,59,62,64]},
  {root:41,notes:[57,60,64,67]}, {root:48,notes:[55,59,62,64]},
  {root:38,notes:[53,57,60,65]}, {root:43,notes:[55,60,62,67]},
];
const SUNSET_MELODY = [
  [[2,72,5],[10,69,5]], [[0,67,6],[9,64,5]],
  [[3,65,4],[10,69,5]], [[1,67,7],[12,62,3]],
  [[0,69,5],[8,72,6]], [[2,71,4],[10,67,5]],
  [[1,65,5],[9,64,3],[14,62,2]], [[0,67,10]],
];
const SURVIVAL_ROOTS = [45,45,41,43,45,48,41,43,45,45,41,43,38,41,43,40,
  41,43,45,45,41,38,43,40,45,48,41,43,38,41,43,45];
const SURVIVAL_HOOK = [
  [[0,76,2],[3,72,2],[8,69,3],[13,72,2]],
  [[1,76,3],[6,79,2],[10,76,2],[14,72,2]],
  [[0,77,3],[5,76,2],[10,72,3]],
  [[2,74,2],[6,71,2],[10,67,2],[14,71,2]],
  [[0,74,3],[6,69,2],[10,65,3]],
  [[1,72,3],[6,69,2],[12,65,3]],
  [[0,74,2],[4,79,2],[8,74,3],[13,71,2]],
  [[0,76,5],[8,72,3],[13,69,2]],
];

// An original E-minor riff cycle: four-bar entrance, full rhythm section,
// a half-time middle eight, then the final hook. Chug lengths leave actual space.
const MENU_ROOTS = [40,40,43,38,40,40,36,38,40,43,45,38,36,38,40,40,
  45,36,40,38,45,36,38,47,40,40,43,38,36,38,40,40];
const MENU_RIFFS = [
  [[0,0,2],[3,0,1],[6,0,2],[8,0,2],[11,7,1],[14,0,2]],
  [[0,0,2],[2,0,1],[5,0,2],[8,0,2],[10,3,2],[14,0,2]],
  [[0,0,3],[4,0,1],[6,0,1],[9,0,2],[12,7,2],[15,0,1]],
  [[0,0,2],[3,0,2],[7,0,1],[8,0,3],[12,0,1],[14,2,1]],
];
const MENU_HOOK = [
  [[0,24,3],[5,31,2],[8,29,2],[12,27,3]],
  [[2,24,3],[7,27,2],[10,22,4]],
  [[0,24,4],[6,26,2],[10,31,4]],
  [[2,24,3],[8,29,3],[13,24,2]],
  [[0,28,4],[6,31,2],[10,24,4]],
  [[0,29,3],[5,26,2],[9,24,4]],
  [[2,31,4],[8,27,2],[12,24,3]],
  [[0,24,6],[10,22,2],[14,24,2]],
];

// Original D-minor power-chord/bass patterns. Short picked attacks leave space
// around the snare, while the syncopated lead answers across the bar line.
const RACE_ROOTS = [38,38,41,36,38,38,34,36,38,41,34,36,38,41,34,36,
  34,34,38,36,34,36,38,45,38,41,34,36,38,41,34,36];
const RACE_RIFFS = [
  [[0,0,2],[3,0,1],[6,7,2],[8,0,2],[11,0,1],[14,3,2]],
  [[0,0,2],[2,0,1],[5,0,2],[8,0,3],[12,7,1],[14,0,2]],
  [[0,0,3],[4,0,1],[6,0,2],[9,7,2],[12,0,1],[15,0,1]],
  [[0,0,2],[3,0,2],[7,0,1],[8,0,2],[11,2,2],[14,0,2]],
];
const RACE_HOOK = [
  [[0,74,2],[3,72,1],[6,69,2],[10,65,2],[14,69,2]],
  [[1,72,2],[5,69,2],[8,65,3],[13,69,2]],
  [[0,70,3],[4,69,2],[8,65,2],[12,62,3]],
  [[2,67,2],[6,72,2],[10,69,2],[14,72,2]],
  [[0,74,3],[5,77,2],[8,76,2],[12,74,3]],
  [[0,72,2],[4,69,2],[7,65,2],[11,69,2],[14,72,2]],
  [[1,70,3],[6,74,2],[10,77,3]],
  [[0,76,3],[6,72,2],[10,69,2],[14,72,2]],
];
const unit = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function saturationCurve(drive = 3.4) {
  const curve = new Float32Array(2048), scale = Math.tanh(drive);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / (curve.length - 1) * 2 - 1) * drive) / scale;
  return curve;
}

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
    this.enabled = false; this.ctx = null; this.mode = 'surf'; this.scene = 'ride';
    this.beat = 0; this.nextBeat = 0; this._selection = 'auto';
    this.active = false; this.voices = new Set(); this._token = 0; this._enabling = false;
    this._strings = new Map(); this._persistent = []; this._persistentSources = [];
    this._trackBeats = {surf:0,menu:0,race:0,sunset:0,survival:0}; this._voiceScenes = new WeakMap();
    this.raceProgress = 0; this.raceBoost = 0;
    this.rideTrack = 'surf'; this.survivalIntensity = 0;
    this._wasted = false; this._wastedRevealed = false;
    this._wastedVoices = new Map(); this._wastedBus = null;
  }

  get selection() { return this._selection; }
  get currentTrackId() { return this._selection === 'auto' ? this.scene === 'ride' ? this.rideTrack : this.scene : this._selection; }
  get trackName() { return radioTrack(this.currentTrackId).title; }
  get _musicScene() { return musicScene(this.currentTrackId); }

  selectTrack(id = 'auto') {
    if (id !== 'auto' && !radioTrack(id)) return false;
    const previous = this.currentTrackId;
    this._selection = id;
    this._changeTrack(previous);
    return true;
  }

  shuffleTrack(random = Math.random) {
    const choices = RADIO_TRACKS.filter(track => track.id !== this.currentTrackId);
    const value = random(), fraction = Number.isFinite(value) ? Math.max(0,Math.min(.999999999,value)) : 0;
    const chosen = choices[Math.floor(fraction * choices.length)].id;
    this.selectTrack(chosen);
    return chosen;
  }

  _changeTrack(previous) {
    const next = this.currentTrackId;
    if (previous === next) return;
    this._trackBeats[previous] = this.beat;
    // Every song retains its own phrase, even when chosen outside its home mode.
    this.beat = Math.floor(this._trackBeats[next] / 16) * 16;
    if (!this.ctx) return; // Station selection never grants audio permission.
    const now = this.ctx.currentTime, nextScene = musicScene(next);
    for (const [bus,target] of [[this.music,nextScene==='ride'?.82:0],[this.menuMusic,nextScene==='menu'?.88:0],[this.raceMusic,nextScene==='race'?.84:0]]) {
      bus.gain.cancelScheduledValues(now);
      bus.gain.setTargetAtTime(0,now,.012);
      if (target && !this._wasted) bus.gain.setTargetAtTime(target,now+.065,.055);
    }
    // The old arrangement stops before the new one begins. Effects keep playing.
    this._stopVoices(musicScene(previous),.06);
    this.nextBeat = now + .085;
  }

  _build(context = null) {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!context && !Audio) throw new Error('Web Audio unavailable');
    const c = this.ctx = context || new Audio();
    this._strings.clear();
    this.master = c.createGain(); this.master.gain.value = 0;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -12; this.limiter.knee.value = 12;
    this.limiter.ratio.value = 5; this.limiter.attack.value = .005; this.limiter.release.value = .25;
    this.music = c.createGain(); this.music.gain.value = !this._wasted && this._musicScene === 'ride' ? .82 : 0;
    this.menuMusic = c.createGain(); this.menuMusic.gain.value = !this._wasted && this._musicScene === 'menu' ? .88 : 0;
    this.raceMusic = c.createGain(); this.raceMusic.gain.value = !this._wasted && this._musicScene === 'race' ? .84 : 0;
    this.effects = c.createGain(); this.effects.gain.value = .64;
    this.music.connect(this.limiter); this.menuMusic.connect(this.limiter); this.raceMusic.connect(this.limiter); this.effects.connect(this.limiter);
    // A normally transparent final safety ceiling also catches the compressor's
    // attack transient. The master leaves further headroom below digital full scale.
    const ceiling = c.createWaveShaper(), ceilingCurve = new Float32Array(2048);
    for (let i = 0; i < ceilingCurve.length; i++) {
      const x = i / (ceilingCurve.length - 1) * 2 - 1, magnitude = Math.abs(x);
      ceilingCurve[i] = Math.sign(x) * (magnitude <= .72 ? magnitude : .72 + .24 * Math.tanh((magnitude - .72) / .24));
    }
    ceiling.curve = ceilingCurve; ceiling.oversample = '2x';
    this.limiter.connect(ceiling); ceiling.connect(this.master); this.master.connect(c.destination);

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
    this._persistent = [this.music, this.menuMusic, this.raceMusic, this.effects, this.limiter, ceiling, this.master, this.guitarAmp, this.slap,
      this.slapSend, this.slapFeedback, echoTone, chorus, chorusSend, chorusPan, lfo, depth, roomSend, room, roomTone];
    this._buildMenu(random);
    this._buildRace();
    this._buildWeatherMusic();

    // Cache physical-model string samples once. Playback uses only buffer voices,
    // rather than recalculating a pluck every frame or downloading sample files.
    const notes = new Set(Object.values(CHORDS).flatMap(chord => chord.notes));
    for (const chord of SUNSET_CHORDS) for (const midi of chord.notes) notes.add(midi);
    for (const phrase of SUNSET_MELODY) for (const [,midi] of phrase) notes.add(midi);
    for (const root of SURVIVAL_ROOTS) for (const offset of [0,7,12]) notes.add(root+offset);
    for (const phrase of [...VERSE, ...BRIDGE, ...CHORUS]) for (const note of phrase) notes.add(note[1]);
    MENU_ROOTS.forEach((root, bar) => {
      for (const [, offset] of MENU_RIFFS[bar % 4]) for (const interval of [0,7,12]) notes.add(root + offset + interval);
      if (bar >= 20 && bar < 24) for (const offset of [24,27,31]) notes.add(root + offset);
      if (bar >= 24) for (const [, offset] of MENU_HOOK[bar - 24]) notes.add(root + offset);
    });
    RACE_ROOTS.forEach((root, bar) => {
      for (const [, offset] of RACE_RIFFS[bar % 4]) for (const interval of [0,7,12]) notes.add(root + offset + interval);
    });
    for (const midi of notes) this._string(midi);
  }

  _buildMenu(random) {
    const c = this.ctx;
    const room = c.createConvolver(), impulse = c.createBuffer(2, Math.ceil(c.sampleRate * .43), c.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel); let smooth = 0;
      for (let i = 0; i < data.length; i++) {
        smooth += (random() - smooth) * .31;
        data[i] = smooth * Math.exp(-i / c.sampleRate * 13) * Math.min(1, i / (c.sampleRate * .008));
      }
    }
    room.buffer = impulse;
    const roomSend = c.createGain(); roomSend.gain.value = .10;
    const roomTone = c.createBiquadFilter(); roomTone.type = 'lowpass'; roomTone.frequency.value = 2400;
    roomSend.connect(room); room.connect(roomTone); roomTone.connect(this.menuMusic);
    this._persistent.push(room, roomSend, roomTone);
    const amp = (pan, volume, drive, cutoff) => {
      const input = c.createGain(), high = c.createBiquadFilter(), distort = c.createWaveShaper();
      const cabinet = c.createBiquadFilter(), gain = c.createGain(), stereo = c.createStereoPanner();
      high.type = 'highpass'; high.frequency.value = 115; high.Q.value = .6;
      distort.curve = saturationCurve(drive); distort.oversample = '2x';
      cabinet.type = 'lowpass'; cabinet.frequency.value = cutoff; cabinet.Q.value = .55;
      gain.gain.value = volume; stereo.pan.value = pan;
      input.connect(high); high.connect(distort); distort.connect(cabinet); cabinet.connect(gain);
      gain.connect(stereo); stereo.connect(this.menuMusic); stereo.connect(roomSend);
      this._persistent.push(input,high,distort,cabinet,gain,stereo); return input;
    };
    // Separate left/right guitar takes feed finite-gain amp/cabinet chains. The
    // actual picked strings drive the distortion; there is no sustained saw wall.
    this.menuGuitars = [amp(-.66,.078,3.5,3450), amp(.66,.078,3.3,3200)];
    this.menuLead = amp(-.05,.061,2.1,3100);
    this.menuBass = c.createBiquadFilter(); this.menuBass.type = 'lowpass'; this.menuBass.frequency.value = 850;
    const bassDrive = c.createWaveShaper(), bassLevel = c.createGain();
    bassDrive.curve = saturationCurve(1.8); bassDrive.oversample = '2x'; bassLevel.gain.value = .105;
    this.menuBass.connect(bassDrive); bassDrive.connect(bassLevel); bassLevel.connect(this.menuMusic);
    this.menuDrums = c.createBiquadFilter(); this.menuDrums.type = 'highshelf'; this.menuDrums.frequency.value = 5400; this.menuDrums.gain.value = -4;
    const drumGlue = c.createDynamicsCompressor(); drumGlue.threshold.value = -18; drumGlue.knee.value = 9;
    drumGlue.ratio.value = 2.8; drumGlue.attack.value = .008; drumGlue.release.value = .11;
    this.menuDrums.connect(drumGlue); drumGlue.connect(this.menuMusic);
    this._persistent.push(this.menuBass,bassDrive,bassLevel,this.menuDrums,drumGlue);
  }

  _buildRace() {
    const c = this.ctx;
    // The race has its own instruments and bus. Opening this filter adds motion
    // as the finish approaches without simply turning the entire track up.
    this.raceTone = c.createBiquadFilter(); this.raceTone.type = 'lowpass';
    this.raceTone.frequency.value = 4300; this.raceTone.Q.value = .4;
    this.raceTone.connect(this.raceMusic);
    const amp = (pan, drive) => {
      const input = c.createGain(), high = c.createBiquadFilter(), shape = c.createWaveShaper();
      const cabinet = c.createBiquadFilter(), level = c.createGain(), stereo = c.createStereoPanner();
      high.type = 'highpass'; high.frequency.value = 130; high.Q.value = .5;
      shape.curve = saturationCurve(drive); shape.oversample = '2x';
      cabinet.type = 'lowpass'; cabinet.frequency.value = 3650; cabinet.Q.value = .55;
      level.gain.value = .066; stereo.pan.value = pan;
      input.connect(high); high.connect(shape); shape.connect(cabinet); cabinet.connect(level);
      level.connect(stereo); stereo.connect(this.raceTone);
      this._persistent.push(input, high, shape, cabinet, level, stereo); return input;
    };
    this.raceGuitars = [amp(-.7,4.1),amp(.7,3.8)];
    this.raceBass = c.createBiquadFilter(); this.raceBass.type = 'lowpass'; this.raceBass.frequency.value = 1150;
    const bassShape = c.createWaveShaper(), bassLevel = c.createGain();
    bassShape.curve = saturationCurve(2.2); bassShape.oversample = '2x'; bassLevel.gain.value = .083;
    this.raceBass.connect(bassShape); bassShape.connect(bassLevel); bassLevel.connect(this.raceMusic);
    this.raceDrums = c.createBiquadFilter(); this.raceDrums.type = 'highshelf';
    this.raceDrums.frequency.value = 6400; this.raceDrums.gain.value = -5;
    const glue = c.createDynamicsCompressor(); glue.threshold.value = -19; glue.knee.value = 10;
    glue.ratio.value = 3; glue.attack.value = .006; glue.release.value = .085;
    this.raceDrums.connect(glue); glue.connect(this.raceMusic);
    this.raceLead = c.createBiquadFilter(); this.raceLead.type = 'lowpass'; this.raceLead.frequency.value = 2900;
    const leadLevel = c.createGain(), leadPan = c.createStereoPanner();
    leadLevel.gain.value = .42; leadPan.pan.value = -.12;
    this.raceLead.connect(leadLevel); leadLevel.connect(leadPan); leadPan.connect(this.raceTone);
    // Tempo-locked dotted-eighth answer, with a dark single repeat.
    const delay = c.createDelay(.5), delayLevel = c.createGain(), delayPan = c.createStereoPanner();
    delay.delayTime.value = RACE_STEP * 3; delayLevel.gain.value = .21; delayPan.pan.value = .55;
    leadLevel.connect(delay); delay.connect(delayLevel); delayLevel.connect(delayPan); delayPan.connect(this.raceTone);
    this._persistent.push(this.raceTone,this.raceBass,bassShape,bassLevel,this.raceDrums,glue,
      this.raceLead,leadLevel,leadPan,delay,delayLevel,delayPan);
  }

  _buildWeatherMusic() {
    const c = this.ctx;
    this.sunsetKeys = c.createBiquadFilter(); this.sunsetKeys.type = 'lowpass';
    this.sunsetKeys.frequency.value = 1250; this.sunsetKeys.Q.value = .35;
    this.sunsetKeys.connect(this.music);
    this.survivalGuitars = [-.54,.54].map((pan,index) => {
      const input=c.createGain(),high=c.createBiquadFilter(),drive=c.createWaveShaper();
      const cabinet=c.createBiquadFilter(),level=c.createGain(),stereo=c.createStereoPanner();
      high.type='highpass';high.frequency.value=155;high.Q.value=.45;
      drive.curve=saturationCurve(2.5+index*.15);drive.oversample='2x';
      cabinet.type='lowpass';cabinet.frequency.value=3050;cabinet.Q.value=.5;
      level.gain.value=.057;stereo.pan.value=pan;
      input.connect(high);high.connect(drive);drive.connect(cabinet);cabinet.connect(level);
      level.connect(stereo);stereo.connect(this.music);
      this._persistent.push(input,high,drive,cabinet,level,stereo);return input;
    });
    this.survivalLead=c.createBiquadFilter();this.survivalLead.type='lowpass';
    this.survivalLead.frequency.value=2350;this.survivalLead.Q.value=.45;
    const leadLevel=c.createGain();leadLevel.gain.value=.46;
    this.survivalLead.connect(leadLevel);leadLevel.connect(this.music);
    this.survivalDrums=c.createBiquadFilter();this.survivalDrums.type='highshelf';
    this.survivalDrums.frequency.value=5200;this.survivalDrums.gain.value=-6;
    this.survivalDrums.connect(this.music);
    this._persistent.push(this.sunsetKeys,this.survivalLead,leadLevel,this.survivalDrums);
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
    this._clearWastedVoices();
    this._fade(false); this._stopVoices(); return Promise.resolve(false);
  }

  _fade(on) {
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(on ? .76 : 0, this.ctx.currentTime, on ? .05 : .007);
  }

  _stopVoices(scene = null, delay = .03) {
    if (!this.ctx) return;
    for (const source of this.voices) {
      if (scene && this._voiceScenes.get(source) !== scene) continue;
      try { source.stop(this.ctx.currentTime + delay); } catch { /* already ended */ }
    }
  }

  _track(source, nodes, scene = this._musicScene) {
    this.voices.add(source);
    this._voiceScenes.set(source,scene);
    source.onended = () => {
      source.disconnect(); for (const node of nodes) node.disconnect(); this.voices.delete(source);
      this._wastedVoices.delete(source);
    };
  }

  _note(freq, at, duration, type, volume, output, endFreq, scene = this._musicScene) {
    const c = this.ctx, oscillator = c.createOscillator(), envelope = c.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, at);
    if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(endFreq, at + duration);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + .012);
    envelope.gain.exponentialRampToValueAtTime(volume * .48, at + duration * .5);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(output);
    this._track(oscillator, [envelope], scene); oscillator.start(at); oscillator.stop(at + duration + .035);
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

  _noiseHit(at, duration, volume, freq, kind = 'bandpass', pan = 0, output = this.music, attack = .012) {
    const c = this.ctx, source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain(), stereo = c.createStereoPanner();
    source.buffer = this.noise; filter.type = kind; filter.frequency.value = freq; filter.Q.value = .55;
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    stereo.pan.value = pan;
    source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(output);
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

  setScene(scene = 'ride') {
    const next = scene === 'menu' || scene === 'race' ? scene : 'ride';
    if (next === this.scene) return;
    const previous = this.currentTrackId;
    this.scene = next;
    this.setRaceState({progress:0,boost:0});
    this._changeTrack(previous);
  }

  setRideContext(context = {}) {
    const next=resolveRideTrack({mode:context.mode??this.mode,rulesId:context.rulesId,weatherId:context.weatherId,
      isRace:context.isRace,isTimeTrial:context.isTimeTrial});
    this.survivalIntensity=unit((Number.isFinite(context.elapsed)?context.elapsed:0)/240);
    if(next===this.rideTrack)return;
    const previous=this.currentTrackId;
    this.rideTrack=next;
    this._changeTrack(previous);
  }

  setRaceState({progress = 0, boost = 0} = {}) {
    const previous = this.raceProgress * 2300 + this.raceBoost * 900;
    this.raceProgress = unit(progress); this.raceBoost = unit(boost);
    const openness = this.raceProgress * 2300 + this.raceBoost * 900;
    if (this.ctx && this.raceTone && Math.abs(openness - previous) > .5) {
      const now = this.ctx.currentTime;
      // Replace the previous target so per-frame updates cannot accumulate a
      // race-long automation history. This never changes the master volume.
      this.raceTone.frequency.cancelScheduledValues(now);
      this.raceTone.frequency.setTargetAtTime(4300 + openness, now, .15);
    }
  }

  _menuPluck(midi, at, duration, volume, output, detune = 0) {
    const c = this.ctx, source = c.createBufferSource(), gain = c.createGain(), pick = c.createBiquadFilter();
    const string = this._string(midi); source.buffer = string.buffer;
    source.playbackRate.value = string.rate * 2 ** (detune / 1200);
    const length = Math.max(.07,duration);
    pick.type = 'lowpass'; pick.Q.value = .5;
    pick.frequency.setValueAtTime(length < .3 ? 2600 : 4100,at);
    pick.frequency.exponentialRampToValueAtTime(length < .3 ? 650 : 1850,at + length);
    gain.gain.setValueAtTime(.0001,at); gain.gain.exponentialRampToValueAtTime(volume,at+.004);
    gain.gain.exponentialRampToValueAtTime(volume*.58,at+length*.64);
    gain.gain.exponentialRampToValueAtTime(.0001,at+length+.035);
    source.connect(pick); pick.connect(gain); gain.connect(output);
    this._track(source,[pick,gain]); source.start(at); source.stop(at+length+.045);
  }

  _menuChord(root, at, duration, weight = 1) {
    for (let take = 0; take < 2; take++) for (const [index,interval] of [0,7,12].entries()) {
      this._menuPluck(root+interval,at+take*.009+index*.003,duration,
        [.43,.28,.22][index]*weight,this.menuGuitars[take],take===0?-5:4);
    }
  }

  _menuKick(at, weight = 1) {
    this._note(128,at,.23,'sine',.19*weight,this.menuDrums,44);
    this._noiseHit(at,.027,.024*weight,2200,'lowpass',0,this.menuDrums,.002);
  }

  _menuSnare(at, weight = 1) {
    this._noiseHit(at,.17,.098*weight,1800,'bandpass',-.08,this.menuDrums,.002);
    this._noiseHit(at,.075,.027*weight,4300,'highpass',.08,this.menuDrums,.002);
    this._note(195,at,.11,'triangle',.047*weight,this.menuDrums,146);
  }

  _scheduleMenuStep(step, at) {
    const bar = Math.floor(step/16)%32, s = step%16, root = MENU_ROOTS[bar];
    const intro = bar < 4, breakdown = bar >= 16 && bar < 20, build = bar >= 20 && bar < 24;
    const fill = bar%8===7, finish = bar===31;
    const kickSteps = breakdown ? [0,10] : bar%2 ? [0,6,10] : [0,7,10];
    if(kickSteps.includes(s)) this._menuKick(at,s===0?1:.76);
    if(s===(breakdown?8:4)||(!breakdown&&s===12)) this._menuSnare(at+.004,intro?.78:1);
    if(!intro&&!breakdown&&(s===3||(bar%2&&s===11))) this._menuSnare(at+.009,.17);
    if(s%2===0&&!(fill&&s>=12)) this._noiseHit(at,.052,s%4?.013:.019,6800,'highpass',s%4?.26:-.22,this.menuDrums,.002);
    if(!intro&&!breakdown&&[3,11].includes(s)) this._noiseHit(at+.007,.04,.006,5700,'highpass',.22,this.menuDrums,.002);
    if(s===14&&!fill&&!intro) this._noiseHit(at,.15,.014,5600,'highpass',.28,this.menuDrums,.003);
    if(s===0&&[4,8,24].includes(bar)) this._noiseHit(at,.55,.031,4900,'bandpass',.25,this.menuDrums,.004);
    if(fill&&s>=12) {
      if(s===12||s===14||s===15)this._menuSnare(at,[.74,.3,.56,.78][s-12]);
      if(s===13||s===15)this._note(s===13?147:110,at,.16,'sine',.065,this.menuDrums,s===13?116:86);
    }

    const riff = breakdown ? [[0,0,7],[10,0,4]] : MENU_RIFFS[bar%4];
    for(const [position,offset,length] of riff) {
      if(position!==s||(intro&&bar<2&&s>8)||(finish&&s>=12))continue;
      this._menuChord(root+offset,at,length*MENU_STEP*(breakdown?.95:.79),intro?.72:1);
      const bass = root-12+(offset===7?7:0);
      this._note(frequency(bass),at+.006,Math.max(.09,length*MENU_STEP*.88),'triangle',.48,this.menuBass);
      if(s===0&&!breakdown)this._note(frequency(bass),at,.25,'sine',.047,this.menuMusic);
    }
    // A small rising answer builds into the final eight-bar guitar hook.
    if(build&&[2,8,14].includes(s)) {
      const offset = s===2?24:s===8?27:31;
      this._menuPluck(root+offset,at,.25,.23,this.menuLead,2);
    }
    if(bar>=24) for(const [position,offset,length] of MENU_HOOK[bar-24]) {
      if(position!==s)continue;
      this._menuPluck(root+offset,at+.011,length*MENU_STEP*.95,.43,this.menuLead,2);
    }
  }

  _raceChord(root, at, duration, weight = 1) {
    for (let take = 0; take < 2; take++) for (const [index,interval] of [0,7,12].entries()) {
      this._menuPluck(root + interval, at + take*.007 + index*.003, duration,
        [.46,.30,.19][index]*weight, this.raceGuitars[take], take === 0 ? -6 : 5);
    }
  }

  _raceKick(at, weight = 1) {
    this._note(137,at,.19,'sine',.19*weight,this.raceDrums,45);
    this._noiseHit(at,.024,.022*weight,2700,'lowpass',0,this.raceDrums,.002);
  }

  _raceSnare(at, weight = 1) {
    this._noiseHit(at,.13,.092*weight,2050,'bandpass',-.10,this.raceDrums,.002);
    this._noiseHit(at+.011,.072,.023*weight,5000,'highpass',.14,this.raceDrums,.002);
    this._note(210,at,.095,'triangle',.038*weight,this.raceDrums,158);
  }

  _raceHookNote(midi, at, duration, weight = 1) {
    const hz = frequency(midi);
    this._note(hz,at,duration,'sawtooth',.037*weight,this.raceLead);
    this._note(hz*2**(6/1200),at+.003,duration,'triangle',.055*weight,this.raceLead);
  }

  _scheduleRaceStep(step, at) {
    const bar = Math.floor(step/16)%32, s = step%16, root = RACE_ROOTS[bar];
    const launch = bar < 4, breakdown = bar >= 16 && bar < 20, build = bar >= 20 && bar < 24;
    const hook = (bar >= 8 && bar < 16) || bar >= 24;
    const boosted = this.raceBoost > .02, finalStretch = this.raceProgress >= .72;
    const fill = bar%4===3, kickSteps = breakdown ? [0,10] : bar%2 ? [0,6,8,11] : [0,3,8,10];
    if(kickSteps.includes(s))this._raceKick(at,s%8===0?1:.77);
    if(s===(breakdown?8:4)||(!breakdown&&s===12))this._raceSnare(at+.003,launch?.84:1);
    if(!breakdown&&[3,11].includes(s))this._raceSnare(at+.007,.19);
    // Tight eighths plus very quiet sixteenth answers give forward motion while
    // keeping the guitar transients and checkpoint sounds intelligible.
    if(s%2===0)this._noiseHit(at,.042,s%4?.013:.021,7200,'highpass',s%4?.32:-.25,this.raceDrums,.002);
    if(!breakdown&&(hook||boosted||finalStretch)&&s%4===3)
      this._noiseHit(at,.033,.007,6200,'highpass',-.35,this.raceDrums,.002);
    if(!breakdown&&s===14&&!fill)this._noiseHit(at,.12,.018,6400,'highpass',.35,this.raceDrums,.002);
    if(s===0&&[0,8,24].includes(bar))this._noiseHit(at,.43,.029,5100,'bandpass',.28,this.raceDrums,.003);
    if(fill&&s>=13) {
      if(s!==14)this._raceSnare(at,.34+(s-13)*.12);
      if(s===14)this._note(132,at,.13,'sine',.063,this.raceDrums,91);
    }
    if(build&&bar>=22&&s%2===0)this._raceSnare(at,.16+(s/16)*.16);
    if(finalStretch&&!breakdown&&s%4===2)this._note(s%8===2?360:280,at,.045,'triangle',.016,this.raceDrums);

    const riff = breakdown ? [[0,0,6],[8,0,4]] : RACE_RIFFS[bar%4];
    for(const [position,offset,length] of riff) {
      if(position!==s)continue;
      this._raceChord(root+offset,at,length*RACE_STEP*(breakdown?.93:.77),launch?.82:1);
      const bass = frequency(root-12+(offset===7?7:0)), duration = Math.max(.065,length*RACE_STEP*.86);
      // A short gap before each kick lets the low end breathe; no continual
      // sub-bass wall or gain jump is needed when the boost layer arrives.
      this._note(bass,at+.012,duration,'triangle',.51,this.raceBass);
      this._note(bass*2,at+.015,duration*.84,'sawtooth',.11,this.raceBass);
      if(s===0)this._note(bass,at,.22,'sine',.031,this.raceMusic);
    }
    const phrase = RACE_HOOK[bar%8];
    for(const [position,midi,length] of phrase) {
      if(position!==s)continue;
      if(hook)this._raceHookNote(midi,at+.008,length*RACE_STEP*.88,1);
      else if(build||(!launch&&!breakdown&&position%2===0))
        this._raceHookNote(midi-12,at+.008,length*RACE_STEP*.74,.58);
      // Boosts answer the hook one octave up with short notes on the grid.
      // They are earned in gameplay; the mix only follows the supplied state.
      if(boosted)this._raceHookNote(midi+12,at+RACE_STEP*.5,Math.min(.14,length*RACE_STEP*.6),.34);
    }
  }

  _scheduleSunsetStep(step, at) {
    const bar=Math.floor(step/16)%32,s=step%16,chord=SUNSET_CHORDS[bar%8];
    const middle=bar>=16&&bar<24,answer=bar>=8&&bar<16;
    // Spacious backbeat, brushed snare and a soft shaker. No busy race layer.
    if(s===0||(!middle&&s===10))this._kick(at,s===0?.58:.37);
    if(s===4||s===12)this._snare(at+.024,middle?.24:.38);
    if(s%2===0)this._noiseHit(at+(s%4?.027:.006),.095,s%4?.0045:.0065,3500,'bandpass',s%4?.32:-.32);
    if(s===0) {
      chord.notes.forEach((midi,i)=>this._guitar(midi,at+i*.033,1.45,.029,true,-.38));
      for(const midi of chord.notes.slice(1))this._note(frequency(midi),at+.035,1.72,'sine',.009,this.sunsetKeys);
    }
    if(s===11&&!middle)this._guitar(chord.notes[2],at+.018,.69,.021,true,.38);
    if(s===0||s===8)this._note(frequency(chord.root),at+.012,s===0?.96:.7,'sine',s===0?.076:.052,this.music);
    const phrase=SUNSET_MELODY[bar%8];
    for(const [position,midi,length] of phrase)if(position===s) {
      this._guitar(midi,at+.025,length*SUNSET_STEP*.92+.12,middle?.065:.091,true,.22);
      if(answer&&position===phrase.at(-1)[0])this._guitar(chord.notes[3],at+SUNSET_STEP*2,.64,.028,true,-.1);
    }
  }

  _scheduleSurvivalStep(step, at) {
    const bar=Math.floor(step/16)%32,s=step%16,root=SURVIVAL_ROOTS[bar];
    const breath=bar>=16&&bar<20,hook=bar>=8&&!breath,build=bar>=20&&bar<24;
    const urgent=this.survivalIntensity>=.5,peak=this.survivalIntensity>=.85;
    const kickSteps=breath?[0,8]:bar%2?[0,6,8,14]:[0,3,8,11];
    if(kickSteps.includes(s)) {
      this._note(123,at,.17,'sine',s%8===0?.155:.113,this.survivalDrums,46);
      this._noiseHit(at,.025,.014,2400,'lowpass',0,this.survivalDrums,.003);
    }
    if(s===4||s===12) {
      this._noiseHit(at+.003,.13,breath?.053:.076,1900,'bandpass',-.08,this.survivalDrums,.003);
      this._note(188,at,.09,'triangle',.028,this.survivalDrums,150);
    }
    if(s%2===0)this._noiseHit(at,.048,s%4?.01:.015,6100,'highpass',s%4?.28:-.26,this.survivalDrums,.003);
    if(urgent&&!breath&&s%4===3)this._noiseHit(at+.007,.035,.0055,4800,'highpass',-.35,this.survivalDrums,.003);
    if((bar%8===7||build)&&s===15)this._noiseHit(at,.11,.043,1400,'bandpass',.14,this.survivalDrums,.003);
    if(peak&&!breath&&[2,10].includes(s))this._note(s===2?330:262,at,.05,'triangle',.012,this.survivalDrums);
    // Tight picked octaves propel the track; different rhythms and melody from
    // the race theme keep Survival recognisable even at its earliest stage.
    const riff=breath?[0,8]:[0,2,6,8,10,14];
    if(riff.includes(s)) {
      const length=breath?SURVIVAL_STEP*5:SURVIVAL_STEP*(s%8===0?1.45:1.1);
      for(let take=0;take<2;take++)for(const [i,offset] of [0,7,12].entries())
        this._menuPluck(root+offset,at+take*.008+i*.004,length,[.32,.2,.17][i],this.survivalGuitars[take],take?-4:4);
      this._note(frequency(root-12),at+.009,length,'triangle',.073,this.music);
    }
    if(hook||build)for(const [position,midi,length] of SURVIVAL_HOOK[bar%8])if(position===s) {
      this._note(frequency(midi),at+.008,length*SURVIVAL_STEP*.86,'triangle',build?.045:.072,this.survivalLead);
      if(urgent)this._note(frequency(midi-12),at+.014,length*SURVIVAL_STEP*.79,'sine',.034,this.survivalLead);
    }
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

  _clearWastedVoices() {
    // Disconnect synchronously as well as stopping: a muted/skipped sequence
    // must not leave a future heartbeat or sting waiting to sound on resume.
    for (const [source,nodes] of this._wastedVoices) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.onended = null; source.disconnect();
      for (const node of nodes) node.disconnect();
      this.voices.delete(source);
    }
    this._wastedVoices.clear();
    if (this._wastedBus) this._wastedBus.disconnect();
    this._wastedBus = null;
  }

  _trackWasted(source,nodes) {
    this._wastedVoices.set(source,nodes); this._track(source,nodes,'wasted');
  }

  _wastedTone(at,duration,startHz,endHz,volume,type='sine',pan=0) {
    const c=this.ctx,source=c.createOscillator(),filter=c.createBiquadFilter(),gain=c.createGain(),stereo=c.createStereoPanner();
    source.type=type;source.frequency.setValueAtTime(startHz,at);
    source.frequency.exponentialRampToValueAtTime(endHz,at+duration);
    filter.type='lowpass';filter.frequency.value=650;filter.Q.value=.45;
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.012);
    gain.gain.exponentialRampToValueAtTime(volume*.3,at+duration*.32);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    stereo.pan.value=pan;source.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(this._wastedBus);
    this._trackWasted(source,[filter,gain,stereo]);source.start(at);source.stop(at+duration+.025);
  }

  _wastedRush(at,duration,volume,startHz,endHz,attack) {
    const c=this.ctx,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    source.buffer=this.noise;source.loop=true;filter.type='lowpass';filter.Q.value=.65;
    filter.frequency.setValueAtTime(startHz,at);filter.frequency.exponentialRampToValueAtTime(endHz,at+duration);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+attack);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this._wastedBus);
    this._trackWasted(source,[filter,gain]);source.start(at);source.stop(at+duration+.025);
  }

  _canPlayWasted() {
    return this.enabled && this.ctx && (this.ctx.state==='running' || typeof this.ctx.startRendering==='function');
  }

  startWastedSequence() {
    if (this._wasted) return false;
    this._wasted=true;this._wastedRevealed=false;
    if (!this.ctx) return false;
    const at=this.ctx.currentTime;
    for (const bus of [this.music,this.menuMusic,this.raceMusic]) {
      bus.gain.cancelScheduledValues(at);bus.gain.setTargetAtTime(0,at,.035);
    }
    this._stopVoices(null,.055);
    if (!this._canPlayWasted()) return false;
    this.active=true;this._fade(true);
    this._wastedBus=this.ctx.createGain();this._wastedBus.gain.value=.84;this._wastedBus.connect(this.effects);
    // An original falling pressure rush and two slowing heartbeats. The final
    // .2 seconds fall quiet before the title hit, following the closing eyes.
    this._wastedRush(at,1.58,.16,2900,145,.12);
    this._wastedTone(at+.05,.30,100,43,.19);
    this._wastedTone(at+.49,.20,76,45,.12);
    this._wastedTone(at+.68,.17,64,40,.075);
    this._wastedTone(at+1.09,.25,64,34,.09);
    return true;
  }

  _scheduleWastedReveal(at) {
    // Heavy low impact, a filtered breath and a dissonant metallic interval
    // that sinks away. All layers are original and share the game's limiter.
    this._wastedTone(at,.96,91,28,.29);
    this._wastedRush(at,.65,.12,1450,180,.014);
    this._wastedTone(at+.012,1.37,174.61,110,.072,'triangle',-.28);
    this._wastedTone(at+.025,1.49,246.94,138.59,.046,'triangle',.28);
  }

  revealWasted() {
    if (!this._wasted || this._wastedRevealed) return false;
    this._wastedRevealed=true;
    if (!this._canPlayWasted() || !this._wastedBus) return false;
    this._scheduleWastedReveal(this.ctx.currentTime);return true;
  }

  endWastedSequence() {
    const wasWasted=this._wasted;this._wasted=false;this._wastedRevealed=false;
    this._clearWastedVoices();
    if (!wasWasted || !this.ctx) return;
    const at=this.ctx.currentTime;
    for (const [bus,target] of [[this.music,this._musicScene==='ride'?.82:0],[this.menuMusic,this._musicScene==='menu'?.88:0],[this.raceMusic,this._musicScene==='race'?.84:0]]) {
      bus.gain.cancelScheduledValues(at);bus.gain.setTargetAtTime(target,at,.08);
    }
    this.active=false;this._fade(false);this.nextBeat=at+.04;
    // The next ordinary update decides whether to resume music or stay paused.
  }

  tone(freq, duration, type = 'sine', volume = .035, endFreq) {
    if (!this.enabled || !this.ctx || !this.active || this._wasted) return;
    this._note(freq, this.ctx.currentTime, duration, type === 'square' || type === 'sawtooth' ? 'sine' : type,
      Math.min(.07, volume), this.effects, endFreq, 'effects');
  }

  event(type) {
    if (type === 'jump') this.tone(294, .19, 'sine', .035, 440);
    if (type === 'trick') this.tone(659, .16, 'sine', .030, 784);
    if (type === 'land') this.tone(96, .13, 'sine', .05, 58);
    if (type === 'bank' || type === 'gate') { this.tone(523.25, .30, 'sine', .040); this.tone(783.99, .36, 'sine', .027); }
    if (type === 'bail') this.tone(196, .30, 'triangle', .030, 98);
    if (type === 'finish') { this.tone(392, .7, 'sine', .040); this.tone(493.88, .6, 'sine', .025); }
    if (type === 'raceBoost') { this.tone(220,.22,'triangle',.025,660); this.tone(440,.28,'sine',.024,880); }
    if (type === 'raceGo') { this.tone(392,.19,'triangle',.035); this.tone(784,.32,'sine',.028); }
  }

  update(active, mode = this.mode) {
    if (mode !== this.mode) this.setMode(mode);
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this._wasted) {
      if (!this.active) { this.active=true;this._fade(true); }
      return; // Cinematic callbacks own the sound until the sequence ends.
    }
    if (Boolean(active) !== this.active) {
      this.active = Boolean(active); this._fade(this.active); this.nextBeat = now + .04;
      if (!this.active) this._stopVoices();
    }
    if (!this.active) return;
    if (this.nextBeat < now - .2) this.nextBeat = now + .04;
    const track = this.currentTrackId, menu = track === 'menu', race = track === 'race';
    const weatherRide=track==='sunset'||track==='survival';
    const total = menu ? MENU_STEPS : race ? RACE_STEPS : weatherRide ? WEATHER_STEPS : TOTAL_STEPS;
    const interval = menu ? MENU_STEP : race ? RACE_STEP : track==='sunset'?SUNSET_STEP:track==='survival'?SURVIVAL_STEP:STEP;
    while (this.nextBeat < now + .18) {
      if(menu)this._scheduleMenuStep(this.beat % total,this.nextBeat);
      else if(race)this._scheduleRaceStep(this.beat % total,this.nextBeat);
      else if(track==='sunset')this._scheduleSunsetStep(this.beat % total,this.nextBeat);
      else if(track==='survival')this._scheduleSurvivalStep(this.beat % total,this.nextBeat);
      else this._scheduleStep(this.beat % total,this.nextBeat);
      this.beat = (this.beat + 1) % total; this.nextBeat += interval;
    }
  }

  async dispose() {
    this._token++; this.enabled = false; this._enabling = false; this.active = false;
    this._wasted=false;this._wastedRevealed=false;this._clearWastedVoices();
    this._stopVoices();
    for (const source of this._persistentSources) { try { source.stop(); } catch { /* already stopped */ } }
    for (const node of this._persistent) node.disconnect();
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close();
    this.ctx = null; this.voices.clear(); this._strings.clear(); this._persistent = []; this._persistentSources = [];
  }
}
