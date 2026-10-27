import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT, sleep } from './cdp.mjs';
import { startupGuards } from './d091-startup-tests.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const out = path.resolve(process.env.D091_OUT || '/tmp/d091-evidence/qa');
const port = +(process.env.GT_PORT || 8311);
const welcome = "document.querySelector('#startup')?.dataset.phase === 'welcome'";
const hidden = "!!window.__gt?.ready && document.querySelector('#startup')?.hidden";
const engine = `({sample:window.__gt.sample,stats:window.__gt.stats(),sim:window.__gt.sim(),cam:window.__gt.cam(),tone:window.__gt.tone(),blocks:window.__gt.blockMode?.(),buildings:window.__gt.buildingCount()})`;

async function waitFor(page, expression, label, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await page.evaluate(expression).catch(() => false)) return;
    await sleep(70);
  }
  throw new Error('Timed out: ' + label);
}
async function key(page, key, code, vk, text = '', modifiers = 0) {
  await page.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, text, unmodifiedText: text, modifiers });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
}
async function point(page, selector, touch = false) {
  const pos = await page.evaluate(`(() => {const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (touch) {
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...pos, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...pos });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...pos });
  }
}
async function shot(page, name, images) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const bytes = Buffer.from(data, 'base64');
  fs.writeFileSync(path.join(out, name), bytes);
  images.push({ file: name, sha256: sha(bytes), bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), source: 'Original Chromium Page.captureScreenshot PNG; no editing' });
}
async function navigate(page, query = '') {
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/${query ? '?' + query : ''}` });
}

