// D045 煙霧測試：市長委託（T385）的瀏覽器半邊（驗收 7）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d045.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   panel   手機直式 360×740、真的觸控：☰ 選單有「委託」；面板三選一的三張＝Node 端同一座城的 commissionOffers（id、順序）、每張有獎金與期限、接受鈕 ≥ 44×44、運量委託標「本線還沒有公共運量」；
//           點第 2 張的「接受」→ 通知「📋 接受委託：…」、歷史多一筆 cms accept、模擬的委託＝那一條、面板換成「進行中」（進度條、剩餘天數、放棄鈕）；點「放棄」→ 通知、輪次 +1、三選一換一批（＝Node 端輪次 1 的三選一）；
//           沙盒「沙盒模式無委託」、城市等級不到 3「城市等級 3 解鎖」、人口不到 51「人口超過 50 解鎖」；面板不超出螢幕、頁面沒有橫向捲動、Esc 關得掉
//   settle  進行中的委託每天結算：C6 已完成接了「學術網絡」→ 推 1 天：通知「📋 委託完成：…　+$1800」、資金＝Node 端同一座城推一天的結果（含 +$1,800）、歷史多一筆 cms done、面板（開著）換成三選一第 2 輪與「已完成 1」、大事記多一行；
//           快到期的鋼材委託 → 推 2 天：通知「📋 委託過期：…」、輪次 +1、沒有罰款
//   persist 接單、推幾天、存檔、重新整理：進行中的委託（開始日、累計、連續天數、輪次、完成清單）與歷史的 cms 事件都在
//   budget  手機 draw call ≤ 18、三角形 ≤ 118,884：面板開著跟關著一樣（沒有改畫面）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import * as realDay from '../src/sim/day.ts';
import { commissionOffers, dropCommission } from '../src/sim/edit.ts';
import { CMS_BY_ID385, NO_RIDERSHIP } from '../src/sim/rules/commission.ts';
import { mk } from './d034-cities.mjs';
import { d045Code, d045Load, C6, SEED45 } from './d045-cities.mjs';

