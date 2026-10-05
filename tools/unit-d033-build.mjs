// D033 驗收 6：污水廠的建造規則對拍（公式層）。做法跟 D016、D019、D020 同一套（tools/unit-d016-build.mjs）：
//   1. 黃金樣本 src/content/samples/d033-build.json 由 tools/lab-build.mjs --set=d033 從實驗線原始碼求值產生；案例是 tools/d011-cases.mjs 的 cases33
//      （FAMILIES33：地圖與參數照 D011 的底家族，地圖多放幾座污水廠，操作抽污水廠）。片段＝D011 的樣本（污水廠的 canPlace 在 51384–51389、placeCost 在 51578、doPlace 在 52180–52181，
//      都在 canPlace／placeCost／doPlace 三個函式的原文裡）；污水網不在放置的時候算（實驗線只設 markSewerDirty451 一類的髒旗標，52406，派生值）；
//   2. 常數：本線 COST 的 sewage＝實驗線；
//   3. 本線 src/sim/rules/build.ts 跑同一批案例，逐筆記錄跟樣本逐字相等；
//   4. 樣本附的實驗線原文原樣重跑，要重現樣本；
//   5. 實驗線原碼單點突變（造價、變體範圍、不清樹、鄰水門檻與範圍、造價漏了污水廠）都要跟本線不同；
//   6. 本線 build.ts 單點突變都要轉紅；
//   7. 樣本記的覆蓋率達卡面驗收 6 的門檻。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as B from '../src/sim/rules/build.ts';
import { cases33, canon, D033_SEED, D033_COUNT, FAMILIES33, SEWAGE, makeLab, runMap } from './d011-cases.mjs';
import { REQUIRED_PIECES, D011_LAB_COMMIT, unpack, firstDiff, buildModule, implAgainst, labAgainst, impl3d } from './unit-d011-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ORDER = (() => {
  const starts = [], out = []; let b = 0;
  for (const [, n] of FAMILIES33) { starts.push([b, n]); b += n; }
  for (let r = 0; out.length < D033_COUNT; r++) for (const [s, n] of starts) if (r < n) out.push(s + r);
  return out;
})();
const MUTANTS = [
  ['污水廠造價 500→501', 'COST', 'sewage:500', 'sewage:501'],
  ['污水廠變體 ri(3)→ri(4)', 'doPlace', 't.bld={k:27,lv:1,v:ri(3)', 't.bld={k:27,lv:1,v:ri(4)'],
  ['污水廠不清樹', 'doPlace', 't.bld={k:27,lv:1,v:ri(3),age:0,pw:true,h:1};t.tree=0;', 't.bld={k:27,lv:1,v:ri(3),age:0,pw:true,h:1};'],
  ['污水廠蓋下去沒電（pw:false）', 'doPlace', 't.bld={k:27,lv:1,v:ri(3),age:0,pw:true,h:1}', 't.bld={k:27,lv:1,v:ri(3),age:0,pw:false,h:1}'],
  ['鄰水門檻 2→3', 'canPlace', "if(toolId==='port'||toolId==='sewage'){if(countNear(x,y,1,tt=>tt.t===0)<2)", "if(toolId==='port'||toolId==='sewage'){if(countNear(x,y,1,tt=>tt.t===0)<3)"],
  ['鄰水範圍 3×3→5×5', 'canPlace', "if(toolId==='port'||toolId==='sewage'){if(countNear(x,y,1,", "if(toolId==='port'||toolId==='sewage'){if(countNear(x,y,2,"],
  ['造價漏了污水廠', 'placeCost', "case 'sewage':c=COST.sewage;break;", "case 'sewage':c=0;break;"],
];
const MUTANTS_3D = [
  ['污水廠造價 500→501', 'sewage: 500,', 'sewage: 501,'],
  ['污水廠變體 ri(3)→ri(4)', 'k: 27, lv: 1, v: st.rng.ri(3)', 'k: 27, lv: 1, v: st.rng.ri(4)'],
  ['污水廠不清樹', 'k: 27, lv: 1, v: st.rng.ri(3), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0;', 'k: 27, lv: 1, v: st.rng.ri(3), age: 0, pw: true, h: 1 }; t.zone = 0;'],
  ['污水廠不清分區', 'k: 27, lv: 1, v: st.rng.ri(3), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0;', 'k: 27, lv: 1, v: st.rng.ri(3), age: 0, pw: true, h: 1 }; t.tree = 0;'],
  ['鄰水門檻 2→3', "(tt: Tile) => tt.t === 0) < 2) return '需鄰近水域(≥2格)';", "(tt: Tile) => tt.t === 0) < 3) return '需鄰近水域(≥2格)';"],
  ['鄰水範圍 3×3→5×5', 'countNear(w, x, y, 1, (tt: Tile) => tt.t === 0)', 'countNear(w, x, y, 2, (tt: Tile) => tt.t === 0)'],
  ['造價漏了污水廠', "case 'sewage': c = COST.sewage; break;", "case 'sewage': c = 0; break;"],
  ['canPlace 漏了「只能蓋在陸地上」', "      const q = seen(t, st.protect);\n      if (t.t !== 2 && t.t !== 1) return '只能蓋在陸地上';\n      if (t.road || q.rail || t.tram)", "      const q = seen(t, st.protect);\n      if (t.road || q.rail || t.tram)"],   // D040：油井、礦場的 case 也有同樣三行（第一行不同），錨點帶上第一行才剛好一處
];
const NEED = {
  'build:sewage': 40, 'civic-reason:需鄰近水域(≥2格)': 30, 'civic-reason:只能蓋在陸地上': 10, 'civic-reason:交通線上不能建造': 5, 'civic-reason:已有建築': 15, 'civic-reason:焦土需先清理': 2, 'civic-reason:隕石坑需先剷除': 2,
  'civic-refused-money': 15, 'civic-tree-surcharge': 10, 'civic-sandbox-free': 5, 'civic-line': 20, 'civic-rect': 20, 'doze-sewage': 5, 'undo-ok': 100, 'log:ri,3': 40,
};

