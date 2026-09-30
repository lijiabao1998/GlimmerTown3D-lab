// D028 Node 守衛：經濟（二）——T346 天然氣鏈、其餘收入、農場化肥增產、大型購物中心稅（驗收 1、2 的公式半邊，含突變）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d028-income.json（tools/lab-income.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；季節倍率常數與化肥倍率跟本線相同；
//   2. 逐項＝實驗線：實驗線原文在 vm 裡，跟本線同一批隨機輸入比：
//      a. 旅宿、農貿市場、釀酒、T346 鏈條結算、熟食、銀行利息、科技園、數據中心、農牧溫室與食品加工的金幣（55992–56024）↔ src/sim/rules/income2.ts chainDay、incomeExtras，每個輸出 Object.is 相等；
//      b. 農場與大農場的化肥增產 fb（55089–55090）↔ count.ts tallyBuildings（食物與金幣兩個累加、農場數與大農場數；一座城裡好幾座農場，浮點加總的順序也要對）；
//      c. 大型購物中心的稅（55964，含 getMaxRoadClass）↔ money.ts buildingTax 的 k65 支；沒電、起火、生病、死亡、廢棄、暴亂、瘟疫的購物中心不繳稅（實驗線走不到那一支）；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（每個係數、每個季節倍率、每個比較符號、四捨五入、化肥倍率與覆蓋、k65 的基礎與每級加成與各覆蓋倍率……），沒改的先核過全等。
//   接線、存檔、實驗線頁面實跑：見 tools/unit-d028-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as INC from '../src/sim/rules/income2.ts';
import * as FOOD from '../src/sim/rules/food.ts';
import * as CNT from '../src/sim/rules/count.ts';
import * as MONEY from '../src/sim/rules/money.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  clamp: 'clamp', FARM_SEASON_MULT: 'FARM_SEASON_MULT', TOUR_SEASON_MULT: 'TOUR_SEASON_MULT', chainVars: 'chainVars', enterpriseTypeUtilization489: 'enterpriseTypeUtilization489', getMaxRoadClass: 'getMaxRoadClass',
  farmFb: '農場與大農場的化肥增產 fb', eduMort: '住宅教育總和與房貸人口', cookedHappy: '熟食供應幸福項', mallTax: '大型購物中心稅 k65', lodgeMarket: '旅宿床位、旅宿收入、農貿市場', brewGold: '釀酒金幣',
  chain346: 'T346 鏈條結算', cookBankTech: '熟食、銀行利息、科技園、數據中心', farmRanchProc: '農場、牧場、溫室、食品加工金幣', incomeSum: '其他收入加總',
};   // text 的鍵 → 樣本 pieces 的名字（照樣本裡的順序）

export async function d028Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D028 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊 A：其餘收入與鏈條結算（旅宿、市場、釀酒、鏈條、熟食、銀行、科技園、數據中心、農牧溫室加工）。企業 T489 關（enterprise489 沒就緒＝利用率 1）----
const XK = ['gh330', 'ht330', 'rs330', 'hs340', 'tourists', 'sea', 'mk330', 'marketFoodUse482', 'foodPrice', 'fp346', 'kitchenFoodUse482', 'gasRatio', 'wageIndex', 'workers', 'gasExportGold482',
  'mortPop346', 'eduSumT342', 'eduCntT342', 'tpk342', 'dtc342', 'br340', 'brewFoodUse482', 'farmGoldU', 'ranchGoldU', 'ghGoldU', 'foodPlantUse482'];
