// D033 Node 守衛（二）：污水的實驗線頁面實跑（驗收 2、3）、接線（驗收 5）、存檔與決定性（驗收 7）。由 tools/unit.mjs 呼叫；vm 逐項與突變（驗收 1、5 的公式半邊）在 tools/unit-d033.mjs。
//   1. 樣本 src/content/samples/d033-lab.json（tools/d033-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀：實驗線版本、回退設定、探針原文、每一筆的碼雜湊（＝本線現在產生的）、佈局與 Q 城的清單；
//   2. layouts：隨機與手排的佈局（354 個）——實驗線讀進來、不推進，強制算 ensureWaterCycle472 之後記下每個建築根格的 SEWER_ROOT_OK472；本線 simFromSave 讀同一張碼、sewerServed 自己算：根格清單逐格相同、
//      每一個根格的接管逐格相等；覆蓋：接管、沒貼管線、管網裡沒有污水廠、超過 90 格四種原因各至少 20 棟、廠夾兩條管（容量只加進先插入的元件）而「看得到廠卻不接管」至少 10 棟；
//   3. runs：Q 系列（人口 ≥ 500 的自造城）連推 13 天，每天跟實驗線逐欄比——D032 的全部欄位（資金不取整、淨額、三項稅、十二個收入項、食物、遊客、旅宿、每一棟住宅的幸福 64 位元浮點逐位、幸福構成 57 項、夜間城市、人口、
//      就業、下一個亂數、焦土、有電、需求、垃圾、EDU）加這一張的兩欄：接管棟數（SEW_OK442 的總和）、lv2／lv3 住宅數（升級的結果）；錢也判；
//      覆蓋：接管的 lv2 升了三級而沒接管的一棟都沒升、lv3 沒接管的有高密度污水 −.04、污水廠減壓（有廠且接管的住宅近旁每座工業 +.025）看得到、人口不到 500 有廠的小城吃減壓、人口從 500 以上掉到以下 sewNeed 隔天關掉；
//   4. 接線：day.ts／food.ts／sewer.ts 的副本改壞一處要紅（接管恆 0、門檻用別的人口、幸福與生長各自不讀接管、減壓不傳廠數／接管／工業數／半徑、報表算反；
//      容量加給所有元件、距離 ≤ 90 改 < 90、不看容量、發電廠當 root、起點只認第一個元件、角落不算、貼著的元件取最後一個、廠沒有容量、k156 沒有起點……）；
//   5. 存檔與決定性：有污水廠的城存→讀→再存逐位元組相同、沒有新欄位、建築與管網原樣；sewerServed 同一張碼兩次相同。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import * as SW from '../src/sim/rules/sewer.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { loadMod } from './unit-d024.mjs';
import { dayVariant } from './unit-d021.mjs';
import { compareCity32 } from './unit-d032-live.mjs';
import { PROBE } from './d033-lab.mjs';
import { d033Layouts, d033Runs, SEWER_DAYS } from './d033-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d033LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D033 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

const lvCount = s => { const a = [0, 0]; for (const t of s.w.tiles) { const b = t.bld; if (b && !b.ref && b.k === 1) { if (b.lv === 2) a[0]++; else if (b.lv === 3) a[1]++; } } return a; };
// 一座 Q 城連推 rec.days 天，逐天跟實驗線比（D032 的全部欄位）加這一張的兩欄（sw、lv）。mod＝day.ts（真的或改壞的）
export function compareCity33(mod, code, rec, KT, vrank, { stopAtFirst = true, onDay, noInject = false, before } = {}) {
  const extra = [];
  const r = compareCity32(mod, code, rec, KT, vrank, { stopAtFirst, noInject, before, onDay: (day, mine, row, rep, s) => {
    const lv = lvCount(s), dd = [];
    if (rep.sewer.served !== row.sw) dd.push(`接管棟數 本線 ${rep.sewer.served} ≠ 實驗線 ${row.sw}`);
    if (J(lv) !== J(row.lv)) dd.push(`lv2／lv3 住宅數 本線 ${J(lv)} ≠ 實驗線 ${J(row.lv)}`);
    if (dd.length) extra.push([day, dd]);
    onDay?.(day, mine, row, rep, s);
  } });
  for (const [day, dd] of extra) { r.d.push(`第 ${day} 天：${dd.join('；')}`); if (!r.first) { r.first = day; r.firstFields = ['sw']; } if (!r.fields.includes('sw')) r.fields.push('sw'); }
  return r;
}

