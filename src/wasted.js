export const WASTED_SECONDS = 3.4;
export const WASTED_SKIP_AFTER = .8;
let sequenceId = 0;

// Presentation time is independent of the finished game's simulation clock.
// Call reset() when beginning a new run; repeated finish signals cannot replay it.
export function createWastedSequence({ stage, onComplete, onStart, onEnd }) {
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
  overlay.setAttribute('aria-labelledby', `wasted-title-${id}`);
  overlay.setAttribute('aria-describedby', `wasted-detail-${id}`);
  const band = doc.createElement('div'); band.className = 'wasted-band';
  const title = doc.createElement('h2'); title.className = 'wasted-title'; title.id = `wasted-title-${id}`; title.textContent = 'WASTED';
  const detail = doc.createElement('p'); detail.className = 'wasted-detail'; detail.id = `wasted-detail-${id}`; detail.textContent = 'THREE WIPEOUTS · RUN OVER';
  const button = doc.createElement('button'); button.className = 'wasted-skip'; button.type = 'button'; button.hidden = true;
  button.textContent = 'CONTINUE TO RESULTS'; button.setAttribute('aria-label', 'Skip the wipeout sequence and show results');
  band.append(title, detail); overlay.append(band, button); doc.body.append(overlay);
  let active = false, started = false, destroyed = false, elapsed = 0, skipReady = false;
  let previousFocus = null, appWasInert = false, oldProgress = '';

  function paint() {
    const progress = Math.min(1, elapsed / WASTED_SECONDS);
    canvas?.style.setProperty('--wasted-progress', String(progress));
    const fade = Math.max(0, Math.min(1, (elapsed - .75) / 2.4));
    const red = [167, 29, 38], pale = [192, 187, 178];
    title.style.color = `rgb(${red.map((value, i) => Math.round(value + (pale[i] - value) * fade)).join(',')})`;
    if (!skipReady && elapsed >= WASTED_SKIP_AFTER) {
      skipReady = true; button.hidden = false; button.focus({ preventScroll:true });
    }
  }
  function end(cancelled) {
    if (!active) return false;
    active = false; overlay.hidden = true; button.hidden = true;
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
      started = true; active = true; elapsed = 0; skipReady = false;
      const viewport = stage.querySelector('#viewport');
      canvas = viewport ? viewport.querySelector('canvas') : stage.querySelector('canvas');
      previousFocus = doc.activeElement; appWasInert = app.hasAttribute('inert');
      oldProgress = canvas?.style.getPropertyValue('--wasted-progress') || '';
      app.setAttribute('inert', ''); canvas?.classList.add('wasted-scene-canvas');
      overlay.hidden = false; button.hidden = true; paint(); overlay.focus({ preventScroll:true });
      try { onStart?.(); } catch (error) { end(true); throw error; }
      return true;
    },
    update(dt) {
      if (!active || !Number.isFinite(dt) || dt <= 0) return;
      elapsed = Math.min(WASTED_SECONDS, elapsed + dt); paint();
      if (elapsed >= WASTED_SECONDS) end(false);
    },
    skip,
    reset() {
      end(true); started = false; elapsed = 0; skipReady = false;
    },
    destroy() {
      if (destroyed) return;
      end(true); destroyed = true;
      win?.removeEventListener('keydown', captureKey, true); win?.removeEventListener('keyup', captureKey, true);
      doc.removeEventListener('focusin', keepFocus, true); overlay.remove();
    },
  };
}
