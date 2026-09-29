// D016 Node 守衛（驗收 2、3）：公共設施九支的實驗線實跑錨點、分享碼互通、歷史與存檔。實驗線那一半是離線錄的（tools/d016-parity.mjs → d016-lab.json，要 Chrome），
// 本線那一半每次在這裡重算（tools/d016-ops.mjs civic3d、prebuilt16），逐項比。由 tools/unit.mjs 呼叫。
//   欄位齊全：逐項比之前先核樣本的每一個錄製欄位都在、型別對（漏錄一欄時兩邊都是 undefined，J(undefined)===J(undefined) 會「相等」）。
//   新城（8 個種子）：D011 的 A 段＋D016 的 C 段每一筆的資金（不取整）、亂數抽取數、格子雜湊、場雜湊（覆蓋、污染、地價）、地價髒狀態、變了哪些格；
//             推進第 1 天之後的格子與場（含地價 LANDBASE／LAND）、逐行的亂數抽取、設施清單；第 1 天那一列（人口、就業、需求、住商工棟數、有電）；
//             收入與維護費：實驗線探針讀到的設施數＝本線城裡的棟數（每一種都 > 0），代入實驗線那一天的第 2 類乘數與進口費，本線的收入、維護費、結算後資金完全相等。
//   預建城（8 個種子）：拆噪音源、九種設施、拆診所再復原，每一筆逐項相等；推進一天之後住商工以外的格子、覆蓋、地價、推進前就在的住商工有沒有電相等；
//             推進前就在的每一棟住宅，實驗線的幸福＝本線的幸福套糧食（第 2 類，同 D011；垃圾 D020 搬了）逐位相等；而且這批設施真的改到了這些住宅的幸福（不蓋設施時不同）。
//   分享碼：本線匯出的碼（帶這批設施）實驗線讀得進來，每一棟設施的種類、等級、變體＝本線、對帳數字＝本線；實驗線匯出的碼本線解碼，設施清單與對帳數字＝實驗線自己量的。
//   歷史與存檔（驗收 3，只有本線）：新城與預建城做完之後，歷史重播＝模擬、存檔再讀檔逐格相同（tools/unit-d011-edit.mjs 的 replayDiff、roundTrip）；
//             C 段蓋墓園再復原：覆蓋各場、污染逐格回到蓋之前；教育場＝照復原後的城整張重算（實驗線復原走 rebuildCov 53135，黃金樣本逐筆比過 EDU）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { loadCode } from '../src/io/save.ts';
import { allocGrids, rebuildCov } from '../src/sim/rules/fields.ts';
import { ROW_FIELDS, PRE_GROWTH_LINES, class2Of } from './d011-parity-lib.mjs';
import { batchDiff, cellsDiff, effectOf, sharedOff, extraOff } from './unit-d011-parity.mjs';
import { replayDiff, roundTrip } from './unit-d011-edit.mjs';
import { run3d } from './d011-ops.mjs';
import { civic3d, prebuilt16, d016Ops, prebuilt16Ops, civvOfCode, CIVIC_K16, PROBE16_EXTRA } from './d016-ops.mjs';

const J = JSON.stringify;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);   // 實驗線 37219
// 探針裡的設施數 → 種類（收稅那一圈 55885–55890 與主計數迴圈 55050–55063 的變數名）
const PROBE_K = { parks: 4, fireStations: 6, policeBoxes: 52, hospitals: 12, clinics: 13, schools: 7, libraries: 14, posts: 15, cemeteries: 16 };
const isHex = v => typeof v === 'string' && /^[0-9a-f]{1,8}$/.test(v), isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const headOk = (x, money) => isObj(x) && isHex(x.tileHash) && isHex(x.fieldHash) && typeof x.land === 'string' && (!money || typeof x.money === 'number');
const civvOk = v => Array.isArray(v) && v.length > 0 && v.every(r => Array.isArray(r) && r.length === 4 && r.every(Number.isInteger));
const recsOk = (xs, list) => Array.isArray(xs) && xs.length === list.length && xs.every((r, i) => isObj(r) && r.k === list[i].k && typeof r.money === 'number' && Number.isInteger(r.draws) && isHex(r.tileHash) && isHex(r.fieldHash));
const kCount = (tiles, k) => tiles.reduce((n, t) => n + (t.bld && !t.bld.ref && t.bld.k === k ? 1 : 0), 0);

