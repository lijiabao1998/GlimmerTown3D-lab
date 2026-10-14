// 資源開採（D036，backlog M）：資源圖 RESOURCE 與耗損 RDEP，油井 k49、礦場 k50 每天的抽取。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。
//   常數 RESOURCE_STOCK＝240、OIL_RATE＝3、ORE_RATE＝2（39447–39448）；值噪聲 makeNoise（37227–37238）；資源圖 genResource（53225–53237）；
//   每天的抽取在主計數迴圈裡（55131–55146，本線 count.ts countMore 叫 extractWell）；讀檔還原耗損 RDEP（66946–66951）；存檔的稀疏欄位 rdep（66730、66765）。
// 資源圖只由種子與地形決定、不入存檔（讀檔時用存檔的種子重建，66895）；耗損 RDEP 是開採歷史、沒辦法從種子重建，所以走存檔的稀疏欄位 rdep（[[格索引, 已開採量], …]）。
// 照抄的細節：值噪聲的格點存成 Float32Array（單精度，門檻邊上的格子靠它判）；兩個噪聲場各 64×64、種子各自 xor 一個常數、不碰全域亂數；只在陸地（沙 t＝1、草 t＝2）鋪資源，
// 油先於礦（同一格兩邊都過門檻算油）；油井只抽油田格（RESOURCE＝1）、礦場只抽礦藏格（RESOURCE＝2）；沒電的井照抽（55131 沒讀 b.pw）；耗盡（RDEP ≥ 240）停產、最後一天只抽剩下的。
// 沒搬：蓋油井與礦場的工具（canPlace 要資源格，51430–51431）、資源圖的視圖與游標提示、市長 AI 找井址（54809、54881）、氣井 k117（走 gasDep485，不吃 RDEP）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；不動世界歷史、不動全域亂數。
import { mulberry32 } from '../rng.ts';
import type { World } from './lab.ts';

export const RESOURCE_STOCK = 240;                       // 39447：單一資源格總可開採量上限（RDEP 累計達此值即該格停產）
export const OIL_RATE = 3;                               // 39448：油井／礦場每日抽取速率
export const ORE_RATE = 2;
export const RES_OIL = 1;                               // RESOURCE 的值：0 無、1 油、2 礦
export const RES_ORE = 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;   // 37219
// 37227 makeNoise：G×G 的格點亂數（Float32Array）、平滑插值、三層疊加 .6／.3／.1
export function makeNoise(rand: () => number, G: number): (x: number, y: number) => number {
  const v = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) v[i] = rand();
  const at = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const g = (a: number, b: number) => v[((a % G) + G) % G * G + (((b % G) + G) % G)];
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), sx), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), sx), sy);
  };
  return (x, y) => .6 * at(x, y) + .3 * at(x * 2.13 + 7, y * 2.13 + 3) + .1 * at(x * 4.7 + 13, y * 4.7 + 11);
}

// 53225 genResource：資源圖（0 無／1 油／2 礦）。sd＝存檔的種子；只看格子的地形 t（1 沙、2 草）
export function genResource(sd: number, w: World): Uint8Array {
  const N = w.N, out = new Uint8Array(N * N);
  const noiOil = makeNoise(mulberry32(sd ^ 0x7c2f19), 64), noiOre = makeNoise(mulberry32(sd ^ 0x1a4d63), 64);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, t = w.tiles[i].t;
    let r = 0;
    if (t === 1 || t === 2) {
      if (noiOil(x * .045, y * .045) > .74) r = RES_OIL;
      else if (noiOre(x * .05 + 50, y * .05 + 50) > .74) r = RES_ORE;
    }
    out[i] = r;
  }
  return out;
}

// 66946–66951 讀檔還原耗損：缺欄位＝全零；不是配對、長度不夠、索引出界、量 ≤ 0 的項目略過；索引與量取整（|0），量夾在 RESOURCE_STOCK 以內
export function rdepOfSave(raw: unknown, nn: number): Uint16Array {
  const out = new Uint16Array(nn);
  if (Array.isArray(raw)) for (const pair of raw) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const i = pair[0] | 0, amt = pair[1] | 0;
    if (i >= 0 && i < nn && amt > 0) out[i] = Math.min(amt, RESOURCE_STOCK);
  }
  return out;
}
// 66730 存檔：僅非零格、依格索引由小到大的 [格索引, 已開採量]（全空＝null，66765）
export function rdepPairs(rdep: ArrayLike<number>): number[][] | null {
  const out: number[][] = [];
  for (let i = 0; i < rdep.length; i++) if (rdep[i]) out.push([i, rdep[i]]);
  return out.length ? out : null;
}

export interface ResourceField { resource: Uint8Array; rdep: Uint16Array; depleted?: number[] }   // depleted（D040）：今天耗盡的井的格子索引（stepDay 每天開頭清空、抽取時推進去；不影響抽取量與耗損）

// 55131–55146：一口井今天的抽取量（也把它記進耗損）。kind＝RES_OIL（油井 k49）或 RES_ORE（礦場 k50）；root＝這口井的格子索引（1×1）。回傳抽了多少（沒抽＝0）
export function extractWell(f: ResourceField, root: number, kind: number): number {
  if (f.resource[root] !== kind || f.rdep[root] >= RESOURCE_STOCK) return 0;
  const ext = Math.min(kind === RES_OIL ? OIL_RATE : ORE_RATE, RESOURCE_STOCK - f.rdep[root]);
  f.rdep[root] += ext;
  if (f.rdep[root] >= RESOURCE_STOCK) f.depleted?.push(root);   // D040：這一口今天抽到 240，記下來（day.ts 記成 depleted 事件）
  return ext;
}
