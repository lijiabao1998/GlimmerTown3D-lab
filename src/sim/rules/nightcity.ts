// 夜間城市（D029，T487）：每天結束前算一次「安全與活力」，隔天的住宅幸福（`夜間城市` 一項）與犯罪抽籤讀它，當天的稅（晚間消費金）、收入（夜間運輸）與維護費（夜間營運）讀當天算好的。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號：輸入 37317–37333（emptyNightInputs487、NIGHT_ENTERTAIN_K487／NIGHT_TRANSIT_K487、prepareNightInputs487）、
// 犯罪乘數 37344–37348（nightCrimeMul487）、結算 37354–37377（finalizeNightCity487），使用點：幸福 55233、犯罪 55817、每天的呼叫 55866、晚間消費金 55968、夜間運輸與營運費 56027。
// 回退設定下 T471 電力調度提早返回（52776），power471.publicLighting 從來沒有值＝路燈的 connected、served 恆 0（有道路＝覆蓋 0，沒有道路＝覆蓋 1）；本線照它。
// 沒有亂數；執行期狀態、不存檔（讀檔與新圖是 ready:false）。純函式：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { clamp, type Bld, type World } from './lab.ts';

type Flag = number | boolean;
export interface NightPol { nightMarket?: Flag; parkNight?: Flag; curfew?: Flag; freeTransit?: Flag }

export interface NightInputs {
  day: number; roadTiles: number; roadWeight: number; transitNodes: number; residential: number; commercial: number; entertainment: number; industrial: number; civic: number; parks: number;
  lightingEvening: number; lightingNight: number;
}
export interface NightCity {
  ready: boolean; day: number; inputs: NightInputs;
  lighting: { planned: number; connected: number; served: number; energyDemand: number; energyServed: number; coverage: number; networkRate: number; powerRate: number; poweredRoads: number; totalRoads: number };
  commerce: { activity: number; taxMul: number; potential: number };
  transit: { demand: number; capacity: number; riders: number; service: number };
  safety: { score: number; grade: string; policeCoverage: number; crimeMul: number };
  finance: { commerceGold: number; transitRevenue: number; operatingCost: number; net: number };
  happinessDelta: number;
  policies: { nightMarket: boolean; parkNight: boolean; curfew: boolean };
}
export const emptyNightInputs = (): NightInputs => ({ day: -1, roadTiles: 0, roadWeight: 0, transitNodes: 0, residential: 0, commercial: 0, entertainment: 0, industrial: 0, civic: 0, parks: 0, lightingEvening: 0, lightingNight: 0 });   // 37317
export const emptyNightCity = (): NightCity => ({   // 37318
  ready: false, day: 0, inputs: emptyNightInputs(),
  lighting: { planned: 0, connected: 0, served: 0, energyDemand: 0, energyServed: 0, coverage: 0, networkRate: 1, powerRate: 1, poweredRoads: 0, totalRoads: 0 },
  commerce: { activity: 0, taxMul: 1, potential: 0 }, transit: { demand: 0, capacity: 0, riders: 0, service: 1 },
  safety: { score: 1, grade: 'A', policeCoverage: 1, crimeMul: 1 }, finance: { commerceGold: 0, transitRevenue: 0, operatingCost: 0, net: 0 },
  happinessDelta: 0, policies: { nightMarket: false, parkNight: false, curfew: false },
});
// 37320、37321
export const NIGHT_ENTERTAIN = new Set([9, 35, 36, 37, 38, 39, 40, 44, 56, 65, 66, 76, 81, 82, 83, 87, 90, 93, 94, 96, 98, 99, 101, 103, 136]);
export const NIGHT_TRANSIT = new Set([17, 18, 19, 21, 55, 90, 110, 114, 139, 166, 173, 174]);
const ROAD_WEIGHT = [0, .55, .78, 1.04, 1.36, 1.78];

