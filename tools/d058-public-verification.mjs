// Isolated, read-only release QA. The app is loaded from GitHub Pages, never localhost.
// Run only in GitHub Actions. Imports and model oracle come from the pinned release checkout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RELEASE = Object.freeze({
  url: 'https://lijiabao1998.github.io/GlimmerTown3D-lab/',
  commit: 'feef2dddd0c1398f9074954ecba6873feb0ae0d8',
  tree: 'ea97761b4038c5825c23fab4eba5f5349a814ff5',
  htmlSha256: 'e672f5f12a7cd1db8962fb984243b33d03d9ad75c59138248f5e3e8143ba92e6',
});
const J = JSON.stringify;
export const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : J(value)).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errorText = e => e?.stack ?? String(e);
const SELF = fileURLToPath(import.meta.url);
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();

export function assertPublicURL(value) {
  const url = new URL(value);
  assert.equal(url.origin, new URL(RELEASE.url).origin, 'exact public HTTPS origin');
  assert.equal(url.pathname, new URL(RELEASE.url).pathname, 'exact released app path');
  assert.equal(url.username + url.password + url.hash, '', 'no credentials or fragment');
  assert.ok(['', '?sample=seed516&clean=1'].includes(url.search), 'only approved fixture navigation query');
  return url.href;
}
export function expectedRequest(value) {
  if (value === 'data:,') return true;
  try { return assertPublicURL(value) === value; } catch { return false; }
}
export function assertReleaseResponse(response, body) {
  assertPublicURL(response.url);
  assert.equal(response.status, 200, 'public response status');
  assert.equal(sha(body), RELEASE.htmlSha256, 'exact approved full HTML bytes');
}
export function sourceManifest(root) {
  const commit = git(root, 'rev-parse', 'HEAD'), tree = git(root, 'rev-parse', 'HEAD^{tree}');
  assert.equal(commit, RELEASE.commit, 'model/helper checkout is the exact approved merge');
  assert.equal(tree, RELEASE.tree, 'approved complete source tree');
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=no'), '', 'release tracked files are unchanged');
  const files = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  return { commit, tree, files: Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])) };
}

