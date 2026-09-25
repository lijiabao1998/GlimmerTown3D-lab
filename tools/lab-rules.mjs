// D009 生長核心公式的黃金樣本：從 2D 實驗線 index.html 摘出原始碼文字，在 Node vm 裡對 tools/d009-cases.mjs 的隨機案例求值。
// 每條公式各開一個獨立的 vm 環境，只放需要的實驗線片段；片段以外的東西（其他系統的場、畫面、音效）換成樁。
// tick() 裡的行內算式包成函式，參數名就是 tick 裡的區域變數名，片段文字一個字都不改。
// 用法：node tools/lab-rules.mjs --lab=scratch/lab-src   → src/content/samples/d009-formulas.json
// 需要先跑 node tools/lab-extract.mjs --part=d009（VRANK406 從實驗線執行期讀）。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { labSource } from './labsrc.mjs';
import { cases, canon, COUNTS, D009_SEED, hashOf, tickIndex } from './d009-cases.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const LAB = path.resolve(arg('lab', path.join(ROOT, 'scratch/lab-src')));
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
const PINNED_D009_COMMIT = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
if (commit !== PINNED_D009_COMMIT) throw new Error(`D009 實驗線版本錯誤：要求 ${PINNED_D009_COMMIT}，目前 ${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/samples/d009-live.json'), 'utf8'));
if (live.source.commit !== commit) throw new Error(`d009-live.json 抽自 ${live.source.commit.slice(0, 7)}，實驗線現在是 ${commit.slice(0, 7)}`);
const L = labSource(html);
const t0 = Date.now();

// ---- 片段 ----
const P = {
  clamp: L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);'),
  T: L.exact('T', 'const T=i=>tiles[i];'), idx: L.exact('idx', 'const idx=(x,y)=>y*N+x;'), inMap: L.decl('inMap'),
  tq: L.decl('tq'), inWinter: L.decl('inWinter'), season: L.decl('season'),
  POPS: L.decl('POPS'), JOBSC: L.decl('JOBSC'), JOBSI: L.decl('JOBSI'), DEN_POP: L.decl('DEN_POP'), TOWER_MULT: L.decl('TOWER_MULT'), TOWER_POP: L.decl('TOWER_POP'),
  MEGA_POP: L.decl('MEGA_POP'), MEGA_JOBS: L.decl('MEGA_JOBS'), TOWER_JOBS: L.decl('TOWER_JOBS'), SOCIAL_HOUSING_POP: L.decl('SOCIAL_HOUSING_POP'),
  WEALTH_PEN: L.decl('WEALTH_PEN'), POL_LV3_MAX: L.decl('POL_LV3_MAX'), URBAN406: L.decl('URBAN406'),
  POWER_SOURCE_K450: L.decl('POWER_SOURCE_K450'), POWER_STARTER_K471: L.decl('POWER_STARTER_K471'), POWER_HOPS444: L.decl('POWER_HOPS444'), POW_DIR: L.decl('POW_DIR'),
  POWER_SEASON_MULT: L.decl('POWER_SEASON_MULT'),
  powGlobals: L.exact('powGlobals', 'let powQ=null,powSeen444=null,powQueued444=null,POWER_REMAIN444=null,POWER_SRC444=null,SUB_ACTIVE444=null,SUB_UP444=null,powRoots444=null,subRoots444=null;'),
};
for (const f of ['mulberry32', 'streetHash', 'hashLocal479', 'urbanDens406', 'getMaxRoadClass', 'hasRoadNear', 'countNear', 'landStaticAt', 'judgeWealth', 'pickV406',
  'laborMarket481', 'economyDemands481', 'housingRciDemand488', 'housingDensityForSpawn488', 'housingUpgradeMul488', 'residentCapacity488', 'residentPopulation488',
  'residentEligible488', 'housingBand488', 'housingOccupancy488', 'powerCapacity450', 'isPowerSource450', 'powerFrontageRoads450', 'powerCarrier475', 'computePower',
  'ensurePower444', 'isPowerStarter444', 'hvEnergizedSubstations471']) P[f] = L.fn(f);
const labMulberry32 = vm.runInNewContext(`(${P.mulberry32})`);
const S = {   // tick() 的行內算式
  F1: L.span('F1 舊式需求', '  const workers=pop*.6;', 'const legacyI481=clamp((jobsC*.8-jobsI)/40'),
  F4: L.span('F4 移民潮與人口學係數', '  if(immWave>0){immWave--;}', 'const demoMul=clamp(1+(cityHappy-.62)*.55'),
  F5: L.spanUntil('F5 生長', '  // 生長：收集候選\n  const cands=[];', '  // 升級\n  for(const i of tickBld){'),
  F6: L.spanUntil('F6 升級', '  // 升級\n  for(const i of tickBld){', '  /* T418 交付②'),
  F7: L.span('F7 住宅幸福', '      const parks=COV.park[ci];', 'b.h=clamp(happyParts.reduce((s,p)=>s+p.val,0),.05,1);'),
  F8a: L.span('F8 商工職位', '      if(b.k===2)jobsC+=JOBSC[b.lv]*(t.office?1.5:1);else jobsI+=JOBSI[b.lv];', 'else jobsI+=JOBSI[b.lv];'),
  F8b: L.span('F8 名目就業', '  pop=popN+towerPop488+megaPop488;jobs=jobsC+jobsI+schools*8', '  jobs+=transitDepotJobs501();'),
  F10: L.span('F10 天氣', '  if(--wxT<=0){\n    if(weather===0){if(R()<.12)', 'if(weather===2&&!inWinter()&&R()<.25){flashT=.4;sThunder();}'),
  F11a: L.span('F11 當日容量', '  const powerNom450=computePower(),powerMul450=POWER_SEASON_MULT[sea],cap=Math.floor(powerNom450*powerMul450);', 'cap=Math.floor(powerNom450*powerMul450);'),
  F11b: L.span('F11 通電', '    const near=hasRoadNear(x,y,2,true);', '    if(b.pw)powered++;'),
};

// ---- vm 環境：先放樁（全域物件屬性），再依序跑片段（頂層 const／let 進同一個 script scope）----
function env(pieces, stubs = {}) {
  const ctx = vm.createContext({ window: {}, console, ...stubs });
  for (const p of pieces) vm.runInContext(P[p] ?? p, ctx, { filename: 'lab:' + p });
  return ctx;
}
const fn = (ctx, params, body, ret) => vm.runInContext(`(function(${params}){${body}\n;return ${ret};})`, ctx);
// 實驗線的 R／ri 換成記錄呼叫順序的版本（ri 不透過 R 記錄，免得一次 ri 記兩筆；抽到的值同實驗線 ri=n=>Math.floor(R()*n)）
function rngStub(seed) { const g = labMulberry32(seed), log = []; return { log, R: () => { log.push(['R']); return g(); }, ri: n => { log.push(['ri', n]); return Math.floor(g() * n); } }; }
const worldGlobals = (ctx, w) => { ctx.N = w.N; ctx.tiles = w.tiles; Object.assign(ctx, w.fields); };
const out = {}, exactOutputs = {};
const run = (name, f) => {
  const hs = [], exact = [];
  for (let k = 0; k < COUNTS[name]; k++) {
    const value = f(cases[name](k), k);
    hs.push(hashOf(value));
    exact.push(canon(value));
  }
  out[name] = hs;
  exactOutputs[name] = gzipSync(Buffer.from(JSON.stringify(exact)), { level: 9, mtime: 0 }).toString('base64');
};

// F1 舊式需求
{ const ctx = env(['clamp', 'tq'], { tech343: { done: [] } });
  const f = fn(ctx, 'pop,jobs,cityHappy,tickCzoneN,jobsC,jobsI,pol', S.F1, '[workers,jobSurplus,happyAdj,legacyR481,czone,legacyC481,legacyI481]');
  run('F1', c => { ctx.tech343 = { done: c.tech }; return f(c.pop, c.jobs, c.cityHappy, c.czone, c.jobsC, c.jobsI, c.indSubsidy ? { indSubsidy: true } : null); }); }
// F2 勞動市場
{ const ctx = env(['clamp', 'laborMarket481']);
  run('F2', c => { if (c.ent) ctx.enterprise489 = c.ent; else delete ctx.enterprise489; ctx.day = c.day; return ctx.laborMarket481(c.p, c.j); }); }
// F3 經濟需求組合
{ const ctx = env(['clamp', 'economyDemands481']);
  run('F3', c => { ctx.economy481 = c.econ || { ready: false }; const r = ctx.economyDemands481(c.lr, c.lc, c.li, c.labor); return [r.r, r.c, r.i]; }); }
// F4 住房組合、移民潮、人口學係數
{ const ctx = env(['clamp', 'streetHash', 'housingRciDemand488'], { toast: () => {} });
  const f = fn(ctx, 'immWave,pop,day,cityHappy,dem', S.F4, '[immWave,demoMul]');
  run('F4', c => { ctx.housing488 = c.housing || { ready: false };
    if (c.mob !== null) ctx.mobilityGrowthModifier509 = () => c.mob; else delete ctx.mobilityGrowthModifier509;
    return [ctx.housingRciDemand488(c.legacy), ...f(c.immWave, c.pop, c.day, c.cityHappy, { 1: c.demR })]; }); }
// F5 生長（住房市場沒就緒；judgeWealth 的住房項＝0）
const gridPieces = ['clamp', 'T', 'idx', 'inMap', 'streetHash', 'hashLocal479', 'URBAN406', 'urbanDens406', 'countNear', 'getMaxRoadClass', 'hasRoadNear', 'judgeWealth', 'pickV406', 'landStaticAt'];
{ const ctx = env([...gridPieces, 'housingDensityForSpawn488'], { VRANK406: live.vrank, housing488: { ready: false }, sPop: () => {}, stampPolSrc: () => {} });
  const f = fn(ctx, 'tickZone,tickBld,dem,cityHappy,demoMul', S.F5, '[cands,spawns]');
  run('F5', c => { worldGlobals(ctx, c.w); const { tickBld, tickZone } = tickIndex(c.w), r = rngStub(c.seed); ctx.R = r.R; ctx.ri = r.ri;
    const [cands] = f(tickZone, tickBld, c.dem, c.cityHappy, c.demoMul);
    return { cands, tickBld, blds: c.w.tiles.map(t => t.bld ? [t.bld.k, t.bld.lv, t.bld.v, t.bld.age, t.bld.pw, t.bld.h, t.bld.den, t.bld.we] : null), log: r.log }; }); }
// F6 升級（住房係數＝1）
{ const ctx = env([...gridPieces, 'tq', 'POL_LV3_MAX', 'housingUpgradeMul488'], { VRANK406: live.vrank, housing488: { ready: false }, tech343: { done: [] } });
  const f = fn(ctx, 'tickBld,dem,sewNeed442,SEW_OK442', S.F6, '0');
  run('F6', c => { worldGlobals(ctx, c.w); ctx.tech343 = { done: c.tech }; const { tickBld } = tickIndex(c.w), r = rngStub(c.seed); ctx.R = r.R; ctx.ri = r.ri;
    f(tickBld, c.dem, c.sewNeed, c.sewOk);
    return { blds: c.w.tiles.map(t => t.bld ? [t.bld.k, t.bld.lv, t.bld.v, t.bld.age, t.bld.den, t.bld.we] : null), log: r.log }; }); }
// F7 住宅幸福：這一格量好的值用樁餵（countNear r=3 回工業數、r=4 回犯罪數）
{ const ctx = env(['clamp', 'tq', 'WEALTH_PEN', 'idx', 'inWinter', 'season'], { tech343: { done: [] }, EDU: [0], eduSumT342: 0, eduCntT342: 0, mortPop346: 0 });
  const f = fn(ctx, 'x,y,ci,b', S.F7, '[b.h,happyParts.map(p=>p.val)]');
  run('F7', c => {
    const COV = {}; for (const [k, v] of Object.entries(c.c)) if (v !== undefined) COV[k] = [v];
    Object.assign(ctx, { N: 1, COV, POL: [c.POL], NOISE: c.NOISE === undefined ? [] : [c.NOISE], commutePenalty: c.commutePenalty === undefined ? [] : [c.commutePenalty],
      countNear: (x, y, r) => r === 3 ? c.ind : c.crime, getMaxRoadClass: () => c.rc, congestNear: () => c.jam, drainagePenalty454At: () => c.drainPen,
      waterLegacy449: () => c.waterLegacy, waterHappinessPenalty472: () => c.waterPen, housingHappinessPenalty488: () => c.housingPen,
      deathPenalty: [c.deathPenalty ? 1 : 0], sewNeed442: c.sewNeed, SEW_OK442: [c.sewOk ? 1 : 0], weather: c.weather, day: c.day, nightCity487: c.nightCity,
      cityEvent: c.eventHappy === null ? null : { i: 0 }, CITY_EVENTS: [{ happy: c.eventHappy }], cookedReady: c.cookedReady, pol: c.pol, rankIdx: c.rankIdx, tvSignal: c.tvSignal,
      tech343: { done: c.tech } });
    const b = { k: c.k, lv: c.lv, pw: c.pw, sick: c.sick, death: c.death }; if (c.we !== undefined) b.we = c.we;
    return f(0, 0, 0, b); }); }
// F8 人口與就業
{ const ctx = env(['clamp', 'POPS', 'JOBSC', 'JOBSI', 'DEN_POP', 'TOWER_MULT', 'TOWER_POP', 'MEGA_POP', 'MEGA_JOBS', 'TOWER_JOBS', 'SOCIAL_HOUSING_POP',
  'housingBand488', 'residentCapacity488', 'residentEligible488', 'housingOccupancy488', 'residentPopulation488']);
  const jobsLine = fn(ctx, 'b,t', 'let jobsC=0,jobsI=0;\n' + S.F8a, '[jobsC,jobsI]');
  const total = vm.runInContext(`(function(c){let pop,jobs;with(c){${S.F8b}\n}return jobs;})`, ctx);
  run('F8', c => { ctx.housing488 = c.occ ? { occ: c.occ } : null;
    const cc = { ...c.counts, popN: 0, towerPop488: 0, megaPop488: 0, powerJobs471: () => c.counts.powerJobs471, waterJobs472: () => c.counts.waterJobs472,
      infraJobs475: () => c.counts.infraJobs475, transitDepotJobs501: () => c.counts.transitDepotJobs501 };
    return [ctx.residentCapacity488(c.b), ctx.residentPopulation488(0, c.b), c.b && c.b.lv ? jobsLine(c.b, { office: c.office }) : null, total(cc)]; }); }
// F9 格子函式：每一格都算
{ const ctx = env(gridPieces, { VRANK406: live.vrank, housing488: { ready: false } });
  run('F9', c => { worldGlobals(ctx, c.w); const N = c.w.N, o = [];
    for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0, [pk, plv, pfb] = c.picks[i % c.picks.length];
      o.push([ctx.landStaticAt(x, y), ctx.judgeWealth(x, y), ctx.getMaxRoadClass(x, y), ctx.getMaxRoadClass(x, y, 3),
        ctx.hasRoadNear(x, y, 2), ctx.hasRoadNear(x, y, 2, true), ctx.hasRoadNear(x, y, 2, true, true), ctx.hasRoadNear(x, y, 2, false, true),
        ctx.urbanDens406(x, y), ctx.pickV406(pk, plv, x, y, pfb), ctx.countNear(x, y, 4, tt => tt.bld && tt.bld.k <= 3 && tt.bld.crime)]); }
    return o; }); }
// F10 天氣：每個案例連跑 400 天
{ const ctx = env(['inWinter', 'season'], { sThunder: () => {} });
  const f = fn(ctx, '', S.F10, '0'), sea = vm.runInContext('()=>[season(),inWinter()]', ctx);   // 頂層 const 不在全域物件上，要在環境裡包一層
  run('F10', c => { const r = rngStub(c.seed); ctx.R = r.R; ctx.ri = r.ri; ctx.weather = c.weather; ctx.wxT = c.wxT; const o = [];
    for (let d = 0; d < c.days; d++) { ctx.day = c.day0 + d; ctx.rainbowT = 0; ctx.flashT = 0; f(); o.push([ctx.weather, ctx.wxT, ctx.rainbowT === 9, ctx.flashT === .4, ...sea()]); }
    return { o, log: r.log }; }); }
// F11 舊版供電：computePower 快路徑＋當日容量＋逐棟通電
{ const ctx = env(['clamp', 'T', 'idx', 'inMap', 'countNear', 'hasRoadNear', 'POWER_SOURCE_K450', 'POWER_STARTER_K471', 'POWER_HOPS444', 'POW_DIR', 'POWER_SEASON_MULT', 'powGlobals',
  'ensurePower444', 'isPowerSource450', 'isPowerStarter444', 'powerCapacity450', 'powerCarrier475', 'powerFrontageRoads450', 'hvEnergizedSubstations471', 'computePower'],
  { assetAvailability493: () => 1, powerLegacy450: () => true });
  const capF = fn(ctx, 'sea', S.F11a, '[powerNom450,cap]');
  const pwF = vm.runInContext(`(function(order,cap){let powered=0;for(const i88 of order){const x=i88%N,y=(i88/N)|0;const t=tiles[i88];const b=t.bld;if(!b||b.ref)continue;if(!b||(b.k>3&&b.k!==127))continue;const si442=idx(x,y);\n${S.F11b}\n}return powered;})`, ctx);
  run('F11', c => { worldGlobals(ctx, c.w); ctx.pol = c.ecoReg ? { ecoReg: true } : null; ctx.window = c.legacySubstation ? { __legacySubstation444: true } : {};
    const [nom, cap] = capF(c.season), { tickBld } = tickIndex(c.w), powered = pwF(tickBld, cap);
    return { nom, cap, rp: c.w.tiles.flatMap((t, i) => t.rp ? [i] : []), pw: tickBld.map(i => c.w.tiles[i].bld.pw), powered }; }); }
// 亂數產生器：實驗線 mulberry32 前 10,000 個值
const rngSeeds = [1, 516, 2026, 0xdeadbeef];
const mulOutputs = rngSeeds.map(s => { const g = labMulberry32(s); return Array.from({ length: 10000 }, () => g()); });
const mulHash = hashOf(mulOutputs);

const sample = Object.fromEntries(Object.keys(COUNTS).map(n => [n, out[n].length]));
fs.writeFileSync(path.join(ROOT, 'src/content/samples/d009-formulas.json'), JSON.stringify({
  source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, tool: 'tools/lab-rules.mjs',
    how: '實驗線 index.html 摘出的原始碼片段在 Node vm 裡求值；案例由 tools/d009-cases.mjs（D009_SEED）產生；每個案例的輸出用 canon() 保留數值的 Object.is 語義，gzip 壓縮後存 exact.outputs；另存 sha256 前 16 字供定位',
    casesSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'tools/d009-cases.mjs'))).digest('hex'),
    pieces: L.pieces },
  seed: D009_SEED, counts: sample, mulberry32: mulHash, hashes: out,
  exact: { codec: 'gzip+base64+json-canon-array', outputs: exactOutputs,
    mulberry32: { seeds: rngSeeds, countPerSeed: 10000,
      values: gzipSync(Buffer.from(JSON.stringify(mulOutputs.map(row => row.map(canon)))), { level: 9, mtime: 0 }).toString('base64') } } }, null, 0));
console.log(`D009 公式樣本：${Object.entries(sample).map(([k, v]) => `${k} ${v}`).join('、')}；片段 ${L.pieces.length} 段；${((Date.now() - t0) / 1000).toFixed(1)}s`);
