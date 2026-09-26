// D011 Node 守衛（驗收 3、4）：實驗線實跑錨點與分享碼互通。實驗線那一半是離線錄的（tools/d011-parity.mjs → d011-lab.json，要 Chrome），
// 本線那一半每次在這裡重算（tools/d011-parity-lib.mjs parity3d、prebuilt3d），逐項比。由 tools/unit.mjs 呼叫。
//   精確相等：新城 A 段（開跑前）、B 段（第 1 天後）與預建城拆除劇本，每一筆的資金（不取整）、亂數抽取數、格子雜湊、場雜湊（含地價 LANDBASE、LAND）、
//             地價髒狀態、變了哪些格；新城推進第 1 天之後的快照（snap1）與逐行的亂數抽取（實驗線多的只在起火、犯罪、生病擲骰三行，次數照推進後的格子算）；
//             預建城推進一天之後在第 2 類系統起作用之前就定案的部分（推進前就在的住商工有沒有電、住商工以外的格、覆蓋、地價、天氣與洗牌的抽取），
//             以及兩邊住宅幸福的差＝實驗線的垃圾與糧食（第 2 類）那三項（逐位）；
//             第 1 天那一列（D010 的 21 欄＋有電棟數）；實驗線匯出的碼本線解碼＝實驗線自己的對帳數字；本線匯出的碼＝實驗線 B 段後自己量的城，實驗線讀回＝本線的對帳數字。
//   劇本不空跑：每個種子上 pick 都找到住商工；每一筆施工「有沒有改到格子或資金」跟劇本註明的一樣（nop）；地價框推進時真的改了格子；快速路真的過了河。
//   錄製時實驗線讀回的事實（兩邊都是錄的值；CI 只核對讀回的那兩張碼就是本線現在算出來的碼與它拿掉 d3 的版本）：附加欄位 d3 有沒有，實驗線讀回都一樣。
//   只量不判：第 1 天的資金（本線第 2 類乘數固定 1、沒有進口；差額照列）、預建城推進那一天的生長與升級（幸福不同，生長機率就不同）、
//             第 2 天以後的逐日數字（均值 ± 標準差、第一個分岔日）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, encodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { ROW_FIELDS, PROJ_FIELDS, EXTRA_LINES, PRE_GROWTH_LINES, labSitesOf, parity3d, prebuilt3d, opsOf, prebuiltOf, meanSd, class2Of } from './d011-parity-lib.mjs';

const J = JSON.stringify;
const cnt = x => typeof x === 'number' ? x : x.length;

