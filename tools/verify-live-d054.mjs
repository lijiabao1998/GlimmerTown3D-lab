// QA ONLY. Never merge. No product, fixture, suite or original CDP changes.
// Actual documents load from official Pages; no interception/replay/fulfillment.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { D054_MODES, d054FixtureManifest } from './d054-scenes.mjs';

export const SITE = 'https://lijiabao1998.github.io/GlimmerTown3D-lab/';
export const APPROVED = '4f0dd04001293f92df884989ccfc295517cc8162';
export const APPROVED_TREE = '0c0e0fef97e250e31c585c3d0c98f70e121637e1';
export const EXPECTED = '5ab7d9960854a7caf56a056698a1fef6fbe156c1d5f02d622f6f9abeb098509e';
export const APPROVAL_FILE = path.join(ROOT,'tools/d054-live-approval.json');
export const DOCUMENT_COUNTS = [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,4,4,4,4,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,2,8,4,4,2,2];
const EXPECTED_SHOT_NAMES = [
 'D054-after-mixed-pipe-preview-360.png','D054-after-mixed-pipe-result-360.png',
 'D054-after-low-road-preview-412.png','D054-after-low-road-result-412.png',
 'D054-after-low-rect-preview-412.png','D054-after-low-rect-result-412.png',
 'D054-after-depleted-oil-preview-412.png','D054-after-depleted-mine-preview-412.png',
 'D054-after-sewage-preview-360.png','D054-after-retained-road-result-panel-412.png',
 'D054-after-depleted-oil-guide-panel-412.png',
];
export function readApproval() {
 const a=JSON.parse(fs.readFileSync(APPROVAL_FILE,'utf8'));
 assert.equal(a.approvedCommit,APPROVED);assert.equal(a.approvedTree,APPROVED_TREE);assert.equal(a.expectedHtmlSha256,EXPECTED);
 assert.match(a.releaseCommit??'',/^[a-f0-9]{40}$/,'confirmed release SHA required; pending config fails closed');
 assert.equal(a.fullCiVerified,true,'final candidate full CI must be verified');
 assert.equal(a.finalImagesChecked,true,'final11 candidate images must be checked');
 assert.deepEqual(Object.keys(a.shots??{}).sort(),[...EXPECTED_SHOT_NAMES].sort(),'exact11 approved shot names');
 for(const [name,digest] of Object.entries(a.shots))assert.match(digest??'',/^[a-f0-9]{64}$/,'final candidate PNG SHA required: '+name);
 assert.match(a.trajectorySha256??'',/^[a-f0-9]{64}$/,'final candidate paired trajectory SHA required');
 return a;
}
const BRANCH = 'claude/d054-live-verification', ORIGIN = new URL(SITE).origin;
const OUT = path.join(ROOT, 'scratch/live-d054'), SHOTS = path.join(ROOT, 'scratch/shots');
const J = JSON.stringify, hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const CDP_URL = pathToFileURL(path.join(ROOT, 'tools/cdp.mjs')).href;
const CAPTURE_URL = pathToFileURL(path.join(ROOT, 'tools/d054-capture.mjs')).href;
const ADAPTER_URL = 'd054-live-qa:original-capture-cdp-adapter';
const ADAPTER_KEY = 'glimmertown.d054.live-capture-adapter';

// Only the unchanged suite's read-only URL list gets its existing allowlist
// representation. Independent observer URLs, navigation and bytes remain raw.
export function compatRequestUrl(raw) {
  if (/^(data:|blob:|about:)/.test(raw)) return raw;
  try { const u = new URL(raw); return u.origin === ORIGIN ? `http://127.0.0.1:8311${u.pathname}${u.search}${u.hash}` : raw; }
  catch { return raw; }
}
export function unexpectedRequests(requests) {
  return requests.filter(raw => {
    if (raw === 'about:blank' || raw.startsWith('data:')) return false;
    try { const u = new URL(raw); return u.origin !== ORIGIN || !!u.username || !!u.password; }
    catch { return true; }
  });
}
export function assertOfficialDocument(frame, expectedUrl) {
  const u = new URL(frame.url);
  assert.equal(u.origin + u.pathname, SITE, 'document is not official Pages');
  assert.equal(u.username + u.password, '', 'no document URL credentials');
  assert.equal(frame.parentId, undefined, 'no child document');
  assert.equal(frame.url, expectedUrl, 'redirect, unexpected navigation or query substitution');
  assert.ok(frame.loaderId, 'document requires a loader ID');
}

// Redirect exactly one import edge using Node24's synchronous loader. Node reads
// original capture and all other module bytes unchanged. ROOT/sleep remain the
// original exports; only captureD054's withBrowser binding calls the live adapter.
export function installCaptureAdapter(browser) {
  assert.equal(globalThis[Symbol.for(ADAPTER_KEY)], undefined, 'adapter installed once');
  const state = { routes: [], calls: 0, invoke: (...args) => { state.calls++; return browser(...args); } };
  globalThis[Symbol.for(ADAPTER_KEY)] = state;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === CAPTURE_URL && specifier === './cdp.mjs') {
        state.routes.push({ parentURL: context.parentURL, specifier });
        return { url: ADAPTER_URL, shortCircuit: true };
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url === ADAPTER_URL) return { format: 'module', shortCircuit: true,
        source: `export { ROOT, sleep } from ${J(CDP_URL)}; export const withBrowser = (...args) => globalThis[Symbol.for(${J(ADAPTER_KEY)})].invoke(...args);` };
      return next(url, context);
    },
  });
  return { state, close: () => { hooks.deregister(); delete globalThis[Symbol.for(ADAPTER_KEY)]; } };
}

