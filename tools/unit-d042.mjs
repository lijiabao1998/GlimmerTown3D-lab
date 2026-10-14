// D042 Node 守衛：合併提示一天多筆合成一則（本線介面；實驗線一筆一則）。由 tools/unit.mjs 呼叫。
//   1. 一筆＝實驗線的字（四種各一，含巨廈的居民人數與綜合體的就業）；
//   2. 兩筆以上＝「🏙️ 今天 N 處合併：住宅摩天樓 ×a、商業摩天樓 ×b、住宅巨廈 ×c、商業綜合體 ×d」：2,000 個隨機清單（1–12 筆）逐一對照獨立寫的期望值；N＝總數、四種各自的數量、沒有的不列、順序固定、
//      清單順序不影響字、名稱＝內容表；
//   3. 真的城：M1b、M2b 連推 13 天，每天的 stepDay 回報 merges 合成的字都合格式（有合併的日子才有字、一天一則）；
//   4. 接線：cityView.ts 是「一天一則」（呼叫 mergesToastText(rep.merges…)、沒有逐筆發提示的迴圈）；
//   5. 突變：merge.ts 的副本改壞一處（數量不寫、種類順序反過來、一筆也走多筆的字、N 寫成種類數）都要紅；cityView.ts 退回逐筆迴圈要紅。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { mergeToastText, mergesToastText, MERGE_NAMES } from '../src/sim/rules/merge.ts';
import { MEGA_POP, MEGA_JOBS } from '../src/sim/rules/jobs.ts';
import { loadMod } from './unit-d024.mjs';
import { d034Runs } from './d034-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
export async function d042Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D042 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}
const KINDS = [33, 34, 105, 106];
// 獨立寫的期望值（不看 merge.ts 的實作）
const expectMulti = list => {
  const n = k => list.filter(m => m.k === k).length, nm = { 33: '住宅摩天樓', 34: '商業摩天樓', 105: '住宅巨廈', 106: '商業綜合體' };
  return `🏙️ 今天 ${list.length} 處合併：` + KINDS.filter(k => n(k)).map(k => `${nm[k]} ×${n(k)}`).join('、');
};
async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  // ---- 1. 一筆＝實驗線的字 ----
  {
    const bad = [], want = { 33: '🏙️ 住宅摩天樓落成！', 34: '🏙️ 商業摩天樓落成！', 105: `🌆 住宅巨廈拔地而起！（居民 ${MEGA_POP} 人）`, 106: `🌆 商業綜合體開幕！（就業 ${MEGA_JOBS}）` };   // 實驗線 55726、55753 的字
    for (const k of KINDS) { const g = mergesToastText([{ k }], MEGA_POP, MEGA_JOBS); if (g !== want[k] || g !== mergeToastText(k, MEGA_POP, MEGA_JOBS)) bad.push(`k${k}：「${g}」≠「${want[k]}」`); }
    for (const k of KINDS) if (MERGE_NAMES[k] !== KT.name(k)) bad.push(`名稱 k${k}：${MERGE_NAMES[k]} ≠ 內容表 ${KT.name(k)}`);
    log(!bad.length, 'D042 驗收 1：一天只有一筆合併——提示的字＝實驗線原來的字（四種各一：住宅摩天樓落成、商業摩天樓落成、住宅巨廈拔地而起〔居民人數〕、商業綜合體開幕〔就業〕）；合併種類名稱＝內容表', bad.join('；') || `四種都對（居民 ${MEGA_POP}、就業 ${MEGA_JOBS}）`);
  }
  // ---- 2. 多筆 ----
  {
    const bad = [], R = mulberry32(0x42042);
    let multi = 0, byN = {};
    for (let t = 0; t < 2000; t++) {
      const n = 2 + Math.floor(R() * 11), list = Array.from({ length: n }, () => ({ k: KINDS[Math.floor(R() * 4)], x: Math.floor(R() * 70), z: Math.floor(R() * 70) }));
      const g = mergesToastText(list, MEGA_POP, MEGA_JOBS), w = expectMulti(list);
      if (g !== w) { bad.push(`${J(list.map(m => m.k))}：「${g}」≠「${w}」`); if (bad.length > 3) break; continue; }
      const shuffled = list.slice().sort(() => R() - .5);
      if (mergesToastText(shuffled, MEGA_POP, MEGA_JOBS) !== g) bad.push(`清單順序影響了字：${J(list.map(m => m.k))}`);
      const total = [...g.matchAll(/×(\d+)/g)].reduce((a, m) => a + +m[1], 0);
      if (total !== n || !g.startsWith(`🏙️ 今天 ${n} 處合併：`)) bad.push(`數量不對：${g}`);
      multi++; byN[n] = (byN[n] ?? 0) + 1;
    }
    for (const n of [2, 12]) if (!(byN[n] > 20)) bad.push(`n＝${n} 的案例只有 ${byN[n] ?? 0} 個`);
    const same = mergesToastText([{ k: 33 }, { k: 33 }], MEGA_POP, MEGA_JOBS);
    if (same !== '🏙️ 今天 2 處合併：住宅摩天樓 ×2') bad.push(`兩棟同種：「${same}」`);
    log(!bad.length, 'D042 驗收 2：一天兩筆以上——「🏙️ 今天 N 處合併：住宅摩天樓 ×a、商業摩天樓 ×b、住宅巨廈 ×c、商業綜合體 ×d」：2,000 個隨機清單（2–12 筆）逐一＝獨立寫的期望值；N＝總數、各種數量加起來＝N、沒有的種類不列、順序固定、清單順序不影響字',
      bad.slice(0, 3).join('；') || `${multi} 個清單全對（n＝2 有 ${byN[2]} 個、n＝12 有 ${byN[12]} 個）`);
  }
  // ---- 3. 真的城 ----
  {
    const bad = [], info = [], runs = d034Runs().filter(r => r.id === 'M1b' || r.id === 'M2b');
    if (runs.length !== 2) throw new Error('找不到 M1b、M2b');
    for (const r of runs) {
      const sim = realDay.simFromSave(decodeLabCode(r.code).save, r.code, KT, vrank);   // 同 tools/d034-cities.mjs expectedMerges（煙霧頁面拿同一張碼）
      let one = 0, many = 0;
      for (let d = 0; d < 13; d++) {
        const rep = realDay.stepDay(sim);
        if (!rep.merges.length) continue;
        const g = mergesToastText(rep.merges, MEGA_POP, MEGA_JOBS);
        if (rep.merges.length === 1) { one++; if (g !== mergeToastText(rep.merges[0].k, MEGA_POP, MEGA_JOBS)) bad.push(`${r.id} 第 ${d + 1} 天單筆：${g}`); }
        else { many++; if (g !== expectMulti(rep.merges)) bad.push(`${r.id} 第 ${d + 1} 天多筆：${g}`); }
      }
      info.push(`${r.id}：單筆 ${one} 天、多筆 ${many} 天`);
      if (!(one + many >= 2 && many >= 1)) bad.push(`${r.id}：13 天裡沒有量到多筆的日子`);
    }
    log(!bad.length, 'D042 驗收 3：真的城（M1b、M2b 連推 13 天）——每天 stepDay 回報的合併合成的字，單筆日＝實驗線的字、多筆日＝合成的字；兩座城都有多筆的日子', bad.slice(0, 3).join('；') || info.join('；'));
  }
  // ---- 4. 接線 ----
  const view = read('src/cityView.ts');
  {
    const bad = [];
    if (!/mergesToastText\(rep\.merges,/.test(view)) bad.push('cityView.ts 沒有呼叫 mergesToastText(rep.merges, …)');
    if (/for \(const m of rep\.merges\)[^\n]*toast/.test(view)) bad.push('cityView.ts 還有逐筆發合併提示的迴圈');
    if (!/if \(rep\.merges\.length\) bui\.toast\(/.test(view)) bad.push('cityView.ts 沒有「有合併才發一則」的判斷');
    log(!bad.length, 'D042 驗收 4：接線——cityView.ts 一天一則：有合併才發、呼叫 mergesToastText(rep.merges…)、沒有逐筆發提示的迴圈；點提示鏡頭過去的是第一筆', bad.join('；') || '一天一則');
  }
  // ---- 5. 突變 ----
  {
    const bad = [], out = [];
    const sample = [[{ k: 33 }, { k: 33 }, { k: 34 }], [{ k: 105 }, { k: 106 }], [{ k: 106 }], [{ k: 34 }, { k: 33 }, { k: 106 }, { k: 105 }, { k: 105 }]];
    const muts = [
      ['不寫數量', "`${MERGE_NAMES[k]} ×${n}`", "`${MERGE_NAMES[k]}`"],
      ['種類順序反過來', 'export const MERGE_KINDS = [33, 34, 105, 106] as const;', 'export const MERGE_KINDS = [106, 105, 34, 33] as const;'],
      ['一筆也走多筆的字', 'if (list.length === 1) return mergeToastText(list[0].k, megaPop, megaJobs);', ''],
      ['N 寫成種類數', '`🏙️ 今天 ${list.length} 處合併：', '`🏙️ 今天 ${parts.length} 處合併：'],
      ['種類名稱寫錯', "33: '住宅摩天樓'", "33: '商業摩天樓'"],
    ];
    for (const [name, a, b] of muts) {
      try {
        const M = await loadMod('src/sim/rules/merge.ts', [[a, b]]);
        const diff = sample.some(l => M.mergesToastText(l, MEGA_POP, MEGA_JOBS) !== (l.length === 1 ? mergeToastText(l[0].k, MEGA_POP, MEGA_JOBS) : expectMulti(l)));
        diff ? out.push(name) : bad.push(`突變「${name}」沒抓到`);
      } catch (e) { bad.push(`突變「${name}」：${String(e.message).slice(0, 100)}`); }
    }
    const back = view.replace(/if \(rep\.merges\.length\) bui\.toast\(mergesToastText\(rep\.merges, MEGA_POP, MEGA_JOBS\), 'gold', \(\) => focusTile\(rep\.merges\[0\]\.x, rep\.merges\[0\]\.z\)\);/, "for (const m of rep.merges) bui.toast(mergeToastText(m.k, MEGA_POP, MEGA_JOBS), 'gold', () => focusTile(m.x, m.z));");
    if (back === view) bad.push('接線突變的錨點沒對上（cityView.ts 的那一行改過）');
    else if (!(/for \(const m of rep\.merges\)[^\n]*toast/.test(back))) bad.push('接線突變沒生效');
    else out.push('cityView 退回逐筆迴圈（接線守衛看得出來）');
    log(!bad.length, 'D042 驗收 5：突變——merge.ts 的副本改壞一處（不寫數量、種類順序反過來、一筆也走多筆的字、N 寫成種類數、種類名稱寫錯）都要紅；cityView.ts 退回逐筆迴圈，接線守衛要看得出來', bad.slice(0, 3).join('；') || `${out.length} 個全紅：${out.join('、')}`);
  }
}
