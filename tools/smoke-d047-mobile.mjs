// D047: genuine Chrome CDP touch at 412×860, not an Android-device run.
// Lifecycle events are explicitly injected; touch and lost capture use Chrome.
// Run after build: node tools/smoke-d047-mobile.mjs. Aggregate entrypoint below.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { pageSession, free } from './smoke-d011.mjs';
import { d044Base, BLOCKS } from './d044-cities.mjs';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { loadCode } from '../src/io/save.ts';

const J = JSON.stringify, W = 412, H = 860, OUT = path.join(ROOT, 'scratch/shots');
const [bx, bz] = BLOCKS.B;
const footprint = (x, z) => Array.from({ length: 9 }, (_, i) => [x + i % 3, z + Math.floor(i / 3)]);
function fixture(rank = 21) {
  const { code, KT, vrank } = d044Base(), raw = { ...decodeLabCode(code).save.raw, rk: rank, money: 1000000,
    cms385: { act: 'steel40', st: 140, acc: 12.5, hold: 0, n: 0, done: [] } };
  delete raw.z; delete raw.d3;
  return { code: encodeLabCode(raw, { deflate: true }), KT, vrank };
}
const STATE = `(()=>{const s=__gt.sim();return {hash:s.hash,money:s.money,day:s.day,events:s.events,history:__gt.history()};})()`;
const FOOT = `(()=>{const L=__gt.layers();return ${J(footprint(bx, bz))}.map(([x,z])=>L.occ[z*L.n+x]);})()`;

