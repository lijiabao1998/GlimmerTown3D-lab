// D020 Node 守衛：垃圾清運（驗收 2，加上守衛的突變、接線、決定性）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d020-garbage.json（tools/lab-garbage.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄，常數＝本線，
//      「實驗線沒有開清運的 rollback、開著住房／企業／事故三個回退開關」這個前提（tools/lab-configs.mjs 的對拍設定）也在這裡核；
//   2. 清運逐項相等：實驗線原文（新式清運 T445 多源 BFS＋T452 清運分區與負載、computeGarbLocal、sanitationAt452、tick() 55256–55278 那一段原文、
//      住宅人口鏈、企業層關掉時的有效職位）在 vm 裡跑，跟本線 src/sim/rules/garbage.ts 吃同一批隨機小圖：格狀、隨機、樹狀死路、通到圖邊、斷開的路網、
//      長路（距離超過 12、18）、雙路夾一排（設施同時貼兩段路：T452 合併）、對稱雙區（平手的挑區與最壞區）、密集城（負載超過 2）、72×72 的大圖、
//      500 前焚化廠只在 ref 格那一側貼路（實驗線 57701 的 k62 沒判 ref）、算好之後才在浮點誤差內剛好超過容量的需求（過載的 1e-9 容差）、
//      垃圾場／回收中心／焚化（多格）／堆肥／資源回收、接不到路的設施、住宅（等級、密度、有電、生病、幸福邊界值）、社宅、住宅塔、巨廈、商業、工業、其他建築、
//      路壓在建築底下的髒圖；人口 0、120、499、500、501、2000、很大（兩個分支：500 前走 T119 舊口徑、500 起走 T452 區負載）；
//      同一張圖連續多天（中間加減路、設施、換電、改幸福、換人口）。
//      每一步比：垃圾量、容量、比例、全城池扣分、每一格路的距離與來源、上線與否、上線設施與全部設施、sanStat445 每個欄位、
//      清運區表（容量、需求、剩餘、溢出、負載、客戶、各種設施數、路格數、起點）、SAN_NET、facilityMap、rootAlloc（區、路格、距離、來源、需求、原因）、
//      alloc、garbLocal（Float32，逐格 Object.is）、每一棟建築的 b.h（Object.is）、far／unserved／warn／penAvg、garbDecisionRatio452，
//      另抽查 sanitationAt452（路、設施、住商工、空地、出界；含建築卡的現算流程 cityView.ts sanRowOf）與 sanRoadSeeds445／sanAccessRoot445（根格、ref 格、空格、出界），
//      並直接呼叫 API：只算 computeSanitation445、computeGarbLocal、sanWasteOfRoot452、算好之後才加設施／拆建築再問 sanitationAt452（過期的狀態）；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一處（常數、BFS 步長與方向、上線判斷、容量只算上線、union 方向與右邊界、不合併 frontage、挑區三層排序、
//      最壞區平手、過載容差、垃圾產量、扣分幅度、clamp 上下限、k62 的 ref 判斷、pw 判斷、住宅人口鏈……）都比出差異（沒改的本線原碼在 vm 裡載入先核過相等）；
//      看不出差異的等價改動另列，逐一核對它們確實沒有任何輸出不同；
//   4. 接線：day.ts 逐字呼叫 garbageStep(w, s.san ??= newSan(N), pop, jobsI, tickBld)（在 jobsI 定案之後、勞動力與結算之前）、結算讀 garbDecisionRatio452(s.san!)；
//      stepDay 真的推進幾天（預建城、AI 城、種子城、樣張城，各補幾座垃圾場），用 s.san 的存取攔截取得呼叫當下的格子，
//      直接呼叫 garbageStep（人口取日報的：含住宅塔、巨廈的居民，55246）的結果＝s.san 的結果＝沒攔截的另一份模擬，b.h 逐棟相等；
//   5. 決定性：同一批圖同一批人口連跑兩次，本線輸出逐位元組相同，並對上寫死的指紋（Node 22 與 24 都要對上）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { ROOT } from './cdp.mjs';
import { FALLBACK_FLAGS } from './lab-configs.mjs';
import { canon } from './d009-cases.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import * as jobsMod from '../src/sim/rules/jobs.ts';
import * as garbageMod from '../src/sim/rules/garbage.ts';
import { loadCode } from '../src/io/save.ts';
import { codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { stepDay } from '../src/sim/day.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['clamp', 'T', 'idx', 'inMap', 'DIRV', 'POPS', 'JOBSC', 'JOBSI', 'DEN_POP', 'TOWER_MULT', 'TOWER_POP', 'MEGA_POP', 'MEGA_JOBS', 'TOWER_JOBS', 'DUMP_CAP', 'SOCIAL_HOUSING_POP', 'garbage', 'lastGarbT', 'garbLocal',
  'SAN_FORMAL_POP445', 'SAN_CAP445', 'sanQ445', 'sanActiveRoots445', 'emptySanStat445', 'sanStat445', 'ensureSan445', 'isSanFacility445', 'isSanClient445', 'sanRoadSeeds445', 'sanAccessRoot445', 'sanitationSourceText445', 'computeSanitation445',
  'SAN_NET452', 'sanDistricts452', 'sanAlloc452', 'sanitationLegacy452', 'ensureSan452', 'sanFind452', 'sanUnion452', 'sanFacilityFrontage452', 'emptySanAlloc452', 'resetSanitation452', 'rebuildSanitationDistricts452', 'ensureSanitationDistricts452',
  'sanRootDistrictChoice452', 'sanWasteOfRoot452', 'prepareSanitationLoad452', 'sanWorstDistrict452', 'garbDecisionRatio452', 'sanitationAt452', 'computeGarbLocal',
  'housingBand488', 'residentCapacity488', 'residentEligible488', 'housingOccupancy488', 'residentPopulation488',
  'enterprisePotentialJobs489', 'enterpriseLegacyJobs489', 'enterpriseRootInfo489', 'enterpriseActualJobs489', 'UP_MAX', 'UP_JOB', 'assetAvailability493', 'tickGarbage'];
// 行號（@ d23c18d）：摘錄工具記下的起點，守衛核對關鍵幾段
const LINES = { clamp: 37219, DIRV: 56955, DUMP_CAP: 37424, SAN_FORMAL_POP445: 37977, SAN_CAP445: 37978, sanRoadSeeds445: 37986, sanAccessRoot445: 37994, computeSanitation445: 38003, rebuildSanitationDistricts452: 38057,
  sanRootDistrictChoice452: 38072, sanWasteOfRoot452: 38077, prepareSanitationLoad452: 38083, sanWorstDistrict452: 38090, garbDecisionRatio452: 38091, sanitationAt452: 38094, computeGarbLocal: 57697,
  residentPopulation488: 39480, enterpriseActualJobs489: 39577, assetAvailability493: 64520, tickGarbage: 55256 };
// vm 裡的載入順序（const／let 要先於使用它初始化的那一行；函式會提升）
const LAB_ORDER = PIECES.filter(k => k !== 'tickGarbage');
// 決定性的指紋：本線 garbage.ts 在這 360 張隨機小圖上「每一步輸出」的 sha256（只跑本線，不含實驗線那邊）——每一步的人口與工業就業、評分用的比例、garbPen409、
// far／unserved／warn／penAvg、垃圾量與容量與比例、sanStat445、清運區表、facilityMap、rootAlloc、alloc（轉成 canon 字串），加上 dist／src／active／net／garbLocal 的原始位元組與每棟建築的 b.h。
// 會讓它變的：garbage.ts 的算法（差一位也算）、jobs.ts 住宅人口鏈、lab.ts 的 clamp／idx／inMap、rng.ts 的 mulberry32、這個檔的案例產生器（cases、FAM_ORDER、runCase 裡的改圖與人口挑法）與快照內容；
// 不會變的：day.ts、stepDay、存檔格式（指紋不跑 stepDay）。守衛失敗時會印出新值；先確認「驗收 2」那一項（跟實驗線逐項相等）還是綠的，再把新值填回來。Node 22 與 24 算出來相同
const FINGERPRINT = '909baed57760ff0f62aa62f74b356fe4c18f67ecaf207633c7f452ffc3144a90';

export async function d020Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D020 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 逐項相等（Object.is：-0、NaN、Infinity 都分得出來；陣列、型別陣列、物件遞迴；鍵的順序不算）
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const la = Array.isArray(a) || ArrayBuffer.isView(a), lb = Array.isArray(b) || ArrayBuffer.isView(b);
  if (la || lb) { if (!(la && lb) || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false; return true; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !same(a[k], b[k])) return false;
  return true;
}

