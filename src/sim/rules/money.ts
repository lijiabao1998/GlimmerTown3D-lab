// 資金（D011）：每天收稅、付維護費、結算，接著貸款、人口里程碑、星等獎金、紓困。照實驗線 tick() 原式逐行搬，運算順序不動（浮點逐位元相等）。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d（index.html 行號）。對拍見 tools/lab-money.mjs（實驗線原碼在 vm 裡跑的黃金樣本）、tools/unit-d011-money.mjs。
// 第 2 類系統（經濟快照 T481／T482、城市活動 T299、夜間城市 T487、地鐵、票務、企業 T489、住房 T488……）本線沒搬：它們給的乘數、進口費、其他收入一律是輸入。
// D011 的模擬給中性值（neutralTaxMul、neutralUpkeepIn：乘數 1、進口費 0、沒有城市活動）；對拍給隨機值。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { clamp, tq, type Bld, type Fields, type World } from './lab.ts';
import { JOBSC, JOBSI, MEGA_JOBS, TOWER_JOBS, residentPopulation488 } from './jobs.ts';
import { getMaxRoadClass } from './grid.ts';
import type { SvcBudget } from './fields.ts';

export const ROAD_UPKEEP = [0.01, 0.02, 0.05, 0.12, 0.35];   // 37429 道路每格每日維護（等級 1–5）
export const WEALTH_TAX = [0.6, 1, 1.5];                    // 37416 住宅財富稅率係數：貧／中／富
export const MILES = [[50, 300], [150, 600], [400, 1000], [900, 1600], [1600, 2600], [2600, 4000], [4000, 6000], [7000, 10000]];   // 37861 人口里程碑 [門檻, 獎金]
export const DIFF_MONEY = [5000, 3000, 1500, 3000];         // 39435 起始資金：簡單／標準／困難／沙盒（沙盒蓋東西不花錢 51505，不結算 56053）
export const SOCIAL_HOUSING_WE = 0;                         // 39460 社宅固定低所得
export const SVC_FLEET_DEFAULT = { fire: 3, police: 2, amb: 2 };   // 57605 服務車隊預設（55989：超出 7 輛才收保養費）
// 38129 LMCFG309 的鍵（觀光地標 T309／T517／T518）：55958 不繳 RCI 稅
export const LMCFG309_KINDS = new Set([70, 73, 78, 79, 80, 74, 69, 71, 72, 75, 76, 77, 179, 180, 181, 182, 183, 184, 185, 186]);
// 55891–55953 逐一列出、什麼都不做的種類（公共設施、交通、地標、產業鏈……）：不繳 RCI 稅，免得落到最後一支收「幽靈工業稅」
export const NO_TAX_K = new Set([14, 15, 10, 7, 13, 16, 8, 9, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32,
  35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68, 121, 122, 123]);

// 實驗線 bld 上跟稅有關、lab.ts 沒列的旗標（廢棄、暴亂、瘟疫：本線 D011 不會設，匯入的碼可能帶 abandoned）
export type MoneyBld = Bld & { abandoned?: number | boolean; riot?: number | boolean; plague?: number | boolean };
type Flag = boolean | number | undefined;
// 實驗線 pol（政策與稅率；沒有政策時是 null，38248）。這裡只列資金公式讀到的欄位
export interface LabPol {
  taxR?: number; taxC?: number; taxI?: number;                                  // 稅率（0／缺＝1：55961 起的 ||1）
  tourPromo?: Flag; nightMarket?: Flag; ecoReg?: Flag; indSubsidy?: Flag;       // 稅收乘數（55963、55965）
  recycle?: Flag; schoolLunch?: Flag; smokeDetect?: Flag; parkNight?: Flag; insurance?: Flag; waterConserve?: Flag; reclaimPriority?: Flag;   // 55972 每日法規費
  industrialPretreat?: Flag; spongeCity?: Flag; housingSubsidy?: Flag; inclusionaryHousing?: Flag; stationHousing?: Flag; infrastructureStimulus?: Flag;
  consumptionSupport?: Flag; industrialRelief?: Flag; completeStreets?: Flag; parkingManagement?: Flag; criticalReserve492?: Flag; emergencyStockpile492?: Flag;
  freeTransit?: Flag; integratedTransit?: Flag;                                 // 55987、56027 票務
}
export type TaxFields = Pick<Fields, 'COV' | 'LAND' | 'EDU'>;
const DEFAULT_PM: LabPol = { taxR: 1, taxC: 1, taxI: 1 };   // 55915 起：pol||{taxR:1,taxC:1,taxI:1}
const sqOf = (spec: string | null, id: string, on: number, off: number) => spec === id ? on : off;   // 37851 sq（spec386）

