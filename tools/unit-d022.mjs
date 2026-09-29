// D022 Node 守衛：糧食（驗收 1、2、3，及接線）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d022-food.json（tools/lab-food.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；
//   2. 規則逐項＝實驗線：實驗線原文（55039–55048 計數宣告、55050–55149 主計數迴圈、55286–55299 有效單位與食物與遊客、55333–55342 貿易額度與供糧率、55414–55424 每棟住宅的加減，
//      加上它們讀的常數與函式）在 vm 裡跑，跟本線 src/sim/rules/food.ts（countFood、foodDay、applyFoodHappy）吃同一批隨機小圖：農場、大農場、牧場、溫室、食品加工類、
//      觀光建築與地標（含會展中心脈衝）、貿易站、港口、貨運、倉儲、實驗線有而本線沒搬的種類（物流 T485、污水廠、化肥廠……）、多格建築的 ref 格、路的多寡（0、少、80／160／…／560 上下）、
//      各種人口與季節、日子（含 20 的倍數）；同一張圖連著三天（幸福逐日累積）：每個計數、食物量、遊客、額度、有效效率、需求、缺口、進口、供糧率、每棟住宅的幸福（逐位）、城市幸福都相等；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一處（農場與觀光的係數、季節倍率、地標觀光值、會展、道路底、額度、各設施的額度、效率、需求、進口、中性點、夾持……）；
//   4. 接線：day.ts 在垃圾（55278）與城市幸福重算（55284）之後、勞動市場與需求（55329、55578）之前接糧食；預建城起步的那一天供糧率、每棟住宅的加減＝算式；
//      只把「加到住宅」那一句拿掉的副本，推進前就在的每一棟住宅幸福差剛好是那一天的加減（夾在 .05～1）。
//   5. 實驗線頁面實跑（驗收 2、3；src/content/samples/d022-lab.json，tools/d022-lab.mjs 錄）：預建城 8 個種子、AI 城、自造城（tools/d021-cities.mjs 34 座、tools/d022-cities.mjs 31 座）讀進來推進一天，
//      糧食那一段的輸入輸出（食物量、遊客、需求、本地、缺口、進口、供糧率、貿易額度與路格底、有效效率）、人口、城市幸福、推進前就在的每一棟住宅的幸福，本線自己算的逐項＝實驗線探針；
//      種子城、全種類樣張城、污水廠碰到工業、物流中心（實驗線有而本線沒搬的輸入）只量不判，並核對它們真的有那個輸入；本線的 food.ts 改壞一處，這批要紅；
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import * as F from '../src/sim/rules/food.ts';
import { codeWithSeed, decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { dayVariant } from './unit-d021.mjs';
import { loadMod } from './unit-d024.mjs';
import { d022Codes } from './d022-lab.mjs';
import { fnv1a } from '../src/sim/rng.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['clamp', 'spec386', 'sq', 'FARM_SEASON_MULT', 'LMCFG309', 'TOUR_SEASON_MULT', 'foodPoints', 'tourists', 'logisticsEfficiency481', 'CONVENTION_PULSE_DAYS', 'REFINERY_RATE',
  'enterpriseTypeUtilization489', 'enterpriseEffectiveCount489', 'gpnTradeCapacityMul508', 'gpnImportAvailability508', 'lets', 'count', 'econ', 'trade', 'happy'];
const KEY = { lets: 'tick 計數宣告', count: 'tick 主計數迴圈', econ: 'tick 有效單位與食物遊客', trade: 'tick 貿易額度與糧食', happy: 'tick 糧食加減' };   // 樣本 pieces 裡的名字
const COUNT_NAMES = Object.keys(F.emptyFoodCount());
const OUT_NAMES = ['foodPoints', 'tourists', 'roadTradeBase482', 'tradeCapacity481', 'tradeRemaining482', 'tradeUsed482', 'foodResidentNeed482', 'foodTouristNeed482', 'foodCoreNeed482',
  'foodDomesticCore482', 'foodShortCore482', 'foodImport482', 'foodServedCore482', 'foodSupplyRate482'];

