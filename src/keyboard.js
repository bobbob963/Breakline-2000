import { getControlMap, getTrickMap, keyLabel, sanitizeKeybinds } from './key-bindings.js';
export const CONTROL_KEYS = Object.freeze(getControlMap());
export const TRICK_KEYS = Object.freeze(getTrickMap());

const ADMIN_SEQUENCE = Object.freeze(['ArrowLeft','ArrowLeft','ArrowRight','ArrowUp']);
const EDITABLE_TARGETS = 'input,textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]';

// The browser and regression tests share this router. Actual trick eligibility
// stays with tryTrick/game.doTrick; every mode receives the same aerial keys.
export function createKeydownHandler(getState, actions) {
  let adminSequence = [], lastAdminPress = null;
  const resetAdminSequence = () => { adminSequence = []; lastAdminPress = null; };
  const handler = e => {
    const { bootReady, workshopMode, modalMode, game, input, homeScreen, adminOpen, settingsOpen, keybinds } = getState();
    const home = homeScreen === true && !workshopMode && !modalMode && !adminOpen && !settingsOpen;
    // Native form editing must never steer a rider, start a session or open a
    // secret menu. Escape in the admin panel belongs to that panel's listener.
    if (!bootReady || adminOpen || settingsOpen || e.ctrlKey || e.altKey || e.metaKey || e.target?.isContentEditable || e.target?.closest?.(EDITABLE_TARGETS)) {
      resetAdminSequence();
      return;
    }
    if (!home) resetAdminSequence();
    if (home && !e.repeat) {
      const now = Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now();
      if (lastAdminPress !== null && (now - lastAdminPress > 2000 || now < lastAdminPress)) resetAdminSequence();
      adminSequence.push(e.code);
      // Retain any matching suffix, so Left Left Left Right Up still uses the
      // final two Left presses. An unrelated key cancels the pending sequence.
      while (adminSequence.length && !adminSequence.every((key,index) => key === ADMIN_SEQUENCE[index])) adminSequence.shift();
      lastAdminPress = adminSequence.length ? now : null;
      if (adminSequence.length === ADMIN_SEQUENCE.length) {
        resetAdminSequence();
        e.preventDefault();
        actions.openAdmin?.();
        return;
      }
    }
    if (home && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) {
      e.preventDefault();
      return;
    }
    // Focused buttons own native Enter/Space activation. Settings, pause and
    // outfit buttons must never charge a pop instead of receiving a click.
    if (['Enter','Space'].includes(e.code) && e.target?.closest?.('button')) return;
    const bindings=sanitizeKeybinds(keybinds),controls=getControlMap(bindings),tricks=getTrickMap(bindings);
    if (controls[e.code] || tricks[e.code] || Object.values(bindings).includes(e.code) || ['Enter','Escape'].includes(e.code) || (workshopMode&&['KeyA','KeyB','KeyX','KeyC'].includes(e.code))) e.preventDefault();
    if (e.repeat) return;
    if (workshopMode) {
      if (e.code === 'Escape' && actions.isWardrobeOpen()) actions.hideWardrobe();
      else if (['Escape','Enter','KeyA','KeyB'].includes(e.code)) actions.closeWorkshop();
      else if (e.code === 'ArrowLeft' && workshopMode === 'character') actions.cycleCharacter(-1);
      else if (e.code === 'ArrowRight' && workshopMode === 'character') actions.cycleCharacter(1);
      else if (e.code === 'KeyX') actions.rotatePreview(-.5);
      else if (e.code === 'KeyC') actions.rotatePreview(.5);
      else if (e.code === bindings.sound) actions.toggleSound();
      return;
    }
    if (e.code === 'Enter') {
      if (['results','ladder','trials'].includes(modalMode)) {actions.startRun();return;}
      if (modalMode) {actions.closeModal();return;}
      if (game.phase === 'ready' || game.phase === 'finished') {actions.startRun();return;}
    }
    if(e.code===bindings.sound){actions.toggleSound();return;}
    if (e.code === 'Escape' || e.code === bindings.pause) { actions.pause(); return; }
    if (e.code === bindings.restart && game.phase !== 'ready') { (actions.restartRun || actions.startRun)(); return; }
    if (game.phase !== 'running' || modalMode) return;
    if(e.code===bindings.bank){game.bank();return;}
    if (e.code === bindings.timePower) {
      if (!home) {
        if (actions.pressTimePower) actions.pressTimePower(e.timeStamp);
        else game.toggleTimePower?.();
      }
      return;
    }
    if (e.code === bindings.cutback && game.doCutback) {
      if (!game.doCutback(input.left ? -1 : input.right ? 1 : 0)) actions.toast(game.airborne ? 'LAND BEFORE CUTTING BACK' : `BUILD SPEED · ${keyLabel(bindings.cutback)} TO CUTBACK`);
      return;
    }
    if (controls[e.code]) actions.pressControl(e.code);
    if (tricks[e.code]) actions.tryTrick(tricks[e.code]);
  };
  handler.resetAdminSequence = resetAdminSequence;
  handler.cancelPendingPower = () => actions.cancelPowerInput?.();
  return handler;
}
