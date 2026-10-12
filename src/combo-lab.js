import * as THREE from 'three';
import { WaveParkGame } from './park.js';
import { TRICKS } from './game.js';
import { COMBO_ANIMATIONS } from './combo-animations.js';
import { SurfWorld } from './world.js';
import { validateProfile } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';
import { sampleRiderTrick } from './rider-pose.js';

const STEP = 1 / 120;

// The preview supplies controls and ordinary trick requests only. Keeping this
// controller separate from the DOM also permits a real-simulation smoke check.
export class ComboPlayback {
  constructor(onEvent = () => {}) {
    this.events = [];
    this.onEvent = onEvent;
    this.game = new WaveParkGame(event => {
      if (!this.game) return;
      if (!['reset', 'start', 'wall'].includes(event.type)) {
        this.events.unshift(`${this.game.elapsed.toFixed(3)} · ${event.type}${event.name ? ' · ' + event.name : ''}`);
        this.events.length = Math.min(this.events.length, 8);
      }
      this.onEvent(event, this.game);
    });
  }

  start(id = COMBO_ANIMATIONS[0].id, comparison = false) {
    this.combo = COMBO_ANIMATIONS.find(combo => combo.id === id) || COMBO_ANIMATIONS[0];
    this.comparison = comparison;
    this.stage = 'approach';
    this.launchTime = null;
    this.secondStart = null;
    this.checkpointSeen = false;
    this.atCheckpoint = false;
    this.done = false;
    this.landed = false;
    this.events = [];
    this.message = 'Pumping up the filter halfpipe. The ramp launches the rider naturally.';
    this.game.start('filters');
  }

  stop(message, done = false) {
    this.message = message;
    this.done = done;
    this.game.pause();
  }

  beginFinisher() {
    if (!this.game.doTrick(this.combo.sequence[1])) {
      this.stop('The finishing trick could not start. Restart to replay the approach.', true);
      return;
    }
    this.stage = 'finishing';
    this.secondStart = this.game.elapsed;
    this.message = this.comparison ? 'Playing the ordinary finishing trick.' : `Playing ${this.combo.name}.`;
  }

  tick() {
    const game = this.game;
    if (!this.combo || this.done || game.phase !== 'running') return;
    game.update(STEP, { pump: true });
    if (game.wipeouts > 0 || game.bailTime > 0) {
      this.stop('The replay ended in a wipeout. The event log shows what happened.', true);
      return;
    }
    if (this.launchTime === null && game.airborne) {
      this.launchTime = game.elapsed;
      this.stage = this.comparison ? 'waiting' : 'first trick';
      if (!this.comparison && !game.doTrick(this.combo.sequence[0])) {
        this.stop('The first trick could not start. Restart to replay the approach.', true);
        return;
      }
      this.message = this.comparison ? 'Matching the combo timing before the finishing trick.' : 'First trick in progress…';
    }
    if (this.launchTime !== null && !game.airborne) {
      this.landed = this.secondStart !== null && !game.trick && game.launchTricks >= (this.comparison ? 1 : 2);
      this.stage = this.landed ? 'landed' : 'incomplete';
      this.stop(this.landed ? 'Landed. Restart, compare the ordinary trick, or choose another combination.' : 'The rider landed before the sequence finished. Inspect the event log.', true);
      return;
    }
    if (game.airborne && this.stage === 'first trick' && !game.trick && game.launchTricks >= 1) this.beginFinisher();
    if (game.airborne && this.stage === 'waiting' && game.elapsed - this.launchTime >= TRICKS[this.combo.sequence[0]].duration - 1e-8) this.beginFinisher();
    if (this.stage === 'finishing' && game.trick && !this.checkpointSeen && game.trick.age / game.trick.duration >= .5) {
      this.checkpointSeen = true;
      this.atCheckpoint = true;
      this.stop(this.comparison ? 'Ordinary finishing pose. Continue to watch the landing.' : `${this.combo.name}: finishing pose. Continue to watch the landing.`);
    } else if (this.stage === 'finishing' && !game.trick) {
      this.stage = 'landing';
      this.message = 'Both feet return with the board. Watching the landing…';
    }
    if (game.elapsed > 9 && !this.done) this.stop('Replay timed out before landing. Inspect the event log.', true);
  }

  resume() {
    if (!this.combo || this.done) return;
    this.atCheckpoint = false;
    this.game.resume();
    this.message = this.checkpointSeen ? 'Continuing through the finishing trick and landing…' : 'Replaying the approach and trick sequence…';
  }

  pause() {
    if (!this.combo || this.done) return;
    this.stop('Paused. Resume to keep watching.');
  }
}

