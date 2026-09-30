// D029 Node 守衛：夜間城市（T487）——輸入、結算、犯罪乘數逐項＝實驗線原文（驗收 1、2 的公式半邊，含突變）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d029-night.json（tools/lab-night.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；兩個種類集合跟本線相同；
//   2. 逐項＝實驗線：實驗線原文（prepareNightInputs487、finalizeNightCity487、nightCrimeMul487）在 vm 裡，跟本線 src/sim/rules/nightcity.ts 吃同一批隨機輸入
//      （隨機的路〔等級、公車站、鐵路、電車〕、建築種類與邊長與 ref 格、警察局與派出所覆蓋、購買力、貨物供給率、遊客、失業率、公交乘客、政策四項；含 0、缺、NaN、負數、超出夾限的值）：
//      輸入 12 欄、結算的 lighting／commerce／transit／safety／finance 每一個數、happinessDelta、grade、policies、犯罪乘數（含夜市加成、沒算過＝1）逐位 Object.is 相等；每一支分支至少發生過（覆蓋守衛）；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（每個係數、每個集合成員、每個夾限、每個取位、路級權重表、min(9, …)），沒改的先核過全等。
//      永遠碰不到的夾限（幸福加減的 −.012／.014、活力的 1.25、犯罪乘數的 .72／1.20、安全分數的 0）是等價突變，不列；守衛用資料量它們真的碰不到（公式上：安全分數 ∈ [.07, 1]、活力 ≤ 1.2272、幸福加減 ∈ [−.0111, .0112]、犯罪乘數 ∈ [.80, 1.18]）。
//   接線、存檔、實驗線頁面實跑：見 tools/unit-d029-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as NC from '../src/sim/rules/nightcity.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  clamp: 'clamp', emptyNightInputs487: 'emptyNightInputs487', emptyNightCity487: 'emptyNightCity487', NIGHT_ENTERTAIN_K487: 'NIGHT_ENTERTAIN_K487', NIGHT_TRANSIT_K487: 'NIGHT_TRANSIT_K487',
  prepareNightInputs487: 'prepareNightInputs487', nightCrimeMul487: 'nightCrimeMul487', finalizeNightCity487: 'finalizeNightCity487',
  happyNightItem: '住宅幸福的夜間城市項（前一日）', tickCall: '每天結算的呼叫（災禍段之後、收稅之前）', commerceGold: '晚間消費金進收入與商業稅（當天的）', financeUse: '夜間運輸收入與營運費（當天的）',
  crimeUse: '犯罪抽籤的夜間乘數（前一日）', reset: '讀檔與新圖歸零',
};   // text 的鍵 → 樣本 pieces 的名字（照樣本裡的順序）

export async function d029Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D029 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

const KDATA = JSON.parse(read('src/content/lab-kinds.json'));
const CATS = Object.fromEntries(KDATA.kinds.map(r => [r.k, r.cat]));
const byCat = c => KDATA.kinds.filter(r => r.cat === c).map(r => r.k);
export const catFn = k => CATS[k] || 'S';   // 實驗線 kcatOf＝KCB[k]||'S'（37275；本線內容表 186 種逐種一致，見 tools/unit.mjs 的分類守衛）

