// 垃圾（D020）：實驗線 T445 清運網、T452 清運區、T119／T445 住宅局部垃圾，照原文搬。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。
// 對拍用的設定（tools/lab-configs.mjs fallback）沒有開 __legacySanitation445／__legacySanitation452，所以實驗線走新式：
//   computeSanitation445（38003–38029）：接路的處理設施上線，從它們的路格沿路多源 BFS；人口 ≥500 是正式清運，容量只算上線的
//   rebuildSanitationDistricts452（38057）：路網四鄰 union-find 分清運區，同一座設施貼多段路就合併；上線設施的容量只屬於自己那一區
//   prepareSanitationLoad452（38083–38090）：住宅、有電的工業的垃圾算到離自己最近的那一區，每一區的負載＝需求／容量
//   computeGarbLocal（57697–57733）：住宅垃圾扣分（500 以下舊式距離 >18；500 以上沒清運、超載、太遠）
//   garbDecisionRatio452（38091）：評分讀的垃圾比例
// 只搬模擬讀得到的欄位；畫面、提示、AI、診斷用的統計（客戶數、樣本格、__t445Sanitation……）不搬。
// 事故 T493 關：assetAvailability493＝1（64520）；企業 T489 關：工業就業＝名目 JOBSI（39577 → 39527）。
// 每天怎麼用見 src/sim/day.ts（55256–55285）。純邏輯：不碰 three、DOM、亂數、現實時間（規則 2、3）。
import { clamp, idx, inMap, type Bld, type World } from './lab.ts';
import { JOBSI, residentPopulation488 } from './jobs.ts';

export const DUMP_CAP = 40;                                                           // 37424：每座垃圾場處理容量（T19）
export const SAN_FORMAL_POP445 = 500, SAN_WARN_DIST445 = 12, SAN_LONG_DIST445 = 18, SAN_INF445 = 65535;   // 37977
export const SAN_CAP445: Record<number, number> = { 8: DUMP_CAP, 29: DUMP_CAP * .75, 62: 100, 88: 60, 111: 40 };   // 37978
const DIRV: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];         // 56955（上、右、下、左）

export const isSanFacility445 = (k: number) => Object.prototype.hasOwnProperty.call(SAN_CAP445, k);   // 37984
export const isSanClient445 = (k: number) => k === 1 || k === 2 || k === 3 || k === 33 || k === 34 || k === 105 || k === 106 || k === 127;   // 37985

export interface SanDistrict {
  id: number; roads: number; facilities: number; capacity: number;
  demand: number; spare: number; overflow: number; load: number; clients: number;
  byK: Record<number, number>;
}
export interface SanFacility { root: number; k: number; capacity: number; nominalCapacity: number; online: boolean; district: number }
export interface SanPick { district: number; road: number; dist: number; src: number }
export interface SanAlloc {
  prepared: boolean; totalDemand: number; assignedDemand: number; noRoadDemand: number; deadDemand: number;
  overflow: number; overloadedDistricts: number; worstDistrict: number; worstLoad: number;
}
// 一次重算的結果（實驗線的全域 SAN_DIST445、SAN_SRC445、SAN_ACTIVE445、sanStat445、SAN_NET452、sanDistricts452……）
export interface Sanitation {
  N: number; formal: boolean; totalCap: number; activeCap: number; effectiveCap: number;
  totalFacilities: number; activeFacilities: number; activeByK: Record<number, number>;
  dist: Uint16Array; src: Int32Array; active: Uint8Array;
  allRoots: number[]; activeRoots: number[];
  net: Int32Array; districts: SanDistrict[]; facilities: Map<number, SanFacility>;
  alloc: SanAlloc; rootAlloc: Map<number, SanPick & { demand: number; reason: string }>;
}
const emptyAlloc = (): SanAlloc => ({ prepared: false, totalDemand: 0, assignedDemand: 0, noRoadDemand: 0, deadDemand: 0, overflow: 0, overloadedDistricts: 0, worstDistrict: -1, worstLoad: 0 });   // 38055

