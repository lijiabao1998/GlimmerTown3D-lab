// D044 驗收 1：天然氣井、太空研究中心的建造規則對拍（公式層）。做法跟 D040 同一套（tools/unit-d040-build.mjs）：
//   1. 黃金樣本 src/content/samples/d044-build.json 由 tools/lab-build.mjs --set=d044 從實驗線原始碼求值產生；案例是 tools/d011-cases.mjs 的 cases44
//      （FAMILIES44：地圖與參數照 D040，資源圖與幾口井照樣帶、大圖多一點；操作抽天然氣井、太空研究中心；目標多一類「整塊 3×3 都是空地的格子」）。
//      片段＝D011 的樣本加一段 canPlaceMulti（51490–51504，太空研究中心 3×3 的逐格判定）；天然氣井的 canPlace 在 51415（資源格）與 canPlace 桶 51365、
//      placeCost 在 51601、doPlace 在 52037（污染源 POL_SRC 117）；太空研究中心 canPlace 在 51436、placeCost 在 51616、doPlace 在 52331–52338，
//      都在 canPlace／placeCost／doPlace 三個函式的原文裡；
//   2. 常數：本線 COST 的 gaswell、megaproject＝實驗線；
//   3. 本線 src/sim/rules/build.ts 跑同一批案例（資源圖由 BuildState.resource 給），逐筆記錄跟樣本逐字相等；
//   4. 樣本附的實驗線原文原樣重跑，要重現樣本；
//   5. 實驗線原碼單點突變（造價、種類、sz、根與參考格、不清樹／分區／裝飾、沒電、污染源、資源格判定、3×3 判定、逐格判定）都要跟本線不同；
//   6. 本線 build.ts 單點突變都要轉紅；
//   7. 樣本記的覆蓋率達卡面驗收 1 的門檻。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as B from '../src/sim/rules/build.ts';
import { cases44, canon, D044_SEED, D044_COUNT, FAMILIES44, INDUSTRY44, makeLab, runMap } from './d011-cases.mjs';
import { REQUIRED_PIECES, D011_LAB_COMMIT, unpack, firstDiff, buildModule, implAgainst, labAgainst, impl3d } from './unit-d011-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const EXTRA = ['canPlaceMulti'];
const PIECES44 = (() => { const a = [...REQUIRED_PIECES]; a.splice(a.indexOf('canPlace') + 1, 0, 'canPlaceMulti'); return a; })();
const ORDER = (() => {
  const starts = [], out = []; let b = 0;
  for (const [, n] of FAMILIES44) { starts.push([b, n]); b += n; }
  for (let r = 0; out.length < D044_COUNT; r++) for (const [s, n] of starts) if (r < n) out.push(s + r);
  return out;
})();
const GAS = "case 'gaswell':{t.tree=0;t.zone=0;t.deco=0;t.bld={k:117,lv:1,v:0,age:0,pw:true,h:1};stampPolSrc(x,y,117,1);break;}";
const MEGA_ROOT = '{k:51,lv:1,v:0,age:0,pw:true,h:1,sz:3}';
const MEGA_LOOP = "if(undoGroup&&!undoGroup.seen[j]){undoGroup.seen[j]=1;undoGroup.snaps.push({i:j,s:JSON.stringify(ct)});}\n        ct.tree=0;ct.zone=0;ct.deco=0;\n        ct.bld=(dx===0&&dy===0)?{k:51,";
const MUTANTS = [
  ['天然氣井造價 1400→1401', 'COST', 'gaswell:1400,', 'gaswell:1401,'],
  ['太空研究中心造價 4500→4501', 'COST', 'megaproject:4500,', 'megaproject:4501,'],
  ['天然氣井種類 k117→k116', 'doPlace', GAS, GAS.replace('k:117', 'k:116')],
  ['天然氣井不清樹', 'doPlace', GAS, GAS.replace('t.tree=0;', '')],
  ['天然氣井不清分區', 'doPlace', GAS, GAS.replace('t.zone=0;', '')],
  ['天然氣井不清裝飾', 'doPlace', GAS, GAS.replace('t.deco=0;', '')],
  ['天然氣井蓋下去沒電（pw:false）', 'doPlace', GAS, GAS.replace('pw:true', 'pw:false')],
  ['天然氣井不是污染源', 'doPlace', GAS, GAS.replace('stampPolSrc(x,y,117,1);', '')],
  ['天然氣井污染源種類 117→116', 'doPlace', GAS, GAS.replace('stampPolSrc(x,y,117,1)', 'stampPolSrc(x,y,116,1)')],
  ['天然氣井資源格 1→2', 'canPlace', "if(toolId==='gaswell'&&RESOURCE[idx(x,y)]!==1)", "if(toolId==='gaswell'&&RESOURCE[idx(x,y)]!==2)"],
  ['造價漏了天然氣井', 'placeCost', "case 'gaswell':c=COST.gaswell;break;", "case 'gaswell':c=0;break;"],
  ['造價漏了太空研究中心', 'placeCost', "case 'megaproject':c=COST.megaproject;break;", "case 'megaproject':c=0;break;"],
  ['太空研究中心根格種類 k51→k50', 'doPlace', MEGA_ROOT, MEGA_ROOT.replace('k:51', 'k:50')],
  ['太空研究中心根格 sz 3→2', 'doPlace', MEGA_ROOT, MEGA_ROOT.replace('sz:3', 'sz:2')],
  ['太空研究中心參考格指向自己（[x,y]→[sx,sy]）', 'doPlace', '{k:51,ref:[x,y]}', '{k:51,ref:[sx,sy]}'],
  ['太空研究中心九格不存快照', 'doPlace', MEGA_LOOP, MEGA_LOOP.replace(/^if\(undoGroup[^\n]*\n\s*/, '')],
  ['太空研究中心不清樹', 'doPlace', MEGA_LOOP, MEGA_LOOP.replace('ct.tree=0;', '')],
  ['太空研究中心不清分區', 'doPlace', MEGA_LOOP, MEGA_LOOP.replace('ct.zone=0;', '')],
  ['太空研究中心不清裝飾', 'doPlace', MEGA_LOOP, MEGA_LOOP.replace('ct.deco=0;', '')],
  ['太空研究中心 3×3→2×2', 'canPlace', "toolId==='megahosp'||toolId==='megaproject')return canPlaceMulti(x,y,3,", "toolId==='megahosp'||toolId==='megaproject')return canPlaceMulti(x,y,2,"],
  ['逐格判定漏了交通線', 'canPlaceMulti', "    if(st.road||st.rail||st.tram)return '交通線擋住';\n", ''],
  ['逐格判定漏了已有建築', 'canPlaceMulti', "    if(st.bld)return '已有建築';\n", ''],
  ['逐格判定漏了焦土', 'canPlaceMulti', "    if(st.ruin)return '焦土需先清理';\n", ''],
  ['逐格判定漏了高壓走廊', 'canPlaceMulti', "    if(st.hv471||st.ug471)return '高壓電力走廊擋住';\n", ''],
  ['逐格判定漏了架空線', 'canPlaceMulti', "    if(st.lv475)return '架空配電線／電線桿擋住';\n", ''],
  ['逐格判定漏了水域（t!==2 才算）', 'canPlaceMulti', 'if(st.t!==2&&st.t!==1)return msg;', 'if(st.t!==2)return msg;'],
];
const MUTANTS_3D = [
  ['天然氣井造價 1400→1401', 'gaswell: 1400, megaproject: 4500 };', 'gaswell: 1401, megaproject: 4500 };'],
  ['太空研究中心造價 4500→4501', 'gaswell: 1400, megaproject: 4500 };', 'gaswell: 1400, megaproject: 4501 };'],
  ['天然氣井種類 k117→k116', 't.bld = { k: 117,', 't.bld = { k: 116,'],
  ['天然氣井不清樹', 't.tree = 0; t.zone = 0; t.deco = 0; t.bld = { k: 117, lv: 1, v: 0, age: 0, pw: true, h: 1 };', 't.zone = 0; t.deco = 0; t.bld = { k: 117, lv: 1, v: 0, age: 0, pw: true, h: 1 };'],
  ['天然氣井不清分區', 't.tree = 0; t.zone = 0; t.deco = 0; t.bld = { k: 117, lv: 1, v: 0, age: 0, pw: true, h: 1 };', 't.tree = 0; t.deco = 0; t.bld = { k: 117, lv: 1, v: 0, age: 0, pw: true, h: 1 };'],
  ['天然氣井不清裝飾', 't.tree = 0; t.zone = 0; t.deco = 0; t.bld = { k: 117, lv: 1, v: 0, age: 0, pw: true, h: 1 };', 't.tree = 0; t.zone = 0; t.bld = { k: 117, lv: 1, v: 0, age: 0, pw: true, h: 1 };'],
  ['天然氣井蓋下去沒電（pw:false）', 't.bld = { k: 117, lv: 1, v: 0, age: 0, pw: true, h: 1 };', 't.bld = { k: 117, lv: 1, v: 0, age: 0, pw: false, h: 1 };'],
  ['天然氣井不是污染源', 'stampPolSrc(g, x, y, 117, 1);', ''],
  ['天然氣井污染源種類 117→116', 'stampPolSrc(g, x, y, 117, 1);', 'stampPolSrc(g, x, y, 116, 1);'],
  ['天然氣井資源格 1→2', "if (toolId === 'gaswell' && r !== 1)", "if (toolId === 'gaswell' && r !== 2)"],
  ['造價漏了天然氣井', "case 'gaswell': c = COST.gaswell; break;", "case 'gaswell': c = 0; break;"],
  ['造價漏了太空研究中心', "case 'megaproject': c = COST.megaproject; break;", "case 'megaproject': c = 0; break;"],
  ['太空研究中心根格種類 k51→k50', '{ k: 51, lv: 1, v: 0, age: 0, pw: true, h: 1, sz: 3 }', '{ k: 50, lv: 1, v: 0, age: 0, pw: true, h: 1, sz: 3 }'],
  ['太空研究中心根格 sz 3→2', '{ k: 51, lv: 1, v: 0, age: 0, pw: true, h: 1, sz: 3 }', '{ k: 51, lv: 1, v: 0, age: 0, pw: true, h: 1, sz: 2 }'],
  ['太空研究中心參考格指向自己（[x,y]→[sx,sy]）', '{ k: 51, ref: [x, y] }', '{ k: 51, ref: [sx, sy] }'],
  ['太空研究中心九格不存快照', 'if (txn && !txn.seen[j]) { txn.seen[j] = 1; txn.snaps.push({ i: j, s: JSON.stringify(ct) }); }\n        ct.tree = 0; ct.zone = 0; ct.deco = 0;\n        ct.bld = (dx === 0', 'ct.tree = 0; ct.zone = 0; ct.deco = 0;\n        ct.bld = (dx === 0'],
  ['太空研究中心不清樹', 'ct.tree = 0; ct.zone = 0; ct.deco = 0;', 'ct.zone = 0; ct.deco = 0;'],
  ['太空研究中心不清分區', 'ct.tree = 0; ct.zone = 0; ct.deco = 0;', 'ct.tree = 0; ct.deco = 0;'],
  ['太空研究中心不清裝飾', 'ct.tree = 0; ct.zone = 0; ct.deco = 0;', 'ct.tree = 0; ct.zone = 0;'],
  ['太空研究中心 3×3→2×2', "canPlaceMulti(st, x, y, 3, '需 3×3 陸地');", "canPlaceMulti(st, x, y, 2, '需 3×3 陸地');"],
  ['逐格判定漏了交通線', "    if (t.road || q.rail || t.tram) return '交通線擋住';\n", ''],
  ['逐格判定漏了已有建築', "    if (t.bld) return '已有建築';\n    if (t.ruin) return '焦土需先清理';\n  }\n  return null;\n}", "    if (t.ruin) return '焦土需先清理';\n  }\n  return null;\n}"],
  ['逐格判定漏了焦土', "    if (t.ruin) return '焦土需先清理';\n  }\n  return null;\n}\nexport function canPlace", "  }\n  return null;\n}\nexport function canPlace"],
  ['逐格判定漏了高壓走廊', "    if (t.hv471 || t.ug471) return '高壓電力走廊擋住';\n    if (t.bld) return '已有建築';\n    if (t.ruin)", "    if (t.bld) return '已有建築';\n    if (t.ruin)"],
  ['逐格判定漏了架空線', "    if (q.lv475) return '架空配電線／電線桿擋住';\n    if (t.hv471 || t.ug471) return '高壓電力走廊擋住';\n    if (t.bld) return '已有建築';\n    if (t.ruin)", "    if (t.hv471 || t.ug471) return '高壓電力走廊擋住';\n    if (t.bld) return '已有建築';\n    if (t.ruin)"],
  ['逐格判定漏了出界（只看地形）', "    if (!inMap(w, sx, sy)) return msg;\n    const t = w.tiles[idx(w, sx, sy)], q = seen(t, st.protect);", "    const t = w.tiles[idx(w, sx, sy)] ?? { t: 0 } as Tile, q = seen(t, st.protect);"],
  ['天然氣井不看資源圖（一律當 0）', 'r = st.resource ? st.resource[idx(w, x, y)] : 0;\n      if (t.t !== 2 && t.t !== 1) return \'只能蓋在陸地上\';\n      if (t.road || q.rail || t.tram) return \'交通線上不能建造\';\n      if (q.lv475) return \'架空配電線／電線桿擋住\';\n      if (t.hv471 || t.ug471) return \'高壓電力走廊擋住\';\n      if (t.bld) return \'已有建築\';\n      if (toolId === \'gaswell\'', 'r = 0;\n      if (t.t !== 2 && t.t !== 1) return \'只能蓋在陸地上\';\n      if (t.road || q.rail || t.tram) return \'交通線上不能建造\';\n      if (q.lv475) return \'架空配電線／電線桿擋住\';\n      if (t.hv471 || t.ug471) return \'高壓電力走廊擋住\';\n      if (t.bld) return \'已有建築\';\n      if (toolId === \'gaswell\''],
];
const NEED = {
  'build:gaswell': 30, 'build:megaproject': 30, 'civic-reason:需油田資源格（天然氣伴生）': 30, 'civic-reason:需 3×3 陸地': 15, 'civic-reason:交通線擋住': 3, 'civic-reason:已有建築': 40,
  'civic-reason:只能蓋在陸地上': 10, 'civic-reason:焦土需先清理': 3, 'civic-reason:隕石坑需先剷除': 2, 'civic-refused-money': 20, 'civic-tree-surcharge': 6, 'civic-sandbox-free': 5, 'civic-line': 10, 'civic-rect': 10,
  'doze-ind:k117': 3, 'doze-ind:k51:root': 3, 'doze-ind:k51:ref': 3, 'undo-ok': 100, 'pre:null': 300,
};

export async function d044BuildGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d044-build.json')), g011 = JSON.parse(read('src/content/samples/d011-build.json'));
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
    if (gold.seed !== D044_SEED || canon(gold.families) !== canon(FAMILIES44) || gold.counts?.maps !== D044_COUNT || want.length !== D044_COUNT) bad.push('種子／家族／張數');
    if (!(D044_COUNT >= 150 && gold.counts?.minOpsPerMap >= 20)) bad.push(`${D044_COUNT} 張、每張至少 ${gold.counts?.minOpsPerMap} 筆`);
    if (canon(meta.map(p => p.name)) !== canon(PIECES44)) bad.push('片段清單≠D011＋canPlaceMulti');
    const textBad = meta.filter((p, i) => pieces[i]?.name !== p.name || crypto.createHash('sha256').update(pieces[i]?.src ?? '').digest('hex') !== p.sha).map(p => p.name);
    if (pieces.length !== meta.length || textBad.length) bad.push(`片段原文雜湊不符：${textBad.join(',')}`);
    if (canon(pieces.filter(p => !EXTRA.includes(p.name))) !== canon(p011)) bad.push('D011 那幾段原文≠D011 樣本附的原文');
    const hashBad = want.filter((w, k) => crypto.createHash('sha256').update(w.ops.join('\n') + '\n' + w.end).digest('hex').slice(0, 16) !== gold.hashes?.[k]).length;
    if (hashBad) bad.push(`${hashBad} 張的雜湊不符`);
    log(bad.length === 0, `D044 建造黃金樣本：實驗線 commit d23c18d、案例檔雜湊、片段＝D011 樣本的 ${REQUIRED_PIECES.length} 段（原文逐段相同）＋canPlaceMulti 一段、≥150 張 × ≥20 筆`,
      bad.join('；') || `${gold.source.commit.slice(0, 7)}；${D044_COUNT} 張 ${gold.counts.ops} 筆；每張至少 ${gold.counts.minOpsPerMap} 筆`);
  }

  // ---- 常數表 ----
  {
    const t = gold.tables ?? {}, bad = [];
    for (const tool of INDUSTRY44) if (!(tool in (t.cost ?? {})) || B.COST[tool] !== t.cost[tool]) bad.push(`COST.${tool} ${B.COST[tool]}／${t.cost?.[tool]}`);
    if (canon(B.D044_TOOLS) !== canon(INDUSTRY44)) bad.push(`D044_TOOLS ${B.D044_TOOLS}`);
    log(bad.length === 0, 'D044 常數與實驗線逐項相等：天然氣井、太空研究中心的造價（COST 37442）', bad.join('；') || INDUSTRY44.map(x => `${x} ${B.COST[x]}`).join('、'));
  }

  // ---- 本線逐張逐筆跟樣本相等 ----
  {
    const bad = [], t0 = Date.now(), impl = impl3d(B);
    let ops = 0;
    for (let k = 0; k < D044_COUNT; k++) {
      const c = cases44(k);
      try {
        const got = runMap(impl, c), d = firstDiff(got, want[k] ?? { ops: [], end: '' }, c);
        ops += c.ops.length;
        if (d) bad.push(`${k}（${c.family} #${c.j}，N=${c.N}）${d.text}`);
      } catch (e) { bad.push(`${k}（${c.family} #${c.j}）：${e.stack || e}`); }
    }
    const cov = gold.coverage ?? {};
    log(bad.length === 0 && want.length === D044_COUNT,
      'D044 建造規則逐筆與實驗線相等：天然氣井的資源格判定（只能蓋在油田上）、太空研究中心的 3×3 逐格判定與拒絕理由、造價、資金、每次 doPlace、交易快照（九格各存一次）與花費、'
      + '亂數抽取順序（沒有抽）、根格與參考格欄位、污染源（天然氣井是、太空研究中心不是）、格子欄位、地價髒框（沒有覆蓋場）',
      bad.length ? `${bad.length}/${D044_COUNT} 張不同；第一個：${bad[0]}`
        : `${D044_COUNT} 張 ${ops} 筆相等（${((Date.now() - t0) / 1000).toFixed(1)}s）；蓋成天然氣井 ${cov['build:gaswell']}、太空研究中心 ${cov['build:megaproject']}；`
          + `拒絕（不是油田 ${cov['civic-reason:需油田資源格（天然氣伴生）']}、3×3 放不下 ${cov['civic-reason:需 3×3 陸地']}、交通線擋住 ${cov['civic-reason:交通線擋住']}、有建築 ${cov['civic-reason:已有建築']}、`
          + `水上 ${cov['civic-reason:只能蓋在陸地上']}、焦土 ${cov['civic-reason:焦土需先清理']}、隕石坑 ${cov['civic-reason:隕石坑需先剷除']}；錢不夠 ${cov['civic-refused-money']}）；`
          + `樹上加價 ${cov['civic-tree-surcharge']}、沙盒 ${cov['civic-sandbox-free']}、線 ${cov['civic-line']}、框 ${cov['civic-rect']}；拆天然氣井 ${cov['doze-ind:k117']}、拆太空研究中心（根 ${cov['doze-ind:k51:root']}、參考格 ${cov['doze-ind:k51:ref']}）；復原 ${cov['undo-ok']}`);
  }

  // ---- 覆蓋率 ----
  {
    const cov = gold.coverage ?? {}, miss = Object.entries(NEED).filter(([k, n]) => !((cov[k] ?? 0) >= n)).map(([k, n]) => `${k} ${cov[k] ?? 0}/${n}`);
    log(miss.length === 0, 'D044 案例覆蓋（卡面驗收 1）：天然氣井、太空研究中心都蓋成過；拒絕理由（不是油田、3×3 放不下、交通線擋住、有建築、水上、焦土、隕石坑、錢不夠）都出現；樹上加價、沙盒、線與框；拆天然氣井、拆太空研究中心（根格與參考格）、復原',
      miss.join('；') || `${Object.keys(NEED).length} 項都達標`);
  }

  // ---- 樣本附的實驗線原文，原樣重跑要重現樣本 ----
  {
    let d = null, err = '';
    const t0 = Date.now();
    try { d = pieces.length ? labAgainst(pieces, want, ORDER, labW(pieces), cases44) : { text: '樣本沒有片段原文' }; } catch (e) { err = e.stack || String(e); }
    log(!d && !err, 'D044 樣本附的實驗線原文在 vm 裡重跑，逐筆重現樣本', err || (d ? `${d.k}（${d.c?.family}）${d.text}` : `${D044_COUNT} 張相等（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
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
        if (from === to) throw new Error('突變沒有改任何字');
        const mutated = pieces.map((p, q) => q === i ? { name: p.name, src: parts.join(to) } : p);
        let lab;
        try { lab = labW(mutated); } catch (e) { throw new Error(`突變後載入失敗（突變本身寫錯）：${e.message}`); }
        let d;
        try { d = labAgainst(mutated, want, ORDER, lab, cases44); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(missed.length === 0 && detected.length === MUTANTS.length, `D044 實驗線原碼單點突變：${MUTANTS.length} 個（造價、種類、sz、根格與參考格、不清樹／分區／裝飾、沒電、污染源、資源格判定、3×3 判定、逐格判定的各項）都跟本線不同`,
      missed.length ? missed.join('；') : `${detected.length} 個都抓到（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  }

  // ---- 本線原碼單點突變 ----
  {
    const source = read('src/sim/rules/build.ts'), detected = [], missed = [], t0 = Date.now();
    let baseline = '';
    try { const d = implAgainst(buildModule(source), want, ORDER.slice(0, 30), cases44); if (d) baseline = `沒改的 build.ts 在 vm 裡就不同：${d.k} 第 ${d.j} 筆`; }
    catch (e) { baseline = `沒改的 build.ts 在 vm 裡載入失敗：${e.message}`; }
    for (const [name, from, to] of MUTANTS_3D) {
      try {
        const parts = source.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點不是剛好一處（${parts.length - 1} 處）`);
        let M;
        try { M = buildModule(parts.join(to)); } catch (e) { throw new Error(`突變後載入失敗：${e.message}`); }
        let d;
        try { d = implAgainst(M, want, ORDER, cases44); } catch (e) { d = { k: -1, text: `執行時例外 ${String(e.message).slice(0, 60)}` }; }
        if (d) detected.push(`${name}：${d.k >= 0 ? `第 ${d.k} 張（${d.c.family}）第 ${d.j} 筆` : d.text}`);
        else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(!baseline && missed.length === 0 && detected.length === MUTANTS_3D.length,
      `D044 本線 build.ts 原碼單點突變：${MUTANTS_3D.length} 個（造價、種類、sz、根格與參考格、不清樹／分區／裝飾、沒電、污染源、資源格判定、3×3 判定、逐格判定的各項）都使守衛轉紅`,
      baseline || (missed.length ? missed.join('；') : `${detected.length} 個都抓到（${((Date.now() - t0) / 1000).toFixed(1)}s）`));
  }
}
