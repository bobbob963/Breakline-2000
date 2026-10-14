export function createScrollCue(scroller, button) {
  let frame = 0;
  const update = () => {
    frame = 0;
    button.hidden = scroller.clientHeight === 0 ||
      scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 8;
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const scroll = () => scroller.scrollBy({
    top: Math.max(120, scroller.clientHeight * .7),
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  const resize = new ResizeObserver(schedule);
  resize.observe(scroller);
  for (const child of scroller.children) resize.observe(child);
  const content = new MutationObserver(schedule);
  content.observe(scroller, { childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'hidden'] });
  scroller.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  button.addEventListener('click', scroll);
  schedule();
  return { dispose() {
    cancelAnimationFrame(frame);
    resize.disconnect(); content.disconnect();
    scroller.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    button.removeEventListener('click', scroll);
  } };
}