// 37986–37993：多格設施的整片佔地四鄰的路格（按佔地格、再按上右下左，去重）
export function sanRoadSeeds445(w: World, rootIdx: number): number[] {
  const N = w.N, out: number[] = [];
  if (rootIdx < 0 || rootIdx >= N * N) return out;
  const b = w.tiles[rootIdx] && w.tiles[rootIdx].bld; if (!b || b.ref) return out;
  const rx = rootIdx % N, ry = (rootIdx / N) | 0, sz = Math.max(1, b.sz || 1);
  for (let fy = 0; fy < sz; fy++) for (let fx = 0; fx < sz; fx++) for (const [dx, dy] of DIRV) {
    const nx = rx + fx + dx, ny = ry + fy + dy; if (!inMap(w, nx, ny)) continue;
    const j = idx(w, nx, ny); if (!w.tiles[j].road || out.includes(j)) continue; out.push(j);
  }
  return out;
}
// 37994–38001：這棟建築（ref 格指回根格）四鄰路格裡距離最近的那一格（同距離取先找到的）
export function sanAccessRoot445(s: Sanitation, w: World, rootIdx: number): { road: number; dist: number; src: number } {
  if (rootIdx < 0 || rootIdx >= w.N * w.N) return { road: -1, dist: SAN_INF445, src: -1 };
  const b = w.tiles[rootIdx] && w.tiles[rootIdx].bld; if (!b) return { road: -1, dist: SAN_INF445, src: -1 };
  if (b.ref) { const r = b.ref as [number, number]; rootIdx = idx(w, r[0], r[1]); }
  let best = -1, bd = SAN_INF445, bs = -1;
  for (const j of sanRoadSeeds445(w, rootIdx)) { const d = s.dist[j]; if (d < bd) { best = j; bd = d; bs = s.src[j]; } }
  return { road: best, dist: bd, src: bs };
}

// 38003–38028：重算清運網（pop＝今天的人口，55246 已算好）；接著 38026 建清運區（T452 沒有回退）
export function computeSanitation445(w: World, pop: number): Sanitation {
  const N = w.N, n = N * N, T = w.tiles;
  const dist = new Uint16Array(n).fill(SAN_INF445), src = new Int32Array(n).fill(-1), active = new Uint8Array(n), q = new Int32Array(n);
  const activeRoots: number[] = [], allRoots: number[] = [], activeByK: Record<number, number> = {};
  let totalCap = 0, activeCap = 0, totalFacilities = 0, activeFacilities = 0, head = 0, tail = 0;
  for (let i = 0; i < n; i++) {                                                         // 38007–38013：接路的處理設施是多源 BFS 的種子
    const b = T[i].bld; if (!b || b.ref || !isSanFacility445(b.k)) continue;
    totalFacilities++; totalCap += SAN_CAP445[b.k]; allRoots.push(i);
    const seeds = sanRoadSeeds445(w, i); if (!seeds.length) continue;
    active[i] = 1; activeFacilities++; activeCap += SAN_CAP445[b.k]; activeByK[b.k] = (activeByK[b.k] || 0) + 1; activeRoots.push(i);
    for (const j of seeds) if (dist[j] !== 0) { dist[j] = 0; src[j] = i; q[tail++] = j; }
  }
  while (head < tail) {                                                                 // 38014–38017
    const cur = q[head++], d = dist[cur], s0 = src[cur], cx = cur % N, cy = (cur / N) | 0;
    for (const [dx, dy] of DIRV) {
      const nx = cx + dx, ny = cy + dy; if (!inMap(w, nx, ny)) continue;
      const j = idx(w, nx, ny); if (!T[j].road) continue;
      const nd = d + 1; if (nd < dist[j]) { dist[j] = nd; src[j] = s0; q[tail++] = j; }
    }
  }
  // 38018–38022 客戶統計：只給畫面，不搬
  const formal = pop >= SAN_FORMAL_POP445, effectiveCap = formal ? activeCap : totalCap;   // 38023
  const s: Sanitation = { N, formal, totalCap, activeCap, effectiveCap, totalFacilities, activeFacilities, activeByK, dist, src, active, allRoots, activeRoots,
    net: new Int32Array(0), districts: [], facilities: new Map(), alloc: emptyAlloc(), rootAlloc: new Map() };
  rebuildSanitationDistricts452(s, w);                                                  // 38026
  return s;
}

