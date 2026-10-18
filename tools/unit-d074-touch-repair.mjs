// D074 bounded presentation repair. Event targets and task scheduling here are
// explicit Node doubles, not native Chrome/Android input or layout evidence.
// The adversarial ordering is not proven to be the original release's cause.
// No guarantee is made for arbitrary delayed click after the post-touchend task.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';

const sourcePath = new URL('../src/ui/panelPress.ts', import.meta.url);
const currentSource = () => fs.readFileSync(sourcePath, 'utf8');
const ORIGINAL_SHA = '108ed5b4b11f262728c0cddb4abe8a719f4b2ef6f673c1dd96a471c7cabc45c6';
// Exact UTF-8 source from beca506c224ad72f9a890ed20b5aa1fa7b2616f5.
// It is executed as captured; no repair adapter or source normalization is used.
const ORIGINAL_SOURCE = "// A stable DOM node can still lose its native click when its rectangle moves\n// between touch-down and click (Chrome 154, D052 promotion fixture). Keep the\n// whole panel presentation stationary through the existing activation handler.\n// Simulation, action validation, HUD and saving continue on their normal paths.\nexport function createPanelUpdateGate(panel: HTMLElement) {\n  const doc = panel.ownerDocument, win = doc.defaultView!;\n  const presses = new Map<number, boolean>(); // false = held, true = released\n  let pending: (() => void) | null = null, generation = 0, timer: number | null = null;\n  const stopTimer = () => { if (timer !== null) win.clearTimeout(timer); timer = null; };\n  const flush = () => {\n    if (presses.size) return;\n    const render = pending; pending = null;\n    if (!panel.hidden) render?.();\n  };\n  const cancel = () => { generation++; stopTimer(); presses.clear(); pending = null; };\n  const abandon = () => { generation++; stopTimer(); presses.clear(); flush(); };\n  const releaseFallback = () => {\n    stopTimer(); const expected = generation;\n    // Normal activation flushes in click bubble below. A task recovers releases\n    // with no click in the tested Chrome path; it must never unlock a newer press.\n    timer = win.setTimeout(() => {\n      if (expected !== generation) return; timer = null;\n      for (const [id, released] of presses) if (released) presses.delete(id);\n      flush();\n    }, 0);\n  };\n  panel.addEventListener('pointerdown', event => {\n    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button');\n    if (panel.hidden || !button || button.disabled || !panel.contains(button) || event.button !== 0) return;\n    generation++; stopTimer(); presses.set(event.pointerId, false);\n  }, true);\n  doc.addEventListener('pointerup', event => {\n    if (!presses.has(event.pointerId)) return;\n    generation++; presses.set(event.pointerId, true); releaseFallback();\n  }, true);\n  doc.addEventListener('pointercancel', event => {\n    if (!presses.delete(event.pointerId)) return;\n    generation++; releaseFallback();\n  }, true);\n  doc.addEventListener('click', event => {\n    const id = (event as PointerEvent).pointerId;\n    if (typeof id === 'number' && presses.has(id)) presses.delete(id);\n    else for (const [pointer, released] of presses) if (released) presses.delete(pointer);\n    if (!presses.size) { generation++; stopTimer(); flush(); }\n  }); // bubble: the original button onclick has already validated/applied its action\n  win.addEventListener('blur', abandon);\n  win.addEventListener('pagehide', abandon);\n  doc.addEventListener('visibilitychange', () => { if (doc.hidden) abandon(); });\n  return {\n    defer(renderLatest: () => void) {\n      if (panel.hidden) { cancel(); return false; }\n      if (!presses.size) return false;\n      pending = renderLatest; return true;\n    },\n    cancel,\n  };\n}\n";

