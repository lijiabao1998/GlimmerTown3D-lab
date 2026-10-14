// A stable DOM node can still lose its native click when its rectangle moves
// between touch-down and click (Chrome 154, D052 promotion fixture). Keep the
// whole panel presentation stationary through the existing activation handler.
// Simulation, action validation, HUD and saving continue on their normal paths.
export function createPanelUpdateGate(panel: HTMLElement) {
  const doc = panel.ownerDocument, win = doc.defaultView!;
  const presses = new Map<number, boolean>(); // false = held, true = released
  let pending: (() => void) | null = null, generation = 0, timer: number | null = null;
  const stopTimer = () => { if (timer !== null) win.clearTimeout(timer); timer = null; };
  const flush = () => {
    if (presses.size) return;
    const render = pending; pending = null;
    if (!panel.hidden) render?.();
  };
  const cancel = () => { generation++; stopTimer(); presses.clear(); pending = null; };
  const abandon = () => { generation++; stopTimer(); presses.clear(); flush(); };
  const releaseFallback = () => {
    stopTimer(); const expected = generation;
    // Normal activation flushes in click bubble below. A task recovers releases
    // with no click in the tested Chrome path; it must never unlock a newer press.
    timer = win.setTimeout(() => {
      if (expected !== generation) return; timer = null;
      for (const [id, released] of presses) if (released) presses.delete(id);
      flush();
    }, 0);
  };
  panel.addEventListener('pointerdown', event => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button');
    if (panel.hidden || !button || button.disabled || !panel.contains(button) || event.button !== 0) return;
    generation++; stopTimer(); presses.set(event.pointerId, false);
  }, true);
  doc.addEventListener('pointerup', event => {
    if (!presses.has(event.pointerId)) return;
    generation++; presses.set(event.pointerId, true); releaseFallback();
  }, true);
  doc.addEventListener('pointercancel', event => {
    if (!presses.delete(event.pointerId)) return;
    generation++; releaseFallback();
  }, true);
  doc.addEventListener('click', event => {
    const id = (event as PointerEvent).pointerId;
    if (typeof id === 'number' && presses.has(id)) presses.delete(id);
    else for (const [pointer, released] of presses) if (released) presses.delete(pointer);
    if (!presses.size) { generation++; stopTimer(); flush(); }
  }); // bubble: the original button onclick has already validated/applied its action
  win.addEventListener('blur', abandon);
  win.addEventListener('pagehide', abandon);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) abandon(); });
  return {
    defer(renderLatest: () => void) {
      if (panel.hidden) { cancel(); return false; }
      if (!presses.size) return false;
      pending = renderLatest; return true;
    },
    cancel,
  };
}