// 稅收迴圈讀的乘數（55874–55965）：全部是輸入，實驗線的來源寫在右邊
export interface TaxMul {
  civicMul: number;                    // 55874：市政廳 k42 有一座以上 1.03（civicMulOf）
  pm: LabPol | null;                   // 實驗線 pol；null＝沒有政策，照 55961 退回 {taxR:1,taxC:1,taxI:1}
  goodsMul284: number;                 // 55397 商品供貨
  commerceSalesMul481: number;         // 55398 商業營業額（跟購買力走）
  industrialMarketMul481: number;      // 55399 工業市場
  indSupplyMul: number;                // 55406 工業原料
  fuelTaxMul: number; steelTaxMul: number;   // 55322–55323 燃料、鋼材存量（有存量 1.10／1.12）
  freightTaxMul: number;               // 55316 貨運覆蓋的商業再乘
  tourists: number;                    // 55294 遊客數
  nightCityReady: boolean; nightCityTaxMul: number;   // 夜間城市 T487（nightCity487.ready、.commerce.taxMul；有夜市政策才讀）
  tech: readonly string[];             // tech343.done（tq，38549）
  spec: string | null;                 // spec386（sq，37851）
  enterpriseTaxFactor: (i: number) => number;   // enterpriseTaxFactor489（39573）；企業 T489 關＝1
  occ?: (band: string) => number | undefined;   // 住房入住率 housing488.occ[帶]（39479）；缺、或住房關（__noHousing488）＝1
}
export const civicMulOf = (chN: number) => chN > 0 ? 1.03 : 1;   // 55874
// D011 的模擬：第 2 類系統沒搬，乘數一律 1、沒有遊客、夜間城市沒就緒、企業與住房關（D011 卡第 5 節）
export const neutralTaxMul = (tech: readonly string[], spec: string | null, chN = 0): TaxMul => ({
  civicMul: civicMulOf(chN), pm: null, goodsMul284: 1, commerceSalesMul481: 1, industrialMarketMul481: 1, indSupplyMul: 1,
  fuelTaxMul: 1, steelTaxMul: 1, freightTaxMul: 1, tourists: 0, nightCityReady: false, nightCityTaxMul: 1, tech, spec, enterpriseTaxFactor: () => 1,
});
const noOcc = () => undefined;

// 55960–55965：分支鏈最後一支——住商工（以及分支鏈沒列到的種類）的一棟稅。不繳（沒電、火災、生病、死亡、廢棄、暴亂、瘟疫）回 null
export function buildingTax(w: World, f: TaxFields, i: number, b: MoneyBld, mul: TaxMul): { kind: 'R' | 'C' | 'I'; v: number } | null {
  if (!(b.pw && !b.fire && !b.sick && !b.death && !b.abandoned && !b.riot && !b.plague)) return null;   // 55960
  const pm = mul.pm || DEFAULT_PM, civicMul = mul.civicMul, t = mul.tech, spec = mul.spec;              // 55961
  if (b.k === 1) {                                                                                      // 55962 住宅：人口 × 財富 × 地價（中性 128 恆等 ×1）
    const we = b.we !== undefined ? b.we : 1;
    const landTaxMul = 1 + (f.LAND[i] - 128) / 128 * .15;
    const v2 = residentPopulation488(b, mul.occ ?? noOcc) * .12 * (pm.taxR || 1) * WEALTH_TAX[we] * landTaxMul * civicMul;
    return { kind: 'R', v: v2 };
  } else if (b.k === 2) {                                                                               // 55963 商業：道路等級、公車、郵局、停車、銀行、貨運、遊客、夜市……
    const COV = f.COV, bx = i % w.N, byy = (i / w.N) | 0;
    const rc = getMaxRoadClass(w, bx, byy, 1);
    let mult = (1 + rc * .08) * (COV.bus![i] > 0 ? 1.1 : 1) * (COV.post![i] > 0 ? 1.15 : 1) * ((COV.parking && COV.parking[i] > 0) ? 1.1 : 1) * ((COV.bank && COV.bank[i] > 0) ? 1.08 : 1) * ((COV.freight && COV.freight[i] > 0) ? 1.05 : 1);
    if (COV.freight && COV.freight[i] > 0) mult *= mul.freightTaxMul;
    if (mul.tourists > 0) mult *= 1 + Math.min(.2, mul.tourists / 500) * (pm.tourPromo ? 1.1 : 1);
    if (pm.nightMarket) mult *= mul.nightCityReady ? mul.nightCityTaxMul : 1.06;
    const v2 = JOBSC[b.lv] * .18 * mult * (pm.taxC || 1) * (pm.ecoReg ? .95 : 1) * civicMul * mul.goodsMul284 * mul.commerceSalesMul481 * tq(t, 'A3', 1.04, 1) * tq(t, 'A6', 1.05, 1) * tq(t, 'B4b', 1.05, 1) * tq(t, 'C3', 1.03, 1) * tq(t, 'D3', 1.04, 1) * sqOf(spec, 'hub', 1.03, 1) * mul.enterpriseTaxFactor(i);
    return { kind: 'C', v: v2 };
  } else if (b.k === 65) {
    // 55964 k65 大型購物中心（T290）：沒搬（D011 蓋不出來、讀檔也只能看）。這裡不收稅，跟實驗線不同；對拍案例不放 k65
    return null;
  } else {                                                                                              // 55965 工業（也是分支鏈沒列到的種類的去處）
    const eduIndMul = b.lv === 3 ? 1 + (f.EDU[i] / 255) * .4 : 1;
    const v2 = JOBSI[b.lv] * .15 * (pm.taxI || 1) * (pm.indSubsidy ? .9 : 1) * civicMul * mul.indSupplyMul * mul.industrialMarketMul481 * eduIndMul * mul.fuelTaxMul * mul.steelTaxMul * tq(t, 'A1', 1.04, 1) * tq(t, 'A4a', 1.08, 1) * tq(t, 'A4b', .98, 1) * tq(t, 'A8', 1.06, 1) * sqOf(spec, 'ind', 1.06, 1) * sqOf(spec, 'green', .92, 1) * mul.enterpriseTaxFactor(i);
    return { kind: 'I', v: v2 };
  }
}

