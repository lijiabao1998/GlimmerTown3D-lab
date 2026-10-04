// 主計數迴圈補齊（D024）：固定就業（55246–55250）、維護費（55973–55976）與後面各系統（貿易、物流、產業鏈）用得到的設施計數。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。主計數迴圈（55050–55149）對每個「有建築的根格」（55054 跳過 ref 格）逐行數一個計數；
// D016 數了 8 種（下面 tallyBuildings 的 fac）、D022 數了食物、觀光、貿易的 36 種（food.ts countFood），這裡數剩下的（欄位名＝實驗線的區域變數名）。
// 各計數彼此獨立、不共用累加器（每個計數在每棟建築上只被一個地方碰到），所以 countFood、fac、countMore 分開數，順序不影響結果；day.ts 只叫 tallyBuildings 一次。
// 讀的 b.pw 是前一天算好的：計數在 55050–55149，通電在同一迴圈後面的 55154–55156（只給 k≤3 與社宅）；本線 day.ts 先數、後通電，跟 D016、D022 一樣。
// 資源開採（55131–55146）：D036 起接上——油井 k49、礦場 k50 每天抽 RESOURCE／RDEP（resource.ts extractWell），suppliesGain、oilGain、oreGain 進這裡的計數；沒給資源場（res）＝沒有資源圖＝抽取量 0。
// 沒搬（一律當 0／沒有）：事故 T493（logisticsOperational485 讀的可用度恆 1）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；不動世界歷史。
import { countNear } from './grid.ts';
import { sanRoadSeeds445 } from './garbage.ts';
import { FERT_BOOST, countFood, emptyFoodCount, type FoodCount } from './food.ts';
import { JOB_KEYS, infraJobs475, jobCounts, powerJobs471, residentPopulation488, transitDepotTotals501, waterJobs472, type JobCounts } from './jobs.ts';
import type { Bld, Tile, World } from './lab.ts';
import { RES_OIL, RES_ORE, extractWell, type ResourceField } from './resource.ts';

// 63008 UP_MAX：可升級的種類（有的話升級加成就業，55055）；63009 UP_JOB：每級加成就業（沒列＝預設 6；顯式 0＝純擴容不加就業，所以用 ?? 不用 ||）
export const UP_MAX: Record<number, number> = { 9: 15, 6: 10, 7: 10, 11: 10, 12: 10, 13: 10, 14: 10, 15: 10, 10: 10, 5: 10, 16: 10, 28: 10, 29: 10, 30: 10, 17: 10, 18: 10, 21: 10, 54: 10, 55: 10, 53: 8, 56: 15, 22: 8, 23: 8, 25: 10, 26: 10,
  57: 10, 58: 10, 59: 10, 60: 10, 61: 10, 62: 10, 63: 8, 64: 10, 65: 8 };
export const UP_JOB: Record<number, number> = { 9: 15, 54: 8, 55: 12, 53: 3, 17: 8, 18: 8, 56: 18, 22: 1, 23: 1, 5: 0, 25: 0, 26: 0, 57: 0, 58: 0, 59: 0, 60: 0, 62: 0, 63: 1, 64: 0, 65: 20 };
// 38129 LMCFG309 的 j（就業）、u（維護）：地標 k69–80（55116 只數 69–80；表裡 k179 以後沒人數）
export const LANDMARK_JOBS309: Record<number, number> = { 69: 4, 70: 3, 71: 2, 72: 3, 73: 4, 74: 2, 75: 3, 76: 6, 77: 3, 78: 1, 79: 2, 80: 4 };
export const LANDMARK_UPKEEP309: Record<number, number> = { 69: 4, 70: 3, 71: 3, 72: 4, 73: 5, 74: 3, 75: 4, 76: 7, 77: 4, 78: 2, 79: 3, 80: 5 };
// 37295 LOGISTICS_META485 的種類（k165–174：貨櫃物流、聯運、配送中心、冷鏈、穀倉、油庫、氣庫、鋼材場、散裝碼頭、貨櫃港）
const isLogistics485 = (k: number) => k >= 165 && k <= 174;

