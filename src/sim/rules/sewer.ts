// 污水（H，D033）：住宅「有沒有接上集中污水」＝實驗線 SEW_OK442。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d（index.html 行號）。
// 回退設定下決定接管的是 T472 的 SEWER_ROOT_OK472（55152：非舊式分支以 sewerRootStatus472 為準；T451 的分區容量帳只做帳）：
//   一棟建築（非水務設施、非發電廠）接管＝貼著的 wp（水管，給水與污水共用）管網元件裡有污水廠（容量 > 0），而且從污水廠周圍起算、
//   沿同一個元件走到這棟建築周圍任一格的步數 ≤ 90（52899）。容量不限制接管（一座廠 180 只用來算溢流統計，回退設定沒有別的讀者）。
// 照抄的細節：管網元件＝wp 格 4 向連通、索引升序掃（52875）；「貼著」＝腳印格＋四邊外一圈、不含四角、插入順序 腳印→上→下→左→右（52876）；
//   找距離用腳印＋外一圈含四角（dy、dx 從 −1 到 sz，52899）；廠的容量只加進它貼著的第一個元件（52889–52890），但每個貼著的元件都有距離起點（52894）；
//   距離＝多源 4 向 BFS、每格 +1、截在 WATER_HOPS472＋32（52877；本線讀檔不帶 sm472 主管線，所以沒有 0 成本的邊）；
//   起點只認 pf > .3 的廠（pf＝pw 為 false 時 .18、否則 1，52878；回退設定 assetAvailability493 恆 1）。
// 沒搬：wm472／sm472 主管線（本線讀檔不帶，backlog L）、T472 的供水與水質與污水量與溢流報表、T451 的分區容量帳與面板。
// 每天在 55011 一次算完整張（實驗線在第一個住宅查詢時才算：回退設定 waterLegacy449 為真，55013 的強制重算不跑；結果只看管網、廠、pw 與建築位置，
// 這些在 55150 那一圈之前不會被這一天的生長動到，兩者逐位相等）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { idx, inMap, type World } from './lab.ts';

export const SEWAGE_THRESHOLD442 = 500;                           // 55011：昨天的人口 ≥ 500 才要求集中污水
export const WATER_HOPS472 = 90;                                  // 52851
export const WATER_FACILITY_K472 = new Set([10, 27, 129, 130, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 163]);   // 52852（T475：配水調壓站也算水務設施）
export const POWER_SOURCE_K450 = new Set([5, 25, 26, 58, 59, 60, 62, 140, 141, 142, 143, 144, 145, 150]);               // 52469
const SEWER_PLANT_K = [27, 156, 157];                             // 52896：污水廠、高級污水廠、提升站＝距離起點
const SEWER_CAP: Record<number, number> = { 27: 180, 156: 340 };  // 52889、52891：容量（只有「> 0」有用）
const POW_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];               // 52436

// 沒接管的原因（介面用，實驗線沒有這一欄）：0＝接管；1＝沒貼著管網；2＝貼著的管網裡沒有污水廠；3＝超過 90 格；255＝這一格不是建築根格或是水務設施／發電廠
export const SEWER_OK = 0;
export const SEWER_NO_PIPE = 1;
export const SEWER_NO_PLANT = 2;
export const SEWER_TOO_FAR = 3;
export const SEWER_NA = 255;

export interface SewerResult {
  ok: Uint8Array;            // 每個建築根格：1＝接管（SEWER_ROOT_OK472）；其他格 0
  why: Uint8Array;           // 每個建築根格的原因（上面的碼）；其他格 255
  hops: Uint16Array;         // 每個建築根格：從污水廠沿管走到它周圍的最少步數（介面用，實驗線沒有這一欄；沒貼管網或走不到＝65535）
  plants: number;            // 污水廠（k27、k156）數；提升站不算
}

export const pfOf = (b: { pw?: boolean }) => b.pw === false ? .18 : 1;    // 52878（k27、k156、k157 都是 sewer 類，base 不是 1 的例外只有 154、159、160）

