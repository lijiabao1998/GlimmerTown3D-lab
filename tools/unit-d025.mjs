// D025 Node 守衛：經濟（一）——共享貿易池、商品庫存、零售與購買力、經濟快照、稅率乘數、進口費（驗收 1、2、6，及接線、存檔）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d025-economy.json（tools/lab-economy.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；常數（六商品表、深加工與船與太空研究中心與供應品的常數）跟本線相同；
//   2. 逐項＝實驗線：實驗線原文（T485 單位與食物與遊客〔D022 的段〕、T364b 深加工鏈、T481／T482 經濟、煉鋼廠加速施工、燃料與鋼材出口與出口金、快照，加上它們讀的常數與函式）在 vm 裡，
//      跟本線 src/sim/rules/economy.ts（economyMain、steelConstruction、economyLate、economySnapshots）與 food.ts、logistics.ts 吃同一批隨機輸入、連跑三天（庫存、船、快照跨日帶）：
//      每個中間量（實驗線那一段的每一個區域變數，同名）、庫存與船與倉容量、資金（太空研究中心）、施工中房屋的屋齡、快照三份（economy481、economy482、logistics485）每一步都逐位相等；
//      55262–55266 資源回收廠產貨物另跑一組；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（池的順序、每一個進口與出口的條件與係數、償付能力、每個乘數的係數與夾值、船兌換、太空研究中心、季節價格……），沒改的先核過全等；
//   4. 接線與存檔、實驗線頁面實跑：見檔案後半。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import * as LOGI from '../src/sim/rules/logistics.ts';
import * as FOOD from '../src/sim/rules/food.ts';
import * as ECON from '../src/sim/rules/economy.ts';
import * as JOBS from '../src/sim/rules/jobs.ts';
import { laborMarket481 as portLabor } from '../src/sim/rules/demand.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['GOODS_IMPORT_COST481', 'COMMODITY_META482', 'INDUSTRY_SUPPLY_UNIT', 'INDUSTRY_SUPPLY_BOOST', 'FUEL_INDUSTRY_TAX_MUL', 'SHIPYARD_STEEL_USE', 'FREIGHT_FUEL_USE', 'SHIP_STEEL', 'MEGAPROJECT_CYCLE_DAYS',
  'goodsCap283', 'foodPriceOf', 'laborMarket481', 'wealthPower481', 'purchasingPower481', 'externalPrice482', 'commoditySupply482', 'businessCycleConsumptionMul490', 'gpnExportDemand508',
  'recycle', 'chain', 'economy', 'steelCons', 'lateFood', 'lateFoodPrice', 'lateFuel', 'lateGas', 'lateSteel', 'snapshot'];
const KEY = { recycle: 'tick 資源回收廠產貨物', chain: 'tick T364b 深加工鏈', economy: 'tick T481／T482 經濟', steelCons: 'tick 煉鋼廠加速施工', lateFood: 'tick 食物出口金', lateFoodPrice: 'tick 食物價格快照',
  lateFuel: 'tick 燃料出口', lateGas: 'tick 天然氣出口金', lateSteel: 'tick 鋼材出口', snapshot: 'tick 經濟快照' };   // 樣本 pieces 的名字 → text 的鍵
// 舊段落（D022 的 d022-food.json）：食物、觀光、單位（econ）、計數宣告（lets）與實驗線的小工具與企業層、gpn 的函式
const FROM22 = ['clamp', 'spec386', 'sq', 'FARM_SEASON_MULT', 'TOUR_SEASON_MULT', 'foodPoints', 'tourists', 'logisticsEfficiency481', 'CONVENTION_PULSE_DAYS', 'REFINERY_RATE', 'enterpriseTypeUtilization489',
  'enterpriseEffectiveCount489', 'gpnTradeCapacityMul508', 'gpnImportAvailability508'];

export async function d025Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D025 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 輸入的名字 ----
const LOGI_OP = ['clOp485', 'imOp485', 'dcOp485', 'coldOp485', 'siloOp485', 'fuelDepOp485', 'gasDepOp485', 'steelYOp485', 'bulkOp485', 'cportOp485'];
const LOGI_BUILT = ['cl485', 'im485', 'dc485', 'cold485', 'silo485', 'fuelDep485', 'gasDep485', 'steelY485', 'bulk485', 'cport485'];
const ECON_C = ['whN284', 'frt342', 'po', 'whCap284', 'nIndG284', 'nComG284', 'tp336', 'kt346', 'mk330', 'br340', 'procCapU', 'gw346', 'fp346', 'fpN', 'refineryN', 'steelMillN', 'shipyardN', 'mgN', 'oilGain', 'oreGain', 'suppliesGain'];
const FOOD_KEYS = Object.keys(FOOD.emptyFoodCount());
const ALL_C = [...new Set([...LOGI_OP, ...LOGI_BUILT, ...ECON_C, ...FOOD_KEYS])];

// 實驗線那一邊：原文在 vm 裡（strict）。樁：企業層沒就緒（利用率 1）、gpn 關、商業循環關、沒有政策與城市事件、火車線長度由輸入給、發電調度由輸入給、資源回收與污水不在這一段、
// 住宅居民用本線的 residentPopulation488（它 D021 已經逐項對過）、道路容量由格子給。計數宣告（D022 的 lets）之後，逐日：塞計數→單位與食物與遊客→深加工鏈→經濟→施工→出口→快照
function makeLab(T) {
  const ctx = vm.createContext({});
  ctx.residentPopulation488 = (i, b) => JOBS.residentPopulation488(b, () => undefined);
  ctx.roadCap475 = t => t.cap;
  ctx.powerGasDispatch482 = () => ctx.__gasDispatch;
  const top = [...FROM22.map(n => T[n]), ...['GOODS_IMPORT_COST481', 'COMMODITY_META482', 'INDUSTRY_SUPPLY_UNIT', 'INDUSTRY_SUPPLY_BOOST', 'FUEL_INDUSTRY_TAX_MUL', 'SHIPYARD_STEEL_USE', 'FREIGHT_FUEL_USE', 'SHIP_STEEL', 'MEGAPROJECT_CYCLE_DAYS',
    'goodsCap283', 'foodPriceOf', 'laborMarket481', 'wealthPower481', 'purchasingPower481', 'externalPrice482', 'commoditySupply482', 'businessCycleConsumptionMul490', 'gpnExportDemand508'].map(n => T[n])].join('\n');
  const NAMES = OUT_LOCALS.join(',');
  vm.runInContext(`'use strict';let N=1,tiles=[],tickBld=[],tickRoad=[],day=1,sea=0,pop=0,jobs=0,money=0,cityHappy=.6;
let goods=0,gWhCap284=0,supplies=0,fuel=0,steel=0,shipCount=0,shipProgress=0,gMade384=0,gasSup=0,gasDem=0,gasRatio=1,gFlow284={gain:0,use:0,mul:1};
let fuelMade=0,steelMade=0,steelUsed=0,fuelTaxMul=1,freightTaxMul=1,steelTaxMul=1,shipTradeTaxMul=1,shipPortGold=0,shipDailyGold418=0,fuelUse418=0,fuelExport418=0,constrSteelUse418=0,steelDisc418=false;
${T.lets}
let economy481={ready:false},economy482=null,logistics485=null,income=0,upkeep=0,taxR=0,taxC=0,taxI=0,roadLoad=[],__bump=[];
const window={__noGpn508:true,__noBusinessCycle490:true},toast=()=>{},sFanfare=()=>{},townName='',enterprise489={ready:false},railLines463=[],pol=null,CITY_EVENTS=[{food:1.5},{food:.7},{food:1.1},{food:.9}],RECIPES482=[];let cityEvent=null;   // 城市活動（T299）：食物加成的四種（豐收 1.5、乾旱 .7、慶典 1.1、科技展 .9）
${top}
function __between(){for(const i of __bump){const b=tiles[i].bld;if(b&&!b.ref&&b.age<9)b.age=9;}}   // 經濟數完施工中的房屋之後、加速施工之前，成長階段讓一部分房屋蓋好（屋齡到 9）
function __day(){
constrSteelUse418=0;
${T.econ}
${T.chain}
${T.economy}
__between();
if(steelMillN>0){
${T.steelCons}
}
}
${T.lateFood}
${T.lateFuel}
${T.lateGas}
${T.lateFoodPrice}
${T.lateSteel}
${T.snapshot}
return {${NAMES},economy481:(({finance,...r})=>r)(economy481),economy482:(({recipes,...r})=>r)(economy482),logistics485,goods,supplies,fuel,steel,shipCount,shipProgress,gWhCap284,money,constrSteelUse418,ages:tickBld.map(i=>tiles[i].bld.ref?null:tiles[i].bld.age)};
}
globalThis.__api={
  init:(n,ts,rl)=>{N=n;tiles=ts;tickBld=[];tickRoad=[];roadLoad=rl;railLines463.length=0;economy481={ready:false};economy482=null;logistics485=null;for(let i=0;i<n*n;i++){if(ts[i].bld)tickBld.push(i);if(ts[i].road)tickRoad.push(i);}},
  state:s=>{goods=s.goods;supplies=s.supplies;fuel=s.fuel;steel=s.steel;shipCount=s.shipCount;shipProgress=s.shipProgress;gWhCap284=s.gWhCap;},
  day:(d,c)=>{__bump=d.bump||[];cityEvent=d.ev==null?null:{i:d.ev};day=d.day;sea=d.sea;pop=d.pop;jobs=d.jobs;money=d.money;cityHappy=d.happy;spec386=d.spec;globalThis.__gasDispatch=d.gas;railLines463.length=d.rail;
    ${ALL_C.map(n => `${n}=(c.${n}||0);`).join('')}
    return __day();},
};`, ctx, { filename: 'lab:economy' });
  return ctx.__api;
}
// 每一步要比的名字（實驗線那一段的區域變數，跟本線 ctx 的鍵同名；U 攤平、fd 與 mgReward 不比：前者是單位的別名、後者在資金）
const OUT_LOCALS = (() => {
  const st = ECON.emptyEconState(), c = {}, fc = FOOD.emptyFoodCount();
  const ec = ECON.economyMain(st, { day: 1, sea: 0, pop: 0, jobs: 0, cityHappy: .6, money: 0, spec: null, roads: 0, c, fc, labor: portLabor(0, 0, null, 1), wealth: 1, activeConstruction: 0 });
  const late = ECON.economyLate(st, ec, c), sn = ECON.economySnapshots(st, ec, late, c, 1, 0);
  return [...Object.keys(ec.U), ...Object.keys(ec).filter(k => !['U', 'fd', 'mgReward'].includes(k)), ...Object.keys(late),
    ...Object.keys(sn).filter(k => !['economy481', 'economy482', 'logistics485'].includes(k))];
})();