// 51246 logisticsOperational485：運作中＝有電、有貼到道路（整片佔地四鄰有路）、聯運要鄰近 ≥2 鐵路格（半徑 6）、散貨碼頭 ≥4 水格（半徑 5）、貨櫃港 ≥5 水格（半徑 6）。
// 事故（assetAvailability493）本線沒有＝可用度 1
export function logisticsOperational485(w: World, root: number, b: Bld | null | undefined): boolean {
  if (!b || b.ref || !isLogistics485(b.k) || !b.pw) return false;
  if (!sanRoadSeeds445(w, root).length) return false;
  const x = root % w.N, y = (root / w.N) | 0;
  if (b.k === 166 && countNear(w, x, y, 6, (t: Tile) => t.rail) < 2) return false;
  if (b.k === 173 && countNear(w, x, y, 5, (t: Tile) => t.t === 0) < 4) return false;
  if (b.k === 174 && countNear(w, x, y, 6, (t: Tile) => t.t === 0) < 5) return false;
  return true;
}

// 主計數迴圈剩下的計數（欄位名＝實驗線的區域變數名；宣告在 55039–55048）
export const MORE_KEYS = ['upJob', 'bigCemN', 'gstN', 'scN', 'fpN', 'procCapU', 'nkN', 'hyN', 'geN', 'fhqN', 'wteN', 'ghN', 'ghGoldU', 'whCap284', 'mallN', 'nComG284', 'nIndG284',
  'gh330', 'ht330', 'kg330', 'sn330', 'bk330', 'mk330', 'cp330', 'dg336', 'ir336', 'sk336', 'fw340', 'pl340', 'hs340', 'br340', 'vt340', 'pa', 'tr', 'fa', 'farmGoldU', 'bigFa', 'ra', 'ranchGoldU',
  'so', 'wi', 'se', 'am', 'rc', 'fs2', 'pr', 'un', 'cr342', 'hsc342', 'tpk342', 'upc342', 'gw346', 'fp346', 'kt346', 'refineryN', 'steelMillN', 'shipyardN',
  'cl485', 'clOp485', 'im485', 'imOp485', 'dc485', 'dcOp485', 'cold485', 'coldOp485', 'silo485', 'siloOp485', 'fuelDep485', 'fuelDepOp485', 'gasDep485', 'gasDepOp485',
  'steelY485', 'steelYOp485', 'bulk485', 'bulkOp485', 'cport485', 'cportOp485', 'court364', 'tennis364', 'play364', 'socialHousing364', 'substation364', 'desal364', 'pump364', 'center364', 'shelter364', 'radar364',
  'gmc466', 'cam342', 'cvc342', 'dtc342', 'mgR341', 'mgC341', 'trR', 'trC', 'faN', 'jobsLm309', 'upLm309', 'gl', 'chN', 'crtN', 'inN', 'wsN', 'mhN', 'indBldN', 'owN', 'mnN', 'mgN',
  'suppliesGain', 'oilGain', 'oreGain'] as const;
export type MoreCount = Record<(typeof MORE_KEYS)[number], number>;
export const emptyMoreCount = (): MoreCount => Object.fromEntries(MORE_KEYS.map(k => [k, 0])) as MoreCount;

