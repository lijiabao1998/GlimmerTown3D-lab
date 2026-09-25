// 住商工需求（D009）：舊式三條（55578–55583）→ 勞動市場（38264）→ 經濟組合（38271）→ 住房組合（39503）；
// 另有移民潮與人口學係數（55590–55593）。上層（經濟閉環、住房市場、企業）沒搬：它們的快照由呼叫端給，沒就緒就給 null。
import { clamp, streetHash, tq } from './lab.ts';

export interface LegacyIn { pop: number; jobs: number; cityHappy: number; czone: number; jobsC: number; jobsI: number; indSubsidy: boolean; tech: readonly string[] }
// 55578–55583
export function legacyDemand(q: LegacyIn) {
  const workers = q.pop * .6;
  const jobSurplus = clamp((q.jobs * 1.2 + 25 - workers) / 70, -1, 1);
  const happyAdj = clamp((q.cityHappy - .6) * 1.2, -1, 1);
  const legacyR481 = clamp(jobSurplus * .7 + happyAdj * .3, -1, 1);
  const czone = q.czone;
  const legacyC481 = clamp((q.pop / Math.max(1, czone) - 3) / 6, -1, 1);
  const legacyI481 = clamp((q.jobsC * .8 - q.jobsI) / 40 + (q.indSubsidy ? .15 : 0) + tq(q.tech, 'A7', .10, 0), -1, 1);
  return { workers, jobSurplus, happyAdj, legacyR481, czone, legacyC481, legacyI481 };
}

export interface Labor { workers: number; employed: number; unemployed: number; vacancies: number; employmentRate: number; unemploymentRate: number; vacancyRate: number; wageIndex: number }
export interface EnterpriseSnap { ready: boolean; day: number; rollback?: boolean; cityEmployed?: number }
// 38264：企業層（T489）就緒且是今天的快照時，就業人數讀企業；否則＝min(勞動力, 職位)
export function laborMarket481(p: number, j: number, ent: EnterpriseSnap | null, day: number): Labor {
  const workers = Math.max(1, Math.round(p * .60)), actual = (ent && ent.ready && ent.day === day && !ent.rollback) ? Math.min(workers, Math.max(0, ent.cityEmployed || 0)) : Math.min(workers, Math.max(0, j)), employed = actual, unemployed = Math.max(0, workers - employed), vacancies = Math.max(0, Math.max(0, j) - employed), employmentRate = workers ? employed / workers : 1, unemploymentRate = workers ? unemployed / workers : 0, vacancyRate = Math.max(0, j) ? vacancies / Math.max(1, j) : 0, wageIndex = clamp(j / workers, .55, 1.55);
  return { workers, employed: +employed.toFixed(2), unemployed: +unemployed.toFixed(2), vacancies: +vacancies.toFixed(2), employmentRate: +employmentRate.toFixed(4), unemploymentRate: +unemploymentRate.toFixed(4), vacancyRate: +vacancyRate.toFixed(4), wageIndex: +wageIndex.toFixed(4) };
}

export interface EconomySnap { ready: boolean; consumption: { purchasingPower: number }; commerce: { utilization: number }; goods: { stockRatio: number; shortageRatio: number }; trade: { exportSignal: number }; production: { marketMul: number } }
// 38271：住宅需求一律混入就業率與工資；經濟閉環就緒時商工改讀購買力、零售利用率、商品庫存與缺貨、出口
export function economyDemands481(legacyR: number, legacyC: number, legacyI: number, laborNow: Labor, e: EconomySnap | null) {
  const empSig = clamp((laborNow.employmentRate - .90) / .10, -1, 1), wageSig = clamp((laborNow.wageIndex - 1) / .40, -1, 1);
  const r = clamp(legacyR * .55 + empSig * .30 + wageSig * .15, -1, 1);
  let c = legacyC, i = legacyI;
  if (e && e.ready) {
    const ppSig = clamp((e.consumption.purchasingPower - 1) / .35, -1, 1), retSig = clamp((e.commerce.utilization - .72) / .45, -1, 1), stockPress = clamp((e.goods.stockRatio - .62) / .38, 0, 1);
    c = clamp(legacyC * .18 + ppSig * .34 + retSig * .62 - e.goods.shortageRatio * .22, -1, 1);
    i = clamp(legacyI * .18 + e.goods.shortageRatio * .72 + e.trade.exportSignal * .38 - stockPress * .42 + (e.production.marketMul - 1) * .25, -1, 1);
  }
  return { r, c, i };
}

// 39503：住房市場就緒時住宅需求＝舊式 42%＋市場 58%
export const housingRciDemand488 = (legacy: number, housing: { ready: boolean; aggregateDemand: number } | null) =>
  housing && housing.ready ? clamp(legacy * .42 + housing.aggregateDemand * .58, -1, 1) : legacy;

// 55590–55593：移民潮倒數；人口 >150、每 45 天、幸福 >.68、住宅需求 >.2 時觸發 6 天。
// 實驗線的 streetHash(day,3,777)%100<70 恆成立（streetHash 在 0..1），照原樣搬。mobMod＝交通層（T509）的成長修正，沒搬就給 0
export function immigration(immWave: number, pop: number, day: number, cityHappy: number, demR: number) {
  if (immWave > 0) return { immWave: immWave - 1, started: false };
  if (pop > 150 && day % 45 === 0 && cityHappy > .68 && demR > .2 && streetHash(day, 3, 777) % 100 < 70) return { immWave: 6, started: true };
  return { immWave, started: false };
}
export const demoMul = (cityHappy: number, immWave: number, mobMod: number) => clamp(1 + (cityHappy - .62) * .55 + (immWave > 0 ? .4 : 0) + mobMod, .6, 1.6);
