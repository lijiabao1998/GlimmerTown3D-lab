// 糧食（D022）：食物產量、觀光遊客、貿易額度、供糧率，以及每棟住宅每天的糧食加減。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。順序照 tick()：主計數迴圈（55050–55149）數食物來源、觀光建築與貿易設施 →
// 55293–55295 食物與遊客 → 55333–55338 貿易額度與 takeTrade482 → 55340–55342 糧食需求、進口、供糧率 → 55414–55424 加到每棟住宅的幸福上。
// 沒搬（本線沒有，一律當沒有／0；讀進來有這些東西的城，糧食那一項會跟實驗線不同，D022 卡「不做什麼」）：
//   化肥 T346（fertReady、農場 ×1.35）、物流 T485（k165–174 與冷藏庫、穀倉對食物保存的加成）、船 T418（shipCount）、火車線 T463（railLines463）、
//   壅堵 T129（roadLoad：logisticsEfficiency481 的扣分）、城市活動 T299（事件食物加成）、專業化 T386（sq('green',…) 取關的值）、
//   企業層 T489（利用率 1）、gpn T508（額度乘數 1、進口可得性照原數）、污水廠 T442（55420 那一句：k27 不算）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；不動世界歷史。
import { clamp, type Bld, type World } from './lab.ts';

export const FARM_SEASON_MULT = [1, 1.15, 1.4, 0.4];      // 38128：農場食物的季節倍率（春夏秋冬）
export const TOUR_SEASON_MULT = [1, 1.3, 1.2, 0.85];      // 38210：觀光的季節倍率
export const CONVENTION_PULSE_DAYS = 20;                  // 39445：會展中心每 20 天一波遊客
// 38129 LMCFG309 的觀光值 t（地標 k69–80；55116 只數 69–80，表裡 k179 以後的項目沒人數）
export const LANDMARK_TOUR309: Record<number, number> = { 69: 16, 70: 10, 71: 8, 72: 18, 73: 14, 74: 9, 75: 17, 76: 24, 77: 11, 78: 10, 79: 12, 80: 20 };

// 主計數迴圈裡食物、觀光、貿易用得到的計數（欄位名＝實驗線的區域變數名）。一天一份，從零數起
export interface FoodCount {
  farmFoodU: number; ranchFoodU: number; ghFoodU: number; fp340: number; cg340: number; ff346: number;                      // 食物來源：農場＋大農場（等級加權）、牧場、溫室、食品加工類
  la: number; ctN307: number; obN307: number; tourLm309: number; ai: number; st: number; mu: number; th: number; ci: number; aq: number; zo: number; ap: number; bgN: number;
  rs330: number; tv330: number; mr330: number; ch340: number; wp340: number; sr340: number; cpk342: number; gpk465: number; art466: number; adm466: number; res466: number; mpt342: number;   // 觀光建築與地標
  cvN: number;                                                                                                              // 會展中心（脈衝）
  tp336: number; po: number; frt342: number; whN284: number;                                                                // 貿易站、港口、貨運中心、倉儲物流中心
}
export const emptyFoodCount = (): FoodCount => ({
  farmFoodU: 0, ranchFoodU: 0, ghFoodU: 0, fp340: 0, cg340: 0, ff346: 0,
  la: 0, ctN307: 0, obN307: 0, tourLm309: 0, ai: 0, st: 0, mu: 0, th: 0, ci: 0, aq: 0, zo: 0, ap: 0, bgN: 0,
  rs330: 0, tv330: 0, mr330: 0, ch340: 0, wp340: 0, sr340: 0, cpk342: 0, gpk465: 0, art466: 0, adm466: 0, res466: 0, mpt342: 0,
  cvN: 0, tp336: 0, po: 0, frt342: 0, whN284: 0,
});

