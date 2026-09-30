// 通勤與壅堵（D027）：實驗線 T141 通勤叢集、T129 道路負載、T130 動態地價 @ d23c18d（index.html 行號）。
// 沒有亂數。每 4 天算一次「住宅→最近就業區」的路徑（每 6×6 格取第一棟住宅當代表），其餘天沿用快取；每天把路徑走過的格子累加成當天的車流，
// 道路負載＝昨天的 ×.85＋今天的 ×.15；負載超過容量的道路是「過載」，半徑 2 內的住宅幸福 −.03／格（上限 −.15）、地價 −12／格（上限 −50）。
// 回退設定關 T491（__noMobility491），所以通勤只有舊式（computeCommuteLegacyT141）那一支；ACCESS468（T468 公交可達性）本線全 0，守衛用注入的值蓋它。
// 沒搬：畫面幀迴圈裡小車的 roadPass++（57016，本線沒有小車）、commuteLoad／commutePass（55005，純觀察）、T491 行動力、T462 道路階層。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { clamp, inMap, type Tile, type World } from './lab.ts';

export const ROAD_CAP = [1, 2, 4, 8, 16];                                                          // 37431：依 rc 1–5 索引
export const COMMUTE_PERIOD = 4, COMMUTE_CELL = 6, COMMUTE_FAR = 20, COMMUTE_PEN_STEP = .012, COMMUTE_PEN_MAX = .18, COMMUTE_PEN_UNREACH = .30, COMMUTE_TRIP_W = 1;   // 37435–37441
export const isCommuteDay = (day: number): boolean => day % COMMUTE_PERIOD === 0;                    // 54991：今天（已經加過 1）要不要重算通勤
export const DIRV: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];              // 56955（上、右、下、左）
const DX = DIRV.map(d => d[0]), DY = DIRV.map(d => d[1]);                                           // 內層迴圈用的平的版本（順序＝DIRV，不用每一步拆陣列）
const HOUSE_KINDS = [1, 127, 33, 105];                                                             // 住宅、社宅、住宅塔、巨廈（57756、57785 的 [1,127,33,105]）

// 50948：道路容量（依 rc；高架 ×1.28、立交 ×1.55；取兩位小數、至少 1）。不是道路回 0
export function roadCap475(t: Tile | undefined | null): number {
  if (!t || !t.road) return 0;
  const base = ROAD_CAP[Math.max(0, Math.min(4, (t.rc || 2) - 1))] || 1, m = (t.fly475 ? 1.28 : 1) * (t.ix475 ? 1.55 : 1);
  return Math.max(1, Math.round(base * m * 100) / 100);
}

