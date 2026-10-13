// Isolated, read-only release QA. The app is loaded from GitHub Pages, never localhost.
// Local isolated QA; source helpers come from the exact pinned D059 release checkout.
// Adapted from the reviewed D058 public verifier eeadaccdb527e1e8c0f598f964632cc87ef3a5f1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RELEASE = Object.freeze({
  url: 'https://lijiabao1998.github.io/GlimmerTown3D-lab/',
  commit: 'b8954fcae4d3b80bc49b6512fb7622f69d711998',
  tree: '3ae57e351ccf117e72cb2c00063df4e0a877ee76',
  htmlSha256: '4515f6a815d3450a1b7b271000955d4ed57fe6a8b2f694cbc73e0b4d8b24a8a8',
});
const J = JSON.stringify;
export const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : J(value)).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errorText = e => e?.stack ?? String(e);
const SELF = fileURLToPath(import.meta.url);
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 10000 }).trim();

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

// The inherited launcher exposes its CDP target but not network response events.
// Open an observer on that SAME blank target, then use it for every browser action.
// This loopback endpoint is Chrome control only; the app is never served through it.
async function observedPage(launcherPage, port, log) {
  const target = (await bounded(launcherPage.send('Target.getTargetInfo'), LIMITS.cdpMs, 'launcher target')).targetInfo;
  const devPort = port + 1000 + launcherPage.chrome.tries - 1;
  const targets = await (await fetch(`http://127.0.0.1:${devPort}/json/list`, {signal: AbortSignal.timeout(LIMITS.connectMs)})).json();
  const socketURL = targets.find(t => t.id === target.targetId)?.webSocketDebuggerUrl;
  assert.ok(socketURL, 'same inherited Chrome page target found');
  const socket = new WebSocket(socketURL), pending = new Map(), documents = new Map();
  let nextId = 0;
  await bounded(new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }), LIMITS.connectMs, 'observer WebSocket open');
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
    const id = ++nextId, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timed out: ' + method)); }, LIMITS.cdpMs);
    pending.set(id, { resolve, reject, timer });
    try { socket.send(J({ id, method, params })); } catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(J(result.exceptionDetails));
    return result.result.value;
  };
  const rejectPending = why => {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(why)); }
    pending.clear();
  };
  socket.onclose = () => rejectPending('observer WebSocket closed');
  socket.onerror = () => rejectPending('observer WebSocket error');
  const close = () => { rejectPending('CDP closed'); socket.close(); };
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
async function publicOpen(page, item, query, write) {
  const url = assertPublicURL(RELEASE.url + (query ? '?' + query : ''));
  const nav = await page.send('Page.navigate', { url });
  assert.ok(!nav.errorText, nav.errorText);
  assert.ok(nav.loaderId, 'full document navigation, not same-document substitution');
  const until = Date.now() + LIMITS.navigationMs;
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
  const file = `${item.id}-document-${item.responseBodies.length + 1}.html`;
  write(file, body);
  item.responseBodies.push({file, url: document.response.url, status: document.response.status, bytes: body.length, sha256: sha(body)});
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

export const LIMITS = Object.freeze({ overallMs: 20 * 60 * 1000, cdpMs: 60000, connectMs: 15000, navigationMs: 120000, fetchMs: 60000 });
export const SITE_IDS = Object.freeze(['cottage', 'rows', 'inn', 'manor', 'church', 'oast']);
const PORT = 8369;
const WORLD = 'JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])';
const VARIANCE = `(()=>{const c=document.querySelector('canvas'),q=document.createElement('canvas');q.width=96;q.height=60;const x=q.getContext('2d');x.drawImage(c,0,0,96,60);const a=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<a.length;i+=4){const v=(a[i]+a[i+1]+a[i+2])/3;sum+=v;sq+=v*v;n++;}return sq/n-(sum/n)**2})()`;

export function bounded(promise, ms, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out: ' + label)), ms); })]).finally(() => clearTimeout(timer));
}
export function assertWorldUnchanged(before, after) { assert.equal(after, before, 'photography/camera never changes the saved world, history or buildings'); }
export function cameraDelta(a, b) {
  for (const c of [a, b]) {
    assert.ok(c && Array.isArray(c.pos) && c.pos.length === 3 && Array.isArray(c.target) && c.target.length === 3);
    assert.ok([...c.pos, ...c.target, c.zoom].every(Number.isFinite), 'finite camera');
  }
  return Math.max(Math.abs(a.zoom - b.zoom), ...['pos', 'target'].flatMap(k => a[k].map((v, i) => Math.abs(v - b[k][i]))));
}
export function assertPNG(bytes, viewport, variance) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'real PNG signature');
  assert.equal(bytes.readUInt32BE(16), viewport.W); assert.equal(bytes.readUInt32BE(20), viewport.H);
  assert.ok(bytes.length > 10000, 'nontrivial PNG'); assert.ok(Number.isFinite(variance) && variance > 50, 'nonblank WebGL canvas');
}
export function assertOwners(selectors, blocks, native) {
  assert.deepEqual(selectors.map(s => s.id), [...SITE_IDS], 'all six live production selectors');
  assert.equal(blocks.pool, 4); assert.equal(blocks.tested, 4); assert.equal(blocks.oblique, 4); assert.deepEqual(blocks.bad, [], 'all four RCI owner probes');
  assert.deepEqual(native.map(p => p.id), ['church', 'oast']);
  for (const p of native) { assert.ok(Number.isInteger(p.want) && p.want > 0); assert.equal(p.got, p.want, p.id + ' actual surface owner'); }
}
export function assertComplete(report) {
  assert.equal(report.cases.length, 3);
  assert.deepEqual(report.cases.map(c => c.viewport.W), [1440, 360, 412]);
  for (const item of report.cases) {
    assert.equal(item.passed, true); assert.equal(item.navigations.length, 3); assert.equal(item.responseBodies.length, 3);
    assert.equal(item.shots.length, 7); assert.equal(new Set(item.shots.map(s => s.name)).size, 7);
    assert.deepEqual(item.shots.map(s => s.name), ['overview', ...SITE_IDS.map(s => s + '-se')]);
    for (const nav of item.navigations) { assert.equal(nav.htmlSha256, RELEASE.htmlSha256); assert.equal(nav.status, 200); assert.equal(nav.securityState, 'secure'); }
  }
}

