// Bounded observation of the unchanged historical D052 native-touch scenario.
// This is evidence collection, not a substitute for the historical smoke gate.
// No production patch, synthetic activation, repeated tap, or timing extension.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { loadD052, tapD052 } from './d052-capture.mjs';
import { D052_SAVE_KEY } from './d052-scenes.mjs';
import { mk } from './d034-cities.mjs';
import { builtBase } from './d036-cities.mjs';
import { loadCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { commissionOffers } from '../src/sim/edit.ts';

const J = JSON.stringify, TRIALS = 12;
const SELECTOR = '#cm li[data-kind="offer"][data-k="happy70"] button';
const OUT = path.join(ROOT, 'scratch/d074-touch-diagnostic');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Installed before page scripts, armed only after fixture/layout preparation.
// Native methods receive the same callback arguments and timer delay. Only
// zero-delay callbacks are wrapped. Snapshot reads can affect timing; evidence
// explicitly reports that observation limitation rather than claiming otherwise.
function installDiagnostic(selector) {
  const originalTimeout = window.setTimeout, originalClear = window.clearTimeout;
  const entries = [], timers = new Map(), listeners = [];
  let armed = false, observer = null, sequence = 0, point = null;
  const describe = node => {
    if (!node) return null;
    const element = node.nodeType === 1 ? node : node.parentElement;
    const button = element?.closest?.('button');
    return { tag: element?.tagName ?? node.nodeName ?? '', id: element?.id ?? '',
      class: typeof element?.className === 'string' ? element.className : '',
      buttonId: button?.id ?? '', buttonKey: button?.closest('[data-k]')?.dataset.k ?? '',
      rowKey: element?.closest?.('[data-k]')?.dataset.k ?? '' };
  };
  const snapshot = () => {
    const held = document.querySelector(selector), rect = held?.getBoundingClientRect();
    return {
      order: [...document.querySelectorAll('#cm li[data-kind="offer"]')].map(e => e.dataset.k),
      heldRect: rect ? { l: rect.left, t: rect.top, r: rect.right, b: rect.bottom, w: rect.width, h: rect.height } : null,
      heldConnected: !!held?.isConnected, heldFocused: !!held && document.activeElement === held,
      scrollTop: document.querySelector('#cm .body')?.scrollTop ?? null,
      hitAtOriginalPoint: point ? describe(document.elementFromPoint(point[0], point[1])) : null,
      activeCommission: window.__gt?.simCms?.().act ?? null,
    };
  };
  const record = (kind, detail = {}) => {
    if (armed) entries.push({ seq: ++sequence, now: performance.now(), kind, ...detail, snapshot: snapshot() });
  };
  window.setTimeout = function (callback, delay, ...args) {
    if (!armed || Number(delay ?? 0) !== 0 || typeof callback !== 'function') {
      return Reflect.apply(originalTimeout, this, [callback, delay, ...args]);
    }
    const stack = new Error('zero-timeout scheduled here').stack;
    let id;
    const wrapped = function (...values) {
      record('zero-timeout-fire-before', { timerId: id });
      try { return Reflect.apply(callback, this, values); }
      finally { record('zero-timeout-fire-after', { timerId: id }); timers.delete(id); }
    };
    id = Reflect.apply(originalTimeout, this, [wrapped, delay, ...args]);
    timers.set(id, true); record('zero-timeout-scheduled', { timerId: id, delay: Number(delay ?? 0), stack });
    return id;
  };
  window.clearTimeout = function (id) {
    if (armed && timers.has(id)) { record('zero-timeout-cleared', { timerId: id }); timers.delete(id); }
    return Reflect.apply(originalClear, this, [id]);
  };
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture',
    'touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click', 'contextmenu', 'blur', 'pagehide', 'visibilitychange']) {
    for (const capture of [true, false]) {
      const listener = event => record(capture ? 'event-capture' : 'event-bubble', {
        type, trusted: event.isTrusted, eventTimeStamp: event.timeStamp, target: describe(event.target),
        path: event.composedPath().slice(0, 6).map(describe),
        pointerId: event.pointerId ?? null, pointerType: event.pointerType ?? null,
        clientX: event.clientX ?? null, clientY: event.clientY ?? null,
        defaultPrevented: event.defaultPrevented, cancelable: event.cancelable,
      });
      window.addEventListener(type, listener, capture); listeners.push({ type, listener, capture });
    }
  }
  window.__d074TouchDiagnostic = {
    arm(at) {
      point = at; armed = true;
      observer = new MutationObserver(records => record('commission-mutation-batch', {
        count: records.length,
        mutations: records.slice(0, 80).map(r => ({ type: r.type, target: describe(r.target),
          attribute: r.attributeName, added: r.addedNodes.length, removed: r.removedNodes.length })),
      }));
      observer.observe(document.querySelector('#cm'), { subtree: true, childList: true, attributes: true, characterData: true });
      record('armed');
    },
    stop() {
      record('stopped'); armed = false; observer?.disconnect();
      window.setTimeout = originalTimeout; window.clearTimeout = originalClear;
      for (const { type, listener, capture } of listeners) window.removeEventListener(type, listener, capture);
      return { entries, final: snapshot(), restoredMethods: window.setTimeout === originalTimeout && window.clearTimeout === originalClear };
    },
  };
}