// 37323–37333：掃道路格與建築（照索引由小到大）。cat＝kcatOf（種類的類別字母）
export function prepareNightInputs(w: World, tickRoad: readonly number[], tickBld: readonly number[], cat: (k: number) => string, day: number, pol: NightPol | null): NightInputs {
  const q = emptyNightInputs(); q.day = day;
  for (const i of tickRoad) {
    const t = w.tiles[i]; if (!t || !t.road) continue;
    const rc = clamp(t.rc || 2, 1, 5);
    q.roadTiles++; q.roadWeight += ROAD_WEIGHT[rc]; if (t.bus) q.transitNodes++; if (t.rail || t.tram) q.transitNodes += .35;
  }
  for (const i of tickBld) {
    const b = w.tiles[i] && w.tiles[i].bld; if (!b || b.ref) continue;
    const k = b.k | 0, c = cat(k), sz = Math.max(1, b.sz || 1), area = Math.min(9, sz * sz);
    if (c === 'R') q.residential += area; else if (c === 'C') q.commercial += area; else if (c === 'I' || c === 'E') q.industrial += area; else if (c === 'A' || c === 'S' || c === 'H' || c === 'D' || c === 'T') q.civic += area;
    if (NIGHT_ENTERTAIN.has(k)) q.entertainment += area; if (NIGHT_TRANSIT.has(k)) q.transitNodes += Math.max(1, sz); if (c === 'G') q.parks += area;
  }
  q.lightingEvening = +(q.roadWeight * .014 + q.transitNodes * .045 + q.civic * .010).toFixed(3);
  q.lightingNight = +(q.roadWeight * .021 + q.transitNodes * .065 + q.civic * .014 + (pol && pol.parkNight ? q.parks * .035 : 0)).toFixed(3);
  return q;
}

// 37364–37368：住宅（R）、商業（C）與娛樂設施裡有警察局（COV.police）或派出所（COV.police2）覆蓋的比例；沒有這樣的建築＝1。照 tickBld 的順序、跳過 ref 格
export function nightPoliceCoverage(w: World, tickBld: readonly number[], cat: (k: number) => string, COV: Record<string, ArrayLike<number> | undefined>): number {
  const p1 = COV.police, p2 = COV.police2; let targets = 0, covered = 0;
  for (const i of tickBld) {
    const b = w.tiles[i] && w.tiles[i].bld; if (!b || b.ref) continue;
    const c = cat(b.k); if (!(c === 'R' || c === 'C' || NIGHT_ENTERTAIN.has(b.k))) continue;
    targets++; if ((p1 && p1[i] > 0) || (p2 && p2[i] > 0)) covered++;
  }
  return targets ? covered / targets : 1;
}

