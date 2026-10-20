// A stable DOM node can still lose its native click when its rectangle moves
// between touch-down and click (Chrome 154, D052 promotion fixture). Keep the
// whole panel presentation stationary through the existing activation handler.
// Simulation, action validation, HUD and saving continue on their normal paths.
export function createPanelUpdateGate(panel: HTMLElement, retainCommissionOffers = false) {
// Layout is pinned only while an offer lease exists. Text remains live and
// overflowing regions are scrollable, rather than clipped or covered by clones.
function createCommissionGeometry(panel: HTMLElement) {
  type Saved = { element: HTMLElement; property: string; value: string; priority: string; desired: string };
  const saved: Saved[] = [], measured = new Set<HTMLElement>();
  let active = false;
  const put = (element: HTMLElement, property: string, value: string) => {
    saved.push({ element, property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property), desired: value });
    element.style.setProperty(property, value);
  };
  const pin = (elements: HTMLElement[], width: boolean) => {
    // Measure the whole batch before changing layout.
    const boxes = elements.filter(element => !measured.has(element)).map(element => ({ element, box: element.getBoundingClientRect() }));
    for (const { element, box } of boxes) {
      measured.add(element);
      put(element, 'box-sizing', 'border-box');
      put(element, 'height', `${box.height}px`);
      if (width) put(element, 'width', `${box.width}px`);
      put(element, 'overflow', 'auto');
      put(element, 'overflow-anchor', 'none');
      put(element, 'flex-shrink', '0');
    }
  };
  return {
    activate() {
      if (active || typeof panel.querySelector !== 'function') return;
      const card = panel.querySelector<HTMLElement>('.card'), head = panel.querySelector<HTMLElement>('.head'), body = panel.querySelector<HTMLElement>('.body');
      // Unit DOM doubles need not implement layout. This boundary does not
      // change the surrounding gate's lease tracking or fresh-data rendering.
      if (!card || !head || !body || typeof card.getBoundingClientRect !== 'function') return;
      const box = card.getBoundingClientRect();
      if (!(box.width > 0 && box.height > 0)) return;
      const bodyWidth = body.getBoundingClientRect().width;
      const scrollTop = card.scrollTop, scrollLeft = card.scrollLeft;
      const anchors = [head, ...body.querySelectorAll<HTMLElement>('h3, li[data-kind="offer"], li[data-kind="offer"] .h, li[data-kind="offer"] .h > b, li[data-kind="offer"] .h > button')];
      // Capture children first, while the card still has its original layout.
      pin(anchors, true);
      put(body, 'box-sizing', 'border-box');
      put(body, 'width', `${bodyWidth}px`);
      put(card, 'box-sizing', 'border-box');
      put(card, 'position', 'fixed');
      put(card, 'top', `${box.top}px`);
      put(card, 'left', `${box.left}px`);
      put(card, 'width', `${box.width}px`);
      put(card, 'height', `${box.height}px`);
      put(card, 'max-height', 'none');
      put(card, 'overflow-anchor', 'none');
      card.scrollTop = scrollTop; card.scrollLeft = scrollLeft;
      active = true;
    },
    refresh() {
      if (!active) return;
      // Retired state headings are not leases. Drop their saved geometry so
      // repeated active/offer transitions cannot retain detached subtrees.
      for (let i = saved.length - 1; i >= 0; i--) if (!panel.contains(saved[i].element)) {
        const { element, property, value, priority } = saved[i];
        if (value) element.style.setProperty(property, value, priority); else element.style.removeProperty(property);
        measured.delete(element); saved.splice(i, 1);
      }
      // The keyed reconciler removes stale inline styles from retained nodes.
      // Reapply the original measurements, never remeasure a moved anchor.
      for (const { element, property, desired } of saved) element.style.setProperty(property, desired);
      const body = panel.querySelector<HTMLElement>('.body');
      if (body) pin([...body.querySelectorAll<HTMLElement>('h3, li[data-kind="offer"], li[data-kind="offer"] .h, li[data-kind="offer"] .h > b, li[data-kind="offer"] .h > button')], true);
    },
    restore() {
      // Restore only properties owned here, preserving any live status styles.
      for (let i = saved.length - 1; i >= 0; i--) {
        const { element, property, value, priority } = saved[i];
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      }
      saved.length = 0; measured.clear(); active = false;
    },
  };
}

  const doc = panel.ownerDocument, win = doc.defaultView!;
  const presses = new Map<number, boolean>(); // false = held, true = released
  // These namespaces are independent: Touch.identifier is not pointerId.
  // The document-wide cohort includes contacts outside this panel's buttons.
  const touchPointers = new Set<number>(), touchContacts = new Set<number>();
  let pending: (() => void) | null = null, generation = 0, timer: number | null = null;
  // A released offer retains its semantic slot beyond the no-click task.
  // The generic render lock still recovers on that original next task.
  const offerLeases = new Map<number, { button: HTMLButtonElement; released: boolean }>();
  let restoreOffers = false;
  let saturatedOffers = false; // conservative resource latch; only explicit invalidation clears it
  const MAX_OFFER_LEASES = 256;
  let offerSlots: string[] = [], latest: (() => void) | null = null;
  const geometry = createCommissionGeometry(panel);
  const savedOffers = new Map<string, HTMLElement>();
  const copy = (node: Node): Node => {
    if (node.nodeType !== 1) return doc.createTextNode(node.textContent ?? '');
    const element = node as HTMLElement, result = doc.createElement(element.tagName.toLowerCase());
    for (const attr of Array.from(element.attributes)) if (attr.name !== 'style') result.setAttribute(attr.name, attr.value);
    result.onclick = element.onclick;
    result.append(...Array.from(element.childNodes, copy));
    return result;
  };
  const clearOffers = () => { offerLeases.clear(); restoreOffers = false; saturatedOffers = false; offerSlots = []; savedOffers.clear(); geometry.restore(); };
  const settleOffer = (id: number) => {
    if (!offerLeases.delete(id)) return false;
    if (offerLeases.size || saturatedOffers) return true;
    offerSlots = []; savedOffers.clear(); restoreOffers = true; pending ??= latest; return true;
  };
  const stopTimer = () => { if (timer !== null) win.clearTimeout(timer); timer = null; };
  const flush = () => {
    if (presses.size) return;
    if (restoreOffers) { geometry.restore(); restoreOffers = false; }
    const render = pending; pending = null;
    if (!panel.hidden) render?.();
  };
  const cancel = () => { generation++; stopTimer(); touchPointers.clear(); touchContacts.clear(); presses.clear(); pending = null; latest = null; clearOffers(); };
  const abandon = () => { generation++; stopTimer(); touchPointers.clear(); touchContacts.clear(); presses.clear(); clearOffers(); pending ??= latest; flush(); };
  const releaseFallback = () => {
    stopTimer(); const expected = generation;
    // Normal activation flushes in click bubble below. A task recovers releases
    // with no click in the tested Chrome path; it must never unlock a newer press.
    timer = win.setTimeout(() => {
      if (expected !== generation) return; timer = null;
      for (const [id, released] of presses) {
        if (touchPointers.has(id) && touchContacts.size) continue;
        if (released) presses.delete(id);
        if (!presses.has(id)) touchPointers.delete(id);
      }
      flush();
    }, 0);
  };
  const observeTouches = (event: TouchEvent) => {
    touchContacts.clear();
    for (const touch of event.touches) touchContacts.add(touch.identifier);
    if (!touchContacts.size && [...touchPointers].some(id => presses.get(id) === true)) {
      generation++; releaseFallback(); // observed cohort ended
    }
  };
  // Keep a released touch pointer guarded if its task precedes touchend. Once
  // the cohort ends, retain D052's next-task no-click recovery, with no grace
  // delay or synthetic click. This is not an arbitrary delayed-click guarantee
  // and does not establish the cause of the original D074 release failure.
  doc.addEventListener('touchstart', observeTouches, { capture: true, passive: true });
  doc.addEventListener('touchend', observeTouches, { capture: true, passive: true });
  doc.addEventListener('touchcancel', observeTouches, { capture: true, passive: true });
  doc.addEventListener('pointerdown', event => {
    // Reuse can begin on another control or outside the panel. Its cancellation
    // cannot identify the older delayed activation, regardless of pointer type.
    if (offerLeases.has(event.pointerId)) saturatedOffers = true;
  }, true);
  panel.addEventListener('pointerdown', event => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button');
    if (panel.hidden || !button || button.disabled || !panel.contains(button) || event.button !== 0) return;
    generation++; stopTimer(); presses.set(event.pointerId, false);
    touchPointers.delete(event.pointerId);
    if (event.pointerType === 'touch') touchPointers.add(event.pointerId);
    if (retainCommissionOffers && event.pointerType === 'touch') {
      let row: HTMLElement | null = button;
      while (row && row !== panel && row.dataset.kind !== 'offer') row = row.parentElement;
      if (row?.dataset.kind === 'offer' && row.parentElement) {
        if (!offerLeases.size && !saturatedOffers) {
          restoreOffers = false;
          offerSlots = Array.from(row.parentElement.children).filter(e => (e as HTMLElement).dataset.kind === 'offer').map(e => (e as HTMLElement).dataset.k!);
          for (const child of Array.from(row.parentElement.children) as HTMLElement[]) if (child.dataset.kind === 'offer') savedOffers.set(child.dataset.k!, copy(child) as HTMLElement);
          geometry.activate();
        }
        if (offerLeases.size < MAX_OFFER_LEASES || offerLeases.has(event.pointerId)) offerLeases.set(event.pointerId, { button, released: false });
        else saturatedOffers = true;
      }
    }
  }, true);
  doc.addEventListener('pointerup', event => {
    if (!presses.has(event.pointerId)) return;
    const lease = offerLeases.get(event.pointerId); if (lease) lease.released = true;
    generation++; presses.set(event.pointerId, true); releaseFallback();
  }, true);
  doc.addEventListener('pointercancel', event => {
    const settled = settleOffer(event.pointerId);
    if (!presses.delete(event.pointerId)) { if (settled) { generation++; releaseFallback(); } return; }
    touchPointers.delete(event.pointerId);
    generation++; releaseFallback();
  }, true);
  doc.addEventListener('click', event => {
    const id = (event as PointerEvent).pointerId;
    const lease = offerLeases.get(id);
    if (lease?.released && (event.target === lease.button || lease.button.contains(event.target as Node))) settleOffer(id);
    if (typeof id === 'number' && presses.has(id)) presses.delete(id);
    else for (const [pointer, released] of presses) {
      if (touchPointers.has(pointer) && touchContacts.size) continue;
      if (released) presses.delete(pointer);
    }
    for (const pointer of touchPointers) if (!presses.has(pointer)) touchPointers.delete(pointer);
    if (!presses.size) { generation++; stopTimer(); flush(); }
  }); // bubble: the original button onclick has already validated/applied its action
  win.addEventListener('blur', abandon);
  win.addEventListener('pagehide', abandon);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) abandon(); });
  return {
    presentation(kids: HTMLElement[], availableCount: number) {
      if (!offerLeases.size && !saturatedOffers) return kids;
      const offered = kids.find(e => e.nodeName === 'OL');
      const fresh = new Map<string, HTMLElement>();
      for (const row of Array.from(offered?.children ?? []) as HTMLElement[]) {
        fresh.set(row.dataset.k!, row);
        if (!offerSlots.includes(row.dataset.k!)) offerSlots.push(row.dataset.k!);
        savedOffers.set(row.dataset.k!, copy(row) as HTMLElement);
      }
      const list = doc.createElement('ol');
      for (const id of offerSlots) {
        const row = fresh.get(id) ?? copy(savedOffers.get(id)!) as HTMLElement;
        if (!fresh.has(id)) {
          row.dataset.st = 'unavailable';
          const mark = (element: HTMLElement) => {
            if (element.nodeName === 'BUTTON') { element.textContent = '已失效'; element.setAttribute('aria-disabled', 'true'); }
            for (const child of Array.from(element.children) as HTMLElement[]) mark(child);
          };
          mark(row);
        }
        list.append(row);
      }
      if (offered) { kids[kids.indexOf(offered)] = list; return kids; }
      const heading = doc.createElement('h3'); heading.textContent = `${availableCount} 選一（先前觸控的委託）`;
      return [heading, list, ...kids];
    },
    refreshGeometry() { geometry.refresh(); },
    defer(renderLatest: () => void) {
      if (panel.hidden) { cancel(); return false; }
      if (retainCommissionOffers) latest = renderLatest;
      if (!presses.size) return false;
      pending = renderLatest; return true;
    },
    cancel,
  };
}
