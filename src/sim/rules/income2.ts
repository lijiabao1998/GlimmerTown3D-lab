// 經濟（二）（D028）：實驗線 T346 天然氣鏈的結算（化肥、熟食、工資指數）與稅以外的其餘收入（農牧、溫室、食品加工、旅宿、農貿市場、釀酒、科技園、數據中心、中央廚房、銀行利息）。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號：旅宿與市場 55992–55994、釀酒 56003、鏈條結算 56006–56011、熟食與銀行與科技園與數據中心 56012–56017、農牧溫室加工 56022–56024；
// 農場的化肥增產（55089–55090）在 count.ts／food.ts，大型購物中心稅（55964）在 money.ts。
// 沒有亂數。企業 T489 回退設定下關，利用率恆 1（39574 enterpriseTypeUtilization489），所以公式裡的「× 利用率」寫成 × 1。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { FARM_SEASON_MULT, TOUR_SEASON_MULT } from './food.ts';

// T346 鏈條結算（56006–56011）：天然氣供給比 gasRatio（economy.ts 已算）決定今天的化肥與熟食產出；產出 > 0 就是「昨天有」——隔天的農場計數（55089）與住宅幸福（55206）讀它
export interface ChainIn { fp346: number; kitchenFoodUse482: number; gasRatio: number }
export interface ChainOut { fertOut: number; cookedOut: number; fertReady: boolean; cookedReady: boolean }
export function chainDay(i: ChainIn): ChainOut {
  const fertOut = Math.round(i.fp346 * 6 * 1 * i.gasRatio);                    // 56006：化肥廠數 × 6 × 企業利用率（118）× 供氣率
  const cookedOut = Math.round(i.kitchenFoodUse482 * i.gasRatio);              // 56007：中央廚房今天用掉的食物 × 供氣率
  return { fertOut, cookedOut, fertReady: fertOut > 0, cookedReady: cookedOut > 0 };   // 56008
}

// 其餘收入的輸入：全是別處已經算好的（D022 糧食、D024 計數、D025 經濟）加上主計數迴圈這一張補的三個住宅累加（教育總和、教育計數、房貸人口）
export interface ExtrasIn {
  sea: number; foodPrice: number; tourists: number;
  farmGoldU: number; ranchGoldU: number; ghGoldU: number;
  foodPlantUse482: number; marketFoodUse482: number; brewFoodUse482: number;
  gh330: number; ht330: number; rs330: number; hs340: number; mk330: number; br340: number; tpk342: number; dtc342: number;
  cookedOut: number; mortPop: number; eduSum: number; eduCnt: number;
}
export interface ExtrasOut {
  farmGold: number; ranchGold: number; ghGold: number; procGold: number; lodgeRev: number; mktGold: number; brewGold: number; techGold: number; dcGold: number; cookGold: number; bankInt: number;
  hotelBeds: number; hotelOcc: number;
}
export function incomeExtras(i: ExtrasIn): ExtrasOut {
  const hotelBeds = i.gh330 * 8 + i.ht330 * 40 + i.rs330 * 110 + i.hs340 * 14, hotelOcc = Math.min(i.tourists, hotelBeds);   // 55992：旅宿床位與入住
  const lodgeRev = Math.round(hotelOcc * .35 * (1 + (TOUR_SEASON_MULT[i.sea] - 1) * .5));                                     // 55993：旺季房價上浮（幅度取季節乘數一半）
  const mktGold = i.mk330 > 0 ? Math.round(i.marketFoodUse482 * 2 * i.foodPrice) : 0;                                         // 55994：農貿市場只結算真分配到的食物
  const brewGold = i.br340 > 0 ? Math.round(i.brewFoodUse482 * 2.2 * i.foodPrice) : 0;                                        // 56003
  const cookGold = Math.round(i.cookedOut * .6);                                                                               // 56012
  const bankInt = Math.round(i.mortPop * .006);                                                                                // 56014：銀行覆蓋住宅的房貸人口
  const eduAvg342 = i.eduCnt ? i.eduSum / i.eduCnt : 0;                                                                        // 56015：全城住宅（k1、k127）教育均值
  const techGold = i.tpk342 > 0 ? Math.round(i.tpk342 * 60 * Math.min(1.2, eduAvg342 / 100) * 1) : 0;                         // 56016：科技園產值＝教育閉環（企業利用率 109＝1）
  const dcGold = Math.round(i.dtc342 * 40 * 1);                                                                                // 56017：數據中心固定產值（利用率 116＝1）
  const farmGold = Math.round(i.farmGoldU * FARM_SEASON_MULT[i.sea] * i.foodPrice);                                           // 56022：農場金幣隨季節
  const ranchGold = Math.round(i.ranchGoldU * i.foodPrice), ghGold = Math.round(i.ghGoldU * i.foodPrice);                     // 56023：牧場與溫室不隨季節
  const procGold = Math.round(i.foodPlantUse482 * 1.5 * i.foodPrice);                                                          // 56024：食品加工只吃真分配到的食物
  return { farmGold, ranchGold, ghGold, procGold, lodgeRev, mktGold, brewGold, techGold, dcGold, cookGold, bankInt, hotelBeds, hotelOcc };
}
