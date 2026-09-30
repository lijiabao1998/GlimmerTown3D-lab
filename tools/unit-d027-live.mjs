// D027 Node 守衛（二）：實驗線頁面實跑（驗收 3、7）、接線（驗收 4）、存檔與決定性（驗收 5）、地面貼圖的輸入（驗收 6 的 Node 半邊）。由 tools/unit.mjs 呼叫；vm 逐項與突變（驗收 1、2）在 tools/unit-d027.mjs；瀏覽器半邊在 tools/smoke-d027.mjs。
//   1. 樣本 src/content/samples/d027-lab.json（tools/d027-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀；
//   2. 本線自己讀檔、每天把實驗線那一天用到的三樣本線沒有的輸入（政策、科技與專精；夜間城市；城市活動）代進去，推進一天之後跟實驗線逐欄比：道路負載、通勤懲罰、叢集路徑、動態地價、地價基準、過載道路格數、
//      每一棟住宅的幸福、幸福構成 57 項、物流效率與貿易額度、城市幸福、人口、就業、下一個亂數（這一天用掉的亂數次數與順序）——
//      自造城 J1–J17 連推 13 天、D022–D025 的 120 座城連推 10 天（分區清成 0／分區不清各一批）、起步城第 30／70／110 天的存檔 24 份連推 12 天；
//   3. 起步城 8 個種子 × 120 天整城軌跡：(a) 代入實驗線的輸入 → 逐日逐欄全等；(b) 什麼都不代（玩家實際玩到的本線）→ 第 30／60／90／120 天的 8 種子平均做統計比對（規則 8）＋逐日相等到第幾天的地板；
//   4. 接線：day.ts 的副本改壞一處要紅（通勤與負載、重算週期、壅堵計數、動態地價、幸福與經濟讀不到、電視訊號、社宅財富級、雜湊……）；
//   5. 存檔與決定性：不進存檔、讀檔全零、第一個 4 的倍數的日子才有、同一張碼讀兩次每天雜湊與整列記錄相同；
//   6. 地面貼圖的輸入（src/render/ground.ts）：over 全 0＝沒給；每檔暖色；逐像素＝公式；非路格不動；增量＝整張。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { ensurePol } from '../src/sim/rules/policy.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import * as realDay from '../src/sim/day.ts';
import { hashBytes, roadCap475 } from '../src/sim/rules/commute.ts';
import { saveCode, loadCode, historyFormat } from '../src/io/save.ts';
import { paintGround, paintGroundInc, repaintTiles, groundKeys, overLevel, overTint, OVER_LEVELS } from '../src/render/ground.ts';
import { dayVariant } from './unit-d021.mjs';
import { loadMod } from './unit-d024.mjs';
import { rebuildCov } from '../src/sim/rules/fields.ts';
import { commitOp, undoOp } from '../src/sim/edit.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { d027Cities, oldList, oldzList, evolvedIds, CRAFTED_DAYS, OLD_DAYS, EVOLVE_DAYS, EVOLVED_DAYS } from './d027-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d027LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D027 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 本線這一天結束時的樣子，形狀跟樣本的 row 一樣
const clHash = s => { const a = []; for (const p of s.commuteClusters) { a.push(p.length); for (const j of p) a.push(j); } return hashBytes(Int32Array.from(a)); };
export function rowOf(s, rep) {
  const N = s.w.N, hs = []; let jc = 0;
  for (let i = 0; i < N * N; i++) {
    const t = s.w.tiles[i], b = t.bld;
    if (b && !b.ref && (b.k === 1 || b.k === 127)) hs.push(i, b.h);
    if (t.road && s.g.roadLoad[i] > roadCap475(t)) jc++;
  }
  return { day: s.day, pop: rep.pop, jobs: rep.jobs, happy: rep.cityHappy, agg: rep.happyAgg, ah: hashBytes(Float64Array.from(rep.happyAgg)), lg: [rep.econ.sn.logistics485.logisticsEfficiency, rep.econ.sn.logistics485.tradeCapacity], rl: hashBytes(s.g.roadLoad), cp: hashBytes(s.g.commutePenalty), cl: [s.commuteClusters.length, clHash(s)], ld: hashBytes(s.g.LAND), lb: hashBytes(s.g.LANDBASE), jc, nh: hs.length / 2, hh: hashBytes(new Float64Array(hs)), peek: s.rng.R(), hl: hs };
}
const FIELDS = ['day', 'pop', 'jobs', 'happy', 'ah', 'lg', 'rl', 'cp', 'cl', 'ld', 'lb', 'jc', 'nh', 'hh', 'peek'];
const NAMES = { rl: '道路負載', cp: '通勤懲罰', cl: '叢集路徑', ld: '動態地價', lb: '地價基準', jc: '過載道路格數', nh: '住宅棟數', hh: '住宅幸福', happy: '城市幸福', pop: '人口', jobs: '就業', peek: '下一個亂數（亂數次數或順序不同）', day: '日子', lg: '物流效率與貿易額度（壅堵扣分進經濟）', ah: '幸福構成（57 項城市平均的位元雜湊）' };

// 這一天要代進去的輸入（本線沒有的科技、專精；D028 起經濟段的也用它，另加 class2；夜間城市 D029、城市活動 D030、政策 D032 起本線自己算，不再代——政策是存檔裡的 pol，simFromSave 讀進來）：
// st＝目前有效的 tech／spec（樣本裡跟前一列一樣的不存，往前找最近一次記的；st.pol 只剩核對用：讀檔那一刻本線的 pol 要＝實驗線的）、row＝這一列。inject＝false 時專精也不代（玩家實際玩到的本線）。
// prev（前一列）以前給夜間城市用，現在沒用、簽名照舊（chart-d028 等呼叫端不必改）。副作用：把科技寫進 s.edu.tech。回 { hazard } 或 { err }
export function injectInputs(s, st, prev, row, inject) {
  const tech = JSON.parse(st.tech);
  if (!Array.isArray(tech) || tech.some(t => typeof t !== 'string')) return { err: `科技不是字串陣列：${st.tech}` };
  s.edu.tech = tech;
  const hazard = inject ? { spec: st.spec || null } : undefined;
  return { hazard };
}

// 一座城連推 rec.days 天，逐天跟實驗線比。mod＝day.ts（真的或改壞的）。inject＝false 時不代任何輸入（政策、夜間城市、城市活動都當沒有＝玩家實際玩到的本線）
// 回 { d: [不同處], days, first: 第一個不同的日子（0＝沒有）, parts: 第一個不同的日子裡幸福構成不同的項, fields: 任何一天不同的欄位鍵, firstFields: 第一個不同的日子裡不同的欄位鍵 }
// onDay(day, mine, row, rep, sim)：每天比完之後呼叫（拿本線當天的值做別的檢查，例如逐項幸福）
export function compareCity27(mod, code, rec, KT, vrank, { stopAtFirst = true, inject = true, onDay } = {}) {
  const r = decodeLabCode(code), s = mod.simFromSave(r.save, code, KT, vrank), d = [], out = { d, days: 0, first: 0, parts: [], fields: [], firstFields: [] };
  const pl = J(ensurePol(s.pol));   // D032：政策是存檔裡的 pol，本線自己讀——讀進來的要跟實驗線讀進來的一樣（逐欄、含順序）。實驗線讀檔之後 pol 已是補齊的物件（讀檔後不久 mayorEnsurePolicy470A 就建了，沒有 pol 的存檔也是），本線留著讀進來的樣子（沒有＝null，消費者都容錯、行為一樣）——兩邊都補齊再比
  if (pl !== rec.start.pol) return { ...out, d: [`讀檔後的政策 本線 ${pl.slice(0, 80)} ≠ 實驗線 ${String(rec.start.pol).slice(0, 80)}`], days: 0, first: 1 };
  let prev = rec.start;
  const st = { pol: rec.start.pol, tech: rec.start.tech, spec: rec.start.spec };   // 政策、科技、專精：樣本裡跟前一列一樣的不存（tools/d027-lab.mjs compactRows），往前找最近一次記的
  for (let day = 1; day <= rec.days; day++) {
    const row = rec.rows[day - 1], dd = [], ff = [];
    const inj = injectInputs(s, st, prev, row, inject);
    if (inj.err) return { ...out, d: [inj.err], days: day, first: day };
    const hz = inj.hazard;
    const rep = mod.stepDay(s, { hazard: hz });
    const mine = rowOf(s, rep);
    for (const k of FIELDS) if (J(mine[k]) !== J(row[k])) { dd.push(`${NAMES[k]} 本線 ${J(mine[k])} ≠ 實驗線 ${J(row[k])}`); ff.push(k); }
    if (row.agg && J(mine.agg) !== J(row.agg)) { const at = HAPPY_NAMES.filter((n, i) => J(mine.agg[i]) !== J(row.agg[i])); dd.push(`幸福構成的項不同：${at.join('、')}`); if (!out.first) out.parts = at; ff.push('agg'); }
    if (rec.rows[day - 1].hl && J(mine.hl) !== J(row.hl)) { const i = mine.hl.findIndex((v, q) => v !== row.hl[q]); dd.push(`住宅幸福清單第 ${i >> 1} 棟（格 ${row.hl[i & ~1]}）本線 ${mine.hl[i | 1]} ≠ 實驗線 ${row.hl[i | 1]}`); ff.push('hl'); }
    for (const k of ff) if (!out.fields.includes(k)) out.fields.push(k);
    onDay?.(day, mine, row, rep, s);
    prev = row; out.days = day; for (const k of ['pol', 'tech', 'spec']) if (row[k] !== undefined) st[k] = row[k];
    if (dd.length) { d.push(`第 ${day} 天：${dd.slice(0, 4).join('；')}`); if (!out.first) { out.first = day; out.firstFields = ff; } if (stopAtFirst) return out; }
  }
  return out;
}

