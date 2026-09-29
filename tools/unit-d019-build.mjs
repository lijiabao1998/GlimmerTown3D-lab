// D019 驗收 1：水塔、配水管的建造規則對拍（公式層）。做法跟 D016 同一套（tools/unit-d016-build.mjs）：
//   1. 黃金樣本 src/content/samples/d019-build.json 由 tools/lab-build.mjs --set=d019 從實驗線原始碼求值產生；案例是 tools/d011-cases.mjs 的 cases19
//      （FAMILIES19：地圖與參數照 D011 的底家族，地圖多鋪幾段水管與水塔，操作抽水塔、配水管）。片段＝D011 的樣本加三段
//      （WATER_TOWER_CAP 37425、DESAL_CAP 39655、computeWaterLegacy449 53267–53299）；computeWater 接舊式供水網原文，格子的 wr 一起比；
//   2. 常數：本線 COST 的 water、wpipe＝實驗線；
//   3. 本線 src/sim/rules/build.ts 跑同一批案例（onWater 接 src/sim/rules/water.ts computeWaterLegacy449），逐筆記錄跟樣本逐字相等；
//   4. 樣本附的實驗線原文原樣重跑，要重現樣本；
//   5. 實驗線原碼單點突變（造價、變體範圍、水管規則、水管清掉別層、放完不重算供水網）都要跟本線不同；
//   6. 本線 build.ts 單點突變都要轉紅；
//   7. 樣本記的覆蓋率達卡面驗收 1 的門檻。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as B from '../src/sim/rules/build.ts';
import { computeWaterLegacy449 } from '../src/sim/rules/water.ts';
import { cases19, canon, D019_SEED, D019_COUNT, FAMILIES19, WATER, makeLab, runMap } from './d011-cases.mjs';
import { REQUIRED_PIECES, D011_LAB_COMMIT, unpack, firstDiff, buildModule, implAgainst, labAgainst, impl3d } from './unit-d011-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const EXTRA = ['WATER_TOWER_CAP', 'DESAL_CAP', 'computeWaterLegacy449'];
const PIECES19 = (() => { const a = [...REQUIRED_PIECES]; a.splice(a.indexOf('ROAD_COST'), 0, 'WATER_TOWER_CAP'); a.splice(a.indexOf('T'), 0, 'DESAL_CAP'); a.splice(a.indexOf('rebuildCov') + 1, 0, 'computeWaterLegacy449'); return a; })();
const water = w => computeWaterLegacy449(w);
const ORDER = (() => {
  const starts = [], out = []; let b = 0;
  for (const [, n] of FAMILIES19) { starts.push([b, n]); b += n; }
  for (let r = 0; out.length < D019_COUNT; r++) for (const [s, n] of starts) if (r < n) out.push(s + r);
  return out;
})();
const MUTANTS = [
  ['水塔造價 400→401', 'COST', ',water:400,', ',water:401,'],
  ['水管造價 10→11', 'COST', 'wpipe:10,', 'wpipe:11,'],
  ['水塔變體 ri(5)→ri(4)', 'doPlace', 't.bld={k:10,lv:1,v:ri(5)', 't.bld={k:10,lv:1,v:ri(4)'],
  ['水管可以鋪在水上', 'canPlace', "case 'wpipe':\n      if(t.t!==2&&t.t!==1)return '只能鋪在陸地上';\n", "case 'wpipe':\n"],
  ['水管可以重複鋪', 'canPlace', "      if(t.wp)return '已有水管';\n", ''],
  ['水管清掉分區', 'doPlace', 't.wp=1;recalcInfraMask4_475(x,y);', 't.wp=1;t.zone=0;recalcInfraMask4_475(x,y);'],
  ['放完不重算供水網', 'doPlace', "if(toolId==='water'||toolId==='wpipe'||toolId==='desalination'||toolId==='doze'){waterDirty449=true;syncWaterCap364(computeWater());}", ''],
  // 水塔容量（80）放置時用不到（容量只在每天給水時讀），這裡的案例量不到；它的突變在 tools/unit-d019.mjs（供水網逐格）
  ['拆水管先拆分區', 'doPlace', 'else if(t.wp){t.wp=0;t.wpMask475=0;recalcInfraMask4_475(x,y);}\n      else if(t.zone){t.zone=0;t.office=0;}', 'else if(t.zone){t.zone=0;t.office=0;}\n      else if(t.wp){t.wp=0;t.wpMask475=0;recalcInfraMask4_475(x,y);}'],
];
const MUTANTS_3D = [
  ['水塔造價 400→401', 'water: 400,', 'water: 401,'],
  ['水管造價 10→11', 'wpipe: 10,', 'wpipe: 11,'],
  ['水塔變體 ri(5)→ri(4)', 'k: 10, lv: 1, v: st.rng.ri(5)', 'k: 10, lv: 1, v: st.rng.ri(4)'],
  ['水管可以重複鋪', "      if (t.wp) return '已有水管';\n", ''],
  ['水管清掉樹', '      t.wp = 1;\n', '      t.wp = 1; t.tree = 0;\n'],
  ['放完不重算供水網', "  if (toolId === 'water' || toolId === 'wpipe' || toolId === 'doze') st.onWater?.();", ''],
  ['復原不重算供水網', '  st.onWater?.();                                                               // 66572（D019）\n', ''],
];
const NEED = {
  'build:water': 20, 'build:wpipe': 100, 'civic-reason:只能蓋在陸地上': 1, 'civic-reason:道路上不能建造': 1, 'civic-reason:已有建築': 1, 'civic-reason:只能鋪在陸地上': 1, 'civic-reason:已有水管': 1,
  'civic-reason:焦土需先清理': 1, 'civic-reason:隕石坑需先剷除': 1, 'civic-refused-money': 1, 'civic-tree-surcharge': 1, 'civic-sandbox-free': 1, 'civic-line': 1, 'civic-rect': 1,
  'wpipe-under-bld': 1, 'wpipe-under-road': 1, 'wpipe-on-zone': 1, 'wpipe-keeps-tree': 1, 'water-reach:water': 1, 'water-reach:wpipe': 1, 'water-reach:doze': 1, 'doze:wp': 1, 'doze-tower': 1, 'log:ri,5': 1,
};