// 稅收迴圈順手數的設施（55884–55912）：維護費（55973、55990）讀前六個；nI、fs2n409 給面板（這裡一起對拍）
export interface IncomeCounts { parks: number; plants: number; fireStations: number; policeStations: number; policeBoxes: number; hospitals: number; nI: number; fs2n409: number }

// 55868–55968：照 tickBld 的順序（升序、當天新長的接在後面）逐棟走實驗線的分支鏈收稅。
// income 依建築順序交錯累加住商工（浮點順序照實驗線；income 不等於 taxR＋taxC＋taxI）。
// 55882–55883 T409 火災、犯罪積案計數只給面板，不動錢，沒搬。
export function dailyIncome(w: World, f: TaxFields, tickBld: readonly number[], mul: TaxMul, extras: { nightCommerceGold487: number }) {
  let income = 0, taxR = 0, taxC = 0, taxI = 0;
  const counts: IncomeCounts = { parks: 0, plants: 0, fireStations: 0, policeStations: 0, policeBoxes: 0, hospitals: 0, nI: 0, fs2n409: 0 };
  const occ = mul.occ ?? noOcc, pmOf = () => mul.pm || DEFAULT_PM;
  for (const i of tickBld) {
    const b = w.tiles[i].bld as MoneyBld | null | undefined;
    if (!b) continue;                                          // 55879 當天被清掉的（tickBld 是一天開頭的索引）
    if (b.ref) continue;                                       // 55880 多格建築的附屬格
    if (b.k === 3) counts.nI++;                                // 55884
    if (b.k === 4) counts.parks++;                             // 55885
    else if (b.k === 5) counts.plants++;                       // 55886
    else if (b.k === 6) counts.fireStations++;                 // 55887
    else if (b.k === 11) counts.policeStations++;              // 55888
    else if (b.k === 52) counts.policeBoxes++;                 // 55889
    else if (b.k === 12) counts.hospitals++;                   // 55890
    else if (NO_TAX_K.has(b.k)) { /* 55891–55953 */ }
    else if (b.k === 30) counts.fs2n409++;                     // 55912
    else if (b.k === 33 || b.k === 105) {                      // 55915–55916 住宅塔、巨廈：不看電與災害
      const v2 = residentPopulation488(b, occ) * .12 * (pmOf().taxR || 1); income += v2; taxR += v2;
    } else if (b.k === 106) {                                  // 55917 商業綜合體
      const v2 = MEGA_JOBS * .18 * (pmOf().taxC || 1) * mul.enterpriseTaxFactor(i); income += v2; taxC += v2;
    } else if (b.k === 34) {                                   // 55918 商業塔
      const v2 = TOWER_JOBS * .18 * (pmOf().taxC || 1) * mul.enterpriseTaxFactor(i); income += v2; taxC += v2;
    } else if (b.k === 127 && b.pw && b.wa && !b.fire && !b.sick && !b.death && !b.abandoned && !b.riot && !b.plague) {   // 55954 社宅
      const v2 = residentPopulation488(b, occ) * .08 * (pmOf().taxR || 1) * WEALTH_TAX[SOCIAL_HOUSING_WE] * mul.civicMul; income += v2; taxR += v2;
    }
    else if (b.k >= 124 && b.k <= 133) { /* 55955 */ }
    else if (b.k >= 140 && b.k <= 160) { /* 55956 */ }
    else if (b.k >= 165 && b.k <= 174) { /* 55957 */ }
    else if (LMCFG309_KINDS.has(b.k)) { /* 55958 */ }
    else if (b.k >= 81 && b.k <= 120 && b.k !== 105 && b.k !== 106) { /* 55959 */ }
    else {                                                     // 55960–55966
      const r = buildingTax(w, f, i, b, mul);
      if (r) { income += r.v; if (r.kind === 'R') taxR += r.v; else if (r.kind === 'C') taxC += r.v; else taxI += r.v; }
    }
  }
  const g = extras.nightCommerceGold487; if (g > 0) { income += g; taxC += g; }   // 55968 夜市稅收鏡像（T487）
  return { income, taxR, taxC, taxI, counts };
}

