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
import { D053_MODES, d053FixtureManifest } from './d053-scenes.mjs';

export const SITE = 'https://lijiabao1998.github.io/GlimmerTown3D-lab/';
export const RELEASE = '74b884fea79afad8909cea606ff8ad3ebdc7fba7';
export const APPROVED = 'dbe8825ce8f42a0c36013c82b3e8c8050d5e8ae1';
export const APPROVED_TREE = '1f5dc819dd7e87f69bf3d084155a40b38571a633';
export const EXPECTED = '0b04a77ac7672de00e01a68cc2fe90c6c7c7faaf77d7eb95abe9fc7a8c5b54cd';
export const APPROVED_SHOTS = {
  'D053-after-rank6-current-line-412.png': 'c520cb53b1a26d43624ef520f75fecb3201b3bd7a7fb2dd58fe6dbcf43afbae0',
  'D053-after-civic-navigation-360.png': '3cf4f428af331a7f9d620604b380ebbcbc83621b5d3ffc0b00e6a18c51ea8fb3',
  'D053-after-rank22-space-entry-412.png': '6200110c70bfa40afb3c378067bcf7dfd0e6d015ce3f43efdee6d0ac0da5f071',
  'D053-after-space-tool-detail-412.png': '6c680d4415a46142a8552c66f5cd02fe9d31ee230600465ccc1e175207829c0c',
  'D053-after-space-build-result-412.png': '3a809429925c665221dffa97700da23e179169f46232873057c4ec1919d6c063',
  'D053-after-open-rank-after-day-360.png': '7b535661970348e453b8057b7ba3eb834829388b15d4e751c40d542facfad498',
};
export const TRAJECTORY = 'bac14d627ba6115246b80c65acafebb36801c31fa9f03cbaea641b1993c878db';
export const DOCUMENT_COUNTS = [...Array(10).fill(2), 2,2,2,2,2,4,2,2,2,2,2,2,3,4,4,3,2,2];
const BRANCH = 'claude/d053-live-verification', ORIGIN = new URL(SITE).origin;
const OUT = path.join(ROOT, 'scratch/live-d053'), SHOTS = path.join(ROOT, 'scratch/shots');
const J = JSON.stringify, hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const CDP_URL = pathToFileURL(path.join(ROOT, 'tools/cdp.mjs')).href;
const CAPTURE_URL = pathToFileURL(path.join(ROOT, 'tools/d053-capture.mjs')).href;
const ADAPTER_URL = 'd053-live-qa:original-capture-cdp-adapter';
const ADAPTER_KEY = 'glimmertown.d053.live-capture-adapter';

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
// original exports; only captureD053's withBrowser binding calls the live adapter.
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
  if (process.env.GITHUB_REF) assert.equal(process.env.GITHUB_REF, 'refs/heads/' + BRANCH);
  else assert.equal(git('branch', '--show-current'), BRANCH, 'isolated QA branch required');
  for (const [key, value] of Object.entries(process.env))
    if (/^D\d+_SMOKE_ONLY$/.test(key)) assert.equal(value, '', 'no smoke-section filtering');
  assert.equal(git('cat-file', '-t', APPROVED_TREE), 'tree');
  if (!offline) {
    assert.equal(git('rev-parse', APPROVED + '^{tree}'), APPROVED_TREE);
    assert.equal(git('rev-parse', RELEASE + '^{tree}'), APPROVED_TREE, 'release equals image-approved candidate');
    git('merge-base', '--is-ancestor', RELEASE, 'HEAD');
  }
  git('diff', '--exit-code', APPROVED_TREE, '--', '.', ':(exclude).github/workflows/ci.yml', ':(exclude)tools/verify-live-d053.mjs');
  const extra = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean).filter(f => f !== 'tools/verify-live-d053.mjs');
  assert.deepEqual(extra, [], 'no unexpected untracked product/test files');
  const localSha256 = hash(fs.readFileSync(path.join(ROOT, 'dist/index.html')));
  assert.equal(localSha256, EXPECTED, 'local build equals image-approved HTML');
  return { offline, releaseObjectsVerified: !offline, localSha256, approvedTree: APPROVED_TREE,
    sourceHashes: Object.fromEntries(['tools/cdp.mjs','tools/d053-capture.mjs','tools/d053-scenes.mjs','tools/smoke-d053.mjs'].map(f => [f, hash(fs.readFileSync(path.join(ROOT, f)))])),
    fixtures: D053_MODES.map(d053FixtureManifest) };
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
export function guardPage(page, gate) {
  return { ...page,
    get requests() { return page.requests.map(compatRequestUrl); },
    evaluate: async expression => { await gate.verify(); return page.evaluate(expression); },
    send: async (method, params = {}) => {
      assert.ok(PREPARATION_METHODS.has(method) || INPUT_METHODS.has(method), 'unapproved suite CDP method: ' + method);
      if (INPUT_METHODS.has(method)) await gate.verify();
      return page.send(method, params);
    },
  };
}