export function localPreflight({ offline = false } = {}) {
  const approval=readApproval(), RELEASE=approval.releaseCommit;
  if (process.env.GITHUB_REF) assert.equal(process.env.GITHUB_REF, 'refs/heads/' + BRANCH);
  else assert.equal(git('branch', '--show-current'), BRANCH, 'isolated QA branch required');
  for (const [key, value] of Object.entries(process.env))
    if (/^D\d+_SMOKE_ONLY$/.test(key)) assert.equal(value, '', 'no smoke-section filtering');
  assert.equal(git('cat-file', '-t', APPROVED_TREE), 'tree');
  if (!offline) {
    assert.equal(git('rev-parse', APPROVED + '^{tree}'), APPROVED_TREE);
    assert.equal(git('rev-parse', RELEASE + '^{tree}'), APPROVED_TREE, 'release equals authorized exact candidate');
    git('merge-base', '--is-ancestor', RELEASE, 'HEAD');
  }
  git('diff', '--exit-code', APPROVED_TREE, '--', '.', ':(exclude).github/workflows/ci.yml', ':(exclude)tools/verify-live-d054.mjs', ':(exclude)tools/d054-live-approval.json');
  const extra = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean).filter(f => !['tools/verify-live-d054.mjs','tools/d054-live-approval.json'].includes(f));
  assert.deepEqual(extra, [], 'no unexpected untracked product/test files');
  const localSha256 = hash(fs.readFileSync(path.join(ROOT, 'dist/index.html')));
  assert.equal(localSha256, EXPECTED, 'local build equals authorized exact candidate HTML');
  return { approval, offline, releaseObjectsVerified: !offline, localSha256, approvedTree: APPROVED_TREE,
    sourceHashes: Object.fromEntries(['tools/cdp.mjs','tools/d054-capture.mjs','tools/d054-scenes.mjs','tools/smoke-d054.mjs','tools/d054-baseline.json','tools/d054-baseline-layout.json','tools/d054-layout-probe.mjs'].map(f => [f, hash(fs.readFileSync(path.join(ROOT, f)))])),
    fixtures: D054_MODES.map(d054FixtureManifest) };
}

// Hash first: even the inert readiness probe is gated. Mock CDP negative tests
// below exercise this same gate; they are never substituted for live verification.
export function createDocumentGate(page, session, record, expectedHash = EXPECTED) {
  const verified = new Map(); let expectedUrl = null;
  const expect = url => { expectedUrl = url; };
  const verify = async () => {
    assert.ok(expectedUrl, 'test observations require a requested official navigation');
    const tree = await page.send('Page.getFrameTree'), frame = tree.frameTree.frame;
    assert.equal(tree.frameTree.childFrames?.length ?? 0, 0, 'no child frames');
    assertOfficialDocument(frame, expectedUrl);
    if (verified.has(frame.loaderId)) {
      assert.equal(verified.get(frame.loaderId), frame.url, 'loader identity must not change URL');
      return frame;
    }
    const resource = await page.send('Page.getResourceContent', { frameId: frame.id, url: frame.url });
    const bytes = Buffer.from(resource.content, resource.base64Encoded ? 'base64' : 'utf8'), sha256 = hash(bytes);
    assert.equal(sha256, expectedHash, 'actual loaded document must equal approved HTML');
    const after = (await page.send('Page.getFrameTree')).frameTree;
    assert.equal(after.childFrames?.length ?? 0, 0);
    assertOfficialDocument(after.frame, expectedUrl);
    assert.equal(after.frame.loaderId, frame.loaderId, 'no document swap during hashing');
    verified.set(frame.loaderId, frame.url); session.documents++;
    record({ session: session.id, url: frame.url, loaderId: frame.loaderId, sha256, bytes: bytes.length });
    return frame;
  };
  return { expect, verify, verified };
}
const PREPARATION_METHODS = new Set(['Browser.getVersion', 'Emulation.setDeviceMetricsOverride',
  'Emulation.setTouchEmulationEnabled', 'Page.addScriptToEvaluateOnNewDocument']);