const OUT_KEYS = ['fertOut', 'cookedOut', 'fertReady', 'cookedReady', 'lodgeRev', 'mktGold', 'brewGold', 'techGold', 'dcGold', 'cookGold', 'bankInt', 'farmGold', 'ranchGold', 'ghGold', 'procGold', 'hotelBeds', 'hotelOcc'];
function makeLabExtras(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`let hotelBeds=0,hotelOcc=0,fertOut=0,cookedOut=0,wageIdx=1,fertReady=false,cookedReady=false,mortPopLast346=0;
let ${XK.filter(k => k !== 'wageIndex' && k !== 'workers').map(k => `${k}=0`).join(',')},laborNow481={workers:0,wageIndex:1},enterprise489=null;
${T.clamp}
${T.FARM_SEASON_MULT}
${T.TOUR_SEASON_MULT}
${T.enterpriseTypeUtilization489}
globalThis.__set=o=>{${XK.filter(k => k !== 'wageIndex' && k !== 'workers').map(k => `${k}=o.${k};`).join('')}laborNow481={workers:o.workers,wageIndex:o.wageIndex};};
globalThis.__run=()=>{
${T.lodgeMarket}
${T.brewGold}
${T.chain346}
${T.cookBankTech}
${T.farmRanchProc}
return {${OUT_KEYS.join(',')},gasGold,wageIdx};
};`, ctx, { filename: 'lab:income' });
  return { run: o => { ctx.__set(o); return ctx.__run(); } };
}
// 本線 A
const mineExtras = (M, o) => {
  const ch = M.INC.chainDay({ fp346: o.fp346, kitchenFoodUse482: o.kitchenFoodUse482, gasRatio: o.gasRatio });
  const ex = M.INC.incomeExtras({
    sea: o.sea, foodPrice: o.foodPrice, tourists: o.tourists, farmGoldU: o.farmGoldU, ranchGoldU: o.ranchGoldU, ghGoldU: o.ghGoldU,
    foodPlantUse482: o.foodPlantUse482, marketFoodUse482: o.marketFoodUse482, brewFoodUse482: o.brewFoodUse482,
    gh330: o.gh330, ht330: o.ht330, rs330: o.rs330, hs340: o.hs340, mk330: o.mk330, br340: o.br340, tpk342: o.tpk342, dtc342: o.dtc342,
    cookedOut: ch.cookedOut, mortPop: o.mortPop346, eduSum: o.eduSumT342, eduCnt: o.eduCntT342,
  });
  return { ...ch, ...ex };
};
// 隨機輸入 A：邊界都要碰到（沒有遊客、遊客多過床位、供氣率 0／部分／1、教育均值 0／不到 100／100–120／超過 120、有／沒有市場與酒廠與科技園卻有食物分配、四個季節……）
function extrasCases(count = 4000) {
  const R = mulberry32(20261401), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)], out = [];
  for (let m = 0; m < count; m++) {
    const eduCnt = ch(.15) ? 0 : int(1, 150), avg = pick([0, 20, 60, 99, 100, 101, 119, 120, 121, 200, 255, R() * 255]);
    const eduSum = eduCnt ? Math.min(255 * eduCnt, Math.round(avg * eduCnt)) : (ch(.2) ? int(0, 40) : 0);
    const sumOf = (n, f) => { let g = 0; for (let q = 0; q < n; q++) g += f(); return g; };
    out.push({
      gh330: ch(.5) ? 0 : int(1, 4), ht330: ch(.5) ? 0 : int(1, 3), rs330: ch(.6) ? 0 : int(1, 2), hs340: ch(.6) ? 0 : int(1, 4),
      tourists: ch(.3) ? 0 : pick([int(1, 60), int(30, 400), int(200, 900)]), sea: int(0, 3),
      mk330: ch(.5) ? 0 : int(1, 3), marketFoodUse482: ch(.3) ? 0 : int(0, 40), foodPrice: .7 + R() * 1.1,
      fp346: ch(.5) ? 0 : int(1, 4), kitchenFoodUse482: ch(.3) ? 0 : int(0, 90), gasRatio: pick([0, 1, 1, R(), R(), int(1, 5) / int(5, 9), .5, .3333333333333333]),
      wageIndex: .55 + R() * 1.0, workers: int(1, 900), gasExportGold482: ch(.5) ? 0 : R() * 80,
      mortPop346: ch(.4) ? 0 : int(1, 800), eduSumT342: eduSum, eduCntT342: eduCnt, tpk342: ch(.5) ? 0 : int(1, 3), dtc342: ch(.6) ? 0 : int(1, 3),
      br340: ch(.6) ? 0 : int(1, 3), brewFoodUse482: ch(.4) ? 0 : int(0, 30),
      farmGoldU: ch(.4) ? 0 : sumOf(int(1, 6), () => int(1, 5) * pick([3, 12]) * pick([1, 1.35])), ranchGoldU: ch(.5) ? 0 : sumOf(int(1, 4), () => int(1, 5) * 2), ghGoldU: ch(.5) ? 0 : sumOf(int(1, 4), () => int(1, 5) * 4),
      foodPlantUse482: ch(.5) ? 0 : int(0, 120),
    });
  }
  return out;
}

// ---- 實驗線那一邊 B：農場與大農場的化肥增產（55089–55090）。主計數迴圈只走根格（跳過 ref 格）----
function makeLabFarm(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`let N=1,tiles=[],COV={},fertReady=false,fa=0,bigFa=0,farmFoodU=0,farmGoldU=0;
const idx=(x,y)=>y*N+x;
globalThis.__set=(n,ts,cov,fr)=>{N=n;tiles=ts;COV=cov;fertReady=fr;};
globalThis.__run=order=>{fa=0;bigFa=0;farmFoodU=0;farmGoldU=0;
for(const i of order){const b=tiles[i].bld;if(!b||b.ref)continue;const x=i%N,y=(i/N)|0;
${T.farmFb}
}
return {fa,bigFa,farmFoodU,farmGoldU};};`, ctx, { filename: 'lab:farm' });
  return { run: (n, ts, cov, fr, order) => { ctx.__set(n, ts, cov, fr); return ctx.__run(order); } };
}
function farmCases(count = 700) {
  const R = mulberry32(20261402), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)], out = [];
  for (let m = 0; m < count; m++) {
    const N = int(6, 14), nn = N * N, tiles = Array.from({ length: nn }, () => ({ t: 2, bld: null }));
    for (let q = int(1, 14); q > 0; q--) {
      const i = int(0, nn - 1); if (tiles[i].bld) continue;
      tiles[i].bld = { k: pick([22, 53, 22, 53, 23, 63, 2, 3, 1, 4]), lv: int(1, 5), v: 0, age: 10, pw: true, h: .6 };
      if (ch(.1)) tiles[i].bld.ref = [0, 0];
    }
    const order = []; for (let i = 0; i < nn; i++) if (tiles[i].bld) order.push(i);
    const cov = ch(.15) ? {} : { fertco: Uint8Array.from({ length: nn }, () => ch(.5) ? int(1, 3) : 0) };
    out.push({ N, tiles, order, cov, fertReady: ch(.6) });
  }
  return out;
}

