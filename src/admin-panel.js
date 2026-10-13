import './admin-panel.css';
import { CHARACTERS } from './appearance.js';
import { getRewardBoard } from './board-rewards.js';
import { ADMIN_CHARACTER_FIELDS, ADMIN_BOARD_FIELDS, ADMIN_SURF_WEATHER_OPTIONS, getAdminScope, updateAdminScope, resetAdminScope, sanitizeAdminSettings } from './admin-settings.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const fieldsByScope = { character: ADMIN_CHARACTER_FIELDS, board: ADMIN_BOARD_FIELDS };

function fieldMarkup(field, scope, value) {
  const id = `admin-${scope}-${field.key}`;
  return `<div class="admin-stat">
    <label for="${id}">${escapeHTML(field.label)} <small>${escapeHTML(field.unit || '')}</small></label>
    <div class="admin-stat-controls">
      <input id="${id}-slider" type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-admin-scope="${scope}" data-admin-key="${field.key}" aria-label="${escapeHTML(field.label)} slider" aria-describedby="${id}-description">
      <input id="${id}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-admin-scope="${scope}" data-admin-key="${field.key}" aria-describedby="${id}-description" required>
    </div>
    <p id="${id}-description">${escapeHTML(field.description || '')}</p>
  </div>`;
}