// 38057–38070：清運區（38047–38055 的狀態與 union-find）
export function rebuildSanitationDistricts452(s: Sanitation, w: World): void {
  const N = w.N, n = N * N, T = w.tiles;
  const net = new Int32Array(n).fill(-1), parent = new Int32Array(n).fill(-1), rank = new Uint8Array(n);
  const find = (a: number) => { let p = parent[a]; if (p < 0) return -1; while (p !== parent[p]) p = parent[p]; while (a !== p) { const nx = parent[a]; parent[a] = p; a = nx; } return p; };   // 38052
  const union = (a: number, b: number) => {                                             // 38053
    a = find(a); b = find(b); if (a < 0 || b < 0 || a === b) return a;
    let ra = rank[a]; const rb = rank[b]; if (ra < rb) { const t = a; a = b; b = t; ra = rb; }
    parent[b] = a; if (ra === rb) rank[a]++; return a;
  };
  s.districts = []; s.facilities = new Map(); s.rootAlloc = new Map(); s.alloc = emptyAlloc();
  for (let i = 0; i < n; i++) if (T[i].road) parent[i] = i;                            // 38060 A：每一格路是一個節點，四鄰的路合併
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (parent[i] < 0) continue; if (x + 1 < N && parent[i + 1] >= 0) union(i, i + 1); if (y + 1 < N && parent[i + N] >= 0) union(i, i + N); }
  for (const root of s.allRoots) {                                                      // 38063 B：設施貼著的幾段路合併成同一區
    const b = T[root] && T[root].bld; if (!b || b.ref || !isSanFacility445(b.k)) continue;
    const f = sanRoadSeeds445(w, root).filter(j => parent[j] >= 0);                    // 38054 sanFacilityFrontage452
    for (let k = 1; k < f.length; k++) union(f[0], f[k]);
  }
  const rootToDist = new Map<number, number>();                                         // 38065–38066 C：依格號第一次出現的順序編區號（沒有設施的路網也是一區）
  for (let i = 0; i < n; i++) if (parent[i] >= 0) {
    const r = find(i); let d = rootToDist.get(r);
    if (d === undefined) { d = s.districts.length; rootToDist.set(r, d); s.districts.push({ id: d, roads: 0, facilities: 0, capacity: 0, demand: 0, spare: 0, overflow: 0, load: 0, clients: 0, byK: {} }); }
    net[i] = d; s.districts[d].roads++;
  }
  s.net = net;
  for (const root of s.allRoots) {                                                      // 38068：上線設施的容量記到它那一區（事故關：可用率 1）
    const b = T[root] && T[root].bld; if (!b || b.ref || !isSanFacility445(b.k)) continue;
    const baseCap = SAN_CAP445[b.k] || 0, cap = baseCap * 1;
    const f = sanRoadSeeds445(w, root).filter(j => net[j] >= 0), on = !!s.active[root] && f.length > 0 && cap > .01, d = on ? net[f[0]] : -1;
    s.facilities.set(root, { root, k: b.k, capacity: cap, nominalCapacity: baseCap, online: on, district: d });
    if (on && d >= 0 && s.districts[d]) { const q = s.districts[d]; q.capacity += cap; q.facilities++; q.byK[b.k] = (q.byK[b.k] || 0) + 1; }
  }
}

