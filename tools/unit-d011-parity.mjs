// D011 Node 守衛（驗收 3、4）：實驗線實跑錨點與分享碼互通。實驗線那一半是離線錄的（tools/d011-parity.mjs → d011-lab.json，要 Chrome），
// 本線那一半每次在這裡重算（tools/d011-parity-lib.mjs parity3d、prebuilt3d），逐項比。由 tools/unit.mjs 呼叫。
//   欄位齊全：逐項比之前先核三份——實驗線樣本、本線樣本、本線這次重算——守衛比到的每一欄都在、型別對（shapeOff）。重錄漏掉一欄時兩邊都是 undefined，
//             J(undefined)===J(undefined) 會「相等」；所以缺哪一欄就講哪一欄（紅），而且不往下比。
//   精確相等：新城 A 段（開跑前）、B 段（第 1 天後）與預建城拆除劇本，每一筆的資金（不取整）、亂數抽取數、格子雜湊、場雜湊（含地價 LANDBASE、LAND）、
//             地價髒狀態、變了哪些格；新城推進第 1 天之後的快照（snap1）與逐行的亂數抽取（這一天兩邊有抽的共用行是生長洗牌 55605、擲骰 55618、變體 55622，
//             每個種子兩邊都要 > 0；天氣、升級那幾行這一天兩邊都 0 次、沒對拍到；實驗線多的只在起火、犯罪、生病擲骰三行，次數照本線推進後的格子算）；
//             預建城推進一天之後在第 2 類系統起作用之前就定案的部分（推進前就在的住商工有沒有電、住商工以外的格、覆蓋、地價、生長洗牌 55605 的抽取），
//             以及兩邊住宅幸福的差＝實驗線的垃圾與糧食（第 2 類）那三項（逐位）；
//             SITE_MAP 天氣那 7 行（上面兩天都沒抽天氣）：實驗線天氣原文（sha256 核過）在 vm 裡跑、本線跑 weatherStep，D009 F10 的起點逐次比呼叫行；
//             第 1 天那一列（D010 的 21 欄＋有電棟數）；實驗線匯出的碼本線解碼＝實驗線自己的對帳數字；本線匯出的碼＝實驗線 B 段後自己量的城，實驗線讀回＝本線的對帳數字。
//   劇本不空跑：每個種子上 pick 都找到住商工；每一筆施工「有沒有改到格子或資金」跟劇本註明的一樣（nop）；地價框推進時真的改了格子；快速路真的過了河。
//   錄製時的事實（兩邊都是實驗線錄的值，CI 不重算；各自另起一條，跟重算的比對分開）：新城第 1 天與預建城推進那一天，逐行加總＝總抽取數、
//             起火／犯罪／生病擲骰的次數＝照實驗線自己推進後的格子算的棟數；第 1 天那一列實驗線的有電棟數＝住商工總數；
//             附加欄位 d3 有沒有，實驗線讀回都一樣（CI 只核對讀回的那兩張碼就是本線現在算出來的碼與它拿掉 d3 的版本）。
//   只量不判：第 1 天的資金（本線第 2 類乘數固定 1、沒有進口；差額照列）、預建城推進那一天的生長與升級（幸福不同，生長機率就不同；升級那兩行只在這一天抽到）、
//             第 2 天以後的逐日數字（均值 ± 標準差、第一個分岔日）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, encodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { cases as d009Cases, COUNTS as D009_COUNTS } from './d009-cases.mjs';
import { ROW_FIELDS, PROJ_FIELDS, EXTRA_LINES, PRE_GROWTH_LINES, SITE_MAP, LINE_NAMES, LAB_WEATHER, LAB_INWINTER, labSitesOf, weatherSites, shapeOff,
  parity3d, prebuilt3d, opsOf, prebuiltOf, meanSd, class2Of } from './d011-parity-lib.mjs';