const INPUT_METHODS = new Set(['Input.dispatchTouchEvent','Input.dispatchMouseEvent','Input.dispatchKeyEvent','Page.captureScreenshot','Runtime.evaluate']);
// The sole auxiliary page is the native-blur test's owned about:blank tab.
// No URL, script, navigation, Runtime command or arbitrary child-session payload
// is accepted for it. The tested original HTTPS page remains hash-gated.
export function guardPage(page, gate, audit = { auxiliaryTargets:[], auxiliaryCommands:[] }) {
  const auxiliary=new Map(), sessions=new Map();
  const exactKeys=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),'exact auxiliary command keys');
  const blank=async targetId=>{
    assert.ok(auxiliary.has(targetId)&&!auxiliary.get(targetId).closed,'owned open blank target required');
    const {targetInfo}=await page.send('Target.getTargetInfo',{targetId});
    assert.equal(targetInfo.targetId,targetId);assert.equal(targetInfo.type,'page');assert.equal(targetInfo.url,'about:blank','auxiliary target may never navigate');
    return targetInfo;
  };
  return { ...page,
    get requests() { return page.requests.map(compatRequestUrl); },
    evaluate: async expression => { await gate.verify(); return page.evaluate(expression); },
    send: async (method, params = {}) => {
      if(method==='Target.createTarget') {
        await gate.verify();exactKeys(params,['url']);assert.equal(params.url,'about:blank');assert.equal(auxiliary.size,0,'only one scoped blank target');
        const result=await page.send(method,params);assert.ok(typeof result.targetId==='string'&&result.targetId.length);const entry={targetId:result.targetId,url:'about:blank',closed:false};auxiliary.set(result.targetId,entry);audit.auxiliaryTargets.push(entry);audit.auxiliaryCommands.push({method,params,result});await blank(result.targetId);return result;
      }
      if(method==='Target.attachToTarget') {
        await gate.verify();exactKeys(params,['targetId','flatten']);assert.equal(params.flatten,false);await blank(params.targetId);assert.equal(sessions.size,0,'one scoped child session');
        const result=await page.send(method,params);assert.ok(typeof result.sessionId==='string'&&result.sessionId.length);sessions.set(result.sessionId,params.targetId);audit.auxiliaryCommands.push({method,params,result});return result;
      }
      if(method==='Target.sendMessageToTarget') {
        await gate.verify();exactKeys(params,['sessionId','message']);assert.ok(sessions.has(params.sessionId),'owned child session only');await blank(sessions.get(params.sessionId));
        const message=JSON.parse(params.message);exactKeys(message,['id','method']);assert.equal(message.id,1);assert.equal(message.method,'Page.bringToFront','only native focus change is allowed');
        const result=await page.send(method,params);audit.auxiliaryCommands.push({method,params,result});await blank(sessions.get(params.sessionId));return result;
      }
      if(method==='Target.closeTarget') {
        await gate.verify();exactKeys(params,['targetId']);await blank(params.targetId);const result=await page.send(method,params);assert.equal(result.success,true);auxiliary.get(params.targetId).closed=true;audit.auxiliaryCommands.push({method,params,result});return result;
      }
      if(method==='Page.bringToFront'||method==='Emulation.setCPUThrottlingRate') {
        await gate.verify();if(method==='Page.bringToFront')exactKeys(params,[]);else{exactKeys(params,['rate']);assert.ok([1,6].includes(params.rate),'original CPU1/CPU6 only');}return page.send(method,params);
      }
      assert.ok(PREPARATION_METHODS.has(method) || INPUT_METHODS.has(method), 'unapproved suite CDP method: ' + method);
      if (INPUT_METHODS.has(method)) await gate.verify();
      return page.send(method, params);
    },
  };
}

// ServiceWorker notifications cover the whole Chrome profile, including bundled
// extensions. Keep every raw update; accept only well-formed chrome-extension
// registrations/versions with matching extension IDs and no control of our page.
// All HTTP(S), foreign, unknown and malformed worker observations fail closed.
export function classifyServiceWorkerUpdates(updates, pageTargetId) {
  assert.ok(typeof pageTargetId === 'string' && pageTargetId.length > 0, 'observed page target ID required');
  assert.ok(Array.isArray(updates), 'worker updates must be an array');
  const registrations = new Map(), extensionIds = new Set();
  const versions = []; let registrationUpdates = 0;
  const identifier = value => typeof value === 'string' && value.length > 0;
  const extensionUrl = raw => {
    assert.ok(typeof raw === 'string', 'worker URL must be a string');
    const u = new URL(raw);
    assert.equal(u.protocol, 'chrome-extension:', 'page-origin/foreign service workers forbidden');
    assert.match(u.hostname, /^[a-p]{32}$/, 'valid isolated Chrome extension ID required');
    assert.equal(u.username + u.password + u.port + u.search + u.hash, '', 'unambiguous extension worker URL required');
    assert.ok(u.pathname.startsWith('/'), 'extension URL requires an absolute path');
    return u;
  };
  for (const update of updates) {
    assert.ok(update && typeof update === 'object' && !Array.isArray(update), 'malformed worker update');
    assert.ok(identifier(update.registrationId), 'worker registration ID required');
    const registration = Object.hasOwn(update, 'scopeURL'), version = Object.hasOwn(update, 'scriptURL');
    assert.notEqual(registration, version, 'unknown or ambiguous worker update');
    if (registration) {
      assert.equal(typeof update.isDeleted, 'boolean', 'registration deletion state required');
      const u = extensionUrl(update.scopeURL), previous = registrations.get(update.registrationId);
      assert.ok(!previous || previous === u.hostname, 'registration cannot change extension identity');
      registrations.set(update.registrationId, u.hostname); extensionIds.add(u.hostname); registrationUpdates++;
    } else versions.push(update);
  }
  for (const version of versions) {
    assert.ok(identifier(version.versionId), 'worker version ID required');
    const u = extensionUrl(version.scriptURL);
    assert.notEqual(u.pathname, '/', 'worker script path required');
    assert.equal(registrations.get(version.registrationId), u.hostname, 'worker version requires matching extension registration');
    assert.ok(['stopped','starting','running','stopping'].includes(version.runningStatus), 'known worker running status required');
    assert.ok(['new','installing','installed','activating','activated','redundant'].includes(version.status), 'known worker lifecycle status required');
    assert.ok(Array.isArray(version.controlledClients) && version.controlledClients.every(identifier), 'explicit valid controlledClients required');
    assert.ok(!version.controlledClients.includes(pageTargetId), 'extension service worker controls the tested HTTPS page');
    if (Object.hasOwn(version, 'targetId')) {
      assert.ok(identifier(version.targetId), 'valid worker target ID required');
      assert.notEqual(version.targetId, pageTargetId, 'extension worker cannot be the tested page target');
    }
  }
  return { pageTargetId, pageControlled:false, extensionIds:[...extensionIds].sort(),
    rawUpdates:updates.length, extensionRegistrationUpdates:registrationUpdates, extensionVersionUpdates:versions.length };
}

export function recordServiceWorkerEvent(session, message) {
  const event = { method:message.method, params:message.params };
  session.serviceWorkerEvents.push(event); // Includes deletions, empty arrays and unknown events.
  const key = message.method === 'ServiceWorker.workerRegistrationUpdated' ? 'registrations'
    : message.method === 'ServiceWorker.workerVersionUpdated' ? 'versions' : null;
  if (key && Array.isArray(message.params?.[key])) session.serviceWorkers.push(...message.params[key]);
  else session.serviceWorkers.push({ unknownOrMalformedWorkerEvent:event });
}

