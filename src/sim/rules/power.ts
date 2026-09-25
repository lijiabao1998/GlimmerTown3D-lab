// 舊版供電（D009）：實驗線 computePower 52518 的快路徑（沒有變電所時）＋ tick() 55151 的 __legacyPower450 那一支。
// 電廠從佔地四周的道路（或手工配電線）起算，沿路 BFS 最多 90 格，走到的道路格帶電（rp）；
// 住商工「兩格內有帶電道路、且全城容量還沒用完」才有電（按建築索引順序，一棟佔 1 份容量）。
// 沒搬：變電所接力（T444 relay path）、T471 分時調度（實驗線預設走它）、事故降載（T493）。有變電所的城市這裡回報 relay 不處理。
import { idx, inMap, type Bld, type Tile, type World } from './lab.ts';
import { hasRoadNear } from './grid.ts';

export const POWER_HOPS444 = 90;                                                          // 52453
export const POW_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];                               // 52452
export const POWER_SOURCE_K450 = new Set([5, 25, 26, 58, 59, 60, 62, 140, 141, 142, 143, 144, 145, 150]);   // 52469
export const POWER_STARTER_K471 = new Set([5, 58, 59, 60, 62, 140, 141, 142, 145, 150]);                    // 52454
export const POWER_SEASON_MULT = [1, 0.9, 1, 0.85];                                       // 38209 春夏秋冬
const SUBSTATION_K = [128, 148, 161, 162];

// 52471
export function powerCapacity450(b: Bld | null | undefined, ecoReg: boolean) {
  if (!b) return 0; const lv = b.lv || 1;
  if (b.k === 5) return 75 + (lv - 1) * 30 + (ecoReg ? 5 : 0);
  if (b.k === 25) return 25 + (lv - 1) * 10;
  if (b.k === 26) return 32 + (lv - 1) * 12;
  if (b.k === 58) return 300 + (lv - 1) * 45;
  if (b.k === 59) return 130 + (lv - 1) * 20;
  if (b.k === 60) return 60 + (lv - 1) * 10;
  if (b.k === 62) return 80 + (lv - 1) * 10;
  if (b.k === 140) return 140;
  if (b.k === 141) return 55;
  if (b.k === 142) return 75;
  if (b.k === 143) return 110;
  if (b.k === 144) return 135;
  if (b.k === 145) return 120;
  if (b.k === 150) return 35;
  return 0;
}
export const powerCarrier475 = (t: Tile | undefined) => !!(t && (t.road || t.lv475 || t.ud475));   // 50950
// 52489：多格電源的整圈佔地周界上的導體格（上下兩排、再左右兩列）
export function powerFrontageRoads450(w: World, rootIdx: number) {
  if (rootIdx < 0 || rootIdx >= w.N * w.N) return [];
  const b = w.tiles[rootIdx] && w.tiles[rootIdx].bld; if (!b || b.ref) return [];
  const x = rootIdx % w.N, y = (rootIdx / w.N) | 0, sz = Math.max(1, b.sz || 1);
  const out: number[] = [], seen = new Set<number>();
  const add = (xx: number, yy: number) => { if (!inMap(w, xx, yy)) return; const j = idx(w, xx, yy), t = w.tiles[j]; if (!powerCarrier475(t) || seen.has(j)) return; seen.add(j); out.push(j); };
  for (let dx = 0; dx < sz; dx++) { add(x + dx, y - 1); add(x + dx, y + sz); }
  for (let dy = 0; dy < sz; dy++) { add(x - 1, y + dy); add(x + sz, y + dy); }
  return out;
}

// 52518 快路徑：清掉 rp、加總容量、從電源 BFS 讓道路帶電；回傳名目容量（還沒乘季節）
export function computePower(w: World, ecoReg = false) {
  const n = w.N * w.N;
  let plants = 0, cap = 0, subN = 0, roadN = 0;
  const roots: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = w.tiles[i]; t.rp = false; if (t.road) roadN++; const b = t.bld; if (!b || b.ref) continue;
    const av = 1;
    if (POWER_SOURCE_K450.has(b.k)) { cap += powerCapacity450(b, ecoReg) * av; if (POWER_STARTER_K471.has(b.k) && av > .02) plants++; }
    if (POWER_STARTER_K471.has(b.k) && av > .02) roots.push(i);
    else if (SUBSTATION_K.includes(b.k)) subN++;
  }
  if (!plants) return { cap: 0, poweredRoads: 0, roadN, relay: false };
  if (subN > 0) return { cap, poweredRoads: 0, roadN, relay: true };   // 變電所接力沒搬
  const seen = new Uint8Array(n), remain = new Int16Array(n).fill(-1), q = new Int32Array(n);
  let head = 0, tail = 0, poweredRoads = 0;
  for (const src of roots) for (const j of powerFrontageRoads450(w, src)) if (!seen[j]) { seen[j] = 1; remain[j] = POWER_HOPS444; q[tail++] = j; }
  while (head < tail) {
    const j = q[head++], rem = remain[j], x = j % w.N, y = (j / w.N) | 0;
    if (w.tiles[j].road && !w.tiles[j].rp) { w.tiles[j].rp = true; poweredRoads++; }
    if (rem <= 0) continue;
    for (const [dx, dy] of POW_DIR) { const nx = x + dx, ny = y + dy; if (!inMap(w, nx, ny)) continue; const nj = idx(w, nx, ny); if (powerCarrier475(w.tiles[nj]) && !seen[nj]) { seen[nj] = 1; remain[nj] = rem - 1; q[tail++] = nj; } }
  }
  return { cap, poweredRoads, roadN, relay: false };
}
// 當日可用容量＝floor(名目 × 季節係數)（tick 54997）
export const powerCap = (nominal: number, season: number) => Math.floor(nominal * POWER_SEASON_MULT[season]);

// 55151–55153：按建築索引順序給住商工（含社宅 k127）通電；回傳用掉的份數
export function assignPower(w: World, order: readonly number[], cap: number) {
  let powered = 0;
  for (const i of order) {
    const b = w.tiles[i].bld;
    if (!b || b.ref) continue;
    if (b.k > 3 && b.k !== 127) continue;
    const near = hasRoadNear(w, i % w.N, (i / w.N) | 0, 2, true);
    b.pw = near && powered < cap;
    if (b.pw) powered++;
  }
  return powered;
}