// Obtain a PID exclusively from this launcher's own browser CDP endpoint, so the
// emergency bound can stop only the disposable browser owned by this run.
async function ownedBrowserPID(launcher) {
  const devPort = PORT + 1000 + launcher.chrome.tries - 1;
  const version = await (await fetch(`http://127.0.0.1:${devPort}/json/version`, { signal: AbortSignal.timeout(LIMITS.connectMs) })).json();
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  try {
    await bounded(new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }), LIMITS.connectMs, 'browser control connection');
    const result = await bounded(new Promise((resolve, reject) => {
      socket.onmessage = e => { const r = JSON.parse(e.data); if (r.id === 1) r.error ? reject(new Error(r.error.message)) : resolve(r.result); };
      socket.onclose = () => reject(new Error('browser control closed'));
      socket.send(J({ id: 1, method: 'SystemInfo.getProcessInfo' }));
    }), LIMITS.connectMs, 'owned browser PID');
    const pid = result.processInfo.find(p => p.type === 'browser')?.id;
    assert.ok(Number.isInteger(pid) && pid > 0 && pid !== process.pid, 'own browser process identified');
    return pid;
  } finally { socket.close(); }
}

export async function verifyPublicRelease() {
  const sourceRoot = path.resolve(process.env.D059_RELEASE_ROOT ?? path.join(path.dirname(SELF), '../..'));
  const out = path.resolve(process.env.D059_PUBLIC_OUT ?? path.join(sourceRoot, 'scratch/d059-release/public'));
  assert.ok(out.startsWith(path.join(sourceRoot, 'scratch') + path.sep), 'evidence output stays in project scratch');
  assert.equal(fs.existsSync(path.join(out, 'report.json')), false, 'preserve prior evidence; choose a new scratch output for a retry');
  fs.mkdirSync(out, { recursive: true });
  const report = { expected: RELEASE, started: new Date().toISOString(), limits: LIMITS, harness: { file: SELF, sha256: sha(fs.readFileSync(SELF)), adaptedFrom: 'eeadaccdb527e1e8c0f598f964632cc87ef3a5f1:tools/d058-public-verification.mjs' }, qualifications: [
    'Genuine public HTTPS document bytes; no localhost app navigation, response interception, or app source substitution.',
    'Exact release checkout supplies the original D059 authored fixture, selectors, camera and renderer comparison helpers.',
    'Isolated disposable Chrome profiles; fixture save is written only inside those profiles at the public origin.',
    'Three viewports; nine full HTTPS document loads and twenty-one actual screenshots. Mobile emulation is not Android hardware.',
    'The authored city contains two existing/imported-save bonus buildings; only the six approved forms plus overview are photographed here.',
    'Native placement and day simulation are already covered by release CI and are deliberately not rerun in this focused publication check.',
    'Browser favicon decoration is retained separately; no global zero-resource-error claim.',
  ], cases: [], passed: false };
  const write = (name, value) => fs.writeFileSync(path.join(out, name), Buffer.isBuffer(value) || typeof value === 'string' ? value : J(value, null, 2));
  const flush = () => write('report.json', report);
  const manifest = () => write('artifact-manifest.json', { expected: RELEASE, harness: report.harness, passed: report.passed, files: Object.fromEntries(fs.readdirSync(out).filter(f => f !== 'artifact-manifest.json').sort().map(f => [f, { sha256: sha(fs.readFileSync(path.join(out, f))), bytes: fs.statSync(path.join(out, f)).size }])) });
  let activePage = null, activePID = null, activeLog = null, activeItem = null;
  const watchdog = setTimeout(() => {
    report.passed = false; report.error = 'Overall 20-minute deadline exceeded'; report.timedOut = true; report.finished = new Date().toISOString();
    try { if (activeLog && activeItem) write(activeItem.id + '-network.json', activeLog); flush(); manifest(); } catch (e) { console.error(errorText(e)); }
    try { activePage?.close(); } catch {}
    if (activePID) {
      try { if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(activePID), '/T', '/F'], { stdio: 'ignore', timeout: 3000 }); else process.kill(activePID, 'SIGTERM'); } catch {}
    }
    console.error(report.error); process.exit(1);
  }, LIMITS.overallMs);
  flush();
  try {
    assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Node 24+ for release TypeScript helpers');
    report.source = sourceManifest(sourceRoot); write('source-manifest.json', report.source);
    const response = await fetch(RELEASE.url, { redirect: 'error', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(LIMITS.fetchMs) });
    const body = Buffer.from(await response.arrayBuffer()); write('public-index.html', body);
    report.fetch = { url: response.url, status: response.status, bytes: body.length, sha256: sha(body), headers: Object.fromEntries(response.headers) };
    flush(); assertReleaseResponse(response, body); assert.match(response.headers.get('content-type') ?? '', /^text\/html\b/i);
    const load = relative => import(pathToFileURL(path.join(sourceRoot, relative)).href);
    const [{ withBrowser }, { pageSession }, scenes, { D057_SAME }] = await Promise.all([load('tools/cdp.mjs'), load('tools/smoke-d011.mjs'), load('tools/d059-scenes.mjs'), load('tools/d057-native.mjs')]);
    const { D059_VIEWPORTS, D059_SITES, D059_CAMERA, d059ReviewCode, d059FixtureProof, d059Selectors } = scenes;
    const code = d059ReviewCode(), proof = d059FixtureProof(code); report.fixture = { sha256: sha(code), proof }; write('fixture.code.txt', code);
    for (const viewport of D059_VIEWPORTS) {
      const item = { id: 'd059-' + viewport.W, viewport, navigations: [], responseBodies: [], shots: [], checks: [], passed: false };
      const log = { requests: [], responses: [], failures: [], errors: [], console: [], entries: [] };
      report.cases.push(item); activeItem = item; activeLog = log; flush();
      await withBrowser({ root: sourceRoot, width: Math.max(960, viewport.W), height: Math.max(900, viewport.H), port: PORT, chromeWaitMs: 60000 }, async ({ page: launcher }) => {
        let page;
        try {
          page = await observedPage(launcher, PORT, log); activePage = page; activePID = await ownedBrowserPID(launcher);
          item.chrome = { ...(await page.send('Browser.getVersion')), launch: launcher.chrome, ownedPID: activePID };
          const p = await pageSession(page, q => publicOpen(page, item, q, write), viewport);
          await p.open('sample=seed516&clean=1');
          await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);
          await p.open('');
          assert.equal(await p.ev('__gt.blockMode()'), 'c', 'actual public default C, without blocks override');
          assert.equal(await p.ev('__gt.sim().playing'), false);
          assert.ok(await p.waitFor(async () => !(await p.toasts()).length, 6000));
          const selectors = d059Selectors((await p.ev('__gt.blockInfo()')).plan, await p.ev('__gt.buildingList()'));
          assert.deepEqual(selectors, proof.selectors.c); assert.equal(await p.ev('__gt.restyled()'), proof.restyled);
          item.selectors = selectors;
          const initial = await p.ev(WORLD); item.worldSha256 = sha(initial); write(item.id + '-world.json', JSON.parse(initial));
          const camera = async (x, z, zoom) => {
            assertWorldUnchanged(initial, await p.ev(WORLD));
            await p.ev(`__gt.view(${x},${z},${zoom});__gt.spin(0);__gt.setVisT(2.2);__gt.setDayFrac(0)`);
            await p.frames(30); let stable = 0, last = await p.ev('__gt.cam()');
            for (let i = 0; i < 24 && stable < 2; i++) { await p.frames(25); const next = await p.ev('__gt.cam()'); stable = cameraDelta(last, next) < 1e-9 ? stable + 1 : 0; last = next; }
            assert.equal(stable, 2, 'observed stable camera'); assert.ok(Math.abs(last.target[0] - x) < 1e-7 && Math.abs(last.target[2] - z) < 1e-7, 'requested model centered');
            assertWorldUnchanged(initial, await p.ev(WORLD)); return last;
          };
          const shot = async (name, cam) => {
            const variance = await p.ev(VARIANCE), bytes = Buffer.from((await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64');
            const file = item.id + '-' + name + '.png'; write(file, bytes);
            const after = await p.ev('__gt.cam()'); assert.ok(cameraDelta(cam, after) < 1e-7, 'camera stays stable during capture');
            assertPNG(bytes, viewport, variance); assertWorldUnchanged(initial, await p.ev(WORLD));
            item.shots.push({ name, file, sha256: sha(bytes), bytes: bytes.length, viewport, camera: after, worldSha256: sha(initial), pixelVariance: variance, url: await page.evaluate('location.href') }); flush();
          };
          await shot('overview', await camera(D059_CAMERA.x, D059_CAMERA.z, D059_CAMERA.zoom * (viewport.mobile ? .43 : 1)));
          for (const site of D059_SITES) {
            const span = (site.w + site.h) * Math.SQRT1_2, zoom = Math.min(viewport.mobile ? 8 : 16, (viewport.mobile ? viewport.W * .70 : 650) / (viewport.H / (72 * .84) * span));
            await shot(site.id + '-se', await camera(site.x + site.w / 2, site.z + site.h / 2, zoom));
          }
          item.render = await p.ev('__gt.renderInfo()'); assert.ok(item.render.calls <= 18 && item.render.triangles < 70000, 'unchanged authored-city capture bounds');
          item.sceneStats = await p.ev('__gt.sceneStats()'); assert.equal(item.sceneStats.arenas.length, 3);
          assert.equal(await p.ev(D057_SAME), true, 'actual cached geometry equals a fresh production rebuild');
          const blocks = await p.ev('__gt.blockPickTest(100)'), list = await p.ev('__gt.buildingList()'), native = [];
          for (const site of D059_SITES.filter(s => s.k > 3)) {
            const b = list.find(b => b[1] === site.k && b[2] === site.x && b[3] === site.z); assert.ok(b);
            const uv = site.id === 'church' ? [.42, .81] : [.29, .48], probe = [site.x + site.w * uv[0], site.z + site.h * uv[1]];
            const hit = await p.ev(`__gt.pickTopDown(${probe[0]},${probe[1]})`); native.push({ id: site.id, probe, want: b[0], got: hit?.id });
          }
          assertOwners(selectors, blocks, native); item.picks = { blocks, native }; assertWorldUnchanged(initial, await p.ev(WORLD));
          // Third independent HTTPS navigation reloads the same original fixture;
          // no placement, undo, or day simulation is repeated in this focused QA.
          await p.ev(`localStorage.setItem('gt3d.v1.save',${J(code)})`); await p.open('');
          assert.equal(await p.ev('__gt.blockMode()'), 'c'); assertWorldUnchanged(initial, await p.ev(WORLD));
          assert.deepEqual(d059Selectors((await p.ev('__gt.blockInfo()')).plan, await p.ev('__gt.buildingList()')), selectors);
          item.gl = await p.ev('__gt.glInfo()'); await sleep(900); item.network = assertNetwork(log);
          item.checks.push('three complete HTTPS response hashes and valid transport', 'actual default C and all six production selectors', 'overview plus six actual SE captures', 'unchanged world and stable camera during photography', 'three arenas, cached/fresh equality, four RCI and two native surface owners', 'zero app errors/resource failures and unexpected requests; favicon separately retained');
          item.passed = true; console.log('PASS D059 public', viewport.W, item.navigations.length, 'HTTPS documents;', item.shots.length, 'PNG');
        } catch (e) { item.error = errorText(e); item.passed = false; throw e; }
        finally { write(item.id + '-network.json', log); item.network ??= networkSummary(log); flush(); try { await bounded(page?.send('Browser.close') ?? Promise.resolve(), 3000, 'close owned browser'); } catch {} page?.close(); activePage = null; activePID = null; }
      });
      activeItem = null; activeLog = null;
    }
    report.sourceAfter = sourceManifest(sourceRoot); assert.deepEqual(report.sourceAfter, report.source, 'pinned source bytes unchanged throughout live verification');
    assertComplete(report); report.passed = true;
  } catch (e) { report.error = errorText(e); report.passed = false; }
  finally { clearTimeout(watchdog); report.finished = new Date().toISOString(); flush(); manifest(); }
  return report;
}