// 一棟根格建築對這些計數的貢獻（55055–55147）。呼叫端先跳過 ref 格（55054）。root＝這棟的格子索引（運作中判斷要用）。行號＝實驗線那一行
// fb：農場與大農場的化肥增產倍率（同 food.ts countFood）
export function countMore(c: MoreCount, w: World, root: number, b: Bld, fb = 1, res?: ResourceField): void {
  const k = b.k;
  if (UP_MAX[k] && (b.lv as number) > 1) c.upJob += (b.lv - 1) * (UP_JOB[k] ?? 6);   // 55055：升級服務每級加成就業（?? 而非 ||：顯式 0 不能退回 6）
  switch (k) {
    case 54: c.bigCemN++; break;                                                  // 55064 大墓園
    case 55: c.gstN++; break;                                                     // 55065 中央車站
    case 56: c.scN++; break;                                                      // 55066 體育園區
    case 57: c.fpN++; if (b.pw) c.procCapU += 40 + ((b.lv || 1) - 1) * 20; break; // 55067 食品加工廠：加工容量 40＋20／級，只算有電的
    case 58: c.nkN++; break;                                                      // 55068 核電廠
    case 59: c.hyN++; break;                                                      // 55069 水力發電
    case 60: c.geN++; break;                                                      // 55070 地熱發電
    case 61: c.fhqN++; break;                                                     // 55071 消防總局
    case 62: c.wteN++; break;                                                     // 55072 垃圾焚化發電廠
    case 63: c.ghN++; c.ghGoldU += (b.lv || 1) * 4; break;                        // 55073 溫室：金幣 4／級（食物 6／級在 countFood）
    case 64: c.whCap284 += 120 + ((b.lv || 1) - 1) * 60; break;                   // 55074 倉儲物流中心：工業品容量 120＋60／級（座數 whN284 在 countFood）
    case 65: c.mallN++; if (b.pw) c.nComG284 += 3; break;                         // 55075 大型購物中心：有電算 3 個零售單位
    case 81: c.gh330++; break;                                                    // 55076
    case 82: c.ht330++; break;
    case 84: c.kg330++; break;                                                    // 55077
    case 85: c.sn330++; break;
    case 86: c.bk330++; break;
    case 87: c.mk330++; break;                                                    // 55078
    case 88: c.cp330++; break;
    case 92: c.dg336++; break;                                                    // 55079（貿易站 k91 在 countFood）
    case 93: c.ir336++; break;
    case 94: c.sk336++; break;
    case 95: c.fw340++; break;                                                    // 55080（食品加工類 k97、k99 在 countFood）
    case 96: c.pl340++; break;
    case 98: c.hs340++; break;
    case 100: c.br340++; break;                                                   // 55081
    case 102: c.vt340++; break;
    case 3: c.indBldN++; if ((b.lv as number) >= 2 && b.pw) c.nIndG284++; break;  // 55082、55130 工業：二級以上有電才算能產工業品的；indBldN 不看電
    case 2: if ((b.lv as number) >= 2 && b.pw) c.nComG284++; break;               // 55083 商業：二級以上有電才算能銷工業品的
    case 20: c.pa++; break;                                                       // 55087 停車場
    case 21: c.tr++; break;                                                       // 55088 輕軌站
    case 25: c.so++; break;                                                       // 55093 太陽能
    case 26: c.wi++; break;                                                       // 55094 風力
    case 27: c.se++; break;                                                       // 55095 污水廠
    case 28: c.am++; break;                                                       // 55096 救護站
    case 29: c.rc++; break;                                                       // 55097 回收中心
    case 30: c.fs2++; break;                                                      // 55098 高級消防
    case 31: c.pr++; break;                                                       // 55099 監獄
    case 32: c.un++; break;                                                       // 55100 大學
    case 107: c.cr342++; break;                                                   // 55101（貨運中心 k110 在 countFood）
    case 108: c.hsc342++; break;
    case 109: c.tpk342++; break;
    case 111: c.upc342++; break;
    case 117: c.gw346++; break;                                                   // 55102（食品加工類 k120 在 countFood）
    case 118: c.fp346++; break;
    case 119: c.kt346++; break;
    case 121: c.refineryN++; break;                                               // 55103
    case 122: c.steelMillN++; break;
    case 123: c.shipyardN++; break;
    case 165: c.cl485++; if (logisticsOperational485(w, root, b)) c.clOp485++; break;          // 55104：built 與 operational 分離
    case 166: c.im485++; if (logisticsOperational485(w, root, b)) c.imOp485++; break;
    case 167: c.dc485++; if (logisticsOperational485(w, root, b)) c.dcOp485++; break;
    case 168: c.cold485++; if (logisticsOperational485(w, root, b)) c.coldOp485++; break;
    case 169: c.silo485++; if (logisticsOperational485(w, root, b)) c.siloOp485++; break;
    case 170: c.fuelDep485++; if (logisticsOperational485(w, root, b)) c.fuelDepOp485++; break;
    case 171: c.gasDep485++; if (logisticsOperational485(w, root, b)) c.gasDepOp485++; break;
    case 172: c.steelY485++; if (logisticsOperational485(w, root, b)) c.steelYOp485++; break;
    case 173: c.bulk485++; if (logisticsOperational485(w, root, b)) c.bulkOp485++; break;
    case 174: c.cport485++; if (logisticsOperational485(w, root, b)) c.cportOp485++; break;
    case 124: c.court364++; break;                                                // 55105
    case 125: c.tennis364++; break;
    case 126: c.play364++; break;
    case 127: c.socialHousing364++; break;
    case 128: c.substation364++; break;                                           // 55106
    case 129: c.desal364++; break;
    case 130: c.pump364++; break;
    case 131: c.center364++; break;
    case 132: c.shelter364++; break;
    case 133: c.radar364++; break;
    case 135: c.gmc466++; break;                                                  // 55107（k112、134、136–138、114 在 countFood）
    case 113: c.cam342++; break;
    case 115: c.cvc342++; break;
    case 116: c.dtc342++; break;
    case 105: c.mgR341++; break;                                                  // 55108 住宅巨廈（居民 megaPop 在 day.ts）
    case 106: c.mgC341++; break;                                                  // 55109 商業綜合體
    case 33: c.trR++; break;                                                      // 55110 住宅塔（居民 towerPop 在 day.ts）
    case 34: c.trC++; break;                                                      // 55111 商業塔
    case 66: c.faN++; break;                                                      // 55113 信仰中心
    case 41: c.gl++; break;                                                       // 55122 圖書總館
    case 42: c.chN++; break;                                                      // 55123 市政廳
    case 43: c.crtN++; break;                                                     // 55124 法院
    case 45: c.inN++; break;                                                      // 55126 研究院
    case 46: c.wsN++; break;                                                      // 55127 氣象站
    case 48: c.mhN++; break;                                                      // 55129 綜合醫院
    case 49: { c.owN++; if (res) { const e = extractWell(res, root, RES_OIL); c.suppliesGain += e; c.oilGain += e; } break; }   // 55131 油井：站在油田格上每天抽 min(3, 240−RDEP)，進耗損、供應品、油
    case 50: { c.mnN++; if (res) { const e = extractWell(res, root, RES_ORE); c.suppliesGain += e; c.oreGain += e; } break; }    // 55139 礦場：站在礦藏格上每天抽 min(2, 240−RDEP)，進耗損、供應品、礦
    case 51: c.mgN++; break;                                                      // 55147 太空研究中心
    case 22: c.fa++; c.farmGoldU += (b.lv || 1) * 3 * fb; break;                  // 55089 農場：金幣 3／級×化肥增產 fb
    case 53: c.bigFa++; c.farmGoldU += (b.lv || 1) * 12 * fb; break;              // 55090 大農場：金幣 12／級×fb
    case 23: c.ra++; c.ranchGoldU += (b.lv || 1) * 2; break;                      // 55091 牧場：金幣 2／級
  }
  if (k >= 69 && k <= 80) { const j = LANDMARK_JOBS309[k], u = LANDMARK_UPKEEP309[k]; if (j !== undefined) { c.jobsLm309 += j; c.upLm309 += u; } }   // 55116 地標累加（觀光值 tourLm309 在 countFood）
}

