// 經濟（D025）：共享貿易池、商品庫存、零售與購買力、經濟快照、稅率乘數、進口費。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。順序照 tick()：
//   55262–55266 資源回收廠產貨物（recycleGoods）→ 55286–55291 T485 單位（logistics.ts）→ 55293–55297 食物與遊客（food.ts）→ 55305–55325 T364b／T418 深加工鏈 →
//   55328–55413 T481／T482 經濟（economyMain：貿易額度、糧食／天然氣／燃料／鋼材／供應品／貨物的進出口、貨物與零售、價格、四個乘數、太空研究中心）→
//   55664–55671 煉鋼廠加速施工（steelConstruction）→ 55996–56021 出口的金幣與燃料、鋼材出口（economyLate）→ 56030–56046 快照（economySnapshots）。
// 沒搬（本線沒有，一律當沒有／0／恆等；卡「不做什麼」）：開採量（suppliesGain、oilGain、oreGain＝計數裡恆 0，backlog M）、道路負載與壅堵（T129，輸入 roadStats，本線給 0）、
//   火車線 T463（輸入 railLines）、事故 T493、企業層 T489（利用率 1）、gpn T508（額度乘數 1、進口可得性與出口需求只取整）、
//   商業循環 T490（消費乘數 1）、城市活動 T299、天然氣發電調度（power471.pools，輸入 gasPowerDispatch，本線給 0）、化肥與熟食與收入加成（T346，下一張）。
// 政策 pol（D032）：稅率 taxR 進購買力（55332、55395：`pol?.taxR||1`）、緊急物資儲備 emergencyStockpile492 進糧食與天然氣與燃料的出口留存和商品儲備（55348、55357、55388、56000）；沒有政策＝稅率 1、儲備關。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；不動世界歷史。
import { clamp, type World } from './lab.ts';
import { residentPopulation488 } from './jobs.ts';
import { foodDay, type FoodCount, type FoodReport } from './food.ts';
import { unitsOf485, NO_ROAD_LOAD, type RoadStats, type Units485 } from './logistics.ts';
import type { Labor } from './demand.ts';

// ---- 常數 ----
export const REFINERY_RATE = 3, STEEL_MILL_RATE = 2;                                            // 39452（FUEL_STOCK_CAP、STEEL_STOCK_CAP 在 logistics.ts）
export const INDUSTRY_SUPPLY_UNIT = .6, INDUSTRY_SUPPLY_BOOST = .3;                            // 39449–39450
export const FUEL_INDUSTRY_TAX_MUL = 1.10, FUEL_FREIGHT_TAX_MUL = 1.08, STEEL_INDUSTRY_TAX_MUL = 1.12;   // 39453
export const SHIPYARD_STEEL_USE = 1, SHIPYARD_TRADE_TAX_MUL = 1.15, SHIPYARD_PORT_GOLD = 5;    // 39454
export const FREIGHT_FUEL_USE = 2, FUEL_EXPORT_RATE = 4;                                        // 39457
export const SHIP_STEEL = 30, SHIP_PORT_CAP = 2, SHIP_DAILY_GOLD = 6;                          // 39458
export const MEGAPROJECT_CYCLE_DAYS = 24, MEGAPROJECT_SUPPLY_COST = 180, MEGAPROJECT_REWARD = 3500;   // 39660
export const GOODS_IMPORT_COST481 = 2.8, GOODS_EXPORT_PRICE481 = 2.35;                         // 38261
// 38278 COMMODITY_META482：六商品的進口價、出口價、外部價格的相位
export type CommodityId = 'food' | 'goods' | 'fuel' | 'steel' | 'gas' | 'supplies';
export const COMMODITY_META482: Record<CommodityId, { nm: string; importPrice: number; exportPrice: number; phase: number }> = {
  food: { nm: '食物', importPrice: 1.35, exportPrice: 1.05, phase: .4 },
  goods: { nm: '一般商品', importPrice: GOODS_IMPORT_COST481, exportPrice: GOODS_EXPORT_PRICE481, phase: 1.2 },
  fuel: { nm: '燃料', importPrice: 2.55, exportPrice: 2.00, phase: 2.1 },
  steel: { nm: '鋼材', importPrice: 3.20, exportPrice: 2.55, phase: 2.9 },
  gas: { nm: '天然氣', importPrice: 1.45, exportPrice: 1.10, phase: 3.7 },
  supplies: { nm: '工業原料', importPrice: 1.75, exportPrice: 1.20, phase: 4.4 },
};

// ---- 跨日狀態 ----
// 存檔欄位（實驗線 66763–66769、66952–66956）：sup＝supplies、gds＝goods（每次寫）、fuel364、steel364、shipCount、shipProgress（非零才寫）；
// gWhCap＝gWhCap284：昨天算的倉容量（55263 資源回收廠產貨物用它），讀檔時由存檔裡的倉儲（k64）重算（66959）、新圖 0；snap＝昨天的經濟快照（economy481），讀檔與新圖＝沒就緒
export interface EconState { goods: number; supplies: number; fuel: number; steel: number; shipCount: number; shipProgress: number; gWhCap: number; snap: EconomySnapshot | null }
export const emptyEconState = (): EconState => ({ goods: 0, supplies: 0, fuel: 0, steel: 0, shipCount: 0, shipProgress: 0, gWhCap: 0, snap: null });

// 56030 economy481（隔天 55585 的商工需求讀它；finance 那一欄是收支鏡像，不記）
export interface EconomySnapshot {
  ready: true; day: number; labor: Labor;
  consumption: { wealthPower: number; purchasingPower: number; residentDemand: number; touristDemand: number; retailCapacity: number; retailPressure: number; unmetRatio: number };
  goods: { made: number; need: number; domestic: number; imports: number; served: number; exports: number; stock: number; cap: number; stockRatio: number; shortageRatio: number; supplyRate: number };
  production: { industryUnits: number; inputDemand: number; inputUsed: number; marketMul: number };
  logistics: { efficiency: number; avgRoadLoad: number; overloadedShare: number; tradeCapacity: number };
  trade: { imports: number; exports: number; importCost: number; exportGold: number; balance: number; importShare: number; exportSignal: number };
  prices: { food: number; goods: number; costOfLiving: number };
  commerce: { salesMul: number; utilization: number };
}

