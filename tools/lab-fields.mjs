// D010 服務覆蓋、污染、地價、教育場的黃金樣本：照 D009 的做法（tools/lab-rules.mjs），從 2D 實驗線 index.html 摘出原始碼文字，
// 在 Node vm 裡對 tools/d010-cases.mjs 的隨機小圖求值。實驗線自己的 allocGrids 配場、自己的 rebuildCov 全量重建，
// 再用實驗線自己的 stampCov／stampPolSrc／stampPolTree 跑增量操作，最後跑 tick() 地價髒重建的全圖分支＋recomputeLandDynamic。
// 片段文字一個字都不改；片段以外的東西（道路負載、噪音重建、地圖其他系統的場）換成樁。
// 用法：node tools/lab-fields.mjs --lab=<實驗線工作目錄>   → src/content/samples/d010-fields.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { labSource } from './labsrc.mjs';
import { cases, canon, D010_SEED, D010_COUNT, FAMILIES, COV_KINDS, POL_KINDS, COV_FIELDS, BUDGET_FIELDS, labPolOf, applyExtras, applyOps, snapshot, hashOf } from './d010-cases.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAB = path.resolve(arg('lab', path.join(ROOT, 'scratch/lab-src')));
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
if (commit !== PINNED) throw new Error(`D010 實驗線版本錯誤：要求 ${PINNED}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const L = labSource(html);
const t0 = Date.now();

// ---- 片段（照執行順序）----
const P = {
  clamp: L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);'),                                  // 37219
  sq: L.exact('sq', 'const sq=(id,on,off)=>spec386===id?on:off;'),                                    // 37851
  tq: L.decl('tq'),                                                                                     // 38549
  T: L.exact('T', 'const T=i=>tiles[i];'), idx: L.exact('idx', 'const idx=(x,y)=>y*N+x;'), inMap: L.decl('inMap'),   // 39730–39732
  countNear: L.fn('countNear'),                                                                         // 52934
  COVR: L.span('COVR', 'const COVR={park:4,', 'Object.assign(COVR,{medcamp:24,'),                        // 52957–52959
  COV: L.exact('COV', 'const COV={};for(const f in COVR)COV[f]=new Uint8Array(N*N);'),                 // 52960
  covFieldOfK: L.fn('covFieldOfK'),                                                                     // 52962
  svcBudget: L.decl('svcBudget'),                                                                       // 52966
  SVC_BUDGET_CAT: L.decl('SVC_BUDGET_CAT'),                                                             // 52967
  covOverride: L.span('covFieldOfK 覆寫', 'const covFieldOfKBase=covFieldOfK;', 'covFieldOfK=(k)=>({124:'),   // 52975–52976
  stampCov: L.fn('stampCov'),                                                                           // 52977
  POL: L.decl('POL'),                                                                                   // 52990
  POL_SRC: L.span('POL_SRC', 'const POL_SRC={3:{r:5,p:30}', 'Object.assign(POL_SRC,{140:'),             // 52991–52992
  POL_LV3_MAX: L.decl('POL_LV3_MAX'),                                                                   // 52993
  recomputePol: L.fn('recomputePol'),                                                                   // 52994
  stampPolSrc: L.fn('stampPolSrc'),                                                                     // 52996
  stampPolTree: L.fn('stampPolTree'),                                                                   // 53007
  LAND: L.decl('LAND'), landDirty: L.decl('landDirty'), landBox: L.decl('landBox'),                    // 53066、53067、53073
  landStaticAt: L.fn('landStaticAt'),                                                                   // 53087
  recomputeLandDynamic: L.fn('recomputeLandDynamic'),                                                   // 53098
  EDU: L.decl('EDU'), EDU_W: L.decl('EDU_W_SCHOOL'),                                                    // 53127、53128
  eduStaticAt: L.fn('eduStaticAt'),                                                                     // 53129
  rebuildCov: L.fn('rebuildCov'),                                                                       // 53135
  allocGrids: L.fn('allocGrids'),                                                                       // 56931
};
const S = {   // tick() 裡的行內片段：地價髒重建（landBox＝null 走全圖）＋每日 LAND 衍生
  tickLand: L.span('tick 地價髒重建', '  if(landDirty){ // T315：只重算受影響框', '  } // T292：地價靜態基準髒重建'),   // 54996–55001
  tickLandDyn: L.exact('tick 地價動態', '  recomputeLandDynamic(); // T130：地價動態部分——每日依最新 roadLoad 疊加壅堵扣分（靜態基準 LANDBASE 於上方髒重建後，此處疊壅堵動態扣分）'),   // 55002
};

// ---- vm 環境：樁放全域物件屬性，片段依序跑（頂層 const／let 進同一個 script scope）----
// N、tiles、pol、tech343、spec386 是實驗線的全域；allocGrids 會順手配 roadLoad（Float32Array，全 0）與 NOISE、METRO_TOD467B、ACCESS468 等。
// 道路負載全 0 → recomputeLandDynamic 走 LAND.set(LANDBASE) 快路徑，roadCap475／landCongestAt 不會被叫到（叫到就丟例外）。
// rebuildNoise：噪音沒搬，換成空函式，NOISE 維持案例給的值。
const ctx = vm.createContext({
  N: 1, tiles: [], window: {}, console, pol: null, tech343: { done: [] }, spec386: '',
  roadCap475: () => { throw new Error('道路負載應為 0，不該走到壅堵分支'); },
  rebuildNoise: () => {}, emptyTransit468: () => ({}), resetDrainage454: () => {},
});
for (const [name, src] of Object.entries(P)) vm.runInContext(src, ctx, { filename: 'lab:' + name });
const run = src => vm.runInContext(src, ctx);
const lab = {
  svcBudget0: JSON.parse(JSON.stringify(run('svcBudget'))),
  COVR: run('COVR'), SVC_BUDGET_CAT: run('SVC_BUDGET_CAT'), POL_SRC: run('POL_SRC'), POL_LV3_MAX: run('POL_LV3_MAX'), EDU_W: run('[EDU_W_SCHOOL,EDU_W_UNI,EDU_W_LIB]'),
  covFieldOfK: run('k=>covFieldOfK(k)'), allocGrids: run('allocGrids'), rebuildCov: run('rebuildCov'),
  stampCov: run('stampCov'), stampPolSrc: run('stampPolSrc'), stampPolTree: run('stampPolTree'), landStaticAt: run('landStaticAt'),
  setBudget: run('b=>{svcBudget=b;}'), budget: run('()=>svcBudget'), dirtyAll: run('()=>{landDirty=true;landBox=null;}'),
  tick: run(`(function(){\n${S.tickLand}\n${S.tickLandDyn}\n})`),
  state: run('()=>({COV,POLBASE,POLTREE,POL,LANDBASE,LAND,EDU,NOISE,METRO_TOD467B,ACCESS468,roadLoad})'),
};

// ---- 實驗線自己的表（本線 fields.ts 的常數逐項比這一份）----
const entries = o => Object.keys(o).map(k => [k, o[k]]);
const tables = {
  covr: entries(lab.COVR), svcBudgetCat: entries(lab.SVC_BUDGET_CAT), svcBudgetDefault: lab.svcBudget0,
  polSrc: entries(lab.POL_SRC).map(([k, v]) => [Number(k), v.r, v.p]), polLv3Max: lab.POL_LV3_MAX, eduW: lab.EDU_W,
  covFieldOfK: Array.from({ length: 301 }, (_, k) => lab.covFieldOfK(k)),
};
// 案例名單要蓋滿實驗線的表：抄漏一種就不產樣本
const labCovKinds = tables.covFieldOfK.flatMap((f, k) => f ? [k] : []), labPolKinds = tables.polSrc.map(r => r[0]);
const same = (a, b) => canon([...a].sort()) === canon([...b].sort());
if (!same(labCovKinds, COV_KINDS)) throw new Error(`COV_KINDS 與實驗線 covFieldOfK 不一致：實驗線 ${labCovKinds.join(',')}`);
if (!same(labPolKinds, POL_KINDS)) throw new Error(`POL_KINDS 與實驗線 POL_SRC 不一致：實驗線 ${labPolKinds.join(',')}`);
if (canon(Object.keys(lab.COVR)) !== canon(COV_FIELDS)) throw new Error('COV_FIELDS 與實驗線 COVR 的鍵（含順序）不一致');
if (!same(Object.keys(lab.SVC_BUDGET_CAT), BUDGET_FIELDS)) throw new Error('BUDGET_FIELDS 與實驗線 SVC_BUDGET_CAT 不一致');

// ---- 逐案例求值 ----
const exact = { rebuild: [], ops: [] }, hashes = { rebuild: [], ops: [] };
const seen = { rootKinds: new Set(), polRootKinds: new Set(), fieldsNonZero: new Set(), refStadium: 0, orphanRefs: 0, trees: 0, rdec: 0, bus: 0, crimeRci: 0 };
const stat = { pol255: 0, polBaseClampedLow: 0, covWrap: 0, landFrac: 0, halfRound: 0, budgetedStamps: 0, eduNonZero: 0, eduCapped: 0, opsTotal: 0, noopPol: 0 };
for (let k = 0; k < D010_COUNT; k++) {
  const c = cases(k), N = c.N;
  ctx.N = N; ctx.tiles = c.tiles; ctx.pol = labPolOf(c.edu); ctx.tech343 = { done: c.edu.tech }; ctx.spec386 = c.edu.spec ?? '';
  lab.allocGrids();
  lab.setBudget({ ...c.budget });
  applyExtras(lab.state(), c.extras);
  lab.rebuildCov();
  const st = lab.state();
  if (st.roadLoad.length !== N * N || st.roadLoad.some(v => v !== 0)) throw new Error('roadLoad 應為全 0');
  const s1 = snapshot(st);
  // st 的陣列之後會被增量操作改掉：重建後的統計現在就記
  const rebuilt255 = st.POLBASE.some(v => v === 255);
  for (const f of COV_FIELDS) if (st.COV[f].some(v => v !== 0)) seen.fieldsNonZero.add(f);
  // 覆蓋率統計（只統計，不影響輸出）
  for (let i = 0; i < N * N; i++) {
    const t = c.tiles[i], b = t.bld;
    if (b && !b.ref) { seen.rootKinds.add(b.k); if (lab.POL_SRC[b.k]) seen.polRootKinds.add(b.k); if (b.k <= 3 && b.crime) seen.crimeRci++; }
    if (b && b.ref) { if (b.k === 9) seen.refStadium++; else seen.orphanRefs++; }
    if (t.tree) seen.trees++; if (t.rdec) seen.rdec++; if (t.bus) seen.bus++;
    const ls = lab.landStaticAt(i % N, (i / N) | 0); if (ls % 1 !== 0) stat.landFrac++;
    if (st.EDU[i]) stat.eduNonZero++; if (st.EDU[i] === 255) stat.eduCapped++;
  }
  const radiusUses = [];
  for (let i = 0; i < N * N; i++) { const b = c.tiles[i].bld; if (b && !b.ref) { const f = lab.covFieldOfK(b.k); if (f) radiusUses.push([f, lab.COVR[f]]); } }
  applyOps(c.ops, {
    cov: (f, x, y, r, d) => { const rr = r === null ? lab.COVR[f] : r; radiusUses.push([f, rr]); const a = lab.state().COV[f], i = y * N + x;
      if (x >= 0 && y >= 0 && x < N && y < N && d < 0 && a[i] === 0) stat.covWrap++; lab.stampCov(f, x, y, rr, d); },
    pol: (x, y, kk, s) => { if (!lab.POL_SRC[kk]) stat.noopPol++; const pb = lab.state().POLBASE, i = y * N + x;
      if (x >= 0 && y >= 0 && x < N && y < N && s < 0 && lab.POL_SRC[kk] && pb[i] < lab.POL_SRC[kk].p) stat.polBaseClampedLow++; lab.stampPolSrc(x, y, kk, s); },
    tree: (x, y, s) => lab.stampPolTree(x, y, s),
  });
  stat.opsTotal += c.ops.length;
  for (const [f, r] of radiusUses) { const cat = lab.SVC_BUDGET_CAT[f]; if (!cat) continue; stat.budgetedStamps++; const q = r * lab.budget()[cat]; if (q - Math.floor(q) === .5) stat.halfRound++; }
  lab.dirtyAll(); lab.tick();
  const st2 = lab.state(), s2 = snapshot(st2);
  for (const f of COV_FIELDS) if (st2.COV[f].some(v => v !== 0)) seen.fieldsNonZero.add(f);
  if (rebuilt255) stat.pol255++;
  exact.rebuild.push(canon(s1)); exact.ops.push(canon(s2));
  hashes.rebuild.push(hashOf(s1)); hashes.ops.push(hashOf(s2));
}
// 覆蓋率門檻：每一種覆蓋源／污染源都當過根格；60 個場都有非零格；飽和、取模、截尾、.5 進位都真的發生過
const missKinds = COV_KINDS.filter(k => !seen.rootKinds.has(k)), missPol = POL_KINDS.filter(k => !seen.polRootKinds.has(k)), missFields = COV_FIELDS.filter(f => !seen.fieldsNonZero.has(f));
if (missKinds.length || missPol.length || missFields.length) throw new Error(`案例覆蓋不足：種類 ${missKinds.join(',')}；污染源 ${missPol.join(',')}；場 ${missFields.join(',')}`);
if (!(stat.pol255 >= 10 && stat.covWrap >= 50 && stat.landFrac >= 1000 && stat.halfRound >= 50 && seen.refStadium >= 100 && seen.crimeRci >= 100 && stat.eduNonZero >= 1000))
  throw new Error(`案例沒碰到該碰的邊界：${JSON.stringify({ ...stat, refStadium: seen.refStadium, crimeRci: seen.crimeRci })}`);
const coverage = {
  covKinds: [...seen.rootKinds].filter(k => labCovKinds.includes(k)).sort((a, b) => a - b), polKinds: [...seen.polRootKinds].sort((a, b) => a - b),
  fieldsNonZero: COV_FIELDS.filter(f => seen.fieldsNonZero.has(f)).length, refStadiumTiles: seen.refStadium, otherRefTiles: seen.orphanRefs,
  treeTiles: seen.trees, rdecTiles: seen.rdec, busTiles: seen.bus, crimeRci: seen.crimeRci, casesWithPolBase255: stat.pol255, covWrapOps: stat.covWrap,
  polClampLowOps: stat.polBaseClampedLow, landFracCells: stat.landFrac, budgetedStamps: stat.budgetedStamps, halfRoundStamps: stat.halfRound,
  eduNonZeroCells: stat.eduNonZero, eduCappedCells: stat.eduCapped, ops: stat.opsTotal, nonSourcePolOps: stat.noopPol,
};

const pack = a => gzipSync(Buffer.from(JSON.stringify(a)), { level: 9, mtime: 0 }).toString('base64');
const out = {
  source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, tool: 'tools/lab-fields.mjs',
    how: '實驗線 index.html 摘出的原始碼片段在 Node vm 裡求值：實驗線 allocGrids 依案例 N 配場、rebuildCov 全量重建，記一次全狀態；再用實驗線 stampCov／stampPolSrc／stampPolTree 跑增量操作，接 tick() 地價髒重建全圖分支（rebuildNoise 換空函式）與 recomputeLandDynamic（道路負載全 0），再記一次。案例由 tools/d010-cases.mjs（D010_SEED）產生；狀態用 snapshot()（非零格 [間隔,值]）＋canon() 存成字串，gzip 壓縮後放 exact.outputs；另存 sha256 前 16 字供定位',
    casesSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'tools/d010-cases.mjs'))).digest('hex'),
    pieces: L.pieces },
  seed: D010_SEED, families: FAMILIES, counts: { rebuild: exact.rebuild.length, ops: exact.ops.length },
  tables, coverage, hashes,
  exact: { codec: 'gzip+base64+json-canon-array', outputs: { rebuild: pack(exact.rebuild), ops: pack(exact.ops) } },
};
const json = JSON.stringify(out);
if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
const file = path.join(ROOT, 'src/content/samples/d010-fields.json');
fs.writeFileSync(file, json);
console.log(`D010 場樣本：${D010_COUNT} 張小圖 × 2 個狀態；片段 ${L.pieces.length} 段；${(json.length / 1024).toFixed(0)} KB；${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('覆蓋：' + JSON.stringify({ ...coverage, covKinds: coverage.covKinds.length, polKinds: coverage.polKinds.length }));
