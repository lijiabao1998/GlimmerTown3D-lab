// D011 建造規則的黃金樣本：照 D009／D010 的做法（tools/lab-rules.mjs、tools/lab-fields.mjs），從 2D 實驗線 index.html 摘出原始碼文字，
// 在 Node vm 裡對 tools/d011-cases.mjs 的隨機小圖求值：實驗線自己的 canPlace／placeCost／doPlace（本卡工具的分支）、
// 觸控手勢 paintTo／roadDraftTiles436／commitRoadDraft436／commitRect、交易 openUndo／closeUndo、復原 undo／restoreTxn460／syncWorldAfterTransaction460、
// 地價髒框 markLandDirty、覆蓋與污染蓋印、rebuildCov。片段文字一個字都不改；片段以外的東西換成樁（見 d011-cases.mjs makeLab）。
// 片段原文也存進樣本（gzip）：本線守衛在沒有實驗線的環境（CI）也能核雜湊、重跑、做原碼單點突變。
// 用法：node tools/lab-build.mjs --lab=<實驗線工作目錄>   → src/content/samples/d011-build.json
//       node tools/lab-build.mjs --lab=<實驗線工作目錄> --set=d016   → src/content/samples/d016-build.json（D016 公共設施的家族 cases16，同一批片段；
//       覆蓋率另有一份門檻 NEED16，civic-* 與 doze-civic、undo-civic 標籤只在 d016 記，D011 的樣本逐字不變）
//       node tools/lab-build.mjs --lab=<實驗線工作目錄> --set=d019   → src/content/samples/d019-build.json（D019 水塔、配水管：家族 cases19；
//       片段多三段（WATER_TOWER_CAP、DESAL_CAP、computeWaterLegacy449），computeWater 接舊式供水網原文，格子的 wr 一起比；門檻 NEED19）
//       node tools/lab-build.mjs --lab=<實驗線工作目錄> --set=d020   → src/content/samples/d020-build.json（D020 垃圾場：家族 cases20，片段同 D011；門檻 NEED20）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { labSource } from './labsrc.mjs';
import { cases, D011_SEED, D011_COUNT, FAMILIES, cases16, D016_SEED, D016_COUNT, FAMILIES16, CIVIC, cases19, D019_SEED, D019_COUNT, FAMILIES19, WATER, cases20, D020_SEED, D020_COUNT, FAMILIES20, DUMP, makeLab, labImpl, runMap, RENDER_KEYS } from './d011-cases.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAB = path.resolve(arg('lab', path.join(ROOT, 'scratch/lab-src')));
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const SET = arg('set', 'd011');
if (!['d011', 'd016', 'd019', 'd020'].includes(SET)) throw new Error(`--set 只能是 d011、d016、d019 或 d020：${SET}`);
const D16 = SET === 'd016', D19 = SET === 'd019', D20 = SET === 'd020';
const CASES = D16 ? cases16 : D19 ? cases19 : D20 ? cases20 : cases, COUNT = D16 ? D016_COUNT : D19 ? D019_COUNT : D20 ? D020_COUNT : D011_COUNT;
// D016：公共設施九支的種類與服務預算類別（doPlace 51667–51717、SVC_BUDGET_CAT 52967；公園、郵局、墓園不看預算）
const CIVIC_K = { park: 4, fire: 6, policeBox: 52, hospital: 12, clinic: 13, school: 7, library: 14, post: 15, cemetery: 16 };
const CIVIC_KS = new Set(Object.values(CIVIC_K));
const CIVIC_CAT = { fire: 'fire', policeBox: 'police', hospital: 'health', clinic: 'health', school: 'edu', library: 'edu' };
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
if (commit !== PINNED) throw new Error(`D011 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const L = labSource(html);
const t0 = Date.now();

// ---- 片段（照載入順序；行號＝index.html @ d23c18d）----
const P = [
  ['clamp', () => L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);')],                          // 37219
  ['mulberry32', () => L.fn('mulberry32')],                                                                // 37221
  ...(D19 ? [['WATER_TOWER_CAP', () => L.exact('WATER_TOWER_CAP', 'const WATER_TOWER_CAP=80;   // 每座水塔供水建築數（T31）')]] : []),   // 37425（D019）
  ['ROAD_COST', () => L.decl('ROAD_COST')],                                                                // 37428
  ['COST', () => L.decl('COST')],                                                                          // 37442（本卡用到的鍵之後沒有再被 Object.assign 改過：37536–37546、67110、67242）
  ['sq', () => L.exact('sq', 'const sq=(id,on,off)=>spec386===id?on:off;')],                              // 37851
  ['tool', () => L.exact('tool', "let tool='pan';")],                                                     // 38109
  ['tq', () => L.decl('tq')],                                                                              // 38549
  ...(D19 ? [['DESAL_CAP', () => L.exact('DESAL_CAP', 'const DESAL_CAP=80;')]] : []),                   // 39655（D019）
  ['T', () => L.exact('T', 'const T=i=>tiles[i];')],                                                     // 39730
  ['idx', () => L.exact('idx', 'const idx=(x,y)=>y*N+x;')],                                              // 39731
  ['inMap', () => L.decl('inMap')],                                                                        // 39732
  ['recalcMask', () => L.fn('recalcMask')],                                                                // 51147（畫面遮罩；照樣跑，比對時不算）
  ['roadToolToRc', () => L.fn('roadToolToRc')],                                                            // 51161
  ['roadCostAt', () => L.fn('roadCostAt')],                                                                // 51191
  ['canPlace', () => L.fn('canPlace')],                                                                    // 51262–51489
  ['placeCost', () => L.fn('placeCost')],                                                                  // 51504–51625
  ['doPlace', () => L.fn('doPlace')],                                                                      // 51626–52415
  ['countNear', () => L.fn('countNear')],                                                                  // 52934
  ['COVR', () => L.span('COVR', 'const COVR={park:4,', 'Object.assign(COVR,{medcamp:24,')],               // 52957–52959
  ['COV', () => L.exact('COV', 'const COV={};for(const f in COVR)COV[f]=new Uint8Array(N*N);')],         // 52960
  ['covFieldOfK', () => L.fn('covFieldOfK')],                                                              // 52962
  ['svcBudget', () => L.decl('svcBudget')],                                                                // 52966
  ['SVC_BUDGET_CAT', () => L.decl('SVC_BUDGET_CAT')],                                                      // 52967
  ['covFieldOfK 覆寫', () => L.span('covFieldOfK 覆寫', 'const covFieldOfKBase=covFieldOfK;', 'covFieldOfK=(k)=>({124:')],   // 52975–52976
  ['stampCov', () => L.fn('stampCov')],                                                                    // 52977
  ['POL', () => L.decl('POL')],                                                                            // 52990
  ['POL_SRC', () => L.span('POL_SRC', 'const POL_SRC={3:{r:5,p:30}', 'Object.assign(POL_SRC,{140:')],    // 52991–52992
  ['POL_LV3_MAX', () => L.decl('POL_LV3_MAX')],                                                            // 52993
  ['recomputePol', () => L.fn('recomputePol')],                                                            // 52994
  ['stampPolSrc', () => L.fn('stampPolSrc')],                                                              // 52996
  ['stampPolTree', () => L.fn('stampPolTree')],                                                            // 53007
  ['LAND', () => L.decl('LAND')], ['landDirty', () => L.decl('landDirty')], ['landBox', () => L.decl('landBox')],   // 53066、53067、53073
  ['markLandDirty', () => L.fn('markLandDirty')],                                                          // 53074–53084
  ['landStaticAt', () => L.fn('landStaticAt')],                                                            // 53087
  ['recomputeLandDynamic', () => L.fn('recomputeLandDynamic')],                                            // 53098
  ['EDU', () => L.decl('EDU')], ['EDU_W_SCHOOL', () => L.decl('EDU_W_SCHOOL')],                            // 53127、53128
  ['eduStaticAt', () => L.fn('eduStaticAt')],                                                              // 53129
  ['rebuildCov', () => L.fn('rebuildCov')],                                                                // 53135–53157
  ...(D19 ? [['computeWaterLegacy449', () => L.fn('computeWaterLegacy449')]] : []),                        // 53267–53299（D019）
  ['allocGrids', () => L.fn('allocGrids')],                                                                // 56931
  ['roadDraftTiles436', () => L.fn('roadDraftTiles436')],                                                  // 62597–62602
  ['rect', () => L.exact('rect', 'const rect={on:false,x0:0,y0:0,x1:0,y1:0};')],                          // 62707
  ['手勢狀態', () => L.exact('手勢狀態', 'let panBase=null,pinchBase=null,paintLast=null,downInfo=null,firstPaint=null,dozeArm=null;')],   // 62709
  ['觸控狀態', () => L.exact('觸控狀態', 'let touchBuild436=null,roadDraft436=null,edgePanTimer436=null,edgePanState436=null;')],        // 62712
  ['復原堆疊', () => L.exact('復原堆疊', 'let undoStack=[],redoStack=[],undoGroup=null,txnHistory460=[];')],                             // 62716
  ['txnLabel460', () => L.fn('txnLabel460')],                                                              // 62717
  ['openUndo', () => L.fn('openUndo')],                                                                    // 62725
  ['closeUndo', () => L.fn('closeUndo')],                                                                  // 62726–62733
  ['paintTo', () => L.fn('paintTo')],                                                                      // 62751–62762
  ['commitRoadDraft436', () => L.fn('commitRoadDraft436')],                                                // 62779–62782
  ['commitRect', () => L.fn('commitRect')],                                                                // 62974–63006
  ['syncWorldAfterTransaction460', () => L.fn('syncWorldAfterTransaction460')],                            // 66570–66580
  ['restoreTxn460', () => L.fn('restoreTxn460')],                                                          // 66581–66585
  ['undo', () => L.fn('undo')],                                                                            // 66594–66598
];
const pieces = P.map(([name, get]) => ({ name, src: get() }));
if (L.pieces.length !== pieces.length || L.pieces.some((p, i) => p.name !== pieces[i].name)) throw new Error('片段名稱與 labSource 記錄對不上');

// ---- 跑：spy 統計覆蓋率（只讀）----
const lab = makeLab(pieces, { water: D19 }), impl = labImpl(lab);
const tags = new Map(), tag = (k, n = 1) => tags.set(k, (tags.get(k) || 0) + n);
const inMap = (x, y) => x >= 0 && y >= 0 && x < lab.N() && y < lab.N();
const LAYERS = ['ruin', 'crater', 'bld', 'rail', 'tram', 'dock', 'rdec', 'bus', 'lv475|ud475', 'fly475|ix475', 'hv471|ug471', 'wm472|sm472', 'road', 'wp', 'zone', 'tree', 'deco',
  'oneway', 'light', 'busLane', 'levee', 'flood'];   // 51777–51818 的順序（只用來貼標籤，不影響輸出）
const topLayer = t => LAYERS.find(l => l.split('|').some(k => t[k]));
// 同一筆交易裡「整棟快照之後再拆同一格」：拆多格建築時占地迴圈（51789）替還沒存過的格存快照、記 seen；
// 框或線後面再拆到這些格的下一層，doPlace（51635）看到 seen 就不再存。via：格號 → [這一格是哪一筆多格拆除存的（從根格或 ref 格起）, 是不是根格]，每一筆手勢重來
const group = lab.run('()=>undoGroup');
let opKind = '', lineShort = false, via = new Map(), resnapped = false;
lab.spy = {
  before(tool, x, y) {
    const N = lab.N(), t = inMap(x, y) ? lab.tiles()[y * N + x] : null, g = group();
    let foot = null;   // 這一筆拆的是多格建築（51779–51796）：占地裡目標以外、這一筆之前還沒存快照的格
    if (t && tool === 'doze' && t.bld && !t.ruin && !t.crater) {
      const r = t.bld.ref || [x, y], rb = inMap(r[0], r[1]) ? lab.tiles()[r[1] * N + r[0]].bld : null, sz = (rb && rb.sz) || 1;
      if (sz > 1) {
        foot = [];
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
          const sx = r[0] + dx, sy = r[1] + dy, j = sy * N + sx;
          if (inMap(sx, sy) && j !== y * N + x && !(g && g.seen[j])) foot.push([j, dx === 0 && dy === 0]);
        }
      }
    }
    const wr = D19 ? lab.tiles().filter(q => q.wr).length : 0, pol = D20 ? lab.run('POL').reduce((a, v) => a + v, 0) : 0;
    return { wr, pol, t: t ? JSON.parse(JSON.stringify(t)) : null, money: lab.money(), reason: lab.canPlace(tool, x, y), cost: t ? lab.placeCost(tool, x, y) : null, land: lab.getLand()[1] === null && lab.getLand()[0],
      seen: !!(t && g && g.seen[y * N + x]), foot, fromRef: !!(t && t.bld && t.bld.ref) };
  },
  after(s0, tool, x, y, ok) {
    tag(`call:${opKind}`);
    if (!s0.t) { tag('call-out-of-map'); return; }
    if (s0.land) tag('land-full-to-box');
    const civ = (D16 && CIVIC.includes(tool)) || (D19 && WATER.includes(tool)) || (D20 && DUMP.includes(tool));
    if (s0.reason) { tag(`reason:${tool === 'doze' ? 'doze:' : ''}${s0.reason}`); if (civ) tag(`civic-reason:${s0.reason}`); return; }
    if (!ok) {
      if (civ && s0.cost > s0.money) { tag('civic-refused-money'); if (s0.cost - s0.money <= 1) tag('civic-refused-money-by≤1'); }
      if (s0.cost > s0.money) { tag('refused-money'); if (s0.cost - s0.money <= 1) tag('refused-money-by≤1'); if (s0.cost === 0) tag('refused-money-negative'); if (opKind === 'line') { tag('line-ran-out'); lineShort = true; } }
      else tag(`noop:${tool}`);
      return;
    }
    if (opKind === 'line' && lineShort) tag('line-cheaper-after-short');   // 錢不夠拒絕之後，後面更便宜的格照樣蓋
    if (s0.foot) for (const [j, root] of s0.foot) via.set(j, [s0.fromRef ? 'via-ref' : 'via-root', root]);
    if (s0.seen) {   // 成功、而且這一格在同一筆交易裡已經存過快照（每一筆手勢每格只碰一次，所以只可能是占地迴圈存的）
      const v = via.get(y * lab.N() + x);
      if (!v) tag('txn-resnap-other');
      else {
        resnapped = true;
        tag('txn-resnap-after-multi'); tag(`txn-resnap-after-multi:${v[0]}`); tag(`txn-resnap-after-multi:${opKind}`); tag(`txn-resnap-after-multi:layer:${topLayer(s0.t)}`);
        if (v[1]) tag('txn-resnap-after-multi:root');   // 回到根格：只有線走得到（框裡的根格一定是占地第一個被碰到的格）
      }
    }
    const b = s0.t, t = lab.tiles()[y * lab.N() + x];
    if (s0.cost === s0.money && s0.cost > 0) tag('money-exact');
    if (s0.cost % 1) tag('cost-fractional');
    if (lab.diff() === 3) tag('sandbox-free');
    if (tool !== 'doze' && b.tree) tag('tree-surcharge');
    if (['alley', 'road', 'coll', 'art', 'hwy'].includes(tool)) tag(b.road ? (b.t === 0 ? 'road-upgrade-bridge' : 'road-upgrade') : b.t === 0 ? 'road-bridge' : 'road-new');
    else if (['zr', 'zc', 'zi'].includes(tool)) tag(b.zone ? (b.zone === t.zone ? 'zone-same-on-tree' : 'zone-rezone-free') : 'zone-new');
    else if (tool === 'doze') { const l = topLayer(b), below = LAYERS.slice(LAYERS.indexOf(l) + 1).find(q => q.split('|').some(k => b[k])); if (below) tag(`doze-order:${l}>${below}`); tag(`doze:${l}${l === 'bld' ? (b.bld.ref || b.bld.sz > 1 ? ':multi' : b.bld.k <= 3 ? `:rci-lv${b.bld.lv}` : ':svc') : ''}`); if (l === 'bld' && b.zone && t.zone) tag('doze:bld-keeps-zone'); if (l === 'ruin' && b.zone) tag('doze:ruin-with-zone'); if (b.crater) tag('doze:crater-120'); }
    else tag(`build:${tool}`);
    if (civ) {
      if (s0.cost === s0.money && s0.cost > 0) tag('civic-money-exact');
      if (s0.cost % 1) tag('civic-cost-fractional');
      if (lab.diff() === 3) tag('civic-sandbox-free');
      if (b.tree) tag('civic-tree-surcharge');
      if (CIVIC_CAT[tool] && lab.run('svcBudget')[CIVIC_CAT[tool]] !== 1) tag('civic-budget-scaled');
      if (opKind !== 'tap') tag(`civic-${opKind}`);
    }
    if (D19) {   // D019：水管壓在建築、路、分區、樹底下；放完或拆完接通的水管格數變了
      if (tool === 'wpipe') { if (b.bld) tag('wpipe-under-bld'); if (b.road) tag('wpipe-under-road'); if (b.zone) tag('wpipe-on-zone'); if (b.tree) tag('wpipe-keeps-tree'); }
      if (lab.tiles().filter(q => q.wr).length !== s0.wr) tag(`water-reach:${tool}`);
      if (tool === 'doze' && topLayer(b) === 'bld' && !b.bld.ref && b.bld.k === 10) tag('doze-tower');
    }
    if (D20 && tool === 'doze' && topLayer(b) === 'bld' && !b.bld.ref && b.bld.k === 8) tag('doze-dump');   // D020：拆垃圾場（污染源撤掉）
    if (D20 && tool === 'dump' && s0.pol !== lab.run('POL').reduce((a, v) => a + v, 0)) tag('dump-pol');   // 放下去污染場變了（stampPolSrc 51720）
    if (D16 && tool === 'doze' && topLayer(b) === 'bld' && !b.bld.ref && !(b.bld.sz > 1) && CIVIC_KS.has(b.bld.k)) tag(`doze-civic:k${b.bld.k}`);
  },
};
// 有「整棟快照後再拆同一格」的交易 → 手勢之前的格子（去掉畫面遮罩）；復原這一筆之後要一模一樣
const resnapTxn = new Map(), flat = () => lab.tiles().map(t => JSON.stringify(t, (k, v) => RENDER_KEYS.has(k) ? undefined : v)).join('\n');
for (const m of ['tap', 'line', 'rect', 'undo']) {
  const f = impl[m];
  impl[m] = op => {
    opKind = m; lineShort = false; via = new Map(); resnapped = false;
    const top0 = lab.getStack().at(-1), pre = (m === 'line' || m === 'rect') && op.tool === 'doze' ? flat() : null, r = f(op), top = lab.getStack().at(-1);
    if (m === 'undo') {
      if (r && resnapTxn.has(top0)) { tag('txn-resnap-undone'); if (flat() === resnapTxn.get(top0)) tag('txn-resnap-undo-restores'); }
      if (D16 && r && top0) for (const q of top0.snaps) {   // 復原的這一筆蓋了／拆了公共設施（快照前後，closeUndo 62729 存的 s、a）
        const s = JSON.parse(q.s).bld, a = JSON.parse(q.a).bld;
        if (a && !a.ref && CIVIC_KS.has(a.k) && !s) tag('undo-civic-build');
        if (s && !s.ref && CIVIC_KS.has(s.k) && !a) tag('undo-civic-doze');
      }
    }
    else if (resnapped && top !== top0) resnapTxn.set(top, pre);
    return r;
  };
}

const outputs = [], hashes = [];
let nOps = 0, minOps = Infinity, bytesRaw = 0;
const opCounts = {};
for (let k = 0; k < COUNT; k++) {
  const c = CASES(k), raw = [];
  const r = runMap(impl, c, { raw });
  outputs.push(r);
  hashes.push(crypto.createHash('sha256').update(r.ops.join('\n') + '\n' + r.end).digest('hex').slice(0, 16));
  nOps += c.ops.length; minOps = Math.min(minOps, c.ops.length); bytesRaw += r.ops.reduce((n, s) => n + s.length, 0) + r.end.length;
  // 手勢層級的標籤（從記錄讀，不影響輸出）
  let depth = 0, arm = null, money = c.money0;
  for (let j = 0; j < c.ops.length; j++) {
    const op = c.ops[j], rec = raw[j];
    opCounts[op.op] = (opCounts[op.op] || 0) + 1;
    if (op.op === 'rect') {
      const toasts = rec.res?.[1] ?? [];
      for (const s of toasts) tag(s.startsWith('資金不足') ? 'rect-refused-money' : s.startsWith('⚠️ 再點一次') ? 'rect-armed' : s.startsWith('已跳過') ? 'rect-skip-hi' : 'rect-other-toast');
      if (op.tool === 'doze' && op.x0 === op.x1 && op.y0 === op.y1 && arm && !rec.arm && rec.res[0] > 0) tag('rect-arm-consumed');
      if (arm && rec.arm && arm[0] === rec.arm[0] && rec.arm[1] !== arm[1]) tag(op.now - arm[1] === 3000 ? 'rect-arm-expired-at-3000' : 'rect-arm-expired');
      if (rec.res[0] > 1 && op.tool === 'police') tag('rect-police-multi');
    }
    if (op.op === 'line') { const b = rec.res[1]; if (b.includes(1) && b.includes(0)) tag('line-mixed'); if (b.includes(1) && b.lastIndexOf(0) > b.indexOf(1)) tag('line-prefix-then-refused'); }
    if (op.op === 'undo') { tag(rec.res ? 'undo-ok' : 'undo-empty'); if (rec.res && rec.money !== money) tag('undo-refund'); }
    if (rec.txn && depth === 40) tag('undo-cap-hit');
    if (rec.txn && rec.txn[1].length > 1 && op.op === 'tap') tag('txn-multi-tile-doze');
    if (op.op === 'money') tag(op.next !== undefined ? 'money-next' : 'money-set');
    if (op.op === 'tap') { tag(`pre:${rec.pre[0]}`); if (rec.pre[1] === 'throw') tag('pre:cost-throw'); }
    if (op.op !== 'undo' && op.op !== 'money' && !rec.txn && (rec.calls ?? []).some(q => q[2] === 0)) tag('txn-dropped');
    for (const e of rec.log) tag(`log:${e.join(',')}`);
    depth = rec.depth; arm = rec.arm; money = rec.money;
  }
}
const cov = Object.fromEntries([...tags].sort(([a], [b]) => a.localeCompare(b)));
// 覆蓋率門檻：卡面驗收 1 要涵蓋的每一種情形都真的發生過
const NEED = {
  'pre:超出地圖': 20, 'pre:null': 500, 'pre:cost-throw': 1, 'reason:已為同級或更高級道路': 20, 'reason:有建築擋住': 20, 'reason:只能劃在陸地上': 10, 'reason:道路上不能分區': 10, 'reason:已有建築': 20,
  'reason:只能蓋在陸地上': 5, 'reason:道路上不能建造': 5, 'reason:doze:這裡沒東西': 20, 'reason:焦土需先清理': 2, 'reason:隕石坑需先剷除': 2,
  'refused-money': 50, 'refused-money-by≤1': 10, 'refused-money-negative': 5, 'money-exact': 20, 'cost-fractional': 50, 'sandbox-free': 50, 'tree-surcharge': 50,
  'road-new': 100, 'road-bridge': 20, 'road-upgrade': 50, 'road-upgrade-bridge': 5, 'zone-new': 100, 'zone-rezone-free': 20, 'zone-same-on-tree': 3, 'noop:zr': 3,
  'build:plant': 20, 'build:police': 20, 'doze:bld:multi': 10, 'doze:bld:rci-lv1': 10, 'doze:bld:rci-lv2': 5, 'doze:bld:rci-lv3': 5, 'doze:bld:svc': 10, 'doze:bld-keeps-zone': 10,
  'doze:road': 20, 'doze:zone': 20, 'doze:tree': 20, 'doze:deco': 5, 'doze:rdec': 3, 'doze:bus': 3, 'doze:ruin': 2, 'doze:ruin-with-zone': 2, 'doze:crater': 2, 'doze:crater-120': 2,
  'doze:rail': 2, 'doze:tram': 2, 'doze:dock': 2, 'doze:lv475|ud475': 2, 'doze:hv471|ug471': 2, 'doze:wm472|sm472': 2, 'doze:wp': 2, 'doze:levee': 1, 'doze:flood': 1, 'doze:oneway': 1, 'doze:light': 1, 'doze:busLane': 1,
  'land-full-to-box': 100, 'rect-refused-money': 20, 'rect-armed': 30, 'rect-arm-consumed': 10, 'rect-arm-expired': 3, 'rect-arm-expired-at-3000': 1, 'rect-skip-hi': 10,
  'rect-police-multi': 2, 'line-mixed': 50, 'line-ran-out': 10, 'line-prefix-then-refused': 20, 'line-cheaper-after-short': 1, 'undo-ok': 200, 'undo-empty': 20, 'undo-refund': 100, 'undo-cap-hit': 10,
  'txn-dropped': 10, 'log:ri,5': 50, 'log:P': 200, 'money-next': 100, 'money-set': 50,
  // 同一筆交易裡整棟快照之後再拆同一格（multi 家族）：框與線、從根格起與從 ref 格起、線回到根格、拆到的層（樹、分區、水管、淹水），事後復原要回到手勢之前
  'txn-resnap-after-multi': 80, 'txn-resnap-after-multi:rect': 50, 'txn-resnap-after-multi:line': 20, 'txn-resnap-after-multi:via-root': 25, 'txn-resnap-after-multi:via-ref': 50,
  'txn-resnap-after-multi:root': 8, 'txn-resnap-after-multi:layer:tree': 15, 'txn-resnap-after-multi:layer:zone': 10, 'txn-resnap-after-multi:layer:wp': 8,
  'txn-resnap-after-multi:layer:flood': 6, 'txn-resnap-undone': 35, 'txn-resnap-undo-restores': 35,
};
// 拆除鏈相鄰兩層的先後：每一對都要有一格兩層都在、先拆上面那層（兩支對調就量得到）
for (let i = 0; i + 1 < LAYERS.length; i++) NEED[`doze-order:${LAYERS[i]}>${LAYERS[i + 1]}`] = 1;
// D016（卡面驗收 1）：每一種新工具成功 ≥ 20 次；每一種拒絕理由都出現；樹上加價、沙盒、科技與特化係數、服務預算縮放半徑；
// 新建築被拆（每一種都拆過）、被復原；線與框也蓋過；公園抽 ri(9)、其他抽 ri(5)
const NEED16 = {
  ...Object.fromEntries(CIVIC.map(t => [`build:${t}`, 60])),
  'civic-reason:只能蓋在陸地上': 100, 'civic-reason:道路上不能建造': 100, 'civic-reason:已有建築': 200, 'civic-reason:焦土需先清理': 10, 'civic-reason:隕石坑需先剷除': 10,
  'civic-refused-money': 300, 'civic-refused-money-by≤1': 20, 'civic-money-exact': 15, 'civic-tree-surcharge': 60, 'civic-sandbox-free': 60, 'civic-cost-fractional': 20,
  'civic-budget-scaled': 100, 'civic-line': 100, 'civic-rect': 100, 'rect-refused-money': 100,
  ...Object.fromEntries(Object.values(CIVIC_K).map(k => [`doze-civic:k${k}`, 5])),
  'undo-civic-build': 200, 'undo-civic-doze': 30, 'undo-ok': 300, 'log:ri,9': 60, 'log:ri,5': 300, 'pre:null': 1000,
};
// D019（卡面驗收 1）：水塔、水管各自成功夠多次；兩種的拒絕理由都出現；水管壓在建築、路、分區、樹底下；接通的水管格數因放水塔、水管、拆除而變；
// 拆水管、拆水塔、復原；線與框；水塔抽 ri(5)
const NEED19 = {
  'build:water': 60, 'build:wpipe': 300, 'civic-reason:只能蓋在陸地上': 10, 'civic-reason:道路上不能建造': 10, 'civic-reason:已有建築': 20, 'civic-reason:只能鋪在陸地上': 20, 'civic-reason:已有水管': 60,
  'civic-reason:焦土需先清理': 3, 'civic-reason:隕石坑需先剷除': 3, 'civic-refused-money': 30, 'civic-tree-surcharge': 30, 'civic-sandbox-free': 20, 'civic-line': 60, 'civic-rect': 30,
  'wpipe-under-bld': 10, 'wpipe-under-road': 10, 'wpipe-on-zone': 10, 'wpipe-keeps-tree': 10, 'water-reach:water': 20, 'water-reach:wpipe': 60, 'water-reach:doze': 10,
  'doze:wp': 20, 'doze-tower': 3, 'undo-ok': 100, 'log:ri,5': 60, 'pre:null': 300,
};
// D020（卡面驗收 1）：垃圾場蓋成夠多次、拒絕理由都出現、放下去污染場變了、拆垃圾場、復原；線與框；變體抽 ri(3)
const NEED20 = {
  'build:dump': 60, 'civic-reason:只能蓋在陸地上': 10, 'civic-reason:道路上不能建造': 10, 'civic-reason:已有建築': 20, 'civic-reason:焦土需先清理': 2, 'civic-reason:隕石坑需先剷除': 2,
  'civic-refused-money': 20, 'civic-tree-surcharge': 20, 'civic-sandbox-free': 10, 'civic-line': 30, 'civic-rect': 30, 'dump-pol': 40, 'doze-dump': 10, 'undo-ok': 100, 'log:ri,3': 60, 'pre:null': 300,
};
const need = D16 ? NEED16 : D19 ? NEED19 : D20 ? NEED20 : NEED;
const missing = Object.entries(need).filter(([k, n]) => (cov[k] || 0) < n).map(([k, n]) => `${k} ${cov[k] || 0}/${n}`);
if (missing.length || minOps < 20 || COUNT < (D16 || D19 || D20 ? 150 : 200)) throw new Error(`案例覆蓋不足：${missing.join('；')}；最少 ${minOps} 筆／張，${COUNT} 張`);
if (!D16 && !D19 && !D20 && cov['txn-resnap-other']) throw new Error(`有 ${cov['txn-resnap-other']} 次成功的 doPlace 碰到同一筆交易已存快照、卻不是多格占地迴圈存的格（標籤的前提不成立）`);
if (!D16 && !D19 && !D20 && cov['txn-resnap-undone'] !== cov['txn-resnap-undo-restores']) throw new Error(`復原整棟快照後再拆的交易 ${cov['txn-resnap-undone']} 次，回到手勢之前的只有 ${cov['txn-resnap-undo-restores']} 次`);

// ---- 實驗線自己的表（本線 build.ts 的常數逐項比這一份）----
const R = s => lab.run(s);
const tables = {
  roadCost: [...R('ROAD_COST')],
  cost: JSON.parse(JSON.stringify(R(`({zone:COST.zone,plant:COST.plant,police:COST.police,doze:COST.doze,bridge:COST.bridge${D16 ? CIVIC.map(t => `,${t}:COST.${t}`).join('') : D19 ? WATER.map(t => `,${t}:COST.${t}`).join('') : D20 ? DUMP.map(t => `,${t}:COST.${t}`).join('') : ''}})`))),
  ...(D19 ? { waterCap: [R('WATER_TOWER_CAP'), R('DESAL_CAP')] } : {}),
  ...(D16 ? { covr: JSON.parse(JSON.stringify(R('({park:COVR.park,fire:COVR.fire,police2:COVR.police2,hospital:COVR.hospital,clinic:COVR.clinic,school:COVR.school,library:COVR.library,post:COVR.post,cemetery:COVR.cemetery})'))),
    budgetCat: JSON.parse(JSON.stringify(R('SVC_BUDGET_CAT'))) } : {}),
  roadToolToRc: ['alley', 'road', 'coll', 'art', 'hwy', 'zr', 'plant', 'doze', 'rail'].map(t => [t, R('roadToolToRc')(t)]),
  renderKeys: [...RENDER_KEYS],
};

const pack = a => gzipSync(Buffer.from(JSON.stringify(a)), { level: 9, mtime: 0 }).toString('base64');
const out = {
  source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, tool: D16 ? 'tools/lab-build.mjs --set=d016' : D19 ? 'tools/lab-build.mjs --set=d019' : D20 ? 'tools/lab-build.mjs --set=d020' : 'tools/lab-build.mjs',
    how: (D16 ? 'D016 公共設施：tools/d011-cases.mjs 的 cases16（FAMILIES16，地圖與參數照底家族、操作抽公共設施九支），其餘同 D011。' : D19 ? 'D019 水塔、配水管：tools/d011-cases.mjs 的 cases19（FAMILIES19，地圖多鋪水管與水塔、操作抽 WATER）；computeWater 接實驗線舊式供水網原文，格子的 wr 一起比，其餘同 D011。' : D20 ? 'D020 垃圾場：tools/d011-cases.mjs 的 cases20（FAMILIES20，地圖多放垃圾場、操作抽 DUMP），片段與 D011 相同，其餘同 D011。' : '') + '實驗線 index.html 摘出的原始碼片段在 Node vm（strict）裡求值：tools/d011-cases.mjs 的隨機小圖，照玩家觸控路徑叫實驗線自己的函式——點＝openUndo→paintTo→closeUndo、線＝roadDraft436＋commitRoadDraft436、框＝rect＋commitRect、復原＝undo；逐筆用 runMap 記錄（施工前理由與造價、每次 doPlace 成敗、交易快照格號與花費、堆疊深度、資金、R／ri／供電重算的呼叫序列、變了的格子欄位、地價髒標記與框、拆除確認、各場雜湊），每張圖結束記全部場；每筆 canon() 成字串，gzip 壓縮後放 exact.outputs。片段原文 gzip 後放 lab.pieces（守衛核 sha256、重跑、做原碼突變）',
    casesSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'tools/d011-cases.mjs'))).digest('hex'),
    pieces: L.pieces },
  seed: D16 ? D016_SEED : D19 ? D019_SEED : D20 ? D020_SEED : D011_SEED, families: D16 ? FAMILIES16 : D19 ? FAMILIES19 : D20 ? FAMILIES20 : FAMILIES, counts: { maps: COUNT, ops: nOps, minOpsPerMap: minOps, byOp: opCounts },
  tables, coverage: cov, hashes,
  lab: { codec: 'gzip+base64+json', pieces: pack(pieces) },
  exact: { codec: 'gzip+base64+json', outputs: pack(outputs) },
};
const json = JSON.stringify(out);
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = path.join(ROOT, `src/content/samples/${SET}-build.json`);
fs.writeFileSync(file, json);
console.log(`${SET.toUpperCase()} 建造樣本：${COUNT} 張小圖、${nOps} 筆操作（每張至少 ${minOps}）；片段 ${pieces.length} 段；原始記錄 ${(bytesRaw / 1048576).toFixed(1)} MB → 樣本 ${(json.length / 1024).toFixed(0)} KB；${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('覆蓋：' + JSON.stringify(cov));