// 夜間城市（T487）當天的三個財務數：55968、56027 都是「就緒才讀，否則 0」
export interface NightCity487 { ready: boolean; commerce?: { taxMul: number }; finance?: { commerceGold: number; transitRevenue: number; operatingCost: number } }
export function nightFinance487(nc: NightCity487) {
  const fin = nc.finance!;
  return {
    nightCommerceGold487: nc.ready ? fin.commerceGold : 0,     // 55968
    nightTransitRev487: nc.ready ? fin.transitRevenue : 0,     // 56027
    nightOpsCost487: nc.ready ? fin.operatingCost : 0,         // 56027
  };
}
// 55987：地鐵逐線票務、廣告、成本的加總取整（整合票價打 .92）。逐線加總（55978–55986，T302／T463／T467B）沒搬，是輸入
export function metroRound467(raw: { metroRev: number; metroAds: number; metroCost: number }, pol: LabPol | null) {
  return { metroRev: Math.round(raw.metroRev * (pol && pol.integratedTransit ? .92 : 1)), metroAds: Math.round(raw.metroAds), metroCost: Math.round(raw.metroCost) };
}
// 56026–56027：地面公共運輸票務（T468）；搭乘比例 transit468.modeShare 是輸入
export function transitRev468(modeShare: { bus?: number; tram?: number; rail?: number; multimodal?: number }, pol: LabPol | null): number {
  const surfaceFareTrips468 = (modeShare.bus || 0) + (modeShare.tram || 0) + (modeShare.rail || 0) + (modeShare.multimodal || 0) * .5;
  return (pol && pol.freeTransit) ? 0 : Math.round(surfaceFareTrips468 * .03 * (pol && pol.integratedTransit ? .92 : 1));
}
// 55988、56025、56027：稅以外的收入。照實驗線分三次加進 income（每次先把右邊加總）
export const OTHER_INCOME_KEYS = ['farmGold', 'ranchGold', 'procGold', 'ghGold', 'lodgeRev', 'mktGold', 'tradeGold', 'brewGold', 'techGold', 'dcGold', 'gasGold', 'cookGold',
  'bankInt', 'parkingRevenue491', 'shipPortGold', 'shipDailyGold418', 'fuelExportGold418', 'steelExportGold482', 'goodsExportGold481'] as const;
export type OtherIncome = Record<(typeof OTHER_INCOME_KEYS)[number] | 'metroRev' | 'metroAds' | 'transitRev' | 'nightTransitRev487', number>;
export function addOtherIncome(income: number, o: OtherIncome): number {
  income += o.metroRev + o.metroAds;                                                           // 55988 地鐵票務與廣告（metroRound467 取整後）
  income += o.farmGold + o.ranchGold + o.procGold + o.ghGold + o.lodgeRev + o.mktGold + o.tradeGold + o.brewGold + o.techGold + o.dcGold + o.gasGold + o.cookGold + o.bankInt + o.parkingRevenue491 + o.shipPortGold + o.shipDailyGold418 + o.fuelExportGold418 + o.steelExportGold482 + o.goodsExportGold481;   // 56025
  income += o.transitRev + o.nightTransitRev487;                                               // 56027 地面公共運輸票務、夜間運輸
  return income;
}
// 56028：城市活動（T299）期間收入乘活動稅率再取整；沒有活動＝null
export const cityEventIncome = (income: number, eventTax: number | null) => eventTax === null ? income : Math.round(income * eventTax);

