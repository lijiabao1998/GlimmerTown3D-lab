import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { assertFrozenCurrentSource } from '../proposals/d090/foundation-routing-contract-pipes-v2.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="startup-presentation">([\s\S]*?)<\/script>/)?.[1];

// Execute the actual presentation script, with explicit frame opportunities.
function setup(search = '') {
  const listeners = new Map(), frames = new Map(), timers = new Map();
  let next = 0, reloads = 0, observer;
  const root = { dataset: { phase: 'loading' }, hidden: false, attributes: {} };
  const doc = { activeElement: null };
  const node = (id, extra = {}) => Object.assign({
    id, tagName: 'BUTTON', hidden: false, disabled: false, owner: root,
    focus() { doc.activeElement = this; },
    blur() { doc.activeElement = doc.body; },
    addEventListener(type, fn) { this.events ??= new Map(); this.events.set(type, fn); },
    removeEventListener(type) { this.events?.delete(type); },
    setAttribute(k, v) { this.attributes[k] = v; },
    getClientRects() { return !this.hidden && (id !== 'startup-enter' || root.dataset.phase === 'welcome') ? [1] : []; },
  }, extra);
  Object.assign(root, node('startup'), { tagName: 'SECTION', contains: n => n === root || n?.owner === root });
  const nodes = Object.fromEntries(['startup', 'startup-status', 'startup-storage', 'startup-notice', 'startup-enter', 'startup-retry', 'summary'].map(id => [id, id === 'startup' ? root : node(id)]));
  nodes['startup-enter'].disabled = true;
  nodes['startup-retry'].hidden = true; nodes['startup-storage'].hidden = true;
  root.querySelectorAll = () => [nodes['startup-enter'], nodes['startup-retry'], nodes.summary].filter(n => !n.disabled && !n.hidden);
  const game = node('game', { tagName: 'DIV', owner: null, inert: false });
  const previouslyInert = node('already-inert', { tagName: 'DIV', owner: null, inert: true });
  doc.body = node('body', { tagName: 'BODY', owner: null, children: [root, game, previouslyInert, { tagName: 'SCRIPT' }] });
  doc.activeElement = doc.body; doc.querySelector = s => nodes[s.slice(1)];
  doc.toasts = []; doc.querySelectorAll = () => doc.toasts;
  const env = {
    document: doc, location: { search, reload: () => reloads++ },
    MutationObserver: class { constructor(fn) { observer = this; this.fn = fn; } observe() {} disconnect() { this.disconnected = true; } },
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id),
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type),
  };
  env.window = env;
  vm.runInNewContext(script, env);
  return {
    env, nodes, game, previouslyInert, listeners, frames, timers, doc, observer,
    tick() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); },
    click(id) { nodes[id].events.get('click')(); }, reloads: () => reloads,
    ready(journal) { env.__gt = { ready: true, ...(journal ? { journal } : {}) }; },
  };
}

