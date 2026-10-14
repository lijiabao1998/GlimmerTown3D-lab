// D053: a held canvas pointer can release after a menu appears underneath it.
// Chrome may send that native click to the new button. Preserve its origin until
// the native click has passed, and reject only that cross-surface activation.
// Keyboard clicks and fresh presses on controls remain untouched. No fake clicks.
export function createMapClickGuard(canvas: EventTarget, defer: (run: () => void) => void = run => { setTimeout(run, 0); }) {
  const origins = new Map<number, object>();
  return {
    down(e: PointerEvent) {
      origins.delete(e.pointerId);
      if (e.target === canvas && e.button === 0) origins.set(e.pointerId, {});
    },
    up(e: PointerEvent) {
      const origin = origins.get(e.pointerId);
      if (origin) defer(() => { if (origins.get(e.pointerId) === origin) origins.delete(e.pointerId); });
    },
    cancel(e: PointerEvent) { origins.delete(e.pointerId); },
    click(e: MouseEvent) {
      const id = (e as PointerEvent).pointerId, fromMap = origins.has(id);
      origins.delete(id);
      if (fromMap && e.target !== canvas) { e.preventDefault(); e.stopPropagation(); }
    },
    clear() { origins.clear(); },
  };
}
