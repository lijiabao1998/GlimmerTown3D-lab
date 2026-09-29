// D016 驗收 1：公共設施九支（公園、消防局、派出所、醫院、診所、學校、圖書館、郵局、墓園）的建造規則對拍（公式層）。
// 做法跟 D011 同一套（tools/unit-d011-build.mjs）：
//   1. 黃金樣本 src/content/samples/d016-build.json 由 tools/lab-build.mjs --set=d016 從實驗線原始碼求值產生；案例是 tools/d011-cases.mjs 的 cases16
//      （FAMILIES16：地圖與參數照 D011 的底家族，操作抽公共設施九支，另有「蓋了馬上拆／復原」）。片段清單與原文跟 D011 的樣本逐段相同（同一份實驗線原始碼）；
//   2. 常數：本線 COST 九個新鍵、fields.ts 的 COVR 九個半徑、服務預算類別＝實驗線自己的表；
//   3. 本線 src/sim/rules/build.ts 跑同一批案例，逐筆記錄跟樣本逐字相等（成敗、理由、造價、資金、亂數抽取順序、格子欄位、覆蓋與污染與地價與教育場……，同 D011）；
//   4. 樣本附的實驗線原文原樣重跑，要重現樣本；
//   5. 實驗線原碼單點突變（造價、半徑、變體範圍、派出所抽亂數、覆蓋場、預算類別、道路上不能建造……）都要跟本線不同；
//   6. 本線 build.ts 單點突變（造價、少蓋一個覆蓋場、派出所多抽一次亂數……）都要轉紅；
//   7. 樣本記的覆蓋率達卡面驗收 1 的門檻（錄的時候 tools/lab-build.mjs 已經核過；這裡再核一次，免得樣本被換成覆蓋不夠的）。
// 用法：import { d016BuildGuards } from './unit-d016-build.mjs'; await d016BuildGuards(log)　log(ok, 名稱, 細節) 同 tools/unit.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as B from '../src/sim/rules/build.ts';
import { COVR, SVC_BUDGET_CAT } from '../src/sim/rules/fields.ts';
import { cases16, canon, D016_SEED, D016_COUNT, FAMILIES16, CIVIC, makeLab } from './d011-cases.mjs';
import { REQUIRED_PIECES, D011_LAB_COMMIT, unpack, firstDiff, buildModule, implAgainst, labAgainst, impl3d } from './unit-d011-build.mjs';
import { runMap } from './d011-cases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CIVIC_K = { park: 4, fire: 6, policeBox: 52, hospital: 12, clinic: 13, school: 7, library: 14, post: 15, cemetery: 16 };
const FIELD = { park: 'park', fire: 'fire', policeBox: 'police2', hospital: 'hospital', clinic: 'clinic', school: 'school', library: 'library', post: 'post', cemetery: 'cemetery' };

// 突變跑的順序：各家族輪流（找到第一個不同就停）
const ORDER = (() => {
  const starts = [], out = []; let b = 0;
  for (const [, n] of FAMILIES16) { starts.push([b, n]); b += n; }
  for (let r = 0; out.length < D016_COUNT; r++) for (const [s, n] of starts) if (r < n) out.push(s + r);
  return out;
})();

