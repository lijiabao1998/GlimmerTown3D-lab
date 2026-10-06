// D048 real Chrome CDP touch (360×740 / 412×860) and desktop keyboard.
// Android-like emulation only. Storage/IndexedDB failures below are explicit test injections.
// Run after build: node tools/smoke-d048.mjs. No product source or persistence format is patched.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { pageSession, free, grew } from './smoke-d011.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { SAVE_LIMIT, loadCode, saveCode } from '../src/io/save.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { stepDay } from '../src/sim/day.ts';
import { cmsLoad3d } from '../src/sim/rules/commissionSave.ts';
import {
  d048ReviewCode, d048FixtureManifest, D048_CAMERA, D048_VIEWS, D048_SAVE_KEY,
  D048_COMMISSION, D048_QUOTA, D048_DENIED, D048_IDB_REASON, D048_IDB_BLOCK,
} from './d048-scenes.mjs';

const J = JSON.stringify, OUT = path.join(ROOT, 'scratch/shots');
const UNSAVED = '#stats [data-k="unsaved"]', JOURNAL = '#stats [data-k="journal"]';
const SECTIONS = ['portrait360', 'portrait412', 'keyboard', 'journal', 'export', 'rng'];
const ONLY = (process.env.D048_SMOKE_ONLY ?? '').split(',').map(x => x.trim()).filter(Boolean);
export const d048SkipNote = () => ONLY.length ? `D048 smoke partial: not run ${SECTIONS.filter(x => !ONLY.includes(x)).join(', ') || '(none)'}` : '';
const sha = x => createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : J(x)).digest('hex');
// Exact comparisons, with short failure diagnostics rather than megabytes of city arrays.
function same(actual, expected, what) {
  assert.ok(isDeepStrictEqual(actual, expected), `${what}: expected SHA256 ${sha(expected)}, got ${sha(actual)}`);
}
const STORAGE_PROBE = `(()=>{
  const original=Storage.prototype.setItem;
  window.__d048Storage={original,fault:'',attempts:[],writes:[]};
  Storage.prototype.setItem=function(k,v){
    const p=window.__d048Storage;
    if(this===localStorage&&k===${J(D048_SAVE_KEY)}){
      p.attempts.push(k);
      if(p.fault)throw new DOMException(p.fault==='quota'?${J(D048_QUOTA)}:${J(D048_DENIED)},p.fault==='quota'?'QuotaExceededError':'SecurityError');
      p.writes.push(k);
    }
    return original.call(this,k,v);
  };
  window.__d048Touches=[];
  addEventListener('pointerdown',e=>window.__d048Touches.push({type:e.pointerType,trusted:e.isTrusted}),true);
})()`;
// save() is the complete ordinary share serialization, including all history. saved is
// the actual localStorage bytes. Neither simHash nor these bytes contain RNG state;
// the matched no-reload future trajectory below is the separate RNG regression guard.
const SNAPSHOT = `(()=>({
  sim:__gt.sim(),layers:__gt.layers(),buildings:__gt.buildingList(),history:__gt.history(),
  commission:__gt.simCms(),code:__gt.save(),saved:__gt.saved(),
  attempts:window.__d048Storage.attempts.length,writes:window.__d048Storage.writes.length,
  url:location.href,historyLength:history.length
}))()`;
const WORLD = `(()=>({sim:__gt.sim(),layers:__gt.layers(),buildings:__gt.buildingList(),
  history:__gt.history(),commission:__gt.simCms(),code:__gt.save(),lastDay:__gt.lastDay(),dayReport:__gt.dayRep()}))()`;