// ================= 實驗線那一邊：原文在 vm 裡（strict）=================
// 樁（每一個都有出處；沒列在這裡的全是原文）：
//   window：對拍設定（tools/lab-configs.mjs FALLBACK_FLAGS）開著 __noHousing488（housingOccupancy488 39479 回 1）、__noEnterprise489、__noIncident493（assetAvailability493 64520 第一句回 1）；
//     沒開 __legacySanitation445／452、__noSanitationDistrict452（sanitationLegacy452 38050 為 false＝新式清運）；window 也接住 __t445Sanitation／__t452Sanitation／__t452Load 的寫入
//   pol＝null：沒有政策（recycleMul452＝1）；enterprise489＝{ready:false}、enterpriseRoot489＝空 Map：企業層關掉（enterpriseRollback489 39560），有效職位走 enterpriseLegacyJobs489 39527
//   goods／goodsCap283／upc342：資源回收廠把垃圾變貨物（55263、55265）：本線沒有貨物系統，卡面「不做什麼」
//   toast＝空函式（55274、55278 的提示只是通知，原文那兩行照留）；day／lastGarbT 讓 day-lastGarbT>=30 有值（lastGarbT 是原文 37967）
//   happySum／happyN／cityHappy：55271–55273 原文會寫的全域，本線由 day.ts 另算（55282–55284）
//   KNAME＝{}：sanitationSourceText445 只組畫面文字；LOGISTICS_META485＝{}：enterprisePotentialJobs489 只在種類不是 2、3、34、106… 時才讀（清運只問 k3）
const LAB_WINDOW = { __noHousing488: true, __noEnterprise489: true, __noIncident493: true };
function makeLab(t) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';
let N=1,tiles=[],pop=0,jobsI=0,tickBld=[],happySum=0,happyN=0,cityHappy=.6,day=0,goods=0;
const window=${J(LAB_WINDOW)};
const pol=null,enterprise489={ready:false},enterpriseRoot489=new Map(),goodsCap283=()=>1e9,upc342=0,toast=()=>{},KNAME={},LOGISTICS_META485={};
${LAB_ORDER.map(k => t[k]).join('\n')}
function garbTick(){
${t.tickGarbage}
return {garbPen409,garbLoc445};
}
const dq=q=>({id:q.id,roads:q.roads,anchor:q.anchor,facilities:q.facilities,capacity:q.capacity,demand:q.demand,spare:q.spare,overflow:q.overflow,load:q.load,clients:q.clients,byK:q.byK});
globalThis.__api={
  set:(n,ts)=>{N=n;tiles=ts;garbLocal=new Float32Array(N*N);resetSanitation452();sanQ445=null;SAN_DIST445=null;SAN_SRC445=null;SAN_ACTIVE445=null;
    sanActiveRoots445=[];sanAllRoots445=[];sanDirty445=true;sanStat445=emptySanStat445();garbage=0;garbCap=0;garbRatio=0;lastGarbT=-999;day=0;ensureSan445();ensureSan452();},
  tick:(p,ji,order)=>{pop=p;jobsI=ji;tickBld=order;day++;const r=garbTick();return {decision:garbDecisionRatio452(),pen:r.garbPen409,loc:r.garbLoc445};},
  snap:()=>({scal:[garbage,garbCap,garbRatio],stat:sanStat445,dist:SAN_DIST445,src:SAN_SRC445,active:SAN_ACTIVE445,activeRoots:sanActiveRoots445,allRoots:sanAllRoots445,
    net:SAN_NET452,districts:sanDistricts452.map(dq),fmap:[...sanFacilityMap452],ralloc:[...sanRootAlloc452],alloc:sanAlloc452,garbLocal,hs:tiles.map(q=>q.bld?q.bld.h:undefined)}),
  probe:(x,y)=>{const r=sanitationAt452(x,y);if(r)delete r.sourceText;return r;},
  seeds:i=>sanRoadSeeds445(i),
  access:i=>sanAccessRoot445(i),
  compute:p=>{pop=p;sanDirty445=true;return computeSanitation445();},
  gl:r=>{garbRatio=r;return computeGarbLocal();},
  waste:(i,m)=>sanWasteOfRoot452(i,m),
  consts:()=>({SAN_FORMAL_POP445,SAN_WARN_DIST445,SAN_LONG_DIST445,SAN_INF445,DUMP_CAP,SAN_CAP445:{...SAN_CAP445}}),
};`, ctx, { filename: 'lab:garbage' });
  return ctx.__api;
}

// ================= 本線那一邊（garbage.ts；突變時傳型別剝除後在 vm 裡載入的那一份）=================
function makeMine(m = garbageMod) {
  let w = null, san = null;
  const dq = q => ({ id: q.id, roads: q.roads, anchor: q.anchor, facilities: q.facilities, capacity: q.capacity, demand: q.demand, spare: q.spare, overflow: q.overflow, load: q.load, clients: q.clients, byK: q.byK });
  return {
    set(n, ts) { w = { N: n, tiles: ts }; san = m.newSan(n); },
    tick(p, ji, order) { const decision = m.garbageStep(w, san, p, ji, order); return { decision, pen: san.garbPen409, loc: { far: san.far, unserved: san.unserved, warn: san.warn, penAvg: san.penAvg } }; },
    snap: () => snapOf(san, w.tiles, dq),
    probe: (x, y) => m.sanitationAt452(w, san, x, y),
    // 建築卡的做法（cityView.ts sanRowOf）：另配一份狀態現算——computeSanitation445，正式清運再 prepareSanitationLoad452，然後 sanitationAt452
    ui(p) { const s2 = m.newSan(w.N), st = m.computeSanitation445(w, s2, p); if (st.formal) m.prepareSanitationLoad452(w, s2, 1); return (x, y) => m.sanitationAt452(w, s2, x, y); },
    seeds: i => m.sanRoadSeeds(w, i),
    access: i => m.sanAccessRoot(w, san, i),
    extras: () => [san.garbPen409, san.far, san.unserved, san.warn, san.penAvg],   // 實驗線這幾個是 tick() 裡的區域變數，沒有全域可比；推進之前一律 0
    compute: p => m.computeSanitation445(w, san, p),
    gl: r => { san.garbRatio = r; return m.computeGarbLocal(w, san, r); },   // 實驗線的 computeGarbLocal 讀全域 garbRatio；本線傳參數，快照也要看到同一個值
    waste: (i, mul) => m.sanWasteOfRoot452(w, i, mul),
  };
}
const snapOf = (san, tiles, dq = q => ({ id: q.id, roads: q.roads, anchor: q.anchor, facilities: q.facilities, capacity: q.capacity, demand: q.demand, spare: q.spare, overflow: q.overflow, load: q.load, clients: q.clients, byK: q.byK })) => ({
  scal: [san.garbage, san.garbCap, san.garbRatio], stat: san.stat, dist: san.dist, src: san.src, active: san.active, activeRoots: san.activeRoots, allRoots: san.allRoots,
  net: san.net, districts: san.districts.map(dq), fmap: [...san.facilityMap], ralloc: [...san.rootAlloc], alloc: san.alloc, garbLocal: san.garbLocal, hs: tiles.map(q => q.bld ? q.bld.h : undefined) });
const stripTs = s => stripTypeScriptTypes(s).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
// 本線原碼（可能是改過的）載入 vm：garbage.ts import 的東西（現在是 lab.ts 的 clamp／idx／inMap 與 jobs.ts 的 residentPopulation488／JOBSI）由 vm 的全域補上；
// jobs 可以換成改過的那份（只覆蓋它有匯出的名字）
function loadMine(src, jobs = jobsMod) {
  const ctx = vm.createContext({ ...labHelpers, ...jobsMod, ...jobs });
  vm.runInContext(`${stripTs(src)}\nglobalThis.__m={newSan,garbageStep,garbDecisionRatio452,sanitationAt452,sanRoadSeeds,sanAccessRoot,computeSanitation445,prepareSanitationLoad452,computeGarbLocal,sanWasteOfRoot452};`, ctx, { filename: 'mutant:garbage.ts' });
  return ctx.__m;
}
function loadJobs(src) {
  const ctx = vm.createContext({ clamp: labHelpers.clamp });
  vm.runInContext(`${stripTs(src)}\nglobalThis.__m={residentPopulation488,JOBSI};`, ctx, { filename: 'mutant:jobs.ts' });
  return ctx.__m;
}

// ================= 隨機小圖 =================
// 格子照實驗線的形狀：{t, road, bld:{k,lv,v,age,pw,wa,h,den,sick,death,sz | ref}}；多格建築的根格有 sz，其他格是 {k,lv:0,v:0,ref:[x,y]}
const FAC_KINDS = [8, 8, 8, 29, 62, 62, 88, 111];
function stamp(T, N, x, y, k, sz, ex) {
  T[y * N + x].bld = { k, lv: 1, v: 0, ...(sz > 1 ? { sz } : {}), ...ex };
  for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) T[(y + dy) * N + x + dx].bld = { k, lv: 0, v: 0, ref: [x, y] };
}
const POP_OF = [6, 7, 8, 10, 13, 15, 19, 22, 28, 35, 38, 46, 54, 68, 86];   // 住宅 lv×密度 的人口（residentCapacity488）
const SPEC_OF_POP = { 6: [1, 1], 7: [1, 2], 8: [1, 3], 10: [1, 4], 13: [1, 5], 15: [2, 1], 19: [2, 2], 22: [2, 3], 28: [2, 4], 35: [2, 5], 38: [3, 1], 46: [3, 2], 54: [3, 3], 68: [3, 4], 86: [3, 5] };
const CASES = 360;
// 一輪 20 張，每種先出一張（突變最好在第一輪就被抓到，抓到就不必往後跑）；72×72 貴，放在每一輪的最後、隔一輪才放
const FAM_ORDER = ['mirror', 'epsilon', 'legacy', 'twin', 'dirty', 'long', 'dense', 'border', 'tiny', 'tree', 'grid', 'random', 'corner', 'mirror', 'legacy8', 'grid', 'long', 'epsilon', 'tree', 'big'];

function cases() {
  const R = mulberry32(20261020), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  const resH = () => ch(.4) ? pick([.05, .06, .1, .15, .2, .5, .95, 1, 1.05, 1.3]) : .2 + R() * .8;
  const lvOf = () => ch(.03) ? pick([0, 4]) : int(1, 3);   // 等級 0、4 不合法（POPS、JOBSI 讀出界），兩邊照樣要一樣
  const house = ex => ({ k: 1, sz: 1, ex: { lv: lvOf(), v: int(0, 11), age: int(0, 40), pw: ch(.85), ...(ch(.8) ? { den: int(1, 5) } : ch(.3) ? { den: 0 } : {}), h: resH(), ...(ch(.04) ? { sick: 1 } : {}), ...(ch(.03) ? { death: 1 } : {}), ...ex } });
  const bldSpec = () => {
    const r = R();
    if (r < .42) return house();
    if (r < .48) return { k: 127, sz: 1, ex: { lv: 1, v: 0, age: 0, pw: ch(.85), wa: ch(.7), h: resH() } };
    if (r < .58) return { k: 2, sz: 1, ex: { lv: int(1, 3), v: int(0, 11), age: int(0, 40), pw: ch(.85) } };
    if (r < .70) return { k: 3, sz: 1, ex: { lv: lvOf(), v: int(0, 11), age: int(0, 40), pw: ch(.75) } };
    if (r < .74) return { k: 33, sz: 2, ex: { lv: 1, v: 0, age: 0, pw: ch(.5) } };
    if (r < .76) return { k: 105, sz: 3, ex: { lv: 1, v: 0, age: 0, pw: ch(.5) } };
    if (r < .79) return { k: 34, sz: 2, ex: { lv: 1, v: 0, age: 0, pw: true } };
    if (r < .80) return { k: 106, sz: 3, ex: { lv: 1, v: 0, age: 0, pw: true } };
    const k = pick([4, 5, 6, 7, 9, 10, 11, 12, 52, 100]);
    return { k, sz: ch(.3) ? 2 : 1, ex: { lv: 1, v: 0, age: 0, pw: true } };
  };
  const facSize = k => k === 62 ? (ch(.85) ? 2 : 3) : k === 8 ? (ch(.9) ? 1 : 2) : k === 111 ? pick([1, 2, 2]) : pick([1, 1, 2]);
  const mkMap = N => {
    const tiles = Array.from({ length: N * N }, () => ({ t: 2, road: 0, bld: null }));
    const at = (x, y) => tiles[y * N + x], inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
    const canPut = (x, y, sz) => { for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (!inb(x + dx, y + dy) || at(x + dx, y + dy).bld || at(x + dx, y + dy).road) return false; return true; };
    const put = (x, y, k, sz, ex) => { if (!canPut(x, y, sz)) return false; stamp(tiles, N, x, y, k, sz, ex); return true; };
    const nearRoad = sz => {   // 貼著某一格路的空地（footprint 的一邊碰到路）
      const rc = []; tiles.forEach((q, i) => { if (q.road) rc.push(i); });
      if (!rc.length) return null;
      for (let a = 0; a < 25; a++) {
        const i = pick(rc), rx = i % N, ry = (i / N) | 0, d = int(0, 3);
        const x = d === 0 ? rx - int(0, sz - 1) : d === 1 ? rx + 1 : d === 2 ? rx - int(0, sz - 1) : rx - sz, y = d === 0 ? ry - sz : d === 1 ? ry - int(0, sz - 1) : d === 2 ? ry + 1 : ry - int(0, sz - 1);
        if (canPut(x, y, sz)) return [x, y];
      }
      return null;
    };
    const line = (x, y, dx, dy, len) => { for (let s = 0; s < len && inb(x, y); s++, x += dx, y += dy) if (!at(x, y).bld) at(x, y).road = 1; };
    return { N, tiles, at, inb, canPut, put, nearRoad, line };
  };
  const fill = (mp, { nf, nb, facNear = .7, bldNear = .6 }) => {
    const { N, put, nearRoad } = mp, sc = Math.max(1, N * N / 900);   // 大圖多放一些
    nf = Math.round(nf * Math.sqrt(sc)); nb = Math.round(nb * sc);
    for (let q = 0; q < nf; q++) {
      const k = pick(FAC_KINDS), sz = facSize(k);
      const spot = (ch(facNear) ? nearRoad(sz) : null) ?? [int(0, N - sz), int(0, N - sz)];
      put(spot[0], spot[1], k, sz, { lv: 1, age: int(0, 30), pw: true });
    }
    for (let q = 0; q < nb; q++) {
      const sp = bldSpec(), spot = (ch(bldNear) ? nearRoad(sp.sz) : null) ?? [int(0, N - sp.sz), int(0, N - sp.sz)];
      put(spot[0], spot[1], sp.k, sp.sz, sp.ex);
    }
  };
  const FAM = {
    random(F) { const mp = mkMap(F ?? int(12, 36)), p = pick([.06, .12, .2, .3, .45]); for (const q of mp.tiles) if (ch(p)) q.road = 1; for (let q = 0, n = int(0, 3); q < n; q++) mp.line(int(0, mp.N - 1), int(0, mp.N - 1), pick([-1, 0, 1]), pick([-1, 0, 1]), int(3, 20)); fill(mp, { nf: int(0, 4), nb: int(6, 60) }); return mp; },
    grid(F) {
      const mp = mkMap(F ?? int(12, 36)), { N } = mp, sx = int(2, 6), sy = int(2, 6), ox = int(0, sx - 1), oy = int(0, sy - 1), cut = pick([0, .05, .12, .25]);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x % sx === ox || y % sy === oy) && !ch(cut)) mp.at(x, y).road = 1;
      if (ch(.3)) { const x0 = int(0, N - 3), y0 = int(0, N - 3); for (let y = y0; y < Math.min(N, y0 + int(1, 4)); y++) for (let x = x0; x < Math.min(N, x0 + int(1, 4)); x++) mp.at(x, y).road = 0; }
      fill(mp, { nf: int(1, 4), nb: int(10, 70) }); return mp;
    },
    long(F) {   // 長路：直線、蛇形、L 形、階梯；設施在起點，住宅沿路排到很遠（距離超過 12、18）
      const mp = mkMap(F ?? int(20, 40)), { N } = mp, v = pick(['row', 'snake', 'L', 'stairs']);
      if (v === 'row') mp.line(0, int(2, N - 3), 1, 0, N);
      else if (v === 'snake') { for (let y = 0; y < N; y += 2) mp.line(0, y, 1, 0, N); for (let y = 1; y < N; y += 2) mp.at(((y >> 1) % 2) ? 0 : N - 1, y).road = 1; }
      else if (v === 'L') { const y = int(2, N - 3), x = int(2, N - 3); mp.line(0, y, 1, 0, N); mp.line(x, 0, 0, 1, N); }
      else for (let s = 0; s < N * 2; s++) { const x = (s >> 1), y = (s + 1) >> 1; if (x < N && y < N) mp.at(x, y).road = 1; }
      const rc = []; mp.tiles.forEach((q, i) => { if (q.road) rc.push(i); });
      if (rc.length) { const i = rc[0], x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (mp.put(x + dx, y + dy, pick([8, 8, 62]), 1, { lv: 1, age: 0, pw: true })) break; }
      fill(mp, { nf: int(0, 1), nb: int(20, 70), facNear: .95, bldNear: .95 }); return mp;
    },
    twin() {   // 兩條平行路夾一排：一格的垃圾場、2×2 的設施同時貼兩段路（T452 把兩段合併成同一區）
      const N = int(10, 30), mp = mkMap(N), g = pick([2, 3, 3]), y1 = int(1, Math.max(1, N - g - 2)), y2 = y1 + g, x0 = int(0, 3), x1 = N - 1 - int(0, 3);
      for (let x = x0; x <= x1; x++) { if (ch(.95)) mp.at(x, y1).road = 1; if (y2 < N && ch(.95)) mp.at(x, y2).road = 1; }
      if (y2 < N && ch(.5)) { const x = ch(.5) ? x0 : x1; for (let y = y1; y <= y2; y++) mp.at(x, y).road = 1; }
      if (y2 < N && x1 - x0 > 3) {
        if (g === 2) { if (ch(.8)) mp.put(int(x0 + 1, x1 - 1), y1 + 1, pick([8, 8, 29, 88]), 1, { lv: 1, age: 0, pw: true }); }
        else if (ch(.85)) mp.put(int(x0 + 1, x1 - 2), y1 + 1, pick([62, 62, 88, 111, 8]), 2, { lv: 1, age: 0, pw: true });
      }
      fill(mp, { nf: int(0, 2), nb: int(6, 40) }); return mp;
    },
    mirror() {   // 上下對稱的兩個路網：兩區容量、需求、距離都一樣（平手的最壞區、平手的挑區）；有時左端連起來（同一區、平手的路格號）
      const H = int(6, 9), N = 2 * H + 1, mp = mkMap(N), x0 = int(0, 2), x1 = N - 1 - int(0, 2), fx = int(x0 + 1, x1 - 1), joined = ch(.4), gapHouses = ch(.5), lv = 3, den = pick([4, 5, 5]);   // 每區一排 lv3 高密度住宅，容量 30–40：一定過載
      for (let x = x0; x <= x1; x++) { mp.at(x, H - 1).road = 1; mp.at(x, H + 1).road = 1; }
      if (joined) mp.at(x0, H).road = 1;
      const fk = pick([8, 8, 29, 111]);
      for (const y of [H - 2, H + 2]) mp.put(fx, y, fk, 1, { lv: 1, age: 0, pw: true });
      for (let x = x0; x <= x1; x++) if (x !== fx && !(joined && x === x0)) if (ch(.9)) { for (const y of [H - 2, H + 2]) mp.put(x, y, 1, 1, { lv, den, v: 0, age: 0, pw: true, h: .6 }); }
      if (gapHouses) for (let x = x0 + 1; x <= x1; x++) if (ch(.4)) mp.put(x, H, 1, 1, { lv, den, v: 0, age: 0, pw: true, h: .6 });
      return mp;
    },
    dense(F) {   // 密集城：住宅塞滿路邊，負載遠超過 1、超過 2
      const mp = mkMap(F ?? int(20, 34)), { N } = mp, s = pick([3, 4]);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (x % s === 1 || y % s === 1) mp.at(x, y).road = 1;
      fill(mp, { nf: int(1, 3), nb: 0, facNear: 1 });
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (ch(.9)) mp.put(x, y, 1, 1, { lv: int(2, 3), den: int(3, 5), v: int(0, 11), age: int(0, 40), pw: ch(.92), h: resH() });
      fill(mp, { nf: 0, nb: int(0, 8) }); return mp;
    },
    tree(F) {   // 亂步走出來的死路與斷開的路網
      const mp = mkMap(F ?? int(12, 36)), { N } = mp;
      for (let q = 0, n = int(1, 5) * Math.max(1, Math.round(N * N / 900)); q < n; q++) { let x = int(0, N - 1), y = int(0, N - 1); for (let s = 0, len = int(4, 40); s < len; s++) { mp.at(x, y).road = 1; const d = int(0, 3); x = Math.min(N - 1, Math.max(0, x + (d === 0 ? 1 : d === 1 ? -1 : 0))); y = Math.min(N - 1, Math.max(0, y + (d === 2 ? 1 : d === 3 ? -1 : 0))); } }
      fill(mp, { nf: int(1, 4), nb: int(10, 60) }); return mp;
    },
    border() {   // 路通到圖邊；只有左右兩欄的變體：右欄最後一格與下一列第一格的索引相鄰（沒判右邊界就會誤併）
      const mp = mkMap(int(6, 26)), { N } = mp, v = pick(['cols', 'ring', 'edges']);
      if (v === 'cols') { mp.line(0, 0, 0, 1, N); mp.line(N - 1, 0, 0, 1, N); }
      else if (v === 'ring') { mp.line(0, 0, 1, 0, N); mp.line(0, N - 1, 1, 0, N); mp.line(0, 0, 0, 1, N); mp.line(N - 1, 0, 0, 1, N); }
      else for (let x = 0; x < N; x++) { if (ch(.8)) mp.at(x, 0).road = 1; if (ch(.8)) mp.at(x, N - 1).road = 1; if (ch(.4)) mp.at(0, x).road = 1; if (ch(.4)) mp.at(N - 1, x).road = 1; }
      fill(mp, { nf: int(0, 3), nb: int(6, 30), facNear: .9, bldNear: .9 }); return mp;
    },
    tiny() {   // 2–5 格見方的小圖；一半在原點（索引 0）放垃圾場或焚化廠（500 前的舊口徑從索引 0 掃起）並讓它貼路
      const mp = mkMap(int(2, 5)), { N } = mp; for (const q of mp.tiles) if (ch(.4)) q.road = 1;
      if (ch(.5)) {
        const sz = Math.min(N, pick([1, 2])), k = pick([8, 62, 29]);
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) mp.at(dx, dy).road = 0;
        mp.put(0, 0, k, sz, { lv: 1, age: 0, pw: true });
        if (sz < N) mp.at(sz, 0).road = 1;
      }
      fill(mp, { nf: int(0, 2), nb: int(1, 6) }); return mp;
    },
    dirty() {   // 路壓在建築底下（含多格建築的內部與 ref 格）：不合法的圖，兩邊照樣要一樣
      const mp = FAM.random(), N = mp.N; const spot = mp.nearRoad(2) ?? [int(0, N - 2), int(0, N - 2)];
      mp.put(spot[0], spot[1], pick([62, 88, 111, 8]), 2, { lv: 1, age: 0, pw: true });
      const idxs = []; mp.tiles.forEach((q, i) => { if (q.bld) idxs.push(i); });
      for (let q = 0, n = Math.min(idxs.length, int(2, 12)); q < n; q++) mp.tiles[pick(idxs)].road = 1;
      mp.tiles.forEach(q => { if (q.bld && !q.bld.ref && q.bld.sz > 1 && SAN.has(q.bld.k)) { const x = mp.tiles.indexOf(q) % N, y = (mp.tiles.indexOf(q) / N) | 0; for (let dy = 0; dy < q.bld.sz; dy++) for (let dx = 0; dx < q.bld.sz; dx++) if (ch(.5)) mp.at(x + dx, y + dy).road = 1; } });
      return mp;
    },
    legacy(k = 62) {   // 500 前的舊口徑：焚化廠（多格）的路只貼在 ref 格那一側；住宅沿路排到很遠（> 18）。k62 沒判 ref（實驗線 57701 的怪處），k8 有判——legacy8 是 2×2 的垃圾場（遊戲裡沒有，格式上合法）
      const N = int(24, 34), mp = mkMap(N), x = int(4, 8);
      mp.line(x, 0, 0, 1, N);
      mp.put(x - 2, int(0, 3), k, 2, { lv: 1, age: 0, pw: true });   // 佔 x-2、x-1 兩欄：右側那欄（ref 格）貼路，根格不貼
      for (let y = 0; y < N; y++) if (ch(.8)) mp.put(x + 1, y, 1, 1, { lv: int(1, 3), den: int(1, 5), v: 0, age: 0, pw: ch(.9), h: resH() });
      fill(mp, { nf: 0, nb: int(0, 12) }); return mp;
    },
    legacy8() { return FAM.legacy(8); },
    corner() {   // 圖的左上角（索引 0）是路，也是掃描序較後的設施的種子；掃描序較前的設施在右邊，兩邊平手於中間那一格（BFS 佇列起點 tail 錯了，來源就會記成後面那座）
      const N = int(5, 8), mp = mkMap(N), k1 = pick([8, 29, 88, 111]), k2 = pick([8, 29, 88, 111]);
      mp.line(0, 0, 1, 0, 3);
      mp.put(3, 0, k1, 1, { lv: 1, age: 0, pw: true });    // 根格索引 3（掃描序較前）：種子是 (2,0)
      mp.put(0, 1, k2, 1, { lv: 1, age: 0, pw: true });    // 根格索引 N：種子是 (0,0)
      for (const x of [1, 2]) mp.put(x, 1, 1, 1, { lv: int(1, 3), den: int(1, 5), v: 0, age: 0, pw: true, h: resH() });
      return mp;
    },
    big() { return FAM[pick(['random', 'grid', 'dense', 'long', 'tree'])](72); },   // 遊戲裡的 72×72
    epsilon() {   // 需求的浮點累加剛好落在容量之上 1e-9 之內（過載的容差），或剛好等於容量（負載正好 1，不算超載）：一排住宅照掃描順序累加（pop×.05 逐個加）
      const [fk, C] = pick([[8, 40], [111, 40], [29, 30], [88, 60]]), P = C * 20, N = 40, mp = mkMap(N), exact = ch(.5);
      let list = null;
      for (let tries = 0; tries < 60000 && !list; tries++) {
        const cand = []; let sum = 0;
        while (sum < P) { const p = pick(POP_OF); if (sum + p > P) break; cand.push(p); sum += p; }
        if (sum !== P) continue;
        let s = 0; for (const p of cand) s += p * .05 * 1;
        if (exact ? s === C : s > C && s <= C + 1e-9) list = cand;
      }
      mp.line(0, 2, 1, 0, N); mp.put(0, 3, fk, 1, { lv: 1, age: 0, pw: true });
      if (list) list.forEach((p, i) => mp.put(3 + i, 3, 1, 1, { lv: SPEC_OF_POP[p][0], den: SPEC_OF_POP[p][1], v: 0, age: 0, pw: true, h: .6 }));
      else fill(mp, { nf: 1, nb: 20 });
      mp.eps = !!list && !exact; mp.exact = !!list && exact; return mp;
    },
  };
  const out = [];
  for (let m = 0; m < CASES; m++) {
    const fam0 = FAM_ORDER[m % FAM_ORDER.length], fam = fam0 === 'big' && ((m / FAM_ORDER.length) | 0) % 2 ? 'dense' : fam0, mp = FAM[fam](), N = mp.N;   // 72×72 的貴，隔一輪才放一張
    out.push({ fam, N, tiles: mp.tiles, steps: fam === 'epsilon' ? int(2, 3) : fam === 'tiny' ? int(4, 7) : fam === 'big' ? int(2, 3) : int(3, 6), seed: 700000 + m, eps: !!mp.eps, exact: !!mp.exact });
  }
  return out;
}

// ================= 每一步：先照同一串亂數改圖（加減路、設施、建築、換電、改幸福），再各自算 =================
const clone = T => T.map(q => ({ ...q, bld: q.bld ? { ...q.bld, ...(q.bld.ref ? { ref: [...q.bld.ref] } : {}) } : null }));
const SAN = new Set([8, 29, 62, 88, 111]);
function rootsOf(T, pred) { const r = []; T.forEach((q, i) => { if (q.bld && !q.bld.ref && pred(q.bld)) r.push(i); }); return r; }
function clearBld(T, N, i) {
  const b = T[i].bld; if (!b || b.ref) return;
  const sz = Math.max(1, b.sz || 1), x = i % N, y = (i / N) | 0;
  for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (x + dx < N && y + dy < N) T[(y + dy) * N + x + dx].bld = null;
}
function roadComps(T, N) {   // 四鄰道路連通塊數（清運區數比它少＝設施貼多段路、T452 合併了）
  const lab = new Int32Array(N * N); let n = 0; const st = [];
  for (let i = 0; i < N * N; i++) if (T[i].road && !lab[i]) {
    lab[i] = ++n; st.push(i);
    while (st.length) { const c = st.pop(), x = c % N, y = (c / N) | 0; for (const j of [x > 0 ? c - 1 : -1, x < N - 1 ? c + 1 : -1, y > 0 ? c - N : -1, y < N - 1 ? c + N : -1]) if (j >= 0 && T[j].road && !lab[j]) { lab[j] = n; st.push(j); } }
  }
  return n;
}
// lab 可以是 null（只跑本線，指紋用）。direct＝另一組 {lab, mine}，跑直接呼叫 API 的抽查（不動主線那兩份的狀態）。onStep(rec) 回 false 就停
function runCase(c, lab, mine, onStep, direct = null) {
  const R = mulberry32(c.seed), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  const A = clone(c.tiles), B = clone(c.tiles), N = c.N, both = f => { f(A); f(B); };
  lab?.set(N, A); mine.set(N, B);
  if (lab) { const d0 = diffSnap(lab.snap(), mine.snap()) ?? (same(mine.extras(), [0, 0, 0, 0, 0]) ? null : `garbPen409／far／unserved／warn／penAvg 的初始值 ${J(mine.extras())}`); if (d0 && onStep({ c, s: -2, final: true, diff: `還沒推進的初始狀態不同：${d0}` }) === false) return false; }   // newSan 的初始值＝實驗線 emptySanStat445／emptySanAlloc452／新配的陣列
  const fixed = c.fam === 'epsilon' || c.fam === 'mirror';
  for (let s = 0; s < c.steps; s++) {
    for (let e = 0, ne = s === 0 ? 0 : int(0, 3); e < ne; e++) {
      const kind = pick(['road', 'line', 'fac+', 'fac-', 'bld+', 'bld-', 'pw', 'wa', 'h', 'road']);
      const p = { i: int(0, N * N - 1), len: int(3, 12), dx: pick([-1, 0, 1]), dy: pick([-1, 0, 1]), k: pick(FAC_KINDS), j: int(0, 99), r: R(), hh: int(0, 3) };
      if (kind === 'road') both(T => { if (!T[p.i].bld) T[p.i].road = T[p.i].road ? 0 : 1; });
      else if (kind === 'line') both(T => { let x = p.i % N, y = (p.i / N) | 0; for (let q = 0; q < p.len && x >= 0 && y >= 0 && x < N && y < N; q++, x += p.dx, y += p.dy) if (!T[y * N + x].bld) T[y * N + x].road = 1; });
      else if (kind === 'fac+' || kind === 'bld+') {
        const sz = kind === 'fac+' ? (p.k === 62 ? 2 : p.k === 8 ? 1 : 1 + (p.j & 1)) : (p.r < .7 ? 1 : 2), x = p.i % N, y = (p.i / N) | 0;
        let ok = x + sz <= N && y + sz <= N; for (let dy = 0; dy < sz && ok; dy++) for (let dx = 0; dx < sz && ok; dx++) if (A[(y + dy) * N + x + dx].bld) ok = false;
        if (ok) {
          const k = kind === 'fac+' ? p.k : (p.r < .7 ? 1 : p.r < .85 ? 3 : 33);
          const ex = kind === 'fac+' ? { lv: 1, age: 0, pw: true } : k === 1 ? { lv: 1 + (p.j % 3), den: 1 + (p.j % 5), v: 0, age: 0, pw: p.j % 5 !== 0, h: [.05, .06, .3, .7, 1][p.j % 5] } : { lv: 1 + (p.j % 3), v: 0, age: 0, pw: p.j % 4 !== 0 };
          both(T => stamp(T, N, x, y, k, sz, ex));
        }
      } else if (kind === 'fac-' || kind === 'bld-') {
        const r = rootsOf(A, b => kind === 'fac-' ? SAN.has(b.k) : !SAN.has(b.k));
        if (r.length) { const i = r[p.j % r.length]; both(T => clearBld(T, N, i)); }
      } else if (kind === 'pw') { const r = rootsOf(A, b => b.k === 1 || b.k === 2 || b.k === 3 || b.k === 127); if (r.length) { const i = r[p.j % r.length]; both(T => { T[i].bld.pw = !T[i].bld.pw; }); } }
      else if (kind === 'wa') { const r = rootsOf(A, b => b.k === 127); if (r.length) { const i = r[p.j % r.length]; both(T => { T[i].bld.wa = !T[i].bld.wa; }); } }
      else if (kind === 'h') both(T => { let n = 0; for (const q of T) if (q.bld && q.bld.k === 1) q.bld.h = [.05, .06, .5, 1, .3][(n++ + p.hh) % 5]; });
    }
    const order = []; for (let i = 0; i < N * N; i++) if (A[i].bld) order.push(i);
    // 人口：500 前後各一半；正好 499、500、501 都要有（>=、> 的差別）
    const formalWanted = c.fam === 'legacy' ? s > 1 && ch(.4) : (c.fam !== 'tiny' && s === 0 && (fixed || c.fam === 'dense' || c.fam === 'long' || c.fam === 'twin')) || ch(.5);
    const popv = formalWanted ? pick([500, 500, 501, 650, 2000, 2000, 5000, 100000]) : pick([0, 120, 499, 499, 30, 250]);
    let indJobs = 0; for (const i of order) { const b = A[i].bld; if (!b.ref && b.k === 3 && b.pw) indJobs += [0, 7, 20, 48][b.lv] || 0; }
    const jobsIv = pick([indJobs, indJobs, 0, 7, 48, 300, 5000]);
    const rb = mine.tick(popv, jobsIv, order), sb = mine.snap();
    if (!lab) { if (onStep({ c, s, pop: popv, jobsI: jobsIv, rb, sb }) === false) return false; continue; }
    const ra = lab.tick(popv, jobsIv, order), sa = lab.snap(), rec = { c, s, pop: popv, jobsI: jobsIv, ra, rb, sa, sb, N, diff: diffStep(sa, sb, ra, rb), probes: [], comps: roadComps(A, N) };
    if (!rec.diff) {   // 抽查：sanitationAt452（含建築卡的現算流程）、sanRoadSeeds445、sanAccessRoot445
      const pts = [];
      if (N <= 12) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) pts.push([x, y]);
      else {
        for (const i of order.slice(0, 20)) pts.push([i % N, (i / N) | 0]);
        for (let q = 0; q < 12; q++) pts.push([int(0, N - 1), int(0, N - 1)]);
      }
      pts.push([-1, 0], [N, N - 1], [0, -1], [N - 1, N]);
      const ui = mine.ui(popv);
      for (const [x, y] of pts) {
        const pa = lab.probe(x, y) ?? null, pb = mine.probe(x, y) ?? null;
        if (!same(pa, pb)) { rec.diff = `sanitationAt452(${x},${y})：${canon(pa).slice(0, 140)} ≠ ${canon(pb).slice(0, 140)}`; break; }
        const pu = ui(x, y) ?? null;
        if (!same(pa, pu)) { rec.diff = `建築卡現算的 sanitationAt452(${x},${y})：${canon(pa).slice(0, 140)} ≠ ${canon(pu).slice(0, 140)}`; break; }
        if (pa) rec.probes.push(pa.kind === 'building' ? pa.reason : pa.kind);
      }
      if (!rec.diff) {
        const ids = [-1, N * N, N * N + 3, ...order.slice(0, 14), int(0, N * N - 1), int(0, N * N - 1), int(0, N * N - 1)];
        for (const i of ids) {
          const xa = lab.seeds(i), xb = mine.seeds(i);
          if (!same(xa, xb)) { rec.diff = `sanRoadSeeds445(${i})：${J(xa)} ≠ ${J(xb)}`; break; }
          const ya = lab.access(i), yb = mine.access(i);
          if (!same(ya, yb)) { rec.diff = `sanAccessRoot445(${i})：${J(ya)} ≠ ${J(yb)}`; break; }
        }
      }
    }
    if (!rec.diff && direct && (c.seed + s) % 3 === 0) rec.diff = directChecks(N, A, B, popv, mulberry32(c.seed * 7 + s + 1), direct.lab, direct.mine);
    if (onStep(rec) === false) return false;
  }
  if (!lab) return true;
  // 整張格子最後逐項一樣（本線沒有偷改別的欄位）
  return onStep({ c, s: -1, final: true, diff: same(A, B) ? null : '結束時整張格子不同' }) !== false;
}
// 直接呼叫 API 的抽查（兩邊各用另一組實例、另一份格子拷貝）：只算 computeSanitation445（不準備負載）、computeGarbLocal（正式清運沒準備過負載就自己準備，實驗線 57712）、
// sanWasteOfRoot452（每一格、ref 格、空格、出界，回收係數 1／.85／NaN／未給）、狀態算好之後才加一座垃圾場或拆一棟建築再問 sanitationAt452（過期的狀態，兩邊的退路一樣）
function directChecks(N, A, B, popv, R2, lab, mine) {
  const int = (a, b) => a + Math.floor(R2() * (b - a + 1)), pick = a => a[Math.floor(R2() * a.length)];
  const A2 = clone(A), B2 = clone(B);
  lab.set(N, A2); mine.set(N, B2);
  const ca = lab.compute(popv), cb = mine.compute(popv);
  if (!same(ca, cb)) return `直接算 computeSanitation445(${popv}) 的回傳 ${canon(ca).slice(0, 120)} ≠ ${canon(cb).slice(0, 120)}`;
  let d = diffSnap(lab.snap(), mine.snap());
  if (d) return `只算 computeSanitation445（不準備負載）：${d}`;
  const ratio = pick([0, .5, 1, 1.3, 2]), ga = lab.gl(ratio), gb = mine.gl(ratio);
  if (!same(ga, gb)) return `直接算 computeGarbLocal(${ratio}) 的回傳 ${J(ga)} ≠ ${J(gb)}`;
  d = diffSnap(lab.snap(), mine.snap());
  if (d) return `直接算 computeGarbLocal(${ratio})：${d}`;
  const ids = [-1, N * N, N * N + 2];
  if (N <= 12) for (let i = 0; i < N * N; i++) ids.push(i); else for (let q = 0; q < 60; q++) ids.push(int(0, N * N - 1));
  A2.forEach((q, i) => { if (q.bld && ids.length < 140 && (q.bld.ref || i % 3 === 0)) ids.push(i); });
  for (const i of ids) for (const mul of [1, .85, NaN, undefined, 0]) {
    const wa = lab.waste(i, mul), wb = mine.waste(i, mul);
    if (!Object.is(wa, wb)) return `sanWasteOfRoot452(${i}, ${mul}) ${wa} ≠ ${wb}`;
  }
  // 過期的狀態：算好之後才加一座垃圾場／拆一棟建築，再問那一格
  const free = []; A2.forEach((q, i) => { if (!q.bld) free.push(i); });
  const roots = []; A2.forEach((q, i) => { if (q.bld && !q.bld.ref && !SAN.has(q.bld.k)) roots.push(i); });
  const at = [];
  if (free.length) { const i = pick(free); at.push(i); for (const T of [A2, B2]) stamp(T, N, i % N, (i / N) | 0, 8, 1, { lv: 1, age: 0, pw: true }); }
  if (roots.length) { const i = pick(roots); at.push(i); for (const T of [A2, B2]) clearBld(T, N, i); }
  for (const i of at) {
    const pa = lab.probe(i % N, (i / N) | 0) ?? null, pb = mine.probe(i % N, (i / N) | 0) ?? null;
    if (!same(pa, pb)) return `過期狀態問 sanitationAt452(${i % N},${(i / N) | 0})：${canon(pa).slice(0, 140)} ≠ ${canon(pb).slice(0, 140)}`;
  }
  return null;
}
const ARR = ['dist', 'src', 'active', 'net', 'garbLocal', 'hs', 'activeRoots', 'allRoots'];
const OBJ = ['scal', 'stat', 'districts', 'fmap', 'ralloc', 'alloc'];
function diffSnap(a, b) {
  for (const k of ARR) {
    const x = a[k], y = b[k];
    if (x.length !== y.length) return `${k} 長度 ${x.length} ≠ ${y.length}`;
    for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return `${k}[${i}] ${x[i]} ≠ ${y[i]}`;
  }
  for (const k of OBJ) if (!same(a[k], b[k])) return `${k}：${canon(a[k]).slice(0, 140)} ≠ ${canon(b[k]).slice(0, 140)}`;
  return null;
}
function diffStep(a, b, ra, rb) {
  if (!Object.is(ra.decision, rb.decision)) return `garbDecisionRatio452 ${ra.decision} ≠ ${rb.decision}`;
  if (!Object.is(ra.pen, rb.pen)) return `garbPen409 ${ra.pen} ≠ ${rb.pen}`;
  for (const k of ['far', 'unserved', 'warn', 'penAvg']) if (!Object.is(ra.loc[k], rb.loc[k])) return `${k} ${ra.loc[k]} ≠ ${rb.loc[k]}`;
  return diffSnap(a, b);
}

// 比一批：兩邊各自一份；stopAtFirst＝第一次不同就停（突變用）；例外算不同（改壞的碼丟例外＝抓到）
function compare(C, mkLab, mkMine, stopAtFirst = false) {
  const lab = mkLab(), mine = mkMine(), direct = { lab: mkLab(), mine: mkMine() };
  const cov = { steps: 0, cases: 0, diffs: 0, first: '', formal: 0, small: 0, offline: 0, multiSrc: 0, districts2: 0, merged: 0, overloaded: 0, load2: 0, dead: 0, noRoad: 0, far: 0, legacyFar: 0, warn: 0, unserved: 0, capPen: 0, legacyPen: 0, eps: 0, epsCases: 0, exact: 0, dirty: 0, big: 0, corner: 0, reasons: {} };
  try {
    for (let m = 0; m < C.length; m++) {
      const c = C[m]; cov.cases++;
      const go = runCase(c, lab, mine, rec => {
        if (rec.final) { if (rec.diff) { cov.diffs++; cov.first ||= `第 ${m} 張（${c.fam}）${rec.diff}`; } return !(rec.diff && stopAtFirst); }
        cov.steps++;
        if (rec.diff) { cov.diffs++; cov.first ||= `第 ${m} 張（${c.fam}）第 ${rec.s} 步（人口 ${rec.pop}）${rec.diff}`; return !stopAtFirst; }
        const sa = rec.sa, st = sa.stat, al = sa.alloc, loc = rec.ra.loc;
        if (st.formal) cov.formal++; else cov.small++;
        if (st.offlineFacilities > 0) cov.offline++;
        if (st.activeFacilities >= 2) cov.multiSrc++;
        if (sa.districts.length >= 2) cov.districts2++;
        if (sa.districts.length < rec.comps) cov.merged++;
        if (st.formal && al.overloadedDistricts > 0) cov.overloaded++;
        if (st.formal && sa.districts.some(q => Number.isFinite(q.load) && q.load > 2)) cov.load2++;
        if (st.formal && al.deadDemand > 0) cov.dead++;
        if (st.formal && al.noRoadDemand > 0) cov.noRoad++;
        if (loc.far > 0) { cov.far++; if (!st.formal) cov.legacyFar++; }
        if (st.formal && loc.warn > 0) cov.warn++;
        if (st.formal && loc.unserved > 0) cov.unserved++;
        if (st.formal && loc.penAvg > 0) cov.capPen++;
        if (!st.formal && sa.scal[2] > 1 && sa.scal[0] > 0) cov.legacyPen++;
        if (c.fam === 'dirty') cov.dirty++;
        if (c.fam === 'big') cov.big++;
        if (c.fam === 'corner') cov.corner++;
        if (st.formal && sa.districts.some(q => q.capacity > 0 && q.demand === q.capacity)) cov.exact++;
        if (c.eps) { cov.epsCases++; if (st.formal && sa.districts.some(q => q.capacity > 0 && q.demand > q.capacity && q.demand - q.capacity < 1e-9)) cov.eps++; }
        for (const r of rec.probes) cov.reasons[r] = (cov.reasons[r] || 0) + 1;
        return true;
      }, direct);
      if (go === false) break;
    }
  } catch (e) { cov.diffs++; cov.first ||= `丟例外：${String(e?.message ?? e).slice(0, 100)}`; }
  return cov;
}

// 本線輸出的指紋：每一步的距離、來源、分區、負載、garbLocal、b.h 的位元組（只跑本線）
function fingerprint(C) {
  const h = crypto.createHash('sha256'), mine = makeMine(), bytes = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  for (const c of C) runCase(c, null, mine, r => {
    const sb = r.sb;
    h.update(J([r.pop, r.jobsI, r.rb.decision, r.rb.pen, r.rb.loc, sb.scal, sb.stat, sb.districts, sb.fmap, sb.ralloc, sb.alloc].map(canon)));
    h.update(bytes(sb.dist)); h.update(bytes(sb.src)); h.update(bytes(sb.active)); h.update(bytes(sb.net)); h.update(bytes(sb.garbLocal));
    const f = new Float64Array(sb.hs.length), u = new Uint8Array(sb.hs.length);
    sb.hs.forEach((v, i) => { u[i] = v === undefined ? 1 : 0; f[i] = v === undefined ? 0 : v; });
    h.update(bytes(f)); h.update(bytes(u));
    return true;
  });
  return h.digest('hex');
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d020-garbage.json')), T = { ...S.text };

  // ---- 1. 出處 ----
  {
    const bad = [], got = (S.pieces ?? []).map(p => p.name);
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    if (J(got) !== J(PIECES)) bad.push(`段落 ${got.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
      if (!(p.line > 0 && p.endLine >= p.line) || typeof p.anchors?.start !== 'string' || !p.anchors.start.length) bad.push(`${p.name} 的行號或錨點`);
    }
    const lines = Object.fromEntries((S.pieces ?? []).map(p => [p.name, p.line]));
    for (const [k, v] of Object.entries(LINES)) if (lines[k] !== v) bad.push(`${k} 行號 ${lines[k]}（要 ${v}）`);
    // 常數：實驗線原文求值＝本線
    const K = makeLab(T).consts(), mineCap = garbageMod.SAN_CAP;
    if (K.SAN_FORMAL_POP445 !== garbageMod.SAN_FORMAL_POP || K.SAN_WARN_DIST445 !== garbageMod.SAN_WARN_DIST || K.SAN_LONG_DIST445 !== garbageMod.SAN_LONG_DIST || K.SAN_INF445 !== garbageMod.SAN_INF || K.DUMP_CAP !== garbageMod.DUMP_CAP) bad.push('SAN_* 常數跟本線不同');
    if (J(Object.keys(K.SAN_CAP445).sort()) !== J(Object.keys(mineCap).sort()) || Object.keys(mineCap).some(k => !Object.is(K.SAN_CAP445[k], mineCap[k]))) bad.push(`SAN_CAP ${J(K.SAN_CAP445)} ≠ ${J(mineCap)}`);
    // 對拍設定：三個回退開關在 FALLBACK_FLAGS 裡，清運的 rollback 開關不在（所以實驗線走新式清運）
    for (const f of Object.keys(LAB_WINDOW)) if (!FALLBACK_FLAGS.includes(f)) bad.push(`對拍設定沒開 ${f}`);
    for (const f of ['__legacySanitation445', '__legacySanitation452', '__noSanitationDistrict452']) if (FALLBACK_FLAGS.includes(f)) bad.push(`對拍設定開了 ${f}（清運會退回舊式）`);
    log(!bad.length, `D020 垃圾原文：實驗線 ${PINNED.slice(0, 7)} 的 ${PIECES.length} 段（新式清運 T445 37977–38028、T452 38047–38101、computeGarbLocal 57697–57722、tick 55256–55278、住宅人口鏈 39476–39480、企業層 39526–39577、事故 64520 等）sha256 逐段＝錨點記錄；SAN_* 常數與五種處理設施容量＝本線；對拍設定沒有開清運的 rollback（走新式清運）、開著住房／企業／事故三個回退開關（樁的依據）`,
      bad.join('；') || `${(S.pieces ?? []).length} 段；${Object.entries(LINES).slice(0, 6).map(([k, v]) => `${k} ${v}`).join('、')}…`);
  }

  // ---- 2. 清運逐項相等 ----
  const C = cases();
  const t0 = performance.now();
  const base = compare(C, () => makeLab(T), () => makeMine());
  const ms = performance.now() - t0;
  const need = { formal: 400, small: 400, offline: 100, multiSrc: 200, districts2: 300, merged: 80, overloaded: 80, load2: 30, dead: 100, noRoad: 100, far: 300, legacyFar: 200, warn: 100, unserved: 200, capPen: 100, legacyPen: 100, eps: 8, exact: 8, dirty: 40, big: 10, corner: 20 };
  const thin = Object.entries(need).filter(([k, v]) => !(base[k] >= v)).map(([k, v]) => `${k} ${base[k]}<${v}`);
  const reasons = ['ok', 'warn', 'far', 'capacity', 'dead-network', 'no-road', 'road', 'facility', 'tile'].filter(r => !base.reasons[r]);
  log(base.diffs === 0 && !thin.length && !reasons.length, `D020 驗收 2：清運逐項相等——實驗線原文在 vm 裡跟本線 garbage.ts 吃 ${C.length} 張隨機小圖 ${base.steps} 步（格狀、隨機、樹狀死路、通到圖邊、斷開的路網、長路、雙路夾一排、對稱雙區、密集城、72×72、路壓在建築下的髒圖；五種處理設施含多格與接不到路的；住宅、社宅、塔、巨廈、商工；人口 0–100000 含 499／500／501；連續多天中間加減路、設施、換電、改幸福）：垃圾量與容量與比例、每一格路的距離與來源與上線與否、sanStat445、清運區表、SAN_NET、facilityMap、rootAlloc、alloc、garbLocal（Float32 逐格）、每棟 b.h、far／unserved／warn／penAvg、評分用的比例每一步都相等；sanitationAt452（含建築卡現算的流程）與 sanRoadSeeds445／sanAccessRoot445 另抽查`,
    base.first || (thin.length ? `覆蓋不足：${thin.join('、')}` : reasons.length ? `抽查沒看過這些原因：${reasons.join('、')}` : `正式清運 ${base.formal} 步／500 前 ${base.small} 步；設施離線 ${base.offline}、多源 ${base.multiSrc}、多區 ${base.districts2}、合併 ${base.merged}；過載 ${base.overloaded}（負載超過 2：${base.load2}）、死路網 ${base.dead}、沒路 ${base.noRoad}；`
      + `離太遠 ${base.far}（500 前 ${base.legacyFar}）、警告 ${base.warn}、斷網 ${base.unserved}、超載扣分 ${base.capPen}、全城池扣分 ${base.legacyPen}；容差 ${base.eps}／${base.epsCases}（需求剛好等於容量 ${base.exact}）、髒圖 ${base.dirty}、72×72 ${base.big}、左上角 ${base.corner}；抽查原因 ${Object.entries(base.reasons).map(([k, v]) => `${k} ${v}`).join('、')}；${(ms / 1000).toFixed(1)} 秒`));

  // ---- 3. 注入錯誤要紅 ----
  {
    const { LAB_MUT, MINE_MUT, JOBS_MUT, EQUIV_LAB, EQUIV_MINE } = mutations();
    const missed = [], caught = [], src = read('src/sim/rules/garbage.ts'), jsrc = read('src/sim/rules/jobs.ts');
    const baseMine = loadMine(src), baseRun = compare(C.slice(0, 120), () => makeLab(T), () => makeMine(baseMine), true), baseOk = !baseRun.diffs;
    const probe = (name, mkLab, mkMine) => { const r = compare(C, mkLab, mkMine, true); (r.diffs ? caught : missed).push(name); };
    for (const [name, key, from, to] of LAB_MUT) {
      const parts = (T[key] ?? '').split(from);
      if (parts.length !== 2) { missed.push(`實驗線 ${name}：錨點在 ${key} 不是剛好一處（${parts.length - 1}）`); continue; }
      { const t2 = { ...T, [key]: parts.join(to) }; probe(`實驗線 ${name}`, () => makeLab(t2), () => makeMine()); }
    }
    for (const [name, from, to] of MINE_MUT) {
      const parts = src.split(from);
      if (parts.length !== 2) { missed.push(`本線 ${name}：錨點在 garbage.ts 不是剛好一處（${parts.length - 1}）`); continue; }
      { const m2 = loadMine(parts.join(to)); probe(`本線 ${name}`, () => makeLab(T), () => makeMine(m2)); }
    }
    for (const [name, from, to] of JOBS_MUT) {
      const parts = jsrc.split(from);
      if (parts.length !== 2) { missed.push(`本線 jobs.ts ${name}：錨點不是剛好一處（${parts.length - 1}）`); continue; }
      { const m2 = loadMine(src, loadJobs(parts.join(to))); probe(`本線 jobs.ts ${name}`, () => makeLab(T), () => makeMine(m2)); }
    }
    log(baseOk && !missed.length, `D020 注入錯誤要紅——實驗線原文 ${LAB_MUT.length} 個、本線 garbage.ts ${MINE_MUT.length} 個、本線 jobs.ts 住宅人口 ${JOBS_MUT.length} 個（常數、BFS 步長與方向、上線判斷、容量只算上線、union 方向與右邊界、不合併 frontage、挑區三層排序、最壞區平手、過載容差、垃圾產量、扣分幅度、clamp 上下限、k62 的 ref 判斷、pw 判斷、住宅人口鏈）都比出差異（沒改的本線原碼在 vm 裡載入先核過相等）`,
      !baseOk ? `沒改的 garbage.ts 在 vm 裡就不同：${baseRun.first}` : missed.length ? `沒抓到：${missed.join('、')}` : `${caught.length} 個全紅`);
    // 等價改動：實驗線與本線都看不出差異，逐一核對（不是守衛漏抓，是這些改動本來就不改任何輸出）；為了時間只跑第一輪（每種圖一張，不含 72×72）
    const sub = C.slice(0, FAM_ORDER.length - 1), eq = [], notEq = [];
    for (const [name, key, from, to] of EQUIV_LAB) { const parts = (T[key] ?? '').split(from); if (parts.length !== 2) { notEq.push(`實驗線 ${name}：錨點`); continue; } const t2 = { ...T, [key]: parts.join(to) }; (compare(sub, () => makeLab(t2), () => makeMine(), true).diffs ? notEq : eq).push(`實驗線 ${name}`); }
    for (const [name, from, to] of EQUIV_MINE) { const parts = src.split(from); if (parts.length !== 2) { notEq.push(`本線 ${name}：錨點`); continue; } const m2 = loadMine(parts.join(to)); (compare(sub, () => makeLab(T), () => makeMine(m2), true).diffs ? notEq : eq).push(`本線 ${name}`); }
    log(!notEq.length && eq.length === EQUIV_LAB.length + EQUIV_MINE.length, `D020 等價改動 ${eq.length} 個（${sub.length} 張圖）：並查集的 rank 與換根（union 只影響樹的深度，分區編號照掃描順序）、y+1<N 的邊界（型別陣列讀出界＝undefined）、負載 >1 改 >=1（差 0）、挑區的 d<0（路格一定有區）、死路網的 capacity<=0 與 dist>=INF（沒有上線設施的區每格距離都是 INF，有容量的區每格都到得了）、上線＝有 frontage、實驗線工業的 pw 判斷（enterpriseLegacyJobs489 已經判過）：這些改動實驗線與本線都不改任何輸出（逐一核對過）`,
      notEq.length ? `其實看得出差異或錨點壞了：${notEq.join('、')}` : eq.join('、'));
  }

  // ---- 4. 接線 ----
  await wiring(log);

  // ---- 5. 決定性 ----
  {
    const f1 = fingerprint(C), f2 = fingerprint(C);
    log(f1 === f2 && f1 === FINGERPRINT, `D020 決定性：同一批圖同一批人口連跑兩次，本線輸出（每一步的距離、來源、分區、負載、garbLocal、b.h 的位元組）逐位元組相同，並對上寫死的指紋（Node ${process.versions.node.split('.')[0]}；Node 22 與 24 都要對上）`,
      f1 !== f2 ? `兩次不同 ${f1.slice(0, 12)} ≠ ${f2.slice(0, 12)}` : f1 === FINGERPRINT ? f1.slice(0, 16) : `指紋 ${f1}（寫死的是 ${FINGERPRINT || '空'}）`);
  }
}

