export const WASTED_SECONDS = 4.8;
export const WASTED_REVEAL_AT = 1.85;
export const WASTED_SKIP_AFTER = 2.1;
let sequenceId = 0;

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// One presentation clock drives the camera, eyelids and sound reveal together.
export function sampleWastedFrame(elapsed) {
  const time = Number.isFinite(elapsed) ? Math.max(0, Math.min(WASTED_SECONDS, elapsed)) : 0;
  return {
    elapsed: time,
    phase: time < .55 ? 'first-person' : time < 1.5 ? 'eyes-closing' : time < WASTED_REVEAL_AT ? 'blackout' : 'wasted',
    cameraProgress: ease(time / .28),
    eyeClosure: ease((time - .55) / .95),
    titleVisible: time >= WASTED_REVEAL_AT,
  };
}

// Presentation time is independent of the finished game's simulation clock.
// Call reset() when beginning a new run; repeated finish signals cannot replay it.
export function createWastedSequence({ stage, onComplete, onStart, onEnd, onFrame, onReveal }) {
  if (!stage?.ownerDocument) throw new TypeError('Wasted sequence requires a stage element.');
  const doc = stage.ownerDocument, win = doc.defaultView;
  const app = stage.closest('#app') || stage;
  // The controller is created before the renderer. Resolve the scene on start,
  // and never mistake the already-present HUD map for a pending scene canvas.
  let canvas = null;
  const id = ++sequenceId;
  const overlay = doc.createElement('section');
  overlay.className = 'wasted-overlay'; overlay.hidden = true; overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Final wipeout');
  const eyelids = doc.createElement('div'); eyelids.className = 'wasted-eyelids'; eyelids.setAttribute('aria-hidden', 'true');
  const upperLid = doc.createElement('div'); upperLid.className = 'wasted-eyelid wasted-eyelid-upper';
  const lowerLid = doc.createElement('div'); lowerLid.className = 'wasted-eyelid wasted-eyelid-lower';
  eyelids.append(upperLid, lowerLid);
  const fade = doc.createElement('div'); fade.className = 'wasted-eye-fade'; fade.setAttribute('aria-hidden', 'true');
  const band = doc.createElement('div'); band.className = 'wasted-band';
  const title = doc.createElement('h2'); title.className = 'wasted-title'; title.id = `wasted-title-${id}`; title.textContent = 'WASTED';
  const detail = doc.createElement('p'); detail.className = 'wasted-detail'; detail.id = `wasted-detail-${id}`; detail.textContent = 'THREE WIPEOUTS · RUN OVER';
  const button = doc.createElement('button'); button.className = 'wasted-skip'; button.type = 'button'; button.hidden = true;
  button.textContent = 'CONTINUE TO RESULTS'; button.setAttribute('aria-label', 'Skip the wipeout sequence and show results');
  band.hidden = true; band.setAttribute('aria-hidden', 'true');
  band.append(title, detail); overlay.append(eyelids, fade, band, button); doc.body.append(overlay);
  let active = false, started = false, destroyed = false, elapsed = 0, skipReady = false, revealed = false;
  let previousFocus = null, appWasInert = false, oldProgress = '';

  function paint() {
    const frame = sampleWastedFrame(elapsed);
    const progress = Math.min(1, elapsed / WASTED_SECONDS);
    canvas?.style.setProperty('--wasted-progress', String(progress));
    overlay.setAttribute('data-phase', frame.phase);
    overlay.style.setProperty('--wasted-eye-closure', String(frame.eyeClosure));
    overlay.style.setProperty('--wasted-blackout', frame.eyeClosure === 1 ? '1' : '0');
    onFrame?.(frame);
    if (!revealed && frame.titleVisible) {
      revealed = true; band.hidden = false; band.removeAttribute('aria-hidden');
      overlay.removeAttribute('aria-label');
      overlay.setAttribute('aria-labelledby', title.id);
      overlay.setAttribute('aria-describedby', detail.id);
      onReveal?.();
    }
    if (!skipReady && elapsed >= WASTED_SKIP_AFTER) {
      skipReady = true; button.hidden = false; button.focus({ preventScroll:true });
    }
  }
  function end(cancelled) {
    if (!active) return false;
    active = false; overlay.hidden = true; button.hidden = true; band.hidden = true;
    band.setAttribute('aria-hidden', 'true');
    canvas?.classList.remove('wasted-scene-canvas');
    if (canvas) {
      if (oldProgress) canvas.style.setProperty('--wasted-progress', oldProgress);
      else canvas.style.removeProperty('--wasted-progress');
    }
    if (!appWasInert) app.removeAttribute('inert');
    if (previousFocus?.isConnected && !previousFocus.closest?.('[inert]')) previousFocus.focus({ preventScroll:true });
    else if (!appWasInert) stage.focus({ preventScroll:true });
    previousFocus = null;
    try { onEnd?.({ cancelled }); }
    finally { if (!cancelled) onComplete?.(); }
    return true;
  }
  function skip() { return active && skipReady ? end(false) : false; }
  function captureKey(event) {
    if (!active) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type !== 'keydown' || event.repeat) return;
    if (event.code === 'Tab') (skipReady ? button : overlay).focus({ preventScroll:true });
    else if (['Enter', 'Escape', 'Space'].includes(event.code)) skip();
  }
  function keepFocus(event) {
    if (active && !overlay.contains(event.target)) (skipReady ? button : overlay).focus({ preventScroll:true });
  }
  const stopPointer = event => event.stopPropagation();
  for (const type of ['pointerdown', 'pointerup', 'click']) overlay.addEventListener(type, stopPointer);
  button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); skip(); });
  win?.addEventListener('keydown', captureKey, true); win?.addEventListener('keyup', captureKey, true);
  doc.addEventListener('focusin', keepFocus, true);

  return {
    get active() { return active; },
    start() {
      if (destroyed || started) return false;
      started = true; active = true; elapsed = 0; skipReady = false; revealed = false;
      const viewport = stage.querySelector('#viewport');
      canvas = viewport ? viewport.querySelector('canvas') : stage.querySelector('canvas');
      previousFocus = doc.activeElement; appWasInert = app.hasAttribute('inert');
      oldProgress = canvas?.style.getPropertyValue('--wasted-progress') || '';
      app.setAttribute('inert', ''); canvas?.classList.add('wasted-scene-canvas');
      overlay.hidden = false; button.hidden = true; band.hidden = true; band.setAttribute('aria-hidden', 'true');
      overlay.removeAttribute('aria-labelledby'); overlay.removeAttribute('aria-describedby'); overlay.setAttribute('aria-label', 'Final wipeout');
      overlay.focus({ preventScroll:true });
      try { onStart?.(); paint(); } catch (error) { end(true); throw error; }
      return true;
    },
    update(dt) {
      if (!active || !Number.isFinite(dt) || dt <= 0) return;
      elapsed = Math.min(WASTED_SECONDS, elapsed + dt);
      try { paint(); } catch (error) { end(true); throw error; }
      if (elapsed >= WASTED_SECONDS) end(false);
    },
    skip,
    reset() {
      end(true); started = false; elapsed = 0; skipReady = false; revealed = false;
    },
    destroy() {
      if (destroyed) return;
      end(true); destroyed = true;
      win?.removeEventListener('keydown', captureKey, true); win?.removeEventListener('keyup', captureKey, true);
      doc.removeEventListener('focusin', keepFocus, true); overlay.remove();
    },
  };
}
