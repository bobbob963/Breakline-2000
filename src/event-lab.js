import { SurfGame } from './game.js';
import { SurfWorld } from './world.js';
import { validateProfile } from './appearance.js';
import { loadCharacterTextures } from './character-textures.js';
import { createWastedSequence } from './wasted.js';
import { ArcadeAudio } from './audio.js';

const STEP = 1 / 120;
const INSPECTION_STAGES = [
  {time:.35,label:'First-person view'},
  {time:1.05,label:'Eyelids closing'},
  {time:1.65,label:'Full blackout'},
  {time:2.4,label:'WASTED title'},
];

// Only legal controls enter the simulation. This export also allows a small
// headless check of the real route, without a renderer or synthetic bail call.
export class WipeoutPlayback {
  constructor(onEvent = () => {}) {
    this.events = [];
    this.game = new SurfGame(event => {
      if (!this.game) return;
      if (['start', 'bail', 'recover', 'finish'].includes(event.type)) {
        this.events.push({ ...event, elapsed:this.game.elapsed, lives:this.game.lives });
      }
      onEvent(event, this.game);
    }, 'storm');
  }

  start() {
    this.events = [];
    this.game.start();
  }

  tick() {
    if (this.game.phase === 'running') this.game.update(STEP, { right:true });
  }
}

async function boot() {
  const $ = id => document.getElementById(id);
  const panel = $('review-panel'), home = $('review-home');
  let world, sequence, accumulator = 0, titleTime = 0, inspectionIndex = 0;
  const audio = new ArcadeAudio();
  let inspectionReleased = false, resultsShown = false, finishPending = false;
  const playback = new WipeoutPlayback((event, game) => {
    world?.onEvent(event, game);
    if (event.type === 'finish') finishPending = true;
  });

  function counters() {
    const game = playback.game;
    $('stat-lives').textContent = `${game.lives} / 3`;
    $('stat-wipeouts').textContent = `${game.wipeouts} / 3`;
    $('stat-phase').textContent = game.phase;
    $('stat-time').textContent = `${game.elapsed.toFixed(3)} s`;
    $('stat-title').textContent = `${titleTime.toFixed(2)} s`;
    $('events').textContent = playback.events.map(event => `${event.elapsed.toFixed(3)} · ${event.type}${event.reason ? ' · ' + event.reason : ''} · ${event.lives} lives`).join('\n');
    $('continue').disabled = !sequence?.active;
  }

  function restart() {
    sequence.reset();
    accumulator = 0; titleTime = 0; inspectionReleased = false; inspectionIndex = 0;
    resultsShown = false; finishPending = false; $('results').hidden = true;
    playback.start();
    $('status').textContent = 'Holding D. The rider will leave the wave naturally three times.';
    counters();
  }

  try {
    await loadCharacterTextures();
    world = new SurfWorld($('viewport'), validateProfile({ character:'jax', outfit:'yardcrew', boardDesign:'tribal' }));
    sequence = createWastedSequence({
      stage:$('stage'),
      onStart() {
        titleTime = 0;
        world.startWastedView(playback.game);audio.startWastedSequence();
        // Keep the local pointer controls reachable inside the production
        // modal. The title, scene effect and built-in skip remain unchanged.
        document.querySelector('.wasted-overlay').append(panel);
        $('status').textContent = 'Three natural wipeouts. The game is frozen while its WASTED presentation plays.';
      },
      onFrame(frame) { world.updateWastedView(frame); },
      onReveal() { audio.revealWasted(); },
      onEnd() { world.endWastedView();audio.endWastedSequence();home.append(panel); },
      onComplete() {
        resultsShown = true; $('results').hidden = false;
        $('result-detail').textContent = `${playback.game.wipeouts} wipeouts · ${playback.game.lives} lives · ${playback.game.elapsed.toFixed(2)} seconds`;
        $('status').textContent = 'Replay complete. The finished game stayed frozen throughout the presentation.';
        counters();
      },
    });
    $('restart').addEventListener('click', restart);
    $('sound').addEventListener('click',async()=>{await audio.toggle();$('sound').textContent=audio.enabled?'Sound on · mute':'Sound off · enable';});
    $('continue').addEventListener('click', () => {
      inspectionIndex++;inspectionReleased=inspectionIndex>=INSPECTION_STAGES.length;
      $('status').textContent = inspectionReleased?'Continuing the production sequence to results…':'Continuing to the next presentation stage…';
    });
    $('pause-title').addEventListener('change', () => {
      if (!$('pause-title').checked && sequence.active) $('status').textContent = 'Continuing the production sequence to results…';
    });
    $('loading').remove();
    restart();
    let last = performance.now();
    function frame(now) {
      const elapsed = Math.max(0, (now - last) / 1000); last = now;
      if (!document.hidden) {
        const dt = Math.min(.05, elapsed);
        if (playback.game.phase === 'running') {
          accumulator += dt;
          while (accumulator >= STEP && playback.game.phase === 'running') {
            playback.tick(); accumulator -= STEP;
          }
        } else accumulator = 0;
        if (finishPending) {
          finishPending = false;
          if (playback.game.resultReason === 'OUT OF LIVES') sequence.start();
        }
        if (sequence.active) {
          const inspect = $('pause-title').checked && !inspectionReleased;
          const checkpoint=INSPECTION_STAGES[inspectionIndex];
          const presentationStep = inspect ? Math.min(elapsed, Math.max(0, checkpoint.time - titleTime)) : elapsed;
          if (presentationStep > 0) {
            titleTime += presentationStep;
            sequence.update(presentationStep);
          }
          if (sequence.active && inspect && titleTime >= checkpoint.time) {
            $('status').textContent = `${checkpoint.label} paused at ${checkpoint.time.toFixed(2)} s. Continue to inspect the next stage.`;
          }
        }
        world.update(dt, playback.game);
        if (!sequence.active && !resultsShown && playback.game.phase === 'running') {
          $('status').textContent = playback.game.bailTime > 0 ? `Wipeout ${playback.game.wipeouts} of 3. Waiting for normal recovery…` : 'Holding D. The rider will leave the wave naturally three times.';
        }
        counters();
      }
      requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => { last = performance.now(); });
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    const loading = $('loading');
    if (loading) loading.textContent = `Unable to start the replay: ${error.message}`;
    $('status').textContent = `Unable to start the replay: ${error.message}`;
  }
}

if (typeof document !== 'undefined') boot();
