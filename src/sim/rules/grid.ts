// 鄰域查詢（D009）：出處見各函式行號（實驗線 index.html @ d23c18d）
import { clamp, idx, inMap, type Tile, type World } from './lab.ts';

// 52934
export function countNear(w: World, x: number, y: number, r: number, pred: (t: Tile) => unknown) {
  let n = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (!inMap(w, nx, ny)) continue;
    if (pred(w.tiles[idx(w, nx, ny)])) n++;
  }
  return n;
}
// countNear 的快速版（D011，效能）：整張先做一次累加表，之後每次查詢 O(1)；結果跟 countNear 逐格數的同一個整數
// （同樣是(2r+1)² 的方框、裁在地圖裡）。只在格子不變的一段裡用（例如 tick 的住宅迴圈），格子一改就要重建。守衛逐格核對。
// 每一格給 0 或 1（flag(t) 為真就是 1）；整張都是 0 時不配置、查詢一律 0
export function nearCounter(w: World, flag: (t: Tile) => unknown) {
  const N = w.N, M = N + 1;
  let S: Int32Array | null = null;                                        // S[(y+1)M+(x+1)]＝左上角到 (x,y) 的個數
  for (let y = 0; y < N; y++) {
    let row = 0;
    for (let x = 0; x < N; x++) {
      if (flag(w.tiles[y * N + x])) row++;
      if (row && !S) S = new Int32Array(M * M);
      if (S) S[(y + 1) * M + x + 1] = S[y * M + x + 1] + row;
    }
  }
  const T = S;
  return T ? (x: number, y: number, r: number) => {
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(N - 1, x + r) + 1, y1 = Math.min(N - 1, y + r) + 1;
    return x1 <= x0 || y1 <= y0 ? 0 : T[y1 * M + x1] - T[y0 * M + x1] - T[y1 * M + x0] + T[y0 * M + x0];
  } : () => 0;
}
// 51181：半徑 r 內道路格的最高等級
export function getMaxRoadClass(w: World, x: number, y: number, r = 1) {
  let mx = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (!inMap(w, nx, ny)) continue;
    const t = w.tiles[idx(w, nx, ny)];
    if (t.road && (t.rc as number) > mx) mx = t.rc as number;
  }
  return mx;
}
// 52420：半徑 r 內有沒有路；needPow＝要帶電的路，noHw＝高速不算（分區生長只認普通路，T21）
export function hasRoadNear(w: World, x: number, y: number, r: number, needPow?: boolean, noHw?: boolean) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (!inMap(w, nx, ny)) continue;
    const t = w.tiles[idx(w, nx, ny)];
    if (t.road && (!noHw || !t.hw) && (!needPow || t.rp)) return true;
  }
  return false;
}
// 53167：都市織理＝住商工＋摩天樓＋巨廈
export const URBAN406 = (k: number) => k <= 3 || k === 33 || k === 34 || k === 105 || k === 106;
// 53175：7×7 內都市建築數 → 0..1
export function urbanDens406(w: World, x: number, y: number) {
  let n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const nx = x + dx, ny = y + dy;
    if (!inMap(w, nx, ny)) continue;
    const nb = w.tiles[idx(w, nx, ny)].bld;
    if (nb && URBAN406(nb.k)) n++;
  }
  return clamp((n - 5) / 38, 0, 1);
}
