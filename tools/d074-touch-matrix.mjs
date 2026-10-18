// D074 recovery: bounded input-observer ablation and CPU stress matrix.
// Sixteen fresh sessions: timer observer off/on × touch observer off/on × CPU
// rate 1/6, two fixed counterbalanced replicates. No retry, synthetic activation,
// added gesture sleep, production change, or claim of forced Chrome interleaving.
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

const J = JSON.stringify, OUT = path.join(ROOT, 'scratch/d074-touch-matrix');
const SELECTOR = '#cm li[data-kind="offer"][data-k="happy70"] button';
const sha = value => createHash('sha256').update(value).digest('hex');
const historicalSource = fs.readFileSync(path.join(ROOT, 'tools/smoke-d052.mjs'), 'utf8');
// Execute the historical pointer-only INPUT string verbatim. In observer-OFF /
// touch-OFF cells no additional event listeners or timer wrappers are installed.
const historicalInput = historicalSource.match(/^const INPUT = `([^`]+)`;/m)?.[1];
assert.ok(historicalInput, 'historical D052 INPUT string must be found verbatim');
const CELLS = [
  { timer: false, touch: false, rate: 1 }, { timer: true, touch: true, rate: 6 },
  { timer: false, touch: true, rate: 1 }, { timer: true, touch: false, rate: 6 },
  { timer: true, touch: false, rate: 1 }, { timer: false, touch: true, rate: 6 },
  { timer: true, touch: true, rate: 1 }, { timer: false, touch: false, rate: 6 },
];
const MATRIX = [CELLS, [...CELLS].reverse()].flatMap((cells, repeat) => cells.map(cell => ({ ...cell, repeat: repeat + 1 })));

// No geometry, hit testing, computed style, stack creation, MutationObserver,
// or model snapshot is performed by this instrumentation during the gesture.
function installMatrixObserver(options) {
  const originalTimeout = window.setTimeout, originalClear = window.clearTimeout;
  const entries = [], listeners = [], tracked = new Set();
  let armed = true, sequence = 0, dispatch = null;
  const describe = target => {
    const button = target?.closest?.('button');
    return { tag: target?.tagName ?? '', id: target?.id ?? '', key: button?.closest('[data-k]')?.dataset.k ?? '' };
  };
  const record = (kind, data = {}) => { if (armed) entries.push({ seq: ++sequence, now: performance.now(), kind, ...data }); };
  const order = () => [...document.querySelectorAll('#cm li[data-kind="offer"]')].map(e => e.dataset.k);
  const add = (type, callback, listenerOptions) => {
    window.addEventListener(type, callback, listenerOptions); listeners.push({ type, callback, listenerOptions });
  };
  if (options.timer) {
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'click']) {
      add(type, event => {
        dispatch = { type, pointerId: event.pointerId ?? null, target: describe(event.target) };
        record('pointer-event', { ...dispatch, trusted: event.isTrusted, eventTimeStamp: event.timeStamp,
          originalTraceIndex: (window.__d052Extra?.length ?? 0) - 1 });
      }, true);
      add(type, () => { dispatch = null; }, false);
    }
    window.setTimeout = function (callback, delay, ...args) {
      if (!armed || Number(delay ?? 0) !== 0 || typeof callback !== 'function') {
        return Reflect.apply(originalTimeout, this, [callback, delay, ...args]);
      }
      const origin = dispatch; let id;
      const wrapped = function (...values) {
        record('timer-fire-before', { timerId: id, order: order() });
        try { return Reflect.apply(callback, this, values); }
        finally { record('timer-fire-after', { timerId: id, order: order() }); tracked.delete(id); }
      };
      id = Reflect.apply(originalTimeout, this, [wrapped, delay, ...args]);
      tracked.add(id); record('timer-scheduled', { timerId: id, delay: Number(delay ?? 0), origin }); return id;
    };
    window.clearTimeout = function (id) {
      if (armed && tracked.has(id)) { record('timer-cleared', { timerId: id }); tracked.delete(id); }
      return Reflect.apply(originalClear, this, [id]);
    };
  }
  if (options.touch) for (const type of ['touchstart', 'touchend']) {
    add(type, event => record('touch-event', { type, target: describe(event.target), trusted: event.isTrusted,
      eventTimeStamp: event.timeStamp, defaultPrevented: event.defaultPrevented }), { capture: true, passive: true });
  }
  window.__d074TouchMatrix = {
    stop() {
      armed = false;
      for (const { type, callback, listenerOptions } of listeners) window.removeEventListener(type, callback, listenerOptions);
      if (options.timer) { window.setTimeout = originalTimeout; window.clearTimeout = originalClear; }
      return { entries, restoredMethods: window.setTimeout === originalTimeout && window.clearTimeout === originalClear,
        additionalListeners: listeners.length, timerWrapped: options.timer, touchObserved: options.touch };
    },
  };
}

function analyse(trial) {
  const entries = trial.observation?.entries ?? [];
  const up = entries.find(e => e.kind === 'pointer-event' && e.type === 'pointerup');
  const click = entries.find(e => e.kind === 'pointer-event' && e.type === 'click');
  const changed = entries.filter(e => {
    if (e.kind !== 'timer-fire-after' || !up || !click || e.seq <= up.seq || e.seq >= click.seq) return false;
    const before = entries.find(b => b.kind === 'timer-fire-before' && b.timerId === e.timerId);
    return !!before && J(before.order) !== J(e.order);
  }).map(e => e.timerId);
  return {
    originalHeldEvents: (trial.originalInput ?? []).slice(trial.inputStart ?? 0),
    firstNativeClick: (trial.originalInput ?? []).slice(trial.inputStart ?? 0).find(e => e.type === 'click') ?? null,
    pointerupToClickMs: up && click ? click.now - up.now : null,
    timerOrderingObservable: trial.factors.timer,
    zeroTimeoutChangedCommissionOrderBeforeClick: trial.factors.timer ? changed.length > 0 : null,
    orderChangingTimerIds: changed,
  };
}

export async function collectD074TouchMatrix(browser = withBrowser, out = OUT) {
  fs.mkdirSync(out, { recursive: true });
  const report = {
    title: 'D074 original held-touch observer/CPU matrix', kind: 'bounded-observer-ablation-and-stress',
    plannedTrials: MATRIX.length, matrix: MATRIX,
    historicalInputSha256: sha(historicalInput), originalInputCopiedVerbatim: true,
    unchangedGestureTiming: { beforeSettlementMs: 50, afterReleaseAssertionMs: 200 },
    cpuProtocol: { method: 'Emulation.setCPUThrottlingRate', rates: [1, 6],
      source: 'https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Emulation.pdl',
      meaning: 'General slowdown factor; does not selectively delay click or force timer/input task ordering.' },
    limitations: ['Chrome CDP touch emulation, not Android hardware.',
      'This matrix cannot deterministically force native input/timer interleaving. All passes remain inconclusive about the historical failure.',
      'Even minimal observers may alter timing. The matched observer-OFF cells measure that possibility.',
      'CPU throttling may change total held duration despite unchanged explicit sleeps; it is an intentional stress factor.',
      'Timer-OFF cells preserve the original pointer-only INPUT exactly and cannot establish timer callback ordering.'],
    sources: Object.fromEntries(['src/ui/panelPress.ts', 'tools/smoke-d052.mjs', 'dist/index.html'].map(file => [file, sha(fs.readFileSync(path.join(ROOT, file)))])),
    trials: [],
  };
  const cellKey = f => `timer${Number(f.timer)}-touch${Number(f.touch)}-cpu${f.rate}`;
  const write = () => {
    report.summary = {
      collected: report.trials.length, planned: MATRIX.length,
      passed: report.trials.filter(t => t.status === 'passed').length,
      observedFailures: report.trials.filter(t => t.status === 'observed-failure').length,
      invalidSetups: report.trials.filter(t => t.status === 'invalid-setup').length,
      timerOrderObserved: report.trials.filter(t => t.analysis?.zeroTimeoutChangedCommissionOrderBeforeClick).map(t => t.id),
      byCell: Object.fromEntries(CELLS.map(f => [cellKey(f), report.trials.filter(t => cellKey(t.factors) === cellKey(f)).map(t => ({
        id: t.id, repeat: t.factors.repeat, status: t.status, clickKey: t.analysis?.firstNativeClick?.k ?? null,
        timerOrderObserved: t.analysis?.zeroTimeoutChangedCommissionOrderBeforeClick ?? null,
      }))])),
    };
    fs.writeFileSync(path.join(out, 'evidence.json'), J(report, null, 2) + '\n');
  };
  write();
  for (const [index, factors] of MATRIX.entries()) {
    const trial = { id: `run-${String(index + 1).padStart(2, '0')}-${cellKey(factors)}-r${factors.repeat}`,
      factors, status: 'invalid-setup', stage: 'setup' };
    try {
      await browser({ width: 960, height: 900 }, async ({ open, page }) => {
        trial.version = await page.send('Browser.getVersion');
        const p = await pageSession(page, open, { W: 412, H: 860 });
        await loadD052(p, 'progress'); await p.ev(historicalInput);
        try {
          const code = mk(1, 50, '委託換位驗收', b => { b.road(4, 30, 60, 30, 3).put(3, 30, 5); for (let x = 10; x <= 41; x++) b.put(x, 29, 1, 1, { den: 3 }); }, { rk: 2, money: 10000 });
          await p.open('sample=seed516&clean=1');
          await p.ev(`__gt.clearSave();localStorage.setItem(${J(D052_SAVE_KEY)},${J(code)})`); await p.open(''); await p.ev(historicalInput);
          await p.ev('__gt.saveNow()'); await p.ev('__gt.journalFlush()');
          await tapD052(p, '#menuBtn'); await tapD052(p, '#menu [data-m="commission"]');
          assert.deepEqual(await p.ev("__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)"), ['trade1200', 'happy70']);
          await p.ev(`document.querySelector(${J(SELECTOR)}).scrollIntoView({block:'center'});window.__offer=document.querySelector(${J(SELECTOR)});__offer.focus();window.__offerScroll=document.querySelector('#cm .body').scrollTop`);
          await p.frames(2); assert.equal(await p.ev('typeof Element.prototype.moveBefore'), 'function');
          // Set the assigned rate before the gesture, identically in all cells;
          // no CDP scheduling/debugger command is inserted during native release.
          await page.send('Emulation.setCPUThrottlingRate', { rate: factors.rate }); trial.cpuRateApplied = factors.rate;
          const heldRect = await p.rectOf(SELECTOR), at = await p.center(SELECTOR), start = await p.ev('__d052Extra.length');
          trial.heldRect = heldRect; trial.point = at; trial.inputStart = start; trial.fixtureSha256 = sha(code);
          await p.ev(`(${installMatrixObserver.toString()})(${J(factors)})`); trial.stage = 'native-gesture';
          await p.touch('touchStart', [at]); await sleep(50); await p.ev('__gt.simStep(1)');
          const { KT, vrank } = builtBase(), control = loadCode(code, KT, vrank); assert.ok(control.ok); stepDay(control.sim);
          assert.deepEqual(commissionOffers(control.sim).map(c => c.id), ['happy70', 'steel40', 'trade1200']);
          assert.deepEqual(await p.ev("__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)"), ['trade1200', 'happy70'], 'held presentation stays in original positions');
          assert.deepEqual(await p.rectOf(SELECTOR), heldRect, 'held target rectangle remains fixed');
          assert.equal((await p.ev('__gt.techState()')).rank, 3); assert.equal((await p.ev('__gt.techState()')).day, 51);
          assert.equal(await p.ev(`__offer===document.querySelector(${J(SELECTOR)})&&__offer.isConnected&&document.activeElement===__offer`), true, 'held offer keeps identity and focus');
          assert.equal(await p.ev("document.querySelector('#cm .body').scrollTop===__offerScroll"), true, 'held offer keeps scroll');
          trial.stage = 'native-release';
          await p.touch('touchEnd', []); await sleep(200); trial.actualCommission = await p.ev('__gt.simCms()');
          assert.equal(trial.actualCommission.act, 'happy70', 'native release accepts same offer using updated index0');
          const trace = await p.ev(`__d052Extra.slice(${start})`);
          for (const type of ['pointerdown', 'gotpointercapture', 'pointerup', 'lostpointercapture', 'click']) {
            assert.ok(trace.some(e => e.type === type && e.trusted && e.k === 'happy70'), J(trace));
          }
          assert.equal(trace.filter(e => e.type === 'click' && e.k === 'happy70').length, 1);
          trial.acceptHistoryCount = await p.ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='accept'&&e.id==='happy70').length");
          assert.equal(trial.acceptHistoryCount, 1); trial.status = 'passed';
        } catch (error) {
          trial.status = error.code === 'ERR_ASSERTION' && trial.stage !== 'setup' ? 'observed-failure' : 'invalid-setup';
          trial.error = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack };
        } finally {
          // Collect after the original 200 ms assertion even when it fails.
          // No outcome-triggered repeat, release, click, or extra grace period.
          const result = await p.ev(`({input:window.__d052Extra??[],observation:window.__d074TouchMatrix?.stop()??null,finalCommission:__gt.simCms(),acceptHistoryCount:__gt.history().filter(e=>e.t==='cms'&&e.ev==='accept'&&e.id==='happy70').length})`);
          trial.originalInput = result.input; trial.observation = result.observation;
          trial.finalCommission = result.finalCommission; trial.finalAcceptHistoryCount = result.acceptHistoryCount;
          trial.analysis = analyse(trial); trial.errors = [...page.errors];
          trial.external = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
          await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }); trial.cpuRateRestored = true;
          if (!trial.observation?.restoredMethods || trial.errors.length || trial.external.length) {
            trial.status = 'invalid-setup'; trial.cleanupError = 'Observer cleanup/page error/external request invariant failed';
          }
        }
      });
    } catch (error) {
      trial.status = 'invalid-setup'; trial.error ??= { name: error.name, message: error.message, stack: error.stack };
    }
    trial.artifact = `${trial.id}.json`;
    fs.writeFileSync(path.join(out, trial.artifact), J(trial, null, 2) + '\n'); report.trials.push(trial); write();
    console.log(`${trial.status === 'passed' ? 'OBSERVED PASS' : trial.status === 'observed-failure' ? 'OBSERVED FAILURE' : 'INVALID SETUP'} ${trial.id}: ${trial.error?.message ?? trial.cleanupError ?? 'original held-touch invariants satisfied'}; artifact=${path.join(out, trial.artifact)}`);
  }
  console.log(J({ ...report.summary, artifact: path.join(out, 'evidence.json'), deterministicInterleavingForced: false }, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await collectD074TouchMatrix();
  process.exitCode = report.summary.observedFailures || report.summary.invalidSetups || report.summary.collected !== MATRIX.length ? 1 : 0;
}