export async function d022Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D022 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 實驗線那一邊：原文在 vm 裡（strict）。樁：window（gpn 關 __noGpn508＝額度乘數 1、進口照原數）、企業沒就緒（利用率 1）、沒有火車線、沒有壅堵（roadLoad 空）、沒有事件、
// 專業化沒選、沒有化肥、沒有資源、物流沒運作（logisticsOperational485 回 false）、入住人口不看（塔與巨廈的居民跟糧食無關）、污水廠沒接管網（SEW_OK442 空）。
// 計數宣告與主計數迴圈、食物與遊客、額度與糧食、住宅加減依序包進同一個函式（它們共用 tick() 的區域變數）
function makeLab(t) {
  const ctx = vm.createContext({});
  const top = ['clamp', 'spec386', 'sq', 'FARM_SEASON_MULT', 'LMCFG309', 'TOUR_SEASON_MULT', 'foodPoints', 'tourists', 'logisticsEfficiency481', 'CONVENTION_PULSE_DAYS', 'REFINERY_RATE',
    'enterpriseTypeUtilization489', 'enterpriseEffectiveCount489', 'gpnTradeCapacityMul508', 'gpnImportAvailability508'].map(n => t[n]).join('\n');
  vm.runInContext(`'use strict';let N=1,tiles=[],tickBld=[],tickRoad=[],day=1,sea=0,pop=0,money=0,cityHappy=.6;
let shipCount=0,fuelMade=0,steelMade=0,steelUsed=0,fuelTaxMul=1,freightTaxMul=1,steelTaxMul=1,shipTradeTaxMul=1,shipPortGold=0,shipDailyGold418=0,fuelUse418=0,fuelExport418=0,constrSteelUse418=0,steelDisc418=false;
const window={__noGpn508:true},toast=()=>{},townName='',enterprise489={ready:false},railLines463=[],roadLoad=[],roadCap475=()=>1,cityEvent=null,CITY_EVENTS=[],
  fertReady=false,COV={},RESOURCE=[],RDEP=[],RESOURCE_STOCK=0,OIL_RATE=0,ORE_RATE=0,UP_MAX=[],UP_JOB=[],SEW_OK442=[],countNear=()=>0,
  idx=(x,y)=>y*N+x,residentPopulation488=()=>0,logisticsOperational485=()=>false;
${top}
function __tick(){
${t.lets}
${t.count}
}
${t.econ}
let logisticsNow481;   // 55333 那一行接在 55330 起的一串 const 宣告後面（宣告在那一串裡），這裡先宣告
${t.trade}
${t.happy}
return {${[...COUNT_NAMES, ...OUT_NAMES].join(',')},eff:logisticsNow481.efficiency,cityHappy,hs:tiles.map(q=>q.bld&&!q.bld.ref&&q.bld.k===1?q.bld.h:null)};
}
globalThis.__api={
  set:(n,ts,p,d,s,ch)=>{N=n;tiles=ts;pop=p;day=d;sea=s;cityHappy=ch;tickBld=[];tickRoad=[];for(let i=0;i<n*n;i++){if(ts[i].bld)tickBld.push(i);if(ts[i].road)tickRoad.push(i);}},
  tick:()=>__tick(),
};`, ctx, { filename: 'lab:food' });
  return ctx.__api;
}
// 本線那一邊（food.ts；突變時傳型別剝除後在 vm 裡載入的那一份）
const makeMine = (m = F) => {
  let w = null, pop = 0, day = 1, sea = 0, ch = .6, order = [], roads = 0;
  return {
    set: (n, ts, p, d, s, c) => { w = { N: n, tiles: ts }; pop = p; day = d; sea = s; ch = c; order = []; roads = 0; for (let i = 0; i < n * n; i++) { if (ts[i].bld) order.push(i); if (ts[i].road) roads++; } },
    tick: () => {
      const fc = m.emptyFoodCount();
      for (const i of order) { const b = w.tiles[i].bld; if (!b || b.ref) continue; m.countFood(fc, b); }
      const fd = m.foodDay(fc, roads, pop, sea, day), cityHappy = m.applyFoodHappy(w, order, fd.need, fd.delta, ch);
      return { ...fc, foodPoints: fd.points, tourists: fd.tourists, roadTradeBase482: fd.roadBase, tradeCapacity481: fd.cap, tradeRemaining482: fd.remaining, tradeUsed482: fd.used,
        foodResidentNeed482: fd.residentNeed, foodTouristNeed482: fd.touristNeed, foodCoreNeed482: fd.need, foodDomesticCore482: fd.domestic, foodShortCore482: fd.short, foodImport482: fd.imports,
        foodServedCore482: fd.served, foodSupplyRate482: fd.rate, eff: fd.eff, cityHappy, hs: w.tiles.map(q => q.bld && !q.bld.ref && q.bld.k === 1 ? q.bld.h : null) };
    },
  };
};