// 實驗線原碼單點突變：[名稱, 片段, 原文, 改成]
const CANPLACE_SVC = "case 'dump':\n      if(t.t!==2&&t.t!==1)return '只能蓋在陸地上';\n      if(t.road)return '道路上不能建造';\n      if(t.bld)return '已有建築';";
const MUTANTS = [
  ['公園造價 60→61', 'COST', ',park:60,', ',park:61,'],
  ['醫院造價 600→601', 'COST', 'hospital:600,', 'hospital:601,'],
  ['派出所造價 250→249', 'COST', 'policeBox:250,', 'policeBox:249,'],
  ['墓園造價 350→351', 'COST', 'cemetery:350,', 'cemetery:351,'],
  ['學校半徑 8→9', 'COVR', 'school:8,', 'school:9,'],
  ['派出所半徑 5→6', 'COVR', 'police2:5,', 'police2:6,'],
  ['醫院半徑 12→11', 'COVR', 'hospital:12,', 'hospital:11,'],
  ['圖書館不看教育預算', 'SVC_BUDGET_CAT', "library:'edu',", ''],
  ['公園變體 ri(9)→ri(8)', 'doPlace', 't.bld={k:4,lv:1,v:ri(9)', 't.bld={k:4,lv:1,v:ri(8)'],
  ['墓園變體 ri(5)→ri(4)', 'doPlace', 't.bld={k:16,lv:1,v:ri(5)', 't.bld={k:16,lv:1,v:ri(4)'],
  ['派出所也抽亂數', 'doPlace', 't.bld={k:52,lv:1,v:0,', 't.bld={k:52,lv:1,v:ri(5),'],
  ['診所蓋到醫院的場', 'doPlace', "stampCov('clinic',x,y,COVR.clinic,1);", "stampCov('hospital',x,y,COVR.clinic,1);"],
  ['圖書館不蓋覆蓋', 'doPlace', "stampCov('library',x,y,COVR.library,1);", ''],
  ['郵局不清樹', 'doPlace', 't.bld={k:15,lv:1,v:ri(5),age:0,pw:true,h:1};t.tree=0;', 't.bld={k:15,lv:1,v:ri(5),age:0,pw:true,h:1};'],
  ['消防局不清分區', 'doPlace', 't.bld={k:6,lv:1,v:ri(5),age:0,pw:true,h:1};t.tree=0;t.zone=0;', 't.bld={k:6,lv:1,v:ri(5),age:0,pw:true,h:1};t.tree=0;'],
  ['服務設施可以蓋在路上', 'canPlace', CANPLACE_SVC, "case 'dump':\n      if(t.t!==2&&t.t!==1)return '只能蓋在陸地上';\n      if(t.bld)return '已有建築';"],
  ['診所用醫院造價', 'placeCost', "case 'clinic':c=COST.clinic;break;", "case 'clinic':c=COST.hospital;break;"],
];
// 本線原碼單點突變（build.ts 改一處，型別剝除後在 vm 裡載入重跑）
const MUTANTS_3D = [
  ['醫院造價 600→601', 'hospital: 600,', 'hospital: 601,'],
  ['墓園造價 350→351', 'cemetery: 350,', 'cemetery: 351,'],   // D019 起 COST 這一行後面還有水塔、水管
  ['少蓋學校的覆蓋場', "stampCov(g, st.budget, 'school', x, y, COVR.school, 1);", ''],
  ['圖書館蓋到學校的場', "stampCov(g, st.budget, 'library', x, y, COVR.library, 1);", "stampCov(g, st.budget, 'school', x, y, COVR.library, 1);"],
  ['派出所多抽一次亂數', 'k: 52, lv: 1, v: 0,', 'k: 52, lv: 1, v: st.rng.ri(5) * 0,'],
  ['公園變體 ri(9)→ri(8)', 'k: 4, lv: 1, v: st.rng.ri(9)', 'k: 4, lv: 1, v: st.rng.ri(8)'],
  ['郵局不清樹', "k: 15, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0;", "k: 15, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 };"],
  ['canPlace 漏了墓園', "case 'post': case 'cemetery':   // 51278", "case 'post':   // 51278"],
];
// 卡面驗收 1 的覆蓋門檻（同 tools/lab-build.mjs 的 NEED16 的一部分：守衛這邊講得出每一項是什麼）
const NEED = {
  ...Object.fromEntries(CIVIC.map(t => [`build:${t}`, 20])),
  'civic-reason:只能蓋在陸地上': 1, 'civic-reason:道路上不能建造': 1, 'civic-reason:已有建築': 1, 'civic-reason:焦土需先清理': 1, 'civic-reason:隕石坑需先剷除': 1, 'civic-refused-money': 1,
  'civic-tree-surcharge': 1, 'civic-sandbox-free': 1, 'civic-cost-fractional': 1, 'civic-budget-scaled': 1,
  ...Object.fromEntries(Object.values(CIVIC_K).map(k => [`doze-civic:k${k}`, 1])), 'undo-civic-build': 1, 'undo-civic-doze': 1, 'log:ri,9': 1, 'log:ri,5': 1,
};