// ================= 突變 =================
function mutations() {
  // [名稱, 片段名, 原文, 改成]；原文在片段裡要剛好一處
  const LAB_MUT = [
    ['警告距離 12→13', 'SAN_FORMAL_POP445', 'SAN_WARN_DIST445=12', 'SAN_WARN_DIST445=13'],
    ['長距離 18→19', 'SAN_FORMAL_POP445', 'SAN_LONG_DIST445=18', 'SAN_LONG_DIST445=19'],
    ['正式清運人口 500→501', 'SAN_FORMAL_POP445', 'SAN_FORMAL_POP445=500', 'SAN_FORMAL_POP445=501'],
    ['不可達 65535→65534', 'SAN_FORMAL_POP445', 'SAN_INF445=65535', 'SAN_INF445=65534'],
    ['垃圾場容量 40→41', 'DUMP_CAP', 'DUMP_CAP=40;', 'DUMP_CAP=41;'],
    ['回收中心容量 ×.75→×.7', 'SAN_CAP445', '29:DUMP_CAP*.75', '29:DUMP_CAP*.7'],
    ['焚化容量 100→101', 'SAN_CAP445', '62:100', '62:101'],
    ['堆肥容量 60→61', 'SAN_CAP445', '88:60', '88:61'],
    ['資源回收容量 40→41', 'SAN_CAP445', '111:40', '111:41'],
    ['BFS 與 frontage 方向順序 上右→右上', 'DIRV', '[[0,-1],[1,0],[0,1],[-1,0]]', '[[1,0],[0,-1],[0,1],[-1,0]]'],
    ['BFS 步長 +1→+2', 'computeSanitation445', 'const nd=d+1;', 'const nd=d+2;'],
    ['BFS 佇列起點 tail 0→1（多出一格假的起點）', 'computeSanitation445', 'head=0,tail=0;', 'head=0,tail=1;'],
    ['BFS 少走一個方向（左）', 'computeSanitation445', 'for(const[dx,dy]of DIRV){const nx=cx+dx,ny=cy+dy;', 'for(const[dx,dy]of DIRV.slice(0,3)){const nx=cx+dx,ny=cy+dy;'],
    ['BFS 傳遞來源改記前一格', 'computeSanitation445', 'SAN_SRC445[j]=src;', 'SAN_SRC445[j]=cur;'],
    ['種子的來源記成 0', 'computeSanitation445', 'SAN_SRC445[j]=i;', 'SAN_SRC445[j]=0;'],
    ['上線旗標不設', 'computeSanitation445', 'SAN_ACTIVE445[i]=1;', ''],
    ['上線設施清單不記', 'computeSanitation445', 'sanActiveRoots445.push(i);', ''],
    ['各種類上線數 +1→+2', 'computeSanitation445', 'activeByK[b.k]=(activeByK[b.k]||0)+1;', 'activeByK[b.k]=(activeByK[b.k]||0)+2;'],
    ['斷網客戶不計', 'computeSanitation445', '}else unservedClients++;', '}'],
    ['接不到路的設施也算上線', 'computeSanitation445', 'const seeds=sanRoadSeeds445(i);if(!seeds.length)continue;', 'const seeds=sanRoadSeeds445(i);'],
    ['正式清運容量改算全部（不只上線的）', 'computeSanitation445', 'effectiveCap=formal?activeCap:totalCap', 'effectiveCap=totalCap'],
    ['正式清運 >= 改 >', 'computeSanitation445', 'pop>=SAN_FORMAL_POP445', 'pop>SAN_FORMAL_POP445'],
    ['長距離客戶 > 改 >=', 'computeSanitation445', 'a.dist>SAN_LONG_DIST445', 'a.dist>=SAN_LONG_DIST445'],
    ['sanRoadSeeds 不去重', 'sanRoadSeeds445', '||out.includes(j))continue;', ')continue;'],
    ['sanRoadSeeds 只看 footprint 第一欄', 'sanRoadSeeds445', 'for(let fx=0;fx<sz;fx++)', 'for(let fx=0;fx<1;fx++)'],
    ['sanRoadSeeds 忽略 sz', 'sanRoadSeeds445', 'sz=Math.max(1,b.sz||1)', 'sz=1'],
    ['sanAccessRoot 不把 ref 換成根', 'sanAccessRoot445', 'if(b.ref)rootIdx=idx(b.ref[0],b.ref[1]);', ''],
    ['union 少了縱向', 'rebuildSanitationDistricts452', 'if(y+1<N&&SAN_PARENT452[i+N]>=0)sanUnion452(i,i+N);', ''],
    ['union 沒判右邊界（換行相連）', 'rebuildSanitationDistricts452', 'if(x+1<N&&SAN_PARENT452[i+1]>=0)', 'if(SAN_PARENT452[i+1]>=0)'],
    ['union 只看縱向不看橫向', 'rebuildSanitationDistricts452', 'if(x+1<N&&SAN_PARENT452[i+1]>=0)sanUnion452(i,i+1);', ''],
    ['union 不設 parent', 'sanUnion452', 'SAN_PARENT452[b]=a;', ''],
    ['不合併 frontage', 'rebuildSanitationDistricts452', 'for(let k=1;k<f.length;k++)sanUnion452(f[0],f[k]);', ''],
    ['設施容量門檻 cap>.01→cap>50', 'rebuildSanitationDistricts452', 'cap>.01', 'cap>50'],
    ['設施容量不進區', 'rebuildSanitationDistricts452', 'q.capacity+=cap;', ''],
    ['事故可用率 1→.5', 'assetAvailability493', '!incidents493.length)return 1;', '!incidents493.length)return .5;'],
    ['負載 Infinity→大數', 'prepareSanitationLoad452', '(q.demand>0?Infinity:0)', '(q.demand>0?1e9:0)'],
    ['過載容差 +1e-9 拿掉', 'prepareSanitationLoad452', 'q.demand>q.capacity+1e-9', 'q.demand>q.capacity'],
    ['過載要有容量 拿掉', 'prepareSanitationLoad452', 'q.capacity>0&&q.demand>q.capacity+1e-9', 'q.demand>q.capacity+1e-9'],
    ['最壞區平手 > 改 >=', 'prepareSanitationLoad452', 'if(q.load>worstLoad)', 'if(q.load>=worstLoad)'],
    ['需求 <=0 改 <0', 'prepareSanitationLoad452', 'if(demand<=0)continue;', 'if(demand<0)continue;'],
    ['挑區：最近改最遠', 'sanRootDistrictChoice452', 'cand.sort((a,b)=>a.dist-b.dist||', 'cand.sort((a,b)=>b.dist-a.dist||'],
    ['挑區平手：區號小改大', 'sanRootDistrictChoice452', '||a.district-b.district||', '||b.district-a.district||'],
    ['挑區再平手：路格號小改大', 'sanRootDistrictChoice452', '||a.road-b.road);', '||b.road-a.road);'],
    ['住宅垃圾 .05→.06', 'sanWasteOfRoot452', 'residentPopulation488(rootIdx,b)*.05', 'residentPopulation488(rootIdx,b)*.06'],
    ['工業垃圾 .08→.09', 'sanWasteOfRoot452', "'employed')*.08", "'employed')*.09"],
    ['社宅不算垃圾', 'sanWasteOfRoot452', 'b.k===127||', ''],
    ['巨廈不算垃圾', 'sanWasteOfRoot452', '||b.k===105)w=', ')w='],
    ['評分比例：最壞區取 max 改 min', 'garbDecisionRatio452', 'Math.max(garbRatio,w.load)', 'Math.min(garbRatio,w.load)'],
    ['評分比例：死路網 max(…,2) 改 1', 'garbDecisionRatio452', 'Math.max(garbRatio,2)', 'Math.max(garbRatio,1)'],
    ['全城比例上限 clamp 2→3', 'tickGarbage', 'clamp(garbage/garbCap,0,2)', 'clamp(garbage/garbCap,0,3)'],
    ['沒容量的比例 2→1', 'tickGarbage', ':2; // 全城 aggregate', ':1; // 全城 aggregate'],
    ['居民垃圾 .05→.06', 'tickGarbage', '(pop*.05+', '(pop*.06+'],
    ['工業垃圾（tick）.08→.09', 'tickGarbage', ':jobsI)*.08)', ':jobsI)*.09)'],
    ['全城池扣分 .15→.16', 'tickGarbage', 'const pen=(garbRatio-1)*.15;', 'const pen=(garbRatio-1)*.16;'],
    ['全城池扣分要比例 >1 改 >2', 'tickGarbage', 'garbage>0&&garbRatio>1', 'garbage>0&&garbRatio>2'],
    ['成熟城平均扣分不記', 'tickGarbage', 'garbPen409=garbLoc445.penAvg||0;', 'garbPen409=0;'],
    ['500 前：距離 >18 改 >19', 'computeGarbLocal', 'if(bd>18)', 'if(bd>19)'],
    ['500 前：扣分 .045→.046', 'computeGarbLocal', 'b.h=clamp(b.h-.045,.05,1);far409++;}else garbLocal[i]=garbRatio;', 'b.h=clamp(b.h-.046,.05,1);far409++;}else garbLocal[i]=garbRatio;'],
    ['500 前：垃圾場只認 k8 不認 k62 的 ref 格', 'computeGarbLocal', '(!b.ref&&b.k===8)||b.k===62', '(!b.ref&&b.k===8)||(!b.ref&&b.k===62)'],
    ['500 前：k8 不判 ref', 'computeGarbLocal', '(!b.ref&&b.k===8)||b.k===62', '(b.k===8)||b.k===62'],
    ['500 前：鄰路距離 min 改 max', 'computeGarbLocal', 'bd=Math.min(bd,dist[j])', 'bd=Math.max(bd,dist[j])'],
    ['500 前：garbLocal +.3→+.31', 'computeGarbLocal', 'garbLocal[i]=clamp(garbRatio+.3,0,2);b.h=clamp(b.h-.045,.05,1);far409++;}else garbLocal[i]=garbRatio;', 'garbLocal[i]=clamp(garbRatio+.31,0,2);b.h=clamp(b.h-.045,.05,1);far409++;}else garbLocal[i]=garbRatio;'],
    ['500 起：離太遠扣分 .045→.046', 'computeGarbLocal', 'localRatio+.3,0,2);b.h=clamp(b.h-.045,.05,1);far409++;}', 'localRatio+.3,0,2);b.h=clamp(b.h-.046,.05,1);far409++;}'],
    ['500 起：斷網扣分 .06→.07', 'computeGarbLocal', 'garbLocal[i]=2;b.h=clamp(b.h-.06,.05,1);unserved445++;continue;', 'garbLocal[i]=2;b.h=clamp(b.h-.07,.05,1);unserved445++;continue;'],
    ['500 起：超載扣分 .15→.16', 'computeGarbLocal', '(q.load-1)*.15', '(q.load-1)*.16'],
    ['500 起：局部比例上限 2→3', 'computeGarbLocal', 'clamp(q.load,0,2)', 'clamp(q.load,0,3)'],
    ['500 起：幸福下限 .05→.04', 'computeGarbLocal', 'b.h=clamp(b.h-capPen,.05,1)', 'b.h=clamp(b.h-capPen,.04,1)'],
    ['500 起：警告距離 > 改 >=', 'computeGarbLocal', 'if(st.dist>SAN_WARN_DIST445)warn445++', 'if(st.dist>=SAN_WARN_DIST445)warn445++'],
    ['500 起：社宅也扣幸福', 'computeGarbLocal', 'if(!b||b.k!==1){garbLocal[i]=0;continue;}const st=sanitationAt452', 'if(!b||(b.k!==1&&b.k!==127)){garbLocal[i]=0;continue;}const st=sanitationAt452'],
    ['建築卡：離太遠 > 改 >=', 'sanitationAt452', 'else if(pick.dist>SAN_LONG_DIST445)reason', 'else if(pick.dist>=SAN_LONG_DIST445)reason'],
    ['建築卡：警告 > 改 >=', 'sanitationAt452', 'else if(pick.dist>SAN_WARN_DIST445)reason', 'else if(pick.dist>=SAN_WARN_DIST445)reason'],
    ['建築卡：設施上線判斷', 'sanitationAt452', 'active:!!(f&&f.online)', 'active:true'],
    ['建築卡：超載門檻 >1 改 >1.5', 'sanitationAt452', 'else if(q.load>1)reason', 'else if(q.load>1.5)reason'],
    ['建築卡：超載 >1 改 >=1（負載正好 1）', 'sanitationAt452', 'else if(q.load>1)reason', 'else if(q.load>=1)reason'],
    ['客戶少一種（商業塔 k34）', 'isSanClient445', '||k===34', ''],
    ['住宅要有電 拿掉', 'residentEligible488', 'if(b.k===1)return !!(b.pw&&!b.sick&&!b.death);', 'if(b.k===1)return !!(!b.sick&&!b.death);'],
    ['住宅生病也算人口', 'residentEligible488', 'if(b.k===1)return !!(b.pw&&!b.sick&&!b.death);', 'if(b.k===1)return !!(b.pw&&!b.death);'],
    ['社宅人口 76→77', 'SOCIAL_HOUSING_POP', 'SOCIAL_HOUSING_POP=76', 'SOCIAL_HOUSING_POP=77'],
    ['住宅塔人口倍率 1.15→1.16', 'TOWER_MULT', 'TOWER_MULT=1.15', 'TOWER_MULT=1.16'],
    ['工業就業表 lv1 7→8', 'JOBSI', 'JOBSI=[0,7,', 'JOBSI=[0,8,'],
  ];
  const MINE_MUT = [
    ['警告距離 12→13', 'SAN_WARN_DIST = 12', 'SAN_WARN_DIST = 13'],
    ['長距離 18→19', 'SAN_LONG_DIST = 18', 'SAN_LONG_DIST = 19'],
    ['正式清運人口 500→501', 'SAN_FORMAL_POP = 500', 'SAN_FORMAL_POP = 501'],
    ['不可達 65535→65534', 'SAN_INF = 65535', 'SAN_INF = 65534'],
    ['垃圾場容量 40→41', 'export const DUMP_CAP = 40;', 'export const DUMP_CAP = 41;'],
    ['回收中心容量 ×.75→×.7', '29: DUMP_CAP * .75', '29: DUMP_CAP * .7'],
    ['焚化容量 100→101', '62: 100', '62: 101'],
    ['堆肥容量 60→61', '88: 60', '88: 61'],
    ['資源回收容量 40→41', '111: 40', '111: 41'],
    ['BFS 與 frontage 方向順序 上右→右上', '[[0, -1], [1, 0], [0, 1], [-1, 0]]', '[[1, 0], [0, -1], [0, 1], [-1, 0]]'],
    ['BFS 步長 +1→+2', 'const nd = d + 1;', 'const nd = d + 2;'],
    ['BFS 佇列起點 tail 0→1（多出一格假的起點）', 'head = 0, tail = 0;', 'head = 0, tail = 1;'],
    ['BFS 少走一個方向（左）', 'for (const [dx, dy] of DIRV) {\n      const nx = cx + dx, ny = cy + dy;', 'for (const [dx, dy] of DIRV.slice(0, 3)) {\n      const nx = cx + dx, ny = cy + dy;'],
    ['BFS 傳遞來源改記前一格', 'san.src[j] = src;', 'san.src[j] = cur;'],
    ['種子的來源記成 0', 'san.src[j] = i;', 'san.src[j] = 0;'],
    ['上線旗標不設', 'san.active[i] = 1;', ''],
    ['上線設施清單不記', 'san.activeRoots.push(i);', ''],
    ['各種類上線數 +1→+2', 'activeByK[b.k] = (activeByK[b.k] || 0) + 1;', 'activeByK[b.k] = (activeByK[b.k] || 0) + 2;'],
    ['斷網客戶不計', '} else unservedClients++;', '}'],
    ['接不到路的設施也算上線', 'if (!seeds.length) continue;', ''],
    ['正式清運容量改算全部（不只上線的）', 'effectiveCap = formal ? activeCap : totalCap', 'effectiveCap = totalCap'],
    ['正式清運 >= 改 >', 'pop >= SAN_FORMAL_POP', 'pop > SAN_FORMAL_POP'],
    ['長距離客戶 > 改 >=', 'a.dist > SAN_LONG_DIST', 'a.dist >= SAN_LONG_DIST'],
    ['sanRoadSeeds 不去重', 'if (!w.tiles[j].road || out.includes(j)) continue;', 'if (!w.tiles[j].road) continue;'],
    ['sanRoadSeeds 只看 footprint 第一欄', 'for (let fx = 0; fx < sz; fx++)', 'for (let fx = 0; fx < 1; fx++)'],
    ['sanRoadSeeds 忽略 sz', 'sz = Math.max(1, b.sz || 1)', 'sz = 1'],
    ['sanAccessRoot 不把 ref 換成根', 'if (b.ref) { const r = b.ref as [number, number]; rootIdx = idx(w, r[0], r[1]); }', ''],
    ['union 少了縱向', 'if (y + 1 < N && san.parent[i + N] >= 0) sanUnion(san, i, i + N);', ''],
    ['union 沒判右邊界（換行相連）', 'if (x + 1 < N && san.parent[i + 1] >= 0)', 'if (san.parent[i + 1] >= 0)'],
    ['union 只看縱向不看橫向', 'if (x + 1 < N && san.parent[i + 1] >= 0) sanUnion(san, i, i + 1);', ''],
    ['union 不設 parent', 'san.parent[b] = a;', ''],
    ['不合併 frontage', 'for (let k = 1; k < f.length; k++) sanUnion(san, f[0], f[k]);', ''],
    ['設施容量門檻 cap>.01→cap>50', 'cap > .01', 'cap > 50'],
    ['設施容量不進區', 'q.capacity += cap;', ''],
    ['事故可用率 1→.5', 'cap = baseCap * 1;', 'cap = baseCap * .5;'],
    ['負載 Infinity→大數', '(q.demand > 0 ? Infinity : 0)', '(q.demand > 0 ? 1e9 : 0)'],
    ['過載容差 +1e-9 拿掉', 'q.demand > q.capacity + 1e-9', 'q.demand > q.capacity'],
    ['過載要有容量 拿掉', 'q.capacity > 0 && q.demand > q.capacity + 1e-9', 'q.demand > q.capacity + 1e-9'],
    ['最壞區平手 > 改 >=', 'if (q.load > worstLoad)', 'if (q.load >= worstLoad)'],
    ['需求 <=0 改 <0', 'if (demand <= 0) continue;', 'if (demand < 0) continue;'],
    ['挑區：最近改最遠', 'cand.sort((a, b) => a.dist - b.dist ||', 'cand.sort((a, b) => b.dist - a.dist ||'],
    ['挑區平手：區號小改大', '|| a.district - b.district ||', '|| b.district - a.district ||'],
    ['挑區再平手：路格號小改大', '|| a.road - b.road);', '|| b.road - a.road);'],
    ['住宅垃圾 .05→.06', 'residentPopulation488(b, () => undefined) * .05', 'residentPopulation488(b, () => undefined) * .06'],
    ['工業垃圾 .08→.09', '(JOBSI[b.lv] || 0) * .08', '(JOBSI[b.lv] || 0) * .09'],
    ['工業不看有電', 'else if (b.k === 3 && b.pw)', 'else if (b.k === 3)'],
    ['社宅不算垃圾', 'b.k === 127 || b.k === 33', 'b.k === 33'],
    ['巨廈不算垃圾', '|| b.k === 105) x =', ') x ='],
    ['評分比例：最壞區取 max 改 min', 'Math.max(garbRatio, w.load)', 'Math.min(garbRatio, w.load)'],
    ['評分比例：死路網 max(…,2) 改 1', 'Math.max(garbRatio, 2)', 'Math.max(garbRatio, 1)'],
    ['全城比例上限 clamp 2→3', 'clamp(san.garbage / san.garbCap, 0, 2)', 'clamp(san.garbage / san.garbCap, 0, 3)'],
    ['沒容量的比例 2→1', ' : 2;             // 55260', ' : 1;             // 55260'],
    ['居民垃圾 .05→.06', '(pop * .05 + jobsI * .08)', '(pop * .06 + jobsI * .08)'],
    ['工業垃圾（step）.08→.09', '(pop * .05 + jobsI * .08)', '(pop * .05 + jobsI * .09)'],
    ['全城池扣分 .15→.16', 'const pen = (san.garbRatio - 1) * .15;', 'const pen = (san.garbRatio - 1) * .16;'],
    ['全城池扣分要比例 >1 改 >2', 'san.garbage > 0 && san.garbRatio > 1', 'san.garbage > 0 && san.garbRatio > 2'],
    ['成熟城平均扣分不記', 'if (local) san.garbPen409 = gl.penAvg || 0;', ''],
    ['500 前：距離 >18 改 >19', 'if (bd > 18)', 'if (bd > 19)'],
    ['500 前：扣分 .045→.046', 'b.h = clamp((b.h as number) - .045, .05, 1); far409++; } else gl[i] = garbRatio;', 'b.h = clamp((b.h as number) - .046, .05, 1); far409++; } else gl[i] = garbRatio;'],
    ['500 前：垃圾場只認 k8 不認 k62 的 ref 格', '((!b.ref && b.k === 8) || b.k === 62)', '((!b.ref && b.k === 8) || (!b.ref && b.k === 62))'],
    ['500 前：k8 不判 ref', '((!b.ref && b.k === 8) || b.k === 62)', '((b.k === 8) || b.k === 62)'],
    ['500 前：鄰路距離 min 改 max', 'bd = Math.min(bd, dist[j])', 'bd = Math.max(bd, dist[j])'],
    ['500 前：garbLocal +.3→+.31', 'gl[i] = clamp(garbRatio + .3, 0, 2); b.h = clamp((b.h as number) - .045', 'gl[i] = clamp(garbRatio + .31, 0, 2); b.h = clamp((b.h as number) - .045'],
    ['500 起：離太遠扣分 .045→.046', 'gl[i] = clamp(localRatio + .3, 0, 2); b.h = clamp((b.h as number) - .045, .05, 1); far409++; }', 'gl[i] = clamp(localRatio + .3, 0, 2); b.h = clamp((b.h as number) - .046, .05, 1); far409++; }'],
    ['500 起：斷網扣分 .06→.07', 'gl[i] = 2; b.h = clamp((b.h as number) - .06, .05, 1); unserved445++; continue;', 'gl[i] = 2; b.h = clamp((b.h as number) - .07, .05, 1); unserved445++; continue;'],
    ['500 起：超載扣分 .15→.16', '(q.load - 1) * .15', '(q.load - 1) * .16'],
    ['500 起：局部比例上限 2→3', 'clamp(q.load, 0, 2)', 'clamp(q.load, 0, 3)'],
    ['500 起：幸福下限 .05→.04', 'b.h = clamp((b.h as number) - capPen, .05, 1)', 'b.h = clamp((b.h as number) - capPen, .04, 1)'],
    ['500 起：警告距離 > 改 >=', 'if (sd > SAN_WARN_DIST) warn445++', 'if (sd >= SAN_WARN_DIST) warn445++'],
    ['500 起：社宅也扣幸福', 'if (!b || b.k !== 1) { gl[i] = 0; continue; }\n    const st = sanitationAt452', 'if (!b || (b.k !== 1 && b.k !== 127)) { gl[i] = 0; continue; }\n    const st = sanitationAt452'],
    ['建築卡：離太遠 > 改 >=', 'else if (pick.dist > SAN_LONG_DIST) reason', 'else if (pick.dist >= SAN_LONG_DIST) reason'],
    ['建築卡：警告 > 改 >=', 'else if (pick.dist > SAN_WARN_DIST) reason', 'else if (pick.dist >= SAN_WARN_DIST) reason'],
    ['建築卡：設施上線判斷', 'active: !!(f && f.online)', 'active: true'],
    ['建築卡：超載門檻 >1 改 >1.5', 'else if (q.load > 1) reason', 'else if (q.load > 1.5) reason'],
    ['建築卡：超載 >1 改 >=1（負載正好 1）', 'else if (q.load > 1) reason', 'else if (q.load >= 1) reason'],
    ['客戶少一種（商業塔 k34）', '|| k === 34', ''],
  ];
  const JOBS_MUT = [
    ['住宅要有電 拿掉', 'if (b.k === 1) return !!(b.pw && !b.sick && !b.death);', 'if (b.k === 1) return !!(!b.sick && !b.death);'],
    ['住宅生病也算人口', 'if (b.k === 1) return !!(b.pw && !b.sick && !b.death);', 'if (b.k === 1) return !!(b.pw && !b.death);'],
    ['社宅人口 76→77', 'SOCIAL_HOUSING_POP = 76', 'SOCIAL_HOUSING_POP = 77'],
    ['工業就業表 lv1 7→8', 'JOBSI = [0, 7,', 'JOBSI = [0, 8,'],
  ];
  // 等價改動（輸出不會變的）：理由見 log 那一行
  const EQUIV_LAB = [
    ['並查集不加 rank', 'sanUnion452', 'if(ra===rb)SAN_RANK452[a]++;', ''],
    ['並查集不換根', 'sanUnion452', 'if(ra<rb){const t=a;a=b;b=t;ra=rb;}', ''],
    ['union 不判下邊界 y+1<N', 'rebuildSanitationDistricts452', 'if(y+1<N&&SAN_PARENT452[i+N]>=0)', 'if(SAN_PARENT452[i+N]>=0)'],
    ['負載 >1 改 >=1', 'computeGarbLocal', 'q.load>1?(q.load-1)*.15:0', 'q.load>=1?(q.load-1)*.15:0'],
    ['挑區不略過 d<0', 'sanRootDistrictChoice452', 'if(d<0)continue;', ''],
    ['死路網 capacity<=0 改 <0', 'prepareSanitationLoad452', 'if(q.capacity<=0||pick.dist>=SAN_INF445)a.deadDemand+=demand;', 'if(q.capacity<0||pick.dist>=SAN_INF445)a.deadDemand+=demand;'],
    ['死路網 dist>=INF 改 >', 'prepareSanitationLoad452', 'if(q.capacity<=0||pick.dist>=SAN_INF445)a.deadDemand+=demand;', 'if(q.capacity<=0||pick.dist>SAN_INF445)a.deadDemand+=demand;'],
    ['上線＝有 frontage（不看 SAN_ACTIVE445）', 'rebuildSanitationDistricts452', 'on=!!SAN_ACTIVE445[root]&&f.length>0&&cap>.01', 'on=f.length>0&&cap>.01'],
    ['工業不看外層的 pw（enterpriseLegacyJobs489 已判）', 'sanWasteOfRoot452', 'else if(b.k===3&&b.pw)', 'else if(b.k===3)'],
  ];
  const EQUIV_MINE = [
    ['並查集不加 rank', 'if (ra === rb) san.rank[a]++;', ''],
    ['並查集不換根', 'if (ra < rb) { const t = a; a = b; b = t; ra = rb; }', ''],
    ['union 不判下邊界 y+1<N', 'if (y + 1 < N && san.parent[i + N] >= 0)', 'if (san.parent[i + N] >= 0)'],
    ['負載 >1 改 >=1', 'const localRatio = clamp(q.load, 0, 2), capPen = q.load > 1 ?', 'const localRatio = clamp(q.load, 0, 2), capPen = q.load >= 1 ?'],
  ];
  return { LAB_MUT, MINE_MUT, JOBS_MUT, EQUIV_LAB, EQUIV_MINE };
}