// 預建城逐項比（D016 先拆噪音源、D017 留著體育場，兩份共用）：pre＝本線那一跑（d016-ops.mjs prebuilt16 的回傳，照種子）、labPre＝實驗線樣本的 prebuilt、
// bareOf(seed)＝同一座城只做劇本開頭（資金、拆噪音源）、不蓋設施時推進後住宅的 h（Map）。回傳 bad、每個種子幸福被設施改到的住宅棟數、住在噪音裡的住宅棟數
export function prebuiltCheck(seeds, pre, labPre, P, bareOf) {
  const bad = [], moved = [], noisy = [];
  for (const seed of seeds) {
    const m = pre[seed], L = labPre[seed], q = L.probe;
    for (const [name, a, b] of [['開跑前', m.snap0, L.snap0], ['劇本後', m.snapOps, L.snapOps]]) if (J(a) !== J(b)) bad.push(`種子 ${seed} ${name}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
    const d = batchDiff(m.ops, L.ops, true); if (d) bad.push(`種子 ${seed} 劇本${d}`);
    for (const e of effectOf(P.ops, m.ops, 3000).filter(e => !e.eff)) bad.push(`種子 ${seed} 劇本第 ${e.i + 1} 筆沒改到東西`);
    if (J(m.inv) !== J(L.inv)) bad.push(`種子 ${seed} 推進後（住商工以外、覆蓋、地價）：本線 ${J(m.inv)} ≠ 實驗線 ${J(L.inv)}`);
    if (m.tickLand !== L.tickLand) bad.push(`種子 ${seed}：推進開頭地價框改了 本線 ${m.tickLand} ≠ 實驗線 ${L.tickLand} 格`);
    const old = new Set(m.pwBefore), pwOld = x => J(x.filter(([i]) => old.has(i)));
    if (pwOld(m.pw) !== pwOld(L.pw)) bad.push(`種子 ${seed} 推進前就在的住商工有電不同`);
    const ds = sharedOff(L.tickSites, m.tickSites, PRE_GROWTH_LINES.map(String)); if (ds) bad.push(`種子 ${seed} 推進那一天生長之前的抽取：${ds}`);
    // 推進前就在的每一棟住宅：實驗線 h＝本線 h 套糧食（55414–55419，第 2 類沒搬）；垃圾（全城池 garbPen409、離垃圾場太遠 −.045）D020 搬了，量、容量、懲罰、太遠的棟數＝實驗線
    const homes = new Set(m.hsBefore), res = m.hs.filter(([i]) => homes.has(i)), labH = new Map(L.hs), food = clamp((q.foodSupplyRate482 - .50) * .11, -.06, .05);
    if (!res.length || q.garbFar409 !== res.length) bad.push(`種子 ${seed}：推進前就在的住宅 ${res.length} 棟、離垃圾場太遠 ${q.garbFar409} 棟`);
    const g = m.garb, gl = [q.garbage, q.garbCap, q.garbPen409, q.garbFar409];
    if (JSON.stringify([g.amount, g.cap, g.pen, g.far]) !== JSON.stringify(gl)) bad.push(`種子 ${seed}：垃圾量／容量／全城懲罰／太遠的棟數 本線 ${JSON.stringify([g.amount, g.cap, g.pen, g.far])} ≠ 實驗線 ${JSON.stringify(gl)}`);
    for (const [i, h] of res) {
      const want = clamp(h + food, .05, 1);
      if (!Object.is(labH.get(i), want)) bad.push(`種子 ${seed} 第 ${i} 格住宅：實驗線 h ${labH.get(i)} ≠ 本線 ${h} 套糧食 ${want}`);
    }
    // 這批設施真的改到了幸福：同一座城不蓋設施，推進前就在的住宅本線的 h 不同
    const bare = bareOf(seed);
    moved.push(res.filter(([i, h]) => bare.get(i) !== h).length);
    if (!res.some(([i, h]) => bare.get(i) !== h)) bad.push(`種子 ${seed}：蓋不蓋設施，推進前就在的住宅幸福都一樣（比了等於沒比）`);
    noisy.push(res.filter(([i]) => m.sim.g.NOISE[i] > 0).length);
  }
  return { bad, moved, noisy };
}

export async function d016ParityGuards(log) {
  const read = p => fs.readFileSync(path.resolve(ROOT, p), 'utf8'), file = 'src/content/samples/d016-lab.json';
  if (!fs.existsSync(path.join(ROOT, file))) { log(false, 'D016 實驗線實跑錨點', `${file} 不存在：跑 tools/d016-parity.mjs`); return; }
  const lab = JSON.parse(read(file)), seeds = lab.seeds ?? [];
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const newcity = read('src/content/samples/newcity.code.txt').trim(), prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim();
  const S0 = decodeLabCode(newcity).save, lay = k => Uint8Array.from(S0.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
  const ops = d016Ops(S0.n, lay('ter'), lay('el'), lay('tre'));
  const src = `實驗線 ${String(lab.source?.commit).slice(0, 7)} v${lab.source?.version}`;

  // ---- 欄位齊全 ----
  let P = null;
  {
    const bad = [];
    if (lab.source?.commit !== 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0') bad.push('source.commit');
    if (!(Array.isArray(seeds) && seeds.length >= 8 && seeds.every(Number.isInteger))) bad.push('seeds（要 ≥ 8 個）');
    if (J(lab.probeExtra) !== J(PROBE16_EXTRA)) bad.push('probeExtra');
    for (const seed of seeds) {
      const r = lab.runs?.[seed], q = lab.prebuilt?.[seed], b = lab.readback?.[seed], put = m => bad.push(`種子 ${seed} ${m}`);
      if (!isObj(r)) { put('runs'); continue; }
      for (const k of ['snap0', 'snapA', 'snapC']) if (!headOk(r[k], true)) put(`runs.${k}`);
      if (!headOk(r.snap1, false)) put('runs.snap1');
      if (!recsOk(r.A, ops.A)) put('runs.A'); if (!recsOk(r.C, ops.C)) put('runs.C');
      if (!civvOk(r.civvC) || !civvOk(r.civv1)) put('runs.civv');
      if (!(Array.isArray(r.day1) && r.day1.length === ROW_FIELDS.length && r.day1[0] === 2)) put('runs.day1');
      if (!(isObj(r.probe1) && typeof r.probe1.income === 'number' && typeof r.probe1.upkeep === 'number' && Object.keys(PROBE_K).every(k => Number.isInteger(r.probe1[k])))) put('runs.probe1（收入、維護費、九種設施數）');
      if (!isObj(r.tick1Sites) || !isObj(r.tick1Extra) || !Number.isInteger(r.tick1Land)) put('runs.tick1');
      if (typeof r.codeC !== 'string' || !isObj(r.measureC)) put('runs.codeC／measureC');
      if (!isObj(q)) { put('prebuilt'); continue; }
      if (!headOk(q.snapOps, true) || !headOk(q.post, false) || !isObj(q.inv) || !Array.isArray(q.pw) || !Array.isArray(q.hs) || !isObj(q.probe) || !isObj(q.tickSites)) put('prebuilt 的快照／INV／有電／幸福／探針');
      if (!isObj(b) || typeof b.ok !== 'boolean' || !civvOk(b.civv) || !isObj(b.measure) || !/^[0-9a-f]{8}$/.test(b.codeHash ?? '')) put('readback');
    }
    log(!bad.length, `D016 對拍樣本欄位齊全（${seeds.length} 個種子）：新城 A／C 段逐筆、推進第 1 天的快照與抽取、第 1 天那一列、探針（收入、維護費、九種設施數）、設施清單、匯出的碼；預建城逐筆、INV、有電、幸福、探針；本線碼的讀回`,
      bad.slice(0, 4).join('；') || `${src}；${seeds.length} 個種子`);
    if (bad.length) { log(false, 'D016 對拍：欄位不齊，後面的逐項比對都不跑', '先重跑 tools/d016-parity.mjs'); return; }
  }

  const mine = {}, pre = {};
  for (const seed of seeds) { mine[seed] = civic3d(codeWithSeed(newcity, seed), KT, vrank); pre[seed] = prebuilt16(codeWithSeed(prebuilt, seed), KT, vrank); }
  P = prebuilt16Ops(loadCode(codeWithSeed(prebuilt, seeds[0]), KT, vrank).sim);

  // ---- 新城：A、C 段逐筆；推進第 1 天之後 ----
  {
    const bad = [], eff = [];
    for (const seed of seeds) {
      const m = mine[seed], L = lab.runs[seed];
      for (const [name, a, b] of [['開跑前', m.snap0, L.snap0], ['A 段後', m.snapA, L.snapA], ['C 段後', m.snapC, L.snapC], ['推進第 1 天後', m.snap1, L.snap1]]) if (J(a) !== J(b)) bad.push(`種子 ${seed} ${name}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
      const dA = batchDiff(m.A, L.A, seed === seeds[0]), dC = batchDiff(m.C, L.C, seed === seeds[0]);
      if (dA) bad.push(`種子 ${seed} A 段${dA}`); if (dC) bad.push(`種子 ${seed} C 段${dC}`);
      if (J(m.civvC) !== J(L.civvC) || J(m.civv1) !== J(L.civv1)) bad.push(`種子 ${seed}：設施清單（種類、等級、變體）不同`);
      if (m.tick1Land !== L.tick1Land) bad.push(`種子 ${seed}：推進開頭地價框改了 本線 ${m.tick1Land} 格 ≠ 實驗線 ${L.tick1Land} 格`);
      const s1 = sharedOff(L.tick1Sites, m.tick1Sites), x1 = extraOff(L.tick1Sites, m.tick1Extra);
      if (s1) bad.push(`種子 ${seed} 推進第 1 天的抽取：${s1}`); if (x1) bad.push(`種子 ${seed} 實驗線多抽的三行（照本線推進後的格子與覆蓋算）：${x1}`);
      // 劇本不空跑：C 段每一筆「有沒有改到格子或資金」跟劇本註明的一樣；九種設施在推進後都在
      const e = effectOf(ops.C, m.C, m.snapA.money);
      for (const q of e) if (q.eff !== q.want) bad.push(`種子 ${seed} C 段第 ${q.i + 1} 筆 ${J(ops.C[q.i])}：${q.want ? '應該改到東西卻沒有' : '應該什麼都不改卻改了'}`);
      const miss = Object.entries(CIVIC_K16).filter(([, k]) => !m.civv1.some(r => r[1] === k)).map(([t]) => t);
      if (miss.length) bad.push(`種子 ${seed}：推進後少了 ${miss.join('、')}`);
      eff.push(e.filter(q => q.eff).length);
    }
    const nC = ops.C.filter(o => !['money', 'seed', 'pick'].includes(o.k)).length, c0 = mine[seeds[0]].civv1;
    log(!bad.length, `D016 實驗線實跑錨點（新城 × ${seeds.length} 個種子，${src}，實驗線用它自己的點／框／復原）：D011 的 A 段（${ops.A.length} 筆）＋公共設施 C 段（${ops.C.length} 筆：九種各蓋一棟、框選公園、水上／路上／有建築／錢差一塊都拒絕、樹上 +$2、錢剛好、蓋了再復原、蓋了再拆、拆了再復原）每一筆的資金、亂數抽取數、逐格、覆蓋與污染與地價、地價髒框都相等；推進第 1 天之後的格子、場、逐行抽取、設施清單也相等`,
      bad.slice(0, 3).join('；') || `C 段有改到東西的筆數 ${[...new Set(eff)].join('、')}／${nC}；推進後設施 ${c0.length} 棟（${Object.entries(CIVIC_K16).map(([t, k]) => `${t} ${c0.filter(r => r[1] === k).length}`).join('、')}）`);
  }
  // ---- 第 1 天：那一列、收入與維護費 ----
  {
    const bad = [], money = [];
    const n = ROW_FIELDS.indexOf('money');
    for (const seed of seeds) {
      const m = mine[seed], L = lab.runs[seed], q = L.probe1;
      const a = [...m.day1.slice(0, n), m.day1[n + 1]], b = [...L.day1.slice(0, n), L.day1[n + 1]];
      if (J(a) !== J(b)) bad.push(`種子 ${seed} 第 1 天那一列（不含資金）：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
      // 探針讀到的設施數＝本線城裡的棟數（推進第 1 天那時），每一種都 > 0
      const cnt = Object.fromEntries(Object.entries(PROBE_K).map(([v, k]) => [v, kCount(m.sim.w.tiles, k)]));
      for (const [v, k] of Object.entries(PROBE_K)) if (q[v] !== cnt[v] || !(q[v] > 0)) bad.push(`種子 ${seed}：${v}（k${k}）實驗線 ${q[v]} ≠ 本線 ${cnt[v]}（兩邊都要 > 0）`);
      const r = civic3d(codeWithSeed(newcity, seed), KT, vrank, { class2: class2Of(q) });
      const got = [r.settle1.income, r.settle1.upkeep, r.day1[n]], want = [q.income, q.upkeep, L.day1[n]];
      if (!got.every((v, i) => Object.is(v, want[i]))) bad.push(`種子 ${seed}：收入／維護費／資金 本線 ${J(got)} ≠ 實驗線 ${J(want)}`);
      money.push(m.day1[n] - L.day1[n]);
    }
    const q0 = lab.runs[seeds[0]].probe1, L0 = lab.runs[seeds[0]];
    log(!bad.length, `D016 第 1 天（${seeds.length} 個種子）：人口、就業（含學校、診所、圖書館、郵局、墓園的固定就業）、需求、住商工棟數、有電逐項相等；實驗線探針讀到的九種設施數＝本線城裡的棟數（每一種都 > 0）；把實驗線那一天的第 2 類乘數與進口費代進本線公式，收入、維護費（含九種設施）、結算後資金完全相等`,
      bad.slice(0, 3).join('；') || `例：種子 ${seeds[0]} 就業 ${L0.day1[ROW_FIELDS.indexOf('jobs')]}、收入 ${q0.income}、維護費 ${q0.upkeep}（設施 ${Object.keys(PROBE_K).map(v => `${v} ${q0[v]}`).join('、')}）；不代入第 2 類時資金 本線−實驗線 ${money.map(v => v.toFixed(2)).join('、')}（只量不判，同 D011）`);
  }
  // ---- 預建城 ----
  {
    const { bad, moved } = prebuiltCheck(seeds, pre, lab.prebuilt, P, seed => new Map(prebuilt16(codeWithSeed(prebuilt, seed), KT, vrank, {}, true).hs));
    log(!bad.length, `D016 預建城（${seeds.length} 個種子，${P.ops.length} 筆：先拆噪音源（D016 那時本線沒搬噪音；D017 另跑一份留著體育場的）、在住宅旁蓋九種設施、拆診所再復原）：每一筆逐項相等；推進一天之後住商工以外的格子、覆蓋、地價、推進前就在的住商工有電、生長之前的抽取都相等；推進前就在的每一棟住宅，實驗線的幸福＝本線的幸福套糧食（第 2 類，同 D011；垃圾 D020 搬了，量、容量、懲罰＝實驗線），逐位相等；而且這批設施真的改到了它們的幸福`,
      bad.slice(0, 3).join('；') || `九種設施 ${P.at.map(([t, x, z]) => `${t}(${x},${z})`).join(' ')}；幸福被設施改到的住宅 ${moved.join('、')} 棟`);
  }
  // ---- 分享碼互通 ----
  {
    const bad = [];
    for (const seed of seeds) {
      const m = mine[seed], L = lab.runs[seed], rb = lab.readback[seed];
      // 本線 → 實驗線：錄樣本時讀回的那張碼＝本線現在算出來的碼（雜湊），讀得進來、設施清單與對帳數字＝本線
      if (rb.codeHash !== fnv1a(m.codeC)) bad.push(`種子 ${seed}：樣本讀回的碼不是本線現在匯出的碼（重跑 tools/d016-parity.mjs）`);
      if (!rb.ok) bad.push(`種子 ${seed}：實驗線讀不進本線的碼`);
      if (J(rb.civv) !== J(civvOfCode(m.codeC)) || J(rb.civv) !== J(m.civv1)) bad.push(`種子 ${seed}：實驗線讀回的設施（種類、等級、變體）≠ 本線`);
      const S = decodeLabCode(m.codeC).save;
      if (J(rb.measure) !== J(cityStats(cityFromLab(S, KT, m.codeC)))) bad.push(`種子 ${seed}：實驗線讀回的對帳數字 ≠ 本線`);
      // 實驗線 → 本線
      const r = decodeLabCode(L.codeC);
      if (!r.ok) { bad.push(`種子 ${seed}：實驗線匯出的碼本線解不開 ${r.error}`); continue; }
      if (J(civvOfCode(L.codeC)) !== J(L.civv1)) bad.push(`種子 ${seed}：實驗線匯出的碼解出來的設施 ≠ 實驗線自己量的`);
      if (J(cityStats(cityFromLab(r.save, KT, L.codeC))) !== J(L.measureC)) bad.push(`種子 ${seed}：實驗線 → 本線 對帳數字不同`);
    }
    const c = lab.readback[seeds[0]].civv;
    log(!bad.length, `D016 分享碼互通（${seeds.length} 個種子）：本線匯出的碼（C 段＋第 1 天之後，帶九種設施）實驗線讀得進來，每一棟設施的種類、等級、變體＝本線、對帳數字＝本線；實驗線匯出的碼本線解碼，設施清單與對帳數字＝實驗線自己量的`,
      bad.slice(0, 3).join('；') || `每個種子 ${c.length} 棟非住商工（其中九種新設施 ${c.filter(r => Object.values(CIVIC_K16).includes(r[1])).length} 棟）`);
  }
  // ---- 驗收 3：歷史與存檔（本線）----
  {
    const bad = [];
    for (const seed of seeds) {
      for (const [what, x] of [['新城', mine[seed]], ['預建城', pre[seed]]]) {
        const rd = replayDiff(x.sim, x.load.start, KT); if (rd) bad.push(`種子 ${seed} ${what} 重播：${rd}`);
        const rt = roundTrip(x.sim, x.load, KT, vrank); if (rt.bad) bad.push(`種子 ${seed} ${what} 存讀檔：${rt.bad}`);
      }
    }
    // 蓋墓園再復原：覆蓋各場、污染逐格回到蓋之前；教育場＝照復原後的城整張重算
    const L = loadCode(codeWithSeed(newcity, seeds[0]), KT, vrank), s = L.sim, picks = {};
    let now = 0;
    for (const o of ops.A) run3d(s, o, picks, now += 10000);
    const j = ops.C.findIndex((o, i) => o.k === 'tap' && o.tool === 'cemetery' && ops.C[i + 1]?.k === 'undo'), undoNext = j >= 0;   // C 段「蓋了再復原」那一棟（那一排裡也有一棟墓園，不是它）
    for (const o of ops.C.slice(0, j)) run3d(s, o, picks, now += 10000);
    const snapF = () => J([Object.keys(s.g.COV).sort().map(f => [f, [...s.g.COV[f]]]), [...s.g.POL], [...s.g.POLBASE], [...s.g.POLTREE]]);
    const before = snapF(), m0 = s.money;
    const r1 = run3d(s, ops.C[j], picks, now += 10000), mid = snapF(), r2 = run3d(s, ops.C[j + 1], picks, now += 10000);
    const g2 = allocGrids(s.w.N); rebuildCov(s.w, g2, s.budget, s.edu);
    if (!undoNext || !r1.ok || mid === before) bad.push(`蓋墓園沒改到覆蓋（${J(r1)}）`);
    if (!r2.ok || snapF() !== before || s.money !== m0) bad.push(`復原墓園：覆蓋與污染${snapF() === before ? '' : '沒'}回到蓋之前、資金 ${s.money}／${m0}`);
    if (J([...s.g.EDU]) !== J([...g2.EDU])) bad.push('復原之後的教育場 ≠ 照現在的城整張重算');
    log(!bad.length, `D016 歷史與存檔（驗收 3，${seeds.length} 個種子 × 新城與預建城）：做完劇本之後歷史重播＝模擬、存檔再讀檔逐格相同（再存再讀逐位元組相同）；蓋墓園再復原，覆蓋各場、污染逐格回到蓋之前、全額退錢，教育場＝照復原後的城整張重算（實驗線 undo 走 rebuildCov）`,
      bad.slice(0, 3).join('；') || `${seeds.length * 2} 座城`);
  }
}
