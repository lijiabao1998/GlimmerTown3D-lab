// D019 驗收 3、4：實驗線頁面實跑錨點（src/content/samples/d019-lab.json，tools/d016-parity.mjs --set=d019 錄）跟本線同一份劇本逐項比。
//   預建城（8 個種子）：劇本（tools/d019-ops.mjs：一條接水塔的配水管、一條沒接的）每一筆、做完之後的水管與接通的水管、推進一天：
//     推進前就在的住商工與社宅每一棟的電與水、推進前就在的住宅幸福（套垃圾與糧食，同 D016）、住商工以外的格子與場、生長之前的抽取；
//     實驗線匯出的碼本線解碼，水管圖層＝本線；本線的碼匯入實驗線，讀回的水管與對帳數字＝本線。
//   樣本城（AI 城 120 天、種子城）：讀進來推進一天，每一棟的電與水、接通的水管、水管、讀檔重挑外觀的棟數、生長之前的抽取。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { PRE_GROWTH_LINES } from './d011-parity-lib.mjs';
import { batchDiff, sharedOff } from './unit-d011-parity.mjs';
import { prebuilt19, sample19 } from './d019-ops.mjs';

const J = JSON.stringify, isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);   // 實驗線 37219

export async function d019ParityGuards(log) {
  const read = p => fs.readFileSync(path.resolve(ROOT, p), 'utf8'), file = 'src/content/samples/d019-lab.json';
  if (!fs.existsSync(path.join(ROOT, file))) { log(false, 'D019 實驗線實跑錨點', `${file} 不存在：跑 tools/d016-parity.mjs --set=d019`); return; }
  const lab = JSON.parse(read(file)), seeds = lab.seeds ?? [];
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim();
  const src = `實驗線 ${String(lab.source?.commit).slice(0, 7)} v${lab.source?.version}`;

  // ---- 欄位齊全 ----
  {
    const bad = [], arr = v => Array.isArray(v);
    if (lab.source?.commit !== 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0') bad.push('source.commit');
    if (lab.source?.tool !== 'tools/d016-parity.mjs --set=d019') bad.push('source.tool');
    if (!(arr(seeds) && seeds.length >= 8 && seeds.every(Number.isInteger))) bad.push('seeds（要 ≥ 8 個）');
    for (const seed of seeds) {
      const q = lab.prebuilt?.[seed], b = lab.readback?.[seed];
      if (!isObj(q) || !arr(q.ops) || !arr(q.wp) || !arr(q.wrOps) || !arr(q.wa) || !arr(q.pw) || !arr(q.hs) || !isObj(q.inv) || !isObj(q.probe) || !isObj(q.tickSites) || typeof q.codeW !== 'string') bad.push(`種子 ${seed} prebuilt`);
      if (!isObj(b) || typeof b.ok !== 'boolean' || !arr(b.wp) || !isObj(b.measure) || !/^[0-9a-f]{8}$/.test(b.codeHash ?? '')) bad.push(`種子 ${seed} readback`);
    }
    for (const id of ['ai120', 'seed516']) { const x = lab.samples?.[id]; if (!isObj(x) || !arr(x.wa) || !arr(x.pw) || !arr(x.wr) || !arr(x.wp) || !isObj(x.tickSites) || !Number.isInteger(x.mig)) bad.push(`樣本城 ${id}`); }
    log(!bad.length, `D019 對拍樣本欄位齊全（${seeds.length} 個種子）：預建城逐筆、水管與接通的水管、推進後每一棟的電與水、幸福、探針、實驗線匯出的碼；樣本城兩座；讀回`,
      bad.slice(0, 4).join('；') || `${src}；${seeds.length} 個種子`);
    if (bad.length) { log(false, 'D019 對拍：欄位不齊，後面的逐項比對都不跑', '先重跑 tools/d016-parity.mjs --set=d019'); return; }
  }

  // ---- 預建城 ----
  const pre = {};
  for (const seed of seeds) pre[seed] = prebuilt19(codeWithSeed(prebuilt, seed), KT, vrank);
  {
    const bad = [], tallies = [];
    for (const seed of seeds) {
      const m = pre[seed], L = lab.prebuilt[seed], q = L.probe;
      for (const [name, a, b] of [['開跑前', m.snap0, L.snap0], ['劇本後', m.snapOps, L.snapOps]]) if (J(a) !== J(b)) bad.push(`種子 ${seed} ${name}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
      const d = batchDiff(m.ops, L.ops, true); if (d) bad.push(`種子 ${seed} 劇本${d}`);
      if (J(m.wp) !== J(L.wp)) bad.push(`種子 ${seed} 水管：本線 ${m.wp.length} 格 ≠ 實驗線 ${L.wp.length} 格`);
      if (J(m.wrOps) !== J(L.wrOps)) bad.push(`種子 ${seed} 劇本後接通的水管：本線 ${m.wrOps.length} ≠ 實驗線 ${L.wrOps.length}`);
      if (J(m.inv) !== J(L.inv)) bad.push(`種子 ${seed} 推進後（住商工以外、覆蓋、地價）不同`);
      if (m.tickLand !== L.tickLand) bad.push(`種子 ${seed}：推進開頭地價框改了 本線 ${m.tickLand} ≠ 實驗線 ${L.tickLand} 格`);
      const ds = sharedOff(L.tickSites, m.tickSites, PRE_GROWTH_LINES.map(String)); if (ds) bad.push(`種子 ${seed} 推進那一天生長之前的抽取：${ds}`);
      // 推進前就在的住商工與社宅：電、水逐棟（新長的當天還沒給過電水，兩邊都不比）
      const oldW = new Set(m.waBefore), oldP = new Set(m.pwBefore), pick = (x, s) => J(x.filter(([i]) => s.has(i)));
      if (pick(m.wa, oldW) !== pick(L.wa, oldW)) bad.push(`種子 ${seed} 推進前就在的住商工有水不同：本線 ${pick(m.wa, oldW)} ≠ 實驗線 ${pick(L.wa, oldW)}`);
      if (pick(m.pw, oldP) !== pick(L.pw, oldP)) bad.push(`種子 ${seed} 推進前就在的住商工有電不同`);
      const wet = m.wa.filter(([i, w]) => oldW.has(i) && w).length, dry = m.wa.filter(([i, w]) => oldW.has(i) && !w).length;
      if (!wet || !dry) bad.push(`種子 ${seed}：有水 ${wet} 棟、沒水 ${dry} 棟（兩種都要有，比了才有意義）`);
      // 推進前就在的每一棟住宅：實驗線 h＝本線 h 依序套垃圾與糧食（同 D016，第 2 類系統本線沒搬）；舊式供水沒有水的幸福項
      const homes = new Set(m.hsBefore), res = m.hs.filter(([i]) => homes.has(i)), labH = new Map(L.hs), food = clamp((q.foodSupplyRate482 - .50) * .11, -.06, .05);
      for (const [i, h] of res) {
        const want = clamp(clamp(clamp(h - q.garbPen409, .05, 1) - .045, .05, 1) + food, .05, 1);
        if (!Object.is(labH.get(i), want)) bad.push(`種子 ${seed} 第 ${i} 格住宅：實驗線 h ${labH.get(i)} ≠ 本線 ${h} 套垃圾與糧食 ${want}`);
      }
      // 實驗線匯出的碼（推進後）：水管圖層＝本線
      const cw = decodeLabCode(L.codeW);
      if (!cw.ok) bad.push(`種子 ${seed} 實驗線匯出的碼本線解不開`);
      else { const wp = []; for (let i = 0; i < cw.save.n ** 2; i++) if (cw.save.layers.wp?.[i] === '1') wp.push(i); if (J(wp) !== J(m.wp)) bad.push(`種子 ${seed} 實驗線匯出的碼的水管 ${wp.length} 格 ≠ 本線 ${m.wp.length}`); }
      tallies.push(`${seed}：水管 ${m.wp.length} 格（接通 ${m.wrOps.length}）、有水 ${wet}／沒水 ${dry}`);
    }
    log(!bad.length, 'D019 驗收 3：實驗線頁面實跑預建城（8 個種子）——拉水管、放水塔（實驗線自己的拉線與點）每一筆逐項相等；水管圖層、接通的水管相等；推進一天：推進前就在的住商工每一棟的電與水、住宅幸福（套垃圾與糧食）、住商工以外的格子與場、生長之前的抽取都相等；實驗線匯出的碼的水管＝本線',
      bad.slice(0, 3).join('；') || tallies.slice(0, 3).join('；') + '……');
  }

  // ---- 本線 → 實驗線讀回 ----
  {
    const bad = [];
    for (const seed of seeds) {
      const m = pre[seed], b = lab.readback[seed], S = decodeLabCode(m.code).save;
      if (b.codeHash !== fnv1a(m.code)) { bad.push(`種子 ${seed}：本線的碼跟錄樣本時不同（重跑 tools/d016-parity.mjs --set=d019）`); continue; }
      if (!b.ok) bad.push(`種子 ${seed}：實驗線讀不進本線的碼`);
      if (J(b.wp) !== J(m.wp)) bad.push(`種子 ${seed}：實驗線讀回的水管 ${b.wp.length} 格 ≠ 本線 ${m.wp.length}`);
      if (J(b.measure) !== J(cityStats(cityFromLab(S, KT, m.code)))) bad.push(`種子 ${seed}：實驗線讀回的對帳數字 ≠ 本線`);
    }
    log(!bad.length, 'D019 驗收 3：本線的碼（拉了水管、放了水塔、推進一天）匯入實驗線：讀得進來，水管圖層與對帳數字＝本線', bad.slice(0, 3).join('；') || `${seeds.length} 張`);
  }

  // ---- 樣本城 ----
  {
    const bad = [], notes = [];
    for (const id of ['ai120', 'seed516']) {
      const m = sample19(read(`src/content/samples/${id}.code.txt`).trim(), KT, vrank), L = lab.samples[id];
      if (m.mig !== L.mig) bad.push(`${id} 讀檔重挑外觀 ${m.mig} ≠ ${L.mig}`);
      for (const k of ['wp', 'wr', 'pw', 'wa']) if (J(m[k]) !== J(L[k])) bad.push(`${id} ${k} 不同`);
      const ds = sharedOff(L.tickSites, m.tickSites, PRE_GROWTH_LINES.map(String)); if (ds) bad.push(`${id} 生長之前的抽取：${ds}`);
      notes.push(`${id} 水管 ${m.wp.length} 格、接通 ${m.wr.length}、有水 ${m.wa.filter(q => q[1]).length}／${m.wa.length}`);
    }
    log(!bad.length, 'D019 驗收 4：讀進來的城（AI 城 120 天、種子城）推進一天——每一棟住商工與社宅的電與水、接通的水管、水管圖層、讀檔重挑外觀的棟數、生長之前的抽取＝實驗線讀同一張碼推進一天',
      bad.slice(0, 3).join('；') || notes.join('；'));
  }
}
