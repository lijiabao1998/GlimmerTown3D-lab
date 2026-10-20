// D081 diagnostic only. This module does not launch Chrome or alter production.
import fs from 'node:fs';
import path from 'node:path';

const J = JSON.stringify;
let destination = null, nextSession = 0;
const sessions = [];
const errorRecord = error => ({ name: error?.name ?? '', message: error?.message ?? String(error), stack: error?.stack ?? '' });

// Installed before application scripts, but armed only by a trusted pointerdown
// on the happy70 offer. Touch/lifecycle listeners are added. No layout/hit tests, stack collection,
// MutationObserver, synthetic input, new task, or added gesture wait.
function installReleaseTrace() {
  const nativeTimeout = window.setTimeout, nativeClear = window.clearTimeout;
  const entries = [], tracked = new Set();
  let armed = false, sequence = 0, gesture = 0, dispatch = null;
  const target = node => {
    const button = node?.closest?.('button');
    return { tag: node?.tagName ?? '', id: node?.id ?? '', key: button?.closest('[data-k]')?.dataset.k ?? '' };
  };
  const record = (kind, data = {}) => entries.push({ seq: ++sequence, now: performance.now(), gesture, kind, ...data });
  // These are the only DOM-order reads in the observer, immediately around an
  // actual zero-timeout callback. They do not ask for style or geometry.
  const order = () => [...document.querySelectorAll('#cm li[data-kind="offer"]')].map(row => row.dataset.k);
  const types = ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'click', 'touchstart', 'touchend', 'touchcancel', 'blur', 'pagehide', 'visibilitychange'];
  for (const type of types) {
    window.addEventListener(type, event => {
      if (type === 'pointerdown' && event.isTrusted && event.button === 0 &&
          event.target?.closest?.('#cm li[data-kind="offer"][data-k="happy70"] button')) {
        armed = true; gesture++;
        record('armed', { pointerId: event.pointerId, originalInputLength: window.__d052Extra?.length ?? 0 });
      }
      if (!armed) return;
      dispatch = event;
      record('pointer-event', { phase: 'capture', type, target: target(event.target), pointerId: event.pointerId ?? null,
        pointerType: event.pointerType ?? '', trusted: event.isTrusted, eventTimeStamp: event.timeStamp,
        originalInputLength: window.__d052Extra?.length ?? 0, touches: event.touches?.length ?? null, hidden: document.hidden });
    }, true);
    window.addEventListener(type, event => {
      if (!armed) return;
      record('pointer-event', { phase: 'bubble', type, target: target(event.target), pointerId: event.pointerId ?? null,
        pointerType: event.pointerType ?? '', trusted: event.isTrusted, eventTimeStamp: event.timeStamp,
        originalInputLength: window.__d052Extra?.length ?? 0 });
      if (dispatch === event) dispatch = null;
    }, false);
  }
  window.setTimeout = function (callback, delay) {
    // Forward the original arguments and receiver. Only the gate's literal 0
    // (or an omitted delay) is observed; no delay coercion or adjustment.
    if (!armed || typeof callback !== 'function' || (delay !== 0 && delay !== undefined)) {
      return Reflect.apply(nativeTimeout, this, arguments);
    }
    const active = dispatch?.eventPhase ? dispatch : null;
    const origin = active ? { type: active.type, pointerId: active.pointerId ?? null, target: target(active.target) } : null;
    let id;
    const args = Array.from(arguments);
    args[0] = function () {
      record('timer-fire-before', { timerId: id, order: order(), hidden: document.hidden });
      try { return Reflect.apply(callback, this, arguments); }
      finally { record('timer-fire-after', { timerId: id, order: order(), hidden: document.hidden }); tracked.delete(id); }
    };
    id = Reflect.apply(nativeTimeout, this, args);
    tracked.add(id); record('timer-scheduled', { timerId: id, delay: delay ?? 0, origin });
    return id;
  };
  window.clearTimeout = function (id) {
    if (armed && tracked.has(id)) { record('timer-cleared', { timerId: id }); tracked.delete(id); }
    return Reflect.apply(nativeClear, this, arguments);
  };
  window.__d081ReleaseTrace = { snapshot: () => ({ armed, gestures: gesture, entries }) };
}