async function guards(log) {
  const lab = JSON.parse(read('src/content/samples/d027-lab.json')), cities = d027Cities(), olds = oldList(), oldzs = oldzList();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, cities, KT, vrank });

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (J(lab.order) !== J(cities.map(c => c.id))) bad.push('樣本裡自造城的順序 ≠ tools/d027-cities.mjs 現在的順序（重跑 tools/d027-lab.mjs）');
    for (const c of cities) { const L = lab.crafted[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else { if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d027-lab.mjs）`); if (L.rows.length !== CRAFTED_DAYS) bad.push(`${c.id}：記了 ${L.rows.length} 天，要 ${CRAFTED_DAYS} 天`); } }
    if (J(lab.oldOrder) !== J(olds.map(c => c.id))) bad.push('樣本裡 D022–D025 城的順序 ≠ 現在的順序（重跑 tools/d027-lab.mjs）');
    for (const c of olds) { const L = lab.old?.[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同`); else if (L.rows.length !== OLD_DAYS) bad.push(`${c.id}：記了 ${L.rows.length} 天，要 ${OLD_DAYS} 天`); }
    for (const c of oldzs) { const L = lab.oldz?.[c.id]; if (!L) bad.push(`${c.id}（分區不清）：沒有記錄`); else if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}（分區不清）：本線產生的碼跟錄樣本時不同`); else if (L.rows.length !== OLD_DAYS) bad.push(`${c.id}（分區不清）：記了 ${L.rows.length} 天，要 ${OLD_DAYS} 天`); }
    for (const seed of STARTER_SEEDS) { const e = lab.evolve?.[seed]; if (!e || e.rows?.length !== EVOLVE_DAYS) bad.push(`起步城 ${seed} 的 ${EVOLVE_DAYS} 天軌跡不齊`); }
    for (const id of evolvedIds()) { const e = lab.evolved?.[id]; if (!e || e.rows?.length !== EVOLVED_DAYS) bad.push(`存檔 ${id}：沒有記錄或不是 ${EVOLVED_DAYS} 天`); }
    log(!bad.length, `D027 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；自造城 ${cities.length} 座連推 ${CRAFTED_DAYS} 天、D022–D025 的城 ${olds.length} 座連推 ${OLD_DAYS} 天、起步城 8 個種子 × ${EVOLVE_DAYS} 天軌跡、長出來的存檔 ${evolvedIds().length} 份連推 ${EVOLVED_DAYS} 天`,
      bad.slice(0, 4).join('；') || `crafted ${Object.keys(lab.crafted).length}、old ${Object.keys(lab.old).length}、evolve ${Object.keys(lab.evolve).length}、evolved ${Object.keys(lab.evolved).length}`);
    if (bad.length) return;
  }
  // ---- 2. 逐天對拍（驗收 3）----
  const d26 = JSON.parse(read('src/content/samples/d026-lab.json')), evolvedCode = id => { const [seed, dd] = id.split('@'); return d26.evolve[seed].codes[dd]; };
  const codeOf = id => cities.find(c => c.id === id).code;
  const runAll = (mod, opts) => {
    const rows = [];
    for (const c of cities) rows.push({ id: c.id, kind: 'crafted', ...compareCity27(mod, c.code, lab.crafted[c.id], KT, vrank, opts) });
    for (const c of olds) rows.push({ id: c.id, kind: 'old', ...compareCity27(mod, c.code, lab.old[c.id], KT, vrank, opts) });
    for (const c of oldzs) rows.push({ id: c.id, kind: 'oldz', ...compareCity27(mod, c.code, lab.oldz[c.id], KT, vrank, opts) });
    for (const id of evolvedIds()) rows.push({ id, kind: 'evolved', ...compareCity27(mod, evolvedCode(id), lab.evolved[id], KT, vrank, opts) });
    return rows;
  };
  const N = 72, ZERO = hashBytes(new Float32Array(N * N));
  const base = runAll(realDay, { stopAtFirst: false });
  LIVE.base = base;
  {
    const by = k => base.filter(x => x.kind === k), bad = k => by(k).filter(x => x.d.length);
    const days = k => by(k).reduce((a, x) => a + x.days, 0);
    // 覆蓋（量實驗線那邊的樣本：這些情況真的發生過，才有意義）：過載的道路格、叢集、通勤懲罰非零、動態地價跟基準不同、物流效率被壅堵拉低、四種重算相位
    const cov = { jc: 0, cl: 0, cp: 0, ld: 0, eff: 0, maxJc: 0, maxCl: 0 }, phase = {};
    for (const c of cities) {
      const L = lab.crafted[c.id]; let first = 0;
      L.rows.forEach((r, i) => { if (r.jc > 0) cov.jc++; if (r.cl[0] > 0) { cov.cl++; if (!first) first = i + 1; } if (r.cp !== ZERO) cov.cp++; if (r.ld !== r.lb) cov.ld++; if (r.lg[0] < L.rows[0].lg[0]) cov.eff++; cov.maxJc = Math.max(cov.maxJc, r.jc); cov.maxCl = Math.max(cov.maxCl, r.cl[0]); });
      phase[c.id] = first;
    }
    const NEED = { jc: 60, cl: 150, cp: 150, ld: 60, eff: 15, maxJc: 40, maxCl: 30 }, lack = Object.entries(NEED).filter(([k, v]) => cov[k] < v).map(([k, v]) => `${k} ${cov[k]}<${v}`);
    const ph = ['J4', 'J15', 'J16', 'J17'].map(id => phase[id]);
    if (J(ph) !== J([4, 3, 2, 1])) lack.push(`第一次重算的日子 J4／J15／J16／J17 要 4／3／2／1，實際 ${J(ph)}`);
    const errs = bad('crafted').map(x => `${x.id} ${x.d[0]}`);
    if (lack.length) errs.push(`覆蓋不夠：${lack.join('、')}`);
    log(!errs.length, `D027 驗收 3：實驗線頁面實跑（自造城）——J1–J17 讀進來連推 ${CRAFTED_DAYS} 天（第一次重算落在第 4／3／2／1 天；一小巷、支路、3–5 級路、高架與立交、橋、不可達、代表不可達、只有商業、沒有就業區、就業區沒接路、四種住宅類），每天逐項相等：道路負載整張（32 位元逐位）、通勤懲罰整張、叢集數與每條路徑、動態地價整張、地價基準整張、過載道路格數、每一棟住宅的幸福（64 位元浮點逐位）、幸福構成 57 項、物流效率與貿易額度、城市幸福、人口與就業、下一個亂數（這一天用掉的亂數次數與順序）`,
      errs.slice(0, 4).join('｜') || `${by('crafted').length} 座、${days('crafted')} 個城日全等；實驗線這邊：過載路格的城日 ${cov.jc}（單日最多 ${cov.maxJc} 格）、有叢集的城日 ${cov.cl}（單日最多 ${cov.maxCl} 條）、通勤懲罰非零 ${cov.cp}、動態地價≠基準 ${cov.ld}、物流效率被壅堵拉低 ${cov.eff}；第一次重算 ${ph.join('／')}`);
  }
  // 幸福有關的欄位（本線與實驗線差在這幾個、其他欄位全等＝差只在幸福的加減，不是模擬的別處）
  const HK = ['happy', 'ah', 'hh'];
  {
    // D022–D025 的 120 座城（分區清成 0＝不會長新房子）連推 10 天：118 座每一天每一欄全等；2 座只差幸福，差在哪一項＝哪個系統沒搬（oldx 是這幾座另存的逐項幸福）
    // D027 收工時是 3 座；G14（差在熟食供應 +.005，T346 cookedReady）由 D028 補上、seed516（差在微光之巔 +.02，T133 城市等級）由 D031 補上，從名單拿掉，下面另有一段正向檢查證明它們現在整條全等
    const KNOWN = {
      D3: { part: null, why: '幸福構成 57 項全等，差在 55420 那一步：污水廠（k27）與管網 SEW_OK442 讓接上管網的住宅每座近旁工業加 .025（T442 污水沒搬，D029）' },
    };
    const rows = base.filter(x => x.kind === 'old'), bad = rows.filter(x => x.d.length), errs = [];
    for (const x of bad) {
      const k = KNOWN[x.id];
      if (!k) { errs.push(`${x.id} 不在已知名單：${x.d[0].slice(0, 140)}`); continue; }
      const off = x.fields.filter(f => !HK.includes(f));
      if (off.length) errs.push(`${x.id} 除了幸福還有別的欄位不同：${off.join('、')}（${x.d[0].slice(0, 100)}）`);
    }
    // 逐項歸因：第一個不同的日子裡，幸福構成不同的項要剛好是那一項（D3 沒有：57 項全等）
    const why = [];
    for (const [id, k] of Object.entries(KNOWN)) {
      const rec = lab.oldx?.[id], c = olds.find(q => q.id === id);
      if (!rec || rec.codeHash !== fnv1a(c.code) || rec.rows.length !== OLD_DAYS) { errs.push(`${id}：oldx 記錄不齊（重跑 tools/d027-lab.mjs --part=oldx）`); continue; }
      const r = compareCity27(realDay, c.code, rec, KT, vrank, { stopAtFirst: false });
      const wantParts = k.part ? [k.part] : [], wantF = k.part ? ['happy', 'ah', 'hh', 'agg'] : ['happy', 'hh'];
      if (!r.first) errs.push(`${id}：這一次沒有差了（本線補了這個系統？把它從已知名單拿掉）`);
      else if (J(r.parts) !== J(wantParts) || r.firstFields.some(f => !wantF.includes(f))) errs.push(`${id} 第 ${r.first} 天：幸福構成不同的項 ${J(r.parts)}（要 ${J(wantParts)}）、不同的欄位 ${r.firstFields.join('、')}`);
      else why.push(`${id} 第 ${r.first} 天起：${k.part ?? '（57 項全等）'}`);
    }
    // D028：G14 的熟食供應（T346）搬了——D027 錄的逐項幸福（oldx，57 項＋每一棟住宅）現在要逐位相等
    {
      const rec = lab.oldx?.G14, c = olds.find(q => q.id === 'G14');
      if (!rec || rec.codeHash !== fnv1a(c.code) || rec.rows.length !== OLD_DAYS) errs.push('G14：oldx 記錄不齊（重跑 tools/d027-lab.mjs --part=oldx）');
      else { const r = compareCity27(realDay, c.code, rec, KT, vrank, { stopAtFirst: false }); if (r.first) errs.push(`G14 第 ${r.first} 天還有差（D028 已搬熟食供應）：${r.d[0].slice(0, 160)}`); else why.push('G14 整條全等（57 項幸福構成與每一棟住宅；D028 補了熟食供應）'); }
    }
    // D031：seed516 的城市等級（T133）搬了——讀進來就在 Lv.26（rk 原樣還原），住宅幸福的「微光之巔」+.02 補上，D027 錄的逐項幸福（oldx）現在要逐位相等
    {
      const rec = lab.oldx?.seed516, c = olds.find(q => q.id === 'seed516');
      if (!rec || rec.codeHash !== fnv1a(c.code) || rec.rows.length !== OLD_DAYS) errs.push('seed516：oldx 記錄不齊（重跑 tools/d027-lab.mjs --part=oldx）');
      else { const r = compareCity27(realDay, c.code, rec, KT, vrank, { stopAtFirst: false }); if (r.first) errs.push(`seed516 第 ${r.first} 天還有差（D031 已搬城市等級）：${r.d[0].slice(0, 160)}`); else why.push('seed516 整條全等（57 項幸福構成與每一棟住宅；D031 補了城市等級）'); }
    }
    if (rows.length !== olds.length) errs.push(`old 只有 ${rows.length} 座`);
    log(!errs.length, 'D027 驗收 3：實驗線頁面實跑（D022–D025 的 120 座城，分區清成 0）——連推 10 天，逐天逐欄跟實驗線比：全等的城要每一欄全等；有差的城只准差在幸福（城市幸福、每一棟住宅的幸福、幸福構成）、而且差在哪一項要剛好是那個沒搬的系統（污水管網＝T442；oldx 逐項；D027 收工時還有熟食供應＝T346〔D028 補上，G14 整條全等〕與微光之巔＝T133 城市等級〔D031 補上，seed516 整條全等〕）',
      errs.slice(0, 4).join('｜') || `${rows.length} 座、${rows.reduce((a, x) => a + x.days, 0)} 個城日：${rows.length - bad.length} 座每一欄全等、${bad.length} 座只差幸福（${why.join('；')}）`);
  }
  {
    const rows = base.filter(x => x.kind === 'evolved'), bad = rows.filter(x => x.d.length);
    log(!bad.length && rows.length === evolvedIds().length, `D027 驗收 3：實驗線頁面實跑（起步城第 30、70、110 天的實驗線存檔 24 份，帶分區、會長新房子，連推 ${EVOLVED_DAYS} 天；第 37、74、111 天的城市活動落在窗口裡）——整條 tick 鏈逐天逐欄全等（生長與升級的擲骰用掉的亂數次數與順序也對得上）`,
      bad.slice(0, 4).map(x => `${x.id} ${x.d[0].slice(0, 140)}`).join('｜') || `${rows.length} 份、${rows.reduce((a, x) => a + x.days, 0)} 個城日全等`);
  }
  {
    // 同一批 120 座城，分區不清（生長、升級、廢棄、亂數全在跑：整條 tick 鏈）：一樣 118 座每一欄每一天全等，一樣那 2 座只差幸福（D028 起 G14 全等）
    const rows = base.filter(x => x.kind === 'oldz'), bad = rows.filter(x => x.d.length), errs = [];
    for (const x of bad) {
      if (!['D3'].includes(x.id)) errs.push(`${x.id} 不在已知名單：${x.d[0].slice(0, 140)}`);
      else if (x.fields.some(f => !HK.includes(f))) errs.push(`${x.id} 除了幸福還有別的欄位不同：${x.fields.join('、')}（${x.d[0].slice(0, 100)}）`);
    }
    // 覆蓋：實驗線那邊真的長了東西（住宅棟數增加的城、人口變的城），不然「分區不清」跟「清成 0」沒有差別
    const grew = rows.filter(x => { const L = lab.oldz[x.id].rows; return L.at(-1).nh > L[0].nh; }).length, popMoved = rows.filter(x => { const L = lab.oldz[x.id].rows; return L.at(-1).pop !== L[0].pop; }).length;
    const rngMoved = rows.filter(x => J(lab.oldz[x.id].rows.map(r => r.peek)) !== J(lab.old[x.id].rows.map(r => r.peek))).length, newHouses = rows.reduce((a, x) => { const L = lab.oldz[x.id].rows; return a + L.at(-1).nh - L[0].nh; }, 0);
    if (grew < 8 || popMoved < 30 || rngMoved < 8) errs.push(`覆蓋不夠：住宅棟數增加的城 ${grew}（要 ≥ 8）、人口有變的城 ${popMoved}（要 ≥ 30）、亂數流跟分區清成 0 那批不同的城 ${rngMoved}（要 ≥ 8；不同＝生長與升級的擲骰真的跑了）`);
    if (rows.length !== oldzs.length) errs.push(`oldz 只有 ${rows.length} 座`);
    log(!errs.length, 'D027 驗收 3：實驗線頁面實跑（D022–D025 的 120 座城，分區不清——會長新房子、升級、廢棄，亂數全在跑）——連推 10 天：整條 tick 鏈逐天逐欄跟實驗線比，跟分區清成 0 那批一樣：118 座每一欄全等、只有那 2 座只差幸福',
      errs.slice(0, 4).join('｜') || `${rows.length} 座、${rows.reduce((a, x) => a + x.days, 0)} 個城日：${rows.length - bad.length} 座每一欄全等（實驗線那邊 ${grew} 座長了新住宅〔共 ${newHouses} 棟〕、${popMoved} 座人口有變、${rngMoved} 座的亂數流跟分區清成 0 那批不同）、${bad.length} 座只差幸福（${bad.map(x => x.id).join('、')}）`);
  }

  // ---- 3. 起步城 8 個種子 × 120 天（驗收 7）：整城軌跡。兩種跑法——(a) 逐天代入實驗線的三樣輸入（夜間城市、城市活動、政策；跟上面一樣），要逐日逐欄全等；(b) 什麼都不代（玩家實際玩到的本線），跟實驗線做統計比對（規則 8）----
  {
    const startCode = read('src/content/samples/starter.code.txt').trim();
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length, sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
    const per = [];
    for (const seed of STARTER_SEEDS) {
      const code = codeWithSeed(startCode, seed), rec = lab.evolve[seed];
      const inj = compareCity27(realDay, code, rec, KT, vrank, { stopAtFirst: false });
      const s = realDay.simFromSave(decodeLabCode(code).save, code, KT, vrank), nat = [];
      for (let d = 0; d < EVOLVE_DAYS; d++) nat.push(rowOf(s, realDay.stepDay(s)));
      per.push({ seed, inj, nat, rec });
    }
    LIVE.traj = per;
    // (a) 代入實驗線輸入
    {
      const bad = per.filter(p => p.inj.d.length);
      log(!bad.length, `D027 驗收 7：起步城 8 個種子 × ${EVOLVE_DAYS} 天（逐天代入實驗線的夜間城市、城市活動與政策，其餘全是本線自己算）——道路負載、通勤懲罰、叢集路徑、動態地價、每一棟住宅的幸福、幸福構成、人口、就業、物流效率、下一個亂數，${EVOLVE_DAYS} 天每一天每一欄逐位元全等`,
        bad.slice(0, 3).map(p => `${p.seed} 第 ${p.inj.first} 天：${p.inj.d[0].slice(0, 160)}`).join('｜') || `${per.length} 個種子 × ${EVOLVE_DAYS} 天＝${per.length * EVOLVE_DAYS} 個城日全等（人口第 ${EVOLVE_DAYS} 天 ${per.map(p => p.rec.rows.at(-1).pop).join('、')}）`);
    }
    // (b) 玩家實際玩到的本線（不代任何輸入）
    const first = (p, k) => { for (let d = 0; d < p.nat.length; d++) if (J(p.nat[d][k]) !== J(p.rec.rows[d][k])) return d + 1; return 0; };
    const FK = ['rl', 'cp', 'cl', 'jc', 'ld', 'pop', 'jobs', 'nh', 'peek', 'happy'];
    const fd = Object.fromEntries(FK.map(k => [k, per.map(p => first(p, k))]));
    const stat = (get, day) => { const pm = per.map(p => get(p.nat[day - 1])), lm = per.map(p => get(p.rec.rows[day - 1])), se = Math.sqrt((sd(pm) ** 2 + sd(lm) ** 2) / per.length); return { pm: mean(pm), lm: mean(lm), diff: mean(pm) - mean(lm), se, t: se > 0 ? (mean(pm) - mean(lm)) / se : 0 }; };
    LIVE.stat = stat;
    const DAYS = [30, 60, 90, 120], errs = [], seeds = per.length;
    const SERIES = [['幸福', r => r.happy, 2], ['人口', r => r.pop, 3], ['就業', r => r.jobs, 3], ['住宅棟數', r => r.nh, 3], ['過載道路格', r => r.jc, 3], ['通勤叢集數', r => r.cl[0], 3]];
    const line = [];
    for (const [name, get, tmax] of SERIES) {
      const xs = DAYS.map(d => stat(get, d));
      for (let q = 0; q < DAYS.length; q++) if (Math.abs(xs[q].t) >= tmax) errs.push(`${name} 第 ${DAYS[q]} 天 本線 ${xs[q].pm.toFixed(3)} 實驗線 ${xs[q].lm.toFixed(3)}（t＝${xs[q].t.toFixed(2)} ≥ ${tmax}）`);
      line.push(`${name} ${xs.map(x => `${x.pm.toFixed(name === '幸福' ? 3 : 1)}／${x.lm.toFixed(name === '幸福' ? 3 : 1)}`).join('、')}（t ${xs.map(x => x.t.toFixed(2)).join('、')}）`);
    }
    // 幸福構成逐項（8 種子平均，第 30、60、90、120 天）：差在 3 倍標準誤加 .004 內（夜間城市 D029 起本線自己算，跟其他 56 項一樣判）
    const partRows = [];
    for (let i = 0; i < HAPPY_NAMES.length; i++) {
      const name = HAPPY_NAMES[i], xs = DAYS.map(d => stat(r => r.agg[i], d));
      for (let q = 0; q < DAYS.length; q++) if (Math.abs(xs[q].diff) > 3 * xs[q].se + .004) errs.push(`${name} 第 ${DAYS[q]} 天 本線 ${xs[q].pm.toFixed(4)} ≠ 實驗線 ${xs[q].lm.toFixed(4)}（差 ${xs[q].diff.toFixed(4)} > 3 倍標準誤 ${(3 * xs[q].se).toFixed(4)} ＋ .004）`);
      partRows.push(xs);
    }
    // 逐日相等到第幾天（本線自然跑 vs 實驗線）：記錄，並訂地板（比 D026 的 11–23 天好很多，別退回去）
    const equalAll = k => fd[k].filter(v => !v).length, minFirst = k => Math.min(...fd[k].filter(v => v));
    if (equalAll('rl') < 5 || minFirst('rl') < 30 || equalAll('pop') < 5 || minFirst('pop') < 30) errs.push(`逐日相等：道路負載全程相等 ${equalAll('rl')} 個種子（要 ≥ 5）、最早分歧 ${minFirst('rl')}（要 ≥ 30）；人口全程相等 ${equalAll('pop')} 個種子、最早分歧 ${minFirst('pop')}`);
    const busy = per.filter(p => p.rec.rows.at(-1).jc > 0).length;
    if (busy < 6) errs.push(`實驗線那邊第 ${EVOLVE_DAYS} 天有過載道路的種子只有 ${busy} 個（要 ≥ 6：不然比的是空的）`);
    log(!errs.length, `D027 驗收 7：起步城 8 個種子 × ${EVOLVE_DAYS} 天整城軌跡（玩家實際玩到的本線：城市活動、政策都沒有；夜間城市 D029 起本線自己算）對實驗線——第 30、60、90、120 天的 8 種子平均：幸福 |t| < 2、人口、就業、住宅棟數、過載道路格、通勤叢集數 |t| < 3；幸福構成 57 項逐項差在 3 倍標準誤加 .004 內；逐日相等到第幾天照實記並訂地板`,
      errs.slice(0, 5).join('｜') || `${line.join('；')}｜逐日全等到第 ${EVOLVE_DAYS} 天的種子（道路負載 ${equalAll('rl')}、通勤懲罰 ${equalAll('cp')}、叢集 ${equalAll('cl')}、動態地價 ${equalAll('ld')}、人口 ${equalAll('pop')}、就業 ${equalAll('jobs')}、住宅棟數 ${equalAll('nh')}、亂數 ${equalAll('peek')}、幸福 ${equalAll('happy')}），第一個分歧日（種子順序）：道路負載 ${fd.rl.map(v => v || '—').join('／')}、人口 ${fd.pop.map(v => v || '—').join('／')}、亂數 ${fd.peek.map(v => v || '—').join('／')}、幸福 ${fd.happy.map(v => v || '—').join('／')}`);
  }

  const ctx = { lab, cities, olds, oldzs, KT, vrank, evolvedCode };
  await wiringGuards(log, ctx);
  await persistGuards(log, ctx);
  await renderGuards(log, ctx);
  await rebuildGuards(log, ctx);
}

// ---- 4. 接線（驗收 4）：day.ts 的副本改壞一處，這批要紅 ----
// 一種是「實驗線頁面實跑對不上」（lab）：J1、J4、J8、J9、J10、J14、J17 各連推 13 天＋起步城存檔 3 份連推 12 天，隨便一項不同就算抓到；
// 另一種是「雜湊不看」（hash）：道路負載、通勤懲罰、叢集路徑各改一格，simHash 要變（決定性守衛靠它）。
export async function wiringGuards(log, { lab, cities, olds, KT, vrank, evolvedCode }) {
  // SUBO：D022–D025 的城裡有電視台的（gallery、E7）與有社宅的（F13）——電視訊號、社宅財富級只有它們看得到
  const SUBC = ['J1', 'J4', 'J8', 'J9', 'J10', 'J14', 'J17'], SUBE = [`${STARTER_SEEDS[0]}@30`, `${STARTER_SEEDS[1]}@70`, `${STARTER_SEEDS[2]}@110`].filter(id => lab.evolved?.[id]), SUBO = ['gallery', 'E7', 'F13'].filter(id => lab.old?.[id]);
  const codeOf = id => cities.find(c => c.id === id).code, oldCode = id => olds.find(c => c.id === id).code;
  const dayBad = mod => {
    try {
      for (const id of SUBC) { const r = compareCity27(mod, codeOf(id), lab.crafted[id], KT, vrank); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; }
      for (const id of SUBE) { const r = compareCity27(mod, evolvedCode(id), lab.evolved[id], KT, vrank); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; }
      for (const id of SUBO) { const r = compareCity27(mod, oldCode(id), lab.old[id], KT, vrank); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; }
    } catch (e) { return `丟例外 ${e.message.slice(0, 60)}`; }
    return null;
  };
  const hashBad = mod => {
    const c = codeOf('J1'), r = decodeLabCode(c), fresh = () => mod.simFromSave(r.save, c, KT, vrank), s0 = fresh(), base = mod.simHash(s0);
    let road = -1, house = -1;
    for (let i = 0; i < s0.w.tiles.length; i++) { const t = s0.w.tiles[i]; if (road < 0 && t.road) road = i; if (house < 0 && t.bld && t.bld.k === 1) house = i; }
    const tests = { 道路負載: q => { q.g.roadLoad[road] = 1.5; }, 通勤懲罰: q => { q.g.commutePenalty[house] = .123; }, 叢集路徑: q => { q.commuteClusters = [[1, 2, 3]]; }, 電視訊號: q => { q.tvSignal = true; } };
    const blind = Object.entries(tests).filter(([, f]) => { const q = fresh(); f(q); return mod.simHash(q) === base; }).map(([k]) => k);
    return blind.length ? `雜湊不看：${blind.join('、')}` : null;
  };
  const V0 = await dayVariant([]);
  // [名稱, 改哪裡, 誰要抓到]
  const MUT = [
    ['通勤與道路負載整段不跑', [['s.commuteClusters = trafficStep(s.day, w, g, s.commuteClusters, tickBld);', 'void trafficStep;']], 'lab'],
    ['重算週期差一天', [['trafficStep(s.day, w, g, s.commuteClusters, tickBld)', 'trafficStep(s.day + 1, w, g, s.commuteClusters, tickBld)']], 'lab'],
    ['叢集路徑每天清掉（沒重算的日子沒有車流）', [['trafficStep(s.day, w, g, s.commuteClusters, tickBld)', 'trafficStep(s.day, w, g, [], tickBld)']], 'lab'],
    ['通勤重算只看前 10 個建築格（索引傳錯）', [['trafficStep(s.day, w, g, s.commuteClusters, tickBld)', 'trafficStep(s.day, w, g, s.commuteClusters, tickBld.slice(0, 10))']], 'lab'],
    ['壅堵計數每天不更新', [['  jamCounts(w, g.roadLoad, g.jam);\n', '']], 'lab'],
    ['動態地價不算', [['  recomputeLandDynamic(g);', '']], 'lab'],
    ['住宅幸福讀不到壅堵（jam 恆 0）', [['jam: g.jam[i],', 'jam: 0,']], 'lab'],
    ['住宅幸福讀不到通勤懲罰', [['commutePenalty: g.commutePenalty[i],', 'commutePenalty: 0,']], 'lab'],
    ['經濟讀不到道路負載統計', [['roadStats: x2?.roadStats ?? roadStatsOf(w, tickRoad, g.roadLoad),', 'roadStats: x2?.roadStats,']], 'lab'],
    ['道路格數當 0（貿易額度的底）', [['const roads = tickRoad.length;', 'const roads = 0;']], 'lab'],
    ['幸福構成不加總', [['for (let k = 0; k < hp.parts.length; k++) aggSum[k] = (aggSum[k] ?? 0) + hp.parts[k];', '']], 'lab'],
    ['幸福構成除以錯的數', [['aggSum.map(v => v / happyN)', 'aggSum.map(v => v / nn)']], 'lab'],
    ['夜間城市不餵幸福', [['nightCity: hzx.nightCity ?? NIGHT_OFF,', 'nightCity: NIGHT_OFF,']], 'lab'],
    ['城市活動不餵幸福', [['eventHappy: opts.hazard?.eventHappy ?? (evd ? evd.happy : null),', 'eventHappy: opts.hazard?.eventHappy ?? null,']], 'lab'],
    ['讀檔後叢集不是空的', [['commuteClusters: [], commuteDay: -1,', 'commuteClusters: [[0]], commuteDay: -1,']], 'lab'],
    ['電視訊號不留到明天（一律 false）', [['tvSignal: s.tvSignal, tech: s.edu.tech,', 'tvSignal: false, tech: s.edu.tech,']], 'lab'],
    ['電視訊號讀今天的電視台數（不是昨天的）', [['tvSignal: s.tvSignal, tech: s.edu.tech,', 'tvSignal: fc.tv330 > 0, tech: s.edu.tech,']], 'lab'],
    ['電視訊號不更新', [['  s.tvSignal = fc.tv330 > 0; ', '  void 0; ']], 'lab'],
    ['社宅的財富級不還原', [['    if (k === 127) bld.we = 0; ', '    if (k === 127) void 0; ']], 'lab'],
    ['雜湊不看道路負載', [['hashBytes(s.g.roadLoad), hashBytes(s.g.commutePenalty), s.commuteClusters, s.tvSignal,', 'hashBytes(s.g.commutePenalty), s.commuteClusters, s.tvSignal,']], 'hash'],
    ['雜湊不看通勤懲罰', [['hashBytes(s.g.roadLoad), hashBytes(s.g.commutePenalty), s.commuteClusters, s.tvSignal,', 'hashBytes(s.g.roadLoad), s.commuteClusters, s.tvSignal,']], 'hash'],
    ['雜湊不看叢集路徑', [['hashBytes(s.g.roadLoad), hashBytes(s.g.commutePenalty), s.commuteClusters, s.tvSignal,', 'hashBytes(s.g.roadLoad), hashBytes(s.g.commutePenalty), s.tvSignal,']], 'hash'],
    ['雜湊不看電視訊號', [['hashBytes(s.g.roadLoad), hashBytes(s.g.commutePenalty), s.commuteClusters, s.tvSignal,', 'hashBytes(s.g.roadLoad), hashBytes(s.g.commutePenalty), s.commuteClusters,']], 'hash'],
  ];
  const bad = [], out = [], base0 = [dayBad(V0), hashBad(V0)].filter(Boolean);
  if (base0.length) bad.push(`沒改的副本就有不對：${base0.join('｜')}`);
  for (const [name, edits, who] of MUT) {
    let V; try { V = await dayVariant(edits); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    const why = who === 'lab' ? dayBad(V) : hashBad(V);
    out.push(`${name}：${why ? (who === 'lab' ? '對拍' : '雜湊') + '（' + why.slice(0, 44) + '）' : '沒抓到'}`);
    if (!why) bad.push(`「${name}」沒抓到（要由${who === 'lab' ? '實驗線對拍' : '雜湊'}抓）`);
  }
  log(!bad.length, `D027 驗收 4：接線——day.ts 的副本改壞一處（${MUT.length} 個：通勤與負載整段不跑、重算週期差一天、叢集每天清掉、壅堵計數不更新、動態地價不算、幸福讀不到壅堵與通勤、經濟讀不到道路負載統計、道路格數、幸福構成的加總與分母、夜間城市與城市活動的輸入、讀檔叢集不清、電視訊號的三種接法、社宅財富級、雜湊看道路負載與通勤懲罰與叢集與電視訊號），這批要紅；沒改的先核過全等`,
    bad.slice(0, 5).join('；') || out.join('；'));
}

// ---- 5. 存檔與決定性（驗收 5）----
export async function persistGuards(log, { cities, KT, vrank }) {
  const bad = [], N = 72, seen = { loads: 0, days: 0, trips: 0, fresh: 0, keys: 0 };
  const codeOf = id => cities.find(c => c.id === id).code;
  const zeroed = (s, what) => {
    const z = [];
    if (s.g.roadLoad.some(v => v !== 0)) z.push('道路負載');
    if (s.g.roadPass.some(v => v !== 0)) z.push('路徑累加器');
    if (s.g.commutePenalty.some(v => v !== 0)) z.push('通勤懲罰');
    if (s.g.jam.some(v => v !== 0)) z.push('壅堵計數');
    if (s.commuteClusters.length !== 0) z.push('叢集');
    if (s.commuteDay !== -1) z.push('最近重算日');
    if (!s.g.LAND.every((v, i) => v === s.g.LANDBASE[i])) z.push('動態地價≠基準');
    return z.length ? `${what}：${z.join('、')}不是零／空` : null;
  };
  for (const id of ['J1', 'J4', 'J8', 'J10', 'J17']) {
    const c = codeOf(id), L = loadCode(c, KT, vrank);
    if (!L.ok) { bad.push(`${id}：讀不進 ${L.error}`); continue; }
    const sm = L.sim; let w = zeroed(sm, `${id} 剛讀進來`); if (w) bad.push(w); seen.loads++;
    // 第一個 4 的倍數的日子才有通勤路徑、負載與懲罰：讀進來的日子 D，第一次重算在 D+1…D+4 裡 4 的倍數那一天
    const d0 = sm.day, firstRefresh = d0 + 4 - (d0 % 4);
    let seenLoad = 0;
    for (let d = 1; d <= 6; d++) {
      realDay.stepDay(sm); seen.days++;
      const has = sm.commuteClusters.length > 0 || sm.g.roadLoad.some(v => v > 0) || sm.g.commutePenalty.some(v => v > 0);
      if (sm.day < firstRefresh && has) bad.push(`${id} 第 ${sm.day} 天（第一次重算要到第 ${firstRefresh} 天）就有叢集、負載或懲罰`);
      if (sm.day === firstRefresh && !has) bad.push(`${id} 第 ${sm.day} 天（第一次重算）沒有叢集、負載或懲罰`);
      if (has) seenLoad++;
      if (sm.day === firstRefresh && sm.commuteDay !== firstRefresh) bad.push(`${id} 第 ${sm.day} 天重算了但 commuteDay＝${sm.commuteDay}`);
    }
    if (!seenLoad) bad.push(`${id} 推 6 天沒有出現過負載（測試沒有意義）`);
    // 存檔：沒有新欄位、城市格式照舊規則（有災禍事件才 6）；再讀回來全零
    // 存檔的欄位：推了 6 天（有通勤、有負載）之後存的碼，欄位集合＝剛讀進來就存的碼（負載與路徑不會漏進存檔）；d3 的欄位都是已知的；沒有名字像負載、通勤、壅堵的欄位
    const L0 = loadCode(c, KT, vrank), raw00 = decodeLabCode(saveCode(L0.sim, L0.template, L0.start)).save.raw, code = saveCode(sm, L.template, L.start), raw1 = decodeLabCode(code).save.raw;
    const extra = Object.keys(raw1).filter(k => !(k in raw00)), gone = Object.keys(raw00).filter(k => !(k in raw1)), d3ok = Object.keys(raw1.d3 ?? {}).every(k => ['f', 's', 'g', 'hv', 'r', 'h', 'j', 't'].includes(k));
    if (extra.length || gone.length || !d3ok || Object.keys(raw1).some(k => /load|commute|jam|clus|traffic/i.test(k))) bad.push(`${id} 存檔的欄位跟剛讀進來就存的不同：多 ${extra.join('、') || '無'}、少 ${gone.join('、') || '無'}｜d3 欄位 ${Object.keys(raw1.d3 ?? {}).join('、')}`);
    seen.keys = Object.keys(raw1).length;
    const h = sm.city.history, hz = h.some(e => ['fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act'].includes(e.t));
    if (hz ? historyFormat(h) !== 6 || raw1.d3.f !== 6 : historyFormat(h) > 5 || raw1.d3.f > 5) bad.push(`${id} 城市格式 ${raw1.d3.f}（有災禍事件要 6、沒有不能寫 6）`);
    const q = loadCode(code, KT, vrank);
    if (!q.ok || !q.replayed) bad.push(`${id} 存了再讀回失敗：${q.ok ? q.note : q.error}`);
    else { w = zeroed(q.sim, `${id} 第 ${sm.day} 天存檔再讀回來`); if (w) bad.push(w); seen.trips++; }
  }
  // 決定性：同一座城讀兩次各推 13 天，每天雜湊與整列記錄相同（J1、J8）；存檔再讀兩次也一樣
  for (const id of ['J1', 'J8']) {
    const a = loadCode(codeOf(id), KT, vrank).sim, b = loadCode(codeOf(id), KT, vrank).sim;
    for (let d = 1; d <= 13; d++) { const ra = realDay.stepDay(a), rb = realDay.stepDay(b); if (realDay.simHash(a) !== realDay.simHash(b) || J(rowOf(a, ra)) !== J(rowOf(b, rb))) { bad.push(`${id} 同一張碼讀兩次、第 ${d} 天不同`); break; } }
    const L = loadCode(codeOf(id), KT, vrank), s5 = L.sim; for (let d = 0; d < 5; d++) realDay.stepDay(s5);
    const code5 = saveCode(s5, L.template, L.start), a2 = loadCode(code5, KT, vrank).sim, b2 = loadCode(code5, KT, vrank).sim;
    for (let d = 1; d <= 8; d++) { realDay.stepDay(a2); realDay.stepDay(b2); if (realDay.simHash(a2) !== realDay.simHash(b2)) { bad.push(`${id} 第 5 天的存檔讀兩次、之後第 ${d} 天雜湊不同`); break; } }
    seen.fresh++;
  }
  log(!bad.length, 'D027 驗收 5：存檔——通勤與壅堵不進存檔（沒有新欄位、d3 欄位照舊、城市格式照 D026 規則）；讀檔與存了再讀後負載、路徑累加器、通勤懲罰、壅堵計數、叢集全零、動態地價＝基準；第一個 4 的倍數的日子之前沒有通勤路徑與負載；同一張碼讀兩次、存檔讀兩次，每天雜湊與整列記錄逐日相同',
    bad.slice(0, 4).join('；') || `${seen.loads} 座城讀檔全零、共推 ${seen.days} 個城日、存檔欄位 ${seen.keys} 個（推 6 天前後相同）、存讀檔 ${seen.trips} 次、決定性 ${seen.fresh} 座×（13 天＋存檔後 8 天）`);
}

// ---- 6. 地面貼圖的輸入（渲染層純函式，驗收 6 的 Node 半邊；瀏覽器半邊在 tools/smoke-d027.mjs）----
export async function renderGuards(log, { cities, KT, vrank }) {
  const bad = [], N = 72, S = 8, cat = k => KT.cat(k);
  let seenRepaint = 0;
  const L = loadCode(cities.find(c => c.id === 'J1').code, KT, vrank), sm = L.sim;
  for (let d = 0; d < 8; d++) realDay.stepDay(sm);
  const city = sm.city, plain = paintGround(city, cat, S), zero = paintGround({ ...city, over: new Uint8Array(N * N) }, cat, S);
  if (Buffer.compare(Buffer.from(plain), Buffer.from(zero))) bad.push('over 全 0 的貼圖跟沒給 over 的不一樣');
  // overLevel 的邊界
  const lv = [overLevel(0, 2), overLevel(2, 2), overLevel(2.0001, 2), overLevel(3, 2), overLevel(4, 2), overLevel(4.5, 2), overLevel(1e9, 2), overLevel(NaN, 2)];
  if (J(lv) !== J([0, 0, 1, 4, 7, 7, 7, 0])) bad.push(`overLevel 邊界 ${J(lv)}（要 [0,0,1,4,7,7,7,0]）`);
  // 每一檔的顏色（實驗線 60574：rgb(255, 210−170r, 40−40r)、透明度 .16＋.34r；r 是各檔的起點）
  const tints = Array.from({ length: OVER_LEVELS }, (_, q) => overTint(q + 1));
  if (tints[0].alpha !== .16 || Math.abs(tints[OVER_LEVELS - 1].alpha - .5) > 1e-12 || tints[0].color !== 0xffd228 || tints[OVER_LEVELS - 1].color !== 0xff2800) bad.push(`暖色的頭尾 ${tints[0].color.toString(16)}／${tints[0].alpha}、${tints[OVER_LEVELS - 1].color.toString(16)}／${tints[OVER_LEVELS - 1].alpha}`);
  for (let q = 1; q < OVER_LEVELS; q++) if (!(tints[q].alpha > tints[q - 1].alpha) || !(((tints[q].color >> 8) & 255) < ((tints[q - 1].color >> 8) & 255))) bad.push(`第 ${q + 1} 檔沒有比第 ${q} 檔更紅更濃`);
  // 決定性地給每個路格一個等級（含非路格：非路格不能被染）
  const over = new Uint8Array(N * N); let roadN = 0, offRoad = 0;
  for (let i = 0; i < N * N; i++) { const q = (i * 2654435761 >>> 0) % 9; over[i] = q > OVER_LEVELS ? 0 : q; if (over[i] && city.road[i]) roadN++; if (over[i] && !city.road[i]) offRoad++; }
  const tinted = paintGround({ ...city, over }, cat, S), mixC = (a, b, t) => { const ch = sh => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
  let wrong = 0, moved = 0, still = 0, stillWrong = 0;
  for (let i = 0; i < N * N; i++) {
    const x = i % N, z = (i / N) | 0, ov = city.road[i] ? over[i] : 0;
    for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
      const p = ((z * S + v) * N * S + x * S + u) * 4, base = (plain[p] << 16) | (plain[p + 1] << 8) | plain[p + 2], got = (tinted[p] << 16) | (tinted[p + 1] << 8) | tinted[p + 2];
      const want = ov ? mixC(base, overTint(ov).color, overTint(ov).alpha) : base;
      if (got !== want) { if (ov) wrong++; else stillWrong++; }
      if (ov) moved += got !== base ? 1 : 0; else still++;
    }
  }
  if (wrong || stillWrong || !roadN || !offRoad || !moved) bad.push(`逐像素：上色的格 ${wrong} 個像素不等於公式、沒上色的格 ${stillWrong} 個像素被動到（路格 ${roadN}、非路格帶等級 ${offRoad}、染到的像素 ${moved}）`);
  // 鍵：等級進鍵、非路格的等級不進鍵、同輸入同鍵
  const cityQ = q => ({ ...city, over: q }), [k1a] = groundKeys(cityQ(over), cat), [k1b] = groundKeys(cityQ(over.slice()), cat), [k1p] = groundKeys(city, cat);
  let keyDiff = 0, keyOff = 0; for (let i = 0; i < N * N; i++) { if (city.road[i] && over[i] && k1a[i] === k1p[i]) keyDiff++; if (!city.road[i] && k1a[i] !== k1p[i]) keyOff++; if (k1a[i] !== k1b[i]) keyDiff++; }
  if (keyDiff || keyOff) bad.push(`groundKeys：上色的路格鍵沒變／同輸入鍵不同 ${keyDiff} 格、非路格的等級進了鍵 ${keyOff} 格`);
  // 增量：先畫沒有 over 的、再換成有 over 的、再換一批＝整張重畫；只重畫等級變了的格
  const p0 = paintGroundInc(city, cat, S, undefined, undefined, null), over2 = over.map((v, i) => (i % 7 === 0 ? (v + 3) % (OVER_LEVELS + 1) : v));
  const p1 = paintGroundInc(cityQ(over), cat, S, undefined, undefined, p0.cache), p2 = paintGroundInc(cityQ(over2), cat, S, undefined, undefined, p1.cache);
  const full1 = paintGround(cityQ(over), cat, S), full2 = paintGround(cityQ(over2), cat, S);
  const wantN1 = Array.from({ length: N * N }, (_, i) => (city.road[i] && over[i] ? 1 : 0)).reduce((a, v) => a + v, 0), wantN2 = Array.from({ length: N * N }, (_, i) => (city.road[i] && over[i] !== over2[i] ? 1 : 0)).reduce((a, v) => a + v, 0);
  if (Buffer.compare(Buffer.from(p1.cache.data), Buffer.from(full1)) || Buffer.compare(Buffer.from(p2.cache.data), Buffer.from(full2)) || p1.painted !== wantN1 || p2.painted !== wantN2) bad.push(`增量重畫：跟整張重畫${Buffer.compare(Buffer.from(p1.cache.data), Buffer.from(full1)) || Buffer.compare(Buffer.from(p2.cache.data), Buffer.from(full2)) ? '不同' : '相同'}；重畫的格數 ${p1.painted}／${p2.painted}（要 ${wantN1}／${wantN2}）`);
  // 就地更新（BuiltCity.setTraffic 用的 repaintTiles）：只重畫等級變了的路格，像素與三個鍵都＝整張重畫
  {
    const cache = paintGroundInc(cityQ(over), cat, S, undefined, undefined, p0.cache).cache, over3 = over.map((v, i) => (i % 5 === 0 ? (v + 2) % (OVER_LEVELS + 1) : v));
    const changed = []; for (let i = 0; i < N * N; i++) if (city.road[i] && (over[i] & 7) !== (over3[i] & 7)) changed.push(i);
    repaintTiles(cityQ(over3), cat, S, undefined, undefined, cache, changed);
    const full3 = paintGround(cityQ(over3), cat, S), [fk1, fk2, fk3] = groundKeys(cityQ(over3), cat);
    if (!changed.length || Buffer.compare(Buffer.from(cache.data), Buffer.from(full3)) || J(Array.from(cache.k1)) !== J(Array.from(fk1)) || J(Array.from(cache.k2)) !== J(Array.from(fk2)) || J(Array.from(cache.k3)) !== J(Array.from(fk3))) bad.push(`就地更新（repaintTiles）${changed.length} 格：像素${Buffer.compare(Buffer.from(cache.data), Buffer.from(full3)) ? '≠' : '＝'}整張重畫、鍵${J(Array.from(cache.k1)) === J(Array.from(fk1)) ? '＝' : '≠'}整張的`);
    seenRepaint = changed.length;
  }
  log(!bad.length, 'D027 驗收 6（Node 半邊）：地面貼圖的輸入（src/render/ground.ts，純函式）——over 全 0＝沒給（逐位元組）；overLevel 的邊界；7 檔暖色越來越紅越濃、頭尾＝實驗線公式（.16／rgb(255,210,40) 到 .50／rgb(255,40,0)）；每個路格逐像素＝底色照公式疊；非路格就算帶等級也一個像素不動；等級進鍵、非路格的等級不進鍵；增量重畫＝整張重畫、只重畫等級變了的格；就地重畫指定的格（repaintTiles）＝整張重畫（像素與鍵）',
    bad.slice(0, 4).join('；') || `就地重畫 ${seenRepaint} 格＝整張；路格 ${roadN} 格帶等級（另有 ${offRoad} 個非路格帶等級、沒被染）、染到 ${moved} 個像素、未染 ${still} 個像素不動；增量重畫 ${p1.painted}＋${p2.painted} 格＝整張重畫`);
}

// ---- 7. 重建覆蓋場（rebuildCov）尾端的壅堵（驗收 4 的「rebuildCov 尾端不補地價動態」）----
// 讀檔與「復原一筆施工」（undoTxn 66578）都整張重建覆蓋場；實驗線 rebuildCov 53155 最後用「當下的道路負載」疊一次壅堵。本線在 rebuildCov 尾端先算壅堵計數再疊。
// 這裡在有負載的城（J1 推 8 天）把一格路的負載改成一定過載、把壅堵計數清成 0（造成過期），呼叫 rebuildCov（整張與局部兩條路）——LAND 與 jam 要等於另外算的（半徑 2 內過載道路格數、−12／格上限 −50）；
// 尾端改壞（不算壅堵計數、局部那條路不算）要紅。再走一次真的「施工 → 復原」，復原完 LAND 一樣要對。
export async function rebuildGuards(log, { cities, KT, vrank }) {
  const bad = [], N = 72, clampB = v => v < 0 ? 0 : v > 255 ? 255 : v;
  const codeOf = id => cities.find(c => c.id === id).code, fresh = () => { const L = loadCode(codeOf('J1'), KT, vrank); for (let d = 0; d < 8; d++) realDay.stepDay(L.sim); return L; };
  const expected = s => {
    const over = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) { const t = s.w.tiles[i]; if (t.road && s.g.roadLoad[i] > roadCap475(t)) over[i] = 1; }
    const jam = new Uint8Array(N * N), land = Uint8Array.from(s.g.LANDBASE);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && over[yy * N + xx]) n++; }
      jam[y * N + x] = n; if (n) land[y * N + x] = clampB(s.g.LANDBASE[y * N + x] - Math.min(50, n * 12));
    }
    return { jam, land, over: over.reduce((a, v) => a + v, 0) };
  };
  const diff = (s, what) => {
    const e = expected(s);
    for (let i = 0; i < N * N; i++) if (s.g.jam[i] !== e.jam[i]) return `${what}：jam 第 ${i} 格 ${s.g.jam[i]} ≠ ${e.jam[i]}`;
    for (let i = 0; i < N * N; i++) if (s.g.LAND[i] !== e.land[i]) return `${what}：LAND 第 ${i} 格 ${s.g.LAND[i]} ≠ ${e.land[i]}`;
    return null;
  };
  // 造過期：挑一格路，負載設成一定過載；壅堵計數清 0
  const stale = s => { let r = -1; for (let i = 0; i < N * N && r < 0; i++) if (s.w.tiles[i].road && !(s.g.roadLoad[i] > roadCap475(s.w.tiles[i]))) r = i; s.g.roadLoad[r] = 99; s.g.jam.fill(0); return r; };
  const houses = s => { const o = []; for (const i of s.root.keys()) if (s.w.tiles[i].bld?.k === 1) o.push(i); return o.slice(0, 20); };
  const run = (mod, s, landAt) => { stale(s); mod.rebuildCov(s.w, s.g, s.budget, s.edu, landAt); return diff(s, landAt ? '局部（landAt）' : '整張'); };
  const L0 = fresh(); if (!expected(L0.sim).over) bad.push('J1 推 8 天沒有過載路格（測試沒有意義）');
  for (const [name, landAt] of [['整張', undefined], ['局部', houses(L0.sim)]]) { const w = run({ rebuildCov }, fresh().sim, landAt); if (w) bad.push(`真的 rebuildCov ${name}：${w}`); }
  // 改壞：整張不算壅堵計數、局部不算壅堵計數、整張不疊壅堵（recomputeLandDynamic 拿掉）
  const cm = await loadMod('src/sim/rules/commute.ts', []);
  const MUT = [
    ['整張不算壅堵計數', [['\n  jamCounts(w, g.roadLoad, g.jam); recomputeLandDynamic(g); ', '\n  recomputeLandDynamic(g); ']], undefined],
    ['局部不算壅堵計數', [['jamCounts(w, g.roadLoad, g.jam); recomputeLandDynamic(g); return; }', 'recomputeLandDynamic(g); return; }']], houses(L0.sim)],
    ['整張不疊壅堵', [['\n  jamCounts(w, g.roadLoad, g.jam); recomputeLandDynamic(g); ', '\n  jamCounts(w, g.roadLoad, g.jam); ']], undefined],
    ['局部不疊壅堵', [['jamCounts(w, g.roadLoad, g.jam); recomputeLandDynamic(g); return; }', 'jamCounts(w, g.roadLoad, g.jam); return; }']], houses(L0.sim)],
  ], out = [];
  for (const [name, edits, landAt] of MUT) {
    let M; try { M = await loadMod('src/sim/rules/fields.ts', edits, { './commute.ts': cm }); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    const w = run(M, fresh().sim, landAt); out.push(`${name}：${w ? '紅' : '沒抓到'}`); if (!w) bad.push(`「${name}」沒抓到`);
  }
  // 真的「施工 → 復原」：復原（undoTxn）整張重建覆蓋場，用當下的負載疊壅堵
  const S = fresh().sim, before = expected(S).over;
  const money = S.money; S.money = 1000;
  const r = commitOp(S, { k: 'line', tool: 'road', x0: 4, z0: 20, x1: 12, z1: 20 }, 0);
  if (!r.ok) bad.push(`施工失敗：${r.reason}`); else { const u = undoOp(S); if (!u.ok) bad.push(`復原失敗：${u.reason}`); else { const w = diff(S, '施工再復原之後'); if (w) bad.push(w); } }
  S.money = money;
  log(!bad.length, 'D027 驗收 4：rebuildCov 尾端補壅堵——讀檔與復原一筆施工（undoTxn）整張重建覆蓋場時，用當下的道路負載算壅堵計數再疊到地價上（實驗線 53155）：在有負載的城把一格路改成過載、計數清成 0 造成過期，整張與局部（landAt）兩條路重建之後 LAND 與 jam 都要等於另外算的；尾端改壞四處（整張與局部各兩種：不算計數、不疊壅堵）要紅；真的施工再復原之後也對',
    bad.slice(0, 4).join('；') || `整張與局部都對（J1 第 8 天過載路格 ${before}）；${out.join('；')}；施工再復原之後 LAND 與 jam 對`);
}
