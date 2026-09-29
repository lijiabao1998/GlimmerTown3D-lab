// 垃圾與清運（D020）：實驗線 T445 城市清運脈絡＋T452 清運分區，照原文搬。出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。
// 對拍用的設定（tools/lab-configs.mjs fallback）沒有關 __legacySanitation445／452，實驗線走新式清運，所以照新式搬：
//   常數 37977–37982（SAN_CAP445 37978）；sanRoadSeeds445 37986；sanAccessRoot445 37994；computeSanitation445 38003–38028（多源 BFS）；
//   T452：sanFind／sanUnion 38052–38053、rebuildSanitationDistricts452 38057–38070（道路四鄰 union-find 分區、設施容量只屬於自己那一區）、
//   sanRootDistrictChoice452 38072、sanWasteOfRoot452 38077、prepareSanitationLoad452 38083–38089、sanWorstDistrict452、garbDecisionRatio452 38091；
//   computeGarbLocal 57697–57722（500 人前走舊 T119 口徑，500 人以上走 T452 區負載）；每天的順序 55256–55278（見 src/sim/day.ts，garbageStep）。
// （行號以 tools/lab-garbage.mjs 摘的原文為準——D020 卡上、施工中寫的幾處差了幾行，見卡面「卡面更正」。）
// 沒搬（見卡面「不做什麼」）：資源回收廠把垃圾變貨物（貨物是經濟系統）、回收政策 pol.recycle（恆 1）、事故 T493 的可用率（關，恆 1，52…assetAvailability493 64520）、
// 提示 toast、垃圾車視覺、AI 市長。狀態全在 SanState，每天整張重算（實驗線 55259 sanDirty445＝true 再算），不進存檔。
// 純邏輯：不碰 three、DOM、亂數、現實時間（規則 2、3）。
import { clamp, idx, inMap, type World } from './lab.ts';
import { residentPopulation488, JOBSI } from './jobs.ts';

export const DUMP_CAP = 40;                                          // 37424：每座垃圾場處理容量（T19）
export const SAN_FORMAL_POP = 500, SAN_WARN_DIST = 12, SAN_LONG_DIST = 18, SAN_INF = 65535;   // 37977
export const SAN_CAP: Readonly<Record<number, number>> = { 8: DUMP_CAP, 29: DUMP_CAP * .75, 62: 100, 88: 60, 111: 40 };   // 37978：垃圾場、回收中心、焚化、堆肥、資源回收
const DIRV: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];      // 56955（上、右、下、左；BFS 的平手順序看它）
const isFacility = (k: number) => Object.prototype.hasOwnProperty.call(SAN_CAP, k);   // 37984
const isClient = (k: number) => k === 1 || k === 2 || k === 3 || k === 33 || k === 34 || k === 105 || k === 106 || k === 127;   // 37985

export interface SanStat { formal: boolean; totalCap: number; activeCap: number; effectiveCap: number; totalFacilities: number; activeFacilities: number; offlineFacilities: number;
  totalClients: number; reachedClients: number; unservedClients: number; longClients: number; activeByK: Record<number, number> }
export interface SanDistrict { id: number; roads: number; anchor: number; facilities: number; capacity: number; demand: number; spare: number; overflow: number; load: number; clients: number; byK: Record<number, number> }
export interface SanFacility { root: number; k: number; capacity: number; nominalCapacity: number; online: boolean; district: number }
export interface SanPick { district: number; road: number; dist: number; src: number }
export interface SanAlloc { prepared: boolean; totalDemand: number; assignedDemand: number; noRoadDemand: number; deadDemand: number; overflow: number; overloadedDistricts: number; worstDistrict: number; worstLoad: number }

export interface SanState {
  n: number;
  dist: Uint16Array; src: Int32Array; active: Uint8Array; queue: Int32Array;            // SAN_DIST445、SAN_SRC445、SAN_ACTIVE445、sanQ445
  activeRoots: number[]; allRoots: number[];                                            // sanActiveRoots445、sanAllRoots445
  stat: SanStat;
  net: Int32Array; parent: Int32Array; rank: Uint8Array;                                 // SAN_NET452、SAN_PARENT452、SAN_RANK452
  districts: SanDistrict[]; facilityMap: Map<number, SanFacility>; rootAlloc: Map<number, SanPick & { demand: number; reason: string }>; alloc: SanAlloc;
  garbLocal: Float32Array;                                                               // garbLocal（37968）：住宅局部垃圾係數，當天算、當天用，不進存檔
  garbage: number; garbCap: number; garbRatio: number; garbPen409: number;               // 37966 garbage、garbCap、garbRatio；55267 garbPen409
  far: number; unserved: number; warn: number; penAvg: number;                            // computeGarbLocal 的回傳
}
const emptyStat = (): SanStat => ({ formal: false, totalCap: 0, activeCap: 0, effectiveCap: 0, totalFacilities: 0, activeFacilities: 0, offlineFacilities: 0,
  totalClients: 0, reachedClients: 0, unservedClients: 0, longClients: 0, activeByK: {} });   // 37981