// ---- 小函式 ----
// 38203 foodPriceOf：農產價格（第一天、讀檔第一天快照還沒有時，生活成本用它）
export function foodPriceOf(d: number, sea: number): number {
  const wave = 0.20 * Math.sin(d * 0.61) + 0.10 * Math.sin(d * 0.173 + 2.3), seaB = [1, 0.95, 0.85, 1.22][sea] || 1, dem = ((d % 53) < 4) ? 1.35 : 1;
  return clamp((1 + wave) * seaB * dem, 0.6, 1.8);
}
// 38298 externalPrice482：外部價格（day、季節的正弦），取三位小數
export function externalPrice482(id: CommodityId, d: number, sea: number): number {
  const p = COMMODITY_META482[id].phase || 0;
  let v = 1 + .075 * Math.sin(d * .071 + p) + .045 * Math.sin(d * .019 + p * 1.7);
  if (id === 'food') v *= ([1.00, .96, .90, 1.12][sea] || 1); else if (id === 'fuel' || id === 'gas') v *= ([.98, 1.08, 1.00, 1.12][sea] || 1); else if (id === 'steel' || id === 'supplies') v *= ([1.00, 1.03, 1.05, .98][sea] || 1);
  return +clamp(v, .82, 1.22).toFixed(3);
}
// 38270 purchasingPower481：購買力＝財富力×就業×工資×心情×稅×物價
export function purchasingPower481(labor: Labor, wealth: number, happy: number, cost: number, taxR: number): number {
  const emp = .55 + .45 * clamp(labor.employmentRate, 0, 1), wage = .82 + .18 * clamp(labor.wageIndex, .55, 1.55), mood = .92 + .08 * clamp(happy, 0, 1),
    tax = clamp(1 - Math.max(0, (taxR || 1) - 1) * .18, .82, 1.06), price = clamp(1.12 - (cost || 1) * .12, .82, 1.08);
  return clamp(wealth * emp * wage * mood * tax * price, .45, 1.45);
}
// 55348／55357／55388／56000 緊急物資儲備（pol?.emergencyStockpile492，D032）：出口與儲備多留一部分庫存；stock＝!!pol?.emergencyStockpile492
export const foodHold492Of = (stock: boolean, foodCoreNeed482: number): number => (stock ? Math.ceil(foodCoreNeed482 * .75) : 0);   // 55348：糧食出口前先留核心需求的 75%
export const gasHold492Of = (stock: boolean, gasDem: number): number => (stock ? Math.ceil(gasDem * .75) : 0);                      // 55357：天然氣出口前先留需求的 75%
export const goodsReserveMul492 = (stock: boolean): number => (stock ? 1.35 : 1);                                                   // 55388：商品儲備 ×1.35
export const fuelHoldMul492 = (stock: boolean): number => (stock ? 2.5 : 1);                                                        // 56000：燃料出口前先留需求的 2.5 倍
// 38268 wealthPower481：住宅（k1 依財富級、社宅、塔、巨廈）的居民加權平均，沒住宅的人口算 1
export function wealthPower481(w: World, tickBld: readonly number[], pTotal: number): number {
  let covered = 0, weighted = 0;
  for (const i of tickBld) {
    const b = w.tiles[i]?.bld; if (!b || b.ref) continue;
    let pp = 0, wt = 1;
    if (b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105) {
      pp = residentPopulation488(b, () => undefined);
      if (b.k === 1) { const we = b.we !== undefined ? b.we : 1; wt = we === 0 ? .72 : we === 2 ? 1.28 : 1; }
      else if (b.k === 127) wt = .72; else if (b.k === 33) wt = 1.08; else wt = 1.12;
    }
    if (pp > 0) { covered += pp; weighted += pp * wt; }
  }
  const rest = Math.max(0, pTotal - covered);
  return pTotal > 0 ? clamp((weighted + rest) / pTotal, .65, 1.35) : 1;
}
// 55364：施工中的房屋（age < 9 的根格）
export function activeConstruction482(w: World, tickBld: readonly number[]): number {
  let n = 0; for (const ci of tickBld) { const cb = w.tiles[ci].bld; if (cb && !cb.ref && (cb.age as number) < 9) n++; } return n;
}
// 38299 commoditySupply482（快照的六商品欄）
function commoditySupply482(production: number, demand: number, served: number, stock: number, cap: number, imports: number, exports: number, localPrice: number, externalPrice: number, importCost: number, exportGold: number, id: CommodityId) {
  const supplyRate = demand > 0 ? clamp(served / demand, 0, 1) : 1, shortageRatio = 1 - supplyRate, stockRatio = cap > 0 ? clamp(stock / cap, 0, 2) : 0;
  return { id, nm: COMMODITY_META482[id].nm, production: +production.toFixed(2), demand: +demand.toFixed(2), served: +served.toFixed(2), stock: +stock.toFixed(2), cap: +cap.toFixed(2), imports: +imports.toFixed(2), exports: +exports.toFixed(2), supplyRate: +supplyRate.toFixed(3),
    shortageRatio: +shortageRatio.toFixed(3), stockRatio: +stockRatio.toFixed(3), localPrice: +localPrice.toFixed(3), externalPrice: +externalPrice.toFixed(3), importCost: Math.round(importCost || 0), exportGold: Math.round(exportGold || 0) };
}
// gpn T508 關：進口可得性、出口需求只取整（68191、68192：n＝max(0, floor(+n||0))，再照原數）
const gpnInt = (n: number) => Math.max(0, Math.floor(+n || 0));

// ---- 55262–55266 資源回收廠（k111）產貨物 ----
// 正式清運：逐清運區 min(round(區的垃圾需求×.08), 區內回收廠數×6)；舊式：min(round(全城垃圾×.08), 回收廠數×6)。上限 goodsCap283()＝60＋昨天的 gWhCap284
export interface SanForGoods { formal: boolean; activeByK: Record<number, number>; districts: readonly { byK: Record<number, number>; demand: number }[] }
export function recycleGoods(st: EconState, san: SanForGoods, garbage: number, upc342: number, legacy452 = false): void {
  const cap = 60 + st.gWhCap;
  if (san.formal && !legacy452) {
    let upGoods452 = 0;
    for (const q of san.districts) { const n = q.byK[111] || 0; if (n > 0 && q.demand > 0) upGoods452 += Math.min(Math.round(q.demand * .08), n * 6); }
    if (upGoods452 > 0) st.goods = Math.min(cap, st.goods + upGoods452);
  } else {
    const upcEff445 = san.formal ? (san.activeByK[111] || 0) : upc342;
    if (upcEff445 > 0) st.goods = Math.min(cap, st.goods + Math.min(Math.round(garbage * .08), upcEff445 * 6));
  }
}

