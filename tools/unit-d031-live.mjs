// D031 Node 守衛（二）：城市等級——實驗線頁面實跑（驗收 3、4）、接線（驗收 5）、存檔與決定性（驗收 6）。由 tools/unit.mjs 呼叫；vm 逐項與突變（驗收 2）在 tools/unit-d031.mjs；瀏覽器半邊在 tools/smoke-d031.mjs。
//   1. 樣本 src/content/samples/d031-lab.json（tools/d031-lab.mjs 從實驗線 d23c18d 的頁面錄的：每天一列 [day, rankIdx, cityPoints, pop, cityHappy]，含讀檔那一刻 start）的出處與覆蓋（等級橫跨 Lv.1–Lv.26、發生過晉升與一天連升、
//      有 rk 高於點數所指等級的城〔只升不降〕、缺 rk 從點數往上爬的舊檔）；
//   2. **不代入城市等級的任何東西**：本線自己讀檔、自己算點數與晉升，跟實驗線逐天比——讀檔那一刻的等級與點數（有 rk 原樣還原、沒有 rk 從點數往上爬）、每天推進之後的等級與點數（逐位相等）、DayReport.rank 的「今天升到哪幾級」＝等級的變化；
//      範圍：起步城 8 種子 × 120 天（什麼都不代）、存檔 24 份、自造城 J1–J17 與 K1–K16、D022–D025 的 120 座城、缺 rk 的舊檔 ≥ 100 點的老城與 24 份存檔；
//   3. D027、D028、D029、D030 的實跑守衛：seed516 的幸福差沒有了（它們的 KNOWN 名單只剩 D3）——那幾份守衛自己會逼（「這一次沒有差了」）；這裡直接量 seed516 每天每欄全等；
//   4. 接線：day.ts 的副本改壞一處要紅（不算點數、不晉升、幸福項不餵等級或餵今天的、點數的引數〔全圖、覆蓋場、幸福、科技、每棟的居民人口〕接錯、讀檔不還原、報表不回報升級、雜湊不看等級）；
//   5. 存檔與決定性：rk 有等級寫、範本有就寫、舊值蓋掉；只升不降（讀進來 Lv.26 而點數只有幾千，存了再讀還是 Lv.26）；沒有新欄位、沒有新事件、格式照舊；同一張碼讀兩次每天雜湊相同。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import * as realDay from '../src/sim/day.ts';
import { saveCode, loadCode, historyFormat } from '../src/io/save.ts';
import { fieldsOf } from '../src/sim/rules/fields.ts';
import { residentPopulation488 } from '../src/sim/rules/jobs.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import * as RK from '../src/sim/rules/rank.ts';
import { dayVariant } from './unit-d021.mjs';
import { injectInputs } from './unit-d027-live.mjs';
import { d027Cities, oldList, evolvedIds } from './d027-lab.mjs';
import { d028Cities } from './d028-lab.mjs';
import { withoutRk } from './d031-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const nz = (a, f) => a.filter(f).length, sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
const HAPPY_RANK = HAPPY_NAMES.indexOf('微光之巔');
export const LIVE = {};   // 除錯用

export async function d031LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D031 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 本線自己走一遍、逐天餵給 onDay(day, null, null, rep, s)。政策、科技、專精照 D027 樣本代入（injectInputs，跟 D027／D028 同一份）。
// **不用 compareCity27／28**：那兩個比對器每天多擲一次亂數（rowOf 的 peek——D027／D028 的實驗線探針也每天多擲一次，兩邊的軌跡都被它動過）；
// D031 的探針只讀、不動實驗線狀態（tools/d031-lab.mjs），實驗線這邊沒有多擲，所以本線這邊也不能多擲：起步城第 2 天的點數就是這樣差 7（141 vs 148）的。
// 夜間城市、城市活動本線自己算，D028 的 class2（地鐵、鐵路、公車收入）只影響錢、不影響等級與點數，不代。
function comparePure(mod, code, rec27, days, KT, vrank, { inject, onDay }) {
  const r = decodeLabCode(code), s = mod.simFromSave(r.save, code, KT, vrank), out = { d: [], days: 0 };
  let prev = rec27.start;
  const st = { pol: rec27.start.pol, tech: rec27.start.tech, spec: rec27.start.spec };
  for (let day = 1; day <= days; day++) {
    const row = rec27.rows[day - 1], inj = injectInputs(s, st, prev, row, inject);
    if (inj.err) return { ...out, d: [inj.err] };
    const rep = mod.stepDay(s, { hazard: inj.hazard });
    onDay(day, null, null, rep, s);
    prev = row; out.days = day; for (const k of ['pol', 'tech', 'spec']) if (row[k] !== undefined) st[k] = row[k];
  }
  return out;
}

