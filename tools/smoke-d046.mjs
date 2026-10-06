// D046 cloud Chromium touch emulation, 412×860. This is not an Android device run.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { ROOT, withBrowser } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { d045Code } from './d045-cities.mjs';
import { foodExportCode, naturalSpaceUnlockCode } from './d046-cities.mjs';
const J = JSON.stringify;
const OUT = path.join(ROOT, 'scratch/shots'); // Existing CI artifact glob, no workflow change needed.
const rawCms = (act, acc = 0) => ({ act, st: 140, acc, hold: 0, n: 0, done: [] });
export async function d046Smoke(browser, log) {
  fs.mkdirSync(OUT, { recursive: true });
  await browser({ width: 960, height: 900 }, async ({ open, page }) => {
    const p = await pageSession(page, open, { W: 412, H: 860 });
    const { ev, tapBtn, tapAt, open: navigate, rectOf, key, toasts } = p;
    const load = async code => { await navigate('sample=seed516&clean=1'); await ev(`__gt.clearSave(); localStorage.setItem('gt3d.v1.save',${J(code)})`); await navigate(''); };
    const shot = async name => { const s = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, 'D046-' + name + '.png'), Buffer.from(s.data, 'base64')); };
    const test = async (name, fn) => { try { await fn(); log(true, 'D046 ' + name); } catch(e) { log(false, 'D046 ' + name, e.stack); } };
    await test('412×860 playable offers, repeated touch, dismiss and active HUD', async () => {
      await load(d045Code({ money: 5000 }));
      await ev("__gt.menu('commission')");
      const offers = await ev("__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)");
      assert.equal(offers.length, 3); assert.ok(offers.every(id => !id.startsWith('transit')));
      const first = `#cm li[data-k="${offers[0]}"] button`, rect = await rectOf(first);
      assert.ok(rect.w >= 44 && rect.h >= 44);
      await shot('01-playable-offers-412x860');
      await tapBtn(first); await tapAt([rect.l + rect.w/2, rect.t + rect.h/2]);
      assert.equal((await ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='accept')")).length, 1);
      assert.equal((await ev('__gt.simCms()')).act, offers[0]);
      await tapBtn('#cmX'); assert.equal((await ev('__gt.cmPanel()')).open, false);
      const hud = await rectOf('#commissionHud'); assert.ok(!hud.hidden && hud.w >= 44 && hud.h >= 44 && hud.r <= 412 && hud.l >= 0);
      assert.ok(await ev("document.querySelector('#commissionHud').textContent.includes(__gt.cmRows().find(r=>r.kind==='act').val)"));
      const toast = await rectOf('#toasts'); assert.ok(toast.t >= hud.b + 6, 'toasts must not cover the active HUD');
      await shot('02-active-hud-412x860');
      await tapBtn('#commissionHud'); assert.equal((await ev('__gt.cmPanel()')).open, true);
      await key('Escape'); assert.equal((await ev('__gt.cmPanel()')).open, false);
      await tapBtn('#commissionHud'); await tapAt([4, 4]); assert.equal((await ev('__gt.cmPanel()')).open, false);
      assert.equal((await ev('__gt.simCms()')).act, offers[0]);
      assert.equal(await ev('document.documentElement.scrollWidth <= innerWidth'), true);
    });
    await test('fractional legacy progress survives real save/reload and ongoing HUD', async () => {
      await load(d045Code({ money: 5000, cms385: rawCms('steel40', 39.96) }));
      assert.match(await ev("document.querySelector('#commissionHud').textContent"), /39\.96 \/ 40/);
      assert.equal(await ev("document.querySelector('#commissionHud .meter i').style.width"), '99%');
      await tapBtn('#commissionHud'); assert.equal((await ev('__gt.cmRows()')).find(r=>r.kind==='act').bar, '99%');
      await load(d045Code({ money: 5000, cms385: rawCms('steel40', 12.5) }));
      assert.equal((await ev('__gt.simCms()')).acc, 12.5);
      await tapBtn('#commissionHud'); await shot('03-fractional-progress-412x860'); await tapBtn('#cmX');
      await ev('__gt.saveNow()'); const before = await ev('__gt.simCms()'); await navigate('');
      assert.deepEqual(await ev('__gt.simCms()'), before);
      assert.equal((await rectOf('#commissionHud')).hidden, false);
      await tapBtn('#commissionHud'); await tapBtn('#cm li[data-kind="act"] button');
      assert.equal((await ev('__gt.simCms()')).act, ''); assert.equal((await rectOf('#commissionHud')).hidden, true);
    });
    await test('expiry clears HUD without penalty', async () => {
      await load(d045Code({ money: 5000, rk: 10, cms385: { ...rawCms('steel40'), st: 62 } }));
      assert.equal((await rectOf('#commissionHud')).hidden, false);
      await ev('__gt.simStep(2)'); assert.equal((await ev('__gt.simCms()')).act, '');
      assert.equal((await rectOf('#commissionHud')).hidden, true);
      assert.equal((await ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='expire')")).length, 1);
    });
    await test('old active transit survives and can be dropped without penalty', async () => {
      await load(d045Code({ money: 5000, cms385: rawCms('transit150') }));
      await tapBtn('#commissionHud'); const money = await ev('__gt.sim().money');
      assert.match(await ev("document.querySelector('#cm').textContent"), /無懲罰放棄/);
      await shot('04-legacy-transit-412x860'); await tapBtn('#cm li[data-kind="act"] button');
      assert.equal(await ev('__gt.sim().money'), money); assert.equal((await ev('__gt.simCms()')).n, 1);
      assert.ok((await ev("__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)")).every(id=>!id.startsWith('transit')));
    });
    await test('real export completion clears HUD and records a single reward', async () => {
      await load(foodExportCode()); await ev('__gt.simStep(44)'); assert.equal((await ev('__gt.simCms()')).act, 'trade1200');
      await shot('05-food-export-progress-412x860'); await ev('__gt.simStep(1)');
      assert.equal((await ev('__gt.simCms()')).act, ''); assert.equal((await rectOf('#commissionHud')).hidden, true);
      assert.equal((await ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='done'&&e.id==='trade1200')")).length, 1);
      await ev("__gt.menu('commission')"); await shot('06-food-export-completed-412x860');
    });
    await test('natural Lv.22 promotion unlocks existing space-center tool and shows notice', async () => {
      await load(naturalSpaceUnlockCode()); await tapBtn('[data-t="civic"]');
      const before = await ev("document.querySelector('[data-c=megaproject]').getAttribute('aria-disabled')"); assert.equal(before, 'true');
      await ev('__gt.simStep(1)'); assert.equal((await ev('__gt.rankRep()')).idx, 21);
      assert.equal(await ev("document.querySelector('[data-c=megaproject]').getAttribute('aria-disabled')"), null);
      assert.ok((await toasts()).some(t=>t.includes('Lv.22')&&t.includes('解鎖：太空研究中心')));
      await shot('07-natural-space-unlock-412x860');
    });
    log(page.errors.length === 0, 'D046 mobile console has no errors', page.errors.join('\n'));
    const external = page.requests.filter(u=>! /^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(!external.length, 'D046 mobile has no external assets', external.join('\n'));
  });
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let fails=0; await d046Smoke(withBrowser,(ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)fails++;}); process.exitCode=fails?1:0;
}
