// D031 煙霧測試：城市等級的瀏覽器半邊（驗收 7）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d031.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome、手機尺寸（412×860）。
//   toast   升級提示：起步城第 29 天升 Lv.5（沒有預告）出現金色的「🏙️ 起步城升至 Lv.5 磚瓦小鎮！」；把 seed516 存檔裡的 rk 改成 6（Lv.7）而點數指向 Lv.8，推一天升 Lv.8，提示帶預告「　解鎖：小型地標…」（全形空白隔開、字＝RANKS 的名稱與預告）；rk 改成 0 一天連升到點數所指的那一級，畫面上留著最後三則；DayReport.rank.promoted＝提示裡的那些級
//   panel   ☰「城市等級」面板每一列＝Sim.rankIdx／cityPoints 與 RANKS：等級與名稱、城市點數、下一級與門檻、進度百分比與進度條寬度、這一級的預告；頂級（seed516，Lv.26）寫「已達最高等級」、進度 100%、預告是榮耀；按關閉、Esc 會關
//   budget  手機 draw call ≤ 18、開著面板不比推進之前多
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { RANKS, rankStep } from '../src/sim/rules/rank.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { oldList } from './d027-lab.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['toast', 'panel', 'budget'];
const ONLY = (process.env.D031_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// D053 UI-only expected scope; numeric source table/golden parity is unchanged.
const noteWant = idx => ({5:'文化建築',7:'小型地標',11:'研究院',16:'紀念工程'})[idx]
  ? `${({5:'文化建築',7:'小型地標',11:'研究院',16:'紀念工程'})[idx]}：本線尚無建造工具；升級不會新增這類可建設施。`
  : idx === 21 ? '解鎖：太空研究中心，可從設施導覽選取（3×3）。' : RANKS[idx].unlock ?? '';
// 文件裡的規則（這一張的卡：「做什麼」4）：每一列的名稱與寫法。跟 src/cityView.ts rankList 各寫一份，煙霧測試兩邊要對得上
export function rankWant(idx, pts) {
  const cur = RANKS[idx], next = RANKS[idx + 1] ?? null, pct = next ? clamp((pts - cur.threshold) / (next.threshold - cur.threshold) * 100, 0, 100) : 100;
  const rows = [['等級', `Lv.${idx + 1} ${cur.name}`, 'sum'], ['城市點數', pts.toLocaleString('en-US'), ''], ['下一級', next ? `Lv.${idx + 2} ${next.name}（${next.threshold.toLocaleString('en-US')} 點）` : '已達最高等級', ''], ['進度', `${Math.round(pct)}%`, '']];
  if (noteWant(idx)) rows.push(['本線說明', noteWant(idx), '']);
  return { rows, pct };
}
export const promoText = (name, q) => `🏙️ ${name}升至 Lv.${q + 1} ${RANKS[q].name}！` + (noteWant(q) ? `　${noteWant(q)}` : '');
const rowsOf = rows => rows.map(r => [r[0], r[1], r[2] === 'sum' ? 'sum' : '']);

export async function d031Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D031_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const want = k => !ONLY.length || ONLY.includes(k);
  const t0 = Date.now(), d26 = JSON.parse(read('src/content/samples/d026-lab.json')), olds = oldList();
  const seed516 = olds.find(c => c.id === 'seed516').code, withRk = (code, rk) => { const r = decodeLabCode(code); return encodeLabCode({ ...r.save.raw, rk }, { deflate: true }); };   // 存檔裡的 rk 改成指定值（其他欄位原樣）
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      const load = async c => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(c)})`); await open(''); };
      const toasts = () => ev(`[...document.querySelectorAll('#toasts .toast')].map(e => [e.textContent, e.className])`);
      const stepUntil = async (n, pred) => { for (let i = 0; i < n; i++) { await ev('__gt.simStep(1), 1'); const r = await ev('__gt.rankRep()'); if (pred(r)) return { r, t: await toasts() }; } return null; };
      if (want('toast')) {
        // 起步城（第 1 天、Lv.4）：第 29 天升 Lv.5
        await open('sample=starter');
        const s = await stepUntil(40, r => r.promoted.length > 0), q = s?.r.promoted.at(-1), name = s?.r.name;
        const hit = s && s.t.find(x => x[0] === promoText(name, q));
        log(!!s && s.r.day === 29 && q === 4 && !!hit && hit[1].includes('gold') && s.r.idx === 4,
          'D031 驗收 7：起步城第 29 天升 Lv.5——金色的「🏙️ 城名升至 Lv.5 磚瓦小鎮！」（這一級沒有預告）、DayReport.rank.promoted＝這一級、Sim.rankIdx＝4',
          s ? `第 ${s.r.day} 天升到 Lv.${q + 1}（${s.r.points} 點）；提示 ${hit ? `「${hit[0]}」（${hit[1]}）` : `沒找到：${J(s.t)}（城名 ${J(name)}）`}` : '推了 40 天都沒升級');
        // 有預告的那一級：seed516 讀進來 rk＝6（Lv.7），一天之後點數所指的那一級是 Lv.8（門檻 980，有「解鎖：小型地標」預告）——只升一級
        await load(withRk(seed516, 6));
        const s2 = await stepUntil(1, r => r.promoted.length > 0), q2 = s2?.r.promoted.at(-1), t2 = s2 && s2.t.find(x => x[0] === promoText(s2.r.name, q2));
        log(!!s2 && J(s2.r.promoted) === J([7]) && !!t2 && t2[1].includes('gold') && RANKS[7].unlock && t2[0].includes('本線尚無建造工具'), 'D031 驗收 7：升進有解鎖預告的那一級（Lv.8）——提示帶本線尚無建造工具說明；RANKS 的名稱與數值不變、DayReport.rank.promoted＝[7]',
          s2 ? `提示 ${t2 ? `「${t2[0]}」（${t2[1]}）` : `沒找到：${J(s2.t)}`}；升到 ${J(s2.r.promoted)}、點數 ${s2.r.points}` : '沒升級');
        // 一天連升好幾級：rk＝0，一天之後升到點數所指的那一級（每一級一則提示，畫面上最多留三則＝最後三級）
        await load(withRk(seed516, 0));
        const s3 = await stepUntil(1, r => r.promoted.length > 0), top3 = s3 ? s3.r.promoted.slice(-3) : [], want3 = s3 ? rankStep(0, s3.r.points).promoted : [];
        const okMulti = !!s3 && J(s3.r.promoted) === J(want3) && want3.length >= 4 && top3.every(q => s3.t.some(x => x[0] === promoText(s3.r.name, q) && x[1].includes('gold'))) && s3.t.length === 3;
        log(okMulti, 'D031 驗收 7：一天連升好幾級（rk＝0、點數指向 Lv.8）——DayReport.rank.promoted＝從 Lv.2 到那一級每一級，畫面上留著最後三則（每一級一則，字＝RANKS 的名稱與預告）',
          s3 ? `升到 ${J(s3.r.promoted)}（點數 ${s3.r.points}）；畫面上 ${s3.t.length} 則：${s3.t.map(x => x[0]).join('｜')}` : '沒升級');
      }
      if (want('panel')) {
        await open('sample=starter');
        await ev('__gt.simStep(3), 1');
        const rep = await ev('__gt.rankRep()'); await ev(`__gt.menu('rank')`); const p = await ev('__gt.rankPanel()'), rows = await ev('__gt.rankRows()'), items = await ev('__gt.menuItems()');
        const w = rankWant(rep.idx, rep.points), got = rowsOf(rows);
        const ok = J(got) === J(w.rows) && p.open && p.sub.includes(`第 ${rep.day} 天`) && p.bar === w.pct + '%' && items.includes('rank');
        log(ok, 'D031 驗收 7：☰ 選單有「城市等級」；面板每一列＝Sim.rankIdx／cityPoints 與 RANKS（等級與名稱、城市點數、下一級與門檻、進度百分比、進度條寬度）',
          ok ? `${got.length} 列：${got.map(r => `${r[0]} ${r[1]}`).join('｜')}；進度條 ${p.bar}` : `不同：面板 ${J(got)} ≠ 期望 ${J(w.rows)}；進度條 ${p.bar}（要 ${w.pct}%）；sub「${p.sub.slice(0, 60)}」；選單 ${items.join('、')}`);
        await ev(`document.getElementById('rkX').click()`); const c1 = (await ev('__gt.rankPanel()')).open === false;
        await ev(`__gt.menu('rank')`); await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); const c2 = (await ev('__gt.rankPanel()')).open === false;
        log(c1 && c2, 'D031 驗收 7：「城市等級」按關閉、按 Esc 都會關', `關閉鈕 ${c1 ? '關了' : '沒關'}、Esc ${c2 ? '關了' : '沒關'}`);
        // 頂級：seed516 讀進來就在 Lv.26
        await load(seed516); await ev('__gt.simStep(1), 1');
        const top = await ev('__gt.rankRep()'); await ev(`__gt.menu('rank')`); const pt = await ev('__gt.rankPanel()'), rt = await ev('__gt.rankRows()'), wt = rankWant(top.idx, top.points);
        const okT = top.idx === 25 && J(rowsOf(rt)) === J(wt.rows) && pt.bar === '100%' && rt.some(r => r[1] === '已達最高等級') && rt.some(r => r[0] === '本線說明' && r[1] === RANKS[25].unlock);
        log(okT, 'D031 驗收 7：頂級（seed516 讀進來就在 Lv.26、點數只有幾千）——面板寫「已達最高等級」、進度 100%、預告是「城市巔峰榮耀：全城住宅幸福 +2%（永久）」',
          okT ? `Lv.${top.idx + 1}、${top.points} 點；${rt.map(r => `${r[0]} ${r[1]}`).join('｜')}` : `不同：面板 ${J(rowsOf(rt))} ≠ 期望 ${J(wt.rows)}；進度條 ${pt.bar}`);
        await ev(`document.getElementById('rkX').click()`);
      }
      if (want('budget')) {
        await load(d26.evolve[STARTER_SEEDS[0]].codes[70]);
        const i0 = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'), calls0 = i0.calls;
        await ev('__gt.simStep(12), 1'); await ev(`__gt.menu('rank')`);
        const info = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'); await ev(`document.getElementById('rkX').click()`);
        log(info.calls <= 18 && info.calls <= calls0 + 1, 'D031 驗收 7：手機預算——起步城第 70 天的存檔推進 12 天、開著「城市等級」，draw call ≤ 18（介面是 DOM，不多畫）', `draw call ${calls0}→${info.calls}`);
      }
      await ev('__gt.clearSave(), 1');
    } catch (e) { log(false, 'D031 toast／panel／budget：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D031：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d031SkipNote = () => ONLY.length ? `  注意：D031_SMOKE_ONLY＝${ONLY.join(',')}，D031 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d031Smoke(withBrowser, log);
  const note = d031SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
