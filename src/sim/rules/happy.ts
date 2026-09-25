// 住宅幸福（D009）：實驗線 tick() 55166–55224 @ d23c18d 的 happyParts，逐項同序照搬；總和夾在 .05..1。
// 輸入是「這一格已經量好的值」：服務覆蓋、污染、噪音、鄰近工業／犯罪數、道路等級、壅堵、各系統的懲罰。
// 大多數服務在起步城都沒有（覆蓋＝0 或整張場不存在），那些項就是 0。
import { clamp, tq } from './lab.ts';
import { inWinter, season } from './weather.ts';

export const WEALTH_PEN = [0.5, 1, 2];   // 37417 財富分級污染／犯罪懲罰係數：貧／中／富

export interface HappyIn {
  c: Record<string, number | undefined>;   // 這一格各服務的覆蓋計數（COV.xxx[ci]）；整張場沒有就 undefined
  POL: number; NOISE?: number; commutePenalty?: number;
  we?: number; k: number; lv: number; pw?: boolean; sick?: unknown; death?: unknown;
  ind: number; crime: number; rc: number; jam: number;   // 半徑 3 工業數、半徑 4 犯罪數、半徑 1 最高道路等級、半徑 2 過載道路數
  drainPen: number; waterLegacy: boolean; waterPen: number; deathPenalty: boolean;
  sewNeed: boolean; sewOk: boolean; weather: number; day: number;   // 季節與冬季由 day 導出（實驗線讀全域 day）
  nightCity: { ready: boolean; happinessDelta: number }; housingPen: number;
  eventHappy: number | null; cookedReady: boolean;
  pol: { freeTransit?: boolean; parkNight?: boolean; curfew?: boolean } | null;
  rankIdx: number; tvSignal: boolean; tech: readonly string[];
}

export function residentialHappy(q: HappyIn) {
  const c = q.c, gt0 = (name: string) => (c[name] as number) > 0;
  const parks = c.park as number;
  const roadHappy = q.rc === 5 ? -.12 : q.rc === 4 ? -.05 : q.rc === 3 ? 0 : q.rc === 2 ? .02 : q.rc === 1 ? .05 : 0;
  const library = gt0('library'), post = gt0('post');
  const we = q.we !== undefined ? q.we : 1;
  const pl = c.plant as number;
  const T = (id: string, on: number) => tq(q.tech, id, on, 0), winter = inWinter(q.day), sea = season(q.day);
  const parts = [
    .62,                                                                           // 基礎
    q.eventHappy !== null ? q.eventHappy : 0,                                      // 城市活動
    roadHappy,                                                                     // 道路等級
    parks ? .16 : 0,                                                               // 公園
    parks > 1 ? .06 : 0,                                                           // 多座公園
    gt0('play') ? .035 : 0,                                                        // 遊樂場
    gt0('botanical') ? .10 : 0,                                                    // 植物園
    0.03 * (gt0('rdec') ? 1 : 0),                                                  // 路旁裝飾
    0.04 * (gt0('bus') ? 1 : 0),                                                   // 公車站
    (gt0('stadium') || gt0('stadium2')) ? (gt0('stadium2') ? .11 : .08) : 0,       // 體育場
    gt0('museum') ? .05 : 0,                                                       // 博物館
    gt0('faith') ? .06 : 0,                                                        // 信仰
    gt0('kindergarten') ? .03 : 0,                                                 // 幼兒園
    gt0('senior') ? .03 : 0,                                                       // 樂齡中心
    gt0('market') ? .02 : 0,                                                       // 農貿市場
    gt0('dogpark') ? .025 : 0,                                                     // 遛狗公園
    gt0('icerink') ? (winter ? .05 : .02) : 0,                                   // 溜冰場
    gt0('skate') ? .025 : 0,                                                       // 滑板公園
    gt0('pool') ? (sea === 1 ? .05 : .02) : 0,                                // 游泳池
    gt0('chapel') ? .02 : 0,                                                       // 婚禮教堂
    gt0('vet') ? .02 : 0,                                                          // 寵物醫院
    gt0('cgarden') ? .015 : 0,                                                     // 社區菜園
    gt0('cpark') ? .05 : 0,                                                        // 中央公園
    gt0('gpark') ? .07 : 0,                                                        // 都會大公園
    gt0('artcamp') ? .08 : 0,                                                      // 文化藝術中心
    gt0('admincamp') ? .06 : 0,                                                    // 中央行政園區
    gt0('researchcamp') ? .03 : 0,                                                 // 科技研究園區
    gt0('civicc') ? .04 : 0,                                                       // 市民中心
    (q.cookedReady && gt0('kitchen')) ? .03 : 0,                                   // 熟食供應
    gt0('theater') ? .05 : 0,                                                      // 劇院
    gt0('cinema') ? .04 : 0,                                                       // 電影院
    library ? .04 : 0,                                                             // 圖書館
    post ? .03 : 0,                                                                // 郵局
    -q.ind * .09,                                                                  // 工業汙染鄰近
    -pl * .18,                                                                     // 電廠鄰近
    -q.POL * .006 * WEALTH_PEN[we],                                                // 空氣污染
    -(q.NOISE || 0) * .004 * WEALTH_PEN[we],                                       // 噪音
    (q.pol && q.pol.freeTransit && gt0('bus')) ? .02 : 0,                          // 免費公交
    (q.pol && q.pol.parkNight && parks) ? .02 : 0,                                 // 公園夜間開放
    q.rankIdx >= 25 ? .02 : 0,                                                     // 微光之巔
    q.tvSignal ? .015 : 0,                                                         // 電視訊號
    T('B1', .01) + T('B4a', .02) + T('B6', .015) + T('B8', .02) + T('C4b', .01) + T('C7', .015) + T('D6', .02) + T('D8', .03),   // 科技進步
    -q.crime * .05 * WEALTH_PEN[we],                                               // 犯罪
    -Math.min(.15, q.jam * .03),                                                   // 交通壅堵
    -(q.commutePenalty || 0),                                                      // 通勤
    -q.drainPen,                                                                   // 排水內澇
    q.waterLegacy ? 0 : -q.waterPen,                                               // 水壓／水質
    q.pol && q.pol.curfew ? -.02 : 0,                                              // 宵禁
    -(q.deathPenalty ? .1 : 0),                                                    // 喪事未安撫
    -(q.sick ? .35 : 0),                                                           // 生病
    -(q.death ? .55 : 0),                                                          // 死亡
    (q.sewNeed && q.k === 1 && q.lv >= 3 && !q.sewOk) ? -.04 : 0,                  // 高密度污水
    -(q.pw ? 0 : .3),                                                              // 無電
    -(q.weather === 1 ? .02 : q.weather === 2 ? .05 : 0),                          // 天氣
    -(winter ? .02 : 0),                                                         // 冬季
    q.nightCity.ready ? q.nightCity.happinessDelta : 0,                            // 夜間城市
    -q.housingPen,                                                                 // 住房負擔
  ];
  let s = 0;
  for (const v of parts) s = s + v;                                              // 同 reduce((s,p)=>s+p.val,0) 的加法順序
  return { h: clamp(s, .05, 1), parts };
}
