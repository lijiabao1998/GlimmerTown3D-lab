// D020 驗收 3、4：實驗線頁面實跑錨點（src/content/samples/d020-lab.json，tools/d016-parity.mjs --set=d020 錄）跟本線同一份劇本逐項比。
//   預建城（8 個種子，500 人以下）：劇本（tools/d020-ops.mjs：一座接路的垃圾場、一座不接路的）每一筆、做完之後的設施、推進一天：
//     住商工以外的格子與場、推進前就在的住商工有電、生長之前的抽取；推進前就在的每一棟住宅的幸福直接相等（只剩糧食那一項要套）；
//     垃圾量、容量、比例、全城懲罰、太遠／沒清運的棟數、清運區數、正式清運、評分用的比例、評分的垃圾那一項＝實驗線；
//     實驗線垃圾那一段的輸入代進本線 garbageDay，輸出（含每一棟住宅的幸福、城市幸福、偏遠的棟數）逐位相等；
//     本線的碼（劇本＋推進一天）匯入實驗線：讀得進來，設施（兩座垃圾場）與對帳數字＝本線。
//   讀進來的城（AI 城 120 天、種子城；兩座都是正式清運）：實驗線垃圾那一段的輸入代進本線 garbageDay，輸出逐位相等；
//     AI 城本線自己推進一天（人口兩邊相同）的垃圾數字也＝實驗線。種子城本線人口少算住宅塔、巨廈（第 3 類，卡面「沒做成的事」），只量不判。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { loadCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { PRE_GROWTH_LINES } from './d011-parity-lib.mjs';
import { batchDiff, sharedOff } from './unit-d011-parity.mjs';
import { prebuilt20, sampleTiles, garbFromLab } from './d020-ops.mjs';
import { civvOf } from './d016-ops.mjs';

const J = JSON.stringify, isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);   // 實驗線 37219
const GA_KEYS = ['garbage', 'garbCap', 'garbRatio', 'garbPen409', 'far', 'unserved', 'warn', 'dec', 'districts', 'formal', 'cityHappy', 'h'];
const pickGa = x => GA_KEYS.map(k => x?.[k]);
const garbScoreOf = r => r <= 1 ? 10 : Math.max(0, 10 - (r - 1) * 20);   // 56117
const mine = g => [g.amount, g.cap, g.ratio, g.pen, g.far, g.unserved, g.dec, g.districts, g.formal];
const labOf = a => [a.garbage, a.garbCap, a.garbRatio, a.garbPen409, a.far, a.unserved, a.dec, a.districts, a.formal];