const emptyAlloc = (): SanAlloc => ({ prepared: false, totalDemand: 0, assignedDemand: 0, noRoadDemand: 0, deadDemand: 0, overflow: 0, overloadedDistricts: 0, worstDistrict: -1, worstLoad: 0 });   // 38055
export function newSan(n: number): SanState {
  const nn = n * n;
  return { n, dist: new Uint16Array(nn), src: new Int32Array(nn), active: new Uint8Array(nn), queue: new Int32Array(nn), activeRoots: [], allRoots: [], stat: emptyStat(),
    net: new Int32Array(nn), parent: new Int32Array(nn), rank: new Uint8Array(nn), districts: [], facilityMap: new Map(), rootAlloc: new Map(), alloc: emptyAlloc(),
    garbLocal: new Float32Array(nn), garbage: 0, garbCap: 0, garbRatio: 0, garbPen409: 0, far: 0, unserved: 0, warn: 0, penAvg: 0 };
}

// 37986：footprint 邊上四鄰的道路格（多格設施任何一邊接路都算；照 fy、fx、方向的順序、去重）
export function sanRoadSeeds(w: World, rootIdx: number): number[] {
  const N = w.N, out: number[] = [];
  if (rootIdx < 0 || rootIdx >= N * N) return out;
  const b = w.tiles[rootIdx] && w.tiles[rootIdx].bld;
  if (!b || b.ref) return out;
  const rx = rootIdx % N, ry = (rootIdx / N) | 0, sz = Math.max(1, b.sz || 1);
  for (let fy = 0; fy < sz; fy++) for (let fx = 0; fx < sz; fx++) for (const [dx, dy] of DIRV) {
    const nx = rx + fx + dx, ny = ry + fy + dy;
    if (!inMap(w, nx, ny)) continue;
    const j = idx(w, nx, ny);
    if (!w.tiles[j].road || out.includes(j)) continue;
    out.push(j);
  }
  return out;
}

// 37994：建築沿道路到最近處理設施的距離與來源（ref 格換成它的根）
export function sanAccessRoot(w: World, san: SanState, rootIdx: number): { road: number; dist: number; src: number } {
  const N = w.N;
  if (rootIdx < 0 || rootIdx >= N * N) return { road: -1, dist: SAN_INF, src: -1 };
  const b = w.tiles[rootIdx] && w.tiles[rootIdx].bld;
  if (!b) return { road: -1, dist: SAN_INF, src: -1 };
  if (b.ref) { const r = b.ref as [number, number]; rootIdx = idx(w, r[0], r[1]); }
  const roads = sanRoadSeeds(w, rootIdx);
  let best = -1, bd = SAN_INF, bs = -1;
  for (const j of roads) { const d = san.dist[j]; if (d < bd) { best = j; bd = d; bs = san.src[j]; } }
  return { road: best, dist: bd, src: bs };
}