// 38072–38076：一棟建築四鄰的路格裡，離設施最近的（同距離取區號小、再取格號小）
export function sanRootDistrictChoice452(s: Sanitation, w: World, rootIdx: number): SanPick {
  const roads = sanRoadSeeds445(w, rootIdx); if (!roads.length) return { district: -1, road: -1, dist: SAN_INF445, src: -1 };
  const cand: SanPick[] = [];
  for (const j of roads) { const d = s.net[j]; if (d < 0) continue; cand.push({ district: d, road: j, dist: s.dist[j], src: s.src[j] }); }
  if (!cand.length) return { district: -1, road: -1, dist: SAN_INF445, src: -1 };
  cand.sort((a, b) => a.dist - b.dist || a.district - b.district || a.road - b.road); return cand[0];
}
// 38077–38082：一棟的垃圾（住宅：入住人口 ×.05；有電的工業：就業 ×.08，企業關＝名目 JOBSI）
export function sanWasteOfRoot452(w: World, rootIdx: number, recycleMul: number): number {
  const b: Bld | null | undefined = w.tiles[rootIdx] && w.tiles[rootIdx].bld; if (!b || b.ref) return 0;
  recycleMul = Number.isFinite(recycleMul) ? recycleMul : 1; let v = 0;
  if (b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105) v = residentPopulation488(b, () => undefined) * .05;   // 住房關：入住率 1
  else if (b.k === 3 && b.pw) v = (JOBSI[b.lv] || 0) * .08;                         // 39577 → 39527 → 39526（UP_MAX 沒有 3）
  return v * recycleMul;
}
// 38083–38089：每一區的需求、負載
export function prepareSanitationLoad452(s: Sanitation, w: World, recycleMul: number): SanAlloc {
  const n = w.N * w.N; s.rootAlloc = new Map(); const a = emptyAlloc(); a.prepared = true;
  for (const q of s.districts) { q.demand = 0; q.spare = q.capacity; q.overflow = 0; q.load = 0; q.clients = 0; }
  for (let i = 0; i < n; i++) {
    const b = w.tiles[i].bld; if (!b || b.ref) continue;
    const demand = sanWasteOfRoot452(w, i, recycleMul); if (demand <= 0) continue;
    a.totalDemand += demand;
    const pick = sanRootDistrictChoice452(s, w, i);
    if (pick.district < 0) { a.noRoadDemand += demand; s.rootAlloc.set(i, { ...pick, demand, reason: 'no-road' }); continue; }
    const q = s.districts[pick.district]; q.demand += demand; q.clients++; a.assignedDemand += demand;
    const dead = q.capacity <= 0 || pick.dist >= SAN_INF445;
    if (dead) a.deadDemand += demand;
    s.rootAlloc.set(i, { ...pick, demand, reason: dead ? 'dead-network' : 'ok' });
  }
  let worst = -1, worstLoad = 0, overflow = 0, overN = 0;
  for (const q of s.districts) {
    q.spare = Math.max(0, q.capacity - q.demand); q.overflow = Math.max(0, q.demand - q.capacity);
    q.load = q.capacity > 0 ? q.demand / q.capacity : (q.demand > 0 ? Infinity : 0);
    overflow += q.overflow;
    if (q.capacity > 0 && q.demand > q.capacity + 1e-9) { overN++; if (q.load > worstLoad) { worstLoad = q.load; worst = q.id; } }
  }
  a.overflow = overflow; a.overloadedDistricts = overN; a.worstDistrict = worst; a.worstLoad = worstLoad; s.alloc = a;
  return a;
}
// 38090–38091：評分讀的垃圾比例（最壞那一區的負載，或斷網就當 2，或全城比例）
export function sanWorstDistrict452(s: Sanitation, w: World, recycleMul = 1): SanDistrict | null {
  if (!s.formal) return null; if (!s.alloc.prepared) prepareSanitationLoad452(s, w, recycleMul);
  return s.alloc.worstDistrict >= 0 ? s.districts[s.alloc.worstDistrict] : null;
}
export function garbDecisionRatio452(s: Sanitation, w: World, garbRatio: number, recycleMul = 1): number {
  const wd = sanWorstDistrict452(s, w, recycleMul); if (wd) return Math.max(garbRatio, wd.load);
  if (s.formal && s.alloc.deadDemand > 0) return Math.max(garbRatio, 2);
  return garbRatio;
}

