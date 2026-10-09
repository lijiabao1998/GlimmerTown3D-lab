// QA-only adapter: never changes published product source.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = process.cwd();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const LIVE = 'https://lijiabao1998.github.io/GlimmerTown3D-lab/';
const EXPECT = '4722cc2f17b4aac10b77b5fa3c9851d3b0634c346b3fada662ac2650283697dc';
const out = path.join(root, 'scratch/d055-live');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out,'D055-live-report.json'),JSON.stringify({passed:false,stage:'preflight',started:new Date().toISOString()}));
const pins = {
  'tools/cdp.mjs': '965afead5988dfe576483a1e74fc2e85f13b6ecbbc377b440d1c4b48323d6831',
  'tools/d055-capture.mjs': 'f86fb5f3101c8198fa23d40d0224676a828e39a6e53dfe0e741891ea820f1656',
  'tools/d055-native.mjs': 'd0ca30addc542055609bbd76389335108c3ada921761d2f62839df520751d19f',
};
for (const [file, digest] of Object.entries(pins)) assert.equal(sha(fs.readFileSync(file)), digest, file + ' approved harness source');
assert.equal(sha(fs.readFileSync('dist/index.html')), EXPECT, 'built product bytes');
const response = await fetch(LIVE, { cache: 'no-store' });
assert.equal(response.status, 200); assert.equal(response.url, LIVE);
const liveBytes = Buffer.from(await response.arrayBuffer());
assert.equal(sha(liveBytes), EXPECT, 'live deployed bytes before browser QA');
fs.writeFileSync(path.join(out, 'D055-live-index.html'), liveBytes);
globalThis.__d055LiveDocuments = [];
function replaceExactly(source, from, to, count = 1) {
  assert.equal(source.split(from).length - 1, count, 'unique QA adapter anchor: ' + from.slice(0, 65));
  return source.split(from).join(to);
}
const originals = Object.fromEntries(Object.keys(pins).map(file => [file, fs.readFileSync(file, 'utf8')]));
let cdp = originals['tools/cdp.mjs'];
cdp = "import { createHash as liveHash } from 'node:crypto';\nimport liveAssert from 'node:assert/strict';\n" + cdp;
cdp = replaceExactly(cdp, 'errors = [], requests = [];', 'errors = [], requests = [], documents = [];');
cdp = replaceExactly(cdp, "if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);", "if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);\n    if (m.method === 'Network.responseReceived' && m.params.type === 'Document') documents.push({id:m.params.requestId,loaderId:m.params.loaderId,frameId:m.params.frameId,url:m.params.response.url,status:m.params.response.status});");
cdp = replaceExactly(cdp, 'return { send, evaluate, errors, requests, close:', 'return { send, evaluate, errors, requests, documents, close:');
cdp = replaceExactly(cdp, "await page.send('Network.enable');", "await page.send('Network.enable'); await page.send('Network.setCacheDisabled', {cacheDisabled:true});");
cdp = replaceExactly(cdp, "await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/${entry}?${query}` });", `const documentStart = page.documents.length;
      const targetUrl = ${JSON.stringify(LIVE)} + \`?\${query}\`;
      const navigation = await page.send('Page.navigate', {url:targetUrl});
      liveAssert.ok(!navigation.errorText, navigation.errorText);
      liveAssert.ok(navigation.loaderId && navigation.frameId, 'new main-frame navigation loader');`);
cdp = replaceExactly(cdp, 'await sleep(opt.settle ?? 900);', `await sleep(opt.settle ?? 900);
      liveAssert.equal(await page.evaluate('location.href'),targetUrl,'current live document URL');
      liveAssert.equal(await page.evaluate(ready),true,'current live document ready');
      const matching = page.documents.slice(documentStart).filter(d=>d.loaderId===navigation.loaderId&&d.frameId===navigation.frameId&&d.url===targetUrl);
      liveAssert.equal(matching.length,1,'one fresh main-frame response for this navigation');
      const doc = matching[0];
      liveAssert.ok(!globalThis.__d055LiveDocuments.some(d=>d.id===doc.id&&d.loaderId===doc.loaderId), 'unique document response');
      liveAssert.equal(doc.status, 200, 'actual document HTTP status');
      const body = await page.send('Network.getResponseBody', {requestId:doc.id});
      const digest = liveHash('sha256').update(Buffer.from(body.body, body.base64Encoded ? 'base64' : 'utf8')).digest('hex');
      liveAssert.equal(digest, ${JSON.stringify(EXPECT)}, 'actual browser document matches approved product');
      globalThis.__d055LiveDocuments.push({...doc, sha256:digest});`);
let capture = originals['tools/d055-capture.mjs'];
capture = replaceExactly(capture,
  "page.requests.filter(u=>!/^(http:\\/\\/127\\.0\\.0\\.1:\\d+\\/|data:|blob:|about:)/.test(u))",
  "page.requests.filter(u=>!u.startsWith(" + JSON.stringify(LIVE) + ")&&!/^(data:|blob:|about:)/.test(u))", 2);
let result;
try {
  fs.writeFileSync('tools/cdp.mjs', cdp);
  fs.writeFileSync('tools/d055-capture.mjs', capture);
  const { captureD055 } = await import('./d055-capture.mjs');
  result = await captureD055({phase:'after',outDir:out});
  result.capturePassed = result.passed; result.passed = false;
  result.liveUrl = LIVE; result.approvedHtmlSha256 = EXPECT;
  result.actualBrowserDocuments = globalThis.__d055LiveDocuments;
  assert.ok(result.capturePassed, 'all three live native viewports');
  assert.equal(result.actualBrowserDocuments.length, 12, 'four real live document loads per viewport');
  const manifest = JSON.parse(fs.readFileSync('tools/d055-approved-image-hashes.json', 'utf8'));
  for (const shot of result.shots) assert.equal(shot.sha256, manifest[shot.filename], 'approved live PNG ' + shot.filename);
  result.approvedPngsByteIdentical = true;
  const { liveReloadChecks } = await import('./d055-live-reload.mjs');
  result.reloadAndInterruptions = await liveReloadChecks();
  assert.equal(result.actualBrowserDocuments.length,21,'seven real live document loads per viewport including reload coverage');
  result.passed = true;
  console.log('PASS D055 live: 3 viewports, 21 paid builds and undo, 27 navigation paths, 3 commission navigation flows, 21 actual document hashes and 9 approved PNGs; additional native interruption and autosave reload coverage');
} catch(error) {
  result ??= {}; result.passed = false; result.error = String(error.stack ?? error); throw error;
} finally {
  try { fs.writeFileSync(path.join(out, 'D055-live-report.json'), JSON.stringify(result ?? {passed:false, actualBrowserDocuments:globalThis.__d055LiveDocuments}, null, 2)); }
  finally { for (const [file, source] of Object.entries(originals)) fs.writeFileSync(file, source); }
}