async function guards(log) {
  const lab = JSON.parse(read(process.env.D033_SAMPLE ?? 'src/content/samples/d033-lab.json')), layouts = d033Layouts(), runs = d033Runs();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, layouts, runs, KT, vrank });
  const simOf = c => realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank);

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('探針原文跟 tools/d033-lab.mjs 現在的不同（重錄）');
    if (J(lab.layoutOrder) !== J(layouts.map(l => l.id))) bad.push('樣本的佈局清單 ≠ tools/d033-cities.mjs d033Layouts() 現在的（重跑 tools/d033-lab.mjs --part=layouts）');
    if (J(lab.order) !== J(runs.map(r => r.id))) bad.push('樣本的 Q 城清單 ≠ d033Runs() 現在的（重跑 tools/d033-lab.mjs --part=runs）');
    for (const l of layouts) { const L = lab.layouts[l.id]; if (!L) bad.push(`${l.id}：沒有記錄`); else if (L.codeHash !== fnv1a(l.code)) bad.push(`${l.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d033-lab.mjs --part=layouts）`); }
    for (const c of runs) { const L = lab.runs[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同或天數不對（重跑 tools/d033-lab.mjs --part=runs）`); }
    log(!bad.length, `D033 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；佈局 ${layouts.length} 個（只讀 SEWER_ROOT_OK472，不推進）、Q 城 ${runs.length} 座連推 ${SEWER_DAYS} 天；探針原文與碼雜湊＝本線現在的`,
      bad.slice(0, 4).join('；') || `layouts ${Object.keys(lab.layouts).length}、runs ${Object.keys(lab.runs).length}，錄了 ${lab.seconds} 秒`);
    if (bad.length) return;
  }

  // ---- 2. 佈局：每個建築根格的接管逐格相等 ----
  const layoutDiffs = M => {   // M＝sewer 模組（真的或改壞的）；回傳 { bad: [...], cover }
    const bad = [], cover = { roots: 0, ok: 0, nopipe: 0, noplant: 0, toofar: 0, quirk: 0, plants: 0 };
    for (const l of layouts) {
      const L = lab.layouts[l.id], s = simOf(l), w = s.w, res = M.sewerServed(w), roots = [];
      for (let i = 0; i < w.tiles.length; i++) { const b = w.tiles[i].bld; if (b && !b.ref) roots.push([i, b.k, b.sz || 1]); }
      if (J(roots) !== J(L.roots)) { bad.push(`${l.id}：根格清單不同（本線 ${roots.length}、實驗線 ${L.roots.length}）`); continue; }
      const mine = []; for (let i = 0; i < res.ok.length; i++) if (res.ok[i]) mine.push(i);
      if (J(mine) !== J(L.ok)) { const a = new Set(mine), b = new Set(L.ok); bad.push(`${l.id}：接管不同——只有本線接管 ${mine.filter(x => !b.has(x)).slice(0, 4).join(',') || '無'}、只有實驗線接管 ${L.ok.filter(x => !a.has(x)).slice(0, 4).join(',') || '無'}`); }
      cover.roots += roots.length; cover.plants += res.plants;
      for (let i = 0; i < res.why.length; i++) { const y = res.why[i]; if (y === 255) continue; if (y === 0) cover.ok++; else if (y === 1) cover.nopipe++; else if (y === 2) cover.noplant++; else cover.toofar++; }
      // 夾兩條管的怪癖：沒有容量的元件卻碰到廠的腳印＋外一圈（含四角）——這些根格看得到廠、卻不接管
      const { comp } = SW.pipeComponents(w), touched = new Set(), capped = new Set();
      for (let i = 0; i < w.tiles.length; i++) {
        const b = w.tiles[i].bld; if (!b || b.ref || ![27, 156, 157].includes(b.k)) continue;
        const sz = b.sz || 1, x = i % w.N, y = (i / w.N) | 0;
        for (let dy = -1; dy <= sz; dy++) for (let dx = -1; dx <= sz; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w.N || yy >= w.N) continue; const c = comp[yy * w.N + xx]; if (c >= 0) touched.add(c); }
        if (b.k !== 157) { const cs = SW.facilityComps(w, comp, i, sz); if (cs.length) capped.add(cs[0]); }
      }
      for (const [i] of roots) if (res.why[i] === 2) { const b = w.tiles[i].bld, cs = SW.facilityComps(w, comp, i, b.sz || 1); if (cs.length && touched.has(cs[0]) && !capped.has(cs[0])) cover.quirk++; }
    }
    return { bad, cover };
  };
  {
    const { bad, cover } = layoutDiffs(SW);
    if (cover.ok < 200) bad.push(`接管的根格只有 ${cover.ok}（要 ≥ 200）`);
    for (const [k, n, name] of [['nopipe', 20, '沒貼管線'], ['noplant', 20, '管網裡沒有污水廠'], ['toofar', 20, '超過 90 格']]) if (cover[k] < n) bad.push(`${name}的根格只有 ${cover[k]}（要 ≥ ${n}）`);
    if (cover.quirk < 10) bad.push(`夾兩條管的怪癖（看得到廠卻不接管）只有 ${cover.quirk} 棟（要 ≥ 10）`);
    LIVE.cover = cover;
    log(!bad.length, `D033 驗收 2：實驗線頁面實跑（隨機與手排的佈局 ${layouts.length} 個，不推進）——實驗線讀進來、強制算 ensureWaterCycle472 之後的 SEWER_ROOT_OK472（非舊式分支裡 SEW_OK442 的來源，55152）與本線 sewerServed 吃同一張碼：根格清單逐格相同、每一個建築根格的接管逐格相等；覆蓋：接管、沒貼管線、管網裡沒有污水廠、超過 90 格四種原因與廠夾兩條管的怪癖`,
      bad.slice(0, 4).join('｜') || `${layouts.length} 個佈局、${cover.roots} 個根格、污水廠 ${cover.plants} 座：接管 ${cover.ok}、沒貼管線 ${cover.nopipe}、沒有廠 ${cover.noplant}、超過 90 格 ${cover.toofar}、夾兩條管的怪癖 ${cover.quirk} 棟，全部逐格相等`);
  }

  // ---- 3. Q 城連推 13 天 ----
  {
    const bad = [], seen = { days: 0, upgrades: {}, unservedLv2Up: 0, dense: {}, reliefCities: [], needFlip: false, needOnDays: 0, need: {} };
    const dn = HAPPY_NAMES.indexOf('高密度污水');
    for (const c of runs) {
      const rec = lab.runs[c.id], lv0 = { v: null }; let prevNeed = null;
      const r = compareCity33(realDay, c.code, rec, KT, vrank, { stopAtFirst: false, onDay: (day, mine, row, rep, s) => {
        seen.days++;
        if (lv0.v === null) lv0.v = row.lv;
        if (rep.happyAgg[dn] < 0) seen.dense[c.id] = (seen.dense[c.id] ?? 0) + 1;
        if (prevNeed !== null && prevNeed && !rep.sewer.need) seen.needFlip = true;
        prevNeed = rep.sewer.need; if (rep.sewer.need) seen.needOnDays++;
        (seen.need[c.id] ??= []).push(rep.sewer.need ? 1 : 0);
      } });
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 220)}（共 ${r.d.length} 天不同）`);
      const last = rec.rows.at(-1), first = rec.rows[0];
      seen.upgrades[c.id] = last.lv[1] - first.lv[1];
    }
    if (!(seen.upgrades.Q1 >= 2 && seen.upgrades.Q4 >= 2)) bad.push(`接管的 lv2 升三級：Q1 ${seen.upgrades.Q1}、Q4 ${seen.upgrades.Q4}（各要 ≥ 2）`);
    if (seen.upgrades.Q7 !== 0) bad.push(`完全沒接管的 Q7 還是升了 ${seen.upgrades.Q7} 棟三級（要 0）`);
    if (!(seen.dense.Q7 >= 10 && seen.dense.Q1 >= 10)) bad.push(`高密度污水 −.04 的天數：Q7 ${seen.dense.Q7 ?? 0}、Q1 ${seen.dense.Q1 ?? 0}（各要 ≥ 10）`);
    if (seen.dense.Q3) bad.push(`人口不到 500 的 Q3 不該有高密度污水（${seen.dense.Q3} 天）`);
    if (!seen.needFlip) bad.push('沒有哪一座城的 sewNeed 從開變關（Q5 人口要從 500 以上掉到以下）');
    LIVE.seen = seen;
    log(!bad.length, `D033 驗收 3：實驗線頁面實跑（Q 系列 ${runs.length} 座自造城，人口 ≥ 500，連推 ${SEWER_DAYS} 天）——每天逐欄跟實驗線比（資金不取整、淨額、三項稅、十二個收入項、食物、遊客、旅宿、每一棟住宅的幸福 64 位元浮點逐位、幸福構成 57 項、夜間城市、人口、就業、下一個亂數、焦土、有電、三種需求、垃圾、EDU）加接管棟數與 lv2／lv3 住宅數；資金也判；覆蓋：接管的 lv2 升三級而沒接管的不升、lv3 沒接管有高密度污水、人口 500 前後 sewNeed 切換`,
      bad.slice(0, 4).join('｜') || `${runs.length} 座、${seen.days} 個城日每一欄全等（資金判了全部）；升三級：Q1 +${seen.upgrades.Q1}、Q4 +${seen.upgrades.Q4}、Q7 +${seen.upgrades.Q7}（沒接管）；高密度污水 −.04 的天數：Q7 ${seen.dense.Q7}、Q1 ${seen.dense.Q1}、Q4 ${seen.dense.Q4 ?? 0}、Q5 ${seen.dense.Q5 ?? 0}；sewNeed 開著的城日 ${seen.needOnDays}、Q5 隔天關掉`);
  }

  await wiringGuards(log, { lab, layouts, runs, KT, vrank, layoutDiffs, simOf });
  await persistGuards(log, { runs, layouts, KT, vrank, simOf });
}

