// D040 驗收 1：油井、礦場的建造規則對拍（公式層）。做法跟 D016、D019、D020、D033 同一套（tools/unit-d033-build.mjs）：
//   1. 黃金樣本 src/content/samples/d040-build.json 由 tools/lab-build.mjs --set=d040 從實驗線原始碼求值產生；案例是 tools/d011-cases.mjs 的 cases40
//      （FAMILIES40：地圖與參數照 D011 的底家族，另帶一張資源圖 RESOURCE［0 無、1 油田、2 礦藏］與幾口已蓋在資源格上的井，操作抽油井、礦場）。
//      片段＝D011 的樣本（油井、礦場的 canPlace 在 51385–51390 的通用判定與 51430、51431 的資源格判定、placeCost 在 51614–51615、doPlace 在 52325–52330，
//      都在 canPlace／placeCost／doPlace 三個函式的原文裡）；抽取不在放置的時候算（實驗線在 tick() 的資源區塊，55131 起，本線在 resource.ts，D036 另有對拍）；
//   2. 常數：本線 COST 的 oilwell、mine＝實驗線；
//   3. 本線 src/sim/rules/build.ts 跑同一批案例（資源圖由 BuildState.resource 給），逐筆記錄跟樣本逐字相等；
//   4. 樣本附的實驗線原文原樣重跑，要重現樣本；
//   5. 實驗線原碼單點突變（造價、種類、不清樹／分區／裝飾、蓋下去沒電、資源格判定對調、造價漏了油井）都要跟本線不同；
//   6. 本線 build.ts 單點突變都要轉紅；
//   7. 樣本記的覆蓋率達卡面驗收 1 的門檻。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as B from '../src/sim/rules/build.ts';
import { cases40, canon, D040_SEED, D040_COUNT, FAMILIES40, WELLS, makeLab, runMap } from './d011-cases.mjs';
import { REQUIRED_PIECES, D011_LAB_COMMIT, unpack, firstDiff, buildModule, implAgainst, labAgainst, impl3d } from './unit-d011-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ORDER = (() => {
  const starts = [], out = []; let b = 0;
  for (const [, n] of FAMILIES40) { starts.push([b, n]); b += n; }
  for (let r = 0; out.length < D040_COUNT; r++) for (const [s, n] of starts) if (r < n) out.push(s + r);
  return out;
})();
const WELL_OIL = "t.bld={k:49,lv:1,v:0,age:0,pw:true,h:1};t.tree=0;t.zone=0;t.deco=0;", WELL_MINE = "t.bld={k:50,lv:1,v:0,age:0,pw:true,h:1};t.tree=0;t.zone=0;t.deco=0;";
const MUTANTS = [
  ['油井造價 1300→1301', 'COST', 'oilwell:1300,', 'oilwell:1301,'],
  ['礦場造價 1500→1501', 'COST', 'mine:1500,', 'mine:1501,'],
  ['油井種類 k49→k48', 'doPlace', WELL_OIL, WELL_OIL.replace('k:49', 'k:48')],
  ['礦場種類 k50→k51', 'doPlace', WELL_MINE, WELL_MINE.replace('k:50', 'k:51')],
  ['油井不清樹', 'doPlace', WELL_OIL, WELL_OIL.replace('t.tree=0;', '')],
  ['礦場不清分區', 'doPlace', WELL_MINE, WELL_MINE.replace('t.zone=0;', '')],
  ['油井不清裝飾', 'doPlace', WELL_OIL, WELL_OIL.replace('t.deco=0;', '')],
  ['礦場蓋下去沒電（pw:false）', 'doPlace', WELL_MINE, WELL_MINE.replace('pw:true', 'pw:false')],
  ['油井資源格 1→2', 'canPlace', "if(toolId==='oilwell'&&RESOURCE[idx(x,y)]!==1)", "if(toolId==='oilwell'&&RESOURCE[idx(x,y)]!==2)"],
  ['礦場資源格 2→1', 'canPlace', "if(toolId==='mine'&&RESOURCE[idx(x,y)]!==2)", "if(toolId==='mine'&&RESOURCE[idx(x,y)]!==1)"],
  ['造價漏了油井', 'placeCost', "case 'oilwell':c=COST.oilwell;break;", "case 'oilwell':c=0;break;"],
  ['造價漏了礦場', 'placeCost', "case 'mine':c=COST.mine;break;", "case 'mine':c=0;break;"],
];
const MUTANTS_3D = [
  ['油井造價 1300→1301', 'oilwell: 1300, mine: 1500,', 'oilwell: 1301, mine: 1500,'],
  ['礦場造價 1500→1501', 'oilwell: 1300, mine: 1500,', 'oilwell: 1300, mine: 1501,'],
  ['油井種類 k49→k48', 'k: 49, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;', 'k: 48, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;'],
  ['礦場種類 k50→k51', 'k: 50, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;', 'k: 51, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;'],
  ['油井不清樹', 'k: 49, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;', 'k: 49, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.zone = 0; t.deco = 0;'],
  ['礦場不清分區', 'k: 50, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;', 'k: 50, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.deco = 0;'],
  ['油井不清裝飾', 'k: 49, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;', 'k: 49, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0;'],
  ['礦場蓋下去沒電（pw:false）', 'k: 50, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;', 'k: 50, lv: 1, v: 0, age: 0, pw: false, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;'],
  ['油井資源格 1→2', "if (toolId === 'oilwell' && r !== 1)", "if (toolId === 'oilwell' && r !== 2)"],
  ['礦場資源格 2→1', "if (toolId === 'mine' && r !== 2)", "if (toolId === 'mine' && r !== 1)"],
  ['資源圖不讀（一律當 0）', 'r = st.resource ? st.resource[idx(w, x, y)] : 0;', 'r = 0;'],
  ['造價漏了油井', "case 'oilwell': c = COST.oilwell; break;", "case 'oilwell': c = 0; break;"],
  ['造價漏了礦場', "case 'mine': c = COST.mine; break;", "case 'mine': c = 0; break;"],
  ['canPlace 漏了「只能蓋在陸地上」', "r = st.resource ? st.resource[idx(w, x, y)] : 0;\n      if (t.t !== 2 && t.t !== 1) return '只能蓋在陸地上';", "r = st.resource ? st.resource[idx(w, x, y)] : 0;"],
  ['canPlace 漏了「高壓電力走廊擋住」', "if (t.hv471 || t.ug471) return '高壓電力走廊擋住';\n      if (t.bld) return '已有建築';\n      if (toolId === 'gaswell'", "if (t.bld) return '已有建築';\n      if (toolId === 'gaswell'"],
];
const NEED = {
  'build:oilwell': 40, 'build:mine': 40, 'civic-reason:需油田資源格': 40, 'civic-reason:需礦藏資源格': 40, 'civic-reason:只能蓋在陸地上': 10, 'civic-reason:交通線上不能建造': 5, 'civic-reason:已有建築': 15,
  'civic-reason:架空配電線／電線桿擋住': 2, 'civic-reason:高壓電力走廊擋住': 2, 'civic-reason:焦土需先清理': 2, 'civic-reason:隕石坑需先剷除': 2,
  'civic-refused-money': 20, 'civic-tree-surcharge': 10, 'civic-sandbox-free': 5, 'civic-line': 20, 'civic-rect': 20, 'doze-well:k49': 3, 'doze-well:k50': 3, 'undo-ok': 100,
};