// 主計數迴圈（55050–55149）的全部計數（D024）：D016 的 8 種（fac）＋ D022 的食物、觀光、貿易（fc）＋ 這裡的其餘（mc），加住宅塔與巨廈的居民（55108、55110：不看有沒有電）。
// 三份計數欄位互不重疊；cnt 是合成的一份（欄位名＝實驗線變數名），餵固定就業（jobCountsOf）與維護費（day.ts settleToday）
export interface FacCount { schools: number; dumps: number; stadiums: number; waterTowers: number; clinics: number; libraries: number; posts: number; cemeteries: number }
export interface Tally { fc: FoodCount; fac: FacCount; mc: MoreCount; towerPop: number; megaPop: number; cnt: Record<string, number> }
// fert（選填）：昨天的化肥（T346 fertReady）與化肥廠覆蓋場（COV.fertco）；兩個都成立的根格農場與大農場食物與金幣 ×1.35（55089、55090）。沒給＝沒有化肥
export interface FertIn { ready: boolean; fertco?: ArrayLike<number> }
export function tallyBuildings(w: World, tickBld: readonly number[], fert?: FertIn, res?: ResourceField): Tally {
  const fc = emptyFoodCount(), mc = emptyMoreCount();
  const fac: FacCount = { schools: 0, dumps: 0, stadiums: 0, waterTowers: 0, clinics: 0, libraries: 0, posts: 0, cemeteries: 0 };
  let towerPop = 0, megaPop = 0;                                            // 55040 towerPop488、megaPop488（D021）
  for (const i of tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.ref) continue;                                              // 55054：多格建築的 ref 格不參與
    const fb = (b.k === 22 || b.k === 53) && fert && fert.ready && fert.fertco && fert.fertco[i] > 0 ? FERT_BOOST : 1;   // 55089–55090：(fertReady&&COV.fertco&&COV.fertco[idx(x,y)]>0)?1.35:1
    countFood(fc, b, fb);
    countMore(mc, w, i, b, fb, res);
    if (b.k === 105) megaPop += residentPopulation488(b, () => undefined);  // 55108：住宅巨廈（T488 單一人口真相；住房沒就緒＝入住率 1）
    if (b.k === 33) towerPop += residentPopulation488(b, () => undefined);  // 55110：住宅塔
    if (b.k === 7) fac.schools++;                                           // 55056
    if (b.k === 8) fac.dumps++;                                             // 55057
    if (b.k === 9) fac.stadiums++;                                          // 55058
    if (b.k === 10) fac.waterTowers++;                                      // 55059
    if (b.k === 13) fac.clinics++;                                          // 55060
    if (b.k === 14) fac.libraries++;                                        // 55061
    if (b.k === 15) fac.posts++;                                            // 55062
    if (b.k === 16) fac.cemeteries++;                                       // 55063
  }
  return { fc, fac, mc, towerPop, megaPop, cnt: { ...fc, ...fac, ...mc } };
}

// 55246–55250 名目就業的計數：每一個 JOB_KEYS 從計數取（沒有的一律 0），商工的職位由呼叫端給（55241–55242 主迴圈裡加的），
// 電力、水務、基建、車庫四個掃圖函式的結果補上（55246、55250）
export function jobCountsOf(t: Tally, w: World, tickBld: readonly number[], jobsC: number, jobsI: number): JobCounts {
  const jc = jobCounts();
  for (const k of JOB_KEYS) jc[k] = t.cnt[k] ?? 0;
  jc.jobsC = jobsC; jc.jobsI = jobsI;
  jc.powerJobs471 = powerJobs471(w, tickBld); jc.waterJobs472 = waterJobs472(w, tickBld); jc.infraJobs475 = infraJobs475(w, tickBld); jc.transitDepotJobs501 = transitDepotTotals501(w, tickBld).jobs;
  return jc;
}