// 主計數迴圈（55050–55149）裡「一棟根格建築」對這些計數的貢獻。呼叫端先跳過 ref 格（55055）。行號＝實驗線那一行
export function countFood(c: FoodCount, b: Bld): void {
  const k = b.k;
  if (k >= 69 && k <= 80) { const t = LANDMARK_TOUR309[k]; if (t) c.tourLm309 += t; return; }   // 55116 地標
  switch (k) {
    case 63: c.ghFoodU += (b.lv || 1) * 6; break;                 // 55073 溫室：等級×6，全年恆溫不乘季節
    case 64: c.whN284++; break;                                   // 55074 倉儲物流中心
    case 83: c.rs330++; break;                                    // 55076 旅宿（T330）
    case 89: c.tv330++; break;                                    // 55078
    case 90: c.mr330++; break;
    case 91: c.tp336++; break;                                    // 55079 貿易站
    case 97: c.fp340++; break;                                    // 55080 食品加工類（T340）
    case 99: c.ch340++; break;
    case 101: c.wp340++; break;                                   // 55081
    case 103: c.sr340++; break;
    case 104: c.cg340++; break;
    case 17: c.st++; break;                                       // 55084 火車站
    case 18: c.po++; break;                                       // 55085 港口
    case 19: c.ai++; break;                                       // 55086 機場
    case 22: c.farmFoodU += (b.lv || 1) * 3; break;               // 55089 農場：等級×3（化肥 T346 ×1.35 沒搬：fb＝1）
    case 53: c.farmFoodU += (b.lv || 1) * 20; break;              // 55090 大農場：等級×20
    case 23: c.ranchFoodU += (b.lv || 1) * 2; break;              // 55091 牧場：等級×2，不隨季節
    case 24: c.la++; break;                                       // 55092 地標
    case 110: c.frt342++; break;                                  // 55101 貨運中心（T342）
    case 120: c.ff346++; break;                                   // 55102 食品加工類（T346）
    case 112: c.cpk342++; break;                                  // 55107
    case 114: c.mpt342++; break;
    case 134: c.gpk465++; break;
    case 136: c.art466++; break;
    case 137: c.adm466++; break;
    case 138: c.res466++; break;
    case 35: c.mu++; break;                                       // 55112 博物館
    case 67: c.ctN307++; break;                                   // 55114 鐘樓
    case 68: c.obN307++; break;                                   // 55115 天文台
    case 36: c.th++; break;                                       // 55117 劇院
    case 37: c.aq++; break;                                       // 55118 水族館
    case 38: c.zo++; break;                                       // 55119 動物園
    case 39: c.ap++; break;                                       // 55120 遊樂園
    case 40: c.ci++; break;                                       // 55121 電影院
    case 44: c.cvN++; break;                                      // 55125 會展中心
    case 47: c.bgN++; break;                                      // 55128 植物園
  }
}

export interface FoodReport {
  points: number;        // 55293 foodPoints：本地食物產量
  tourists: number;      // 55294–55297 tourists（含會展中心的脈衝）
  residentNeed: number; touristNeed: number; need: number;   // 55340 居民、遊客、合計的基本需求（foodCoreNeed482）
  domestic: number; short: number; imports: number; served: number;   // 55341–55342：本地供給、缺口、進口、合計供給
  rate: number;          // 55342 foodSupplyRate482：供糧率（需求 0 ＝ 1）
  delta: number;         // 55416 foodHappyDelta482：每棟住宅每天的幸福加減（只在 need > 0 時加）
  cap: number; used: number; remaining: number;   // 55335、55338：貿易額度、糧食拿走的、剩下的（後面的商品拿剩下的）
  roadBase: number; eff: number;                  // 55334 roadTradeBase482、55333 logisticsNow481.efficiency
}