// 38003–38028：多源 BFS。pop＝今天算完的人口（55258 pop）：≥ 500 是正式清運，容量只算接得到路的
export function computeSanitation445(w: World, san: SanState, pop: number): SanStat {
  const N = w.N, T = w.tiles;
  san.dist.fill(SAN_INF); san.src.fill(-1); san.active.fill(0); san.activeRoots.length = 0; san.allRoots.length = 0;
  let totalCap = 0, activeCap = 0, totalFacilities = 0, activeFacilities = 0, head = 0, tail = 0;
  const activeByK: Record<number, number> = {};
  for (let i = 0; i < N * N; i++) {
    const b = T[i].bld;
    if (!b || b.ref || !isFacility(b.k)) continue;
    totalFacilities++; totalCap += SAN_CAP[b.k]; san.allRoots.push(i);
    const seeds = sanRoadSeeds(w, i);
    if (!seeds.length) continue;
    san.active[i] = 1; activeFacilities++; activeCap += SAN_CAP[b.k]; activeByK[b.k] = (activeByK[b.k] || 0) + 1; san.activeRoots.push(i);
    for (const j of seeds) if (san.dist[j] !== 0) { san.dist[j] = 0; san.src[j] = i; san.queue[tail++] = j; }
  }
  while (head < tail) {
    const cur = san.queue[head++], d = san.dist[cur], src = san.src[cur], cx = cur % N, cy = (cur / N) | 0;
    for (const [dx, dy] of DIRV) {
      const nx = cx + dx, ny = cy + dy;
      if (!inMap(w, nx, ny)) continue;
      const j = idx(w, nx, ny);
      if (!T[j].road) continue;
      const nd = d + 1;
      if (nd < san.dist[j]) { san.dist[j] = nd; san.src[j] = src; san.queue[tail++] = j; }
    }
  }
  let totalClients = 0, reachedClients = 0, unservedClients = 0, longClients = 0;
  for (let i = 0; i < N * N; i++) {
    const b = T[i].bld;
    if (!b || b.ref || !isClient(b.k)) continue;
    totalClients++;
    const a = sanAccessRoot(w, san, i);
    if (a.dist < SAN_INF) { reachedClients++; if (a.dist > SAN_LONG_DIST) longClients++; } else unservedClients++;
  }
  const formal = pop >= SAN_FORMAL_POP, effectiveCap = formal ? activeCap : totalCap;
  san.stat = { formal, totalCap, activeCap, effectiveCap, totalFacilities, activeFacilities, offlineFacilities: totalFacilities - activeFacilities, totalClients, reachedClients, unservedClients, longClients, activeByK };
  rebuildSanitationDistricts452(w, san);   // 38028：T452 沿同一份 road／active facility 快照建清運分區（新式清運沒有 rollback，恆做）
  return san.stat;
}

// T452 38052–38053：union-find（壓縮路徑、按 rank 併）
function sanFind(san: SanState, a: number): number {
  let p = san.parent[a];
  if (p < 0) return -1;
  while (p !== san.parent[p]) p = san.parent[p];
  while (a !== p) { const n = san.parent[a]; san.parent[a] = p; a = n; }
  return p;
}
function sanUnion(san: SanState, a: number, b: number): number {
  a = sanFind(san, a); b = sanFind(san, b);
  if (a < 0 || b < 0 || a === b) return a;
  let ra = san.rank[a], rb = san.rank[b];
  if (ra < rb) { const t = a; a = b; b = t; ra = rb; }
  san.parent[b] = a;
  if (ra === rb) san.rank[a]++;
  return a;
}

// 38057–38070：道路先四鄰 union；處理設施 footprint 若貼多段道路，視為場內動線互通、合併；每個 component 是一個清運區，設施容量只屬於自己那一區
export function rebuildSanitationDistricts452(w: World, san: SanState): void {
  const N = w.N, T = w.tiles;
  san.net.fill(-1); san.parent.fill(-1); san.rank.fill(0);
  san.districts = []; san.facilityMap = new Map(); san.rootAlloc = new Map(); san.alloc = emptyAlloc();
  for (let i = 0; i < N * N; i++) if (T[i].road) san.parent[i] = i;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(w, x, y);
    if (san.parent[i] < 0) continue;
    if (x + 1 < N && san.parent[i + 1] >= 0) sanUnion(san, i, i + 1);
    if (y + 1 < N && san.parent[i + N] >= 0) sanUnion(san, i, i + N);
  }
  for (const root of san.allRoots) {
    const b = T[root] && T[root].bld;
    if (!b || b.ref || !isFacility(b.k)) continue;
    const f = sanRoadSeeds(w, root).filter(j => san.parent[j] >= 0);
    for (let k = 1; k < f.length; k++) sanUnion(san, f[0], f[k]);
  }
  const rootToDist = new Map<number, number>();
  for (let i = 0; i < N * N; i++) if (san.parent[i] >= 0) {
    const r = sanFind(san, i);
    let d = rootToDist.get(r);
    if (d === undefined) { d = san.districts.length; rootToDist.set(r, d); san.districts.push({ id: d, roads: 0, anchor: i, facilities: 0, capacity: 0, demand: 0, spare: 0, overflow: 0, load: 0, clients: 0, byK: {} }); }
    san.net[i] = d; san.districts[d].roads++;
  }
  for (const root of san.allRoots) {
    const b = T[root] && T[root].bld;
    if (!b || b.ref || !isFacility(b.k)) continue;
    const baseCap = SAN_CAP[b.k] || 0, cap = baseCap * 1;                    // 38068 assetAvailability493(root,'sanitation')：事故 T493 關＝1
    const f = sanRoadSeeds(w, root).filter(j => san.net[j] >= 0);
    const on = !!san.active[root] && f.length > 0 && cap > .01, d = on ? san.net[f[0]] : -1;
    san.facilityMap.set(root, { root, k: b.k, capacity: cap, nominalCapacity: baseCap, online: on, district: d });
    if (on && d >= 0 && san.districts[d]) { const q = san.districts[d]; q.capacity += cap; q.facilities++; q.byK[b.k] = (q.byK[b.k] || 0) + 1; }
  }
}

