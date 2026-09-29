// D020 驗收 1：垃圾場（dump，$300）的建造規則對拍（公式層）。做法跟 D016／D019 同一套（tools/unit-d016-build.mjs、unit-d019-build.mjs）：
//   1. 黃金樣本 src/content/samples/d020-build.json 由 tools/lab-build.mjs --set=d020 從實驗線原始碼求值產生；案例是 tools/d011-cases.mjs 的 cases20
//      （FAMILIES20：地圖與參數照 D011 的底家族，地圖多放零到兩座垃圾場，操作抽垃圾場，另有「蓋了馬上拆／復原」）。片段清單與原文跟 D011 的樣本逐段相同
//      （垃圾場的 canPlace 51278、placeCost 51534、doPlace 51718–51721、污染源 POL_SRC 52991、蓋印 stampPolSrc 52996 都在同一批片段裡）；
//   2. 常數：本線 COST.dump、fields.ts 的 POL_SRC[8]＝實驗線自己的表；
//   3. 本線 src/sim/rules/build.ts 跑同一批案例，逐筆記錄跟樣本逐字相等：成敗、拒絕理由、造價、資金、每次 doPlace、交易快照與花費、亂數抽取順序、
//      格子欄位、地價髒框、覆蓋場與污染源場（POLBASE）與污染樹減免（POLTREE）與污染（POL）與地價與教育場的雜湊——垃圾場蓋印、拆除撤印、復原重建都逐筆比；
//   4. 樣本附的實驗線原文原樣重跑，要重現樣本；
//   5. 實驗線原碼單點突變（造價、變體範圍與亂數、污染源蓋印與種類與強度與半徑、清樹與分區與裝飾、canPlace 三條、拆除撤印、地價髒框……）都要跟本線不同；
//   6. 本線 build.ts 單點突變都要轉紅；
//   7. 樣本記的覆蓋率達卡面驗收 1 的門檻（錄的時候 tools/lab-build.mjs 已經核過；這裡再核一次，免得樣本被換成覆蓋不夠的）。
// 清運（每天的垃圾量、上線設施、清運區、負載、住宅扣分）不在這裡：另見 tools/unit-d020.mjs。實驗線放置垃圾場只是把清運標成髒（52409 sanDirty445），下次讀取或 tick 才重算；
// 本線每天整張重算（src/sim/day.ts），所以建造這一層沒有對應的當場動作可比。
// 用法：import { d020BuildGuards } from './unit-d020-build.mjs'; await d020BuildGuards(log)　log(ok, 名稱, 細節) 同 tools/unit.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as B from '../src/sim/rules/build.ts';
import { POL_SRC } from '../src/sim/rules/fields.ts';
import { cases20, canon, D020_SEED, D020_COUNT, FAMILIES20, DUMP, makeLab, runMap } from './d011-cases.mjs';
import { REQUIRED_PIECES, D011_LAB_COMMIT, unpack, firstDiff, buildModule, implAgainst, labAgainst, impl3d } from './unit-d011-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 突變跑的順序：各家族輪流（找到第一個不同就停）
const ORDER = (() => {
  const starts = [], out = []; let b = 0;
  for (const [, n] of FAMILIES20) { starts.push([b, n]); b += n; }
  for (let r = 0; out.length < D020_COUNT; r++) for (const [s, n] of starts) if (r < n) out.push(s + r);
  return out;
})();

