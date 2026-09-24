// 世界歷史：逐年生成「只增不改」的事件；任一年的城市狀態＝把事件從頭套到那一年（D000 地基、CLAUDE.md 規則 4）。
// 本模組不碰 DOM 與 three（規則 2），可以在 Node 裡直接跑。
import { mulberry32, fnv1a } from './rng.ts';

export type Zone = 'R' | 'C' | 'I';
export type Era = 'old' | 'mid' | 'new';
export type Kind = Zone | 'chapel' | 'clock' | 'school' | 'watertower' | 'plant';
export const LANDMARKS: readonly Kind[] = ['chapel', 'clock', 'school', 'watertower', 'plant'];

export type Ev =
  | { y: number; t: 'road'; x: number; z: number }
  | { y: number; t: 'park'; x: number; z: number }
  | { y: number; t: 'tree'; x: number; z: number; s: number }
  | { y: number; t: 'clear'; x: number; z: number }
  | { y: number; t: 'build'; id: number; x: number; z: number; w: number; d: number; kind: Kind; lv: number; era: Era; tone: number }
  | { y: number; t: 'upgrade'; id: number; lv: number }
  | { y: number; t: 'demolish'; id: number }
  | { y: number; t: 'abandon'; id: number }
  | { y: number; t: 'decay'; id: number; dmg: number }
  | { y: number; t: 'overgrow'; x: number; z: number };

export interface World {
  format: number;
  seed: number;
  size: number;
  end: number;
  water: Uint8Array;
  riverX: Float32Array;
  center: [number, number];
  events: Ev[];
}

export interface Bld {
  id: number; x: number; z: number; w: number; d: number;
  kind: Kind; lv: number; era: Era; tone: number;
  built: number; abandoned: boolean; dmg: number;
}

export interface CityState {
  year: number;
  size: number;
  water: Uint8Array;
  road: Uint8Array;   // 0 無、1 路、2 橋、3 荒廢長草的路
  park: Uint8Array;
  trees: { x: number; z: number; s: number }[];
  blds: Bld[];
}

// 歷史格式版本：事件的欄位或意義一改就升號，舊存檔要能讀（CLAUDE.md 規則 4）
export const HISTORY_FORMAT = 1;
export const GROW_END = 80;   // 0→80 成長（一生），80→300 衰亡（考古）
export const END = 300;
export const eraOf = (y: number): Era => (y < 25 ? 'old' : y < 55 ? 'mid' : 'new');