// 本線那一邊（economy.ts；突變時傳改壞的一份）
function makeMine(M = { econ: ECON, food: FOOD }) {
  let w = null, order = [], roadIdx = [], load = [], st = null;
  return {
    init: (n, ts, rl) => { w = { N: n, tiles: ts }; order = []; roadIdx = []; load = rl; for (let i = 0; i < n * n; i++) { if (ts[i].bld) order.push(i); if (ts[i].road) roadIdx.push(i); } st = M.econ.emptyEconState(); },
    state: s => { st.goods = s.goods; st.supplies = s.supplies; st.fuel = s.fuel; st.steel = s.steel; st.shipCount = s.shipCount; st.shipProgress = s.shipProgress; st.gWhCap = s.gWhCap; },
    day: (d, c) => {
      const fc = {}; for (const k of FOOD_KEYS) fc[k] = c[k] || 0;
      const labor = portLabor(d.pop, d.jobs, null, d.day), wealth = M.econ.wealthPower481(w, order, d.pop), act = M.econ.activeConstruction482(w, order);
      let sum = 0, nn = 0, over = 0;
      for (const i of roadIdx) { const t = w.tiles[i]; const cap = t.cap || 1, r = (load[i] || 0) / cap; sum += Math.min(2, r); nn++; if (r > 1) over++; }
      const roadStats = { avg: nn ? sum / nn : 0, over: nn ? over / nn : 0 };
      const ec = M.econ.economyMain(st, { day: d.day, sea: d.sea, pop: d.pop, jobs: d.jobs, cityHappy: d.happy, money: d.money, spec: d.spec || null, roads: roadIdx.length, roadStats, railLines: d.rail, gasPowerDispatch: d.gas, eventFood: d.ev == null ? undefined : [1.5, .7, 1.1, .9][d.ev], c, fc, labor, wealth, activeConstruction: act });
      const money = d.money + ec.mgReward;
      for (const i of d.bump || []) { const b = w.tiles[i].bld; if (b && !b.ref && b.age < 9) b.age = 9; }
      const cons = M.econ.steelConstruction(st, c.steelMillN || 0, w, order, d.day);
      const late = M.econ.economyLate(st, ec, c), sn = M.econ.economySnapshots(st, ec, late, c, d.day, cons);
      st.snap = sn.economy481;
      const out = {};
      for (const k of OUT_LOCALS) out[k] = k in ec.U ? ec.U[k] : k in ec ? ec[k] : k in late ? late[k] : sn[k];
      return { ...out, economy481: sn.economy481, economy482: sn.economy482, logistics485: sn.logistics485, goods: st.goods, supplies: st.supplies, fuel: st.fuel, steel: st.steel, shipCount: st.shipCount, shipProgress: st.shipProgress,
        gWhCap284: st.gWhCap, money, constrSteelUse418: cons, ages: order.map(i => w.tiles[i].bld.ref ? null : w.tiles[i].bld.age) };
    },
  };
}

// 隨機輸入。家族：small（小圖少量）、econ（工商多、零售與供應品）、shop（零售缺貨：額度大、人口小、鋼與供應品庫存夠，貨物才進得到口）、logi（物流九種、船、港口）、food（食物加工鏈）、steel（煉鋼廠、造船廠、煉油廠）、mega（太空研究中心）、roads（路很多：門檻兩側）、rich（什麼都有）、
// yard（造船廠與煉鋼廠、施工中的房屋多、鋼庫存在目標與保留量之間、船進度接近 30：船兌換的餘數、鋼進口同一天不出口；經濟與加速施工之間屋齡會變）、heavy（物流九種各 4–12 座：貨運單位過 60，燃料缺口超過庫存上限 120）、
// pricey（沒有路也沒有工業＝貨物缺貨率 1，外部價高的日子價格頂到上限）、jam（路很擠：效率壓到 .45、國內配送不夠 → 缺貨進口；庫存又高過留存量 → 貨物出口的條件同一天成立）
// 貨物的外部價（最大 1.12）最高的那幾天：缺貨率 1 時貨物價 ＝ 外部價×1.18 才會超過上限 1.32
const HOT_GOODS = (() => { const h = []; for (let d = 3; d <= 2000; d++) if (ECON.externalPrice482('goods', d, 0) >= 1.118) h.push(d); return h; })();
const FAMS = ['small', 'econ', 'logi', 'food', 'steel', 'mega', 'roads', 'rich', 'shop', 'yard', 'heavy', 'pricey', 'jam'];
function cases25(count = 1040) {
  const out = [], R = mulberry32(20261202), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)], f3 = () => Math.round(R() * 1000) / 1000;
  for (let m = 0; m < count; m++) {
    const fam = FAMS[m % FAMS.length], N = fam === 'roads' ? int(24, 30) : fam === 'yard' ? int(7, 12) : int(5, 12);
    const tiles = Array.from({ length: N * N }, () => ({ t: 2, bld: null })), at = (x, y) => tiles[y * N + x];
    // 路：road 家族鋪到門檻兩側（路底 1＋floor(n/80)：79／80／81、159／160／161…），其餘 0 到 50 格
    const target = fam === 'pricey' ? 0 : fam === 'jam' ? int(15, 60) : fam === 'roads' ? pick([0, 1, 79, 80, 81, 159, 160, 161, 239, 240, 320, 400, 479, 480, 559, 560, 640, int(100, N * N - 30)]) : ch(.15) ? 0 : int(1, Math.min(50, Math.floor(N * N / 3)));
    let roads = 0;
    for (let g = 0; g < 3000 && roads < target; g++) {
      const hz = ch(.5), a = int(0, N - 1), b0 = int(0, N - 1), len = int(2, N);
      for (let q = 0; q < len && roads < target; q++) { const x = hz ? Math.min(N - 1, b0 + q) : a, y = hz ? a : Math.min(N - 1, b0 + q); if (!at(x, y).road) { at(x, y).road = 1; at(x, y).cap = fam === 'jam' ? pick([1, 1, 2]) : pick([1, 2, 3, 4, 6, 8, 12]); roads++; } }
    }
    const load = new Array(N * N).fill(0);
    if (fam === 'jam') { for (let i = 0; i < N * N; i++) if (tiles[i].road) load[i] = 1 + f3() * 3; }   // 每一格都過載
    else if (ch(.5)) for (let i = 0; i < N * N; i++) if (tiles[i].road && ch(.7)) load[i] = R() < .3 ? f3() * 30 : f3() * 3;   // 壅堵：有的過載、有的不
    // 建築（住宅與塔與巨廈給財富力、其他種類給施工中的房屋數；屋齡 0–12）
    const put = (k, extra, sz) => {
      for (let a = 0; a < 30; a++) {
        const x = int(0, N - 1), y = int(0, N - 1); let free = x + sz <= N && y + sz <= N;
        for (let dy = 0; dy < sz && free; dy++) for (let dx = 0; dx < sz; dx++) { const q = at(x + dx, y + dy); if (q.road || q.bld) { free = false; break; } }
        if (!free) continue;
        at(x, y).bld = { k, lv: int(1, 3), v: 0, age: int(0, 12), h: .6, ...(sz > 1 ? { sz } : {}), ...extra };
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) at(x + dx, y + dy).bld = { k, ref: [x, y] };
        return true;
      }
      return false;
    };
    const mix = fam === 'rich' ? [.30, .45, .60, .70] : [.5, .6, .68, .74];   // 累積機率：住宅、社宅、塔、巨廈（財富力的權重要多吃到）
    const nb = fam === 'yard' ? int(12, Math.min(40, Math.floor(N * N / 3))) : int(0, Math.min(40, Math.floor(N * N / 4)));
    for (let q = 0; q < nb; q++) {
      const r = R();
      if (r < mix[0]) put(1, { den: int(1, 5), we: ch(.2) ? undefined : int(0, 2), pw: ch(.8) }, 1);
      else if (r < mix[1]) put(127, { pw: ch(.8), wa: ch(.8) }, 2);   // 社宅要有電也要有水才算居民（residentEligible488）
      else if (r < mix[2]) put(33, { pw: true }, 2); else if (r < mix[3]) put(105, { pw: true }, 3);
      else put(pick([2, 3, 122, 123, 64, 110, 91, 18, 49, 50]), { pw: ch(.8) }, 1);
    }
    // 計數
    const c = {};
    const big = () => ch(.4) ? 0 : int(1, 6), small = () => ch(.55) ? 0 : int(1, 3);
    for (const k of ECON_C) c[k] = 0;
    for (const k of LOGI_OP) c[k] = 0;
    if (fam === 'econ' || fam === 'rich' || fam === 'small') { c.nIndG284 = ch(.3) ? 0 : int(1, 40); c.nComG284 = ch(.3) ? 0 : int(1, 40); c.whCap284 = ch(.5) ? 0 : 120 * int(1, 4); c.whN284 = small(); }
    if (fam === 'econ') { c.tp336 = ch(.3) ? 0 : int(2, 8); c.po = small(); c.frt342 = small(); }   // 額度夠大，糧食、鋼材吃完還有剩，供應品與貨物才進得到口
    if (fam === 'shop') { c.tp336 = int(5, 14); c.po = small(); c.nComG284 = int(1, 30); c.nIndG284 = ch(.5) ? 0 : int(1, 10); c.whCap284 = ch(.5) ? 0 : 120 * int(1, 3); }
    if (fam === 'logi' || fam === 'rich') {
      for (let q = 0; q < LOGI_OP.length; q++) { const built = big(); c[LOGI_BUILT[q]] = built; c[LOGI_OP[q]] = ch(.3) ? 0 : int(0, built); }
      c.tp336 = big(); c.po = big(); c.frt342 = small(); c.whN284 = small(); c.nIndG284 = ch(.5) ? 0 : int(1, 20); c.nComG284 = ch(.5) ? 0 : int(1, 20);
    }
    if (fam === 'food' || fam === 'rich') {
      c.farmFoodU = ch(.4) ? 0 : int(1, 300); c.ranchFoodU = small() * 3; c.ghFoodU = small() * 6; c.fp340 = small(); c.cg340 = small(); c.ff346 = small();
      c.kt346 = small(); c.mk330 = small(); c.br340 = small(); c.procCapU = ch(.5) ? 0 : 40 * int(1, 5); c.gw346 = small(); c.fp346 = small(); c.fpN = small(); c.tp336 = big(); c.po = small();
      c.la = small(); c.cvN = small(); c.mu = small(); c.tourLm309 = ch(.5) ? 0 : int(1, 100);
      for (let q = 0; q < LOGI_OP.length; q++) { const built = small(); c[LOGI_BUILT[q]] = built; c[LOGI_OP[q]] = ch(.5) ? 0 : int(0, built); }
    }
    if (fam === 'steel' || fam === 'rich') {
      c.refineryN = small(); c.steelMillN = small(); c.shipyardN = small(); c.oilGain = ch(.5) ? 0 : int(1, 12); c.oreGain = ch(.5) ? 0 : int(1, 12); c.suppliesGain = ch(.6) ? 0 : int(1, 20);
      c.po = big(); c.tp336 = small(); c.nIndG284 = ch(.5) ? 0 : int(1, 15); c.nComG284 = small();
      for (let q = 0; q < LOGI_OP.length; q++) { const built = small(); c[LOGI_BUILT[q]] = built; c[LOGI_OP[q]] = ch(.5) ? 0 : int(0, built); }
    }
    if (fam === 'mega' || fam === 'rich') { c.mgN = int(1, 3); c.nIndG284 = int(3, 30); c.po = small(); c.tp336 = big(); c.suppliesGain = ch(.5) ? 0 : int(20, 200); }
    if (fam === 'roads') { c.tp336 = small(); c.po = small(); c.frt342 = small(); c.whN284 = small(); c.nComG284 = small() * 2; c.nIndG284 = small() * 3; }
    if (fam === 'yard') {   // 造船廠 1–5、煉鋼廠多半有：鋼目標＝施工需求＋造船廠＋12，保留量＝max(18, 施工需求＋造船廠×3)；港口至少 1（船才造得出來）、貿易站讓額度夠鋼進口之後還有剩
      c.shipyardN = int(1, 5); c.steelMillN = ch(.75) ? int(1, 3) : 0; c.refineryN = small(); c.oilGain = ch(.5) ? 0 : int(1, 12); c.oreGain = ch(.5) ? 0 : int(1, 12);
      c.po = int(1, 4); c.tp336 = int(1, 6); c.nIndG284 = small() * 2; c.nComG284 = small();
      for (let q = 0; q < LOGI_OP.length; q++) { const built = small(); c[LOGI_BUILT[q]] = built; c[LOGI_OP[q]] = ch(.5) ? 0 : int(0, built); }
    }
    if (fam === 'jam') { c.nComG284 = int(10, 40); c.tp336 = int(3, 8); c.po = small(); c.whCap284 = 120 * int(1, 4); c.whN284 = small(); c.nIndG284 = ch(.5) ? 0 : int(1, 10); }
    if (fam === 'pricey') { c.nComG284 = int(3, 30); c.nIndG284 = 0; }   // 沒路沒貿易額度、沒有工業產貨物：零售缺貨率 1
    if (fam === 'heavy') {   // 物流九種各 4–12 座（運作中的座數＝建成數或少 2 座）：貨運單位過 60 → 每天耗油 2×單位 超過庫存上限 120
      for (let q = 0; q < LOGI_OP.length; q++) { const built = int(4, 12); c[LOGI_BUILT[q]] = built; c[LOGI_OP[q]] = int(built - 2, built); }
      c.fuelDepOp485 = ch(.8) ? 0 : int(1, 2); c.tp336 = big(); c.po = small(); c.frt342 = small();
    }
    const fresh = () => ({ goods: ch(.4) ? 0 : ch(.2) ? 60 + int(0, 400) : int(0, 90) + (ch(.5) ? .5 : 0), supplies: ch(.4) ? 0 : ch(.5) ? int(0, 300) : int(0, 30) + f3(), fuel: ch(.4) ? 0 : ch(.25) ? int(1, 3) : int(0, 260), steel: ch(.4) ? 0 : ch(.25) ? int(1, 3) : int(0, 260),
      shipCount: ch(.6) ? 0 : int(0, 8), shipProgress: ch(.6) ? 0 : int(0, 29), gWhCap: ch(.5) ? 0 : 120 * int(0, 5) });
    const s0 = fresh();
    if (fam === 'econ') s0.goods = ch(.6) ? 0 : s0.goods;
    if (fam === 'shop') { s0.goods = ch(.7) ? 0 : int(0, 20); s0.steel = int(12, 120); s0.supplies = ch(.5) ? 0 : int(20, 200); }
    if (fam === 'mega') s0.supplies = ch(.7) ? int(150, 400) : s0.supplies;
    if (fam === 'yard') { s0.steel = int(0, 26); s0.shipProgress = ch(.7) ? int(26, 29) : int(0, 29); s0.shipCount = int(0, 4); s0.fuel = int(0, 30); }
    if (fam === 'heavy') s0.fuel = ch(.5) ? 0 : int(0, 40);
    if (fam === 'jam') { s0.goods = int(120, 460); s0.gWhCap = 120 * int(1, 4); }
    const steps = [], bldIdx = [];
    for (let i = 0; i < N * N; i++) if (tiles[i].bld && !tiles[i].bld.ref) bldIdx.push(i);
    let day0 = fam === 'pricey' ? pick(HOT_GOODS) - int(0, 2) : ch(fam === 'mega' ? .8 : .3) ? 24 * int(1, 20) - (ch(.7) ? 0 : int(0, 1)) : int(1, 900);
    for (let s = 0; s < 3; s++) {
      const day = day0 + s, pop = ch(.1) ? 0 : ch(.2) ? int(1, 60) : fam === 'econ' ? int(60, 1500) : fam === 'shop' || fam === 'yard' ? int(0, 300) : fam === 'jam' ? int(1500, 6000) : int(60, 6000);
      steps.push({ day, sea: int(0, 3), pop, jobs: ch(.1) ? 0 : int(0, Math.max(1, Math.round(pop * .9))), happy: f3(), money: ch(.2) ? -int(1, 500) : ch(.08) ? 0 : int(0, 3000), spec: ch(.2) ? 'ind' : '', gas: ch(.7) ? 0 : int(1, 300), rail: ch(.7) ? 0 : int(1, 4), ev: ch(.15) ? int(0, 3) : null,
        bump: fam === 'yard' || fam === 'steel' ? (ch(.5) ? bldIdx : bldIdx.filter(() => ch(.5))) : [] });
    }
    out.push({ fam, N, tiles, load, roads, c, s0, steps });
  }
  return out;
}
const clone = tiles => tiles.map(t => ({ ...t, bld: t.bld ? { ...t.bld, ...(t.bld.ref ? { ref: [...t.bld.ref] } : {}) } : null }));