export function assertNetworkSession(session, verified) {
  assert.deepEqual(unexpectedRequests([...session.rawRequests, ...session.networkRequests.map(r => r.url)]), [], 'raw external/local requests');
  assert.deepEqual(session.redirects, [], 'no HTTP redirects');
  assert.deepEqual(session.childFrames, [], 'no attached or navigated child frames');
  assert.deepEqual(session.serviceWorkers, [], 'no service worker registrations or versions');
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
}

// Independent read-only observer. Only Node-side CDP discovery uses localhost.
async function observeRawNetwork(page, port, session) {
  const { targetInfo } = await page.send('Target.getTargetInfo');
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
    if (message.method === 'ServiceWorker.workerRegistrationUpdated') session.serviceWorkers.push(...p.registrations.filter(r => !r.isDeleted));
    if (message.method === 'ServiceWorker.workerVersionUpdated') session.serviceWorkers.push(...p.versions);
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
    const good = {documents:1,rawRequests:[SITE],networkRequests:[{url:SITE,type:'Document',loaderId:'one'}],documentResponses:[{url:SITE,loaderId:'one',status:200,mime:'text/html',fromServiceWorker:false,fromDiskCache:false}],redirects:[],childFrames:[],serviceWorkers:[],errors:[]};
    const verified = new Map([['one',SITE]]); assertNetworkSession(good,verified);
    for(const field of ['redirects','childFrames','serviceWorkers','errors']) { const bad=structuredClone(good);bad[field].push('bad');assert.throws(()=>assertNetworkSession(bad,verified)); }
    for(const [key,value] of [['status',302],['fromServiceWorker',true],['fromDiskCache',true],['loaderId','unverified'],['url',SITE+'?changed=1']]) {const bad=structuredClone(good);bad.documentResponses[0][key]=value;assert.throws(()=>assertNetworkSession(bad,verified));}
    const local=structuredClone(good);local.networkRequests.push({url:'http://127.0.0.1:8311/',type:'Other'});assert.throws(()=>assertNetworkSession(local,verified));
  });
  await test('unchanged capture import uses isolated adapter without Chrome', async () => {
    const sentinel = new Error('QA loader self-test sentinel; no Chrome launch');
    const adapter=installCaptureAdapter(async()=>{throw sentinel;});
    const tmp=fs.mkdtempSync(path.join(ROOT,'scratch/d053-adapter-test-'));
    try {
      const cdp=await import(CDP_URL); assert.equal(cdp.withBrowser,withBrowser); assert.equal(cdp.ROOT,ROOT);
      const capture=await import(CAPTURE_URL);
      await assert.rejects(capture.captureD053({phase:'after',outDir:tmp,modes:['rank6']}), e=>e===sentinel);
      assert.equal(adapter.state.calls,1); assert.deepEqual(adapter.state.routes,[{parentURL:CAPTURE_URL,specifier:'./cdp.mjs'}]);
    } finally { adapter.close(); fs.rmSync(tmp,{recursive:true,force:true}); }
  });
  return { passed:true,tests:names.length,names,browserLaunched:false,networkUsed:false };
}