export function generateWorld(seed: number, N = 48, end = END): World {
  const R = mulberry32(seed);
  const I = (x: number, z: number) => z * N + x;
  const inb = (x: number, z: number) => x >= 1 && z >= 1 && x < N - 1 && z < N - 1;

  // ---- 地形：一條蜿蜒的河 ----
  const water = new Uint8Array(N * N), riverX = new Float32Array(N);
  const ph = R() * 6.283, base = N * 0.68 + (R() - 0.5) * 3;
  for (let z = 0; z < N; z++) {
    const cx = base + 3.0 * Math.sin(z * 0.15 + ph) + 1.4 * Math.sin(z * 0.37 + ph * 1.7);
    const hw = 1.3 + 0.5 * Math.sin(z * 0.23 + ph * 0.6);
    riverX[z] = cx;
    for (let x = 0; x < N; x++) if (Math.abs(x + 0.5 - cx) < hw) water[I(x, z)] = 1;
  }
  const cz0 = Math.round(N * 0.48 + (R() - 0.5) * 4);
  const cx0 = Math.round(riverX[cz0] - 10 - R() * 3);
  const dist = (x: number, z: number) => Math.hypot(x - cx0, z - cz0);
  const rnd = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) rnd[i] = R();
  const eastBank = (x: number, z: number) => x + 0.5 > riverX[z] + 1.2;

  // ---- 路網計畫：每格一個啟用年份（Infinity＝永不）。老城巷距 3、外圍棋盤距 6，由城心往外長 ----
  const roadYear = new Float32Array(N * N).fill(Infinity);
  const plan = (x: number, z: number, yr: number) => { if (inb(x, z)) { const i = I(x, z); if (yr < roadYear[i]) roadYear[i] = yr; } };
  for (let z = 1; z < N - 1; z++) plan(cx0, z, Math.abs(z - cz0) <= 3 ? 0 : 1 + Math.abs(z - cz0) * 0.9);
  for (let x = 1; x < N - 1; x++) plan(x, cz0, Math.abs(x - cx0) <= 2 ? 1 : 2 + Math.abs(x - cx0) * 1.0);
  for (let x = cx0 - 9; x <= cx0 + 9; x++) for (let z = cz0 - 9; z <= cz0 + 9; z++) {
    const dx = x - cx0, dz = z - cz0;
    if (inb(x, z) && (dx % 3 === 0 || dz % 3 === 0)) plan(x, z, 3 + dist(x, z) * 0.9 + rnd[I(x, z)] * 3);
  }
  for (let x = 1; x < N - 1; x++) for (let z = 1; z < N - 1; z++) {
    const dx = x - cx0, dz = z - cz0;
    if (Math.max(Math.abs(dx), Math.abs(dz)) > 9 && ((dx % 6 + 6) % 6 === 0 || (dz % 6 + 6) % 6 === 0))
      plan(x, z, 12 + dist(x, z) * 1.25 + rnd[I(x, z)] * 6);
  }
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = I(x, z);
    if (water[i]) roadYear[i] = (z === cz0 || z === cz0 + 12) ? Math.max(roadYear[i], 30) : Infinity;   // 只有兩座橋
    else if (eastBank(x, z)) roadYear[i] = Math.max(roadYear[i], 34 + dist(x, z) * 0.3);                // 過河要等橋
  }

  // ---- 生成期間的狀態（事件以外的工作記憶，不輸出）----
  const events: Ev[] = [];
  const occ = new Int32Array(N * N);     // 0 空、-1 路、-2 公園、>0 建築 id
  const tree = new Uint8Array(N * N);
  const road = new Uint8Array(N * N);
  type Live = Bld & { dist: number };
  const live = new Map<number, Live>();
  let nextId = 1;

  const clearTree = (y: number, x: number, z: number) => { const i = I(x, z); if (tree[i]) { tree[i] = 0; events.push({ y, t: 'clear', x, z }); } };
  const addTree = (y: number, x: number, z: number, s: number) => { const i = I(x, z); if (!tree[i] && !water[i]) { tree[i] = 1; events.push({ y, t: 'tree', x, z, s: +s.toFixed(2) }); } };
  const zoneOf = (x: number, z: number): Zone => {
    if (eastBank(x, z)) return 'I';
    const d = dist(x, z);
    if (d <= 5 || ((Math.abs(x - cx0) <= 1 || Math.abs(z - cz0) <= 1) && d <= 10)) return 'C';
    return 'R';
  };
  const free = (x: number, z: number) => inb(x, z) && !water[I(x, z)] && occ[I(x, z)] === 0;
  const nearRoad = (x: number, z: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inb(x + a, z + b) && road[I(x + a, z + b)] > 0);
  const place = (y: number, x: number, z: number, w: number, d: number, kind: Kind, lv: number) => {
    const id = nextId++;
    for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) { clearTree(y, x + a, z + b); occ[I(x + a, z + b)] = id; }
    const tone = +R().toFixed(3), era = eraOf(y);
    events.push({ y, t: 'build', id, x, z, w, d, kind, lv, era, tone });
    live.set(id, { id, x, z, w, d, kind, lv, era, tone, built: y, abandoned: false, dmg: 0, dist: dist(x + w / 2, z + d / 2) });
    return id;
  };
  const nearPark = (x: number, z: number) => { for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (inb(x + a, z + b) && occ[I(x + a, z + b)] === -2) return true; return false; };
  const score = (x: number, z: number) => 1 / (1 + dist(x, z) * 0.08) + (nearPark(x, z) ? 0.3 : 0) + (zoneOf(x, z) === 'C' ? 0.2 : 0);
  const findLot = (w: number, d: number, ok: (x: number, z: number) => boolean) => {
    let best: [number, number] | null = null, bd = Infinity;
    for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
      if (!ok(x, z)) continue;
      let fits = true;
      for (let a = 0; a < w && fits; a++) for (let b = 0; b < d && fits; b++) if (!free(x + a, z + b)) fits = false;
      if (!fits || !nearRoad(x, z)) continue;
      const k = dist(x, z) + rnd[I(x, z)];
      if (k < bd) { bd = k; best = [x, z]; }
    }
    return best;
  };

  // ---- 第 0 年的自然：森林與零星樹 ----
  const fa = R() * 6.283, fb = R() * 6.283, fc = R() * 6.283;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const f = Math.sin(x * 0.21 + fa) + Math.sin(z * 0.17 + fb) + 0.6 * Math.sin((x + z) * 0.13 + fc) + (rnd[I(x, z)] - 0.5);
    if ((dist(x, z) > 11 && f > 1.0) || (dist(x, z) > 5 && rnd[I(x, z)] < 0.025)) addTree(0, x, z, 0.75 + rnd[I((x * 7) % N, (z * 3) % N)] * 0.45);
  }

  const LAND: [number, Kind, number, number][] = [[6, 'chapel', 1, 1], [12, 'clock', 1, 1], [20, 'school', 2, 1], [28, 'watertower', 1, 1], [36, 'plant', 2, 2]];
  const PARKS = [1, 26, 44, 61];

  for (let y = 0; y <= Math.min(end, GROW_END); y++) {
    // 路
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = I(x, z);
      if (!road[i] && roadYear[i] <= y && occ[i] === 0) { clearTree(y, x, z); road[i] = water[i] ? 2 : 1; occ[i] = -1; events.push({ y, t: 'road', x, z }); }
    }
    // 公園（第 1 年是十字路口旁的村口綠地，之後在外圍住宅區）
    if (PARKS.includes(y)) {
      const lot = y === 1 ? [cx0 + 1, cz0 + 1] as [number, number]
        : findLot(2, 2, (x, z) => zoneOf(x, z) === 'R' && dist(x, z) >= 10 && dist(x, z) <= 18);
      if (lot) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const x = lot[0] + a, z = lot[1] + b;
        if (!free(x, z)) continue;
        clearTree(y, x, z); occ[I(x, z)] = -2; events.push({ y, t: 'park', x, z });
        if ((a + b) % 2 === 0) addTree(y, x, z, 0.8);
      }
    }
    // 地標
    for (const [ly, kind, w, d] of LAND) if (ly === y) {
      const lot = findLot(w, d, (x, z) =>
        kind === 'plant' ? zoneOf(x, z) === 'I' :
        kind === 'school' ? zoneOf(x, z) === 'R' && dist(x, z) >= 6 :
        kind === 'watertower' ? dist(x, z) >= 10 : dist(x, z) >= 1.5);
      if (lot) place(y, lot[0], lot[1], w, d, kind, 1);
    }
    // 新建築：目標數量走 logistic 曲線；候選地依分數加權抽選
    const target = y === 0 ? 5 : Math.round(380 / (1 + Math.exp(-(y - 32) / 8)));
    let need = Math.min(18, Math.max(0, target - live.size));
    if (need > 0) {
      const cand: [number, number, number][] = [];
      for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) if (free(x, z) && nearRoad(x, z)) cand.push([x, z, R() / (0.2 + score(x, z))]);
      cand.sort((a, b) => a[2] - b[2]);
      for (const [x, z] of cand) {
        if (need <= 0) break;
        if (!free(x, z)) continue;
        const zone = zoneOf(x, z);
        const big = zone !== 'R' && dist(x, z) > 6 && R() < 0.35 && free(x + 1, z) && free(x, z + 1) && free(x + 1, z + 1);
        place(y, x, z, big ? 2 : 1, big ? 2 : 1, zone, 1);
        need--;
      }
    }
    // 升級與改建：最核心（半徑 4）的老房子只加一層、永不改建——低矮老城被外圈的高樓環繞，城市看得出歷史
    for (const b of [...live.values()]) {
      if (LANDMARKS.includes(b.kind) || y - b.built < 6) continue;
      const maxLv = b.kind === 'C' ? (b.dist <= 7 ? 6 : b.dist <= 11 ? 5 : 3) : b.kind === 'R' ? (b.dist <= 10 ? 4 : 2) : 2;
      const heritage = b.era === 'old' && b.dist <= 4;
      const cap = heritage ? Math.min(2, maxLv) : maxLv;
      if (b.lv >= cap || R() >= 0.05 + 0.06 * score(b.x, b.z)) continue;
      if (!heritage && R() < 0.45) {
        events.push({ y, t: 'demolish', id: b.id });
        live.delete(b.id);
        for (let a = 0; a < b.w; a++) for (let c = 0; c < b.d; c++) occ[I(b.x + a, b.z + c)] = 0;
        place(y, b.x, b.z, b.w, b.d, b.kind, b.lv + 1);
      } else {
        b.lv++;
        events.push({ y, t: 'upgrade', id: b.id, lv: b.lv });
      }
    }
  }

  // ---- 81→300：衰亡。外圍先被遺棄，荒屋逐年損壞，植物從森林與廢墟往城裡長 ----
  for (let y = GROW_END + 1; y <= end; y++) {
    if (y >= 115) {
      const k = 0.0015 + 0.012 * ((y - 115) / (END - 115));
      for (const b of live.values()) {
        if (b.abandoned) continue;
        if (R() < k * (1 + b.dist / 14) * (LANDMARKS.includes(b.kind) ? 0.25 : 1)) { b.abandoned = true; events.push({ y, t: 'abandon', id: b.id }); }
      }
    }
    for (const b of live.values()) {
      if (!b.abandoned || b.dmg >= 1) continue;
      // 衰敗放慢：第 300 年多數停在「屋頂塌陷、只剩牆」的空殼，考古才有東西可讀；地標更慢，留作廢墟裡的地標
      if (R() < (LANDMARKS.includes(b.kind) ? 0.03 : 0.07)) {
        b.dmg = Math.min(1, +(b.dmg + 0.06 + R() * 0.1).toFixed(3));
        events.push({ y, t: 'decay', id: b.id, dmg: b.dmg });
      }
    }
    if (y >= 125) {
      const n = Math.floor(4 + (y - 125) * 0.35);
      for (let k = 0; k < n; k++) {
        const x = 1 + Math.floor(R() * (N - 2)), z = 1 + Math.floor(R() * (N - 2)), i = I(x, z);
        if (water[i] || tree[i]) continue;
        const nearTree = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tree[I(x + a, z + b)]);
        const o = occ[i];
        if (o === -1) {                                   // 路：先長草，再長樹
          if (road[i] !== 3 && (nearTree || R() < 0.08)) { road[i] = 3; events.push({ y, t: 'overgrow', x, z }); }
          else if (road[i] === 3 && nearTree && R() < 0.3) addTree(y, x, z, 0.6 + R() * 0.5);
        } else if (o > 0) {                               // 只有倒塌成瓦礫的建築才會長樹
          const b = live.get(o);
          if (b && b.dmg >= 1 && (nearTree || R() < 0.2)) addTree(y, x, z, 0.6 + R() * 0.5);
        } else if (nearTree || R() < 0.15) addTree(y, x, z, 0.6 + R() * 0.5);
      }
    }
  }

  return { format: HISTORY_FORMAT, seed, size: N, end, water, riverX, center: [cx0, cz0], events };
}