// ---- 55286–55413 經濟（一天一次，在食物與遊客之後）----
export interface EconIn {
  day: number; sea: number; pop: number; jobs: number; cityHappy: number; money: number; spec: string | null;
  roads: number;                         // tickRoad.length
  roadStats?: RoadStats;                 // 道路負載（T129，沒搬＝0）
  railLines?: number;                    // 火車線（T463，沒搬＝0）
  gasPowerDispatch?: number;             // T471 當日 CCGT／調峰機組的調度量（舊版供電＝0）
  pol?: { taxR?: number; emergencyStockpile492?: unknown } | null;   // 政策（D032）：稅率 taxR 進購買力（pol?.taxR||1）、緊急物資儲備 emergencyStockpile492 進出口的留存（55348、55357、55388、56000）
  eventFood?: number;                    // T299 城市活動的食物加成（本線沒有城市活動＝1；對拍時給實驗線那天的）
  c: Readonly<Record<string, number>>;   // 主計數迴圈的全部計數（count.ts tallyBuildings 的 cnt）
  fc: FoodCount;                         // 食物、觀光、貿易的計數（tally.fc）
  labor: Labor;                          // laborMarket481(pop, jobs)
  wealth: number;                        // wealthPower481(w, tickBld, pop)
  activeConstruction: number;            // activeConstruction482(w, tickBld)
}
export interface EconCtx {
  U: Units485; fd: FoodReport;
  // 55305–55325 深加工鏈
  refineryUtil489: number; steelMillUtil489: number; shipyardUtil489: number; fuelMade: number; steelMade: number; steelUsed: number; fuelUse418: number; freightTaxMul: number;
  shipDailyGold418: number; fuelTaxMul: number; steelTaxMul: number; steelDisc418: boolean; shipTradeTaxMul: number; shipPortGold: number;
  // 55328–55413 經濟
  laborNow481: Labor; effectiveIndUnits489: number; effectiveComUnits489: number;
  extFood482: number; extGoods482: number; extFuel482: number; extSteel482: number; extGas482: number; extSup482: number;
  wealthNow481: number; prevCost481: number; purchaseBase481: number; logisticsNow481: { efficiency: number; avgRoadLoad: number; overloadedShare: number; tradeCapacity: number };
  roadTradeBase482: number; tradeCapacity481: number; solvent482A1: boolean; tradeRemaining482: number; tradeUsed482: number;
  foodResidentNeed482: number; foodTouristNeed482: number; foodCoreNeed482: number; foodDomesticCore482: number; foodShortCore482: number; foodImport482: number; foodServedCore482: number; foodSupplyRate482: number;
  foodPoints: number; tourists: number; foodProcessPool482: number; kitchenFoodUse482: number; marketFoodUse482: number; foodPlantUse482: number; brewFoodUse482: number;
  foodExportLimit485: number; foodHold492: number; foodExportCandidate482: number; foodShortage482: number; foodSurplusSignal482: number; foodPrice481: number; foodImportCost482: number;
  gasPowerDispatchNow482: number; gasPowerNeed482: number; gasSup: number; gasDem: number; gasShortLocal482: number; gasImport482: number; gasServed482: number; gasRatio: number;
  gasSurplus482: number; gasExportCandidate482: number; gasImportCost482: number;
  fuelDemand482: number; fuelShort482: number; fuelImport482: number; fuelImportCost482: number;
  activeConstruction482: number; steelConstructionNeed482: number; steelBase482: number; steelTarget482: number; steelImport482: number; steelImportCost482: number;
  suppliesTarget482: number; suppliesImport482: number; suppliesImportCost482: number; gInput482: number; gMade384: number;
  gCap481: number; retailCapacity481: number; residentGoodsDemand481: number; touristGoodsDemand481: number; rawRetailDemand481: number; retailPressure481: number; gNeed284: number;
  domesticDeliverCap481: number; gDomesticUse481: number; shortagePreImport481: number; goodsImport481: number; gUse284: number; supplyRate481: number; shortageRatio481: number; importShare481: number;
  stockPreExport481: number; stockRatioPre481: number; reserve481: number; exportable481: number; exportSignal481: number;
  foodExport482: number; gasExport482: number; goodsExport481: number; foodExportGold482: number; gasExportGold482: number; goodsPrice481: number; costOfLiving481: number; purchasingPowerNow481: number;
  goodsImportCost481: number; goodsExportGold481: number; goodsMul284: number; commerceSalesMul481: number; industrialMarketMul481: number;
  gFlow284: { gain: number; use: number; mul: number };
  fuelHoldMul492: number;                // 56000：燃料出口前留的倍數（緊急物資儲備 2.5、沒開 1；economyLate 用）
  megaSupplyUsed482: number; indSupplyDemand: number; indSupplyUsed: number; indSupplyMul: number; mgReward: number;
}
// 一天的經濟（55305–55413）：改 st 的庫存與船、倉容量；回傳當天的每一個實驗線變數（同名）。呼叫端要在同一天接著叫 steelConstruction（施工之後）、economyLate、economySnapshots
export function economyMain(st: EconState, i: EconIn): EconCtx {
  const c = i.c, g = (k: string) => c[k] ?? 0, day = i.day, sea = i.sea, pop = i.pop;
  const U = unitsOf485(c, i.railLines ?? 0);
  const roadStats = i.roadStats ?? NO_ROAD_LOAD;
  const stock = !!i.pol?.emergencyStockpile492;   // 政策：緊急物資儲備（55348、55357、55388、56000）
  // 55305–55325 T364b／T418 深加工鏈：企業層關＝利用率 1；開採量（oilGain、oreGain、suppliesGain）沒搬＝計數裡恆 0
  const refineryUtil489 = 1, steelMillUtil489 = 1, shipyardUtil489 = 1;
  const refineryN = g('refineryN'), steelMillN = g('steelMillN'), shipyardN = g('shipyardN');
  const fuelMade = refineryN > 0 ? Math.min(g('oilGain'), refineryN * REFINERY_RATE * refineryUtil489, Math.max(0, U.fuelCap485 - st.fuel)) : 0;
  const steelMade = steelMillN > 0 ? Math.min(g('oreGain'), steelMillN * STEEL_MILL_RATE * steelMillUtil489, Math.max(0, U.steelCap485 - st.steel)) : 0;
  st.supplies += g('suppliesGain') - fuelMade - steelMade;
  st.fuel += fuelMade; st.steel += steelMade;
  const steelUsed = shipyardN > 0 ? Math.min(st.steel, shipyardN * SHIPYARD_STEEL_USE * shipyardUtil489) : 0;
  st.steel -= steelUsed;
  const fuelUse418 = U.freightUnits485 > 0 ? Math.min(st.fuel, U.freightUnits485 * FREIGHT_FUEL_USE) : 0;
  st.fuel -= fuelUse418;
  const freightTaxMul = 1 + (FUEL_FREIGHT_TAX_MUL - 1) * (U.freightUnits485 > 0 ? fuelUse418 / (U.freightUnits485 * FREIGHT_FUEL_USE) : 0);
  if (steelUsed > 0 && U.portEquivalent485 > 0) { st.shipProgress += steelUsed; if (st.shipProgress >= SHIP_STEEL) { st.shipCount += Math.floor(st.shipProgress / SHIP_STEEL); st.shipProgress %= SHIP_STEEL; } }
  if (st.shipCount > U.portEquivalent485 * SHIP_PORT_CAP) st.shipCount = U.portEquivalent485 * SHIP_PORT_CAP;
  const shipDailyGold418 = st.shipCount * SHIP_DAILY_GOLD;
  const fuelTaxMul = st.fuel > 0 ? FUEL_INDUSTRY_TAX_MUL : 1;
  const steelTaxMul = st.steel > 0 ? STEEL_INDUSTRY_TAX_MUL : 1, steelDisc418 = st.steel > 0;
  const shipTradeTaxMul = steelUsed > 0 ? SHIPYARD_TRADE_TAX_MUL : 1;
  const shipPortGold = steelUsed > 0 ? Math.round(U.portEquivalent485 * steelUsed * SHIPYARD_PORT_GOLD * (i.spec === 'ind' ? 1.25 : 1)) : 0;
  // 55328 倉容量：倉儲物流中心的容量加物流的加成（今天的；55263 用的是昨天的）
  st.gWhCap = g('whCap284') + U.goodsCapBonus485;
  const goodsCap = () => 60 + st.gWhCap;
  // 55329：勞動市場（呼叫端算好）、能銷售與生產的有效單位
  const laborNow481 = i.labor, effectiveIndUnits489 = g('nIndG284') * 1, effectiveComUnits489 = g('nComG284') * 1;
  const extFood482 = externalPrice482('food', day, sea), extGoods482 = externalPrice482('goods', day, sea), extFuel482 = externalPrice482('fuel', day, sea), extSteel482 = externalPrice482('steel', day, sea),
    extGas482 = externalPrice482('gas', day, sea), extSup482 = externalPrice482('supplies', day, sea);
  const wealthNow481 = i.wealth, prevCost481 = st.snap ? st.snap.prices.costOfLiving : foodPriceOf(day, sea);
  const purchaseBase481 = clamp(purchasingPower481(laborNow481, wealthNow481, i.cityHappy, prevCost481, i.pol?.taxR || 1) * 1, .40, 1.65);   // 55332：pol?.taxR||1；businessCycleConsumptionMul490()＝1
  // 55293–55299、55333–55342：食物與遊客、貿易額度、糧食進口與供糧率（food.ts foodDay；額度用 T485 的單位、船、壅堵、貨運燃料的效率加成）
  const fd = foodDay(i.fc, i.roads, pop, sea, day, { U, roadStats, shipCount: st.shipCount, fuelMul: freightTaxMul, eventFood: i.eventFood, spec: i.spec });
  const logisticsNow481 = { efficiency: fd.eff, avgRoadLoad: +roadStats.avg.toFixed(4), overloadedShare: +roadStats.over.toFixed(4), tradeCapacity: fd.cap };
  const roadTradeBase482 = fd.roadBase, tradeCapacity481 = fd.cap;
  const solvent482A1 = i.money >= 0;
  let tradeRemaining482 = fd.remaining, tradeUsed482 = fd.used;
  const takeTrade482 = (n: number) => { const q = Math.max(0, Math.min(Math.floor(n || 0), tradeRemaining482)); tradeRemaining482 -= q; tradeUsed482 += q; return q; };
  const tp336 = g('tp336'), foodPoints = fd.points, tourists = fd.tourists;
  // FOOD：先保居民與遊客基本需求（fd），再把剩餘本地糧食分配給廚房→農貿→食品加工→釀酒，最後才出口
  let foodProcessPool482 = Math.max(0, foodPoints - fd.domestic);
  const kitchenFoodUse482 = Math.min(foodProcessPool482, g('kt346') * 10 * 1); foodProcessPool482 -= kitchenFoodUse482;
  const marketFoodUse482 = Math.min(foodProcessPool482, g('mk330') * 4); foodProcessPool482 -= marketFoodUse482;
  const foodPlantUse482 = Math.min(foodProcessPool482, g('procCapU')); foodProcessPool482 -= foodPlantUse482;
  const brewFoodUse482 = Math.min(foodProcessPool482, g('br340') * 3 * 1); foodProcessPool482 -= brewFoodUse482;
  const foodExportLimit485 = tp336 * 15 + U.siloEff489 * 18 + U.coldEff489 * 8 + U.bulkEff489 * 24 + U.cportEff489 * 35, foodHold492 = foodHold492Of(stock, fd.need),
    foodExportCandidate482 = foodExportLimit485 > 0 ? Math.min(Math.max(0, foodProcessPool482 - foodHold492), foodExportLimit485) : 0;
  const foodShortage482 = 1 - fd.rate, foodSurplusSignal482 = fd.need > 0 ? clamp(foodProcessPool482 / Math.max(1, fd.need), 0, 1) : 0,
    foodPrice481 = clamp(extFood482 * (1 + foodShortage482 * .32 - foodSurplusSignal482 * .08), .70, 1.80),
    foodImportCost482 = Math.round(fd.imports * COMMODITY_META482.food.importPrice * extFood482);
  // GAS：化肥／中央廚房／食品加工＋當日發電調度形成的需求；不足向同一個貿易池進口
  const gasPowerDispatchNow482 = i.gasPowerDispatch ?? 0, gasPowerNeed482 = Math.ceil(gasPowerDispatchNow482 * .035);
  const gasSup = g('gw346') * 8, gasDem = g('fp346') * 3 * 1 + g('kt346') * 2 * 1 + g('fpN') * 1 + gasPowerNeed482;
  const gasShortLocal482 = Math.max(0, gasDem - gasSup), gasImport482 = takeTrade482(gpnInt(gasShortLocal482)), gasServed482 = Math.min(gasDem, gasSup + gasImport482);
  const gasRatio = gasDem > 0 ? clamp(gasServed482 / gasDem, 0, 1) : 1;
  const gasSurplus482 = Math.max(0, gasSup - gasDem), gasExportCandidate482 = gasImport482 > 0 ? 0 : Math.min(Math.max(0, gasSurplus482 - gasHold492Of(stock, gasDem)), tp336 * 4 + U.gasDepEff489 * 8 + U.bulkEff489 * 5 + U.cportEff489 * 6),
    gasImportCost482 = Math.round(gasImport482 * COMMODITY_META482.gas.importPrice * extGas482);
  // FUEL：貨運燃料已在上面先消耗；有償付能力才用貿易額度補回缺口
  const fuelDemand482 = U.freightUnits485 * FREIGHT_FUEL_USE, fuelShort482 = Math.max(0, fuelDemand482 - fuelUse418),
    fuelImport482 = solvent482A1 ? takeTrade482(gpnInt(Math.min(fuelShort482, Math.max(0, U.fuelCap485 - st.fuel)))) : 0;
  st.fuel = Math.min(U.fuelCap485, st.fuel + fuelImport482);
  const fuelImportCost482 = Math.round(fuelImport482 * COMMODITY_META482.fuel.importPrice * extFuel482);
  // STEEL：造船先吃本地鋼；估算施工中的房屋數後補安全庫存（有煉鋼廠或造船廠才成立；企業層關時利用率 1，所以恆成立）
  const steelConstructionNeed482 = steelMillN > 0 ? Math.min(i.activeConstruction, steelMillN * STEEL_MILL_RATE * steelMillUtil489) : 0,
    steelBase482 = (steelMillUtil489 > 0 || shipyardUtil489 > 0) ? Math.ceil(12 * Math.max(steelMillUtil489, shipyardUtil489)) : 0,
    steelTarget482 = Math.min(U.steelCap485, steelConstructionNeed482 + shipyardN * SHIPYARD_STEEL_USE * shipyardUtil489 + steelBase482),
    steelImport482 = solvent482A1 ? takeTrade482(gpnInt(Math.max(0, steelTarget482 - st.steel))) : 0;
  st.steel = Math.min(U.steelCap485, st.steel + steelImport482);
  const steelImportCost482 = Math.round(steelImport482 * COMMODITY_META482.steel.importPrice * extSteel482);
  // SUPPLIES：先用貿易補一般工業的短缺，再做貨物
  const suppliesTarget482 = Math.ceil(effectiveIndUnits489 / 2) + Math.ceil(effectiveIndUnits489 * INDUSTRY_SUPPLY_UNIT * .6),
    suppliesImport482 = solvent482A1 ? takeTrade482(gpnInt(Math.max(0, suppliesTarget482 - st.supplies))) : 0;
  st.supplies += suppliesImport482;
  const suppliesImportCost482 = Math.round(suppliesImport482 * COMMODITY_META482.supplies.importPrice * extSup482);
  let gInput482 = 0, gMade384 = 0;
  { const gCap = goodsCap(), room482 = Math.max(0, gCap - st.goods);
    gInput482 = (st.supplies > 0 && effectiveIndUnits489 > 0) ? Math.min(st.supplies, Math.ceil(effectiveIndUnits489 / 2), Math.floor(room482 / 2)) : 0;
    gMade384 = Math.max(0, gInput482 * 2);
    if (gInput482 > 0) { st.supplies -= gInput482; st.goods = Math.min(gCap, st.goods + gMade384); } }
  // 零售：能量、需求、壓力、缺貨、進口、出口訊號
  const gCap481 = goodsCap(), retailCapacity481 = effectiveComUnits489 > 0 ? Math.max(1, effectiveComUnits489 * .80) : 0,
    residentGoodsDemand481 = pop / 180 * purchaseBase481, touristGoodsDemand481 = tourists / 320,
    rawRetailDemand481 = effectiveComUnits489 > 0 ? Math.max(effectiveComUnits489 * .12, residentGoodsDemand481 + touristGoodsDemand481) : 0,
    retailPressure481 = retailCapacity481 > 0 ? rawRetailDemand481 / retailCapacity481 : 0,
    gNeed284 = retailCapacity481 > 0 ? Math.ceil(Math.min(retailCapacity481, rawRetailDemand481)) : 0,
    domesticDeliverCap481 = Math.ceil(gNeed284 * Math.min(1, logisticsNow481.efficiency)), gDomesticUse481 = Math.min(st.goods, domesticDeliverCap481);
  st.goods -= gDomesticUse481;
  const shortagePreImport481 = Math.max(0, gNeed284 - gDomesticUse481), goodsImport481 = takeTrade482(gpnInt(shortagePreImport481)),
    gUse284 = gDomesticUse481 + goodsImport481, supplyRate481 = gNeed284 > 0 ? clamp(gUse284 / gNeed284, 0, 1) : 1,
    shortageRatio481 = 1 - supplyRate481, importShare481 = gUse284 > 0 ? goodsImport481 / gUse284 : 0,
    stockPreExport481 = st.goods, stockRatioPre481 = gCap481 > 0 ? st.goods / gCap481 : 0,
    reserve481 = Math.max(gNeed284 * 2, gCap481 * .28) * goodsReserveMul492(stock), exportable481 = Math.max(0, st.goods - reserve481),
    exportSignal481 = tradeCapacity481 > 0 ? clamp(exportable481 / Math.max(1, tradeCapacity481 * .35), 0, 1) : 0;
  // 所有短缺進口完成後才開始出口（糧食→天然氣→貨物；燃料與鋼材的出口在 economyLate）
  const foodExport482 = takeTrade482(gpnInt(foodExportCandidate482)); foodProcessPool482 -= foodExport482;
  const gasExport482 = takeTrade482(gpnInt(gasExportCandidate482));
  const goodsExport481 = goodsImport481 > 0 ? 0 : takeTrade482(gpnInt(exportable481)); st.goods -= goodsExport481;
  const foodExportGold482 = Math.round(foodExport482 * COMMODITY_META482.food.exportPrice * extFood482), gasExportGold482 = Math.round(gasExport482 * COMMODITY_META482.gas.exportPrice * extGas482),
    goodsPrice481 = clamp(extGoods482 * (1 + shortageRatio481 * .18 + importShare481 * .05 - (gCap481 > 0 ? st.goods / gCap481 : 0) * .06), .82, 1.32),
    costOfLiving481 = foodPrice481 * .55 + goodsPrice481 * .45,
    purchasingPowerNow481 = clamp(purchasingPower481(laborNow481, wealthNow481, i.cityHappy, costOfLiving481, i.pol?.taxR || 1) * 1, .40, 1.65),
    goodsImportCost481 = Math.round(goodsImport481 * COMMODITY_META482.goods.importPrice * extGoods482), goodsExportGold481 = Math.round(goodsExport481 * COMMODITY_META482.goods.exportPrice * extGoods482),
    goodsMul284 = .75 + .50 * supplyRate481,
    commerceSalesMul481 = clamp((.72 + purchasingPowerNow481 * .28) * (.94 + Math.min(1.25, retailPressure481) * .08), .64, 1.18),
    industrialMarketMul481 = clamp(.78 + shortageRatio481 * .26 + exportSignal481 * .20 + Math.min(1, retailPressure481) * .08 - Math.max(0, stockRatioPre481 - .70) * .20, .70, 1.22);
  const gFlow284 = { gain: stockPreExport481 + gDomesticUse481, use: gUse284, mul: +goodsMul284.toFixed(3) };
  // 工業原料的稅收加成、太空研究中心每 24 天一輪（供應品夠 180 就花掉，每座換 $3,500）
  let megaSupplyUsed482 = 0, mgReward = 0;
  const indSupplyDemand = effectiveIndUnits489 * INDUSTRY_SUPPLY_UNIT, indSupplyUsed = Math.min(st.supplies, indSupplyDemand);
  st.supplies -= indSupplyUsed;
  const indSupplyMul = indSupplyDemand > 0 ? 1 + (indSupplyUsed / indSupplyDemand) * INDUSTRY_SUPPLY_BOOST : 1;
  const mgN = g('mgN');
  if (mgN > 0 && day % MEGAPROJECT_CYCLE_DAYS === 0 && st.supplies >= MEGAPROJECT_SUPPLY_COST) { st.supplies -= MEGAPROJECT_SUPPLY_COST; megaSupplyUsed482 = MEGAPROJECT_SUPPLY_COST; mgReward = MEGAPROJECT_REWARD * mgN; }
  return {
    U, fd, refineryUtil489, steelMillUtil489, shipyardUtil489, fuelMade, steelMade, steelUsed, fuelUse418, freightTaxMul, shipDailyGold418, fuelTaxMul, steelTaxMul, steelDisc418, shipTradeTaxMul, shipPortGold,
    laborNow481, effectiveIndUnits489, effectiveComUnits489, extFood482, extGoods482, extFuel482, extSteel482, extGas482, extSup482, wealthNow481, prevCost481, purchaseBase481, logisticsNow481,
    roadTradeBase482, tradeCapacity481, solvent482A1, tradeRemaining482, tradeUsed482,
    foodResidentNeed482: fd.residentNeed, foodTouristNeed482: fd.touristNeed, foodCoreNeed482: fd.need, foodDomesticCore482: fd.domestic, foodShortCore482: fd.short, foodImport482: fd.imports, foodServedCore482: fd.served, foodSupplyRate482: fd.rate,
    foodPoints, tourists, foodProcessPool482, kitchenFoodUse482, marketFoodUse482, foodPlantUse482, brewFoodUse482, foodExportLimit485, foodHold492, foodExportCandidate482, foodShortage482, foodSurplusSignal482, foodPrice481, foodImportCost482,
    gasPowerDispatchNow482, gasPowerNeed482, gasSup, gasDem, gasShortLocal482, gasImport482, gasServed482, gasRatio, gasSurplus482, gasExportCandidate482, gasImportCost482,
    fuelDemand482, fuelShort482, fuelImport482, fuelImportCost482,
    activeConstruction482: i.activeConstruction, steelConstructionNeed482, steelBase482, steelTarget482, steelImport482, steelImportCost482, suppliesTarget482, suppliesImport482, suppliesImportCost482, gInput482, gMade384,
    gCap481, retailCapacity481, residentGoodsDemand481, touristGoodsDemand481, rawRetailDemand481, retailPressure481, gNeed284, domesticDeliverCap481, gDomesticUse481, shortagePreImport481, goodsImport481, gUse284,
    supplyRate481, shortageRatio481, importShare481, stockPreExport481, stockRatioPre481, reserve481, exportable481, exportSignal481,
    foodExport482, gasExport482, goodsExport481, foodExportGold482, gasExportGold482, goodsPrice481, costOfLiving481, purchasingPowerNow481, goodsImportCost481, goodsExportGold481, goodsMul284, commerceSalesMul481, industrialMarketMul481,
    gFlow284, fuelHoldMul492: fuelHoldMul492(stock), megaSupplyUsed482, indSupplyDemand, indSupplyUsed, indSupplyMul, mgReward,
  };
}