export async function verifyLiveD053() {
  fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(SHOTS,{recursive:true});
  const report = { site:SITE,release:RELEASE,approved:APPROVED,approvedTree:APPROVED_TREE,expectedSha256:EXPECTED,
    mode:'Actual official GitHub Pages, fresh Chrome + SwiftShader; trusted CDP touch 360x740/412x860 and desktop keyboard. Not Android hardware.',
    unchangedSuite:'Original d053Smoke: 10 separate fixed scenes, 6 PNGs, 18 native workflows, 56 checks; held/repeated/cancelled input, all18 selectors, accessibility, normal play, original model build/undo/persistence and paired6-day trajectories.',
    hashGate:'Every document hashes before even boot-readiness evaluation. Every suite read/input/capture checks current document identity. No response interception or local replay.',
    adapter:'Node24 loader redirects only d053-capture.mjs -> ./cdp.mjs. withBrowser uses live wrapper; ROOT/sleep and original module bytes are unchanged. Only suite-facing request-list strings normalize the official origin.',
    isolation:'Disposable local profiles contain synthetic saves; no user data, accounts, credentials, server changes or deployment.',
    qualifications:'Original fixture/debug observations, fixed cameras, scroll/focus positioning and explicit original simStep are retained. Dialog guard throws on unexpected prompts. No synthetic DOM clicks/keys/pointers. RNG coverage is paired future exposed-state/code/history equivalence, not a hidden RNG dump. Android hardware and device Back are not tested.',
    checks:[],suiteChecks:[],sessions:[],documentHashes:[],screenshots:[] };
  const write=()=>{report.passed=report.checks.filter(c=>c.ok).length;report.failed=report.checks.filter(c=>!c.ok).length;fs.writeFileSync(path.join(OUT,'report.json'),J(report,null,2)+'\n');};
  const log=(ok,name,detail='')=>{report.checks.push({ok,name,detail});console.log(ok?'OK':'NG',name,detail);write();};
  const suiteLog=(ok,name,detail='')=>{report.suiteChecks.push({ok,name,detail});log(ok,name,detail);};
  let sequence=0,adapter;
  const liveBrowser=async(options,run)=>{
    const id=++sequence,port=8450+id*10;
    const session={id,phase:id<=10?'fixed-capture':'native-workflow',documents:0,rawRequests:[],networkRequests:[],documentResponses:[],redirects:[],childFrames:[],serviceWorkers:[],errors:[]};report.sessions.push(session);
    // Original helper's local server is an unused sentinel with no app bytes.
    // Any browser localhost request fails the independent raw-origin guard.
    try {
      return await withBrowser({...options,port,root:path.join(OUT,'unused-host'),overlay:{'index.html':'<!doctype html><title>Unused QA sentinel</title>'}},async({page})=>{
        const observer=await observeRawNetwork(page,port,session);
        const gate=createDocumentGate(page,session,d=>{report.documentHashes.push(d);write();});
        await page.send('Network.setCacheDisabled',{cacheDisabled:true});
        await page.send('Network.setBypassServiceWorker',{bypass:true});
        const open=async(query='')=>{
          assert.ok(['','sample=seed516&clean=1'].includes(query),'unchanged D053 navigation query only');
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
        try {return await run({page:guardPage(page,gate),open});}
        finally {
          try {
            await gate.verify();await observer.flush();await page.send('Page.getFrameTree');
            session.rawRequests=[...page.requests];session.errors=[...page.errors];
            assertNetworkSession(session,gate.verified);
            log(true,`Live session ${id}: raw origins, all documents, no redirects/frames/workers/errors`,J({documents:session.documents,requests:session.rawRequests.length}));
          } finally {observer.close();write();}
        }
      });
    } catch(error) {log(false,`Live session ${id}: official document/network verification`,error.stack);throw error;}
  };
  try {
    report.localPreflight=localPreflight();log(true,'Approved release, product, original suite/CDP and build pinned',J(report.localPreflight));
    assert.deepEqual(fs.readdirSync(SHOTS).filter(n=>/^D053-/.test(n)),[],'fresh output required; stale D053 files refused');
    const response=await fetch(SITE,{redirect:'error',signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200);assert.equal(response.url,SITE);assert.match(response.headers.get('content-type')??'',/text\/html/);
    const bytes=Buffer.from(await response.arrayBuffer());report.liveSha256=hash(bytes);report.liveBytes=bytes.length;
    assert.equal(report.liveSha256,EXPECTED,'Pages must deploy approved release before tests');log(true,'Official HTTP200 HTML equals approved SHA256',EXPECTED);
    adapter=installCaptureAdapter(liveBrowser);
    const {d053Smoke}=await import('./smoke-d053.mjs');await d053Smoke(liveBrowser,suiteLog);
    report.captureAdapter={routes:adapter.state.routes,calls:adapter.state.calls};
    assert.deepEqual(adapter.state.routes,[{parentURL:CAPTURE_URL,specifier:'./cdp.mjs'}]);assert.equal(adapter.state.calls,10,'all10 fixed capture browsers adapted');
    assert.equal(report.sessions.length,28);assert.deepEqual(report.sessions.map(s=>s.documents),DOCUMENT_COUNTS);
    assert.equal(report.documentHashes.length,64);assert.ok(report.documentHashes.every(d=>d.sha256===EXPECTED));
    assert.equal(report.suiteChecks.length,56);assert.ok(report.suiteChecks.every(c=>c.ok));
    const evidence=JSON.parse(fs.readFileSync(path.join(SHOTS,'D053-evidence.json'),'utf8'));
    const fixed=JSON.parse(fs.readFileSync(path.join(SHOTS,'D053-fixed-capture.json'),'utf8'));
    assert.ok(evidence.passed&&fixed.passed);assert.equal(evidence.checks.length,56);assert.ok(evidence.checks.every(c=>c.ok));
    assert.equal(evidence.sessions.length,18);assert.ok(evidence.sessions.every(s=>s.passed));
    assert.equal(fixed.htmlSha256,EXPECTED);assert.deepEqual(fixed.cases.map(c=>c.mode),D053_MODES);assert.ok(fixed.cases.every(c=>c.passed));assert.equal(fixed.shots.length,6);
    assert.deepEqual(evidence.fixedCapture,fixed,'fixed capture retained inside suite evidence');
    for(const s of evidence.sessions.filter(s=>s.name.startsWith('paired future trajectory')))assert.deepEqual(s.trajectory,{days:6,snapshots:7,sha256:TRAJECTORY});
    assert.equal(evidence.sessions.filter(s=>s.trajectory).length,2);
    const files=fs.readdirSync(SHOTS).filter(n=>/^D053-.*\.png$/.test(n)).sort();assert.deepEqual(files,Object.keys(APPROVED_SHOTS).sort());
    for(const file of files) {
      const actual=hash(fs.readFileSync(path.join(SHOTS,file))),approved=APPROVED_SHOTS[file];
      report.screenshots.push({file,sha256:actual,approvedSha256:approved,exactMatch:actual===approved});
      assert.equal(fixed.shots.find(s=>s.filename===file)?.sha256,actual,'capture report matches actual PNG bytes');
    }
    log(report.screenshots.every(s=>s.exactMatch),'Six public-site PNGs byte-identical to approved candidate',J(report.screenshots));
    log(true,'Complete public rollout: 28 browsers, 64 approved documents, 10 fixed scenes, 18 workflows, 56 original checks');
  } catch(error) {log(false,'Live D053 verification',error.stack);}
  finally {adapter?.close();write();}
  console.log(J({passed:report.passed,failed:report.failed,documents:report.documentHashes.length,sessions:report.sessions.length,site:SITE}));
  return report.failed?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.includes('--offline-preflight'))console.log(J(localPreflight({offline:true}),null,2));
  else if(process.argv.includes('--preflight'))console.log(J(localPreflight(),null,2));
  else if(process.argv.includes('--self-test')){fs.mkdirSync(path.join(ROOT,'scratch'),{recursive:true});console.log(J(await adapterSelfTests(),null,2));}
  else process.exitCode=await verifyLiveD053();
}