// 一天的糧食（沒有副作用）。roads＝道路格數（tickRoad.length，含橋與快速路）；pop＝當天的人口（55246）；sea＝季節 0–3；day＝已經 ++ 之後的日子
export function foodDay(c: FoodCount, roads: number, pop: number, sea: number, day: number): FoodReport {
  // 55293：（農場×季節＋牧場＋溫室＋加工類）×食物保存 foodPreserveMul485（冷藏庫、穀倉 T485 沒搬：1）×事件食物加成（T299 沒搬：1）
  const foodPoints = Math.round((c.farmFoodU * FARM_SEASON_MULT[sea] + c.ranchFoodU + c.ghFoodU + c.fp340 * 3 + c.cg340 * 1 + c.ff346 * 4) * 1 * 1);
  // 55294：觀光建築與地標各自的係數加總×季節×sq('green',1.15,1)（專業化 T386 沒搬：取關的值 1）
  let tourists = Math.round((c.la * 25 + c.ctN307 * 12 + c.obN307 * 22 + c.tourLm309 + c.ai * 40 + c.st * 5 + c.mu * 15 + c.th * 12 + c.ci * 8 + c.aq * 35 + c.zo * 45 + c.ap * 55 + c.bgN * 20
    + c.rs330 * 15 + c.tv330 * 18 + c.mr330 * 30 + c.ch340 * 8 + c.wp340 * 34 + c.sr340 * 16 + c.cpk342 * 12 + c.gpk465 * 28 + c.art466 * 80 + c.adm466 * 25 + c.res466 * 20 + c.mpt342 * 120) * TOUR_SEASON_MULT[sea] * 1);
  if (c.cvN > 0 && day % CONVENTION_PULSE_DAYS === 0) tourists += Math.round(500 * c.cvN * TOUR_SEASON_MULT[sea]);   // 55295–55297 會展中心的脈衝（不消耗亂數）
  // 55286–55289：有效單位。企業層 T489 沒就緒（利用率 1）；物流 T485 的九種設施、火車線 railLines463 沒搬：0
  const freightUnits = c.frt342, warehouseUnits = c.whN284, portEquivalent = c.po, railUnits = 0;
  // 55333 logisticsEfficiency481（38269）：設施加成 min(.26, …)；壅堵扣分 pen 讀 roadLoad（T129 沒搬：平均負載 0、超載比 0）；油的加成讀 freightTaxMul（燃料 T364b 沒搬：1）
  const bonus = Math.min(.26, freightUnits * .035 + warehouseUnits * .022 + portEquivalent * .025 + railUnits * .012), fuelBonus = 0, pen = 0;
  const eff = +clamp(.78 + bonus + fuelBonus - pen, .45, 1.12).toFixed(4);
  // 55334–55335：有路就有 min(8, 1＋路格/80) 的底，加各種設施，乘效率（gpnTradeCapacityMul508＝1）；最少 3（有路的話）。物流 T485 各項、船 T418 沒搬
  const roadBase = roads ? Math.min(8, 1 + Math.floor(roads / 80)) : 0;
  const cap = Math.max(roads > 0 ? 3 : 0, Math.floor((roadBase + c.tp336 * 4 + portEquivalent * 4 + freightUnits * 3 + warehouseUnits * 2 + 0 /* 物流 T485 */ + Math.min(0 /* shipCount */, portEquivalent * 2)) * eff * 1));
  let remaining = cap, used = 0;                                                        // 55337–55338
  const take = (n: number) => { const q = Math.max(0, Math.min(Math.floor(n || 0), remaining)); remaining -= q; used += q; return q; };
  // 55340–55342 糧食：居民每 10 人 1 單位、遊客每 160 人 1 單位；本地不夠向共用貿易額度拿（糧食排第一個拿，gpnImportAvailability508 在 gpn 關時原數）
  const residentNeed = Math.ceil(pop / 10), touristNeed = Math.ceil(tourists / 160), need = residentNeed + touristNeed;
  const domestic = Math.min(foodPoints, need), short = Math.max(0, need - domestic), imports = take(short);
  const served = domestic + imports, rate = need > 0 ? clamp(served / need, 0, 1) : 1;
  // 55416：中性點 .50（「半飽即穩」）；全飢 −.055、全飽 +.05（夾在 −.06～.05）
  const delta = clamp((rate - .50) * .11, -.06, .05);
  return { points: foodPoints, tourists, residentNeed, touristNeed, need, domestic, short, imports, served, rate, delta, cap, used, remaining, roadBase, eff };
}

// 55414–55424：需求大於 0 就把 delta 加到每一棟住宅（k1，跳過 ref 格）的幸福上（夾在 .05～1，每天從當天的 h 起算、不累積），再用住宅 k1 重算城市幸福。
// 實驗線這個迴圈的條件是「need > 0 或有污水廠」（se>0）；污水廠 T442 沒搬，這裡只看 need。need＝0 整段不做（回傳原來的城市幸福）
export function applyFoodHappy(w: World, tickBld: number[], need: number, delta: number, cityHappy: number): number {
  if (!(need > 0)) return cityHappy;
  let happySum = 0, happyN = 0;
  for (const i of tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.k !== 1 || b.ref) continue;
    b.h = clamp((b.h as number) + delta, .05, 1);
    happySum += b.h; happyN++;
  }
  return happyN ? happySum / happyN : cityHappy;
}