export async function d016BuildGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d016-build.json')), g011 = JSON.parse(read('src/content/samples/d011-build.json'));
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
    if (gold.seed !== D016_SEED || canon(gold.families) !== canon(FAMILIES16) || gold.counts?.maps !== D016_COUNT || want.length !== D016_COUNT) bad.push('種子／家族／張數');
    if (!(D016_COUNT >= 150 && gold.counts?.minOpsPerMap >= 20)) bad.push(`${D016_COUNT} 張、每張至少 ${gold.counts?.minOpsPerMap} 筆`);
    if (gold.exact?.codec !== 'gzip+base64+json' || gold.lab?.codec !== 'gzip+base64+json') bad.push('編碼');
    if (canon(meta.map(p => p.name)) !== canon(REQUIRED_PIECES)) bad.push('片段清單≠D011');
    const textBad = meta.filter((p, i) => pieces[i]?.name !== p.name || crypto.createHash('sha256').update(pieces[i]?.src ?? '').digest('hex') !== p.sha).map(p => p.name);
    if (pieces.length !== meta.length || textBad.length) bad.push(`片段原文雜湊不符：${textBad.join(',')}`);
    if (canon(pieces) !== canon(p011)) bad.push('片段原文≠D011 樣本附的原文');
    const hashBad = want.filter((w, k) => crypto.createHash('sha256').update(w.ops.join('\n') + '\n' + w.end).digest('hex').slice(0, 16) !== gold.hashes?.[k]).length;
    if (hashBad) bad.push(`${hashBad} 張的雜湊不符`);
    log(bad.length === 0, `D016 建造黃金樣本：實驗線 commit d23c18d、案例檔雜湊、片段清單與原文＝D011 樣本（${REQUIRED_PIECES.length} 段，sha256 逐段核對）、≥150 張 × ≥20 筆`,
      bad.join('；') || `${gold.source.commit.slice(0, 7)}；${D016_COUNT} 張 ${gold.counts.ops} 筆；每張至少 ${gold.counts.minOpsPerMap} 筆`);
  }

  // ---- 常數表 ----
  {
    const t = gold.tables ?? {}, bad = [];
    for (const tool of CIVIC) {
      if (!(tool in (t.cost ?? {})) || B.COST[tool] !== t.cost[tool]) bad.push(`COST.${tool} ${B.COST[tool]}／${t.cost?.[tool]}`);
      const f = FIELD[tool];
      if (!(f in (t.covr ?? {})) || COVR[f] !== t.covr[f]) bad.push(`COVR.${f} ${COVR[f]}／${t.covr?.[f]}`);
    }
    if (canon(SVC_BUDGET_CAT) !== canon(t.budgetCat)) bad.push('服務預算類別');
    if (canon(B.D016_TOOLS) !== canon(CIVIC)) bad.push(`D016_TOOLS ${B.D016_TOOLS}`);
    log(bad.length === 0, 'D016 常數與實驗線逐項相等：九支工具的造價（COST 37442）、覆蓋半徑（COVR 52957）、服務預算類別（SVC_BUDGET_CAT 52967）',
      bad.join('；') || `造價 ${CIVIC.map(x => `${x} ${B.COST[x]}`).join('、')}；半徑 ${CIVIC.map(x => `${FIELD[x]} ${COVR[FIELD[x]]}`).join('、')}`);
  }

  // ---- 本線逐張逐筆跟樣本相等 ----
  {
    const bad = [], t0 = Date.now(), impl = impl3d();
    let ops = 0;
    for (let k = 0; k < D016_COUNT; k++) {
      const c = cases16(k);
      try {
        const got = runMap(impl, c), d = firstDiff(got, want[k] ?? { ops: [], end: '' }, c);
        ops += c.ops.length;
        if (d) bad.push(`${k}（${c.family} #${c.j}，N=${c.N}）${d.text}`);
      } catch (e) { bad.push(`${k}（${c.family} #${c.j}）：${e.stack || e}`); }
    }
    const cov = gold.coverage ?? {};
    log(bad.length === 0 && want.length === D016_COUNT,
      'D016 建造規則逐筆與實驗線相等：九支公共設施的成敗、拒絕理由、造價、資金、每次 doPlace、交易快照與花費、亂數抽取順序、格子欄位、地價髒框、覆蓋與污染與地價與教育場',
      bad.length ? `${bad.length}/${D016_COUNT} 張不同；第一個：${bad[0]}`
        : `${D016_COUNT} 張 ${ops} 筆相等（${((Date.now() - t0) / 1000).toFixed(1)}s）；蓋成 ${CIVIC.map(x => `${x} ${cov[`build:${x}`]}`).join('、')}；`
          + `拒絕（水上 ${cov['civic-reason:只能蓋在陸地上']}、路上 ${cov['civic-reason:道路上不能建造']}、有建築 ${cov['civic-reason:已有建築']}、焦土 ${cov['civic-reason:焦土需先清理']}、隕石坑 ${cov['civic-reason:隕石坑需先剷除']}、錢不夠 ${cov['civic-refused-money']}）、`
          + `樹上加價 ${cov['civic-tree-surcharge']}、沙盒 ${cov['civic-sandbox-free']}、造價有小數 ${cov['civic-cost-fractional']}、預算縮放半徑 ${cov['civic-budget-scaled']}、`
          + `拆新建築 ${Object.values(CIVIC_K).map(q => cov[`doze-civic:k${q}`]).join('/')}、復原蓋 ${cov['undo-civic-build']}／拆 ${cov['undo-civic-doze']}、ri(9) ${cov['log:ri,9']}、ri(5) ${cov['log:ri,5']}`);
  }

  // ---- 覆蓋率 ----
  {
    const cov = gold.coverage ?? {}, miss = Object.entries(NEED).filter(([k, n]) => !((cov[k] ?? 0) >= n)).map(([k, n]) => `${k} ${cov[k] ?? 0}/${n}`);
    log(miss.length === 0, 'D016 案例覆蓋（卡面驗收 1）：每一種新工具蓋成 ≥ 20 次；水上、路上、有建築、焦土、隕石坑、錢不夠都拒絕過；樹上加價、沙盒、科技與特化係數（造價有小數）、服務預算縮放半徑都出現過；九種新建築每一種都被拆過；蓋與拆都被復原過',
      miss.join('；') || `${Object.keys(NEED).length} 項都達標`);
  }

  // ---- 樣本附的實驗線原文，原樣重跑要重現樣本 ----
  {
    let d = null, err = '';
    const t0 = Date.now();
    try { d = pieces.length ? labAgainst(pieces, want, ORDER, makeLab(pieces), cases16) : { text: '樣本沒有片段原文' }; } catch (e) { err = e.stack || String(e); }
    log(!d && !err, 'D016 樣本附的實驗線原文在 vm 裡重跑，逐筆重現樣本', err || (d ? `${d.k}（${d.c?.family}）${d.text}` : `${D016_COUNT} 張相等（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
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
        try { lab = makeLab(mutated); } catch (e) { throw new Error(`突變後載入失敗（突變本身寫錯）：${e.message}`); }
        let d;
        try { d = labAgainst(mutated, want, ORDER, lab, cases16); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(missed.length === 0 && detected.length === MUTANTS.length, `D016 實驗線原碼單點突變：${MUTANTS.length} 個（造價、半徑、預算類別、變體範圍、派出所抽亂數、覆蓋場、清樹與分區、道路上不能建造、造價分支）都讓實驗線跟本線的結果不同`,
      missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  }

  // ---- 本線原碼單點突變 ----
  {
    const source = read('src/sim/rules/build.ts'), detected = [], missed = [], t0 = Date.now();
    let baseline = '';
    try { const d = implAgainst(buildModule(source), want, ORDER.slice(0, 30), cases16); if (d) baseline = `沒改的 build.ts 在 vm 裡就不同：${d.k} 第 ${d.j} 筆`; }
    catch (e) { baseline = `沒改的 build.ts 在 vm 裡載入失敗：${e.message}`; }
    for (const [name, from, to] of MUTANTS_3D) {
      try {
        const parts = source.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點不是剛好一處（${parts.length - 1} 處）`);
        let M;
        try { M = buildModule(parts.join(to)); } catch (e) { throw new Error(`突變後載入失敗：${e.message}`); }
        let d;
        try { d = implAgainst(M, want, ORDER, cases16); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(!baseline && missed.length === 0 && detected.length === MUTANTS_3D.length,
      `D016 本線 build.ts 原碼單點突變：${MUTANTS_3D.length} 個（造價、少蓋一個覆蓋場、蓋錯場、派出所多抽一次亂數、變體範圍、不清樹、canPlace 漏一種）都使守衛轉紅`,
      baseline || (missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }
}