// 38072：一棟建築該算在哪一區（四鄰道路裡屬於某區的，挑距離最近、再依區號、道路格號）
export function sanRootDistrictChoice452(w: World, san: SanState, rootIdx: number): SanPick {
  const roads = sanRoadSeeds(w, rootIdx);
  if (!roads.length) return { district: -1, road: -1, dist: SAN_INF, src: -1 };
  const cand: SanPick[] = [];
  for (const j of roads) { const d = san.net[j]; if (d < 0) continue; cand.push({ district: d, road: j, dist: san.dist[j], src: san.src[j] }); }
  if (!cand.length) return { district: -1, road: -1, dist: SAN_INF, src: -1 };
  cand.sort((a, b) => a.dist - b.dist || a.district - b.district || a.road - b.road);
  return cand[0];
}

// 38077：一棟建築每天的垃圾量。住宅（k1、社宅、住宅塔、巨廈）＝住的人×.05；有電的工業＝就業×.08（企業 T489 關，就業是名目值：等級表、有電才算，39527／39577）
export function sanWasteOfRoot452(w: World, rootIdx: number, recycleMul: number): number {
  const b = w.tiles[rootIdx] && w.tiles[rootIdx].bld;
  if (!b || b.ref) return 0;
  recycleMul = Number.isFinite(recycleMul) ? recycleMul : 1;
  let x = 0;
  if (b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105) x = residentPopulation488(b, () => undefined) * .05;   // 住房 T488 關：入住率 1
  else if (b.k === 3 && b.pw) x = (JOBSI[b.lv] || 0) * .08;
  return x * recycleMul;
}

// 38083–38089：把今天的垃圾總量按來源分到各區，算每區負載與最壞的一區
export function prepareSanitationLoad452(w: World, san: SanState, recycleMul: number): SanAlloc {
  const N = w.N;
  san.rootAlloc = new Map();
  const a = emptyAlloc(); a.prepared = true;
  for (const q of san.districts) { q.demand = 0; q.spare = q.capacity; q.overflow = 0; q.load = 0; q.clients = 0; }
  for (let i = 0; i < N * N; i++) {
    const b = w.tiles[i].bld;
    if (!b || b.ref) continue;
    const demand = sanWasteOfRoot452(w, i, recycleMul);
    if (demand <= 0) continue;
    a.totalDemand += demand;
    const pick = sanRootDistrictChoice452(w, san, i);
    if (pick.district < 0) { a.noRoadDemand += demand; san.rootAlloc.set(i, { ...pick, demand, reason: 'no-road' }); continue; }
    const q = san.districts[pick.district];
    q.demand += demand; q.clients++; a.assignedDemand += demand;
    if (q.capacity <= 0 || pick.dist >= SAN_INF) a.deadDemand += demand;
    san.rootAlloc.set(i, { ...pick, demand, reason: q.capacity <= 0 || pick.dist >= SAN_INF ? 'dead-network' : 'ok' });
  }
  let worst = -1, worstLoad = 0, overflow = 0, overN = 0;
  for (const q of san.districts) {
    q.spare = Math.max(0, q.capacity - q.demand); q.overflow = Math.max(0, q.demand - q.capacity);
    q.load = q.capacity > 0 ? q.demand / q.capacity : (q.demand > 0 ? Infinity : 0);
    overflow += q.overflow;
    if (q.capacity > 0 && q.demand > q.capacity + 1e-9) { overN++; if (q.load > worstLoad) { worstLoad = q.load; worst = q.id; } }
  }
  a.overflow = overflow; a.overloadedDistricts = overN; a.worstDistrict = worst; a.worstLoad = worstLoad;
  san.alloc = a;
  return a;
}

