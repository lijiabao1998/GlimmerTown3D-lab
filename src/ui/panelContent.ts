// D052: these generated panels contain text, rows and onclick buttons only.
// Update their content without detaching unchanged controls during a day tick:
// native focus, scroll and a pointer already held on a button must survive.
// This is deliberately not a form/input or general component reconciler.
const keyOf = (node: Node): string => node instanceof HTMLElement
  ? node.dataset.kind ? `${node.dataset.kind}:${node.dataset.k ?? ''}` : node.dataset.route ? `route:${node.dataset.route}` : ''
  : '';
const compatible = (a: Node, b: Node) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && keyOf(a) === keyOf(b);

export function updatePanelContent(parent: Element, ...next: Node[]): void {
  const previous = Array.from(parent.childNodes), kept = new Set<Node>();
  next.forEach((fresh, index) => {
    const key = keyOf(fresh), old = key
      ? previous.find(n => !kept.has(n) && compatible(n, fresh))
      : previous[index] && !kept.has(previous[index]) && compatible(previous[index], fresh) ? previous[index] : undefined;
    const node = old ?? fresh;
    kept.add(node);
    if (parent.childNodes[index] !== node) {
      const reference = parent.childNodes[index] ?? null;
      if (old && node.parentNode === parent && typeof parent.moveBefore === 'function') {
        // A retained commission offer can change position after a promotion.
        // Atomic moves preserve native focus/pointer state; insertBefore detaches.
        parent.moveBefore(node, reference);
      } else {
        const active = parent.ownerDocument.activeElement, top = parent.scrollTop, left = parent.scrollLeft;
        const restoreFocus = old instanceof HTMLElement && active instanceof HTMLElement && old.contains(active);
        parent.insertBefore(node, reference);
        // Older engines can restore focus/scroll, but cannot emulate an atomic
        // move's pointer capture. Never synthesize a click to repair that limit.
        if (restoreFocus) active.focus({ preventScroll: true });
        parent.scrollTop = top; parent.scrollLeft = left;
      }
    }
    if (!old) return;
    if (old instanceof HTMLElement && fresh instanceof HTMLElement) {
      for (const attr of Array.from(old.attributes)) if (!fresh.hasAttribute(attr.name)) old.removeAttribute(attr.name);
      for (const attr of Array.from(fresh.attributes)) if (old.getAttribute(attr.name) !== attr.value) old.setAttribute(attr.name, attr.value);
      old.onclick = fresh.onclick;
      updatePanelContent(old, ...Array.from(fresh.childNodes));
    } else if (old.nodeValue !== fresh.nodeValue) old.nodeValue = fresh.nodeValue;
  });
  for (const old of previous) if (!kept.has(old)) old.remove();
}