// ---- 實驗線那一邊：原文在 vm 裡（三個函式共用同一批全域）。樁：T471 電力調度沒有（power471 空＝路燈的 connected、served 恆 0，回退設定）、沒有電力分區 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`let N=1,tiles=[],tickRoad=[],tickBld=[],COV={},day=0,pol=null,power471=null,powerDistricts450=[],POWER_DIST450=null,CATS={};
const window={};
const kcatOf=k=>CATS[k]||'S';
${T.clamp}
${T.emptyNightInputs487}
${T.emptyNightCity487}
let nightInputs487=emptyNightInputs487(),nightCity487=emptyNightCity487(),nightDistrictRate487=new Float32Array(0);
${T.NIGHT_ENTERTAIN_K487}
${T.NIGHT_TRANSIT_K487}
${T.prepareNightInputs487}
${T.nightCrimeMul487}
${T.finalizeNightCity487}
globalThis.__set=o=>{N=o.N;tiles=o.tiles;tickRoad=o.tickRoad;tickBld=o.tickBld;COV=o.cov;day=o.day;pol=o.pol;CATS=o.cats;nightCity487=emptyNightCity487();};
globalThis.__prep=()=>prepareNightInputs487();
globalThis.__fin=o=>{prepareNightInputs487();return finalizeNightCity487(o);};
globalThis.__crime=(i,b)=>nightCrimeMul487(i,b);
globalThis.__empty=()=>({inputs:emptyNightInputs487(),city:emptyNightCity487()});
globalThis.__sets=()=>({ent:[...NIGHT_ENTERTAIN_K487],trn:[...NIGHT_TRANSIT_K487]});`, ctx, { filename: 'lab:night' });
  return {
    set: c => ctx.__set({ N: c.N, tiles: c.tiles, tickRoad: c.tickRoad, tickBld: c.tickBld, cov: c.cov, day: c.day, pol: c.pol, cats: CATS }),
    prep: () => ctx.__prep(), fin: o => ctx.__fin(o), crime: (i, b) => ctx.__crime(i, b), empty: () => ctx.__empty(), sets: () => ctx.__sets(),
  };
}
// 本線
const world = c => ({ N: c.N, tiles: c.tiles });
const mineInputs = (M, c) => M.prepareNightInputs(world(c), c.tickRoad, c.tickBld, catFn, c.day, c.pol);
const roadsOf = c => c.tickRoad.filter(i => c.tiles[i] && c.tiles[i].road).length;   // 日常路徑裡 tickRoad 只有道路格，兩者相同；隨機城會塞雜物，所以數真的路
const mineFinal = (M, c, o) => M.finalizeNightCity(mineInputs(M, c), o, M.nightPoliceCoverage(world(c), c.tickBld, catFn, c.cov), roadsOf(c), c.day, c.pol);
const policedAt = (c, i) => !!((c.cov.police && c.cov.police[i] > 0) || (c.cov.police2 && c.cov.police2[i] > 0));

// 兩個值第一個不同的路徑（說明用）：數字用 Object.is（分得出 0 與 −0、NaN）
const deepDiff = (a, b, skip = [], p = '') => {
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) ? null : `${p} 實驗線 ${a}≠本線 ${b}`;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (skip.includes(k)) continue; const r = deepDiff(a[k], b[k], skip, `${p}.${k}`); if (r) return r; }
    return null;
  }
  return Object.is(a, b) ? null : `${p} 實驗線 ${J(a)}≠本線 ${J(b)}`;
};

// ---- 隨機輸入：邊界都要碰到 ----
function makeCases(count = 3200) {
  const R = mulberry32(20261601), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  const ENT = [...NC.NIGHT_ENTERTAIN], TRN = [...NC.NIGHT_TRANSIT];
  const pools = Object.fromEntries('RCIESHDTAGFW'.split('').map(c => [c, byCat(c)]));
  const flag = () => pick([undefined, false, true, 0, 1]), out = [];
  // 三種世界：一般；空曠（沒路、沒民生、沒運輸設施、沒站＝路燈規劃 0＝覆蓋 1，活力與安全分數才碰得到高處）；繁忙（大商場、大娛樂設施、很多站與很多乘客，運輸收入與營運費才不會四捨五入成 0）
  const bareKinds = KDATA.kinds.filter(r => 'RCIEFW'.includes(r.cat) && !TRN.includes(r.k)).map(r => r.k);
  for (let m = 0; m < count; m++) {
    const mode = pick(['normal', 'normal', 'normal', 'bare', 'busy']);
    const N = int(6, 14), nn = N * N, tiles = Array.from({ length: nn }, () => ({ t: 2, bld: null }));
    const roadP = mode === 'bare' ? 0 : mode === 'busy' ? pick([.2, .35, .5]) : pick([0, .05, .2, .35, .5]), bldN = mode === 'busy' ? int(20, 40) : pick([0, int(1, 4), int(3, 20), int(10, 40)]);
    for (let i = 0; i < nn; i++) if (ch(roadP)) { const t = tiles[i]; t.road = 1; t.rc = pick([undefined, 0, 1, 2, 3, 4, 5, 5, 6, 7, -1]); if (ch(mode === 'busy' ? .3 : .15)) t.bus = 1; if (ch(mode === 'busy' ? .2 : .1)) t.rail = 1; if (ch(.06)) t.tram = 1; }
    for (let q = 0; q < bldN; q++) {
      const i = int(0, nn - 1); if (tiles[i].bld || tiles[i].road) continue;
      const g = mode === 'bare' ? 'bare' : mode === 'busy' ? pick(['C', 'C', 'ent', 'ent', 'ent', 'trn', 'I', 'A', 'R']) : pick(['R', 'R', 'C', 'C', 'C', 'I', 'E', 'S', 'H', 'D', 'T', 'A', 'A', 'G', 'G', 'F', 'W', 'ent', 'ent', 'trn']);
      const k = g === 'bare' ? pick(bareKinds) : g === 'ent' ? pick(ENT) : g === 'trn' ? pick(TRN) : pick(pools[g]);
      const b = { k, lv: int(1, 5), v: 0, age: 10, pw: true, h: .6, sz: mode === 'busy' ? pick([2, 3, 4, 5]) : pick([undefined, 0, 1, 1, 1, 1, 2, 2, 3, 4, 5]) };
      if (ch(.07)) b.ref = [0, 0];
      tiles[i].bld = b;
    }
    const tickRoad = [], tickBld = [];
    for (let i = 0; i < nn; i++) { if (tiles[i].road) tickRoad.push(i); if (tiles[i].bld) tickBld.push(i); }
    if (ch(.15)) { for (let q = int(1, 4); q > 0; q--) tickRoad.push(int(0, nn + 3)); tickRoad.sort((a, b) => a - b); }   // 雜物：非路格、出界的索引（實驗線 if(!t||!t.road)continue）
    if (ch(.15)) { for (let q = int(1, 4); q > 0; q--) tickBld.push(int(0, nn + 3)); tickBld.sort((a, b) => a - b); }
    const pc = pick([0, .3, .6, 1]), arr = () => Uint8Array.from({ length: nn }, () => ch(pc) ? int(1, 3) : 0);
    const cov = { police: ch(.12) ? undefined : arr(), police2: ch(.4) ? undefined : arr() };
    const pol = pick([null, null, {}, { nightMarket: true }, { parkNight: true }, { curfew: true }, { freeTransit: true }, { nightMarket: true, curfew: true }, { nightMarket: true, parkNight: true },
      { curfew: true, parkNight: true, freeTransit: true }, { nightMarket: flag(), parkNight: flag(), curfew: flag(), freeTransit: flag() }, { nightMarket: flag(), parkNight: flag(), curfew: flag(), freeTransit: flag() }]);
    const o = mode === 'busy' ? {
      purchasingPower: pick([1, 1.2, 1.45, 1.9, R() * 2]), goodsSupply: pick([.7, 1, R()]), transitRidership: pick([800, 2000, 5000, int(500, 4000)]), tourists: pick([300, 900, 3000, int(100, 2000)]), unemployment: pick([0, .05, .3, R()]),
    } : {
      purchasingPower: pick([undefined, 0, .3, .45, .8, 1, 1.2, 1.45, 1.9, NaN, R() * 2]), goodsSupply: pick([undefined, 0, .2, .7, 1, 1.4, R(), R()]),
      transitRidership: pick([0, 0, undefined, NaN, -5, 30, 200, 900, int(0, 2000)]), tourists: pick([0, 0, undefined, -200, int(1, 60), int(60, 900), R() * 3000]),
      unemployment: pick([0, 0, undefined, NaN, .05, .3, 1, 1.4, -.1, R(), R()]),
    };
    const crime = []; for (let q = 0; q < 6; q++) { const i = int(0, nn - 1); crime.push([i, pick([tiles[i].bld, { k: 2, lv: 1 }, { k: 2, lv: 3 }, { k: 1, lv: 1 }, null, undefined])]); }
    out.push({ N, tiles, tickRoad, tickBld, cov, day: int(1, 400), pol, o, crime });
  }
  return out;
}
let CASES = [];

// ---- 比對 ----
function compareAll(T, M, stopAtFirst = false) {
  const st = { steps: 0, diffs: 0, first: '', cnt: {}, ext: { maxAct: -Infinity, minSafe: Infinity, maxSafe: -Infinity, minHd: Infinity, maxHd: -Infinity, minCm: Infinity, maxCm: -Infinity, minCrime: Infinity, maxCrime: -Infinity } };
  const bump = (k, v = 1) => { if (v) st.cnt[k] = (st.cnt[k] ?? 0) + v; };
  const miss = what => { st.diffs++; if (!st.first) st.first = what; return stopAtFirst; };
  const lab = makeLab(T);
  // 空狀態、集合
  {
    const e = lab.empty(), a = deepDiff(e.inputs, M.emptyNightInputs()), b = deepDiff(e.city, M.emptyNightCity(), ['saveSchemaChanged']);
    if (a && miss(`空的輸入 ${a}`)) return st; if (b && miss(`空的夜間城市 ${b}`)) return st;
    const s = lab.sets(); if (J(s.ent) !== J([...M.NIGHT_ENTERTAIN]) && miss(`娛樂設施集合 實驗線 ${J(s.ent)}≠本線 ${J([...M.NIGHT_ENTERTAIN])}`)) return st;
    if (J(s.trn) !== J([...M.NIGHT_TRANSIT]) && miss(`運輸設施集合 實驗線 ${J(s.trn)}≠本線 ${J([...M.NIGHT_TRANSIT])}`)) return st;
  }
  for (const [n, c] of CASES.entries()) {
    st.steps++;
    lab.set(c);
    // 沒算過：犯罪乘數 1（讀檔與新圖之後第 1 天）
    { const [i, b] = c.crime[0], x = lab.crime(i, b), y = M.nightCrimeMul(M.emptyNightCity(), policedAt(c, i), b, c.pol); if (!Object.is(x, y) && miss(`第 ${n} 組 沒算過的犯罪乘數 實驗線 ${x}≠本線 ${y}`)) return st; bump('crimeNotReady'); }
    const a = lab.prep(), d0 = deepDiff(a, mineInputs(M, c));
    if (d0 && miss(`第 ${n} 組 輸入 ${d0}`)) return st;
    const af = lab.fin(c.o), bf = mineFinal(M, c, c.o), d1 = deepDiff(af, bf, ['saveSchemaChanged']);
    if (d1 && miss(`第 ${n} 組 結算 ${d1}`)) return st;
    for (const [i, b] of c.crime) {
      const x = lab.crime(i, b), y = M.nightCrimeMul(bf, policedAt(c, i), b, c.pol);
      if (!Object.is(x, y) && miss(`第 ${n} 組 犯罪乘數 格 ${i} 實驗線 ${x}≠本線 ${y}`)) return st;
      bump('crimeReady'); bump(policedAt(c, i) ? 'crimePoliced' : 'crimeNotPoliced'); bump(b && b.k === 2 && c.pol && c.pol.nightMarket ? 'crimeMarket' : 'crimeNoMarket'); bump(b === null || b === undefined ? 'crimeNoBld' : 'crimeBld');
      bump(b && b.k === 2 && !(c.pol && c.pol.nightMarket) ? 'crimeCommerceNoMarket' : 'crimeOther'); st.ext.minCrime = Math.min(st.ext.minCrime, x); st.ext.maxCrime = Math.max(st.ext.maxCrime, x);
    }
    // 覆蓋
    const nm = !!(c.pol && c.pol.nightMarket), cf = !!(c.pol && c.pol.curfew), pn = !!(c.pol && c.pol.parkNight), ft = !!(c.pol && c.pol.freeTransit), q = af;
    bump(nm ? 'nmOn' : 'nmOff'); bump(cf ? 'cfOn' : 'cfOff'); bump(pn ? 'pnOn' : 'pnOff'); bump(ft ? 'ftOn' : 'ftOff'); bump(nm && cf ? 'nmAndCf' : 'notBoth'); bump(c.pol === null ? 'polNull' : 'polObj');
    bump(q.lighting.totalRoads === 0 ? 'roadsNone' : 'roadsSome'); bump(a.transitNodes > 0 ? 'nodes' : 'noNodes');
    let bus = 0, rail = 0, tram = 0, rcLow = 0, rcHigh = 0, rcNeg = 0, rcMissing = 0;
    for (const i of c.tickRoad) { const t = c.tiles[i]; if (!t || !t.road) continue; if (t.bus) bus++; if (t.rail) rail++; if (t.tram) tram++; if (!t.rc) rcMissing++; else if (t.rc < 0) rcNeg++; else if (t.rc > 5) rcHigh++; }
    bump('bus', bus > 0 ? 1 : 0); bump('rail', rail > 0 ? 1 : 0); bump('tram', tram > 0 ? 1 : 0); bump('railTram', rail > 0 && tram > 0 ? 1 : 0); bump('rcMissing', rcMissing > 0 ? 1 : 0); bump('rcNeg', rcNeg > 0 ? 1 : 0); bump('rcHigh', rcHigh > 0 ? 1 : 0);
    let ref = 0, big = 0, szMiss = 0, szZero = 0, tb = 0, tbBig = 0, entBld = 0, catN = {}, junkR = 0, junkB = 0;
    for (const i of c.tickRoad) if (!c.tiles[i] || !c.tiles[i].road) junkR++;
    for (const i of c.tickBld) {
      const t = c.tiles[i], b = t && t.bld; if (!b) { junkB++; continue; } if (b.ref) { ref++; continue; }
      const cat = catFn(b.k), sz = b.sz; catN[cat] = (catN[cat] ?? 0) + 1; if (sz >= 4) big++; if (sz === undefined) szMiss++; if (sz === 0) szZero++;
      if (M.NIGHT_TRANSIT.has(b.k)) { tb++; if (sz >= 2) tbBig++; } if (M.NIGHT_ENTERTAIN.has(b.k)) entBld++;
    }
    bump('refCells', ref > 0 ? 1 : 0); bump('sz4plus', big > 0 ? 1 : 0); bump('szMissing', szMiss > 0 ? 1 : 0); bump('szZero', szZero > 0 ? 1 : 0); bump('transitBld', tb > 0 ? 1 : 0); bump('transitBldBig', tbBig > 0 ? 1 : 0); bump('entBld', entBld > 0 ? 1 : 0);
    bump('junkRoad', junkR > 0 ? 1 : 0); bump('junkBld', junkB > 0 ? 1 : 0);
    for (const k of 'RCIESHDTAGFW') bump('cat' + k, catN[k] ? 1 : 0);
    const pc = q.safety.policeCoverage; let targets = 0; for (const i of c.tickBld) { const b = c.tiles[i] && c.tiles[i].bld; if (b && !b.ref && (catFn(b.k) === 'R' || catFn(b.k) === 'C' || M.NIGHT_ENTERTAIN.has(b.k))) targets++; }
    bump('policeNoTargets', targets === 0 ? 1 : 0); bump('policeNone', targets > 0 && pc === 0 ? 1 : 0); bump('policeAll', targets > 0 && pc === 1 ? 1 : 0); bump('policePartial', pc > 0 && pc < 1 ? 1 : 0);
    bump('policeUndef', !c.cov.police ? 1 : 0); bump('police2Undef', !c.cov.police2 ? 1 : 0);
    { let only2 = 0; for (const i of c.tickBld) { const b = c.tiles[i] && c.tiles[i].bld; if (b && !b.ref && (catFn(b.k) === 'R' || catFn(b.k) === 'C' || M.NIGHT_ENTERTAIN.has(b.k)) && !(c.cov.police && c.cov.police[i] > 0) && c.cov.police2 && c.cov.police2[i] > 0) only2++; } bump('police2Only', only2 > 0 ? 1 : 0); }
    const dem = q.transit.demand, cap = q.transit.capacity;
    bump(dem === 0 ? 'demand0' : 'demandPos'); bump(dem > 0 && cap > dem ? 'capGt' : 'capNotGt'); bump(dem > 0 && cap < dem && cap > 0 ? 'capLt' : 'capNotLt'); bump(dem > 0 && cap === dem ? 'capEq' : 'capNotEq'); bump(dem > 0 && cap === 0 ? 'capZero' : 'capNotZero');
    bump(q.transit.service === 1 && dem === 0 ? 'serviceByNoDemand' : 'serviceOther'); bump(q.transit.service > 0 && q.transit.service < 1 ? 'serviceFrac' : 'serviceNotFrac');
    bump(q.safety.score === 1 ? 'safety1' : 'safetyLt1'); bump(q.commerce.activity > 1 ? 'actGt1' : 'actLe1'); bump(q.commerce.activity > 0 && q.commerce.activity < 1 ? 'actFrac' : 'actNotFrac');
    bump('grade' + q.safety.grade); bump(q.happinessDelta > 0 ? 'hdPos' : q.happinessDelta < 0 ? 'hdNeg' : 'hdZero');
    const ppRaw = +c.o.purchasingPower || 1, gRaw = +c.o.goodsSupply || 1, uRaw = +c.o.unemployment || 0, tourRaw = +c.o.tourists || 0, trRaw = +c.o.transitRidership || 0;
    bump(ppRaw < .45 ? 'ppLow' : ppRaw > 1.45 ? 'ppHigh' : 'ppMid'); bump(!c.o.purchasingPower ? 'ppFalsy' : 'ppTruthy'); bump(gRaw > 1 ? 'goodsHigh' : 'goodsMid'); bump(!c.o.goodsSupply ? 'goodsFalsy' : 'goodsTruthy');
    bump(uRaw > 1 ? 'unempHigh' : uRaw < 0 ? 'unempNeg' : 'unempMid'); bump(Number.isNaN(c.o.unemployment) ? 'unempNaN' : 'unempNotNaN'); bump(trRaw < 0 ? 'transitNeg' : trRaw > 0 ? 'transitPos' : 'transitZero'); bump(tourRaw < 0 ? 'tourNeg' : tourRaw > 0 ? 'tourPos' : 'tourZero');
    const potential = a.commercial + a.entertainment * 1.8, rawGold = (potential * .16 + tourRaw * .0035) * q.commerce.activity * (nm ? 1 : .38);
    bump(rawGold < 0 ? 'goldNegClamp' : 'goldNotNeg'); bump(q.finance.commerceGold > 0 ? 'goldPos' : 'goldZero'); bump(q.finance.transitRevenue > 0 ? 'transitRevPos' : 'transitRevZero'); bump(ft && q.transit.riders > 0 ? 'freeTransitWithRiders' : 'noFreeWithRiders');
    bump(q.transit.riders > 0 ? 'ridersPos' : 'ridersZero'); bump(q.finance.operatingCost > 0 ? 'opsPos' : 'opsZero'); bump(pn && a.parks > 0 ? 'parksNightParks' : 'noParksNight'); bump(nm || pn ? 'opsFullRate' : 'opsCheapRate');
    bump(q.commerce.taxMul !== 1 ? 'taxMulOn' : 'taxMulOff'); bump(q.lighting.coverage === 1 ? 'lightCov1' : 'lightCov0'); bump(a.lightingNight === 0 ? 'planned0' : 'plannedPos');
    st.ext.maxAct = Math.max(st.ext.maxAct, q.commerce.activity); st.ext.minSafe = Math.min(st.ext.minSafe, q.safety.score); st.ext.maxSafe = Math.max(st.ext.maxSafe, q.safety.score);
    st.ext.minHd = Math.min(st.ext.minHd, q.happinessDelta); st.ext.maxHd = Math.max(st.ext.maxHd, q.happinessDelta); st.ext.minCm = Math.min(st.ext.minCm, q.safety.crimeMul); st.ext.maxCm = Math.max(st.ext.maxCm, q.safety.crimeMul);
  }
  return st;
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d029-night.json')), T = S.text;
  CASES = makeCases();

  // ---- 1. 出處、常數 ----
  {
    const bad = [], names = (S.pieces ?? []).map(p => p.name), want = Object.values(KEY);
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    if (J(names) !== J(want)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[Object.keys(KEY).find(k => KEY[k] === p.name) ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    if (!/\[0,\.55,\.78,1\.04,1\.36,1\.78\]/.test(T.prepareNightInputs487)) bad.push('道路權重表不是 [0,.55,.78,1.04,1.36,1.78]');
    const sets = vm.runInNewContext(`${T.NIGHT_ENTERTAIN_K487}\n${T.NIGHT_TRANSIT_K487}\n[[...NIGHT_ENTERTAIN_K487],[...NIGHT_TRANSIT_K487]]`);
    if (J(sets[0]) !== J([...NC.NIGHT_ENTERTAIN]) || J(sets[1]) !== J([...NC.NIGHT_TRANSIT])) bad.push(`種類集合：實驗線 ${J(sets)}≠本線 ${J([[...NC.NIGHT_ENTERTAIN], [...NC.NIGHT_TRANSIT]])}`);
    if (NC.NIGHT_ENTERTAIN.size !== 25 || NC.NIGHT_TRANSIT.size !== 12) bad.push(`集合大小 ${NC.NIGHT_ENTERTAIN.size}／${NC.NIGHT_TRANSIT.size}（要 25／12）`);
    log(!bad.length, `D029 夜間城市原文：實驗線 ${PINNED.slice(0, 7)} 的 ${S.pieces?.length} 段（clamp 37219、空狀態 37317–37318、娛樂設施與運輸設施集合 37320–37321、輸入 37323–37333、犯罪乘數 37344–37348、結算 37354–37377、歸零 37322、幸福項 55233、每天的呼叫 55866、晚間消費金 55968、夜間運輸與營運費 56027、犯罪抽籤 55817）逐段 sha256＝錨點記錄；道路權重表、娛樂設施 25 種、運輸設施 12 種跟本線相同`,
      bad.join('；') || `${S.pieces.length} 段；集合 ${NC.NIGHT_ENTERTAIN.size}／${NC.NIGHT_TRANSIT.size} 種、權重表 [0,.55,.78,1.04,1.36,1.78]`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const BASE = { ...NC };
  const base = compareAll(T, BASE);
  const NEED = {
    crimeNotReady: 2000, crimeReady: 10000, crimePoliced: 3000, crimeNotPoliced: 3000, crimeMarket: 200, crimeNoMarket: 5000, crimeNoBld: 500, crimeBld: 5000, crimeCommerceNoMarket: 300,
    nmOn: 300, nmOff: 1000, cfOn: 300, cfOff: 1000, pnOn: 300, pnOff: 1000, ftOn: 300, ftOff: 1000, nmAndCf: 60, polNull: 300, polObj: 1000,
    roadsNone: 300, roadsSome: 1000, nodes: 1000, noNodes: 100, bus: 800, rail: 500, tram: 300, railTram: 100, rcMissing: 500, rcNeg: 300, rcHigh: 500,
    refCells: 200, sz4plus: 300, szMissing: 300, szZero: 300, transitBld: 300, transitBldBig: 100, entBld: 500, junkRoad: 200, junkBld: 200,
    catR: 800, catC: 800, catI: 300, catE: 200, catS: 300, catH: 200, catD: 200, catT: 200, catA: 500, catG: 500, catF: 100, catW: 100,
    policeNoTargets: 100, policeNone: 100, policeAll: 100, policePartial: 500, policeUndef: 100, police2Undef: 500, police2Only: 100,
    demand0: 100, demandPos: 1000, capGt: 100, capLt: 300, capEq: 5, capZero: 100, serviceByNoDemand: 100, serviceFrac: 200,
    safety1: 20, safetyLt1: 1000, actGt1: 15, actFrac: 1000, gradeA: 20, gradeB: 100, gradeC: 100, gradeD: 100, hdPos: 100, hdNeg: 100,
    ppLow: 100, ppHigh: 100, ppFalsy: 100, goodsHigh: 100, goodsFalsy: 100, unempHigh: 100, unempNeg: 100, unempNaN: 100, transitNeg: 100, transitPos: 500, tourNeg: 100, tourPos: 1000,
    goldNegClamp: 5, goldPos: 500, goldZero: 100, transitRevPos: 200, freeTransitWithRiders: 20, ridersPos: 300, opsPos: 300, parksNightParks: 100, opsFullRate: 300, opsCheapRate: 500, taxMulOn: 300, lightCov1: 100, planned0: 100,
  };
  const lacking = Object.entries(NEED).filter(([k, v]) => (base.cnt[k] ?? 0) < v).map(([k, v]) => `${k} ${(base.cnt[k] ?? 0)}<${v}`);
  // 永遠碰不到的夾限（等價突變）：資料量得到它們真的碰不到
  const x = base.ext, dead = [];
  if (!(x.maxAct < 1.25)) dead.push(`活力最大 ${x.maxAct} ≥ 1.25`);
  if (!(x.minSafe > 0)) dead.push(`安全分數最小 ${x.minSafe} ≤ 0`);
  if (!(x.minHd > -.012 && x.maxHd < .014)) dead.push(`幸福加減 ${x.minHd}～${x.maxHd} 碰到 −.012／.014`);
  if (!(x.minCm > .72 && x.maxCm < 1.20 && x.minCrime > .72 && x.maxCrime < 1.20)) dead.push(`犯罪乘數 ${x.minCm}～${x.maxCm}、${x.minCrime}～${x.maxCrime} 碰到 .72／1.20`);
  log(base.diffs === 0 && !lacking.length && !dead.length,
    `D029 驗收 2：夜間城市逐項＝實驗線——實驗線原文在 vm 裡跟本線 nightcity.ts 吃同一批隨機輸入（${CASES.length} 座隨機小城：隨機的路〔等級缺、0、負、超過 5、公車站、鐵路、電車〕、建築種類與邊長與 ref 格、警察局與派出所覆蓋、購買力、貨物供給率、遊客、失業率、公交乘客、政策四項，含 0、缺、NaN、負數與超出夾限的值）：`
      + `輸入 12 欄、結算的 lighting／commerce／transit／safety／finance 每個數、幸福加減、等級、政策、犯罪乘數（含夜市加成、沒算過＝1）逐位 Object.is 相等；每一支分支都發生過`,
    base.first || (lacking.length ? `覆蓋不夠：${lacking.join('、')}｜${J(base.cnt)}` : dead.length ? `等價突變的前提不成立：${dead.join('；')}` : `${base.steps} 組全等；安全分數 ${x.minSafe}～${x.maxSafe}、活力 ≤ ${x.maxAct}、幸福加減 ${x.minHd}～${x.maxHd}、犯罪乘數 ${x.minCrime.toFixed(4)}～${x.maxCrime.toFixed(4)}（四個夾限碰不到）；`
      + ['nmOn', 'cfOn', 'pnOn', 'ftOn', 'roadsNone', 'demand0', 'capGt', 'capLt', 'capZero', 'safety1', 'actGt1', 'gradeA', 'gradeB', 'gradeC', 'gradeD', 'goldNegClamp', 'policePartial', 'police2Only', 'crimeMarket'].map(k => `${k} ${base.cnt[k]}`).join('、')));

  if (process.env.D029_BASE_ONLY) return;
  // ---- 3. 注入錯誤要紅 ----
  {
    const missed = [];
    for (const [name, key, from, to] of LAB_MUTANTS) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key] === undefined ? '沒有這段' : t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = compareAll(t2, BASE, true).diffs; } catch (e) { missed.push(`實驗線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`實驗線「${name}」`);
    }
    for (const [name, from, to] of MINE_MUTANTS) {
      let M;
      try { M = await loadMod('src/sim/rules/nightcity.ts', [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = compareAll(T, M, true).diffs; } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`本線「${name}」`);
    }
    const cm0 = await loadMod('src/sim/rules/nightcity.ts', []);
    const baseOk = !compareAll(T, cm0, true).diffs;
    log(baseOk && !missed.length, `D029 驗收 2（突變）：注入錯誤要紅——實驗線原文 ${LAB_MUTANTS.length} 個、本線原碼 ${MINE_MUTANTS.length} 個（路級權重表、min(9, …)、每個係數、兩個集合的成員、每個取位、每個政策的加減、每個比較與取整……）；沒改的先核過全等`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }
}