// 52875 buildPipeComponents472：wp 格 4 向連通，索引升序掃，元件編號依發現順序（−1＝不是管網格）
export function pipeComponents(w: World): { comp: Int32Array; n: number } {
  const N = w.N, nn = N * N, tiles = w.tiles, comp = new Int32Array(nn).fill(-1), q = new Int32Array(nn);
  let n = 0;
  for (let i = 0; i < nn; i++) {
    if (!tiles[i].wp || comp[i] >= 0) continue;
    let h = 0, m = 0; q[m++] = i; comp[i] = n;
    while (h < m) {
      const j = q[h++], x = j % N, y = (j / N) | 0;
      for (const [dx, dy] of POW_DIR) {
        const nx = x + dx, ny = y + dy; if (!inMap(w, nx, ny)) continue;
        const z = idx(w, nx, ny);
        if (comp[z] < 0 && tiles[z].wp) { comp[z] = n; q[m++] = z; }
      }
    }
    n++;
  }
  return { comp, n };
}
// 52876 facilityComps472：腳印格＋四邊外一圈（不含四角），插入順序（腳印 → 上 → 下 → 左 → 右）
export function facilityComps(w: World, comp: Int32Array, root: number, sz0: number): number[] {
  const N = w.N, x = root % N, y = (root / N) | 0, sz = Math.max(1, sz0), set: number[] = [];
  const add = (xx: number, yy: number) => { if (!inMap(w, xx, yy)) return; const c = comp[idx(w, xx, yy)]; if (c >= 0 && !set.includes(c)) set.push(c); };
  for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) add(x + dx, y + dy);
  for (let d = 0; d < sz; d++) { add(x + d, y - 1); add(x + d, y + sz); add(x - 1, y + d); add(x + sz, y + d); }
  return set;
}
// 52877 pressureDistances472：多源 BFS，每格 +1、同一個元件內、截在 WATER_HOPS472＋32（本線沒有 sm472 主管線，沒有 0 成本的邊）
export function pipeDistances(w: World, comp: Int32Array, seeds: number[]): Uint16Array {
  const N = w.N, n = N * N, dist = new Uint16Array(n).fill(65535), cutoff = WATER_HOPS472 + 32, dq = new Int32Array(n * 2);
  let head = 0, tail = 0;
  for (const i of seeds) { if (i < 0 || i >= n || comp[i] < 0 || dist[i] === 0) continue; dist[i] = 0; dq[tail++] = i; }
  while (head < tail) {
    const j = dq[head++], x = j % N, y = (j / N) | 0, d = dist[j];
    for (const [dx, dy] of POW_DIR) {
      const nx = x + dx, ny = y + dy; if (!inMap(w, nx, ny)) continue;
      const z = idx(w, nx, ny); if (comp[z] < 0 || comp[z] !== comp[j]) continue;
      const nd = d + 1;
      if (nd < dist[z] && nd <= cutoff) { dist[z] = nd; dq[tail++] = z; }
    }
  }
  return dist;
}

export function sewerServed(w: World): SewerResult {
  const N = w.N, n = N * N, tiles = w.tiles;
  const ok = new Uint8Array(n), why = new Uint8Array(n).fill(SEWER_NA), hops = new Uint16Array(n).fill(65535);
  const { comp, n: nComp } = pipeComponents(w);
  // 52884–52892 根迴圈：每棟（非 ref）建築；非水務設施、非發電廠的記進它貼著的第一個元件；廠的容量只加進第一個元件
  const roots: number[] = [], capOf = new Float64Array(Math.max(1, nComp)), rootComp = new Int32Array(n).fill(-2);   // −2＝不是 root；−1＝沒貼管網
  let plants = 0;
  const seedsOf: { i: number; sz: number; cs: number[] }[] = [];
  for (let i = 0; i < n; i++) {
    const b = tiles[i].bld; if (!b || b.ref) continue;
    const cs = facilityComps(w, comp, i, b.sz || 1);
    if (!WATER_FACILITY_K472.has(b.k) && !POWER_SOURCE_K450.has(b.k)) { roots.push(i); rootComp[i] = cs.length ? cs[0] : -1; }
    const cap = SEWER_CAP[b.k];
    if (cap && cs.length) capOf[cs[0]] += cap * pfOf(b);
    if (b.k === 27 || b.k === 156) plants++;
    if (SEWER_PLANT_K.includes(b.k) && pfOf(b) > .3) seedsOf.push({ i, sz: b.sz || 1, cs });
  }
  // 52894 sewerSeeds：每個貼著的元件，廠腳印＋外一圈（含四角）裡屬於那個元件的格
  const seeds: number[] = [];
  for (const { i, sz, cs } of seedsOf) {
    const x = i % N, y = (i / N) | 0;
    for (const c of cs) for (let dy = -1; dy <= sz; dy++) for (let dx = -1; dx <= sz; dx++) {
      const xx = x + dx, yy = y + dy; if (!inMap(w, xx, yy)) continue;
      const z = idx(w, xx, yy); if (comp[z] === c) seeds.push(z);
    }
  }
  const dist = pipeDistances(w, comp, seeds);
  // 52899 每棟的接管：貼著的第一個元件、周圍（含四角）在那個元件內的格取最小距離，≤ 90 且元件有容量
  for (const r of roots) {
    const b = tiles[r].bld!, c = rootComp[r];
    if (c < 0) { why[r] = SEWER_NO_PIPE; continue; }
    const x = r % N, y = (r / N) | 0, sz = b.sz || 1;
    let best = 65535;
    for (let dy = -1; dy <= sz; dy++) for (let dx = -1; dx <= sz; dx++) {
      const xx = x + dx, yy = y + dy; if (!inMap(w, xx, yy)) continue;
      const z = idx(w, xx, yy); if (comp[z] === c && dist[z] < best) best = dist[z];
    }
    hops[r] = best;
    if (best <= WATER_HOPS472 && capOf[c] > 0) { ok[r] = 1; why[r] = SEWER_OK; }
    else why[r] = capOf[c] > 0 ? SEWER_TOO_FAR : SEWER_NO_PLANT;
  }
  return { ok, why, hops, plants };
}
