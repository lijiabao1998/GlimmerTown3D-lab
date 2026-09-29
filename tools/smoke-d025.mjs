// D025 煙霧測試：經濟（驗收 8 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d025.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome。
//   card  起步城（沙盒）：推進到有工業，連著三天工業建築卡的「市場」一列（市場乘數、缺貨、貨物庫存、原料）＝當天的經濟快照 __gt.lastDay().econ；住宅的卡沒有「市場」列
//         種子城（seed516：商業 377 棟、工業 282 棟）當成「我的城」讀進來：推進之前（沒有當天的回報）商業與工業的卡都講「推進一天之後才算得出來」，推進一天之後商業卡（購買力、零售利用率、貨物需求、銷售乘數）
//         與工業卡的數字＝當天的快照
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['card'];
const ONLY = (process.env.D025_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
// 卡上「市場」一列的樣子（tools 這一邊獨立寫一次：src/cityView.ts 的 marketRow 是另一份；卡上的列是「標籤＋內容」連在一起）
const expectC = e => `市場購買力 ${e.consumption.purchasingPower.toFixed(2)}；零售利用率 ${Math.round(e.commerce.utilization * 100)}%（貨物需求 ${e.goods.need}：本地 ${e.goods.domestic}＋進口 ${e.goods.imports}）；銷售乘數 ×${e.commerce.salesMul.toFixed(2)}`;
const expectI = e => `市場市場乘數 ×${e.production.marketMul.toFixed(2)}（缺貨 ${Math.round(e.goods.shortageRatio * 100)}%、貨物庫存 ${e.goods.stock}／${e.goods.cap}）；原料 ${e.production.inputUsed.toFixed(1)}／${e.production.inputDemand.toFixed(1)}`;
const WAIT = '市場推進一天之後才算得出來';

export async function d025Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D025_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  if (ONLY.length && !ONLY.includes('card')) return;
  const t0 = Date.now(), seed = read('src/content/samples/seed516.code.txt').trim();
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      const rowOf = async b => { await ev(`__gt.openTile(${b.x},${b.z})`); return (await ev(CARD)).rows.find(r => r.startsWith('市場')) ?? ''; };
      const alive = async k => (await ev('__gt.conBuildings()')).filter(b => !b.gone && b.k === k);
      // 起步城：推進到有工業，連三天卡上的市場一列＝當天快照；住宅沒有這一列
      await open('sample=starter');
      let inds = [];
      for (let d = 0; d < 40 && inds.length < 3; d++) { await ev('__gt.simStep(1), 1'); inds = await alive(3); }
      const i0 = inds[0], days = [];
      for (let d = 0; d < 3 && i0; d++) {
        await ev('__gt.simStep(1), 1');
        const e = (await ev('__gt.lastDay()')).econ, row = await rowOf(i0);
        days.push({ ok: row === expectI(e), row, want: expectI(e) });
      }
      const home = (await alive(1))[0], homeRows = home ? (await (async () => { await ev(`__gt.openTile(${home.x},${home.z})`); return (await ev(CARD)).rows; })()) : [];
      log(!!i0 && days.length === 3 && days.every(x => x.ok) && !!home && !homeRows.some(r => r.startsWith('市場')),
        'D025 驗收 8：起步城（沙盒）推進到有工業，工業建築卡多一列「市場」，連著三天卡上的數字（市場乘數、缺貨、貨物庫存、原料）＝當天的經濟快照；住宅的卡沒有這一列',
        i0 ? `工業 (${i0.x},${i0.z})：${days.map(x => `「${x.row}」${x.ok ? '＝' : '≠ 「' + x.want + '」'}`).join('；')}；住宅有市場列：${homeRows.some(r => r.startsWith('市場'))}` : '沒有工業');
      // 種子城當成「我的城」（AI 城沒有商業建築）：推進之前沒有當天的回報，商業與工業都講實話；推進一天之後＝當天的快照
      await open('sample=seed516&clean=1'); await ev('__gt.clearSave()');
      await ev(`localStorage.setItem('gt3d.v1.save', ${J(seed)})`);
      await open('');
      const cs = await alive(2), is = await alive(3), c0 = cs[0], k0 = is[0];
      const beforeC = c0 ? await rowOf(c0) : '', beforeI = k0 ? await rowOf(k0) : '';
      await ev('__gt.simStep(1), 1');
      const e1 = (await ev('__gt.lastDay()')).econ, afterC = c0 ? await rowOf(c0) : '', afterI = k0 ? await rowOf(k0) : '';
      log(cs.length > 100 && is.length > 100 && beforeC.startsWith(WAIT) && beforeI.startsWith(WAIT) && afterC === expectC(e1) && afterI === expectI(e1) && Number.isFinite(e1.consumption.purchasingPower),
        'D025 驗收 8：種子城當成「我的城」讀進來——推進之前商業與工業的卡都講「推進一天之後才算得出來」；推進一天之後商業卡（購買力、零售利用率、貨物需求、銷售乘數）與工業卡的數字＝當天的快照',
        `商業 (${c0?.x},${c0?.z})（共 ${cs.length} 棟）：之前「${beforeC}」；之後「${afterC}」；工業 (${k0?.x},${k0?.z})（共 ${is.length} 棟）：之前「${beforeI}」；之後「${afterI}」；購買力 ${e1?.consumption?.purchasingPower}`);
      await ev('__gt.clearSave(), 1');
    } catch (e) { log(false, 'D025 card：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D025 card：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d025SkipNote = () => ONLY.length ? `  注意：D025_SMOKE_ONLY＝${ONLY.join(',')}，D025 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d025Smoke(withBrowser, log);
  const note = d025SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