export async function startupBrowser() {
  await startupGuards(); fs.mkdirSync(out, { recursive: true });
  const receipts = [], images = [];
  const provenance = {
    createdUtc: new Date().toISOString(), repository: 'lijiabao1998/GlimmerTown3D-lab',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain=v1'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    indexSha256: sha(fs.readFileSync(path.join(ROOT, 'index.html'))), buildSha256: sha(fs.readFileSync(path.join(ROOT, 'dist/index.html'))),
    testSha256: sha(fs.readFileSync(new URL(import.meta.url))),
    browser: execFileSync(process.env.CHROME_PATH || '/usr/bin/chromium', ['--version'], { encoding: 'utf8' }).trim(),
    browserRoute: 'Browser plugin not available; repository existing Chrome/CDP e2e harness',
    flow: 'root URL -> automatic engine initialization -> ready welcome -> real Enter Town action dismisses shell; parameterized URLs enter directly',
    receipts, images,
  };
  try {
    for (const [width, height] of [[1440, 900], [412, 844], [390, 844], [360, 844], [844, 390]]) {
      await withBrowser({ width, height, port, keepWelcome: true, settle: 0 }, async ({ page }) => {
        const phone = width <= 640 || height === 390;
        if (phone) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
        if (width === 390) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await navigate(page); await waitFor(page, welcome, 'root ready welcome');
        const state = await page.evaluate(`({url:location.href,title:document.title,ready:!!window.__gt?.ready,phase:document.querySelector('#startup').dataset.phase,overflow:document.documentElement.scrollWidth>innerWidth,enterHeight:document.querySelector('#startup-enter').getBoundingClientRect().height,gameInert:[...document.body.children].filter(n=>n.tagName!=='SCRIPT'&&n.id!=='startup').every(n=>n.inert)})`);
        assert.equal(state.url, `http://127.0.0.1:${port}/`); assert.equal(state.title, '微光小鎮 3D');
        assert.equal(state.ready, true); assert.equal(state.phase, 'welcome'); assert.equal(state.overflow, false);
        assert.ok(state.enterHeight >= 44); assert.equal(state.gameInert, true);
        assert.equal(await page.evaluate('document.querySelectorAll("canvas").length'), 1);
        if (width === 390) assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.startup-loader i')).animationName"), 'none');
        await page.evaluate('window.__d091OriginalApi=window.__gt');
        const before = await page.evaluate(engine);
        await shot(page, `D091-${width}-welcome.png`, images);
        await key(page, 'Tab', 'Tab', 9); assert.equal(await page.evaluate('document.activeElement.tagName'), 'SUMMARY');
        await key(page, ' ', 'Space', 32, ' ');
        assert.deepEqual(await page.evaluate(engine), before, 'instructions shield underlying simulation shortcut');
        await key(page, ' ', 'Space', 32, ' ');
        await key(page, 'Tab', 'Tab', 9); assert.equal(await page.evaluate('document.activeElement.id'), 'startup-enter');
        await key(page, 'Tab', 'Tab', 9, '', 8); assert.equal(await page.evaluate('document.activeElement.tagName'), 'SUMMARY');
        if (width === 360 || height === 390) {
          await point(page, '#startup summary', true);
          assert.equal(await page.evaluate("document.querySelector('#startup details').open"), true);
          assert.equal(await page.evaluate('window.__gt.ui().pointers'), 0, 'menu touch must not leak into engine pointer ledger');
          const info = await page.evaluate(`(() => {const s=document.querySelector('.startup-mobile');s.scrollIntoView({block:'nearest'});const r=s.getBoundingClientRect();return{text:s.textContent,visible:r.top>=0&&r.bottom<=innerHeight,rootOverflow:document.querySelector('#startup').scrollHeight>innerHeight};})()`);
          assert.equal(info.visible, true); assert.ok(info.text.includes('雙指縮放'));
          await shot(page, `D091-${width}-instructions.png`, images);
          await point(page, '#startup summary', true);
        }
        if (width === 390) {
          await key(page, 'Tab', 'Tab', 9); assert.equal(await page.evaluate('document.activeElement.id'), 'startup-enter');
          await key(page, 'Enter', 'Enter', 13, '\r');
        } else {
          await point(page, '#startup-enter', phone);
        }
        await waitFor(page, hidden, 'shell dismissed');
        assert.equal(await page.evaluate('window.__gt===window.__d091OriginalApi'), true);
        assert.deepEqual(await page.evaluate(engine), before, 'CTA only dismisses presentation');
        assert.equal(await page.evaluate('window.__gt.ui().pointers'), 0, 'all menu contacts released without stale engine pointers');
        assert.equal(await page.evaluate("document.querySelector('#startup').contains(document.activeElement)"), false);
        assert.equal(await page.evaluate('[...document.body.children].filter(n=>n.tagName!=="SCRIPT"&&n.id!=="startup").some(n=>n.inert)'), false);
        await key(page, 'Tab', 'Tab', 9);
        assert.equal(await page.evaluate("document.querySelector('#startup').contains(document.activeElement)"), false);
        await shot(page, `D091-${width}-entered.png`, images);
        let firstTouchConstruction;
        if (width === 360 || height === 390) {
          await point(page, '#tools button[data-t="road"]', true);
          assert.equal(await page.evaluate('window.__gt.ui().tool'), 'road');
          const cell = await page.evaluate(`(() => {const n=window.__gt.blockInfo().n;for(let z=3;z<n-3;z+=2)for(let x=3;x<n-3;x+=2){const [sx,sy]=window.__gt.cellScreen(x,z),op={k:'line',tool:'road',x0:x,z0:z,x1:x,z1:z},p=window.__gt.preview(op);if(p.count===1&&p.affordable&&sx>20&&sx<innerWidth-20&&sy>90&&sy<innerHeight-80&&document.elementFromPoint(sx,sy)?.tagName==='CANVAS')return{x,z,sx,sy,cost:p.total};}return null;})()`);
          assert.ok(cell, 'visible legal road cell');
          const money = await page.evaluate('window.__gt.sim().money');
          await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cell.sx, y: cell.sy, radiusX: 2, radiusY: 2, force: 1, id: 11 }] });
          await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          assert.equal(await page.evaluate('window.__gt.sim().money'), money - cell.cost, 'first native touch after menu builds exactly one road');
          assert.equal(await page.evaluate('window.__gt.ui().pointers'), 0);
          firstTouchConstruction = { cell, spent: cell.cost, pointerLedgerAfterRelease: 0 };
        }
        assert.deepEqual(page.errors, []);
        receipts.push({ kind: 'root', width, height, state, engineBeforeAndAfterEqual: true, keyboardFocusRestored: true, entryInput: width === 390 ? 'native keyboard Enter' : phone ? 'native touch' : 'native mouse', firstTouchConstruction, errors: page.errors });
      });
    }

    // Delay actual IndexedDB success delivery, never engine state. Explicit negative
    // control for loading screenshots; not a hardware/performance measurement.
    const slowJournal = `(() => {const original=indexedDB.open.bind(indexedDB);indexedDB.open=(...args)=>{const request=original(...args);Object.defineProperty(request,'onsuccess',{set(fn){request.addEventListener('success',e=>setTimeout(()=>fn.call(request,e),1500),{once:true});}});return request;};})();`;
    for (const width of [1440, 390]) {
      await withBrowser({ width, height: width === 1440 ? 900 : 844, port, keepWelcome: true, preload: slowJournal, settle: 0 }, async ({ page }) => {
        await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='loading'", 'actual journal-wait loading');
        assert.equal(await page.evaluate('!!window.__gt?.ready'), false);
        await shot(page, `D091-${width}-loading-delayed-journal-control.png`, images);
        assert.doesNotMatch(await page.evaluate("document.querySelector('#startup-status').textContent"), /\d+\s*%/);
        await waitFor(page, welcome, 'delayed journal resolves');
        assert.deepEqual(page.errors, []);
        receipts.push({ kind: 'loading-control', width, delayMs: 1500, control: 'actual IndexedDB success callback delayed; not device performance evidence', readyEventually: true });
      });
    }

    for (const query of ['sample=starter', 'sample=seed516&style=B', 'mode=history&year=30', 'unknown=1']) {
      await withBrowser({ width: 390, height: 844, port, settle: 0 }, async ({ page, open }) => {
        await open(query); await waitFor(page, hidden, 'direct parameter entry');
        assert.equal(await page.evaluate('document.querySelectorAll("canvas").length'), 1);
        assert.deepEqual(page.errors, []);
        receipts.push({ kind: 'direct', query, ready: true, noEnterAction: true });
      });
    }

    const deniedJournal = `Object.defineProperty(window,'indexedDB',{value:{open(){throw new DOMException('D091 denied-journal negative control','SecurityError');}}});`;
    await withBrowser({ width: 390, height: 844, port, keepWelcome: true, preload: deniedJournal }, async ({ page }) => {
      await navigate(page); await waitFor(page, welcome, 'journal-unavailable fallback');
      const storage = await page.evaluate(`({journal:window.__gt.journal(),visible:!document.querySelector('#startup-storage').hidden,text:document.querySelector('#startup-storage').textContent})`);
      assert.equal(storage.journal.kind, null); assert.equal(storage.visible, true); assert.ok(storage.text.includes('暫不可用'));
      await shot(page, 'D091-390-journal-unavailable-control.png', images);
      assert.deepEqual(page.errors, []); receipts.push({ kind: 'journal-denied-control', ...storage });
    });

    await withBrowser({ width: 390, height: 844, port, keepWelcome: true, preload: "localStorage.setItem('gt3d.v1.save','D091 intentional corrupt-save negative control');" }, async ({ page }) => {
      await navigate(page); await waitFor(page, welcome, 'original corrupt-save fallback');
      const notice = await page.evaluate("document.querySelector('#startup-notice').textContent");
      assert.ok(notice.includes('存檔讀不出來')); assert.ok(notice.includes('原檔另存'));
      await sleep(3000);
      assert.equal(await page.evaluate("document.querySelector('.gtu #toasts .toast.bad')===null"), true);
      assert.equal(await page.evaluate("document.querySelector('#startup-notice').textContent"), notice);
      assert.equal(await page.evaluate("localStorage.getItem('gt3d.v1.save.bad')"), 'D091 intentional corrupt-save negative control');
      await shot(page, 'D091-390-original-save-warning-control.png', images);
      assert.deepEqual(page.errors, []); receipts.push({ kind: 'original-save-warning-control', retainedAfterOriginalToastExpired: true, originalBackupBytesPreserved: true, notice });
    });

    // Capture a genuine valid engine-generated save, fail WebGL on one navigation,
    // then activate the actual retry button and verify bytes through real reloads.
    const failOnce = `window.__d091AtNavigation=localStorage.getItem('gt3d.v1.save');if(sessionStorage.getItem('d091-fail-once')){sessionStorage.removeItem('d091-fail-once');const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:original.call(this,type,...args);};}`;
    await withBrowser({ width: 390, height: 844, port, keepWelcome: true, preload: failOnce }, async ({ page, open }) => {
      await navigate(page); await waitFor(page, welcome, 'valid automatic city save');
      const code = await page.evaluate("(async () => {await window.__gt.journalFlush();window.__gt.saveNow();await window.__gt.journalFlush();const code=window.__gt.saved();if(!window.__gt.tryCode(code).ok)throw Error('invalid persisted test save');sessionStorage.setItem('d091-fail-once','1');return code;})()");
      const expectedSim = await page.evaluate('window.__gt.sim().hash');
      await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='error'", 'actual renderer failure');
      assert.ok(await page.evaluate("localStorage.getItem('gt3d.v1.save')") === code, 'exact saved bytes after renderer failure');
      await shot(page, 'D091-390-renderer-error-control.png', images);
      for (const shift of [0, 8, 0]) {
        await key(page, 'Tab', 'Tab', 9, '', shift);
        assert.equal(await page.evaluate("document.querySelector('#startup').contains(document.activeElement)"), true);
      }
      const expectedErrors = [...page.errors]; assert.ok(expectedErrors.some(x => /WebGL|context/i.test(x)));
      await point(page, '#startup-retry', true);
      await waitFor(page, "performance.getEntriesByType('navigation')[0]?.type==='reload' && document.querySelector('#startup')?.dataset.phase==='welcome'", 'retry reload recovers');
      assert.ok(await page.evaluate('window.__d091AtNavigation') === code, 'exact saved bytes at retry navigation');
      assert.ok(await page.evaluate("localStorage.getItem('gt3d.v1.save')") === code, 'exact saved bytes after retry initialization');
      assert.equal(await page.evaluate('window.__gt.sample'), 'mine');
      assert.equal(await page.evaluate('window.__gt.sim().hash'), expectedSim);
      const repeated = await page.evaluate(`(() => {const r=document.querySelector('#startup-enter').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await page.evaluate('window.__d091OriginalApi=window.__gt');
      for (let n = 0; n < 2; n++) {
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: n + 1, ...repeated });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: n + 1, ...repeated });
      }
      assert.equal(await page.evaluate('window.__gt===window.__d091OriginalApi'), true);
      assert.equal(await page.evaluate('window.__gt.sim().hash'), expectedSim);
      assert.equal(await page.evaluate('document.querySelectorAll("canvas").length'), 1);
      assert.ok(await page.evaluate("localStorage.getItem('gt3d.v1.save')") === code, 'exact saved bytes after repeated entry');
      await page.send('Page.reload'); await waitFor(page, welcome, 'ordinary reload');
      assert.ok(await page.evaluate('window.__d091AtNavigation') === code, 'exact saved bytes at ordinary reload navigation');
      assert.ok(await page.evaluate("localStorage.getItem('gt3d.v1.save')") === code, 'exact saved bytes after ordinary reload initialization');
      assert.equal(await page.evaluate('window.__gt.sim().hash'), expectedSim);
      assert.deepEqual(page.errors, expectedErrors);
      receipts.push({ kind: 'renderer-failure-control', retry: 'actual touch activation -> navigation type reload -> root welcome -> mine restored', saveBytes: Buffer.byteLength(code), saveSha256: sha(code), exactBytesAtErrorRetryAndReload: true, simulationHashPreserved: expectedSim, repeatedMouseEntry: true, expectedErrors });
    });

    const baseline = process.env.D091_BASELINE_DIST;
    if (baseline) {
      let expected;
      await withBrowser({ width: 1440, height: 900, port, root: baseline }, async ({ page, open }) => {
        await open(''); expected = await page.evaluate(engine); assert.deepEqual(page.errors, []);
        await shot(page, 'D091-1440-approved-baseline-default.png', images);
      });
      await withBrowser({ width: 1440, height: 900, port }, async ({ page, open }) => {
        await open(''); assert.deepEqual(await page.evaluate(engine), expected);
        assert.equal(await page.evaluate(hidden), true); assert.deepEqual(page.errors, []);
        await shot(page, 'D091-1440-candidate-default-parity.png', images);
      });
      receipts.push({ kind: 'approved-baseline-default-parity', baseline: 'be875201f9992ede9301df423ee57f9bcd9aa383', engineStateEqual: true, expected });
    } else receipts.push({ kind: 'approved-baseline-default-parity', result: 'NOT RUN: set D091_BASELINE_DIST' });
    provenance.result = 'PASS';
    console.log('D091 Plan A browser PASS: ' + receipts.length + ' scenario receipts, ' + images.length + ' original PNGs at ' + out);
  } catch (error) {
    provenance.result = 'FAIL'; provenance.firstFailure = error.stack; throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'D091-evidence.json'), JSON.stringify(provenance, null, 2) + '\n');
  }
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await startupBrowser();
