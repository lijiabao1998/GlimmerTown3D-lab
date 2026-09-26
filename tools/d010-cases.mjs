// D010 服務覆蓋／污染／地價／教育場對拍的隨機輸入（實驗線那邊 tools/lab-fields.mjs 與本線 tools/unit-d010-fields.mjs 共用）。
// 同一個種子產生同一批案例；每次呼叫 cases(k) 都回新的物件，兩邊各自產生、互不共用。
// 每個案例＝一張隨機小圖（N 6–16）＋服務預算＋教育輸入＋一串增量蓋印／撤印（20–60 步，在 rebuildCov 之後跑）。
// 輸出一律過 snapshot()（Uint8Array → 非零格的 [間隔,值] 攤平成一列）再 canon()，兩邊比字串。
import crypto from 'node:crypto';
import { mulberry32 } from '../src/sim/rng.ts';
import { canon } from './d009-cases.mjs';

export { canon };
export const D010_SEED = 20260926;
// 家族：random 隨機城、edge 貼邊＋預算四捨五入邊界、saturate 污染飽和後撤印、sweep 每一種覆蓋／污染源都輪一遍
export const FAMILIES = [['random', 180], ['edge', 24], ['saturate', 24], ['sweep', 24]];
export const D010_COUNT = FAMILIES.reduce((n, [, c]) => n + c, 0);

// 以下名單照實驗線 @ d23c18d 抄（52957–52959 COVR 的鍵、52962＋52976 covFieldOfK、52991–52992 POL_SRC、52967 SVC_BUDGET_CAT）；
// tools/lab-fields.mjs 會拿實驗線自己的表核對「每一種都出現在案例裡」，抄漏就不產樣本。
export const COV_FIELDS = ['park', 'plant', 'fire', 'school', 'stadium', 'police', 'hospital', 'clinic', 'library', 'post', 'cemetery', 'bus', 'rdec', 'ambulance',
  'fire2', 'prison', 'university', 'parking', 'museum', 'theater', 'cinema', 'grandlib', 'court', 'institute', 'botanical', 'megahosp', 'police2', 'cem2',
  'stadium2', 'fireHQ', 'faith', 'kindergarten', 'senior', 'bank', 'market', 'dogpark', 'icerink', 'skate', 'firewatch', 'pool', 'chapel', 'vet', 'cgarden',
  'crem', 'highsch', 'freight', 'cpark', 'campus', 'civicc', 'fertco', 'kitchen', 'pump', 'resilience', 'shelter', 'play', 'gpark', 'medcamp', 'artcamp',
  'admincamp', 'researchcamp'];
export const BUDGET_FIELDS = ['police', 'police2', 'court', 'fire', 'fire2', 'fireHQ', 'hospital', 'clinic', 'ambulance', 'megahosp', 'medcamp', 'school',
  'university', 'library', 'grandlib', 'institute', 'researchcamp'];
export const COV_KINDS = [4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 20, 28, 30, 31, 32, 35, 36, 40, 41, 43, 45, 47, 48, 52, 54, 56, 61, 66, 84, 85, 86, 87, 92, 93,
  94, 95, 96, 99, 102, 104, 107, 108, 110, 112, 113, 115, 118, 119, 124, 125, 126, 130, 131, 132, 134, 135, 136, 137, 138];
