// 城市等級（D031，T133）：累積「城市點數」（人口＋幸福＋服務覆蓋）晉升的 26 級階梯，只升不降；頂級「微光之巔」住宅幸福 +2%。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號：等級表 38476–38503、宣告 38504–38505、tq 38549、城市點數 53636–53656、
// 每天的晉升 56133–56140（結算之後）、住宅幸福的「微光之巔」項 55217（讀進來時的、也就是昨天的等級）、存檔 66762、讀檔 66969–66971、歸零 51128。
// 沒有亂數；等級入存檔（實驗線既有的可選欄位 rk），點數是每天重算的、不存。純函式：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { clamp, type Bld, type World } from './lab.ts';

export interface RankDef { name: string; threshold: number; unlock?: string }
// 38476–38503：26 條，5 條帶預告文案（Lv.6、8、12、17、22 的「解鎖：…」）加頂級的榮耀（照抄，含全形符號）
export const RANKS: readonly RankDef[] = [
  { name: "拓荒營地", threshold: 0 },
  { name: "邊陲聚落", threshold: 30 },
  { name: "溪畔村落", threshold: 80 },
  { name: "阡陌村莊", threshold: 160 },
  { name: "磚瓦小鎮", threshold: 280 },
  { name: "集市小鎮", threshold: 450, unlock: "解鎖：文化建築（博物館/劇院/水族館/動物園/遊樂園/電影院/圖書總館）" },
  { name: "石橋鎮", threshold: 680 },
  { name: "通衢鎮", threshold: 980, unlock: "解鎖：小型地標（鐘樓/風車/噴泉/涼亭/燈塔/碼頭亭…）" },
  { name: "燈火小城", threshold: 1360 },
  { name: "繁景小城", threshold: 1830 },
  { name: "匠坊之城", threshold: 2400 },
  { name: "商旅之城", threshold: 3080, unlock: "解鎖：研究院" },
  { name: "學府之城", threshold: 3880 },
  { name: "港灣之城", threshold: 4810 },
  { name: "花園之城", threshold: 5880 },
  { name: "星軌之城", threshold: 7100 },
  { name: "雲塔之城", threshold: 8480, unlock: "解鎖：紀念工程（天文台/觀景塔/紀念碑/凱旋門/摩天輪/旋轉木馬）" },
  { name: "千帆之都", threshold: 10030 },
  { name: "萬家之都", threshold: 11760 },
  { name: "燈海都會", threshold: 13680 },
  { name: "環帶都會", threshold: 15800 },
  { name: "穹頂都會", threshold: 18130, unlock: "解鎖：太空研究中心" },
  { name: "星穹大都會", threshold: 20680 },
  { name: "永晝大都會", threshold: 23460 },
  { name: "織夢都會", threshold: 26480 },
  { name: "微光之巔", threshold: 29750, unlock: "城市巔峰榮耀：全城住宅幸福 +2%（永久）" },
];
export const TOP_RANK = RANKS.length - 1;   // 25：微光之巔（Lv.26）；住宅幸福 +.02 的門檻（55217）

// 53636–53656：純唯讀掃描全圖。住宅區（zone 1）的格子數與每格的服務覆蓋（警察局或派出所、消防局或二號消防站或消防總部、學校、醫院或診所、公園，各算 1，除以 5）加總；
// 住宅類建築（種類 1、127、33、105，跳過 ref 格）的居民人口；點數＝max(0, round((人口＋(幸福−.6)×400＋平均覆蓋×800)×tq(D1, 1.05)×tq(D4b, 1.10)))。
// residentPop＝每棟的居民人口（實驗線 residentPopulation488，住房市場沒就緒＝入住率 1）；tech＝做完的科技（tq 的三元 helper：做完才乘）
export function cityPoints(w: World, COV: Record<string, ArrayLike<number> | undefined>, cityHappy: number, tech: readonly string[], residentPop: (b: Bld) => number): number {
  let popN = 0, zoned = 0, covSum = 0;
  const tiles = w.tiles, nn = w.N * w.N, police = COV.police, police2 = COV.police2, fire = COV.fire, fire2 = COV.fire2, fireHQ = COV.fireHQ, school = COV.school, hospital = COV.hospital, clinic = COV.clinic, park = COV.park;
  for (let i = 0; i < nn; i++) {
    const t = tiles[i], b = t.bld;
    if (t.zone === 1) {
      zoned++;
      let c = 0;
      if ((police && police[i] > 0) || (police2 && police2[i] > 0)) c++;   // T222：派出所同計警力覆蓋
      if ((fire && fire[i] > 0) || (fire2 && fire2[i] > 0) || (fireHQ && fireHQ[i] > 0)) c++;
      if (school && school[i] > 0) c++;
      if ((hospital && hospital[i] > 0) || (clinic && clinic[i] > 0)) c++;
      if (park && park[i] > 0) c++;
      covSum += c / 5;
    }
    if (b && !b.ref) {
      if (b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105) popN += residentPop(b);   // T127／T341：住宅摩天樓也算
    }
  }
  const svcCov = zoned ? covSum / zoned : 0;
  return Math.max(0, Math.round((popN + (cityHappy - .6) * 400 + svcCov * 800) * (tech.includes('D1') ? 1.05 : 1) * (tech.includes('D4b') ? 1.10 : 1)));
}

// 56133–56140：點數達下一級的門檻就升，一天可以連升好幾級、不降級。回傳新等級與這一天升到的每一級（0 起算的 RANKS 索引）
export function rankStep(rankIdx: number, points: number): { rankIdx: number; promoted: number[] } {
  const promoted: number[] = [];
  while (rankIdx < RANKS.length - 1 && points >= RANKS[rankIdx + 1].threshold) { rankIdx++; promoted.push(rankIdx); }
  return { rankIdx, promoted };
}

// 66969–66971：讀檔。有 rk 就夾在 0 到 25 原樣還原（保留只升不降的歷史，即使現在的點數暫時低於門檻）；沒有 rk（舊檔）就從點數往上爬。
// rk 可以是任何 JSON 值：實驗線用 `d.rk|0`（小數捨去、字串轉數字、null 與壞值＝0）；缺欄位才是 undefined
export function rankOfSave(rk: unknown, points: number): number {
  if (rk !== undefined) return clamp((rk as number) | 0, 0, RANKS.length - 1);
  return rankStep(0, points).rankIdx;
}
