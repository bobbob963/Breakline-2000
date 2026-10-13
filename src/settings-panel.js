import './settings.css';
import { sanitizePlayerSettings } from './player-settings.js';
import { KEY_BINDING_ACTIONS, sanitizeKeybinds, keyLabel, rebindKey, validateBindingCode } from './key-bindings.js';
import { RIDER_NAME_LIMIT, sanitizeRiderName } from './rider-identity.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const SECTIONS = Object.freeze([
  { id: 'display', label: 'GRAPHICS + CAMERA', title: 'YOUR POINT OF VIEW', description: 'Dial in the picture and the way you follow your rider.' },
  { id: 'audio', label: 'AUDIO', title: 'SET THE LEVELS', description: 'Keep the radio and the sound of your ride in balance.' },
  { id: 'rider', label: 'RIDER NAME', title: 'MAKE YOUR NAME', description: 'This name appears above your surfer in the lobby.' },
  { id: 'keys', label: 'KEYBINDS', title: 'MAKE IT YOURS', description: 'Select an action, then press the key you want to use.' },
  { id: 'progress', label: 'PROGRESS', title: 'A FRESH RUN', description: 'Start the climb again whenever you want.' },
]);

function rangeControl(key, label, min, max, step, detail) {
  return `<label class="settings-range" for="settings-${key}"><span><strong>${label}</strong><output data-settings-output="${key}"></output></span><input type="range" id="settings-${key}" data-setting="${key}" min="${min}" max="${max}" step="${step}"><small>${detail}</small></label>`;
}

