// 服務覆蓋、污染、地價、教育四個逐格場（D010）：照實驗線原式逐行搬，運算順序不動（浮點逐位元相等）。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d（index.html 行號）。對拍見 tools/lab-fields.mjs、tools/unit-d010-fields.mjs。
// 實驗線這些場都是全域 Uint8Array；這裡收進 Grids，型別照舊（Uint8Array 的 += 取模 256、存小數截尾都是公式的一部分）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { clamp, idx, tq, type World, type Fields } from './lab.ts';
import { landStaticAt } from './land.ts';

// 52957＋52958＋52959：覆蓋半徑（Chebyshev 方框）；60 個場，插入順序同實驗線
export const COVR: Record<string, number> = {
  park: 4, plant: 4, fire: 9, school: 8, stadium: 10, police: 10, hospital: 12, clinic: 6, library: 6, post: 8, cemetery: 10, bus: 6, rdec: 2,
  ambulance: 10, fire2: 12, prison: 8, university: 10, parking: 8, museum: 8, theater: 7, cinema: 6, grandlib: 12, court: 10, institute: 8,
  botanical: 10, megahosp: 18, police2: 5, cem2: 16, stadium2: 16, fireHQ: 16, faith: 8, kindergarten: 6, senior: 6, bank: 5, market: 5,
  dogpark: 4, icerink: 6, skate: 5, firewatch: 6, pool: 6, chapel: 5, vet: 5, cgarden: 4, crem: 12, highsch: 10, freight: 8, cpark: 8,
  campus: 12, civicc: 9, fertco: 10, kitchen: 8,
};
Object.assign(COVR, { pump: 6, resilience: 10, shelter: 7, play: 4, gpark: 12 });                 // 52958（T364c/d、T465）
Object.assign(COVR, { medcamp: 24, artcamp: 16, admincamp: 16, researchcamp: 18 });              // 52959（T466）

// 52967：四類服務預算（T294）縮放的場
export const SVC_BUDGET_CAT: Record<string, 'police' | 'fire' | 'health' | 'edu'> = {
  police: 'police', police2: 'police', court: 'police', fire: 'fire', fire2: 'fire', fireHQ: 'fire',
  hospital: 'health', clinic: 'health', ambulance: 'health', megahosp: 'health', medcamp: 'health',
  school: 'edu', university: 'edu', library: 'edu', grandlib: 'edu', institute: 'edu', researchcamp: 'edu',
};
export interface SvcBudget { police: number; fire: number; health: number; edu: number }
// 52966：預設全 1（存檔欄位 sb，缺省 1）；實驗線 setSvcBudget（52968）夾在 .5–1.5、toFixed(2)
export const SVC_BUDGET_DEFAULT: SvcBudget = { police: 1, fire: 1, health: 1, edu: 1 };

// 52962：種類 → 覆蓋場
const COV_FIELD_BASE: Record<number, string> = {
  4: 'park', 5: 'plant', 6: 'fire', 7: 'school', 9: 'stadium', 11: 'police', 12: 'hospital', 13: 'clinic', 14: 'library', 15: 'post', 16: 'cemetery',
  28: 'ambulance', 30: 'fire2', 31: 'prison', 32: 'university', 20: 'parking', 35: 'museum', 36: 'theater', 40: 'cinema', 41: 'grandlib', 43: 'court',
  45: 'institute', 47: 'botanical', 48: 'megahosp', 52: 'police2', 54: 'cem2', 56: 'stadium2', 61: 'fireHQ', 66: 'faith', 84: 'kindergarten',
  85: 'senior', 86: 'bank', 87: 'market', 92: 'dogpark', 93: 'icerink', 94: 'skate', 95: 'firewatch', 96: 'pool', 99: 'chapel', 102: 'vet',
  104: 'cgarden', 107: 'crem', 108: 'highsch', 110: 'freight', 112: 'cpark', 113: 'campus', 115: 'civicc', 118: 'fertco', 119: 'kitchen',
};
const covFieldOfKBase = (k: number): string | null => COV_FIELD_BASE[k] || null;
// 52975–52976：實驗線用新的箭頭函式蓋掉 covFieldOfK，124–138 先查這張表，查不到才回到 52962
const COV_FIELD_OVERRIDE: Record<number, string> = {
  124: 'park', 125: 'park', 126: 'park', 130: 'pump', 131: 'resilience', 132: 'park', 134: 'gpark', 135: 'medcamp', 136: 'artcamp', 137: 'admincamp', 138: 'researchcamp',
};
export function covFieldOfK(k: number): string | null { return COV_FIELD_OVERRIDE[k] ?? covFieldOfKBase(k); }