/** The panel owns an unsaved draft; only Apply changes riding stats and conditions. */
export function createAdminPanel({ getState, onApply, onGiveEverything, onFullReset, onTutorial = () => {}, onClose = () => {} }) {
  const overlay = document.createElement('div');
  overlay.id = 'admin-panel';
  overlay.className = 'admin-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<section class="admin-card" role="dialog" aria-modal="true" aria-labelledby="admin-title" aria-describedby="admin-description" tabindex="-1">
    <header class="admin-heading">
      <div><p class="admin-kicker">BREAKLINE '99 / SECRET MENU</p><h2 id="admin-title">ADMIN / RIDE TUNING</h2></div>
      <button type="button" data-admin-action="close" class="admin-close" aria-label="Close admin panel">×</button>
    </header>
    <form class="admin-form">
      <div class="admin-scroll">
        <div class="admin-intro">
          <p id="admin-description">Build your own setup. Stats are saved separately for each rider and board.</p>
          <label class="admin-enabled"><input type="checkbox" id="admin-enabled"> <span>ENABLE CUSTOM STATS</span></label>
          <p class="admin-enabled-note">Switch this off to ride with the normal stats. Your custom values stay saved.</p>
        </div>
        <section class="admin-environment" aria-labelledby="admin-environment-title">
          <div><h3 id="admin-environment-title">SESSION CONDITIONS</h3><label for="admin-surf-weather">Surf Session weather / time</label></div>
          <select id="admin-surf-weather" aria-describedby="admin-surf-weather-description">${ADMIN_SURF_WEATHER_OPTIONS.map(option => `<option value="${option.value}">${escapeHTML(option.label)}</option>`).join('')}</select>
          <p id="admin-surf-weather-description">Choose the sky and time of day for Surf Session. Random picks a different calm sky each session. Sunset includes its chilled soundtrack. This works with custom stats switched off. Survival always stays stormy.</p>
        </section>
        <section class="admin-cheats" aria-labelledby="admin-cheats-title">
          <div><h3 id="admin-cheats-title">CHEATS</h3><label class="admin-enabled"><input type="checkbox" id="admin-slow-motion" aria-describedby="admin-slow-motion-description"> <span>SLOW MOTION / Q</span></label></div>
          <p id="admin-slow-motion-description">Use slow motion with any board, even with custom stats switched off. Press Q to toggle a 6-second charge. Use the full charge for +50% speed for 3 seconds. The charge returns after 12 seconds.</p>
        </section>
        <section class="admin-tutorial" aria-labelledby="admin-tutorial-title">
          <div><h3 id="admin-tutorial-title">RIDER GUIDE</h3><p id="admin-tutorial-description">Replay the tutorial and change your rider name. Keeps your progress and unlocks. Unapplied tuning changes will be discarded.</p></div>
          <button type="button" data-admin-action="tutorial" aria-describedby="admin-tutorial-description">SHOW TUTORIAL <span>▶</span></button>
        </section>
        <div class="admin-columns">
          <section class="admin-stat-section" aria-labelledby="admin-character-title"><div class="admin-section-heading"><span>01 / CHARACTER</span><h3 id="admin-character-title"></h3></div><div id="admin-character-fields"></div></section>
          <section class="admin-stat-section" aria-labelledby="admin-board-title"><div class="admin-section-heading"><span>02 / BOARD</span><h3 id="admin-board-title"></h3></div><div id="admin-board-fields"></div></section>
        </div>
        <div class="admin-default-row"><button type="button" data-admin-action="defaults" class="admin-text-button">RESTORE THIS RIDER + BOARD DEFAULTS</button><span>Apply to save these defaults.</span></div>
        <section class="admin-save-tools" aria-labelledby="admin-save-title">
          <div class="admin-section-heading"><span>03 / SAVE FILE</span><h3 id="admin-save-title">UNLOCKS + RESET</h3></div>
          <div class="admin-save-grid">
            <div><button type="button" data-admin-action="give" class="admin-unlock">GIVE ME EVERYTHING <span>↗</span></button><p>Unlock every ladder, Time Trial, outfit, board style and reward board.</p></div>
            <div><button type="button" data-admin-action="reset" class="admin-reset">FULL RESET <span>↺</span></button><p>Start fresh: erase game progress, saved scores, custom stats, session settings, rider name and tutorial completion.</p></div>
          </div>
          <div class="admin-reset-confirm" hidden role="group" aria-labelledby="admin-reset-title">
            <strong id="admin-reset-title">ERASE YOUR BREAKLINE SAVE?</strong>
            <p>This removes all game progress, unlocks, personal bests, custom stats, session settings, your rider name and tutorial completion from this browser. It cannot be undone.</p>
            <div><button type="button" data-admin-action="confirm-reset">YES, RESET EVERYTHING</button><button type="button" data-admin-action="cancel-reset">KEEP MY SAVE</button></div>
          </div>
        </section>
      </div>
      <footer class="admin-footer">
        <p class="admin-status" role="status" aria-live="polite">Change your setup, then apply to ride.</p>
        <div><button type="button" data-admin-action="close" class="admin-cancel">CANCEL</button><button type="submit" class="admin-apply">APPLY + CLOSE <span>▶</span></button></div>
      </footer>
    </form>
  </section>`;
  document.body.append(overlay);
  const query = selector => overlay.querySelector(selector);
  const form = query('form');
  let draft, profile, previousFocus, open = false, busy = false, disposed = false;

  function status(text, error = false) {
    const message = query('.admin-status');
    message.textContent = text;
    message.classList.toggle('is-error', error);
  }

  function renderFields() {
    const values = getAdminScope(draft, profile);
    for (const [scope, fields] of Object.entries(fieldsByScope)) {
      query(`#admin-${scope}-fields`).innerHTML = fields.map(field => fieldMarkup(field, scope, values[scope][field.key])).join('');
    }
    query('#admin-character-title').textContent = CHARACTERS[profile.character]?.name || 'YOUR RIDER';
    query('#admin-board-title').textContent = getRewardBoard(profile.rewardBoard)?.name || 'STANDARD BOARD';
    query('#admin-enabled').checked = draft.enabled;
    query('#admin-slow-motion').checked = draft.cheats.slowMotion;
    query('#admin-surf-weather').value = draft.environment.surfWeather;
    overlay.classList.toggle('admin-tuning-off', !draft.enabled);
  }

  function close() {
    if (!open || busy) return;
    open = false;
    overlay.hidden = true;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    onClose();
  }

  async function action(callback, success) {
    if (busy) return false;
    busy = true;
    overlay.setAttribute('aria-busy', 'true');
    const buttons = [...overlay.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      await callback();
      if (success) status(success);
      return true;
    } catch (error) {
      status(error?.message || 'Could not save this change. Please try again.', true);
      return false;
    } finally {
      busy = false;
      overlay.removeAttribute('aria-busy');
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function handleInput(event) {
    const input = event.target;
    if (input.id === 'admin-surf-weather') {
      draft = sanitizeAdminSettings({ ...draft, environment: { ...draft.environment, surfWeather: input.value } });
      status(draft.environment.surfWeather === 'random' ? 'Surf Session will choose a different calm sky each session after you apply.' : 'Your chosen sky and time of day will be used in Surf Session after you apply.');
      return;
    }
    if (input.id === 'admin-slow-motion') {
      draft = { ...draft, cheats: { ...draft.cheats, slowMotion: input.checked === true } };
      status(input.checked ? 'Slow motion will work with any board after you apply.' : 'The slow motion cheat will switch off after you apply.');
      return;
    }
    if (input.id === 'admin-enabled') {
      draft = { ...draft, enabled: input.checked };
      overlay.classList.toggle('admin-tuning-off', !input.checked);
      status(input.checked ? 'Custom stats will be active after you apply.' : 'Normal riding stats will be restored after you apply.');
      return;
    }
    const { adminScope: scope, adminKey: key } = input.dataset;
    const field = fieldsByScope[scope]?.find(item => item.key === key);
    if (!field || !input.validity.valid || input.value === '') return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    draft = updateAdminScope(draft, profile, scope, { [key]: value });
    const other = query(`#admin-${scope}-${key}${input.type === 'range' ? '' : '-slider'}`);
    other.value = value;
    status('Unsaved changes. Apply when your setup is ready.');
  }

  async function handleClick(event) {
    const button = event.target.closest('[data-admin-action]');
    if (!button || busy) return;
    const name = button.dataset.adminAction;
    if (name === 'close') close();
    if (name === 'tutorial') {
      close();
      onTutorial();
    }
    if (name === 'defaults') {
      draft = resetAdminScope(draft, profile);
      renderFields();
      status('Default values restored for this rider and board. Apply to save.');
    }
    if (name === 'give') await action(onGiveEverything, 'Everything unlocked! Your current tuning draft is still here.');
    if (name === 'reset') {
      query('.admin-reset-confirm').hidden = false;
      query('[data-admin-action="cancel-reset"]').focus({ preventScroll: true });
      query('.admin-reset-confirm').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (name === 'cancel-reset') {
      query('.admin-reset-confirm').hidden = true;
      query('[data-admin-action="reset"]').focus({ preventScroll: true });
    }
    if (name === 'confirm-reset' && await action(onFullReset)) close();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    // Capture autofill without turning untouched reward defaults into saved overrides.
    const current = getAdminScope(draft, profile);
    for (const input of overlay.querySelectorAll('input[type="number"]')) {
      if (Number(input.value) !== current[input.dataset.adminScope][input.dataset.adminKey]) handleInput({ target: input });
    }
    draft.enabled = query('#admin-enabled').checked;
    draft.cheats.slowMotion = query('#admin-slow-motion').checked === true;
    draft.environment.surfWeather = query('#admin-surf-weather').value;
    if (await action(() => onApply(sanitizeAdminSettings(draft)))) close();
  }

  function handleKeydown(event) {
    if (!open) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!query('.admin-reset-confirm').hidden) {
        query('.admin-reset-confirm').hidden = true;
        query('[data-admin-action="reset"]').focus({ preventScroll: true });
      } else close();
    }
    if (event.key === 'Tab') {
      const focusable = [...overlay.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(element => !element.closest('[hidden]'));
      const first = focusable[0], last = focusable.at(-1);
      if (!focusable.includes(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
  }

  overlay.addEventListener('input', handleInput);
  overlay.addEventListener('click', handleClick);
  overlay.addEventListener('keydown', handleKeydown);
  form.addEventListener('submit', handleSubmit);

  return {
    open() {
      if (open || disposed) return;
      const state = getState();
      draft = sanitizeAdminSettings(state.settings);
      profile = { ...state.profile };
      previousFocus = document.activeElement;
      renderFields();
      query('.admin-reset-confirm').hidden = true;
      status('Change your setup, then apply to ride.');
      open = true;
      overlay.hidden = false;
      query('.admin-scroll').scrollTop = 0;
      query('#admin-enabled').focus({ preventScroll: true });
    },
    close,
    get isOpen() { return open; },
    dispose() {
      busy = false;
      close();
      disposed = true;
      overlay.removeEventListener('input', handleInput);
      overlay.removeEventListener('click', handleClick);
      overlay.removeEventListener('keydown', handleKeydown);
      form.removeEventListener('submit', handleSubmit);
      overlay.remove();
    },
  };
}