// ---- 55655–55672 煉鋼廠加速施工 ----
// 有煉鋼廠時，每天用鋼庫存讓施工中的房屋多長一天（age＋1）：額度＝鋼廠日吞吐（並受庫存限制）、輪轉起點＝day％施工中的座數；每加速一棟，鋼庫存 −1。回傳當天的施工耗鋼（constrSteelUse418）
export function steelConstruction(st: EconState, steelMillN: number, w: World, tickBld: readonly number[], day: number): number {
  let constrSteelUse418 = 0;
  if (steelMillN > 0) {
    let cap418 = Math.min(steelMillN * STEEL_MILL_RATE, st.steel);
    const el418: number[] = [];
    for (const i of tickBld) { const b = w.tiles[i].bld; if (b && !b.ref && (b.age as number) < 9) el418.push(i); }
    const nE418 = el418.length, offE418 = nE418 ? day % nE418 : 0;
    for (let j418 = 0; j418 < nE418; j418++) {
      if (cap418 <= 0 || st.steel <= 0) break;
      const b = w.tiles[el418[(j418 + offE418) % nE418]].bld!;
      (b.age as number)++; cap418--; st.steel--; constrSteelUse418++;
    }
  }
  return constrSteelUse418;
}

// ---- 55996–56021 出口的金幣、燃料與鋼材出口（在 55990 之後才抽池，排在貨物出口之後）----
export interface EconLate { tradeGold: number; fuelExport418: number; fuelExportGold418: number; gasGold: number; steelReserve482: number; steelExport482: number; steelExportGold482: number; suppliesUsed482: number }
export function economyLate(st: EconState, ec: EconCtx, c: Readonly<Record<string, number>>): EconLate {
  const g = (k: string) => c[k] ?? 0;
  const takeTrade482 = (n: number) => { const q = Math.max(0, Math.min(Math.floor(n || 0), ec.tradeRemaining482)); ec.tradeRemaining482 -= q; ec.tradeUsed482 += q; return q; };
  const tp336 = g('tp336'), fuelDepOp485 = g('fuelDepOp485'), bulkOp485 = g('bulkOp485'), cportOp485 = g('cportOp485'), shipyardN = g('shipyardN');
  const tradeGoldBase = ec.foodExportGold482;
  const tradeGold = ec.shipTradeTaxMul > 1 ? Math.round(tradeGoldBase * ec.shipTradeTaxMul) : tradeGoldBase;                              // 55997
  const fuelExport418 = (tp336 + fuelDepOp485 + bulkOp485 + cportOp485) > 0
    ? takeTrade482(gpnInt(Math.min(Math.max(0, st.fuel - Math.ceil(ec.fuelDemand482 * ec.fuelHoldMul492)), tp336 * FUEL_EXPORT_RATE + fuelDepOp485 * 8 + bulkOp485 * 10 + cportOp485 * 12))) : 0;   // 56000：pol?.emergencyStockpile492 ？ 2.5 : 1
  if (fuelExport418 > 0) st.fuel -= fuelExport418;
  const fuelExportGold418 = fuelExport418 > 0 ? Math.round(fuelExport418 * COMMODITY_META482.fuel.exportPrice * ec.extFuel482) : 0;
  const gasGold = Math.round(ec.gasExportGold482);                                                                                         // 56011
  const steelReserve482 = Math.max(18, ec.steelConstructionNeed482 + shipyardN * SHIPYARD_STEEL_USE * ec.shipyardUtil489 * 3),
    steelExport482 = ec.steelImport482 > 0 ? 0 : takeTrade482(gpnInt(Math.max(0, st.steel - steelReserve482)));                            // 56018
  if (steelExport482 > 0) st.steel -= steelExport482;
  const steelExportGold482 = Math.round(steelExport482 * COMMODITY_META482.steel.exportPrice * ec.extSteel482);
  const suppliesUsed482 = ec.gInput482 + ec.indSupplyUsed + ec.megaSupplyUsed482;
  return { tradeGold, fuelExport418, fuelExportGold418, gasGold, steelReserve482, steelExport482, steelExportGold482, suppliesUsed482 };
}