// 38091：評分用的垃圾比例（最壞那一區的負載，或全城比例）。新式清運沒有 rollback；沒準備過負載＝小城（500 人前），準備了才有最壞的一區
export function sanWorstDistrict452(san: SanState): SanDistrict | null {
  if (!san.stat.formal) return null;
  return san.alloc.worstDistrict >= 0 ? san.districts[san.alloc.worstDistrict] : null;
}
export function garbDecisionRatio452(san: SanState, garbRatio = san.garbRatio): number {
  const w = sanWorstDistrict452(san);
  if (w) return Math.max(garbRatio, w.load);
  if (san.stat.formal && san.alloc.deadDemand > 0) return Math.max(garbRatio, 2);
  return garbRatio;
}

// 57697–57722：住宅局部垃圾壓力，直接扣住宅幸福 b.h。500 人前保留 T119 舊口徑（離垃圾場、焚化廠道路距離 > 18 扣 .045）；500 人以上：
// 沒有清運區、區裡沒容量、到不了 −.06；區負載 > 1 −(負載−1)×.15；距離 > 18 再 −.045
export function computeGarbLocal(w: World, san: SanState, garbRatio: number): { far: number; unserved: number; warn: number; penAvg: number } {
  const N = w.N, T = w.tiles, gl = san.garbLocal;
  let far409 = 0, unserved445 = 0, warn445 = 0;
  if (!san.stat.formal) {
    const dsrc: number[] = [];
    for (let i = 0; i < N * N; i++) { const b = T[i].bld; if (b && ((!b.ref && b.k === 8) || b.k === 62)) dsrc.push(i); }
    const dist = new Uint16Array(N * N).fill(9999), q: number[] = [];
    for (const di of dsrc) {
      const dx0 = di % N, dy0 = (di / N) | 0;
      for (const [dx, dy] of DIRV) { const nx = dx0 + dx, ny = dy0 + dy; if (inMap(w, nx, ny)) { const j = idx(w, nx, ny); if (T[j].road && dist[j] > 0) { dist[j] = 0; q.push(j); } } }
    }
    let head = 0;
    while (head < q.length) {
      const cur = q[head++], d = dist[cur], cx = cur % N, cy = (cur / N) | 0;
      for (const [dx, dy] of DIRV) { const nx = cx + dx, ny = cy + dy; if (!inMap(w, nx, ny)) continue; const j = idx(w, nx, ny); if (T[j].road && dist[j] > d + 1) { dist[j] = d + 1; q.push(j); } }
    }
    for (let i = 0; i < N * N; i++) {
      const b = T[i].bld;
      if (!b || b.k !== 1) { gl[i] = 0; continue; }
      const x = i % N, y = (i / N) | 0;
      let bd = 9999;
      for (const [dx, dy] of DIRV) { const nx = x + dx, ny = y + dy; if (inMap(w, nx, ny)) { const j = idx(w, nx, ny); if (T[j].road) bd = Math.min(bd, dist[j]); } }
      if (bd > 18) { gl[i] = clamp(garbRatio + .3, 0, 2); b.h = clamp((b.h as number) - .045, .05, 1); far409++; } else gl[i] = garbRatio;
    }
    return { far: far409, unserved: 0, warn: 0, penAvg: 0 };
  }
  if (!san.alloc.prepared) prepareSanitationLoad452(w, san, 1);
  let capPenSum = 0, capPenN = 0;
  for (let i = 0; i < N * N; i++) {
    const b = T[i].bld;
    if (!b || b.k !== 1) { gl[i] = 0; continue; }
    const st = sanitationAt452(w, san, i % N, (i / N) | 0), q = st && st.district >= 0 ? san.districts[st.district] : null, sd = st?.dist ?? SAN_INF;
    if (!st || st.district < 0 || !q || q.capacity <= 0 || sd >= SAN_INF) { gl[i] = 2; b.h = clamp((b.h as number) - .06, .05, 1); unserved445++; continue; }
    const localRatio = clamp(q.load, 0, 2), capPen = q.load > 1 ? (q.load - 1) * .15 : 0;
    if (capPen > 0) { b.h = clamp((b.h as number) - capPen, .05, 1); capPenSum += capPen; capPenN++; }
    if (sd > SAN_LONG_DIST) { gl[i] = clamp(localRatio + .3, 0, 2); b.h = clamp((b.h as number) - .045, .05, 1); far409++; }
    else { gl[i] = localRatio; if (sd > SAN_WARN_DIST) warn445++; }
  }
  return { far: far409, unserved: unserved445, warn: warn445, penAvg: capPenN ? capPenSum / capPenN : 0 };
}