export async function d020ParityGuards(log) {
  const read = p => fs.readFileSync(path.resolve(ROOT, p), 'utf8'), file = 'src/content/samples/d020-lab.json';
  if (!fs.existsSync(path.join(ROOT, file))) { log(false, 'D020 實驗線實跑錨點', `${file} 不存在：跑 tools/d016-parity.mjs --set=d020`); return; }
  const lab = JSON.parse(read(file)), seeds = lab.seeds ?? [];
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim();
  const src = `實驗線 ${String(lab.source?.commit).slice(0, 7)} v${lab.source?.version}`;

  // ---- 欄位齊全 ----
  {
    const bad = [], arr = v => Array.isArray(v), gaOk = a => isObj(a) && GA_KEYS.every(k => k in a) && arr(a.h), gbOk = b => isObj(b) && arr(b.b) && Number.isFinite(b.pop) && Number.isFinite(b.jobsI);
    if (lab.source?.commit !== 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0') bad.push('source.commit');
    if (lab.source?.tool !== 'tools/d016-parity.mjs --set=d020') bad.push('source.tool');
    if (!(arr(seeds) && seeds.length >= 8 && seeds.every(Number.isInteger))) bad.push('seeds（要 ≥ 8 個）');
    for (const seed of seeds) {
      const q = lab.prebuilt?.[seed], b = lab.readback?.[seed];
      if (!isObj(q) || !arr(q.ops) || !arr(q.civvOps) || !arr(q.pw) || !arr(q.hs) || !isObj(q.inv) || !isObj(q.probe) || !isObj(q.tickSites) || !gbOk(q.gb) || !gaOk(q.ga) || !Number.isFinite(q.garbScore)) bad.push(`種子 ${seed} prebuilt`);
      if (!isObj(b) || typeof b.ok !== 'boolean' || !arr(b.civv) || !isObj(b.measure) || !/^[0-9a-f]{8}$/.test(b.codeHash ?? '')) bad.push(`種子 ${seed} readback`);
    }
    for (const id of ['ai120', 'seed516']) { const x = lab.samples?.[id]; if (!isObj(x) || !gbOk(x.gb) || !gaOk(x.ga)) bad.push(`樣本城 ${id}`); }
    log(!bad.length, `D020 對拍樣本欄位齊全（${seeds.length} 個種子）：預建城逐筆、設施、推進後每一棟的幸福、探針、垃圾那一段的輸入與輸出、評分；樣本城兩座；讀回`,
      bad.slice(0, 4).join('；') || `${src}；${seeds.length} 個種子`);
    if (bad.length) { log(false, 'D020 對拍：欄位不齊，後面的逐項比對都不跑', '先重跑 tools/d016-parity.mjs --set=d020'); return; }
  }

  // ---- 預建城 ----
  const pre = {};
  for (const seed of seeds) pre[seed] = prebuilt20(codeWithSeed(prebuilt, seed), KT, vrank);
  {
    const bad = [], tallies = [];
    for (const seed of seeds) {
      const m = pre[seed], L = lab.prebuilt[seed], q = L.probe;
      for (const [name, a, b] of [['開跑前', m.snap0, L.snap0], ['劇本後', m.snapOps, L.snapOps]]) if (J(a) !== J(b)) bad.push(`種子 ${seed} ${name}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
      const d = batchDiff(m.ops, L.ops, true); if (d) bad.push(`種子 ${seed} 劇本${d}`);
      if (J(m.civvOps) !== J(L.civvOps)) bad.push(`種子 ${seed} 劇本後的設施不同`);
      const dumps = m.civvOps.filter(r => r[1] === 8).map(r => r[0]);
      if (J(dumps) !== J([m.P.on, m.P.off].sort((a, b) => a - b))) bad.push(`種子 ${seed}：垃圾場 ${J(dumps)}（要在 ${m.P.on}、${m.P.off}）`);
      if (J(m.inv) !== J(L.inv)) bad.push(`種子 ${seed} 推進後（住商工以外、覆蓋、地價）不同`);
      if (m.tickLand !== L.tickLand) bad.push(`種子 ${seed}：推進開頭地價框改了 本線 ${m.tickLand} ≠ 實驗線 ${L.tickLand} 格`);
      const ds = sharedOff(L.tickSites, m.tickSites, PRE_GROWTH_LINES.map(String)); if (ds) bad.push(`種子 ${seed} 推進那一天生長之前的抽取：${ds}`);
      const oldP = new Set(m.pwBefore), pick = x => J(x.filter(([i]) => oldP.has(i)));
      if (pick(m.pw) !== pick(L.pw)) bad.push(`種子 ${seed} 推進前就在的住商工有電不同`);
      // 垃圾的數字：本線這一天的回報＝實驗線那一段的輸出
      if (J(mine(m.garb)) !== J(labOf(L.ga))) bad.push(`種子 ${seed} 垃圾（量、容量、比例、懲罰、太遠、沒清運、評分用、區數、正式）本線 ${J(mine(m.garb))} ≠ 實驗線 ${J(labOf(L.ga))}`);
      if (garbScoreOf(m.garb.dec) !== L.garbScore) bad.push(`種子 ${seed} 評分的垃圾那一項 本線 ${garbScoreOf(m.garb.dec)} ≠ 實驗線 ${L.garbScore}`);
      // 推進前就在的每一棟住宅：實驗線 h＝本線 h 套糧食（55414–55419，第 2 類沒搬）
      const homes = new Set(m.hsBefore), res = m.hs.filter(([i]) => homes.has(i)), labH = new Map(L.hs), food = clamp((q.foodSupplyRate482 - .50) * .11, -.06, .05);
      for (const [i, h] of res) { const want = clamp(h + food, .05, 1); if (!Object.is(labH.get(i), want)) bad.push(`種子 ${seed} 第 ${i} 格住宅：實驗線 h ${labH.get(i)} ≠ 本線 ${h} 套糧食 ${want}`); }
      // 實驗線那一段的輸入代進本線 garbageDay：輸出逐位相等
      const g = garbFromLab(m.tiles0, L.gb);
      if (g.bad.length) bad.push(`種子 ${seed} 代入：${g.bad.slice(0, 2).join('；')}`);
      if (J(pickGa(g.ga)) !== J(pickGa(L.ga))) bad.push(`種子 ${seed} 代入實驗線的輸入：本線 ${J(pickGa(g.ga)).slice(0, 200)} ≠ 實驗線 ${J(pickGa(L.ga)).slice(0, 200)}`);
      // 有意義：兩座垃圾場都算容量（500 以下）；接路那一座讓太遠的住宅變 0（沒有垃圾場時每一棟都太遠，D016／D019 的探針）
      if (!(L.ga.garbCap === 80 && L.ga.far === 0 && res.length > 0 && !L.ga.formal)) bad.push(`種子 ${seed}：容量 ${L.ga.garbCap}、太遠 ${L.ga.far}、住宅 ${res.length}、正式 ${L.ga.formal}`);
      tallies.push(`${seed}：住宅 ${res.length} 棟、垃圾 ${L.ga.garbage.toFixed(2)}／${L.ga.garbCap}、評分垃圾 ${L.garbScore}`);
    }
    log(!bad.length, 'D020 驗收 3：實驗線頁面實跑預建城（8 個種子）——放兩座垃圾場（接路、不接路）每一筆逐項相等、設施相等；推進一天：住商工以外的格子與場、推進前就在的住商工有電、生長之前的抽取相等；推進前就在的每一棟住宅的幸福直接相等（只套糧食）；垃圾量、容量、比例、懲罰、太遠與沒清運的棟數、清運區數、評分用的比例、評分的垃圾那一項＝實驗線；實驗線那一段的輸入代進本線，輸出逐位相等',
      bad.slice(0, 3).join('；') || tallies.slice(0, 3).join('；') + '……');
  }

  // ---- 本線 → 實驗線讀回 ----
  {
    const bad = [];
    for (const seed of seeds) {
      const m = pre[seed], b = lab.readback[seed], S = decodeLabCode(m.code).save;
      if (b.codeHash !== fnv1a(m.code)) { bad.push(`種子 ${seed}：本線的碼跟錄樣本時不同（重跑 tools/d016-parity.mjs --set=d020）`); continue; }
      if (!b.ok) bad.push(`種子 ${seed}：實驗線讀不進本線的碼`);
      if (J(b.civv) !== J(civvOf(m.sim.w.tiles))) bad.push(`種子 ${seed}：實驗線讀回的設施 ≠ 本線`);
      if (!b.civv.some(r => r[0] === m.P.on && r[1] === 8) || !b.civv.some(r => r[0] === m.P.off && r[1] === 8)) bad.push(`種子 ${seed}：實驗線讀回的設施沒有兩座垃圾場`);
      if (J(b.measure) !== J(cityStats(cityFromLab(S, KT, m.code)))) bad.push(`種子 ${seed}：實驗線讀回的對帳數字 ≠ 本線`);
    }
    log(!bad.length, 'D020 驗收 3：本線的碼（放了兩座垃圾場、推進一天）匯入實驗線：讀得進來，設施（含兩座垃圾場）與對帳數字＝本線', bad.slice(0, 3).join('；') || `${seeds.length} 張`);
  }

  // ---- 讀進來的城 ----
  {
    const bad = [], notes = [];
    for (const id of ['ai120', 'seed516']) {
      const code = read(`src/content/samples/${id}.code.txt`).trim(), L = lab.samples[id];
      const g = garbFromLab(sampleTiles(code, KT, vrank), L.gb);
      if (g.bad.length) bad.push(`${id} 代入：${g.bad.slice(0, 2).join('；')}`);
      if (J(pickGa(g.ga)) !== J(pickGa(L.ga))) bad.push(`${id} 代入實驗線的輸入：本線 ${J(pickGa(g.ga)).slice(0, 200)} ≠ 實驗線 ${J(pickGa(L.ga)).slice(0, 200)}`);
      if (!L.ga.formal) bad.push(`${id}：實驗線不是正式清運（要比到 500 人以上那一支）`);
      const s = loadCode(code, KT, vrank).sim, r = stepDay(s);
      const same = J(mine(r.garb)) === J(labOf(L.ga));
      if (id === 'ai120' && !same) bad.push(`ai120 本線自己推進一天的垃圾 ${J(mine(r.garb))} ≠ 實驗線 ${J(labOf(L.ga))}`);
      notes.push(`${id}：實驗線人口 ${L.gb.pop}、本線 ${r.pop}；垃圾 ${L.ga.garbage}／${L.ga.garbCap}、清運區 ${L.ga.districts}、太遠 ${L.ga.far}、沒清運 ${L.ga.unserved}、偏遠 ${L.ga.warn} 棟；住宅 ${L.ga.h.length} 棟逐位相等；本線自己推進 ${same ? '也相等' : '不同（人口少算住宅塔、巨廈）'}`);
    }
    log(!bad.length, 'D020 驗收 4：讀進來的城（AI 城 120 天、種子城，兩座都是正式清運）——實驗線垃圾那一段的輸入代進本線 garbageDay，垃圾量、容量、比例、懲罰、太遠／沒清運／偏遠的棟數、評分用的比例、清運區數、城市幸福與每一棟住宅的幸福逐位相等；AI 城本線自己推進一天的垃圾數字也相等',
      bad.slice(0, 3).join('；') || notes.join('；'));
  }
}