export const POL_KINDS = [3, 5, 8, 19, 62, 100, 107, 114, 117, 118, 140, 141, 142, 170, 171, 173, 174];
// 沒有覆蓋也不是污染源的種類（住商工、127–133 之間沒被覆寫的、雜項）：rebuildCov 對它們什麼都不蓋
const OTHER_KINDS = [1, 1, 1, 2, 2, 2, 3, 10, 17, 22, 25, 26, 33, 34, 53, 55, 58, 60, 105, 106, 127, 128, 129, 133, 139, 148, 150, 161, 162, 186];
const EDU_KINDS = [7, 32, 14, 108, 113, 138, 41];   // 學校、大學、圖書館、高中、大學城、研究園區（教育場讀）＋圖書總館（有預算、不進教育場）
const HEAVY_POL = [62, 62, 114, 114, 5, 5, 19, 3, 8];
const TECH = ['C1', 'C4a', 'C4b', 'D7', 'A5', 'C2'];
const SPECS = [null, 'edu', 'edu', 'ind', 'green', 'hub'];
// 預算：+(x).toFixed(2) 夾 .5–1.5（52968），(50+j)/100 跟 toFixed 字串解析是同一個 double。邊界值專挑會碰到 .5 進位的
const BUDGET_EDGE = [0.5, 1.5, 0.7, 0.9, 1.1, 1.3, 0.75, 1.25, 0.55, 0.65, 0.85, 0.95, 1.05, 1.15, 1.35, 1.45];
const ODD_R = [1, 3, 5, 7, 9, 11, 13, 15, 17];

// 種子：整個家族名逐字元混進去（避免 D009 sub() 只取 name.charCodeAt(1) 的撞號）
export function seedOf(name, k) {
  let h = (D010_SEED ^ 0x9e3779b9) >>> 0;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h = Math.imul(h ^ (k + 1), 2654435761) >>> 0;
  h ^= h >>> 15;
  return Math.imul(h, 2246822519) >>> 0;
}
function gen(seed) {
  const R = mulberry32(seed);
  const int = (a, b) => a + Math.floor(R() * (b - a + 1)), f = (a, b) => a + R() * (b - a), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  return { R, int, f, ch, pick };
}

