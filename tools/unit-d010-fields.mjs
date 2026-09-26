// D010 驗收 3：服務覆蓋／污染（連同地價、教育）場跟實驗線對拍。照 D009 的做法：
//   1. 黃金樣本 src/content/samples/d010-fields.json 由 tools/lab-fields.mjs 從實驗線原始碼求值產生（commit 釘死、片段錨點與雜湊存證）；
//   2. 本線 src/sim/rules/fields.ts 跑同一批案例（tools/d010-cases.mjs），重建後、增量操作後、在有資料的場上換預算再重建後三個全狀態
//      逐格相等（canon 字串相等；每張陣列的型別與長度也要相等）；fieldsOf 的 8 個鍵都要是 Grids 裡同一張陣列；
//   3. 單點突變：把 fields.ts 原始碼改一個常數／符號／刪一句，型別剝除後在 vm 裡重跑，守衛必須轉紅。
// 用法：import { d010FieldGuards } from './unit-d010-fields.mjs'; await d010FieldGuards(log)　log(ok, 名稱, 細節) 同 tools/unit.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as fields from '../src/sim/rules/fields.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import { landStaticAt } from '../src/sim/rules/land.ts';
import { POL_LV3_MAX } from '../src/sim/rules/growth.ts';
import { cases, canon, D010_SEED, D010_COUNT, FAMILIES, applyExtras, applyOps, applyEdits, snapshot } from './d010-cases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const D010_LAB_COMMIT = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
// 黃金樣本必須摘到的實驗線片段（名稱＝tools/lab-fields.mjs 的 labSource 名稱）
const REQUIRED_PIECES = ['clamp', 'sq', 'tq', 'T', 'idx', 'inMap', 'countNear', 'COVR', 'COV', 'covFieldOfK', 'svcBudget', 'SVC_BUDGET_CAT', 'covFieldOfK 覆寫',
  'stampCov', 'POL', 'POL_SRC', 'POL_LV3_MAX', 'recomputePol', 'stampPolSrc', 'stampPolTree', 'LAND', 'landDirty', 'landBox', 'landStaticAt', 'recomputeLandDynamic',
  'EDU', 'EDU_W_SCHOOL', 'eduStaticAt', 'rebuildCov', 'allocGrids', 'tick 地價髒重建', 'tick 地價動態'];

const STATES = ['rebuild', 'ops', 'rebuild2'];
// 本線跑一個案例：配場 → 填外部場 → rebuildCov → 記狀態 → 增量操作 → 地價髒重建（全圖）＋LAND 衍生 → 記狀態
// → 改地圖、換預算（與教育輸入）→ 在有資料的場上 rebuildCov → 記狀態
export function runFields(m, c) {
  const g = m.allocGrids(c.N);
  applyExtras(g, c.extras);
  const w = { N: c.N, tiles: c.tiles }, e = { tech: c.edu.tech, spec: c.edu.spec, schoolLunch: c.edu.schoolLunch };
  m.rebuildCov(w, g, c.budget, e);
  const rebuild = canon(snapshot(g));
  applyOps(c.ops, {
    cov: (f, x, y, r, d) => m.stampCov(g, c.budget, f, x, y, r === null ? m.COVR[f] : r, d),
    pol: (x, y, k, s) => m.stampPolSrc(g, x, y, k, s),
    tree: (x, y, s) => m.stampPolTree(g, x, y, s),
  });
  m.rebuildLandBase(w, g);
  m.recomputeLandDynamic(g);
  const ops = canon(snapshot(g)), r2 = c.rebuild2;
  applyEdits(c.tiles, r2.edits);
  const e2 = r2.edu ? { tech: r2.edu.tech, spec: r2.edu.spec, schoolLunch: r2.edu.schoolLunch } : e;
  m.rebuildCov(w, g, r2.budget, e2);
  return { rebuild, ops, rebuild2: canon(snapshot(g)) };
}
// fieldsOf：剛好 8 個鍵，每一個都是 Grids 裡同一張陣列（D009 規則讀的是活的場，不是複本、不是別張）
const FIELD_KEYS = ['COV', 'LAND', 'POL', 'NOISE', 'EDU', 'commutePenalty', 'METRO_TOD467B', 'ACCESS468'];
export function fieldsOfBad(m) {
  const g = m.allocGrids(7), f = m.fieldsOf(g), keys = Object.keys(f), bad = [];
  if (canon([...keys].sort()) !== canon([...FIELD_KEYS].sort())) bad.push(`鍵 ${keys.join(',')}`);
  for (const k of FIELD_KEYS) if (f[k] !== g[k]) bad.push(`${k} 不是 g.${k}`);
  return bad;
}
// 兩個 canon 字串第一個不同的位置附近，給紅燈細節用
const where = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return `@${i} 本線「${a.slice(Math.max(0, i - 40), i + 40)}」≠ 實驗線「${String(b).slice(Math.max(0, i - 40), i + 40)}」`; };