export async function d040BuildGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d040-build.json')), g011 = JSON.parse(read('src/content/samples/d011-build.json'));
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
    if (gold.seed !== D040_SEED || canon(gold.families) !== canon(FAMILIES40) || gold.counts?.maps !== D040_COUNT || want.length !== D040_COUNT) bad.push('種子／家族／張數');
    if (!(D040_COUNT >= 150 && gold.counts?.minOpsPerMap >= 20)) bad.push(`${D040_COUNT} 張、每張至少 ${gold.counts?.minOpsPerMap} 筆`);
    if (canon(meta.map(p => p.name)) !== canon(REQUIRED_PIECES)) bad.push('片段清單≠D011');
    const textBad = meta.filter((p, i) => pieces[i]?.name !== p.name || crypto.createHash('sha256').update(pieces[i]?.src ?? '').digest('hex') !== p.sha).map(p => p.name);
    if (pieces.length !== meta.length || textBad.length) bad.push(`片段原文雜湊不符：${textBad.join(',')}`);
    if (canon(pieces) !== canon(p011)) bad.push('片段原文≠D011 樣本附的原文');
    const hashBad = want.filter((w, k) => crypto.createHash('sha256').update(w.ops.join('\n') + '\n' + w.end).digest('hex').slice(0, 16) !== gold.hashes?.[k]).length;
    if (hashBad) bad.push(`${hashBad} 張的雜湊不符`);
    log(bad.length === 0, `D040 建造黃金樣本：實驗線 commit d23c18d、案例檔雜湊、片段＝D011 樣本的 ${REQUIRED_PIECES.length} 段（原文逐段相同）、≥150 張 × ≥20 筆`,
      bad.join('；') || `${gold.source.commit.slice(0, 7)}；${D040_COUNT} 張 ${gold.counts.ops} 筆；每張至少 ${gold.counts.minOpsPerMap} 筆`);
  }

  // ---- 常數表 ----
  {
    const t = gold.tables ?? {}, bad = [];
    for (const tool of WELLS) if (!(tool in (t.cost ?? {})) || B.COST[tool] !== t.cost[tool]) bad.push(`COST.${tool} ${B.COST[tool]}／${t.cost?.[tool]}`);
    if (canon(B.D040_TOOLS) !== canon(WELLS)) bad.push(`D040_TOOLS ${B.D040_TOOLS}`);
    log(bad.length === 0, 'D040 常數與實驗線逐項相等：油井、礦場的造價（COST 37442）', bad.join('；') || WELLS.map(x => `${x} ${B.COST[x]}`).join('、'));
  }

  // ---- 本線逐張逐筆跟樣本相等 ----
  {
    const bad = [], t0 = Date.now(), impl = impl3d(B);
    let ops = 0;
    for (let k = 0; k < D040_COUNT; k++) {
      const c = cases40(k);
      try {
        const got = runMap(impl, c), d = firstDiff(got, want[k] ?? { ops: [], end: '' }, c);
        ops += c.ops.length;
        if (d) bad.push(`${k}（${c.family} #${c.j}，N=${c.N}）${d.text}`);
      } catch (e) { bad.push(`${k}（${c.family} #${c.j}）：${e.stack || e}`); }
    }
    const cov = gold.coverage ?? {};
    log(bad.length === 0 && want.length === D040_COUNT,
      'D040 建造規則逐筆與實驗線相等：油井、礦場的成敗、資源格判定（要對的種類）與拒絕理由、造價、資金、每次 doPlace、交易快照與花費、亂數抽取順序（沒有抽）、格子欄位、地價髒框（沒有覆蓋場、不是污染源）',
      bad.length ? `${bad.length}/${D040_COUNT} 張不同；第一個：${bad[0]}`
        : `${D040_COUNT} 張 ${ops} 筆相等（${((Date.now() - t0) / 1000).toFixed(1)}s）；蓋成油井 ${cov['build:oilwell']}、礦場 ${cov['build:mine']}；`
          + `拒絕（不是油田 ${cov['civic-reason:需油田資源格']}、不是礦藏 ${cov['civic-reason:需礦藏資源格']}、水上 ${cov['civic-reason:只能蓋在陸地上']}、路上 ${cov['civic-reason:交通線上不能建造']}、有建築 ${cov['civic-reason:已有建築']}、`
          + `架空線 ${cov['civic-reason:架空配電線／電線桿擋住']}、高壓走廊 ${cov['civic-reason:高壓電力走廊擋住']}、焦土 ${cov['civic-reason:焦土需先清理']}、隕石坑 ${cov['civic-reason:隕石坑需先剷除']}；錢不夠 ${cov['civic-refused-money']}）；`
          + `樹上加價 ${cov['civic-tree-surcharge']}、沙盒 ${cov['civic-sandbox-free']}、線 ${cov['civic-line']}、框 ${cov['civic-rect']}；拆油井 ${cov['doze-well:k49']}、拆礦場 ${cov['doze-well:k50']}；復原 ${cov['undo-ok']}`);
  }

  // ---- 覆蓋率 ----
  {
    const cov = gold.coverage ?? {}, miss = Object.entries(NEED).filter(([k, n]) => !((cov[k] ?? 0) >= n)).map(([k, n]) => `${k} ${cov[k] ?? 0}/${n}`);
    log(miss.length === 0, 'D040 案例覆蓋（卡面驗收 1）：油井、礦場都蓋成過；拒絕理由（不是對的資源格、水上、交通線上、有建築、架空線、高壓走廊、焦土、隕石坑、錢不夠）都出現；樹上加價、沙盒、線與框；拆油井、拆礦場、復原',
      miss.join('；') || `${Object.keys(NEED).length} 項都達標`);
  }

  // ---- 樣本附的實驗線原文，原樣重跑要重現樣本 ----
  {
    let d = null, err = '';
    const t0 = Date.now();
    try { d = pieces.length ? labAgainst(pieces, want, ORDER, labW(pieces), cases40) : { text: '樣本沒有片段原文' }; } catch (e) { err = e.stack || String(e); }
    log(!d && !err, 'D040 樣本附的實驗線原文在 vm 裡重跑，逐筆重現樣本', err || (d ? `${d.k}（${d.c?.family}）${d.text}` : `${D040_COUNT} 張相等（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
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
        try { d = labAgainst(mutated, want, ORDER, lab, cases40); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(missed.length === 0 && detected.length === MUTANTS.length, `D040 實驗線原碼單點突變：${MUTANTS.length} 個（造價、種類、不清樹／分區／裝飾、蓋下去沒電、資源格判定對調、造價漏了油井或礦場）都跟本線不同`,
      missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  }

  // ---- 本線原碼單點突變 ----
  {
    const source = read('src/sim/rules/build.ts'), detected = [], missed = [], t0 = Date.now();
    let baseline = '';
    try { const d = implAgainst(buildModule(source), want, ORDER.slice(0, 30), cases40); if (d) baseline = `沒改的 build.ts 在 vm 裡就不同：${d.k} 第 ${d.j} 筆`; }
    catch (e) { baseline = `沒改的 build.ts 在 vm 裡載入失敗：${e.message}`; }
    for (const [name, from, to] of MUTANTS_3D) {
      try {
        const parts = source.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點不是剛好一處（${parts.length - 1} 處）`);
        let M;
        try { M = buildModule(parts.join(to)); } catch (e) { throw new Error(`突變後載入失敗：${e.message}`); }
        let d;
        try { d = implAgainst(M, want, ORDER, cases40); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(!baseline && missed.length === 0 && detected.length === MUTANTS_3D.length,
      `D040 本線 build.ts 原碼單點突變：${MUTANTS_3D.length} 個（造價、種類、不清樹／分區／裝飾、沒電、資源格判定對調、資源圖不讀、造價漏了、canPlace 漏了陸地與高壓走廊檢查）都使守衛轉紅`,
      baseline || (missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }
}
