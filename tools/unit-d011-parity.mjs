// D011 Node 守衛（驗收 3、4）：實驗線實跑錨點與分享碼互通。實驗線那一半是離線錄的（tools/d011-parity.mjs → d011-lab.json，要 Chrome），
// 本線那一半每次在這裡重算（tools/d011-parity-lib.mjs parity3d），逐項比。由 tools/unit.mjs 呼叫。
//   精確相等：A 段（開跑前）與 B 段（第 1 天後）每一筆的資金（不取整）、亂數抽取數、格子雜湊、場雜湊、地價髒狀態、變了哪些格；
//             第 1 天那一列（D010 的 21 欄＋有電棟數）；實驗線匯出的碼本線解碼＝實驗線自己的對帳數字；本線匯出的碼實驗線讀回＝本線的對帳數字；
//             附加欄位 d3 有沒有，實驗線讀回都一樣。
//   只量不判：第 1 天的資金（本線第 2 類乘數固定 1、沒有進口；差額照列）、第 2 天以後的逐日數字（均值 ± 標準差、第一個分岔日）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { ROW_FIELDS, parity3d, meanSd, class2Of } from './d011-parity-lib.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;

// 兩邊的一段操作逐筆比：第一個不同的地方（哪一筆、哪一項）
export function batchDiff(a, b, detail) {
  if (a.length !== b.length) return `筆數 ${a.length} ≠ ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = b[i];
    for (const k of ['k', 'money', 'draws', 'tileHash', 'fieldHash', 'land']) if (!Object.is(p[k], q[k])) return `第 ${i + 1} 筆 ${p.k}：${k} 本線 ${J(p[k])} ≠ 實驗線 ${J(q[k])}`;
    if (J(p.found) !== J(q.found)) return `第 ${i + 1} 筆 pick：${J(p.found)} ≠ ${J(q.found)}`;
    const n = x => typeof x === 'number' ? x : x.length;
    if (n(p.changed) !== n(q.changed)) return `第 ${i + 1} 筆 ${p.k}：變了 ${n(p.changed)} 格 ≠ ${n(q.changed)} 格`;
    if (detail && typeof q.changed !== 'number' && J(p.changed) !== J(q.changed)) {
      const j = p.changed.findIndex((c, m) => J(c) !== J(q.changed[m]));
      return `第 ${i + 1} 筆 ${p.k}：第 ${p.changed[j]?.[0]} 格 本線 ${J(p.changed[j]?.[1])} ≠ 實驗線 ${J(q.changed[j]?.[1])}`;
    }
  }
  return null;
}

// opts.dir／opts.code：除錯時改讀別處的樣本與起點碼（tools/d011-parity.mjs --out／--code）
export async function d011ParityGuards(log, opts = {}) {
  const dir = opts.dir ?? 'src/content/samples', labPath = `${dir}/d011-lab.json`;
  if (!fs.existsSync(path.join(ROOT, labPath))) { log(false, 'D011 實驗線實跑錨點', `${labPath} 不存在：跑 tools/d011-parity.mjs`); return; }
  const lab = JSON.parse(read(labPath)), mine3d = JSON.parse(read(`${dir}/d011-3d.json`));
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
  const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const newcity = read(opts.code ?? 'src/content/samples/newcity.code.txt').trim(), seeds = lab.seeds, src = `實驗線 ${lab.source.commit.slice(0, 7)} v${lab.source.version}`;
  const mine = {};
  for (const seed of seeds) mine[seed] = parity3d(codeWithSeed(newcity, seed), KT, vrank, lab.days);

  // 驗收 3：兩批操作之後逐格、資金（完全相等）、各種場都相等
  {
    const bad = [];
    let ops = 0;
    for (const seed of seeds) {
      const m = mine[seed], L = lab.runs[seed];
      for (const [name, a, b] of [['開跑前', m.snap0, L.snap0], ['A 段後', m.snapA, L.snapA], ['B 段後', m.snapB, L.snapB]]) if (J(a) !== J(b)) bad.push(`種子 ${seed} ${name}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
      const dA = batchDiff(m.A, L.A, seed === seeds[0]), dB = batchDiff(m.B, L.B, seed === seeds[0]);
      if (dA) bad.push(`種子 ${seed} A 段${dA}`);
      if (dB) bad.push(`種子 ${seed} B 段${dB}`);
      ops += m.A.length + m.B.length;
    }
    const tally = {}; for (const o of [...lab.runs[seeds[0]].A, ...lab.runs[seeds[0]].B]) tally[o.k] = (tally[o.k] || 0) + 1;
    log(bad.length === 0, `實驗線實跑錨點：新城 × ${seeds.length} 個種子，開跑前一批（${lab.runs[seeds[0]].A.length} 筆）、推進第 1 天、推進後一批（${lab.runs[seeds[0]].B.length} 筆），每一筆之後的資金（不取整）、亂數抽取數、逐格、覆蓋與污染場、地價髒框都相等（${src}，實驗線用它自己的拉線／框選／點／復原）`,
      bad.slice(0, 2).join('；') || `${ops} 筆全等；種類 ${J(tally)}`);
  }
  // 第 1 天那一列：D010 的 21 欄＋有電棟數逐項相等；資金另比（本線乘數 1、沒有進口）
  {
    const bad = [], money = [];
    for (const seed of seeds) {
      const a = mine[seed].day1, b = lab.runs[seed].day1, n = ROW_FIELDS.indexOf('money');
      const off = ROW_FIELDS.filter((f, i) => f !== 'money' && !Object.is(a[i], b[i]));
      if (off.length) bad.push(`種子 ${seed}：${off.map(f => `${f} ${a[ROW_FIELDS.indexOf(f)]}≠${b[ROW_FIELDS.indexOf(f)]}`).join(',')}`);
      money.push(a[n] - b[n]);
    }
    log(bad.length === 0, `第 1 天那一列：D010 的 21 欄＋有電的住商工棟數，${seeds.length} 個種子逐項相等`, bad.slice(0, 2).join('；') || `有電 ${seeds.map(s => lab.runs[s].day1.at(-1)).join('、')} 棟`);
    const [m, sd] = meanSd(money), p = lab.runs[seeds[0]].probe1 || {};
    log(true, '第 1 天的資金（只量不判）：本線第 2 類乘數固定 1、沒有進口，比實驗線多的錢', `本線−實驗線 ${m.toFixed(4)} ± ${sd.toFixed(4)}；實驗線第 1 天進口 鋼 ${p.steelImportCost482} 糧 ${p.foodImportCost482}、goodsMul284 ${p.goodsMul284}、commerceSalesMul481 ${p.commerceSalesMul481}、industrialMarketMul481 ${p.industrialMarketMul481}`);
    // 代入實驗線那一天的第 2 類值（探針讀的），本線公式算出的收入、維護費、結算後資金要跟實驗線逐位相等：證明公式和輸入都對
    const off = [];
    for (const seed of seeds) {
      const L = lab.runs[seed], q = L.probe1;
      if (!q) { off.push(`種子 ${seed}：沒有探針`); continue; }
      const r = parity3d(codeWithSeed(newcity, seed), KT, vrank, 1, { class2: class2Of(q) }), n = ROW_FIELDS.indexOf('money');
      const got = [r.settle1.income, r.settle1.upkeep, r.day1[n]], want = [q.income, q.upkeep, L.day1[n]];
      if (!got.every((v, i) => Object.is(v, want[i]))) off.push(`種子 ${seed}：收入／維護費／資金 本線 ${J(got)} ≠ 實驗線 ${J(want)}`);
    }
    log(off.length === 0, `第 1 天的資金：把實驗線當天的第 2 類乘數與進口費代進本線公式，收入、維護費、結算後資金跟實驗線完全相等（${seeds.length} 個種子）`,
      off.slice(0, 2).join('；') || `例：種子 ${seeds[0]} 收入 ${p.income}、維護費 ${p.upkeep}（其中進口 ${p.steelImportCost482 + p.foodImportCost482}）`);
  }
  // 驗收 4：分享碼互通
  {
    const bad = [];
    for (const seed of seeds) {
      const L = lab.runs[seed], r = decodeLabCode(L.codeB);
      if (!r.ok) { bad.push(`種子 ${seed}：實驗線匯出的碼本線解不開 ${r.error}`); continue; }
      const st = cityStats(cityFromLab(r.save, KT, L.codeB));
      if (J(st) !== J(L.measureB)) bad.push(`種子 ${seed}：實驗線 → 本線 對帳數字不同`);
      const rc = {}; const c = cityFromLab(r.save, KT, L.codeB); for (let i = 0; i < c.n * c.n; i++) if (c.road[i]) rc[c.rclass[i]] = (rc[c.rclass[i]] || 0) + 1;
      if (J(rc) !== J(L.rcB)) bad.push(`種子 ${seed}：實驗線 → 本線 道路等級不同`);
      if (r.save.money !== Math.round(L.snapB.money) || r.save.df !== 1) bad.push(`種子 ${seed}：實驗線匯出的資金 ${r.save.money}／難度 ${r.save.df}`);
      // 本線 → 實驗線：本線 B 段後的碼，實驗線讀回的數字＝本線（錄的時候那張碼要跟現在算出來的一樣，不一樣就是樣本過期）
      const rb = lab.readback[seed], code = mine[seed].codeB, S = decodeLabCode(code).save;
      if (rb.codeHash !== fnv1a(code)) { bad.push(`種子 ${seed}：本線 B 段後的碼跟錄樣本時不同（重跑 tools/d011-parity.mjs）`); continue; }
      const my = cityStats(cityFromLab(S, KT, code));
      if (!rb.withD3.ok || J(rb.withD3.measure) !== J(my)) bad.push(`種子 ${seed}：本線 → 實驗線 對帳數字不同`);
      if (rb.withD3.money !== S.money || rb.withD3.diff !== S.df || rb.withD3.star !== S.star || rb.withD3.msIdx !== S.msIdx || rb.withD3.day !== S.day) bad.push(`種子 ${seed}：本線 → 實驗線 資金／難度／星等／里程碑／天數 ${J([rb.withD3.money, rb.withD3.diff, rb.withD3.star, rb.withD3.msIdx, rb.withD3.day])} ≠ ${J([S.money, S.df, S.star, S.msIdx, S.day])}`);
      const strip = o => { const { ok, ...rest } = o; void ok; return J(rest); };
      if (strip(rb.withD3) !== strip(rb.plain)) bad.push(`種子 ${seed}：附加欄位 d3 改變了實驗線讀回的結果`);
    }
    log(bad.length === 0, `分享碼互通：實驗線照同一串操作蓋完匯出的碼，本線讀回＝實驗線自己的對帳數字與道路等級；本線蓋完匯出的碼（帶 d3 歷史），實驗線讀回＝本線（路、分區、建築、道路等級、資金、天數、難度、星等、里程碑）；拿掉 d3 讀回完全一樣（${seeds.length} 個種子）`,
      bad.slice(0, 2).join('；') || `${seeds.length * 3} 張碼`);
  }
  // 回歸錨點：本線 8 個種子的整段（兩批操作、第 1 天、逐日數字）＝d011-3d.json（卡面對照表的本線數字）
  {
    const bad = [];
    for (const seed of seeds) {
      const a = mine[seed], b = mine3d.runs[seed];
      const strip = r => J({ ...r, sim: undefined, A: r.A.map(o => ({ ...o, changed: typeof o.changed === 'number' ? o.changed : o.changed.length })), B: r.B.map(o => ({ ...o, changed: typeof o.changed === 'number' ? o.changed : o.changed.length })) });
      if (strip(a) !== strip(b)) bad.push(`種子 ${seed}`);
    }
    log(bad.length === 0, `回歸錨點：本線 ${seeds.length} 個種子的整段（兩批操作、第 1 天、${lab.days} 天逐日數字、匯出的碼）＝d011-3d.json`, bad.join('、') || '相同');
  }
  // 第 2 天以後：只量不判（均值 ± 標準差、第一個分岔日）
  {
    const first = seeds.map(seed => { const a = mine[seed].rows, b = lab.runs[seed].rows; const d = a.findIndex((r, i) => J(r.slice(0, 21)) !== J(b[i]?.slice(0, 21))); return d < 0 ? null : a[d][0] - 1; });
    const at = d => {   // 第 d 天＝推進 d 次之後（D010 的算法），那一列的 day 欄是 d＋1
      const pick = (runs, f) => seeds.map(s => runs(s).find(r => r[0] === d + 1)?.[ROW_FIELDS.indexOf(f)]).filter(v => v !== undefined);
      return ['pop', 'jobs', 'money', 'R', 'C', 'I'].map(f => { const [m1] = meanSd(pick(s => mine[s].rows, f)), [m2] = meanSd(pick(s => lab.runs[s].rows, f)); return `${f} ${m1.toFixed(0)}/${m2.toFixed(0)}`; }).join(' ');
    };
    log(true, `第 2 天以後只量不判（本線/實驗線 均值；第一個分岔日）`, `第一個分岔日 ${first.join('、')}；第 30 天 ${at(30)}；第 ${lab.days} 天 ${at(lab.days)}`);
  }
  return { mine };
}