// 單點突變：[名稱, 原文, 改成, 說明]。equivalent＝可證明等價的突變（守衛不可能轉紅），另列理由與證明
const MUTANTS = [
  ['COVR police 10→11', 'police: 10,', 'police: 11,'],
  ['預算半徑 Math.round→Math.floor', 'Math.round(r * budget[cat])', 'Math.floor(r * budget[cat])'],
  ['預算半徑下限 1→0', 'Math.max(1, Math.round(r * budget[cat]))', 'Math.max(0, Math.round(r * budget[cat]))'],
  ['污染衰減 (r + 1)→(r + 2)', 'p * (1 - d / (r + 1))', 'p * (1 - d / (r + 2))'],
  ['污染 if (v <= 0)→(v < 0)', 'if (v <= 0) continue', 'if (v < 0) continue', 'equivalent'],
  ['污染門檻 if (v <= 0)→(v <= 3)（上一條的替身）', 'if (v <= 0) continue', 'if (v <= 3) continue'],
  ['POLBASE 上限 255→256', 'clamp(g.POLBASE[i] + sign * v, 0, 255)', 'clamp(g.POLBASE[i] + sign * v, 0, 256)'],
  ['樹減免 sign * 2→sign * 3', 'sign * 2', 'sign * 3'],
  ['POL_SRC k3 p 30→31', '3: { r: 5, p: 30 }', '3: { r: 5, p: 31 }'],
  ['recomputePol 夾 255→254', 'v < 255 ? v : 255', 'v < 254 ? v : 254'],
  ['rebuildCov LANDBASE 不截尾（Math.round）', 'g.LANDBASE[idx(w, x, y)] = landStaticAt(w, f, x, y)', 'g.LANDBASE[idx(w, x, y)] = Math.round(landStaticAt(w, f, x, y))'],
  ['rebuildLandBase LANDBASE 不截尾（Math.round）', 'g.LANDBASE[i] = landStaticAt(w, f, i % N, (i / N) | 0)', 'g.LANDBASE[i] = Math.round(landStaticAt(w, f, i % N, (i / N) | 0))'],
  ['covFieldOfK 覆寫 124 park→play', "124: 'park'", "124: 'play'"],
  ['COV 不取模（Uint16Array）', 'COV[f] = new Uint8Array(n)', 'COV[f] = new Uint16Array(n)'],
  ['體育場附屬格 k9→k8', "if (b.k === 9) stampCov(g, budget, 'stadium'", "if (b.k === 8) stampCov(g, budget, 'stadium'"],
  ['遊樂場附加 k126→k125', 'if (b.k === 126)', 'if (b.k === 125)'],
  ['避難公園附加 shelter 漏蓋', "if (b.k === 132) stampCov(g, budget, 'shelter', x, y, COVR.shelter, 1)", "if (b.k === 132) stampCov(g, budget, 'shelter', x, y, COVR.shelter, 0)"],
  ['教育 大學 90→91', 'EDU_W_UNI = 90', 'EDU_W_UNI = 91'],
  ['教育 營養午餐 1.25→1.2', '(e.schoolLunch ? 1.25 : 1)', '(e.schoolLunch ? 1.2 : 1)'],
  ['教育 特化 edu 1.08→1.07', "sq('edu', 1.08, 1)", "sq('edu', 1.07, 1)"],
  ['SVC_BUDGET_CAT court police→fire', "court: 'police'", "court: 'fire'"],
  ['rebuildCov 不清 COV', 'for (const f in g.COV) g.COV[f].fill(0);', ''],
  ['rebuildCov 不清 POLBASE', 'g.POLBASE.fill(0); g.POLTREE.fill(0);', 'g.POLTREE.fill(0);'],
  ['rebuildCov 不清 POLTREE', 'g.POLTREE.fill(0); g.POL.fill(0);', 'g.POL.fill(0);'],
  ['rebuildCov 不清 POL', 'g.POLTREE.fill(0); g.POL.fill(0);', 'g.POLTREE.fill(0);'],
  ['allocGrids 長度 N*N→N*N+N', 'const n = N * N, COV', 'const n = N * N + N, COV'],
  ['allocGrids commutePenalty Float32→Float64', 'commutePenalty: new Float32Array(n)', 'commutePenalty: new Float64Array(n)'],
  ['fieldsOf EDU: g.LAND', 'EDU: g.EDU, commutePenalty', 'EDU: g.LAND, commutePenalty'],
  ['fieldsOf commutePenalty: g.NOISE', 'commutePenalty: g.commutePenalty, METRO', 'commutePenalty: g.NOISE, METRO'],
  ['fieldsOf LAND: g.LANDBASE', 'LAND: g.LAND, POL: g.POL', 'LAND: g.LANDBASE, POL: g.POL'],
];
const EXPORTS = ['COVR', 'SVC_BUDGET_CAT', 'SVC_BUDGET_DEFAULT', 'covFieldOfK', 'POL_SRC', 'allocGrids', 'stampCov', 'recomputePol', 'stampPolSrc', 'stampPolTree',
  'eduStaticAt', 'fieldsOf', 'rebuildLandBase', 'recomputeLandDynamic', 'rebuildCov'];