// 55969–55970：道路維護，照格子順序逐格加（實驗線走 tickRoad＝一天開頭升序掃出的道路格，54940；浮點順序照實驗線：185 格 × .02＝3.700000000000003）
export function roadUpkeep(w: World): number {
  let roadUpkeep = 0;
  for (let i = 0; i < w.N * w.N; i++) { const t = w.tiles[i]; if (t.road) roadUpkeep += ROAD_UPKEEP[((t.rc as number) || 2) - 1]; }
  return roadUpkeep;
}

// 55973–55976、55990 讀的設施數。前六個來自稅收迴圈（IncomeCounts），其餘是 tick 第一個計數迴圈（55050 起）數的，upLm309 是 T309 地標維護合計
export const UPKEEP_KEYS = ['parks', 'plants', 'fireStations', 'policeStations', 'policeBoxes', 'hospitals', 'clinics', 'schools', 'libraries', 'posts', 'cemeteries', 'bigCemN',
  'dumps', 'stadiums', 'waterTowers', 'st', 'gstN', 'scN', 'fpN', 'nkN', 'hyN', 'geN', 'fhqN', 'wteN', 'ghN', 'whN284', 'mallN', 'po', 'ai', 'pa', 'tr', 'fa', 'bigFa', 'ra',
  'la', 'so', 'wi', 'se', 'am', 'rc', 'fs2', 'pr', 'un', 'faN', 'ctN307', 'obN307', 'upLm309', 'mu', 'th', 'aq', 'zo', 'ap', 'ci', 'gl', 'chN', 'crtN', 'cvN', 'inN', 'wsN',
  'bgN', 'mhN', 'owN', 'mnN', 'mgN', 'gh330', 'ht330', 'rs330', 'kg330', 'sn330', 'bk330', 'mk330', 'cp330', 'tv330', 'mr330', 'tp336', 'dg336', 'ir336', 'sk336', 'fw340',
  'pl340', 'fp340', 'hs340', 'ch340', 'br340', 'wp340', 'vt340', 'sr340', 'cg340', 'cr342', 'hsc342', 'tpk342', 'frt342', 'upc342', 'cpk342', 'gpk465', 'gmc466', 'art466',
  'adm466', 'res466', 'cam342', 'mpt342', 'cvc342', 'dtc342', 'gw346', 'fp346', 'kt346', 'ff346', 'refineryN', 'steelMillN', 'shipyardN', 'cl485', 'im485', 'dc485',
  'cold485', 'silo485', 'fuelDep485', 'gasDep485', 'steelY485', 'bulk485', 'cport485', 'court364', 'tennis364', 'play364', 'socialHousing364', 'substation364', 'desal364',
  'pump364', 'center364', 'shelter364', 'radar364'] as const;
export type UpkeepCounts = Record<(typeof UPKEEP_KEYS)[number], number>;
const ZERO_COUNTS = Object.fromEntries(UPKEEP_KEYS.map(k => [k, 0])) as UpkeepCounts;
export const IMPORT_KEYS = ['goodsImportCost481', 'foodImportCost482', 'gasImportCost482', 'fuelImportCost482', 'steelImportCost482', 'suppliesImportCost482'] as const;
export type ImportCosts = Record<(typeof IMPORT_KEYS)[number], number>;
export const ZERO_IMPORTS: ImportCosts = Object.fromEntries(IMPORT_KEYS.map(k => [k, 0])) as ImportCosts;