// This is a measured point-to-surface distance, not a claim that every part of
// the hand or body is free of penetration. The target is the generated mesh.
export function fingertipDeckDistance(surfer) {
  const point = surfer.landmarks?.rightFingertip;
  const deck = surfer.board;
  const position = deck?.geometry?.getAttribute('position');
  if (!point || !position) return null;
  deck.updateWorldMatrix(true, false);
  const index = deck.geometry.getIndex();
  const count = index ? index.count : position.count;
  const triangle = new THREE.Triangle();
  const closest = new THREE.Vector3();
  let distance = Infinity;
  for (let i = 0; i + 2 < count; i += 3) {
    [triangle.a, triangle.b, triangle.c].forEach((vertex, corner) => {
      vertex.fromBufferAttribute(position, index ? index.getX(i + corner) : i + corner).applyMatrix4(deck.matrixWorld);
    });
    triangle.closestPointToPoint(point, closest);
    distance = Math.min(distance, point.distanceTo(closest));
  }
  return Number.isFinite(distance) ? distance : null;
}

async function boot() {
  const $ = id => document.getElementById(id);
  let world;
  const playback = new ComboPlayback((event, game) => world?.onEvent(event, game));
  const choices = new Map();
  let accumulator = 0;

  function start(id = playback.combo?.id || COMBO_ANIMATIONS[0].id) {
    accumulator = 0;
    playback.start(id, $('comparison').value === 'single');
    const combo = playback.combo;
    for (const [key, button] of choices) button.setAttribute('aria-pressed', String(key === combo.id));
    $('description').textContent = combo.description;
    $('key-sequence').textContent = combo.keys.join(' → ');
    $('caption-name').textContent = playback.comparison ? TRICKS[combo.sequence[1]].name : combo.name;
    $('caption-mode').textContent = playback.comparison ? 'Ordinary finishing trick · same approach and timing' : combo.keys.join(' → ') + ' · full combo sequence';
    updateCounters();
  }

  function updateCounters() {
    const game = playback.game, combo = playback.combo;
    if (!combo) return;
    const pose = sampleRiderTrick(game);
    $('status').textContent = playback.message;
    $('stat-name').textContent = playback.comparison ? 'Ordinary ' + TRICKS[combo.sequence[1]].name : combo.name;
    $('stat-keys').textContent = playback.comparison ? combo.keys[1] + ' (first key skipped)' : combo.keys.join(' → ');
    $('stat-phase').textContent = `${game.phase} / ${playback.stage}`;
    $('stat-time').textContent = game.elapsed.toFixed(3) + ' s';
    $('stat-air').textContent = game.airtime.toFixed(3) + ' s';
    $('stat-trick').textContent = game.trick?.name || 'none';
    $('stat-progress').textContent = playback.stage === 'finishing' && game.trick ? (game.trick.age / game.trick.duration * 100).toFixed(1) + '%' : '—';
    $('stat-combo').textContent = game.trick?.comboAnimation || 'none';
    $('stat-pose').textContent = pose.comboPose ? `${pose.comboPose.id} · ${(pose.comboPose.weight * 100).toFixed(0)}%${pose.holdingGrab ? ' · grab held' : ''}` : pose.holdingGrab ? 'standard grab held' : game.airborne ? 'standard air' : 'riding';
    const distance = pose.grab > .05 || pose.lipGrab > .05 ? fingertipDeckDistance(world.surfer) : null;
    $('stat-contact').textContent = distance === null ? 'no grab in this pose' : distance < .0001 ? '<0.1 mm (measured)' : (distance * 1000).toFixed(1) + ' mm (measured)';
    $('stat-tricks').textContent = String(game.launchTricks);
    $('stat-points').textContent = `${game.comboBase} × ${game.multiplier}`;
    $('events').textContent = playback.events.join('\n');
    $('pause').textContent = game.phase === 'running' ? 'Pause' : 'Resume';
    $('pause').disabled = playback.done;
    $('continue').disabled = playback.done || game.phase !== 'paused';
    $('restart').disabled = false;
  }

  try {
    await loadCharacterTextures();
    world = new SurfWorld($('viewport'), validateProfile({ character: 'jax', outfit: 'yardcrew', boardDesign: 'tribal' }));
    world.setMode('park');
    for (const combo of COMBO_ANIMATIONS) {
      const button = document.createElement('button');
      button.className = 'choice';
      button.type = 'button';
      button.dataset.combo = combo.id;
      const name = document.createElement('span'), keys = document.createElement('small');
      name.textContent = combo.name;
      keys.textContent = combo.keys.join(' → ');
      button.append(name, keys);
      button.addEventListener('click', () => start(combo.id));
      choices.set(combo.id, button);
      $('choices').append(button);
    }
    $('continue').addEventListener('click', () => { playback.resume(); updateCounters(); });
    $('pause').addEventListener('click', () => { if (playback.game.phase === 'running') playback.pause(); else playback.resume(); updateCounters(); });
    $('restart').addEventListener('click', () => start());
    $('comparison').addEventListener('change', () => start());
    $('loading').remove();
    start();
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (playback.game.phase === 'running') {
        accumulator += dt * Number($('rate').value);
        while (accumulator >= STEP && playback.game.phase === 'running') {
          playback.tick();
          accumulator -= STEP;
        }
      } else accumulator = 0;
      world.update(dt, playback.game);
      updateCounters();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    const loading = $('loading');
    if (loading) loading.textContent = 'Unable to load Combo Lab: ' + error.message;
    else $('status').textContent = 'Unable to start Combo Lab: ' + error.message;
  }
}

if (typeof document !== 'undefined') boot();