export function assertNetworkSession(session, verified) {
  assert.deepEqual(unexpectedRequests([...session.rawRequests, ...session.networkRequests.map(r => r.url)]), [], 'raw external/local requests');
  assert.deepEqual(session.redirects, [], 'no HTTP redirects');
  assert.deepEqual(session.childFrames, [], 'no attached or navigated child frames');
  const workerIsolation = classifyServiceWorkerUpdates(session.serviceWorkers, session.pageTargetId);
  assert.deepEqual(session.errors, [], 'no Chrome console/runtime errors');
  assert.ok(session.documents > 0);
  assert.equal(session.documentResponses.length, session.documents, 'every document response hashed');
  for (const response of session.documentResponses) {
    assert.equal(response.status, 200); assert.equal(response.mime, 'text/html');
    assert.equal(response.fromServiceWorker, false); assert.equal(response.fromDiskCache, false);
    assert.equal(response.url, verified.get(response.loaderId), 'raw response equals hashed document');
  }
  assert.deepEqual(session.networkRequests.filter(r => r.type === 'Document').map(r => r.loaderId).sort(), [...verified.keys()].sort(), 'every requested document hashed');
  assert.deepEqual(session.documentResponses.map(r => r.loaderId).sort(), [...verified.keys()].sort(), 'every response loader hashed');
  return workerIsolation;
}

// Independent read-only observer. Only Node-side CDP discovery uses localhost.
async function observeRawNetwork(page, port, session) {
  const { targetInfo } = await page.send('Target.getTargetInfo');
  assert.equal(targetInfo.type, 'page');
  session.pageTargetId = targetInfo.targetId;
  const devPort = port + 1000 + page.chrome.tries - 1;
  const targets = await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json();
  const target = targets.find(t => t.id === targetInfo.targetId && t.type === 'page');
  assert.ok(target?.webSocketDebuggerUrl, 'same-page CDP observer endpoint');
  const endpoint = new URL(target.webSocketDebuggerUrl);
  assert.equal(endpoint.hostname, '127.0.0.1'); assert.equal(endpoint.port, String(devPort)); assert.equal(endpoint.protocol, 'ws:');
  const ws = new WebSocket(endpoint.href), pending = new Map(), finished = new Set(); let next = 0;
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result); return;
    }
    const p = message.params;
    if (message.method === 'Network.requestWillBeSent') {
      session.networkRequests.push({ url:p.request.url,type:p.type,frameId:p.frameId,loaderId:p.loaderId,requestId:p.requestId });
      if (p.redirectResponse) session.redirects.push({ from:p.redirectResponse.url,to:p.request.url,status:p.redirectResponse.status });
    }
    if (message.method === 'Network.responseReceived' && p.type === 'Document')
      session.documentResponses.push({ url:p.response.url,status:p.response.status,mime:p.response.mimeType,
        frameId:p.frameId,loaderId:p.loaderId,fromServiceWorker:!!p.response.fromServiceWorker,fromDiskCache:!!p.response.fromDiskCache });
    if (message.method === 'Network.loadingFinished') finished.add(p.requestId);
    if (message.method === 'Page.frameAttached') session.childFrames.push({ ...p, event:message.method });
    if (message.method === 'Page.frameNavigated' && p.frame.parentId) session.childFrames.push({ ...p.frame,event:message.method });
    if (message.method?.startsWith('ServiceWorker.')) recordServiceWorkerEvent(session, message);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, { resolve,reject }); ws.send(J({ id,method,params })); });
  await send('Network.enable'); await send('Page.enable'); await send('ServiceWorker.enable');
  return {
    documentLoaded: loaderId => session.networkRequests.some(r => r.type === 'Document' && r.loaderId === loaderId && finished.has(r.requestId)),
    flush: () => send('Page.getFrameTree'), close: () => ws.close(),
  };
}