const bld = (g, k) => ({ k, lv: g.int(1, 3), v: g.int(0, 5), age: g.int(0, 40), pw: g.ch(.8) });
function budgetOf(g, mode) {
  const one = () => mode === 'edge' ? g.pick(BUDGET_EDGE) : g.ch(.3) ? 1 : g.ch(.25) ? g.pick(BUDGET_EDGE) : (50 + g.int(0, 100)) / 100;
  return { police: one(), fire: one(), health: one(), edu: one() };
}
function eduOf(g) {
  const schoolLunch = g.ch(.5);
  return { tech: TECH.filter(() => g.ch(.4)), spec: g.pick(SPECS), schoolLunch, polNull: !schoolLunch && g.ch(.5) };   // polNull：實驗線 pol 整個是 null（只影響實驗線那邊的樁）
}
// 2×2 體育場：根格＋三個附屬格 {k:9,ref:[x,y]}（實驗線 51728）
function stadium(tiles, N, x, y, g) {
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const t = tiles[(y + dy) * N + x + dx];
    t.bld = dx === 0 && dy === 0 ? { ...bld(g, 9), sz: 2 } : { k: 9, ref: [x, y] };
  }
}
function randomKind(g) {
  const r = g.R();
  return r < .40 ? g.pick(COV_KINDS) : r < .52 ? g.pick(EDU_KINDS) : r < .72 ? g.pick(POL_KINDS) : g.pick(OTHER_KINDS);
}
// 一格可能有：路（rdec／公車站多半在路上，偶爾不在）、樹、建築（住商工可能有犯罪旗標）
function genTiles(g, N, density) {
  const tiles = [];
  for (let i = 0; i < N * N; i++) {
    const t = { bld: null };
    if (g.ch(.25)) { t.road = 1; t.rc = g.int(1, 5); if (g.ch(.18)) t.rdec = 1; if (g.ch(.15)) t.bus = 1; }
    else { if (g.ch(.02)) t.rdec = 1; if (g.ch(.02)) t.bus = 1; }
    if (g.ch(.15)) t.tree = g.int(1, 6);
    if (!t.road && g.ch(density)) {
      const b = bld(g, randomKind(g));
      if (b.k <= 3 ? g.ch(.3) : g.ch(.05)) b.crime = 1;   // landStaticAt 只數 k≤3 的犯罪；k>3 的旗標要被忽略
      t.bld = b;
    }
    tiles.push(t);
  }
  return tiles;
}
function sprinkleRefs(g, tiles, N, p) {   // 散落的附屬格：只有 k9 會蓋 stadium，其他種類（含污染源）什麼都不蓋
  for (let i = 0; i < N * N; i++) if (g.ch(p)) {
    const k = g.ch(.3) ? 9 : g.ch(.5) ? g.pick(POL_KINDS) : g.pick(COV_KINDS);
    tiles[i].bld = { k, ref: [g.int(0, N - 1), g.int(0, N - 1)], ...(g.ch(.2) ? { crime: 1 } : {}) };
  }
}
function extrasOf(g, N) {   // landStaticAt 讀的其他場（噪音、地鐵 TOD、可達性）：rebuildCov 不動它們，當輸入
  if (!g.ch(.4)) return null;
  const sparse = (p, a, b) => { const o = []; for (let i = 0; i < N * N; i++) if (g.ch(p)) o.push(i, g.int(a, b)); return o; };
  return { NOISE: sparse(.3, 1, 60), METRO_TOD467B: sparse(.1, 1, 20), ACCESS468: sparse(.1, 1, 20) };
}
// 增量操作：['cov', 場, x, y, r（null＝COVR[場]，同實驗線 doPlace）, ±1]、['pol', x, y, k, ±1]、['tree', x, y, ±1]
function genOps(g, N, tiles, mode) {
  const roots = tiles.flatMap((t, i) => t.bld && !t.bld.ref ? [[i % N, (i / N) | 0, t.bld.k]] : []);
  const covRoots = roots.filter(([, , k]) => COV_KINDS.includes(k)), polRoots = roots.filter(([, , k]) => POL_KINDS.includes(k));
  const xy = () => mode === 'edge' ? [g.pick([0, 1, N - 2, N - 1, -1, N, g.int(0, N - 1)]), g.pick([0, 1, N - 2, N - 1, -2, N + 1, g.int(0, N - 1)])]
    : g.ch(.9) ? [g.int(0, N - 1), g.int(0, N - 1)] : [g.int(-2, N + 1), g.int(-2, N + 1)];
  const ops = [], n = g.int(20, 60);
  for (let s = 0; s < n; s++) {
    const u = g.R(), sign = g.ch(mode === 'saturate' ? .7 : .5) ? -1 : 1;
    if (u < (mode === 'saturate' ? .25 : .45)) {
      let field, x, y, r = null;
      if (covRoots.length && g.ch(.3)) { const [rx, ry, k] = g.pick(covRoots); x = rx; y = ry; field = COV_FIELD_OF[k]; }   // 拆掉現有的服務
      else { field = g.ch(.4) ? g.pick(BUDGET_FIELDS) : g.pick(COV_FIELDS); [x, y] = xy(); }
      if (g.ch(.3)) r = mode === 'edge' ? g.pick(ODD_R) : g.ch(.1) ? 0 : g.int(1, 20);
      ops.push(['cov', field, x, y, r, sign]);
    } else if (u < .8) {
      if (polRoots.length && g.ch(.4)) { const [x, y, k] = g.pick(polRoots); ops.push(['pol', x, y, k, sign]); }
      else { const [x, y] = xy(); ops.push(['pol', x, y, g.ch(.9) ? g.pick(POL_KINDS) : g.pick([1, 2, 4, 9, 11, 124]), sign]); }   // 不是污染源：直接返回
    } else { const [x, y] = xy(); ops.push(['tree', x, y, sign]); }
  }
  return ops;
}
// 用來挑「拆掉現有服務」的場名：本檔自己的表（跟 COV_KINDS 同出處），兩邊拿到同一串操作
const COV_FIELD_OF = Object.fromEntries(COV_KINDS.map(k => [k, ({
  4: 'park', 5: 'plant', 6: 'fire', 7: 'school', 9: 'stadium', 11: 'police', 12: 'hospital', 13: 'clinic', 14: 'library', 15: 'post', 16: 'cemetery', 28: 'ambulance',
  30: 'fire2', 31: 'prison', 32: 'university', 20: 'parking', 35: 'museum', 36: 'theater', 40: 'cinema', 41: 'grandlib', 43: 'court', 45: 'institute', 47: 'botanical',
  48: 'megahosp', 52: 'police2', 54: 'cem2', 56: 'stadium2', 61: 'fireHQ', 66: 'faith', 84: 'kindergarten', 85: 'senior', 86: 'bank', 87: 'market', 92: 'dogpark',
  93: 'icerink', 94: 'skate', 95: 'firewatch', 96: 'pool', 99: 'chapel', 102: 'vet', 104: 'cgarden', 107: 'crem', 108: 'highsch', 110: 'freight', 112: 'cpark',
  113: 'campus', 115: 'civicc', 118: 'fertco', 119: 'kitchen', 124: 'park', 125: 'park', 126: 'park', 130: 'pump', 131: 'resilience', 132: 'park', 134: 'gpark',
  135: 'medcamp', 136: 'artcamp', 137: 'admincamp', 138: 'researchcamp' })[k]]));

