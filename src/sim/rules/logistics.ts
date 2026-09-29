// 物流（T485）的單位（D025）：糧食（food.ts）與經濟（economy.ts）共用的純函式。貿易額度與物流效率的算式留在 food.ts 的 foodDay（D022 逐項對拍過，經濟接著用它的結果）。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。
// 沒搬（一律當沒有／0）：火車線 T463（railLines463.length）、道路負載 T129（roadLoad：logisticsEfficiency481 的壅堵扣分吃輸入，本線給 0）、
//   企業層 T489（利用率 1）、gpn T508（額度乘數 1、進口可得性與出口需求照原數）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；不動世界歷史。

export const FUEL_STOCK_CAP = 120, STEEL_STOCK_CAP = 120;   // 39452（REFINERY_RATE=3、STEEL_MILL_RATE=2 也在這一行，見 economy.ts）

// 55286–55291：物流九種設施（運作中的座數，D024 的 clOp485…cportOp485）、貨運中心與倉儲物流中心的「有效座數」與由它們算出來的各個單位與上限。
// enterpriseEffectiveCount489(k, n)＝n×企業利用率（39576）；企業層關＝利用率 1，所以有效座數＝座數。輸入是主計數迴圈的計數（缺的當 0）
export interface Units485 {
  whEff489: number; frtEff489: number; clEff489: number; imEff489: number; dcEff489: number; coldEff489: number; siloEff489: number; fuelDepEff489: number; gasDepEff489: number;
  steelYEff489: number; bulkEff489: number; cportEff489: number;
  freightUnits485: number; warehouseUnits485: number; portEquivalent485: number; railUnits485: number; fuelCap485: number; steelCap485: number;
  foodPreserveMul485: number; goodsCapBonus485: number;
}
export function unitsOf485(c: Readonly<Record<string, number>>, railLines = 0): Units485 {
  const g = (k: string) => c[k] ?? 0;
  const whEff489 = g('whN284'), frtEff489 = g('frt342'), clEff489 = g('clOp485'), imEff489 = g('imOp485'), dcEff489 = g('dcOp485'), coldEff489 = g('coldOp485'), siloEff489 = g('siloOp485'),
    fuelDepEff489 = g('fuelDepOp485'), gasDepEff489 = g('gasDepOp485'), steelYEff489 = g('steelYOp485'), bulkEff489 = g('bulkOp485'), cportEff489 = g('cportOp485');
  const freightUnits485 = frtEff489 + clEff489 * 2 + imEff489 * 3 + dcEff489 + bulkEff489 * 2 + cportEff489 * 4;
  const warehouseUnits485 = whEff489 + clEff489 * 2 + dcEff489 * 1.5 + coldEff489 + siloEff489 * .5 + fuelDepEff489 * .5 + gasDepEff489 * .5 + steelYEff489;
  const portEquivalent485 = g('po') + bulkEff489 + cportEff489 * 2, railUnits485 = railLines + imEff489 * 2;
  const fuelCap485 = FUEL_STOCK_CAP + fuelDepEff489 * 80, steelCap485 = STEEL_STOCK_CAP + steelYEff489 * 80;
  const foodPreserveMul485 = 1 + Math.min(.20, coldEff489 * .05 + siloEff489 * .035), goodsCapBonus485 = clEff489 * 240 + dcEff489 * 180 + cportEff489 * 300;
  return { whEff489, frtEff489, clEff489, imEff489, dcEff489, coldEff489, siloEff489, fuelDepEff489, gasDepEff489, steelYEff489, bulkEff489, cportEff489,
    freightUnits485, warehouseUnits485, portEquivalent485, railUnits485, fuelCap485, steelCap485, foodPreserveMul485, goodsCapBonus485 };
}

// 道路負載統計（T129 壅堵）：平均（每個路格 min(2, 負載／容量) 的平均）與過載路格的比例。壅堵沒搬＝0、0
export interface RoadStats { avg: number; over: number }
export const NO_ROAD_LOAD: RoadStats = { avg: 0, over: 0 };