// ================= 接線 =================
// 在預建城與各城的格子上補幾座處理設施（貼路的空地，第 frac 個候選處）；給接線守衛用，不走建造規則
function addFac(s, k, sz, frac) {
  const w = s.w, N = w.N, spots = [], free = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !w.tiles[y * N + x].bld && !w.tiles[y * N + x].road;
  for (let y = 0; y + sz <= N; y++) for (let x = 0; x + sz <= N; x++) {
    let ok = true; for (let dy = 0; dy < sz && ok; dy++) for (let dx = 0; dx < sz && ok; dx++) if (!free(x + dx, y + dy)) ok = false;
    if (!ok) continue;
    let touch = false;
    for (let d = 0; d < sz && !touch; d++) for (const [xx, yy] of [[x + d, y - 1], [x + d, y + sz], [x - 1, y + d], [x + sz, y + d]]) if (xx >= 0 && yy >= 0 && xx < N && yy < N && w.tiles[yy * N + xx].road) { touch = true; break; }
    if (touch) spots.push([x, y]);
  }
  if (!spots.length) throw new Error('找不到貼路的空地');
  const [x, y] = spots[Math.floor(spots.length * frac)];
  w.tiles[y * N + x].bld = { k, lv: 1, v: 0, age: 0, pw: true, h: 1, ...(sz > 1 ? { sz } : {}) };
  for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) w.tiles[(y + dy) * N + x + dx].bld = { k, lv: 0, v: 0, age: 0, ref: [x, y] };
}
async function wiring(log) {
  const day = read('src/sim/day.ts'), bad = [], count = (t, sub) => t.split(sub).length - 1;
  const CALL = 'garbageStep(w, s.san ??= newSan(N), pop, jobsI, tickBld);', DEC = 'garbRatio: garbDecisionRatio452(s.san!)';
  if (count(day, CALL) !== 1) bad.push(`day.ts 要剛好一處「${CALL}」（${count(day, CALL)} 處）`);
  if (count(day, DEC) !== 1) bad.push(`day.ts 結算要剛好一處「${DEC}」（${count(day, DEC)} 處）`);
  if (/garbRatio:\s*2\b/.test(day)) bad.push('結算還有寫死的 garbRatio: 2');
  if (!day.includes("import { garbageStep, garbDecisionRatio452, newSan, type SanState } from './rules/garbage.ts';")) bad.push('day.ts 沒有照樣 import garbage.ts');
  const anchors = ['jobsI = Math.max(0, Math.round(jobsI));', CALL, 'if (n1) cityHappy = s1 / n1;', 'const labor = laborMarket481(', 'const settle = settleToday('], pos = anchors.map(a => day.indexOf(a));
  if (pos.some(p => p < 0) || pos.some((p, i) => i && p <= pos[i - 1])) bad.push(`順序要是 jobsI 定案 → 垃圾（55256）→ 只用住宅 k1 重算城市幸福（55282）→ 勞動力（55329）→ 結算（56117）：${pos.join('、')}`);
  log(!bad.length, 'D020 接線（原文）：day.ts 逐字呼叫 garbageStep(w, s.san ??= newSan(N), pop, jobsI, tickBld)，在 jobsI 定案（55251）之後、城市幸福重算（55282）與勞動力（55329）之前；結算的垃圾比例逐字讀 garbDecisionRatio452(s.san!)（56117），沒有殘留的 garbRatio: 2',
    bad.join('；') || anchors.map((a, i) => `${a.slice(0, 22)}@${pos[i]}`).join(' → '));

  // 動態：stepDay 真的推進幾天。s.san 的存取攔截（每天第一次讀＝垃圾那一行，此時的格子存起來），直接呼叫 garbageStep 的結果要＝s.san＝沒攔截的另一份模擬
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const loadSim = (id, seed) => { const code = read(`src/content/samples/${id}.code.txt`).trim(), L = loadCode(seed ? codeWithSeed(code, seed) : code, KT, vrank); if (!L.ok) throw new Error(`${id} 讀不進來：${L.note ?? L.error}`); return L.sim; };
  const SC = [
    { name: '預建城（沒有處理設施：小城比例 2、全城池扣分）', days: 3, make: () => loadSim('d011-prebuilt', 5162026) },
    { name: '預建城＋垃圾場×2', days: 5, make: () => { const s = loadSim('d011-prebuilt', 5162026); addFac(s, 8, 1, .3); addFac(s, 8, 1, .8); return s; } },
    { name: 'AI 城（原有 2 座垃圾場）', days: 4, make: () => loadSim('ai120') },
    { name: 'AI 城＋回收中心、焚化（2×2）', days: 3, make: () => { const s = loadSim('ai120'); addFac(s, 29, 1, .4); addFac(s, 62, 2, .7); return s; } },
    { name: '種子城＋垃圾場、焚化（2×2）、堆肥、資源回收', days: 3, make: () => { const s = loadSim('seed516'); addFac(s, 8, 1, .2); addFac(s, 62, 2, .6); addFac(s, 88, 1, .9); addFac(s, 111, 2, .4); return s; } },
    { name: '種子城（沒有處理設施）', days: 2, make: () => loadSim('seed516') },
    { name: '樣張城（每種一棟、沒有路）', days: 2, make: () => loadSim('gallery') },
  ];
  const bad2 = [], notes = [], seen = { formal: 0, small: 0, cap: 0, unserved: 0, far: 0, over: 0, days: 0 };
  for (const sc of SC) {
    const sA = sc.make(), sB = sc.make(), N = sA.w.N, real = garbageMod.newSan(N), sD = garbageMod.newSan(N);
    let calls = 0, cap = null;
    const capture = w => ({ tiles: w.tiles.map(q => ({ road: q.road, bld: q.bld ? { ...q.bld } : null })), order: w.tiles.flatMap((q, i) => q.bld ? [i] : []) });
    Object.defineProperty(sB, 'san', { configurable: true, get() { if (calls++ === 0) cap = capture(sB.w); return real; }, set() { throw new Error('day.ts 不該重新指定 s.san'); } });
    const row = [];
    for (let d = 1; d <= sc.days; d++) {
      calls = 0; cap = null;
      const tag = `${sc.name} 第 ${d} 天`;
      let ra, rb;
      try { ra = stepDay(sA); rb = stepDay(sB); } catch (e) { bad2.push(`${tag}：stepDay 丟例外：${String(e?.message ?? e).slice(0, 100)}`); break; }
      seen.days++;
      if (J(ra) !== J(rb)) { bad2.push(`${tag}：攔截 s.san 之後的日報不同`); break; }
      if (!sA.san || sA.san.n !== N) { bad2.push(`${tag}：沒有 s.san（??= newSan(N) 沒跑）`); break; }
      if (calls < 2 || !cap) { bad2.push(`${tag}：s.san 讀了 ${calls} 次（垃圾一次、結算一次，至少 2）`); break; }
      // 55246：pop＝有電的住宅＋住宅塔＋巨廈（塔、巨廈的居民不看電）；日報的 pop 至少要含塔與巨廈
      const towers = cap.tiles.reduce((a, q) => a + (q.bld && !q.bld.ref && (q.bld.k === 33 || q.bld.k === 105) ? jobsMod.residentPopulation488(q.bld, () => undefined) : 0), 0);
      if (rb.pop < towers) { bad2.push(`${tag}：日報的人口 ${rb.pop} 少於住宅塔與巨廈的居民 ${towers}`); break; }
      const dw = { N, tiles: cap.tiles }, dr = garbageMod.garbageStep(dw, sD, rb.pop, rb.jobsI, cap.order);
      const hsOf = (tiles, has) => tiles.map((q, i) => has[i].bld ? q.bld.h : undefined);
      const sn = { real: snapOf(real, sB.w.tiles), direct: snapOf(sD, cap.tiles), plain: snapOf(sA.san, sA.w.tiles) };
      sn.real.hs = hsOf(sB.w.tiles, cap.tiles);   // 呼叫當下就在的建築（之後長出來的不算）：模擬跑完的 b.h ＝ 直接呼叫後的 b.h
      const d1 = diffSnap(sn.real, sn.direct), d2 = diffSnap(snapOf(real, sB.w.tiles), sn.plain);
      if (d1) { bad2.push(`${tag}：s.san／b.h 跟直接呼叫 garbageStep（人口 ${rb.pop}、工業就業 ${rb.jobsI}）不同：${d1}`); break; }
      if (d2) { bad2.push(`${tag}：攔截的那份跟沒攔截的那份不同：${d2}`); break; }
      // 55282–55284：垃圾扣完幸福之後，城市幸福只用住宅 k1 重算（垃圾要排在它前面）
      { let s1 = 0, n1 = 0; for (const i of cap.order) { const b = cap.tiles[i].bld; if (b && b.k === 1) { s1 += b.h; n1++; } } if (n1 && !Object.is(rb.cityHappy, s1 / n1)) { bad2.push(`${tag}：日報的城市幸福 ${rb.cityHappy} ≠ 垃圾扣完之後住宅 k1 的平均 ${s1 / n1}`); break; } }
      const r1 = garbageMod.garbDecisionRatio452(real), r2 = garbageMod.garbDecisionRatio452(sA.san);
      if (!Object.is(r1, dr) || !Object.is(r2, dr)) { bad2.push(`${tag}：評分用的比例 ${r1}／${r2}／直接 ${dr}`); break; }
      const st = real.stat;
      if (st.formal) seen.formal++; else seen.small++;
      if (st.effectiveCap > 0) seen.cap++;
      if (real.unserved > 0) seen.unserved++;
      if (real.far > 0) seen.far++;
      if (real.alloc.overloadedDistricts > 0) seen.over++;
      row.push(`${st.formal ? '正式' : '小城'}人口 ${rb.pop}、容量 ${st.effectiveCap}、比例 ${dr.toFixed(2)}`);
    }
    notes.push(`${sc.name}：${row.join('；')}`);
  }
  if (!seen.formal || !seen.small || !seen.cap || !seen.unserved || !seen.far || !seen.over) bad2.push(`覆蓋不足（正式 ${seen.formal}、小城 ${seen.small}、有容量 ${seen.cap}、斷網 ${seen.unserved}、離太遠 ${seen.far}、過載 ${seen.over}）`);
  log(!bad2.length, `D020 接線（stepDay 實跑）：${SC.length} 座城共 ${seen.days} 天，攔截 s.san 取得垃圾那一行當下的格子，直接呼叫 garbageStep（人口、工業就業取日報的）的整份狀態（距離、來源、分區、負載、garbLocal）與 b.h 逐位＝s.san＝沒攔截的另一份模擬，評分用的比例相同；每天讀 s.san 至少兩次（垃圾、結算）`,
    bad2.slice(0, 3).join('；') || `正式清運 ${seen.formal} 天／小城 ${seen.small} 天；有容量 ${seen.cap}、斷網 ${seen.unserved}、離太遠 ${seen.far}、過載 ${seen.over} 天；${notes.join('｜')}`);
}