export async function adapterSelfTests() {
  const names = [], test = async (name, fn) => { await fn(); names.push(name); };
  await test('raw URLs reject localhost, lookalikes, credentials and foreign blobs', async () => {
    assert.deepEqual(unexpectedRequests([SITE,SITE+'?sample=seed516&clean=1',ORIGIN+'/favicon.ico','data:image/png;base64,AA==','blob:'+SITE+'id','about:blank']), []);
    const bad = ['http://127.0.0.1:8311/','https://example.com/','https://lijiabao1998.github.io.evil.example/','blob:https://example.com/id','not a URL','https://user@lijiabao1998.github.io/GlimmerTown3D-lab/'];
    assert.deepEqual(unexpectedRequests(bad), bad);
    assert.equal(compatRequestUrl(SITE+'?x=1'),'http://127.0.0.1:8311/GlimmerTown3D-lab/?x=1');
    assert.equal(compatRequestUrl(bad[0]),bad[0]); assert.equal(compatRequestUrl(bad[2]),bad[2]);
  });
  const content = '<!doctype html><title>mock gate</title>', expectedHash = hash(content);
  let frame = { id:'root',loaderId:'one',url:SITE }, children = [], resource = content, calls = [];
  const page = { requests:[SITE],errors:[],
    evaluate: async expression => { calls.push('eval:'+expression); return true; },
    send: async method => {
      calls.push(method);
      if (method === 'Page.getFrameTree') return { frameTree:{frame:{...frame},childFrames:children} };
      if (method === 'Page.getResourceContent') return { content:resource,base64Encoded:false };
      return {};
    },
  };
  const session = { id:0,documents:0 }, records = [], gate = createDocumentGate(page,session,d => records.push(d),expectedHash), guarded = guardPage(page,gate);
  await test('test reads and native input cannot precede official navigation', async () => {
    await assert.rejects(guarded.evaluate('read'),/requested official navigation/);
    await assert.rejects(guarded.send('Input.dispatchTouchEvent'),/requested official navigation/);
    assert.deepEqual(calls,[]);
  });
  await test('loaded bytes hash before evaluation and are memoized by loader', async () => {
    gate.expect(SITE); await guarded.evaluate('first');
    assert.ok(calls.indexOf('Page.getResourceContent') < calls.indexOf('eval:first'));
    await guarded.send('Input.dispatchKeyEvent'); assert.equal(session.documents,1);
    assert.equal(calls.filter(c=>c==='Page.getResourceContent').length,1);
    frame.loaderId='two'; await guarded.evaluate('reload'); assert.equal(session.documents,2); assert.equal(records.length,2);
  });
  await test('mismatched HTML fails before test evaluation or input', async () => {
    frame.loaderId='bad'; resource='wrong'; const reads=calls.filter(c=>c.startsWith('eval:')).length;
    await assert.rejects(guarded.evaluate('must-not-run'),/actual loaded document/);
    await assert.rejects(guarded.send('Input.dispatchTouchEvent'),/actual loaded document/);
    assert.equal(calls.filter(c=>c.startsWith('eval:')).length,reads); assert.equal(session.documents,2); resource=content;
  });
  await test('redirects, other paths, child frames and direct navigation fail', async () => {
    for (const url of [SITE+'?redirect=1',ORIGIN+'/GlimmerTown-lab/','http://127.0.0.1:8311/']) { frame.url=url; await assert.rejects(gate.verify()); }
    frame.url=SITE; children=[{frame:{id:'child'}}]; await assert.rejects(gate.verify(),/no child frames/); children=[];
    for (const method of ['Page.navigate','Page.reload','Fetch.enable','Fetch.fulfillRequest','Network.setBypassServiceWorker']) await assert.rejects(guarded.send(method),/unapproved suite CDP method/);
  });
  await test('raw responses reject redirects, workers, cache, frames and unverified loaders', async () => {
    const good = {pageTargetId:'self-test-page',documents:1,rawRequests:[SITE],networkRequests:[{url:SITE,type:'Document',loaderId:'one'}],documentResponses:[{url:SITE,loaderId:'one',status:200,mime:'text/html',fromServiceWorker:false,fromDiskCache:false}],redirects:[],childFrames:[],serviceWorkers:[],errors:[]};
    const verified = new Map([['one',SITE]]); assertNetworkSession(good,verified);
    for(const field of ['redirects','childFrames','serviceWorkers','errors']) { const bad=structuredClone(good);bad[field].push('bad');assert.throws(()=>assertNetworkSession(bad,verified)); }
    for(const [key,value] of [['status',302],['fromServiceWorker',true],['fromDiskCache',true],['loaderId','unverified'],['url',SITE+'?changed=1']]) {const bad=structuredClone(good);bad.documentResponses[0][key]=value;assert.throws(()=>assertNetworkSession(bad,verified));}
    const local=structuredClone(good);local.networkRequests.push({url:'http://127.0.0.1:8311/',type:'Other'});assert.throws(()=>assertNetworkSession(local,verified));
  });
  const extension = 'chrome-extension://fignfifoniblkonapihmkfakmlgkbkcf/';
  const registration = { registrationId:'0',scopeURL:extension,isDeleted:false };
  const version = { versionId:'0',registrationId:'0',scriptURL:extension+'service_worker.js',runningStatus:'running',status:'activated',controlledClients:[],targetId:'extension-worker' };
  await test('isolated extension workers accepted while all raw updates and deletions retained', async () => {
    const session={serviceWorkerEvents:[],serviceWorkers:[]};
    const events=[{method:'ServiceWorker.workerRegistrationUpdated',params:{registrations:[registration]}},
      {method:'ServiceWorker.workerVersionUpdated',params:{versions:[version]}},
      {method:'ServiceWorker.workerRegistrationUpdated',params:{registrations:[{...registration,isDeleted:true}]}},
      {method:'ServiceWorker.workerVersionUpdated',params:{versions:[]}}];
    for(const event of events)recordServiceWorkerEvent(session,event);
    assert.deepEqual(session.serviceWorkerEvents,events);assert.equal(session.serviceWorkers.length,3);
    assert.equal(session.serviceWorkers[2].isDeleted,true);
    const result=classifyServiceWorkerUpdates(session.serviceWorkers,'self-test-page');
    assert.equal(result.pageControlled,false);assert.equal(result.extensionVersionUpdates,1);
    assert.deepEqual(session.serviceWorkerEvents,events,'classification never rewrites raw evidence');
  });
  await test('site and foreign HTTP workers rejected even when deleted or mislabelled extension', async () => {
    for(const url of [SITE,'https://example.com/','http://127.0.0.1:8311/','data:text/javascript,0','chrome-extension://bad-id/']) {
      for(const isDeleted of [false,true])assert.throws(()=>classifyServiceWorkerUpdates([{...registration,scopeURL:url,isDeleted}],'self-test-page'));
      assert.throws(()=>classifyServiceWorkerUpdates([registration,{...version,scriptURL:url+'worker.js'}],'self-test-page'));
    }
    assert.throws(()=>classifyServiceWorkerUpdates([registration,{...version,scriptURL:'chrome-extension://ghbmnnjooekpmoecnnnilnnbdlolhkhi/worker.js'}],'self-test-page'),/matching extension registration/);
  });
  await test('extension control of current page and absent or malformed client evidence rejected', async () => {
    assert.throws(()=>classifyServiceWorkerUpdates([registration,{...version,controlledClients:['self-test-page']}],'self-test-page'),/controls the tested HTTPS page/);
    assert.throws(()=>classifyServiceWorkerUpdates([registration,{...version,targetId:'self-test-page'}],'self-test-page'),/cannot be the tested page/);
    for(const controlledClients of [undefined,null,'self-test-page',[null],['']])assert.throws(()=>classifyServiceWorkerUpdates([registration,{...version,controlledClients}],'self-test-page'),/controlledClients/);
    assert.throws(()=>classifyServiceWorkerUpdates([version],'self-test-page'),/matching extension registration/);
    assert.throws(()=>classifyServiceWorkerUpdates([],undefined),/page target ID/);
  });
  await test('unknown and malformed service-worker events fail closed with raw evidence retained', async () => {
    for(const event of [{method:'ServiceWorker.workerErrorReported',params:{errorMessage:{}}},
      {method:'ServiceWorker.workerVersionUpdated',params:{versions:null}},
      {method:'ServiceWorker.workerRegistrationUpdated',params:{}},
      {method:'ServiceWorker.workerVersionUpdated',params:{versions:[{}]}}]) {
      const session={serviceWorkers:[],serviceWorkerEvents:[]};recordServiceWorkerEvent(session,event);
      assert.deepEqual(session.serviceWorkerEvents,[event]);assert.throws(()=>classifyServiceWorkerUpdates(session.serviceWorkers,'self-test-page'));
    }
    for(const malformed of [null,'bad',{}, {...registration,scriptURL:version.scriptURL}, {...registration,isDeleted:undefined}, {...version,status:'unknown'}])
      assert.throws(()=>classifyServiceWorkerUpdates([registration,malformed],'self-test-page'));
  });
  await test('auxiliary blank target scope denies navigation, unowned targets and arbitrary payloads', async () => {
    const audit={auxiliaryTargets:[],auxiliaryCommands:[]},calls=[],info={targetId:'owned-blank',type:'page',url:'about:blank'};let gates=0;
    const page={requests:[],evaluate:async()=>true,send:async(method,params)=>{calls.push({method,params});if(method==='Target.createTarget')return {targetId:'owned-blank'};if(method==='Target.attachToTarget')return{sessionId:'owned-session'};if(method==='Target.getTargetInfo')return{targetInfo:{...info}};if(method==='Target.closeTarget')return{success:true};return{};}},guarded=guardPage(page,{verify:async()=>{gates++;}},audit);
    await assert.rejects(guarded.send('Target.createTarget',{url:SITE}));await assert.rejects(guarded.send('Target.createTarget',{url:'about:blank',newWindow:true}));
    await assert.rejects(guarded.send('Target.attachToTarget',{targetId:'unowned',flatten:false}));assert.equal(calls.length,0);
    await guarded.send('Target.createTarget',{url:'about:blank'});await guarded.send('Target.attachToTarget',{targetId:'owned-blank',flatten:false});
    for(const message of [{id:1,method:'Page.navigate',params:{url:SITE}},{id:1,method:'Runtime.evaluate',params:{expression:'1'}},{id:1,method:'Page.bringToFront',params:{}},{id:2,method:'Page.bringToFront'}])await assert.rejects(guarded.send('Target.sendMessageToTarget',{sessionId:'owned-session',message:J(message)}));
    await assert.rejects(guarded.send('Target.sendMessageToTarget',{sessionId:'unowned',message:J({id:1,method:'Page.bringToFront'})}));
    await guarded.send('Target.sendMessageToTarget',{sessionId:'owned-session',message:J({id:1,method:'Page.bringToFront'})});assert.ok(gates>0);
    info.url=SITE;await assert.rejects(guarded.send('Target.closeTarget',{targetId:'owned-blank'}),/may never navigate/);info.url='about:blank';
    await guarded.send('Target.closeTarget',{targetId:'owned-blank'});assert.equal(audit.auxiliaryTargets[0].closed,true);await assert.rejects(guarded.send('Target.closeTarget',{targetId:'owned-blank'}));
    await assert.rejects(guarded.send('Target.createTarget',{url:'about:blank'}),/only one/);await assert.rejects(guarded.send('Emulation.setCPUThrottlingRate',{rate:12}));
  });
  await test('unchanged capture import uses isolated adapter without Chrome', async () => {
    const sentinel = new Error('QA loader self-test sentinel; no Chrome launch');
    const adapter=installCaptureAdapter(async()=>{throw sentinel;});
    const tmp=fs.mkdtempSync(path.join(ROOT,'scratch/d054-adapter-test-'));
    try {
      const cdp=await import(CDP_URL); assert.equal(cdp.withBrowser,withBrowser); assert.equal(cdp.ROOT,ROOT);
      const capture=await import(CAPTURE_URL);
      await assert.rejects(capture.captureD054({phase:'after',outDir:tmp,modes:['mixed-pipe']}), e=>e===sentinel);
      assert.equal(adapter.state.calls,1); assert.deepEqual(adapter.state.routes,[{parentURL:CAPTURE_URL,specifier:'./cdp.mjs'}]);
    } finally { adapter.close(); fs.rmSync(tmp,{recursive:true,force:true}); }
  });
  return { passed:true,tests:names.length,names,browserLaunched:false,networkUsed:false };
}