class Target {
  constructor(name, parent = null) {
    this.name = name; this.parentNode = parent; this.listeners = new Map();
    this.hidden = false; this.disabled = false; this.onclick = null;
  }
  addEventListener(type, fn, options = false) {
    const list = this.listeners.get(type) ?? [];
    list.push({fn, capture: typeof options === 'boolean' ? options : !!options.capture,
      passive: typeof options === 'object' && options.passive === true});
    this.listeners.set(type, list);
  }
  fire(event, capture) {
    for (const listener of this.listeners.get(event.type) ?? []) {
      if (listener.capture === capture) listener.fn(event);
    }
  }
  closest(selector) {
    assert.equal(selector, 'button');
    for (let node = this; node; node = node.parentNode) if (node.name === 'button') return node;
    return null;
  }
  contains(target) {
    for (let node = target; node; node = node.parentNode) if (node === this) return true;
    return false;
  }
}
function setup(source) {
  // Compile the raw candidate or exact original, rather than replacing it with
  // a copied behavioral implementation. Compilation errors are never mutations.
  const create = new Function(stripTypeScriptTypes(source).replace(
    'export function createPanelUpdateGate', 'function createPanelUpdateGate') + ';return createPanelUpdateGate;')();
  const win = new Target('window'), doc = new Target('document', win);
  const panel = new Target('panel', doc), a = new Target('button', panel), b = new Target('button', panel);
  const nested = new Target('span', a), outside = new Target('button', doc);
  doc.defaultView = win; panel.ownerDocument = doc;
  const timers = new Map(), timerDelays = [], events = []; let nextTimer = 0;
  win.setTimeout = (fn, delay) => {
    assert.equal(delay, 0, 'only the original zero-delay recovery task is allowed');
    timerDelays.push(delay); timers.set(++nextTimer, fn); return nextTimer;
  };
  win.clearTimeout = id => timers.delete(id);
  const emit = (type, fields = {}) => {
    const target = fields.target ?? a;
    const event = {type, target, button: 0, isTrusted: false, ...fields,
      preventDefault() { throw new Error('gate must remain a passive observer'); },
      stopPropagation() { throw new Error('gate must not change event propagation'); }};
    const path = []; for (let node = target; node; node = node.parentNode) path.push(node);
    for (const node of [...path].reverse()) node.fire(event, true);
    for (const node of path) {
      if (type === 'click' && node === target) node.onclick?.(event);
      node.fire(event, false);
    }
  };
  const pointer = (type, id = 701, target = a, pointerType = 'touch', extras = {}) =>
    emit(type, {target, pointerId: id, pointerType, ...extras});
  const contact = (identifier, target = a) => ({identifier, target});
  const touch = (type, live, changed = live, target = changed[0]?.target ?? a) =>
    emit(type, {target, touches: live, changedTouches: changed});
  const runTimers = () => {
    const ready = [...timers]; timers.clear(); for (const [, fn] of ready) fn();
  };
  const gate = create(panel);
  const defer = label => assert.equal(gate.defer(() => events.push(label)), true, 'panel update must be deferred');
  const unlocked = () => assert.equal(gate.defer(() => events.push('unexpected render')), false, 'gate must be unlocked');
  const action = (target = a, label = 'action') => { target.onclick = () => { events.push(label); defer('after ' + label); }; };
  return {doc, win, panel, a, b, nested, outside, timers, timerDelays, events, emit, pointer, contact, touch, runTimers, gate, defer, unlocked, action};
}
function begin(q, pointerId = 701, touchId = 41, target = q.a, live = []) {
  assert.notEqual(pointerId, touchId, 'touch and pointer identities deliberately differ');
  const touch = q.contact(touchId, target);
  q.pointer('pointerdown', pointerId, target);
  q.touch('touchstart', [...live, touch], [touch]);
  return touch;
}
function adversarial(source) {
  const q = setup(source), t = begin(q);
  q.defer('obsolete'); q.defer('latest'); q.action();
  q.pointer('pointerup');
  assert.equal(q.timers.size, 1, 'execute a genuinely due release fallback');
  q.runTimers();
  assert.deepEqual(q.events, [], 'active observed touch cohort must block due pointerup fallback');
  assert.equal(q.timers.size, 0, 'blocked fallback must not spin or add a polling delay');
  q.touch('touchend', [], [t]);
  assert.deepEqual(q.events, [], 'touchend cannot redraw before click');
  q.pointer('click');
  assert.deepEqual(q.events, ['action', 'after action'], 'original target action precedes the newest deferred presentation');
  q.runTimers();
  assert.deepEqual(q.events, ['action', 'after action'], 'native action and render happen only once');
  q.unlocked();
}
function listenerBoundary(source) {
  const q = setup(source);
  for (const type of ['touchstart', 'touchend', 'touchcancel']) {
    const listeners = q.doc.listeners.get(type) ?? [];
    assert.equal(listeners.length, 1, type + ' has one document-wide observer');
    assert.equal(listeners[0].capture, true, type + ' uses capture observation');
    assert.equal(listeners[0].passive, true, type + ' is explicitly passive');
  }
  // Contacts outside the panel alone never create a panel press or suppress
  // mouse/keyboard controls; identifiers are only cohort membership.
  const outer = q.contact(701, q.outside);
  q.touch('touchstart', [outer]); q.unlocked();
  q.emit('click', {target: q.a}); q.unlocked();
  q.touch('touchend', [], [outer]); assert.equal(q.timers.size, 0);
}
function multitouch(source) {
  for (const sameButton of [false, true]) for (const ending of ['partial', 'batched']) {
    const q = setup(source), second = sameButton ? q.a : q.b;
    const t1 = begin(q, 701, 41), t2 = begin(q, 702, 42, second, [t1]);
    q.defer('multi'); q.a.onclick = () => q.events.push('first action');
    if (!sameButton) second.onclick = () => q.events.push('second action');
    q.pointer('pointerup', 701); q.runTimers();
    assert.deepEqual(q.events, [], 'first release cannot move either held button');
    if (ending === 'partial') {
      q.touch('touchend', [t2], [t1]); q.runTimers();
      assert.deepEqual(q.events, [], 'partial touchend leaves the other contact active');
      q.pointer('click', 701);
      assert.deepEqual(q.events, ['first action'], 'first click keeps the other pointer guarded');
      q.pointer('pointerup', 702, second); q.runTimers();
      assert.deepEqual(q.events, ['first action'], 'remaining active contact blocks its release fallback');
      q.touch('touchend', [], [t2]);
    } else {
      q.pointer('pointerup', 702, second); q.runTimers();
      assert.deepEqual(q.events, [], 'two released pointers still share an active cohort');
      q.touch('touchend', [], [t1, t2]); q.pointer('click', 701);
      assert.deepEqual(q.events, ['first action'], 'matching click clears only its own pointer');
    }
    q.pointer('click', 702, second); q.runTimers();
    assert.deepEqual(q.events, ['first action', sameButton ? 'first action' : 'second action', 'multi']);
    q.unlocked();
  }
}
function outsideContact(source) {
  for (const outsideFirst of [false, true]) {
    const q = setup(source), out = q.contact(701, q.outside);
    // The outside Touch.identifier equals the inside PointerEvent.pointerId on
    // purpose: identity collision must not be mistaken for the same contact.
    if (outsideFirst) q.touch('touchstart', [out]);
    const inside = begin(q, 701, 41, q.a, outsideFirst ? [out] : []);
    if (!outsideFirst) q.touch('touchstart', [inside, out], [out]);
    q.defer('outside cohort'); q.pointer('pointerup'); q.runTimers();
    q.touch('touchend', [out], [inside]); q.runTimers();
    assert.deepEqual(q.events, [], 'outside-panel contact remains part of the observed cohort');
    q.touch('touchend', [], [out], q.outside);
    assert.deepEqual(q.events, []); q.runTimers();
    assert.deepEqual(q.events, ['outside cohort'], 'last outside contact releases the existing no-click task');
    q.unlocked();
  }
}
function cancellation(source) {
  for (const touchFirst of [false, true]) {
    const q = setup(source), t1 = begin(q, 701, 41), t2 = begin(q, 702, 42, q.b, [t1]);
    q.defer('partial cancel');
    if (touchFirst) q.touch('touchcancel', [t2], [t1]);
    q.pointer('pointercancel', 701);
    if (!touchFirst) q.touch('touchcancel', [t2], [t1]);
    q.pointer('pointerup', 702, q.b); q.runTimers();
    assert.deepEqual(q.events, [], 'partial cancellation cannot clear the remaining cohort');
    q.touch('touchend', [], [t2]); q.pointer('click', 702, q.b); q.runTimers();
    assert.deepEqual(q.events, ['partial cancel']); q.unlocked();
  }
  for (const touchFirst of [false, true]) {
    const q = setup(source), t = begin(q); q.defer('cancel');
    if (touchFirst) q.touch('touchcancel', [], [t]);
    q.pointer('pointercancel');
    if (!touchFirst) q.touch('touchcancel', [], [t]);
    assert.deepEqual(q.events, []); q.runTimers();
    assert.deepEqual(q.events, ['cancel'], 'fully cancelled gesture recovers without any activation'); q.unlocked();
  }
}
function eventOrders(source) {
  for (const touchFirst of [false, true]) for (const click of [false, true]) {
    const q = setup(source), t = begin(q); q.defer('latest');
    if (click) q.action();
    if (touchFirst) q.touch('touchend', [], [t]);
    q.pointer('pointerup');
    if (!touchFirst) { q.runTimers(); assert.deepEqual(q.events, []); q.touch('touchend', [], [t]); }
    assert.deepEqual(q.events, [], 'either release order stays stable until click or next task');
    if (click) q.pointer('click');
    q.runTimers();
    assert.deepEqual(q.events, click ? ['action', 'after action'] : ['latest']); q.unlocked();
  }
  // touchstart may be observed before pointerdown, without matching identifiers.
  const q = setup(source), t = q.contact(41); q.touch('touchstart', [t]);
  q.pointer('pointerdown'); q.defer('touch-first'); q.pointer('pointerup'); q.runTimers();
  assert.deepEqual(q.events, []); q.touch('touchend', [], [t]); q.runTimers();
  assert.deepEqual(q.events, ['touch-first']); q.unlocked();
}
function mousePen(source) {
  for (const pointerType of ['mouse', 'pen', '']) {
    const q = setup(source), out = q.contact(81, q.outside); q.touch('touchstart', [out]);
    q.pointer('pointerdown', 901, q.a, pointerType); q.defer(pointerType || 'unknown');
    q.pointer('pointerup', 901, q.a, pointerType); q.runTimers();
    assert.deepEqual(q.events, [pointerType || 'unknown'], pointerType + ' keeps original next-task recovery during unrelated touches'); q.unlocked();
  }
  for (const pointerType of ['mouse', 'pen']) {
    const q = setup(source), t = begin(q); q.defer('mixed');
    q.pointer('pointerdown', 901, q.b, pointerType); q.pointer('pointerup', 901, q.b, pointerType); q.runTimers();
    assert.deepEqual(q.events, [], 'held touch retains presentation while non-touch release recovers');
    q.pointer('pointerup'); q.runTimers(); q.touch('touchend', [], [t]);
    q.action(); q.pointer('click'); q.runTimers();
    assert.deepEqual(q.events, ['action', 'after action'], 'non-touch release did not remain stuck in mixed cohort'); q.unlocked();
  }
}
function pointerOnlyAndKeyboard(source) {
  for (const pointerType of ['touch', 'mouse', 'pen']) {
    const q = setup(source); q.pointer('pointerdown', 701, q.a, pointerType); q.defer('pointer only');
    q.pointer('pointerup', 701, q.a, pointerType); q.runTimers();
    assert.deepEqual(q.events, ['pointer only'], 'without observed touch contacts original next-task behavior remains'); q.unlocked();
  }
  const q = setup(source); q.a.onclick = () => q.events.push('keyboard action');
  q.emit('click', {target: q.a, detail: 0}); q.unlocked();
  assert.deepEqual(q.events, ['keyboard action']); assert.equal(q.timerDelays.length, 0);
}
function unrelatedClicks(source) {
  for (const fields of [{pointerId: 901, pointerType: 'mouse'}, {pointerId: -1, detail: 0}, {}]) {
    for (const taskFirst of [false, true]) {
      const q = setup(source), t = begin(q); q.defer('latest'); q.pointer('pointerup');
      if (taskFirst) q.runTimers();
      let unrelatedActions = 0; q.outside.onclick = () => unrelatedActions++;
      q.emit('click', {target: q.outside, ...fields}); q.runTimers();
      assert.equal(unrelatedActions, 1, 'unrelated native/keyboard/programmatic action remains untouched');
      assert.deepEqual(q.events, [], 'unmatched click cannot bypass the still-active touch cohort');
      q.touch('touchend', [], [t]); q.action(); q.pointer('click'); q.runTimers();
      assert.deepEqual(q.events, ['action', 'after action']); q.unlocked();
    }
  }
  // A legacy click lacking pointerId remains usable once the observed contact
  // has ended; it is not replaced with a synthetic activation by the gate.
  const q = setup(source), t = begin(q); q.defer('legacy'); q.pointer('pointerup'); q.runTimers();
  q.touch('touchend', [], [t]); q.action(); q.emit('click', {target: q.a}); q.runTimers();
  assert.deepEqual(q.events, ['action', 'after action']); q.unlocked();
}
function reusedPointerType(source) {
  for (const pointerType of ['mouse', 'pen']) {
    const q = setup(source), t = begin(q); q.defer('old'); q.pointer('pointerup');
    q.touch('touchend', [], [t]); const oldTask = [...q.timers.values()][0];
    // The pointer API may reuse IDs after a gesture. Classification belongs to
    // the new pointerdown, never to an old released touch with the same number.
    q.pointer('pointerdown', 701, q.b, pointerType); q.defer('reused ' + pointerType);
    const out = q.contact(41, q.outside); q.touch('touchstart', [out]);
    oldTask(); assert.deepEqual(q.events, []);
    q.pointer('pointerup', 701, q.b, pointerType); q.runTimers();
    assert.deepEqual(q.events, ['reused ' + pointerType]); q.unlocked();
  }
}
function staleTasks(source) {
  // Replay an already queued callback deliberately, even after clearTimeout,
  // to exercise generation checks rather than relying on the scheduler double.
  const q = setup(source), t = begin(q); q.defer('old'); q.pointer('pointerup');
  const beforeTouchend = [...q.timers.values()][0]; q.touch('touchend', [], [t]);
  beforeTouchend(); assert.deepEqual(q.events, [], 'pre-touchend callback is invalidated by cohort completion');
  const afterTouchend = [...q.timers.values()][0]; assert.equal(typeof afterTouchend, 'function');
  const fresh = begin(q, 702, 42, q.b); q.defer('new'); afterTouchend(); beforeTouchend(); q.runTimers();
  assert.deepEqual(q.events, [], 'neither old callback can unlock a fresh press');
  q.pointer('pointerup', 702, q.b); q.runTimers(); assert.deepEqual(q.events, []);
  q.touch('touchend', [], [fresh]); q.pointer('click', 702, q.b); q.runTimers();
  assert.deepEqual(q.events, ['new']); q.unlocked();
}
function lifecycle(source) {
  for (const reason of ['cancel', 'hidden', 'blur', 'pagehide', 'visibilitychange']) {
    const q = setup(source), t = begin(q); q.defer('stale'); q.pointer('pointerup');
    const stale = [...q.timers.values()][0];
    if (reason === 'cancel') { q.gate.cancel(); q.panel.hidden = true; }
    else if (reason === 'hidden') { q.panel.hidden = true; q.unlocked(); }
    else if (reason === 'visibilitychange') { q.doc.hidden = true; q.emit(reason, {target: q.doc}); }
    else q.emit(reason, {target: q.win});
    stale(); q.runTimers();
    assert.deepEqual(q.events, ['cancel', 'hidden'].includes(reason) ? [] : ['stale'], reason + ' retains original discard/abandon semantics');
    q.touch('touchend', [], [t]); q.panel.hidden = false; q.doc.hidden = false;
    const fresh = begin(q, 702, 42); q.defer('fresh'); q.pointer('pointerup', 702); q.runTimers();
    assert.equal(q.events.includes('fresh'), false, reason + ' cannot leak stale contact or timer state');
    q.touch('touchend', [], [fresh]); q.pointer('click', 702); q.runTimers();
    assert.equal(q.events.at(-1), 'fresh'); q.unlocked();
  }
}
function unchangedBoundaries(source) {
  for (const mode of ['outside', 'disabled', 'hidden', 'right button']) {
    const q = setup(source);
    if (mode === 'disabled') q.a.disabled = true;
    if (mode === 'hidden') q.panel.hidden = true;
    q.pointer('pointerdown', 701, mode === 'outside' ? q.outside : q.a, 'touch', {button: mode === 'right button' ? 2 : 0});
    q.unlocked(); assert.equal(q.timers.size, 0);
  }
  const q = setup(source); q.pointer('pointerdown', 701, q.nested); q.defer('nested');
  q.pointer('lostpointercapture'); q.runTimers(); assert.deepEqual(q.events, []);
  q.pointer('pointerup'); q.emit('click', {target: q.a}); q.runTimers();
  assert.deepEqual(q.events, ['nested'], 'legacy click without pointer ID releases only released pointers'); q.unlocked();
}
function change(source, from, to) {
  assert.equal(source.split(from).length, 2, 'mutation anchor must occur exactly once: ' + from);
  const altered = source.replace(from, () => to); assert.notEqual(altered, source); return altered;
}
function mutations(source) {
  const specs = [
    ['cohort check removed', 'if (touchPointers.has(id) && touchContacts.size) continue;', 'if (false) continue;', adversarial],
    ['pointer IDs substituted for touch membership', 'touchPointers.has(id) && touchContacts.size', 'touchContacts.has(id)', adversarial],
    ['touch pointer type classification removed', "if (event.pointerType === 'touch') touchPointers.add(event.pointerId);", 'void 0;', adversarial],
    ['mouse/pen incorrectly included in touch cohort', "if (event.pointerType === 'touch') touchPointers.add(event.pointerId);", 'touchPointers.add(event.pointerId);', mousePen],
    ['empty cohort never schedules recovery', 'generation++; releaseFallback(); // observed cohort ended', 'void 0;', eventOrders],
    ['cohort-end stale callback not invalidated', 'generation++; releaseFallback(); // observed cohort ended', 'releaseFallback(); // observed cohort ended', staleTasks],
    ['partial touchcancel clears every contact', 'for (const touch of event.touches) touchContacts.add(touch.identifier);', "for (const touch of event.type === 'touchcancel' ? [] : event.touches) touchContacts.add(touch.identifier);", cancellation],
    ['touchend eagerly renders before click', 'generation++; releaseFallback(); // observed cohort ended', 'generation++; presses.clear(); touchPointers.clear(); flush();', adversarial],
    ['unmatched click discards released active touch', 'if (touchPointers.has(pointer) && touchContacts.size) continue;', 'if (false) continue;', unrelatedClicks],
    ['reused non-touch pointer keeps obsolete touch classification', '    touchPointers.delete(event.pointerId);\n    if (event.pointerType', '    if (event.pointerType', reusedPointerType],
  ];
  // Both source construction and compilation precede assert.throws. Missing
  // anchors, type stripping, syntax errors and unknown identifiers cannot count
  // as behaviorally rejected mutations.
  const prepared = specs.map(([name, from, to, test]) => {
    const altered = change(source, from, to); setup(altered); return {name, altered, test};
  });
  for (const {name, altered, test} of prepared)
    assert.throws(() => test(altered), error => error?.code === 'ERR_ASSERTION', name);
  return prepared.length + ' constructed valid mutations rejected by behavior';
}
export function d074TouchRepairGuards(log = () => {}, source = currentSource()) {
  let failed = 0;
  const report = {qualification: 'Node event/task doubles only; adversarial ordering is not a proven original release cause and arbitrary delayed click after touchend is not guaranteed.', tests: [], passed: false};
  const test = (name, fn) => {
    try { const detail = fn(); report.tests.push({name, passed: true}); log(true, 'D074 touch repair ' + name, detail); }
    catch (error) { failed++; report.tests.push({name, passed: false, error: error.stack}); log(false, 'D074 touch repair ' + name, error.stack); }
  };
  test('exact original source is rejected for the new behavior before candidate verification', () => {
    assert.equal(createHash('sha256').update(ORIGINAL_SOURCE).digest('hex'), ORIGINAL_SHA);
    setup(ORIGINAL_SOURCE);
    let observed = '';
    assert.throws(() => adversarial(ORIGINAL_SOURCE), error => {
      observed = error.message; return error?.code === 'ERR_ASSERTION' && error.message.includes('active observed touch cohort must block due pointerup fallback');
    });
    return observed.split('\n')[0];
  });
  for (const [name, check] of [
    ['pointerup → due task → touchend → click preserves original action then latest presentation', adversarial],
    ['document observers are passive; unrelated contacts do not create a panel press', listenerBoundary],
    ['same/different-button multitouch and partial/batched contact endings', multitouch],
    ['outside-panel cohort contact with deliberately colliding cross-API identifier', outsideContact],
    ['partial and complete cancellation in either event order', cancellation],
    ['both pointerup/touchend orders and no-click next-task recovery', eventOrders],
    ['mouse/pen and touch-pointer interleaving preserve original recovery', mousePen],
    ['pointer-only paths and keyboard activation retain original behavior', pointerOnlyAndKeyboard],
    ['unmatched mouse/keyboard/programmatic clicks cannot release active touch', unrelatedClicks],
    ['reused pointer IDs take their fresh mouse/pen classification', reusedPointerType],
    ['cohort-end and fresh-press generation checks reject stale callbacks', staleTasks],
    ['close/reopen, hidden, blur, pagehide and visibility cleanup', lifecycle],
    ['original disabled/hidden/outside/secondary/nested/lost-capture boundaries', unchangedBoundaries],
    ['actual candidate source mutations are constructed before behavioral rejection', mutations],
  ]) test(name, () => check(source));
  report.passed = failed === 0;
  return {failed, report};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : currentSource();
  const {failed, report} = d074TouchRepairGuards((ok, name, detail) => console.log(ok ? 'OK' : 'NG', name, detail ?? ''), source);
  console.log(JSON.stringify({passed: report.passed, tests: report.tests.length, failed, qualification: report.qualification}));
  process.exitCode = failed ? 1 : 0;
}