// Fetching old HTML is expected while the authorized main deployment is pending.
// Redirects, errors, and hashes remain in the report; no old version can pass.
async function awaitRelease(report, out, flush) {
  const deadline = Date.now() + 90 * 60 * 1000;
  report.releaseWait = { started: new Date().toISOString(), attempts: [] };
  do {
    const attempt = { at: new Date().toISOString() };
    report.releaseWait.attempts.push(attempt);
    try {
      const response = await fetch(RELEASE.url, { redirect: 'error', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
      const body = Buffer.from(await response.arrayBuffer());
      Object.assign(attempt, { url: response.url, status: response.status, bytes: body.length, sha256: sha(body), contentType: response.headers.get('content-type'), etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') });
      if (response.status === 200 && attempt.sha256 === RELEASE.htmlSha256) {
        assertReleaseResponse(response, body);
        assert.match(attempt.contentType ?? '', /^text\/html\b/i);
        fs.writeFileSync(path.join(out, 'public-index.html'), body);
        report.releaseWait.matched = attempt;
        flush();
        return;
      }
    } catch (e) { attempt.error = errorText(e); }
    flush();
    console.log('Await approved public release:', attempt.status ?? 'error', attempt.sha256 ?? attempt.error);
    if (Date.now() < deadline) await sleep(Math.min(60000, deadline - Date.now()));
  } while (Date.now() < deadline);
  throw new Error('Approved public HTML did not appear within the 90-minute deployment observation window');
}

// The inherited launcher exposes its CDP target but not network response events.
// Open an observer on that SAME blank target, then use it for every browser action.
// This loopback endpoint is Chrome control only; the app is never served through it.
async function observedPage(launcherPage, port, log) {
  const target = (await launcherPage.send('Target.getTargetInfo')).targetInfo;
  const devPort = port + 1000 + launcherPage.chrome.tries - 1;
  const targets = await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json();
  const socketURL = targets.find(t => t.id === target.targetId)?.webSocketDebuggerUrl;
  assert.ok(socketURL, 'same inherited Chrome page target found');
  const socket = new WebSocket(socketURL), pending = new Map(), documents = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data), p = message.params;
    if (message.id) {
      const entry = pending.get(message.id);
      if (entry) { clearTimeout(entry.timer); pending.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result); }
      return;
    }
    if (message.method === 'Network.requestWillBeSent') {
      log.requests.push({ requestId: p.requestId, loaderId: p.loaderId, frameId: p.frameId, type: p.type, url: p.request.url, method: p.request.method, initiator: p.initiator, redirect: p.redirectResponse ?? null });
      if (p.type === 'Document') documents.set(p.requestId, { requestId: p.requestId, loaderId: p.loaderId, frameId: p.frameId, url: p.request.url, finished: false });
    }
    if (message.method === 'Network.responseReceived') {
      log.responses.push({ requestId: p.requestId, type: p.type, ...p.response });
      if (documents.has(p.requestId)) documents.get(p.requestId).response = p.response;
    }
    if (message.method === 'Network.loadingFinished' && documents.has(p.requestId)) documents.get(p.requestId).finished = true;
    if (message.method === 'Network.loadingFailed') log.failures.push(p);
    if (message.method === 'Runtime.exceptionThrown') log.errors.push({ type: 'exception', details: p.exceptionDetails });
    if (message.method === 'Runtime.consoleAPICalled') {
      log.console.push(p);
      if (p.type === 'error' || p.type === 'assert') log.errors.push({ type: 'console', details: p });
    }
    if (message.method === 'Log.entryAdded') {
      log.entries.push(p.entry);
      if (p.entry.level === 'error') log.errors.push({ type: 'log', details: p.entry });
    }
    if (message.method === 'Page.javascriptDialogOpening') log.errors.push({ type: 'unexpected dialog', details: p });
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timed out: ' + method)); }, 240000);
    pending.set(id, { resolve, reject, timer });
    socket.send(J({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(J(result.exceptionDetails));
    return result.result.value;
  };
  const close = () => {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('CDP closed')); }
    pending.clear(); socket.close();
  };
  try {
    for (const domain of ['Runtime', 'Log', 'Page', 'Network']) await send(domain + '.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Network.setBypassServiceWorker', { bypass: true });
    return { send, evaluate, close, documents, errors: log.errors, requests: log.requests };
  } catch (e) { close(); throw e; }
}
// Preserve the inherited suite's favicon exception without hiding raw evidence.
// Only the browser's exact root icon request is decoration; app assets and all
// Runtime console/exception errors remain fatal. No request is blocked or fulfilled.
export function networkSummary(log) {
  const faviconURL = new URL('/favicon.ico', RELEASE.url).href;
  const isFavicon = r => r.url === faviconURL && r.type === 'Other' && r.method === 'GET' && r.initiator?.type === 'other' && !r.redirect;
  // CDP reuses requestId for redirects: reject an entire chain if any hop differs.
  const favicon = log.requests.filter(r => isFavicon(r)
    && log.requests.filter(other => other.requestId === r.requestId).every(isFavicon)
    && log.responses.filter(other => other.requestId === r.requestId).every(other => other.url === faviconURL && !(other.status >= 300 && other.status < 400)));
  const ids = new Set(favicon.map(r => r.requestId));
  const faviconError = e => e.type === 'log' && e.details.source === 'network' && favicon.length > 0 && (e.details.url === faviconURL || ids.has(e.details.networkRequestId));
  return {
    appErrors: log.errors.filter(e => !faviconError(e)),
    appFailures: log.failures.filter(e => !ids.has(e.requestId)),
    unexpectedRequests: log.requests.filter(r => !ids.has(r.requestId) && (!expectedRequest(r.url) || r.method !== 'GET' || r.redirect)),
    unsuccessfulResponses: log.responses.filter(r => !ids.has(r.requestId) && (r.status < 200 || r.status >= 300)),
    browserDecoration: { qualification: 'Browser favicon only; retained separately, consistent with the original suite. Not a global zero-resource-error claim.', url: faviconURL, requests: favicon, responses: log.responses.filter(r => ids.has(r.requestId)), failures: log.failures.filter(e => ids.has(e.requestId)), errors: log.errors.filter(faviconError) },
  };
}
function assertNetwork(log) {
  const summary = networkSummary(log);
  assert.deepEqual(summary.appErrors, [], 'zero app runtime, console, dialog, and browser log errors');
  assert.deepEqual(summary.appFailures, [], 'zero app resource loading failures');
  assert.deepEqual(summary.unexpectedRequests, [], 'no unexpected app requests or redirects; no localhost app requests');
  assert.deepEqual(summary.unsuccessfulResponses, [], 'zero unsuccessful app resource responses');
  return summary;
}
async function publicOpen(page, item, query) {
  const url = assertPublicURL(RELEASE.url + (query ? '?' + query : ''));
  const nav = await page.send('Page.navigate', { url });
  assert.ok(!nav.errorText, nav.errorText);
  assert.ok(nav.loaderId, 'full document navigation, not same-document substitution');
  const until = Date.now() + 120000;
  let document;
  while (Date.now() < until) {
    document = [...page.documents.values()].find(d => d.loaderId === nav.loaderId && d.frameId === nav.frameId);
    if (document?.finished && document.response && await page.evaluate('!!(window.__gt && __gt.ready)').catch(() => false)) break;
    await sleep(150);
  }
  assert.ok(document?.finished && document.response, 'main public response finished');
  assert.equal(await page.evaluate('!!(window.__gt && __gt.ready)'), true, 'production WebGL app is ready');
  const bodyResult = await page.send('Network.getResponseBody', { requestId: document.requestId });
  const body = Buffer.from(bodyResult.body, bodyResult.base64Encoded ? 'base64' : 'utf8');
  assertReleaseResponse(document.response, body);
  assert.equal(document.response.securityState, 'secure', 'valid HTTPS browser transport');
  assert.equal(Boolean(document.response.fromServiceWorker), false, 'not service-worker substituted');
  assert.equal(Boolean(document.response.fromDiskCache), false, 'actual network response');
  const actualURL = await page.evaluate('location.href');
  assert.equal(actualURL, url, 'browser is on the exact public navigation URL');
  assert.equal(await page.evaluate('isSecureContext'), true);
  item.navigations.push({ url: actualURL, requestId: document.requestId, loaderId: nav.loaderId, status: document.response.status, htmlSha256: sha(body), bytes: body.length, securityState: document.response.securityState, remoteIPAddress: document.response.remoteIPAddress, protocol: document.response.protocol });
  await sleep(900);
}

export async function verifyPublicRelease() {
  const sourceRoot = path.resolve(process.env.D058_RELEASE_ROOT ?? path.dirname(path.dirname(SELF)));
  const out = path.resolve(process.env.D058_PUBLIC_OUT ?? path.join(sourceRoot, 'scratch/d058-public'));
  fs.mkdirSync(out, { recursive: true });
  const report = { expected: RELEASE, started: new Date().toISOString(), harness: { sha256: sha(fs.readFileSync(SELF)), commit: process.env.GITHUB_SHA ?? null, file: path.basename(SELF) }, qualifications: [
    'Genuine HTTPS GitHub Pages navigation; every main document response hash must equal the approved full HTML.',
    'Exact release checkout supplies unchanged fixtures, original simulator, helpers, and inherited Chrome launcher.',
    'Launcher local static server is unused; no page may request localhost. No response interception or app source substitution.',
    'Isolated disposable browser profiles. Authored synthetic saves only, written to this public origin localStorage.',
    'Trusted CDP desktop mouse / emulated mobile touch; Chrome software WebGL, not physical Android.',
    'Original public debug camera, save, journal and simulation helpers are used. sim() can recompute powerStatus; no claim of globally pure snapshots.',
    'All raw browser observations are retained. Browser favicon decoration is reported separately under the inherited suite exception; no global zero-resource-error claim.',
    'Focused publication verification, not a replacement for full CI, 124 visual pairs, or the approved art review.',
  ], cases: [], passed: false };
  const write = (name, value) => fs.writeFileSync(path.join(out, name), Buffer.isBuffer(value) || typeof value === 'string' ? value : J(value, null, 2));
  const flush = () => write('report.json', report);
  flush();
  try {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'browser verification is Actions-only; never launch a local browser');
    report.source = sourceManifest(sourceRoot);
    write('source-manifest.json', { expected: RELEASE, harness: report.harness, source: report.source });
    await awaitRelease(report, out, flush);
    const load = relative => import(pathToFileURL(path.join(sourceRoot, relative)).href);
    const [{ withBrowser }, { pageSession }, { D058_SCENES, d058Code }, { D057_SAME }, d054, { tapD053 }, { commitOp, undoOp }, { stepDay }] = await Promise.all([
      load('tools/cdp.mjs'), load('tools/smoke-d011.mjs'), load('tools/d058-scenes.mjs'), load('tools/d057-native.mjs'), load('tools/d054-capture.mjs'), load('tools/d053-capture.mjs'), load('src/sim/edit.ts'), load('src/sim/day.ts'),
    ]);
    const { d054Snapshot, d054Model, d054CompareModel, d054Select, d054Hold, d054Release } = d054;
    const camera = async (p, x, z, zoom) => {
      await p.ev(`__gt.view(${x},${z},${zoom});__gt.spin(0);__gt.setVisT(2.2);__gt.setDayFrac(0)`);
      await p.frames(30);
      let stable = 0, last = await p.ev('__gt.cam()');
      for (let i = 0; i < 24 && stable < 2; i++) {
        await p.frames(25);
        const next = await p.ev('__gt.cam()');
        stable = Math.max(...next.pos.map((x, j) => Math.abs(x - last.pos[j]))) < 1e-9 ? stable + 1 : 0;
        last = next;
      }
      assert.equal(stable, 2, 'camera reached observed stability');
    };
    for (const viewport of [{ W: 1440, H: 1000, mobile: false }, { W: 360, H: 740, mobile: true }]) for (const scene of D058_SCENES) {
      const id = `${scene.id}-${viewport.W}`, item = { id, scene: scene.id, viewport, navigations: [], shots: [], states: [], checks: [], passed: false };
      const log = { requests: [], responses: [], failures: [], errors: [], console: [], entries: [] };
      report.cases.push(item); flush();
      try {
        // Only the inherited launcher is used. Its `open` callback is deliberately ignored.
        await withBrowser({ root: sourceRoot, width: Math.max(960, viewport.W), height: Math.max(900, viewport.H), port: 8368 }, async ({ page: launcher }) => {
          let page, p;
          const shot = async stage => {
            const bytes = Buffer.from((await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64');
            const file = `${id}-${stage}.png`;
            write(file, bytes); // Preserve even an invalid/blank screenshot before assertions.
            const info = { file, sha256: sha(bytes), bytes: bytes.length, url: await page.evaluate('location.href') };
            item.shots.push(info);
            assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
            assert.equal(bytes.readUInt32BE(16), viewport.W); assert.equal(bytes.readUInt32BE(20), viewport.H);
            assert.ok(bytes.length > 10000, 'real screenshot is nontrivial');
            info.camera = await p.ev('__gt.cam()');
            return info;
          };
          const snapshot = async (stage, model) => {
            const state = await d054Snapshot(p), file = `${id}-${stage}.json`;
            write(file, state); item.states.push({ stage, file, sha256: sha(state) });
            d054CompareModel(state, model, id + ' ' + stage);
            return state;
          };
          try {
            page = await observedPage(launcher, 8368, log);
            item.chrome = { ...(await page.send('Browser.getVersion')), launch: launcher.chrome };
            p = await pageSession(page, query => publicOpen(page, item, query), viewport);
            const code = d058Code(scene); item.fixtureSha256 = sha(code); write(`${id}.code.txt`, code);
            await p.open('sample=seed516&clean=1');
            await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);
            await p.open('');
            assert.equal(await p.ev('__gt.sim().playing'), false);
            assert.ok(await p.waitFor(async () => !(await p.toasts()).length, 6000));
            const facades = await p.ev('__gt.facadeBlocks()');
            for (const target of scene.targets) {
              const actual = facades.find(b => b.x === target.x && b.z === target.z);
              assert.ok(actual); for (const key of ['path', 'w', 'h']) assert.equal(actual[key], target[key]);
            }
            item.facades = facades;
            const zoom = scene.camera.zoom * (viewport.mobile ? (scene.id === 'corner' ? 0.42 : 0.50) : 1);
            await camera(p, scene.camera.x, scene.camera.z, zoom);
            item.render = await p.ev('__gt.renderInfo()'); assert.ok(item.render.calls <= 18); assert.ok(item.render.triangles < 40000);
            item.pixelVariance = await p.ev(`(()=>{const c=document.querySelector('canvas'),q=document.createElement('canvas');q.width=96;q.height=60;const x=q.getContext('2d');x.drawImage(c,0,0,96,60);const a=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<a.length;i+=4){const v=(a[i]+a[i+1]+a[i+2])/3;sum+=v;sq+=v*v;n++;}return sq/n-(sum/n)**2})()`);
            assert.ok(item.pixelVariance > 50, 'nonblank actual WebGL canvas');
            item.sceneStats = await p.ev('__gt.sceneStats()'); assert.equal(item.sceneStats.arenas.length, 3, 'exactly three building arenas');
            item.gl = await p.ev('__gt.glInfo()');
            await shot('authored-street');
            assert.equal(await p.ev(D057_SAME), true, 'fresh / incremental scene equality');
            assert.deepEqual((await p.ev('__gt.blockPickTest(100)')).bad, []);
            const initial = await d054Snapshot(p), model = d054Model(initial.code).sim;
            await snapshot('initial', model);
            await p.ev(`window.__publicInputs=[];for(const type of ['pointerdown','pointerup','pointercancel','click'])addEventListener(type,e=>__publicInputs.push({type,trusted:e.isTrusted,pointerType:e.pointerType??null}),true)`);
            await camera(p, scene.camera.x, 6.4, viewport.mobile ? 3.3 : 7.5);
            const x = scene.id === 'highstreet' ? 17 : 22, op = { k: 'rect', tool: 'doze', x0: x, z0: 6, x1: x + 3, z1: 6 };
            await d054Select(p, 'doze', viewport.mobile);
            if (viewport.mobile) {
              const held = await d054Hold(p, page, op, true); assert.equal(held.preview.count, 4);
              await p.touch('touchCancel', []); await p.frames(2); await snapshot('cancelled', model);
            }
            for (let repeat = 0; repeat < 2; repeat++) {
              const held = await d054Hold(p, page, op, viewport.mobile); assert.equal(held.preview.count, 4);
              assert.ok(commitOp(model, op, 0).ok); await d054Release(p, page, held.b, viewport.mobile);
              await snapshot(`edit-${repeat}`, model);
              assert.equal(await p.ev(D057_SAME), true, 'edit invalidates orientation cache');
              assert.deepEqual((await p.ev('__gt.blockPickTest(100)')).bad, []);
              await tapD053(p, '#undo', viewport.mobile); assert.ok(undoOp(model).ok);
              await snapshot(`undo-${repeat}`, model); assert.equal(await p.ev(D057_SAME), true);
            }
            item.inputs = await p.ev('__publicInputs');
            assert.ok(item.inputs.length >= 8 && item.inputs.every(e => e.trusted), 'genuine trusted browser input');
            for (const type of ['pointerdown', 'pointerup']) assert.ok(item.inputs.filter(e => e.type === type).length >= 4);
            assert.ok(item.inputs.some(e => e.pointerType === (viewport.mobile ? 'touch' : 'mouse')));
            if (viewport.mobile) assert.ok(item.inputs.some(e => e.type === 'pointercancel'));
            await p.key('Escape'); assert.equal(await p.ev('__gt.saveNow()'), true);
            await p.ev('__gt.journalFlush()'); assert.equal(await p.ev('__gt.saveNow()'), true);
            await p.open(''); await snapshot('save-reload', model);
            stepDay(model); await p.ev('__gt.simStep(1)'); await snapshot('simulated-day', model);
            assert.equal(await p.ev(D057_SAME), true);
            assert.equal((await p.ev('__gt.sceneStats()')).arenas.length, 3);
            await camera(p, scene.camera.x, scene.camera.z, zoom); await shot('after-reload-simulation');
            assert.equal(await p.ev('location.href'), RELEASE.url);
            await sleep(1000); assertNetwork(log);
            item.checks.push('exact HTTPS document and approved bytes on every navigation', 'production fixture archetypes', 'nonblank render and exactly three arenas', 'two native edit/undo repetitions', 'trusted mouse/touch events', 'save/reload and original simulator parity', 'fresh/incremental render equality and picking', 'zero app errors/resource failures and unexpected app requests; browser favicon reported separately');
            item.native = { roadRemoveUndoRepeats: 2, touchCancel: viewport.mobile, saveReload: true, simulationCompared: true };
            item.passed = true;
            console.log('PASS D058 public', id, item.navigations.length, 'verified HTTPS loads');
          } catch (e) {
            item.error = errorText(e);
            if (page) {
              try { await shot('failure'); } catch (debug) { item.failureCaptureError = errorText(debug); }
              try { write(`${id}-failure-state.json`, await page.evaluate('window.__gt ? ({url:location.href,ready:__gt.ready,ui:__gt.ui(),inputs:window.__publicInputs??[]}) : ({url:location.href,title:document.title})')); } catch (debug) { item.failureStateError = errorText(debug); }
            }
          } finally {
            write(`${id}-network.json`, log);
            item.network = { file: `${id}-network.json`, requests: log.requests.length, responses: log.responses.length, failures: log.failures.length, errors: log.errors.length, ...networkSummary(log) };
            page?.close(); flush();
          }
        });
      } catch (e) { item.error ??= errorText(e); item.passed = false; }
      flush();
    }
    report.passed = report.cases.length === 4 && report.cases.every(c => c.passed && c.navigations.length === 3 && c.shots.length === 2);
    assert.ok(report.passed, 'all four real public desktop/mobile street cases passed');
  } catch (e) { report.error = errorText(e); report.passed = false; }
  finally {
    report.finished = new Date().toISOString(); flush();
    write('artifact-manifest.json', { expected: RELEASE, harness: report.harness, passed: report.passed, files: Object.fromEntries(fs.readdirSync(out).filter(f => f !== 'artifact-manifest.json').sort().map(f => [f, { sha256: sha(fs.readFileSync(path.join(out, f))), bytes: fs.statSync(path.join(out, f)).size }])) });
  }
  return report;
}
// --self-test exercises QA-only guards without network, dependencies, or Chrome.
export async function selfTest() {
  const { default: test } = await import('node:test');
  const harnessText = fs.readFileSync(SELF, 'utf8').split('// --self-test exercises')[0];
  const workflow = fs.readFileSync(path.join(path.dirname(SELF), '../.github/workflows/d058-public-verification.yml'), 'utf8');
test('release pins are the reviewed merge, full tree, and exact built HTML', () => {
  assert.equal(RELEASE.commit, 'feef2dddd0c1398f9074954ecba6873feb0ae0d8');
  assert.equal(RELEASE.tree, 'ea97761b4038c5825c23fab4eba5f5349a814ff5');
  assert.equal(RELEASE.htmlSha256, 'e672f5f12a7cd1db8962fb984243b33d03d9ad75c59138248f5e3e8143ba92e6');
  assert.ok(Object.isFrozen(RELEASE));
});
test('only exact HTTPS app navigations and fixed fixture query are accepted', () => {
  for (const value of [RELEASE.url, RELEASE.url + '?sample=seed516&clean=1']) assert.equal(assertPublicURL(value), value);
  for (const value of ['http://127.0.0.1:8368/', RELEASE.url.replace('https:', 'http:'), RELEASE.url + 'index.html', RELEASE.url + '?other=1', RELEASE.url + '#fake', RELEASE.url.replace('https://', 'https://user:secret@'), 'https://example.com/GlimmerTown3D-lab/', 'https://lijiabao1998.github.io/']) assert.throws(() => assertPublicURL(value));
});
test('unexpected app requests fail and raw favicon decoration stays explicit', () => {
  assert.equal(expectedRequest(RELEASE.url), true);
  assert.equal(expectedRequest('data:,'), true);
  for (const value of ['http://localhost:8368/', 'https://lijiabao1998.github.io/favicon.ico', RELEASE.url + 'source.js', 'blob:' + RELEASE.url + 'fake', 'data:text/html,fake', 'https://cdn.example.com/art.png']) assert.equal(expectedRequest(value), false);
  assert.match(harnessText, /assert\.deepEqual\(summary\.appFailures, \[\]/);
  assert.match(harnessText, /assert\.deepEqual\(summary\.appErrors, \[\]/);
});
test('favicon exception never hides app, runtime, or console errors', () => {
  const faviconURL = new URL('/favicon.ico', RELEASE.url).href;
  const favicon = { requestId: 'icon', url: faviconURL, type: 'Other', method: 'GET', initiator: { type: 'other' } };
  const iconError = { type: 'log', details: { source: 'network', url: faviconURL } };
  const runtimeError = { type: 'exception', details: { url: faviconURL } };
  const consoleError = { type: 'console', details: { url: faviconURL } };
  const log = { requests: [favicon], responses: [{ requestId: 'icon', url: faviconURL, status: 404 }], failures: [], errors: [iconError, runtimeError, consoleError] };
  const summary = networkSummary(log);
  assert.equal(summary.browserDecoration.responses[0].status, 404);
  assert.equal(summary.browserDecoration.errors.length, 1);
  assert.deepEqual(summary.appErrors, [runtimeError, consoleError]);
  assert.deepEqual(summary.unexpectedRequests, []);
  assert.equal(log.errors.length, 3, 'raw observations preserved');
  log.requests[0] = { ...favicon, type: 'Image', initiator: { type: 'script' } };
  assert.equal(networkSummary(log).unexpectedRequests.length, 1, 'app-generated icon is not exempt');
  assert.equal(networkSummary(log).appErrors.length, 3);
});
test('favicon redirects cannot launder unexpected requests sharing the same CDP ID', () => {
  const url = new URL('/favicon.ico', RELEASE.url).href;
  const icon = { requestId: 'icon', url, type: 'Other', method: 'GET', initiator: { type: 'other' } };
  const redirect = { ...icon, url: 'https://example.com/pixel', redirect: { url, status: 302 } };
  const log = { requests: [icon, redirect], responses: [{ requestId: 'icon', url: redirect.url, status: 200 }], failures: [], errors: [] };
  const summary = networkSummary(log);
  assert.equal(summary.browserDecoration.requests.length, 0);
  assert.equal(summary.unexpectedRequests.length, 2);
  log.requests = [icon];
  assert.equal(networkSummary(log).browserDecoration.requests.length, 0, 'mismatched response URL also rejects exemption');
  log.responses = [{ requestId: 'icon', url, status: 302 }];
  assert.equal(networkSummary(log).browserDecoration.requests.length, 0, 'unfinished redirect also rejects exemption');
});
test('wrong bytes/status are rejected rather than treating ready UI as proof', () => {
  assert.throws(() => assertReleaseResponse({ url: RELEASE.url, status: 200 }, Buffer.from('<html>old build</html>')), /exact approved/);
  assert.throws(() => assertReleaseResponse({ url: RELEASE.url, status: 404 }, Buffer.from('missing')), /response status/);
  assert.equal(sha(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.match(harnessText, /Network\.getResponseBody/);
  assert.match(harnessText, /document\.response\.securityState, 'secure'/);
});
test('isolated workflow has read-only permissions and no deployment/main trigger', () => {
  assert.match(workflow, /branches: \['codex\/d058-public-verification'\]/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(workflow, /pages: write|id-token: write|deploy-pages|upload-pages|workflow_dispatch|pull_request|branches: \[main/);
  assert.match(workflow, new RegExp('ref: ' + RELEASE.commit));
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /timeout-minutes: 120/);
  assert.match(harnessText, /90 \* 60 \* 1000/);
});
test('launcher is inherited without calling its localhost app open or changing browser security', () => {
  assert.match(harnessText, /process\.env\.GITHUB_ACTIONS, 'true'/);
  assert.match(harnessText, /async \(\{ page: launcher \}\)/);
  assert.doesNotMatch(harnessText, /Page\.setDocumentContent|Fetch\.fulfillRequest|Fetch\.enable|ignoreHTTPSErrors|setIgnoreCertificateErrors|disable-web-security|__gt\.load/);
  assert.match(harnessText, /Page\.navigate', \{ url \}/);
  assert.match(harnessText, /item\.inputs\.every\(e => e\.trusted\)/);
  assert.match(harnessText, /report\.cases\.length === 4/);
});

}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes('--self-test')) {
    await selfTest();
  } else {
  const report = await verifyPublicRelease();
  console.log(`${report.passed ? 'PASS' : 'FAIL'} D058 public HTTPS verification`, report.error ?? '');
  process.exitCode = report.passed ? 0 : 1;
}
}
