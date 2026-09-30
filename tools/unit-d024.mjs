// D024 Node 守衛：主計數迴圈補齊（驗收 1、2、3、5，及接線）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d024-count.json（tools/lab-count.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；
//   2. 計數、就業、維護費逐項＝實驗線：實驗線原文（55039–55048 計數宣告與 55050–55149 主計數迴圈，D022 的樣本；55246–55250 就業加總、55969–55977 與 55990 維護費加總；
//      物流「運作中」判斷、升級加成表、地標表、電力／水務／基建／車庫的掃圖函式，加上它們讀的常數）在 vm 裡跑，跟本線 src/sim/rules/count.ts（tallyBuildings、jobCountsOf）、
//      jobs.ts、money.ts（upkeepIn、dailyUpkeep）吃同一批隨機小圖：全部 186 種建築、多格建築的根格與 ref 格、有電沒電、等級 1–10、路、鐵路、水格、四種格子旗標、
//      物流設施貼路與不貼路、鐵路與水格夠不夠；每個計數（實驗線宣告的每一個）、電力／水務／基建／車庫的就業與維護費、名目就業、維護費總額逐位相等；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（每一種計數的條件與係數、升級表、地標表、運作中的每一個判斷、四個掃圖函式的表與旗標係數、就業與維護費的加總、接線）；
//   4. 接線：day.ts 的計數、就業、維護費各接一次，順序照實驗線；simFromSave 讀進辦公區、鐵路格與 T475 的四個格子旗標；
//   5. 實驗線頁面實跑（src/content/samples/d024-lab.json，tools/d024-lab.mjs 錄）：見檔案後半（讀檔後推進一天的 jobs、jobsC、jobsI、upkeep），一座城的碼在 Node 產生。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as CNT from '../src/sim/rules/count.ts';
import * as JOBS from '../src/sim/rules/jobs.ts';
import * as MONEY from '../src/sim/rules/money.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { fnv1a } from '../src/sim/rng.ts';
import * as realDay from '../src/sim/day.ts';
import { dayVariant } from './unit-d021.mjs';
import { d024Codes } from './d024-lab.mjs';
import { saveCode } from '../src/io/save.ts';
import { commitOp, previewOp } from '../src/sim/edit.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['POPS', 'JOBSC', 'TOWER_MULT', 'MEGA_JOBS', 'TOWER_JOBS', 'ROAD_UPKEEP', 'DIRV', 'UP_MAX', 'UP_JOB', 'LOGISTICS_META485', 'TRANSIT_DEPOT_META501', 'TRANSIT_DEPOT_BY_K501',
  'sanRoadSeeds445', 'countNear', 'assetAvailability493', 'logisticsOperational485', 'powerJobs471', 'powerUpkeep471', 'waterJobs472', 'waterUpkeep472', 'infraJobs475', 'infraUpkeep475',
  'transitDepotPools501', 'transitDepotJobs501', 'transitDepotUpkeep501', 'tick 就業加總', 'tick 維護費加總', 'tick 服務預算維護費'];
const KEY = { 'tick 就業加總': 'jobs', 'tick 維護費加總': 'upkeep', 'tick 服務預算維護費': 'upkeepBudget' };   // 樣本 pieces 的名字 → text 的鍵
const TOP = ['clamp', 'spec386', 'sq', 'LMCFG309', 'POPS', 'JOBSC', 'TOWER_MULT', 'MEGA_JOBS', 'TOWER_JOBS', 'ROAD_UPKEEP', 'DIRV', 'UP_MAX', 'UP_JOB', 'LOGISTICS_META485', 'TRANSIT_DEPOT_META501',
  'TRANSIT_DEPOT_BY_K501', 'sanRoadSeeds445', 'countNear', 'assetAvailability493', 'logisticsOperational485', 'powerJobs471', 'powerUpkeep471', 'waterJobs472', 'waterUpkeep472', 'infraJobs475',
  'infraUpkeep475', 'transitDepotPools501', 'transitDepotJobs501', 'transitDepotUpkeep501'];
const LOGI = [165, 166, 167, 168, 169, 170, 171, 172, 173, 174];
const LOGI_NAMES = { 165: ['cl485', 'clOp485'], 166: ['im485', 'imOp485'], 167: ['dc485', 'dcOp485'], 168: ['cold485', 'coldOp485'], 169: ['silo485', 'siloOp485'], 170: ['fuelDep485', 'fuelDepOp485'],
  171: ['gasDep485', 'gasDepOp485'], 172: ['steelY485', 'steelYOp485'], 173: ['bulk485', 'bulkOp485'], 174: ['cport485', 'cportOp485'] };

export async function d024Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D024 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 本線原碼（或改壞的一份）在 vm 裡另載：只換 src/sim/rules 底下的檔；import 的東西用真模組（over 可以換掉其中幾個，例如把改壞的 jobs.ts 接到 count.ts 上）
export async function loadMod(rel, edits = [], over = {}) {
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, 'utf8');
  for (const [a, b] of edits) { if (src.split(a).length !== 2) throw new Error(`錨點要剛好一處：${a.slice(0, 60)}（${src.split(a).length - 1} 處）`); src = src.replace(a, b); }
  const js0 = stripTypeScriptTypes(src), ctx = {};
  for (const [, names, from] of js0.matchAll(/^import \{([^}]*)\} from '([^']+)';$/gm)) {
    const ns = over[from] ?? await import(new URL(from, pathToFileURL(file)).href);
    for (const k of names.split(',').map(q => q.trim()).filter(Boolean)) { if (!(k in ns)) throw new Error(`${from} 沒有匯出 ${k}`); ctx[k] = ns[k]; }
  }
  const exported = [...js0.matchAll(/^export (?:const|function) ([A-Za-z0-9_]+)/gm)].map(m => m[1]);
  const js = js0.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  vm.runInContext(`${js}\n;globalThis.__m = {${exported.join(',')}};`, vm.createContext(ctx), { filename: `variant:${rel}` });
  return ctx.__m;
}
// 一組本線模組：可以改壞其中一個檔（jobs.ts 改壞時，count.ts 與 money.ts 要接到改壞的那份）
async function mods(target, edits) {
  if (!target) return { count: CNT, jobs: JOBS, money: MONEY };
  if (target === 'count') return { count: await loadMod('src/sim/rules/count.ts', edits), jobs: JOBS, money: MONEY };
  if (target === 'money') return { count: CNT, jobs: JOBS, money: await loadMod('src/sim/rules/money.ts', edits) };
  const jobs = await loadMod('src/sim/rules/jobs.ts', edits);
  return { count: await loadMod('src/sim/rules/count.ts', [], { './jobs.ts': jobs }), jobs, money: await loadMod('src/sim/rules/money.ts', [], { './jobs.ts': jobs }) };
}