// 一列樣本跟本線比：[day, rankIdx, cityPoints, pop, cityHappy]；prev＝前一天的等級（第一天＝讀檔那一刻）
// （D033 起名單是空的：D3 的污水廠減壓搬了，D3 的點數與等級現在逐位相等；下面「已知的差」的做法留著，名單再有東西時照用。）
// 已知的差（D027–D030 的 KNOWN 名單只剩 D3：T442 污水近旁的工業每座 +.025 幸福，本線沒搬）：D3 的城市幸福本來就不一樣，所以點數也不一樣——
// 這裡不要求點數、等級逐位相等，改證「差得剛好等於幸福的差」：日子、人口逐位相等，點數差＝400 × 幸福差 × 科技係數（四捨五入 ±1.5）；
// 而且至少要有一天真的有差（名單不能過期：等污水搬進來、差沒了，這一項會逼著把 D3 從名單拿掉）。
const KNOWN31 = new Set([]);   // D033：D3 的污水廠減壓由污水這一張補上，名單空了
function rowCheckKnown(rec, cnt, bad) {
  return (day, mine, row, rep, s) => {
    const L = rec.rows[day - 1], tech = s.edu.tech, tq = (tech.includes('D1') ? 1.05 : 1) * (tech.includes('D4b') ? 1.10 : 1);
    cnt.days = (cnt.days ?? 0) + 1;
    if (L[0] !== s.day || L[3] !== rep.pop) { bad.push(`第 ${day} 天 日子／人口 本線 ${s.day}／${rep.pop} ≠ 實驗線 ${L[0]}／${L[3]}`); return; }
    const dh = L[4] - rep.cityHappy, dp = L[2] - s.cityPoints;
    if (Math.abs(dp - 400 * dh * tq) > 1.5) bad.push(`第 ${day} 天 點數差 ${dp} ≠ 400×幸福差 ${dh.toFixed(4)}×${tq} ＝ ${(400 * dh * tq).toFixed(2)}`);
    if (dp !== 0) cnt.diff = (cnt.diff ?? 0) + 1;
  };
}
function rowCheck(rec, prevRank, cnt, bad) {
  let prev = prevRank;
  return (day, mine, row, rep, s) => {
    const L = rec.rows[day - 1], have = [s.day, s.rankIdx, s.cityPoints, rep.pop, rep.cityHappy];
    cnt.days = (cnt.days ?? 0) + 1;
    for (let i = 0; i < 5; i++) if (!Object.is(L[i], have[i])) { bad.push(`第 ${day} 天 ${['日子', '等級', '點數', '人口', '幸福'][i]} 本線 ${have[i]} ≠ 實驗線 ${L[i]}`); break; }
    const want = []; for (let q = prev + 1; q <= L[1]; q++) want.push(q);
    if (J(rep.rank.promoted) !== J(want) || rep.rank.idx !== s.rankIdx || rep.rank.points !== s.cityPoints) bad.push(`第 ${day} 天 DayReport.rank 升級 ${J(rep.rank.promoted)}／${rep.rank.idx}／${rep.rank.points} ≠ ${J(want)}／${L[1]}／${L[2]}`);
    if (want.length) { cnt.promo = (cnt.promo ?? 0) + 1; if (want.length > 1) cnt.multi = (cnt.multi ?? 0) + 1; }
    if (L[1] === prev && L[2] < (RK.RANKS[L[1]]?.threshold ?? 0)) cnt.belowCur = (cnt.belowCur ?? 0) + 1;
    cnt.maxRank = Math.max(cnt.maxRank ?? 0, L[1]); cnt.minRank = Math.min(cnt.minRank ?? 99, L[1]);
    prev = L[1];
  };
}