const make = {
  random(g) {
    const N = g.int(6, 16), tiles = genTiles(g, N, g.f(.1, .5));
    for (let s = 0, ns = g.ch(.5) ? g.int(1, 2) : 0; s < ns; s++) stadium(tiles, N, g.int(0, N - 2), g.int(0, N - 2), g);
    sprinkleRefs(g, tiles, N, .02);
    return { N, tiles, budget: budgetOf(g), edu: eduOf(g), extras: extrasOf(g, N), ops: genOps(g, N, tiles, 'random') };
  },
  // 建築貼著邊與角（裁剪），體育場放在右下角；預算只取 .5 進位邊界值，增量操作的半徑取奇數
  edge(g) {
    const N = g.int(6, 16), tiles = genTiles(g, N, .05), e = [0, 1, N - 2, N - 1];
    for (let s = 0, n = g.int(6, 16); s < n; s++) {
      const x = g.ch(.5) ? g.pick(e) : g.int(0, N - 1), y = g.ch(.5) || !e.includes(x) ? g.pick(e) : g.int(0, N - 1), t = tiles[y * N + x];
      t.bld = bld(g, g.ch(.6) ? g.pick([...BUDGET_KINDS, ...EDU_KINDS]) : randomKind(g));
      if (t.bld.k <= 3 && g.ch(.4)) t.bld.crime = 1;
    }
    stadium(tiles, N, N - 2, N - 2, g);
    if (g.ch(.5)) stadium(tiles, N, 0, g.int(0, N - 2), g);
    return { N, tiles, budget: budgetOf(g, 'edge'), edu: eduOf(g), extras: extrasOf(g, N), ops: genOps(g, N, tiles, 'edge') };
  },
  // 重污染源擠在中心：POLBASE 在重建時就撞到 255，之後的撤印從 255 往下扣（跟「真實總和」不同，夾的順序要一樣）
  saturate(g) {
    const N = g.int(10, 16), tiles = genTiles(g, N, .05), c = N >> 1;
    for (let s = 0, n = g.int(10, 18); s < n; s++) {
      const x = c + g.int(-2, 2), y = c + g.int(-2, 2), t = tiles[y * N + x];
      t.road = 0; t.rdec = 0; t.bus = 0; t.bld = bld(g, g.pick(HEAVY_POL));
    }
    for (let s = 0, n = g.int(0, 6); s < n; s++) tiles[g.int(0, N * N - 1)].tree = g.int(1, 6);
    const w = { N, tiles, budget: budgetOf(g), edu: eduOf(g), extras: extrasOf(g, N), ops: genOps(g, N, tiles, 'saturate') };
    // 再補一串「拆掉中心污染源」與再蓋回去
    const srcs = tiles.flatMap((t, i) => t.bld && !t.bld.ref && POL_KINDS.includes(t.bld.k) ? [[i % N, (i / N) | 0, t.bld.k]] : []);
    for (let s = 0, n = g.int(8, 20); s < n; s++) { const [x, y, k] = g.pick(srcs); w.ops.push(['pol', x, y, k, g.ch(.75) ? -1 : 1]); }
    return w;
  },
  // 每一種覆蓋源、污染源都輪到：第 k 個案例放 COV_KINDS／POL_KINDS 的一段（加上隨機的其他東西）
  sweep(g, k) {
    const N = g.int(8, 16), tiles = genTiles(g, N, .08);
    const want = [...COV_KINDS.slice((k * 3) % COV_KINDS.length, (k * 3) % COV_KINDS.length + 3), POL_KINDS[k % POL_KINDS.length], 126, 132];
    for (const kk of want) { const x = g.int(0, N - 1), y = g.int(0, N - 1), t = tiles[y * N + x]; t.road = 0; t.bld = bld(g, kk); }
    stadium(tiles, N, g.int(0, N - 2), g.int(0, N - 2), g);
    return { N, tiles, budget: budgetOf(g), edu: eduOf(g), extras: extrasOf(g, N), ops: genOps(g, N, tiles, 'random') };
  },
};
const BUDGET_KINDS = [11, 52, 43, 6, 30, 61, 12, 13, 28, 48, 135, 7, 32, 14, 41, 45, 138];