function mutantModule(source) {
  let js = stripTypeScriptTypes(source);
  js = js.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const ctx = vm.createContext({ ...labHelpers, landStaticAt });
  vm.runInContext(`${js}\n;globalThis.__m = { ${EXPORTS.join(', ')} };`, ctx, { filename: 'mutant:fields.ts' });
  return ctx.__m;
}

export async function d010FieldGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d010-fields.json'));
  const casesSha = crypto.createHash('sha256').update(read('tools/d010-cases.mjs')).digest('hex');
  const want = {};
  for (const s of STATES) {
    try { want[s] = JSON.parse(gunzipSync(Buffer.from(gold.exact?.outputs?.[s] ?? '', 'base64')).toString('utf8')); } catch { want[s] = []; }
  }
  const names = new Set((gold.source?.pieces ?? []).map(p => p.name));
  const missing = REQUIRED_PIECES.filter(n => !names.has(n));
  const metaOk = gold.source?.commit === D010_LAB_COMMIT && gold.source?.repo === 'lijiabao1998/GlimmerTown-lab' && gold.seed === D010_SEED
    && gold.source?.casesSha256 === casesSha && canon(gold.families) === canon(FAMILIES)
    && STATES.every(s => gold.counts?.[s] === D010_COUNT && want[s].length === D010_COUNT) && D010_COUNT >= 200 && gold.exact?.codec === 'gzip+base64+json-canon-array'
    && missing.length === 0 && gold.source.pieces.every(p => p.name && p.line > 0 && p.endLine >= p.line && /^[0-9a-f]{64}$/.test(p.sha)
      && typeof p.anchors?.start === 'string' && p.anchors.start.length > 0
      && (p.kind !== 'span' || typeof p.anchors.end === 'string' && p.anchors.end.length > 0)
      && (p.kind !== 'fn' || p.anchors.closure === 'balanced-brace'));
  log(metaOk, 'D010 場黃金樣本：實驗線 commit、案例檔雜湊、原碼錨點與雜湊、≥200 張小圖 × 三個狀態',
    `${gold.source?.commit?.slice(0, 7)}；${gold.source?.pieces?.length} 段${missing.length ? `（缺 ${missing.join(',')}）` : ''}；${STATES.map(s => gold.counts?.[s]).join('／')} 組；案例檔 ${casesSha === gold.source?.casesSha256 ? '相符' : '不符'}`);

  // 常數表逐項（含 COVR 插入順序）：本線 fields.ts ＝ 實驗線自己的表
  {
    const t = gold.tables ?? {}, bad = [];
    const entries = o => Object.keys(o).map(k => [k, o[k]]);
    if (canon(entries(fields.COVR)) !== canon(t.covr)) bad.push('COVR');
    if (canon(entries(fields.SVC_BUDGET_CAT)) !== canon(t.svcBudgetCat)) bad.push('SVC_BUDGET_CAT');
    if (canon(fields.SVC_BUDGET_DEFAULT) !== canon(t.svcBudgetDefault)) bad.push('SVC_BUDGET_DEFAULT');
    if (canon(entries(fields.POL_SRC).map(([k, v]) => [Number(k), v.r, v.p])) !== canon(t.polSrc)) bad.push('POL_SRC');
    if (canon(Array.from({ length: 301 }, (_, k) => fields.covFieldOfK(k))) !== canon(t.covFieldOfK)) bad.push('covFieldOfK 0–300');
    if (POL_LV3_MAX !== t.polLv3Max) bad.push('POL_LV3_MAX（growth.ts）');
    log(bad.length === 0 && Array.isArray(t.covr) && t.covr.length === 60, 'D010 場常數表與實驗線逐項相等：COVR 60 場（含順序）、預算類別、預設預算、污染源、covFieldOfK 0–300',
      bad.length ? `不一致：${bad.join('、')}` : `COVR ${t.covr.length}、預算類別 ${t.svcBudgetCat.length}、污染源 ${t.polSrc.length}、覆蓋種類 ${t.covFieldOfK.filter(Boolean).length}`);
  }

  // fieldsOf 是活的視圖：8 個鍵都指向 Grids 裡同一張陣列
  {
    const bad = fieldsOfBad(fields);
    log(bad.length === 0, 'D010 fieldsOf：剛好 COV／LAND／POL／NOISE／EDU／commutePenalty／METRO_TOD467B／ACCESS468 八個鍵，都是 Grids 裡同一張陣列', bad.join('；') || '8 個鍵都相同（===）');
  }

  // 逐案例：重建後、增量操作後、有資料時再重建後三個全狀態
  const bad = { rebuild: [], ops: [], rebuild2: [] };
  for (let k = 0; k < D010_COUNT; k++) {
    try {
      const got = runFields(fields, cases(k));
      for (const s of STATES) if (got[s] !== want[s][k]) bad[s].push(`${k}(${cases(k).family}) ${where(got[s], want[s][k] ?? '')}`);
    } catch (e) { bad.rebuild.push(`${k}: ${e.stack || e}`); }
  }
  const cov = gold.coverage ?? {};
  log(bad.rebuild.length === 0 && want.rebuild.length === D010_COUNT,
    'D010 rebuildCov 後逐格與實驗線相等：60 個覆蓋場、POLBASE／POLTREE／POL、LANDBASE（截尾）、LAND、EDU',
    bad.rebuild.length ? `${bad.rebuild.length}/${D010_COUNT} 差異：${bad.rebuild.slice(0, 2).join('｜')}`
      : `${D010_COUNT} 張小圖相等；覆蓋種類 ${cov.covKinds?.length}、污染源 ${cov.polKinds?.length}、體育場附屬格 ${cov.refStadiumTiles}、POLBASE 飽和 ${cov.casesWithPolBase255} 張、地價截尾格 ${cov.landFracCells}`);
  log(bad.ops.length === 0 && want.ops.length === D010_COUNT,
    'D010 增量蓋印／撤印＋地價髒重建後逐格與實驗線相等（Uint8 取模、POLBASE 先夾再減、預算半徑 .5 進位）',
    bad.ops.length ? `${bad.ops.length}/${D010_COUNT} 差異：${bad.ops.slice(0, 2).join('｜')}`
      : `${D010_COUNT} 張小圖、${cov.ops} 步操作相等；覆蓋 −1 取模 ${cov.covWrapOps} 次、預算 .5 進位 ${cov.halfRoundStamps}／${cov.budgetedStamps} 次`);
  const r2 = cov.rebuild2 ?? {};
  log(bad.rebuild2.length === 0 && want.rebuild2.length === D010_COUNT,
    'D010 在有資料的場上換預算再 rebuildCov 後逐格與實驗線相等（setSvcBudget／復原／讀檔：清零、改地圖、換教育輸入）',
    bad.rebuild2.length ? `${bad.rebuild2.length}/${D010_COUNT} 差異：${bad.rebuild2.slice(0, 2).join('｜')}`
      : `${D010_COUNT} 張小圖相等；地圖修改 ${r2.edits} 格、換教育輸入 ${r2.eduChanged} 張、預算含 .5／1.5 ${r2.budget05}／${r2.budget15} 張、.5 進位 ${r2.halfRoundStamps} 次；清零有作用：覆蓋 ${r2.staleCov}、POLTREE ${r2.stalePolTree}、POL ${r2.stalePol} 張`);

  // 單點突變
  {
    const source = read('src/sim/rules/fields.ts'), detected = [], missed = [], equivalent = [];
    // 等價突變的證明：污染源每一種在最遠一圈 d＝r 的值 round(p*(1−r/(r+1))) 都 ≥1，所以 v≤0 那一行永遠不成立
    const minEdgeV = Math.min(...Object.values(fields.POL_SRC).map(({ r, p }) => Math.round(p * (1 - r / (r + 1)))));
    const at = first => first === 'fieldsOf' ? '（fieldsOf 視圖檢查）' : `第 ${first} 組`;
    for (const [name, from, to, kind] of MUTANTS) {
      try {
        if (source.split(from).length !== 2) throw new Error(`突變錨點不是剛好一處：${from}`);
        const m = mutantModule(source.replace(from, to));
        let first = fieldsOfBad(m).length ? 'fieldsOf' : -1;
        for (let k = 0; k < D010_COUNT && first === -1; k++) {
          const got = runFields(m, cases(k));
          if (STATES.some(s => got[s] !== want[s][k])) first = k;
        }
        if (kind === 'equivalent') {
          if (first !== -1) detected.push(`${name} ${at(first)}`);
          else if (minEdgeV >= 1) equivalent.push(`${name}（等價：污染源最遠一圈最小值 ${minEdgeV}，v 不會 ≤0）`);
          else missed.push(`${name} 未抓到，且等價證明不成立`);
        } else if (first === -1) missed.push(`${name} 未抓到`);
        else detected.push(`${name} ${at(first)}`);
      } catch (e) { missed.push(`${name}: ${e.message}`); }
    }
    log(missed.length === 0 && detected.length + equivalent.length === MUTANTS.length,
      `D010 場原碼單點突變：${MUTANTS.length - equivalent.length} 個都使守衛轉紅，${equivalent.length} 個經證明等價`,
      missed.length ? missed.join('；') : `${detected.join('、')}${equivalent.length ? '；' + equivalent.join('、') : ''}`);
  }
}