// 55866 呼叫的輸入（當天經濟段算好的）：購買力、貨物供給率、公交乘客（T463／T468，本線沒有＝0）、遊客、失業率
export interface NightOut { purchasingPower: number; goodsSupply: number; transitRidership: number; tourists: number; unemployment: number }
// 37354–37377：policeCoverage＝（住宅、商業、娛樂設施裡有警察局或派出所覆蓋的比例；沒有這樣的建築＝1，由呼叫端數）、totalRoads＝道路格數
export function finalizeNightCity(I: NightInputs, o: NightOut, policeCoverage: number, totalRoads: number, day: number, pol: NightPol | null): NightCity {
  const planned = Math.max(0, +I.lightingNight || 0), connected = 0, served = 0;   // publicLighting 沒有值（回退設定的 __legacyPower471）
  const networkRate = planned > 0 ? clamp(connected / planned, 0, 1) : 1, pRate = connected > 0 ? clamp(served / connected, 0, 1) : (planned > 0 ? 0 : 1), lightingCoverage = planned > 0 ? clamp(served / planned, 0, 1) : 1;
  const nm = !!(pol && pol.nightMarket), cf = !!(pol && pol.curfew), pn = !!(pol && pol.parkNight);
  const pp = clamp(+o.purchasingPower || 1, .45, 1.45), goods = clamp(+o.goodsSupply || 1, 0, 1), unemp = clamp(+o.unemployment || 0, 0, 1), dailyTransit = Math.max(0, +o.transitRidership || 0);
  const demand = Math.round((I.commercial * 1.8 + I.entertainment * 3.8 + I.industrial * .75 + I.civic * .55 + (+o.tourists || 0) * .025) * (nm ? 1.25 : 1) * (cf ? .58 : 1));
  const capacity = Math.round(dailyTransit * .22 + I.transitNodes * 5), service = demand > 0 ? clamp(capacity / demand, 0, 1) : 1;
  const safety = clamp(.18 + lightingCoverage * .37 + policeCoverage * .31 + service * .10 + (cf ? .10 : 0) - (nm ? .035 : 0) - (pn ? .015 : 0) - unemp * .06, 0, 1);
  const policy = (nm ? 1.18 : .72) * (cf ? .68 : 1) * (pn ? 1.04 : 1);
  const activity = clamp((.20 + lightingCoverage * .31 + service * .20 + safety * .16 + clamp((pp - .55) / .9, 0, 1) * .13) * policy * goods * (1 - unemp * .22), 0, 1.25);
  const riders = Math.round(Math.min(demand, capacity) * clamp(activity, 0, 1)), potential = I.commercial + I.entertainment * 1.8;
  const commerceGold = Math.max(0, Math.round((potential * .16 + (+o.tourists || 0) * .0035) * activity * (nm ? 1 : .38)));
  const transitRevenue = pol && pol.freeTransit ? 0 : Math.max(0, Math.round(riders * .018));
  const operatingCost = Math.max(0, Math.round((riders * .004 + I.transitNodes * .025 + (pn ? I.parks * .025 : 0)) * (nm || pn ? 1 : .45)));
  const hDelta = clamp((safety - .55) * .016 + (activity - .45) * .005, -.012, .014), grade = safety >= .82 ? 'A' : safety >= .66 ? 'B' : safety >= .48 ? 'C' : 'D';
  return {
    ready: true, day, inputs: { ...I },
    lighting: { planned: +planned.toFixed(3), connected: +connected.toFixed(3), served: +served.toFixed(3), energyDemand: 0, energyServed: 0, coverage: +lightingCoverage.toFixed(3), networkRate: +networkRate.toFixed(3), powerRate: +pRate.toFixed(3), poweredRoads: 0, totalRoads },
    commerce: { activity: +activity.toFixed(3), taxMul: +(nm ? 1 + .04 + .08 * activity : 1).toFixed(3), potential: +potential.toFixed(1) },
    transit: { demand, capacity, riders, service: +service.toFixed(3) },
    safety: { score: +safety.toFixed(3), grade, policeCoverage: +policeCoverage.toFixed(3), crimeMul: +clamp(1.14 - safety * .34, .72, 1.20).toFixed(3) },
    finance: { commerceGold, transitRevenue, operatingCost, net: commerceGold + transitRevenue - operatingCost },
    happinessDelta: +hDelta.toFixed(4), policies: { nightMarket: nm, parkNight: pn, curfew: cf },
  };
}

// 37344–37348：犯罪抽籤的乘數（讀前一天算好的狀態）。policed＝這一格有警察局或派出所覆蓋，isCommerce＝這一棟是商業（k2）
export function nightCrimeMul(g: NightCity, policed: boolean, b: Pick<Bld, 'k'> | null | undefined, pol: NightPol | null): number {
  if (!g.ready) return 1;
  const sLocal = policed ? 1 : 0, local = .62 * g.safety.score + .38 * sLocal, market = (b && b.k === 2 && pol && pol.nightMarket) ? .05 : 0;
  return clamp(1.14 - local * .34 + market, .72, 1.20);
}
