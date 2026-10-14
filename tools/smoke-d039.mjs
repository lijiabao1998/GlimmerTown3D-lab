// D039 煙霧測試：☰「大事記」的瀏覽器半邊（驗收 7）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d039.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   panel   P1（Lv.9、$20,000）：☰ 有「大事記」；沒決策時講「還沒有」；調稅率、開宵禁、動預算、開始研究、選方向之後面板逐列講得出（新到舊、文字＝Node 端同一座城同一串動作的 chronicleOf）；
//           推進到研究完成多一行「學會了」；按關閉、Esc、點背景都會關、關著的時候 display 是 none（D038 的教訓）
//   persist 存檔、重新整理（歷史從存檔／日誌讀回來）：大事記還在、一筆不少
//   mobile  手機 412×860 與 360×740：面板不超出螢幕、沒有橫向捲動、按鈕 ≥ 44×44；沒有改畫面：draw call ≤ 18、三角形 ≤ 118,884
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { setPolicy, setBudget, startResearch, chooseSpec } from '../src/sim/edit.ts';
import { chronicleOf } from '../src/sim/decisions.ts';
import { d038Plays } from './d038-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['panel', 'persist', 'mobile'];
const ONLY = (process.env.D039_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);

// Node 端：P1 做同一串動作，回傳大事記（發生順序）
export function expectedChronicle(days = 0) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const c = d038Plays().find(r => r.id === 'P1'), s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank);
  setPolicy(s, 'taxR', 1.1); setPolicy(s, 'curfew', true); setBudget(s, 'edu', .1); startResearch(s, 'A1'); chooseSpec(s, 2);
  for (let d = 0; d < days; d++) realDay.stepDay(s);
  return { code: c.code, lines: chronicleOf(s.city.history) };
}