// ---- 4. 接線：day.ts／food.ts／sewer.ts 的副本改壞一處要紅（驗收 5）----
const WIRING = [   // [名字, day.ts 的編輯, 要被哪幾座 Q 城抓到]
  ['接管恆 0（人口 ≥ 500 時）', [['const sewOkArr = sew ? sew.ok : new Uint8Array(nn).fill(1);', 'const sewOkArr = new Uint8Array(nn).fill(sewNeed ? 0 : 1);']], ['Q1', 'Q4', 'Q5']],
  ['接管恆 1（人口 ≥ 500 時也全算接管）', [['const sewOkArr = sew ? sew.ok : new Uint8Array(nn).fill(1);', 'const sewOkArr = new Uint8Array(nn).fill(1);']], ['Q1', 'Q4', 'Q7']],
  ['不呼叫 sewerServed（沒廠沒管一樣）', [['const sew = sewNeed ? sewerServed(w) : null;', 'const sew = null;']], ['Q1', 'Q4', 'Q7']],
  ['門檻改成 300 人', [['const sewNeed = s.pop >= SEWAGE_THRESHOLD442;', 'const sewNeed = s.pop >= 300;']], ['Q3']],
  ['門檻改成 700 人', [['const sewNeed = s.pop >= SEWAGE_THRESHOLD442;', 'const sewNeed = s.pop >= 700;']], ['Q4']],
  ['門檻用 500 人但判斷用「>」', [['const sewNeed = s.pop >= SEWAGE_THRESHOLD442;', 'const sewNeed = s.pop > SEWAGE_THRESHOLD442;']], []],
  ['sewNeed 永遠關（住宅幸福與生長都不看污水）', [['const sewNeed = s.pop >= SEWAGE_THRESHOLD442;', 'const sewNeed = false;']], ['Q1', 'Q4', 'Q7']],
  ['住宅幸福的接管讀 !sewNeed（不看這一棟）', [['sewNeed, sewOk: sewOkArr[i] === 1,', 'sewNeed, sewOk: !sewNeed,']], ['Q1', 'Q7']],
  ['住宅幸福的接管恆 true', [['sewNeed, sewOk: sewOkArr[i] === 1,', 'sewNeed, sewOk: true,']], ['Q1', 'Q7']],
  ['生長拿全 0 的接管', [['sewNeed, sewOk: sewOkArr, onIndustry:', 'sewNeed, sewOk: new Uint8Array(nn), onIndustry:']], ['Q1', 'Q4']],
  ['生長不要求接管（sewNeed 給 false）', [['sewNeed, sewOk: sewOkArr, onIndustry:', 'sewNeed: false, sewOk: sewOkArr, onIndustry:']], ['Q7', 'Q1']],
  ['污水廠減壓不傳廠數', [['cityHappy, cnt.se ?? 0, sewOkArr,', 'cityHappy, 0, sewOkArr,']], ['Q3', 'Q4']],
  ['污水廠減壓不傳接管', [['cnt.se ?? 0, sewOkArr, (x, y)', 'cnt.se ?? 0, null, (x, y)']], ['Q3', 'Q4']],
  ['污水廠減壓不傳工業數', [['(x, y) => indNear(x, y, 3));', '(x, y) => 0);']], ['Q3', 'Q4']],
  ['污水廠減壓的工業半徑 3 變 2', [['(x, y) => indNear(x, y, 3));', '(x, y) => indNear(x, y, 2));']], ['Q4']],
  ['污水廠減壓讀 k27 之外的計數（se 恆 1）', [['cityHappy, cnt.se ?? 0, sewOkArr,', 'cityHappy, 1, sewOkArr,']], ['Q2']],   // 人口不到 500、沒有廠、住宅旁有工業：SEW_OK 全 1，只有 se 擋得住減壓
  ['報表的接管棟數算反', [['if (sewOkArr[i] === 1) sewServedN++; else sewUnservedN++;', 'if (sewOkArr[i] === 1) sewUnservedN++; else sewServedN++;']], ['Q1', 'Q4', 'Q7']],
];
const FOOD = [
  ['減壓 .025 變 .026', [['ind * .025', 'ind * .026']], ['Q3', 'Q4']],
  ['減壓不看這一棟接管', [['if (se > 0 && sewOk && sewOk[i] && indNear)', 'if (se > 0 && indNear)']], ['Q4']],
  ['減壓不看有沒有廠', [['if (se > 0 && sewOk && sewOk[i] && indNear)', 'if (sewOk && sewOk[i] && indNear)']], ['Q2']],
];
const SEWER = [   // [名字, sewer.ts 的編輯]——用佈局抓（layoutDiffs）
  ['廠的容量加給貼著的每一個元件', [['if (cap && cs.length) capOf[cs[0]] += cap * pfOf(b);', 'if (cap && cs.length) for (const c of cs) capOf[c] += cap * pfOf(b);']]],
  ['廠的容量加給貼著的最後一個元件', [['if (cap && cs.length) capOf[cs[0]] += cap * pfOf(b);', 'if (cap && cs.length) capOf[cs[cs.length - 1]] += cap * pfOf(b);']]],
  ['距離 ≤ 90 改成 < 90', [['best <= WATER_HOPS472 && capOf[c] > 0', 'best < WATER_HOPS472 && capOf[c] > 0']]],
  ['距離 ≤ 90 改成 ≤ 91', [['best <= WATER_HOPS472 && capOf[c] > 0', 'best <= WATER_HOPS472 + 1 && capOf[c] > 0']]],
  ['不看元件有沒有容量', [['best <= WATER_HOPS472 && capOf[c] > 0', 'best <= WATER_HOPS472']]],
  ['發電廠與水務設施也當 root', [['if (!WATER_FACILITY_K472.has(b.k) && !POWER_SOURCE_K450.has(b.k))', 'if (true)']]],
  ['發電廠當 root（水務設施不是）', [['if (!WATER_FACILITY_K472.has(b.k) && !POWER_SOURCE_K450.has(b.k))', 'if (!WATER_FACILITY_K472.has(b.k))']]],
  ['水務設施當 root（發電廠不是）', [['if (!WATER_FACILITY_K472.has(b.k) && !POWER_SOURCE_K450.has(b.k))', 'if (!POWER_SOURCE_K450.has(b.k))']]],
  ['距離起點只認廠貼著的第一個元件', [['for (const c of cs) for (let dy = -1; dy <= sz; dy++) for (let dx = -1; dx <= sz; dx++) {', 'for (const c of cs.slice(0, 1)) for (let dy = -1; dy <= sz; dy++) for (let dx = -1; dx <= sz; dx++) {']]],
  ['找距離時四角不算', [['if (comp[z] === c && dist[z] < best) best = dist[z];', 'if (comp[z] === c && !((dx === -1 || dx === sz) && (dy === -1 || dy === sz)) && dist[z] < best) best = dist[z];']]],
  ['貼著的元件取最後一個', [['rootComp[i] = cs.length ? cs[0] : -1;', 'rootComp[i] = cs.length ? cs[cs.length - 1] : -1;']]],
  ['污水廠沒有容量', [['const SEWER_CAP: Record<number, number> = { 27: 180, 156: 340 };', 'const SEWER_CAP: Record<number, number> = { 156: 340 };']]],
  ['高級污水廠沒有容量', [['const SEWER_CAP: Record<number, number> = { 27: 180, 156: 340 };', 'const SEWER_CAP: Record<number, number> = { 27: 180 };']]],
  ['高級污水廠與提升站不是距離起點', [['const SEWER_PLANT_K = [27, 156, 157];', 'const SEWER_PLANT_K = [27];']]],
  ['提升站不是距離起點', [['const SEWER_PLANT_K = [27, 156, 157];', 'const SEWER_PLANT_K = [27, 156];']]],
  ['沒貼著管網的住宅算接管', [['if (c < 0) { why[r] = SEWER_NO_PIPE; continue; }', 'if (c < 0) { ok[r] = 1; why[r] = SEWER_OK; continue; }']]],
  ['管網元件 4 向連通換成只看水平', [['const POW_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];', 'const POW_DIR = [[1, 0], [-1, 0]];']]],
];
async function wiringGuards(log, { lab, layouts, runs, KT, vrank, layoutDiffs, simOf }) {
  const codeOf = id => runs.find(c => c.id === id).code, recOf = id => lab.runs[id];
  const diffOn = (mod, ids) => ids.map(id => ({ id, d: compareCity33(mod, codeOf(id), recOf(id), KT, vrank, { stopAtFirst: true }).d })).filter(x => x.d.length);
  const bad = [], out = [];
  const allIds = [...new Set([...WIRING, ...FOOD].flatMap(m => m[2]))];
  const base = diffOn(await dayVariant([]), allIds);
  if (base.length) bad.push(`沒改的副本就有不對：${base.slice(0, 3).map(x => `${x.id} ${x.d[0].slice(0, 80)}`).join('｜')}`);
  const equiv = [];
  for (const [name, edits, ids] of WIRING) {
    if (!ids.length) { equiv.push(name); continue; }
    let hit; try { hit = diffOn(await dayVariant(edits), ids); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    out.push(`${name}：${hit.length ? hit.map(x => x.id).join('、') : '沒抓到'}`);
    if (!hit.length) bad.push(`「${name}」沒抓到（${ids.join('、')}）`);
  }
  for (const [name, edits, ids] of FOOD) {
    let F2, V; try { F2 = await loadMod('src/sim/rules/food.ts', edits); V = await dayVariant([], { './rules/food.ts': F2 }); } catch (e) { bad.push(`food.ts「${name}」載入失敗 ${e.message.slice(0, 100)}`); continue; }
    const hit = diffOn(V, ids);
    out.push(`${name}：${hit.length ? hit.map(x => x.id).join('、') : '沒抓到'}`);
    if (!hit.length) bad.push(`food.ts「${name}」沒抓到（${ids.join('、')}）`);
  }
  // sewer.ts：用佈局抓（接管逐格相等）；沒改的先核過全等（上一項已證）
  const missed = [], caught = [];
  for (const [name, edits] of SEWER) {
    let M; try { M = await loadMod('src/sim/rules/sewer.ts', edits); } catch (e) { bad.push(`sewer.ts「${name}」載入失敗 ${e.message.slice(0, 100)}`); continue; }
    const { bad: d } = layoutDiffs(M);
    if (d.length) caught.push(`${name}（${d.length} 個佈局）`); else missed.push(name);
  }
  if (missed.length) bad.push(`sewer.ts 的突變沒抓到：${missed.join('、')}`);
  out.push(`sewer.ts：${caught.join('、')}`);
  log(!bad.length, `D033 驗收 5：接線——day.ts 的副本改壞一處（${WIRING.filter(m => m[2].length).length} 個：接管恆 0／恆 1、不呼叫 sewerServed、門檻用別的人口、sewNeed 永遠關、住宅幸福與生長各自不讀接管、污水廠減壓不傳廠數／接管／工業數／半徑、報表算反）、food.ts（${FOOD.length} 個：減壓係數、不看這一棟接管、不看有沒有廠）、sewer.ts（${SEWER.length} 個：容量加給每個元件或最後一個、距離邊界、不看容量、發電廠與水務設施當 root、起點只認第一個元件、四角不算、貼著的元件取最後一個、廠與高級污水廠沒有容量、提升站不是起點、沒貼管網算接管、元件連通）要紅；沒改的先核過全等`,
    bad.slice(0, 4).join('｜') || out.join('；'));
}

// ---- 5. 存檔與決定性 ----
async function persistGuards(log, { runs, layouts, KT, vrank, simOf }) {
  const bad = [], info = [];
  const q1 = runs.find(c => c.id === 'Q1'), L1 = loadCode(q1.code, KT, vrank);
  if (!L1.ok) { log(false, 'D033 驗收 7：存檔與決定性', `本線讀不進 Q1：${L1.error}`); return; }
  const s = L1.sim;
  for (let d = 0; d < 4; d++) realDay.stepDay(s);
  const code1 = saveCode(s, L1.template, L1.start), L2 = loadCode(code1, KT, vrank);
  if (!L2.ok) bad.push(`存檔讀不回：${L2.error}`);
  else {
    const code2 = saveCode(L2.sim, L2.template, L2.start);
    // 讀檔重挑變體會多記事件（見 D032 驗收 6），所以比建築與管網，不比整串碼
    const raw1 = decodeLabCode(code1).save.raw, raw2 = decodeLabCode(code2).save.raw, rawT = decodeLabCode(q1.code).save.raw;
    const OK_EXTRA = new Set(['ln', 'sup', 'gds', 'steel364', 'rk', 'd3', 'z']);   // 範本沒有、存檔會寫的既有欄位（庫存 D025、城市等級 D031、歷史附加 d3）；污水不加任何欄位
    const extraKeys = Object.keys(raw1).filter(k => !(k in rawT) && !OK_EXTRA.has(k));
    if (extraKeys.length) bad.push(`存檔多了欄位：${extraKeys.join('、')}`);
    const tiles = x => J({ wp: x.wp, bl: x.bl.map(r => r.slice(0, 2)) });
    if (tiles(raw1) !== tiles(raw2)) bad.push('存→讀→再存的管網與建築清單不同');
    const a = realDay.stepDay(L2.sim), b = realDay.stepDay(loadCode(code1, KT, vrank).sim);
    if (J(a.sewer) !== J(b.sewer)) bad.push(`同一張存檔讀兩次、推進一天的接管報表不同：${J(a.sewer)} ≠ ${J(b.sewer)}`);
    info.push(`Q1 推 4 天存→讀→再存：管網格 ${[...raw1.wp].filter(c => c === '1').length}、建築 ${raw1.bl.length}、沒有新欄位`);
  }
  // sewerServed 決定性：同一張碼兩次相同
  const l0 = layouts[0], A = SW.sewerServed(simOf(l0).w), B = SW.sewerServed(simOf(l0).w);
  if (J([...A.ok]) !== J([...B.ok]) || J([...A.why]) !== J([...B.why])) bad.push('sewerServed 同一張碼兩次不同');
  // 污水廠是普通建築：存檔裡的 k27 讀得回來、數得到
  const withPlant = runs.filter(c => { const s2 = simOf(c); return s2.w.tiles.some(t => t.bld && !t.bld.ref && t.bld.k === 27); });
  if (withPlant.length < 3) bad.push(`有污水廠的 Q 城只有 ${withPlant.length} 座`);
  log(!bad.length, 'D033 驗收 7：存檔與決定性——有污水廠與管網的城存→讀→再存，管網與建築清單不變、沒有新欄位（接管是每天重算的派生值）；同一張存檔讀兩次、推進一天的接管報表相同；sewerServed 同一張碼兩次相同',
    bad.slice(0, 3).join('｜') || `${info.join('；')}；有污水廠的 Q 城 ${withPlant.length} 座`);
}