// 第 k 個案例（0 ≤ k < D010_COUNT）
export function cases(k) {
  let base = 0;
  for (const [name, count] of FAMILIES) {
    if (k < base + count) { const j = k - base, c = make[name](gen(seedOf(name, j)), j); c.family = name; c.j = j; return c; }
    base += count;
  }
  throw new Error(`D010 案例 ${k} 超出 ${D010_COUNT}`);
}

// 實驗線 pol 樁（eduStaticAt 讀 pol&&pol.schoolLunch）
export const labPolOf = e => e.schoolLunch ? { schoolLunch: true } : e.polNull ? null : { schoolLunch: false };
// 把 extras 寫進場（兩邊一樣：各自配置好的 Uint8Array 上照 [i,v] 填）
export function applyExtras(g, extras) {
  if (!extras) return;
  for (const name of ['NOISE', 'METRO_TOD467B', 'ACCESS468']) { const a = extras[name]; for (let j = 0; j < a.length; j += 2) g[name][a[j]] = a[j + 1]; }
}
// 增量操作的分派：op 陣列 → 呼叫哪一個函式由 fns 提供（實驗線那邊包成 vm 裡的函式，本線是 fields.ts）
export function applyOps(ops, fns) {
  for (const o of ops) {
    if (o[0] === 'cov') fns.cov(o[1], o[2], o[3], o[4], o[5]);
    else if (o[0] === 'pol') fns.pol(o[1], o[2], o[3], o[4]);
    else if (o[0] === 'tree') fns.tree(o[1], o[2], o[3]);
    else throw new Error(`未知操作 ${o[0]}`);
  }
}
// 逐格狀態：60 個覆蓋場＋POLBASE／POLTREE／POL／LANDBASE／LAND／EDU，每一張都寫成非零格的 [間隔,值,間隔,值,…]：
// 間隔＝跟上一個非零格之間跳過幾個 0（第一個從 -1 算起），格號 i＝前一個 i＋1＋間隔。無損；比直接寫格號小三倍（gzip 後）
const sparse = a => { const o = []; let p = -1; for (let i = 0; i < a.length; i++) if (a[i] !== 0) { o.push(i - p - 1, a[i]); p = i; } return o; };
export function snapshot(s) {
  const COV = {};
  for (const f of Object.keys(s.COV)) COV[f] = sparse(s.COV[f]);
  return { COV, covKeys: Object.keys(s.COV), POLBASE: sparse(s.POLBASE), POLTREE: sparse(s.POLTREE), POL: sparse(s.POL), LANDBASE: sparse(s.LANDBASE), LAND: sparse(s.LAND), EDU: sparse(s.EDU) };
}
export const hashOf = v => crypto.createHash('sha256').update(canon(v)).digest('hex').slice(0, 16);