function analyseTrace(trace) {
  const events = trace.entries.filter(e => e.kind === 'event-capture');
  const up = events.find(e => e.type === 'pointerup'), click = events.find(e => e.type === 'click');
  const orderChangingTimersBeforeClick = trace.entries.filter(e => {
    if (e.kind !== 'zero-timeout-fire-after' || !up || !click || e.seq <= up.seq || e.seq >= click.seq) return false;
    const before = trace.entries.find(b => b.kind === 'zero-timeout-fire-before' && b.timerId === e.timerId);
    return !!before && J(before.snapshot.order) !== J(e.snapshot.order);
  }).map(e => e.timerId);
  return {
    firstClickTarget: click?.target ?? null,
    pointerupToClickMs: up && click ? click.now - up.now : null,
    orderChangingTimersBeforeClick,
    zeroTimeoutChangedCommissionOrderBeforeClick: orderChangingTimersBeforeClick.length > 0,
    mutationBatches: trace.entries.filter(e => e.kind === 'commission-mutation-batch').length,
  };
}

export async function collectD074TouchDiagnostic(browser = withBrowser, out = OUT) {
  fs.mkdirSync(out, { recursive: true });
  const report = {
    title: 'D074 recovery: unchanged D052 native release ordering',
    kind: 'diagnostic-collection-not-release-gate', plannedTrials: TRIALS,
    unchangedTiming: { originalPreSettlementHoldMs: 50, originalPostReleaseAssertionMs: 200 },
    limitations: ['Chrome CDP touch emulation, not Android hardware.',
      'Event/layout/timer observation may affect scheduling; no delay, callback order, or activation is intentionally changed.',
      'Mutation batches are observable DOM changes, not a count of private render function calls.'],
    sources: Object.fromEntries(['src/ui/panelPress.ts', 'tools/smoke-d052.mjs', 'dist/index.html'].map(file => [file, sha(fs.readFileSync(path.join(ROOT, file)))])),
    trials: [],
  };
  const write = () => {
    report.summary = {
      collected: report.trials.length, planned: TRIALS,
      passed: report.trials.filter(t => t.status === 'passed').length,
      observedFailures: report.trials.filter(t => t.status === 'observed-failure').length,
      invalidSetups: report.trials.filter(t => t.status === 'invalid-setup').length,
      timerOrderObserved: report.trials.filter(t => t.analysis?.zeroTimeoutChangedCommissionOrderBeforeClick).map(t => t.id),
      failedTrials: report.trials.filter(t => t.status !== 'passed').map(t => ({ id: t.id, status: t.status, error: t.error?.message })),
    };
    fs.writeFileSync(path.join(out, 'evidence.json'), J(report, null, 2) + '\n');
  };
  write();
  for (let i = 1; i <= TRIALS; i++) {
    const trial = { id: `run-${String(i).padStart(2, '0')}`, status: 'invalid-setup', stage: 'setup' };
    try {
      await browser({ width: 960, height: 900 }, async ({ open, page }) => {
        trial.version = await page.send('Browser.getVersion');
        await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installDiagnostic.toString()})(${J(SELECTOR)});` });
        const p = await pageSession(page, open, { W: 412, H: 860 });
        await loadD052(p, 'progress');
        try {
          // Same fixture, navigation, save, panel, focus, and CDP action ordering
          // as tools/smoke-d052.mjs:91–106, including its original 50/200 waits.
          const code = mk(1, 50, '委託換位驗收', b => { b.road(4, 30, 60, 30, 3).put(3, 30, 5); for (let x = 10; x <= 41; x++) b.put(x, 29, 1, 1, { den: 3 }); }, { rk: 2, money: 10000 });
          await p.open('sample=seed516&clean=1');
          await p.ev(`__gt.clearSave();localStorage.setItem(${J(D052_SAVE_KEY)},${J(code)})`); await p.open('');
          await p.ev('__gt.saveNow()'); await p.ev('__gt.journalFlush()');
          await tapD052(p, '#menuBtn'); await tapD052(p, '#menu [data-m="commission"]');
          assert.deepEqual(await p.ev("__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)"), ['trade1200', 'happy70']);
          await p.ev(`document.querySelector(${J(SELECTOR)}).scrollIntoView({block:'center'});window.__offer=document.querySelector(${J(SELECTOR)});__offer.focus();window.__offerScroll=document.querySelector('#cm .body').scrollTop`);
          await p.frames(2); assert.equal(await p.ev('typeof Element.prototype.moveBefore'), 'function');
          const heldRect = await p.rectOf(SELECTOR), at = await p.center(SELECTOR);
          trial.heldRect = heldRect; trial.point = at; trial.fixtureSha256 = sha(code);
          await p.ev(`__d074TouchDiagnostic.arm(${J(at)})`); trial.stage = 'native-gesture';
          await p.touch('touchStart', [at]); await sleep(50); await p.ev('__gt.simStep(1)');
          const { KT, vrank } = builtBase(), control = loadCode(code, KT, vrank); assert.ok(control.ok); stepDay(control.sim);
          assert.deepEqual(commissionOffers(control.sim).map(c => c.id), ['happy70', 'steel40', 'trade1200']);
          assert.deepEqual(await p.ev("__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)"), ['trade1200', 'happy70'], 'held presentation stays in original positions');
          assert.deepEqual(await p.rectOf(SELECTOR), heldRect, 'held target rectangle remains fixed');
          assert.equal((await p.ev('__gt.techState()')).rank, 3); assert.equal((await p.ev('__gt.techState()')).day, 51);
          assert.equal(await p.ev(`__offer===document.querySelector(${J(SELECTOR)})&&__offer.isConnected&&document.activeElement===__offer`), true, 'held offer keeps identity and focus');
          assert.equal(await p.ev("document.querySelector('#cm .body').scrollTop===__offerScroll"), true, 'held offer keeps scroll');
          trial.stage = 'native-release';
          await p.touch('touchEnd', []); await sleep(200);
          trial.actualCommission = await p.ev('__gt.simCms()');
          assert.equal(trial.actualCommission.act, 'happy70', 'native release accepts same offer using updated index0');
          trial.acceptHistoryCount = await p.ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='accept'&&e.id==='happy70').length");
          assert.equal(trial.acceptHistoryCount, 1, 'exactly one happy70 acceptance event');
          trial.status = 'passed';
        } catch (error) {
          trial.status = error.code === 'ERR_ASSERTION' && trial.stage !== 'setup' ? 'observed-failure' : 'invalid-setup';
          trial.error = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack };
        } finally {
          trial.trace = await p.ev('__d074TouchDiagnostic.stop()');
          trial.analysis = analyseTrace(trial.trace);
          trial.errors = [...page.errors];
          trial.external = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
          if (trial.status === 'passed') {
            const events = trial.trace.entries.filter(e => e.kind === 'event-capture');
            for (const type of ['pointerdown', 'gotpointercapture', 'pointerup', 'lostpointercapture', 'click']) {
              if (!events.some(e => e.type === type && e.trusted && e.target?.buttonKey === 'happy70')) {
                trial.status = 'observed-failure'; trial.error = { message: `Missing original trusted happy70 ${type}` }; break;
              }
            }
            if (events.filter(e => e.type === 'click' && e.target?.buttonKey === 'happy70').length !== 1) {
              trial.status = 'observed-failure'; trial.error = { message: 'Original exactly-one happy70 click invariant failed' };
            }
          }
          if (!trial.trace.restoredMethods || trial.errors.length || trial.external.length) {
            trial.status = 'invalid-setup'; trial.error = { message: 'Diagnostic cleanup/page error/external request invariant failed' };
          }
        }
      });
    } catch (error) {
      trial.status = 'invalid-setup'; trial.error = { name: error.name, message: error.message, stack: error.stack };
    }
    trial.artifact = `${trial.id}.json`;
    fs.writeFileSync(path.join(out, trial.artifact), J(trial, null, 2) + '\n');
    report.trials.push(trial); write();
    console.log(`${trial.status === 'passed' ? 'OBSERVED PASS' : trial.status === 'observed-failure' ? 'OBSERVED FAILURE' : 'INVALID SETUP'} ${trial.id}: ${trial.error?.message ?? 'original held-touch invariants satisfied'}; artifact=${path.join(out, trial.artifact)}`);
  }
  console.log(J({ ...report.summary, artifact: path.join(out, 'evidence.json'), diagnosticOnly: true }, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await collectD074TouchDiagnostic();
  // Finish all twelve observations even after a failure, then expose every
  // observed failure through the exit status as well as the saved artifacts.
  // This diagnostic cannot substitute for full release-gate success.
  process.exitCode = report.summary.invalidSetups || report.summary.observedFailures || report.summary.collected !== TRIALS ? 1 : 0;
}