// 住宅的清運狀況（sanitationAt452 38094–38101 的 building 那一支；建築卡與 computeGarbLocal 用）
export interface SanAt { district: number; capacity: number; demand: number; load: number; reachable: boolean; dist: number; src: number; reason: string }
export function sanitationAtRoot452(s: Sanitation, w: World, rootIdx: number): SanAt {
  const pick = s.rootAlloc.get(rootIdx) || sanRootDistrictChoice452(s, w, rootIdx), q = pick.district >= 0 ? s.districts[pick.district] : null;
  let reason = 'ok';
  if (pick.district < 0) reason = 'no-road';
  else if (!q || q.capacity <= 0 || pick.dist >= SAN_INF445) reason = 'dead-network';
  else if (q.load > 1) reason = 'capacity';
  else if (pick.dist > SAN_LONG_DIST445) reason = 'far';
  else if (pick.dist > SAN_WARN_DIST445) reason = 'warn';
  return { district: pick.district, capacity: q ? q.capacity : 0, demand: q ? q.demand : 0, load: q ? q.load : 0, reachable: pick.dist < SAN_INF445, dist: pick.dist, src: pick.src, reason };
}

// tick() 55257–55278 那一段：垃圾量、清運網、全城比例、（500 以上）清運區負載、（500 以下）全城容量池懲罰、住宅局部扣分。
// pop、jobsI＝今天的（55246、55251 之後，企業關＝四捨五入後的名目值）；cityHappy＝55254 算的，小城懲罰時重算（55274）。
// 55262–55266 資源回收廠產貨物：貨物是經濟系統，沒搬；55275、55278 的提示不搬
export function garbageDay(w: World, tickBld: readonly number[], pop: number, jobsI: number, cityHappy: number, recycleMul = 1) {
  const garbage = (pop * .05 + jobsI * .08) * recycleMul;                  // 55258
  const san = computeSanitation445(w, pop), garbCap = san.effectiveCap;     // 55259：500 人以下算全部設施，以上只算接路的
  const garbRatio = garbCap > 0 ? clamp(garbage / garbCap, 0, 2) : 2;      // 55260
  if (san.formal) prepareSanitationLoad452(san, w, recycleMul);            // 55261
  let garbPen409 = 0;                                                      // 55267：小城的全城懲罰；正式清運時是超載扣分的住宅平均（55278）
  if (!san.formal && garbage > 0 && garbRatio > 1) {                       // 55268–55275：小城全城容量不夠，每一棟住宅一樣扣
    const pen = (garbRatio - 1) * .15; garbPen409 = pen;
    let hs = 0, hn = 0;
    for (const i of tickBld) { const b = w.tiles[i].bld; if (!b || b.k !== 1) continue; b.h = clamp((b.h as number) - pen, .05, 1); hs += b.h; hn++; }
    cityHappy = hn ? hs / hn : cityHappy;
  }
  const loc = computeGarbLocal(san, w, recycleMul);                        // 55277：住宅局部扣分（距離、沒清運、區超載）
  if (san.formal) garbPen409 = loc.penAvg || 0;                            // 55278
  return { garbage, garbCap, garbRatio, garbPen409, san, loc, cityHappy };
}

