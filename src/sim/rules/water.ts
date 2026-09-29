// 供水（D019）：實驗線 T448 舊式供水網，照原文搬。出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。
// 對拍用的設定（tools/lab-configs.mjs fallback）開著 __legacyWater449，實驗線的 computeWater 走舊式分支（53300–53303），只用下面兩支：
//   computeWaterLegacy449（53267–53299）：容量＝水塔數 × 80＋淡化廠根格數 × 80；從水源四鄰的水管格沿水管 BFS 最多 90 步，走到的水管格 wr＝true
//   hasWaterNear（53581–53588）：半徑 r 的方框裡有 wr 的格
// 每天怎麼用見 src/sim/day.ts（55010 wCap、55157 逐棟 wa）。純邏輯：不碰 three、DOM、亂數、現實時間（規則 2、3）。
import { idx, inMap, type World } from './lab.ts';

export const WATER_TOWER_CAP = 80;   // 37425：每座水塔供水建築數（T31）
export const DESAL_CAP = 80;         // 39655：淡化廠
const DIR4: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 53279、53291 的順序（上、右、下、左）

// 53267–53299：重算每一格的 wr，回傳容量。淡化廠 2×2：每一格（含 ref 格，k 也是 129）都能接水管，容量只在根格算一次（53271、53278）
export function computeWaterLegacy449(w: World): number {
  const N = w.N, T = w.tiles, n = N * N;
  let towers = 0, desalRoots = 0;
  for (let i = 0; i < n; i++) {                                                 // 53269–53272：先全部清成 false
    const b = T[i].bld; T[i].wr = false;
    if (b && !b.ref) { if (b.k === 10) towers++; else if (b.k === 129) desalRoots++; }
  }
  if (!towers && !desalRoots) return 0;                                         // 53273
  const seen = new Uint8Array(n), q: [number, number, number][] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {                     // 53276–53285：水源四鄰的水管格入隊（距離 0）
    const t = T[idx(w, x, y)];
    if (!(t.bld && (t.bld.k === 10 || t.bld.k === 129))) continue;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (inMap(w, nx, ny) && T[idx(w, nx, ny)].wp && !seen[idx(w, nx, ny)]) { seen[idx(w, nx, ny)] = 1; q.push([nx, ny, 0]); }
    }
  }
  let head = 0;
  while (head < q.length) {                                                     // 53286–53297：沿水管四鄰走，距離到 90 就不再往外
    const [x, y, d] = q[head++];
    T[idx(w, x, y)].wr = true;
    if (d >= 90) continue;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(w, nx, ny)) continue;
      const j = idx(w, nx, ny);
      if (T[j].wp && !seen[j]) { seen[j] = 1; q.push([nx, ny, d + 1]); }
    }
  }
  return towers * WATER_TOWER_CAP + desalRoots * DESAL_CAP;                    // 53298
}

// 53581–53588
export function hasWaterNear(w: World, x: number, y: number, r = 2): boolean {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (!inMap(w, nx, ny)) continue;
    if (w.tiles[idx(w, nx, ny)].wr) return true;
  }
  return false;
}

// 逐棟有沒有水（tick() 主迴圈 55050 起：55054 跳過 ref 格；55150 只看住商工與社宅；55157 舊式、55160 計數）。
// 實驗線跟供電（55155–55156）在同一個迴圈裡、同一棟先給電再給水；水只看這一棟自己的電，跟別棟的電無關，
// 所以本線先整輪給電（src/sim/rules/power.ts assignPower）再整輪給水，每一棟的結果、計數的順序都一樣（照建築索引）
export function assignWater(w: World, order: readonly number[], wCap: number): number {
  let watered = 0;
  for (const i of order) {
    const b = w.tiles[i].bld;
    if (!b || b.ref) continue;                                                  // 55054
    if (b.k > 3 && b.k !== 127) continue;                                       // 55150
    b.wa = !!(b.pw && hasWaterNear(w, i % w.N, (i / w.N) | 0, 2) && watered < wCap);   // 55157
    if (b.wa) watered++;                                                        // 55160
  }
  return watered;
}