// Also runnable without Chromium: verifies the frozen review bytes and demonstrates
// that this fixture's subsequent simulation notices a single extra RNG draw.
export function verifyD048Fixture() {
  const fixture = d048FixtureManifest();
  assert.equal(fixture.codeSha256, '7413aadbe93ec7383a82768eb7db9b85b09e7cb2421d18c0396b8b90804b00d5');
  const KT = kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/lab-kinds.json'),'utf8')));
  const vrank = JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/samples/d009-live.json'),'utf8')).vrank;
  const load = () => { const r=loadCode(d048ReviewCode(),KT,vrank); assert.ok(r.ok); return r; };
  const control=load(), mutation=load();
  same(control.sim.cms,D048_COMMISSION,'saved legacy fractional commission fixture');
  const raw=decodeLabCode(saveCode(control.sim,control.template,control.start)).save.raw;
  assert.equal(raw.cms385.acc,12); assert.equal(raw.cms3d.acc,12.5);
  same(cmsLoad3d(raw.cms385,raw.cms3d),D048_COMMISSION,'D046 exact precision and 2D-compatible integer');
  mutation.sim.rng.R(); // deliberate test-only single-draw corruption; no production hook.
  let detectedAfterDays=null;
  for(let day=1;day<=20;day++){
    stepDay(control.sim); stepDay(mutation.sim);
    if(detectedAfterDays===null&&saveCode(control.sim,control.template,control.start)!==saveCode(mutation.sim,mutation.template,mutation.start))detectedAfterDays=day;
  }
  assert.notEqual(detectedAfterDays,null,'fixture must detect one extra RNG draw within the browser trajectory window');
  return {codeSha256:fixture.codeSha256,fractionalCompatibility:{cms385:12,cms3d:12.5},singleExtraRngDrawDetectedAfterDays:detectedAfterDays};
}

