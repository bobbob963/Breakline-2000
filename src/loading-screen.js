// Progress represents completed startup stages, not downloaded bytes.
export function createLoadingScreen(doc = document) {
  const get = id => doc.getElementById(id);
  const screen = get('loading'), app = get('app');
  let failed = false;
  function set(value, status, detail) {
    if (failed) return;
    get('loading-fill').style.width = `${value}%`;
    get('loading-bar').setAttribute('aria-valuenow', String(value));
    get('loading-bar').setAttribute('aria-valuetext', status);
    get('loading-percent').textContent = `${value}%`;
    get('loading-status').textContent = status;
    get('loading-detail').textContent = detail;
  }
  return {
    set,
    async finish() {
      if (failed) return false;
      set(100, 'READY TO RIDE', 'Coast, factory and crew ready.');
      await new Promise(resolve => setTimeout(resolve, 260));
      if (failed || screen.classList.contains('has-error')) return false;
      app.setAttribute('aria-busy', 'false');
      screen.classList.add('is-leaving');
      await new Promise(resolve => setTimeout(resolve, 180));
      if (failed || screen.classList.contains('has-error')) return false;
      app.removeAttribute('inert');
      screen.hidden = true;
      doc.dispatchEvent(new Event('breakline-ready'));
      return true;
    },
    fail() {
      failed = true;
      app.setAttribute('inert', '');
      app.setAttribute('aria-busy', 'true');
      screen.hidden = false;
      screen.classList.remove('is-leaving');
      screen.classList.add('has-error');
      get('loading-status').textContent = 'COULD NOT LOAD THE SESSION';
      get('loading-detail').textContent = 'Try reloading. If it keeps happening, check WebGL 2 and hardware acceleration in your browser.';
      get('loading-percent').textContent = 'STOPPED';
      get('loading-retry').hidden = false;
      get('loading-retry').focus();
    },
  };
}

// Give the overlay a painted frame before synchronous scene/texture work.
// The timeout also lets a background tab finish starting when RAF is suspended.
export function paintLoadingStage() {
  return new Promise(resolve => {
    const fallback = setTimeout(resolve, 100);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      clearTimeout(fallback);
      resolve();
    }));
  });
}