// 55971：edu 專精日費隨人口縮放，夾 6–40（T394b）
export const eduFee394Of = (pop: number) => Math.min(40, Math.max(6, Math.round(pop / 100)));
// 55972：法規與政策的每日固定支出（沒有政策＝只剩科技、專精、政策套件日費）
export function upRegOf(pol: LabPol | null, tech: readonly string[], spec: string | null, pop: number, policyDailyCost504: number): number {
  const eduFee394 = eduFee394Of(pop);
  return (pol && pol.recycle ? 8 : 0) + (pol && pol.tourPromo ? 10 : 0) + (pol && pol.schoolLunch ? 12 : 0) + (pol && pol.smokeDetect ? 6 : 0) + (pol && pol.parkNight ? 5 : 0)
    + (pol && pol.insurance ? 18 : 0) + (pol && pol.waterConserve ? 3 : 0) + (pol && pol.reclaimPriority ? 6 : 0) + (pol && pol.industrialPretreat ? 5 : 0) + (pol && pol.spongeCity ? 4 : 0)
    + (pol && pol.housingSubsidy ? 10 : 0) + (pol && pol.inclusionaryHousing ? 4 : 0) + (pol && pol.stationHousing ? 3 : 0) + (pol && pol.infrastructureStimulus ? 18 : 0)
    + (pol && pol.consumptionSupport ? 14 : 0) + (pol && pol.industrialRelief ? 12 : 0) + (pol && pol.completeStreets ? 8 : 0) + (pol && pol.parkingManagement ? 2 : 0)
    + (pol && pol.criticalReserve492 ? 10 : 0) + (pol && pol.emergencyStockpile492 ? 8 : 0) + tq(tech, 'B4a', 10, 0) + tq(tech, 'C4a', 8, 0) + sqOf(spec, 'edu', eduFee394, 0) + policyDailyCost504;
}

export interface UpkeepIn {
  roadUpkeep: number;                                  // roadUpkeep(w)
  counts: Partial<UpkeepCounts>;                       // 缺的一律 0
  pop: number; pol: LabPol | null; tech: readonly string[]; spec: string | null;   // 55971–55972 法規費、edu 專精費
  policyDailyCost504: number;                          // 67580 政策套件日費（T504 關＝0）
  powerUpkeep471: number;                              // 52829（舊版供電 __legacyPower471：operatingCost 不算，只剩 k140–150 設施）
  waterUpkeep472: number; infraUpkeep475: number;      // 52911、52913
  transitDepotUpkeep501: number;                       // 67163
  metroCost: number; railOpsCost463: number;           // 55987（metroRound467 取整後）、55988
  svcFleet: { fire: number; police: number; amb: number };   // 55989
  svcBudget: SvcBudget;                                // 55990（服務預算 T294）
  imports: ImportCosts;                                // 56025 六種商品進口費（T481／T482）
  busOpsCost468: number; nightOpsCost487: number;      // 56027
}
// D011 的模擬：沒有政策、地鐵、運輸營運、進口；車隊預設（D011 卡第 5 節）
export const neutralUpkeepIn = (p: { roadUpkeep: number; counts: Partial<UpkeepCounts>; pop: number; svcBudget: SvcBudget; tech: readonly string[]; spec: string | null }): UpkeepIn => ({
  ...p, pol: null, policyDailyCost504: 0, powerUpkeep471: 0, waterUpkeep472: 0, infraUpkeep475: 0, transitDepotUpkeep501: 0, metroCost: 0, railOpsCost463: 0,
  svcFleet: { ...SVC_FLEET_DEFAULT }, imports: { ...ZERO_IMPORTS }, busOpsCost468: 0, nightOpsCost487: 0,
});