/** A draft-only modal: settings are applied only by Save; resetting progress is separately confirmed. */
export function createSettingsPanel({ getState = () => ({}), onApply = () => {}, onResetProgress = () => {}, onClose = () => {} } = {}) {
  const overlay = document.createElement('div');
  overlay.id = 'player-settings';
  overlay.className = 'settings-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" aria-describedby="settings-description" tabindex="-1">
    <header class="settings-header"><div><span>BREAKLINE '99 / OPTIONS</span><h2>RIDER SETUP<span>99</span></h2></div><button type="button" data-settings-action="close" class="settings-close" aria-label="Close settings">×</button></header>
    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Settings sections">${SECTIONS.map((section, index) => `<button type="button" data-settings-section="${section.id}" aria-controls="settings-section-${section.id}"><span>${String(index + 1).padStart(2, '0')}</span>${section.label}<b aria-hidden="true">↗</b></button>`).join('')}<div class="settings-nav-stamp">SALT / SPEED / STYLE<br><span>YOUR RIDE. YOUR RULES.</span></div></nav>
      <div class="settings-content"><div class="settings-scroll"><p class="settings-kicker" id="settings-section-number"></p><h3 id="settings-title" tabindex="-1"></h3><p class="settings-description" id="settings-description"></p>
        <section id="settings-section-display" data-settings-page="display" aria-labelledby="settings-title">
          <fieldset class="settings-fieldset"><legend>GRAPHICS</legend><div class="settings-choice-grid settings-quality">
            <label><input type="radio" name="settings-quality" data-setting="quality" value="retro"><span><b>RETRO</b><small>Original pixel texture. Lighter on your system.</small><i class="settings-pixel-preview" aria-hidden="true"></i></span></label>
            <label><input type="radio" name="settings-quality" data-setting="quality" value="clean"><span><b>CLEAN</b><small>Sharper rendering. The same low-poly world.</small><i class="settings-clean-preview" aria-hidden="true"></i></span></label>
          </div></fieldset>
          <fieldset class="settings-fieldset"><legend>CAMERA DISTANCE</legend><div class="settings-choice-grid settings-camera">${[['classic', 'CLASSIC', 'The original chase view.'], ['close', 'CLOSE', 'Right behind the action.'], ['wide', 'WIDE', 'More of the route ahead.']].map(([value, title, detail]) => `<label><input type="radio" name="settings-camera" data-setting="camera" value="${value}"><span><b>${title}</b><small>${detail}</small></span></label>`).join('')}</div></fieldset>
          <div class="settings-sliders">${rangeControl('cameraHeight', 'Camera height', -1, 3, .1, 'Lower for speed. Higher to read the terrain.')}${rangeControl('cameraFov', 'Field of view', 50, 90, 1, 'A wider view makes speed feel more dramatic.')}</div>
          <label class="settings-toggle"><input type="checkbox" data-setting="cameraShake"><span><strong>CAMERA SHAKE</strong><small>Impact and speed movement during your ride.</small></span><i aria-hidden="true"></i></label>
        </section>
        <section id="settings-section-audio" data-settings-page="audio" aria-labelledby="settings-title" hidden><div class="settings-audio-mark" aria-hidden="true"><span>RIPTIDE</span><b>RADIO '99</b><i></i></div>${rangeControl('musicVolume', 'Music volume', 0, 100, 1, 'Every station, from sunset surf to rival races.')}${rangeControl('effectsVolume', 'Sound effects', 0, 100, 1, 'Pops, tricks, landings and wipeouts.')}<p class="settings-note">The radio's sound button still mutes everything. These levels return when sound is switched on.</p></section>
        <section id="settings-section-rider" data-settings-page="rider" aria-labelledby="settings-title" hidden><label class="settings-name-label" for="settings-rider-name">RIDER NAME</label><input id="settings-rider-name" class="settings-name-input" type="text" autocomplete="nickname" spellcheck="false" aria-describedby="settings-name-note settings-status"><p class="settings-note" id="settings-name-note">Up to ${RIDER_NAME_LIMIT} characters. Change it any time.</p><div class="settings-name-tag"><small>YOUR LOBBY NAMETAG</small><strong id="settings-name-preview"></strong><i></i></div></section>
        <section id="settings-section-keys" data-settings-page="keys" aria-labelledby="settings-title" hidden><div class="settings-keys-top"><p>Keys already in use swap places. Escape cancels a key change.</p><button type="button" data-settings-action="reset-keys" class="settings-text-button">RESTORE DEFAULT KEYS</button></div><div class="settings-keybind-list">${KEY_BINDING_ACTIONS.map(action => `<div class="settings-keybind"><span><strong>${escapeHTML(action.label)}</strong><small>${escapeHTML(action.description || '')}</small></span><button type="button" data-settings-bind="${escapeHTML(action.id)}" aria-label="Change ${escapeHTML(action.label)} key"></button></div>`).join('')}</div><p class="settings-note">Tab and Escape stay available for menus. Ctrl, Alt, Windows and browser shortcuts cannot be assigned.</p></section>
        <section id="settings-section-progress" data-settings-page="progress" aria-labelledby="settings-title" hidden><div class="settings-reset-card"><span class="settings-reset-symbol" aria-hidden="true">↻</span><h4>RESET GAME PROGRESS</h4><p>Clear scores, rival ladders, Time Trials and earned boards, styles and outfits.</p><p>Your rider name, tutorial completion, settings and keybinds stay saved.</p><button type="button" data-settings-action="request-reset" class="settings-danger">RESET PROGRESS…</button><div class="settings-reset-confirm" hidden><strong>START FROM THE BEGINNING?</strong><p>This cannot be undone. Your earned rewards and records will be removed.</p><div><button type="button" data-settings-action="confirm-reset" class="settings-danger">YES, RESET PROGRESS</button><button type="button" data-settings-action="cancel-reset" class="settings-secondary">KEEP MY PROGRESS</button></div></div></div></section>
      </div><div class="settings-status" id="settings-status" role="status" aria-live="polite"></div></div>
    </div><footer class="settings-footer"><button type="button" data-settings-action="defaults" class="settings-text-button">RESTORE DEFAULT SETTINGS</button><span>ESC <b>CANCEL</b></span><div><button type="button" data-settings-action="close" class="settings-secondary">CANCEL</button><button type="button" data-settings-action="save" class="settings-primary">SAVE CHANGES <b>▶</b></button></div></footer>
  </section>`;
  document.body.append(overlay);
  const query = selector => overlay.querySelector(selector);
  const dialog = query('.settings-dialog'), nameInput = query('#settings-rider-name'), app = document.getElementById('app'), win = document.defaultView;
  let open = false, disposed = false, busy = false, draft = sanitizePlayerSettings(null), sectionId = 'display', rebinding = null, previousFocus = null, appWasInert = false, generation = 0;

  function status(message = '', error = false) {
    query('#settings-status').textContent = message;
    query('#settings-status').classList.toggle('is-error', error);
  }
  function output(key) {
    const value = draft[key];
    if (key === 'cameraHeight') return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
    if (key === 'cameraFov') return `${Math.round(value)}°`;
    return `${Math.round(value)}%`;
  }
  function renderKeys() {
    for (const button of overlay.querySelectorAll('[data-settings-bind]')) {
      const active = rebinding === button.dataset.settingsBind;
      button.textContent = active ? 'PRESS A KEY…' : keyLabel(draft.keybinds[button.dataset.settingsBind]);
      button.classList.toggle('is-listening', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  function updateName() {
    if (Array.from(nameInput.value).length > RIDER_NAME_LIMIT) nameInput.value = Array.from(nameInput.value).slice(0, RIDER_NAME_LIMIT).join('');
    query('#settings-name-preview').textContent = sanitizeRiderName(nameInput.value) || 'YOUR NAME';
    nameInput.removeAttribute('aria-invalid');
  }
  function renderValues() {
    for (const input of overlay.querySelectorAll('[data-setting]')) {
      const key = input.dataset.setting;
      if (input.type === 'radio') input.checked = draft[key] === input.value;
      else if (input.type === 'checkbox') input.checked = draft[key];
      else input.value = String(draft[key]);
    }
    for (const element of overlay.querySelectorAll('[data-settings-output]')) element.textContent = output(element.dataset.settingsOutput);
    renderKeys(); updateName();
  }
  function clearReset() {
    query('.settings-reset-confirm').hidden = true;
    query('[data-settings-action="request-reset"]').hidden = false;
  }
  function showSection(id, focus = true) {
    const index = SECTIONS.findIndex(section => section.id === id);
    if (index < 0) return;
    rebinding = null; sectionId = id; renderKeys(); clearReset(); status();
    const section = SECTIONS[index];
    query('#settings-title').textContent = section.title;
    query('#settings-description').textContent = section.description;
    query('#settings-section-number').textContent = `${String(index + 1).padStart(2, '0')} / ${section.label}`;
    for (const page of overlay.querySelectorAll('[data-settings-page]')) page.hidden = page.dataset.settingsPage !== id;
    for (const button of overlay.querySelectorAll('[data-settings-section]')) {
      if (button.dataset.settingsSection === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    query('.settings-scroll').scrollTop = 0;
    if (focus) query('#settings-title').focus({ preventScroll: true });
  }
  function close(force = false) {
    if (!open || (busy && !force)) return false;
    generation++; open = false; busy = false; rebinding = null; overlay.hidden = true; overlay.removeAttribute('aria-busy');
    if (!appWasInert) app?.removeAttribute('inert');
    if (previousFocus?.isConnected && !previousFocus.closest?.('[inert]')) previousFocus.focus({ preventScroll: true });
    previousFocus = null; onClose(); return true;
  }
  async function transaction(action, message, success) {
    if (!open || busy) return false;
    busy = true; rebinding = null; renderKeys(); overlay.setAttribute('aria-busy', 'true');
    const current = generation, controls = [...overlay.querySelectorAll('button,input')];
    controls.forEach(element => { element.disabled = true; }); status(message);
    let done = false;
    try { await action(); done = true; }
    catch (error) { if (open && !disposed && generation === current) status(error?.message || 'Could not save. Please try again.', true); }
    finally {
      if (!disposed && generation === current) {
        busy = false; overlay.removeAttribute('aria-busy'); controls.forEach(element => { element.disabled = false; });
        if (done) success();
      }
    }
    return done;
  }
  function save() {
    const name = sanitizeRiderName(nameInput.value);
    if (!name) {
      showSection('rider', false); nameInput.setAttribute('aria-invalid', 'true'); status('Enter a rider name before saving.', true); nameInput.focus(); return;
    }
    nameInput.value = name;
    return transaction(() => onApply(sanitizePlayerSettings(draft), { name }), 'Saving your setup…', () => close());
  }
  function handleInput(event) {
    if (!open || busy) return;
    if (event.target === nameInput) { updateName(); return; }
    const input = event.target.closest('[data-setting]');
    if (!input || (input.type === 'radio' && !input.checked)) return;
    const key = input.dataset.setting;
    draft[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
    draft = sanitizePlayerSettings(draft);
    const valueOutput = query(`[data-settings-output="${key}"]`);
    if (valueOutput) valueOutput.textContent = output(key);
    status('Unsaved changes. Select Save Changes to apply.');
  }
  function handleClick(event) {
    if (!open || busy) return;
    const section = event.target.closest('[data-settings-section]');
    if (section) { showSection(section.dataset.settingsSection); return; }
    const binding = event.target.closest('[data-settings-bind]');
    if (binding) {
      rebinding = rebinding === binding.dataset.settingsBind ? null : binding.dataset.settingsBind;
      renderKeys(); status(rebinding ? 'Press a new key. Escape cancels. An occupied key swaps the two actions.' : 'Key change cancelled.'); return;
    }
    const action = event.target.closest('[data-settings-action]')?.dataset.settingsAction;
    if (action === 'close') close();
    else if (action === 'save') save();
    else if (action === 'defaults') { draft = sanitizePlayerSettings(null); rebinding = null; renderValues(); status('Default settings restored in this draft. Save Changes to keep them.'); }
    else if (action === 'reset-keys') { draft.keybinds = sanitizeKeybinds(null); rebinding = null; renderKeys(); status('Default keys restored in this draft. Save Changes to keep them.'); }
    else if (action === 'request-reset') { query('.settings-reset-confirm').hidden = false; query('[data-settings-action="request-reset"]').hidden = true; query('[data-settings-action="cancel-reset"]').focus(); }
    else if (action === 'cancel-reset') { clearReset(); query('[data-settings-action="request-reset"]').focus(); }
    else if (action === 'confirm-reset' && !query('.settings-reset-confirm').hidden) {
      transaction(onResetProgress, 'Resetting your progress…', () => { clearReset(); status('Progress reset. Your name and preferences are unchanged.'); query('[data-settings-action="request-reset"]').focus(); });
    }
  }
  function focusable() {
    return [...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(element => !element.hidden && !element.closest('[hidden]'));
  }
  function captureKey(event) {
    if (!open) return;
    // Settings own both keydown and keyup so a new binding never performs a game action.
    event.stopImmediatePropagation();
    if (event.type !== 'keydown') return;
    if (busy) { event.preventDefault(); return; }
    if (rebinding) {
      event.preventDefault();
      if (event.repeat) return;
      if (event.key === 'Escape') { rebinding = null; renderKeys(); status('Key change cancelled.'); return; }
      if (event.ctrlKey || event.altKey || event.metaKey || !validateBindingCode(event.code)) { status('That key is reserved for menus or your browser. Choose another key.', true); return; }
      const action = rebinding, previous = draft.keybinds[action], next = rebindKey(draft.keybinds, action, event.code);
      if (next[action] === previous && event.code !== previous) { status('That key is reserved. Choose another key.', true); return; }
      const swapped = KEY_BINDING_ACTIONS.find(item => item.id !== action && draft.keybinds[item.id] !== next[item.id]);
      draft.keybinds = next; rebinding = null; renderKeys();
      status(`${keyLabel(next[action])} assigned.${swapped ? ` Swapped with ${swapped.label}.` : ''} Save Changes to keep it.`); return;
    }
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') {
      const elements = focusable(), first = elements[0] || dialog, last = elements.at(-1) || dialog, inside = elements.includes(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (!inside || document.activeElement === last)) { event.preventDefault(); first.focus(); }
    }
  }
  function keepFocus(event) { if (open && !overlay.contains(event.target)) dialog.focus({ preventScroll: true }); }
  overlay.addEventListener('input', handleInput);
  overlay.addEventListener('change', handleInput);
  overlay.addEventListener('click', handleClick);
  win?.addEventListener('keydown', captureKey, true); win?.addEventListener('keyup', captureKey, true);
  document.addEventListener('focusin', keepFocus, true);
  return {
    get isOpen() { return open; },
    open() {
      if (disposed || open) return false;
      const state = getState() || {};
      draft = sanitizePlayerSettings(state.settings); nameInput.value = sanitizeRiderName(state.name); nameInput.removeAttribute('aria-invalid');
      previousFocus = document.activeElement; appWasInert = app?.hasAttribute('inert') || false;
      open = true; busy = false; rebinding = null; generation++; overlay.hidden = false; app?.setAttribute('inert', '');
      overlay.querySelectorAll('button,input').forEach(element => { element.disabled = false; });
      renderValues(); showSection('display'); return true;
    },
    close: () => close(),
    dispose() {
      if (disposed) return;
      close(true); disposed = true;
      overlay.removeEventListener('input', handleInput); overlay.removeEventListener('change', handleInput); overlay.removeEventListener('click', handleClick);
      win?.removeEventListener('keydown', captureKey, true); win?.removeEventListener('keyup', captureKey, true); document.removeEventListener('focusin', keepFocus, true);
      overlay.remove();
    },
  };
}