const J = JSON.stringify;
const cnt = x => typeof x === 'number' ? x : x.length;
// 一串實驗線行號照名字分組：天氣 54965／54967、升級擲骰 55648
const linesText = ls => { const g = {}; for (const l of ls) (g[LINE_NAMES[l] ?? '?'] ??= []).push(l); return Object.entries(g).map(([n, xs]) => `${n} ${xs.join('／')}`).join('、'); };
// 每一行在各種子的次數（最少–最多；有種子是 0 就附「幾個種子 > 0」）
const countsText = (ls, per) => ls.map(l => { const xs = per[l] ?? [0], lo = Math.min(...xs), hi = Math.max(...xs), nz = xs.filter(v => v > 0).length;
  return `${LINE_NAMES[l]} ${l} ${lo === hi ? lo : `${lo}–${hi}`}${nz < xs.length ? `（${nz}/${xs.length} 個種子 > 0）` : ''}`; }).join('、');

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
  const seeds = lab.seeds, src = `實驗線 ${String(lab.source?.commit).slice(0, 7)} v${lab.source?.version}`, ops = opsOf(newcity), P = prebuiltOf(prebuilt);
  if (!(Array.isArray(seeds) && seeds.length && seeds.every(Number.isInteger) && Number.isInteger(lab.days) && lab.days >= 2)) {
    log(false, 'D011 實驗線實跑錨點', `${labPath} 沒有 seeds／days（重跑 tools/d011-parity.mjs），後面的比對都不跑`); return;
  }
  const mine = {}, pre = {};
  for (const seed of seeds) { mine[seed] = parity3d(codeWithSeed(newcity, seed), KT, vrank, lab.days); pre[seed] = prebuilt3d(codeWithSeed(prebuilt, seed), KT, vrank); }
  const labPre = lab.prebuilt ?? {};

  // 欄位齊全（形狀）：實驗線樣本、本線樣本、本線這次重算三份，守衛比到的每一欄都要在、型別對。重錄漏掉一欄時兩邊都是 undefined，
  // J(undefined)===J(undefined) 會「相等」（例：parity3d 與兩份樣本都拿掉 snap1，原本照樣綠），所以先核；不齊就不往下比
  {
    const c = { seeds, days: lab.days, ops, P };
    const off = [['實驗線樣本 d011-lab.json', shapeOff('lab', lab, c)], ['本線樣本 d011-3d.json', shapeOff('3d', mine3d, c)], ['本線這次重算', shapeOff('live', { runs: mine, prebuilt: pre }, c)]]
      .filter(([, o]) => o.length);
    log(!off.length, `D011 對拍的欄位齊全：實驗線樣本、本線樣本、本線這次重算三份，守衛比到的每一欄都在、型別對——新城 snap0／snapA／snap1／snapB 的格子與場雜湊、兩批操作逐筆（筆數＝劇本）、推進第 1 天的抽取（總數、逐行、多抽的三行）與地價框、第 1 天那一列、${lab.days - 1} 列逐日數字（天數連號）、匯出的碼；預建城讀檔重挑變體、快照、拆除逐筆、推進那一天的抽取、INV、有電、幸福；實驗線的探針、對帳數字、讀回兩張碼與雜湊（重錄漏掉一欄時兩邊都是 undefined，逐項比也會「相等」，所以先核）`,
      off.map(([who, o]) => `${who} 缺或形狀不對：${o.slice(0, 4).join('、')}${o.length > 4 ? ` 等 ${o.length} 項` : ''}`).join('；') || `${seeds.length} 個種子 × 3 份`);
    if (off.length) { log(false, 'D011 對拍：欄位不齊，後面的逐項比對都不跑（比了也是拿 undefined 跟 undefined 比）', '先補齊：重跑 tools/d011-parity.mjs，或修本線的量法'); return { mine, pre }; }
  }

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
  // 第 1 天的亂數抽取：實驗線－本線＝起火、犯罪、生病擲骰（第 2 類系統，都在生長之後，所以生長兩邊逐位相同）。
  // 逐行比的是兩邊所有的行，但這一天兩邊真的有抽的共用行只有生長洗牌、擲骰、變體（天氣這一天沒換態、也不是暴雨；推進前沒有住商工，當天新長的屋齡才 1，升級不抽）：
  // 守衛講到名字的行都要真的抽到——這三行每個種子兩邊都 > 0，多抽的三行各種子合計 > 0（某個種子算出來 0 棟是正常的）；SITE_MAP 其餘 0＝0 的行照列、講明沒對拍到
  {
    const bad = [], offs = [], fact = [], per = {}, perMine = {}, DRAWN = [55605, 55618, 55622], EXTRA = Object.values(EXTRA_LINES);
    for (const seed of seeds) {
      const m = mine[seed], L = lab.runs[seed], my = labSitesOf(m.tick1Sites), e = m.tick1Extra;
      const d = [sharedOff(L.tick1Sites, m.tick1Sites), extraOff(L.tick1Sites, e) && `照本線的格子算：${extraOff(L.tick1Sites, e)}`,
        L.tick1Draws - m.tick1Draws !== e.fire + e.crime + e.disease && `實驗線−本線 ${L.tick1Draws - m.tick1Draws} ≠ ${e.fire}＋${e.crime}＋${e.disease}`,
        ...DRAWN.filter(l => !(L.tick1Sites[l] > 0 && my[l] > 0)).map(l => `${l} 行（${LINE_NAMES[l]}）實驗線 ${L.tick1Sites[l] ?? 0} 次、本線 ${my[l] ?? 0} 次（兩邊都要 > 0）`)].filter(Boolean);
      if (d.length) bad.push(`種子 ${seed}：${d.join('，')}`);
      offs.push(`${L.tick1Draws}−${m.tick1Draws}＝${e.fire}＋${e.crime}＋${e.disease}`);
      for (const l of new Set([...Object.values(SITE_MAP), ...EXTRA])) { (per[l] ??= []).push(L.tick1Sites[l] ?? 0); (perMine[l] ??= []).push(my[l] ?? 0); }
      // 錄製時的事實：逐行次數、總數、實驗線自己的格子算出來的棟數，都是實驗線錄的值
      const sum = Object.values(L.tick1Sites).reduce((a, v) => a + v, 0), f = [sum !== L.tick1Draws && `逐行加總 ${sum} ≠ ${L.tick1Draws}`, extraOff(L.tick1Sites, L.tick1Extra)].filter(Boolean);
      if (f.length) fact.push(`種子 ${seed}：${f.join('，')}`);
    }
    const quiet = EXTRA.filter(l => !per[l].some(v => v > 0));
    if (quiet.length) bad.push(`${linesText(quiet)} 在 ${seeds.length} 個種子都 0 次（守衛講到它，就要有種子真的抽到）`);
    const zero = [...new Set(Object.values(SITE_MAP))].filter(l => per[l].every(v => !v) && perMine[l].every(v => !v));
    const more = [...new Set(Object.values(SITE_MAP))].filter(l => !DRAWN.includes(l) && !zero.includes(l));
    log(bad.length === 0, `推進第 1 天的亂數抽取（${seeds.length} 個種子）：兩邊逐行記呼叫位置，本線每一次抽取都對得到實驗線的行、每一行次數相同——這一天兩邊有抽的共用行：生長洗牌 55605、生長擲骰 55618、變體 55622（每個種子兩邊都 > 0）${more.length ? `，另有 ${linesText(more)}` : ''}；實驗線多的只在起火（${EXTRA_LINES.fire}）、犯罪（${EXTRA_LINES.crime}）、生病（${EXTRA_LINES.disease}）擲骰三行（第 2 類，都在生長之後；三行 ${seeds.length} 個種子合計都 > 0），每個種子的次數＝照本線推進後的格子與覆蓋算的棟數，所以實驗線－本線＝這三行的和${zero.length ? `；${linesText(zero)} 這一天兩邊都 0 次（0＝0），這裡沒有對拍到${zero.some(l => LINE_NAMES[l] === '天氣') ? '（天氣那幾行見下一條）' : ''}` : ''}`,
      bad.slice(0, 2).join('；') || `實驗線逐行次數（各種子最少–最多）：${countsText(DRAWN, per)}；${countsText(EXTRA, per)}；實驗線−本線 ${offs.join('、')}`);
    log(fact.length === 0, `錄製時的事實（新城推進第 1 天；兩邊都是實驗線錄的值，CI 不重算）：實驗線逐行記的次數加總＝它記的總抽取數；起火、犯罪、生病擲骰三行的次數＝照實驗線自己推進後的格子與覆蓋算的棟數（${seeds.length} 個種子）`,
      fact.slice(0, 2).join('；') || `總抽取數 ${seeds.map(s => lab.runs[s].tick1Draws).join('、')}`);
  }
  // SITE_MAP 天氣那 7 行：新城第 1 天、預建城推進那一天兩邊都沒抽天氣（上一條與預建城那一條只比得到 0＝0），在這裡另外對拍：
  // 實驗線 tick() 天氣那一段原文（LAB_WEATHER；sha256 先核＝D009 樣本記的片段）在 vm 裡跑、本線跑 weatherStep，同一組起點（D009 F10 的案例：天氣、wxT、起始日、種子），
  // 每一次抽取的呼叫行照 SITE_MAP 對過去要逐次相同、每天的天氣狀態相同，表裡天氣那幾項每一項都要抽到
  {
    const pieces = JSON.parse(read('src/content/samples/d009-formulas.json')).source?.pieces ?? [], sha = s => crypto.createHash('sha256').update(s).digest('hex');
    const pw = pieces.find(p => p.name === 'F10 天氣'), pi = pieces.find(p => p.name === 'inWinter'), end = LAB_WEATHER.line + LAB_WEATHER.src.split('\n').length - 1;
    const bad = [!(pw && pw.line === LAB_WEATHER.line && pw.endLine === end && pw.sha === sha(LAB_WEATHER.src)) && `天氣原文 ${LAB_WEATHER.line}–${end} 跟 D009 樣本記的「F10 天氣」片段（行號、sha256）不同`,
      !(pi && pi.line === LAB_INWINTER.line && pi.sha === sha(LAB_INWINTER.src)) && `inWinter ${LAB_INWINTER.line} 跟 D009 樣本記的片段不同`].filter(Boolean);
    const wx = Object.entries(SITE_MAP).filter(([k]) => k.startsWith('weather.ts:')), run = weatherSites(), labN = {}, myN = {}, days = d009Cases.F10(0).days;
    let draws = 0;
    for (let k = 0; k < D009_COUNTS.F10 && bad.length < 3; k++) {
      const r = run(d009Cases.F10(k)), my = r.mine.map(s => SITE_MAP[s] ?? `?${s}`);
      for (const s of r.mine) myN[s] = (myN[s] || 0) + 1;
      for (const l of r.lab) labN[l] = (labN[l] || 0) + 1;
      draws += r.lab.length;
      const i = my.findIndex((l, j) => l !== r.lab[j]), n = Math.min(my.length, r.lab.length);
      if (i >= 0 || my.length !== r.lab.length) bad.push(`第 ${k} 組第 ${(i >= 0 ? i : n) + 1} 次抽取：本線 ${r.mine[i >= 0 ? i : n] ?? '沒有'}（對到 ${my[i >= 0 ? i : n] ?? '—'}）≠ 實驗線 ${r.lab[i >= 0 ? i : n] ?? '沒有'}`);
      else if (J(r.mineOut) !== J(r.labOut)) bad.push(`第 ${k} 組每天的天氣狀態不同`);
    }
    const miss = wx.filter(([k, l]) => !myN[k] || !labN[l]).map(([k, l]) => `${k}→${l}`);
    if (miss.length) bad.push(`沒抽到：${miss.join('、')}`);
    log(bad.length === 0, `SITE_MAP 天氣那 ${wx.length} 項（本線 weather.ts → 實驗線 ${linesText([...new Set(wx.map(e => e[1]))])}）：新城第 1 天、預建城推進那一天兩邊都沒抽天氣，實跑錨點對拍不到，改在這裡對拍——實驗線原文（index.html ${LAB_WEATHER.line}–${end}、inWinter ${LAB_INWINTER.line} @d23c18d，sha256＝D009 樣本記的片段）在 vm 裡跑、本線跑 weatherStep，D009 F10 的 ${D009_COUNTS.F10} 組起點各 ${days} 天：每一次抽取的呼叫行照 SITE_MAP 對過去逐次相同、每天的天氣狀態相同，表裡每一項都抽到`,
      bad.slice(0, 3).join('；') || `${draws} 次抽取；${wx.map(([k, l]) => `${k}→${l} ${labN[l]} 次`).join('、')}`);
  }
  // 第 1 天那一列：D010 的 21 欄＋有電棟數逐項相等；資金另比（本線乘數 1、沒有進口）
  {
    const bad = [], fact = [], money = [], n = ROW_FIELDS.indexOf('money'), col = f => ROW_FIELDS.indexOf(f);
    const rciOff = r => r[col('powered')] !== r[col('R')] + r[col('C')] + r[col('I')] && `有電 ${r[col('powered')]} ≠ 住商工 ${r[col('R')] + r[col('C')] + r[col('I')]}`;
    for (const seed of seeds) {
      const a = mine[seed].day1, b = lab.runs[seed].day1;
      const off = ROW_FIELDS.filter((f, i) => f !== 'money' && !Object.is(a[i], b[i]));
      if (off.length) bad.push(`種子 ${seed}：${off.map(f => `${f} ${a[col(f)]}≠${b[col(f)]}`).join(',')}`);
      // 有電棟數＝住商工總數：第 1 天的住商工全是當天新長的，實驗線 55622 生出來就帶電（pw:true），這一欄相等是必然，不是供電對拍。
      // 本線這一邊是重算的；實驗線那一邊兩個數都是錄的值（錄製時的事實，另起一條）
      if (rciOff(a)) bad.push(`種子 ${seed} 本線：${rciOff(a)}`);
      if (rciOff(b)) fact.push(`種子 ${seed}：${rciOff(b)}`);
      money.push(a[n] - b[n]);
    }
    log(bad.length === 0, `第 1 天那一列：D010 的 21 欄與有電棟數逐項相等（${seeds.length} 個種子）；本線的有電棟數＝住商工總數——第 1 天的住商工全是當天新長的、生出來就帶電（55622），這一欄相等是必然，供電對拍在下面的預建城`,
      bad.slice(0, 2).join('；') || `住商工 ${seeds.map(s => lab.runs[s].day1.at(-1)).join('、')} 棟`);
    log(fact.length === 0, `錄製時的事實（新城第 1 天那一列；兩個數都是實驗線錄的值，CI 不重算）：實驗線的有電棟數＝住商工總數（${seeds.length} 個種子）`, fact.slice(0, 2).join('；') || `${seeds.length} 個種子`);
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
    const bad = [], fx = [], fact = [], per = {}, perMine = {}, perX = {}, EXTRA = Object.values(EXTRA_LINES);
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
      // 推進一天：地價框（開頭 54996）、供電分配（55151–55156，在幸福之前）、生長擲骰之前的抽取（天氣、生長洗牌）都跟第 2 類系統無關；
      // 格子只比住商工以外的格與住商工以外的欄、場只比覆蓋、POLTREE、LANDBASE、LAND（INV_SRC）
      if (J(m.inv) !== J(L.inv)) bad.push(`種子 ${seed} 推進後（住商工以外、覆蓋、地價）：本線 ${J(m.inv)} ≠ 實驗線 ${J(L.inv)}`);
      if (m.tickLand !== L.tickLand) bad.push(`種子 ${seed}：推進開頭地價框改了 本線 ${m.tickLand} 格 ≠ 實驗線 ${L.tickLand} 格`);
      const old = new Set(m.pwBefore), pwOld = x => J(x.filter(([i]) => old.has(i)));
      if (pwOld(m.pw) !== pwOld(L.pw)) bad.push(`種子 ${seed} 推進前就在的住商工有電：本線 ${pwOld(m.pw)} ≠ 實驗線 ${pwOld(L.pw)}`);
      // 推進前就在的住商工：有電、沒電都要有（斷掉的小巷那一段沒電），這一欄才量得到供電分配
      const on = m.pw.filter(([i, v]) => old.has(i) && v).length, off = m.pw.filter(([i, v]) => old.has(i) && !v).length;
      if (!on || !off) bad.push(`種子 ${seed}：推進前就在的住商工有電 ${on}、沒電 ${off}（兩種都要有）`);
      // 推進那一天的抽取只比生長擲骰之前的行（PRE_GROWTH_LINES）。這一天兩邊真的有抽的只有生長洗牌 55605（每個種子兩邊都要 > 0）；天氣那幾行也比，但兩邊都 0 次
      const my = labSitesOf(m.tickSites);
      const dd = [sharedOff(L.tickSites, m.tickSites, PRE_GROWTH_LINES.map(String)),
        !(L.tickSites[55605] > 0 && my[55605] > 0) && `55605 行（生長洗牌）實驗線 ${L.tickSites[55605] ?? 0} 次、本線 ${my[55605] ?? 0} 次（兩邊都要 > 0）`].filter(Boolean);
      if (dd.length) bad.push(`種子 ${seed} 推進那一天的抽取：${dd.join('，')}`);
      for (const l of PRE_GROWTH_LINES) { (per[l] ??= []).push(L.tickSites[l] ?? 0); (perMine[l] ??= []).push(my[l] ?? 0); }
      // 錄製時的事實：逐行次數、總數、實驗線自己的格子算出來的棟數，都是實驗線錄的值
      const sum = Object.values(L.tickSites).reduce((a, v) => a + v, 0), f = [sum !== L.tickDraws && `逐行加總 ${sum} ≠ ${L.tickDraws}`, extraOff(L.tickSites, L.tickExtra)].filter(Boolean);
      if (f.length) fact.push(`種子 ${seed}：${f.join('，')}`);
      for (const l of EXTRA) (perX[l] ??= []).push(L.tickSites[l] ?? 0);
      fx.push(`${on}/${off}`);
    }
    const s0 = pre[seeds[0]], wz = PRE_GROWTH_LINES.filter(l => l !== 55605 && per[l].every(v => !v) && perMine[l].every(v => !v)), wn = PRE_GROWTH_LINES.filter(l => l !== 55605 && !wz.includes(l));
    log(bad.length === 0, `預建城拆除劇本（${seeds.length} 個種子，${P.ops.length} 筆，單格拆除都走框；讀檔時實驗線重挑住商工的變體（T531 視覺遷移，本線讀檔沒有這一步，對拍前本線照做、棟數相同））：點體育場附屬格整棟拆；二級 1 秒內再按才拆；三級過 3 秒、剛好 3 秒都重新預備，2.999 秒才拆；框選一級＋二級只拆一級；復原；拆小巷接支路那一格——每一筆兩邊逐項相等。推進一天之後比第 2 類系統起作用之前就定案的部分：推進前就在的住商工每一棟有沒有電、住商工以外的格子、覆蓋、地價 LANDBASE／LAND、生長洗牌 55605 的抽取次數（每個種子兩邊都 > 0）${wn.length ? `、${linesText(wn)} 的抽取次數` : ''}，都相等${wz.length ? `；${linesText(wz)} 也比了，但這一天兩邊都 0 次（0＝0），沒有對拍到（天氣見上面 SITE_MAP 那一條）` : ''}`,
      bad.slice(0, 3).join('；') || `讀檔重挑變體 ${s0.mig} 棟；推進前就在的住商工有電／沒電 ${fx.join('、')}；實驗線逐行次數（各種子最少–最多）：${countsText([55605], per)}`);
    const xq = EXTRA.filter(l => !perX[l].some(v => v > 0)), xs = EXTRA.filter(l => !xq.includes(l));
    log(fact.length === 0, `錄製時的事實（預建城推進那一天；兩邊都是實驗線錄的值，CI 不重算）：實驗線逐行記的次數加總＝它記的總抽取數；${xs.length ? `${linesText(xs)} 的次數＝照實驗線自己推進後的格子與覆蓋算的棟數` : '多抽的三行一次都沒抽到'}${xq.length ? `；${linesText(xq)} 錄到 0 次、照格子算也是 0，這一天沒對拍到` : ''}（${seeds.length} 個種子）`,
      fact.slice(0, 2).join('；') || `實驗線逐行次數（各種子最少–最多）：${countsText(EXTRA, perX)}`);
  }
  // 預建城推進那一天的第 2 類差異，精確找出來：實驗線住宅的幸福在本卡的公式（55164–55236，本線 residentialHappy 逐項相同）之後，再被兩個本線沒搬的第 2 類系統改過：
  //   垃圾：沒有垃圾場時全城容量池懲罰 garbPen409＝(garbRatio−1)×.15（55270–55274），再加每一棟離垃圾場太遠 −.045（computeGarbLocal 57697 起）；
  //   糧食：+clamp((foodSupplyRate482−.5)×.11,−.06,.05)（55414–55419）。都夾在 .05..1，都在需求（55578）之前。
  // 第 1 天的新城推進前沒有住宅（人口 0、垃圾 0、糧食需求 0），所以沒有這個差。核對：推進前就在的每一棟住宅，實驗線的 h＝本線的 h 依序套這三項（逐位）。
  // 全城幸福不同 → 住宅需求 demR 不同（legacyDemand）→ 生長機率不同（55613），生長、升級、新房子的變體與後面起火／生病擲骰的次數就可能不同（哪些種子不同只量不判）
  {
    const bad = [], hap = [], full = [], up = { 55648: [0, 0], 55649: [0, 0] };   // 升級那兩行 [實驗線, 本線] 合計（只量不判）
    const col = f => ROW_FIELDS.indexOf(f);
    for (const seed of seeds) {
      const m = pre[seed], L = labPre[seed], q = L?.probe;
      if (!L || !q || !L.hs) { bad.push(`種子 ${seed}：樣本沒有預建城的探針或幸福（重跑 tools/d011-parity.mjs）`); continue; }
      const my = labSitesOf(m.tickSites);
      for (const l of Object.keys(up)) { up[l][0] += L.tickSites[l] ?? 0; up[l][1] += my[l] ?? 0; }
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
      bad.slice(0, 2).join('；') || `垃圾 ${q0.garbage}／容量 ${q0.garbCap}、懲罰 ${q0.garbPen409}；供糧率 ${q0.foodSupplyRate482}（幸福 ${clamp((q0.foodSupplyRate482 - .5) * .11, -.06, .05)}）；全城幸福 本線/實驗線 ${hap.join('、')}；推進後整張（含生長、升級、有電、抽取逐行）剛好全等的種子 ${full.filter(Boolean).length}/${seeds.length}；升級那兩行只在這一天抽到、只量不判（SITE_MAP 升級那兩項沒有對拍到）：${Object.entries(up).map(([l, [a, b]]) => `${LINE_NAMES[l]} ${l} 實驗線 ${a}／本線 ${b} 次`).join('、')}（${seeds.length} 個種子合計）`);
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
    log(fact.length === 0 && !stale.length, `錄製時的事實（實驗線讀回；兩邊都是錄的值，CI 核對的是那兩張碼＝本線現在的碼與它拿掉 d3 的版本）：同一張碼拿掉附加欄位 d3，實驗線讀回的對帳數字、道路等級、資金、難度、星等、里程碑、天數完全一樣`,
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