// 55969–55977、55988–55990、56025、56027：一天的維護費，照實驗線逐次累加（55978–55986 地鐵逐線迴圈、55991–56024 旅宿與產業鏈只動收入或沒搬）
export function dailyUpkeep(u: UpkeepIn): number {
  const c: UpkeepCounts = { ...ZERO_COUNTS, ...u.counts };
  const upReg = upRegOf(u.pol, u.tech, u.spec, u.pop, u.policyDailyCost504);                                        // 55971–55972
  let upkeep = u.roadUpkeep + c.parks * .5 + c.plants * 4 + c.fireStations * 3 + c.policeStations * 4 + c.policeBoxes * 1.5 + c.hospitals * 5 + c.clinics * 2.5 + c.schools * 2.5
    + c.libraries * 2 + c.posts * 3 + c.cemeteries * 2 + c.bigCemN * 8 + c.dumps * 2 + c.stadiums * 8 + c.waterTowers * 3 + c.st * 6 + c.gstN * 15 + c.scN * 18 + c.fpN * 14 + c.nkN * 28
    + c.hyN * 9 + c.geN * 4 + c.fhqN * 10 + c.wteN * 10 + c.ghN * 3 + c.whN284 * 4 + c.mallN * 16 + c.po * 5 + c.ai * 25 + c.pa * 1.5 + c.tr * 4 + c.fa * 1 + c.bigFa * 6 + c.ra * 1.5
    + c.la * 8 + c.so * 1 + c.wi * 1.5 + c.se * 3 + c.am * 4 + c.rc * 2 + c.fs2 * 6 + c.pr * 5 + c.un * 8 + c.faN * 8 + c.ctN307 * 4 + c.obN307 * 9 + c.upLm309 + c.mu * 6 + c.th * 5
    + c.aq * 7 + c.zo * 10 + c.ap * 12 + c.ci * 3 + c.gl * 8 + c.chN * 10 + c.crtN * 6 + c.cvN * 20 + c.inN * 10 + c.wsN * 4 + c.bgN * 14 + c.mhN * 16 + c.owN * 4 + c.mnN * 5 + c.mgN * 25
    + upReg + c.gh330 * 1 + c.ht330 * 5 + c.rs330 * 12 + c.kg330 * 2 + c.sn330 * 2 + c.bk330 * 3 + c.mk330 * 3 + c.cp330 * 2 + c.tv330 * 4 + c.mr330 * 4 + c.tp336 * 4 + c.dg336 * 1
    + c.ir336 * 3 + c.sk336 * 2 + c.fw340 * 1 + c.pl340 * 2 + c.fp340 * 1 + c.hs340 * 2 + c.ch340 * 3 + c.br340 * 5 + c.wp340 * 6 + c.vt340 * 2 + c.sr340 * 4 + c.cg340 * 1 + c.cr342 * 3
    + c.hsc342 * 5 + c.tpk342 * 10 + c.frt342 * 4 + c.upc342 * 4 + c.cpk342 * 2 + c.gpk465 * 6 + c.gmc466 * 32 + c.art466 * 26 + c.adm466 * 38 + c.res466 * 42 + c.cam342 * 12
    + c.mpt342 * 20 + c.cvc342 * 6 + c.dtc342 * 8 + c.gw346 * 4 + c.fp346 * 5 + c.kt346 * 4 + c.ff346 * 2 + u.powerUpkeep471 + u.waterUpkeep472 + u.infraUpkeep475;   // 55973
  upkeep += c.refineryN * 11 + c.steelMillN * 13 + c.shipyardN * 15;                                              // 55974 深加工廠
  upkeep += c.cl485 * 18 + c.im485 * 20 + c.dc485 * 12 + c.cold485 * 8 + c.silo485 * 6 + c.fuelDep485 * 14 + c.gasDep485 * 14 + c.steelY485 * 8 + c.bulk485 * 22 + c.cport485 * 36;   // 55975 物流與港區
  upkeep += c.court364 * 1 + c.tennis364 * 1.2 + c.play364 * .8 + c.socialHousing364 * 5 + c.substation364 * 3 + c.desal364 * 11 + c.pump364 * 4 + c.center364 * 12 + c.shelter364 * 4 + c.radar364 * 7;   // 55976
  upkeep += u.transitDepotUpkeep501;                                                                              // 55977
  upkeep += u.metroCost + u.railOpsCost463;                                                                       // 55988
  upkeep += (u.svcFleet.fire + u.svcFleet.police + u.svcFleet.amb - 7) * .8;                                      // 55989 車隊保養（預設 7 輛＝0）
  upkeep += (c.fireStations * 3 + c.fs2 * 6 + c.fhqN * 10) * (u.svcBudget.fire - 1) + (c.policeStations * 4 + c.policeBoxes * 1.5 + c.crtN * 6) * (u.svcBudget.police - 1)
    + (c.hospitals * 5 + c.clinics * 2.5 + c.am * 4 + c.mhN * 16) * (u.svcBudget.health - 1) + (c.schools * 2.5 + c.libraries * 2 + c.un * 8 + c.inN * 10) * (u.svcBudget.edu - 1);   // 55990 服務預算（預算 1＝0）
  const m = u.imports;
  upkeep += m.goodsImportCost481 + m.foodImportCost482 + m.gasImportCost482 + m.fuelImportCost482 + m.steelImportCost482 + m.suppliesImportCost482;   // 56025
  upkeep += u.busOpsCost468 + u.nightOpsCost487;                                                                  // 56027
  return upkeep;
}

// ---- 結算之後（56053–56145）----
// 實驗線的全域 money、diff、loan、msIdx、bestStar、bailoutDay（本線 Sim 上同名欄位）；settleDay 就地改
export interface MoneyState { money: number; diff: number; loan: { remain: number; daily: number } | null; msIdx: number; bestStar: number; bailoutDay: number }
export interface SettleIn {
  income: number; upkeep: number;          // 56028 之後的收入（城市活動取整過）、56027 之後的維護費
  day: number;                             // 今天（tick 開頭已經 day++）
  pop: number; jobs: number; cityHappy: number;
  fireCoverN: number; fireTotalN: number; schoolCoverN: number; schoolTotalN: number;   // scoreCounts（56102–56113）
  garbRatio: number | null;                // garbDecisionRatio452()（38091）：沒有垃圾場＝2（55260）→ 0 分；不是數字＝10 分
}
export interface SettleReport {
  net: number;                             // income−upkeep（沙盒照算、只是不入帳）
  loanPaid?: number; milestone?: { pop: number; reward: number }; star?: { star: number; bonus: number }; bailout?: number;
  score: number; cityStar: number;         // 城市評分與星等（人口 <50 不評分＝−1）
}