// 38094–38101：某一格的清運狀況（道路、處理設施、住商工、其他）。狀態要是新的（每天 stepDay 算過，或呼叫端先 refreshSanitation）
export interface SanInfo { kind: 'road' | 'facility' | 'building' | 'tile'; district: number; capacity: number; demand: number; spare: number; overflow: number; load: number;
  reachable?: boolean; dist?: number; src?: number; active?: boolean; cap?: number; facility?: boolean; reason?: string }
export function sanitationAt452(w: World, san: SanState, x: number, y: number): SanInfo | null {
  if (!inMap(w, x, y)) return null;
  let i = idx(w, x, y), b = w.tiles[i].bld;
  if (b && b.ref) { const r = b.ref as [number, number]; i = idx(w, r[0], r[1]); x = i % w.N; y = (i / w.N) | 0; b = w.tiles[i].bld; }
  const dq = (q: SanDistrict | null) => ({ capacity: q ? q.capacity : 0, demand: q ? q.demand : 0, spare: q ? q.spare : 0, overflow: q ? q.overflow : 0, load: q ? q.load : 0 });
  if (w.tiles[i].road) {
    const d = san.net[i], q = d >= 0 ? san.districts[d] : null, dd = san.dist[i];
    return { kind: 'road', district: d, ...dq(q), reachable: dd < SAN_INF, dist: dd, src: san.src[i] };
  }
  if (b && isFacility(b.k)) {
    const f = san.facilityMap.get(i), q = f && f.district >= 0 ? san.districts[f.district] : null;
    return { kind: 'facility', facility: true, active: !!(f && f.online), district: f ? f.district : -1, cap: f ? f.capacity : (SAN_CAP[b.k] || 0), ...dq(q) };
  }
  if (b && isClient(b.k)) {
    const pick = san.rootAlloc.get(i) || sanRootDistrictChoice452(w, san, i), q = pick.district >= 0 ? san.districts[pick.district] : null;
    let reason = 'ok';
    if (pick.district < 0) reason = 'no-road';
    else if (!q || q.capacity <= 0 || pick.dist >= SAN_INF) reason = 'dead-network';
    else if (q.load > 1) reason = 'capacity';
    else if (pick.dist > SAN_LONG_DIST) reason = 'far';
    else if (pick.dist > SAN_WARN_DIST) reason = 'warn';
    return { kind: 'building', district: pick.district, ...dq(q), reachable: pick.dist < SAN_INF, dist: pick.dist, src: pick.src, reason };
  }
  return { kind: 'tile', district: -1, ...dq(null), reachable: false, dist: SAN_INF, src: -1, reason: 'none' };
}

// 55256–55278（tick() 每天，人口、就業算完之後）：垃圾量→清運→垃圾比例→（小城）全城池扣分→局部扣分。
// 回傳給結算用的垃圾比例（garbDecisionRatio452）。沿用實驗線的順序與 tickBld 迴圈；資源回收廠的貨物、提示 toast 沒搬
export function garbageStep(w: World, san: SanState, pop: number, jobsI: number, tickBld: readonly number[]): number {
  const recycleMul = 1;                                                                     // 55257 pol.recycle：沒有政策＝1
  san.garbage = (pop * .05 + jobsI * .08) * recycleMul;                                     // 55258（企業 T489 關：jobsI 是名目值）
  const st = computeSanitation445(w, san, pop);                                             // 55259
  san.garbCap = st.effectiveCap;
  san.garbRatio = san.garbCap > 0 ? clamp(san.garbage / san.garbCap, 0, 2) : 2;             // 55260
  const local = st.formal;                                                                  // 55261 sanLocal452
  if (local) prepareSanitationLoad452(w, san, recycleMul);
  san.garbPen409 = 0;                                                                       // 55267
  if (!local && san.garbage > 0 && san.garbRatio > 1) {                                     // 55268：小城（500 人前）全城容量池的懲罰
    const pen = (san.garbRatio - 1) * .15;
    san.garbPen409 = pen;
    for (const i of tickBld) { const b = w.tiles[i].bld; if (!b || b.k !== 1) continue; b.h = clamp((b.h as number) - pen, .05, 1); }   // 55273（cityHappy 之後照 55282 重算）
  }
  const gl = computeGarbLocal(w, san, san.garbRatio);                                       // 55277
  san.far = gl.far; san.unserved = gl.unserved; san.warn = gl.warn; san.penAvg = gl.penAvg;
  if (local) san.garbPen409 = gl.penAvg || 0;                                               // 55278
  return garbDecisionRatio452(san);
}