// ---- 實驗線那一邊 C：大型購物中心的稅（55964）。前面的條件（有電、沒有火災與病與死亡與廢棄與暴亂與瘟疫）是實驗線分支鏈的外層，這裡只跑 k65 那一支 ----
function makeLabMall(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`let N=1,tiles=[],COV={},tourists=0,nightCity487={ready:false,commerce:{taxMul:1}},civicMul=1,goodsMul284=1,commerceSalesMul481=1,PM=null,ETF=1;
const idx=(x,y)=>y*N+x,inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N,T=i=>tiles[i],enterpriseTaxFactor489=()=>ETF;
${T.getMaxRoadClass}
globalThis.__set=o=>{N=o.N;tiles=o.tiles;COV=o.cov;tourists=o.tourists;nightCity487={ready:o.nightReady,commerce:{taxMul:o.nightTaxMul}};civicMul=o.civicMul;goodsMul284=o.goodsMul284;commerceSalesMul481=o.commerceSalesMul481;PM=o.pm;ETF=o.etf;};
globalThis.__run=(i,b)=>{let income=0,taxC=0;const pm=PM||{taxR:1,taxC:1,taxI:1};
if(false){}${T.mallTax}
return {income,taxC};};`, ctx, { filename: 'lab:mall' });
  return { run: (o, i, b) => { ctx.__set(o); return ctx.__run(i, b); } };
}
function mallCases(count = 900) {
  const R = mulberry32(20261403), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)], out = [];
  for (let m = 0; m < count; m++) {
    const N = int(6, 12), nn = N * N, tiles = Array.from({ length: nn }, () => ({ t: 2, bld: null }));
    for (let i = 0; i < nn; i++) if (ch(.3)) { tiles[i].road = 1; tiles[i].rc = ch(.05) ? 0 : int(1, 5); }
    const at = int(0, nn - 1), b = { k: 65, lv: int(1, 5), v: 0, age: 10, pw: true, h: .6 }; tiles[at].bld = b; tiles[at].road = 0; delete tiles[at].rc;
    const cov = { bus: new Uint8Array(nn), post: new Uint8Array(nn), parking: ch(.2) ? undefined : new Uint8Array(nn) };
    if (ch(.5)) cov.bus[at] = int(1, 3); if (ch(.5)) cov.post[at] = int(1, 3); if (cov.parking && ch(.5)) cov.parking[at] = int(1, 3);
    out.push({ N, tiles, at, b, cov, tourists: ch(.4) ? 0 : pick([int(1, 90), int(90, 300), int(300, 900)]), nightReady: ch(.5), nightTaxMul: 1 + R() * .2, civicMul: pick([1, 1.03]),
      goodsMul284: .75 + R() * .5, commerceSalesMul481: .64 + R() * .54, etf: pick([1, 1, .9, 1.1, R()]),
      pm: ch(.3) ? null : { taxR: 1, taxC: pick([0, .8, 1, 1.2, 1.5]), taxI: 1, ecoReg: ch(.3), nightMarket: ch(.35), tourPromo: ch(.2) } });
  }
  return out;
}
const mineMall = (M, c, b = c.b) => {
  const f = { COV: c.cov, LAND: new Uint8Array(c.N * c.N).fill(128), EDU: new Uint8Array(c.N * c.N) };
  const mul = { ...M.MONEY.neutralTaxMul([], null, 0), civicMul: c.civicMul, pm: c.pm, goodsMul284: c.goodsMul284, commerceSalesMul481: c.commerceSalesMul481, tourists: c.tourists,
    nightCityReady: c.nightReady, nightCityTaxMul: c.nightTaxMul, enterpriseTaxFactor: () => c.etf };
  return M.MONEY.buildingTax({ N: c.N, tiles: c.tiles }, f, c.at, b, mul);
};

