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

// D091 B: computed-style fingerprint of the startup scene (scene, label, moon, houses and each house, each with ::before
// and ::after). Elements report Typed OM computed values, so no font metrics or scrollbar width enter it; pseudo-elements
// report getComputedStyle without the used-value geometry (offsets, width, height, transform-origin). A pseudo-element
// without content is 'absent'. Outside loading the B scene must equal 10707fc: these pins were measured on the 10707fc
// build and on the B head with Chrome for Testing 153 (card D091), one per viewport, the same for welcome, error and
// reduced motion.
export const sceneFingerprint = `(() => {const root=document.querySelector('#startup'),props=['display','visibility','opacity','position','top','right','bottom','left','width','height','min-width','min-height','transform','transform-origin','filter','mix-blend-mode','background-color','background-image','background-position','background-size','background-repeat','box-shadow','border-top-width','border-top-style','border-top-color','border-top-left-radius','clip-path','content','animation-name','color','font-size','letter-spacing','z-index','overflow-x','overflow-y'],used=['top','right','bottom','left','width','height','transform-origin'],houses=[...root.querySelectorAll('.startup-houses i')],els=[['scene',root.querySelector('.startup-scene')],['label',root.querySelector('.startup-scene > span')],['moon',root.querySelector('.startup-moon')],['houses',root.querySelector('.startup-houses')],...houses.map((n,i)=>['house'+i,n])],out={houseCount:houses.length};for(const [k,n] of els){if(!n){out[k]='missing';continue;}const m=n.computedStyleMap();out[k]=Object.fromEntries(props.map(p=>[p,String(m.get(p))]));for(const pe of ['::before','::after']){const cs=getComputedStyle(n,pe);out[k+pe]=/^(none|normal)$/.test(cs.content)?'absent':Object.fromEntries(props.filter(p=>!used.includes(p)).map(p=>[p,cs.getPropertyValue(p)]));}}return out;})()`;
export const SCENE_PINS_10707FC = {
  '1440x900': '6e3f2fc0a78c19313d4cb70ce1839e893094490218e34a9d126bea0d81a3c1ef',
  '390x844': '5523fe70ae8b2ac18dc839073169bf3f199e6fe0cb60595b2a71e45e61ec4e74',
  '844x390': '898b22087852d08d1e3c934a4f58e547abc361193e720f48c2c2e830eacdc37f',
};

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

    // D091 reduced-motion repair (owner 2026-10-28 「先修再給你看圖」): the same explicitly labelled
    // 1500 ms delayed IndexedDB loading control as D091-390-loading-delayed-journal-control, now with
    // prefers-reduced-motion: reduce. Unknown duration must not read as a completed bar: the static
    // indicator stays visible, is clearly shorter than its track, is centred (not a fill level from the
    // track start) and is a segmented pattern rather than a solid fill. The PNG is taken before the
    // geometry assertions so a failing run keeps the defective frame; phase is re-read after the shot
    // (loading -> welcome/error is one-way), proving the frame is the loading state.
    const reducedLoading = `(() => {const track=document.querySelector('#startup .startup-loader'),fill=track.querySelector('i'),cs=getComputedStyle(fill),t=track.getBoundingClientRect(),f=fill.getBoundingClientRect();return{phase:document.querySelector('#startup').dataset.phase,ready:!!window.__gt?.ready,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,animationName:cs.animationName,transform:cs.transform,opacity:cs.opacity,backgroundColor:cs.backgroundColor,backgroundImage:cs.backgroundImage,track:{left:t.left,width:t.width,height:t.height},fill:{left:f.left,width:f.width,height:f.height},status:document.querySelector('#startup-status').textContent,waitVisible:document.querySelector('.startup-wait').getClientRects().length>0,overflow:document.documentElement.scrollWidth>innerWidth};})()`;
    await withBrowser({ width: 390, height: 844, port, keepWelcome: true, preload: slowJournal, settle: 0 }, async ({ page }) => {
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='loading' && !!document.querySelector('#startup .startup-loader i')", 'actual journal-wait loading under reduced motion');
      const m = await page.evaluate(reducedLoading);
      assert.equal(m.phase, 'loading'); assert.equal(m.ready, false); assert.equal(m.reduced, true);
      assert.equal(m.animationName, 'none');
      assert.ok(m.track.width > 0 && m.fill.width > 0 && m.fill.height > 0, 'a static indicator stays visible');
      await shot(page, 'D091-390-reduced-motion-loading-control.png', images);
      assert.equal(await page.evaluate("document.querySelector('#startup').dataset.phase"), 'loading', 'captured frame is still the loading state');
      const leftGap = m.fill.left - m.track.left, rightGap = m.track.left + m.track.width - (m.fill.left + m.fill.width);
      assert.ok(m.fill.width <= m.track.width / 4, `reduced-motion loading must not read as a completed bar: fill ${m.fill.width}px of ${m.track.width}px track`);
      assert.ok(leftGap > 0 && Math.abs(leftGap - rightGap) <= 1, `static segment centred, not a fill level from the track start: gaps ${leftGap}/${rightGap}px`);
      assert.match(m.backgroundImage, /gradient/, 'segmented pattern, not a solid fill'); assert.equal(m.backgroundColor, 'rgba(0, 0, 0, 0)', 'no solid fill colour');
      assert.doesNotMatch(m.status, /\d+\s*%/); assert.match(m.status, /正在準備/); assert.equal(m.waitVisible, true); assert.equal(m.overflow, false);
      await waitFor(page, welcome, 'delayed journal resolves under reduced motion');
      assert.deepEqual(page.errors, []);
      receipts.push({ kind: 'reduced-motion-loading-control', width: 390, height: 844, delayMs: 1500, control: 'actual IndexedDB success callback delayed, prefers-reduced-motion: reduce emulated; not device performance evidence', measured: m, readyEventually: true });
    });

    // D091 loading-motion refinement (owner 2026-10-28 「對照圖的動畫還可以精修一下，參考 town lab」; Lab main dde12ad
    // index.html #boot453): during an explicitly labelled 3000 ms delayed IndexedDB loading control (below the engine's
    // 4000 ms journal timeout) the shell shows the Lab-referenced ambience: a travelling rail light, window lights
    // (boot453Windows) and a breathing glow (boot453Glow). Every startup animation touches only transform/opacity and
    // nothing reads as progress. Frames are frozen at exact times through the Web Animations API, so each PNG is an
    // original, reproducible capture rather than an edit; phase is re-read after the last shot. Under
    // prefers-reduced-motion: reduce the shell runs no animation at all, in loading or on the welcome.
    const slowJournal3000 = slowJournal.replace('1500', '3000');
    const motion = `(() => {const root=document.querySelector('#startup'),rail=root.querySelector('.startup-loader'),r=rail.getBoundingClientRect(),light=getComputedStyle(rail.querySelector('i'));const part=n=>n.closest('.startup-loader')?'rail':n.closest('.startup-houses')?'window':n.classList.contains('startup-moon')?'moon':n.classList.contains('startup-scene')?'scene':n.tagName.toLowerCase();return{phase:root.dataset.phase,ready:!!window.__gt?.ready,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,rail:{width:r.width,height:r.height},lightImage:light.backgroundImage,text:root.querySelector('#startup-status').textContent+rail.textContent,anims:document.getAnimations().filter(a=>a.effect?.target&&root.contains(a.effect.target)).map(a=>({name:a.animationName,part:part(a.effect.target)+(a.effect.pseudoElement||''),state:a.playState,props:[...new Set(a.effect.getKeyframes().flatMap(k=>Object.keys(k)))].filter(p=>!['offset','computedOffset','easing','composite'].includes(p)).sort()}))};})()`;
    const freeze = ms => `(() => {const root=document.querySelector('#startup');for(const a of document.getAnimations())if(a.effect?.target&&root.contains(a.effect.target)){a.pause();a.currentTime=${ms};}})()`;
    const resume = "(() => {const root=document.querySelector('#startup');for(const a of document.getAnimations())if(a.effect?.target&&root.contains(a.effect.target)&&a.playState==='paused')a.play();})()";
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await withBrowser({ width, height, port, keepWelcome: true, preload: slowJournal3000, settle: 0 }, async ({ page }) => {
        await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='loading' && !!document.querySelector('#startup .startup-loader i')", 'actual journal-wait loading with motion');
        const m = await page.evaluate(motion);
        assert.equal(m.phase, 'loading'); assert.equal(m.ready, false); assert.equal(m.reduced, false);
        const parts = m.anims.map(a => a.part);
        assert.ok(parts.includes('rail'), 'the rail light travels');
        assert.ok(parts.filter(p => p === 'window::after').length >= 3, `Lab boot453Windows: window lights animate during loading (${parts})`);
        assert.ok(parts.some(p => p === 'scene::before' || p === 'moon::after'), `Lab boot453Glow: a glow breathes during loading (${parts})`);
        for (const a of m.anims) assert.ok(a.props.length && a.props.every(p => p === 'transform' || p === 'opacity'), `${a.name} on ${a.part} animates only transform/opacity: ${a.props}`);
        assert.ok(m.rail.height >= 6, `rail tall enough to carry the light at ${width}px: ${m.rail.height}px`);
        assert.match(m.lightImage, /gradient/, 'travelling light is a gradient, not a solid fill segment');
        assert.doesNotMatch(m.text, /\d+\s*%/);
        const frames = [];
        for (const ms of [550, 1100, 1650]) {
          await page.evaluate(freeze(ms)); await sleep(60);
          await shot(page, `D091-${width}-loading-motion-t${ms}.png`, images); frames.push(images.at(-1).file);
        }
        assert.equal(await page.evaluate("document.querySelector('#startup').dataset.phase"), 'loading', 'frozen frames are the loading state');
        await page.evaluate(resume);
        await waitFor(page, welcome, 'delayed journal resolves after motion frames');
        assert.deepEqual(page.errors, []);
        receipts.push({ kind: 'loading-motion-frames', width, height, delayMs: 3000, control: 'actual IndexedDB success callback delayed; frames frozen by Web Animations currentTime; not device smoothness evidence', source: 'Lab main dde12ad index.html #boot453', animations: m.anims, rail: m.rail, frames });
      });
    }
    await withBrowser({ width: 390, height: 844, port, keepWelcome: true, preload: slowJournal3000, settle: 0 }, async ({ page }) => {
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='loading' && !!document.querySelector('#startup .startup-loader i')", 'actual journal-wait loading, reduced motion, ambience');
      const loading = await page.evaluate(motion);
      assert.equal(loading.phase, 'loading'); assert.equal(loading.reduced, true);
      assert.deepEqual(loading.anims, [], 'reduced motion: no startup animation while loading');
      await waitFor(page, welcome, 'delayed journal resolves under reduced motion, ambience');
      assert.deepEqual((await page.evaluate(motion)).anims, [], 'reduced motion: no startup animation on the welcome');
      assert.deepEqual(page.errors, []);
      receipts.push({ kind: 'reduced-motion-no-ambience', width: 390, height: 844, delayMs: 3000, loadingAnimations: 0, welcomeAnimations: 0 });
    });

    // D091 loading-motion scope (independent review 2026-10-28; owner 「其它的沒問題」): the ambience runs only while
    // loading. With normal motion the welcome and an observed startup failure run no startup animation and keep the
    // 10707fc scene; the moon halo, hidden behind the houses on phones, is not generated there. Same explicitly labelled
    // 3000 ms delayed IndexedDB loading control; the failure control fails WebGL context creation on every attempt.
    const failWebgl = "(() => {const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:original.call(this,type,...args);};})();";
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await withBrowser({ width, height, port, keepWelcome: true, preload: slowJournal3000, settle: 0 }, async ({ page }) => {
        await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='loading' && !!document.querySelector('#startup .startup-loader i')", 'actual journal-wait loading, scope');
        const loading = await page.evaluate(motion);
        assert.equal(loading.phase, 'loading');
        const parts = loading.anims.map(a => a.part);
        assert.equal(parts.includes('moon::after'), width > 640, `moon halo only where the moon is visible (${width}px): ${parts}`);
        await waitFor(page, welcome, 'delayed journal resolves, scope');
        const after = await page.evaluate(motion);
        assert.equal(after.phase, 'welcome'); assert.deepEqual(after.anims, [], 'normal motion: no startup animation on the welcome');
        assert.deepEqual(page.errors, []);
        receipts.push({ kind: 'loading-motion-scope', width, height, delayMs: 3000, loadingParts: parts, welcomeAnimations: 0 });
      });
    }
    await withBrowser({ width: 390, height: 844, port, keepWelcome: true, preload: failWebgl, settle: 0 }, async ({ page }) => {
      await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='error'", 'actual renderer failure, scope');
      const failed = await page.evaluate(motion);
      assert.equal(failed.phase, 'error'); assert.deepEqual(failed.anims, [], 'normal motion: no startup animation on the error screen');
      assert.ok(page.errors.some(x => /WebGL|context/i.test(x)), 'the induced renderer failure is the observed error');
      receipts.push({ kind: 'error-phase-scope', width: 390, height: 844, control: 'WebGL context creation fails on every attempt', errorAnimations: 0, expectedErrors: page.errors });
    });
    await withBrowser({ width: 390, height: 844, port, keepWelcome: true, preload: slowJournal3000, settle: 0 }, async ({ page }) => {
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='loading' && !!document.querySelector('#startup .startup-loader i')", 'reduced-motion loading, dash geometry');
      const dash = await page.evaluate("(() => {const cs=getComputedStyle(document.querySelector('#startup .startup-loader i'));return{size:cs.backgroundSize,radius:cs.borderTopLeftRadius,phase:document.querySelector('#startup').dataset.phase};})()");
      assert.equal(dash.phase, 'loading'); assert.equal(dash.size, '100% 4px', 'reduced-motion dashes are 4px tall'); assert.equal(dash.radius, '0px', 'reduced-motion dashes are square-ended');
      await waitFor(page, welcome, 'delayed journal resolves, dash geometry');
      assert.deepEqual(page.errors, []);
      receipts.push({ kind: 'reduced-motion-dash-geometry', width: 390, height: 844, ...dash });
    });

    // D091 single window drawing, light width and halo generation (second independent review 2026-10-28). While loading
    // with normal motion the house background draws no windows, so the lit windows exist once, in the ::after layer that
    // dims them; the travelling light is at most half the rail in a frozen frame (an override to a fill fails); the halo
    // is not generated at 640px and narrower; and the error screen runs no startup animation at 1440 as well as at 390.
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await withBrowser({ width, height, port, keepWelcome: true, preload: slowJournal3000, settle: 0 }, async ({ page }) => {
        await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='loading' && !!document.querySelector('#startup .startup-loader i')", 'actual journal-wait loading, windows and light');
        await page.evaluate(freeze(1100));
        const w = await page.evaluate(`(() => {const root=document.querySelector('#startup'),houses=[...root.querySelectorAll('.startup-houses i')],rail=root.querySelector('.startup-loader').getBoundingClientRect(),light=root.querySelector('.startup-loader i').getBoundingClientRect(),moon=getComputedStyle(root.querySelector('.startup-moon'),'::after');return{phase:root.dataset.phase,houseImages:houses.map(h=>getComputedStyle(h).backgroundImage),windowLayers:houses.map(h=>getComputedStyle(h,'::after').backgroundImage),lightShare:light.width/rail.width,haloDisplay:moon.display,haloContent:moon.content};})()`);
        assert.equal(w.phase, 'loading');
        assert.ok(w.houseImages.every(x => x === 'none'), `while loading the house background draws no windows: ${w.houseImages[0]}`);
        assert.ok(w.windowLayers.every(x => /rgb\(229, 195, 125\)/.test(x)), `the ::after layer draws the lit windows: ${w.windowLayers[0]}`);
        assert.ok(w.lightShare > 0 && w.lightShare <= 0.5, `travelling light is at most half the rail: ${w.lightShare}`);
        if (width <= 640) assert.equal(w.haloDisplay, 'none', 'halo not generated on phones'); else assert.notEqual(w.haloContent, 'none', 'halo generated on wide screens');
        await page.evaluate(resume);
        await waitFor(page, welcome, 'delayed journal resolves, windows and light');
        assert.ok((await page.evaluate("[...document.querySelectorAll('#startup .startup-houses i')].map(h=>getComputedStyle(h).backgroundImage)")).every(x => /rgb\(229, 195, 125\)/.test(x)), 'the welcome keeps the 10707fc lit windows in the house background');
        assert.deepEqual(page.errors, []);
        receipts.push({ kind: 'loading-windows-light-halo', width, height, lightShare: w.lightShare, haloDisplay: w.haloDisplay, houseImagesWhileLoading: 'none', windowLayer: 'lit #e5c37d' });
      });
    }
    await withBrowser({ width: 1440, height: 900, port, keepWelcome: true, preload: failWebgl, settle: 0 }, async ({ page }) => {
      await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='error'", 'actual renderer failure, scope 1440');
      const failed = await page.evaluate(motion);
      assert.equal(failed.phase, 'error'); assert.deepEqual(failed.anims, [], 'normal motion: no startup animation on the 1440 error screen');
      assert.ok(page.errors.some(x => /WebGL|context/i.test(x)), 'the induced renderer failure is the observed error');
      receipts.push({ kind: 'error-phase-scope', width: 1440, height: 900, control: 'WebGL context creation fails on every attempt', errorAnimations: 0, expectedErrors: page.errors });
    });

    // D091 B hardening (owner 2026-10-28 chose B 「載入條＋場景呼吸」; card: 「等業主定檔後，再補那一檔的測試」). The final
    // review's mutants showed changes that slipped past every check above; these pin the chosen variant instead, at 1440,
    // 390 and 844x390, with the same explicitly labelled 3000 ms delayed IndexedDB loading control and a WebGL failure:
    // - welcome, error, and reduced motion even while loading: the scene fingerprint equals the 10707fc pin, whatever
    //   selector, @media, extra <style>, <link> or style attribute would change it, and no startup animation runs;
    // - loading with normal motion, counting the subjects first: rail 1, windows 5, street glow 1 and the halo only wider
    //   than 640px, all running. Each house ::after is drawn, visible, inset 0 and paints the welcome's own window grid;
    //   across one 9.6s cycle each house dims once to .15 for about a second, never two at once; the glow and the halo
    //   breathe in antiphase; the light travels left to right, covers at most half the rail and casts no shadow;
    // - apart from the loading-only layers and the house background, the loading scene is the welcome scene.
    const ambience = `(() => {const root=document.querySelector('#startup'),rail=root.querySelector('.startup-loader'),light=rail.querySelector('i'),r=rail.getBoundingClientRect(),l=light.getBoundingClientRect(),lc=getComputedStyle(light),layer=cs=>({content:cs.content,display:cs.display,visibility:cs.visibility,pos:cs.position,inset:[cs.top,cs.right,cs.bottom,cs.left].join(' '),image:cs.backgroundImage,bgPosition:cs.backgroundPosition,bgSize:cs.backgroundSize,bgRepeat:cs.backgroundRepeat,shadow:cs.boxShadow,name:cs.animationName});return{phase:root.dataset.phase,houses:[...root.querySelectorAll('.startup-houses i')].map(h=>{const cs=getComputedStyle(h);return{image:cs.backgroundImage,bgPosition:cs.backgroundPosition,bgSize:cs.backgroundSize,bgRepeat:cs.backgroundRepeat,after:layer(getComputedStyle(h,'::after'))};}),moon:layer(getComputedStyle(root.querySelector('.startup-moon'),'::after')),glow:layer(getComputedStyle(root.querySelector('.startup-scene'),'::before')),rail:{left:r.left,right:r.right,width:r.width,overflow:getComputedStyle(rail).overflow},light:{left:l.left,right:l.right,shadow:lc.boxShadow,color:lc.backgroundColor}};})()`;
    const cycle = `(() => {const root=document.querySelector('#startup'),anims=document.getAnimations().filter(a=>a.effect?.target&&root.contains(a.effect.target)),houses=[...root.querySelectorAll('.startup-houses i')],moon=root.querySelector('.startup-moon'),scene=root.querySelector('.startup-scene'),out=[];for(let t=0;t<9600;t+=100){for(const a of anims){a.pause();a.currentTime=t;}out.push({t,windows:houses.map(h=>+getComputedStyle(h,'::after').opacity),moon:+getComputedStyle(moon,'::after').opacity,glow:+getComputedStyle(scene,'::before').opacity});}return out;})()`;
    const motionPreference = value => ({ features: [{ name: 'prefers-reduced-motion', value }] });
    const pinned = async (page, size, what, preferences) => {
      for (const value of preferences) {
        await page.send('Emulation.setEmulatedMedia', motionPreference(value));
        const fp = await page.evaluate(sceneFingerprint);
        assert.equal(fp.houseCount, 5, `${what} ${size} ${value}: five houses`);
        assert.equal(sha(JSON.stringify(fp)), SCENE_PINS_10707FC[size], `${what} ${size} ${value}: the scene is the 10707fc scene`);
        assert.deepEqual((await page.evaluate(motion)).anims, [], `${what} ${size} ${value}: no startup animation`);
      }
      await page.send('Emulation.setEmulatedMedia', motionPreference('no-preference'));
    };
    for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
      const size = `${width}x${height}`, wide = width > 640;
      await withBrowser({ width, height, port, keepWelcome: true, preload: slowJournal3000, settle: 0 }, async ({ page }) => {
        await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='loading' && !!document.querySelector('#startup .startup-loader i')", 'actual journal-wait loading, B hardening');
        const m = await page.evaluate(motion);
        assert.equal(m.phase, 'loading'); assert.equal(m.reduced, false);
        const count = part => m.anims.filter(a => a.part === part).length;
        assert.deepEqual([count('rail'), count('window::after'), count('scene::before'), count('moon::after'), m.anims.length], [1, 5, 1, wide ? 1 : 0, wide ? 8 : 7], `${size}: rail, five windows, glow, and the halo only wider than 640px: ${m.anims.map(a => a.part)}`);
        assert.ok(m.anims.every(a => a.state === 'running'), `${size}: every startup animation runs`);
        const lights = [];
        for (const ms of [550, 1100, 1650]) {
          await page.evaluate(freeze(ms)); lights.push(await page.evaluate(ambience));
        }
        const a = lights[1];
        assert.equal(a.houses.length, 5, `${size}: five houses`);
        for (const [k, h] of a.houses.entries()) {
          assert.equal(h.image, 'none', `${size} house ${k}: the house background draws no windows while loading`);
          assert.deepEqual([h.after.content, h.after.display, h.after.visibility, h.after.pos, h.after.inset, h.after.name], ['""', 'block', 'visible', 'absolute', '0px 0px 0px 0px', 'startup-windows'], `${size} house ${k}: the lit-window layer is drawn, visible and covers the house`);
        }
        assert.deepEqual([a.glow.content, a.glow.display, a.glow.visibility, a.glow.name], ['""', 'block', 'visible', 'startup-breathe'], `${size}: the street glow is drawn and breathes`);
        assert.match(a.glow.image, /rgba\(0, 0, 0, 0\)\)$/, `${size}: the street glow fades to transparent at its edge`);
        if (wide) assert.deepEqual([a.moon.content, a.moon.display, a.moon.visibility, a.moon.name], ['""', 'block', 'visible', 'startup-breathe'], `${size}: the moon halo is drawn and breathes`);
        else assert.equal(a.moon.display, 'none', `${size}: no moon halo at 640px and narrower`);
        assert.deepEqual([a.rail.overflow, a.light.shadow, a.light.color], ['hidden', 'none', 'rgba(0, 0, 0, 0)'], `${size}: the light is clipped to the rail, casts no shadow and has no solid fill`);
        const shares = lights.map(f => (Math.min(f.light.right, f.rail.right) - Math.max(f.light.left, f.rail.left)) / f.rail.width);
        assert.ok(shares.every(s => s > 0 && s <= 0.5), `${size}: the light is on the rail and covers at most half of it: ${shares}`);
        assert.ok(lights[0].light.left < lights[1].light.left && lights[1].light.left < lights[2].light.left, `${size}: the light travels left to right: ${lights.map(f => f.light.left)}`);
        const loadingFp = await page.evaluate(sceneFingerprint);
        const samples = await page.evaluate(cycle);
        assert.ok(samples.length === 96 && samples.every(s => s.windows.length === 5 && s.windows.filter(o => o < 0.5).length <= 1), `${size}: never two houses dim at once`);
        const dims = [];
        for (let k = 0; k < 5; k++) {
          const o = samples.map(s => s.windows[k]), low = o.map(x => x < 0.5), starts = low.flatMap((d, i) => d && !low.at(i - 1) ? [samples[i].t] : []), seconds = low.filter(Boolean).length / 10;
          assert.ok(Math.abs(Math.min(...o) - 0.15) < 0.005 && Math.max(...o) === 1, `${size} house ${k}: lit at 1, dimmed to .15: ${Math.min(...o)}..${Math.max(...o)}`);
          assert.ok(starts.length === 1 && seconds >= 1 && seconds <= 1.6, `${size} house ${k}: dims once a cycle for about a second: starts ${starts}, ${seconds}s`);
          dims.push({ house: k, fromMs: starts[0], seconds });
        }
        const at = t => samples.find(s => s.t === t);
        assert.deepEqual([at(0).glow, at(2400).glow], [1, 0.5], `${size}: the street glow breathes`);
        if (wide) assert.deepEqual([at(0).moon, at(2400).moon], [0.5, 1], `${size}: the halo breathes in antiphase with the street glow`);
        assert.ok(samples.every(s => s.glow >= 0.5 && s.glow <= 1 && (!wide || (s.moon >= 0.5 && s.moon <= 1))), `${size}: breathing stays between .5 and 1`);
        assert.equal(await page.evaluate("document.querySelector('#startup').dataset.phase"), 'loading', `${size}: measured while loading`);
        await pinned(page, size, 'loading under reduced motion', ['reduce']);
        await waitFor(page, welcome, 'delayed journal resolves, B hardening');
        await pinned(page, size, 'welcome', ['no-preference', 'reduce']);
        const welcomeFp = await page.evaluate(sceneFingerprint), w = await page.evaluate(ambience);
        for (const [k, h] of w.houses.entries()) {
          const lit = a.houses[k].after;
          assert.deepEqual([h.image, h.bgPosition, h.bgSize, h.bgRepeat], [lit.image + ', none', lit.bgPosition + ', 0% 0%', lit.bgSize + ', auto', lit.bgRepeat + ', repeat'], `${size} house ${k}: while loading the ::after paints the welcome's own windows`);
        }
        for (const key of Object.keys(welcomeFp)) {
          if (/^(house\d::after|moon::after|scene::before)$/.test(key)) continue;
          // While loading the house background is one 'none' layer, so its position/size/repeat lists keep the first layer.
          const first = s => String(s).split(', ')[0];
          const strip = v => /^house\d$/.test(key) && typeof v === 'object' ? { ...v, 'background-image': 'differs while loading', 'background-position': first(v['background-position']), 'background-size': first(v['background-size']), 'background-repeat': first(v['background-repeat']) } : v;
          assert.deepEqual(strip(loadingFp[key]), strip(welcomeFp[key]), `${size} ${key}: apart from the loading-only layers, the loading scene is the welcome scene`);
        }
        assert.deepEqual(page.errors, []);
        receipts.push({ kind: 'b-hardening-loading-welcome', width, height, delayMs: 3000, control: 'actual IndexedDB success callback delayed; animations sampled through Web Animations currentTime; not device smoothness evidence', pin: SCENE_PINS_10707FC[size], loadingAnimations: m.anims.length, lightShares: shares, dims, welcomePinned: ['no-preference', 'reduce'], loadingReducedPinned: true });
      });
      await withBrowser({ width, height, port, keepWelcome: true, preload: failWebgl, settle: 0 }, async ({ page }) => {
        await navigate(page); await waitFor(page, "document.querySelector('#startup')?.dataset.phase==='error'", 'actual renderer failure, B hardening');
        await pinned(page, size, 'error', ['no-preference', 'reduce']);
        assert.ok(page.errors.some(x => /WebGL|context/i.test(x)), 'the induced renderer failure is the observed error');
        receipts.push({ kind: 'b-hardening-error', width, height, control: 'WebGL context creation fails on every attempt', pin: SCENE_PINS_10707FC[size], errorAnimations: 0, expectedErrors: page.errors });
      });
    }
    provenance.result = 'PASS';
    console.log('D091 Plan A browser PASS: ' + receipts.length + ' scenario receipts, ' + images.length + ' original PNGs at ' + out);
  } catch (error) {
    provenance.result = 'FAIL'; provenance.firstFailure = error.stack; throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'D091-evidence.json'), JSON.stringify(provenance, null, 2) + '\n');
  }
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await startupBrowser();
