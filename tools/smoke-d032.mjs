// D032 煙霧測試：政策與預算的瀏覽器半邊（驗收 7）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d032.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome、手機尺寸（412×860）。
//   panel      ☰ 選單有「政策與預算」；面板每一列＝目錄與 Sim.pol／Sim.budget（三條稅率、四條服務預算、四個法規與七個政策開關：名稱、倍率或開關、有日費的列寫日費）；按關閉、按 Esc、點背景都會關
//   tax        按稅率＋／−：Sim.pol.taxR 加減 0.1、提示字照實驗線「📜 住宅稅：1.0× → 1.1×」；冷卻中再按講還剩幾天、狀態不動；三條稅率各自冷卻；值夾在 0.5–2.0；推進一天之後，同一座城同一天，住宅稅率 1.5 的住宅稅＝1.0 的 1.5 倍
//   toggle     勾營養午餐：Sim.pol.schoolLunch 與 edu.schoolLunch 跟著變、教育場重算、日費進「現在合計」、按鈕狀態與提示字；冷卻中再按擋下來；過了冷卻關掉、教育場回到原本
//   budget     服務預算＋／−：Sim.budget 加減 0.1（0.5–1.5）、提示字照實驗線「🎚️ 教育預算 ×1.1（覆蓋更廣、更貴）」、教育場重算、維護費跟著變；沒有冷卻
//   insurance  災害保險：面板勾開、有建築被燒毀的那一天跳金色的「🛡️ 災害保險理賠 +$35／戶」（同一天只一則）、資金＝沒投保的同一天 ＋ $35 × 燒毀棟數 − 日費 $18
//   persist    存檔後重新整理：政策與預算都在、冷卻不存（重新開始算）；存檔裡營養午餐開著，讀進來的教育場是沒加午餐的（實驗線的讀檔順序），改一次預算才補上
//   budget2    手機 draw call ≤ 18、開著面板不比推進之前多
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { POLICY_CATALOG, POLICY_SHOWN, POLICY_FEE, BUDGET_CATS, INSURANCE_PAYOUT, INSURANCE_TOAST } from '../src/sim/rules/policy.ts';
import { d032Runs } from './d032-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['panel', 'tax', 'toggle', 'budget', 'insurance', 'persist', 'budget2'];
const ONLY = (process.env.D032_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
export const POLICY_ORDER = ['taxR', 'taxC', 'taxI', ...BUDGET_CATS.map(c => c.id), ...POLICY_SHOWN.law, ...POLICY_SHOWN.policy];
const NAME = Object.fromEntries([...Object.entries(POLICY_CATALOG).map(([k, v]) => [k, v.nm]), ...BUDGET_CATS.map(c => [c.id, c.nm])]);
export const taxText = (from, to, nm) => `📜 ${nm}：${from.toFixed(1)}× → ${to.toFixed(1)}×`;
export const budText = (nm, v, up) => `🎚️ ${nm}預算 ×${v.toFixed(1)}${up ? '（覆蓋更廣、更貴）' : '（省錢、覆蓋縮水）'}`;

export async function d032Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D032_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const want = k => !ONLY.length || ONLY.includes(k);
  const t0 = Date.now(), runs = d032Runs();
  const p2none = runs.find(r => r.id === 'P2/none').code, p4none = runs.find(r => r.id === 'P4/none').code;   // P4：三所學校（教育場不是全 0）、垃圾場、公園、商店；P2：沒有消防局、一開始就有帶燃燒天數的建築
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      const load = async c => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(c)})`); await open(''); };
      const toasts = () => ev(`[...document.querySelectorAll('#toasts .toast')].map(e => [e.textContent, e.className])`);
      const st = () => ev('__gt.policyState()'), rows = () => ev('__gt.policyRows()'), panel = () => ev('__gt.policyPanel()');
      const press = async (k, w) => { const before = (await toasts()).length; const ok = await ev(`__gt.policyClick(${J(k)}, ${J(w)})`); return { ok, toasts: await toasts(), n0: before }; };
      if (want('panel')) {
        await open('sample=starter'); await ev('__gt.simStep(2), 1');
        const items0 = await ev('__gt.menuItems()'); await ev(`__gt.menu('policy')`);
        const p = await panel(), got = await rows(), s = await st();
        const wantKeys = POLICY_ORDER, gotKeys = got.map(r => r.k);
        const okNames = got.every((r, i) => r.name === NAME[wantKeys[i]]), okVals = got.every(r => r.kind === 'tax' ? r.val === '1.0×' : r.kind === 'budget' ? r.val === '×1.0' : r.val === '關' && !r.on);
        const okFee = got.every(r => { const fee = POLICY_FEE[r.k] ?? 0; return r.kind === 'toggle' && fee > 0 ? r.note.includes(`日費 $${fee}`) : !r.note.includes('日費'); });
        const okNote = got.every(r => r.note.length > 6);
        const ok = J(gotKeys) === J(wantKeys) && okNames && okVals && okFee && okNote && p.open && p.sub.includes(`第 ${s.day} 天`) && p.sub.includes('現在合計 $0') && items0.includes('policy') && s.pol === null;
        log(ok, 'D032 驗收 7：☰ 選單有「政策與預算」；面板 18 列（三條稅率、四條服務預算、四個法規、七個政策）的名稱＝目錄、值＝Sim.pol／Sim.budget（沒有政策＝稅率 1.0×、預算 ×1.0、開關關）、有日費的列寫日費、每列一行效果；打開面板不建預設物件（Sim.pol 還是 null）',
          ok ? `${got.length} 列：${got.slice(0, 4).map(r => `${r.name} ${r.val}`).join('｜')}…；${p.sub.slice(0, 50)}…` : `不同：鍵 ${J(gotKeys)}｜名稱 ${okNames}｜值 ${okVals}｜日費 ${okFee}｜說明 ${okNote}｜sub「${p.sub.slice(0, 50)}」｜選單 ${items0.join('、')}｜pol ${J(s.pol)}`);
        await ev(`document.getElementById('plX').click()`); const c1 = (await panel()).open === false;
        await ev(`__gt.menu('policy')`); await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); const c2 = (await panel()).open === false;
        await ev(`__gt.menu('policy')`); await ev(`document.getElementById('pl').dispatchEvent(new MouseEvent('click',{bubbles:true}))`); const c3 = (await panel()).open === false;
        log(c1 && c2 && c3, 'D032 驗收 7：「政策與預算」按關閉、按 Esc、點背景都會關', `關閉鈕 ${c1 ? '關了' : '沒關'}、Esc ${c2 ? '關了' : '沒關'}、背景 ${c3 ? '關了' : '沒關'}`);
      }
      if (want('tax')) {
        await open('sample=starter'); await ev('__gt.simStep(1), 1'); await ev(`__gt.menu('policy')`);
        const s0 = await st();
        const a = await press('taxR', '+'), s1 = await st(), r1 = (await rows()).find(r => r.k === 'taxR'), hit = a.toasts.find(x => x[0] === taxText(1, 1.1, '住宅稅'));
        const okUp = a.ok && s1.pol?.taxR === 1.1 && s1.last.taxR === s0.day && !!hit && hit[1].includes('gold') && r1.val === '1.1×' && r1.note.includes('冷卻中：還剩 40 天');
        log(okUp, 'D032 驗收 7：按住宅稅＋：Sim.pol.taxR＝1.1（1.0＋0.1 取兩位）、最後套用的日子記今天、金色提示「📜 住宅稅：1.0× → 1.1×」（字照實驗線 53752）、那一列變成 1.1× 且寫「冷卻中：還剩 40 天」',
          okUp ? `taxR ${s1.pol.taxR}；提示「${hit[0]}」；${r1.note}` : `不同：taxR ${J(s1.pol)}｜last ${J(s1.last)}（今天 ${s0.day}）｜提示 ${J(a.toasts)}｜列 ${J(r1)}`);
        const n1 = (await toasts()).length, b = await press('taxR', '+'), b2 = await press('taxR', '-'), s2 = await st(), p2 = await panel();
        const okCool = b.ok && b2.ok && s2.pol.taxR === 1.1 && b.toasts.length === n1 && b2.toasts.length === n1 && p2.tip.includes('住宅稅：冷卻中，還剩 40 天') && J(s2.last) === J(s1.last);
        log(okCool, 'D032 驗收 7：冷卻中再按＋或−：狀態不動（taxR 還是 1.1）、不跳成功提示、面板下方講「住宅稅：冷卻中，還剩 40 天才能再調」（實驗線是靜默不動）', okCool ? p2.tip : `不同：taxR ${s2.pol.taxR}｜新提示 ${b.toasts.length - n1}／${b2.toasts.length - n1}｜tip「${p2.tip}」`);
        const c = await press('taxC', '-'), s3 = await st(); await ev(`__gt.policyApply('taxI', 9)`); const s4 = await st();
        const okEach = c.ok && s3.pol.taxC === 0.9 && s4.pol.taxI === 2 && s4.pol.taxR === 1.1 && (await toasts()).some(x => x[0] === taxText(1, 2, '工業稅'));
        log(okEach, 'D032 驗收 7：三條稅率各自冷卻（商業稅按−＝0.9 照樣成功）；輸入 9 夾成 2.0（「1.0× → 2.0×」）', okEach ? `taxC ${s3.pol.taxC}、taxI ${s4.pol.taxI}` : `不同：taxC ${s3.pol.taxC}、taxI ${s4.pol.taxI}、taxR ${s4.pol.taxR}`);
        // 過了冷卻：住宅稅可以再調；工業稅在頂（2.0）再按＋＝同值不動，講「已經是 2.0×」
        await ev('__gt.simStep(40), 1'); await ev(`__gt.menu('policy')`);
        const d = await press('taxR', '+'), s5 = await st(), e = await press('taxI', '+'), p5 = await panel();
        const okAfter = d.ok && s5.pol.taxR === 1.2 && e.ok && p5.tip.includes('工業稅已經是 2.0×') && (await st()).pol.taxI === 2;
        log(okAfter, 'D032 驗收 7：過了 40 天冷卻，住宅稅可以再＋（1.2）；工業稅已在 2.0 再按＋＝同值不動、講「工業稅已經是 2.0×（範圍 0.5–2.0×）」', okAfter ? `taxR ${s5.pol.taxR}；${p5.tip}` : `不同：taxR ${s5.pol.taxR}｜tip「${p5.tip}」`);
        // 收支：同一座城同一天，住宅稅率 1.0 與 1.5，住宅稅（rep.settle.tax.R）比 1.5
        const taxR = async rate => { await open('sample=starter'); if (rate !== 1) await ev(`__gt.policyApply('taxR', ${rate})`); await ev('__gt.simStep(1), 1'); return (await ev('__gt.dayRep()')).tax.R; };
        const t1 = await taxR(1), t15 = await taxR(1.5);
        log(t1 > 0 && Math.abs(t15 / t1 - 1.5) < 1e-9, 'D032 驗收 7：推進一天之後收支明細的住宅稅照新稅率變動——同一座城同一天，住宅稅率 1.5 的住宅稅＝1.0 的 1.5 倍', `住宅稅 ${t1.toFixed(4)}（1.0×）→ ${t15.toFixed(4)}（1.5×），比 ${(t15 / t1).toFixed(9)}`);
      }
      if (want('toggle')) {
        await load(p4none); await ev('__gt.simStep(1), 1'); await ev(`__gt.menu('policy')`);
        const s0 = await st(), E0 = s0.edu, a = await press('schoolLunch', 'toggle'), s1 = await st(), r1 = (await rows()).find(r => r.k === 'schoolLunch'), p1 = await panel();
        const hit = a.toasts.find(x => x[0] === '📜 營養午餐：開啟');
        const okOn = a.ok && s1.pol?.schoolLunch === true && s1.schoolLunch === true && s1.edu !== E0 && r1.on && r1.val === '開' && r1.note.includes('日費 $12') && r1.note.includes('冷卻中：還剩 40 天') && !!hit && hit[1].includes('gold') && p1.sub.includes('現在合計 $12');
        log(okOn, 'D032 驗收 7：勾營養午餐——Sim.pol.schoolLunch 與 edu.schoolLunch 變 true、教育場 EDU 重算（雜湊變了）、按鈕亮起（aria-pressed）、提示「📜 營養午餐：開啟」、那一列寫日費 $12 與冷卻、「現在合計」＝$12',
          okOn ? `EDU ${E0} → ${s1.edu}；${r1.note}；${p1.sub.slice(-14)}` : `不同：ok ${a.ok}｜pol ${J(s1.pol?.schoolLunch)}｜edu.schoolLunch ${s1.schoolLunch}｜EDU ${E0}→${s1.edu}｜列 ${J(r1)}｜提示 ${J(a.toasts.map(x => x[0]))}｜sub「${p1.sub}」`);
        const n1 = (await toasts()).length, b = await press('schoolLunch', 'toggle'), s2 = await st(), p2 = await panel();
        log(b.ok && s2.pol.schoolLunch === true && s2.edu === s1.edu && b.toasts.length === n1 && p2.tip.includes('營養午餐：冷卻中，還剩 40 天'), 'D032 驗收 7：冷卻中再按營養午餐：擋下來（還是開著、EDU 不變、沒有新提示、面板講還剩 40 天）', `開著 ${s2.pol.schoolLunch}、EDU ${s2.edu}、tip「${p2.tip}」`);
        await ev('__gt.simStep(40), 1'); await ev(`__gt.menu('policy')`);
        const c = await press('schoolLunch', 'toggle'), s3 = await st(), r3 = (await rows()).find(r => r.k === 'schoolLunch');
        log(c.ok && s3.pol.schoolLunch === false && s3.schoolLunch === false && s3.edu === E0 && !r3.on && r3.val === '關' && (await toasts()).some(x => x[0] === '📜 營養午餐：關閉'), 'D032 驗收 7：過了冷卻關掉營養午餐：教育場回到原本（雜湊＝開之前）、按鈕熄掉、提示「📜 營養午餐：關閉」', `EDU ${s3.edu}（原本 ${E0}）、按鈕 ${r3.val}`);
      }
      if (want('budget')) {
        await load(p4none); await ev('__gt.simStep(1), 1'); await ev(`__gt.menu('policy')`);
        const s0 = await st(), E0 = s0.edu, a = await press('edu', '+'), s1 = await st(), r1 = (await rows()).find(r => r.k === 'edu');
        const hit = a.toasts.find(x => x[0] === budText('教育', 1.1, true));
        log(a.ok && s1.budget.edu === 1.1 && r1.val === '×1.1' && !!hit && s1.edu !== E0 && s1.last.edu === undefined && !r1.note.includes('冷卻'), 'D032 驗收 7：按教育預算＋：Sim.budget.edu＝1.1、提示「🎚️ 教育預算 ×1.1（覆蓋更廣、更貴）」（字照實驗線 65800）、教育場重算（覆蓋半徑變大）、沒有冷卻',
          `預算 ${J(s1.budget)}；EDU ${E0} → ${s1.edu}；提示 ${hit ? `「${hit[0]}」` : J(a.toasts.map(x => x[0]))}`);
        const d1 = await press('edu', '-'), d2 = await press('edu', '-'), s2 = await st(), t2 = d2.toasts.map(x => x[0]);
        log(d1.ok && d2.ok && s2.budget.edu === 0.9 && t2.includes(budText('教育', 1.0, false)) && t2.includes(budText('教育', 0.9, false)), 'D032 驗收 7：連按兩次－（沒有冷卻）：1.1→1.0→0.9，提示「（省錢、覆蓋縮水）」', `預算 ${s2.budget.edu}；提示 ${J(t2.slice(-2))}`);
        for (let i = 0; i < 8; i++) await ev(`__gt.budgetApply('edu', -1)`);
        const lo = (await st()).budget.edu; for (let i = 0; i < 12; i++) await ev(`__gt.budgetApply('edu', 1)`); const hi = (await st()).budget.edu;
        log(lo === 0.5 && hi === 1.5, 'D032 驗收 7：服務預算夾在 0.5–1.5', `一路按－到 ${lo}、一路按＋到 ${hi}`);
        // 維護費跟著變：同一座城同一天，教育預算 1.0 與 1.5，維護費多 (學校×2.5＋圖書館×2＋大學×8＋…)×0.5
        const upkeep = async cat => { await load(p4none); if (cat) for (let i = 0; i < 5; i++) await ev(`__gt.budgetApply('edu', 1)`); await ev('__gt.simStep(1), 1'); return (await ev('__gt.dayRep()')).upkeep; };
        const u1 = await upkeep(false), u15 = await upkeep(true);
        log(u15 > u1, 'D032 驗收 7：教育預算 1.5 的維護費比 1.0 高（同一座城同一天；維護費＝學校、圖書館、大學…的維護費 ×預算）', `維護費 ${u1.toFixed(2)}（×1.0）→ ${u15.toFixed(2)}（×1.5）`);
      }
      if (want('insurance')) {
        const fund = async on => {
          await load(p2none);
          if (on) { await ev(`__gt.menu('policy')`); await ev(`__gt.policyClick('insurance', 'toggle')`); await ev(`document.getElementById('plX').click()`); }
          await ev('__gt.simStep(1), 1'); const s = await st(), t = await toasts();
          return { insured: s.insured, toasts: t.filter(x => x[0] === INSURANCE_TOAST), money: s.money, pol: s.pol };
        };
        const off = await fund(false), on = await fund(true);
        const exact = on.money - off.money, want = INSURANCE_PAYOUT * on.insured - (POLICY_FEE.insurance ?? 0);
        log(off.insured === 0 && on.insured > 0 && on.toasts.length === 1 && on.toasts[0][1].includes('gold') && off.toasts.length === 0 && Math.abs(exact - want) < 1e-9 && on.pol?.insurance === true,
          'D032 驗收 7：災害保險——第 1 天有 n 棟建築燒毀（P2：沒有消防局、帶燃燒天數的住宅與商店與工廠）：面板勾開、跳一則金色「🛡️ 災害保險理賠 +$35／戶」（同一天只一則；沒投保不跳）、資金＝沒投保的同一天 ＋ $35×n − 日費 $18',
          `燒毀 ${on.insured} 棟；資金 ${off.money.toFixed(2)}（沒投保）→ ${on.money.toFixed(2)}（投保），差 ${exact.toFixed(2)}（要 ${want}）；提示 ${on.toasts.length} 則`);
      }
      if (want('persist')) {
        await load(p4none); await ev('__gt.simStep(1), 1'); await ev(`__gt.menu('policy')`);
        const E0 = (await st()).edu;
        await press('taxR', '+'); await press('schoolLunch', 'toggle'); await press('police', '+'); await ev(`__gt.saveNow()`);
        const before = await st();
        await open('');   // 重新整理（讀存檔）
        const after = await st();
        const okKeep = after.pol?.taxR === 1.1 && after.pol.schoolLunch === true && after.budget.police === 1.1 && after.schoolLunch === true && J(after.last) === '{}' && before.last.taxR !== undefined;
        log(okKeep, 'D032 驗收 7：存檔後重新整理——政策（住宅稅 1.1、營養午餐開）與服務預算（警察 1.1）都在；冷卻不存（重新開始算，實驗線放在 AI 市長的存檔裡、本線沒有）', okKeep ? `taxR ${after.pol.taxR}、午餐 ${after.pol.schoolLunch}、警察預算 ${after.budget.police}、冷卻 ${J(after.last)}` : `不同：讀回 pol ${J(after.pol)}｜預算 ${J(after.budget)}｜冷卻 ${J(after.last)}（存檔前 ${J(before.last)}）`);
        await ev(`__gt.menu('policy')`);
        const quirk = after.edu === E0;   // 存檔裡營養午餐開著：讀進來的教育場 EDU 還是沒加午餐的（實驗線 load() 先 rebuildCov、後設 pol）
        await ev(`__gt.budgetApply('edu', 1)`); const fixed = (await st()).edu;
        log(quirk && fixed !== E0, 'D032 驗收 7：存檔裡營養午餐開著——讀進來的教育場是沒加午餐的（雜湊＝開之前的，實驗線 load() 先 rebuildCov、後設 pol 的怪癖，照抄），改一次教育預算（rebuildCov）才補上午餐的 ×1.25', `讀回 EDU ${after.edu}（開之前 ${E0}）${quirk ? '＝沒加午餐' : '≠'}；改預算後 ${fixed}`);
      }
      if (want('budget2')) {
        await load(p4none);
        const i0 = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'), calls0 = i0.calls;
        await ev('__gt.simStep(12), 1'); await ev(`__gt.menu('policy')`);
        const info = await ev('(__gt.renderInfoAll(), __gt.renderInfo())'); await ev(`document.getElementById('plX').click()`);
        log(info.calls <= 18 && info.calls <= calls0 + 1, 'D032 驗收 7：手機預算——P4 推進 12 天、開著「政策與預算」，draw call ≤ 18（介面是 DOM，不多畫）', `draw call ${calls0}→${info.calls}`);
      }
      await ev('__gt.clearSave(), 1');
    } catch (e) { log(false, 'D032 panel／tax／toggle／budget／insurance／persist：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D032：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d032SkipNote = () => ONLY.length ? `  注意：D032_SMOKE_ONLY＝${ONLY.join(',')}，D032 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d032Smoke(withBrowser, log);
  const note = d032SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}
void read;