// ---- 56030–56046 快照 ----
// economy481 是隔天需求讀的那一份；economy482（貿易與六商品）、logistics485（物流設施）是給介面看的。finance（收支鏡像）、recipes 不記
export function economySnapshots(st: EconState, ec: EconCtx, late: EconLate, c: Readonly<Record<string, number>>, day: number, constrSteelUse418: number) {
  const g = (k: string) => c[k] ?? 0, U = ec.U;
  const economy481: EconomySnapshot = {
    ready: true, day, labor: { ...ec.laborNow481 },
    consumption: { wealthPower: +ec.wealthNow481.toFixed(3), purchasingPower: +ec.purchasingPowerNow481.toFixed(3), residentDemand: +ec.residentGoodsDemand481.toFixed(2), touristDemand: +ec.touristGoodsDemand481.toFixed(2),
      retailCapacity: +ec.retailCapacity481.toFixed(2), retailPressure: +ec.retailPressure481.toFixed(3), unmetRatio: +ec.shortageRatio481.toFixed(3) },
    goods: { made: ec.gMade384, need: ec.gNeed284, domestic: ec.gDomesticUse481, imports: ec.goodsImport481, served: ec.gUse284, exports: ec.goodsExport481, stock: Math.round(st.goods), cap: ec.gCap481,
      stockRatio: +(ec.gCap481 ? st.goods / ec.gCap481 : 0).toFixed(3), shortageRatio: +ec.shortageRatio481.toFixed(3), supplyRate: +ec.supplyRate481.toFixed(3) },
    production: { industryUnits: +ec.effectiveIndUnits489.toFixed(2), inputDemand: +ec.indSupplyDemand.toFixed(2), inputUsed: +ec.indSupplyUsed.toFixed(2), marketMul: +ec.industrialMarketMul481.toFixed(3) },
    logistics: { ...ec.logisticsNow481 },
    trade: { imports: ec.goodsImport481, exports: ec.goodsExport481, importCost: ec.goodsImportCost481, exportGold: ec.goodsExportGold481, balance: ec.goodsExportGold481 - ec.goodsImportCost481,
      importShare: +ec.importShare481.toFixed(3), exportSignal: +ec.exportSignal481.toFixed(3) },
    prices: { food: +ec.foodPrice481.toFixed(3), goods: +ec.goodsPrice481.toFixed(3), costOfLiving: +ec.costOfLiving481.toFixed(3) },
    commerce: { salesMul: +ec.commerceSalesMul481.toFixed(3), utilization: +ec.retailPressure481.toFixed(3) },
  };
  const totalImportCost482 = ec.foodImportCost482 + ec.gasImportCost482 + ec.fuelImportCost482 + ec.steelImportCost482 + ec.suppliesImportCost482 + ec.goodsImportCost481,
    totalExportGold482 = late.tradeGold + late.gasGold + late.fuelExportGold418 + late.steelExportGold482 + ec.goodsExportGold481,
    fuelServed482 = Math.min(ec.fuelDemand482, ec.fuelUse418), steelDemand482 = g('shipyardN') * SHIPYARD_STEEL_USE * ec.shipyardUtil489 + ec.steelConstructionNeed482,
    steelServed482 = Math.min(steelDemand482, ec.steelUsed + constrSteelUse418), suppliesDemand482 = Math.ceil(ec.effectiveIndUnits489 / 2) + ec.indSupplyDemand + ec.megaSupplyUsed482,
    suppliesServed482 = Math.min(suppliesDemand482, late.suppliesUsed482),
    fuelLocalPrice482 = clamp(ec.extFuel482 * (1 + (ec.fuelDemand482 > 0 ? 1 - fuelServed482 / ec.fuelDemand482 : 0) * .18 - (st.fuel / U.fuelCap485) * .04), .82, 1.35),
    steelLocalPrice482 = clamp(ec.extSteel482 * (1 + (steelDemand482 > 0 ? 1 - steelServed482 / steelDemand482 : 0) * .20 - (st.steel / U.steelCap485) * .04), .82, 1.40),
    gasLocalPrice482 = clamp(ec.extGas482 * (1 + (1 - ec.gasRatio) * .22), .82, 1.40),
    supLocalPrice482 = clamp(ec.extSup482 * (1 + (suppliesDemand482 > 0 ? 1 - suppliesServed482 / suppliesDemand482 : 0) * .18), .82, 1.35);
  const suppliesGain = g('suppliesGain');
  const economy482 = {
    ready: true, day,
    commodities: {
      food: commoditySupply482(ec.foodPoints, ec.foodCoreNeed482, ec.foodServedCore482, 0, 0, ec.foodImport482, ec.foodExport482, ec.foodPrice481, ec.extFood482, ec.foodImportCost482, late.tradeGold, 'food'),
      goods: commoditySupply482(ec.gMade384, ec.gNeed284, ec.gUse284, st.goods, ec.gCap481, ec.goodsImport481, ec.goodsExport481, ec.goodsPrice481, ec.extGoods482, ec.goodsImportCost481, ec.goodsExportGold481, 'goods'),
      fuel: commoditySupply482(ec.fuelMade, ec.fuelDemand482, fuelServed482, st.fuel, U.fuelCap485, ec.fuelImport482, late.fuelExport418, fuelLocalPrice482, ec.extFuel482, ec.fuelImportCost482, late.fuelExportGold418, 'fuel'),
      steel: commoditySupply482(ec.steelMade, steelDemand482, steelServed482, st.steel, U.steelCap485, ec.steelImport482, late.steelExport482, steelLocalPrice482, ec.extSteel482, ec.steelImportCost482, late.steelExportGold482, 'steel'),
      gas: commoditySupply482(ec.gasSup, ec.gasDem, ec.gasServed482, 0, 0, ec.gasImport482, ec.gasExport482, gasLocalPrice482, ec.extGas482, ec.gasImportCost482, late.gasGold, 'gas'),
      supplies: commoditySupply482(Math.max(0, suppliesGain - ec.fuelMade - ec.steelMade), suppliesDemand482, suppliesServed482, st.supplies, 0, ec.suppliesImport482, 0, supLocalPrice482, ec.extSup482, ec.suppliesImportCost482, 0, 'supplies'),
    },
    trade: { capacity: ec.tradeCapacity481, used: ec.tradeUsed482, remaining: ec.tradeRemaining482,
      imports: ec.foodImport482 + ec.goodsImport481 + ec.fuelImport482 + ec.steelImport482 + ec.gasImport482 + ec.suppliesImport482,
      exports: ec.foodExport482 + ec.goodsExport481 + late.fuelExport418 + late.steelExport482 + ec.gasExport482, importCost: totalImportCost482, exportGold: totalExportGold482, balance: totalExportGold482 - totalImportCost482 },
    powerGas: { dispatch: ec.gasPowerDispatchNow482, demand: ec.gasPowerNeed482 }, financialMarket: false,
  };
  const fac = (built: string, active: string, eff: number) => ({ built: g(built), active: g(active), effective: +eff.toFixed(2) });
  const logistics485 = {
    ready: true, day,
    facilities: { containerLogistics: fac('cl485', 'clOp485', U.clEff489), intermodalHub: fac('im485', 'imOp485', U.imEff489), distributionCenter: fac('dc485', 'dcOp485', U.dcEff489), coldStorage: fac('cold485', 'coldOp485', U.coldEff489),
      grainSilo: fac('silo485', 'siloOp485', U.siloEff489), fuelDepot: fac('fuelDep485', 'fuelDepOp485', U.fuelDepEff489), gasDepot: fac('gasDep485', 'gasDepOp485', U.gasDepEff489), steelYard: fac('steelY485', 'steelYOp485', U.steelYEff489),
      bulkTerminal: fac('bulk485', 'bulkOp485', U.bulkEff489), containerPort: fac('cport485', 'cportOp485', U.cportEff489) },
    freightUnits: U.freightUnits485, warehouseUnits: +U.warehouseUnits485.toFixed(1), portEquivalent: U.portEquivalent485, railUnits: U.railUnits485, goodsCapBonus: U.goodsCapBonus485, fuelCap: U.fuelCap485, steelCap: U.steelCap485,
    foodPreservation: +U.foodPreserveMul485.toFixed(3), tradeCapacity: ec.tradeCapacity481, logisticsEfficiency: +ec.logisticsNow481.efficiency.toFixed(3),
  };
  return { economy481, economy482, logistics485, totalImportCost482, totalExportGold482, fuelServed482, steelDemand482, steelServed482, suppliesDemand482, suppliesServed482, fuelLocalPrice482, steelLocalPrice482, gasLocalPrice482, supLocalPrice482 };
}