// 57697–57722：住宅（k1）局部垃圾扣分，直接改 b.h。garbLocal（57705）只給測試讀，不搬。
// 500 以下：從垃圾場根格、焚化廠每一格（含 ref）四鄰的路起算沿路 BFS，住宅四鄰路的最短距離 >18（含不貼路）就 −.045。
// 500 以上：沒有清運區、區裡沒容量、到不了 −.06；區的負載 >1 −(負載−1)×.15；距離 >18 再 −.045。penAvg＝有超載扣分的住宅的平均扣分
export function computeGarbLocal(s: Sanitation, w: World, recycleMul = 1): { far: number; unserved: number; warn: number; penAvg: number } {
  const N = w.N, n = N * N, T = w.tiles;
  let far = 0, unserved = 0, warn = 0;
  if (!s.formal) {
    const dist = garbLegacyDist(w);
    for (let i = 0; i < n; i++) {
      const b = T[i].bld; if (!b || b.k !== 1) continue;
      if (garbLegacyAt(w, dist, i) > 18) { b.h = clamp((b.h as number) - .045, .05, 1); far++; }
    }
    return { far, unserved: 0, warn: 0, penAvg: 0 };
  }
  if (!s.alloc.prepared) prepareSanitationLoad452(s, w, recycleMul);
  let capPenSum = 0, capPenN = 0;
  for (let i = 0; i < n; i++) {
    const b = T[i].bld; if (!b || b.k !== 1) continue;
    let r = i; if (b.ref) { const rf = b.ref as [number, number]; r = idx(w, rf[0], rf[1]); }   // sanitationAt452 38096：ref 格指回根格
    const st = T[r].road ? { district: s.net[r], dist: s.dist[r] } : sanitationAtRoot452(s, w, r), q = st.district >= 0 ? s.districts[st.district] : null;   // 38097：路格走路那一支
    if (st.district < 0 || !q || q.capacity <= 0 || st.dist >= SAN_INF445) { b.h = clamp((b.h as number) - .06, .05, 1); unserved++; continue; }
    const capPen = q.load > 1 ? (q.load - 1) * .15 : 0;
    if (capPen > 0) { b.h = clamp((b.h as number) - capPen, .05, 1); capPenSum += capPen; capPenN++; }
    if (st.dist > SAN_LONG_DIST445) { b.h = clamp((b.h as number) - .045, .05, 1); far++; }
    else if (st.dist > SAN_WARN_DIST445) warn++;
  }
  return { far, unserved, warn, penAvg: capPenN ? capPenSum / capPenN : 0 };
}

// 57701–57704：500 人以下的舊式距離場（T119）：垃圾場根格、焚化廠每一格（含 ref）四鄰的路是 0，沿路 BFS；到不了＝9999
export function garbLegacyDist(w: World): Uint16Array {
  const N = w.N, n = N * N, T = w.tiles, dsrc: number[] = [];
  for (let i = 0; i < n; i++) { const b = T[i].bld; if (b && ((!b.ref && b.k === 8) || b.k === 62)) dsrc.push(i); }
  const dist = new Uint16Array(n).fill(9999), q: number[] = [];
  for (const di of dsrc) { const dx0 = di % N, dy0 = (di / N) | 0; for (const [dx, dy] of DIRV) { const nx = dx0 + dx, ny = dy0 + dy; if (inMap(w, nx, ny)) { const j = idx(w, nx, ny); if (T[j].road && dist[j] > 0) { dist[j] = 0; q.push(j); } } } }
  let head = 0;
  while (head < q.length) { const cur = q[head++], d = dist[cur], cx = cur % N, cy = (cur / N) | 0; for (const [dx, dy] of DIRV) { const nx = cx + dx, ny = cy + dy; if (!inMap(w, nx, ny)) continue; const j = idx(w, nx, ny); if (T[j].road && dist[j] > d + 1) { dist[j] = d + 1; q.push(j); } } }
  return dist;
}
// 57705：住宅四鄰路格的最短距離（不貼路＝9999）
export function garbLegacyAt(w: World, dist: Uint16Array, i: number): number {
  const N = w.N, x = i % N, y = (i / N) | 0; let bd = 9999;
  for (const [dx, dy] of DIRV) { const nx = x + dx, ny = y + dy; if (inMap(w, nx, ny)) { const j = idx(w, nx, ny); if (w.tiles[j].road) bd = Math.min(bd, dist[j]); } }
  return bd;
}