async function guards(log) {
  const lab = JSON.parse(read('src/content/samples/d031-lab.json')), lab27 = JSON.parse(read('src/content/samples/d027-lab.json')), lab28 = JSON.parse(read('src/content/samples/d028-lab.json'));
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const d26 = JSON.parse(read('src/content/samples/d026-lab.json')), evolvedCode = id => { const [seed, dd] = id.split('@'); return d26.evolve[seed].codes[dd]; };
  const startCode = read('src/content/samples/starter.code.txt').trim(), olds = oldList(), cities27 = d027Cities(), cities28 = d028Cities();
  const techOf = rec => { try { return JSON.parse(rec?.start?.tech ?? '[]'); } catch { return []; } };
  Object.assign(LIVE, { lab, KT, vrank });

  // ---- 1. 樣本：出處、形狀、覆蓋 ----
  const groups = { evolve: Object.entries(lab.evolve), evolved: Object.entries(lab.evolved), crafted: Object.entries(lab.crafted), craftedK: Object.entries(lab.craftedK), old: Object.entries(lab.old), nork: Object.entries(lab.nork) };
  {
    const bad = [], cov = { rows: 0, promo: 0, multi: 0, minStart: 99, maxStart: 0, rkAbove: 0, norkClimb: 0, norkPos: 0 };
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    for (const [g, list] of Object.entries(groups)) for (const [id, rec] of list) {
      let prev = rec.start[1];
      cov.minStart = Math.min(cov.minStart, rec.start[1]); cov.maxStart = Math.max(cov.maxStart, rec.start[1]);
      if (g !== 'nork' && rec.start[1] > RK.rankStep(0, rec.start[2]).rankIdx) cov.rkAbove++;
      if (g === 'nork') { if (rec.start[1] !== RK.rankStep(0, rec.start[2]).rankIdx) bad.push(`nork ${id}：實驗線缺 rk 讀檔的等級 ${rec.start[1]} ≠ 從點數 ${rec.start[2]} 往上爬 ${RK.rankStep(0, rec.start[2]).rankIdx}`); else { cov.norkClimb++; if (rec.start[1] > 0) cov.norkPos++; } }
      for (const r of rec.rows) { cov.rows++; if (r[1] < prev) bad.push(`${g} ${id}：第 ${r[0]} 天等級 ${prev}→${r[1]}（不會降）`); if (r[1] > prev) { cov.promo++; if (r[1] - prev > 1) cov.multi++; } prev = r[1]; }
    }
    const NEED = { rows: 2500, promo: 5, maxStart: 25, rkAbove: 3, norkClimb: 40, norkPos: 20 };
    const lack = Object.entries(NEED).filter(([k, v]) => cov[k] < v).map(([k, v]) => `${k} ${cov[k]}<${v}`);
    if (lack.length) bad.push(`覆蓋不夠：${lack.join('、')}`);
    // 等級橫跨：讀檔那一刻的等級種類
    const kinds = new Set(Object.values(groups).flatMap(l => l.map(([, r]) => r.start[1])));
    LIVE.cov = { ...cov, startRanks: [...kinds].sort((a, b) => a - b) };
    if (kinds.size < 8) bad.push(`讀檔等級只有 ${kinds.size} 種（要 ≥ 8）：${[...kinds].join('、')}`);
    log(!bad.length, `D031 實跑樣本：實驗線 ${PINNED.slice(0, 7)} 回退設定（起步城 8 種子 × 120 天、存檔 24 份 × 12 天、自造城 J1–J17 與 K1–K16 × 13 天、D022–D025 的 120 座城 × 10 天、缺 rk 的舊檔 ${groups.nork.length} 份只讀檔）；每天一列 [日子、等級、點數、人口、幸福]；等級只升不降、缺 rk 的舊檔讀檔等級＝從點數往上爬`,
      bad.slice(0, 4).join('；') || `${cov.rows} 個城日；讀檔等級 ${[...kinds].sort((a, b) => a - b).map(q => 'Lv.' + (q + 1)).join('、')}；晉升 ${cov.promo} 次（一天連升 ${cov.multi} 次）、rk 高於點數所指等級的城 ${cov.rkAbove} 座、缺 rk 的舊檔 ${cov.norkClimb} 份（爬到 Lv.2 以上 ${cov.norkPos} 份）`);
    if (bad.length) return;
  }

  // ---- 2. 讀檔那一刻與每天：跟實驗線逐位比（驗收 3）----
  const startBad = [], cntStart = { checked: 0, techSkipped: 0, restored: 0, climbed: 0 };
  {
    const startCheck = (kind, id, code, rec, tech) => {
      const r = decodeLabCode(code), s = realDay.simFromSave(r.save, code, KT, vrank);
      cntStart.checked++;
      const usesTech = tech.includes('D1') || tech.includes('D4b');
      if (usesTech) {   // 本線讀檔時沒有科技（T343 沒搬，守衛才代入）：用代入的科技重算點數，等級照存檔／往上爬的規則
        const pts = RK.cityPoints(s.w, fieldsOf(s.g).COV, .6, tech, b => residentPopulation488(b, () => undefined)), rk = RK.rankOfSave(r.save.raw.rk, pts);
        cntStart.techSkipped++;
        if (!Object.is(pts, rec.start[2]) || rk !== rec.start[1]) startBad.push(`${kind} ${id}（科技 ${tech.join('、')}）讀檔 點數 ${pts}／等級 ${rk} ≠ 實驗線 ${rec.start[2]}／${rec.start[1]}`);
        return;
      }
      if (s.cityPoints !== rec.start[2] || s.rankIdx !== rec.start[1]) startBad.push(`${kind} ${id} 讀檔 點數 ${s.cityPoints}／等級 ${s.rankIdx} ≠ 實驗線 ${rec.start[2]}／${rec.start[1]}`);
      if (r.save.raw.rk !== undefined) cntStart.restored++; else cntStart.climbed++;
    };
    for (const seed of STARTER_SEEDS) startCheck('起步城', seed, codeWithSeed(startCode, seed), lab.evolve[seed], []);
    for (const id of evolvedIds()) startCheck('存檔', id, evolvedCode(id), lab.evolved[id], techOf(lab27.evolved[id]));
    for (const c of cities27) startCheck('自造城 J', c.id, c.code, lab.crafted[c.id], techOf(lab27.crafted[c.id]));
    for (const c of cities28) startCheck('自造城 K', c.id, c.code, lab.craftedK[c.id], techOf(lab28.crafted[c.id]));
    for (const c of olds) startCheck('老城', c.id, c.code, lab.old[c.id], techOf(lab27.old[c.id]));
    for (const [id, rec] of groups.nork) { const [k, name] = id.split(':'); const code = k === 'old' ? withoutRk(olds.find(c => c.id === name).code) : withoutRk(evolvedCode(name)); startCheck('缺 rk', id, code, rec, techOf(k === 'old' ? lab27.old[name] : lab27.evolved[name])); }
    log(!startBad.length, `D031 驗收 3：讀檔那一刻的等級與點數跟實驗線逐位相等——起步城 8 種子、存檔 24 份、自造城 J1–J17 與 K1–K16、老城 120 座、缺 rk 的舊檔 ${groups.nork.length} 份（有 rk 原樣還原、缺 rk 從點數往上爬；科技清單有 D1／D4b 的城，本線讀檔時沒有科技，用代入的科技重算）`,
      startBad.slice(0, 4).join('｜') || `${cntStart.checked} 份全等（有 rk ${cntStart.restored}、缺 rk 往上爬 ${cntStart.climbed}、科技非空重算 ${cntStart.techSkipped}）`);
    if (startBad.length) return;
  }
  const daily = { errs: [], cnt: {}, sets: [] };
  {
    const run27 = (kind, list, get27, get31, inject) => {
      let days = 0;
      for (const [id, code] of list) {
        const rec = get31(id), b = [], c = {}, known = kind === '老城' && KNOWN31.has(id), r = comparePure(realDay, code, get27(id), rec.days, KT, vrank, { inject, onDay: known ? rowCheckKnown(rec, c, b) : rowCheck(rec, rec.start[1], c, b) });
        if (known) { daily.known = daily.known ?? {}; daily.known[id] = c.diff ?? 0; if (!c.diff) b.push('已知的差沒有了（名單過期，把它從 KNOWN31 拿掉）'); }
        if (r.d.length) daily.errs.push(`${kind} ${id} ${r.d[0].slice(0, 130)}`); if (b.length) daily.errs.push(`${kind} ${id} ${b[0]}`);
        days += c.days ?? 0; for (const k of ['promo', 'multi', 'belowCur']) daily.cnt[k] = (daily.cnt[k] ?? 0) + (c[k] ?? 0);
        daily.cnt.maxRank = Math.max(daily.cnt.maxRank ?? 0, c.maxRank ?? 0);
      }
      daily.sets.push(`${kind} ${list.length} 座、${days} 個城日`);
    };
    run27('起步城（什麼都不代）', STARTER_SEEDS.map(sd => [sd, codeWithSeed(startCode, sd)]), sd => lab27.evolve[sd], sd => lab.evolve[sd], false);
    run27('存檔', evolvedIds().map(id => [id, evolvedCode(id)]), id => lab27.evolved[id], id => lab.evolved[id], true);
    run27('自造城 J', cities27.map(c => [c.id, c.code]), id => lab27.crafted[id], id => lab.crafted[id], true);
    run27('老城', olds.map(c => [c.id, c.code]), id => lab27.old[id], id => lab.old[id], true);
    let kd = 0;
    for (const c of cities28) {
      const rec = lab.craftedK[c.id], b = [], k = {}, r = comparePure(realDay, c.code, lab28.crafted[c.id], rec.days, KT, vrank, { inject: true, onDay: rowCheck(rec, rec.start[1], k, b) });
      if (r.d.length) daily.errs.push(`自造城 K ${c.id} ${r.d[0].slice(0, 130)}`); if (b.length) daily.errs.push(`自造城 K ${c.id} ${b[0]}`); kd += k.days ?? 0;
    }
    daily.sets.push(`自造城 K ${cities28.length} 座、${kd} 個城日`);
    log(!daily.errs.length && daily.cnt.promo >= 5, `D031 驗收 3：實驗線頁面實跑（不代入等級的任何東西）——每天推進之後的等級、點數、人口、幸福逐位相等，DayReport.rank 的「今天升到哪幾級」＝等級的變化；本線自己走一遍、政策科技專精照 D027 樣本代入（D3 除外：T442 污水的已知差，只證差得剛好等於幸福的差）`,
      daily.errs.slice(0, 4).join('｜') || `${daily.sets.join('；')}；晉升 ${daily.cnt.promo} 次（連升 ${daily.cnt.multi} 次）、點數低於目前等級門檻而沒降級的城日 ${daily.cnt.belowCur}、最高到 Lv.${daily.cnt.maxRank + 1}；已知的差 ${J(daily.known)}（有差的天數）`);
    if (daily.errs.length) return;
  }
  {
    // seed516：讀進來就在 Lv.26（點數只有幾千）——D027／D028／D029／D030 的 KNOWN 名單少了它；這裡直接量：每天每一欄全等（D028 的全部欄位）
    const c = olds.find(q => q.id === 'seed516'), rec = lab28.old.seed516, b = [], k = {}, r = comparePure(realDay, c.code, rec, lab.old.seed516.days, KT, vrank, { inject: true, onDay: rowCheck(lab.old.seed516, lab.old.seed516.start[1], k, b) });
    const s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank);
    log(!r.d.length && !b.length && s.rankIdx === 25 && s.cityPoints < 29750, 'D031 驗收 4：seed516（讀進來就在 Lv.26、點數只有幾千）每一欄每一天逐位全等——住宅幸福的「微光之巔」+.02 補上了，只升不降（點數低於 Lv.26 的門檻也不降級）',
      r.d[0] ?? b[0] ?? `${r.days} 個城日全等；讀檔 Lv.${s.rankIdx + 1}、點數 ${s.cityPoints}（Lv.26 門檻 ${RK.RANKS[25].threshold}）`);
    if (r.d.length || b.length) return;
  }

  await wiringGuards(log, { lab, lab27, lab28, olds, cities28, KT, vrank, evolvedCode, startCode });
  await persistGuards(log, { lab, olds, KT, vrank, startCode, evolvedCode });
}