export async function d019BuildGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d019-build.json')), g011 = JSON.parse(read('src/content/samples/d011-build.json'));
  const casesSha = crypto.createHash('sha256').update(read('tools/d011-cases.mjs')).digest('hex');
  let want = [], pieces = [], p011 = [];
  try { want = unpack(gold.exact?.outputs); } catch { want = []; }
  try { pieces = unpack(gold.lab?.pieces); } catch { pieces = []; }
  try { p011 = unpack(g011.lab?.pieces); } catch { p011 = []; }
  const labW = ps => makeLab(ps, { water: true });

  // ---- 樣本的出處 ----
  {
    const meta = gold.source?.pieces ?? [], bad = [];
    if (gold.source?.commit !== D011_LAB_COMMIT || gold.source?.repo !== 'lijiabao1998/GlimmerTown-lab') bad.push('commit／repo');
    if (gold.source?.casesSha256 !== casesSha) bad.push('案例檔雜湊（tools/d011-cases.mjs 改過就要重產樣本）');
    if (gold.seed !== D019_SEED || canon(gold.families) !== canon(FAMILIES19) || gold.counts?.maps !== D019_COUNT || want.length !== D019_COUNT) bad.push('種子／家族／張數');
    if (!(D019_COUNT >= 150 && gold.counts?.minOpsPerMap >= 20)) bad.push(`${D019_COUNT} 張、每張至少 ${gold.counts?.minOpsPerMap} 筆`);
    if (canon(meta.map(p => p.name)) !== canon(PIECES19)) bad.push('片段清單≠D011＋三段');
    const textBad = meta.filter((p, i) => pieces[i]?.name !== p.name || crypto.createHash('sha256').update(pieces[i]?.src ?? '').digest('hex') !== p.sha).map(p => p.name);
    if (pieces.length !== meta.length || textBad.length) bad.push(`片段原文雜湊不符：${textBad.join(',')}`);
    if (canon(pieces.filter(p => !EXTRA.includes(p.name))) !== canon(p011)) bad.push('D011 那幾段原文≠D011 樣本附的原文');
    const hashBad = want.filter((w, k) => crypto.createHash('sha256').update(w.ops.join('\n') + '\n' + w.end).digest('hex').slice(0, 16) !== gold.hashes?.[k]).length;
    if (hashBad) bad.push(`${hashBad} 張的雜湊不符`);
    log(bad.length === 0, `D019 建造黃金樣本：實驗線 commit d23c18d、案例檔雜湊、片段＝D011 樣本的 ${REQUIRED_PIECES.length} 段（原文逐段相同）＋水塔容量、淡化廠容量、舊式供水網三段、≥150 張 × ≥20 筆`,
      bad.join('；') || `${gold.source.commit.slice(0, 7)}；${D019_COUNT} 張 ${gold.counts.ops} 筆；每張至少 ${gold.counts.minOpsPerMap} 筆`);
  }

  // ---- 常數表 ----
  {
    const t = gold.tables ?? {}, bad = [];
    for (const tool of WATER) if (!(tool in (t.cost ?? {})) || B.COST[tool] !== t.cost[tool]) bad.push(`COST.${tool} ${B.COST[tool]}／${t.cost?.[tool]}`);
    if (canon(B.D019_TOOLS) !== canon(WATER)) bad.push(`D019_TOOLS ${B.D019_TOOLS}`);
    log(bad.length === 0, 'D019 常數與實驗線逐項相等：水塔、配水管的造價（COST 37442）', bad.join('；') || WATER.map(x => `${x} $${B.COST[x]}`).join('、'));
  }

  // ---- 本線逐張逐筆跟樣本相等 ----
  {
    const bad = [], t0 = Date.now(), impl = impl3d(B, water);
    let ops = 0;
    for (let k = 0; k < D019_COUNT; k++) {
      const c = cases19(k);
      try {
        const got = runMap(impl, c), d = firstDiff(got, want[k] ?? { ops: [], end: '' }, c);
        ops += c.ops.length;
        if (d) bad.push(`${k}（${c.family} #${c.j}，N=${c.N}）${d.text}`);
      } catch (e) { bad.push(`${k}（${c.family} #${c.j}）：${e.stack || e}`); }
    }
    const cov = gold.coverage ?? {};
    log(bad.length === 0 && want.length === D019_COUNT,
      'D019 建造規則逐筆與實驗線相等：水塔、配水管的成敗、拒絕理由、造價、資金、每次 doPlace、交易快照與花費、亂數抽取順序、格子欄位（含每一格接不接得到水 wr）、地價髒框、覆蓋與污染與地價與教育場',
      bad.length ? `${bad.length}/${D019_COUNT} 張不同；第一個：${bad[0]}`
        : `${D019_COUNT} 張 ${ops} 筆相等（${((Date.now() - t0) / 1000).toFixed(1)}s）；蓋成水塔 ${cov['build:water']}、水管 ${cov['build:wpipe']}；`
          + `拒絕（水塔：水上 ${cov['civic-reason:只能蓋在陸地上']}、路上 ${cov['civic-reason:道路上不能建造']}、有建築 ${cov['civic-reason:已有建築']}；水管：水上 ${cov['civic-reason:只能鋪在陸地上']}、已有 ${cov['civic-reason:已有水管']}；錢不夠 ${cov['civic-refused-money']}）；`
          + `水管壓在建築 ${cov['wpipe-under-bld']}、路 ${cov['wpipe-under-road']}、分區 ${cov['wpipe-on-zone']}、樹 ${cov['wpipe-keeps-tree']} 底下；接通格數變了（水塔 ${cov['water-reach:water']}、水管 ${cov['water-reach:wpipe']}、拆除 ${cov['water-reach:doze']}）；拆水管 ${cov['doze:wp']}、拆水塔 ${cov['doze-tower']}`);
  }

  // ---- 覆蓋率 ----
  {
    const cov = gold.coverage ?? {}, miss = Object.entries(NEED).filter(([k, n]) => !((cov[k] ?? 0) >= n)).map(([k, n]) => `${k} ${cov[k] ?? 0}/${n}`);
    log(miss.length === 0, 'D019 案例覆蓋（卡面驗收 1）：水塔、水管都蓋成過；兩種的拒絕理由（水上、路上、有建築、已有水管、焦土、隕石坑、錢不夠）都出現；水管壓在建築、路、分區、樹底下；放水塔、水管、拆除都改過接通的水管；拆水管、拆水塔；水塔抽 ri(5)',
      miss.join('；') || `${Object.keys(NEED).length} 項都達標`);
  }

  // ---- 樣本附的實驗線原文，原樣重跑要重現樣本 ----
  {
    let d = null, err = '';
    const t0 = Date.now();
    try { d = pieces.length ? labAgainst(pieces, want, ORDER, labW(pieces), cases19) : { text: '樣本沒有片段原文' }; } catch (e) { err = e.stack || String(e); }
    log(!d && !err, 'D019 樣本附的實驗線原文在 vm 裡重跑，逐筆重現樣本', err || (d ? `${d.k}（${d.c?.family}）${d.text}` : `${D019_COUNT} 張相等（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
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
        try { d = labAgainst(mutated, want, ORDER, lab, cases19); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(missed.length === 0 && detected.length === MUTANTS.length, `D019 實驗線原碼單點突變：${MUTANTS.length} 個（造價、變體範圍、水管規則兩條、水管清掉分區、放完不重算供水網、拆除時水管與分區的先後）都跟本線不同`,
      missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  }

  // ---- 本線原碼單點突變 ----
  {
    const source = read('src/sim/rules/build.ts'), detected = [], missed = [], t0 = Date.now();
    let baseline = '';
    try { const d = implAgainst(buildModule(source), want, ORDER.slice(0, 30), cases19, water); if (d) baseline = `沒改的 build.ts 在 vm 裡就不同：${d.k} 第 ${d.j} 筆`; }
    catch (e) { baseline = `沒改的 build.ts 在 vm 裡載入失敗：${e.message}`; }
    for (const [name, from, to] of MUTANTS_3D) {
      try {
        const parts = source.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點不是剛好一處（${parts.length - 1} 處）`);
        let M;
        try { M = buildModule(parts.join(to)); } catch (e) { throw new Error(`突變後載入失敗：${e.message}`); }
        let d;
        try { d = implAgainst(M, want, ORDER, cases19, water); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(!baseline && missed.length === 0 && detected.length === MUTANTS_3D.length,
      `D019 本線 build.ts 原碼單點突變：${MUTANTS_3D.length} 個（造價、變體範圍、水管可以重複鋪、水管清掉樹、放完或復原不重算供水網）都使守衛轉紅`,
      baseline || (missed.length ? missed.join('；') : `${detected.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }
}