async function loadFixture(p) {
  await p.open('sample=seed516&clean=1');
  await p.ev(`__gt.clearSave();localStorage.setItem(${J(D048_SAVE_KEY)},${J(d048ReviewCode())})`);
  await p.open('');
  await p.ev(`__gt.view(${D048_CAMERA.x},${D048_CAMERA.z},${D048_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  assert.equal((await p.ev('__gt.sim()')).playing, false, 'fixture must stay paused');
  assert.equal((await p.ev('__gt.simCms()')).acc, D048_COMMISSION.acc, 'D046 fractional saved progress must survive load');
  assert.match(await p.ev("document.querySelector('#commissionHud').textContent"), /12\.5 \/ 40/);
  await p.ev('__gt.saveNow()'); await p.ev('__gt.journalFlush()'); await p.ev('__gt.saveNow()');
  assert.ok(await p.waitFor(async () => !(await p.toasts()).length, 4500), 'load notices must fully expire');
  await p.ev(STORAGE_PROBE);
}
async function failSave(p, kind = 'quota') {
  await p.ev(`window.__d048Storage.fault=${J(kind)}`);
  assert.equal(await p.ev('__gt.saveNow()'), false, `${kind} injection must reject the actual save`);
}
async function settleToasts(p) {
  assert.ok(await p.waitFor(async () => !(await p.toasts()).length, 4500), 'toast nodes must expire, not only become transparent');
}
async function key(page, value, shift = false) {
  const map = { Enter: ['Enter',13], ' ': ['Space',32], Tab: ['Tab',9], Escape: ['Escape',27] };
  const [code, kc] = map[value], modifiers = shift ? 8 : 0;
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code, windowsVirtualKeyCode: kc, modifiers });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code, windowsVirtualKeyCode: kc, modifiers });
  await sleep(100);
}
async function visible(p, sel) { const r = await p.rectOf(sel); return !!r && !r.hidden; }
async function assertButton(p, sel) {
  const b = await p.ev(`(()=>{const e=document.querySelector(${J(sel)}),r=e.getBoundingClientRect();return {tag:e.tagName,w:r.width,h:r.height,l:r.left,r:r.right,t:r.top,b:r.bottom,hidden:!!e.closest('[hidden]')};})()`);
  assert.equal(b.tag, 'BUTTON', `${sel} must be a real button`);
  assert.ok(!b.hidden && b.w >= 44 && b.h >= 44 && b.l >= 0 && b.r <= p.W + .5 && b.t >= 0 && b.b <= p.H + .5, `${sel} touch target: ${J(b)}`);
}
async function noHorizontalOverflow(p, sel = '#saveStatus') {
  const out = await p.ev(`(()=>{const e=document.querySelector(${J(sel)});return {page:document.documentElement.scrollWidth,viewport:innerWidth,panel:e.scrollWidth,client:e.clientWidth};})()`);
  assert.ok(out.page <= out.viewport && out.panel <= out.client + 1, `horizontal overflow ${J(out)}`);
}
async function assertModal(p, sel) {
  const m = await p.ev(`(()=>{const e=document.querySelector(${J(sel)}),lab=e.getAttribute('aria-labelledby');return {hidden:e.hidden,role:e.getAttribute('role'),modal:e.getAttribute('aria-modal'),label:lab&&document.getElementById(lab)?.textContent,focus:e.contains(document.activeElement),visible:document.activeElement?.getClientRects().length>0};})()`);
  assert.equal(m.hidden, false); assert.equal(m.role, 'dialog'); assert.equal(m.modal, 'true');
  assert.ok(m.label && m.focus && m.visible, `accessible visible dialog focus ${J(m)}`);
  await noHorizontalOverflow(p, sel);
}
async function focusCycle(p, page, sel) {
  const controls = await p.ev(`(()=>{const d=document.querySelector(${J(sel)});return [...d.querySelectorAll('button,textarea,input,select,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length&&!e.closest('[hidden]')).length;})()`);
  assert.ok(controls >= 2, 'must exercise multiple visible dialog controls');
  for (const shift of [false, true]) for (let n = 0; n < controls + 2; n++) {
    await key(page, 'Tab', shift);
    assert.equal(await p.ev(`document.querySelector(${J(sel)}).contains(document.activeElement)&&document.activeElement.getClientRects().length>0&&!document.activeElement.closest('[hidden]')`), true, `${shift?'Shift+Tab':'Tab'} focus must remain in ${sel}`);
  }
}
async function noFalseSuccess(p) {
  assert.ok(!(await p.toasts()).some(t => /已恢復自動存檔|已備份|備份成功/.test(t)), 'UI-only export must not claim backup or autosave recovery');
  assert.ok(await p.ev('__gt.ui().saveError'), 'opening/copying/cancelling export does not restore autosave');
}
async function exportReturn(p, page, how = 'button') {
  await p.tapBtn('#saveStatusExport'); await assertModal(p, '#dlg');
  assert.equal(await visible(p, '#saveStatus'), false);
  const code = await p.ev("document.querySelector('#dlg textarea').value"), parsed = decodeLabCode(code);
  assert.ok(parsed.ok && parsed.save.raw.d3?.hv === 2, 'ordinary export retains complete history');
  assert.equal(parsed.save.raw.d3.r.length, await p.ev('__gt.history().length'));
  assert.equal(parsed.save.raw.cms385.acc, Math.floor(D048_COMMISSION.acc), '2D-compatible commission stays integer');
  assert.equal(parsed.save.raw.cms3d.acc, D048_COMMISSION.acc, 'D046 precision extension stays exact');
  same(cmsLoad3d(parsed.save.raw.cms385, parsed.save.raw.cms3d), D048_COMMISSION, 'D046 fractional commission round-trips through existing code');
  assert.match(await p.ev("document.querySelector('#dlgNo').textContent"), /返回/);
  if (how === 'escape') await key(page, 'Escape');
  else if (how === 'backdrop') await p.tapAt([2, 2]);
  else await p.tapBtn('#dlgNo');
  await assertModal(p, '#saveStatus'); assert.equal(await visible(p, '#dlg'), false);
  await noFalseSuccess(p);
}
async function heldPreviewCancelled(p, page) {
  await p.tapBtn('[data-t="road"]');
  const box = await p.findBox(2, 1, free); assert.equal(box.length, 2, 'fixture has two visible free tiles');
  const before = await p.ev(SNAPSHOT);
  await p.drag(box[0][1], box[1][1]);
  assert.ok((await p.ev('__gt.stroke()'))?.preview?.count > 0, 'real held drag must show a preview before interruption');
  // Assistive/keyboard activation while a genuine canvas touch remains captured.
  await p.ev("__gt.menu('save-status')");
  assert.equal(await p.ev('__gt.stroke()'), null); assert.equal(await p.ev('__gt.previewCount()'), 0);
  assert.equal(await p.ev("document.querySelector('#costTag').hidden"), true);
  await key(page, 'Escape'); await p.release();
  same(await p.ev(SNAPSHOT), before, 'closing and releasing interrupted preview must not build/save');
  await p.ev('__gt.tool(null)');
}

export async function d048Smoke(browser, log) {
  fs.mkdirSync(OUT, { recursive: true });
  const unknown = ONLY.filter(x => !SECTIONS.includes(x));
  if (unknown.length) log(false, 'D048 recognized section selection', unknown.join(', '));
  const fixtureChecks = verifyD048Fixture();
  log(true,'D048 fixture: frozen bytes, D046 exact fractional compatibility, single RNG-draw sensitivity',J(fixtureChecks));
  const manifest = { ...d048FixtureManifest(), fixtureChecks, candidateHtmlSha256: fs.existsSync(path.join(ROOT,'dist/index.html')) ? sha(fs.readFileSync(path.join(ROOT,'dist/index.html'),'utf8')) : null, screenshots: [], sections: {}, rng: null };
  const run = async (section, options, fn) => {
    if (ONLY.length && !ONLY.includes(section)) return;
    try {
      await browser({ width: 1280, height: 900 }, async ({ open, page }) => {
        const p = await pageSession(page, open, options);
        const shot = async name => {
          // The same camera and fixed render time are used for deployed-baseline and candidate.
          const cam = await p.ev('__gt.cam()');
          assert.equal(cam.zoom, D048_CAMERA.zoom); same(cam.target, [D048_CAMERA.x,0,D048_CAMERA.z], 'review camera target');
          const response = await page.send('Page.captureScreenshot', { format: 'png' });
          const file = `D048-${name}-${p.W}x${p.H}.png`, bytes = Buffer.from(response.data,'base64');
          fs.writeFileSync(path.join(OUT,file), bytes);
          manifest.screenshots.push({ file, sha256: sha(bytes), width:p.W, height:p.H, camera:cam, fixtureCodeSha256:manifest.codeSha256, simulatedAndroid:true });
        };
        let pass = false;
        try { await fn(p, page, shot); pass = true; log(true, `D048 ${section}`); }
        catch (error) { log(false, `D048 ${section}`, error.stack); manifest.sections[section] = { pass:false, error:error.message }; }
        const external = page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
        log(page.errors.length === 0 && external.length === 0, `D048 ${section}: zero console errors / external assets`, [...page.errors,...external].join('\n'));
        if (options.mobile !== false) {
          const touches = await p.ev('window.__d048Touches??[]');
          const trusted = touches.length > 0 && touches.every(t=>t.type==='touch'&&t.trusted);
          log(trusted, `D048 ${section}: genuine trusted CDP touch`, `${touches.length} pointerdown events; Android emulation, not device`);
          pass &&= trusted;
        }
        manifest.sections[section] ??= { pass:pass && !page.errors.length && !external.length };
      });
    } catch (error) { log(false, `D048 ${section}: browser session`, error.stack); manifest.sections[section] = { pass:false, error:error.message }; }
    fs.writeFileSync(path.join(OUT,'D048-evidence.json'), J(manifest,null,2)+'\n');
  };

  for (const { width:W,height:H } of D048_VIEWS) await run(`portrait${W}`, { W,H }, async (p,page,shot) => {
    await loadFixture(p);
    assert.equal(await visible(p, UNSAVED), false); assert.equal(await visible(p, JOURNAL), false);
    await failSave(p);
    await assertButton(p, UNSAVED);
    const toast = await p.rectOf('#toasts'), commission = await p.rectOf('#commissionHud');
    assert.ok(toast.t >= commission.b + 6, `toast must not cover active commission: ${J({toast,commission})}`);
    await settleToasts(p);
    await assertButton(p, UNSAVED);
    await shot('warning-after');
    const before = await p.ev(SNAPSHOT), cam = await p.ev('__gt.cam()');
    for (const how of ['button','escape','backdrop']) {
      await p.tapBtn(UNSAVED); await assertModal(p,'#saveStatus');
      assert.equal(await visible(p,'#saveStatusUnsaved'),true); assert.equal(await visible(p,'#saveStatusJournal'),false);
      assert.ok(await p.ev("document.querySelector('#saveStatusUnsaved').textContent.includes(__gt.ui().saveError)"), 'persistent dialog shows current full cause after toast expiry');
      await assertButton(p,'#saveStatusExport'); await assertButton(p,'#saveStatusClose');
      await exportReturn(p,page,how);
      if (W === 412 && how === 'button') await shot('details-export-return-after');
      if (how === 'button') await p.tapBtn('#saveStatusClose');
      else if (how === 'escape') await key(page,'Escape');
      else await p.tapAt([2,2]);
      assert.equal(await visible(p,'#saveStatus'),false);
      assert.equal(await p.ev(`document.activeElement===document.querySelector(${J(UNSAVED)})`),true,'focus returns to warning');
    }
    await p.ev("document.activeElement?.blur();__gt.menu('save-status');__gt.menu('save-status')");
    await assertModal(p,'#saveStatus');
    assert.equal(await p.ev("document.querySelectorAll('#saveStatus').length"),1,'repeated activation must not duplicate a dialog');
    await p.tapBtn('#saveStatusClose');
    assert.equal(await p.ev(`document.activeElement===document.querySelector(${J(UNSAVED)})`),true,'body is not a useful opener; restore actual warning focus');
    same(await p.ev(SNAPSHOT),before,'repeated warning/export/cancel/backdrop/Escape navigation is read-only');
    same(await p.ev('__gt.cam()'),cam,'UI navigation leaves camera unchanged');
    await heldPreviewCancelled(p,page);
    await p.tapBtn(UNSAVED);
    await failSave(p,'denied');
    const current = await p.ev('__gt.ui().saveError'); assert.match(current,/不讓/);
    assert.ok(await p.ev("document.querySelector('#saveStatusUnsaved').textContent.includes(__gt.ui().saveError)"),'open panel updates generic storage denial immediately');
    assert.ok(!await p.ev("document.querySelector('#saveStatusUnsaved').textContent.includes('儲存空間滿了')"),'old quota cause must disappear');
    const afterChange = await p.ev(SNAPSHOT);
    await p.tapBtn('#saveStatusClose'); await p.tapBtn(UNSAVED);
    same(await p.ev(SNAPSHOT),afterChange,'reopening changed failure remains read-only');
    await settleToasts(p);
    // Repeated same failure should not repeat a toast, but the persistent cause remains.
    await failSave(p,'denied'); assert.deepEqual(await p.toasts(),[]);
    assert.ok(await p.ev("document.querySelector('#saveStatusUnsaved').textContent.includes(__gt.ui().saveError)"));
    await p.ev("window.__d048Storage.fault=''");
    const world = await p.ev(WORLD);
    assert.equal(await p.ev('__gt.saveNow()'),true); await p.ev('__gt.journalFlush()');
    same(await p.ev(WORLD),world,'successful persistence retry changes no simulation/history');
    assert.equal(await p.ev('__gt.ui().saveError'),''); assert.equal(await visible(p,UNSAVED),false);
    assert.ok(!await p.ev("!document.querySelector('#saveStatusUnsaved').hidden&&document.querySelector('#saveStatusUnsaved').textContent.includes('不讓')"),'recovered open panel must not show stale refusal');
    if (await visible(p,'#saveStatus')) await p.tapBtn('#saveStatusClose');
    assert.equal(await p.ev("document.activeElement?.getClientRects().length>0&&!document.activeElement.closest('[hidden]')"),true,'recovery focus fallback is visible');
    await settleToasts(p);
    if (W === 412) await shot('recovered-after');
    await failSave(p); await settleToasts(p); await p.tapBtn(UNSAVED);
    assert.ok(await p.ev("document.querySelector('#saveStatusUnsaved').textContent.includes('儲存空間滿了')"),'new failure after recovery is current');
    await p.tapBtn('#saveStatusClose');
  });

  await run('keyboard',{W:1280,H:800,mobile:false},async(p,page)=>{
    await loadFixture(p); await failSave(p); await settleToasts(p);
    const before = await p.ev(SNAPSHOT);
    await p.ev(`document.querySelector(${J(UNSAVED)}).focus()`);
    // Real Tab creates keyboard modality; Shift+Tab comes back to the warning button.
    await key(page,'Tab'); await key(page,'Tab',true);
    const focus = await p.ev(`(()=>{const e=document.querySelector(${J(UNSAVED)}),s=getComputedStyle(e);return {active:document.activeElement===e,visible:e.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),shadow:s.boxShadow};})()`);
    assert.ok(focus.active&&focus.visible&&((focus.outline!=='none'&&focus.width>0)||focus.shadow!=='none'),`warning needs visible keyboard focus ${J(focus)}`);
    for (const opener of ['Enter',' ']) {
      await key(page,opener); await assertModal(p,'#saveStatus'); await focusCycle(p,page,'#saveStatus');
      await p.ev("document.querySelector('#saveStatusExport').focus()"); await key(page,'Enter');
      await assertModal(p,'#dlg'); await focusCycle(p,page,'#dlg');
      // Both modal layers must reject ordinary simulation shortcuts.
      await p.ev("document.querySelector('#dlg textarea').focus()");
      await key(page,' '); assert.equal((await p.ev('__gt.sim()')).playing,false);
      await key(page,'Escape'); await assertModal(p,'#saveStatus');
      await key(page,'Escape'); assert.equal(await visible(p,'#saveStatus'),false);
      assert.equal(await p.ev(`document.activeElement===document.querySelector(${J(UNSAVED)})`),true);
    }
    same(await p.ev(SNAPSHOT),before,'keyboard navigation/Escape cannot change city, save bytes, or URL history');
  });

  await run('journal',{W:360,H:740},async(p,page,shot)=>{
    const block = await page.send('Page.addScriptToEvaluateOnNewDocument',{source:D048_IDB_BLOCK});
    await loadFixture(p); assert.equal((await p.ev('__gt.journal()')).kind,null);
    assert.equal(await visible(p,UNSAVED),false); await assertButton(p,JOURNAL);
    const fallback = decodeLabCode(await p.ev('__gt.saved()'));
    assert.ok(fallback.ok&&fallback.save.raw.d3?.hv===2,'existing fallback persists full history in ordinary save');
    assert.equal(fallback.save.raw.d3.r.length,await p.ev('__gt.history().length'));
    const before = await p.ev(SNAPSHOT);
    await p.tapBtn(JOURNAL); await assertModal(p,'#saveStatus');
    assert.equal(await visible(p,'#saveStatusUnsaved'),false); assert.equal(await visible(p,'#saveStatusJournal'),true);
    assert.ok(await p.ev("document.querySelector('#saveStatusJournal').textContent.includes(__gt.journal().why)"));
    assert.match(await p.ev("document.querySelector('#saveStatusJournal').textContent"),/上限/);
    await p.tapBtn('#saveStatusClose'); same(await p.ev(SNAPSHOT),before,'journal-only details do not alter fallback or city');
    await failSave(p); await settleToasts(p);
    await assertButton(p,UNSAVED); assert.equal(await visible(p,JOURNAL),false,'unsaved warning keeps priority when both conditions exist');
    await p.tapBtn(UNSAVED); await assertModal(p,'#saveStatus');
    assert.equal(await visible(p,'#saveStatusUnsaved'),true); assert.equal(await visible(p,'#saveStatusJournal'),true);
    await shot('both-details-after'); await exportReturn(p,page); await p.tapBtn('#saveStatusClose');
    // Recover storage independently: history warning remains because IDB is still blocked.
    await p.ev("window.__d048Storage.fault=''"); assert.equal(await p.ev('__gt.saveNow()'),true);
    assert.equal(await visible(p,UNSAVED),false); await assertButton(p,JOURNAL);
    const hist = await p.ev('__gt.history()'), cms = await p.ev('__gt.simCms()');
    await page.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:block.identifier});
    await p.open('');
    assert.equal((await p.ev('__gt.journal()')).kind,'indexeddb');
    assert.ok(grew(hist,await p.ev('__gt.history()'),await p.ev('__gt.restyled()')).ok,'restored IDB reload preserves history plus legitimate restyle only');
    same(await p.ev('__gt.simCms()'),cms,'fractional D046 commission survives fallback save and real reload');
    assert.equal(await visible(p,JOURNAL),false); assert.equal(await visible(p,UNSAVED),false);
    // Long unbroken injected detail must wrap; panel may scroll vertically, never the page horizontally.
    const longReason = D048_IDB_REASON+'／測試長原因：'+'INDEXEDDB_DENIED_'.repeat(35);
    const longBlock = await page.send('Page.addScriptToEvaluateOnNewDocument',{source:D048_IDB_BLOCK.replace(J(D048_IDB_REASON),J(longReason))});
    await p.open(''); await p.ev(STORAGE_PROBE); await settleToasts(p); await p.tapBtn(JOURNAL);
    await assertModal(p,'#saveStatus');
    assert.ok(await p.ev(`document.querySelector('#saveStatusJournal').textContent.includes(${J(longReason)})`),'complete long reason retained');
    const scroll = await p.ev("(()=>{const e=document.querySelector('#saveStatus .saveBody'),r=e.getBoundingClientRect();e.scrollTop=0;return {l:r.left,t:r.top,w:r.width,h:r.height,content:e.scrollHeight,viewport:e.clientHeight};})()");
    assert.ok(scroll.content>scroll.viewport+40&&scroll.h>80,'long reason must genuinely need a scrollable body');
    const sx=scroll.l+scroll.w/2, from=[sx,scroll.t+scroll.h*.78], to=[sx,scroll.t+scroll.h*.22];
    await p.drag(from,to); await p.release(); await p.frames(3);
    assert.ok(await p.ev("document.querySelector('#saveStatus .saveBody').scrollTop")>20,'genuine CDP touch drag must scroll the long reason');
    await noHorizontalOverflow(p);
    await p.ev("document.querySelector('#saveStatusExport').scrollIntoView({block:'nearest'})");
    await assertButton(p,'#saveStatusExport'); await p.tapBtn('#saveStatusExport'); await assertModal(p,'#dlg');
    await p.tapBtn('#dlgNo'); await key(page,'Escape');
    await page.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:longBlock.identifier});
  });

  await run('export',{W:412,H:860},async(p,page)=>{
    await loadFixture(p); await failSave(p); await settleToasts(p);
    const genericBefore = await p.ev(SNAPSHOT);
    for(const mode of ['export','paste']){
      await p.tapBtn('#menuBtn');
      await p.ev(`document.querySelector('#menu [data-m="${mode}"]').scrollIntoView({block:'center'})`);
      await p.tapBtn(`#menu [data-m="${mode}"]`); await assertModal(p,'#dlg');
      assert.equal(await visible(p,'#saveStatus'),false,'ordinary menu dialogs must not invent a status-return flow');
      assert.equal(await p.ev("document.querySelector('#dlgNo').textContent"),'取消');
      assert.equal(await p.ev("document.querySelector('#dlg textarea').readOnly"),mode==='export');
      if(mode==='export')await p.tapBtn('#dlgNo');else await key(page,'Escape');
      assert.equal(await visible(p,'#dlg'),false); assert.equal(await visible(p,'#saveStatus'),false);
    }
    same(await p.ev(SNAPSHOT),genericBefore,'ordinary export/import cancel regression');
    await p.tapBtn(UNSAVED);
    const pristine = await p.ev(SNAPSHOT);
    // Save/share limit is exercised through the real legacy export path; synthetic
    // history is always restored before another save, day step, or page navigation.
    const count = await p.ev(`(()=>{const h=__gt.history(),n=h.length,d=h.at(-1).day;for(let i=0;i<130000;i++)h.push({day:d,t:'restyle',x:i%50,z:(i/50|0)%50,v:i%7});return n;})()`);
    try {
      assert.ok(await p.ev('__gt.save().length') > SAVE_LIMIT,'fixture really exceeds SAVE_LIMIT');
      await p.tapBtn('#saveStatusExport'); await assertModal(p,'#dlg');
      const data = await p.ev("({code:document.querySelector('#dlg textarea').value,note:document.querySelector('#dlgSub').textContent})");
      const parsed=decodeLabCode(data.code); assert.ok(parsed.ok); assert.equal(parsed.save.raw.d3,undefined);
      assert.ok(data.code.length<=SAVE_LIMIT); assert.match(data.note,/歷史太長/); assert.match(data.note,/歷史沒有帶/); assert.match(data.note,/只能看/);
      await noFalseSuccess(p); await p.tapBtn('#dlgNo'); await assertModal(p,'#saveStatus');
    } finally { await p.ev(`__gt.history().length=${count}`); }
    same(await p.ev(SNAPSHOT),pristine,'oversize export preserves actual saved bytes and restores injected history');
    // Export generation failure must stay readable after its temporary toast.
    // This injection does not change a registered event or any production file.
    const invalid = 'D048_TEST_UNKNOWN_EVENT';
    await p.ev(`__gt.history().push({day:__gt.sim().day,t:${J(invalid)}})`);
    try {
      await p.tapBtn('#saveStatusExport');
      assert.equal(await visible(p,'#dlg'),false,'failed generation must not leave a successful-looking export');
      await assertModal(p,'#saveStatus');
      assert.match(await p.ev("document.querySelector('#saveStatus').textContent"),/匯出失敗/);
      assert.ok(await p.ev(`document.querySelector('#saveStatus').textContent.includes(${J(invalid)})`));
      await settleToasts(p);
      assert.match(await p.ev("document.querySelector('#saveStatus').textContent"),/匯出失敗/);
      await noFalseSuccess(p);
    } finally { await p.ev(`__gt.history().length=${count}`); }
    await exportReturn(p,page,'escape'); await p.tapBtn('#saveStatusClose');
    same(await p.ev(SNAPSHOT),pristine,'export failure, retry, and cancellation preserve original city/history/save');
    // Copy target is intercepted locally; never touches an external sharing service.
    await p.tapBtn(UNSAVED); await p.tapBtn('#saveStatusExport');
    await p.ev("window.__d048Copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__d048Copies.push(text)}}})");
    await p.tapBtn('#dlgOk'); await p.tapBtn('#dlgOk');
    assert.equal(await p.ev('window.__d048Copies.length'),2); await noFalseSuccess(p);
    await p.tapBtn('#dlgNo'); await p.tapBtn('#saveStatusClose');
    same(await p.ev(SNAPSHOT),pristine,'repeated local copying is not autosave or destructive navigation');
    const inertState=()=>p.ev("[...document.querySelectorAll('[inert]')].map(e=>e.id||e.tagName+'.'+e.className).sort()");
    const inertBefore=await inertState();
    for(const panel of ['status','export']){
      await p.tapBtn(UNSAVED); if(panel==='export')await p.tapBtn('#saveStatusExport');
      assert.ok((await inertState()).length>inertBefore.length,'modal actually locks background before lifecycle test');
      // Explicit lifecycle injection, not a claim of actual device/browser Back.
      // No pushState/URL change is introduced by the product; those were compared above.
      await p.ev("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))");
      assert.equal(await visible(p,'#saveStatus'),false); assert.equal(await visible(p,'#dlg'),false);
      same(await inertState(),inertBefore,'pagehide releases every temporary background inert lock');
      await p.ev("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
    }
    same(await p.ev(SNAPSHOT),pristine,'synthetic pagehide/pageshow closes panels without replaying export or changing city');
    await p.tapBtn(UNSAVED); await assertModal(p,'#saveStatus'); await p.tapBtn('#saveStatusClose');

  });

  if (!ONLY.length || ONLY.includes('rng')) {
    const trajectories=[];
    // Each arm gets exactly one fixture load. Never reload between UI actions and
    // stepping the next 20 days: reloading would reset seed^day and hide RNG use.
    for (const interactive of [false,true]) await run('rng',{W:412,H:860},async(p,page)=>{
      await loadFixture(p); await failSave(p); await settleToasts(p);
      const before=await p.ev(SNAPSHOT);
      if(interactive){
        for(let i=0;i<3;i++){await p.tapBtn(UNSAVED);await exportReturn(p,page,i%2?'escape':'button');await p.tapBtn('#saveStatusClose');}
        await heldPreviewCancelled(p,page);
      }else{
        // A neutral genuine touch on the warning-free city heading neither builds
        // nor opens a panel. Both arms still prove real mobile touch is enabled.
        await p.tapBtn('#cityName');
      }
      same(await p.ev(SNAPSHOT),before,'paired UI arm leaves present city/history/save bytes exactly equal');
      const trajectory=[await p.ev(WORLD)];
      for(let d=0;d<20;d++){await p.ev('__gt.simStep(1)');trajectory.push(await p.ev(WORLD));}
      trajectories.push(trajectory);
    });
    if(trajectories.length===2){
      try{
        for(let d=0;d<trajectories[0].length;d++)same(trajectories[1][d],trajectories[0][d],`no-reload matched RNG trajectory day offset ${d}`);
        manifest.rng={pass:true,method:'matched control versus repeated warning/export/interrupted-preview UI; no reload within either arm',days:20,fullFieldComparisons:trajectories[0].length,digest:sha(trajectories[0])};
        log(true,'D048 RNG: same full future-day city/history/economy trajectory, not simHash alone');
      }catch(error){manifest.rng={pass:false,error:error.message};log(false,'D048 RNG trajectory',error.stack);}
    }else{manifest.rng={pass:false,error:'one or both trajectory arms failed'};log(false,'D048 RNG trajectory','one or both trajectory arms failed');}
  }
  fs.writeFileSync(path.join(OUT,'D048-evidence.json'),JSON.stringify(manifest,null,2)+'\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let fails=0;
  await d048Smoke(withBrowser,(ok,name,detail)=>{console.log(ok?'OK':'NG',name,detail??'');if(!ok)fails++;});
  if(d048SkipNote())console.log(d048SkipNote());
  process.exitCode=fails?1:0;
}