// ---- 4. 接線（驗收 5）：day.ts 的副本改壞一處，這批要紅 ----
async function wiringGuards(log, { lab, lab27, lab28, olds, cities28, KT, vrank, evolvedCode, startCode }) {
  const SEEDS = [STARTER_SEEDS[0], STARTER_SEEDS[5]], OLDS = ['seed516', 'gallery', 'ai120'].filter(id => olds.some(c => c.id === id)), EVO = [`${STARTER_SEEDS[0]}@70`, `${STARTER_SEEDS[3]}@110`];
  const oldCode = id => olds.find(c => c.id === id).code;
  const dayBad = mod => {
    try {
      for (const seed of SEEDS) { const code = codeWithSeed(startCode, seed), b = [], r = comparePure(mod, code, lab27.evolve[seed], lab.evolve[seed].days, KT, vrank, { inject: false, onDay: rowCheck(lab.evolve[seed], lab.evolve[seed].start[1], {}, b) }); if (r.d.length) return `${seed} ${r.d[0].slice(0, 80)}`; if (b.length) return `${seed} ${b[0].slice(0, 80)}`; }
      for (const id of EVO) { const code = evolvedCode(id), b = [], r = comparePure(mod, code, lab27.evolved[id], lab.evolved[id].days, KT, vrank, { inject: true, onDay: rowCheck(lab.evolved[id], lab.evolved[id].start[1], {}, b) }); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; if (b.length) return `${id} ${b[0].slice(0, 80)}`; }
      for (const id of OLDS) { const b = [], r = comparePure(mod, oldCode(id), lab28.old[id], lab.old[id].days, KT, vrank, { inject: true, onDay: rowCheck(lab.old[id], lab.old[id].start[1], {}, b) }); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; if (b.length) return `${id} ${b[0].slice(0, 80)}`; }
      const s0 = mod.simFromSave(decodeLabCode(oldCode('seed516')).save, oldCode('seed516'), KT, vrank); if (s0.rankIdx !== 25) return `seed516 讀檔等級 ${s0.rankIdx}（要 25：rk 原樣還原）`;
      const up = decodeLabCode(evolvedCode(EVO[0])).save; delete up.raw.rk; const s1 = mod.simFromSave(up, 'x', KT, vrank); if (s1.rankIdx !== RK.rankStep(0, s1.cityPoints).rankIdx || s1.rankIdx === 0) return `缺 rk 的舊檔讀檔等級 ${s1.rankIdx}（要從點數 ${s1.cityPoints} 往上爬）`;
    } catch (e) { return `丟例外 ${e.message.slice(0, 60)}`; }
    return null;
  };
  // 引數與時間的直接測：day.ts 的副本 import 一份「間諜版」rank.ts（記下 cityPoints 的引數、照舊算；可以指定回傳的點數）——
  // ① 每天呼叫一次、引數＝全圖、覆蓋場、今天的城市幸福、科技清單、每棟住宅的居民人口（residentPopulation488，住房沒就緒＝入住率 1）；② 升級的加成明天才有：今天升到 Lv.26（指定點數 99999）當天的「微光之巔」項是 0、第二天才 +.02
  const spyOf = (calls, fake) => ({ ...RK, cityPoints: (...a) => { calls.push(a); return fake ?? RK.cityPoints(...a); } });
  const mk = async edits => { const calls = [], V = await dayVariant(edits, { './rules/rank.ts': spyOf(calls) }); return { V, calls }; };
  const spyBad = async edits => {
    try {
      const calls = [], V = await dayVariant(edits, { './rules/rank.ts': spyOf(calls) });
      for (const [code, tech] of [[oldCode('gallery'), ['D1']], [codeWithSeed(startCode, STARTER_SEEDS[0]), []], [oldCode('seed516'), ['D1', 'D4b']]]) {
        const s = V.simFromSave(decodeLabCode(code).save, code, KT, vrank); s.edu.tech = tech; calls.length = 0;
        const rep = V.stepDay(s);
        if (calls.length !== 1) return `一天呼叫了 ${calls.length} 次 cityPoints`;
        const [w, COV, happy, tk, rp] = calls[0], f = fieldsOf(s.g);
        const house = s.w.tiles.map(t => t.bld).find(b => b && !b.ref && b.k === 1);
        const chk = [['全圖', w === s.w], ['覆蓋場', COV === f.COV], ['幸福', Object.is(happy, rep.cityHappy)], ['科技', tk === s.edu.tech], ['居民人口', !house || Object.is(rp(house), residentPopulation488(house, () => undefined))]];
        const off = chk.filter(([, ok]) => !ok).map(([k]) => k); if (off.length) return `引數 ${off.join('、')} 不對`;
      }
      // 時間：指定點數 99999、Lv.25（索引 24）→ 今天升到 Lv.26，今天的幸福項還讀昨天的 24 級（0），明天才 +.02
      const V2 = await dayVariant(edits, { './rules/rank.ts': spyOf([], 99999) }), code = oldCode('gallery'), s2 = V2.simFromSave(decodeLabCode(code).save, code, KT, vrank); s2.rankIdx = 24;
      const r1 = V2.stepDay(s2), r2 = V2.stepDay(s2);
      if (s2.rankIdx !== 25 || J(r1.rank.promoted) !== J([25]) || r2.rank.promoted.length) return `升級 ${J(r1.rank.promoted)}／${J(r2.rank.promoted)}、等級 ${s2.rankIdx}`;
      // 一天連升好幾級（實驗線 while 迴圈；樣本裡沒有一天連升的城，所以在這裡直接測）：Lv.21（索引 20）＋點數 99999 → 一天升到 Lv.26，promoted＝21、22、23、24、25
      const s3 = V2.simFromSave(decodeLabCode(code).save, code, KT, vrank); s3.rankIdx = 20; const r3 = V2.stepDay(s3);
      if (s3.rankIdx !== 25 || J(r3.rank.promoted) !== J([21, 22, 23, 24, 25])) return `一天連升 ${J(r3.rank.promoted)}、等級 ${s3.rankIdx}（要一天升 21–25 五級）`;
      if (r1.happyAgg.length && Math.abs(r1.happyAgg[HAPPY_RANK]) > 1e-12) return `今天升到 Lv.26 當天的微光之巔項 ${r1.happyAgg[HAPPY_RANK]}（要 0：讀的是昨天的等級）`;
      if (r2.happyAgg.length && Math.abs(r2.happyAgg[HAPPY_RANK] - .02) > 1e-12) return `升級隔天的微光之巔項 ${r2.happyAgg[HAPPY_RANK]}（要 .02）`;
    } catch (e) { return `丟例外 ${e.message.slice(0, 80)}`; }
    return null;
  };
  const hashBad = mod => {
    const code = oldCode('gallery'), r = decodeLabCode(code), fresh = () => mod.simFromSave(r.save, code, KT, vrank), base = mod.simHash(fresh());
    const h = q => { const s = fresh(); s.rankIdx = q; return mod.simHash(s); }, blind = [];
    void base; if (h(3) === h(0)) blind.push('等級 3 跟 0 一樣'); if (h(3) === h(4)) blind.push('等級 3 跟 4 一樣');
    return blind.length ? `雜湊：${blind.join('、')}` : null;
  };
  const CHECK = [['對拍', async e => dayBad(await dayVariant(e))], ['引數與時間', e => spyBad(e)], ['雜湊', async e => hashBad(await dayVariant(e))]];
  const MUT = [
    ['不算點數（恆 0）', [['s.cityPoints = cityPoints(w, f.COV, cityHappy, s.edu.tech, b => residentPopulation488(b, () => undefined));', 's.cityPoints = 0;']]],
    ['不晉升', [['s.rankIdx = rk.rankIdx;', 'void rk;']]],
    ['一天只升一級', [['const rk = rankStep(s.rankIdx, s.cityPoints);', 'const rk0 = rankStep(s.rankIdx, s.cityPoints), rk = rk0.promoted.length > 1 ? { rankIdx: rk0.promoted[0], promoted: [rk0.promoted[0]] } : rk0;']]],
    ['點數的幸福讀 .6（不看今天的城市幸福）', [['cityPoints(w, f.COV, cityHappy, s.edu.tech,', 'cityPoints(w, f.COV, .6, s.edu.tech,']]],
    ['點數的覆蓋場是空的', [['cityPoints(w, f.COV, cityHappy,', 'cityPoints(w, {}, cityHappy,']]],
    ['點數不看科技', [['cityPoints(w, f.COV, cityHappy, s.edu.tech,', 'cityPoints(w, f.COV, cityHappy, [],']]],
    ['點數的居民人口恆 1', [['b => residentPopulation488(b, () => undefined));\n  const rk', 'b => 1);\n  const rk']]],
    ['幸福項不餵等級', [['rankIdx: s.rankIdx, tvSignal', 'rankIdx: 0, tvSignal']]],
    ['幸福項餵今天的等級（先晉升再算幸福不可能改成字面，改成恆頂級）', [['rankIdx: s.rankIdx, tvSignal', 'rankIdx: 25, tvSignal']]],
    ['讀檔不還原 rk', [['rankIdx: rankOfSave(save.raw.rk, rkPoints)', 'rankIdx: 0']]],
    ['讀檔的 rk 不看存檔（一律從點數爬）', [['rankOfSave(save.raw.rk, rkPoints)', 'rankOfSave(undefined, rkPoints)']]],
    ['讀檔的點數是 0', [['cityPoints: rkPoints', 'cityPoints: 0']]],
    ['讀檔時點數的幸福讀 1（不是 .6）', [['cityPoints(w, fieldsOf(g).COV, .6, edu.tech,', 'cityPoints(w, fieldsOf(g).COV, 1, edu.tech,']]],
    ['報表不回報升級', [['promoted: rk.promoted }', 'promoted: [] }']]],
    ['報表的等級是昨天的', [['rank: { idx: s.rankIdx,', 'rank: { idx: s.rankIdx - rk.promoted.length,']]],
    ['雜湊不看等級', [['...(s.rankIdx > 0 ? [s.rankIdx] : []),', '']]],
  ];
  const bad = [], out = [], base0 = [];
  for (const [tag, fn] of CHECK) { const w = await fn([]); if (w) base0.push(`${tag}：${w}`); }
  if (base0.length) bad.push(`沒改的副本就有不對：${base0.join('｜')}`);
  const tally = {};
  for (const [name, edits] of MUT) {
    let hit = null;
    try { for (const [tag, fn] of CHECK) { const w = await fn(edits); if (w) { hit = [tag, w]; break; } } } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    out.push(`${name}：${hit ? hit[0] + '（' + hit[1].slice(0, 40) + '）' : '沒抓到'}`);
    if (!hit) bad.push(`「${name}」沒抓到`); else tally[hit[0]] = (tally[hit[0]] ?? 0) + 1;
  }
  void mk;
  log(!bad.length, `D031 驗收 5：接線——day.ts 的副本改壞一處（${MUT.length} 個：不算點數、不晉升、一天只升一級、點數的引數〔幸福、覆蓋場、科技、居民人口〕接錯、幸福項不餵或餵成別的、讀檔不還原 rk 與不看存檔與點數是 0、報表不回報升級與等級是昨天的、雜湊不看等級）：`
    + `每一個都要被實驗線對拍（起步城 ${SEEDS.length} 個種子、存檔 ${EVO.length} 份、老城 ${OLDS.join('、')}）、引數與時間的直接測或雜湊抓到；沒改的先核過全等`,
    bad.slice(0, 5).join('；') || `${Object.entries(tally).map(([k, v]) => `${k} ${v} 個`).join('、')}；` + out.join('；'));
}