// 實驗線原碼單點突變：[名稱, 片段, 原文, 改成]（錨點在片段裡要剛好一處）
const DUMP_BLD = 't.bld={k:8,lv:1,v:ri(3),age:0,pw:true,h:1};';
const DUMP_CLR = 't.tree=0;t.zone=0;t.deco=0;\n      stampPolSrc(x,y,8,1);';
const MUTANTS = [
  ['垃圾場造價 300→301', 'COST', 'dump:300,', 'dump:301,'],
  ['垃圾場造價用診所的（250）', 'placeCost', "case 'dump':c=COST.dump;break;", "case 'dump':c=COST.clinic;break;"],
  ['垃圾場變體 ri(3)→ri(4)', 'doPlace', 't.bld={k:8,lv:1,v:ri(3)', 't.bld={k:8,lv:1,v:ri(4)'],
  ['垃圾場變體不抽亂數', 'doPlace', 't.bld={k:8,lv:1,v:ri(3)', 't.bld={k:8,lv:1,v:0'],
  ['垃圾場多抽一次亂數', 'doPlace', 't.bld={k:8,lv:1,v:ri(3)', 't.bld={k:8,lv:1,v:(ri(3),ri(3))'],
  ['垃圾場不蓋污染源', 'doPlace', 'stampPolSrc(x,y,8,1);', ''],
  ['垃圾場污染源種類蓋成電廠的（k5）', 'doPlace', 'stampPolSrc(x,y,8,1);', 'stampPolSrc(x,y,5,1);'],
  ['垃圾場污染源強度 p26→p27', 'POL_SRC', '8:{r:5,p:26},', '8:{r:5,p:27},'],
  ['垃圾場污染源半徑 r5→r4', 'POL_SRC', '8:{r:5,p:26},', '8:{r:4,p:26},'],
  ['垃圾場不清樹', 'doPlace', DUMP_BLD + 't.tree=0;', DUMP_BLD],
  ['垃圾場不清分區', 'doPlace', DUMP_BLD + DUMP_CLR, DUMP_BLD + 't.tree=0;t.deco=0;\n      stampPolSrc(x,y,8,1);'],
  ['垃圾場不清裝飾', 'doPlace', DUMP_BLD + DUMP_CLR, DUMP_BLD + 't.tree=0;t.zone=0;\n      stampPolSrc(x,y,8,1);'],
  ['垃圾場清樹不撤污染樹減免', 'doPlace', 'if(hadTree&&!t.tree)stampPolTree(x,y,-1);', 'if(false)stampPolTree(x,y,-1);'],
  ['canPlace 漏了垃圾場', 'canPlace', "case 'cemetery':case 'dump':", "case 'cemetery':"],
  ['服務設施（垃圾場同一支）可以蓋在水上', 'canPlace', "case 'dump':\n      if(t.t!==2&&t.t!==1)return '只能蓋在陸地上';", "case 'dump':"],
  ['服務設施（垃圾場同一支）可以蓋在路上', 'canPlace', "      if(t.road)return '道路上不能建造';\n", ''],
  ['服務設施（垃圾場同一支）可以蓋在建築上', 'canPlace', "if(t.road)return '道路上不能建造';\n      if(t.bld)return '已有建築';", "if(t.road)return '道路上不能建造';"],
  ['拆垃圾場不撤污染源', 'doPlace', 'if(POL_SRC[bk])stampPolSrc(x,y,bk,-1);', ''],
  ['拆垃圾場撤印用電廠的種類', 'doPlace', 'if(POL_SRC[bk])stampPolSrc(x,y,bk,-1);', 'if(POL_SRC[bk])stampPolSrc(x,y,5,-1);'],
  ['地價框半徑 20→19', 'doPlace', 'markLandDirty(x,y,20);', 'markLandDirty(x,y,19);'],
  ['垃圾場放完也當場重算供電', 'doPlace', "if(syncWtePower||toolId==='plant'||", "if(syncWtePower||toolId==='dump'||toolId==='plant'||"],
  ['垃圾場種類寫成 k29（回收中心）', 'doPlace', 't.bld={k:8,', 't.bld={k:29,'],
  ['垃圾場放下去沒電（pw:false）', 'doPlace', '{k:8,lv:1,v:ri(3),age:0,pw:true,h:1}', '{k:8,lv:1,v:ri(3),age:0,pw:false,h:1}'],
];
// 本線原碼單點突變（build.ts 改一處，型別剝除後在 vm 裡載入重跑）：[名稱, 原文, 改成]（錨點在 build.ts 要剛好一處）
const MUTANTS_3D = [
  ['垃圾場造價 300→301', 'dump: 300', 'dump: 301'],
  ['垃圾場造價用診所的（250）', 'case \'dump\': c = COST.dump; break;', 'case \'dump\': c = COST.clinic; break;'],
  ['垃圾場變體 ri(3)→ri(4)', 'k: 8, lv: 1, v: st.rng.ri(3)', 'k: 8, lv: 1, v: st.rng.ri(4)'],
  ['垃圾場變體不抽亂數', 'k: 8, lv: 1, v: st.rng.ri(3)', 'k: 8, lv: 1, v: 0'],
  ['垃圾場多抽一次亂數', 'k: 8, lv: 1, v: st.rng.ri(3)', 'k: 8, lv: 1, v: (st.rng.ri(3), st.rng.ri(3))'],
  ['少蓋污染源', 'stampPolSrc(g, x, y, 8, 1);', ''],
  ['污染源種類蓋成電廠的（k5）', 'stampPolSrc(g, x, y, 8, 1);', 'stampPolSrc(g, x, y, 5, 1);'],
  ['垃圾場不清樹', 'pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;\n      stampPolSrc(g, x, y, 8, 1);', 'pw: true, h: 1 }; t.zone = 0; t.deco = 0;\n      stampPolSrc(g, x, y, 8, 1);'],
  ['垃圾場不清分區', 'pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;\n      stampPolSrc(g, x, y, 8, 1);', 'pw: true, h: 1 }; t.tree = 0; t.deco = 0;\n      stampPolSrc(g, x, y, 8, 1);'],
  ['垃圾場不清裝飾', 'pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;\n      stampPolSrc(g, x, y, 8, 1);', 'pw: true, h: 1 }; t.tree = 0; t.zone = 0;\n      stampPolSrc(g, x, y, 8, 1);'],
  ['垃圾場清樹不撤污染樹減免', 'if (hadTree && !t.tree) stampPolTree(g, x, y, -1);', 'if (false) stampPolTree(g, x, y, -1);'],
  ['canPlace 漏了垃圾場', "case 'cemetery': case 'dump':", "case 'cemetery':"],
  ['服務設施（垃圾場同一支）可以蓋在水上', "      if (t.t !== 2 && t.t !== 1) return '只能蓋在陸地上';\n", ''],
  ['服務設施（垃圾場同一支）可以蓋在路上', "      if (t.road) return '道路上不能建造';\n", ''],
  ['服務設施（垃圾場同一支）可以蓋在建築上', "if (t.road) return '道路上不能建造';\n      if (t.bld) return '已有建築';", "if (t.road) return '道路上不能建造';"],
  ['拆垃圾場不撤污染源', 'if (POL_SRC[bk]) stampPolSrc(g, x, y, bk, -1);', ''],
  ['拆垃圾場撤印用電廠的種類', 'if (POL_SRC[bk]) stampPolSrc(g, x, y, bk, -1);', 'if (POL_SRC[bk]) stampPolSrc(g, x, y, 5, -1);'],
  ['地價框半徑 20→19', 'markLandDirty(st, x, y, 20);', 'markLandDirty(st, x, y, 19);'],
  ['垃圾場放完也當場重算供電', "if (toolId === 'plant' || roadToolToRc(toolId) || toolId === 'doze') st.onPower?.();", "if (toolId === 'plant' || toolId === 'dump' || roadToolToRc(toolId) || toolId === 'doze') st.onPower?.();"],
  ['垃圾場種類寫成 k29（回收中心）', 'k: 8, lv: 1,', 'k: 29, lv: 1,'],
  ['垃圾場放下去沒電（pw:false）', 'k: 8, lv: 1, v: st.rng.ri(3), age: 0, pw: true, h: 1 }', 'k: 8, lv: 1, v: st.rng.ri(3), age: 0, pw: false, h: 1 }'],
];
// 卡面驗收 1 的覆蓋門檻（同 tools/lab-build.mjs 的 NEED20 的一部分：守衛這邊講得出每一項是什麼）
const NEED = {
  'build:dump': 20, 'civic-reason:只能蓋在陸地上': 1, 'civic-reason:道路上不能建造': 1, 'civic-reason:已有建築': 1, 'civic-reason:焦土需先清理': 1, 'civic-reason:隕石坑需先剷除': 1,
  'civic-refused-money': 1, 'civic-tree-surcharge': 1, 'civic-sandbox-free': 1, 'civic-cost-fractional': 1, 'civic-line': 1, 'civic-rect': 1,
  'dump-on-zone': 1, 'dump-on-deco': 1, 'dump-pol-stamped': 1, 'dump-on-polluted': 1, 'dump-on-clean': 1, 'dump-pol-hit-255': 1,
  'doze-dump': 1, 'doze-dump-pol-unstamped': 1, 'doze-dump-on-saturated': 1, 'undo-civic-build': 1, 'undo-civic-doze': 1, 'log:ri,3': 1,
};