// --self-test exercises validator failures only: no network, app, or Chrome.
export async function selfTest() {
  const { default: test } = await import('node:test');
  await test('release identity pins the authorized D059 merge, full tree and HTML', () => {
    assert.equal(RELEASE.commit, 'b8954fcae4d3b80bc49b6512fb7622f69d711998'); assert.equal(RELEASE.tree, '3ae57e351ccf117e72cb2c00063df4e0a877ee76'); assert.equal(RELEASE.htmlSha256, '4515f6a815d3450a1b7b271000955d4ed57fe6a8b2f694cbc73e0b4d8b24a8a8'); assert.ok(Object.isFrozen(RELEASE));
    assert.throws(() => assertReleaseResponse({ url: RELEASE.url, status: 200 }, Buffer.from('old release')), /approved full HTML/); assert.throws(() => assertReleaseResponse({ url: RELEASE.url, status: 404 }, Buffer.from('missing')), /response status/);
  });
  await test('only the exact HTTPS origin/path and fixed sample query can navigate', () => {
    for (const u of [RELEASE.url, RELEASE.url + '?sample=seed516&clean=1']) assert.equal(assertPublicURL(u), u);
    for (const u of ['http://127.0.0.1:8369/', RELEASE.url.replace('https:', 'http:'), RELEASE.url + 'index.html', RELEASE.url + '?blocks=c', RELEASE.url + '#fake', RELEASE.url.replace('https://', 'https://user:secret@'), 'https://example.com/GlimmerTown3D-lab/']) assert.throws(() => assertPublicURL(u));
  });
  await test('unexpected resource requests, redirects and failed app responses are fatal', () => {
    const log = { requests: [{ requestId: 'a', url: 'http://localhost:8369/', method: 'GET', type: 'Document' }, { requestId: 'b', url: RELEASE.url, method: 'GET', type: 'Document', redirect: { status: 302 } }], responses: [{ requestId: 'a', url: 'http://localhost:8369/', status: 404 }], failures: [], errors: [] };
    assert.equal(networkSummary(log).unexpectedRequests.length, 2); assert.equal(networkSummary(log).unsuccessfulResponses.length, 1); assert.throws(() => assertNetwork(log));
  });
  await test('favicon decoration never hides runtime errors or redirect chains', () => {
    const url = new URL('/favicon.ico', RELEASE.url).href, icon = { requestId: 'icon', url, method: 'GET', type: 'Other', initiator: { type: 'other' } };
    const log = { requests: [icon], responses: [{ requestId: 'icon', url, status: 404 }], failures: [], errors: [{ type: 'log', details: { source: 'network', url } }, { type: 'exception', details: { url } }, { type: 'console', details: { url } }] };
    assert.equal(networkSummary(log).browserDecoration.errors.length, 1); assert.equal(networkSummary(log).appErrors.length, 2);
    log.requests.push({ ...icon, url: 'https://example.com/pixel', redirect: { url, status: 302 } }); assert.equal(networkSummary(log).browserDecoration.requests.length, 0); assert.equal(networkSummary(log).unexpectedRequests.length, 2);
  });
  await test('PNG size, signature and nonblank canvas gates reject fabricated capture metadata', () => {
    const b = Buffer.alloc(10001); Buffer.from('89504e470d0a1a0a', 'hex').copy(b); b.writeUInt32BE(360, 16); b.writeUInt32BE(740, 20); assertPNG(b, { W: 360, H: 740 }, 100);
    assert.throws(() => assertPNG(b, { W: 412, H: 860 }, 100)); assert.throws(() => assertPNG(b, { W: 360, H: 740 }, 0)); b[0] = 0; assert.throws(() => assertPNG(b, { W: 360, H: 740 }, 100));
  });
  await test('world/camera validators detect mutation, movement and nonfinite values', () => {
    assertWorldUnchanged('same', 'same'); assert.throws(() => assertWorldUnchanged('same', 'changed'));
    const a = { pos: [1, 2, 3], target: [4, 0, 5], zoom: 8 }; assert.equal(cameraDelta(a, a), 0); assert.equal(cameraDelta(a, { ...a, pos: [2, 2, 3] }), 1); assert.throws(() => cameraDelta(a, { ...a, zoom: NaN }));
  });
  await test('all six selectors and all four RCI plus two native owners are required', () => {
    const s = SITE_IDS.map(id => ({ id })), b = { pool: 4, tested: 4, oblique: 4, bad: [] }, n = [{ id: 'church', want: 13, got: 13 }, { id: 'oast', want: 14, got: 14 }]; assertOwners(s, b, n);
    assert.throws(() => assertOwners(s.slice(0, 5), b, n)); assert.throws(() => assertOwners(s, { ...b, tested: 3 }, n)); assert.throws(() => assertOwners(s, b, [n[0], { ...n[1], got: 13 }]));
  });
  await test('completion requires nine HTTPS loads and twenty-one distinct shots; operation timeout rejects', async () => {
    const make = () => ({ cases: [1440, 360, 412].map(W => ({ viewport: { W }, passed: true, navigations: Array.from({ length: 3 }, () => ({ htmlSha256: RELEASE.htmlSha256, status: 200, securityState: 'secure' })), responseBodies: [{}, {}, {}], shots: ['overview', ...SITE_IDS.map(s => s + '-se')].map(name => ({ name })) })) });
    assertComplete(make()); const partial = make(); partial.cases[1].shots.pop(); assert.throws(() => assertComplete(partial)); const stale = make(); stale.cases[0].navigations[1].htmlSha256 = 'old'; assert.throws(() => assertComplete(stale));
    await assert.rejects(bounded(new Promise(() => {}), 10, 'self-test pending operation'), /Timed out/); assert.equal(LIMITS.overallMs, 20 * 60 * 1000);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes('--self-test')) await selfTest();
  else if (process.argv.includes('--live')) { const report = await verifyPublicRelease(); console.log((report.passed ? 'PASS' : 'FAIL') + ' D059 public HTTPS verification', report.error ?? ''); process.exitCode = report.passed ? 0 : 1; }
  else { console.error('Use --self-test for offline validators; run --live only after the exact D059 Pages deployment succeeds.'); process.exitCode = 2; }
}