const J = JSON.stringify;
const SECTIONS = ['panel', 'settle', 'persist', 'budget'];
const ONLY = (process.env.D045_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;
void fs; void path; void ROOT;
const act = (id, st, o = {}) => ({ cms385: { act: id, st, acc: 0, hold: 0, n: 0, done: [], ...o } });
const money = { money: 5000 };
const ranked = { rk: 10 };   // 起步就是 Lv.11（這座底城第一天就會從 Lv.6 連升到 Lv.11，升級通知會把別的通知擠出去：通知最多留三則）

// Node 端：各座城的碼與預期
export function cities() {
  const empty = extra => mk(SEED45, 150, '空城', () => {}, { money: 5000, ...extra });
  return {
    offers: d045Code(money), done: d045Code({ ...money, ...ranked, tech343: C6, ...act('techC6', 100) }), expire: d045Code({ ...money, ...ranked, ...act('steel40', 62) }),
    sandbox: d045Code({ ...money, df: 3 }), low: empty({ rk: 1 }), pop: empty({ rk: 4 }),
  };
}

export async function d045Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D045_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D045 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D045 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const C = cities();
  const loadCity = async (open, ev, code) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
  const ROWS = '__gt.cmRows()', PANEL = '__gt.cmPanel()';
  const nodeSim = code => { const L = d045Load(); void L; return code; };
  void nodeSim;

  await run('panel', '手機 360×740 委託面板', async ({ ev, open, tapBtn, waitFor, toasts, sim }) => {
    // Node 端同一座城的三選一（輪次 0 與輪次 1）
    const N0 = d045Load(), off0 = commissionOffers(N0.sim), id0 = off0.map(c => c.id);
    const N1 = d045Load(); { const q = N1.sim; q.cms.act = 'x'; q.cms.act = ''; q.cms.n = 1; }
    const id1 = commissionOffers(N1.sim).map(c => c.id);
    await loadCity(open, ev, C.offers);
    const items = await ev('__gt.menuItems()'); await ev(`__gt.menu('commission')`);
    const pn = await ev(PANEL), rows = await ev(ROWS), offers = rows.filter(r => r.kind === 'offer');
    const sizes = await ev(`[...document.querySelectorAll('#cm li button, #cm #cmX')].map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})`);
    const fit = await ev(`(()=>{const c=document.querySelector('#cm .card').getBoundingClientRect();return {l:c.left,r:c.right,t:c.top,b:c.bottom,sx:document.documentElement.scrollWidth,iw:innerWidth,ih:innerHeight};})()`);
    const noteOk = offers.every((r, i) => r.note.includes(`獎金 $${off0[i].bonus.toLocaleString()}`) && r.note.includes(`限 ${off0[i].days} 天`) && (NO_RIDERSHIP(off0[i]) === r.note.includes('本線還沒有公共運量')));
    log(items.includes('commission') && pn.open && pn.state === 'offers' && J(offers.map(r => r.k)) === J(id0) && offers.every(r => r.btn === '接受') && noteOk
        && sizes.length >= 4 && sizes.every(([w, h]) => w >= 44 && h >= 44) && fit.l >= 0 && fit.r <= fit.iw + .5 && fit.b <= fit.ih + .5 && fit.sx <= fit.iw,
      'D045 驗收 7：手機 360×740 ☰「委託」——三選一的三張＝Node 端同一座城的 commissionOffers（id 與順序）、每張寫獎金與期限、運量委託標「本線還沒有公共運量」、接受鈕與關閉鈕 ≥ 44×44、面板不超出螢幕、沒有橫向捲動',
      `選單有 commission ${items.includes('commission')}；三張 ${J(offers.map(r => r.k))}（Node ${J(id0)}）；按鈕最小 ${Math.min(...sizes.map(s => s[0]))}×${Math.min(...sizes.map(s => s[1]))}；面板 ${Math.round(fit.l)}–${Math.round(fit.r)} × ${Math.round(fit.t)}–${Math.round(fit.b)}`);
    // 接受第 2 張（真的點）
    const pick = id0[1], c = CMS_BY_ID385[pick], h0 = (await ev('__gt.history()')).length;
    await waitFor(async () => (await toasts()).length === 0, 4000);
    await tapBtn(`#cm li[data-k="${pick}"] button`);
    const t1 = await toasts(), cms1 = await ev('__gt.simCms()'), h1 = await ev('__gt.history()'), rows1 = await ev(ROWS), pn1 = await ev(PANEL), sim1 = await sim();
    const actRow = rows1.find(r => r.kind === 'act');
    log(t1.some(q => q === `📋 接受委託：${c.nm}`) && cms1.act === pick && cms1.st === sim1.day && h1.length === h0 + 1 && J(h1.at(-1)) === J({ day: sim1.day, t: 'cms', ev: 'accept', id: pick }) && pn1.state === 'active'
        && actRow?.k === pick && actRow.name.includes(c.nm) && actRow.btn === '🗑 放棄委託' && /剩餘 \d+ 天/.test(actRow.note) && actRow.bar !== '',
      'D045 驗收 7：點第 2 張的「接受」——通知「📋 接受委託：…」（實驗線的字）、模擬的委託＝那一條且開始日＝今天、歷史多一筆 cms accept、面板換成「進行中」（進度條、獎金與剩餘天數、放棄鈕）',
      `接受 ${pick}；通知 ${J(t1)}；委託 ${J(cms1)}；歷史 ${h0}→${h1.length}；進行中那一列 ${J(actRow)}`);
    // 放棄
    await waitFor(async () => (await toasts()).length === 0, 4000);
    await tapBtn(`#cm li[data-k="${pick}"] button`);
    const t2 = await toasts(), cms2 = await ev('__gt.simCms()'), rows2 = await ev(ROWS), h2 = await ev('__gt.history()');
    const offers2 = rows2.filter(r => r.kind === 'offer').map(r => r.k);
    log(t2.some(q => q === `📋 放棄委託：${c.nm}`) && cms2.act === '' && cms2.n === 1 && J(h2.at(-1)) === J({ day: sim1.day, t: 'cms', ev: 'drop', id: pick }) && J(offers2) === J(id1),
      'D045 驗收 7：點「放棄」——通知「📋 放棄委託：…」、輪次 +1、歷史多一筆 cms drop、三選一換一批（＝Node 端輪次 1 的三選一）', `通知 ${J(t2)}；委託 ${J(cms2)}；新三選一 ${J(offers2)}（Node ${J(id1)}）`);
    // Esc 關得掉；關閉鈕
    await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); const e1 = (await ev(PANEL)).open === false;
    await ev(`__gt.menu('commission')`); await tapBtn('#cmX'); const e2 = (await ev(PANEL)).open === false;
    log(e1 && e2, 'D045 驗收 7：面板用 Esc、關閉鈕都關得掉', `Esc ${e1}、關閉鈕 ${e2}`);
  }, { W: 360, H: 740 });

  await run('settle', '委託每天結算與狀態文字', async ({ ev, open, toasts, waitFor }) => {
    // 完成：C6 已完成、接了「學術網絡」→ 推 1 天
    const N = d045Load({ ...ranked, tech343: C6, ...act('techC6', 100) }), m0 = N.sim.money; realDay.stepDay(N.sim);
    await loadCity(open, ev, C.done);
    await ev(`__gt.menu('commission')`);
    const r0 = await ev(ROWS), a0 = r0.find(r => r.kind === 'act'), mon0 = await ev('__gt.sim().money');
    await ev('__gt.simStep(1), 1');
    const t = await toasts(), cms = await ev('__gt.simCms()'), h = await ev('__gt.history()'), mon1 = await ev('__gt.sim().money'), rows = await ev(ROWS), pn = await ev(PANEL);
    const doneRow = rows.find(r => r.k === 'done');
    log(a0?.bar === '100%' && /已研究/.test(a0.val) && t.some(q => q === '📋 委託完成：研究「學術網絡」　+$1800') && Math.abs((mon1 - mon0) - (N.sim.money - m0)) < 1e-6 && J(h.at(-1).bonus) === '1800' && h.at(-1).ev === 'done'
        && cms.act === '' && cms.n === 1 && J(cms.done) === J(['techC6']) && pn.state === 'offers' && /第 2 輪/.test(await ev(`document.querySelector('#cm h3:nth-of-type(1)')?.textContent ?? ''`)) && doneRow?.val === '1',
      'D045 驗收 7：C6 已完成、接了「學術網絡」（面板開著，進度條 100%）→ 推 1 天：通知「📋 委託完成：研究「學術網絡」　+$1800」、資金＝Node 端同一座城推一天的結果（含 +$1,800）、歷史多一筆 cms done（獎金 1800）、面板換成三選一第 2 輪與「已完成 1」',
      `通知 ${J(t)}；資金 ${Math.round(mon0)}→${Math.round(mon1)}（Node ${Math.round(m0)}→${Math.round(N.sim.money)}）；委託 ${J(cms)}；最後一筆歷史 ${J(h.at(-1))}；已完成列 ${J(doneRow)}`);
    await ev(`document.getElementById('cmX').click()`);
    await ev(`__gt.menu('chronicle')`); const ch = await ev('__gt.chronicleRows()'), cl = ch.filter(r => r.kind === 'cms');
    log(cl.length === 1 && cl[0].text === '委託完成：研究「學術網絡」　+$1,800', 'D045 驗收 7：☰「大事記」多一行「委託完成：…　+$1,800」', J(cl));
    await ev(`document.getElementById('chX').click()`);
    // 過期
    await loadCity(open, ev, C.expire);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    await ev('__gt.simStep(2), 1');
    const t2 = await toasts(), cms2 = await ev('__gt.simCms()'), h2 = await ev('__gt.history()').then(q => q.filter(e => e.t === 'cms'));
    const N2 = d045Load({ ...ranked, ...act('steel40', 62) }), N2c = d045Load(ranked); for (let d = 0; d < 2; d++) { realDay.stepDay(N2.sim); realDay.stepDay(N2c.sim); }
    log(t2.some(q => q === '📋 委託過期：造船用鋼 40') && cms2.act === '' && cms2.n === 1 && cms2.done.length === 0 && J(h2.map(e => e.ev)) === J(['expire']) && N2.sim.money === N2c.sim.money,
      'D045 驗收 7：快到期的鋼材委託推 2 天——通知「📋 委託過期：造船用鋼 40」、輪次 +1、歷史多一筆 cms expire、沒有罰款（Node 端有沒有委託的同一座城，資金一樣）', `通知 ${J(t2)}；委託 ${J(cms2)}；歷史 ${J(h2)}`);
    // 三種不能接的狀態
    const states = [];
    for (const [key, want] of [['sandbox', ['sandbox', '沙盒模式無委託']], ['low', ['rank', '城市等級 3 解鎖']], ['pop', ['pop', '人口超過 50 解鎖']]]) {
      await loadCity(open, ev, C[key]); await ev(`__gt.menu('commission')`);
      const pn2 = await ev(PANEL), rows2 = await ev(ROWS), st = rows2.find(r => r.k === 'state');
      states.push([key, pn2.state, st?.val, rows2.some(r => r.kind === 'offer' || r.kind === 'act')]);
      if (pn2.state !== want[0] || st?.val !== want[1] || rows2.some(r => r.kind === 'offer' || r.kind === 'act')) states.push(['不對', key, want]);
    }
    log(!states.some(s => s[0] === '不對'), 'D045 驗收 7：不能接單的三種狀態——沙盒「沙盒模式無委託」、城市等級不到 3「城市等級 3 解鎖」、人口不到 51「人口超過 50 解鎖」，都沒有接受鈕', J(states));
  }, { W: 360, H: 740 });

  await run('persist', '重新整理', async ({ ev, open, tapBtn, waitFor, toasts }) => {
    await loadCity(open, ev, C.offers);
    await ev(`__gt.menu('commission')`);
    const id = (await ev(ROWS)).find(r => r.kind === 'offer').k;
    await tapBtn(`#cm li[data-k="${id}"] button`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    await ev('__gt.simStep(3), 1'); await ev('__gt.saveNow()');
    const read = () => ev(`(()=>({cms:__gt.simCms(),h:__gt.history().filter(e=>e.t==='cms')}))()`);
    const a = await read(); await open(''); const b = await read();
    log(a.cms.act === id && J(a.cms) === J(b.cms) && J(a.h) === J(b.h) && b.h.length === 1,
      'D045 驗收 7：接單、推 3 天、存檔、重新整理——進行中的委託（開始日、累計、連續天數、輪次、完成清單）與歷史的 cms 事件都在', `之前 ${J(a.cms)}／${a.h.length} 筆；之後 ${J(b.cms)}／${b.h.length} 筆`);
  });

  await run('budget', '手機效能預算', async ({ ev, open }) => {
    await loadCity(open, ev, C.done);
    const before = await ev('__gt.renderInfoAll()'); await ev(`__gt.menu('commission')`); const after = await ev('__gt.renderInfoAll()'), same = await ev(SAME);
    log(after.calls <= 18 && after.triangles <= 118884 && after.calls === before.calls && after.triangles === before.triangles && same,
      'D045 驗收 7：手機 360×740——委託面板開著跟關著一樣（沒有改畫面）：draw call ≤ 18、三角形 ≤ 118,884、增量重建＝整張重建', `draw call ${before.calls}→${after.calls}、三角形 ${before.triangles}→${after.triangles}；${same ? '＝' : '≠'}`);
  }, { W: 360, H: 740 });
}
export const d045SkipNote = () => ONLY.length ? `  注意：D045_SMOKE_ONLY＝${ONLY.join(',')}，D045 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d045Smoke(withBrowser, log);
  const note = d045SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