// 57733–57790：通勤叢集（舊式 T141）。commutePenalty 先清、就業區＝所有 k2、k3 的根格（不看有沒有電）；沒有就業區就直接回（全零、沒有叢集）。
// 多源 BFS（源＝就業區四鄰的道路格，DIRV 順序）算每個道路格到最近就業區的路距 dist 與回溯指標 prev；再逐格（y 外圈、x 內圈）掃住宅類根格：
// 四鄰道路裡 dist 最小的（同距離取先掃到的）當入口；沒有入口或 dist≥9999＝不可達（.30）；dist>20＝min(.18, (dist−20)×.012)；
// 每 6×6 格的粗網格塊第一棟住宅是代表：代表不可達，整塊沒有路徑；否則沿 prev 回溯到就業區（最多 600 步）存成一條路徑。
// 最後 T468：ACCESS468>0 的住宅打折（≥80 的不可達解除、罰改成 min(.12, .30×mul)；其餘罰×mul）。回傳叢集路徑（每條是格索引，從入口到就業區）
// bldIdx（選填）：有建築的格索引，升序（stepDay 的 tickBld）。給了就只掃這些格：就業區、住宅、T468 三段都只看建築格，順序＝整圖逐格掃（y 外圈、x 內圈＝索引升序），結果逐位相同（守衛核對）；
// 沒給就整圖掃（守衛與工具用）。暫存陣列（路距、回溯指標、佇列、不可達旗）整個模組共用一份、每次呼叫開頭清乾淨：不留跨呼叫的狀態，結果不看它
let scratch: { nn: number; unreach: Uint8Array; dist: Uint16Array; prev: Int32Array; q: Int32Array } | null = null;
export function computeCommuteLegacy(w: World, commutePenalty: Float32Array, access: ArrayLike<number>, bldIdx?: ArrayLike<number>): number[][] {
  const N = w.N, nn = N * N, tiles = w.tiles, clusters: number[][] = [];
  commutePenalty.fill(0);
  if (!scratch || scratch.nn !== nn) scratch = { nn, unreach: new Uint8Array(nn), dist: new Uint16Array(nn), prev: new Int32Array(nn), q: new Int32Array(nn) };
  const { unreach, dist, prev, q } = scratch, cnt = bldIdx ? bldIdx.length : nn;
  unreach.fill(0);
  const dsrc: number[] = [];
  for (let n = 0; n < cnt; n++) { const i = bldIdx ? bldIdx[n] : n, b = tiles[i].bld; if (b && !b.ref && (b.k === 2 || b.k === 3)) dsrc.push(i); }
  if (!dsrc.length) return clusters;                                   // 無就業區：全部維持零（不變量）
  dist.fill(9999); prev.fill(-1);
  let head = 0, tail = 0;                                              // 佇列：每個道路格最多進一次（路距單調不降），長度不會超過 nn
  for (const si of dsrc) {
    const sx0 = si % N, sy0 = (si / N) | 0;
    for (let k = 0; k < 4; k++) { const nx = sx0 + DX[k], ny = sy0 + DY[k]; if (inMap(w, nx, ny)) { const j = ny * N + nx; if (tiles[j].road && dist[j] > 0) { dist[j] = 0; q[tail++] = j; } } }
  }
  while (head < tail) {
    const cur = q[head++], d = dist[cur], cx = cur % N, cy = (cur / N) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = cx + DX[k], ny = cy + DY[k];
      if (!inMap(w, nx, ny)) continue;
      const j = ny * N + nx;
      if (tiles[j].road && dist[j] > d + 1) { dist[j] = d + 1; prev[j] = cur; q[tail++] = j; }
    }
  }
  const blkPerRow = Math.ceil(N / COMMUTE_CELL), blkSeen = new Uint8Array(blkPerRow * blkPerRow);
  for (let n = 0; n < cnt; n++) {
    const i = bldIdx ? bldIdx[n] : n, b = tiles[i].bld;
    if (!b || b.ref || !HOUSE_KINDS.includes(b.k)) continue;
    let bd = 9999, broad = -1;
    const x = i % N, y = (i / N) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (!inMap(w, nx, ny)) continue;
      const j = ny * N + nx;
      if (tiles[j].road && dist[j] < bd) { bd = dist[j]; broad = j; }
    }
    if (broad < 0 || bd >= 9999) { unreach[i] = 1; commutePenalty[i] = COMMUTE_PEN_UNREACH; }
    else if (bd > COMMUTE_FAR) commutePenalty[i] = Math.min(COMMUTE_PEN_MAX, (bd - COMMUTE_FAR) * COMMUTE_PEN_STEP);
    const blk = ((x / COMMUTE_CELL) | 0) * blkPerRow + ((y / COMMUTE_CELL) | 0);   // 叢集鍵：粗網格分塊，塊內首個住宅格為代表
    if (blkSeen[blk]) continue;
    blkSeen[blk] = 1;
    if (broad < 0 || bd >= 9999) continue;                               // 代表格本身不可達，該叢集無路徑可貢獻（不進叢集）
    const path: number[] = [];
    let c = broad, steps = 0;
    while (c !== -1 && steps < 600) { path.push(c); c = prev[c]; steps++; }
    clusters.push(path);
  }
  // T468：真正存在的多模式可達性降低長距離道路通勤懲罰；低可達性不白送幸福
  for (let n = 0; n < cnt; n++) {
    const i = bldIdx ? bldIdx[n] : n, b = tiles[i].bld; if (!b || b.ref || !HOUSE_KINDS.includes(b.k)) continue;
    const a = access[i] || 0; if (a <= 0) continue;
    const mul = clamp(1 - a / 220, .35, .88);
    if (unreach[i] && a >= 80) { unreach[i] = 0; commutePenalty[i] = Math.min(.12, COMMUTE_PEN_UNREACH * mul); }
    else commutePenalty[i] *= mul;
  }
  return clusters;
}