export async function startupGuards() {
  assertFrozenCurrentSource();
  assert.equal(fs.existsSync(new URL('../src/ui/startup.ts', import.meta.url)), false);
  assert.ok(script); assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /safe-area-inset-bottom/); assert.match(html, /aria-live="polite"/); assert.match(html, /<noscript>/);
  assert.doesNotMatch(script, /\b(?:startCity|startHistory|bootJournal|localStorage|indexedDB|saveCode|loadCode)\b/);

  const a = setup();
  assert.equal(a.game.inert, true); assert.equal(a.nodes['startup-enter'].disabled, true);
  a.click('startup-enter'); a.tick(); assert.equal(a.nodes.startup.hidden, false);
  const later = { tagName: 'CANVAS', inert: false };
  a.doc.body.children.push(later); a.observer.fn(); assert.equal(later.inert, true);
  a.doc.toasts.push({ textContent: 'original engine save warning' }); a.observer.fn();
  assert.equal(a.nodes['startup-notice'].textContent, 'original engine save warning');
  a.doc.toasts = []; a.observer.fn();
  assert.equal(a.nodes['startup-notice'].hidden, false); assert.equal(a.nodes['startup-notice'].textContent, 'original engine save warning');
  let journalReads = 0;
  a.ready(() => { journalReads++; return { kind: 'idb', why: '' }; });
  a.tick(); assert.equal(a.nodes.startup.dataset.phase, 'loading');
  a.tick(); assert.equal(a.nodes.startup.dataset.phase, 'loading');
  a.tick(); assert.equal(a.nodes.startup.dataset.phase, 'welcome'); assert.equal(journalReads, 1);
  assert.equal(a.nodes['startup-storage'].hidden, true); assert.equal(a.doc.activeElement.id, 'startup-enter');
  const contact = { type: 'pointerdown', target: a.nodes.summary, stopImmediatePropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
  a.listeners.get('pointerdown')(contact); assert.equal(contact.stopped, true); assert.equal(contact.prevented, undefined);
  const tab = { type: 'keydown', key: 'Tab', shiftKey: true, target: a.nodes['startup-enter'], preventDefault() { this.prevented = true; } };
  a.listeners.get('keydown')(tab); assert.equal(tab.prevented, true); assert.equal(a.doc.activeElement.id, 'summary');
  a.click('startup-enter'); a.click('startup-enter');
  assert.equal(a.nodes.startup.hidden, true); assert.equal(a.game.inert, false); assert.equal(later.inert, false);
  assert.equal(a.previouslyInert.inert, true); assert.equal(a.listeners.size, 0); assert.equal(a.frames.size, 0);
  assert.equal(a.doc.activeElement, a.doc.body); assert.equal(journalReads, 1);

  for (const search of ['?sample=starter', '?mode=history', '?style=A', '?unknown=1']) {
    const b = setup(search); b.ready(); b.tick(); b.tick(); b.tick();
    assert.equal(b.nodes.startup.hidden, true); assert.equal(b.nodes['startup-enter'].disabled, true);
  }
  for (const journal of [{ kind: null, why: 'storage denied' }, { kind: 'idb', why: 'read failed' }]) {
    const b = setup(); b.ready(() => journal); b.tick(); b.tick(); b.tick();
    assert.equal(b.nodes['startup-storage'].hidden, false); assert.match(b.nodes['startup-storage'].textContent, /暫不可用或讀取不完整/);
    assert.ok(b.nodes['startup-storage'].textContent.includes(journal.why));
  }
  for (const type of ['error', 'unhandledrejection']) {
    const b = setup(); b.listeners.get(type)({ type, target: { tagName: 'SCRIPT' } });
    b.ready(); b.tick();
    assert.equal(b.nodes.startup.dataset.phase, 'error'); assert.equal(b.nodes.startup.hidden, false);
    assert.equal(b.nodes['startup-retry'].hidden, false); assert.equal(b.game.inert, true);
    b.click('startup-retry'); assert.equal(b.reloads(), 1);
  }
  const slow = setup(); [...slow.timers.values()][0]();
  assert.equal(slow.nodes.startup.dataset.phase, 'loading'); assert.match(slow.nodes['startup-status'].textContent, /仍在準備中/);
  assert.equal(slow.nodes['startup-retry'].hidden, false);
  slow.ready(); slow.tick(); slow.tick(); slow.tick(); assert.equal(slow.nodes.startup.dataset.phase, 'welcome');
  console.log('D091 Plan A PASS: exact263 source; observer-only shell; two paint opportunities; single dismiss; input/focus shielding and cleanup; direct parameters; truthful journal, error and slow retry states');
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await startupGuards();

// D091 reduced-motion repair (owner 2026-10-28 「先修再給你看圖」): source complement to the Chromium
// computed-geometry scenario D091-390-reduced-motion-loading-control. Kept outside startupGuards(),
// which the browser tool runs first, so that tool still reaches the scenario and records its own red.
export function reducedMotionGuards() {
  const rule = html.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\.startup-loader i \{([^}]*)\}\s*\}/)?.[1];
  assert.ok(rule, 'reduced-motion rule for the startup loader indicator');
  assert.match(rule, /animation: none/, 'no motion');
  assert.doesNotMatch(rule, /width:\s*100%/, 'reduced motion must not draw a full-width bar that reads as completed');
  assert.doesNotMatch(rule, /display:\s*none|visibility:\s*hidden/, 'the static indicator stays visible');
  assert.match(rule, /margin:\s*0 auto/, 'short segment centred in the track, not a fill level from the track start');
  assert.match(rule, /background:\s*repeating-linear-gradient\(/, 'segmented pattern, not a solid fill');
  console.log('D091 reduced-motion PASS: static loader rule has no animation and no full-width completion cue; centred segmented indicator');
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) reducedMotionGuards();