export async function d039Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D039_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D039 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D039 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const E = expectedChronicle(10);
  const loadCity = async (open, ev, code) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
  const SHOWN = `(()=>{const e=document.getElementById('ch'),r=e.getBoundingClientRect();return {hidden:e.hidden,display:getComputedStyle(e).display,w:Math.round(r.width),h:Math.round(r.height)};})()`;
  const doActions = async ev => {
    await ev(`__gt.policyApply('taxR', 1.1)`); await ev(`__gt.policyApply('curfew', true)`); await ev(`__gt.budgetApply('edu', 1)`);
    await ev(`__gt.menu('tech')`); await ev(`__gt.techApply('A1')`); await ev(`__gt.specApply(2)`); await ev(`__gt.specApply(2)`); await ev(`document.getElementById('tcX').click()`);
  };
  const SAME = `(()=>{const P=d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts}),a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;

  await run('panel', '面板', async ({ ev, open }) => {
    await loadCity(open, ev, E.code);
    const closed0 = await ev(SHOWN), items = await ev('__gt.menuItems()');
    log(closed0.hidden && closed0.display === 'none' && closed0.w === 0 && closed0.h === 0 && items.includes('chronicle'), 'D039 驗收 7：☰ 有「大事記」；面板沒開的時候真的不在畫面上（display none、沒有尺寸）', `選單 ${items.includes('chronicle') ? '有' : '沒有'}；hidden ${closed0.hidden}、display ${closed0.display}、${closed0.w}×${closed0.h}`);
    await ev(`__gt.menu('chronicle')`); const p0 = await ev('__gt.chroniclePanel()'), r0 = await ev('__gt.chronicleRows()');
    log(p0.open && r0.length === 0 && /還沒有/.test(p0.sub), 'D039 驗收 7：沒有決策的城——面板講「還沒有」、沒有列', `「${p0.sub}」、${r0.length} 列`);
    await ev(`document.getElementById('chX').click()`);
    await doActions(ev);
    await ev(`__gt.menu('chronicle')`); const r1 = await ev('__gt.chronicleRows()'), p1 = await ev('__gt.chroniclePanel()');
    const want = E.lines.slice(0, 5).map(l => l.text).reverse();
    log(J(r1.map(r => r.text)) === J(want) && r1.every(r => /^第 [\d,]+ 天$/.test(r.day)) && /共 5 筆/.test(p1.sub), 'D039 驗收 7：調稅率、開宵禁、動教育預算、開始研究、選方向之後——面板五列、新到舊、文字＝Node 端同一座城同一串動作的 chronicleOf；標題講「共 5 筆」', `${r1.length} 列：${r1.map(r => r.text.slice(0, 14)).join('｜')}；${p1.sub}`);
    await ev(`document.getElementById('chX').click()`); await ev('__gt.simStep(10), 1'); await ev(`__gt.menu('chronicle')`);
    const r2 = await ev('__gt.chronicleRows()'), top = r2[0];
    log(r2.length === 6 && top.kind === 'techdone' && /^學會了：標準化生產（工業稅 ×1\.04）$/.test(top.text) && J(r2.map(r => r.text)) === J(E.lines.map(l => l.text).reverse()), 'D039 驗收 7：推進十天、研究完成——最上面多一行「學會了：標準化生產」，全部六列＝Node 端', `${r2.length} 列；最上面「${top?.text}」`);
    await ev(`document.getElementById('chX').click()`); const c1 = (await ev(SHOWN)).display === 'none';
    await ev(`__gt.menu('chronicle')`); await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); const c2 = (await ev(SHOWN)).display === 'none';
    await ev(`__gt.menu('chronicle')`); await ev(`document.getElementById('ch').dispatchEvent(new MouseEvent('click',{bubbles:true}))`); const c3 = (await ev(SHOWN)).display === 'none';
    log(c1 && c2 && c3, 'D039 驗收 7：「大事記」按關閉、按 Esc、點背景都會關，關了之後 display 是 none', `關閉鈕 ${c1 ? '關了' : '沒關'}、Esc ${c2 ? '關了' : '沒關'}、背景 ${c3 ? '關了' : '沒關'}`);
  }, { W: 412, H: 860 });

  await run('persist', '存檔', async ({ ev, open }) => {
    await loadCity(open, ev, E.code); await doActions(ev); await ev('__gt.simStep(10), 1'); await ev(`__gt.saveNow()`);
    await open('');
    await ev(`__gt.menu('chronicle')`); const r = await ev('__gt.chronicleRows()');
    log(J(r.map(x => x.text)) === J(E.lines.map(l => l.text).reverse()), 'D039 驗收 5：存檔、重新整理（歷史從存檔與日誌讀回來）——大事記六列一筆不少、順序文字照舊', `${r.length} 列：${r.slice(0, 2).map(x => x.text.slice(0, 16)).join('｜')}…`);
    await ev('__gt.clearSave(), 1');
  }, { W: 412, H: 860 });

  for (const [W, H] of [[412, 860], [360, 740]]) await run('mobile', `手機 ${W}×${H}`, async ({ ev, open }) => {
    await loadCity(open, ev, E.code); await doActions(ev); await ev('__gt.simStep(10), 1');
    await ev(`__gt.menu('chronicle')`);
    const before = await ev('__gt.renderInfoAll()');
    const m = await ev(`(()=>{const c=document.querySelector('#ch .card').getBoundingClientRect(),bs=[...document.querySelectorAll('#ch button')].map(b=>{const r=b.getBoundingClientRect();return [b.textContent,Math.round(r.width),Math.round(r.height)];});return {cl:Math.round(c.left),cr:Math.round(c.right),cb:Math.round(c.bottom),ct:Math.round(c.top),iw:innerWidth,ih:innerHeight,sw:document.documentElement.scrollWidth,small:bs.filter(b=>b[1]<44||b[2]<44),n:bs.length};})()`);
    log(m.cl >= 0 && m.cr <= m.iw && m.ct >= 0 && m.cb <= m.ih && m.sw <= m.iw && m.small.length === 0 && m.n >= 1, `D039 驗收 7：手機 ${W}×${H}——面板不超出螢幕、頁面沒有橫向捲動、按鈕 ≥ 44×44`, `面板 ${m.cl}–${m.cr} × ${m.ct}–${m.cb}（螢幕 ${m.iw}×${m.ih}）；頁面寬 ${m.sw}；太小的 ${J(m.small.slice(0, 3))}`);
    await ev(`document.getElementById('chX').click()`);
    await ev('__gt.simStep(1), 1'); const same = await ev(SAME), after = await ev('__gt.renderInfoAll()');
    log(same && after.calls <= 18 && after.triangles <= 118884, `D039 驗收 7：手機 ${W}×${H}——沒有改畫面：增量重建＝整張重建；draw call ≤ 18、三角形 ≤ 118,884`, `${same ? '＝' : '≠'}；draw call ${before.calls} → ${after.calls}、三角形 ${before.triangles.toLocaleString()} → ${after.triangles.toLocaleString()}`);
  }, { W, H });
}
export const d039SkipNote = () => ONLY.length ? `  注意：D039_SMOKE_ONLY＝${ONLY.join(',')}，D039 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d039Smoke(withBrowser, log);
  const note = d039SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