// 52991＋52992：污染源（半徑 r、中心峰值 p）
export const POL_SRC: Record<number, { r: number; p: number }> = {
  3: { r: 5, p: 30 }, 5: { r: 6, p: 40 }, 8: { r: 5, p: 26 }, 19: { r: 6, p: 34 }, 62: { r: 7, p: 44 }, 100: { r: 3, p: 12 }, 107: { r: 2, p: 8 },
  114: { r: 8, p: 40 }, 117: { r: 4, p: 22 }, 118: { r: 3, p: 14 },
};
Object.assign(POL_SRC, { 140: { r: 6, p: 22 }, 141: { r: 3, p: 12 }, 142: { r: 4, p: 15 }, 170: { r: 4, p: 18 }, 171: { r: 4, p: 14 }, 173: { r: 5, p: 18 }, 174: { r: 6, p: 20 } });   // 52992（T471 等）

// 實驗線的全域場（52960 COV、52990 POL／POLBASE／POLTREE、53020 NOISE、53066 LAND／LANDBASE、53127 EDU 等），配置見 allocGrids（56931）
export interface Grids {
  N: number; COV: Record<string, Uint8Array>; POL: Uint8Array; POLBASE: Uint8Array; POLTREE: Uint8Array;
  LANDBASE: Uint8Array; LAND: Uint8Array; EDU: Uint8Array; NOISE: Uint8Array; commutePenalty: Float32Array; METRO_TOD467B: Uint8Array; ACCESS468: Uint8Array;
}
// 52960／56931–56947：每個 COVR 場一張 Uint8Array(N*N)，其他場全 0
export function allocGrids(N: number): Grids {
  const n = N * N, COV: Record<string, Uint8Array> = {};
  for (const f in COVR) COV[f] = new Uint8Array(n);
  return {
    N, COV, POL: new Uint8Array(n), POLBASE: new Uint8Array(n), POLTREE: new Uint8Array(n),
    LANDBASE: new Uint8Array(n), LAND: new Uint8Array(n), EDU: new Uint8Array(n), NOISE: new Uint8Array(n),
    commutePenalty: new Float32Array(n), METRO_TOD467B: new Uint8Array(n), ACCESS468: new Uint8Array(n),
  };
}

// 52977：Chebyshev 半徑 r 方框逐格 ±delta（邊界裁剪，可重疊計數）。有預算類別的場先把半徑乘預算四捨五入（至少 1）；Uint8Array 的 += 取模 256
export function stampCov(g: Grids, budget: SvcBudget, field: string, x: number, y: number, r: number, delta: number): void {
  const cat = SVC_BUDGET_CAT[field]; if (cat) r = Math.max(1, Math.round(r * budget[cat]));
  const a = g.COV[field], N = g.N;
  for (let dy = -r; dy <= r; dy++) { const ny = y + dy; if (ny < 0 || ny >= N) continue;
    for (let dx = -r; dx <= r; dx++) { const nx = x + dx; if (nx < 0 || nx >= N) continue; a[ny * N + nx] += delta; } }   // idx(nx,ny)＝ny*N+nx（39731）
}

// 52994：POL＝POLBASE−POLTREE，夾 0..255
export function recomputePol(g: Grids, i: number): void { const v = g.POLBASE[i] - g.POLTREE[i]; g.POL[i] = v > 0 ? (v < 255 ? v : 255) : 0; }

// 52996：污染源中心強、半徑遞減（Chebyshev）；POLBASE 每一格先夾 0..255 再重算 POL（夾的順序決定飽和後撤印的結果）
export function stampPolSrc(g: Grids, x: number, y: number, k: number, sign: number): void {
  const cfg = POL_SRC[k]; if (!cfg) return; const r = cfg.r, p = cfg.p, N = g.N;
  for (let dy = -r; dy <= r; dy++) { const ny = y + dy; if (ny < 0 || ny >= N) continue;
    for (let dx = -r; dx <= r; dx++) { const nx = x + dx; if (nx < 0 || nx >= N) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const v = Math.round(p * (1 - d / (r + 1))); if (v <= 0) continue;
      const i = ny * N + nx;
      g.POLBASE[i] = clamp(g.POLBASE[i] + sign * v, 0, 255); recomputePol(g, i);
    } }
}

// 53007：樹格對 5×5 鄰域固定 −2（POLTREE 累計，夾 0..255）
export function stampPolTree(g: Grids, x: number, y: number, sign: number): void {
  const r = 2, N = g.N;
  for (let dy = -r; dy <= r; dy++) { const ny = y + dy; if (ny < 0 || ny >= N) continue;
    for (let dx = -r; dx <= r; dx++) { const nx = x + dx; if (nx < 0 || nx >= N) continue;
      const i = ny * N + nx;
      g.POLTREE[i] = clamp(g.POLTREE[i] + sign * 2, 0, 255); recomputePol(g, i);
    } }
}