export async function verifyLiveD054() {
  const approval=readApproval(), RELEASE=approval.releaseCommit, APPROVED_SHOTS=approval.shots, TRAJECTORY=approval.trajectorySha256;
  fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(SHOTS,{recursive:true});
  const report = { site:SITE,release:RELEASE,approved:APPROVED,approvedTree:APPROVED_TREE,expectedSha256:EXPECTED,
    mode:'Actual official GitHub Pages, fresh Chrome + SwiftShader; trusted CDP touch 360x740/412x860 and desktop keyboard. Not Android hardware.',
    unchangedSuite:'Original d054Smoke:6 fixed scenes,9 paired PNGs+2 supplemental candidate PNGs,34 native workflows,105 checks; exact-original state/code/history/money/undo and36 subsequent-day pairing, native interrupted/held input, CPU6 first real preview16ms, actual WINDOW blur and hidden-guide focus.',
    hashGate:'Every document hashes before even boot-readiness evaluation. Every suite read/input/capture checks current document identity. No response interception or local replay.',
    adapter:'Node24 loader redirects only d054-capture.mjs -> ./cdp.mjs. withBrowser uses live wrapper; ROOT/sleep and original module bytes are unchanged. Only suite-facing request-list strings normalize the official origin.',
    blankAuxiliary:'One owned about:blank tab is allowed only for the unchanged real-window-blur test. Its URL is checked before/after scoped focus commands; no script evaluation or navigation is allowed, and it must be closed.',
    isolation:'Disposable local profiles contain synthetic saves; no user data, accounts, credentials, server changes or deployment.',
    serviceWorkerScope:'All raw worker notifications retained. Only well-formed isolated Chrome-extension registrations/versions are allowed; their controlledClients must exclude the observed page target. HTTP(S), foreign, unknown or malformed workers fail. Every HTML response must still have fromServiceWorker=false and cache bypass remains enabled.',
    qualifications:'Original fixture/debug observations, fixed cameras, scroll/focus positioning and explicit original simStep are retained. Dialog guard throws on unexpected prompts. No synthetic DOM clicks/keys/pointers. RNG coverage is paired future exposed-state/code/history equivalence, not a hidden RNG dump. Android hardware and device Back are not tested.',
    checks:[],suiteChecks:[],sessions:[],documentHashes:[],screenshots:[] };
  const write=()=>{report.passed=report.checks.filter(c=>c.ok).length;report.failed=report.checks.filter(c=>!c.ok).length;fs.writeFileSync(path.join(OUT,'report.json'),J(report,null,2)+'\n');};
  const log=(ok,name,detail='')=>{report.checks.push({ok,name,detail});console.log(ok?'OK':'NG',name,detail);write();};
  const suiteLog=(ok,name,detail='')=>{report.suiteChecks.push({ok,name,detail});log(ok,name,detail);};
  let sequence=0,adapter;
  const liveBrowser=async(options,run)=>{
    const id=++sequence,port=8450+id*10;
    const session={id,phase:id<=6?'fixed-capture':'native-workflow',auxiliaryTargets:[],auxiliaryCommands:[],documents:0,rawRequests:[],networkRequests:[],documentResponses:[],redirects:[],childFrames:[],serviceWorkers:[],serviceWorkerEvents:[],errors:[]};report.sessions.push(session);
    // Original helper's local server is an unused sentinel with no app bytes.
    // Any browser localhost request fails the independent raw-origin guard.
    try {
      return await withBrowser({...options,port,root:path.join(OUT,'unused-host'),overlay:{'index.html':'<!doctype html><title>Unused QA sentinel</title>'}},async({page})=>{
        const observer=await observeRawNetwork(page,port,session);
        const gate=createDocumentGate(page,session,d=>{report.documentHashes.push(d);write();});
        await page.send('Network.setCacheDisabled',{cacheDisabled:true});
        await page.send('Network.setBypassServiceWorker',{bypass:true});
        const open=async(query='')=>{
          assert.ok(['','sample=seed516&clean=1'].includes(query),'unchanged D054 navigation query only');
          const url=SITE+(query?'?'+query:'');gate.expect(url);
          const nav=await page.send('Page.navigate',{url});assert.ok(!nav.errorText,nav.errorText);assert.ok(nav.loaderId,'real document navigation required');
          let hashed=false,lastError;
          for(const started=Date.now();Date.now()-started<30000;await sleep(100)) {
            // Network completion is metadata only. Never poll application JS
            // while the first response bytes are incomplete/unverified.
            if(!observer.documentLoaded(nav.loaderId))continue;
            const tree=await page.send('Page.getFrameTree');
            if(tree.frameTree.frame.loaderId!==nav.loaderId)continue;
            try {await gate.verify();hashed=true;break;} catch(error) {lastError=error;if(error.code==='ERR_ASSERTION')throw error;}
          }
          assert.ok(hashed,'approved document unavailable: '+(lastError?.message??url));
          let ready=false;
          for(const started=Date.now();Date.now()-started<30000;await sleep(150)) {
            await gate.verify();if(await page.evaluate('!!(window.__gt&&__gt.ready)').catch(()=>false)){ready=true;break;}
          }
          assert.ok(ready,'official page failed readiness: '+url);await sleep(options.settle??900);await gate.verify();
        };
        try {return await run({page:guardPage(page,gate,session),open});}
        finally {
          try {
            await gate.verify();await observer.flush();await page.send('Page.getFrameTree');
            session.rawRequests=[...page.requests];session.errors=[...page.errors];
            session.serviceWorkerIsolation=assertNetworkSession(session,gate.verified);assert.ok(session.auxiliaryTargets.every(t=>t.url==='about:blank'&&t.closed),'all auxiliary blank tabs closed');
            log(true,`Live session ${id}: raw origins, all documents, no redirects/frames/page-controlling workers/errors`,J({documents:session.documents,requests:session.rawRequests.length,workerIsolation:session.serviceWorkerIsolation}));
          } finally {observer.close();write();}
        }
      });
    } catch(error) {log(false,`Live session ${id}: official document/network verification`,error.stack);throw error;}
  };
  try {
    report.localPreflight=localPreflight();log(true,'Approved release, product, original suite/CDP and build pinned',J(report.localPreflight));
    assert.deepEqual(fs.readdirSync(SHOTS).filter(n=>/^D054-/.test(n)),[],'fresh output required; stale D054 files refused');
    const response=await fetch(SITE,{redirect:'error',signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200);assert.equal(response.url,SITE);assert.match(response.headers.get('content-type')??'',/text\/html/);
    const bytes=Buffer.from(await response.arrayBuffer());report.liveSha256=hash(bytes);report.liveBytes=bytes.length;
    assert.equal(report.liveSha256,EXPECTED,'Pages must deploy approved release before tests');log(true,'Official HTTP200 HTML equals approved SHA256',EXPECTED);
    adapter=installCaptureAdapter(liveBrowser);
    const {d054Smoke}=await import('./smoke-d054.mjs');await d054Smoke(liveBrowser,suiteLog);
    report.captureAdapter={routes:adapter.state.routes,calls:adapter.state.calls};
    assert.deepEqual(adapter.state.routes,[{parentURL:CAPTURE_URL,specifier:'./cdp.mjs'}]);assert.equal(adapter.state.calls,6,'all6 fixed capture browsers adapted');
    assert.equal(report.sessions.length,40);assert.deepEqual(report.sessions.map(s=>s.documents),DOCUMENT_COUNTS);
    assert.equal(report.documentHashes.length,99);assert.ok(report.documentHashes.every(d=>d.sha256===EXPECTED));
    assert.equal(report.suiteChecks.length,105);assert.ok(report.suiteChecks.every(c=>c.ok));
    const evidence=JSON.parse(fs.readFileSync(path.join(SHOTS,'D054-evidence.json'),'utf8'));
    const fixed=JSON.parse(fs.readFileSync(path.join(SHOTS,'D054-fixed-capture.json'),'utf8'));
    assert.ok(evidence.passed&&fixed.passed);assert.equal(evidence.checks.length,105);assert.ok(evidence.checks.every(c=>c.ok));
    assert.equal(evidence.sessions.length,34);assert.ok(evidence.sessions.every(s=>s.passed));
    assert.equal(fixed.htmlSha256,EXPECTED);assert.deepEqual(fixed.cases.map(c=>c.mode),D054_MODES);assert.ok(fixed.cases.every(c=>c.passed));assert.equal(fixed.shots.length,9);assert.equal(evidence.extraShots.length,2);
    assert.deepEqual(evidence.fixedCapture,fixed,'fixed capture retained inside suite evidence');assert.equal(evidence.baselinePairing.passed,true);assert.equal(evidence.baselinePairing.futureDays,6);
    for(const s of evidence.sessions.filter(s=>s.name.startsWith('paired navigation future')))assert.deepEqual(s.trajectory,{snapshots:7,sha256:TRAJECTORY});
    assert.equal(evidence.sessions.filter(s=>s.trajectory).length,2);
    const entries=[...fixed.shots,...evidence.extraShots], files=fs.readdirSync(SHOTS).filter(n=>/^D054-.*\.png$/.test(n)).sort();assert.deepEqual(files,Object.keys(APPROVED_SHOTS).sort());
    for(const file of files) {
      const actual=hash(fs.readFileSync(path.join(SHOTS,file))),approved=APPROVED_SHOTS[file],entry=entries.find(s=>s.filename===file);assert.ok(entry,'every actualPNG has original native-suite metadata');
      assert.equal(entry.sha256,actual,'suite metadata matches realPNG bytes');assert.ok(entry.camera&&entry.viewport&&entry.visual&&entry.stateFile);assert.equal(entry.stateSha256,hash(Buffer.from(JSON.stringify(JSON.parse(fs.readFileSync(path.join(SHOTS,entry.stateFile),'utf8'))))),'full state snapshot matches original metadata');
      report.screenshots.push({...entry,file,sha256:actual,approvedSha256:approved,exactMatch:actual===approved,actualOrigin:SITE,htmlSha256:EXPECTED});
    }
    log(report.screenshots.every(s=>s.exactMatch),'Eleven public-site PNGs byte-identical to final candidate',J(report.screenshots.map(({file,sha256,exactMatch})=>({file,sha256,exactMatch}))));
    report.artifactManifest={site:SITE,release:RELEASE,candidate:APPROVED,htmlSha256:EXPECTED,documents:report.documentHashes,screenshots:report.screenshots,files:fs.readdirSync(SHOTS).filter(f=>/^D054-/.test(f)).sort().map(file=>({file,bytes:fs.statSync(path.join(SHOTS,file)).size,sha256:hash(fs.readFileSync(path.join(SHOTS,file)))}))};
    fs.writeFileSync(path.join(OUT,'artifact-manifest.json'),J(report.artifactManifest,null,2)+'\n');
    log(true,'Complete public verification:40 browsers,99 exact official documents,6 fixed scenes,34 workflows,105 unchanged checks,11 exactPNG matches');
  } catch(error) {log(false,'Live D054 verification',error.stack);}
  finally {adapter?.close();write();}
  console.log(J({passed:report.passed,failed:report.failed,documents:report.documentHashes.length,sessions:report.sessions.length,site:SITE}));
  return report.failed?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.includes('--offline-preflight'))console.log(J(localPreflight({offline:true}),null,2));
  else if(process.argv.includes('--preflight'))console.log(J(localPreflight(),null,2));
  else if(process.argv.includes('--self-test')){fs.mkdirSync(path.join(ROOT,'scratch'),{recursive:true});console.log(J(await adapterSelfTests(),null,2));}
  else process.exitCode=await verifyLiveD054();
}