// ---- 突變表：[名字, 段落鍵, 原文, 改成]（實驗線）／[名字, 原文, 改成]（本線 nightcity.ts）。原文要在那一段（那個檔）裡剛好出現一次 ----
// 等價突變不列：活力夾限 1.25、幸福加減夾限 −.012／.014、犯罪乘數夾限 .72／1.20、安全分數下限 0（上面的資料量出它們碰不到）；lightingNight 的 Math.max(0, …)（輸入從來不是負的）；
// 購買力夾限 .45／1.45 差 ±.01（後面的 clamp((pp−.55)/.9, 0, 1) 把 ≤ .55 與 ≥ 1.45 都吃掉，改 .6 與 1.3 才看得出來）與那個內層夾限的上限 1（pp ≤ 1.45 時 ≤ 1）；安全分數剛好等於門檻（浮點和不會剛好 .82）；
// 路燈覆蓋、連網率、供電率的取位（回退設定沒有 T471 電力調度，三個值只會是 0 或 1）；潛力取 1 位或 2 位小數（娛樂面積 ×1.8 最多一位小數，改成取整才看得出來）；種類 b.k|0（生產路徑的種類一定是整數）
const LAB_MUTANTS = [
  // 輸入 37323–37333
  ['路權重 .55→.56', 'prepareNightInputs487', '[0,.55,', '[0,.56,'], ['路權重 .78→.79', 'prepareNightInputs487', ',.78,', ',.79,'], ['路權重 1.04→1.05', 'prepareNightInputs487', ',1.04,', ',1.05,'], ['路權重 1.36→1.37', 'prepareNightInputs487', ',1.36,', ',1.37,'], ['路權重 1.78→1.79', 'prepareNightInputs487', ',1.78]', ',1.79]'],
  ['路等級缺值補 2→3', 'prepareNightInputs487', '(t.rc||2)', '(t.rc||3)'], ['路等級上限 5→6', 'prepareNightInputs487', ',1,5)', ',1,6)'], ['路等級下限 1→0', 'prepareNightInputs487', ',1,5)', ',0,5)'],
  ['公車站 +1→+2', 'prepareNightInputs487', 'if(t.bus)q.transitNodes++', 'if(t.bus)q.transitNodes+=2'], ['鐵路電車 .35→.36', 'prepareNightInputs487', 'q.transitNodes+=.35', 'q.transitNodes+=.36'], ['鐵路與電車 ||→&&', 'prepareNightInputs487', 't.rail||t.tram', 't.rail&&t.tram'],
  ['路格要是路 不看', 'prepareNightInputs487', 'if(!t||!t.road)continue;', 'if(!t)continue;'],
  ['邊長缺值補 1→2', 'prepareNightInputs487', 'Math.max(1,b.sz||1)', 'Math.max(1,b.sz||2)'], ['邊長下限 1→2', 'prepareNightInputs487', 'Math.max(1,b.sz||1)', 'Math.max(2,b.sz||1)'], ['面積上限 9→10', 'prepareNightInputs487', 'Math.min(9,sz*sz)', 'Math.min(10,sz*sz)'], ['面積不平方', 'prepareNightInputs487', 'Math.min(9,sz*sz)', 'Math.min(9,sz)'],
  ['ref 格不跳過', 'prepareNightInputs487', 'if(!b||b.ref)continue;', 'if(!b)continue;'],
  ['住宅不算', 'prepareNightInputs487', "if(cat==='R')q.residential+=area;", "if(cat==='Z')q.residential+=area;"], ['商業不算', 'prepareNightInputs487', "else if(cat==='C')q.commercial+=area;", "else if(cat==='Z')q.commercial+=area;"],
  ['工業不算能源', 'prepareNightInputs487', "cat==='I'||cat==='E'", "cat==='I'"], ['能源不算工業', 'prepareNightInputs487', "cat==='I'||cat==='E'", "cat==='E'"],
  ['民生不算文化', 'prepareNightInputs487', "['A','S','H','D','T']", "['S','H','D','T']"], ['民生不算市政', 'prepareNightInputs487', "['A','S','H','D','T']", "['A','H','D','T']"], ['民生不算醫療', 'prepareNightInputs487', "['A','S','H','D','T']", "['A','S','D','T']"], ['民生不算教育', 'prepareNightInputs487', "['A','S','H','D','T']", "['A','S','H','T']"], ['民生不算交通', 'prepareNightInputs487', "['A','S','H','D','T']", "['A','S','H','D']"],
  ['民生算進農業', 'prepareNightInputs487', "['A','S','H','D','T']", "['A','S','H','D','T','F']"],
  ['娛樂設施不算', 'prepareNightInputs487', 'if(NIGHT_ENTERTAIN_K487.has(k))q.entertainment+=area;', 'if(false)q.entertainment+=area;'], ['娛樂設施算邊長', 'prepareNightInputs487', 'q.entertainment+=area;', 'q.entertainment+=sz;'],
  ['運輸設施不算', 'prepareNightInputs487', 'if(NIGHT_TRANSIT_K487.has(k))q.transitNodes+=Math.max(1,sz);', 'if(false)q.transitNodes+=Math.max(1,sz);'], ['運輸設施只算 1', 'prepareNightInputs487', 'q.transitNodes+=Math.max(1,sz);', 'q.transitNodes+=1;'], ['運輸設施算面積', 'prepareNightInputs487', 'q.transitNodes+=Math.max(1,sz);', 'q.transitNodes+=area;'],
  ['公園不算', 'prepareNightInputs487', "if(cat==='G')q.parks+=area;", "if(cat==='Z')q.parks+=area;"], ['公園算成農業', 'prepareNightInputs487', "if(cat==='G')q.parks+=area;", "if(cat==='F')q.parks+=area;"],
  ['傍晚照明 路 .014→.015', 'prepareNightInputs487', 'q.roadWeight*.014', 'q.roadWeight*.015'], ['傍晚照明 站 .045→.046', 'prepareNightInputs487', 'q.transitNodes*.045', 'q.transitNodes*.046'], ['傍晚照明 民生 .010→.011', 'prepareNightInputs487', 'q.civic*.010', 'q.civic*.011'], ['傍晚照明 取位 3→2', 'prepareNightInputs487', '.010).toFixed(3)', '.010).toFixed(2)'],
  ['夜間照明 路 .021→.022', 'prepareNightInputs487', 'q.roadWeight*.021', 'q.roadWeight*.022'], ['夜間照明 站 .065→.066', 'prepareNightInputs487', 'q.transitNodes*.065', 'q.transitNodes*.066'], ['夜間照明 民生 .014→.015', 'prepareNightInputs487', 'q.civic*.014+(pol', 'q.civic*.015+(pol'],
  ['夜間照明 公園夜開 .035→.036', 'prepareNightInputs487', 'q.parks*.035', 'q.parks*.036'], ['夜間照明 公園夜開不看政策', 'prepareNightInputs487', '(pol&&pol.parkNight?q.parks*.035:0)', '(q.parks*.035)'], ['夜間照明 取位 3→2', 'prepareNightInputs487', ':0)).toFixed(3)', ':0)).toFixed(2)'],
  // 結算 37354–37377
  ['路燈覆蓋 沒規劃補 1→0', 'finalizeNightCity487', 'clamp(served/planned,0,1):1', 'clamp(served/planned,0,1):0'], ['路燈覆蓋 planned>0→>=0', 'finalizeNightCity487', 'lightingCoverage=planned>0?', 'lightingCoverage=planned>=0?'],
  ['連網率 沒規劃補 1→0', 'finalizeNightCity487', 'clamp(connected/planned,0,1):1,', 'clamp(connected/planned,0,1):0,'], ['供電率 有規劃補 0→1', 'finalizeNightCity487', '(planned>0?0:1)', '(planned>0?1:1)'], ['供電率 沒規劃補 1→0', 'finalizeNightCity487', '(planned>0?0:1)', '(planned>0?0:0)'],
  ['警察覆蓋 沒對象補 1→0', 'finalizeNightCity487', 'targets?policeCovered/targets:1', 'targets?policeCovered/targets:0'], ['警察覆蓋 不算商業', 'finalizeNightCity487', "cat==='R'||cat==='C'||NIGHT_ENTERTAIN_K487.has(b.k)", "cat==='R'||NIGHT_ENTERTAIN_K487.has(b.k)"], ['警察覆蓋 不算住宅', 'finalizeNightCity487', "cat==='R'||cat==='C'||NIGHT_ENTERTAIN_K487.has(b.k)", "cat==='C'||NIGHT_ENTERTAIN_K487.has(b.k)"],
  ['警察覆蓋 不算娛樂設施', 'finalizeNightCity487', "cat==='R'||cat==='C'||NIGHT_ENTERTAIN_K487.has(b.k)", "cat==='R'||cat==='C'"], ['警察覆蓋 派出所不算', 'finalizeNightCity487', '||(COV.police2&&COV.police2[i]>0))policeCovered++', ')policeCovered++'], ['警察覆蓋 警察局不算', 'finalizeNightCity487', 'if((COV.police&&COV.police[i]>0)||', 'if(false||'],
  ['警察覆蓋 >0→>=0', 'finalizeNightCity487', '(COV.police&&COV.police[i]>0)||(COV.police2', '(COV.police&&COV.police[i]>=0)||(COV.police2'], ['警察覆蓋 ref 格不跳過', 'finalizeNightCity487', 'if(!b||b.ref)continue;const cat=kcatOf(b.k)', 'if(!b)continue;const cat=kcatOf(b.k)'],
  ['購買力下限 .45→.6', 'finalizeNightCity487', 'clamp(+o.purchasingPower||1,.45,1.45)', 'clamp(+o.purchasingPower||1,.6,1.45)'], ['購買力上限 1.45→1.3', 'finalizeNightCity487', 'clamp(+o.purchasingPower||1,.45,1.45)', 'clamp(+o.purchasingPower||1,.45,1.3)'], ['購買力缺值補 1→2', 'finalizeNightCity487', '+o.purchasingPower||1', '+o.purchasingPower||2'],
  ['貨物供給缺值補 1→0', 'finalizeNightCity487', 'clamp(+o.goodsSupply||1,0,1)', 'clamp(+o.goodsSupply||0,0,1)'], ['貨物供給上限 1→2', 'finalizeNightCity487', 'clamp(+o.goodsSupply||1,0,1)', 'clamp(+o.goodsSupply||1,0,2)'],
  ['失業上限 1→2', 'finalizeNightCity487', 'clamp(+o.unemployment||0,0,1)', 'clamp(+o.unemployment||0,0,2)'], ['失業下限 0→−1', 'finalizeNightCity487', 'clamp(+o.unemployment||0,0,1)', 'clamp(+o.unemployment||0,-1,1)'],
  ['公交乘客下限 0→−9', 'finalizeNightCity487', 'Math.max(0,+o.transitRidership||0)', 'Math.max(-9,+o.transitRidership||0)'],
  ['需求 商業 1.8→1.9', 'finalizeNightCity487', 'I.commercial*1.8+', 'I.commercial*1.9+'], ['需求 娛樂 3.8→3.9', 'finalizeNightCity487', 'I.entertainment*3.8+', 'I.entertainment*3.9+'], ['需求 工業 .75→.76', 'finalizeNightCity487', 'I.industrial*.75+', 'I.industrial*.76+'], ['需求 民生 .55→.56', 'finalizeNightCity487', 'I.civic*.55+', 'I.civic*.56+'], ['需求 遊客 .025→.026', 'finalizeNightCity487', '(+o.tourists||0)*.025)', '(+o.tourists||0)*.026)'],
  ['需求 夜市 1.25→1.26', 'finalizeNightCity487', 'pol.nightMarket?1.25:1', 'pol.nightMarket?1.26:1'], ['需求 宵禁 .58→.59', 'finalizeNightCity487', 'pol.curfew?.58:1', 'pol.curfew?.59:1'], ['需求 不取整', 'finalizeNightCity487', 'demand=Math.round((I.commercial', 'demand=((I.commercial'],
  ['運量 乘客 .22→.23', 'finalizeNightCity487', 'dailyTransit*.22', 'dailyTransit*.23'], ['運量 站 5→6', 'finalizeNightCity487', 'I.transitNodes*5)', 'I.transitNodes*6)'], ['運量 取整→無條件捨去', 'finalizeNightCity487', 'capacity=Math.round(', 'capacity=Math.floor('],
  ['服務 沒需求補 1→0', 'finalizeNightCity487', 'clamp(capacity/demand,0,1):1', 'clamp(capacity/demand,0,1):0'], ['服務 上限 1→2', 'finalizeNightCity487', 'clamp(capacity/demand,0,1)', 'clamp(capacity/demand,0,2)'], ['服務 demand>0→>=0', 'finalizeNightCity487', 'service=demand>0?', 'service=demand>=0?'],
  ['安全 基礎 .18→.19', 'finalizeNightCity487', 'safety=clamp(.18+', 'safety=clamp(.19+'], ['安全 路燈 .37→.38', 'finalizeNightCity487', 'lightingCoverage*.37+', 'lightingCoverage*.38+'], ['安全 警察 .31→.32', 'finalizeNightCity487', 'policeCoverage*.31+', 'policeCoverage*.32+'], ['安全 運輸 .10→.11', 'finalizeNightCity487', 'service*.10+', 'service*.11+'],
  ['安全 宵禁 .10→.11', 'finalizeNightCity487', 'pol.curfew?.10:0', 'pol.curfew?.11:0'], ['安全 夜市 .035→.036', 'finalizeNightCity487', 'pol.nightMarket?.035:0', 'pol.nightMarket?.036:0'], ['安全 公園夜開 .015→.016', 'finalizeNightCity487', 'pol.parkNight?.015:0', 'pol.parkNight?.016:0'], ['安全 失業 .06→.07', 'finalizeNightCity487', 'unemp*.06,0,1)', 'unemp*.07,0,1)'],
  ['安全 上限 1→2', 'finalizeNightCity487', 'unemp*.06,0,1)', 'unemp*.06,0,2)'], ['安全 夜市加成的符號', 'finalizeNightCity487', '-(pol&&pol.nightMarket?.035:0)', '+(pol&&pol.nightMarket?.035:0)'],
  ['政策 夜市 1.18→1.19', 'finalizeNightCity487', 'pol.nightMarket?1.18:.72', 'pol.nightMarket?1.19:.72'], ['政策 沒夜市 .72→.73', 'finalizeNightCity487', 'pol.nightMarket?1.18:.72', 'pol.nightMarket?1.18:.73'], ['政策 宵禁 .68→.69', 'finalizeNightCity487', 'pol.curfew?.68:1', 'pol.curfew?.69:1'], ['政策 公園夜開 1.04→1.05', 'finalizeNightCity487', 'pol.parkNight?1.04:1', 'pol.parkNight?1.05:1'],
  ['活力 基礎 .20→.21', 'finalizeNightCity487', '(.20+lightingCoverage', '(.21+lightingCoverage'], ['活力 路燈 .31→.32', 'finalizeNightCity487', 'lightingCoverage*.31+', 'lightingCoverage*.32+'], ['活力 運輸 .20→.21', 'finalizeNightCity487', 'service*.20+', 'service*.21+'], ['活力 安全 .16→.17', 'finalizeNightCity487', 'safety*.16+clamp', 'safety*.17+clamp'],
  ['活力 購買力起點 .55→.56', 'finalizeNightCity487', '(pp-.55)/.9', '(pp-.56)/.9'], ['活力 購買力幅度 .9→.91', 'finalizeNightCity487', '(pp-.55)/.9', '(pp-.55)/.91'], ['活力 購買力 .13→.14', 'finalizeNightCity487', ',0,1)*.13)', ',0,1)*.14)'], ['活力 購買力夾限 下限 0→−1', 'finalizeNightCity487', 'clamp((pp-.55)/.9,0,1)', 'clamp((pp-.55)/.9,-1,1)'],
  ['活力 失業 .22→.23', 'finalizeNightCity487', '(1-unemp*.22)', '(1-unemp*.23)'], ['活力 不乘貨物供給', 'finalizeNightCity487', '*policy*goods*(1-unemp', '*policy*(1-unemp'], ['活力 不乘政策', 'finalizeNightCity487', '*policy*goods*(1-unemp', '*goods*(1-unemp'],
  ['乘客 取小→取大', 'finalizeNightCity487', 'Math.min(demand,capacity)', 'Math.max(demand,capacity)'], ['乘客 活力夾限 1→2', 'finalizeNightCity487', 'clamp(activity,0,1)),potential', 'clamp(activity,0,2)),potential'], ['乘客 不取整', 'finalizeNightCity487', 'riders=Math.round(', 'riders=('],
  ['潛力 娛樂 1.8→1.9', 'finalizeNightCity487', 'potential=I.commercial+I.entertainment*1.8', 'potential=I.commercial+I.entertainment*1.9'],
  ['晚間消費金 潛力 .16→.17', 'finalizeNightCity487', '(potential*.16+', '(potential*.17+'], ['晚間消費金 遊客 .0035→.0036', 'finalizeNightCity487', '(+o.tourists||0)*.0035)', '(+o.tourists||0)*.0036)'], ['晚間消費金 沒夜市 .38→.39', 'finalizeNightCity487', 'pol.nightMarket?1:.38', 'pol.nightMarket?1:.39'], ['晚間消費金 夜市 1→2', 'finalizeNightCity487', 'pol.nightMarket?1:.38', 'pol.nightMarket?2:.38'],
  ['晚間消費金 下限 0→−9', 'finalizeNightCity487', 'commerceGold=Math.max(0,', 'commerceGold=Math.max(-9,'], ['晚間消費金 不乘活力', 'finalizeNightCity487', '*activity*(pol&&pol.nightMarket?1:.38)', '*(pol&&pol.nightMarket?1:.38)'], ['晚間消費金 不取整', 'finalizeNightCity487', 'commerceGold=Math.max(0,Math.round(', 'commerceGold=Math.max(0,('],
  ['運輸收入 .018→.019', 'finalizeNightCity487', 'riders*.018', 'riders*.019'], ['運輸收入 免費公交補 0→1', 'finalizeNightCity487', 'pol&&pol.freeTransit?0:', 'pol&&pol.freeTransit?1:'], ['運輸收入 不看免費公交', 'finalizeNightCity487', 'pol&&pol.freeTransit?0:Math.max', 'false?0:Math.max'],
  ['營運費 乘客 .004→.005', 'finalizeNightCity487', 'riders*.004+', 'riders*.005+'], ['營運費 站 .025→.026', 'finalizeNightCity487', 'I.transitNodes*.025+', 'I.transitNodes*.026+'], ['營運費 公園夜開 .025→.026', 'finalizeNightCity487', 'I.parks*.025:0)', 'I.parks*.026:0)'], ['營運費 公園夜開不看政策', 'finalizeNightCity487', '(pol&&pol.parkNight?I.parks*.025:0)', '(I.parks*.025)'],
  ['營運費 沒政策 .45→.46', 'finalizeNightCity487', 'pol&&pol.parkNight?1:.45', 'pol&&pol.parkNight?1:.46'], ['營運費 夜市不算全額', 'finalizeNightCity487', 'pol&&pol.nightMarket||pol&&pol.parkNight?1:.45', 'pol&&pol.parkNight?1:.45'], ['營運費 公園夜開不算全額', 'finalizeNightCity487', 'pol&&pol.nightMarket||pol&&pol.parkNight?1:.45', 'pol&&pol.nightMarket?1:.45'],
  ['幸福 安全 .55→.56', 'finalizeNightCity487', '(safety-.55)*.016', '(safety-.56)*.016'], ['幸福 安全 .016→.017', 'finalizeNightCity487', '(safety-.55)*.016', '(safety-.55)*.017'], ['幸福 活力 .45→.46', 'finalizeNightCity487', '(activity-.45)*.005', '(activity-.46)*.005'], ['幸福 活力 .005→.006', 'finalizeNightCity487', '(activity-.45)*.005', '(activity-.45)*.006'],
  ['等級 A .82→.83', 'finalizeNightCity487', 'safety>=.82?', 'safety>=.83?'], ['等級 B .66→.67', 'finalizeNightCity487', 'safety>=.66?', 'safety>=.67?'], ['等級 C .48→.49', 'finalizeNightCity487', 'safety>=.48?', 'safety>=.49?'],
  ['結果 ready→false', 'finalizeNightCity487', 'nightCity487={ready:true,', 'nightCity487={ready:false,'], ['結果 日子', 'finalizeNightCity487', 'ready:true,day,', 'ready:true,day:day+1,'], ['結果 規劃取位 3→2', 'finalizeNightCity487', 'planned:+planned.toFixed(3)', 'planned:+planned.toFixed(2)'],
  ['結果 活力取位 3→2', 'finalizeNightCity487', 'activity:+activity.toFixed(3)', 'activity:+activity.toFixed(2)'], ['結果 稅乘數 .04→.05', 'finalizeNightCity487', '1+.04+.08*activity', '1+.05+.08*activity'], ['結果 稅乘數 .08→.09', 'finalizeNightCity487', '1+.04+.08*activity', '1+.04+.09*activity'], ['結果 稅乘數取位', 'finalizeNightCity487', '.08*activity:1).toFixed(3)', '.08*activity:1).toFixed(2)'],
  ['結果 潛力取位 1→0', 'finalizeNightCity487', 'potential:+potential.toFixed(1)', 'potential:+potential.toFixed(0)'], ['結果 服務取位 3→2', 'finalizeNightCity487', 'service:+service.toFixed(3)', 'service:+service.toFixed(2)'], ['結果 安全分數取位 3→2', 'finalizeNightCity487', 'score:+safety.toFixed(3)', 'score:+safety.toFixed(2)'],
  ['結果 警察覆蓋取位', 'finalizeNightCity487', 'policeCoverage:+policeCoverage.toFixed(3)', 'policeCoverage:+policeCoverage.toFixed(2)'], ['結果 犯罪乘數 1.14→1.15', 'finalizeNightCity487', 'clamp(1.14-safety*.34,', 'clamp(1.15-safety*.34,'], ['結果 犯罪乘數 .34→.35', 'finalizeNightCity487', 'clamp(1.14-safety*.34,', 'clamp(1.14-safety*.35,'], ['結果 犯罪乘數取位', 'finalizeNightCity487', '.72,1.20).toFixed(3)', '.72,1.20).toFixed(2)'],
  ['結果 淨額 −→+', 'finalizeNightCity487', 'commerceGold+transitRevenue-operatingCost', 'commerceGold+transitRevenue+operatingCost'], ['結果 幸福加減取位 4→3', 'finalizeNightCity487', 'happinessDelta:+hDelta.toFixed(4)', 'happinessDelta:+hDelta.toFixed(3)'],
  ['結果 政策 夜市', 'finalizeNightCity487', 'nightMarket:!!pol?.nightMarket', 'nightMarket:!!pol?.parkNight'], ['結果 政策 宵禁', 'finalizeNightCity487', 'curfew:!!pol?.curfew', 'curfew:!!pol?.nightMarket'],
  ['結果 路格數', 'finalizeNightCity487', 'poweredRoads,totalRoads}', 'poweredRoads,totalRoads:totalRoads+1}'], ['結果 路格數 要是路', 'finalizeNightCity487', 'const t=tiles[i];if(!t||!t.road)continue;totalRoads++', 'const t=tiles[i];if(!t)continue;totalRoads++'],
  // 犯罪乘數 37344–37348
  ['犯罪 沒算過 1→2', 'nightCrimeMul487', 'if(!nightCity487.ready)return 1;', 'if(!nightCity487.ready)return 2;'], ['犯罪 沒算過也算', 'nightCrimeMul487', 'if(!nightCity487.ready)return 1;', ''], ['犯罪 分數 .62→.63', 'nightCrimeMul487', 'local=.62*g.safety.score', 'local=.63*g.safety.score'], ['犯罪 警察 .38→.39', 'nightCrimeMul487', '+.38*sLocal', '+.39*sLocal'],
  ['犯罪 基礎 1.14→1.15', 'nightCrimeMul487', 'return clamp(1.14-local*.34', 'return clamp(1.15-local*.34'], ['犯罪 係數 .34→.35', 'nightCrimeMul487', 'local*.34+market', 'local*.35+market'], ['犯罪 夜市 .05→.06', 'nightCrimeMul487', '&&pol.nightMarket)?.05:0', '&&pol.nightMarket)?.06:0'], ['犯罪 夜市只算商業 k===2→k===3', 'nightCrimeMul487', 'b.k===2', 'b.k===3'],
  ['犯罪 夜市不看政策', 'nightCrimeMul487', '(b&&b.k===2&&pol&&pol.nightMarket)', '(b&&b.k===2)'], ['犯罪 派出所不算', 'nightCrimeMul487', '||(COV.police2&&COV.police2[i]>0))?1:0', ')?1:0'], ['犯罪 警察局不算', 'nightCrimeMul487', 'sLocal=((COV.police&&COV.police[i]>0)||', 'sLocal=(false||'], ['犯罪 警察 >0→>=0', 'nightCrimeMul487', '(COV.police&&COV.police[i]>0)', '(COV.police&&COV.police[i]>=0)'],
  // 種類集合 37320–37321
  ['娛樂集合少 9', 'NIGHT_ENTERTAIN_K487', 'new Set([9,35,', 'new Set([35,'], ['娛樂集合少 136', 'NIGHT_ENTERTAIN_K487', ',103,136]', ',103]'], ['娛樂集合多 137', 'NIGHT_ENTERTAIN_K487', ',103,136]', ',103,136,137]'], ['娛樂集合少 65', 'NIGHT_ENTERTAIN_K487', ',56,65,66,', ',56,66,'], ['娛樂集合少 90', 'NIGHT_ENTERTAIN_K487', ',87,90,93,', ',87,93,'],
  ['運輸集合少 17', 'NIGHT_TRANSIT_K487', 'new Set([17,18,', 'new Set([18,'], ['運輸集合少 174', 'NIGHT_TRANSIT_K487', ',173,174]', ',173]'], ['運輸集合多 175', 'NIGHT_TRANSIT_K487', ',173,174]', ',173,174,175]'], ['運輸集合少 55', 'NIGHT_TRANSIT_K487', ',21,55,90,', ',21,90,'], ['運輸集合少 90', 'NIGHT_TRANSIT_K487', ',55,90,110', ',55,110'],
];
const MINE_MUTANTS = [
  ['路權重 .55→.56', 'ROAD_WEIGHT = [0, .55,', 'ROAD_WEIGHT = [0, .56,'], ['路權重 .78→.79', ', .78, 1.04,', ', .79, 1.04,'], ['路權重 1.04→1.05', ', 1.04, 1.36,', ', 1.05, 1.36,'], ['路權重 1.36→1.37', ', 1.36, 1.78]', ', 1.37, 1.78]'], ['路權重 1.78→1.79', ', 1.78];', ', 1.79];'],
  ['路等級缺值補 2→3', 'clamp(t.rc || 2, 1, 5)', 'clamp(t.rc || 3, 1, 5)'], ['路等級上限 5→6', 'clamp(t.rc || 2, 1, 5)', 'clamp(t.rc || 2, 1, 6)'], ['路等級下限 1→0', 'clamp(t.rc || 2, 1, 5)', 'clamp(t.rc || 2, 0, 5)'],
  ['公車站 +1→+2', 'if (t.bus) q.transitNodes++;', 'if (t.bus) q.transitNodes += 2;'], ['鐵路電車 .35→.36', 'q.transitNodes += .35;', 'q.transitNodes += .36;'], ['鐵路與電車 ||→&&', 't.rail || t.tram', 't.rail && t.tram'], ['路格要是路 不看', 'if (!t || !t.road) continue;\n    const rc', 'if (!t) continue;\n    const rc'],
  ['邊長缺值補 1→2', 'Math.max(1, b.sz || 1)', 'Math.max(1, b.sz || 2)'], ['邊長下限 1→2', 'Math.max(1, b.sz || 1)', 'Math.max(2, b.sz || 1)'], ['面積上限 9→10', 'Math.min(9, sz * sz)', 'Math.min(10, sz * sz)'], ['面積不平方', 'Math.min(9, sz * sz)', 'Math.min(9, sz)'],
  ['ref 格不跳過（輸入）', 'if (!b || b.ref) continue;\n    const k = b.k | 0', 'if (!b) continue;\n    const k = b.k | 0'],
  ['住宅不算', "if (c === 'R') q.residential += area;", "if (c === 'Z') q.residential += area;"], ['商業不算', "else if (c === 'C') q.commercial += area;", "else if (c === 'Z') q.commercial += area;"], ['工業不算能源', "c === 'I' || c === 'E'", "c === 'I'"], ['能源不算工業', "c === 'I' || c === 'E'", "c === 'E'"],
  ['民生不算文化', "c === 'A' || c === 'S' || c === 'H' || c === 'D' || c === 'T'", "c === 'S' || c === 'H' || c === 'D' || c === 'T'"], ['民生不算市政', "c === 'A' || c === 'S' || c === 'H' || c === 'D' || c === 'T'", "c === 'A' || c === 'H' || c === 'D' || c === 'T'"],
  ['民生不算醫療', "c === 'A' || c === 'S' || c === 'H' || c === 'D' || c === 'T'", "c === 'A' || c === 'S' || c === 'D' || c === 'T'"], ['民生不算教育', "c === 'A' || c === 'S' || c === 'H' || c === 'D' || c === 'T'", "c === 'A' || c === 'S' || c === 'H' || c === 'T'"],
  ['民生不算交通', "c === 'A' || c === 'S' || c === 'H' || c === 'D' || c === 'T'", "c === 'A' || c === 'S' || c === 'H' || c === 'D'"], ['民生算進農業', "c === 'A' || c === 'S' || c === 'H' || c === 'D' || c === 'T'", "c === 'A' || c === 'S' || c === 'H' || c === 'D' || c === 'T' || c === 'F'"],
  ['娛樂設施不算', 'if (NIGHT_ENTERTAIN.has(k)) q.entertainment += area;', 'if (false) q.entertainment += area;'], ['娛樂設施算邊長', 'q.entertainment += area;', 'q.entertainment += sz;'],
  ['運輸設施不算', 'if (NIGHT_TRANSIT.has(k)) q.transitNodes += Math.max(1, sz);', 'if (false) q.transitNodes += Math.max(1, sz);'], ['運輸設施只算 1', 'q.transitNodes += Math.max(1, sz);', 'q.transitNodes += 1;'], ['運輸設施算面積', 'q.transitNodes += Math.max(1, sz);', 'q.transitNodes += area;'],
  ['公園不算', "if (c === 'G') q.parks += area;", "if (c === 'Z') q.parks += area;"], ['公園算成農業', "if (c === 'G') q.parks += area;", "if (c === 'F') q.parks += area;"],
  ['傍晚照明 路 .014→.015', 'q.roadWeight * .014', 'q.roadWeight * .015'], ['傍晚照明 站 .045→.046', 'q.transitNodes * .045', 'q.transitNodes * .046'], ['傍晚照明 民生 .010→.011', 'q.civic * .010', 'q.civic * .011'], ['傍晚照明 取位 3→2', '.010).toFixed(3)', '.010).toFixed(2)'],
  ['夜間照明 路 .021→.022', 'q.roadWeight * .021', 'q.roadWeight * .022'], ['夜間照明 站 .065→.066', 'q.transitNodes * .065', 'q.transitNodes * .066'], ['夜間照明 民生 .014→.015', 'q.civic * .014 +', 'q.civic * .015 +'], ['夜間照明 公園夜開 .035→.036', 'q.parks * .035', 'q.parks * .036'],
  ['夜間照明 公園夜開不看政策', '(pol && pol.parkNight ? q.parks * .035 : 0)', '(q.parks * .035)'], ['夜間照明 取位 3→2', ': 0)).toFixed(3)', ': 0)).toFixed(2)'],
  ['警察覆蓋 沒對象補 1→0', 'return targets ? covered / targets : 1;', 'return targets ? covered / targets : 0;'], ['警察覆蓋 不算商業', "c === 'R' || c === 'C' || NIGHT_ENTERTAIN.has(b.k)", "c === 'R' || NIGHT_ENTERTAIN.has(b.k)"], ['警察覆蓋 不算住宅', "c === 'R' || c === 'C' || NIGHT_ENTERTAIN.has(b.k)", "c === 'C' || NIGHT_ENTERTAIN.has(b.k)"],
  ['警察覆蓋 不算娛樂設施', "c === 'R' || c === 'C' || NIGHT_ENTERTAIN.has(b.k)", "c === 'R' || c === 'C'"], ['警察覆蓋 派出所不算', 'if ((p1 && p1[i] > 0) || (p2 && p2[i] > 0)) covered++;', 'if ((p1 && p1[i] > 0)) covered++;'], ['警察覆蓋 警察局不算', 'if ((p1 && p1[i] > 0) || (p2 && p2[i] > 0)) covered++;', 'if ((p2 && p2[i] > 0)) covered++;'],
  ['警察覆蓋 >0→>=0', '(p1 && p1[i] > 0) || (p2', '(p1 && p1[i] >= 0) || (p2'], ['警察覆蓋 ref 格不跳過', 'const b = w.tiles[i] && w.tiles[i].bld; if (!b || b.ref) continue;\n    const c = cat(b.k);', 'const b = w.tiles[i] && w.tiles[i].bld; if (!b) continue;\n    const c = cat(b.k);'],
  ['路燈覆蓋 沒規劃補 1→0', 'clamp(served / planned, 0, 1) : 1;', 'clamp(served / planned, 0, 1) : 0;'], ['路燈覆蓋 planned>0→>=0', 'lightingCoverage = planned > 0 ?', 'lightingCoverage = planned >= 0 ?'], ['連網率 沒規劃補 1→0', 'clamp(connected / planned, 0, 1) : 1,', 'clamp(connected / planned, 0, 1) : 0,'],
  ['供電率 有規劃補 0→1', '(planned > 0 ? 0 : 1)', '(planned > 0 ? 1 : 1)'], ['供電率 沒規劃補 1→0', '(planned > 0 ? 0 : 1)', '(planned > 0 ? 0 : 0)'],
  ['購買力下限 .45→.6', 'clamp(+o.purchasingPower || 1, .45, 1.45)', 'clamp(+o.purchasingPower || 1, .6, 1.45)'], ['購買力上限 1.45→1.3', 'clamp(+o.purchasingPower || 1, .45, 1.45)', 'clamp(+o.purchasingPower || 1, .45, 1.3)'], ['購買力缺值補 1→2', '+o.purchasingPower || 1', '+o.purchasingPower || 2'],
  ['貨物供給缺值補 1→0', 'clamp(+o.goodsSupply || 1, 0, 1)', 'clamp(+o.goodsSupply || 0, 0, 1)'], ['貨物供給上限 1→2', 'clamp(+o.goodsSupply || 1, 0, 1)', 'clamp(+o.goodsSupply || 1, 0, 2)'], ['失業上限 1→2', 'clamp(+o.unemployment || 0, 0, 1)', 'clamp(+o.unemployment || 0, 0, 2)'], ['失業下限 0→−1', 'clamp(+o.unemployment || 0, 0, 1)', 'clamp(+o.unemployment || 0, -1, 1)'],
  ['公交乘客下限 0→−9', 'Math.max(0, +o.transitRidership || 0)', 'Math.max(-9, +o.transitRidership || 0)'],
  ['需求 商業 1.8→1.9', 'I.commercial * 1.8 +', 'I.commercial * 1.9 +'], ['需求 娛樂 3.8→3.9', 'I.entertainment * 3.8 +', 'I.entertainment * 3.9 +'], ['需求 工業 .75→.76', 'I.industrial * .75 +', 'I.industrial * .76 +'], ['需求 民生 .55→.56', 'I.civic * .55 +', 'I.civic * .56 +'], ['需求 遊客 .025→.026', '(+o.tourists || 0) * .025)', '(+o.tourists || 0) * .026)'],
  ['需求 夜市 1.25→1.26', '(nm ? 1.25 : 1)', '(nm ? 1.26 : 1)'], ['需求 宵禁 .58→.59', '(cf ? .58 : 1)', '(cf ? .59 : 1)'], ['需求 不取整', 'const demand = Math.round((I.commercial', 'const demand = ((I.commercial'],
  ['運量 乘客 .22→.23', 'dailyTransit * .22', 'dailyTransit * .23'], ['運量 站 5→6', 'I.transitNodes * 5)', 'I.transitNodes * 6)'], ['運量 取整→無條件捨去', 'capacity = Math.round(', 'capacity = Math.floor('],
  ['服務 沒需求補 1→0', 'clamp(capacity / demand, 0, 1) : 1;', 'clamp(capacity / demand, 0, 1) : 0;'], ['服務 上限 1→2', 'clamp(capacity / demand, 0, 1)', 'clamp(capacity / demand, 0, 2)'], ['服務 demand>0→>=0', 'service = demand > 0 ?', 'service = demand >= 0 ?'],
  ['安全 基礎 .18→.19', 'clamp(.18 + lightingCoverage', 'clamp(.19 + lightingCoverage'], ['安全 路燈 .37→.38', 'lightingCoverage * .37 +', 'lightingCoverage * .38 +'], ['安全 警察 .31→.32', 'policeCoverage * .31 +', 'policeCoverage * .32 +'], ['安全 運輸 .10→.11', 'service * .10 +', 'service * .11 +'],
  ['安全 宵禁 .10→.11', '(cf ? .10 : 0)', '(cf ? .11 : 0)'], ['安全 夜市 .035→.036', '(nm ? .035 : 0)', '(nm ? .036 : 0)'], ['安全 公園夜開 .015→.016', '(pn ? .015 : 0)', '(pn ? .016 : 0)'], ['安全 失業 .06→.07', 'unemp * .06, 0, 1)', 'unemp * .07, 0, 1)'], ['安全 上限 1→2', 'unemp * .06, 0, 1)', 'unemp * .06, 0, 2)'],
  ['安全 夜市加成的符號', '- (nm ? .035 : 0)', '+ (nm ? .035 : 0)'],
  ['政策 夜市 1.18→1.19', '(nm ? 1.18 : .72)', '(nm ? 1.19 : .72)'], ['政策 沒夜市 .72→.73', '(nm ? 1.18 : .72)', '(nm ? 1.18 : .73)'], ['政策 宵禁 .68→.69', '(cf ? .68 : 1)', '(cf ? .69 : 1)'], ['政策 公園夜開 1.04→1.05', '(pn ? 1.04 : 1)', '(pn ? 1.05 : 1)'],
  ['活力 基礎 .20→.21', '(.20 + lightingCoverage', '(.21 + lightingCoverage'], ['活力 路燈 .31→.32', 'lightingCoverage * .31 +', 'lightingCoverage * .32 +'], ['活力 運輸 .20→.21', 'service * .20 +', 'service * .21 +'], ['活力 安全 .16→.17', 'safety * .16 +', 'safety * .17 +'],
  ['活力 購買力起點 .55→.56', '(pp - .55) / .9', '(pp - .56) / .9'], ['活力 購買力幅度 .9→.91', '(pp - .55) / .9', '(pp - .55) / .91'], ['活力 購買力 .13→.14', ', 0, 1) * .13)', ', 0, 1) * .14)'], ['活力 購買力夾限 下限 0→−1', 'clamp((pp - .55) / .9, 0, 1)', 'clamp((pp - .55) / .9, -1, 1)'],
  ['活力 失業 .22→.23', '(1 - unemp * .22)', '(1 - unemp * .23)'], ['活力 不乘貨物供給', '* policy * goods * (1 - unemp', '* policy * (1 - unemp'], ['活力 不乘政策', '* policy * goods * (1 - unemp', '* goods * (1 - unemp'],
  ['乘客 取小→取大', 'Math.min(demand, capacity)', 'Math.max(demand, capacity)'], ['乘客 活力夾限 1→2', 'clamp(activity, 0, 1)), potential', 'clamp(activity, 0, 2)), potential'], ['乘客 不取整', 'riders = Math.round(', 'riders = ('],
  ['潛力 娛樂 1.8→1.9', 'potential = I.commercial + I.entertainment * 1.8', 'potential = I.commercial + I.entertainment * 1.9'],
  ['晚間消費金 潛力 .16→.17', '(potential * .16 +', '(potential * .17 +'], ['晚間消費金 遊客 .0035→.0036', '(+o.tourists || 0) * .0035)', '(+o.tourists || 0) * .0036)'], ['晚間消費金 沒夜市 .38→.39', '(nm ? 1 : .38)', '(nm ? 1 : .39)'], ['晚間消費金 夜市 1→2', '(nm ? 1 : .38)', '(nm ? 2 : .38)'],
  ['晚間消費金 下限 0→−9', 'commerceGold = Math.max(0,', 'commerceGold = Math.max(-9,'], ['晚間消費金 不乘活力', '* activity * (nm ? 1 : .38)', '* (nm ? 1 : .38)'], ['晚間消費金 不取整', 'commerceGold = Math.max(0, Math.round(', 'commerceGold = Math.max(0, ('],
  ['運輸收入 .018→.019', 'riders * .018', 'riders * .019'], ['運輸收入 免費公交補 0→1', 'pol && pol.freeTransit ? 0 :', 'pol && pol.freeTransit ? 1 :'], ['運輸收入 不看免費公交', 'pol && pol.freeTransit ? 0 : Math.max', 'false ? 0 : Math.max'],
  ['營運費 乘客 .004→.005', 'riders * .004 +', 'riders * .005 +'], ['營運費 站 .025→.026', 'I.transitNodes * .025 +', 'I.transitNodes * .026 +'], ['營運費 公園夜開 .025→.026', 'I.parks * .025 : 0)', 'I.parks * .026 : 0)'], ['營運費 公園夜開不看政策', '(pn ? I.parks * .025 : 0)', '(I.parks * .025)'],
  ['營運費 沒政策 .45→.46', '(nm || pn ? 1 : .45)', '(nm || pn ? 1 : .46)'], ['營運費 夜市不算全額', '(nm || pn ? 1 : .45)', '(pn ? 1 : .45)'], ['營運費 公園夜開不算全額', '(nm || pn ? 1 : .45)', '(nm ? 1 : .45)'],
  ['幸福 安全 .55→.56', '(safety - .55) * .016', '(safety - .56) * .016'], ['幸福 安全 .016→.017', '(safety - .55) * .016', '(safety - .55) * .017'], ['幸福 活力 .45→.46', '(activity - .45) * .005', '(activity - .46) * .005'], ['幸福 活力 .005→.006', '(activity - .45) * .005', '(activity - .45) * .006'],
  ['等級 A .82→.83', "safety >= .82 ? 'A'", "safety >= .83 ? 'A'"], ['等級 B .66→.67', "safety >= .66 ? 'B'", "safety >= .67 ? 'B'"], ['等級 C .48→.49', "safety >= .48 ? 'C'", "safety >= .49 ? 'C'"],
  ['結果 ready→false', 'ready: true, day, inputs: { ...I },', 'ready: false, day, inputs: { ...I },'], ['結果 日子', 'ready: true, day, inputs', 'ready: true, day: day + 1, inputs'], ['結果 規劃取位 3→2', 'planned: +planned.toFixed(3)', 'planned: +planned.toFixed(2)'],
    ['結果 活力取位 3→2', 'activity: +activity.toFixed(3)', 'activity: +activity.toFixed(2)'], ['結果 稅乘數 .04→.05', '1 + .04 + .08 * activity', '1 + .05 + .08 * activity'], ['結果 稅乘數 .08→.09', '1 + .04 + .08 * activity', '1 + .04 + .09 * activity'], ['結果 稅乘數取位', '.08 * activity : 1).toFixed(3)', '.08 * activity : 1).toFixed(2)'],
  ['結果 潛力取位 1→0', 'potential: +potential.toFixed(1)', 'potential: +potential.toFixed(0)'], ['結果 服務取位 3→2', 'service: +service.toFixed(3)', 'service: +service.toFixed(2)'], ['結果 安全分數取位 3→2', 'score: +safety.toFixed(3)', 'score: +safety.toFixed(2)'],
  ['結果 警察覆蓋取位', 'policeCoverage: +policeCoverage.toFixed(3)', 'policeCoverage: +policeCoverage.toFixed(2)'], ['結果 犯罪乘數 1.14→1.15', 'clamp(1.14 - safety * .34,', 'clamp(1.15 - safety * .34,'], ['結果 犯罪乘數 .34→.35', 'clamp(1.14 - safety * .34,', 'clamp(1.14 - safety * .35,'], ['結果 犯罪乘數取位', '.72, 1.20).toFixed(3)', '.72, 1.20).toFixed(2)'],
  ['結果 淨額 −→+', 'commerceGold + transitRevenue - operatingCost', 'commerceGold + transitRevenue + operatingCost'], ['結果 幸福加減取位 4→3', 'happinessDelta: +hDelta.toFixed(4)', 'happinessDelta: +hDelta.toFixed(3)'],
  ['結果 政策 夜市', 'policies: { nightMarket: nm, parkNight: pn, curfew: cf }', 'policies: { nightMarket: pn, parkNight: pn, curfew: cf }'], ['結果 政策 宵禁', 'policies: { nightMarket: nm, parkNight: pn, curfew: cf }', 'policies: { nightMarket: nm, parkNight: pn, curfew: nm }'],
  ['結果 路格數', 'poweredRoads: 0, totalRoads }', 'poweredRoads: 0, totalRoads: totalRoads + 1 }'],
  ['犯罪 沒算過 1→2', 'if (!g.ready) return 1;', 'if (!g.ready) return 2;'], ['犯罪 沒算過也算', 'if (!g.ready) return 1;\n', ''], ['犯罪 分數 .62→.63', 'local = .62 * g.safety.score', 'local = .63 * g.safety.score'], ['犯罪 警察 .38→.39', '+ .38 * sLocal', '+ .39 * sLocal'],
  ['犯罪 基礎 1.14→1.15', 'clamp(1.14 - local * .34', 'clamp(1.15 - local * .34'], ['犯罪 係數 .34→.35', 'local * .34 + market', 'local * .35 + market'], ['犯罪 夜市 .05→.06', '&& pol.nightMarket) ? .05 : 0', '&& pol.nightMarket) ? .06 : 0'], ['犯罪 夜市只算商業 k===2→k===3', 'b.k === 2', 'b.k === 3'],
  ['犯罪 夜市不看政策', '(b && b.k === 2 && pol && pol.nightMarket)', '(b && b.k === 2)'], ['犯罪 沒有警察覆蓋 sLocal 1→0', 'sLocal = policed ? 1 : 0', 'sLocal = policed ? 0 : 0'],
  ['娛樂集合少 9', 'new Set([9, 35,', 'new Set([35,'], ['娛樂集合少 136', ', 103, 136]', ', 103]'], ['娛樂集合多 137', ', 103, 136]', ', 103, 136, 137]'], ['娛樂集合少 65', ', 56, 65, 66,', ', 56, 66,'], ['娛樂集合少 90', ', 87, 90, 93,', ', 87, 93,'],
  ['運輸集合少 17', 'new Set([17, 18,', 'new Set([18,'], ['運輸集合少 174', ', 173, 174]', ', 173]'], ['運輸集合多 175', ', 173, 174]', ', 173, 174, 175]'], ['運輸集合少 55', ', 21, 55, 90, 110', ', 21, 90, 110'], ['運輸集合少 90', ', 55, 90, 110', ', 55, 110'],
  ['空狀態 ready', 'ready: false, day: 0, inputs: emptyNightInputs()', 'ready: true, day: 0, inputs: emptyNightInputs()'], ['空狀態 安全分數', 'safety: { score: 1, grade', 'safety: { score: 0, grade'], ['空狀態 犯罪乘數', 'policeCoverage: 1, crimeMul: 1 }', 'policeCoverage: 1, crimeMul: 2 }'], ['空狀態 供電率', 'networkRate: 1, powerRate: 1,', 'networkRate: 1, powerRate: 0,'],
];