// ---- 地塊履歷：一格 300 年來發生過的事（考古與一生的最小形態）。只回結構，文字由介面組 ----
export type LotEntry =
  | { y: number; t: 'road' | 'bridge' | 'park' | 'overgrow' | 'tree' | 'clear' }
  | { y: number; t: 'build'; id: number; kind: Kind; era: Era; lv: number; replaces: boolean }
  | { y: number; t: 'upgrade'; id: number; kind: Kind; lv: number }
  | { y: number; t: 'demolish' | 'abandon' | 'roofless' | 'collapse'; id: number; kind: Kind };

export function lotHistory(w: World, x: number, z: number): LotEntry[] {
  const out: LotEntry[] = [], here = new Map<number, Kind>(), marks = new Map<number, { roofless: boolean; collapse: boolean }>();
  let demolishedAt = -1;
  const at = (ex: number, ez: number) => ex === x && ez === z;
  for (const e of w.events) {
    switch (e.t) {
      case 'road': if (at(e.x, e.z)) out.push({ y: e.y, t: w.water[z * w.size + x] ? 'bridge' : 'road' }); break;
      case 'park': case 'overgrow': case 'tree': case 'clear': if (at(e.x, e.z)) out.push({ y: e.y, t: e.t }); break;
      case 'build':
        if (x >= e.x && x < e.x + e.w && z >= e.z && z < e.z + e.d) {
          here.set(e.id, e.kind); marks.set(e.id, { roofless: false, collapse: false });
          out.push({ y: e.y, t: 'build', id: e.id, kind: e.kind, era: e.era, lv: e.lv, replaces: demolishedAt === e.y });
        }
        break;
      case 'upgrade': { const k = here.get(e.id); if (k) out.push({ y: e.y, t: 'upgrade', id: e.id, kind: k, lv: e.lv }); break; }
      case 'demolish': { const k = here.get(e.id); if (k) { out.push({ y: e.y, t: 'demolish', id: e.id, kind: k }); demolishedAt = e.y; } break; }
      case 'abandon': { const k = here.get(e.id); if (k) out.push({ y: e.y, t: 'abandon', id: e.id, kind: k }); break; }
      case 'decay': {
        const k = here.get(e.id), m = marks.get(e.id);
        if (!k || !m) break;
        if (!m.roofless && e.dmg >= 0.3) { m.roofless = true; out.push({ y: e.y, t: 'roofless', id: e.id, kind: k }); }
        if (!m.collapse && e.dmg >= 1) { m.collapse = true; out.push({ y: e.y, t: 'collapse', id: e.id, kind: k }); }
        break;
      }
    }
  }
  return out;
}