// tick() 54991–54995：每 4 天（day＝已經加過 1 的今天）重算通勤；每天把叢集路徑走過的格子 +1；道路負載＝昨天 ×.85＋今天 ×.15，累加器歸零。
// 回傳今天用的叢集（重算了就是新的，否則原樣）。roadLoad 是 Float32Array（逐格先乘再加、存回 32 位元）、roadPass 是 Uint16Array（滿 65536 繞回）。bldIdx＝有建築的格索引（computeCommuteLegacy 只掃這些，選填）
export interface TrafficGrids { commutePenalty: Float32Array; ACCESS468: ArrayLike<number>; roadLoad: Float32Array; roadPass: Uint16Array }
export function trafficStep(day: number, w: World, g: TrafficGrids, clusters: number[][], bldIdx?: ArrayLike<number>): number[][] {
  if (isCommuteDay(day)) clusters = computeCommuteLegacy(w, g.commutePenalty, g.ACCESS468, bldIdx);
  for (const path of clusters) for (const j of path) g.roadPass[j] += COMMUTE_TRIP_W;
  const nn = g.roadLoad.length;
  for (let i = 0; i < nn; i++) { g.roadLoad[i] = g.roadLoad[i] * .85 + g.roadPass[i] * .15; g.roadPass[i] = 0; }
  return clusters;
}

// 52946 congestNear(x,y,2) 一次算好：jam[格]＝Chebyshev 半徑 2 內「過載道路」（road 且 roadLoad>roadCap475）的格數（邊界裁剪）；回傳過載道路格數。
// 住宅幸福（55175）與動態地價（53098）共用；過載格通常極少（空車城恆 0），所以從過載格往外蓋印，不逐格掃 25 鄰
export function jamCounts(w: World, roadLoad: Float32Array, jam: Uint8Array): number {
  jam.fill(0);
  const N = w.N, tiles = w.tiles;
  let cells = 0;
  for (let i = 0; i < roadLoad.length; i++) {
    if (roadLoad[i] === 0) continue;                                     // 多數格恆 0，先廉價跳過（53105）
    const t = tiles[i];
    if (!(t.road && roadLoad[i] > roadCap475(t))) continue;
    cells++;
    const jx = i % N, jy = (i / N) | 0;
    for (let dy = -2; dy <= 2; dy++) {
      const y = jy + dy; if (y < 0 || y >= N) continue;
      for (let dx = -2; dx <= 2; dx++) { const x = jx + dx; if (x < 0 || x >= N) continue; jam[y * N + x]++; }
    }
  }
  return cells;
}

// 38269 logisticsEfficiency481 的統計半邊：路格的平均負載比（每格封頂 2）與過載比例（負載比 > 1）。roads＝tickRoad（所有道路格，升序）
export interface RoadStats { avg: number; over: number }
export function roadStatsOf(w: World, roads: readonly number[], roadLoad: ArrayLike<number>): RoadStats {
  let sum = 0, n = 0, over = 0;
  for (const i of roads) {
    const t = w.tiles[i];
    if (!t || !t.road) continue;
    const cap = roadCap475(t) || 1, r = (roadLoad[i] || 0) / cap;
    sum += Math.min(2, r); n++; if (r > 1) over++;
  }
  return { avg: n ? sum / n : 0, over: n ? over / n : 0 };
}

// 逐位元組的 FNV-1a（給 simHash 與守衛：Float32Array 的每個 32 位元都看得到）
export function hashBytes(a: ArrayBufferView): number {
  const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let x = 2166136261;
  for (let i = 0; i < u.length; i++) { x ^= u[i]; x = Math.imul(x, 16777619); }
  return x >>> 0;
}