// D091 loading-motion refinement (owner 2026-10-28 「對照圖的動畫還可以精修一下，參考 town lab」): source complement to
// the Chromium scenario D091-loading-motion-frames. The scene ambience is ported from Lab main dde12ad index.html #boot453
// (boot453Windows lit windows, boot453Glow ground glow) and must name that source; every startup keyframe may only touch
// transform/opacity (compositor-eligible); ambience runs only without a reduced-motion preference; nothing reads as progress.
export function loadingMotionGuards() {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const startupCss = css.slice(css.indexOf('#startup {'));
  const keyframes = [...startupCss.matchAll(/@keyframes (startup-[\w-]+) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
  assert.ok(keyframes.length >= 2, 'startup ambience keyframes besides the rail light');
  for (const [, name, body] of keyframes) {
    const props = [...body.matchAll(/([\w-]+)\s*:/g)].map(m => m[1]);
    assert.ok(props.length && props.every(p => p === 'transform' || p === 'opacity'), `${name} animates only transform/opacity: ${props}`);
  }
  const gate = startupCss.match(/@media \(prefers-reduced-motion: no-preference\) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/)?.[1];
  assert.ok(gate, 'scene ambience is gated behind prefers-reduced-motion: no-preference');
  assert.match(gate, /\.startup-houses i::after \{[^}]*animation: startup-/, 'window lights animate (Lab boot453Windows)');
  assert.match(gate, /animation: startup-breathe/, 'glow breathes (Lab boot453Glow)');
  const outside = startupCss.replace(gate, '').match(/animation:(?!\s*none\b)[^;]*;/g) || [];
  assert.deepEqual(outside.map(s => s.trim()), [outside.find(s => /startup-drift/.test(s))].filter(Boolean), 'only the rail light animates outside the no-preference gate (it keeps its own reduced-motion override)');
  assert.match(startupCss, /Lab main dde12ad index\.html #boot453/, 'ported ambience names its Lab source commit and element');
  const loader = html.match(/<div class="startup-loader"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.doesNotMatch(loader, /%|role="progressbar"|aria-value/, 'indeterminate: no percentage or progress value');
  console.log('D091 loading-motion PASS: Lab #boot453 source named; startup keyframes transform/opacity only; ambience gated by no-preference; no progress value');
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) loadingMotionGuards();

// D091 loading-motion scope (independent review 2026-10-28; owner 「其它的沒問題」): the Lab-referenced ambience belongs to
// the loading phase only. Outside the no-preference gate the scene is byte-for-byte the 10707fc scene (the original lit
// windows stay in the house background; no halo, glow or window layer is generated), so reduced motion, the welcome and
// the error screen look exactly as before. Also closes gaps the review found: longhand animation-name outside the gate,
// keyframes under any name, a full-width rail light, and the 4px square reduced-motion dashes.
export function loadingScopeGuards() {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const startupCss = css.slice(css.indexOf('#startup {'));
  const gate = startupCss.match(/@media \(prefers-reduced-motion: no-preference\) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/)?.[1];
  assert.ok(gate, 'ambience gate present');
  for (const [, selectors] of gate.matchAll(/([^{}]+)\{[^{}]*\}/g))
    for (const s of selectors.split(',').map(x => x.trim()))
      assert.ok(s.startsWith('#startup[data-phase="loading"] '), `ambience is scoped to the loading phase: ${s}`);
  const outside = startupCss.replace(gate, '');
  assert.doesNotMatch(outside, /(?:\.startup-moon::after|\.startup-scene::before|\.startup-houses i::after)[^{]*\{[^}]*content:/, 'no halo, glow or window layer outside the loading gate');
  assert.ok(startupCss.includes('.startup-houses i { position: relative; flex: 1; height: 130px; background: repeating-linear-gradient(90deg, transparent 0 20px, #e5c37d 20px 30px, transparent 30px 45px) center 35px / 100% 13px no-repeat, #46616a; border-top: 18px solid #24353c; box-shadow: 0 24px 0 #0f232c; }'), 'house windows exactly as 10707fc');
  assert.doesNotMatch(outside, /animation-name:(?!\s*none\b)/, 'no longhand animation-name outside the gate');
  for (const [, name, body] of startupCss.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    const props = [...body.matchAll(/([\w-]+)\s*:/g)].map(m => m[1]);
    assert.ok(props.length && props.every(p => p === 'transform' || p === 'opacity'), `${name} animates only transform/opacity: ${props}`);
  }
  const light = startupCss.match(/\.startup-loader i \{([^}]*)\}/)[1];
  assert.ok(+light.match(/width:\s*(\d+)%/)?.[1] < 50, 'the travelling light is a short segment, never a fill');
  const rm = html.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\.startup-loader i \{([^}]*)\}\s*\}/)[1];
  assert.match(rm, /border-radius: 0/, 'reduced-motion dashes are square-ended');
  assert.match(rm, /center \/ 100% 4px no-repeat/, 'reduced-motion dashes are 4px tall inside the 8px rail');
  console.log('D091 loading-scope PASS: ambience only in the loading phase; 10707fc scene outside it; no longhand or foreign keyframes; short light; 4px square dashes');
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) loadingScopeGuards();