// 實驗線那一邊：原文在 vm 裡（strict）。樁：事故 T493 關（可用度恆 1）、企業沒就緒、政策沒有、電力舊版（power471.operatingCost 0）、沒有公車線／輕軌／鐵路／地鐵線、車庫「運作中」不看（只影響 on）、
// 沒有化肥、沒有資源（RESOURCE 空：開採量 0）、住宅塔與巨廈的居民不看（residentPopulation488 給 0）。計數宣告、主計數迴圈、就業加總、維護費依序包進同一個函式（共用 tick() 的區域變數）
function makeLab(t, names) {
  const ctx = vm.createContext({});
  const top = TOP.map(n => t[n]).join('\n');
  vm.runInContext(`'use strict';let N=1,tiles=[],tickBld=[],tickRoad=[],day=1,pop=0,jobs=0,upkeep=0,money=0,popN0=0,jobsC0=0,jobsI0=0;
let parks=0,plants=0,fireStations=0,policeStations=0,policeBoxes=0,hospitals=0,svcBudget={police:1,fire:1,health:1,edu:1};
let shipCount=0,fuelMade=0,steelMade=0,steelUsed=0,fuelTaxMul=1,freightTaxMul=1,steelTaxMul=1,shipTradeTaxMul=1,shipPortGold=0,shipDailyGold418=0,fuelUse418=0,fuelExport418=0,constrSteelUse418=0,steelDisc418=false;
const window={__noIncident493:true},incidents493=[],incidentByRoot493=new Map(),incidentResolveRoot493=i=>i,pol=null,tq=(id,a,b)=>b,policyDailyCost504=()=>0,
  power471={operatingCost:0},busRoutes=[],busOpsCfg468=[],tramLines463=[],railLines463=[],metroLines=[],transitDepotOperational501=()=>false,
  fertReady=false,COV={},RESOURCE=[],RDEP=[],RESOURCE_STOCK=240,OIL_RATE=3,ORE_RATE=2,
  T=i=>tiles[i],idx=(x,y)=>y*N+x,inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N,residentPopulation488=()=>0;
${top}
function __tick(){
${t.lets}
${t.count}
}
jobsC=jobsC0;jobsI=jobsI0;popN=popN0;
${t.jobs}
${t.upkeep}
${t.upkeepBudget}
return {${names.join(',')},jobs,upkeep,pj:powerJobs471(),wj:waterJobs472(),ij:infraJobs475(),dj:transitDepotJobs501(),pu:powerUpkeep471(),wu:waterUpkeep472(),iu:infraUpkeep475(),du:transitDepotUpkeep501()};
}
globalThis.__api={
  set:(n,ts,pn,jc,ji,tax,sb)=>{N=n;tiles=ts;popN0=pn;jobsC0=jc;jobsI0=ji;({parks,plants,fireStations,policeStations,policeBoxes,hospitals}=tax);svcBudget={...sb};tickBld=[];tickRoad=[];for(let i=0;i<n*n;i++){if(ts[i].bld)tickBld.push(i);if(ts[i].road)tickRoad.push(i);}},
  tick:()=>__tick(),
};`, ctx, { filename: 'lab:count' });
  return ctx.__api;
}
// 本線那一邊（count.ts、jobs.ts、money.ts；突變時傳改壞的那一份）
const makeMine = (m) => {
  let w = null, order = [], pn = 0, jc = 0, ji = 0, tax = null, sb = null;
  return {
    set: (n, ts, p, a, b, x, y) => { w = { N: n, tiles: ts }; pn = p; jc = a; ji = b; tax = x; sb = y; order = []; for (let i = 0; i < n * n; i++) if (ts[i].bld) order.push(i); },
    tick: () => {
      const tally = m.count.tallyBuildings(w, order), jcs = m.count.jobCountsOf(tally, w, order, jc, ji);
      const jobs = m.jobs.nominalJobs(jcs);
      const inp = m.money.upkeepIn(w, order, tally.cnt, { ...tax, nI: 0, fs2n409: 0 }, { pop: pn, svcBudget: sb, tech: [], spec: null });
      return { ...tally.cnt, jobs, upkeep: m.money.dailyUpkeep(inp), pj: m.jobs.powerJobs471(w), wj: m.jobs.waterJobs472(w), ij: m.jobs.infraJobs475(w), dj: m.jobs.transitDepotTotals501(w, order).jobs,
        pu: m.money.powerUpkeep471(w), wu: m.money.waterUpkeep472(w), iu: m.money.infraUpkeep475(w), du: m.jobs.transitDepotTotals501(w, order).upkeep };
    },
  };
};

// 隨機小圖。家族：small（小圖少量建築）、all（什麼都有）、logi（物流設施，貼路與不貼路、鐵路與水格夠與不夠）、infra（電力、水務、基建、車庫與格子旗標）、upg（升級過的服務）、rci（住商工與塔）、empty
const FAMS = ['small', 'all', 'logi', 'infra', 'upg', 'rci', 'empty', 'all', 'logi'];
const UP_KINDS = Object.keys(CNT.UP_MAX).map(Number);
const SB = [.5, .6, .7, .8, .9, 1, 1.1, 1.25, 1.4, 1.5];
function cases(KT, count = 1400) {
  const out = [], R = mulberry32(20261201), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  const ALL = KT.data.kinds.map(r => r.k), BIG = ALL.filter(k => KT.size(k) >= 3);
  for (let m = 0; m < count; m++) {
    const fam = FAMS[m % FAMS.length], N = fam === 'small' ? int(5, 10) : fam === 'empty' ? int(4, 8) : int(14, 30);
    const tiles = Array.from({ length: N * N }, () => ({ t: 2, bld: null }));
    const at = (x, y) => tiles[y * N + x], inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
    // 水：幾塊池塘（t＝0）；路：直線路段，等級 1–5；鐵路格
    for (let p = ch(.55) ? int(1, 3) : 0; p > 0; p--) { const w0 = int(2, 7), h0 = int(2, 7), x0 = int(0, N - 1), y0 = int(0, N - 1); for (let dy = 0; dy < h0; dy++) for (let dx = 0; dx < w0; dx++) if (inb(x0 + dx, y0 + dy)) at(x0 + dx, y0 + dy).t = 0; }
    const roadTarget = fam === 'empty' ? int(0, 4) : int(0, Math.floor(N * N / 4));
    let roads = 0;
    for (let g = 0; g < 800 && roads < roadTarget; g++) {
      const hz = ch(.5), a = int(0, N - 1), b0 = int(0, N - 1), len = int(2, N), rc = int(1, 5);
      for (let q = 0; q < len && roads < roadTarget; q++) { const x = hz ? Math.min(N - 1, b0 + q) : a, y = hz ? a : Math.min(N - 1, b0 + q); const t = at(x, y); if (!t.road && t.t !== 0) { t.road = 1; t.rc = rc; roads++; } }
    }
    if (ch(.4)) for (let q = int(2, N * 2); q > 0; q--) { const t = at(int(0, N - 1), int(0, N - 1)); if (t.t !== 0 && !t.road) t.rail = 1; }
    const flagP = fam === 'infra' ? .18 : fam === 'all' ? .04 : 0;
    if (flagP) for (const t of tiles) { if (ch(flagP)) t.lv475 = 1; if (ch(flagP)) t.ud475 = 1; if (ch(flagP)) t.fly475 = 1; if (ch(flagP)) t.ix475 = int(1, 3); }
    const put = (k, lvOverride, extra = {}) => {
      const sz = k === 9 ? Math.max(2, KT.size(9)) : KT.size(k);
      for (let a = 0; a < 30; a++) {
        const x = int(0, N - 1), y = int(0, N - 1); let free = x + sz <= N && y + sz <= N;
        for (let dy = 0; dy < sz && free; dy++) for (let dx = 0; dx < sz; dx++) { const q = at(x + dx, y + dy); if (q.road || q.bld || q.t === 0) { free = false; break; } }
        if (!free) continue;
        const lvr = R(), lv = lvOverride ?? (lvr < .05 ? 0 : lvr < .1 ? undefined : lvr < .8 ? int(1, 3) : int(1, 10));
        at(x, y).bld = { k, lv, v: 0, age: 0, pw: ch(.7), h: 1, ...(sz > 1 ? { sz } : {}), ...extra };
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) at(x + dx, y + dy).bld = { k, ref: [x, y] };
        return { x, y, sz };
      }
      return null;
    };
    if (fam === 'all' && N >= 20) for (const k of BIG) if (ch(.22)) put(k);   // 3×3 以上的大建築塞不進小圖：大圖再特別各擺一次（機率 .22）
    const many = fam === 'empty' ? int(0, 2) : fam === 'small' ? int(0, 8) : int(6, Math.min(70, Math.floor(N * N / 5)));
    for (let q = 0; q < many; q++) {
      if (fam === 'logi') {
        const k = pick(LOGI), pos = put(k, ch(.3) ? int(1, 3) : undefined);
        if (!pos) continue;
        const { x, y, sz } = pos;
        if (ch(.65)) { const cells = []; for (let i = 0; i < sz; i++) cells.push([x + i, y - 1], [x + i, y + sz], [x - 1, y + i], [x + sz, y + i]); const c = pick(cells.filter(([a, b]) => inb(a, b) && !at(a, b).bld && at(a, b).t !== 0)); if (c) { const t = at(c[0], c[1]); t.road = 1; t.rc = int(1, 5); } }
        if (k === 166 && ch(.55)) for (let j = int(1, 4); j > 0; j--) { const a = x + int(-6, 6), b = y + int(-6, 6); if (inb(a, b) && !at(a, b).bld && at(a, b).t !== 0) at(a, b).rail = 1; }
        if ((k === 173 || k === 174) && ch(.55)) for (let j = int(2, 8); j > 0; j--) { const a = x + int(-6, 6), b = y + int(-6, 6); if (inb(a, b) && !at(a, b).bld) at(a, b).t = 0; }
        continue;
      }
      const r = R();
      const pool = fam === 'infra' ? (r < .55 ? [140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164] : r < .8 ? [175, 176, 177, 178] : ALL)
        : fam === 'upg' ? UP_KINDS : fam === 'rci' ? [1, 1, 1, 2, 2, 3, 3, 33, 34, 105, 106, 65, 127, 4, 5, 6, 7, 11, 12, 13] : ALL;
      const k = pick(pool);
      put(k, fam === 'upg' ? int(2, 10) : undefined);
    }
    const tax = { parks: int(0, 25), plants: int(0, 6), fireStations: int(0, 8), policeStations: int(0, 8), policeBoxes: int(0, 8), hospitals: int(0, 6) };
    const sb = { police: pick(SB), fire: pick(SB), health: pick(SB), edu: pick(SB) };
    out.push({ fam, N, tiles, roads, popN: fam === 'empty' ? 0 : int(0, 4000), jobsC: int(0, 1600) / 2, jobsI: int(0, 1600) / 2, tax, sb });
  }
  return out;
}
// 兩邊各一份格子（深拷貝，undefined 也照樣留著）
const clone = tiles => tiles.map(t => ({ ...t, bld: t.bld ? { ...t.bld, ...(t.bld.ref ? { ref: [...t.bld.ref] } : {}) } : null }));

