export const CONTROL_KEYS = Object.freeze({ KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right', KeyW:'pump', ArrowUp:'pump', KeyS:'brake', ArrowDown:'brake', Space:'jump', KeyE:'action', ShiftLeft:'grind', ShiftRight:'grind' });
export const TRICK_KEYS = Object.freeze({ KeyJ:'spin', KeyK:'flip', KeyL:'grab', KeyU:'shuvit', KeyO:'heelflip', KeyH:'method', KeyF:'spin360', KeyI:'special', KeyB:'tweak' });

// The browser and regression tests share this router. Actual trick eligibility
// stays with tryTrick/game.doTrick; every mode receives the same aerial keys.
export function createKeydownHandler(getState, actions) {
  return e => {
    const { bootReady, workshopMode, modalMode, game, input } = getState();
    if (!bootReady) return;
    // Let the focused menu button receive its native Enter click. Otherwise
    // Enter on RESET THIS LADDER would start a race before the button fires.
    if (e.code === 'Enter' && !workshopMode && e.target?.closest?.('button')) return;
    if (CONTROL_KEYS[e.code] || TRICK_KEYS[e.code] || ['Enter','Escape','KeyP','KeyR','KeyM','KeyC'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyM') { actions.toggleSound(); return; }
    if (workshopMode) {
      if (e.code === 'Escape' && actions.isWardrobeOpen()) actions.hideWardrobe();
      else if (['Escape','Enter','KeyA','KeyB'].includes(e.code)) actions.closeWorkshop();
      else if (e.code === 'ArrowLeft' && workshopMode === 'character') actions.cycleCharacter(-1);
      else if (e.code === 'ArrowRight' && workshopMode === 'character') actions.cycleCharacter(1);
      else if (e.code === 'KeyX') actions.rotatePreview(-.5);
      else if (e.code === 'KeyC') actions.rotatePreview(.5);
      return;
    }
    if (e.code === 'Enter') {
      if (['results','ladder','trials'].includes(modalMode)) actions.startRun();
      else if (modalMode) actions.closeModal();
      else if (game.phase === 'ready' || game.phase === 'finished') actions.startRun();
      else game.bank();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') { actions.pause(); return; }
    if (e.code === 'KeyR' && game.phase !== 'ready') { (actions.restartRun || actions.startRun)(); return; }
    if (game.phase !== 'running' || modalMode) return;
    if (e.code === 'KeyC' && game.doCutback) {
      if (!game.doCutback(input.left ? -1 : input.right ? 1 : 0)) actions.toast(game.airborne ? 'LAND BEFORE CUTTING BACK' : 'BUILD SPEED · C TO CUTBACK');
      return;
    }
    if (CONTROL_KEYS[e.code]) actions.pressControl(e.code);
    if (TRICK_KEYS[e.code]) actions.tryTrick(TRICK_KEYS[e.code]);
  };
}