export async function d033BuildGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d033-build.json')), g011 = JSON.parse(read('src/content/samples/d011-build.json'));
  const casesSha = crypto.createHash('sha256').update(read('tools/d011-cases.mjs')).digest('hex');
  let want = [], pieces = [], p011 = [];
  try { want = unpack(gold.exact?.outputs); } catch { want = []; }
  try { pieces = unpack(gold.lab?.pieces); } catch { pieces = []; }
  try { p011 = unpack(g011.lab?.pieces); } catch { p011 = []; }
  const labW = ps => makeLab(ps);

  // ---- 樣本的出處 ----
  {
    const meta = gold.source?.pieces ?? [], bad = [];
    if (gold.source?.commit !== D011_LAB_COMMIT || gold.source?.repo !== 'lijiabao1998/GlimmerTown-lab') bad.push('commit／repo');
    if (gold.source?.casesSha256 !== casesSha) bad.push('案例檔雜湊（tools/d011-cases.mjs 改過就要重產樣本）');
    if (gold.seed !== D033_SEED || canon(gold.families) !== canon(FAMILIES33) || gold.counts?.maps !== D033_COUNT || want.length !== D033_COUNT) bad.push('種子／家族／張數');
    if (!(D033_COUNT >= 150 && gold.counts?.minOpsPerMap >= 20)) bad.push(`${D033_COUNT} 張、每張至少 ${gold.counts?.minOpsPerMap} 筆`);
    if (canon(meta.map(p => p.name)) !== canon(REQUIRED_PIECES)) bad.push('片段清單≠D011');
    const textBad = meta.filter((p, i) => pieces[i]?.name !== p.name || crypto.createHash('sha256').update(pieces[i]?.src ?? '').digest('hex') !== p.sha).map(p => p.name);
    if (pieces.length !== meta.length || textBad.length) bad.push(`片段原文雜湊不符：${textBad.join(',')}`);
    if (canon(pieces) !== canon(p011)) bad.push('片段原文≠D011 樣本附的原文');
    const hashBad = want.filter((w, k) => crypto.createHash('sha256').update(w.ops.join('\n') + '\n' + w.end).digest('hex').slice(0, 16) !== gold.hashes?.[k]).length;
    if (hashBad) bad.push(`${hashBad} 張的雜湊不符`);
    log(bad.length === 0, `D033 建造黃金樣本：實驗線 commit d23c18d、案例檔雜湊、片段＝D011 樣本的 ${REQUIRED_PIECES.length} 段（原文逐段相同）、≥150 張 × ≥20 筆`,
      bad.join('；') || `${gold.source.commit.slice(0, 7)}；${D033_COUNT} 張 ${gold.counts.ops} 筆；每張至少 ${gold.counts.minOpsPerMap} 筆`);
  }

  // ---- 常數表 ----
  {
    const t = gold.tables ?? {}, bad = [];
    for (const tool of SEWAGE) if (!(tool in (t.cost ?? {})) || B.COST[tool] !== t.cost[tool]) bad.push(`COST.${tool} ${B.COST[tool]}／${t.cost?.[tool]}`);
    if (canon(B.D033_TOOLS) !== canon(SEWAGE)) bad.push(`D033_TOOLS ${B.D033_TOOLS}`);
    log(bad.length === 0, 'D033 常數與實驗線逐項相等：污水廠的造價（COST 37442）', bad.join('；') || SEWAGE.map(x => `${x} ${B.COST[x]}`).join('、'));
  }

  // ---- 本線逐張逐筆跟樣本相等 ----
  {
    const bad = [], t0 = Date.now(), impl = impl3d(B);
    let ops = 0;
    for (let k = 0; k < D033_COUNT; k++) {
      const c = cases33(k);
      try {
        const got = runMap(impl, c), d = firstDiff(got, want[k] ?? { ops: [], end: '' }, c);
        ops += c.ops.length;
        if (d) bad.push(`${k}（${c.family} #${c.j}，N=${c.N}）${d.text}`);
      } catch (e) { bad.push(`${k}（${c.family} #${c.j}）：${e.stack || e}`); }
    }
    const cov = gold.coverage ?? {};
    log(bad.length === 0 && want.length === D033_COUNT,
      'D033 建造規則逐筆與實驗線相等：污水廠的成敗、鄰水判定與拒絕理由、造價、資金、每次 doPlace、交易快照與花費、亂數抽取順序（變體 ri(3)）、格子欄位、地價髒框（沒有覆蓋場、不是污染源）',
      bad.length ? `${bad.length}/${D033_COUNT} 張不同；第一個：${bad[0]}`
        : `${D033_COUNT} 張 ${ops} 筆相等（${((Date.now() - t0) / 1000).toFixed(1)}s）；蓋成污水廠 ${cov['build:sewage']}（變體抽 ri(3) ${cov['log:ri,3']}）；`
          + `拒絕（離水太遠 ${cov['civic-reason:需鄰近水域(≥2格)']}、水上 ${cov['civic-reason:只能蓋在陸地上']}、路上 ${cov['civic-reason:交通線上不能建造']}、有建築 ${cov['civic-reason:已有建築']}、焦土 ${cov['civic-reason:焦土需先清理']}、隕石坑 ${cov['civic-reason:隕石坑需先剷除']}；錢不夠 ${cov['civic-refused-money']}）；`
          + `樹上加價 ${cov['civic-tree-surcharge']}、沙盒 ${cov['civic-sandbox-free']}、線 ${cov['civic-line']}、框 ${cov['civic-rect']}；拆污水廠 ${cov['doze-sewage']}；復原 ${cov['undo-ok']}`);
  }

  // ---- 覆蓋率 ----
  {
    const cov = gold.coverage ?? {}, miss = Object.entries(NEED).filter(([k, n]) => !((cov[k] ?? 0) >= n)).map(([k, n]) => `${k} ${cov[k] ?? 0}/${n}`);
    log(miss.length === 0, 'D033 案例覆蓋（卡面驗收 6）：污水廠蓋成過；拒絕理由（離水太遠、水上、交通線上、有建築、焦土、隕石坑、錢不夠）都出現；樹上加價、沙盒、線與框；拆污水廠、復原；變體抽 ri(3)',
      miss.join('；') || `${Object.keys(NEED).length} 項都達標`);
  }

  // ---- 樣本附的實驗線原文，原樣重跑要重現樣本 ----
  {
    let d = null, err = '';
    const t0 = Date.now();
    try { d = pieces.length ? labAgainst(pieces, want, ORDER, labW(pieces), cases33) : { text: '樣本沒有片段原文' }; } catch (e) { err = e.stack || String(e); }
    log(!d && !err, 'D033 樣本附的實驗線原文在 vm 裡重跑，逐筆重現樣本', err || (d ? `${d.k}（${d.c?.family}）${d.text}` : `${D033_COUNT} 張相等（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }

  // ---- 實驗線原碼單點突變 ----
  {
    const detected = [], missed = [], t0 = Date.now();
    for (const [name, piece, from, to] of MUTANTS) {
      try {
        const i = pieces.findIndex(p => p.name === piece);
        if (i < 0) throw new Error(`沒有片段 ${piece}`);
        const parts = pieces[i].src.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點在 ${piece} 裡不是剛好一處（${parts.length - 1} 處）`);
        const mutated = pieces.map((p, q) => q === i ? { name: p.name, src: parts.join(to) } : p);
        let lab;
        try { lab = labW(mutated); } catch (e) { throw new Error(`突變後載入失敗（突變本身寫錯）：${e.message}`); }
        let d;
        try { d = labAgainst(mutated, want, ORDER, lab, cases33); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(missed.length === 0 && detected.length === MUTANTS.length, `D033 實驗線原碼單點突變：${MUTANTS.length} 個（造價、變體範圍、不清樹、蓋下去沒電、鄰水門檻與範圍、造價漏了污水廠）都跟本線不同`,
      missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  }

  // ---- 本線原碼單點突變 ----
  {
    const source = read('src/sim/rules/build.ts'), detected = [], missed = [], t0 = Date.now();
    let baseline = '';
    try { const d = implAgainst(buildModule(source), want, ORDER.slice(0, 30), cases33); if (d) baseline = `沒改的 build.ts 在 vm 裡就不同：${d.k} 第 ${d.j} 筆`; }
    catch (e) { baseline = `沒改的 build.ts 在 vm 裡載入失敗：${e.message}`; }
    for (const [name, from, to] of MUTANTS_3D) {
      try {
        const parts = source.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點不是剛好一處（${parts.length - 1} 處）`);
        let M;
        try { M = buildModule(parts.join(to)); } catch (e) { throw new Error(`突變後載入失敗：${e.message}`); }
        let d;
        try { d = implAgainst(M, want, ORDER, cases33); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(!baseline && missed.length === 0 && detected.length === MUTANTS_3D.length,
      `D033 本線 build.ts 原碼單點突變：${MUTANTS_3D.length} 個（造價、變體範圍、不清樹、不清分區、鄰水門檻與範圍、造價漏了污水廠、canPlace 漏了陸地檢查）都使守衛轉紅`,
      baseline || (missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }
}