export async function d047MobileSmoke(browser, log) {
  fs.mkdirSync(OUT, { recursive: true });
  const run = async (name, fn, rank = 21) => {
    await browser({ width: 960, height: 900 }, async ({ open, page }) => {
      const p = await pageSession(page, open, { W, H }), { ev, toasts, waitFor } = p;
      const F = fixture(rank);
      const shot = async name => { const r = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `D047-mobile-${name}.png`), Buffer.from(r.data, 'base64')); };
      try {
        await p.open('sample=seed516&clean=1'); await ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(F.code)})`); await p.open('');
        assert.ok(await waitFor(async () => !(await toasts()).length, 4000));
        await ev(`window.__d047Touches=[];addEventListener('pointerdown',e=>{window.__d047Pid=e.pointerId;window.__d047Touches.push([e.pointerType,e.isTrusted]);},true)`);
        await fn(p, page, shot, F); log(true, 'D047 mobile ' + name);
        const touches = await ev('window.__d047Touches ?? []');
        // Reload tests re-install their probe; all recorded interaction is trusted touch.
        assert.ok(touches.length && touches.every(([type, trusted]) => type === 'touch' && trusted), J(touches));
        log(true, 'D047 mobile ' + name + ': trusted touch events');
      } catch (e) { log(false, 'D047 mobile ' + name, e.stack); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(!ext.length && !page.errors.length, 'D047 mobile ' + name + ': no external assets or console errors', [...ext, ...page.errors].join('\n'));
    });
  };
  const chooseSpace = async p => {
    if ((await p.ev('__gt.ui()')).tool !== 'civic') await p.tapBtn('[data-t="civic"]');
    await p.tapBtn('[data-c="megaproject"]'); assert.equal((await p.ev('__gt.ui()')).civicTool, 'megaproject');
    await p.ev(`__gt.view(${bx + 1.5},${bz + 1.5},1.7)`); await p.frames(2);
  };
  const hold = async (p, target = [bx, bz]) => {
    const point = await p.cell(...target);
    assert.equal(await p.hit(point), 'CANVAS', `the held cell must be unobscured: ${J(point)}`);
    await p.touch('touchStart', [point]); await p.frames(2);
    const stroke = await p.ev('__gt.stroke()');
    assert.ok(stroke && stroke.preview, 'trusted pointerdown must arm a preview');
    return { point, stroke };
  };
  const cleanCancelled = async (p, before) => {
    assert.deepEqual(await p.ev(STATE), before, 'cancelled gesture must not change simulation/history/RNG hash/money');
    assert.equal(await p.ev('__gt.stroke()'), null); assert.equal(await p.ev('__gt.previewCount()'), 0);
    assert.equal((await p.ev('__gt.ui()')).pointers, 0); assert.equal((await p.rectOf('#costTag')).hidden, true);
  };
  const safeTag = async p => {
    await p.frames(3);
    const [tag, hud, notices, dock] = await Promise.all(['#costTag', '#hud', '#toasts', '#dock'].map(p.rectOf));
    assert.ok(!tag.hidden && tag.w > 30 && tag.h >= 26, J(tag));
    assert.ok(tag.l >= 7.5 && tag.r <= W - 7.5 && tag.t >= 0 && tag.b <= H, J(tag));
    assert.ok(tag.t >= hud.b + 7 && tag.b <= dock.t - 7, J({ tag, hud, dock }));
    if ((await p.toasts()).length) assert.ok(tag.t >= notices.b + 7, J({ tag, notices }));
  };

  await run('rank lock, nine-cell placement, invalid site, repeat, undo and persistence', async (p, page, shot, F) => {
    const { ev, tapBtn, toasts, waitFor, release } = p;
    await tapBtn('[data-t="civic"]');
    const buttons = await ev(`[...document.querySelectorAll('#civicSub button')].map(b=>{const r=b.getBoundingClientRect();return [r.width,r.height,r.left,r.right,r.top,r.bottom];})`);
    assert.equal(buttons.length, 18); assert.ok(buttons.every(([w,h,l,r,t,b])=>w>=44&&h>=44&&l>=0&&r<=W&&t>=0&&b<=H));
    const locked = await ev(STATE), current = (await ev('__gt.ui()')).civicTool;
    assert.equal(await ev(`document.querySelector('[data-c="megaproject"]').getAttribute('aria-disabled')`), 'true');
    for (let i = 0; i < 2; i++) await tapBtn('[data-c="megaproject"]');
    assert.equal((await ev('__gt.ui()')).civicTool, current); assert.deepEqual(await ev(STATE), locked);
    assert.ok((await toasts()).some(t => t === '🔒 太空研究中心：城市 Lv.22 解鎖'));
    await ev('__gt.simRank(21)'); await chooseSpace(p);
    assert.equal(await ev(`document.querySelector('[data-c="megaproject"]').getAttribute('aria-disabled')`), null);
    const before = await ev(STATE), { stroke } = await hold(p);
    assert.deepEqual(stroke.preview, { count: 1, total: 4500, cells: 9 }); assert.equal(await ev('__gt.previewCount()'), 9);
    assert.deepEqual(await ev(STATE), before); assert.ok((await toasts()).length, 'cost tag is checked while notices and the active commission HUD are present');
    await safeTag(p);   // Keep the overlap assertion while the lock notices are live.
    assert.ok(await waitFor(async () => !(await toasts()).length, 4000), 'old lock notices must expire before the unlocked preview review image');
    assert.deepEqual(await ev('__gt.stroke()'), stroke, 'the genuine touch must remain held while notices expire');
    assert.equal(await ev('__gt.previewCount()'), 9); assert.deepEqual(await ev(STATE), before);
    await safeTag(p); await shot('01-nine-cell-preview-412x860'); await release();
    const after = await ev(STATE), placed = after.history.at(-1), cells = await ev(FOOT);
    assert.equal(after.money, before.money - 4500); assert.equal(after.events, before.events + 1);
    assert.equal(placed.t, 'place'); assert.equal(placed.k, 51); assert.equal(placed.cost, 4500);
    assert.deepEqual([placed.x, placed.z], [bx, bz]); assert.ok(cells.every(id => id === placed.id));
    await shot('02-placed-412x860');
    const invalid = await hold(p); assert.equal(invalid.stroke.preview.count, 0); assert.equal(invalid.stroke.preview.cells, 9);
    assert.equal(await ev(`document.querySelector('#costTag').classList.contains('bad')`), true); await safeTag(p); await release();
    assert.deepEqual(await ev(STATE), after, 'occupied footprint must reject the entire tap');
    await tapBtn('#undo'); assert.equal((await ev(STATE)).money, before.money); assert.ok((await ev(FOOT)).every(id => id === 0));
    for (let i = 0; i < 3; i++) {
      assert.ok(await waitFor(async () => !(await toasts()).length, 4000));
      const a = await ev(STATE); await hold(p); await release(); const b = await ev(STATE);
      assert.equal(b.events, a.events + 1); assert.equal(b.money, a.money - 4500);
      await tapBtn('#undo'); const c = await ev(STATE);
      assert.equal(c.money, a.money); assert.equal(c.events, b.events + 1); assert.equal(c.history.at(-1).t, 'undo');
      assert.ok((await ev(FOOT)).every(id => id === 0));
    }
    await hold(p); await release();
    const final = await ev(STATE), finalFoot = await ev(FOOT), code = await ev('__gt.save()');
    const L = loadCode(code, F.KT, F.vrank); assert.ok(L.ok); assert.equal(L.sim.money, final.money);
    assert.ok(footprint(bx, bz).every(([x,z]) => L.sim.city.occ[z * L.sim.city.n + x] === finalFoot[0]), 'share code retains all nine occupancy cells');
    await ev('__gt.saveNow()'); await p.open('');
    const reloaded = await ev(STATE); assert.equal(reloaded.money, final.money); assert.deepEqual(await ev(FOOT), finalFoot);
    assert.deepEqual(reloaded.history.filter(e=>e.t==='place'&&e.k===51), final.history.filter(e=>e.t==='place'&&e.k===51));
    assert.equal(await ev('__gt.stroke()'), null); assert.equal(await ev('__gt.previewCount()'), 0);
    assert.ok(await waitFor(async () => !(await toasts()).length, 4000));
    await ev(`window.__d047Touches=[];addEventListener('pointerdown',e=>window.__d047Touches.push([e.pointerType,e.isTrusted]),true)`);
    await tapBtn('#menuBtn'); await tapBtn('#menuX'); assert.equal((await ev(STATE)).money, final.money);
    assert.equal(await ev('document.documentElement.scrollWidth <= innerWidth'), true);
  }, 20);

  await run('drag, second finger, toolbar, panels, capture loss and lifecycle interruptions', async (p, page, shot) => {
    await chooseSpace(p);
    const before = await p.ev(STATE);
    let h = await hold(p); await p.touch('touchMove', [[h.point[0] + 24, h.point[1]]]); await p.frames(2);
    assert.equal(await p.ev('__gt.previewCount()'), 0); await p.release(); await cleanCancelled(p, before);
    for (const ui of [false, true]) {
      h = await hold(p); const other = ui ? await p.center('#menuBtn') : [h.point[0] + 64, h.point[1]];
      await p.touch('touchStart', [[...h.point, 0], [...other, 1]]); await p.frames(2);
      assert.equal(await p.ev('__gt.stroke()'), null); assert.equal(await p.ev('__gt.previewCount()'), 0);
      await p.touch('touchEnd', [[...other, 1]]); await p.touch('touchMove', [[h.point[0] + 2, h.point[1], 0]]); await p.release();
      await cleanCancelled(p, before);
      if (!(await p.rectOf('#menu')).hidden) await p.tapBtn('#menuX');
    }
    // Programmatic activation models keyboard/assistive activation while a real
    // captured touch remains down; closing the overlay must not revive it.
    for (const activation of ['menu', 'commission', 'export', 'toolbar']) {
      h = await hold(p);
      if (activation === 'menu') await p.ev(`document.querySelector('#menuBtn').click()`);
      else if (activation === 'toolbar') await p.ev(`document.querySelector('#spd button').click()`);
      else await p.ev(`__gt.menu(${J(activation)})`);
      assert.equal(await p.ev('__gt.stroke()'), null); assert.equal(await p.ev('__gt.previewCount()'), 0);
      if (activation !== 'toolbar') await p.key('Escape');
      await p.release(); await cleanCancelled(p, before);
    }
    await hold(p); await p.touch('touchCancel', []); await p.frames(2); await cleanCancelled(p, before);
    // A touchStart only requests capture. Releasing that pending request before
    // the next pointer event produces neither gotpointercapture nor lostpointercapture.
    // First observe active, trusted capture; both movements remain below the
    // product's 8px drag-cancel threshold so that path cannot mask capture loss.
    await p.ev(`(()=>{
      const c=document.querySelector('canvas'), events=[], types=['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture'];
      const probe=window.__d047Capture={pid:null,origin:null,events};
      const record=e=>{
        if(e.type==='pointerdown'&&e.target===c){probe.pid=e.pointerId;probe.origin=[e.clientX,e.clientY];}
        events.push({type:e.type,pid:e.pointerId,trusted:e.isTrusted,target:e.target.nodeName,x:e.clientX,y:e.clientY,buttons:e.buttons,captured:c.hasPointerCapture(e.pointerId)});
      };
      for(const type of types)addEventListener(type,record,true);
      probe.stop=()=>{for(const type of types)removeEventListener(type,record,true);};
    })()`);
    let capturePhase = 'arm';
    const captureState = () => p.ev(`(()=>{const p=window.__d047Capture;return {pid:p.pid,origin:p.origin,events:p.events,
      captured:p.pid!==null&&document.querySelector('canvas').hasPointerCapture(p.pid),stroke:__gt.stroke(),preview:__gt.previewCount(),pointers:__gt.ui().pointers,costHidden:document.querySelector('#costTag').hidden};})()`);
    try {
      await hold(p); const armed = await captureState(), pid = armed.pid, [x, y] = armed.origin;
      assert.equal(typeof pid, 'number'); assert.equal(armed.captured, true, 'capture is requested for the held pointer');
      capturePhase = 'activate capture';
      await p.touch('touchMove', [[x + 6, y, 0]]); await p.frames(2);
      const active = await captureState();
      assert.ok(active.events.some(e=>e.type==='gotpointercapture'&&e.pid===pid&&e.trusted&&e.target==='CANVAS'), 'must receive real gotpointercapture before requesting release');
      assert.ok(active.events.some(e=>e.type==='pointermove'&&e.pid===pid&&e.trusted), 'activation move must reach the page');
      assert.equal(active.captured, true); assert.equal(active.stroke?.moved, false);
      assert.deepEqual(active.stroke?.preview, { count: 1, total: 4500, cells: 9 });
      assert.deepEqual(await p.ev(STATE), before, 'activating capture must not change the city');
      capturePhase = 'request release';
      await p.ev(`(()=>{const p=window.__d047Capture;p.events.push({type:'release-request',pid:p.pid});document.querySelector('canvas').releasePointerCapture(p.pid);})()`);
      assert.equal((await captureState()).captured, false, 'the capture release request must take effect');
      capturePhase = 'observe capture loss';
      await p.touch('touchMove', [[x + 7, y, 0]]); await p.frames(2);
      const lost = await captureState(), events = lost.events;
      const requestIndex = events.findIndex(e=>e.type==='release-request'&&e.pid===pid);
      const lostIndex = events.findIndex(e=>e.type==='lostpointercapture'&&e.pid===pid&&e.trusted&&e.target==='CANVAS');
      assert.ok(lostIndex > requestIndex, 'must receive real lostpointercapture after requesting release');
      assert.ok(events.slice(lostIndex+1).some(e=>e.type==='pointermove'&&e.pid===pid&&e.trusted), 'lost capture must precede the following real move');
      assert.ok(events.filter(e=>e.type==='pointermove'&&e.pid===pid).every(e=>Math.hypot(e.x-x,e.y-y)<8), 'all movement must stay below drag cancellation');
      assert.equal(lost.stroke, null); assert.equal(lost.preview, 0); assert.equal(lost.costHidden, true);
      assert.deepEqual(await p.ev(STATE), before, 'capture loss must not change the city');
      capturePhase = 'lift and verify';
      await p.release(); await cleanCancelled(p, before);
    } catch (e) {
      const diagnostic = await captureState().catch(error=>({probeError:String(error)}));
      throw new Error(`Capture phase ${capturePhase}: ${e.message}\nPointer diagnostics: ${J(diagnostic)}`, { cause: e });
    } finally { await p.ev('window.__d047Capture.stop()'); }
    for (const type of ['blur', 'pagehide', 'visibilitychange']) {
      await hold(p);
      if (type === 'visibilitychange') {
        await p.ev(`Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))`);
        assert.equal(await p.ev('__gt.stroke()'), null);
        await p.ev(`delete document.visibilityState`);
      } else await p.ev(`window.dispatchEvent(new Event(${J(type)}))`);
      await p.release(); await cleanCancelled(p, before);
    }
    // After every interruption, the following genuine tap still works once.
    await hold(p); await p.release(); const after = await p.ev(STATE);
    assert.equal(after.events, before.events + 1); assert.equal(after.money, before.money - 4500);
    await shot('03-interrupted-then-repeated-412x860');
    // Undo via keyboard/API while another preview is held must cancel that preview.
    await p.ev(`__gt.view(${BLOCKS.C[0] + 1.5},${BLOCKS.C[1] + 1.5},1.7)`);
    await hold(p, BLOCKS.C); await p.ev('__gt.undo()'); assert.equal(await p.ev('__gt.stroke()'), null);
    await p.release(); assert.equal((await p.ev(STATE)).money, before.money);
    assert.equal((await p.ev(STATE)).events, after.events + 1); assert.ok((await p.ev(FOOT)).every(id=>id===0));
  });

  await run('road, zone, dock-safe preview, one-finger rotation and two-finger camera regression', async p => {
    await p.ev(`__gt.view(${bx + 1.5},${bz + 1.5},1.7)`);
    for (const [tool, w, h] of [['road', 3, 1], ['zr', 3, 2]]) {
      await p.tapBtn(`[data-t="${tool}"]`); const box = await p.findBox(w, h, free); assert.equal(box.length, w*h);
      const before = await p.ev(STATE), a = box[0][1], b = box.at(-1)[1];
      await p.drag(a, b); const stroke = await p.ev('__gt.stroke()'); assert.equal(stroke.preview.count, w*h);
      await p.release(); const after = await p.ev(STATE); assert.equal(after.events, before.events + w*h); assert.equal(after.money, before.money - stroke.preview.total);
      await p.tapBtn('#undo'); assert.equal((await p.ev(STATE)).money, before.money);
      assert.ok(await p.waitFor(async () => !(await p.toasts()).length, 4000));
    }
    await p.tapBtn('[data-t="road"]'); const box = await p.findBox(1, 1, free); assert.equal(box.length, 1);
    const beforeDock = await p.ev(STATE); await p.drag(box[0][1], [W/2,H-35]);
    assert.ok(await p.ev('__gt.stroke()'), 'captured road preview is preserved at the dock'); await safeTag(p);
    await p.release(); await cleanCancelled(p, beforeDock);
    await p.tapBtn('[data-t="road"]'); assert.equal((await p.ev('__gt.ui()')).tool, null);
    let before = await p.ev(STATE), cam = await p.ev('__gt.cam()');
    await p.drag([W/2,H/2], [W/2+70,H/2+25]); await p.release(); await p.frames(90);
    assert.notDeepEqual(await p.ev('__gt.cam()'), cam); await cleanCancelled(p, before);
    await p.tapBtn('[data-t="road"]'); cam = await p.ev('__gt.cam()'); before = await p.ev(STATE);
    const cy = H/2 - 30;
    await p.touch('touchStart', [[W/2-35,cy,0],[W/2+35,cy,1]]);
    for (let k=1;k<=8;k++) { await p.touch('touchMove', [[W/2-35-k*9,cy,0],[W/2+35+k*9,cy,1]]); await sleep(20); }
    await p.release(); await p.frames(90); assert.ok((await p.ev('__gt.cam()')).zoom > cam.zoom * 1.1); await cleanCancelled(p, before);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failures = 0; await d047MobileSmoke(withBrowser, (ok,name,detail) => { console.log(ok?'OK':'NG',name,detail??''); if(!ok) failures++; });
  process.exitCode = failures ? 1 : 0;
}