// 資源回收廠產貨物（55262–55266）：實驗線那一段在 vm 裡。sanLocal452（逐區清運）跟 san445.formal（正式清運）是兩個旗標：正式清運但不是逐區時（legacy）走舊式那一支、讀 activeByK[111]
function makeRecycleLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';let goods=0,gWhCap284=0,sanLocal452=false,sanDistricts452=[],san445={formal:false,activeByK:{}},garbage=0,upc342=0;
${T.goodsCap283}
globalThis.__r=a=>{goods=a.goods;gWhCap284=a.gWhCap;sanLocal452=a.formal&&!a.legacy;sanDistricts452=a.districts;san445={formal:a.formal,activeByK:a.activeByK};garbage=a.garbage;upc342=a.upc;
${T.recycle}
return goods;};`, ctx, { filename: 'lab:recycle' });
  return ctx.__r;
}
// 4,000 組固定種子的輸入：正式清運（逐區或 legacy）、舊式、每區的回收廠數與垃圾需求、貨物與昨天的倉容量
const recycleCases = () => {
  const R = mulberry32(20261203), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, out = [];
  for (let m = 0; m < 4000; m++) {
    const formal = ch(.5), legacy = formal && ch(.3), districts = Array.from({ length: int(0, 4) }, () => ({ byK: ch(.7) ? { 111: int(0, 3) } : {}, demand: ch(.2) ? 0 : R() * 100 })), activeByK = ch(.7) ? { 111: int(0, 6) } : {};
    out.push({ goods: ch(.4) ? 0 : R() * 200, gWhCap: ch(.4) ? 0 : 120 * int(0, 3), formal, legacy, districts, activeByK, garbage: R() * 800, upc: int(0, 6) });
  }
  return out;
};
const recycleMine = M => a => { const st = M.emptyEconState(); st.goods = a.goods; st.gWhCap = a.gWhCap; M.recycleGoods(st, { formal: a.formal, activeByK: a.activeByK, districts: a.districts }, a.garbage, a.upc, a.legacy); return st.goods; };

async function guards(log) {
  const S25 = JSON.parse(read('src/content/samples/d025-economy.json')), S22 = JSON.parse(read('src/content/samples/d022-food.json')), T = { ...S22.text, ...S25.text };

  // ---- 1. 出處與常數 ----
  {
    const bad = [], names = (S25.pieces ?? []).map(p => p.name), want = PIECES.map(n => KEY[n] ?? n);
    if (S25.source?.commit !== PINNED) bad.push(`commit ${S25.source?.commit}`);
    if (J(names) !== J(want)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S25.pieces ?? []) {
      const txt = S25.text[Object.keys(KEY).find(k => KEY[k] === p.name) ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    const lab = vm.runInNewContext(`${T.GOODS_IMPORT_COST481}\n${T.COMMODITY_META482}\n${T.INDUSTRY_SUPPLY_UNIT}\n${T.INDUSTRY_SUPPLY_BOOST}\n${T.REFINERY_RATE}\n${T.FUEL_INDUSTRY_TAX_MUL}\n${T.SHIPYARD_STEEL_USE}\n${T.FREIGHT_FUEL_USE}\n${T.SHIP_STEEL}\n${T.MEGAPROJECT_CYCLE_DAYS}\n`
      + `({g:[GOODS_IMPORT_COST481,GOODS_EXPORT_PRICE481],m:COMMODITY_META482,u:[INDUSTRY_SUPPLY_UNIT,INDUSTRY_SUPPLY_BOOST],r:[REFINERY_RATE,STEEL_MILL_RATE,FUEL_STOCK_CAP,STEEL_STOCK_CAP],`
      + `t:[FUEL_INDUSTRY_TAX_MUL,FUEL_FREIGHT_TAX_MUL,STEEL_INDUSTRY_TAX_MUL],s:[SHIPYARD_STEEL_USE,SHIPYARD_TRADE_TAX_MUL,SHIPYARD_PORT_GOLD],f:[FREIGHT_FUEL_USE,FUEL_EXPORT_RATE],h:[SHIP_STEEL,SHIP_PORT_CAP,SHIP_DAILY_GOLD],`
      + `e:[MEGAPROJECT_CYCLE_DAYS,MEGAPROJECT_SUPPLY_COST,MEGAPROJECT_REWARD]})`);
    const meta = Object.fromEntries(Object.entries(lab.m).map(([k, v]) => [k, { nm: v.nm, importPrice: v.importPrice, exportPrice: v.exportPrice, phase: v.phase }]));
    const mine = [[ECON.GOODS_IMPORT_COST481, ECON.GOODS_EXPORT_PRICE481], ECON.COMMODITY_META482, [ECON.INDUSTRY_SUPPLY_UNIT, ECON.INDUSTRY_SUPPLY_BOOST], [ECON.REFINERY_RATE, ECON.STEEL_MILL_RATE, LOGI.FUEL_STOCK_CAP, LOGI.STEEL_STOCK_CAP],
      [ECON.FUEL_INDUSTRY_TAX_MUL, ECON.FUEL_FREIGHT_TAX_MUL, ECON.STEEL_INDUSTRY_TAX_MUL], [ECON.SHIPYARD_STEEL_USE, ECON.SHIPYARD_TRADE_TAX_MUL, ECON.SHIPYARD_PORT_GOLD], [ECON.FREIGHT_FUEL_USE, ECON.FUEL_EXPORT_RATE],
      [ECON.SHIP_STEEL, ECON.SHIP_PORT_CAP, ECON.SHIP_DAILY_GOLD], [ECON.MEGAPROJECT_CYCLE_DAYS, ECON.MEGAPROJECT_SUPPLY_COST, ECON.MEGAPROJECT_REWARD]];
    const labs = [lab.g, meta, lab.u, lab.r, lab.t, lab.s, lab.f, lab.h, lab.e];
    labs.forEach((x, i) => { if (J(x) !== J(mine[i])) bad.push(`常數 #${i}：實驗線 ${J(x)}≠本線 ${J(mine[i])}`); });
    log(!bad.length, `D025 經濟原文：實驗線 ${PINNED.slice(0, 7)} 的 ${PIECES.length} 段（六商品表 38278、貨物與進出口價 38261、庫存與深加工與船與太空研究中心的常數 39449–39660、貨物倉容量 38202、農產價格 38203、勞動市場 38264、財富力 38268、購買力 38270、外部價格 38298、商品欄 38299、`
      + `資源回收廠產貨物 55262–55266、深加工鏈 55305–55325、經濟 55328–55413、煉鋼廠加速施工 55664–55671、出口與出口金 55991–56021、快照 56030–56046）逐段 sha256＝錨點記錄；六商品表與各個常數跟本線相同`,
      bad.join('；') || `六商品 ${Object.keys(ECON.COMMODITY_META482).join('、')}；深加工 ${J(ECON.REFINERY_RATE)}／${J(ECON.STEEL_MILL_RATE)}；船 ${ECON.SHIP_STEEL} 鋼一艘、上限港口×${ECON.SHIP_PORT_CAP}；太空研究中心每 ${ECON.MEGAPROJECT_CYCLE_DAYS} 天`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const C = cases25();
  const runCase = (c, lab, mine) => {
    const A = clone(c.tiles), B = clone(c.tiles), recs = [];
    lab.init(c.N, A, c.load); mine.init(c.N, B, c.load); lab.state(c.s0); mine.state(c.s0);
    for (const d of c.steps) {
      const a = lab.day(d, c.c), b = mine.day(d, c.c);
      recs.push({ a: J(a), b: J(b), r: a, d });
    }
    return recs;
  };
  const compare = (lab, mine, stopAtFirst = false) => {
    const st = { steps: 0, diffs: 0, first: '', cnt: {}, fam: {}, ext: {}, shipOver: 0, whOdd: 0, clFrac: 0 };
    const bump = k => { st.cnt[k] = (st.cnt[k] ?? 0) + 1; };
    const mm = (k, v) => { const e = st.ext[k] ??= { lo: Infinity, hi: -Infinity }; if (v < e.lo) e.lo = v; if (v > e.hi) e.hi = v; };
    for (let m = 0; m < C.length; m++) {
      for (const q of runCase(C[m], lab, mine)) {
        st.steps++;
        const r = q.r;
        if (r.foodImport482 > 0) bump('foodImp'); if (r.gasImport482 > 0) bump('gasImp'); if (r.fuelImport482 > 0) bump('fuelImp'); if (r.steelImport482 > 0) bump('steelImp'); if (r.suppliesImport482 > 0) bump('supImp');
        if (r.goodsImport481 > 0) bump('goodsImp'); if (r.foodExport482 > 0) bump('foodExp'); if (r.gasExport482 > 0) bump('gasExp'); if (r.goodsExport481 > 0) bump('goodsExp'); if (r.fuelExport418 > 0) bump('fuelExp'); if (r.steelExport482 > 0) bump('steelExp');
        if (!r.solvent482A1) bump('insolvent'); if (!r.solvent482A1 && (r.fuelShort482 > 0 || r.steelTarget482 > r.steel || r.suppliesTarget482 > 0)) bump('insolventSkip');
        if (r.gMade384 > 0) bump('goodsMade'); if (r.gNeed284 > 0) bump('retail'); if (r.shortageRatio481 > 0) bump('shortage'); if (r.retailPressure481 > 1) bump('pressure>1'); if (r.exportSignal481 > 0) bump('exportSignal');
        if (r.shipCount > 0) bump('ships'); if (r.shipPortGold > 0) bump('shipGold'); if (r.steelUsed > 0) bump('steelUsed'); if (r.fuelUse418 > 0) bump('fuelUse'); if (r.fuelMade > 0) bump('fuelMade'); if (r.steelMade > 0) bump('steelMade');
        if (r.megaSupplyUsed482 > 0) bump('mega'); if (r.tradeCapacity481 > 3) bump('cap>3'); if (r.tradeUsed482 >= r.tradeCapacity481 && r.tradeCapacity481 > 0) bump('poolDry'); if (r.constrSteelUse418 > 0) bump('constrSteel');
        if (r.logisticsNow481.efficiency < .78) bump('eff<.78'); if (r.logisticsNow481.efficiency > .78) bump('eff>.78'); if (r.freightTaxMul > 1) bump('freightMul'); if (r.fuelTaxMul > 1) bump('fuelMul'); if (r.steelTaxMul > 1) bump('steelMul');
        if (r.economy481.consumption.wealthPower !== 1) bump('wealth'); if (r.foodProcessPool482 > 0) bump('foodPool'); if (r.kitchenFoodUse482 > 0 || r.marketFoodUse482 > 0 || r.brewFoodUse482 > 0 || r.foodPlantUse482 > 0) bump('foodUse');
        if (r.indSupplyMul > 1) bump('indSupplyMul'); if (r.gasDem > r.gasSup) bump('gasShort'); if (r.gasPowerNeed482 > 0) bump('gasPower'); if (r.roadTradeBase482 === 8) bump('roadBase8');
        if (r.fuelImport482 > 0 && r.fuelShort482 > r.fuelCap485) bump('fuelCapBinds');   // 燃料缺口比庫存上限還大：進口要被上限截
        if (r.steelImport482 > 0 && r.steel > r.steelReserve482 && r.tradeUsed482 < r.tradeCapacity481) bump('steelExpBlocked');   // 當天有鋼進口、庫存又高過保留量、額度還有剩：要不是「進口那天不出口」，鋼就賣出去了
        mm('foodPrice481', r.foodPrice481); mm('commerceSalesMul481', r.commerceSalesMul481); mm('industrialMarketMul481', r.industrialMarketMul481); mm('purchaseBase481', r.purchaseBase481); mm('purchasingPowerNow481', r.purchasingPowerNow481);
        if (r.shipCount > r.portEquivalent485 * 2) st.shipOver++; if (!Number.isInteger(r.warehouseUnits485 * 2)) st.whOdd++; if (!Number.isInteger(r.clEff489)) st.clFrac++;
        if (q.a !== q.b) {
          st.diffs++;
          if (!st.first) {
            const x = JSON.parse(q.a), y = JSON.parse(q.b);
            st.first = `第 ${m} 張（${C[m].fam}，N=${C[m].N}）第 ${st.steps} 步：${Object.keys(x).filter(k => J(x[k]) !== J(y[k])).slice(0, 4).map(k => `${k} 實驗線 ${J(x[k]).slice(0, 60)}≠本線 ${J(y[k]).slice(0, 60)}`).join('；')}`;
          }
          if (stopAtFirst) return st;
        }
      }
    }
    return st;
  };
  const NEED = { foodImp: 100, gasImp: 30, fuelImp: 30, steelImp: 100, supImp: 100, goodsImp: 100, foodExp: 30, gasExp: 30, goodsExp: 50, fuelExp: 30, steelExp: 30, insolvent: 100, insolventSkip: 50, goodsMade: 100, retail: 200, shortage: 100, 'pressure>1': 50,
    exportSignal: 50, ships: 30, shipGold: 30, steelUsed: 50, fuelUse: 100, fuelMade: 20, steelMade: 20, mega: 20, 'cap>3': 200, poolDry: 100, constrSteel: 30, 'eff<.78': 30, 'eff>.78': 100, freightMul: 30, fuelMul: 30, steelMul: 100, wealth: 300,
    foodPool: 50, foodUse: 50, indSupplyMul: 100, gasShort: 30, gasPower: 30, roadBase8: 5, fuelCapBinds: 30, steelExpBlocked: 5 };
  const base = compare(makeLab(T), makeMine());
  const lacking = Object.entries(NEED).filter(([k, v]) => (base.cnt[k] ?? 0) < v).map(([k, v]) => `${k} ${(base.cnt[k] ?? 0)}<${v}`);
  log(base.diffs === 0 && !lacking.length,
    `D025 驗收 1、2：經濟逐項＝實驗線——實驗線原文在 vm 裡跟本線 economy.ts、food.ts、logistics.ts 吃 ${C.length} 張隨機小圖、每張連三天共 ${base.steps} 步（庫存、船、倉容量、快照跨日帶；物流九種、路格 0 到 700、壅堵、船、港口、煉油煉鋼造船、太空研究中心、償付能力、季節、日子）：`
      + `T485 單位、深加工鏈、貿易額度、六商品的進口出口庫存進口費出口金、貨物與零售與價格、四個乘數、快照三份、資金、施工中房屋的屋齡，實驗線那一段的每一個區域變數每一步逐位相等`,
    base.first || (lacking.length ? `覆蓋不夠：${lacking.join('、')}｜${J(base.cnt)}` : `${base.steps} 步全等；` + Object.entries(NEED).map(([k]) => `${k} ${base.cnt[k]}`).join('、')));

  // ---- 2a. 等價突變的前提（不放進突變清單的那幾個改動，為什麼改了也不會紅）----
  //   ・船的額度上限 港口×2（economy 的 Math.min(shipCount,portEquivalent485*2)、food.ts 的同一項）：55321 的截斷 `if(shipCount>portEquivalent485*SHIP_PORT_CAP)shipCount=…` 在額度之前已把船數壓到 ≤ 港口×2，這個 min 永遠取 shipCount；
  //   ・購買基準的下限 .40（與購買力的今日值）：purchasingPower481 自己夾 .45–1.45，本線沒有商業循環（乘數 1），外層 .40 永遠碰不到；
  //   ・糧價上限 1.80：外部價 ≤ 1.22、缺糧係數 ≤ 1 → 原式最大 1.22×1.32＝1.61；
  //   ・商業銷售上限 1.18：購買力 ≤ 1.45、零售壓力項 ≤ .94＋1.25×.08＝1.04 → 最大 (.72＋1.45×.28)×1.04＝1.171；
  //   ・工業市場上限 1.22：有出口訊號（庫存過了留存量）時缺貨率 ≤ 1−效率(≥.45)＝.55，沒有出口訊號時貨物已用光 → 理論最大 .78＋.26×.55＋.20＋.08＝1.203（實測最大 1.147）；
  //   ・快照裡倉儲單位與貨櫃物流有效座數的位數：企業層沒搬＝有效座數是整數，倉儲單位是 .5 的倍數，toFixed(1)＝toFixed(2)。
  //   下面用同一批輸入量出它們真的沒碰到界（量到的最大／最小值在界內），而「碰得到的鄰近改動」（1.18→1.12、.40→.50…）都放在突變清單裡，證明這些地方有被吃到。
  {
    const e = base.ext, bad = [], f = (k, x) => e[k] ? +e[k][x].toFixed(4) : NaN;
    if (!(f('commerceSalesMul481', 'hi') < 1.18)) bad.push(`商業銷售乘數最大 ${f('commerceSalesMul481', 'hi')} 碰到上限 1.18`);
    if (!(f('industrialMarketMul481', 'hi') < 1.22)) bad.push(`工業市場乘數最大 ${f('industrialMarketMul481', 'hi')} 碰到上限 1.22`);
    if (!(f('foodPrice481', 'hi') < 1.80)) bad.push(`糧價最大 ${f('foodPrice481', 'hi')} 碰到上限 1.80`);
    if (!(f('purchaseBase481', 'lo') >= .45)) bad.push(`購買基準最小 ${f('purchaseBase481', 'lo')} 低於購買力的下限 .45`);
    if (!(f('purchasingPowerNow481', 'lo') >= .45)) bad.push(`今日購買力最小 ${f('purchasingPowerNow481', 'lo')} 低於 .45`);
    if (base.shipOver) bad.push(`有 ${base.shipOver} 步船數超過港口×2`); if (base.whOdd) bad.push(`有 ${base.whOdd} 步倉儲單位不是 .5 的倍數`); if (base.clFrac) bad.push(`有 ${base.clFrac} 步貨櫃物流有效座數不是整數`);
    log(!bad.length, 'D025 等價突變的前提：實驗線跟本線吃同一批輸入時，商業銷售乘數、工業市場乘數、糧價的最大值都低於它們的上限（1.18、1.22、1.80），購買基準與今日購買力的最小值不低於 .45（外層 .40 碰不到），船數恆 ≤ 港口×2（額度裡的船項不束縛），倉儲單位恆為 .5 的倍數、有效座數恆為整數（位數突變看不出來）',
      bad.join('；') || `商業銷售 ${f('commerceSalesMul481', 'lo')}–${f('commerceSalesMul481', 'hi')}、工業市場 ${f('industrialMarketMul481', 'lo')}–${f('industrialMarketMul481', 'hi')}、糧價 ${f('foodPrice481', 'lo')}–${f('foodPrice481', 'hi')}、購買基準 ${f('purchaseBase481', 'lo')}–${f('purchaseBase481', 'hi')}、今日購買力 ${f('purchasingPowerNow481', 'lo')}–${f('purchasingPowerNow481', 'hi')}`);
  }

  // ---- 2b. 資源回收廠產貨物（55262–55266）----
  const RC = recycleCases();
  const recycleCompare = (lab, mine, stopAtFirst = false) => {
    const out = { diffs: [], seen: { formal: 0, legacy: 0, formalOld: 0, up: 0, capped: 0, over: 0 } };
    for (let m = 0; m < RC.length; m++) {
      const a = RC[m], want = lab(a), got = mine(a);
      if (want !== got) { out.diffs.push(`第 ${m} 組：實驗線 ${want}≠本線 ${got}`); if (stopAtFirst) return out; }
      if (a.formal && !a.legacy) out.seen.formal++; else out.seen.legacy++; if (a.formal && a.legacy) out.seen.formalOld++;
      if (want > a.goods) out.seen.up++; if (want === 60 + a.gWhCap && a.goods < want) out.seen.capped++; if (a.goods > 60 + a.gWhCap) out.seen.over++;
    }
    return out;
  };
  {
    const r = recycleCompare(makeRecycleLab(T), recycleMine(ECON)), seen = r.seen;
    log(!r.diffs.length && seen.formal > 1000 && seen.legacy > 1000 && seen.formalOld > 400 && seen.up > 1000 && seen.capped > 50 && seen.over > 300,
      `D025 資源回收廠產貨物（55262–55266）：實驗線那一段在 vm 裡跟本線 recycleGoods 吃 ${RC.length.toLocaleString('en-US')} 組（正式逐區清運、正式但不逐區〔讀 activeByK 的回收廠數〕、舊式全城、回收廠數、貨物已超過上限、上限用昨天的倉容量）逐位相等`,
      r.diffs.slice(0, 3).join('；') || `${RC.length} 組全等；逐區 ${seen.formal}、舊式（含正式不逐區 ${seen.formalOld}）${seen.legacy}、有加 ${seen.up}、頂到上限 ${seen.capped}、原本就超過上限 ${seen.over}`);
  }

  // ---- 3. 注入錯誤要紅 ----
  {
    const LAB_MUT = LAB_MUTANTS, MINE_MUT = MINE_MUTANTS;
    const missed = [], KILLS = process.env.D025_KILLS ? [] : null;   // D025_KILLS=1：每個突變跑完整組（不在第一個差異停），列出被幾步抓到——只靠一兩步的是運氣、要補輸入
    const kill = (name, n) => { KILLS?.push([n, name]); return n; };
    for (const [name, key, from, to] of LAB_MUT) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key] === undefined ? '沒有這段' : t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = kill(`實驗線 ${name}`, compare(makeLab(t2), makeMine(), !KILLS).diffs); } catch (e) { missed.push(`實驗線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`實驗線「${name}」`);
    }
    const mods = async (target, edits) => {
      if (target === 'econ') return { econ: await loadMod('src/sim/rules/economy.ts', edits), food: FOOD };
      if (target === 'food') { const food = await loadMod('src/sim/rules/food.ts', edits); return { econ: await loadMod('src/sim/rules/economy.ts', [], { './food.ts': food }), food }; }
      const logi = await loadMod('src/sim/rules/logistics.ts', edits), food = await loadMod('src/sim/rules/food.ts', [], { './logistics.ts': logi });
      return { econ: await loadMod('src/sim/rules/economy.ts', [], { './logistics.ts': logi, './food.ts': food }), food };
    };
    for (const [target, name, from, to] of MINE_MUT) {
      let M; try { M = await mods(target, [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = kill(`本線 ${name}`, compare(makeLab(T), makeMine(M), !KILLS).diffs); } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`本線「${name}」`);
    }
    // 資源回收廠（另一組輸入：逐區、正式但不逐區、舊式；貨物超過上限的）
    for (const [name, key, from, to] of RECYCLE_LAB_MUTANTS) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線資源回收「${name}」錨點不唯一`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = kill(`實驗線資源回收 ${name}`, recycleCompare(makeRecycleLab(t2), recycleMine(ECON), !KILLS).diffs.length); } catch (e) { missed.push(`實驗線資源回收「${name}」改壞之後跑不起來：${e.message}`); continue; }
      if (!d) missed.push(`實驗線資源回收「${name}」`);
    }
    for (const [name, from, to] of RECYCLE_MINE_MUTANTS) {
      let M; try { M = await loadMod('src/sim/rules/economy.ts', [[from, to]]); } catch (e) { missed.push(`本線資源回收「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = kill(`本線資源回收 ${name}`, recycleCompare(makeRecycleLab(T), recycleMine(M), !KILLS).diffs.length); } catch (e) { missed.push(`本線資源回收「${name}」改壞之後跑不起來：${e.message}`); continue; }
      if (!d) missed.push(`本線資源回收「${name}」`);
    }
    if (KILLS) console.error('擊殺次數（少→多，前 45）：\n' + KILLS.sort((a, b) => a[0] - b[0]).slice(0, 45).map(([n, name]) => `${String(n).padStart(6)}  ${name}`).join('\n'));
    let baseOk = false;
    for (const target of ['econ', 'food', 'logi']) baseOk = !compare(makeLab(T), makeMine(await mods(target, [])), true).diffs;
    log(baseOk && !missed.length, `D025 驗收 6：注入錯誤要紅——實驗線原文 ${LAB_MUT.length + RECYCLE_LAB_MUTANTS.length} 個、本線原碼 ${MINE_MUT.length + RECYCLE_MINE_MUTANTS.length} 個（池的順序、每一個進口與出口的條件與係數、償付能力、每個乘數的係數與夾值、船兌換、太空研究中心、季節價格、單位與額度、快照的位數……）；沒改的先核過全等`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }
}

// ---- 突變清單（實驗線原文：[名字, 段, 原文, 改成]；本線：[檔, 名字, 原文, 改成]）----
const LAB_MUTANTS = [
  // 深加工鏈（55305–55325）
  ['煉油量不受庫存上限', 'chain', 'Math.min(oilGain,refineryN*REFINERY_RATE*refineryUtil489,Math.max(0,fuelCap485-fuel))', 'Math.min(oilGain,refineryN*REFINERY_RATE*refineryUtil489)'],
  ['煉鋼量不受庫存上限', 'chain', 'Math.min(oreGain,steelMillN*STEEL_MILL_RATE*steelMillUtil489,Math.max(0,steelCap485-steel))', 'Math.min(oreGain,steelMillN*STEEL_MILL_RATE*steelMillUtil489)'],
  ['供應品不扣分流給燃料與鋼', 'chain', 'supplies+=suppliesGain-fuelMade-steelMade;', 'supplies+=suppliesGain;'],
  ['造船耗鋼不受庫存限制', 'chain', 'Math.min(steel,shipyardN*SHIPYARD_STEEL_USE*shipyardUtil489)', 'shipyardN*SHIPYARD_STEEL_USE*shipyardUtil489'],
  ['貨運耗油不受庫存限制', 'chain', 'Math.min(fuel,freightUnits485*FREIGHT_FUEL_USE)', 'freightUnits485*FREIGHT_FUEL_USE'],
  ['貨運稅乘數只給一半', 'chain', '1+(FUEL_FREIGHT_TAX_MUL-1)*(freightUnits485>0', '1+(FUEL_FREIGHT_TAX_MUL-1)*.5*(freightUnits485>0'],
  ['船兌換 floor→ceil', 'chain', 'shipCount+=Math.floor(shipProgress/SHIP_STEEL)', 'shipCount+=Math.ceil(shipProgress/SHIP_STEEL)'],
  ['船進度不取餘數', 'chain', 'shipProgress%=SHIP_STEEL;', ''],
  ['船上限放寬', 'chain', 'if(shipCount>portEquivalent485*SHIP_PORT_CAP)', 'if(shipCount>portEquivalent485*SHIP_PORT_CAP*2)'],
  ['沒有港口也造船', 'chain', 'steelUsed>0&&portEquivalent485>0', 'steelUsed>0'],
  ['船每日金 +1', 'chain', 'shipDailyGold418=shipCount*SHIP_DAILY_GOLD;', 'shipDailyGold418=shipCount*(SHIP_DAILY_GOLD+1);'],
  ['燃料稅乘數門檻 >0→>1', 'chain', 'fuelTaxMul=fuel>0?', 'fuelTaxMul=fuel>1?'],
  ['鋼材稅乘數門檻 >0→>1', 'chain', 'steelTaxMul=steel>0?', 'steelTaxMul=steel>1?'],
  ['升級折扣門檻 >0→>1', 'chain', 'steelDisc418=steel>0;', 'steelDisc418=steel>1;'],
  ['造船貿易乘數門檻', 'chain', 'shipTradeTaxMul=steelUsed>0?', 'shipTradeTaxMul=steelUsed>1?'],
  ['港口金專業化 1.25→1.2', 'chain', "sq('ind',1.25,1)", "sq('ind',1.2,1)"],
  ['港口金不乘港口', 'chain', 'portEquivalent485*steelUsed*SHIPYARD_PORT_GOLD', 'steelUsed*SHIPYARD_PORT_GOLD'],
  // 經濟（55328–55413）
  ['倉容量漏掉物流加成', 'economy', 'gWhCap284=whCap284+goodsCapBonus485;', 'gWhCap284=whCap284;'],
  ['勞動市場人口與職位對調', 'economy', 'laborMarket481(pop,jobs)', 'laborMarket481(jobs,pop)'],
  ['工業有效單位 ×2', 'economy', 'effectiveIndUnits489=nIndG284*enterpriseTypeUtilization489(3)', 'effectiveIndUnits489=nIndG284*enterpriseTypeUtilization489(3)*2'],
  ['商業有效單位 ×2', 'economy', 'effectiveComUnits489=nComG284*enterpriseTypeUtilization489(2)', 'effectiveComUnits489=nComG284*enterpriseTypeUtilization489(2)*2'],
  ['生活成本不讀昨天的快照', 'economy', 'prevCost481=economy481.ready?economy481.prices.costOfLiving:foodPriceOf(day,sea)', 'prevCost481=foodPriceOf(day,sea)'],
  ['購買基準下限 .40→.50', 'economy', 'prevCost481,pol?.taxR||1)*businessCycleConsumptionMul490(),.40,1.65)', 'prevCost481,pol?.taxR||1)*businessCycleConsumptionMul490(),.50,1.65)'],
  ['購買力下限 .45→.46', 'purchasingPower481', 'wealth*emp*wage*mood*tax*price,.45,1.45)', 'wealth*emp*wage*mood*tax*price,.46,1.45)'],
  ['購買力上限 1.45→1.46', 'purchasingPower481', 'wealth*emp*wage*mood*tax*price,.45,1.45)', 'wealth*emp*wage*mood*tax*price,.45,1.46)'],
  ['路底封頂 8→7', 'economy', 'Math.min(8,1+Math.floor(tickRoad.length/80))', 'Math.min(7,1+Math.floor(tickRoad.length/80))'],
  ['額度最少 3→2', 'economy', 'Math.max(tickRoad.length>0?3:0,', 'Math.max(tickRoad.length>0?2:0,'],
  ['貨櫃物流額度 ×8→×9', 'economy', 'clEff489*8+', 'clEff489*9+'],
  ['聯運額度 ×10→×11', 'economy', 'imEff489*10+', 'imEff489*11+'],
  ['配送中心額度 ×4→×5', 'economy', 'dcEff489*4+coldEff489*3', 'dcEff489*5+coldEff489*3'],
  ['冷鏈額度 ×3→×4', 'economy', 'coldEff489*3+siloEff489*3', 'coldEff489*4+siloEff489*3'],
  ['穀倉額度 ×3→×4', 'economy', 'siloEff489*3+fuelDepEff489*4', 'siloEff489*4+fuelDepEff489*4'],
  ['油庫額度 ×4→×5', 'economy', 'fuelDepEff489*4+gasDepEff489*4', 'fuelDepEff489*5+gasDepEff489*4'],
  ['氣庫額度 ×4→×5', 'economy', 'gasDepEff489*4+steelYEff489*3', 'gasDepEff489*5+steelYEff489*3'],
  ['鋼材場額度 ×3→×4', 'economy', 'steelYEff489*3+bulkEff489*12', 'steelYEff489*4+bulkEff489*12'],
  ['散貨碼頭額度 ×12→×13', 'economy', 'bulkEff489*12+cportEff489*18', 'bulkEff489*13+cportEff489*18'],
  ['貨櫃港額度 ×18→×19', 'economy', 'cportEff489*18+Math.min(shipCount', 'cportEff489*19+Math.min(shipCount'],
  ['償付能力 >=0→>0', 'economy', 'const solvent482A1=money>=0;', 'const solvent482A1=money>0;'],
  ['天然氣進口不受額度限制', 'economy', "takeTrade482(gpnImportAvailability508('gas',gasShortLocal482))", "gpnImportAvailability508('gas',gasShortLocal482)"],
  ['燃料進口不看償付能力', 'economy', 'fuelImport482=solvent482A1?takeTrade482(', 'fuelImport482=true?takeTrade482('],
  ['燃料進口不受庫存上限', 'economy', 'Math.min(fuelShort482,Math.max(0,fuelCap485-fuel))', 'fuelShort482'],
  ['鋼安全庫存 12→13', 'economy', 'Math.ceil(12*Math.max(steelMillUtil489,shipyardUtil489))', 'Math.ceil(13*Math.max(steelMillUtil489,shipyardUtil489))'],
  ['鋼目標不加造船需求', 'economy', '+shipyardN*SHIPYARD_STEEL_USE*shipyardUtil489+steelBase482', '+steelBase482'],
  ['鋼進口不看償付能力', 'economy', 'steelImport482=solvent482A1?takeTrade482(', 'steelImport482=true?takeTrade482('],
  ['施工中房屋 age<9→age<8', 'economy', 'cb482.age<9', 'cb482.age<8'],
  ['煉鋼廠施工需求不取 min', 'economy', 'Math.min(activeConstruction482,steelMillN*STEEL_MILL_RATE*steelMillUtil489)', 'activeConstruction482'],
  ['供應品目標 /2→/3', 'economy', 'suppliesTarget482=Math.ceil(effectiveIndUnits489/2)', 'suppliesTarget482=Math.ceil(effectiveIndUnits489/3)'],
  ['供應品進口不看償付能力', 'economy', 'suppliesImport482=solvent482A1?takeTrade482(', 'suppliesImport482=true?takeTrade482('],
  ['貨物產量 ×2→×3', 'economy', 'gMade384=Math.max(0,gInput482*2);', 'gMade384=Math.max(0,gInput482*3);'],
  ['貨物投入受倉容量 /2→/3', 'economy', 'Math.floor(room482/2)', 'Math.floor(room482/3)'],
  ['零售能量 .80→.85', 'economy', 'Math.max(1,effectiveComUnits489*.80)', 'Math.max(1,effectiveComUnits489*.85)'],
  ['居民貨物需求 /180→/181', 'economy', 'pop/180*purchaseBase481', 'pop/181*purchaseBase481'],
  ['遊客貨物需求 /320→/321', 'economy', 'tourists/320', 'tourists/321'],
  ['零售需求下限 .12→.13', 'economy', 'effectiveComUnits489*.12', 'effectiveComUnits489*.13'],
  ['國內配送不乘效率', 'economy', 'Math.ceil(gNeed284*Math.min(1,logisticsNow481.efficiency))', 'Math.ceil(gNeed284)'],
  ['貨物準備量 .28→.29', 'economy', 'gCap481*.28', 'gCap481*.29'],
  ['出口訊號 .35→.36', 'economy', 'tradeCapacity481*.35', 'tradeCapacity481*.36'],
  ['貨物出口不看進口', 'economy', 'let goodsExport481=goodsImport481>0?0:takeTrade482(', 'let goodsExport481=takeTrade482('],
  ['糧食加工池不扣廚房', 'economy', 'foodProcessPool482-=kitchenFoodUse482;', ''],
  ['農貿市場 ×4→×5', 'economy', 'mk330*4', 'mk330*5'],
  ['釀酒 ×3→×4', 'economy', 'br340*3*enterpriseTypeUtilization489(100)', 'br340*4*enterpriseTypeUtilization489(100)'],
  ['糧食出口上限 貿易站 ×15→×16', 'economy', 'tp336*15+siloEff489*18', 'tp336*16+siloEff489*18'],
  ['糧食出口上限 穀倉 ×18→×19', 'economy', 'siloEff489*18+coldEff489*8', 'siloEff489*19+coldEff489*8'],
  ['糧價缺糧係數 .32→.33', 'economy', 'foodShortage482*.32', 'foodShortage482*.33'],
  ['糧價過剩係數 .08→.09', 'economy', 'foodSurplusSignal482*.08', 'foodSurplusSignal482*.09'],
  ['糧價上限 1.80→1.55', 'economy', 'foodSurplusSignal482*.08),.70,1.80)', 'foodSurplusSignal482*.08),.70,1.55)'],
  ['化肥的天然氣 ×3→×4', 'economy', 'fp346*3*enterpriseTypeUtilization489(118)', 'fp346*4*enterpriseTypeUtilization489(118)'],
  ['廚房的天然氣 ×2→×3', 'economy', 'kt346*2*enterpriseTypeUtilization489(119)', 'kt346*3*enterpriseTypeUtilization489(119)'],
  ['氣井產量 ×8→×9', 'economy', 'gasSup=gw346*8;', 'gasSup=gw346*9;'],
  ['發電用氣 .035→.036', 'economy', 'gasPowerDispatchNow482*.035', 'gasPowerDispatchNow482*.036'],
  ['天然氣出口上限 貿易站 ×4→×5', 'economy', 'tp336*4+gasDepEff489*8', 'tp336*5+gasDepEff489*8'],
  ['貨物價格缺貨係數 .18→.19', 'economy', 'shortageRatio481*.18', 'shortageRatio481*.19'],
  ['貨物價格進口占比 .05→.06', 'economy', 'importShare481*.05', 'importShare481*.06'],
  ['貨物價格庫存係數 .06→.07', 'economy', 'goods/gCap481:0)*.06', 'goods/gCap481:0)*.07'],
  ['貨物價格上限 1.32→1.33', 'economy', 'goodsPrice481=clamp(extGoods482*(1+shortageRatio481*.18+importShare481*.05-(gCap481>0?goods/gCap481:0)*.06),.82,1.32)', 'goodsPrice481=clamp(extGoods482*(1+shortageRatio481*.18+importShare481*.05-(gCap481>0?goods/gCap481:0)*.06),.82,1.33)'],
  ['生活成本權重', 'economy', 'foodPrice481*.55+goodsPrice481*.45', 'foodPrice481*.5+goodsPrice481*.5'],
  ['商品供貨乘數 .50→.51', 'economy', 'goodsMul284=.75+.50*supplyRate481', 'goodsMul284=.75+.51*supplyRate481'],
  ['商業銷售購買力係數 .28→.29', 'economy', '(.72+purchasingPowerNow481*.28)', '(.72+purchasingPowerNow481*.29)'],
  ['商業銷售零售壓力係數 .08→.09', 'economy', '(.94+Math.min(1.25,retailPressure481)*.08)', '(.94+Math.min(1.25,retailPressure481)*.09)'],
  ['商業銷售上限 1.18→1.12', 'economy', 'retailPressure481)*.08),.64,1.18)', 'retailPressure481)*.08),.64,1.12)'],
  ['工業市場缺貨係數 .26→.27', 'economy', 'shortageRatio481*.26', 'shortageRatio481*.27'],
  ['工業市場出口係數 .20→.21', 'economy', 'exportSignal481*.20', 'exportSignal481*.21'],
  ['工業市場零售壓力 .08→.09', 'economy', 'Math.min(1,retailPressure481)*.08', 'Math.min(1,retailPressure481)*.09'],
  ['工業市場庫存門檻 .70→.71', 'economy', 'Math.max(0,stockRatioPre481-.70)*.20', 'Math.max(0,stockRatioPre481-.71)*.20'],
  ['工業市場上限 1.22→1.10', 'economy', 'stockRatioPre481-.70)*.20,.70,1.22)', 'stockRatioPre481-.70)*.20,.70,1.10)'],
  ['原料加成 +.1', 'economy', '*INDUSTRY_SUPPLY_BOOST:1;', '*(INDUSTRY_SUPPLY_BOOST+.1):1;'],
  ['太空研究中心週期', 'economy', 'day%MEGAPROJECT_CYCLE_DAYS===0', 'day%MEGAPROJECT_CYCLE_DAYS===1'],
  ['太空研究中心獎金不乘座數', 'economy', 'MEGAPROJECT_REWARD*mgN', 'MEGAPROJECT_REWARD'],
  // 煉鋼廠加速施工、出口、快照
  ['煉鋼廠加速額度 ×2', 'steelCons', 'Math.min(steelMillN*STEEL_MILL_RATE,steel)', 'Math.min(steelMillN*STEEL_MILL_RATE*2,steel)'],
  ['加速的施工中 age<9→age<8', 'steelCons', 'b.age<9', 'b.age<8'],
  ['加速輪轉起點固定 0', 'steelCons', 'offE418=nE418?day%nE418:0', 'offE418=0'],
  ['加速不扣鋼', 'steelCons', 'b.age++;cap418--;steel--;constrSteelUse418++;', 'b.age++;cap418--;constrSteelUse418++;'],
  ['食物出口金不乘造船貿易', 'lateFood', 'Math.round(tradeGoldBase*shipTradeTaxMul)', 'tradeGoldBase'],
  ['燃料出口不算貨櫃港', 'lateFuel', '(tp336+fuelDepOp485+bulkOp485+cportOp485)>0?', '(tp336+fuelDepOp485+bulkOp485)>0?'],
  ['燃料出口上限 貨櫃港 ×12→×13', 'lateFuel', 'cportOp485*12', 'cportOp485*13'],
  ['燃料留下的量 ×1→×2', 'lateFuel', 'Math.ceil(fuelDemand482*(pol?.emergencyStockpile492?2.5:1))', 'Math.ceil(fuelDemand482*2)'],
  ['天然氣出口金 +1', 'lateGas', 'Math.round(gasExportGold482)', 'Math.round(gasExportGold482)+1'],
  ['鋼安全庫存下限 18→19', 'lateSteel', 'Math.max(18,steelConstructionNeed482', 'Math.max(19,steelConstructionNeed482'],
  ['鋼出口不看當天進口', 'lateSteel', 'steelImport482>0?0:takeTrade482(', 'takeTrade482('],
  ['供應品用量漏太空研究中心', 'lateSteel', 'suppliesUsed482=gInput482+indSupplyUsed+megaSupplyUsed482', 'suppliesUsed482=gInput482+indSupplyUsed'],
  ['快照購買力位數 3→2', 'snapshot', 'purchasingPower:+purchasingPowerNow481.toFixed(3)', 'purchasingPower:+purchasingPowerNow481.toFixed(2)'],
  ['快照庫存不取整', 'snapshot', 'stock:Math.round(goods)', 'stock:goods'],
  ['快照零售利用率位數', 'snapshot', 'utilization:+retailPressure481.toFixed(3)', 'utilization:+retailPressure481.toFixed(2)'],
  ['快照物流欄少一個', 'snapshot', 'logistics:{...logisticsNow481}', 'logistics:{efficiency:logisticsNow481.efficiency}'],
  ['快照貿易餘額', 'snapshot', 'balance:goodsExportGold481-goodsImportCost481', 'balance:goodsExportGold481'],
  ['燃料本地價缺貨係數', 'snapshot', 'fuelServed482/fuelDemand482:0)*.18', 'fuelServed482/fuelDemand482:0)*.19'],
  ['鋼本地價庫存係數', 'snapshot', '(steel/steelCap485)*.04)', '(steel/steelCap485)*.05)'],
  ['天然氣本地價係數', 'snapshot', '(1-gasRatio)*.22', '(1-gasRatio)*.23'],
  ['供應品本地價係數', 'snapshot', 'suppliesServed482/suppliesDemand482:0)*.18),.82,1.35)', 'suppliesServed482/suppliesDemand482:0)*.19),.82,1.35)'],
  ['供應品需求漏太空研究中心', 'snapshot', 'indSupplyDemand+megaSupplyUsed482,', 'indSupplyDemand,'],
  ['鋼供給漏施工耗鋼', 'snapshot', 'Math.min(steelDemand482,steelUsed+constrSteelUse418)', 'Math.min(steelDemand482,steelUsed)'],
  ['出口金總額漏貨物', 'snapshot', 'fuelExportGold418+steelExportGold482+goodsExportGold481,', 'fuelExportGold418+steelExportGold482,'],
  ['貿易已用 +1', 'snapshot', 'used:tradeUsed482,', 'used:tradeUsed482+1,'],
  ['倉儲單位位數', 'snapshot', 'warehouseUnits:+warehouseUnits485.toFixed(1)', 'warehouseUnits:+warehouseUnits485.toFixed(0)'],
  ['食物保存位數', 'snapshot', 'foodPreservation:+foodPreserveMul485.toFixed(3)', 'foodPreservation:+foodPreserveMul485.toFixed(2)'],
];
const MINE_MUTANTS = [
  ['econ', '煉油量不受庫存上限', "Math.min(g('oilGain'), refineryN * REFINERY_RATE * refineryUtil489, Math.max(0, U.fuelCap485 - st.fuel))", "Math.min(g('oilGain'), refineryN * REFINERY_RATE * refineryUtil489)"],
  ['econ', '煉鋼量不受庫存上限', "Math.min(g('oreGain'), steelMillN * STEEL_MILL_RATE * steelMillUtil489, Math.max(0, U.steelCap485 - st.steel))", "Math.min(g('oreGain'), steelMillN * STEEL_MILL_RATE * steelMillUtil489)"],
  ['econ', '供應品不扣分流', "st.supplies += g('suppliesGain') - fuelMade - steelMade;", "st.supplies += g('suppliesGain');"],
  ['econ', '造船耗鋼不受庫存限制', 'Math.min(st.steel, shipyardN * SHIPYARD_STEEL_USE * shipyardUtil489)', 'shipyardN * SHIPYARD_STEEL_USE * shipyardUtil489'],
  ['econ', '貨運耗油不受庫存限制', 'Math.min(st.fuel, U.freightUnits485 * FREIGHT_FUEL_USE)', 'U.freightUnits485 * FREIGHT_FUEL_USE'],
  ['econ', '貨運稅乘數只給一半', '1 + (FUEL_FREIGHT_TAX_MUL - 1) * (U.freightUnits485 > 0', '1 + (FUEL_FREIGHT_TAX_MUL - 1) * .5 * (U.freightUnits485 > 0'],
  ['econ', '船兌換 floor→ceil', 'Math.floor(st.shipProgress / SHIP_STEEL)', 'Math.ceil(st.shipProgress / SHIP_STEEL)'],
  ['econ', '船進度不取餘數', 'st.shipProgress %= SHIP_STEEL;', ''],
  ['econ', '船上限放寬', 'if (st.shipCount > U.portEquivalent485 * SHIP_PORT_CAP)', 'if (st.shipCount > U.portEquivalent485 * SHIP_PORT_CAP * 2)'],
  ['econ', '沒有港口也造船', 'steelUsed > 0 && U.portEquivalent485 > 0', 'steelUsed > 0'],
  ['econ', '船每日金 +1', 'st.shipCount * SHIP_DAILY_GOLD', 'st.shipCount * (SHIP_DAILY_GOLD + 1)'],
  ['econ', '燃料稅乘數門檻', 'const fuelTaxMul = st.fuel > 0 ?', 'const fuelTaxMul = st.fuel > 1 ?'],
  ['econ', '鋼材稅乘數門檻', 'const steelTaxMul = st.steel > 0 ?', 'const steelTaxMul = st.steel > 1 ?'],
  ['econ', '升級折扣門檻', 'steelDisc418 = st.steel > 0;', 'steelDisc418 = st.steel > 1;'],
  ['econ', '造船貿易乘數門檻', 'const shipTradeTaxMul = steelUsed > 0 ?', 'const shipTradeTaxMul = steelUsed > 1 ?'],
  ['econ', '港口金專業化', "(i.spec === 'ind' ? 1.25 : 1)", "(i.spec === 'ind' ? 1.2 : 1)"],
  ['econ', '港口金不乘港口', 'Math.round(U.portEquivalent485 * steelUsed * SHIPYARD_PORT_GOLD', 'Math.round(steelUsed * SHIPYARD_PORT_GOLD'],
  ['econ', '倉容量漏掉物流加成', "st.gWhCap = g('whCap284') + U.goodsCapBonus485;", "st.gWhCap = g('whCap284');"],
  ['econ', '工業有效單位 ×2', "effectiveIndUnits489 = g('nIndG284') * 1", "effectiveIndUnits489 = g('nIndG284') * 2"],
  ['econ', '商業有效單位 ×2', "effectiveComUnits489 = g('nComG284') * 1", "effectiveComUnits489 = g('nComG284') * 2"],
  ['econ', '生活成本不讀快照', 'prevCost481 = st.snap ? st.snap.prices.costOfLiving : foodPriceOf(day, sea);', 'prevCost481 = foodPriceOf(day, sea);'],
  ['econ', '購買基準下限', 'i.cityHappy, prevCost481, 1) * 1, .40, 1.65)', 'i.cityHappy, prevCost481, 1) * 1, .50, 1.65)'],
  ['econ', '額度改讀沒有船的', 'shipCount: st.shipCount, fuelMul: freightTaxMul', 'shipCount: 0, fuelMul: freightTaxMul'],
  ['econ', '額度不吃貨運燃料加成', 'shipCount: st.shipCount, fuelMul: freightTaxMul', 'shipCount: st.shipCount, fuelMul: 1'],
  ['econ', '償付能力', 'const solvent482A1 = i.money >= 0;', 'const solvent482A1 = i.money > 0;'],
  ['econ', '天然氣進口不受額度限制', 'gasImport482 = takeTrade482(gpnInt(gasShortLocal482))', 'gasImport482 = gpnInt(gasShortLocal482)'],
  ['econ', '燃料進口不看償付能力', 'fuelImport482 = solvent482A1 ? takeTrade482', 'fuelImport482 = true ? takeTrade482'],
  ['econ', '燃料進口不受庫存上限', 'gpnInt(Math.min(fuelShort482, Math.max(0, U.fuelCap485 - st.fuel)))', 'gpnInt(fuelShort482)'],
  ['econ', '鋼安全庫存 12→13', 'Math.ceil(12 * Math.max(steelMillUtil489, shipyardUtil489))', 'Math.ceil(13 * Math.max(steelMillUtil489, shipyardUtil489))'],
  ['econ', '鋼目標不加造船需求', 'steelConstructionNeed482 + shipyardN * SHIPYARD_STEEL_USE * shipyardUtil489 + steelBase482', 'steelConstructionNeed482 + steelBase482'],
  ['econ', '鋼進口不看償付能力', 'steelImport482 = solvent482A1 ? takeTrade482', 'steelImport482 = true ? takeTrade482'],
  ['econ', '施工中房屋 age<9→age<8', 'if (cb && !cb.ref && (cb.age as number) < 9) n++;', 'if (cb && !cb.ref && (cb.age as number) < 8) n++;'],
  ['econ', '煉鋼廠施工需求不取 min', 'Math.min(i.activeConstruction, steelMillN * STEEL_MILL_RATE * steelMillUtil489)', 'i.activeConstruction'],
  ['econ', '供應品目標 /2→/3', 'Math.ceil(effectiveIndUnits489 / 2) + Math.ceil(effectiveIndUnits489 * INDUSTRY_SUPPLY_UNIT * .6)', 'Math.ceil(effectiveIndUnits489 / 3) + Math.ceil(effectiveIndUnits489 * INDUSTRY_SUPPLY_UNIT * .6)'],
  ['econ', '供應品進口不看償付能力', 'suppliesImport482 = solvent482A1 ? takeTrade482', 'suppliesImport482 = true ? takeTrade482'],
  ['econ', '貨物產量 ×2→×3', 'gMade384 = Math.max(0, gInput482 * 2);', 'gMade384 = Math.max(0, gInput482 * 3);'],
  ['econ', '貨物投入受倉容量', 'Math.floor(room482 / 2)', 'Math.floor(room482 / 3)'],
  ['econ', '零售能量 .80→.85', 'Math.max(1, effectiveComUnits489 * .80)', 'Math.max(1, effectiveComUnits489 * .85)'],
  ['econ', '居民貨物需求', 'pop / 180 * purchaseBase481', 'pop / 181 * purchaseBase481'],
  ['econ', '遊客貨物需求', 'tourists / 320', 'tourists / 321'],
  ['econ', '零售需求下限', 'effectiveComUnits489 * .12', 'effectiveComUnits489 * .13'],
  ['econ', '國內配送不乘效率', 'Math.ceil(gNeed284 * Math.min(1, logisticsNow481.efficiency))', 'Math.ceil(gNeed284)'],
  ['econ', '貨物準備量', 'gCap481 * .28', 'gCap481 * .29'],
  ['econ', '出口訊號', 'tradeCapacity481 * .35', 'tradeCapacity481 * .36'],
  ['econ', '貨物出口不看進口', 'const goodsExport481 = goodsImport481 > 0 ? 0 : takeTrade482', 'const goodsExport481 = takeTrade482'],
  ['econ', '糧食加工池不扣廚房', 'foodProcessPool482 -= kitchenFoodUse482;', ''],
  ['econ', '農貿市場 ×4→×5', "g('mk330') * 4", "g('mk330') * 5"],
  ['econ', '釀酒 ×3→×4', "g('br340') * 3 * 1", "g('br340') * 4 * 1"],
  ['econ', '糧食出口上限', 'tp336 * 15 + U.siloEff489 * 18', 'tp336 * 16 + U.siloEff489 * 18'],
  ['econ', '糧價缺糧係數', 'foodShortage482 * .32', 'foodShortage482 * .33'],
  ['econ', '糧價過剩係數', 'foodSurplusSignal482 * .08), .70, 1.80)', 'foodSurplusSignal482 * .09), .70, 1.80)'],
  ['econ', '化肥的天然氣', "g('fp346') * 3 * 1", "g('fp346') * 4 * 1"],
  ['econ', '廚房的天然氣', "g('kt346') * 2 * 1", "g('kt346') * 3 * 1"],
  ['econ', '氣井產量', "gasSup = g('gw346') * 8", "gasSup = g('gw346') * 9"],
  ['econ', '發電用氣', 'gasPowerDispatchNow482 * .035', 'gasPowerDispatchNow482 * .036'],
  ['econ', '天然氣出口上限', 'tp336 * 4 + U.gasDepEff489 * 8', 'tp336 * 5 + U.gasDepEff489 * 8'],
  ['econ', '貨物價格缺貨係數', 'shortageRatio481 * .18', 'shortageRatio481 * .19'],
  ['econ', '貨物價格庫存係數', "(gCap481 > 0 ? st.goods / gCap481 : 0) * .06), .82, 1.32)", "(gCap481 > 0 ? st.goods / gCap481 : 0) * .07), .82, 1.32)"],
  ['econ', '生活成本權重', 'foodPrice481 * .55 + goodsPrice481 * .45', 'foodPrice481 * .5 + goodsPrice481 * .5'],
  ['econ', '商品供貨乘數', 'goodsMul284 = .75 + .50 * supplyRate481', 'goodsMul284 = .75 + .51 * supplyRate481'],
  ['econ', '商業銷售購買力係數', '(.72 + purchasingPowerNow481 * .28)', '(.72 + purchasingPowerNow481 * .29)'],
  ['econ', '商業銷售零售壓力係數', '(.94 + Math.min(1.25, retailPressure481) * .08), .64, 1.18)', '(.94 + Math.min(1.25, retailPressure481) * .09), .64, 1.18)'],
  ['econ', '工業市場缺貨係數', 'shortageRatio481 * .26', 'shortageRatio481 * .27'],
  ['econ', '工業市場出口係數', 'exportSignal481 * .20', 'exportSignal481 * .21'],
  ['econ', '工業市場庫存門檻', 'Math.max(0, stockRatioPre481 - .70) * .20', 'Math.max(0, stockRatioPre481 - .71) * .20'],
  ['econ', '工業市場上限', 'stockRatioPre481 - .70) * .20, .70, 1.22)', 'stockRatioPre481 - .70) * .20, .70, 1.10)'],
  ['econ', '原料加成', '* INDUSTRY_SUPPLY_BOOST : 1;', '* (INDUSTRY_SUPPLY_BOOST + .1) : 1;'],
  ['econ', '太空研究中心週期', 'day % MEGAPROJECT_CYCLE_DAYS === 0', 'day % MEGAPROJECT_CYCLE_DAYS === 1'],
  ['econ', '太空研究中心獎金', 'mgReward = MEGAPROJECT_REWARD * mgN;', 'mgReward = MEGAPROJECT_REWARD;'],
  ['econ', '煉鋼廠加速額度', 'Math.min(steelMillN * STEEL_MILL_RATE, st.steel)', 'Math.min(steelMillN * STEEL_MILL_RATE * 2, st.steel)'],
  ['econ', '加速的施工中', 'if (b && !b.ref && (b.age as number) < 9) el418.push(i);', 'if (b && !b.ref && (b.age as number) < 8) el418.push(i);'],
  ['econ', '加速輪轉起點', 'offE418 = nE418 ? day % nE418 : 0', 'offE418 = 0'],
  ['econ', '加速不扣鋼', '(b.age as number)++; cap418--; st.steel--; constrSteelUse418++;', '(b.age as number)++; cap418--; constrSteelUse418++;'],
  ['econ', '食物出口金不乘造船貿易', 'Math.round(tradeGoldBase * ec.shipTradeTaxMul)', 'tradeGoldBase'],
  ['econ', '燃料出口不算貨櫃港', '(tp336 + fuelDepOp485 + bulkOp485 + cportOp485) > 0', '(tp336 + fuelDepOp485 + bulkOp485) > 0'],
  ['econ', '燃料出口上限', 'cportOp485 * 12', 'cportOp485 * 13'],
  ['econ', '燃料留下的量', 'Math.ceil(ec.fuelDemand482 * 1)', 'Math.ceil(ec.fuelDemand482 * 2)'],
  ['econ', '天然氣出口金', 'const gasGold = Math.round(ec.gasExportGold482);', 'const gasGold = Math.round(ec.gasExportGold482) + 1;'],
  ['econ', '鋼安全庫存下限', 'Math.max(18, ec.steelConstructionNeed482', 'Math.max(19, ec.steelConstructionNeed482'],
  ['econ', '鋼出口不看當天進口', 'steelExport482 = ec.steelImport482 > 0 ? 0 : takeTrade482', 'steelExport482 = takeTrade482'],
  ['econ', '供應品用量漏太空研究中心', 'ec.gInput482 + ec.indSupplyUsed + ec.megaSupplyUsed482', 'ec.gInput482 + ec.indSupplyUsed'],
  ['econ', '快照購買力位數', 'purchasingPower: +ec.purchasingPowerNow481.toFixed(3)', 'purchasingPower: +ec.purchasingPowerNow481.toFixed(2)'],
  ['econ', '快照庫存不取整', 'stock: Math.round(st.goods)', 'stock: st.goods'],
  ['econ', '快照貿易餘額', 'balance: ec.goodsExportGold481 - ec.goodsImportCost481,', 'balance: ec.goodsExportGold481,'],
  ['econ', '燃料本地價', "ec.fuelDemand482 > 0 ? 1 - fuelServed482 / ec.fuelDemand482 : 0) * .18", "ec.fuelDemand482 > 0 ? 1 - fuelServed482 / ec.fuelDemand482 : 0) * .19"],
  ['econ', '天然氣本地價', '(1 - ec.gasRatio) * .22', '(1 - ec.gasRatio) * .23'],
  ['econ', '供應品需求漏太空研究中心', 'ec.indSupplyDemand + ec.megaSupplyUsed482,', 'ec.indSupplyDemand,'],
  ['econ', '鋼供給漏施工耗鋼', 'Math.min(steelDemand482, ec.steelUsed + constrSteelUse418)', 'Math.min(steelDemand482, ec.steelUsed)'],
  ['econ', '出口金總額漏貨物', 'late.steelExportGold482 + ec.goodsExportGold481,', 'late.steelExportGold482,'],
  ['econ', '快照物流欄少一個', 'logistics: { ...ec.logisticsNow481 },', 'logistics: { efficiency: ec.logisticsNow481.efficiency },'],
  ['econ', '外部價格相位', 'Math.sin(d * .071 + p)', 'Math.sin(d * .071 + p + .01)'],
  ['econ', '外部價格食物季節', '[1.00, .96, .90, 1.12][sea]', '[1.00, .96, .91, 1.12][sea]'],
  ['econ', '外部價格燃料季節', '[.98, 1.08, 1.00, 1.12][sea]', '[.98, 1.08, 1.01, 1.12][sea]'],
  ['econ', '外部價格鋼材季節', '[1.00, 1.03, 1.05, .98][sea]', '[1.00, 1.03, 1.05, .99][sea]'],
  ['econ', '外部價格夾值', 'return +clamp(v, .82, 1.22).toFixed(3);', 'return +clamp(v, .82, 1.23).toFixed(3);'],
  ['econ', '購買力財富級', 'wealth * emp * wage * mood * tax * price, .45, 1.45)', 'wealth * emp * wage * mood * tax * price, .45, 1.46)'],
  ['econ', '購買力就業係數', 'emp = .55 + .45 * clamp', 'emp = .55 + .46 * clamp'],
  ['econ', '購買力下限', 'wealth * emp * wage * mood * tax * price, .45, 1.45)', 'wealth * emp * wage * mood * tax * price, .46, 1.45)'],
  ['econ', '糧價上限', 'foodSurplusSignal482 * .08), .70, 1.80)', 'foodSurplusSignal482 * .08), .70, 1.55)'],
  ['econ', '商業銷售上限', '(.94 + Math.min(1.25, retailPressure481) * .08), .64, 1.18)', '(.94 + Math.min(1.25, retailPressure481) * .08), .64, 1.12)'],
  ['econ', '快照倉儲單位位數', 'warehouseUnits: +U.warehouseUnits485.toFixed(1)', 'warehouseUnits: +U.warehouseUnits485.toFixed(0)'],
  ['econ', '財富力社宅 .72', 'else if (b.k === 127) wt = .72;', 'else if (b.k === 127) wt = .73;'],
  ['econ', '財富力貧戶 .72', 'we === 0 ? .72 : we === 2 ? 1.28 : 1', 'we === 0 ? .73 : we === 2 ? 1.28 : 1'],
  ['econ', '財富力塔 1.08', 'else if (b.k === 33) wt = 1.08;', 'else if (b.k === 33) wt = 1.09;'],
  ['food', '糧食保存不進食物量', '* U.foodPreserveMul485 * (x.eventFood ?? 1))', '* 1 * (x.eventFood ?? 1))'],
  ['food', '事件的食物加成不進食物量', '* U.foodPreserveMul485 * (x.eventFood ?? 1))', '* U.foodPreserveMul485 * 1)'],
  ['food', '額度不吃單位裡的貨櫃物流', 'U.clEff489 * 8 + ', ''],
  ['food', '額度的貨櫃港項', 'U.cportEff489 * 18', 'U.cportEff489 * 19'],
  ['food', '額度的散貨碼頭項', 'U.bulkEff489 * 12', 'U.bulkEff489 * 13'],
  ['food', '額度的聯運項', 'U.imEff489 * 10', 'U.imEff489 * 11'],
  ['food', '效率的燃料加成', 'Math.max(0, (x.fuelMul || 1) - 1) * .30', 'Math.max(0, (x.fuelMul || 1) - 1) * .31'],
  ['food', '效率的壅堵扣分', 'Math.max(0, rd.avg - .65) * .35 + rd.over * .22', 'Math.max(0, rd.avg - .65) * .36 + rd.over * .22'],
  ['food', '效率的過載扣分', 'rd.over * .22', 'rd.over * .23'],
  ['food', '效率的鐵路加成', 'railUnits * .012', 'railUnits * .013'],
  ['logi', '有效座數：貨櫃物流讀成建成', "clEff489 = g('clOp485')", "clEff489 = g('cl485')"],
  ['logi', '貨運單位：聯運 ×3→×4', 'imEff489 * 3 + dcEff489 + bulkEff489 * 2', 'imEff489 * 4 + dcEff489 + bulkEff489 * 2'],
  ['logi', '倉儲單位：配送中心 ×1.5→×2', 'dcEff489 * 1.5', 'dcEff489 * 2'],
  ['logi', '港口等量：貨櫃港 ×2→×3', 'bulkEff489 + cportEff489 * 2, railUnits', 'bulkEff489 + cportEff489 * 3, railUnits'],
  ['logi', '鐵路單位：聯運 ×2→×3', 'railLines + imEff489 * 2', 'railLines + imEff489 * 3'],
  ['logi', '燃料上限：油庫 ×80→×90', 'fuelDepEff489 * 80', 'fuelDepEff489 * 90'],
  ['logi', '鋼材上限：鋼材場 ×80→×90', 'steelYEff489 * 80', 'steelYEff489 * 90'],
  ['logi', '食物保存：冷鏈 .05→.06', 'coldEff489 * .05 + siloEff489 * .035', 'coldEff489 * .06 + siloEff489 * .035'],
  ['logi', '食物保存上限 .20→.25', 'Math.min(.20,', 'Math.min(.25,'],
  ['logi', '倉容量加成：貨櫃港 ×300→×310', 'cportEff489 * 300', 'cportEff489 * 310'],
];
// 資源回收廠產貨物（55262–55266）：[名字, 段, 原文, 改成]／[名字, 原文, 改成]
const RECYCLE_LAB_MUTANTS = [
  ['逐區：區的垃圾需求係數 .08→.09', 'recycle', 'Math.round(q452.demand*.08)', 'Math.round(q452.demand*.09)'],
  ['逐區：每座回收廠 6→7', 'recycle', 'n452*6);}if(upGoods452>0)', 'n452*7);}if(upGoods452>0)'],
  ['逐區：沒有回收廠也算一座', 'recycle', 'const n452=q452.byK[111]||0;', 'const n452=q452.byK[111]||1;'],
  ['逐區：沒有產出也削到上限', 'recycle', 'if(upGoods452>0)goods=Math.min(goodsCap283(),goods+upGoods452);', 'goods=Math.min(goodsCap283(),goods+upGoods452);'],
  ['逐區：不受倉容量限制', 'recycle', 'goods=Math.min(goodsCap283(),goods+upGoods452)', 'goods=goods+upGoods452'],
  ['舊式：垃圾係數 .08→.09', 'recycle', 'Math.round(garbage*.08)', 'Math.round(garbage*.09)'],
  ['舊式：每座 6→7', 'recycle', 'upcEff445*6)', 'upcEff445*7)'],
  ['舊式：不受倉容量限制', 'recycle', 'goods=Math.min(goodsCap283(),goods+Math.min(Math.round(garbage*.08),upcEff445*6));', 'goods=goods+Math.min(Math.round(garbage*.08),upcEff445*6);'],
  ['舊式：沒有回收廠也削到上限', 'recycle', 'if(upcEff445>0)goods=', 'goods='],
  ['舊式：正式清運卻讀舊計數', 'recycle', 'san445.formal?(san445.activeByK[111]||0):upc342', 'san445.formal?upc342:(san445.activeByK[111]||0)'],
  ['倉容量的底 60→61', 'goodsCap283', 'return 60+gWhCap284;', 'return 61+gWhCap284;'],
  ['倉容量不加昨天的加成', 'goodsCap283', 'return 60+gWhCap284;', 'return 60;'],
];
const RECYCLE_MINE_MUTANTS = [
  ['逐區：區的垃圾需求係數', 'q.demand * .08', 'q.demand * .09'],
  ['逐區：每座回收廠 6→7', 'n * 6);', 'n * 7);'],
  ['逐區：沒有回收廠也算一座', 'const n = q.byK[111] || 0;', 'const n = q.byK[111] || 1;'],
  ['逐區：沒有產出也削到上限', 'if (upGoods452 > 0) st.goods = Math.min(cap, st.goods + upGoods452);', 'st.goods = Math.min(cap, st.goods + upGoods452);'],
  ['逐區：不受倉容量限制', 'if (upGoods452 > 0) st.goods = Math.min(cap, st.goods + upGoods452);', 'if (upGoods452 > 0) st.goods = st.goods + upGoods452;'],
  ['舊式：垃圾係數', 'Math.round(garbage * .08)', 'Math.round(garbage * .09)'],
  ['舊式：每座 6→7', 'upcEff445 * 6));', 'upcEff445 * 7));'],
  ['舊式：不受倉容量限制', 'if (upcEff445 > 0) st.goods = Math.min(cap, st.goods + Math.min(Math.round(garbage * .08), upcEff445 * 6));', 'if (upcEff445 > 0) st.goods = st.goods + Math.min(Math.round(garbage * .08), upcEff445 * 6);'],
  ['舊式：沒有回收廠也削到上限', 'if (upcEff445 > 0) st.goods = Math.min(', 'st.goods = Math.min('],
  ['舊式：正式清運卻讀舊計數', 'san.formal ? (san.activeByK[111] || 0) : upc342', 'san.formal ? upc342 : (san.activeByK[111] || 0)'],
  ['用昨天的倉容量', 'const cap = 60 + st.gWhCap;', 'const cap = 60;'],
  ['倉容量的底 60→61', 'const cap = 60 + st.gWhCap;', 'const cap = 61 + st.gWhCap;'],
  ['逐區判斷讀 legacy 旗標', 'if (san.formal && !legacy452) {', 'if (san.formal) {'],
];