// 兩邊的一段操作逐筆比：第一個不同的地方（哪一筆、哪一項）
export function batchDiff(a, b, detail) {
  if (a.length !== b.length) return `筆數 ${a.length} ≠ ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = b[i];
    for (const k of ['k', 'money', 'draws', 'tileHash', 'fieldHash', 'land']) if (!Object.is(p[k], q[k])) return `第 ${i + 1} 筆 ${p.k}：${k} 本線 ${J(p[k])} ≠ 實驗線 ${J(q[k])}`;
    if (J(p.found) !== J(q.found)) return `第 ${i + 1} 筆 pick：${J(p.found)} ≠ ${J(q.found)}`;
    if (cnt(p.changed) !== cnt(q.changed)) return `第 ${i + 1} 筆 ${p.k}：變了 ${cnt(p.changed)} 格 ≠ ${cnt(q.changed)} 格`;
    if (detail && typeof q.changed !== 'number' && J(p.changed) !== J(q.changed)) return `第 ${i + 1} 筆 ${p.k}：${cellsDiff(p.changed, q.changed)}`;
  }
  return null;
}
// 兩份「變了的格」（[格索引, 投影]）逐格比：第一個不同的格與欄位
export function cellsDiff(a, b) {
  const m = new Map(b.map(([i, p]) => [i, p]));
  for (const [i, p] of a) {
    const q = m.get(i);
    if (!q) return `第 ${i} 格只有本線變了 ${J(p)}`;
    const f = PROJ_FIELDS.filter((_, j) => p[j] !== q[j]);
    if (f.length) return `第 ${i} 格 ${f.map(k => `${k} 本線 ${p[PROJ_FIELDS.indexOf(k)]}≠實驗線 ${q[PROJ_FIELDS.indexOf(k)]}`).join(',')}`;
    m.delete(i);
  }
  return m.size ? `第 ${[...m.keys()][0]} 格只有實驗線變了` : null;
}
// 一段操作裡的施工與復原（money、seed、pick 不算）每一筆有沒有改到東西（格子或資金），跟劇本的 nop 對照；m0＝這一段開頭的資金
export function effectOf(list, recs, m0) {
  let prev = m0; const out = [];
  list.forEach((o, i) => { const r = recs[i]; if (!['money', 'seed', 'pick'].includes(o.k)) out.push({ i, eff: cnt(r.changed) > 0 || !Object.is(r.money, prev), want: !o.nop }); prev = r.money; });
  return out;
}
// 推進一天的亂數抽取，兩邊都記了每一次抽取的呼叫行號（實驗線＝index.html 行號；本線＝src 行號，SITE_MAP 對到實驗線那一行）。
// extraOff：EXTRA_LINES 那三行（起火 55772、犯罪 55817、生病 55850）實驗線記下的次數＝用某一邊推進後的格子算的次數（EXTRA_SRC）
export function extraOff(sites, extra) {
  const bad = [];
  for (const k of ['fire', 'crime', 'disease']) if ((sites[EXTRA_LINES[k]] ?? 0) !== extra[k]) bad.push(`${EXTRA_LINES[k]} 行 ${sites[EXTRA_LINES[k]] ?? 0} 次 ≠ 算出來的 ${extra[k]}`);
  return bad.length ? bad.join('，') : null;
}
// sharedOff：其餘行逐行＝本線對到的那一行（only＝只比這幾行）；本線有對不到實驗線的呼叫位置就紅
export function sharedOff(sites, mySites, only) {
  const mine = labSitesOf(mySites), extra = Object.values(EXTRA_LINES), bad = Object.keys(mine).filter(l => l.startsWith('?')).map(l => `本線 ${l.slice(1)} 對不到實驗線的行`);
  const lines = only ?? [...new Set([...Object.keys(sites), ...Object.keys(mine)])].filter(l => !l.startsWith('?') && !extra.includes(+l));
  for (const l of lines) if ((sites[l] ?? 0) !== (mine[l] ?? 0)) bad.push(`${l} 行實驗線 ${sites[l] ?? 0} 次 ≠ 本線 ${mine[l] ?? 0} 次`);
  return bad.length ? bad.join('，') : null;
}
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);   // 實驗線 37219

// opts.dir／opts.code：除錯時改讀別處的樣本與起點碼（tools/d011-parity.mjs --out／--code）
export async function d011ParityGuards(log, opts = {}) {
  const dir = path.resolve(ROOT, opts.dir ?? 'src/content/samples'), labPath = path.join(dir, 'd011-lab.json');
  const read = p => fs.readFileSync(path.resolve(ROOT, p), 'utf8');
  if (!fs.existsSync(labPath)) { log(false, 'D011 實驗線實跑錨點', `${labPath} 不存在：跑 tools/d011-parity.mjs`); return; }
  const lab = JSON.parse(read(labPath)), mine3d = JSON.parse(read(path.join(dir, 'd011-3d.json')));
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
  const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const newcity = read(opts.code ?? 'src/content/samples/newcity.code.txt').trim(), prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim();
  const seeds = lab.seeds, src = `實驗線 ${lab.source.commit.slice(0, 7)} v${lab.source.version}`, ops = opsOf(newcity), P = prebuiltOf(prebuilt);
  const mine = {}, pre = {};
  for (const seed of seeds) { mine[seed] = parity3d(codeWithSeed(newcity, seed), KT, vrank, lab.days); pre[seed] = prebuilt3d(codeWithSeed(prebuilt, seed), KT, vrank); }
  const labPre = lab.prebuilt ?? {};

  // 驗收 3：兩批操作之後逐格、資金（完全相等）、各種場都相等；推進第 1 天之後（snap1，場含地價 LANDBASE／LAND）也相等
  {
    const bad = [];
    let n = 0;
    for (const seed of seeds) {
      const m = mine[seed], L = lab.runs[seed];
      for (const [name, a, b] of [['開跑前', m.snap0, L.snap0], ['A 段後', m.snapA, L.snapA], ['推進第 1 天後', m.snap1, L.snap1], ['B 段後', m.snapB, L.snapB]]) if (J(a) !== J(b)) bad.push(`種子 ${seed} ${name}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
      const dA = batchDiff(m.A, L.A, seed === seeds[0]), dB = batchDiff(m.B, L.B, seed === seeds[0]);
      if (dA) bad.push(`種子 ${seed} A 段${dA}`);
      if (dB) bad.push(`種子 ${seed} B 段${dB}`);
      n += m.A.length + m.B.length;
    }
    const tally = {}; for (const o of [...ops.A, ...ops.B]) tally[o.k] = (tally[o.k] || 0) + 1;
    log(bad.length === 0, `實驗線實跑錨點：新城 × ${seeds.length} 個種子，開跑前一批（${ops.A.length} 筆）、推進第 1 天、推進後一批（${ops.B.length} 筆，開頭兩邊亂數對齊），每一筆之後的資金（不取整）、亂數抽取數、逐格、覆蓋與污染場、地價 LANDBASE／LAND、地價髒框都相等；推進第 1 天之後的格子、場、髒狀態也相等（${src}，實驗線用它自己的拉線／框選／點／復原）`,
      bad.slice(0, 2).join('；') || `${n} 筆全等；種類 ${J(tally)}`);
  }
  // 劇本不空跑：pick 每個種子都找到住商工；每一筆施工與復原有沒有改到東西跟劇本註明的一樣；快速路真的過了河（路碼 4）
  {
    const bad = [], effA = [], effB = [], hwy = [];
    for (const seed of seeds) {
      const m = mine[seed], f = m.B.find(o => o.k === 'pick')?.found;
      if (!f) bad.push(`種子 ${seed}：B 段的 pick 沒找到住商工`);
      const a = effectOf(ops.A, m.A, 3000), b = effectOf(ops.B, m.B, m.day1[ROW_FIELDS.indexOf('money')]);
      for (const [seg, e, list] of [['A', a, ops.A], ['B', b, ops.B]]) for (const q of e) if (q.eff !== q.want) bad.push(`種子 ${seed} ${seg} 段第 ${q.i + 1} 筆 ${J(list[q.i])}：${q.want ? '應該改到東西卻沒有' : '應該什麼都不改卻改了'}`);
      effA.push(a.filter(q => q.eff).length); effB.push(b.filter(q => q.eff).length);
      if (!(m.hwyBridge > 0)) bad.push(`種子 ${seed}：A 段之後沒有快速路橋（路碼 4）`);
      hwy.push(m.hwyBridge);
    }
    const nA = ops.A.filter(o => !['money', 'seed', 'pick'].includes(o.k)).length, nB = ops.B.filter(o => !['money', 'seed', 'pick'].includes(o.k)).length;
    log(bad.length === 0 && ops.hwy.water > 0, `劇本不空跑（${seeds.length} 個種子）：B 段 pick 每個種子都找到第 1 天長出來的住商工；施工與復原每一筆「有沒有改到格子或資金」都跟劇本註明的一樣；快速路那條線經過水面、A 段之後有路碼 4 的格`,
      bad.slice(0, 3).join('；') || `有改到東西的筆數 A 段 ${effA.join('、')}／${nA}、B 段 ${effB.join('、')}／${nB}；快速路線 ${ops.hwy.cells} 格其中水面 ${ops.hwy.water} 格，路碼 4 ${hwy.join('、')} 格`);
  }
  // 第 1 天開頭的地價框：A 段最後一筆（不復原的警察局）改了覆蓋，推進時框裡真的重算出不同的 LANDBASE；兩邊改的格數相同（推進後的 LANDBASE 逐格相等在上面 snap1 的場雜湊）
  {
    const bad = [];
    for (const seed of seeds) { const a = mine[seed].tick1Land, b = lab.runs[seed].tick1Land; if (!(a > 0) || a !== b) bad.push(`種子 ${seed}：本線 ${a} 格、實驗線 ${b} 格`); }
    log(bad.length === 0, `推進第 1 天開頭的地價框重算：每個種子 LANDBASE 都有改到（> 0 格），兩邊改的格數相同`, bad.slice(0, 2).join('；') || `${seeds.map(s => mine[s].tick1Land).join('、')} 格`);
  }
  // 第 1 天的亂數抽取：實驗線－本線＝起火、犯罪、生病擲骰（第 2 類系統，都在生長之後，所以生長兩邊逐位相同）
  {
    const bad = [], offs = [];
    for (const seed of seeds) {
      const m = mine[seed], L = lab.runs[seed];
      if (!L.tick1Sites || !L.tick1Extra) { bad.push(`種子 ${seed}：樣本沒有逐行抽取紀錄（重跑 tools/d011-parity.mjs）`); continue; }
      const sum = Object.values(L.tick1Sites).reduce((a, v) => a + v, 0), e = m.tick1Extra;
      const d = [sum !== L.tick1Draws && `逐行加總 ${sum} ≠ ${L.tick1Draws}`, sharedOff(L.tick1Sites, m.tick1Sites), extraOff(L.tick1Sites, e) && `照本線的格子算：${extraOff(L.tick1Sites, e)}`,
        extraOff(L.tick1Sites, L.tick1Extra) && `照實驗線自己的格子算：${extraOff(L.tick1Sites, L.tick1Extra)}`,
        L.tick1Draws - m.tick1Draws !== e.fire + e.crime + e.disease && `實驗線−本線 ${L.tick1Draws - m.tick1Draws} ≠ ${e.fire}＋${e.crime}＋${e.disease}`].filter(Boolean);
      if (d.length) bad.push(`種子 ${seed}：${d.join('，')}`);
      offs.push(`${L.tick1Draws}−${m.tick1Draws}＝${e.fire}＋${e.crime}＋${e.disease}`);
    }
    log(bad.length === 0, `推進第 1 天的亂數抽取：兩邊逐行記呼叫位置——天氣、生長洗牌／擲骰／變體、升級每一行次數相同；實驗線多的只在起火擲骰（${EXTRA_LINES.fire}）、犯罪擲骰（${EXTRA_LINES.crime}）、生病擲骰（${EXTRA_LINES.disease}）三行（第 2 類，都在生長之後），次數＝照推進後的格子與覆蓋算的棟數（本線的格子、實驗線的格子各算一次都對）；所以實驗線－本線＝這三行的和（${seeds.length} 個種子）`,
      bad.slice(0, 2).join('；') || offs.join('、'));
  }
  // 第 1 天那一列：D010 的 21 欄＋有電棟數逐項相等；資金另比（本線乘數 1、沒有進口）
  {
    const bad = [], money = [], n = ROW_FIELDS.indexOf('money'), col = f => ROW_FIELDS.indexOf(f);
    for (const seed of seeds) {
      const a = mine[seed].day1, b = lab.runs[seed].day1;
      const off = ROW_FIELDS.filter((f, i) => f !== 'money' && !Object.is(a[i], b[i]));
      if (off.length) bad.push(`種子 ${seed}：${off.map(f => `${f} ${a[col(f)]}≠${b[col(f)]}`).join(',')}`);
      // 有電棟數＝住商工總數：第 1 天的住商工全是當天新長的，實驗線 55622 生出來就帶電（pw:true），這一欄相等是必然，不是供電對拍
      for (const [who, r] of [['本線', a], ['實驗線', b]]) if (r[col('powered')] !== r[col('R')] + r[col('C')] + r[col('I')]) bad.push(`種子 ${seed} ${who}：有電 ${r[col('powered')]} ≠ 住商工 ${r[col('R')] + r[col('C')] + r[col('I')]}`);
      money.push(a[n] - b[n]);
    }
    log(bad.length === 0, `第 1 天那一列：D010 的 21 欄逐項相等（${seeds.length} 個種子）；有電棟數兩邊都＝住商工總數——第 1 天的住商工全是當天新長的、生出來就帶電（55622），這一欄相等是必然，供電對拍在下面的預建城`,
      bad.slice(0, 2).join('；') || `住商工 ${seeds.map(s => lab.runs[s].day1.at(-1)).join('、')} 棟`);
    const [m, sd] = meanSd(money), p = lab.runs[seeds[0]].probe1 || {};
    log(true, '第 1 天的資金（只量不判）：本線第 2 類乘數固定 1、沒有進口，比實驗線多的錢', `本線−實驗線 ${m.toFixed(4)} ± ${sd.toFixed(4)}；實驗線第 1 天進口 鋼 ${p.steelImportCost482} 糧 ${p.foodImportCost482}、goodsMul284 ${p.goodsMul284}、commerceSalesMul481 ${p.commerceSalesMul481}、industrialMarketMul481 ${p.industrialMarketMul481}`);
    // 代入實驗線那一天的第 2 類值（探針讀的），本線公式算出的收入、維護費、結算後資金要跟實驗線逐位相等：證明公式和輸入都對
    const off = [];
    for (const seed of seeds) {
      const L = lab.runs[seed], q = L.probe1;
      if (!q) { off.push(`種子 ${seed}：沒有探針`); continue; }
      const r = parity3d(codeWithSeed(newcity, seed), KT, vrank, 1, { class2: class2Of(q) });
      const got = [r.settle1.income, r.settle1.upkeep, r.day1[n]], want = [q.income, q.upkeep, L.day1[n]];
      if (!got.every((v, i) => Object.is(v, want[i]))) off.push(`種子 ${seed}：收入／維護費／資金 本線 ${J(got)} ≠ 實驗線 ${J(want)}`);
    }
    log(off.length === 0, `第 1 天的資金：把實驗線當天的第 2 類乘數與進口費代進本線公式，收入、維護費、結算後資金跟實驗線完全相等（${seeds.length} 個種子）`,
      off.slice(0, 2).join('；') || `例：種子 ${seeds[0]} 收入 ${p.income}、維護費 ${p.upkeep}（其中進口 ${p.steelImportCost482 + p.foodImportCost482}）`);
  }
  // 預建城（d011-prebuilt.code.txt × 同一組種子）：拆除劇本逐筆；推進一天之後只比「在第 2 類系統起作用之前就定案」的部分（為什麼見下一段）
  {
    const bad = [], fx = [];
    const PN = decodeLabCode(prebuilt).save.n, at = ([x, z]) => z * PN + x;
    for (const seed of seeds) {
      const m = pre[seed], L = labPre[seed];
      if (!L || !L.inv) { bad.push(`種子 ${seed}：樣本沒有預建城（重跑 tools/d011-parity.mjs）`); continue; }
      // 讀檔：實驗線 load 最後重挑住商工的變體 v（T531，67035）；本線讀檔沒有這一步，對拍的本線這邊先照做（variety531），改的棟數要跟實驗線讀檔時一樣
      if (!(m.mig > 0) || m.mig !== L.mig) bad.push(`種子 ${seed}：讀檔時重挑變體 本線 ${m.mig} 棟 ≠ 實驗線 ${L.mig} 棟`);
      for (const [name, a, b] of [['開跑前', m.snap0, L.snap0], ['劇本後', m.snapOps, L.snapOps]]) if (J(a) !== J(b)) bad.push(`種子 ${seed} ${name}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
      const d = batchDiff(m.ops, L.ops, true);
      if (d) bad.push(`種子 ${seed} 劇本${d}`);
      for (const q of effectOf(P.ops, m.ops, 3000)) if (q.eff !== q.want) bad.push(`種子 ${seed} 劇本第 ${q.i + 1} 筆 ${J(P.ops[q.i])}：${q.want ? '應該改到東西卻沒有' : '應該什麼都不改卻改了'}`);
      // 框選一級＋二級：只變了一級那一格（二級略過）
      const mix = P.ops.findIndex(o => o.k === 'rect' && o.x1 > o.x0);
      if (J(m.ops[mix].changed.map(c => c[0])) !== J([at(P.pair)])) bad.push(`種子 ${seed}：框選一級＋二級變了 ${J(m.ops[mix].changed.map(c => c[0]))}，應該只有一級那一格 ${at(P.pair)}`);
      // 推進一天：地價框（開頭 54996）、供電分配（55151–55156，在幸福之前）、天氣與生長洗牌的抽取（生長擲骰之前）都跟第 2 類系統無關；
      // 格子只比住商工以外的格與住商工以外的欄、場只比覆蓋、POLTREE、LANDBASE、LAND（INV_SRC）
      if (J(m.inv) !== J(L.inv)) bad.push(`種子 ${seed} 推進後（住商工以外、覆蓋、地價）：本線 ${J(m.inv)} ≠ 實驗線 ${J(L.inv)}`);
      if (m.tickLand !== L.tickLand) bad.push(`種子 ${seed}：推進開頭地價框改了 本線 ${m.tickLand} 格 ≠ 實驗線 ${L.tickLand} 格`);
      const old = new Set(m.pwBefore), pwOld = x => J(x.filter(([i]) => old.has(i)));
      if (pwOld(m.pw) !== pwOld(L.pw)) bad.push(`種子 ${seed} 推進前就在的住商工有電：本線 ${pwOld(m.pw)} ≠ 實驗線 ${pwOld(L.pw)}`);
      // 推進前就在的住商工：有電、沒電都要有（斷掉的小巷那一段沒電），這一欄才量得到供電分配
      const on = m.pw.filter(([i, v]) => old.has(i) && v).length, off = m.pw.filter(([i, v]) => old.has(i) && !v).length;
      if (!on || !off) bad.push(`種子 ${seed}：推進前就在的住商工有電 ${on}、沒電 ${off}（兩種都要有）`);
      const sum = Object.values(L.tickSites).reduce((a, v) => a + v, 0);
      const dd = [sum !== L.tickDraws && `逐行加總 ${sum} ≠ ${L.tickDraws}`, sharedOff(L.tickSites, m.tickSites, PRE_GROWTH_LINES.map(String)), extraOff(L.tickSites, L.tickExtra)].filter(Boolean);
      if (dd.length) bad.push(`種子 ${seed} 推進那一天的抽取：${dd.join('，')}`);
      fx.push(`${on}/${off}`);
    }
    const s0 = pre[seeds[0]];
    log(bad.length === 0, `預建城拆除劇本（${seeds.length} 個種子，${P.ops.length} 筆，單格拆除都走框；讀檔時實驗線重挑住商工的變體（T531 視覺遷移，本線讀檔沒有這一步，對拍前本線照做、棟數相同））：點體育場附屬格整棟拆；二級 1 秒內再按才拆；三級過 3 秒、剛好 3 秒都重新預備，2.999 秒才拆；框選一級＋二級只拆一級；復原；拆小巷接支路那一格——每一筆兩邊逐項相等。推進一天之後比第 2 類系統起作用之前就定案的部分：推進前就在的住商工每一棟有沒有電、住商工以外的格子、覆蓋、地價 LANDBASE／LAND、天氣與生長洗牌的抽取次數，都相等；實驗線起火、犯罪、生病三行的抽取次數＝照它自己推進後的格子算的棟數`,
      bad.slice(0, 3).join('；') || `讀檔重挑變體 ${s0.mig} 棟；推進前就在的住商工有電／沒電 ${fx.join('、')}`);
  }
  // 預建城推進那一天的第 2 類差異，精確找出來：實驗線住宅的幸福在本卡的公式（55164–55236，本線 residentialHappy 逐項相同）之後，再被兩個本線沒搬的第 2 類系統改過：
  //   垃圾：沒有垃圾場時全城容量池懲罰 garbPen409＝(garbRatio−1)×.15（55270–55274），再加每一棟離垃圾場太遠 −.045（computeGarbLocal 57697 起）；
  //   糧食：+clamp((foodSupplyRate482−.5)×.11,−.06,.05)（55414–55419）。都夾在 .05..1，都在需求（55578）之前。
  // 第 1 天的新城推進前沒有住宅（人口 0、垃圾 0、糧食需求 0），所以沒有這個差。核對：推進前就在的每一棟住宅，實驗線的 h＝本線的 h 依序套這三項（逐位）。
  // 全城幸福不同 → 住宅需求 demR 不同（legacyDemand）→ 生長機率不同（55613），生長、升級、新房子的變體與後面起火／生病擲骰的次數就可能不同（哪些種子不同只量不判）
  {
    const bad = [], hap = [], full = [];
    const col = f => ROW_FIELDS.indexOf(f);
    for (const seed of seeds) {
      const m = pre[seed], L = labPre[seed], q = L?.probe;
      if (!L || !q || !L.hs) { bad.push(`種子 ${seed}：樣本沒有預建城的探針或幸福（重跑 tools/d011-parity.mjs）`); continue; }
      const old = new Set(m.pwBefore), res = m.hs.filter(([i]) => old.has(i)), labH = new Map(L.hs);
      if (!(q.garbPen409 > 0) || q.garbFar409 !== res.length || !(q.foodCoreNeed482 > 0)) bad.push(`種子 ${seed}：垃圾懲罰 ${q.garbPen409}、離垃圾場太遠的住宅 ${q.garbFar409} 棟（推進前就在的住宅 ${res.length} 棟）、糧食需求 ${q.foodCoreNeed482}`);
      const food = clamp((q.foodSupplyRate482 - .50) * .11, -.06, .05);   // 55416
      for (const [i, h] of res) {
        const want = clamp(clamp(clamp(h - q.garbPen409, .05, 1) - .045, .05, 1) + food, .05, 1);
        if (!Object.is(labH.get(i), want)) bad.push(`種子 ${seed} 第 ${i} 格住宅：實驗線 h ${labH.get(i)} ≠ 本線 ${h} −${q.garbPen409} −.045 ${food >= 0 ? '+' : ''}${food} ＝ ${want}`);
      }
      hap.push(`${m.day1[col('happy')]}/${L.day1[col('happy')]}`);
      full.push(J(m.post) === J(L.post) && !cellsDiff(m.postChanged, L.postChanged) && J(m.pw) === J(L.pw) && J(labSitesOf(m.tickSites)) === J(Object.fromEntries(Object.entries(L.tickSites).filter(([l]) => !Object.values(EXTRA_LINES).includes(+l)))));
    }
    const q0 = labPre[seeds[0]]?.probe ?? {};
    log(bad.length === 0, `預建城推進那一天的第 2 類差異（精確找出來）：實驗線住宅的幸福在本卡公式之後，再被垃圾（全城容量池懲罰 garbPen409 55270–55274、離垃圾場太遠 −.045 57697 起）與糧食（55414–55419）改過——推進前就在的每一棟住宅，實驗線的 h＝本線的 h 依序套這三項，逐位相等（${seeds.length} 個種子）；全城幸福因此不同，住宅需求與生長機率跟著不同，生長、升級只量不判`,
      bad.slice(0, 2).join('；') || `垃圾 ${q0.garbage}／容量 ${q0.garbCap}、懲罰 ${q0.garbPen409}；供糧率 ${q0.foodSupplyRate482}（幸福 ${clamp((q0.foodSupplyRate482 - .5) * .11, -.06, .05)}）；全城幸福 本線/實驗線 ${hap.join('、')}；推進後整張（含生長、升級、有電、抽取逐行）剛好全等的種子 ${full.filter(Boolean).length}/${seeds.length}`);
  }
  // 驗收 4：分享碼互通
  {
    const bad = [], fact = [], stale = [];
    for (const seed of seeds) {
      const L = lab.runs[seed], r = decodeLabCode(L.codeB);
      if (!r.ok) { bad.push(`種子 ${seed}：實驗線匯出的碼本線解不開 ${r.error}`); continue; }
      const c = cityFromLab(r.save, KT, L.codeB), st = cityStats(c);
      if (J(st) !== J(L.measureB)) bad.push(`種子 ${seed}：實驗線 → 本線 對帳數字不同`);
      const rc = {}; for (let i = 0; i < c.n * c.n; i++) if (c.road[i]) rc[c.rclass[i]] = (rc[c.rclass[i]] || 0) + 1;
      if (J(rc) !== J(L.rcB)) bad.push(`種子 ${seed}：實驗線 → 本線 道路等級不同`);
      if (r.save.money !== Math.round(L.snapB.money) || r.save.df !== 1) bad.push(`種子 ${seed}：實驗線匯出的資金 ${r.save.money}／難度 ${r.save.df}`);
      // 本線 → 實驗線：錄樣本時讀回的那兩張碼，要是本線現在算出來的碼與它拿掉 d3 的版本（雜湊都在 Node 重算）；不一樣就是樣本過期
      const rb = lab.readback[seed], code = mine[seed].codeB, S = decodeLabCode(code).save, o = { ...S.raw }, my = cityStats(cityFromLab(S, KT, code));
      // 兩邊 B 段之後是同一座城：本線匯出的碼（照格子寫）讀回的對帳數字＝實驗線自己在頁面裡量的（MEASURE）；
      // 本線的城市模型（畫面、歷史、建築卡讀的那一份，src/sim/edit.ts syncEdit／undoOp 跟著格子改）也要＝它——拆掉、復原掉的建築不能還留在城裡
      if (J(my) !== J(L.measureB)) bad.push(`種子 ${seed}：本線匯出的碼 ≠ 實驗線 B 段後自己量的城（對帳數字：路、分區、建築）`);
      const model = cityStats(parity3d(codeWithSeed(newcity, seed), KT, vrank, 1).sim.city);   // 推進 1 天＝B 段剛做完、還沒往下推
      if (J(model) !== J(L.measureB)) bad.push(`種子 ${seed}：本線城市模型 B 段後 ≠ 實驗線自己量的城（建築 ${model.buildings} 棟 ${J(model.kinds)} ≠ ${L.measureB.buildings} 棟 ${J(L.measureB.kinds)}）`);
      delete o.z; delete o.d3;
      if (rb.codeHash !== fnv1a(code) || rb.plainHash !== fnv1a(encodeLabCode(o, { deflate: true }))) { stale.push(seed); bad.push(`種子 ${seed}：本線 B 段後的碼（或拿掉 d3 的版本）跟錄樣本時不同（重跑 tools/d011-parity.mjs）`); continue; }
      if (!rb.withD3.ok || J(rb.withD3.measure) !== J(my)) bad.push(`種子 ${seed}：本線 → 實驗線 對帳數字不同`);
      if (rb.withD3.money !== S.money || rb.withD3.diff !== S.df || rb.withD3.star !== S.star || rb.withD3.msIdx !== S.msIdx || rb.withD3.day !== S.day) bad.push(`種子 ${seed}：本線 → 實驗線 資金／難度／星等／里程碑／天數 ${J([rb.withD3.money, rb.withD3.diff, rb.withD3.star, rb.withD3.msIdx, rb.withD3.day])} ≠ ${J([S.money, S.df, S.star, S.msIdx, S.day])}`);
      const strip = x => { const { ok, ...rest } = x; void ok; return J(rest); };
      if (!rb.plain.ok || strip(rb.withD3) !== strip(rb.plain)) fact.push(`種子 ${seed}：錄的時候，拿掉 d3 讀回的結果不一樣`);
    }
    log(bad.length === 0, `分享碼互通：實驗線照同一串操作蓋完匯出的碼，本線讀回＝實驗線自己的對帳數字與道路等級；本線蓋完匯出的碼（帶 d3 歷史）與本線的城市模型（畫面、歷史用）都＝實驗線 B 段後自己量的城，實驗線讀回那張碼也＝本線（路、分區、建築、道路等級、資金、天數、難度、星等、里程碑）——讀回的碼雜湊在 Node 重算（${seeds.length} 個種子）`,
      bad.slice(0, 2).join('；') || `${seeds.length * 2} 張碼`);
    log(fact.length === 0 && !stale.length, `錄製時實驗線讀回的事實：同一張碼拿掉附加欄位 d3，實驗線讀回的對帳數字、道路等級、資金、難度、星等、里程碑、天數完全一樣（兩邊都是錄的值；CI 核對的是那兩張碼＝本線現在的碼與它拿掉 d3 的版本）`,
      fact.slice(0, 2).join('；') || (stale.length ? `種子 ${stale.join('、')} 讀回的碼不是本線現在的碼（樣本過期），核不到` : `${seeds.length} 對`));
  }
  // 回歸錨點：本線 8 個種子的整段（兩批操作、第 1 天、逐日數字、預建城）＝d011-3d.json（卡面對照表的本線數字）
  {
    const bad = [];
    const flat = r => J({ ...r, sim: undefined, A: r.A.map(o => ({ ...o, changed: cnt(o.changed) })), B: r.B.map(o => ({ ...o, changed: cnt(o.changed) })) });
    for (const seed of seeds) {
      if (flat(mine[seed]) !== flat(mine3d.runs[seed])) bad.push(`種子 ${seed} 新城`);
      if (J({ ...pre[seed], sim: undefined }) !== J(mine3d.prebuilt?.[seed])) bad.push(`種子 ${seed} 預建城`);
    }
    log(bad.length === 0, `回歸錨點：本線 ${seeds.length} 個種子的整段（兩批操作、第 1 天、${lab.days} 天逐日數字、匯出的碼、預建城）＝d011-3d.json`, bad.join('、') || '相同');
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
  return { mine, pre };
}
