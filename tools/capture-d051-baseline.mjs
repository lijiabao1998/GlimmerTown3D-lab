// QA-only baseline capture. Never merge or deploy this branch.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ROOT, withBrowser } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { D051_BASELINE, D051_CAMERA, D051_BASELINE_CAMERA, D051_SAVE_KEY, d051ReviewCode, d051FixtureManifest } from './d051-scenes.mjs';
const J = JSON.stringify;
const hash = x => createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : J(x)).digest('hex');
const OUT = path.join(ROOT, 'scratch/d051-baseline');
const SNAP = `(async()=>({sim:__gt.sim(),layers:__gt.layers(),buildings:__gt.buildingList(),history:__gt.history(),technology:__gt.techState(),commission:__gt.simCms(),code:__gt.save(),saved:__gt.saved(),lastDay:__gt.lastDay(),dayReport:__gt.dayRep(),journal:__gt.journal(),journalRows:await __gt.journalRows(),journalCount:await __gt.journalCount(),storage:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))}))()`;
const PROBE = `window.__d051Touches=[];window.__d051Writes=[];for(const type of ['pointerdown','click'])addEventListener(type,e=>__d051Touches.push({type,trusted:e.isTrusted,pointerType:e.pointerType,target:e.target.closest('button')?.id??e.target.id}),true);for(const name of ['setItem','removeItem','clear']){const original=Storage.prototype[name];Storage.prototype[name]=function(...args){if(this===localStorage)__d051Writes.push({name,key:args[0]??null});return original.apply(this,args)}}`;
const report = {
  purpose: 'D051 genuine before screenshots on unchanged product; QA-only branch, never merge/deploy',
  synthetic: true, device: 'Chrome CDP portrait touch simulation; no Android hardware',
  baseline: D051_BASELINE, shots: [], passed: false,
};
fs.mkdirSync(OUT, { recursive: true });
try {
  const html = fs.readFileSync(path.join(ROOT, 'dist/index.html'));
  assert.equal(hash(html), D051_BASELINE.htmlSha256, 'product must match the exact approved baseline HTML');
  fs.writeFileSync(path.join(OUT, 'baseline-index.html'), html);
  fs.writeFileSync(path.join(OUT, 'fixture-manifest.json'), J(['idle','paused','researching','complete'].map(d051FixtureManifest), null, 2));
  for (const [mode, width, height, modal] of [['idle',360,740,true],['paused',412,860,false]]) {
    await withBrowser({ width: 960, height: 900 }, async ({ page, open }) => {
      const p = await pageSession(page, open, { W: width, H: height, mobile: true });
      const fixture = d051FixtureManifest(mode), code = d051ReviewCode(mode);
      await p.open('sample=seed516&clean=1');
      await p.ev(`__gt.clearSave();localStorage.setItem(${J(D051_SAVE_KEY)},${J(code)})`);
      await p.open('');
      await p.ev(`__gt.view(${D051_CAMERA.x},${D051_CAMERA.z},${D051_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
      assert.equal((await p.ev('__gt.sim()')).playing, false);
      assert.equal(await p.ev('__gt.saveNow()'), true);
      await p.ev('__gt.journalFlush()');
      assert.equal(await p.ev('__gt.saveNow()'), true);
      assert.ok(await p.waitFor(async () => !(await p.toasts()).length, 5000), 'load toasts settle before capture');
      await p.frames(2);
      assert.deepEqual(await p.ev('__gt.cam()'), D051_BASELINE_CAMERA, 'full realized D048 camera');
      const tech = await p.ev('__gt.techState()');
      assert.deepEqual({ act: tech.act, prog: tech.prog, done: tech.done }, fixture.technology);
      assert.deepEqual(await p.ev('__gt.simCms()'), fixture.commission);
      await p.ev(PROBE);
      const before = await p.ev(SNAP);
      assert.equal(before.sim.day, 150);
      assert.equal(before.journal.busy, false);
      assert.equal(before.journal.kind, 'indexeddb');
      const hud = await p.ev("document.querySelector('#commissionHud').textContent");
      assert.match(hud, /研究中/, 'baseline reproducibly mislabels idle/paused research');
      assert.ok(await p.tapBtn('#commissionHud'), 'open through genuine CDP touch');
      assert.equal((await p.ev('__gt.cmPanel()')).open, true);
      assert.deepEqual(await p.ev(SNAP), before, 'opening preserves full world/code/tech/cms/history/storage/journal');
      const row = (await p.ev('__gt.cmRows()')).find(r => r.k === 'techC6');
      assert.equal(row.val, '研究中');
      assert.equal(row.bar, '0%');
      if (!modal) {
        assert.ok(await p.tapBtn('#cmX'));
        assert.equal((await p.ev('__gt.cmPanel()')).open, false);
        assert.deepEqual(await p.ev(SNAP), before, 'closing preserves full state');
      }
      await p.frames(2);
      const filename = `D051-before-${mode}-${width}-${modal ? 'commission' : 'hud'}.png`;
      const pixels = Buffer.from((await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64');
      assert.ok(pixels.length > 10000);
      assert.equal(pixels.readUInt32BE(16), width);
      assert.equal(pixels.readUInt32BE(20), height);
      fs.writeFileSync(path.join(OUT, filename), pixels);
      const camera = await p.ev('__gt.cam()');
      assert.deepEqual(camera, D051_BASELINE_CAMERA);
      if (modal) {
        assert.ok(await p.tapBtn('#cmX'));
        assert.equal((await p.ev('__gt.cmPanel()')).open, false);
      }
      assert.deepEqual(await p.ev(SNAP), before, 'all capture/open/close actions preserve full state');
      assert.deepEqual(await p.ev('__d051Writes'), [], 'reading and opening/closing perform no localStorage writes');
      const touches = await p.ev('__d051Touches');
      for (const id of ['commissionHud', 'cmX']) assert.ok(touches.some(e => e.type === 'click' && e.trusted && e.target === id && e.pointerType === 'touch'), `${id} receives trusted touch click`);
      const external = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      assert.deepEqual(external, []);
      assert.deepEqual(page.errors, []);
      fs.writeFileSync(path.join(OUT, `state-${mode}.json`), J(before, null, 2));
      report.shots.push({ filename, sha256: hash(pixels), bytes: pixels.length, viewport: { width, height }, camera, fixture, observedHud: hud, observedRow: row, snapshotSha256: hash(before), trustedTouches: touches, localStorageWrites: [], assertions: ['unchanged product HTML', 'exact fixture technology/commission', 'full camera equality', 'genuine trusted touch open/close', 'full world/code/tech/cms/history/storage/journal preserved', 'no localStorage writes', 'zero external requests', 'zero console errors'] });
      console.log(`PASS ${filename} sha256=${hash(pixels)} HTML=${hash(html)} state=${hash(before)}`);
    });
  }
  report.passed = true;
  console.log('PASS D051 BASELINE: 2 genuine before screenshots; synthetic fixture; Chrome touch simulation, not Android; no product edits or deployment.');
} finally {
  fs.writeFileSync(path.join(OUT, 'report.json'), J(report, null, 2));
}
