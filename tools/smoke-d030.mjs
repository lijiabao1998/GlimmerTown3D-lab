// D030 煙霧測試：城市活動的瀏覽器半邊（驗收 6）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d030.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome、手機尺寸（412×860）。
//   toast   起步城第 30 天的實驗線存檔讀進來當「我的城」，一天一天推：第 37 天出現「✨ 名稱！說明」（金色，字＝實驗線 toast 的字：名稱與說明照 CITY_EVENTS 表）、
//           活動結束那天出現「🎏 活動結束：名稱」；DayReport.cityEvent 的開始與結束編號＝提示裡的事件
//   fin     活動中：☰「收支明細」在工業稅之後多一列「✨ 名稱（剩 D 天）」（稅×、食×、幸福±％＝DayReport 與表），其餘每一列＝DayReport；活動結束後沒有這一列
//   happy   活動中：☰「幸福構成」有「城市活動」一項＝表的 happy；沒有活動的日子沒有這一項
//   budget  手機 draw call ≤ 18、活動中不比推進之前多
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { CITY_EVENTS } from '../src/sim/rules/events.ts';
import { finWant } from './smoke-d028.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['toast', 'fin', 'happy', 'budget'];
const ONLY = (process.env.D030_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const fp1 = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
const rowsOf = rows => rows.map(r => [r[0], r[1], r[2] === 'sum' ? 'sum' : r[3]]);
// 文件裡的規則（這一張的卡：「做什麼」4）：活動中的那一列。跟 src/cityView.ts finList 各寫一份，煙霧測試兩邊要對得上
export const eventRow = (ev, daysLeft) => [`✨ ${ev.name}（剩 ${daysLeft} 天）`, `稅×${ev.tax}　食×${ev.food}　幸福${ev.happy >= 0 ? '+' : '−'}${Math.abs(ev.happy * 100).toFixed(0)}%`, ''];
export const startText = ev => `✨ ${ev.name}！${ev.desc}`, endText = ev => `🎏 活動結束：${ev.name}`;

export async function d030Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D030_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const want = k => !ONLY.length || ONLY.includes(k);
  const t0 = Date.now(), d26 = JSON.parse(read('src/content/samples/d026-lab.json')), code30 = d26.evolve[STARTER_SEEDS[0]].codes[30];
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      const load = async c => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(c)})`); await open(''); };
      const toasts = () => ev(`[...document.querySelectorAll('#toasts .toast')].map(e => [e.textContent, e.className])`);
      // 推到活動開始那天（第 37 天），回傳那天的提示與 DayReport
      const toStart = async () => {
        for (let i = 0; i < 12; i++) { await ev('__gt.simStep(1), 1'); const r = await ev('__gt.cityEventRep()'); if (r.started >= 0) return { r, t: await toasts() }; }
        return null;
      };
      if (want('toast')) {
        await load(code30);
        const day0 = (await ev('__gt.sim()')).day, s = await toStart();
        const def = s && CITY_EVENTS[s.r.started], hit = s && s.t.find(x => x[0] === startText(def));
        log(!!s && s.r.day === 37 && !!hit && hit[1].includes('gold') && s.r.state && s.r.state.i === s.r.started && s.r.state.daysLeft === def.days,
          `D030 驗收 6：活動開始的提示——第 30 天的實驗線存檔讀進來一天一天推，第 37 天出現金色的「✨ 名稱！說明」（字＝CITY_EVENTS 表的名稱與說明）、DayReport.cityEvent 的開始編號＝這一場、狀態＝{i, days}`,
          s ? `第 ${s.r.day} 天（讀進來第 ${day0} 天）開始 ${s.r.started}「${def.name}」；提示 ${hit ? `「${hit[0]}」（${hit[1]}）` : `沒找到：${J(s.t)}`}；狀態 ${J(s.r.state)}` : '推了 12 天都沒有活動');
        if (s) {
          let end = null;
          for (let i = 0; i < 14; i++) { await ev('__gt.simStep(1), 1'); const r = await ev('__gt.cityEventRep()'); if (r.ended >= 0) { end = { r, t: await toasts() }; break; } }
          const e = end && end.t.find(x => x[0] === endText(def));
          log(!!end && end.r.ended === s.r.started && !!e && end.r.day === s.r.day + def.days && end.r.state === null,
            'D030 驗收 6：活動結束的提示——「🎏 活動結束：名稱」、DayReport.cityEvent 的結束編號＝開始的那一場、結束在開始後第 days 天、狀態回到沒有活動',
            end ? `第 ${end.r.day} 天結束（開始 ${s.r.day}、days ${def.days}）；提示 ${e ? `「${e[0]}」` : `沒找到：${J(end.t)}`}` : '沒有結束');
        }
      }
      if (want('fin')) {
        await load(code30);
        const s = await toStart();
        if (!s) log(false, 'D030 驗收 6：活動中的「收支明細」', '推了 12 天都沒有活動');
        else {
          const def = CITY_EVENTS[s.r.started];
          await ev('__gt.simStep(1), 1');   // 第 2 天：剩 days−1 天
          const rep = await ev('__gt.dayRep()'), cr = await ev('__gt.cityEventRep()');
          await ev(`__gt.menu('fin')`); const p = await ev('__gt.finPanel()'), rows = await ev('__gt.finRows()');
          const w = finWant(rep), at = w.findIndex(r => r[0] === '工業稅'); w.splice(at + 1, 0, eventRow(def, cr.active.daysLeft));
          const got = rowsOf(rows), ok = J(got) === J(w) && p.open && cr.active.daysLeft === def.days - 1 && cr.active.i === s.r.started;
          log(ok, 'D030 驗收 6：活動中的「收支明細」——在工業稅之後多一列「✨ 名稱（剩 D 天）」（稅×、食×、幸福±％），其餘每一列＝DayReport；剩餘天數＝days−1（開始後第 2 天）',
            ok ? `${got.length} 列；${J(eventRow(def, cr.active.daysLeft))}` : `不同：面板 ${J(got).slice(0, 360)} ≠ 期望 ${J(w).slice(0, 360)}`);
          await ev(`document.getElementById('finX').click()`);
          // 推到結束：沒有這一列
          for (let i = 0; i < 14; i++) { await ev('__gt.simStep(1), 1'); if ((await ev('__gt.cityEventRep()')).ended >= 0) break; }
          await ev(`__gt.menu('fin')`); const rows2 = await ev('__gt.finRows()'); await ev(`document.getElementById('finX').click()`);
          const has = rows2.some(r => String(r[0]).startsWith('✨')), rep2 = await ev('__gt.dayRep()');
          log(!has && J(rowsOf(rows2)) === J(finWant(rep2)), 'D030 驗收 6：活動結束之後的「收支明細」沒有活動那一列，其餘每一列＝DayReport', has ? `還有：${J(rows2.filter(r => String(r[0]).startsWith('✨')))}` : `${rows2.length} 列`);
        }
      }
      if (want('happy')) {
        await load(code30);
        const q = HAPPY_NAMES.indexOf('城市活動'), rowOfEvent = async () => { await ev(`__gt.menu('happy')`); const r = (await ev('__gt.happyRows()')).find(x => x[0] === '城市活動') ?? null; await ev(`document.getElementById('hsX').click()`); return r; };
        await ev('__gt.simStep(3), 1'); const before = await rowOfEvent(), a0 = (await ev('__gt.lastDay()')).happyAgg[q];
        const s = await toStart();
        if (!s) log(false, 'D030 驗收 6：活動中的「幸福構成」', '推了 12 天都沒有活動');
        else {
          const def = CITY_EVENTS[s.r.started], a1 = (await ev('__gt.lastDay()')).happyAgg[q], r1 = await rowOfEvent();
          log(before === null && a0 === 0 && Math.abs(a1 - def.happy) < 1e-9 && r1 && r1[1] === fp1(a1) && r1[2] === '',
            'D030 驗收 6：☰「幸福構成」的「城市活動」——沒有活動的日子沒有這一項（面板不列）、活動開始那天起＝表的 happy（面板列出來）',
            `活動前項 ${a0}、面板 ${J(before)}；活動中項 ${a1}（表 ${def.happy}）、面板 ${J(r1)}（要 ${fp1(a1)}）`);
        }
      }
      if (want('budget')) {
        await load(code30);
        const i0 = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'), calls0 = i0.calls, s = await toStart();
        await ev(`__gt.menu('fin')`); const info = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'); await ev(`document.getElementById('finX').click()`);
        log(!!s && info.calls <= 18 && info.calls <= calls0 + 1, 'D030 驗收 6：手機預算——活動中、開著「收支明細」，draw call ≤ 18（介面是 DOM，不多畫）', `draw call ${calls0}→${info.calls}`);
      }
      await ev('__gt.clearSave(), 1');
    } catch (e) { log(false, 'D030 toast／fin／happy／budget：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D030：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d030SkipNote = () => ONLY.length ? `  注意：D030_SMOKE_ONLY＝${ONLY.join(',')}，D030 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d030Smoke(withBrowser, log);
  const note = d030SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