// 隨機小圖。家族：small（小圖少量建築）、farm（食物來源多）、tour（觀光多，含會展中心）、trade（貿易站、港口、貨運、倉儲）、road（路很多：100～700 格）、mixed（什麼都有，含本線沒搬的種類）、empty（沒人）
const FAMS = ['small', 'farm', 'tour', 'trade', 'road', 'mixed', 'empty'];
const K_FOOD = [22, 22, 53, 23, 23, 63, 63, 97, 104, 120], K_TOUR = [24, 67, 68, 17, 19, 35, 36, 37, 38, 39, 40, 44, 44, 47, 83, 89, 90, 99, 101, 103, 112, 114, 134, 136, 137, 138, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80];
const K_TRADE = [91, 18, 110, 64, 18, 91, 64, 110];
const K_OTHER = [2, 3, 8, 27, 33, 105, 127, 95, 96, 98, 100, 102, 111, 117, 118, 119, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 179, 180, 181, 49, 50, 4, 5, 16, 31];   // 實驗線數了但跟糧食無關、或本線沒搬（物流、污水廠、化肥廠、觀光地標 k179 以後表裡有但不數）
function cases() {
  const out = [], R = mulberry32(20261101), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  for (let m = 0; m < 700; m++) {
    const fam = FAMS[m % FAMS.length], N = fam === 'road' ? int(24, 34) : m < 14 ? int(3, 6) : int(6, 22), refK1 = ch(.07);   // refK1：這張圖假造幾格「k1 的 ref」（實際上 k1 沒有多格；污水廠 k27 不放，見下）
    const tiles = Array.from({ length: N * N }, () => ({ t: 2, bld: null }));
    const at = (x, y) => tiles[y * N + x];
    // 路：直線路段，road 家族鋪到 100～700 格（80／160…／560 的門檻兩側）
    const target = fam === 'road' ? pick([79, 80, 81, 159, 160, 161, 239, 240, 320, 400, 479, 480, 559, 560, 640, int(100, Math.min(700, N * N - 40))]) : fam === 'empty' ? int(0, 3) : int(0, Math.min(90, Math.floor(N * N / 3)));
    let roads = 0;
    for (let g = 0; g < 4000 && roads < target; g++) {
      const hz = ch(.5), a = int(0, N - 1), b0 = int(0, N - 1), len = int(2, N);
      for (let q = 0; q < len && roads < target; q++) { const x = hz ? Math.min(N - 1, b0 + q) : a, y = hz ? a : Math.min(N - 1, b0 + q); if (!at(x, y).road) { at(x, y).road = 1; roads++; } }
    }
    const put = (k, extra, sz) => {
      for (let a = 0; a < 30; a++) {
        const x = int(0, N - 1), y = int(0, N - 1); let free = x + sz <= N && y + sz <= N;
        for (let dy = 0; dy < sz && free; dy++) for (let dx = 0; dx < sz; dx++) { const q = at(x + dx, y + dy); if (q.road || q.bld) { free = false; break; } }
        if (!free) continue;
        const lvr = R();
        at(x, y).bld = { k, lv: lvr < .05 ? 0 : lvr < .1 ? undefined : int(1, 3), v: 0, age: 0, h: 1, ...(sz > 1 ? { sz } : {}), ...extra };
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) at(x + dx, y + dy).bld = { k, ref: [x, y] };
        return true;
      }
      return false;
    };
    const SZ = { 53: 3, 63: 2, 64: 2, 110: 2, 44: 2, 39: 2, 38: 2, 105: 3, 33: 2, 127: 2, 173: 2, 174: 2 };
    const many = fam === 'empty' ? 0 : fam === 'small' ? int(0, 6) : int(2, Math.min(40, Math.floor(N * N / 6)));
    for (let q = 0; q < many; q++) {
      const r = R(), pool = fam === 'farm' ? (r < .7 ? K_FOOD : r < .85 ? K_TRADE : K_OTHER) : fam === 'tour' ? (r < .8 ? K_TOUR : r < .9 ? K_FOOD : K_OTHER)
        : fam === 'trade' ? (r < .7 ? K_TRADE : r < .85 ? K_FOOD : K_OTHER) : fam === 'road' ? [...K_TRADE, ...K_FOOD, 44] : [...K_FOOD, ...K_TOUR, ...K_TRADE, ...K_OTHER];
      const k = pick(pool); if (refK1 && k === 27) continue; put(k, { pw: ch(.8) }, SZ[k] ?? 1);
    }
    const hv = () => ch(.08) ? .05 : ch(.06) ? 1 : ch(.1) ? Math.round((.05 + R() * .1) * 1000) / 1000 : Math.round((.05 + R() * .95) * 1000) / 1000;
    const nh = fam === 'empty' ? int(0, 5) : int(0, Math.floor(N * N / 4));
    for (let q = 0; q < nh; q++) {
      const r = R();
      if (r < .85) put(1, { lv: int(1, 3), den: int(1, 5), pw: ch(.8), h: hv() }, 1);
      else if (r < .93) put(127, { pw: ch(.8), wa: ch(.5), h: hv() }, 2);
      else if (refK1) {   // 實驗線的主迴圈跳過 ref 格：假造一格「k1 的 ref」也得跳過（實際上 k1 沒有多格，但兩邊該一致）
        const x = int(0, N - 1), y = int(0, N - 1); if (!at(x, y).bld && !at(x, y).road) at(x, y).bld = { k: 1, ref: [x, y], h: hv() };
      }
    }
    const steps = [];
    for (let s = 0; s < 3; s++) {
      const day = ch(.3) ? 20 * int(1, 40) : int(1, 900), pop = fam === 'empty' ? 0 : ch(.12) ? 0 : ch(.15) ? int(1, 60) : int(60, 4000);
      steps.push({ pop, day, sea: int(0, 3), happy: Math.round(R() * 1000) / 1000 });
    }
    out.push({ fam, N, tiles, roads, steps });
  }
  return out;
}
// 兩邊各一份格子（深拷貝，undefined 也照樣留著）；同一張圖連著三天，每天各自算。回傳每一天的記錄
const clone = tiles => tiles.map(t => ({ ...t, bld: t.bld ? { ...t.bld, ...(t.bld.ref ? { ref: [...t.bld.ref] } : {}) } : null }));
function runCase(c, lab, mine) {
  const A = clone(c.tiles), B = clone(c.tiles), N = c.N, recs = [];
  for (const st of c.steps) {
    // 糧食那一段的前提：城市幸福已經是住宅 k1 的平均（55282–55284、day.ts 同一句；沒有住宅就留著原來的值）
    let hs = 0, hn = 0; for (const t of A) if (t.bld && t.bld.k === 1) { hs += t.bld.h; hn++; }
    const pre = hn ? hs / hn : st.happy;
    lab.set(N, A, st.pop, st.day, st.sea, pre); mine.set(N, B, st.pop, st.day, st.sea, pre);
    const a = lab.tick(), b = mine.tick();
    recs.push({ a: J(a), b: J(b), r: a, st });
  }
  return recs;
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d022-food.json')), T = { ...S.text };

  // ---- 1. 出處 ----
  {
    const bad = [], names = (S.pieces ?? []).map(p => p.name);
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    const want = PIECES.map(n => KEY[n] ?? n);
    if (J(names) !== J(want)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[Object.keys(KEY).find(k => KEY[k] === p.name) ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    // 常數：季節倍率、會展週期、地標觀光值、燃料鋼材庫存上限（實驗線原文取出來跟本線比）
    const lab = vm.runInNewContext(`${T.FARM_SEASON_MULT}\n${T.TOUR_SEASON_MULT}\n${T.CONVENTION_PULSE_DAYS}\n${T.LMCFG309}\n({f:FARM_SEASON_MULT,t:TOUR_SEASON_MULT,c:CONVENTION_PULSE_DAYS,l:LMCFG309})`);
    const lm = Object.fromEntries(Object.entries(lab.l).filter(([k]) => +k >= 69 && +k <= 80).map(([k, v]) => [k, v.t]));
    if (J(lab.f) !== J(F.FARM_SEASON_MULT) || J(lab.t) !== J(F.TOUR_SEASON_MULT) || lab.c !== F.CONVENTION_PULSE_DAYS || J(lm) !== J(F.LANDMARK_TOUR309)) bad.push(`常數：實驗線 ${J([lab.f, lab.t, lab.c, lm])}`);
    log(!bad.length, `D022 糧食原文：實驗線 ${PINNED.slice(0, 7)} 的 ${PIECES.length} 段（季節倍率 38128／38210、地標觀光值 38129、logisticsEfficiency481 38269、會展週期 39445、tick 主計數迴圈 55050–55149、食物與遊客 55293–55299、貿易額度與糧食 55333–55342、住宅加減 55414–55424 等）sha256 逐段＝錨點記錄；季節倍率、會展週期、地標 k69–80 的觀光值＝本線`,
      bad.join('；') || `農場 ${J(F.FARM_SEASON_MULT)}、觀光 ${J(F.TOUR_SEASON_MULT)}、會展每 ${F.CONVENTION_PULSE_DAYS} 天`);
  }

  // ---- 2. 規則逐項＝實驗線 ----
  const C = cases();
  const compare = (lab, mine, stopAtFirst = false) => {
    const st = { steps: 0, diffs: 0, first: '', imp: 0, dom: 0, short: 0, capUp: 0, effUp: 0, tourNeed: 0, pulse: 0, base8: 0, noRoad: 0, clampTop: 0, noNeed: 0, winter: 0, cut: 0, houses: 0, lowH: 0, roadBase: new Set(), kinds: new Set() };
    for (let m = 0; m < C.length; m++) {
      const recs = runCase(C[m], lab, mine);
      for (const q of recs) {
        st.steps++;
        const r = q.r;
        if (r.foodImport482 > 0) st.imp++; if (r.foodDomesticCore482 > 0) st.dom++; if (r.foodShortCore482 > 0) st.short++; if (r.tradeCapacity481 > 3) st.capUp++; if (r.eff > .78) st.effUp++;
        if (r.foodTouristNeed482 > 0) st.tourNeed++; if (r.cvN > 0 && q.st.day % 20 === 0) st.pulse++; if (r.roadTradeBase482 === 8) st.base8++; if (r.tradeCapacity481 === 0) st.noRoad++;
        if (r.foodCoreNeed482 > 0 && r.foodSupplyRate482 >= 1) st.clampTop++; if (r.foodCoreNeed482 === 0) st.noNeed++; if (q.st.sea === 3) st.winter++;
        if (r.foodShortCore482 > r.foodImport482) st.cut++;
        st.houses += r.hs.filter(v => v !== null).length; st.lowH += r.hs.filter(v => v !== null && v <= .06).length; st.roadBase.add(r.roadTradeBase482);
        if (q.a !== q.b) {
          st.diffs++;
          if (!st.first) {
            const x = JSON.parse(q.a), y = JSON.parse(q.b);
            st.first = `第 ${m} 張（${C[m].fam}，N=${C[m].N}）第 ${st.steps} 步：${Object.keys(x).filter(k => J(x[k]) !== J(y[k])).slice(0, 4).map(k => `${k} 實驗線 ${J(x[k]).slice(0, 40)}≠本線 ${J(y[k]).slice(0, 40)}`).join('；')}`;
          }
          if (stopAtFirst) return st;
        }
      }
    }
    return st;
  };
  const base = compare(makeLab(T), makeMine());
  log(base.diffs === 0 && base.imp > 100 && base.dom > 100 && base.short > 100 && base.capUp > 50 && base.effUp > 30 && base.tourNeed > 50 && base.pulse > 20 && base.base8 > 5 && base.noRoad > 50
      && base.clampTop > 50 && base.noNeed > 50 && base.winter > 100 && base.cut > 100 && base.lowH > 5 && base.roadBase.size >= 8,
    `D022 驗收 1：糧食逐項＝實驗線——實驗線原文在 vm 裡跟本線 food.ts 吃 ${C.length} 張隨機小圖、每張連三天共 ${base.steps} 步（農場、大農場、牧場、溫室、食品加工類、觀光建築與地標、會展中心脈衝、貿易站、港口、貨運、倉儲、物流與污水廠等本線沒搬的種類、多格建築的 ref 格、路 0 到 700 格、各種人口、四季）：`
      + '每個計數、食物量、遊客、額度與有效效率、需求、缺口、進口、供糧率、每棟住宅的幸福（逐位）、城市幸福每一步都相等',
    base.first || `進口 ${base.imp} 步、本地供給 ${base.dom} 步、有缺口 ${base.short} 步、額度不夠拿（缺口＞進口）${base.cut} 步；額度＞3 ${base.capUp} 步、效率＞.78 ${base.effUp} 步、路底 ${[...base.roadBase].sort().join('／')}（8 封頂 ${base.base8} 步）、沒路 ${base.noRoad} 步；遊客需求 ${base.tourNeed} 步、會展脈衝 ${base.pulse} 步；供糧率 1（夾 +.05）${base.clampTop} 步、需求 0 ${base.noNeed} 步、冬季 ${base.winter} 步；住宅 ${base.houses} 棟次（幸福貼下限 ${base.lowH}）`);

  // ---- 3. 注入錯誤要紅 ----
  {
    const LAB_MUT = [
      ['夏季農場倍率 1.15→1.16', 'FARM_SEASON_MULT', '1.15', '1.16'],
      ['溫室 ×6→×7', 'count', 'ghFoodU+=glv*6;', 'ghFoodU+=glv*7;'],
      ['大農場 ×20→×21', 'count', 'farmFoodU+=flv*20*fb;', 'farmFoodU+=flv*21*fb;'],
      ['牧場 ×2→×3', 'count', 'ranchFoodU+=rlv*2;', 'ranchFoodU+=rlv*3;'],
      ['食品加工 k97 ×3→×4', 'econ', 'fp340*3', 'fp340*4'],
      ['動物園 45→46', 'econ', 'zo*45', 'zo*46'],
      ['地標 k70 觀光值 10→11', 'LMCFG309', '70:{t:10', '70:{t:11'],
      ['會展中心 500→501', 'econ', 'Math.round(500*cvN', 'Math.round(501*cvN'],
      ['會展週期 20→21', 'CONVENTION_PULSE_DAYS', '=20', '=21'],
      ['道路底 80→81', 'trade', 'tickRoad.length/80', 'tickRoad.length/81'],
      ['道路底封頂 8→7', 'trade', 'Math.min(8,1+', 'Math.min(7,1+'],
      ['額度最少 3→2', 'trade', 'tickRoad.length>0?3:0', 'tickRoad.length>0?2:0'],
      ['貿易站 ×4→×5', 'trade', 'tp336*4', 'tp336*5'],
      ['港口 ×4→×5', 'trade', 'portEquivalent485*4', 'portEquivalent485*5'],
      ['貨運 ×3→×4', 'trade', 'freightUnits485*3', 'freightUnits485*4'],
      ['倉儲 ×2→×3', 'trade', 'warehouseUnits485*2', 'warehouseUnits485*3'],
      ['物流效率底 .78→.79', 'logisticsEfficiency481', '.78+bonus', '.79+bonus'],
      ['港口的效率加成 .025→.03', 'logisticsEfficiency481', 'portN*.025', 'portN*.03'],
      ['居民需求 10→11', 'trade', 'Math.ceil(pop/10)', 'Math.ceil(pop/11)'],
      ['遊客需求 160→161', 'trade', 'Math.ceil(tourists/160)', 'Math.ceil(tourists/161)'],
      ['進口不受額度限制', 'trade', "takeTrade482(gpnImportAvailability508('food',foodShortCore482))", 'foodShortCore482'],
      ['中性點 .50→.55', 'happy', '(foodSupplyRate482-.50)', '(foodSupplyRate482-.55)'],
      ['加成係數 .11→.12', 'happy', '*.11,', '*.12,'],
      ['加成上限 .05→.06', 'happy', '-.06,.05)', '-.06,.06)'],
      ['住宅幸福下限 .05→.06', 'happy', 'clamp(b.h+foodHappyDelta482,.05,1)', 'clamp(b.h+foodHappyDelta482,.06,1)'],
      ['需求 0 也加', 'happy', 'if(foodCoreNeed482>0)b.h=clamp', 'b.h=clamp'],
    ];
    const MINE_MUT = [
      ['夏季農場倍率 1.15→1.16', '[1, 1.15, 1.4, 0.4]', '[1, 1.16, 1.4, 0.4]'],
      ['溫室 ×6→×7', 'c.ghFoodU += (b.lv || 1) * 6;', 'c.ghFoodU += (b.lv || 1) * 7;'],
      ['大農場 ×20→×21', 'c.farmFoodU += (b.lv || 1) * 20;', 'c.farmFoodU += (b.lv || 1) * 21;'],
      ['牧場 ×2→×3', 'c.ranchFoodU += (b.lv || 1) * 2;', 'c.ranchFoodU += (b.lv || 1) * 3;'],
      ['農場 ×3→×4', 'c.farmFoodU += (b.lv || 1) * 3;', 'c.farmFoodU += (b.lv || 1) * 4;'],
      ['食品加工 k97 ×3→×4', 'c.fp340 * 3', 'c.fp340 * 4'],
      ['動物園 45→46', 'c.zo * 45', 'c.zo * 46'],
      ['地標 k70 觀光值 10→11', '70: 10', '70: 11'],
      ['會展中心 500→501', 'Math.round(500 * c.cvN', 'Math.round(501 * c.cvN'],
      ['會展週期 20→21', 'CONVENTION_PULSE_DAYS = 20', 'CONVENTION_PULSE_DAYS = 21'],
      ['會展脈衝日 ＝0→＝1', 'day % CONVENTION_PULSE_DAYS === 0', 'day % CONVENTION_PULSE_DAYS === 1'],
      ['道路底 80→81', 'roads / 80', 'roads / 81'],
      ['道路底封頂 8→7', 'Math.min(8, 1 + Math.floor', 'Math.min(7, 1 + Math.floor'],
      ['額度最少 3→2', 'roads > 0 ? 3 : 0', 'roads > 0 ? 2 : 0'],
      ['貿易站 ×4→×5', 'c.tp336 * 4', 'c.tp336 * 5'],
      ['港口 ×4→×5', 'portEquivalent * 4', 'portEquivalent * 5'],
      ['貨運 ×3→×4', 'freightUnits * 3', 'freightUnits * 4'],
      ['倉儲 ×2→×3', 'warehouseUnits * 2', 'warehouseUnits * 3'],
      ['物流效率底 .78→.79', '.78 + bonus', '.79 + bonus'],
      ['港口的效率加成 .025→.03', 'portEquivalent * .025', 'portEquivalent * .03'],
      ['貨運的效率加成 .035→.04', 'freightUnits * .035', 'freightUnits * .04'],
      ['倉儲的效率加成 .022→.03', 'warehouseUnits * .022', 'warehouseUnits * .03'],
      ['效率不取四位小數', '+clamp(.78 + bonus + fuelBonus - pen, .45, 1.12).toFixed(4)', 'clamp(.78 + bonus + fuelBonus - pen, .45, 1.12)'],
      ['居民需求 10→11', 'Math.ceil(pop / 10)', 'Math.ceil(pop / 11)'],
      ['遊客需求 160→161', 'Math.ceil(tourists / 160)', 'Math.ceil(tourists / 161)'],
      ['進口不受額度限制', 'imports = take(short)', 'imports = short'],
      ['中性點 .50→.55', '(rate - .50)', '(rate - .55)'],
      ['加成係數 .11→.12', '* .11,', '* .12,'],
      ['加成上限 .05→.06', '-.06, .05)', '-.06, .06)'],
      ['住宅幸福下限 .05→.06', 'clamp((b.h as number) + delta, .05, 1)', 'clamp((b.h as number) + delta, .06, 1)'],
      ['需求 0 也加', 'if (!(need > 0)) return cityHappy;', ''],
      ['ref 格也算住宅', '!b || b.k !== 1 || b.ref', '!b || b.k !== 1'],
      ['倉儲不數', 'case 64: c.whN284++; break;', 'case 64: break;'],
      ['港口不數', 'case 18: c.po++; break;', 'case 18: break;'],
      ['貿易站不數', 'case 91: c.tp336++; break;', 'case 91: break;'],
      ['會展中心不數', 'case 44: c.cvN++; break;', 'case 44: break;'],
      ['大型購物中心 k104 不數', 'case 104: c.cg340++; break;', 'case 104: break;'],
      ['地標 k69–80 只數到 79', 'k >= 69 && k <= 80', 'k >= 69 && k <= 79'],
    ];
    const missed = [];
    for (const [name, key, from, to] of LAB_MUT) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key] === undefined ? '沒有這段' : t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = compare(makeLab(t2), makeMine(), true).diffs; } catch (e) { missed.push(`實驗線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`實驗線「${name}」`);
    }
    const src = read('src/sim/rules/food.ts');
    const load = s => { const js = stripTypeScriptTypes(s).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''); const ctx = vm.createContext({ ...labHelpers });
      vm.runInContext(js + '\nglobalThis.__m={emptyFoodCount,countFood,foodDay,applyFoodHappy};', ctx); return ctx.__m; };
    const baseOk = !compare(makeLab(T), makeMine(load(src)), true).diffs;
    for (const [name, from, to] of MINE_MUT) {
      if (src.split(from).length !== 2) { missed.push(`本線「${name}」錨點不唯一（${src.split(from).length - 1}）`); continue; }
      let M; try { M = load(src.replace(from, to)); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = compare(makeLab(T), makeMine(M), true).diffs; } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`本線「${name}」`);
    }
    log(baseOk && !missed.length, `D022 驗收 1：注入錯誤要紅——實驗線原文 ${LAB_MUT.length} 個、本線原碼 ${MINE_MUT.length} 個（農場與觀光的係數、季節倍率、地標觀光值、會展、道路底、額度與各設施的額度、效率、需求、進口、中性點、夾持、ref 格、各種設施不數）都比出差異（沒改的本線原碼在 vm 裡載入先核過相等）`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }

  // ---- 4. 接線 ----
  {
    const bad = [], day = read('src/sim/day.ts');
    const iH = day.indexOf('let cityHappy = happyN ? happySum / happyN : .6;'), iG = day.indexOf('garbageDay(w, tickBld, pop, jobsI, cityHappy, recycleMul)'), iK = day.indexOf('// 55282–55284：只用住宅 k1 重算'),
      iF = day.indexOf('foodDay(fc, roads, pop, sea, s.day)'), iA = day.indexOf('applyFoodHappy(w, tickBld, fd.need, fd.delta, cityHappy)'), iL = day.indexOf('laborMarket481(pop, jobs, null, s.day)'), cnt = read('src/sim/rules/count.ts'), iC = cnt.indexOf('countFood(fc, b)'), iR = cnt.indexOf('if (!b || b.ref) continue;'), iS = cnt.indexOf('if (b.k === 7) fac.schools++;');
    const iT = day.indexOf('tallyBuildings(w, tickBld)');   // D024：主計數迴圈搬到 rules/count.ts 的 tallyBuildings，day.ts 叫它一次
    if (!(iH > 0 && iG > iH && iK > iG && iF > iK && iA > iF && iL > iA)) bad.push('day.ts 的順序要是：城市幸福（55254）→ 垃圾（55278）→ 住宅重算城市幸福（55284）→ 糧食 → 勞動市場與需求（55329、55578）');
    if (!(iR > 0 && iC > iR && iS > iC && iT > 0 && iT < iF)) bad.push('countFood 要在主計數迴圈（count.ts 的 tallyBuildings）裡、跳過 ref 格之後，而且 day.ts 在糧食之前叫 tallyBuildings');
    if (day.split('foodDay(').length !== 2 || day.split('applyFoodHappy(').length !== 2 || cnt.split('countFood(').length !== 2) bad.push('foodDay、applyFoodHappy（day.ts）、countFood（count.ts）都只叫一次');
    if (!day.includes('food: fd,')) bad.push('回報要有 food');
    // 預建城起步那一天：沒有農場、沒有貿易站，路格 < 80（底 1、效率 .78 → floor(.78)＝0 → 最少 3），額度 3；需求 ceil(pop/10)，本地 0，進口 min(3, 需求)，供糧率＝進口／需求
    const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
    const pre = codeWithSeed(read('src/content/samples/d011-prebuilt.code.txt').trim(), 5162026), save = decodeLabCode(pre).save;
    const s1 = realDay.simFromSave(save, pre, KT, vrank);
    const r = realDay.stepDay(s1), f = r.food, want = { need: Math.ceil(r.pop / 10), imp: Math.min(3, Math.ceil(r.pop / 10)) };
    if (!(f.points === 0 && f.tourists === 0 && f.cap === 3 && f.need === want.need && f.domestic === 0 && f.imports === want.imp && f.rate === want.imp / want.need && f.delta === Math.max(-.06, Math.min(.05, (f.rate - .5) * .11)))) bad.push(`預建城起步那一天：${J(f)}`);
    // 同一天、把「加到住宅」那一句拿掉的副本：推進前就在、等級沒變的每一棟住宅，差的剛好是 clamp(h＋加減, .05, 1)
    const V = await dayVariant([['cityHappy = applyFoodHappy(w, tickBld, fd.need, fd.delta, cityHappy);', '']]);
    const s0 = realDay.simFromSave(save, pre, KT, vrank), s3 = V.simFromSave(save, pre, KT, vrank), lv0 = new Map();
    for (let i = 0; i < s0.w.tiles.length; i++) { const b = s0.w.tiles[i].bld; if (b && b.k === 1 && !b.ref) lv0.set(i, b.lv); }
    const r3 = V.stepDay(s3);
    let n = 0, off = 0;
    for (const [i, lv] of lv0) {
      const x = s1.w.tiles[i].bld, y = s3.w.tiles[i].bld;
      if (!x || !y || x.k !== 1 || y.k !== 1 || x.lv !== lv || y.lv !== lv) continue;
      n++;
      if (x.h !== Math.max(.05, Math.min(1, y.h + f.delta))) off++;
    }
    if (!(n >= 5 && off === 0)) bad.push(`拿掉加到住宅那一句的副本：${n} 棟裡有 ${off} 棟的差不是 ${f.delta}（供糧率 ${f.rate}；副本回報 ${J(r3.food)}）`);
    if (r3.food.delta !== f.delta || r3.food.need !== f.need) bad.push('副本的供糧率跟原版不同（糧食的算式不該被拿掉的那一句影響）');
    log(!bad.length, 'D022 接線：day.ts 在垃圾（55278）與住宅重算城市幸福（55284）之後、勞動市場與需求（55329、55578）之前接糧食一次，countFood 在主計數迴圈裡；預建城起步那一天供糧率、每天加減＝算式（額度 3、本地 0、進口 min(3, 需求)）；拿掉「加到住宅」那一句的副本，推進前就在的每一棟住宅幸福差剛好是那一天的加減',
      bad.join('；') || `需求 ${f.need}（人口 ${r.pop}）、進口 ${f.imports}、供糧率 ${f.rate.toFixed(4)}、每天加減 ${f.delta.toFixed(5)}；住宅 ${n} 棟逐棟＝clamp(副本的幸福＋加減)`);
  }

  // ---- 5. 實驗線頁面實跑（驗收 2、3）----
  {
    const lab = JSON.parse(read('src/content/samples/d022-lab.json')), codes = d022Codes();
    const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (J(lab.order) !== J(codes.map(c => c.id))) bad.push('樣本裡城的順序 ≠ tools/d022-lab.mjs d022Codes() 現在的順序（重跑 tools/d022-lab.mjs）');
    const FIELDS = ['pop', 'day', 'sea', 'points', 'tourists', 'resNeed', 'touNeed', 'need', 'domestic', 'short', 'imports', 'served', 'rate', 'cap', 'base', 'cityHappy', 'rail', 'freight', 'ware', 'port', 'preserve', 'se', 'shipCount', 'eff'];
    for (const c of codes) {
      const L = lab.cities[c.id];
      if (!L || !FIELDS.every(k => Number.isFinite(L.probe?.[k])) || !Array.isArray(L.probe.hs)) { bad.push(`${c.id}：樣本欄位不齊`); continue; }
      if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d022-lab.mjs）`);
    }
    const judged = c => c.kind === 'prebuilt' || c.kind === 'judged';   // AI 城原樣（有污水廠與政策）、種子城、全種類樣張城、污水廠碰到工業、物流中心：只量不判
    // 本線自己讀進來、推進一天，逐座比：回傳每座城的 { id, diffs, unported（實驗線有、本線沒搬的輸入）, homes（比了幾棟住宅）}
    const runAll = mod => codes.map(c => {
      const L = lab.cities[c.id], q = L.probe, r = decodeLabCode(c.code);
      if (!r.ok) return { id: c.id, diffs: [`本線解不開碼 ${r.error}`], unported: [], homes: 0 };
      const s = mod.simFromSave(r.save, c.code, KT, vrank), homes = new Map();
      let frt = 0, ware = 0, port = 0;
      for (let i = 0; i < s.w.tiles.length; i++) { const b = s.w.tiles[i].bld; if (!b || b.ref) continue; if (b.k === 110) frt++; if (b.k === 64) ware++; if (b.k === 18) port++; if (b.k === 1) homes.set(i, true); }
      const rep = mod.stepDay(s), f = rep.food, d = [];
      const cmp = (name, mine, theirs) => { if (!Object.is(mine, theirs)) d.push(`${name} 本線 ${mine} ≠ 實驗線 ${theirs}`); };
      cmp('日', rep.day, q.day); cmp('人口', rep.pop, q.pop); cmp('食物量', f.points, q.points); cmp('遊客', f.tourists, q.tourists); cmp('居民需求', f.residentNeed, q.resNeed); cmp('遊客需求', f.touristNeed, q.touNeed);
      cmp('需求', f.need, q.need); cmp('本地供給', f.domestic, q.domestic); cmp('缺口', f.short, q.short); cmp('進口', f.imports, q.imports); cmp('合計供給', f.served, q.served); cmp('供糧率', f.rate, q.rate);
      cmp('額度', f.cap, q.cap); cmp('路格底', f.roadBase, q.base); cmp('效率', f.eff, q.eff); cmp('城市幸福', rep.cityHappy, q.cityHappy);
      let nh = 0, dh = 0; for (const [i, h] of q.hs) { if (!homes.has(i)) continue; nh++; const b = s.w.tiles[i].bld; if (!b || !Object.is(b.h, h)) dh++; }
      if (dh) d.push(`推進前就在的 ${nh} 棟住宅有 ${dh} 棟的幸福不同`);
      // 實驗線有、本線沒搬的輸入：火車線、冷藏庫與穀倉的保存加成、船、物流中心（有效的貨運／倉儲／港口單位比本線數到的多）、污水廠
      const unported = [];
      if (q.rail > 0) unported.push('火車線 T463'); if (q.preserve !== 1) unported.push('食物保存 T485'); if (q.shipCount > 0) unported.push('船 T418');
      if (q.freight !== frt || q.ware !== ware || q.port !== port) unported.push('物流 T485（貨運、倉儲、港口單位）'); if (q.se > 0) unported.push('污水廠 T442');
      const pol = r.save.raw.pol; if (pol && (Object.values(pol).some(v => v === true) || pol.taxR !== 1 || pol.taxC !== 1 || pol.taxI !== 1)) unported.push('政策（存檔裡開著的政策，例如公園夜間開放 +.02）');
      return { id: c.id, diffs: d, unported, homes: nh, q, f, rep };
    });
    const base = runAll(realDay);
    for (const x of base) {
      const c = codes.find(k => k.id === x.id);
      if (judged(c) && x.diffs.length) bad.push(`${x.id}：${x.diffs.slice(0, 3).join('；')}`);
      if (judged(c) && x.unported.length && x.id !== 'D2') bad.push(`${x.id} 要判的城裡有本線沒搬的輸入：${x.unported.join('、')}`);
      if (!judged(c) && !x.unported.length) bad.push(`${x.id} 標成只量不判，但實驗線沒有本線沒搬的輸入（該判）`);
    }
    // 覆蓋：判的城要真的走到各個分支
    const J1 = base.filter(x => judged(codes.find(k => k.id === x.id))), qs = J1.map(x => x.q);
    const cover = {
      '推進前就在的住宅共比': [J1.reduce((a, x) => a + x.homes, 0), 500],
      '進口 > 0 且額度不夠拿（缺口 > 進口）': [qs.filter(q => q.imports > 0 && q.short > q.imports).length, 20],
      '本地不夠、額度夠拿（缺口＝進口 > 0）': [qs.filter(q => q.short > 0 && q.imports === q.short).length, 2],
      '供過於求（供糧率 1、需求 > 0）': [qs.filter(q => q.need > 0 && q.rate === 1).length, 4],
      '需求 0（沒有人）': [qs.filter(q => q.need === 0).length, 1],
      '春': [qs.filter(q => q.sea === 0).length, 5], '夏': [qs.filter(q => q.sea === 1).length, 2], '秋': [qs.filter(q => q.sea === 2).length, 2], '冬': [qs.filter(q => q.sea === 3).length, 2],
      '路格底 0（沒有路）': [qs.filter(q => q.base === 0).length, 1], '路格底 1': [qs.filter(q => q.base === 1).length, 5], '路格底 2': [qs.filter(q => q.base === 2).length, 1], '路格底 6': [qs.filter(q => q.base === 6).length, 1], '路格底 8': [qs.filter(q => q.base === 8).length, 3],
      '額度 > 6（貿易設施的額度）': [qs.filter(q => q.cap > 6).length, 4], '效率 > .78（設施加成）': [qs.filter(q => q.eff > .78).length, 4],
      '遊客 > 0': [qs.filter(q => q.tourists > 0).length, 8], '遊客需求 > 0': [qs.filter(q => q.touNeed > 0).length, 6],
      '本地有食物（食物量 > 0）': [qs.filter(q => q.points > 0).length, 8],
    };
    const dead = Object.entries(cover).filter(([, [n, min]]) => n < min).map(([k, [n, min]]) => `${k} ${n}/${min}`);
    if (dead.length) bad.push(`覆蓋不夠：${dead.join('、')}`);
    // 會展脈衝：C5（第 19 → 20 天）1000 位遊客、C6（第 20 → 21 天）沒有、C7（夏）650
    const tou = id => lab.cities[id]?.probe.tourists;
    if (!(tou('C5') === 1000 && tou('C6') === 0 && tou('C7') === 650)) bad.push(`會展脈衝：C5 ${tou('C5')}（要 1000）、C6 ${tou('C6')}（要 0）、C7 ${tou('C7')}（要 650）`);
    const nMeasure = base.filter(x => !judged(codes.find(k => k.id === x.id)));
    const measureText = nMeasure.map(x => `${x.id}：${x.unported.join('、')}——${x.diffs.length ? x.diffs.slice(0, 2).join('；') : '兩邊剛好相同'}`).join('｜');
    log(!bad.length, `D022 驗收 2、3：實驗線頁面實跑——${codes.length} 座城（預建城 8 個種子、AI 城與拿掉污水廠、政策的 AI 城、種子城、全種類樣張城、自造城 D021 34 座＋D022 糧食 32 座）讀進來推進一天：糧食那一段的食物量、遊客、居民與遊客的需求、本地供給、缺口、進口、合計供給、供糧率、貿易額度與路格底、有效效率、人口、城市幸福、推進前就在的每一棟住宅的幸福，本線自己算的逐項＝實驗線探針（不套任何東西）；`
      + `AI 城原樣（有污水廠與政策）、種子城、全種類樣張城、污水廠碰到工業、物流中心（實驗線有、本線沒搬的輸入）只量不判；AI 城拿掉污水廠與政策（ai120-plain）判`,
      bad.slice(0, 4).join('；') || `判 ${J1.length} 座、比了 ${J1.reduce((a, x) => a + x.homes, 0)} 棟住宅；只量不判 ${nMeasure.length} 座：${measureText.slice(0, 500)}`);

    // 突變：本線的 food.ts 改壞一處，這批要紅（沒改的先核過全等）
    const src = read('src/sim/rules/food.ts');
    const load = t => { const js = stripTypeScriptTypes(t).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''); const ctx = vm.createContext({ ...labHelpers });
      vm.runInContext(js + '\nglobalThis.__m={emptyFoodCount,countFood,foodDay,applyFoodHappy};', ctx); return ctx.__m; };
    const LIVE_MUT = [
      ['農場 ×3→×4', 'c.farmFoodU += (b.lv || 1) * 3;', 'c.farmFoodU += (b.lv || 1) * 4;'],
      ['大農場 ×20→×21', 'c.farmFoodU += (b.lv || 1) * 20;', 'c.farmFoodU += (b.lv || 1) * 21;'],
      ['冬季農場倍率 0.4→0.5', '[1, 1.15, 1.4, 0.4]', '[1, 1.15, 1.4, 0.5]'],
      ['秋季農場倍率 1.4→1.5', '[1, 1.15, 1.4, 0.4]', '[1, 1.15, 1.5, 0.4]'],
      ['溫室 ×6→×7', 'c.ghFoodU += (b.lv || 1) * 6;', 'c.ghFoodU += (b.lv || 1) * 7;'],
      ['動物園 45→46', 'c.zo * 45', 'c.zo * 46'],
      ['夏季觀光 1.3→1.4', '[1, 1.3, 1.2, 0.85]', '[1, 1.4, 1.2, 0.85]'],
      ['會展中心 500→501', 'Math.round(500 * c.cvN', 'Math.round(501 * c.cvN'],
      ['道路底 80→81', 'roads / 80', 'roads / 81'],
      ['道路底封頂 8→7', 'Math.min(8, 1 + Math.floor', 'Math.min(7, 1 + Math.floor'],
      ['額度最少 3→2', 'roads > 0 ? 3 : 0', 'roads > 0 ? 2 : 0'],
      ['貿易站 ×4→×5', 'c.tp336 * 4', 'c.tp336 * 5'],
      ['港口 ×4→×5', 'portEquivalent * 4', 'portEquivalent * 5'],
      ['倉儲 ×2→×3', 'warehouseUnits * 2', 'warehouseUnits * 3'],
      ['倉儲的效率加成 .022→.03', 'warehouseUnits * .022', 'warehouseUnits * .03'],
      ['居民需求 10→11', 'Math.ceil(pop / 10)', 'Math.ceil(pop / 11)'],
      ['遊客需求 160→161', 'Math.ceil(tourists / 160)', 'Math.ceil(tourists / 161)'],
      ['中性點 .50→.55', '(rate - .50)', '(rate - .55)'],
      ['加成上限 .05→.06', '-.06, .05)', '-.06, .06)'],
      ['需求 0 也加', 'if (!(need > 0)) return cityHappy;', ''],
    ];
    const missed = [], out = [];
    const variantOf = async food => dayVariant([], { './rules/food.ts': food, './rules/count.ts': await loadMod('src/sim/rules/count.ts', [], { './food.ts': food }) });   // D024：countFood 在 count.ts 裡被叫，改壞的 food.ts 要接到 count.ts 上
    const V0 = await variantOf(load(src)), ok0 = runAll(V0).filter(x => judged(codes.find(k => k.id === x.id)) && x.diffs.length);
    for (const [name, from, to] of LIVE_MUT) {
      if (src.split(from).length !== 2) { missed.push(`「${name}」錨點不唯一（${src.split(from).length - 1}）`); continue; }
      let V; try { V = await variantOf(load(src.replace(from, to))); } catch (e) { missed.push(`「${name}」載入失敗 ${e.message}`); continue; }
      const dd = runAll(V).filter(x => judged(codes.find(k => k.id === x.id)) && x.diffs.length).length;
      out.push(`${name}：${dd} 座不等`);
      if (!dd) missed.push(`「${name}」`);
    }
    log(!ok0.length && !missed.length, `D022 驗收 2、3 突變：本線的 food.ts 改壞一處（${LIVE_MUT.length} 個：農場與溫室係數、四季倍率、觀光係數與季節、會展、路格底與封頂、額度最少、各設施的額度與效率加成、居民與遊客需求、中性點、夾持、需求 0）——實驗線實跑的這批城要紅；沒改的先核過全等`,
      missed.length ? `沒抓到：${missed.join('、')}` : ok0.length ? `沒改的副本就有 ${ok0.length} 座不等：${ok0[0].id} ${ok0[0].diffs[0]}` : out.map(t => t.replace(/：.*座不等/, m => m.replace('：', ' '))).join('；').slice(0, 900));
  }
}