export const RELEASE_TRACE_PRELOAD = `;(${installReleaseTrace.toString()})();`;
const SNAPSHOT = `({url:location.href,userAgent:navigator.userAgent,trace:window.__d081ReleaseTrace?.snapshot()??null,originalInput:window.__d052Extra??[]})`;

export function configureReleaseTrace(out) {
  if (destination !== null) throw new Error('D081 release trace may be configured only once per process');
  fs.mkdirSync(out, { recursive: true }); destination = out;
}

export function releaseTraceSummary() {
  return sessions.map(session => ({ id: session.id, file: session.file, status: session.status,
    snapshots: session.snapshots.length, armedSnapshots: session.snapshots.filter(s => s.page?.trace?.armed).length,
    callbackError: session.callbackError ?? null, browserError: session.browserError ?? null,
    captureErrors: session.captureErrors }));
}

// Wrap only the browser function handed to d052Smoke. Its existing legacy-art
// wrapper, options, callback, native input, and assertions remain in control.
export function diagnosticBrowser(browser) {
  if (!destination) throw new Error('configureReleaseTrace must run before diagnosticBrowser');
  return async (options, callback) => {
    const id = `session-${String(++nextSession).padStart(3, '0')}`;
    const session = { id, file: `${id}.json`, status: 'starting', options: { ...options },
      startedAt: new Date().toISOString(), snapshots: [], captureErrors: [] };
    sessions.push(session);
    const persist = () => fs.writeFileSync(path.join(destination, session.file), J(session, null, 2) + '\n');
    persist();
    try {
      const result = await browser({ ...options, preload: (options.preload ?? '') + '\n' + RELEASE_TRACE_PRELOAD }, async context => {
        const { page, open } = context;
        const capture = async (reason, extra = {}) => {
          try {
            const snapshot = await page.evaluate(SNAPSHOT);
            session.snapshots.push({ reason, at: new Date().toISOString(), ...extra, page: snapshot });
            persist();
          } catch (error) {
            session.captureErrors.push({ reason, error: errorRecord(error) });
            throw error;
          }
        };
        const tracedOpen = async query => {
          await capture('before-navigation', { nextQuery: query });
          return open(query);
        };
        session.status = 'callback-running'; persist();
        let value, failure, failed = false;
        try { value = await callback({ ...context, open: tracedOpen }); }
        catch (error) { failed = true; failure = error; session.callbackError = errorRecord(error); }
        // The historical D052 runner catches its assertions internally. Thus
        // callback-returned is not a claim that its checks passed; raw checks
        // and original exit status are retained by the launcher separately.
        session.status = failed ? 'callback-threw' : 'callback-returned';
        try {
          await capture('callback-end', { callbackThrew: failed });
          session.version = await page.send('Browser.getVersion');
        } catch (error) {
          if (!failed) { failed = true; failure = error; }
        }
        session.pageErrors = [...page.errors];
        session.externalRequests = page.requests.filter(url => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(url));
        try { persist(); } catch (error) { if (!failed) { failed = true; failure = error; } }
        // Rethrow the identical original object, never convert failure to green
        // or replace an original callback error with a later capture error.
        if (failed) throw failure;
        return value;
      });
      session.status = 'browser-returned'; session.endedAt = new Date().toISOString(); persist();
      return result;
    } catch (error) {
      session.status = 'browser-threw'; session.browserError = errorRecord(error); session.endedAt = new Date().toISOString();
      try { persist(); } catch (writeError) { console.error('D081 trace persistence failed:', writeError); }
      throw error;
    }
  };
}