// ---- 比對 ----
function compareAll(T, M, stopAtFirst = false) {
  const st = { steps: 0, diffs: 0, first: '', cnt: {} };
  const bump = (k, v = 1) => { if (v) st.cnt[k] = (st.cnt[k] ?? 0) + v; };
  const miss = (what) => { st.diffs++; if (!st.first) st.first = what; return stopAtFirst; };
  // A：其餘收入與鏈條
  const A = makeLabExtras(T);
  for (const [n, o] of EXTRAS.entries()) {
    st.steps++;
    const a = A.run(o), b = mineExtras(M, o), bad = OUT_KEYS.filter(k => !Object.is(a[k], b[k]));
    if (bad.length && miss(`收入 第 ${n} 組 ${bad.join('、')} 不同（${bad.slice(0, 1).map(k => `${k} 實驗線 ${a[k]}≠本線 ${b[k]}`)}）`)) return st;
    const beds = o.gh330 * 8 + o.ht330 * 40 + o.rs330 * 110 + o.hs340 * 14;
    bump('fertOn', a.fertOut > 0 ? 1 : 0); bump('fertOff', a.fertOut > 0 ? 0 : 1); bump('cookOn', a.cookedOut > 0 ? 1 : 0); bump('cookOff', a.cookedOut > 0 ? 0 : 1);
    bump('gas0', o.gasRatio === 0 ? 1 : 0); bump('gas1', o.gasRatio === 1 ? 1 : 0); bump('gasFrac', o.gasRatio > 0 && o.gasRatio < 1 ? 1 : 0);
    bump('touristsOver', o.tourists > beds && beds > 0 ? 1 : 0); bump('touristsUnder', o.tourists > 0 && o.tourists <= beds ? 1 : 0); bump('noTourists', o.tourists === 0 ? 1 : 0); bump('lodgePaid', a.lodgeRev > 0 ? 1 : 0);
    bump('sea' + o.sea); bump('mktNoShop', o.mk330 === 0 && o.marketFoodUse482 > 0 ? 1 : 0); bump('mktPaid', a.mktGold > 0 ? 1 : 0); bump('brewNoShop', o.br340 === 0 && o.brewFoodUse482 > 0 ? 1 : 0); bump('brewPaid', a.brewGold > 0 ? 1 : 0);
    if (o.tpk342 > 0) { const av = o.eduCntT342 ? o.eduSumT342 / o.eduCntT342 : 0; bump(av === 0 ? 'techAvg0' : av < 100 ? 'techLt100' : av <= 120 ? 'tech100_120' : 'techGt120'); bump('techPaid', a.techGold > 0 ? 1 : 0); }
    bump('techNoPark', o.tpk342 === 0 && o.eduCntT342 > 0 ? 1 : 0); bump('dcPaid', a.dcGold > 0 ? 1 : 0); bump('bankPaid', a.bankInt > 0 ? 1 : 0); bump('farmPaid', a.farmGold > 0 ? 1 : 0); bump('procPaid', a.procGold > 0 ? 1 : 0);
    bump('ranchPaid', a.ranchGold > 0 ? 1 : 0); bump('ghPaid', a.ghGold > 0 ? 1 : 0); bump('cookPaid', a.cookGold > 0 ? 1 : 0);
  }
  // B：農場與大農場的化肥增產
  const F = makeLabFarm(T);
  for (const [n, c] of FARMS.entries()) {
    st.steps++;
    const a = F.run(c.N, c.tiles, c.cov, c.fertReady, c.order), t = M.CNT.tallyBuildings({ N: c.N, tiles: c.tiles }, c.order, { ready: c.fertReady, fertco: c.cov.fertco }), b = { fa: t.cnt.fa, bigFa: t.cnt.bigFa, farmFoodU: t.cnt.farmFoodU, farmGoldU: t.cnt.farmGoldU };
    const bad = Object.keys(a).filter(k => !Object.is(a[k], b[k]));
    if (bad.length && miss(`農場 第 ${n} 組 ${bad.join('、')} 不同（${bad[0]} 實驗線 ${a[bad[0]]}≠本線 ${b[bad[0]]}）`)) return st;
    let fertFarms = 0; for (const i of c.order) { const bb = c.tiles[i].bld; if (bb && !bb.ref && (bb.k === 22 || bb.k === 53) && c.fertReady && c.cov.fertco && c.cov.fertco[i] > 0) fertFarms++; }
    bump('farmFert', fertFarms > 0 ? 1 : 0); bump('farmNoFert', a.fa + a.bigFa > 0 && fertFarms === 0 ? 1 : 0); bump('fertNotReady', !c.fertReady && a.fa + a.bigFa > 0 ? 1 : 0); bump('noFertco', !c.cov.fertco && a.fa + a.bigFa > 0 ? 1 : 0);
    bump('bigFarm', a.bigFa > 0 ? 1 : 0); bump('farmBoth', a.fa > 0 && a.bigFa > 0 ? 1 : 0); bump('fertMixed', fertFarms > 0 && fertFarms < a.fa + a.bigFa ? 1 : 0);
  }
  // C：大型購物中心的稅
  const Mall = makeLabMall(T);
  for (const [n, c] of MALLS.entries()) {
    st.steps++;
    const a = Mall.run(c, c.at, c.b), r = mineMall(M, c);
    if (!r || r.kind !== 'C' || !Object.is(r.v, a.taxC) || !Object.is(r.v, a.income)) { if (miss(`購物中心 第 ${n} 組 稅 實驗線 ${a.taxC}（收入 ${a.income}）≠ 本線 ${r ? `${r.kind} ${r.v}` : 'null'}`)) return st; }
    // 不繳稅的分支：沒電、起火、生病、死亡、廢棄、暴亂、瘟疫（實驗線走不到 k65 那一支＝沒有這筆稅）
    for (const [what, patch] of [['沒電', { pw: false }], ['起火', { fire: 3 }], ['生病', { sick: 2 }], ['死亡', { death: 1 }], ['廢棄', { abandoned: 1 }], ['暴亂', { riot: 1 }], ['瘟疫', { plague: 1 }]]) {
      if (n % 7 !== 0) break;
      const r2 = mineMall(M, c, { ...c.b, ...patch }); if (r2 !== null && miss(`購物中心 第 ${n} 組 ${what}還繳稅 ${J(r2)}`)) return st;
    }
    const cn = c.tiles; let rcMax = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c.at % c.N + dx, y = ((c.at / c.N) | 0) + dy; if (x >= 0 && y >= 0 && x < c.N && y < c.N) { const t = cn[y * c.N + x]; if (t.road && t.rc > rcMax) rcMax = t.rc; } }
    bump('mallLv' + c.b.lv); bump('mallRc' + rcMax); bump('mallBus', c.cov.bus[c.at] > 0 ? 1 : 0); bump('mallPost', c.cov.post[c.at] > 0 ? 1 : 0); bump('mallPark', c.cov.parking && c.cov.parking[c.at] > 0 ? 1 : 0); bump('mallNoParkCov', !c.cov.parking ? 1 : 0);
    bump('mallTour', c.tourists > 0 ? 1 : 0); bump('mallTourCap', c.tourists >= 100 ? 1 : 0); bump('mallNight', c.pm?.nightMarket ? 1 : 0); bump('mallNightReady', c.pm?.nightMarket && c.nightReady ? 1 : 0); bump('mallEco', c.pm?.ecoReg ? 1 : 0);
    bump('mallPmNull', c.pm === null ? 1 : 0); bump('mallCivic', c.civicMul > 1 ? 1 : 0); bump('mallTaxC0', c.pm && c.pm.taxC === 0 ? 1 : 0);
  }
  return st;
}
let EXTRAS = [], FARMS = [], MALLS = [];

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d028-income.json')), T = S.text;
  EXTRAS = extrasCases(); FARMS = farmCases(); MALLS = mallCases();

  // ---- 1. 出處、常數 ----
  {
    const bad = [], names = (S.pieces ?? []).map(p => p.name), want = Object.values(KEY);
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    if (J(names) !== J(want)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[Object.keys(KEY).find(k => KEY[k] === p.name) ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    const lab = vm.runInNewContext(`${T.FARM_SEASON_MULT}\n${T.TOUR_SEASON_MULT}\n[FARM_SEASON_MULT,TOUR_SEASON_MULT]`);
    if (J(lab) !== J([FOOD.FARM_SEASON_MULT, FOOD.TOUR_SEASON_MULT])) bad.push(`季節倍率：實驗線 ${J(lab)}≠本線 ${J([FOOD.FARM_SEASON_MULT, FOOD.TOUR_SEASON_MULT])}`);
    const fbs = [...T.farmFb.matchAll(/\?(\d+(?:\.\d+)?):1;/g)].map(m => +m[1]);
    if (fbs.length !== 2 || fbs.some(v => v !== FOOD.FERT_BOOST)) bad.push(`化肥倍率：實驗線 ${J(fbs)}≠本線 ${FOOD.FERT_BOOST}`);
    if (!/\.03:0/.test(T.cookedHappy)) bad.push('熟食供應幸福項不是 +.03');
    log(!bad.length, `D028 收入原文：實驗線 ${PINNED.slice(0, 7)} 的 ${S.pieces?.length} 段（季節倍率 38128、38210、企業利用率 39574、getMaxRoadClass 51181、農場化肥 55089–55090、教育與房貸人口 55165–55166、熟食幸福 55206、k65 稅 55964、旅宿與市場 55992–55994、釀酒 56003、鏈條結算 56006–56011、熟食銀行科技園數據中心 56012–56017、農牧溫室加工 56022–56024、加總 56025）逐段 sha256＝錨點記錄；季節倍率與化肥倍率跟本線相同`,
      bad.join('；') || `${S.pieces.length} 段；農場季節 ${J(FOOD.FARM_SEASON_MULT)}、觀光季節 ${J(FOOD.TOUR_SEASON_MULT)}、化肥 ×${FOOD.FERT_BOOST}、熟食幸福 +.03`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const BASE = { INC, CNT, MONEY };
  const base = compareAll(T, BASE);
  const NEED = {
    fertOn: 300, fertOff: 300, cookOn: 300, cookOff: 300, gas0: 100, gas1: 300, gasFrac: 500, touristsOver: 300, touristsUnder: 300, noTourists: 500, lodgePaid: 500, sea0: 500, sea1: 500, sea2: 500, sea3: 500,
    mktNoShop: 100, mktPaid: 300, brewNoShop: 100, brewPaid: 200, techAvg0: 20, techLt100: 100, tech100_120: 60, techGt120: 100, techPaid: 300, techNoPark: 100, dcPaid: 300, bankPaid: 500, farmPaid: 500, procPaid: 500, ranchPaid: 300, ghPaid: 300, cookPaid: 300,
    farmFert: 150, farmNoFert: 150, fertNotReady: 100, noFertco: 50, bigFarm: 200, farmBoth: 100, fertMixed: 100,
    mallLv1: 100, mallLv2: 100, mallLv3: 100, mallLv4: 100, mallLv5: 50, mallRc0: 30, mallRc1: 30, mallRc2: 30, mallRc3: 30, mallRc4: 30, mallRc5: 30, mallBus: 200, mallPost: 200, mallPark: 100, mallNoParkCov: 50,
    mallTour: 300, mallTourCap: 100, mallNight: 150, mallNightReady: 50, mallEco: 150, mallPmNull: 100, mallCivic: 200, mallTaxC0: 20,
  };
  const lacking = Object.entries(NEED).filter(([k, v]) => (base.cnt[k] ?? 0) < v).map(([k, v]) => `${k} ${(base.cnt[k] ?? 0)}<${v}`);
  log(base.diffs === 0 && !lacking.length,
    `D028 驗收 2：其餘收入、天然氣鏈、農場化肥、大型購物中心稅逐項＝實驗線——實驗線原文在 vm 裡跟本線 income2.ts、count.ts、money.ts 吃同一批隨機輸入（其餘收入 ${EXTRAS.length} 組、農場 ${FARMS.length} 座隨機小城、購物中心 ${MALLS.length} 座）：`
      + `化肥與熟食產出與旗標、旅宿床位與入住與旅宿收入、農貿市場、釀酒、熟食、銀行利息、科技園（教育均值四段）、數據中心、農場（四季）、牧場、溫室、食品加工逐個 Object.is 相等；農場數、大農場數、食物與金幣的浮點加總逐位相等；購物中心的稅逐位相等，沒電與起火與生病與死亡與廢棄與暴亂與瘟疫的不繳`,
    base.first || (lacking.length ? `覆蓋不夠：${lacking.join('、')}｜${J(base.cnt)}` : `${base.steps} 組全等；` + Object.keys(NEED).map(k => `${k} ${base.cnt[k]}`).join('、')));

  if (process.env.D028_BASE_ONLY) return;
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
    for (const [name, file, from, to] of MINE_MUTANTS) {
      let M;
      try {
        if (file === 'income2') M = { INC: await loadMod('src/sim/rules/income2.ts', [[from, to]]), CNT, MONEY };
        else if (file === 'money') M = { INC, CNT, MONEY: await loadMod('src/sim/rules/money.ts', [[from, to]]) };
        else if (file === 'count') M = { INC, CNT: await loadMod('src/sim/rules/count.ts', [[from, to]]), MONEY };
        else if (file === 'food') { const fm = await loadMod('src/sim/rules/food.ts', [[from, to]]); M = { INC: await loadMod('src/sim/rules/income2.ts', [], { './food.ts': fm }), CNT: await loadMod('src/sim/rules/count.ts', [], { './food.ts': fm }), MONEY }; }
        else throw new Error('不認得的檔 ' + file);
      } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = compareAll(T, M, true).diffs; } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`本線「${name}」`);
    }
    const cm0 = { INC: await loadMod('src/sim/rules/income2.ts', []), CNT: await loadMod('src/sim/rules/count.ts', []), MONEY: await loadMod('src/sim/rules/money.ts', []) };
    const baseOk = !compareAll(T, cm0, true).diffs;
    log(baseOk && !missed.length, `D028 驗收 2（突變）：注入錯誤要紅——實驗線原文 ${LAB_MUTANTS.length} 個、本線原碼 ${MINE_MUTANTS.length} 個（每個係數、每個季節倍率、每個比較符號、四捨五入、旅宿床位、教育均值與科技園上限、化肥倍率與昨天旗標與覆蓋判斷、k65 的基礎與每級加成與各覆蓋倍率與遊客與夜市與節能與各乘數……）；沒改的先核過全等`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }
}

// ---- 突變表：[名字, 段落鍵, 原文, 改成]（實驗線）／[名字, 檔案, 原文, 改成]（本線）。原文要在那一段（那個檔）裡剛好出現一次 ----
const LAB_MUTANTS = [
  ['季節倍率 農場 春 1→1.01', 'FARM_SEASON_MULT', '[1,1.15,1.4,0.4]', '[1.01,1.15,1.4,0.4]'], ['季節倍率 觀光 冬 .85→.86', 'TOUR_SEASON_MULT', '.85]', '.86]'],
  ['化肥 ×6→×7', 'chain346', 'fp346*6*', 'fp346*7*'], ['熟食 round→floor', 'chain346', 'cookedOut=Math.round(', 'cookedOut=Math.floor('], ['化肥旗標 >0→>=0', 'chain346', 'fertReady=fertOut>0;', 'fertReady=fertOut>=0;'], ['熟食旗標 >0→>=0', 'chain346', 'cookedReady=cookedOut>0;', 'cookedReady=cookedOut>=0;'],
  ['民宿 ×8→×9', 'lodgeMarket', 'gh330*8', 'gh330*9'], ['旅館 ×40→×41', 'lodgeMarket', 'ht330*40', 'ht330*41'], ['度假村 ×110→×111', 'lodgeMarket', 'rs330*110', 'rs330*111'], ['青旅 ×14→×15', 'lodgeMarket', 'hs340*14', 'hs340*15'],
  ['入住取小→取大', 'lodgeMarket', 'Math.min(tourists,hotelBeds)', 'Math.max(tourists,hotelBeds)'], ['房價 .35→.36', 'lodgeMarket', 'hotelOcc*.35*', 'hotelOcc*.36*'], ['旺季上浮 .5→.6', 'lodgeMarket', '-1)*.5)', '-1)*.6)'],
  ['農貿 ×2→×3', 'lodgeMarket', 'marketFoodUse482*2*', 'marketFoodUse482*3*'], ['農貿 沒市場也算', 'lodgeMarket', 'mk330>0?', 'mk330>=0?'], ['釀酒 ×2.2→×2.3', 'brewGold', 'brewFoodUse482*2.2*', 'brewFoodUse482*2.3*'],
  ['熟食金 .6→.7', 'cookBankTech', 'cookedOut*.6', 'cookedOut*.7'], ['銀行 .006→.007', 'cookBankTech', 'mortPop346*.006', 'mortPop346*.007'], ['科技 ×60→×61', 'cookBankTech', 'tpk342*60*', 'tpk342*61*'],
  ['科技 上限 1.2→1.3', 'cookBankTech', 'Math.min(1.2,', 'Math.min(1.3,'], ['科技 教育 /100→/101', 'cookBankTech', 'eduAvg342/100', 'eduAvg342/101'], ['數據中心 ×40→×41', 'cookBankTech', 'dtc342*40*', 'dtc342*41*'],
  ['農場金 不乘季節', 'farmRanchProc', 'farmGoldU*FARM_SEASON_MULT[sea]*foodPrice', 'farmGoldU*foodPrice'], ['牧場金 不乘糧價', 'farmRanchProc', 'ranchGoldU*foodPrice', 'ranchGoldU'], ['溫室金 不乘糧價', 'farmRanchProc', 'ghGoldU*foodPrice', 'ghGoldU'],
  ['食品加工 ×1.5→×1.6', 'farmRanchProc', 'foodPlantUse482*1.5*', 'foodPlantUse482*1.6*'],
  ['農場 fb 1.35→1.36', 'farmFb', 'farmFoodU+=flv*3*fb;farmGoldU+=flv*3*fb;', 'farmFoodU+=flv*3*fb*1.01;farmGoldU+=flv*3*fb;'], ['大農場 食物 ×20→×21', 'farmFb', 'farmFoodU+=flv*20*fb;', 'farmFoodU+=flv*21*fb;'], ['大農場 金幣 ×12→×13', 'farmFb', 'farmGoldU+=flv*12*fb;', 'farmGoldU+=flv*13*fb;'],
  ['k65 基礎 150→151', 'mallTax', '(150+(b.lv-1)*55)', '(151+(b.lv-1)*55)'], ['k65 每級 55→56', 'mallTax', '(b.lv-1)*55)', '(b.lv-1)*56)'], ['k65 遊客上限 .25→.26', 'mallTax', 'Math.min(.25,tourists/400)', 'Math.min(.26,tourists/400)'], ['k65 遊客 400→401', 'mallTax', 'tourists/400', 'tourists/401'],
  ['k65 道路 .08→.09', 'mallTax', '(1+rc*.08)', '(1+rc*.09)'], ['k65 公車 1.1→1.2', 'mallTax', '(COV.bus[i]>0?1.1:1)', '(COV.bus[i]>0?1.2:1)'], ['k65 郵局 1.15→1.16', 'mallTax', '(COV.post[i]>0?1.15:1)', '(COV.post[i]>0?1.16:1)'],
  ['k65 停車 1.1→1.2', 'mallTax', '((COV.parking&&COV.parking[i]>0)?1.1:1)', '((COV.parking&&COV.parking[i]>0)?1.2:1)'], ['k65 夜市 1.06→1.07', 'mallTax', 'nightCity487.ready?nightCity487.commerce.taxMul:1.06', 'nightCity487.ready?nightCity487.commerce.taxMul:1.07'],
  ['k65 節能 .95→.96', 'mallTax', '(pm.ecoReg?.95:1)', '(pm.ecoReg?.96:1)'],
];
// 「科技園 tpk342 > 0 改 ≥ 0」（實驗線 56016 與本線 income2.ts）是等價突變：沒有科技園時 round(0 × 60 × min(1.2, 教育均值/100)) 還是 0（教育均值有限），改了也不會不同，所以突變表不列。
const MINE_MUTANTS = [
  ['化肥 ×6→×7', 'income2', 'i.fp346 * 6 * 1 * i.gasRatio', 'i.fp346 * 7 * 1 * i.gasRatio'], ['熟食 round→floor', 'income2', 'Math.round(i.kitchenFoodUse482 * i.gasRatio)', 'Math.floor(i.kitchenFoodUse482 * i.gasRatio)'],
  ['化肥旗標 >0→>=0', 'income2', 'fertReady: fertOut > 0', 'fertReady: fertOut >= 0'], ['熟食旗標 >0→>=0', 'income2', 'cookedReady: cookedOut > 0', 'cookedReady: cookedOut >= 0'],
  ['民宿 ×8→×9', 'income2', 'i.gh330 * 8 +', 'i.gh330 * 9 +'], ['旅館 ×40→×41', 'income2', 'i.ht330 * 40 +', 'i.ht330 * 41 +'], ['度假村 ×110→×111', 'income2', 'i.rs330 * 110 +', 'i.rs330 * 111 +'], ['青旅 ×14→×15', 'income2', 'i.hs340 * 14,', 'i.hs340 * 15,'],
  ['入住取小→取大', 'income2', 'Math.min(i.tourists, hotelBeds)', 'Math.max(i.tourists, hotelBeds)'], ['房價 .35→.36', 'income2', 'hotelOcc * .35 *', 'hotelOcc * .36 *'], ['旺季上浮 .5→.6', 'income2', '(TOUR_SEASON_MULT[i.sea] - 1) * .5', '(TOUR_SEASON_MULT[i.sea] - 1) * .6'],
  ['農貿 沒市場也算', 'income2', 'i.mk330 > 0 ?', 'i.mk330 >= 0 ?'], ['農貿 ×2→×3', 'income2', 'i.marketFoodUse482 * 2 *', 'i.marketFoodUse482 * 3 *'], ['釀酒 沒酒廠也算', 'income2', 'i.br340 > 0 ?', 'i.br340 >= 0 ?'], ['釀酒 ×2.2→×2.3', 'income2', 'i.brewFoodUse482 * 2.2 *', 'i.brewFoodUse482 * 2.3 *'],
  ['熟食金 .6→.7', 'income2', 'Math.round(i.cookedOut * .6)', 'Math.round(i.cookedOut * .7)'], ['銀行 .006→.007', 'income2', 'i.mortPop * .006', 'i.mortPop * .007'], ['教育均值不擋 0', 'income2', 'i.eduCnt ? i.eduSum / i.eduCnt : 0', 'i.eduSum / i.eduCnt'],
  ['科技 ×60→×61', 'income2', 'i.tpk342 * 60 *', 'i.tpk342 * 61 *'], ['科技 上限 1.2→1.3', 'income2', 'Math.min(1.2, eduAvg342 / 100)', 'Math.min(1.3, eduAvg342 / 100)'], ['科技 教育 /100→/101', 'income2', 'eduAvg342 / 100', 'eduAvg342 / 101'],
  ['數據中心 ×40→×41', 'income2', 'i.dtc342 * 40 * 1', 'i.dtc342 * 41 * 1'],
  ['農場金 不乘季節', 'income2', 'i.farmGoldU * FARM_SEASON_MULT[i.sea] * i.foodPrice', 'i.farmGoldU * i.foodPrice'], ['農場金 季節差一格', 'income2', 'FARM_SEASON_MULT[i.sea]', 'FARM_SEASON_MULT[(i.sea + 1) % 4]'],
  ['牧場金 乘季節', 'income2', 'Math.round(i.ranchGoldU * i.foodPrice)', 'Math.round(i.ranchGoldU * FARM_SEASON_MULT[i.sea] * i.foodPrice)'], ['溫室金 不乘糧價', 'income2', 'Math.round(i.ghGoldU * i.foodPrice)', 'Math.round(i.ghGoldU)'],
  ['食品加工 ×1.5→×1.6', 'income2', 'i.foodPlantUse482 * 1.5 *', 'i.foodPlantUse482 * 1.6 *'],
  ['觀光季節 冬 .85→.86', 'food', 'export const TOUR_SEASON_MULT = [1, 1.3, 1.2, 0.85];', 'export const TOUR_SEASON_MULT = [1, 1.3, 1.2, 0.86];'], ['農場季節 春 1→1.01', 'food', 'export const FARM_SEASON_MULT = [1, 1.15, 1.4, 0.4];', 'export const FARM_SEASON_MULT = [1.01, 1.15, 1.4, 0.4];'],
  ['化肥倍率 1.35→1.36', 'food', 'export const FERT_BOOST = 1.35;', 'export const FERT_BOOST = 1.36;'],
  ['農場食物不乘 fb', 'food', 'c.farmFoodU += (b.lv || 1) * 3 * fb;', 'c.farmFoodU += (b.lv || 1) * 3;'], ['大農場食物不乘 fb', 'food', 'c.farmFoodU += (b.lv || 1) * 20 * fb;', 'c.farmFoodU += (b.lv || 1) * 20;'],
  ['化肥 不看昨天', 'count', 'fert && fert.ready && fert.fertco', 'fert && fert.fertco'], ['化肥 不看覆蓋場', 'count', 'fert.fertco && fert.fertco[i] > 0 ?', 'fert.fertco ?'], ['化肥 覆蓋 >0→>=0', 'count', 'fert.fertco[i] > 0 ?', 'fert.fertco[i] >= 0 ?'],
  ['化肥 大農場不吃', 'count', '(b.k === 22 || b.k === 53) &&', '(b.k === 22) &&'], ['農場金不乘 fb', 'count', 'c.farmGoldU += (b.lv || 1) * 3 * fb;', 'c.farmGoldU += (b.lv || 1) * 3;'], ['大農場金不乘 fb', 'count', 'c.farmGoldU += (b.lv || 1) * 12 * fb;', 'c.farmGoldU += (b.lv || 1) * 12;'],
  ['fb 沒傳給 countFood', 'count', 'countFood(fc, b, fb);', 'countFood(fc, b);'], ['fb 沒傳給 countMore', 'count', 'countMore(mc, w, i, b, fb);', 'countMore(mc, w, i, b);'],
  ['k65 基礎 150→151', 'money', '(150 + (b.lv - 1) * 55)', '(151 + (b.lv - 1) * 55)'], ['k65 每級 55→56', 'money', '(b.lv - 1) * 55)', '(b.lv - 1) * 56)'],
  ['k65 道路 .08→.09', 'money', 'let mult = (1 + rc * .08) * (COV.bus![i] > 0 ? 1.1 : 1) * (COV.post![i] > 0 ? 1.15 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.1 : 1);', 'let mult = (1 + rc * .09) * (COV.bus![i] > 0 ? 1.1 : 1) * (COV.post![i] > 0 ? 1.15 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.1 : 1);'],
  ['k65 公車 1.1→1.2', 'money', 'let mult = (1 + rc * .08) * (COV.bus![i] > 0 ? 1.1 : 1) * (COV.post![i] > 0 ? 1.15 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.1 : 1);', 'let mult = (1 + rc * .08) * (COV.bus![i] > 0 ? 1.2 : 1) * (COV.post![i] > 0 ? 1.15 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.1 : 1);'],
  ['k65 郵局 1.15→1.16', 'money', 'let mult = (1 + rc * .08) * (COV.bus![i] > 0 ? 1.1 : 1) * (COV.post![i] > 0 ? 1.15 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.1 : 1);', 'let mult = (1 + rc * .08) * (COV.bus![i] > 0 ? 1.1 : 1) * (COV.post![i] > 0 ? 1.16 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.1 : 1);'],
  ['k65 停車 1.1→1.2', 'money', 'let mult = (1 + rc * .08) * (COV.bus![i] > 0 ? 1.1 : 1) * (COV.post![i] > 0 ? 1.15 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.1 : 1);', 'let mult = (1 + rc * .08) * (COV.bus![i] > 0 ? 1.1 : 1) * (COV.post![i] > 0 ? 1.15 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.2 : 1);'],
  ['k65 遊客上限 .25→.26', 'money', 'if (mul.tourists > 0) mult *= 1 + Math.min(.25, mul.tourists / 400);', 'if (mul.tourists > 0) mult *= 1 + Math.min(.26, mul.tourists / 400);'], ['k65 遊客 400→401', 'money', 'if (mul.tourists > 0) mult *= 1 + Math.min(.25, mul.tourists / 400);', 'if (mul.tourists > 0) mult *= 1 + Math.min(.25, mul.tourists / 401);'],
  ['k65 夜市 1.06→1.07', 'money', 'Math.min(.25, mul.tourists / 400);\n    if (pm.nightMarket) mult *= mul.nightCityReady ? mul.nightCityTaxMul : 1.06;', 'Math.min(.25, mul.tourists / 400);\n    if (pm.nightMarket) mult *= mul.nightCityReady ? mul.nightCityTaxMul : 1.07;'],
  ['k65 節能 .95→.96', 'money', '* (pm.ecoReg ? .95 : 1) * civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };', '* (pm.ecoReg ? .96 : 1) * civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };'],
  ['k65 不乘市政廳', 'money', '* civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };', '* mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };'],
  ['k65 不乘商品供貨', 'money', '* civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };', '* civicMul * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };'],
  ['k65 不乘營業額', 'money', '* civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };', '* civicMul * mul.goodsMul284 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };'],
  ['k65 不乘企業係數', 'money', '* civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };', '* civicMul * mul.goodsMul284 * mul.commerceSalesMul481;\n    return { kind: \'C\', v: v65 };'],
  ['k65 算進工業稅', 'money', 'return { kind: \'C\', v: v65 };', 'return { kind: \'I\', v: v65 };'], ['k65 稅率讀成住宅', 'money', '* (pm.taxC || 1) * (pm.ecoReg ? .95 : 1) * civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };', '* (pm.taxR || 1) * (pm.ecoReg ? .95 : 1) * civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * mul.enterpriseTaxFactor(i);\n    return { kind: \'C\', v: v65 };'],
];