async function guards(log) {
  const S22 = JSON.parse(read('src/content/samples/d022-food.json')), S24 = JSON.parse(read('src/content/samples/d024-count.json'));
  const T = { ...S22.text, ...S24.text };
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));

  // ---- 1. 出處 ----
  {
    const bad = [], names = (S24.pieces ?? []).map(p => p.name);
    if (S24.source?.commit !== PINNED) bad.push(`commit ${S24.source?.commit}`);
    if (J(names) !== J(PIECES)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S24.pieces ?? []) {
      const txt = S24.text[KEY[p.name] ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    // 常數：升級表、地標的就業與維護、車庫表（實驗線原文取出來跟本線比）；掃圖函式裡的表由第 2 項的隨機圖逐種比
    const lab = vm.runInNewContext(`${T.UP_MAX}\n${T.UP_JOB}\n${T.LMCFG309}\n${T.TRANSIT_DEPOT_META501}\n({m:UP_MAX,j:UP_JOB,l:LMCFG309,d:TRANSIT_DEPOT_META501})`);
    const lmJ = Object.fromEntries(Object.entries(lab.l).filter(([k]) => +k >= 69 && +k <= 80).map(([k, v]) => [k, v.j])), lmU = Object.fromEntries(Object.entries(lab.l).filter(([k]) => +k >= 69 && +k <= 80).map(([k, v]) => [k, v.u]));
    const dep = Object.fromEntries(Object.values(lab.d).map(q => [q.k, { jobs: q.jobs, upkeep: q.upkeep }]));
    if (J(lab.m) !== J(CNT.UP_MAX) || J(lab.j) !== J(CNT.UP_JOB) || J(lmJ) !== J(CNT.LANDMARK_JOBS309) || J(lmU) !== J(CNT.LANDMARK_UPKEEP309) || J(dep) !== J(JOBS.DEPOT501)) bad.push('常數表跟實驗線不同');
    const logiKeys = Object.keys(vm.runInNewContext(`${T.LOGISTICS_META485}\nLOGISTICS_META485`)).map(Number);
    if (J(logiKeys) !== J(LOGI)) bad.push(`物流設施種類 ${logiKeys.join(',')}`);
    log(!bad.length, `D024 計數原文：實驗線 ${PINNED.slice(0, 7)} 的 ${PIECES.length} 段（常數 37409–37429、升級表 63008–63009、物流表 37295、運作中判斷 51246、電力／水務／基建掃圖函式 52828–52913、車庫 67111–67163、就業加總 55246–55250、維護費加總 55969–55977 與 55990）逐段 sha256＝錨點記錄；升級表、地標表、車庫表、物流種類跟本線相同`,
      bad.join('；') || `升級表 ${Object.keys(CNT.UP_MAX).length} 種、地標 ${Object.keys(CNT.LANDMARK_JOBS309).length} 座、車庫 ${Object.keys(JOBS.DEPOT501).length} 種、物流 ${LOGI.length} 種`);
  }

  // ---- 2. 計數、就業、維護費逐項＝實驗線 ----
  const C = cases(KT);
  // 實驗線計數宣告裡每一個「迴圈本體有 ++ 或 += 的」變數；本線的 cnt 要全部涵蓋（住宅塔與巨廈的居民 towerPop488、megaPop488 在 day.ts，不在這裡比）
  const declared = new Set([...T.lets.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)=0\b/g)].map(m => m[1]));
  const bumped = [...new Set([...T.count.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*(?:\+\+|\+=)/g)].map(m => m[1]))].filter(n => declared.has(n) && !['towerPop488', 'megaPop488'].includes(n));
  const emptyKeys = Object.keys(CNT.tallyBuildings({ N: 1, tiles: [{ t: 2, bld: null }] }, []).cnt);   // 本線三份計數的全部欄位（fc＋fac＋mc）
  const names = [...emptyKeys];
  const missingKeys = bumped.filter(n => !emptyKeys.includes(n)), extraKeys = emptyKeys.filter(n => !declared.has(n));
  const compare = (lab, mine, stopAtFirst = false) => {
    const st = { steps: 0, diffs: 0, first: '', pos: Object.fromEntries(emptyKeys.map(k => [k, 0])), upJob: 0, pj: 0, wj: 0, ij: 0, dj: 0, iuF: 0, opOn: {}, opOff: {}, lvHigh: 0, refs: 0 };
    for (const k of LOGI) { st.opOn[k] = 0; st.opOff[k] = 0; }
    for (let m = 0; m < C.length; m++) {
      const c = C[m], A = clone(c.tiles), B = clone(c.tiles);
      lab.set(c.N, A, c.popN, c.jobsC, c.jobsI, c.tax, c.sb); mine.set(c.N, B, c.popN, c.jobsC, c.jobsI, c.tax, c.sb);
      const a = lab.tick(), b = mine.tick(), sa = J(a), sb = J(b);
      st.steps++;
      for (const k of emptyKeys) if (a[k] > 0) st.pos[k]++;
      if (a.upJob > 0) st.upJob++; if (a.pj > 0) st.pj++; if (a.wj > 0) st.wj++; if (a.ij > 0) st.ij++; if (a.dj > 0) st.dj++; if (a.iu % 1 !== 0) st.iuF++;
      for (const k of LOGI) { const [built, op] = LOGI_NAMES[k]; if (a[op] > 0) st.opOn[k]++; if (a[built] > a[op]) st.opOff[k]++; }
      if (sa !== sb) {
        st.diffs++;
        if (!st.first) { const x = JSON.parse(sa), y = JSON.parse(sb); st.first = `第 ${m} 張（${c.fam}，N=${c.N}）：${Object.keys(x).filter(k => J(x[k]) !== J(y[k])).slice(0, 5).map(k => `${k} 實驗線 ${J(x[k]).slice(0, 30)}≠本線 ${J(y[k]).slice(0, 30)}`).join('；')}`; }
        if (stopAtFirst) return st;
      }
    }
    return st;
  };
  const base = compare(makeLab(T, names), makeMine(await mods()));
  if (process.env.D024_DEBUG) console.log('最少的計數：', Object.entries(base.pos).sort((x, y) => x[1] - y[1]).slice(0, 14).map(([k, v]) => `${k}:${v}`).join(' '));
  const minPos = Math.min(...emptyKeys.filter(k => !['suppliesGain', 'oilGain', 'oreGain'].includes(k)).map(k => base.pos[k]));
  const zeroKeys = emptyKeys.filter(k => !['suppliesGain', 'oilGain', 'oreGain'].includes(k) && base.pos[k] === 0);
  const opMin = Math.min(...LOGI.map(k => Math.min(base.opOn[k], base.opOff[k])));
  log(base.diffs === 0 && !missingKeys.length && !zeroKeys.length && minPos >= 20 && opMin >= 8 && base.upJob > 200 && base.pj > 100 && base.wj > 100 && base.ij > 100 && base.dj > 100 && base.iuF > 100,
    `D024 驗收 1、2、3：計數、就業、維護費逐項＝實驗線——實驗線原文在 vm 裡跟本線 count.ts、jobs.ts、money.ts 吃 ${C.length} 張隨機小圖（全部 186 種建築、多格建築的根格與 ref 格、有電沒電、等級 1–10、路、鐵路、水格、四種格子旗標、物流設施貼路與不貼路、`
      + `鐵路與水格夠不夠）：實驗線宣告裡「迴圈有數」的 ${bumped.length} 個計數（除住宅塔與巨廈的居民）每一個逐項相等，名目就業（55246–55250）、電力／水務／基建／車庫的就業與維護費、維護費總額（55969–55977、55990）逐位相等`,
    base.first || (missingKeys.length ? `本線缺這些計數：${missingKeys.join('、')}` : zeroKeys.length ? `這些計數沒有任何一張圖 > 0：${zeroKeys.join('、')}` : `${base.steps} 步全等；每個計數至少 ${minPos} 步 > 0；物流「運作中」與「沒運作」每種至少 ${opMin} 步；升級加成就業 ${base.upJob} 步、電力／水務／基建／車庫的就業 ${base.pj}／${base.wj}／${base.ij}／${base.dj} 步、基建維護有小數 ${base.iuF} 步；本線多出的欄位 ${extraKeys.join('、') || '沒有'}`));

  // ---- 3. 注入錯誤要紅 ----
  {
    const LAB_MUT = [
      ['nIndG284 門檻 lv≥2→lv≥3', 'count', 'b.k===3&&!b.ref&&b.lv>=2&&b.pw)nIndG284++', 'b.k===3&&!b.ref&&b.lv>=3&&b.pw)nIndG284++'],
      ['nComG284 商業 lv≥2→lv≥3', 'count', 'b.k===2&&!b.ref&&b.lv>=2&&b.pw)nComG284++', 'b.k===2&&!b.ref&&b.lv>=3&&b.pw)nComG284++'],
      ['購物中心 +3→+4', 'count', 'nComG284+=3', 'nComG284+=4'],
      ['溫室金幣 ×4→×5', 'count', 'ghGoldU+=glv*4', 'ghGoldU+=glv*5'],
      ['倉儲容量每級 60→61', 'count', 'whCap284+=120+((b.lv||1)-1)*60', 'whCap284+=120+((b.lv||1)-1)*61'],
      ['食品加工容量每級 20→21', 'count', 'procCapU+=40+((b.lv||1)-1)*20', 'procCapU+=40+((b.lv||1)-1)*21'],
      ['升級加成 ??6→||6', 'count', '(UP_JOB[b.k]??6)', '(UP_JOB[b.k]||6)'],
      ['升級門檻 lv>1→lv>2', 'count', 'UP_MAX[b.k]&&b.lv>1)', 'UP_MAX[b.k]&&b.lv>2)'],
      ['農場金幣 ×3→×4', 'count', 'farmGoldU+=flv*3*fb', 'farmGoldU+=flv*4*fb'],
      ['大農場金幣 ×12→×13', 'count', 'farmGoldU+=flv*12*fb', 'farmGoldU+=flv*13*fb'],
      ['牧場金幣 ×2→×3', 'count', 'ranchGoldU+=rlv*2;', 'ranchGoldU+=rlv*3;'],
      ['貨櫃物流不判斷運作中', 'count', 'if(logisticsOperational485(i88,b))clOp485++', 'clOp485++'],
      ['大墓園算成 k53', 'count', 'if(b&&b.k===54)bigCemN++', 'if(b&&b.k===53)bigCemN++'],
      ['地標就業改讀維護', 'count', 'jobsLm309+=lc309.j', 'jobsLm309+=lc309.u'],
      ['社宅算成 k126', 'count', 'b.k===127)socialHousing364++', 'b.k===126)socialHousing364++'],
      ['UP_JOB 體育場 15→16', 'UP_JOB', '9:15', '9:16'],
      ['UP_JOB 電廠 0→1', 'UP_JOB', ',5:0,', ',5:1,'],
      ['UP_MAX 消防局 10→0', 'UP_MAX', '{9:15,6:10', '{9:15,6:0'],
      ['地標 k70 就業 3→4', 'LMCFG309', '70:{t:10,j:3', '70:{t:10,j:4'],
      ['地標 k70 維護 3→4', 'LMCFG309', '70:{t:10,j:3,u:3', '70:{t:10,j:3,u:4'],
      ['聯運鐵路格門檻 2→3', 'logisticsOperational485', 'countNear(x,y,6,t=>t.rail)<2', 'countNear(x,y,6,t=>t.rail)<3'],
      ['散貨碼頭水格門檻 4→5', 'logisticsOperational485', 'countNear(x,y,5,t=>t.t===0)<4', 'countNear(x,y,5,t=>t.t===0)<5'],
      ['貨櫃港水格門檻 5→6', 'logisticsOperational485', 'countNear(x,y,6,t=>t.t===0)<5', 'countNear(x,y,6,t=>t.t===0)<6'],
      ['運作中不要電', 'logisticsOperational485', '||!b.pw)return false', '||false)return false'],
      ['運作中不看貼路', 'logisticsOperational485', 'if(!sanRoadSeeds445(rootIdx).length)return false;', ''],
      ['物流表拿掉 k174', 'LOGISTICS_META485', '174:{tool:', '1740:{tool:'],
      ['學校 ×8→×9', 'jobs', 'schools*8', 'schools*9'],
      ['購物中心 ×70→×71', 'jobs', 'mallN*70', 'mallN*71'],
      ['升級加成就業不加', 'jobs', '+upJob+powerJobs471()', '+powerJobs471()'],
      ['電力就業不加', 'jobs', '+powerJobs471()', '+0'],
      ['水務就業不加', 'jobs', '+waterJobs472()', '+0'],
      ['基建就業不加', 'jobs', '+infraJobs475()', '+0'],
      ['車庫就業不加', 'jobs', 'jobs+=transitDepotJobs501();', ''],
      ['貨櫃港就業 70→71', 'jobs', 'cport485*70', 'cport485*71'],
      ['煉油廠就業 18→19', 'jobs', 'refineryN*18', 'refineryN*19'],
      ['雷達就業 6→7', 'jobs', 'radar364*6', 'radar364*7'],
      ['電力就業 k140 28→29', 'powerJobs471', '140:28', '140:29'],
      ['水務就業 k156 24→25', 'waterJobs472', '156:24', '156:25'],
      ['基建就業 k164 8→9', 'infraJobs475', '164:8', '164:9'],
      ['電力維護 k144 18→19', 'powerUpkeep471', '144:18', '144:19'],
      ['水務維護 k156 18→19', 'waterUpkeep472', '156:18', '156:19'],
      ['基建維護 架空 .035→.036', 'infraUpkeep475', 'n+=.035', 'n+=.036'],
      ['基建維護 立交 .24→.25', 'infraUpkeep475', 'n+=.24', 'n+=.25'],
      ['基建維護 k164 5→6', 'infraUpkeep475', '164:5', '164:6'],
      ['車庫 地鐵就業 16→17', 'TRANSIT_DEPOT_META501', 'jobs:16', 'jobs:17'],
      ['車庫 公車維護 6→7', 'TRANSIT_DEPOT_META501', 'upkeep:6', 'upkeep:7'],
      ['公園維護 .5→.6', 'upkeep', 'parks*.5', 'parks*.6'],
      ['綜合醫院維護 16→17', 'upkeep', 'mhN*16', 'mhN*17'],
      ['貨櫃港維護 36→37', 'upkeep', 'cport485*36', 'cport485*37'],
      ['雷達維護 7→8', 'upkeep', 'radar364*7', 'radar364*8'],
      ['車庫維護不加', 'upkeep', 'upkeep+=transitDepotUpkeep501();', ''],
      ['服務預算：消防不減 1', 'upkeepBudget', '(svcBudget.fire-1)', '(svcBudget.fire)'],
    ];
    const MINE_MUT = [
      ['count', 'nIndG284 門檻 lv≥2→lv≥3', '(b.lv as number) >= 2 && b.pw) c.nIndG284++', '(b.lv as number) >= 3 && b.pw) c.nIndG284++'],
      ['count', 'nComG284 商業 lv≥2→lv≥3', '(b.lv as number) >= 2 && b.pw) c.nComG284++', '(b.lv as number) >= 3 && b.pw) c.nComG284++'],
      ['count', '購物中心 +3→+4', 'c.nComG284 += 3', 'c.nComG284 += 4'],
      ['count', '溫室金幣 ×4→×5', 'c.ghGoldU += (b.lv || 1) * 4', 'c.ghGoldU += (b.lv || 1) * 5'],
      ['count', '倉儲容量每級 60→61', 'c.whCap284 += 120 + ((b.lv || 1) - 1) * 60', 'c.whCap284 += 120 + ((b.lv || 1) - 1) * 61'],
      ['count', '食品加工容量每級 20→21', 'c.procCapU += 40 + ((b.lv || 1) - 1) * 20', 'c.procCapU += 40 + ((b.lv || 1) - 1) * 21'],
      ['count', '升級加成 ??6→||6', '(UP_JOB[k] ?? 6)', '(UP_JOB[k] || 6)'],
      ['count', '升級門檻 lv>1→lv>2', 'UP_MAX[k] && (b.lv as number) > 1', 'UP_MAX[k] && (b.lv as number) > 2'],
      ['count', '農場金幣 ×3→×4', 'c.farmGoldU += (b.lv || 1) * 3', 'c.farmGoldU += (b.lv || 1) * 4'],
      ['count', '大農場金幣 ×12→×13', 'c.farmGoldU += (b.lv || 1) * 12', 'c.farmGoldU += (b.lv || 1) * 13'],
      ['count', '牧場金幣 ×2→×3', 'c.ranchGoldU += (b.lv || 1) * 2', 'c.ranchGoldU += (b.lv || 1) * 3'],
      ['count', '貨櫃物流不判斷運作中', 'c.cl485++; if (logisticsOperational485(w, root, b)) c.clOp485++;', 'c.cl485++; c.clOp485++;'],
      ['count', '大墓園不數', 'case 54: c.bigCemN++; break;', 'case 54: break;'],
      ['count', '地標就業與維護對調', 'c.jobsLm309 += j; c.upLm309 += u;', 'c.jobsLm309 += u; c.upLm309 += j;'],
      ['count', '社宅不數', 'case 127: c.socialHousing364++; break;', 'case 127: break;'],
      ['count', '聯運鐵路格門檻 2→3', 'countNear(w, x, y, 6, (t: Tile) => t.rail) < 2', 'countNear(w, x, y, 6, (t: Tile) => t.rail) < 3'],
      ['count', '散貨碼頭水格門檻 4→5', 'countNear(w, x, y, 5, (t: Tile) => t.t === 0) < 4', 'countNear(w, x, y, 5, (t: Tile) => t.t === 0) < 5'],
      ['count', '貨櫃港水格門檻 5→6', 'countNear(w, x, y, 6, (t: Tile) => t.t === 0) < 5', 'countNear(w, x, y, 6, (t: Tile) => t.t === 0) < 6'],
      ['count', '運作中不要電', '!isLogistics485(b.k) || !b.pw', '!isLogistics485(b.k)'],
      ['count', '運作中不看貼路', 'if (!sanRoadSeeds445(w, root).length) return false;', ''],
      ['count', '物流種類只到 k173', 'k >= 165 && k <= 174;', 'k >= 165 && k <= 173;'],
      ['count', '地標就業 k69 4→5', 'LANDMARK_JOBS309: Record<number, number> = { 69: 4', 'LANDMARK_JOBS309: Record<number, number> = { 69: 5'],
      ['count', '地標只數到 k79', 'if (k >= 69 && k <= 80) { const j', 'if (k >= 69 && k <= 79) { const j'],
      ['count', 'UP_JOB 體育場 15→16', 'UP_JOB: Record<number, number> = { 9: 15,', 'UP_JOB: Record<number, number> = { 9: 16,'],
      ['count', 'UP_JOB 電廠 0→1', '5: 0, 25: 0', '5: 1, 25: 0'],
      ['count', 'ref 格也數', 'if (!b || b.ref) continue;', 'if (!b) continue;'],
      ['count', '學校數成 k8', 'if (b.k === 7) fac.schools++;', 'if (b.k === 8) fac.schools++;'],
      ['count', '車庫就業接成維護', 'transitDepotTotals501(w, tickBld).jobs', 'transitDepotTotals501(w, tickBld).upkeep'],
      ['count', '電力就業不接', 'jc.powerJobs471 = powerJobs471(w, tickBld);', 'jc.powerJobs471 = 0;'],
      ['count', '水務就業不接', 'jc.waterJobs472 = waterJobs472(w, tickBld);', 'jc.waterJobs472 = 0;'],
      ['jobs', '電力就業 k140 28→29', '140: 28,', '140: 29,'],
      ['jobs', '水務就業 k156 24→25', '156: 24,', '156: 25,'],
      ['jobs', '基建就業 k164 8→9', '164: 8 }', '164: 9 }'],
      ['jobs', '車庫地鐵就業 16→17', '178: { jobs: 16,', '178: { jobs: 17,'],
      ['jobs', '掃圖不跳 ref 格', 'const b = w.tiles[i].bld; if (!b || b.ref) continue; n += table[b.k] || 0;', 'const b = w.tiles[i].bld; if (!b) continue; n += table[b.k] || 0;'],
      ['jobs', '掃圖（建築索引版）不跳 ref 格', 'const b = w.tiles[bldIdx[k]]?.bld; if (!b || b.ref) continue;', 'const b = w.tiles[bldIdx[k]]?.bld; if (!b) continue;'],
      ['jobs', '掃圖（建築索引版）只掃前一半', 'for (let k = 0; k < bldIdx.length; k++) { const b', 'for (let k = 0; k < bldIdx.length >> 1; k++) { const b'],
      ['money', '電力維護 k144 18→19', '144: 18,', '144: 19,'],
      ['money', '水務維護 k156 18→19', '156: 18,', '156: 19,'],
      ['money', '基建維護 k164 5→6', '164: 5 }', '164: 6 }'],
      ['money', '基建維護 架空 .035→.036', 'if (t.lv475) n += .035;', 'if (t.lv475) n += .036;'],
      ['money', '基建維護 地下 .018→.019', 'if (t.ud475) n += .018;', 'if (t.ud475) n += .019;'],
      ['money', '基建維護 高架 .11→.12', 'if (t.fly475) n += .11;', 'if (t.fly475) n += .12;'],
      ['money', '基建維護 立交 .24→.25', 'if (t.ix475) n += .24;', 'if (t.ix475) n += .25;'],
      ['money', '基建維護不取兩位小數', 'return +n.toFixed(2);', 'return n;'],
      ['money', '車庫維護接成就業', 'transitDepotUpkeep501: transitDepotTotals501(w, tickBld).upkeep', 'transitDepotUpkeep501: transitDepotTotals501(w, tickBld).jobs'],
      ['money', '電力維護不接', 'powerUpkeep471: powerUpkeep471(w, tickBld),', 'powerUpkeep471: 0,'],
      ['money', '計數不餵維護費', 'counts: { ...cnt, parks: tax.parks,', 'counts: { parks: tax.parks,'],
    ];
    const missed = [];
    for (const [name, key, from, to] of LAB_MUT) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key] === undefined ? '沒有這段' : t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = compare(makeLab(t2, names), makeMine(await mods()), true).diffs; } catch (e) { missed.push(`實驗線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`實驗線「${name}」`);
    }
    for (const [target, name, from, to] of MINE_MUT) {
      let M; try { M = await mods(target, [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = compare(makeLab(T, names), makeMine(M), true).diffs; } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`本線「${name}」`);
    }
    // 沒改的先核過全等（vm 另載的本線原碼跟 import 的一樣）
    let baseOk = false;
    for (const target of ['count', 'jobs', 'money']) baseOk = !compare(makeLab(T, names), makeMine(await mods(target, [])), true).diffs;
    log(baseOk && !missed.length, `D024 驗收 5：注入錯誤要紅——實驗線原文 ${LAB_MUT.length} 個、本線原碼 ${MINE_MUT.length} 個（每一種計數的條件與係數、升級表、地標表、物流運作中的每一個判斷、電力／水務／基建／車庫的表與旗標係數、就業與維護費的加總、接線）；沒改的先核過全等`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }

  // ---- 4. 接線 ----
  {
    const bad = [], day = read('src/sim/day.ts');
    const iT = day.indexOf('tallyBuildings(w, tickBld)'), iN = day.indexOf('rebuildNoise(w, g, s, tickBld)'), iJ = day.indexOf('jobCountsOf(tally, w, tickBld, jobsC, jobsI)'), iM = day.indexOf('nominalJobs(jc)'),
      iU = day.indexOf('upkeepIn(w, tickBld, cnt, c,'), iS = day.indexOf('function settleToday');
    if (!(iT > 0 && iN > iT && iJ > iN && iM > iJ && iU > iS)) bad.push('day.ts 的順序要是：主計數迴圈 tallyBuildings → 噪音 → jobCountsOf → nominalJobs；維護費在 settleToday 裡 upkeepIn');
    for (const [needle, what] of [['tallyBuildings(', 'tallyBuildings'], ['jobCountsOf(', 'jobCountsOf'], ['upkeepIn(', 'upkeepIn'], ['nominalJobs(', 'nominalJobs']]) if (day.split(needle).length !== 2) bad.push(`${what} 只叫一次（實際 ${day.split(needle).length - 1}）`);
    for (const flag of ["tiles[i].office = 1", "tiles[i].rail = 1", "tiles[i].lv475 = 1", "tiles[i].ud475 = 1", "tiles[i].fly475 = 1", "tiles[i].ix475 = q"]) if (!day.includes(flag)) bad.push(`simFromSave 沒有 ${flag}`);
    // 計數欄位合起來：JOB_KEYS、UPKEEP_KEYS 的每一個鍵，不是計數就是四個掃圖函式／商工職位／稅收迴圈的六種
    const all = new Set([...emptyKeys, 'jobsC', 'jobsI', 'powerJobs471', 'waterJobs472', 'infraJobs475', 'transitDepotJobs501', 'parks', 'plants', 'fireStations', 'policeStations', 'policeBoxes', 'hospitals']);
    const lackJ = JOBS.JOB_KEYS.filter(k => !all.has(k)), lackU = MONEY.UPKEEP_KEYS.filter(k => !all.has(k));
    if (lackJ.length || lackU.length) bad.push(`沒有來源的鍵：就業 ${lackJ.join('、') || '—'}；維護費 ${lackU.join('、') || '—'}`);
    log(!bad.length, `D024 接線：day.ts 主計數迴圈 tallyBuildings（ref 格跳過在裡面）→ 噪音 → jobCountsOf → nominalJobs、維護費 upkeepIn 各叫一次；simFromSave 讀進辦公區、鐵路格與 T475 的四個格子旗標；就業的 ${JOBS.JOB_KEYS.length} 個鍵與維護費的 ${MONEY.UPKEEP_KEYS.length} 個鍵都有來源`, bad.join('；') || '順序、次數、讀檔旗標、鍵的來源都對');
  }

  // ---- 5. 實驗線頁面實跑 ----
  {
    const lab = JSON.parse(read('src/content/samples/d024-lab.json')), codes = d024Codes(), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`樣本出處 ${lab.source?.commit?.slice(0, 7)}／${lab.config}`);
    if (J(lab.order) !== J(codes.map(c => c.id))) bad.push('樣本的城跟 d024Codes() 的順序不同');
    for (const c of codes) if (lab.cities[c.id]?.codeHash !== fnv1a(c.code)) bad.push(`${c.id} 的碼雜湊跟樣本不同`);
    // 一份 day.ts（真的或改壞的）逐座比：讀檔後本線主計數迴圈的每個計數（實驗線探針讀 tick() 區域變數）、四個掃圖函式、推進一天後的名目就業與商工職位、維護費。
    // 維護費：實驗線那一天的維護費，減掉本線沒搬的（地鐵、鐵路、公車、夜間城市的營運費；車隊超出預設 7 輛的保養；法規與科技與專精的日費），要＝本線的維護費（差 < 1e-9）。
    // 六種商品的進口費 D025 搬了（本線自己算，103 座讀進來的第一天都跟實驗線探針的一樣），不再扣
    const check = (mod, stopAtFirst = false) => {
      const rows = [], diffs = [];
      for (const c of codes) {
        const L = lab.cities[c.id], D = L.day1, r = decodeLabCode(c.code), d = [];
        if (!r.ok) { diffs.push(`${c.id}：解不開碼`); if (stopAtFirst) break; continue; }
        const s = mod.simFromSave(r.save, c.code, kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank), order = [];
        for (let i = 0; i < s.w.tiles.length; i++) if (s.w.tiles[i].bld) order.push(i);
        const t = CNT.tallyBuildings(s.w, order);
        for (const k of Object.keys(t.cnt)) if ((D.cnt[k] ?? 0) !== t.cnt[k]) d.push(`${k} 實驗線 ${D.cnt[k] ?? 0}≠本線 ${t.cnt[k]}`);
        if (t.towerPop !== D.tp || t.megaPop !== D.mp) d.push(`塔／巨廈居民 ${D.tp}／${D.mp}≠${t.towerPop}／${t.megaPop}`);
        const tot = JOBS.transitDepotTotals501(s.w, order), scan = { pj: JOBS.powerJobs471(s.w), wj: JOBS.waterJobs472(s.w), ij: JOBS.infraJobs475(s.w), dj: tot.jobs, pu: MONEY.powerUpkeep471(s.w), wu: MONEY.waterUpkeep472(s.w), iu: MONEY.infraUpkeep475(s.w), du: tot.upkeep };
        for (const k of Object.keys(scan)) if (scan[k] !== L.scan[k]) d.push(`掃圖 ${k} 實驗線 ${L.scan[k]}≠本線 ${scan[k]}`);
        const rep = mod.stepDay(s), fl = D.fleet[0] + D.fleet[1] + D.fleet[2], unported = D.metroCost + D.railOps + D.busOps + D.nightOps + (fl - 7) * .8 + D.upReg, want = D.upkeep - unported;
        if (rep.jobs !== D.jobs) d.push(`jobs 實驗線 ${D.jobs}≠本線 ${rep.jobs}`);
        if (rep.jobsC !== D.jobsC) d.push(`商業職位 ${D.jobsC}≠${rep.jobsC}`);
        if (rep.jobsI !== D.jobsI) d.push(`工業職位 ${D.jobsI}≠${rep.jobsI}`);
        if (rep.pop !== D.pop) d.push(`人口 ${D.pop}≠${rep.pop}`);
        if (Math.abs(rep.settle.upkeep - want) > 1e-9) d.push(`維護費 實驗線 ${D.upkeep.toFixed(4)}－沒搬的 ${unported.toFixed(2)}＝${want.toFixed(4)}≠本線 ${rep.settle.upkeep.toFixed(4)}`);
        if (rep.econ.sn.totalImportCost482 !== D.imports) d.push(`進口費 實驗線 ${D.imports}≠本線 ${rep.econ.sn.totalImportCost482}`);   // D025
        rows.push({ id: c.id, jobs: D.jobs, upkeep: D.upkeep, unported, imports: D.imports, n: d.length });
        if (d.length) { diffs.push(`${c.id}：${d.slice(0, 4).join('；')}`); if (stopAtFirst) break; }
      }
      return { rows, diffs };
    };
    const base = check(realDay);
    const units = base.rows.filter(x => x.unported > 0).map(x => `${x.id}（${x.unported.toFixed(2)}）`), withImp = base.rows.filter(x => x.imports > 0).length;
    const jobs = base.rows.map(x => x.jobs);
    if (bad.length || base.diffs.length) bad.push(...base.diffs.slice(0, 4));
    log(!bad.length && codes.length >= 100 && Math.max(...jobs) > 2500 && base.rows.filter(x => x.jobs > 0).length >= 70,
      `D024 驗收 4：實驗線頁面實跑——${codes.length} 座城（D022 的 80 座、D023 的 9 座、D024 的自造城 14 座；電力、水務、基建、車庫、物流運作中與差一格、升級過的服務、地標與旅宿與產業鏈、辦公區與塔、每一種建築各一棟、亂數混排）讀進來：主計數迴圈的每一個計數（含住宅塔與巨廈的居民）＝實驗線探針、四個掃圖函式的就業與維護費、推進一天後的名目就業與商工職位與人口、維護費逐座相等`,
      bad.join('｜') || `${base.rows.length} 座全等；jobs 最多 ${Math.max(...jobs)}；進口費（${withImp} 座有進口，D025 起本線自己算）逐座相等；維護費扣掉本線沒搬的（${units.length} 座有：${units.slice(0, 8).join('、')}）都對得上`);
    // 接線突變：day.ts 的副本改壞一處，這批要紅
    const MUT = [
      ['讀檔不讀辦公區', 'if (office && office.charCodeAt(i) === 49) tiles[i].office = 1;', ''],
      ['讀檔不讀鐵路格', 'if (railL && railL.charCodeAt(i) === 49) tiles[i].rail = 1;', ''],
      ['讀檔不讀手工配電線', 'if (lvl475 && lvl475.charCodeAt(i) === 49) tiles[i].lv475 = 1;', ''],
      ['讀檔不讀地下線', 'if (udl475 && udl475.charCodeAt(i) === 49) tiles[i].ud475 = 1;', ''],
      ['讀檔不讀高架', 'if (city.fly[i]) tiles[i].fly475 = 1;', ''],
      ['讀檔不讀立交', 'tiles[i].ix475 = q;', 'void q;'],
      ['主計數迴圈什麼都不數', 'tallyBuildings(w, tickBld)', 'tallyBuildings(w, [])'],
      ['名目就業不算商業職位', 'jobCountsOf(tally, w, tickBld, jobsC, jobsI)', 'jobCountsOf(tally, w, tickBld, 0, jobsI)'],
      ['維護費不餵計數', 'upkeepIn(w, tickBld, cnt, c,', 'upkeepIn(w, tickBld, {}, c,'],
    ];
    const missed = [];
    for (const [name, from, to] of MUT) {
      let V; try { V = await dayVariant([[from, to]]); } catch (e) { missed.push(`「${name}」載入失敗 ${e.message}`); continue; }
      let n; try { n = check(V, true).diffs.length; } catch (e) { missed.push(`「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!n) missed.push(`「${name}」`);
    }
    const ok0 = check(await dayVariant([]), true).diffs.length === 0;
    log(ok0 && !missed.length, `D024 驗收 4 突變：day.ts 的副本改壞一處（${MUT.length} 個：讀檔不讀辦公區／鐵路格／配電線／地下線／高架／立交、主計數迴圈不數、名目就業不算商業職位、維護費不餵計數）——實驗線實跑的這批城要紅；沒改的先核過全等`, missed.join('、') || (ok0 ? '全紅' : '沒改的副本就不等'));
  }
  // ---- 6. 存檔與拆除：讀進來的圖層 ----
  {
    const codes = d024Codes(), byId = Object.fromEntries(codes.map(c => [c.id, c])), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
    const KEYS = ['of', 'fly475', 'ix475', 'rl', 'lvl475', 'udl475'], IDS = ['E1', 'E3', 'E5', 'E8', 'E9', 'E12', 'E13', 'E14', 'gallery', 'ai120', 'seed516'];
    // 一份「存檔、拆除」的模組（真的或改壞的）：回傳不合的說明
    const run = async (edit = {}, sv = {}) => {
      const bad = [];
      const load = id => { const r = decodeLabCode(byId[id].code); return { r, s: edit.simFromSave ? edit.simFromSave(r.save, byId[id].code, KT, vrank) : realDay.simFromSave(r.save, byId[id].code, KT, vrank) }; };
      const save = (s, r, id) => (sv.saveCode ?? saveCode)(s, r.save.raw, byId[id].code, { history: false });
      const rawOf = code => decodeLabCode(code).save.raw;
      // (a) 讀進來再存出去，這幾層逐格不變；範本沒有的層不多欄位
      for (const id of IDS) {
        const { r, s } = load(id), back = rawOf(save(s, r, id));
        for (const k of KEYS) if (String(back[k] ?? '') !== String(r.save.raw[k] ?? '')) bad.push(`${id} 的 ${k} 讀了再存就變了`);
      }
      // (b) 只有鐵路的格：本線的施工看不見（跟 D024 之前一樣：「這裡沒東西」、不扣錢、不記事件）
      {
        const { r, s } = load('E5'), i = 34 * 72 + 16, t = s.w.tiles[i];
        if (!t.rail || t.road || t.bld || t.zone) bad.push('E5 (16,34) 不是只有鐵路的格');
        const op = { k: 'tap', tool: 'doze', x0: 16, z0: 34, x1: 16, z1: 34 }, m0 = s.money, pv = (edit.previewOp ?? previewOp)(s, op), res = (edit.commitOp ?? commitOp)(s, op, 0);
        if (pv.reason !== '這裡沒東西' || res.ok || res.events.length || s.money !== m0 || !t.rail) bad.push(`只有鐵路的格能拆了：預覽 ${pv.reason}、拆 ${res.ok}、事件 ${res.events.length}、錢 ${m0}→${s.money}、鐵路 ${t.rail}`);
      }
      // (c) 拆路帶走高架與立交的旗標；存檔寫回去，讀回來還是拆掉的樣子
      // (d) 拆分區帶走辦公區的旗標；同上
      {
        const { r, s } = load('E1'), i = 50 * 72 + 22, j = 50 * 72 + 30, t = s.w.tiles[i], u = s.w.tiles[j];
        t.road = 1; t.rc = 2; u.road = 1; u.rc = 2;                                      // 這兩格本來是空地（E1 的高架 (22,50)、立交 (30,50) 旗標）：在記憶體裡鋪成路再拆
        if (!t.fly475 || !u.ix475) bad.push('E1 的旗標格不對');
        const rs = ['(22,50)', '(30,50)'].map((_, q) => (edit.commitOp ?? commitOp)(s, { k: 'tap', tool: 'doze', x0: q ? 30 : 22, z0: 50, x1: q ? 30 : 22, z1: 50 }, 0));
        if (!rs.every(x => x.ok && x.events.some(e => e.t === 'doze' && e.layer === 'road')) || t.road || t.fly475 || u.ix475) bad.push(`拆路：${J(rs.map(x => [x.ok, x.events.map(e => e.layer)]))}、fly475 ${t.fly475}、ix475 ${u.ix475}`);
        const back = rawOf(save(s, r, 'E1')), b2 = decodeLabCode(save(s, r, 'E1')).save;
        if (back.fly475?.[i] !== '0' || back.ix475?.[j] !== '0' || r.save.raw.fly475?.[i] !== '1' || r.save.raw.ix475?.[j] !== String.fromCharCode(48 + u_ix(r, j))) bad.push(`存檔的高架 ${back.fly475?.[i]}（原 ${r.save.raw.fly475?.[i]}）、立交 ${back.ix475?.[j]}`);
        const s2 = realDay.simFromSave(b2, save(s, r, 'E1'), KT, vrank);
        if (s2.w.tiles[i].fly475 || s2.w.tiles[j].ix475) bad.push('存了再讀，拆掉的高架或立交又回來了');
      }
      {
        const { r, s } = load('E8'), i = 60 * 72 + 40, t = s.w.tiles[i];
        if (!t.office) bad.push('E8 (40,60) 沒有辦公區旗標');
        t.zone = 2;                                                                       // 在記憶體裡劃成商業區再拆
        const res = (edit.commitOp ?? commitOp)(s, { k: 'tap', tool: 'doze', x0: 40, z0: 60, x1: 40, z1: 60 }, 0);
        if (!res.ok || !res.events.some(e => e.t === 'doze' && e.layer === 'zone') || t.zone || t.office) bad.push(`拆分區：${res.ok}、${J(res.events.map(e => e.layer))}、zone ${t.zone}、office ${t.office}`);
        const back = save(s, r, 'E8'), s2 = realDay.simFromSave(decodeLabCode(back).save, back, KT, vrank);
        if (rawOf(back).of?.[i] !== '0' || s2.w.tiles[i].office) bad.push('存了再讀，拆掉的辦公區又回來了');
      }
      return bad;
    };
    const u_ix = (r, j) => Math.max(0, r.save.raw.ix475.charCodeAt(j) - 48);
    const bad0 = await run();
    const EDIT_MUT = [['拆除不保護讀進來的圖層', 'protect: true, ', '']];
    const SAVE_MUT = [['存檔不寫回辦公區', "if (typeof template.of === 'string' || of.includes('1')) o.of = of;", ''], ['存檔不寫回高架', "if (typeof template.fly475 === 'string' || fly.includes('1')) o.fly475 = fly;", ''],
      ['存檔不寫回立交', "if (typeof template.ix475 === 'string' || /[^0]/.test(ix)) o.ix475 = ix;", '']];
    const missed = [];
    for (const [name, from, to] of EDIT_MUT) {
      try { const E = await loadMod('src/sim/edit.ts', [[from, to]]); if (!(await run(E)).length) missed.push(`「${name}」`); } catch (e) { missed.push(`「${name}」跑不起來：${e.message}`); }
    }
    for (const [name, from, to] of SAVE_MUT) {
      try { const V = await loadMod('src/io/save.ts', [[from, to]]); if (!(await run({}, V)).length) missed.push(`「${name}」`); } catch (e) { missed.push(`「${name}」跑不起來：${e.message}`); }
    }
    log(!bad0.length && !missed.length, `D024 存檔與拆除：讀進來的辦公區、鐵路、配電線、地下線、高架、立交——讀了再存逐層不變（${IDS.length} 座城；範本沒有的層不多欄位）；只有鐵路的格本線的施工看不見（「這裡沒東西」、不扣錢、不記事件，同 D024 之前）；拆路帶走高架與立交的旗標、拆分區帶走辦公區的旗標，存檔寫回去、讀回來還是拆掉的樣子；`
      + `突變（拆除不保護、存檔不寫回辦公區／高架／立交）要紅`, bad0.slice(0, 4).join('；') || missed.join('、') || `${IDS.length} 座城不變；拆除與存檔的 ${EDIT_MUT.length + SAVE_MUT.length} 個突變全紅`);
  }
}