export async function d020BuildGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d020-build.json')), g011 = JSON.parse(read('src/content/samples/d011-build.json'));
  const casesSha = crypto.createHash('sha256').update(read('tools/d011-cases.mjs')).digest('hex');
  let want = [], pieces = [], p011 = [];
  try { want = unpack(gold.exact?.outputs); } catch { want = []; }
  try { pieces = unpack(gold.lab?.pieces); } catch { pieces = []; }
  try { p011 = unpack(g011.lab?.pieces); } catch { p011 = []; }

  // ---- 樣本的出處 ----
  {
    const meta = gold.source?.pieces ?? [], bad = [];
    if (gold.source?.commit !== D011_LAB_COMMIT || gold.source?.repo !== 'lijiabao1998/GlimmerTown-lab') bad.push('commit／repo');
    if (gold.source?.casesSha256 !== casesSha) bad.push('案例檔雜湊（tools/d011-cases.mjs 改過就要重產樣本）');
    if (gold.seed !== D020_SEED || canon(gold.families) !== canon(FAMILIES20) || gold.counts?.maps !== D020_COUNT || want.length !== D020_COUNT) bad.push('種子／家族／張數');
    if (!(D020_COUNT >= 150 && gold.counts?.minOpsPerMap >= 20)) bad.push(`${D020_COUNT} 張、每張至少 ${gold.counts?.minOpsPerMap} 筆`);
    if (gold.exact?.codec !== 'gzip+base64+json' || gold.lab?.codec !== 'gzip+base64+json') bad.push('編碼');
    if (canon(meta.map(p => p.name)) !== canon(REQUIRED_PIECES)) bad.push('片段清單≠D011');
    const textBad = meta.filter((p, i) => pieces[i]?.name !== p.name || crypto.createHash('sha256').update(pieces[i]?.src ?? '').digest('hex') !== p.sha).map(p => p.name);
    if (pieces.length !== meta.length || textBad.length) bad.push(`片段原文雜湊不符：${textBad.join(',')}`);
    if (canon(pieces) !== canon(p011)) bad.push('片段原文≠D011 樣本附的原文');
    const hashBad = want.filter((w, k) => crypto.createHash('sha256').update(w.ops.join('\n') + '\n' + w.end).digest('hex').slice(0, 16) !== gold.hashes?.[k]).length;
    if (hashBad) bad.push(`${hashBad} 張的雜湊不符`);
    log(bad.length === 0, `D020 建造黃金樣本：實驗線 commit d23c18d、案例檔雜湊、片段清單與原文＝D011 樣本（${REQUIRED_PIECES.length} 段，sha256 逐段核對）、≥150 張 × ≥20 筆`,
      bad.join('；') || `${gold.source.commit.slice(0, 7)}；${D020_COUNT} 張 ${gold.counts.ops} 筆；每張至少 ${gold.counts.minOpsPerMap} 筆`);
  }

  // ---- 常數表 ----
  {
    const t = gold.tables ?? {}, bad = [];
    for (const tool of DUMP) if (!(tool in (t.cost ?? {})) || B.COST[tool] !== t.cost[tool]) bad.push(`COST.${tool} ${B.COST[tool]}／${t.cost?.[tool]}`);
    if (canon(B.D020_TOOLS) !== canon(DUMP)) bad.push(`D020_TOOLS ${B.D020_TOOLS}`);
    if (!t.polSrc8 || canon(POL_SRC[8]) !== canon(t.polSrc8)) bad.push(`POL_SRC[8] ${canon(POL_SRC[8])}／${canon(t.polSrc8)}`);
    log(bad.length === 0, 'D020 常數與實驗線逐項相等：垃圾場的造價（COST 37442）、污染源半徑與強度（POL_SRC[8] 52991）',
      bad.join('；') || `dump $${B.COST.dump}；污染源 r${POL_SRC[8].r} p${POL_SRC[8].p}`);
  }

  // ---- 本線逐張逐筆跟樣本相等 ----
  {
    const bad = [], t0 = Date.now(), impl = impl3d();
    let ops = 0;
    for (let k = 0; k < D020_COUNT; k++) {
      const c = cases20(k);
      try {
        const got = runMap(impl, c), d = firstDiff(got, want[k] ?? { ops: [], end: '' }, c);
        ops += c.ops.length;
        if (d) bad.push(`${k}（${c.family} #${c.j}，N=${c.N}）${d.text}`);
      } catch (e) { bad.push(`${k}（${c.family} #${c.j}）：${e.stack || e}`); }
    }
    const cov = gold.coverage ?? {};
    log(bad.length === 0 && want.length === D020_COUNT,
      'D020 建造規則逐筆與實驗線相等：垃圾場的成敗、拒絕理由、造價、資金、每次 doPlace、交易快照與花費、亂數抽取順序、格子欄位、地價髒框、覆蓋與污染源場與污染樹減免與地價與教育場',
      bad.length ? `${bad.length}/${D020_COUNT} 張不同；第一個：${bad[0]}`
        : `${D020_COUNT} 張 ${ops} 筆相等（${((Date.now() - t0) / 1000).toFixed(1)}s）；蓋成垃圾場 ${cov['build:dump']}（ri(3) ${cov['log:ri,3']}）；`
          + `拒絕（水上 ${cov['civic-reason:只能蓋在陸地上']}、路上 ${cov['civic-reason:道路上不能建造']}、有建築 ${cov['civic-reason:已有建築']}、焦土 ${cov['civic-reason:焦土需先清理']}、隕石坑 ${cov['civic-reason:隕石坑需先剷除']}、錢不夠 ${cov['civic-refused-money']}）、`
          + `樹上加價 ${cov['civic-tree-surcharge']}、沙盒 ${cov['civic-sandbox-free']}、造價有小數 ${cov['civic-cost-fractional']}；`
          + `蓋在分區 ${cov['dump-on-zone']}、裝飾 ${cov['dump-on-deco']} 上（清掉）、乾淨 ${cov['dump-on-clean']}／已有污染 ${cov['dump-on-polluted']} 的格子上、蓋到 255 上限 ${cov['dump-pol-hit-255']}；`
          + `拆垃圾場 ${cov['doze-dump']}（撤印 ${cov['doze-dump-pol-unstamped']}、上限那一圈 ${cov['doze-dump-on-saturated']}）、復原蓋 ${cov['undo-civic-build']}／拆 ${cov['undo-civic-doze']}`);
  }

  // ---- 覆蓋率 ----
  {
    const cov = gold.coverage ?? {}, miss = Object.entries(NEED).filter(([k, n]) => !((cov[k] ?? 0) >= n)).map(([k, n]) => `${k} ${cov[k] ?? 0}/${n}`);
    log(miss.length === 0, 'D020 案例覆蓋（卡面驗收 1）：垃圾場蓋成 ≥ 20 次；水上、路上、有建築、焦土、隕石坑、錢不夠都拒絕過；樹上加價、沙盒、造價有小數都出現過；蓋在分區與裝飾上、蓋在乾淨與已有污染的格子上、蓋到 255 上限；拆垃圾場撤印（含上限那一圈）；蓋與拆都被復原；線與框；垃圾場抽 ri(3)',
      miss.join('；') || `${Object.keys(NEED).length} 項都達標`);
  }

  // ---- 樣本附的實驗線原文，原樣重跑要重現樣本 ----
  {
    let d = null, err = '';
    const t0 = Date.now();
    try { d = pieces.length ? labAgainst(pieces, want, ORDER, makeLab(pieces), cases20) : { text: '樣本沒有片段原文' }; } catch (e) { err = e.stack || String(e); }
    log(!d && !err, 'D020 樣本附的實驗線原文在 vm 裡重跑，逐筆重現樣本', err || (d ? `${d.k}（${d.c?.family}）${d.text}` : `${D020_COUNT} 張相等（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
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
        const mutated = pieces.map((p, q) => q === i ? { name: p.name, src: parts.join(to) } : p);   // 照字面接（replace 會把 $' 當特殊符號）
        let lab;
        try { lab = makeLab(mutated); } catch (e) { throw new Error(`突變後載入失敗（突變本身寫錯）：${e.message}`); }
        let d;
        try { d = labAgainst(mutated, want, ORDER, lab, cases20); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(missed.length === 0 && detected.length === MUTANTS.length,
      `D020 實驗線原碼單點突變：${MUTANTS.length} 個（造價、變體範圍與亂數、污染源蓋印與種類與強度與半徑、清樹與分區與裝飾、建築欄位與種類、canPlace 漏一種與水上與路上與建築上、拆除撤印、供電重算、地價框）都讓實驗線跟本線的結果不同`,
      missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  }

  // ---- 本線原碼單點突變 ----
  {
    const source = read('src/sim/rules/build.ts'), detected = [], missed = [], t0 = Date.now();
    let baseline = '';
    try { const d = implAgainst(buildModule(source), want, ORDER.slice(0, 30), cases20); if (d) baseline = `沒改的 build.ts 在 vm 裡就不同：${d.k} 第 ${d.j} 筆`; }
    catch (e) { baseline = `沒改的 build.ts 在 vm 裡載入失敗：${e.message}`; }
    for (const [name, from, to] of MUTANTS_3D) {
      try {
        const parts = source.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點不是剛好一處（${parts.length - 1} 處）`);
        let M;
        try { M = buildModule(parts.join(to)); } catch (e) { throw new Error(`突變後載入失敗：${e.message}`); }
        let d;
        try { d = implAgainst(M, want, ORDER, cases20); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(!baseline && missed.length === 0 && detected.length === MUTANTS_3D.length,
      `D020 本線 build.ts 原碼單點突變：${MUTANTS_3D.length} 個（造價、變體範圍與亂數、少蓋或蓋錯污染源、清樹與分區與裝飾、建築欄位與種類、canPlace 漏一種與水上與路上與建築上、拆除不撤或撤錯印、供電重算、地價框）都使守衛轉紅`,
      baseline || (missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }
}
