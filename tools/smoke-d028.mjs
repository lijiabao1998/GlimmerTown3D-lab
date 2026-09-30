// D028 煙霧測試：經濟（二）的瀏覽器半邊（驗收 6）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d028.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome、手機尺寸（412×860）。
//   card    K1（化肥廠＋天然氣井；農場與大農場在化肥廠覆蓋內外）讀進來當「我的城」：讀檔當天——覆蓋內的農場講「讀檔之後化肥廠要先運轉一天」、覆蓋外的講「不在化肥廠覆蓋內」、
//           天然氣井與化肥廠講「推進一天之後才算得出來」；推 1 天之後：覆蓋內的農場與大農場「最近一天化肥廠有產出 N：…下一天食物與金幣 ×1.35」、覆蓋外的照舊 ×1、天然氣井與化肥廠的「天然氣」列＝模擬給的供需與供氣率；
//           K2（化肥廠沒有天然氣，供氣率 0）：覆蓋內的農場講「沒有產出、下一天不增產」；K3（中央廚房）：廚房的「天然氣」列講熟食產出與「下一天住宅幸福 +3%」
//   fin     K4（食物分配鏈：大農場、廚房、農貿、食品加工、釀酒、牧場、溫室）：☰ 有「收支明細」；推進之前講「推進一天之後才算得出來」；推進之後每一列＝最近一天的 DayReport
//           （住商工稅、非零的收入項、收入合計、維護費、其中進口費、淨額、工資指數），淨額＝收入−維護費、也＝資金的前後差（扣掉里程碑等獎金）；按關閉與 Esc 都會關
//   budget  手機 draw call ≤ 18、不比推進之前多
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { cities28 } from './d028-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['card', 'fin', 'budget'];
const ONLY = (process.env.D028_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
const rowOf = (rows, head) => rows.find(r => r.startsWith(head)) ?? null;
const pct = v => `${Math.round(v * 100)}%`;
const money = v => (Math.round(v) < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
const INCOME_NAME = [['farmGold', '農場'], ['ranchGold', '牧場'], ['ghGold', '溫室'], ['procGold', '食品加工'], ['lodgeRev', '旅宿'], ['mktGold', '農貿市場'], ['brewGold', '釀酒'], ['techGold', '科技園'], ['dcGold', '數據中心'],
  ['cookGold', '中央廚房（熟食）'], ['bankInt', '銀行利息'], ['tradeGold', '貿易'], ['gasGold', '天然氣出口'], ['fuelExportGold418', '燃料出口'], ['steelExportGold482', '鋼材出口'], ['goodsExportGold481', '貨物出口'], ['shipPortGold', '港口船運'], ['shipDailyGold418', '船運日收入']];
const IMPORT_NAME = [['foodImportCost482', '糧食'], ['gasImportCost482', '天然氣'], ['fuelImportCost482', '燃料'], ['steelImportCost482', '鋼材'], ['suppliesImportCost482', '供應品'], ['goodsImportCost481', '貨物']];
// 文件裡的規則（這一張的卡：「做什麼」6）：每一列的名稱與寫法。跟 src/cityView.ts finList 各寫一份，煙霧測試兩邊要對得上
export function finWant(rep) {
  const rows = [['住宅稅', money(rep.tax.R), 'pos'], ['商業稅', money(rep.tax.C), 'pos'], ['工業稅', money(rep.tax.I), 'pos']];
  for (const [k, name] of INCOME_NAME) { const v = rep.other[k]; if (v && Math.round(v) !== 0) rows.push([name, money(v), v > 0 ? 'pos' : 'neg']); }
  rows.push(['收入合計', money(rep.income), 'sum']);
  rows.push(['維護費', money(-rep.upkeep), 'neg']);
  for (const [k, name] of IMPORT_NAME) { const v = rep.imports[k]; if (v && Math.round(v) !== 0) rows.push([`　其中進口${name}`, money(-v), 'neg']); }
  rows.push(['淨額（收入−維護費）', money(rep.income - rep.upkeep), 'sum']);
  rows.push(['工資指數', `×${rep.chain.wageIdx.toFixed(2)}`, '']);
  return rows;
}
export function gasText(rep) { const c = rep.chain; return `全城天然氣：本地產 ${c.gasSup}、需求 ${c.gasDem}${rep.gasImport > 0 ? `、進口 ${rep.gasImport}` : ''}，供氣率 ${pct(c.gasRatio)}`; }

export async function d028Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D028_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const want = k => !ONLY.length || ONLY.includes(k);
  const t0 = Date.now(), KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt');
  const cs = cities28(newcity, KT), code = id => cs.find(c => c.id === id).code;
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      const load = async c => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(c)})`); await open(''); };
      const cardAt = async (x, z) => { await ev(`__gt.openTile(${x},${z})`); return ev(CARD); };
      if (want('card')) {
        // ---- K1：讀檔當天 ----
        await load(code('K1'));
        const FARMS = [[24, 28, 22], [36, 31, 22], [56, 28, 22], [10, 32, 22], [34, 24, 53], [44, 24, 53]];
        const cov0 = {}; for (const [x, z] of FARMS) cov0[`${x},${z}`] = await ev(`__gt.covAt(${x},${z})`);
        const inn = FARMS.filter(([x, z]) => cov0[`${x},${z}`].fertco > 0), out = FARMS.filter(([x, z]) => !(cov0[`${x},${z}`].fertco > 0));
        const bad0 = [];
        for (const [x, z] of inn) { const r = rowOf((await cardAt(x, z)).rows, '化肥'); if (!r || !r.includes('在化肥廠覆蓋內') || !r.includes('讀檔之後化肥廠要先運轉一天')) bad0.push(`(${x},${z})「${r}」`); }
        for (const [x, z] of out) { const r = rowOf((await cardAt(x, z)).rows, '化肥'); if (!r || !r.includes('不在化肥廠覆蓋內（半徑 10 格）') || !r.includes('×1')) bad0.push(`(${x},${z})「${r}」`); }
        const gw0 = rowOf((await cardAt(33, 32)).rows, '天然氣'), fp0 = rowOf((await cardAt(30, 28)).rows, '天然氣');
        if (!gw0 || !gw0.includes('推進一天之後才算得出來') || !fp0 || !fp0.includes('推進一天之後才算得出來')) bad0.push(`天然氣井「${gw0}」化肥廠「${fp0}」`);
        log(!bad0.length && inn.length >= 3 && out.length >= 2, `D028 驗收 6：讀檔當天（K1）——化肥廠覆蓋內的農場與大農場講「讀檔之後化肥廠要先運轉一天，隔天才有增產（旗標不進存檔）」、覆蓋外的講「不在化肥廠覆蓋內（半徑 10 格）：×1」、天然氣井與化肥廠講「推進一天之後才算得出來」（覆蓋內 ≥ 3 座、覆蓋外 ≥ 2 座）`,
          bad0.slice(0, 3).join('｜') || `覆蓋內 ${inn.length} 座（${inn.map(([x, z]) => `(${x},${z})`).join('、')}）、覆蓋外 ${out.length} 座；天然氣井「${gw0}」`);
        // ---- K1：推 1 天 ----
        await ev('__gt.simStep(1), 1');
        const rep1 = await ev('__gt.dayRep()'), bad1 = [];
        if (!rep1.chain.fertReady || !(rep1.chain.fertOut > 0)) bad1.push(`第 1 天化肥廠沒有產出（fertOut ${rep1.chain.fertOut}）`);
        for (const [x, z] of inn) { const r = rowOf((await cardAt(x, z)).rows, '化肥'), exp = `化肥最近一天（第 ${rep1.day} 天）化肥廠有產出 ${rep1.chain.fertOut}：這座在覆蓋內，下一天食物與金幣 ×1.35`; if (r !== exp) bad1.push(`(${x},${z})「${r}」≠「${exp}」`); }
        for (const [x, z] of out) { const r = rowOf((await cardAt(x, z)).rows, '化肥'); if (r !== '化肥不在化肥廠覆蓋內（半徑 10 格）：食物與金幣照常 ×1') bad1.push(`(${x},${z})「${r}」`); }
        const gw1 = rowOf((await cardAt(33, 32)).rows, '天然氣'), fp1 = rowOf((await cardAt(30, 28)).rows, '天然氣');
        if (gw1 !== `天然氣${gasText(rep1)}`) bad1.push(`天然氣井「${gw1}」≠「天然氣${gasText(rep1)}」`);
        const expFp = `天然氣${gasText(rep1)}；化肥產出 ${rep1.chain.fertOut}（下一天覆蓋內的農場增產 ×1.35）`;
        if (fp1 !== expFp) bad1.push(`化肥廠「${fp1}」≠「${expFp}」`);
        log(!bad1.length, 'D028 驗收 6：推進 1 天（K1）——覆蓋內的農場與大農場「最近一天（第 N 天）化肥廠有產出 N：這座在覆蓋內，下一天食物與金幣 ×1.35」、覆蓋外照舊 ×1；天然氣井與化肥廠的「天然氣」列＝模擬給的供需、進口、供氣率與化肥產出',
          bad1.slice(0, 3).join('｜') || `第 ${rep1.day} 天：${gasText(rep1)}；化肥產出 ${rep1.chain.fertOut}；覆蓋內 ${inn.length} 座、覆蓋外 ${out.length} 座逐一核過`);
        // ---- K2：化肥廠沒有天然氣 ----
        await load(code('K2')); await ev('__gt.simStep(1), 1');
        const rep2 = await ev('__gt.dayRep()'), farm2 = [[22, 32], [10, 32], [14, 32]], bad2 = [];
        if (rep2.chain.fertReady || rep2.chain.gasRatio !== 0) bad2.push(`K2 第 1 天供氣率 ${rep2.chain.gasRatio}、化肥旗標 ${rep2.chain.fertReady}（要 0、false）`);
        for (const [x, z] of farm2) {
          const cv = await ev(`__gt.covAt(${x},${z})`); if (!(cv.fertco > 0)) { bad2.push(`(${x},${z}) 不在覆蓋內`); continue; }
          const r = rowOf((await cardAt(x, z)).rows, '化肥'), exp = `化肥在化肥廠覆蓋內，但最近一天化肥廠沒有產出（${gasText(rep2)}）：下一天不增產（×1）`;
          if (r !== exp) bad2.push(`(${x},${z})「${r}」≠「${exp}」`);
        }
        log(!bad2.length, 'D028 驗收 6：化肥廠沒有天然氣（K2，供氣率 0）——覆蓋內的農場講「最近一天化肥廠沒有產出（…供氣率 0%）：下一天不增產（×1）」',
          bad2.slice(0, 3).join('｜') || `供氣率 ${pct(rep2.chain.gasRatio)}（${gasText(rep2)}）；${farm2.length} 座農場逐一核過`);
        // ---- K3：中央廚房 ----
        await load(code('K3')); await ev('__gt.simStep(1), 1');
        const rep3 = await ev('__gt.dayRep()'), bad3 = [];
        for (const [x, z] of [[20, 28], [44, 28]]) {
          const r = rowOf((await cardAt(x, z)).rows, '天然氣'), exp = `天然氣${gasText(rep3)}；熟食產出 ${rep3.chain.cookedOut}（${rep3.chain.cookedReady ? '下一天覆蓋內的住宅幸福 +3%、每份熟食收入 $0.6' : '沒有產出'}）`;
          if (r !== exp) bad3.push(`(${x},${z})「${r}」≠「${exp}」`);
        }
        if (!rep3.chain.cookedReady || !(rep3.chain.cookedOut > 0)) bad3.push(`K3 第 1 天熟食產出 ${rep3.chain.cookedOut}（要 > 0）`);
        log(!bad3.length, 'D028 驗收 6：中央廚房（K3）——「天然氣」列講全城供需與供氣率、熟食產出、「下一天覆蓋內的住宅幸福 +3%」',
          bad3.slice(0, 3).join('｜') || `第 ${rep3.day} 天：${gasText(rep3)}；熟食產出 ${rep3.chain.cookedOut}`);
      }
      if (want('fin')) {
        await load(code('K4'));
        const items0 = await ev('__gt.menuItems()');
        await ev(`__gt.menu('fin')`); const p0 = await ev('__gt.finPanel()'), rows0 = await ev('__gt.finRows()');
        await ev(`document.getElementById('finX').click()`); const closed0 = (await ev('__gt.finPanel()')).open === false;
        log(items0.includes('fin') && p0.open && p0.sub.includes('推進一天之後才算得出來') && rows0.length === 0 && closed0, 'D028 驗收 6：☰ 選單有「收支明細」；還沒推進過講「推進一天之後才算得出來」、沒有列、按關閉會關',
          `選單項 ${items0.join('、')}；面板${p0.open ? '開' : '沒開'}「${p0.sub}」、${rows0.length} 列、關閉${closed0 ? '成功' : '失敗'}`);
        await ev('__gt.simStep(1), 1'); const before = (await ev('__gt.dayRep()')).money;
        await ev('__gt.simStep(1), 1'); const rep = await ev('__gt.dayRep()');
        await ev(`__gt.menu('fin')`); const p1 = await ev('__gt.finPanel()'), rows1 = await ev('__gt.finRows()');
        const w = finWant(rep), got = rows1.map(r => [r[0], r[1], r[2] === 'sum' ? 'sum' : r[3]]);
        const netOk = Math.abs((rep.money - before) - (rep.net + rep.bonus)) < 1e-6;
        const kinds = rep.other, nonzero = INCOME_NAME.filter(([k]) => kinds[k] && Math.round(kinds[k]) !== 0).map(([, n]) => n);
        log(J(got) === J(w) && p1.open && p1.sub.includes(`第 ${rep.day} 天`) && Math.abs(rep.net - (rep.income - rep.upkeep)) < 1e-9 && netOk && nonzero.length >= 5,
          '「收支明細」面板每一列＝最近一天的 DayReport（住商工稅、非零的收入項、收入合計、維護費、其中進口費、淨額、工資指數）；淨額＝收入−維護費、也＝資金的前後差（扣掉里程碑、星等、貸款的錢）'.replace(/^/, 'D028 驗收 6：'),
          J(got) === J(w) ? `${got.length} 列：${got.map(r => `${r[0]} ${r[1]}`).join('｜')}；資金 ${before.toFixed(2)}→${rep.money.toFixed(2)}（差 ${(rep.money - before).toFixed(4)}＝淨額 ${rep.net.toFixed(4)}＋獎金 ${rep.bonus}）` : `不同：面板 ${J(got).slice(0, 300)} ≠ 期望 ${J(w).slice(0, 300)}；淨額對帳 ${netOk}；非零收入項 ${nonzero.join('、')}`);
        // Esc 關面板
        await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); const closed1 = (await ev('__gt.finPanel()')).open === false;
        log(closed1, 'D028 驗收 6：「收支明細」按 Esc 會關', closed1 ? '關了' : '沒關');
      }
      if (want('budget')) {
        await load(code('K4'));
        const i0 = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'), calls0 = i0.calls;
        await ev('__gt.simStep(12), 1'); await ev(`__gt.menu('fin')`);
        const info = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'); await ev(`document.getElementById('finX').click()`);
        log(info.calls <= 18 && info.calls <= calls0 + 1, 'D028 驗收 6：手機預算——推進 12 天、開著「收支明細」，draw call ≤ 18（介面是 DOM，不多畫）', `draw call ${calls0}→${info.calls}`);
      }
      await ev('__gt.clearSave(), 1');
    } catch (e) { log(false, 'D028 card／fin／budget：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D028：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d028SkipNote = () => ONLY.length ? `  注意：D028_SMOKE_ONLY＝${ONLY.join(',')}，D028 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d028Smoke(withBrowser, log);
  const note = d028SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