// 53128：教育權重
const EDU_W_SCHOOL = 50, EDU_W_UNI = 90, EDU_W_LIB = 35;
// 教育場的外部輸入：科技（tech343.done）、城市特化（spec386）、營養午餐政策（pol.schoolLunch）
export interface EduCtx { tech: readonly string[]; spec: string | null; schoolLunch: boolean }
// 53129：學校／大學／圖書館／高中／大學城／研究園區覆蓋各自加分，乘科技與特化係數後四捨五入、封頂 255
export function eduStaticAt(g: Grids, x: number, y: number, e: EduCtx): number {
  const i = y * g.N + x, COV = g.COV;   // idx(x,y)（39731）
  const sq = (id: string, on: number, off: number) => e.spec === id ? on : off;   // 37851
  const v = (COV.school[i] > 0 ? Math.round(EDU_W_SCHOOL * (e.schoolLunch ? 1.25 : 1)) : 0) + (COV.university[i] > 0 ? EDU_W_UNI : 0) + (COV.library[i] > 0 ? EDU_W_LIB : 0)
    + ((COV.highsch && COV.highsch[i] > 0) ? 70 : 0) + ((COV.campus && COV.campus[i] > 0) ? 120 : 0) + ((COV.researchcamp && COV.researchcamp[i] > 0) ? 140 : 0);
  return Math.min(255, Math.round(v * tq(e.tech, 'C1', 1.05, 1) * tq(e.tech, 'C4a', 1.15, 1) * tq(e.tech, 'C4b', 1.08, 1) * tq(e.tech, 'D7', 1.10, 1) * sq('edu', 1.08, 1)));
}

// D009 公式讀的場（landStaticAt、judgeWealth、住宅幸福……）：同一批陣列的視圖，不複製
export function fieldsOf(g: Grids): Fields {
  return { COV: g.COV, LAND: g.LAND, POL: g.POL, NOISE: g.NOISE, EDU: g.EDU, commutePenalty: g.commutePenalty, METRO_TOD467B: g.METRO_TOD467B, ACCESS468: g.ACCESS468 };
}

// tick() 54996–55001 的全圖分支（landBox＝null）：LANDBASE 逐格重算；存進 Uint8Array＝小數截尾。
// 實驗線這一支先跑 rebuildNoise(null)（53023）；噪音沒搬，NOISE 維持呼叫端給的值。
export function rebuildLandBase(w: World, g: Grids): void {
  const f = fieldsOf(g), N = g.N;
  for (let i = 0; i < N * N; i++) g.LANDBASE[i] = landStaticAt(w, f, i % N, (i / N) | 0);
}

// 53098（tick 55002 每天呼叫）：LAND＝LANDBASE 扣壅堵。道路負載沒搬（全 0），實驗線這時走快路徑 LAND.set(LANDBASE)
export function recomputeLandDynamic(g: Grids): void {
  g.LAND.set(g.LANDBASE);
}

// 53135–53157：全量重建（讀檔、新圖、復原後）。清零 → 掃全圖蓋印 → LANDBASE → LAND → EDU。
// 實驗線同時清 landDirty／landBox（53154），這裡沒有髒標記，呼叫端自己決定何時 rebuildLandBase。
export function rebuildCov(w: World, g: Grids, budget: SvcBudget, e: EduCtx): void {
  if (w.N !== g.N) throw new Error(`rebuildCov：地圖 ${w.N} 與場 ${g.N} 尺寸不同`);
  const N = g.N;
  for (const f in g.COV) g.COV[f].fill(0);
  g.POLBASE.fill(0); g.POLTREE.fill(0); g.POL.fill(0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = w.tiles[idx(w, x, y)], b = t.bld;
    if (b) {
      if (b.ref) { if (b.k === 9) stampCov(g, budget, 'stadium', x, y, COVR.stadium, 1); }   // 體育場 2×2 的三個附屬格也是覆蓋源
      else {
        const f = covFieldOfK(b.k); if (f) stampCov(g, budget, f, x, y, COVR[f], 1);
        if (b.k === 126) stampCov(g, budget, 'play', x, y, COVR.play, 1);        // T364c 遊樂場附加
        if (b.k === 132) stampCov(g, budget, 'shelter', x, y, COVR.shelter, 1);  // T364d 避難公園附加
        if (POL_SRC[b.k]) stampPolSrc(g, x, y, b.k, 1);
      }
    }
    if (t.rdec) stampCov(g, budget, 'rdec', x, y, COVR.rdec, 1);
    if (t.bus) stampCov(g, budget, 'bus', x, y, COVR.bus, 1);
    if (t.tree) stampPolTree(g, x, y, 1);
  }
  const f = fieldsOf(g);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.LANDBASE[idx(w, x, y)] = landStaticAt(w, f, x, y);   // Uint8Array 存值＝截尾
  recomputeLandDynamic(g);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.EDU[idx(w, x, y)] = eduStaticAt(g, x, y, e);
}
