// D029 煙霧測試：夜間城市的瀏覽器半邊（驗收 6）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d029.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome、手機尺寸（412×860）。
//   panel   K4 讀進來當「我的城」：☰ 有「夜間城市」；推進之前講「推進一天之後才算得出來」、沒有列、按關閉會關；推進之後每一列＝最近一天的 DayReport.night
//           （安全與等級、路燈覆蓋、警察覆蓋、運輸服務、晚間商業活動、乘客與需求與運量、晚間消費金、夜間運輸收入、夜間營運費、夜間淨額、對住宅幸福的每日加減）；安全分數低的講建議；按 Esc 也會關
//   fin     gallery（公車站與鐵路：有夜間運輸收入與營運費）：☰「收支明細」多了「夜間運輸」（其他收入）、「其中夜間營運」（維護費下）、「其中晚間消費金」（商業稅下），每一列＝DayReport；
//           收入合計、淨額對得上
//   happy   ☰「幸福構成」的「夜間城市」一項：讀檔後第 1 天沒有（前一天沒算過）、第 2 天起＝前一天的幸福加減
//   budget  手機 draw call ≤ 18、不比推進之前多
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { cities28 } from './d028-cities.mjs';
import { oldList } from './d028-lab.mjs';
import { finWant } from './smoke-d028.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['panel', 'fin', 'happy', 'budget'];
const ONLY = (process.env.D029_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const pct = v => `${Math.round(v * 100)}%`;
const money = v => (Math.round(v) < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
const fp2 = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(2) + '%';
const fp1 = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
export const NIGHT_TIP = '安全分數偏低：警察局與派出所覆蓋越多住宅與商業越好（佔 0.31）；有公交站、鐵路與運輸設施會提高運輸服務（佔 0.10）；失業率高會扣分';
// 文件裡的規則（這一張的卡：「做什麼」3）：每一列的名稱與寫法。跟 src/cityView.ts nightList 各寫一份，煙霧測試兩邊要對得上
export function nightWant(n) {
  const g = n.safety.grade;
  return [
    ['安全', `${n.safety.score.toFixed(2)}（${g}）`, 'sum'],
    ['　路燈覆蓋', pct(n.lighting.coverage), ''], ['　警察覆蓋（住宅、商業、娛樂設施）', pct(n.safety.policeCoverage), ''], ['　運輸服務（運量÷夜間需求）', pct(n.transit.service), ''],
    ['晚間商業活動', pct(n.commerce.activity), ''], [`　乘客（需求 ${n.transit.demand.toLocaleString('en-US')}、運量 ${n.transit.capacity.toLocaleString('en-US')}）`, n.transit.riders.toLocaleString('en-US'), ''],
    ['晚間消費金（同時算進商業稅）', money(n.finance.commerceGold), 'pos'], ['夜間運輸收入', money(n.finance.transitRevenue), 'pos'], ['夜間營運費', money(-n.finance.operatingCost), 'neg'],
    ['夜間淨額', money(n.finance.net), 'sum'], ['對住宅幸福（明天起每天）', fp2(n.happinessDelta), n.happinessDelta > 0 ? 'pos' : n.happinessDelta < 0 ? 'neg' : ''],
  ];
}
const rowsOf = rows => rows.map(r => [r[0], r[1], r[2] === 'sum' ? 'sum' : r[3]]);

export async function d029Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D029_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const want = k => !ONLY.length || ONLY.includes(k);
  const t0 = Date.now(), KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt');
  const cs = cities28(newcity, KT), code = id => cs.find(c => c.id === id).code, gallery = oldList().find(c => c.id === 'gallery').code;
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      const load = async c => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(c)})`); await open(''); };
      if (want('panel')) {
        await load(code('K4'));
        const items0 = await ev('__gt.menuItems()');
        await ev(`__gt.menu('night')`); const p0 = await ev('__gt.nightPanel()'), rows0 = await ev('__gt.nightRows()');
        await ev(`document.getElementById('ncX').click()`); const closed0 = (await ev('__gt.nightPanel()')).open === false;
        log(items0.includes('night') && p0.open && p0.sub.includes('推進一天之後才算得出來') && rows0.length === 0 && closed0, 'D029 驗收 6：☰ 選單有「夜間城市」；還沒推進過講「推進一天之後才算得出來」、沒有列、按關閉會關',
          `選單項 ${items0.join('、')}；面板${p0.open ? '開' : '沒開'}「${p0.sub}」、${rows0.length} 列、關閉${closed0 ? '成功' : '失敗'}`);
        await ev('__gt.simStep(2), 1');
        const nr = await ev('__gt.nightRep()'), dr = await ev('__gt.dayRep()');
        await ev(`__gt.menu('night')`); const p1 = await ev('__gt.nightPanel()'), rows1 = await ev('__gt.nightRows()');
        const w = nightWant(nr.night), got = rowsOf(rows1), low = nr.night.safety.grade === 'C' || nr.night.safety.grade === 'D';
        const same = dr.night.commerceGold === nr.night.finance.commerceGold && dr.night.operatingCost === nr.night.finance.operatingCost && dr.night.transitRevenue === nr.night.finance.transitRevenue;
        log(J(got) === J(w) && p1.open && p1.sub.includes(`第 ${nr.day} 天`) && (nr.night.lighting.planned > 0 ? p1.sub.includes('路燈要電力調度 T471') : true) && p1.tip === (low ? NIGHT_TIP : '') && nr.simReady === true && nr.night.ready === true && same,
          '「夜間城市」面板每一列＝最近一天的 DayReport.night（安全與等級、路燈覆蓋、警察覆蓋、運輸服務、晚間商業活動、乘客與需求與運量、晚間消費金、夜間運輸收入、夜間營運費、夜間淨額、對住宅幸福的每日加減）；安全分數低（C、D）的講建議、路燈講清楚本線還沒有電力調度'.replace(/^/, 'D029 驗收 6：'),
          J(got) === J(w) ? `${got.length} 列：${got.map(r => `${r[0]} ${r[1]}`).join('｜')}；提示${p1.tip ? '「' + p1.tip.slice(0, 16) + '…」' : '無'}（等級 ${nr.night.safety.grade}）` : `不同：面板 ${J(got).slice(0, 300)} ≠ 期望 ${J(w).slice(0, 300)}；sub「${p1.sub.slice(0, 60)}」tip「${p1.tip.slice(0, 20)}」simReady ${nr.simReady}`);
        await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); const closed1 = (await ev('__gt.nightPanel()')).open === false;
        log(closed1, 'D029 驗收 6：「夜間城市」按 Esc 會關', closed1 ? '關了' : '沒關');
      }
      if (want('fin')) {
        await load(gallery);
        await ev('__gt.simStep(2), 1');
        const rep = await ev('__gt.dayRep()'), nr = await ev('__gt.nightRep()');
        await ev(`__gt.menu('fin')`); const p = await ev('__gt.finPanel()'), rows = await ev('__gt.finRows()');
        const w = finWant(rep), got = rowsOf(rows), names = got.map(r => r[0]);
        const ok = J(got) === J(w) && p.open && names.includes('夜間運輸') && names.includes('　其中夜間營運') && names.includes('　其中晚間消費金')
          && rep.other.nightTransitRev487 === nr.night.finance.transitRevenue && rep.other.nightTransitRev487 > 0 && rep.night.operatingCost === nr.night.finance.operatingCost && rep.night.operatingCost > 0 && Math.abs(rep.net - (rep.income - rep.upkeep)) < 1e-9;
        log(ok, 'D029 驗收 6：公車站與鐵路的城（gallery）——「收支明細」多了「夜間運輸」（其他收入）、「其中夜間營運」（維護費下）、「其中晚間消費金」（商業稅下），每一列＝DayReport；夜間運輸收入與夜間營運費＝夜間城市當天結算的',
          ok ? `${got.length} 列；夜間運輸 ${money(rep.other.nightTransitRev487)}、夜間營運 ${money(-rep.night.operatingCost)}、晚間消費金 ${money(rep.night.commerceGold)}` : `不同：面板 ${J(got).slice(0, 320)} ≠ 期望 ${J(w).slice(0, 320)}；夜間運輸 ${rep.other.nightTransitRev487}／${nr.night.finance.transitRevenue}、營運費 ${rep.night.operatingCost}`);
        await ev(`document.getElementById('finX').click()`);
      }
      if (want('happy')) {
        await load(code('K4'));
        const q0 = HAPPY_NAMES.indexOf('夜間城市'), rowOfNight = async () => { await ev(`__gt.menu('happy')`); const r = (await ev('__gt.happyRows()')).find(x => x[0] === '夜間城市') ?? null; await ev(`document.getElementById('hsX').click()`); return r; };
        await ev('__gt.simStep(1), 1'); const a1 = (await ev('__gt.lastDay()')), r1 = await rowOfNight(), n1 = (await ev('__gt.nightRep()')).night;
        await ev('__gt.simStep(1), 1'); const a2 = (await ev('__gt.lastDay()')), r2 = await rowOfNight();
        const want2 = fp1(a2.happyAgg[q0]);
        log(a1.happyAgg[q0] === 0 && r1 === null && Math.abs(a2.happyAgg[q0] - n1.happinessDelta) < 1e-12 && r2 && r2[1] === want2 && r2[2] === '',
          'D029 驗收 6：☰「幸福構成」的「夜間城市」——讀檔後第 1 天沒有（前一天沒算過、面板不列）、第 2 天起＝前一天的幸福加減（面板列出來、負的紅）',
          `第 1 天項 ${a1.happyAgg[q0]}、面板 ${J(r1)}；第 2 天項 ${a2.happyAgg[q0]}（前一天的幸福加減 ${n1.happinessDelta}）、面板 ${J(r2)}（要 ${want2}）`);
      }
      if (want('budget')) {
        await load(code('K4'));
        const i0 = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'), calls0 = i0.calls;
        await ev('__gt.simStep(12), 1'); await ev(`__gt.menu('night')`);
        const info = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'); await ev(`document.getElementById('ncX').click()`);
        log(info.calls <= 18 && info.calls <= calls0 + 1, 'D029 驗收 6：手機預算——推進 12 天、開著「夜間城市」，draw call ≤ 18（介面是 DOM，不多畫）', `draw call ${calls0}→${info.calls}`);
      }
      await ev('__gt.clearSave(), 1');
    } catch (e) { log(false, 'D029 panel／fin／happy／budget：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D029：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d029SkipNote = () => ONLY.length ? `  注意：D029_SMOKE_ONLY＝${ONLY.join(',')}，D029 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d029Smoke(withBrowser, log);
  const note = d029SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
