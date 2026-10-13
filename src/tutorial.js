import './tutorial.css';
import { TUTORIAL_STEPS } from './tutorial-content.js';
import { sanitizeRiderName } from './rider-identity.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const LAST_STEP = TUTORIAL_STEPS.length - 1;

export function createTutorial({ getName = () => '', onComplete, onClose = () => {} }) {
  const overlay = document.createElement('div');
  overlay.id = 'ride-tutorial';
  overlay.className = 'tutorial-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<section class="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-lead" tabindex="-1">
    <header class="tutorial-header"><span>BREAKLINE '99 <b>/ RIDER'S HANDBOOK</b></span><button type="button" data-tutorial-action="close" class="tutorial-close" aria-label="Close tutorial">×</button></header>
    <div class="tutorial-layout">
      <nav class="tutorial-chapters" aria-label="Tutorial chapters">${TUTORIAL_STEPS.map((step, index) => `<button type="button" data-tutorial-step="${index}"><span>${String(index + 1).padStart(2, '0')}</span>${escapeHTML(step.chapter)}</button>`).join('')}<p>FROM THE COAST<br>TO THE CONCRETE.</p></nav>
      <div class="tutorial-main"><div class="tutorial-page">
        <p class="tutorial-kicker" id="tutorial-progress" aria-live="polite"></p>
        <h2 id="tutorial-title" tabindex="-1"></h2><p id="tutorial-lead"></p>
        <div id="tutorial-body"></div>
        <form class="tutorial-name-form" hidden novalidate>
          <label for="tutorial-rider-name">RIDER NAME</label>
          <input id="tutorial-rider-name" name="riderName" type="text" autocomplete="nickname" spellcheck="false" placeholder="YOUR NAME" aria-describedby="tutorial-note tutorial-status" required>
          <div class="tutorial-name-preview" aria-hidden="true"><span id="tutorial-name-preview">YOUR NAME</span><i></i><small>YOUR LOBBY NAMETAG</small></div>
          <button type="submit" class="tutorial-primary tutorial-finish">SAVE NAME + ENTER LOBBY <span>▶</span></button>
          <button type="button" data-tutorial-action="session" class="tutorial-session" hidden>CONTINUE FOR THIS VISIT</button>
        </form>
        <p class="tutorial-note" id="tutorial-note"></p><p class="tutorial-status" id="tutorial-status" role="status" aria-live="polite"></p>
      </div>
      <footer class="tutorial-footer"><button type="button" data-tutorial-action="back" class="tutorial-back">← BACK</button><button type="button" data-tutorial-action="skip" class="tutorial-skip">SKIP TO NAMING</button><button type="button" data-tutorial-action="next" class="tutorial-primary">NEXT <span>→</span></button></footer></div>
    </div><div class="tutorial-progress-track" aria-hidden="true"><i></i></div>
  </section>`;
  document.body.append(overlay);
  const query = selector => overlay.querySelector(selector);
  const dialog = query('.tutorial-dialog'), nameInput = query('#tutorial-rider-name');
  const form = query('.tutorial-name-form'), app = document.getElementById('app');
  const win = document.defaultView;
  let open = false, replay = false, busy = false, disposed = false, step = 0, previousFocus = null, appWasInert = false, generation = 0;

  function status(message = '', error = false) {
    query('#tutorial-status').textContent = message;
    query('#tutorial-status').classList.toggle('is-error', error);
  }
  function render(focus = true) {
    const page = TUTORIAL_STEPS[step], naming = step === LAST_STEP;
    query('#tutorial-progress').textContent = `${String(step + 1).padStart(2, '0')} / ${TUTORIAL_STEPS.length} — ${page.chapter}`;
    query('#tutorial-title').textContent = page.title;
    query('#tutorial-lead').textContent = page.lead;
    query('#tutorial-note').textContent = page.note;
    query('#tutorial-body').innerHTML = `${page.controls ? `<div class="tutorial-controls ${page.id === 'tricks' ? 'tutorial-tricks' : ''}">${page.controls.map(control => `<div><span>${control.keys.map(key => `<kbd>${escapeHTML(key)}</kbd>`).join('<b>+</b>')}</span><section><strong>${escapeHTML(control.label)}</strong>${control.detail ? `<p>${escapeHTML(control.detail)}</p>` : ''}</section></div>`).join('')}</div>` : ''}${page.cards ? `<div class="tutorial-cards">${page.cards.map(card => `<article><h3>${escapeHTML(card.title)}</h3><p>${escapeHTML(card.text)}</p></article>`).join('')}</div>` : ''}`;
    form.hidden = !naming;
    query('[data-tutorial-action="back"]').disabled = step === 0;
    query('[data-tutorial-action="next"]').hidden = naming;
    query('[data-tutorial-action="skip"]').hidden = naming;
    query('[data-tutorial-action="session"]').hidden = true;
    query('[data-tutorial-action="close"]').hidden = !replay;
    for (const button of overlay.querySelectorAll('[data-tutorial-step]')) {
      if (Number(button.dataset.tutorialStep) === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    query('.tutorial-progress-track i').style.width = `${(step + 1) / TUTORIAL_STEPS.length * 100}%`;
    query('.tutorial-page').scrollTop = 0;
    status();
    updateNamePreview();
    if (focus) (naming ? nameInput : query('#tutorial-title')).focus({ preventScroll: true });
  }
  function updateNamePreview() {
    // HTML maxlength counts UTF-16 units and would cut emoji names short.
    if (Array.from(nameInput.value).length > 20) nameInput.value = Array.from(nameInput.value).slice(0, 20).join('');
    query('#tutorial-name-preview').textContent = sanitizeRiderName(nameInput.value) || 'YOUR NAME';
  }
  function goTo(index) {
    if (!open || busy || !Number.isInteger(index) || index < 0 || index > LAST_STEP) return;
    step = index; render();
  }
  function close(force = false) {
    if (!open || (busy && !force)) return false;
    generation++; open = false; busy = false; overlay.hidden = true;
    overlay.removeAttribute('aria-busy');
    if (!appWasInert) app?.removeAttribute('inert');
    if (previousFocus?.isConnected && !previousFocus.closest?.('[inert]')) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
    onClose();
    return true;
  }
  async function finish(persist = true) {
    if (!open || busy || step !== LAST_STEP) return false;
    const name = sanitizeRiderName(nameInput.value);
    if (!name) {
      status('Enter a rider name before heading to the lobby.', true);
      nameInput.setAttribute('aria-invalid', 'true'); nameInput.focus(); return false;
    }
    nameInput.value = name; nameInput.removeAttribute('aria-invalid');
    busy = true; overlay.setAttribute('aria-busy', 'true');
    const transaction = generation;
    const buttons = [...overlay.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; }); nameInput.disabled = true;
    status(persist ? 'Saving your rider…' : 'Opening the lobby…');
    let saved = false;
    try {
      await onComplete(name, { persist });
      saved = true;
    } catch (error) {
      if (!disposed && open && transaction === generation) {
        status(error?.message || 'Your browser could not save the name. Try again, or continue for this visit.', true);
        query('[data-tutorial-action="session"]').hidden = false;
      }
    } finally {
      if (!disposed && transaction === generation) {
        busy = false; overlay.removeAttribute('aria-busy');
        buttons.forEach(button => { button.disabled = false; }); nameInput.disabled = false;
        if (saved) close(); else nameInput.focus({ preventScroll: true });
      }
    }
    return saved;
  }
  async function handleClick(event) {
    const chapter = event.target.closest('[data-tutorial-step]');
    if (chapter) { goTo(Number(chapter.dataset.tutorialStep)); return; }
    const action = event.target.closest('[data-tutorial-action]')?.dataset.tutorialAction;
    if (action === 'next') goTo(step + 1);
    else if (action === 'back') goTo(step - 1);
    else if (action === 'skip') goTo(LAST_STEP);
    else if (action === 'close' && replay) close();
    else if (action === 'session') await finish(false);
  }
  function focusable() { return [...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(element => !element.hidden && !element.closest('[hidden]')); }
  function captureKey(event) {
    if (!open) return;
    // These keys belong to the guide, including keyup (which otherwise releases a game control).
    event.stopImmediatePropagation();
    if (event.type !== 'keydown') return;
    if (event.key === 'Tab') {
      const elements = focusable(), first = elements[0] || dialog, last = elements.at(-1) || dialog;
      const inside = elements.includes(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (!inside || document.activeElement === last)) { event.preventDefault(); first.focus(); }
    } else if (event.key === 'Escape') { event.preventDefault(); if (replay) close(); }
    else if (event.target === nameInput) { /* Keep native text editing and form submission. */ }
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); if (!event.repeat) goTo(step + (event.key === 'ArrowRight' ? 1 : -1));
    } else if (event.key === 'Enter' && !event.target?.closest?.('button') && step !== LAST_STEP) {
      event.preventDefault(); if (!event.repeat) goTo(step + 1);
    }
  }
  function keepFocus(event) { if (open && !overlay.contains(event.target)) dialog.focus({ preventScroll: true }); }
  const submit = event => { event.preventDefault(); event.stopPropagation(); return finish(); };
  overlay.addEventListener('click', handleClick);
  form.addEventListener('submit', submit);
  nameInput.addEventListener('input', updateNamePreview);
  win?.addEventListener('keydown', captureKey, true);
  win?.addEventListener('keyup', captureKey, true);
  document.addEventListener('focusin', keepFocus, true);

  return {
    get isOpen() { return open; },
    open(options = {}) {
      if (disposed || open) return false;
      replay = options.replay === true; step = 0; open = true; busy = false; generation++;
      previousFocus = document.activeElement; appWasInert = app?.hasAttribute('inert') || false;
      nameInput.value = sanitizeRiderName(getName()); nameInput.disabled = false; nameInput.removeAttribute('aria-invalid');
      overlay.querySelectorAll('button').forEach(button => { button.disabled = false; });
      app?.setAttribute('inert', ''); overlay.hidden = false; render(); return true;
    },
    close: () => close(),
    dispose() {
      if (disposed) return;
      close(true); disposed = true;
      win?.removeEventListener('keydown', captureKey, true); win?.removeEventListener('keyup', captureKey, true);
      document.removeEventListener('focusin', keepFocus, true);
      overlay.removeEventListener('click', handleClick); form.removeEventListener('submit', submit);
      nameInput.removeEventListener('input', updateNamePreview); overlay.remove();
    },
  };
}