// ---- 5. 存檔與決定性（驗收 6）----
async function persistGuards(log, { lab, olds, KT, vrank, startCode, evolvedCode }) {
  const bad = [], seen = { loads: 0, days: 0, trips: 0, keys: 0, det: 0 };
  const KNOWN_EVENTS = new Set(['import', 'restyle', 'grow', 'upgrade', 'build', 'demolish', 'zone', 'road', 'place', 'pipe', 'park', 'tree', 'doze', 'clear', 'undo', 'decay', 'overgrow', 'roofless', 'collapse', 'police', 'fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act']);
  const ECON_OPT = new Set(['fuel364', 'steel364', 'shipCount', 'shipProgress']);
  const rawOf = (sm, L, tpl = L.template) => decodeLabCode(saveCode(sm, tpl, L.start)).save.raw;
  // 起步城：讀進來 Lv.4（缺 rk 往上爬）→ 推到第 30 天升 Lv.5；存檔的 rk＝等級；讀回來同一級
  for (const seed of [STARTER_SEEDS[0], STARTER_SEEDS[4]]) {
    const L = loadCode(codeWithSeed(startCode, seed), KT, vrank); if (!L.ok) { bad.push(`${seed}：讀不進 ${L.error}`); continue; }
    const sm = L.sim; seen.loads++;
    const raw0 = rawOf(sm, L);
    if (raw0.rk !== sm.rankIdx) bad.push(`${seed} 剛讀進來存的 rk ${J(raw0.rk)}（等級 ${sm.rankIdx}）`);
    for (let d = 1; d <= 40; d++) { realDay.stepDay(sm); seen.days++; }
    if (sm.rankIdx < 4) bad.push(`${seed} 推了 40 天等級還在 ${sm.rankIdx}`);
    const code = saveCode(sm, L.template, L.start), raw = decodeLabCode(code).save.raw;
    if (raw.rk !== sm.rankIdx) bad.push(`${seed} 存檔的 rk ${J(raw.rk)} ≠ 等級 ${sm.rankIdx}`);
    const extra = Object.keys(raw).filter(k => !(k in raw0) && !ECON_OPT.has(k) && k !== 'rk' && k !== 'cev'), gone = Object.keys(raw0).filter(k => !(k in raw));
    if (extra.length || gone.length) bad.push(`${seed} 存檔欄位跟剛讀進來就存的不同：多 ${extra.join('、') || '無'}、少 ${gone.join('、') || '無'}`);
    seen.keys = Object.keys(raw).length;
    const h = sm.city.history; if (h.some(e => !KNOWN_EVENTS.has(e.t))) bad.push(`${seed} 歷史裡有不認得的事件：${[...new Set(h.map(e => e.t))].join('、')}`);
    const hz = h.some(e => ['fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act'].includes(e.t));
    if (hz ? historyFormat(h) !== 6 || raw.d3.f !== 6 : historyFormat(h) > 5 || raw.d3.f > 5) bad.push(`${seed} 城市格式 ${raw.d3.f}（有災禍事件要 6、沒有不能寫 6）`);
    const q = loadCode(code, KT, vrank); if (!q.ok || !q.replayed) { bad.push(`${seed} 存了再讀回失敗：${q.ok ? q.note : q.error}`); continue; }
    if (q.sim.rankIdx !== sm.rankIdx) bad.push(`${seed} 讀回來的等級 ${q.sim.rankIdx} ≠ 存的 ${sm.rankIdx}`);
    seen.trips++;
    // 範本沒有 rk、等級 0 → 照樣寫 rk:0（實驗線 66762 每次都寫；不寫的話讀回時缺 rk＝舊檔，會從點數往上爬到別的等級）；範本裡的舊值 → 蓋成現在的
    const noKey = { ...L.template }; delete noKey.rk;
    const z = loadCode(codeWithSeed(startCode, seed), KT, vrank).sim; z.rankIdx = 0;
    const zc = saveCode(z, noKey, L.start), zr = decodeLabCode(zc).save.raw.rk;
    if (zr !== 0) bad.push(`${seed} 範本沒有 rk、等級 0：要寫 rk:0，寫的是 ${J(zr)}`);
    const zq = loadCode(zc, KT, vrank); if (!zq.ok || zq.sim.rankIdx !== 0) bad.push(`${seed} 等級 0 存了再讀：等級 ${zq.ok ? zq.sim.rankIdx : zq.error}（要還是 0，不從點數往上爬；點數 ${zq.ok ? zq.sim.cityPoints : '?'}）`);
    const stale = decodeLabCode(saveCode(sm, { ...L.template, rk: 1 }, L.start)).save.raw; if (stale.rk !== sm.rankIdx) bad.push(`${seed} 範本裡的舊 rk 沒蓋成現在的：${J(stale.rk)}`);
  }
  // 只升不降：seed516 讀進來 Lv.26（rk 25）而點數只有幾千；推 5 天、存、再讀，還是 Lv.26；缺 rk 的同一張碼讀進來是點數所指的等級（比 Lv.26 低很多）
  {
    const c = olds.find(q => q.id === 'seed516').code, L = loadCode(c, KT, vrank), sm = L.sim;
    for (let d = 0; d < 5; d++) { realDay.stepDay(sm); seen.days++; }
    const code = saveCode(sm, L.template, L.start), q = loadCode(code, KT, vrank);
    if (sm.rankIdx !== 25 || sm.cityPoints >= RK.RANKS[25].threshold) bad.push(`seed516 推 5 天：等級 ${sm.rankIdx}、點數 ${sm.cityPoints}（要 Lv.26 而點數低於門檻）`);
    if (!q.ok || q.sim.rankIdx !== 25) bad.push(`seed516 存了再讀回：等級 ${q.ok ? q.sim.rankIdx : q.error}（要 25）`);
    const n = loadCode(withoutRk(c), KT, vrank); if (!n.ok || n.sim.rankIdx !== RK.rankStep(0, n.sim.cityPoints).rankIdx || n.sim.rankIdx >= 25) bad.push(`seed516 缺 rk：等級 ${n.ok ? n.sim.rankIdx : n.error}（要從點數 ${n.ok ? n.sim.cityPoints : '?'} 往上爬、遠低於 25）`);
    seen.trips++; seen.loads += 2;
  }
  // 決定性：同一張碼讀兩次，各推 13 天，每天雜湊相同
  for (const c of [codeWithSeed(startCode, STARTER_SEEDS[1]), olds.find(q => q.id === 'gallery').code]) {
    const a = loadCode(c, KT, vrank).sim, b = loadCode(c, KT, vrank).sim;
    for (let d = 1; d <= 13; d++) { realDay.stepDay(a); realDay.stepDay(b); if (realDay.simHash(a) !== realDay.simHash(b)) { bad.push(`同一張碼讀兩次、第 ${d} 天雜湊不同`); break; } }
    seen.det++;
  }
  void lab; void evolvedCode;
  log(!bad.length, 'D031 驗收 6：存檔——rk 一律寫（0 級也寫，跟實驗線 66762 一樣；範本有沒有都寫）、範本裡的舊值蓋成現在的、0 級存了再讀還是 0 級；只升不降（seed516 讀進來 Lv.26 而點數只有幾千，推進、存、再讀還是 Lv.26；缺 rk 的同一張碼讀進來遠低於 25）；沒有新欄位、歷史沒有新事件、城市格式照舊；同一張碼讀兩次每天雜湊相同',
    bad.slice(0, 4).join('；') || `${seen.loads} 次讀檔、共推 ${seen.days} 個城日、存檔欄位 ${seen.keys} 個、存讀檔往返 ${seen.trips} 次、決定性 ${seen.det} 座×13 天`);
}