export function stateAt(w: World, year: number): CityState {
  const N = w.size, road = new Uint8Array(N * N), park = new Uint8Array(N * N);
  const trees = new Map<number, number>(), blds = new Map<number, Bld>();
  for (const e of w.events) {
    if (e.y > year) break;
    switch (e.t) {
      case 'road': road[e.z * N + e.x] = w.water[e.z * N + e.x] ? 2 : 1; break;
      case 'overgrow': road[e.z * N + e.x] = 3; break;
      case 'park': park[e.z * N + e.x] = 1; break;
      case 'tree': trees.set(e.z * N + e.x, e.s); break;
      case 'clear': trees.delete(e.z * N + e.x); break;
      case 'build': blds.set(e.id, { id: e.id, x: e.x, z: e.z, w: e.w, d: e.d, kind: e.kind, lv: e.lv, era: e.era, tone: e.tone, built: e.y, abandoned: false, dmg: 0 }); break;
      case 'upgrade': { const b = blds.get(e.id); if (b) b.lv = e.lv; break; }
      case 'demolish': blds.delete(e.id); break;
      case 'abandon': { const b = blds.get(e.id); if (b) b.abandoned = true; break; }
      case 'decay': { const b = blds.get(e.id); if (b) b.dmg = e.dmg; break; }
    }
  }
  return {
    year, size: N, water: w.water, road, park,
    trees: [...trees].map(([i, s]) => ({ x: i % N, z: (i / N) | 0, s })),
    blds: [...blds.values()],
  };
}

export function stats(s: CityState) {
  const b = s.blds, n = b.length;
  let roads = 0, overgrown = 0;
  for (const r of s.road) { if (r) roads++; if (r === 3) overgrown++; }
  return {
    buildings: n,
    avgLv: n ? +(b.reduce((a, x) => a + x.lv, 0) / n).toFixed(3) : 0,
    intact: n ? +(b.filter(x => !x.abandoned && x.dmg < 0.2).length / n).toFixed(3) : 0,
    trees: s.trees.length,
    roads, overgrown,
  };
}

export const historyHash = (w: World) => fnv1a(JSON.stringify(w.events));