// 56102–56113：城市評分讀的覆蓋比例（住商工根格有消防覆蓋、住宅有學校覆蓋）
export function scoreCounts(w: World, f: Pick<Fields, 'COV'>, tickBld: readonly number[]) {
  let fireCoverN = 0, fireTotalN = 0, schoolCoverN = 0, schoolTotalN = 0;
  const COV = f.COV;
  for (const i of tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.k > 3 || b.ref) continue;
    fireTotalN++;
    if ((COV.fire![i] > 0 || (COV.fire2 && COV.fire2[i] > 0) || (COV.fireHQ && COV.fireHQ[i] > 0))) fireCoverN++;
    if (b.k === 1) { schoolTotalN++; if (COV.school![i] > 0) schoolCoverN++; }
  }
  return { fireCoverN, fireTotalN, schoolCoverN, schoolTotalN };
}

// 一天的結算與之後的獎懲，順序照實驗線（56053–56145）
export function settleDay(st: MoneyState, q: SettleIn): SettleReport {
  const income = q.income, upkeep = q.upkeep, pop = q.pop;
  const rep: SettleReport = { net: income - upkeep, score: -1, cityStar: -1 };
  if (st.diff !== 3) st.money += income - upkeep;                                                       // 56053 沙盒不結算
  // 56054–56055 region、水容量：不動錢。56056–56077 挑戰（T88）、場景戰役（T132）：D011 沒有，沒搬
  if (st.loan) { rep.loanPaid = st.loan.daily; st.money -= st.loan.daily; if (--st.loan.remain <= 0) st.loan = null; }   // 56079 貸款還款（就地改 remain）
  if (st.msIdx < MILES.length && pop >= MILES[st.msIdx][0]) {                                           // 56081–56086 人口里程碑，一天最多一個
    const bonus = MILES[st.msIdx][1]; st.money += bonus;
    rep.milestone = { pop: MILES[st.msIdx][0], reward: bonus };
    st.msIdx++;
  }
  // 56087–56097 成就：不動錢，沒搬
  if (pop < 50) { rep.score = -1; rep.cityStar = -1; }                                                  // 56099–56100 人口 <50 不評分
  else {
    const happyScore = q.cityHappy * 40;                                                                 // 56114–56120
    const jobScore = Math.min(q.jobs / Math.max(1, pop * .6), 1) * 25;
    const fireScore = q.fireTotalN > 0 ? (q.fireCoverN / q.fireTotalN) * 15 : 15;
    const garbScoreRatio452 = q.garbRatio; const garbScore = typeof garbScoreRatio452 !== 'number' ? 10 : (garbScoreRatio452 <= 1 ? 10 : Math.max(0, 10 - (garbScoreRatio452 - 1) * 20));
    const eduScore = q.schoolTotalN > 0 ? (q.schoolCoverN / q.schoolTotalN) * 10 : 10;
    const score = clamp(happyScore + jobScore + fireScore + garbScore + eduScore, 0, 100);
    const cityStar = clamp(Math.floor(score / 18), 0, 5);
    rep.score = score; rep.cityStar = cityStar;
    if (cityStar > st.bestStar) {                                                                        // 56122–56129 升星獎金＝新星等×500（不是差額）
      const bonus = cityStar * 500;
      st.money += bonus;
      rep.star = { star: cityStar, bonus };
      st.bestStar = cityStar;
    }
  }
  // 56131–56140 城市等級：不動錢，沒搬
  if (st.money < 20 && income - upkeep <= 0 && q.day - st.bailoutDay > 60) { st.money += 250; st.bailoutDay = q.day; rep.bailout = 250; }   // 56142–56145 紓困
  // 56147 AI 市長（對照時關掉）、56169 市長觀測（唯讀）、56170–56189 委託（T385，接單才動錢）：D011 沒有，沒搬；56190 hist 由本線自己記
  // tick 之後的包裝（T510 市債、T515 財政）在回退設定下都關著，不動錢
  return rep;
}
