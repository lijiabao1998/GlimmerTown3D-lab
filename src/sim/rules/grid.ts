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
