// 住商工的超街區切分（D004）：照抄 2D 實驗線的切分（index.html @ d23c18d），另給 A、C 兩檔的切法。
// 純函式：不 import three、不碰 DOM（卡面驗收 9）；只讀格子、不改城市（規則 2）。
// 實驗線座標 (x,y) 對到本線 (x,z)；格索引都是 z*n+x（實驗線 idx(x,y)＝y*N+x）；掃描序 y 先、x 後。
import { isVilla, type ArcheTable } from './recipes.ts';

// 一格的建築（根格才有 k/lv/v；多格建築的其他格 ref＝true，實驗線的 bld.ref）
export interface BlockCell { k: number; lv: number; v: number; ref: boolean }
export interface BlockGrid { n: number; cell(i: number): BlockCell | null }

// 從城市建出格子（只讀 occ 與 buildings）
export function gridOf(c: { n: number; occ: Int32Array; buildings: { k: number; lv: number; v: number; x: number; z: number }[] }): BlockGrid {
  const n = c.n, cells: (BlockCell | null)[] = new Array(n * n).fill(null);
  for (let i = 0; i < n * n; i++) {
    const id = c.occ[i]; if (!id) continue;
    const b = c.buildings[id - 1];
    cells[i] = { k: b.k, lv: b.lv || 1, v: b.v || 0, ref: b.x !== i % n || b.z !== ((i / n) | 0) };
  }
  return { n, cell: i => cells[i] };
}

// 注入錯誤（只給 tools/unit.mjs 驗「守衛真的會紅」用）
export interface BlockFaults { terraceDeep1?: number; noVillaRule?: boolean; noScanClaim?: boolean; drawMaxLv?: boolean }

interface Blk { w: number; h: number; k: number; lv: number; v: number }
// 逐格切分結果；欄位順序跟黃金樣本 d004-partition-*.json 一樣
export interface PartCell { i: number; origin: boolean; w: number; h: number; k: number; lv: number; v: number; olv: number; ov: number; absorbed: boolean }
export const partRow = (p: PartCell) => [p.i, p.origin ? 1 : 0, p.w, p.h, p.k, p.lv, p.v, p.olv, p.ov, p.absorbed ? 1 : 0];

export function labPartition(g: BlockGrid, arche: ArcheTable, f: BlockFaults = {}): PartCell[] {
  const n = g.n, inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;
  const at = (x: number, y: number) => (inMap(x, y) ? g.cell(y * n + x) : null);
  // rciMergeable547（70454）：同 k 就能併、等級不必相同；第一級住宅的 villa 不併（T602）
  const mergeable = (b: BlockCell | null, k: number) =>
    !!b && !b.ref && b.k === k && !(!f.noVillaRule && k === 1 && b.lv === 1 && isVilla(arche, k, b.lv, b.v));
  const same = (x: number, y: number, k: number) => inMap(x, y) && mergeable(at(x, y), k);   // rciSame547
  const isRci = (b: BlockCell | null): b is BlockCell => !!b && !b.ref && b.k >= 1 && b.k <= 3;
  // rciGrow633（70477）：先長正方形（上限 4，blockMax602），再往右、再往下；T603 聯排進深、T604 工業 2×2；cl＝已被認領的格子
  const grow = (x: number, y: number, b: BlockCell, k: number, lv: number, cl: Int32Array | null): Blk => {
    const MAXW = 4, MAXH = 4;
    const free = (tx: number, ty: number) => same(tx, ty, k) && (!cl || cl[ty * n + tx] < 0);
    let s = 1;
    while (s < Math.min(MAXW, MAXH)) { let ok = true; for (let dy = 0; dy <= s && ok; dy++) for (let dx = 0; dx <= s; dx++) if (!free(x + dx, y + dy)) ok = false; if (!ok) break; s++; }
    let bw = s, bh = s;
    while (bw < MAXW) { let ok = true; for (let dy = 0; dy < bh; dy++) if (!free(x + bw, y + dy)) { ok = false; break; } if (!ok) break; bw++; }
    while (bh < MAXH) { let ok = true; for (let dx = 0; dx < bw; dx++) if (!free(x + dx, y + bh)) { ok = false; break; } if (!ok) break; bh++; }
    if (k === 1) { const deep = lv >= 2 ? 2 : (f.terraceDeep1 ?? 1); if (bw >= bh) bh = Math.min(bh, deep); else bw = Math.min(bw, deep); }
    else if (k === 2 && lv === 1) { if (bw >= bh) bh = Math.min(bh, 2); else bw = Math.min(bw, 2); }
    if (k === 3) { bw = Math.min(bw, 2); bh = Math.min(bh, 2); }
    // 回傳區內最高等級與那格的變體（v＝q.v||v：變體 0 會沿用前一個，照抄）
    let maxLv = 1, v = b.v || 0;
    for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) { const q = at(x + dx, y + dy); if (q && (q.lv || 1) > maxLv) { maxLv = q.lv || 1; v = q.v || v; } }
    return { w: bw, h: bh, k, lv: maxLv, v };
  };
  // buildPart633（70493）：依掃描序認領（T633）
  const cl = new Int32Array(n * n).fill(-1), map = new Map<number, Blk>();
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, b = at(x, y);
    if (!isRci(b)) continue;
    const k = b.k, lv = b.lv || 1;
    if (!mergeable(b, k)) continue;
    if (x > 0 && same(x - 1, y, k)) continue;
    if (y > 0 && same(x, y - 1, k)) continue;
    const r = grow(x, y, b, k, lv, f.noScanClaim ? null : cl);
    map.set(i, r);
    for (let dy = 0; dy < r.h; dy++) for (let dx = 0; dx < r.w; dx++) cl[(y + dy) * n + x + dx] = i;
  }
  // rciBlockOrigin547（70457）
  const origin = (x: number, y: number): Blk | null => {
    const b = at(x, y);
    if (!isRci(b)) return { w: 1, h: 1, k: 0, lv: 0, v: 0 };
    const k = b.k, lv = b.lv || 1;
    if (!mergeable(b, k)) return { w: 1, h: 1, k, lv, v: b.v || 0 };
    if (x > 0 && same(x - 1, y, k)) return null;
    if (y > 0 && same(x, y - 1, k)) return null;
    return map.get(y * n + x) ?? null;
  };
  // rciAbsorbed555（71878）：不足 4 格的起點，上下左右有同類鄰居屬於 ≥4 格的街區（往左、再往上找它的起點）就不畫
  const absorbed = (x: number, y: number) => {
    const b = at(x, y);
    if (!isRci(b)) return false;
    const self = origin(x, y);
    if (!self || self.w * self.h >= 4) return false;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const nb = at(nx, ny);
      if (!nb || nb.ref || nb.k !== b.k) continue;
      let ox = nx, oy = ny;
      while (ox > 0 && same(ox - 1, oy, b.k)) ox--;
      while (oy > 0 && same(ox, oy - 1, b.k)) oy--;
      const ob = origin(ox, oy);
      if (ob && ob.w * ob.h >= 4) return true;
    }
    return false;
  };
  const out: PartCell[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const b = at(x, y);
    if (!isRci(b)) continue;
    const o = origin(x, y), ab = absorbed(x, y);
    out.push(o ? { i: y * n + x, origin: true, w: o.w, h: o.h, k: o.k, lv: o.lv, v: o.v, olv: b.lv || 1, ov: b.v || 0, absorbed: ab }
      : { i: y * n + x, origin: false, w: 0, h: 0, k: 0, lv: 0, v: 0, olv: b.lv || 1, ov: b.v || 0, absorbed: ab });
  }
  return out;
}

// ---- 三檔的畫法 ----
export type BlockMode = 'a' | 'b' | 'c';
export const BLOCK_MODES: Record<BlockMode, string> = { a: '一格一棟', b: '照實驗線', c: '超街區補滿' };
// 一個要畫的街區：x,z 是起點（左上）格；lv、v 是繪製用的等級與變體（實驗線 61581：起點那格的 bd.lv／bd.v）
export interface DrawBlock { x: number; z: number; w: number; h: number; k: number; lv: number; v: number; cells: number[]; from: 'lab' | 'fill' | 'cell' }

export function drawPlan(g: BlockGrid, arche: ArcheTable, mode: BlockMode, f: BlockFaults = {}): DrawBlock[] {
  const n = g.n, out: DrawBlock[] = [];
  const rect = (x: number, z: number, w: number, h: number) => { const a: number[] = []; for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) a.push((z + dz) * n + x + dx); return a; };
  if (mode === 'a') {
    for (let i = 0; i < n * n; i++) {
      const b = g.cell(i);
      if (b && !b.ref && b.k >= 1 && b.k <= 3) out.push({ x: i % n, z: (i / n) | 0, w: 1, h: 1, k: b.k, lv: b.lv || 1, v: b.v || 0, cells: [i], from: 'cell' });
    }
    return out;
  }
  const part = labPartition(g, arche, f);
  const lvv = (p: PartCell) => (f.drawMaxLv ? [p.lv, p.v] : [p.olv, p.ov]);
  const claimed = new Int32Array(n * n).fill(-1);
  for (const p of part) {
    if (!p.origin) continue;
    if (mode === 'b' && p.w * p.h === 1 && p.absorbed) continue;   // T555：被吸收的 1×1 不畫（C 檔照畫）
    const x = p.i % n, z = (p.i / n) | 0, [lv, v] = lvv(p);
    const cells = rect(x, z, p.w, p.h);
    for (const c of cells) claimed[c] = out.length;
    out.push({ x, z, w: p.w, h: p.h, k: p.k, lv, v, cells, from: 'lab' });
  }
  if (mode === 'b') return out;
  // C：實驗線沒人畫的 D0 格，依掃描序當新起點，用同一套長法（rciGrow633，帶認領）補切；畫法用這個新起點自己的等級與變體
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;
  const at = (x: number, y: number) => (inMap(x, y) ? g.cell(y * n + x) : null);
  const mergeable = (b: BlockCell | null, k: number) => !!b && !b.ref && b.k === k && !(k === 1 && b.lv === 1 && isVilla(arche, k, b.lv, b.v));
  const free = (x: number, y: number, k: number) => inMap(x, y) && mergeable(at(x, y), k) && claimed[y * n + x] < 0;
  for (const p of part) {
    if (claimed[p.i] >= 0) continue;
    const x = p.i % n, z = (p.i / n) | 0, b = at(x, z)!, k = b.k, lv = b.lv || 1;
    let s = 1;
    while (s < 4) { let ok = true; for (let dy = 0; dy <= s && ok; dy++) for (let dx = 0; dx <= s; dx++) if (!free(x + dx, z + dy, k)) ok = false; if (!ok) break; s++; }
    let bw = s, bh = s;
    while (bw < 4) { let ok = true; for (let dy = 0; dy < bh; dy++) if (!free(x + bw, z + dy, k)) { ok = false; break; } if (!ok) break; bw++; }
    while (bh < 4) { let ok = true; for (let dx = 0; dx < bw; dx++) if (!free(x + dx, z + bh, k)) { ok = false; break; } if (!ok) break; bh++; }
    if (k === 1) { const deep = lv >= 2 ? 2 : 1; if (bw >= bh) bh = Math.min(bh, deep); else bw = Math.min(bw, deep); }
    else if (k === 2 && lv === 1) { if (bw >= bh) bh = Math.min(bh, 2); else bw = Math.min(bw, 2); }
    if (k === 3) { bw = Math.min(bw, 2); bh = Math.min(bh, 2); }
    const cells = rect(x, z, bw, bh);
    for (const c of cells) claimed[c] = out.length;
    out.push({ x, z, w: bw, h: bh, k, lv, v: b.v || 0, cells, from: 'fill' });
  }
  return out;
}

// 統計（卡面驗收 2）：住商工格分四類——畫在多格街區、單格、被吸收、D0 沒人畫；重疊格數必須是 0
export function partitionStats(part: PartCell[], n: number) {
  const cover = new Map<number, number>();
  let blocks = 0, multi = 0, inMulti = 0, single = 0, absorbed = 0;
  for (const p of part) {
    if (!p.origin) continue;
    blocks++;
    if (p.w * p.h > 1) { multi++; inMulti += p.w * p.h; }
    else if (p.absorbed) absorbed++; else single++;
    const x = p.i % n, z = (p.i / n) | 0;
    for (let dz = 0; dz < p.h; dz++) for (let dx = 0; dx < p.w; dx++) { const c = (z + dz) * n + x + dx; cover.set(c, (cover.get(c) || 0) + 1); }
  }
  const overlap = [...cover.values()].filter(v => v > 1).length;
  const d0 = part.filter(p => !cover.has(p.i)).length;
  return { rci: part.length, blocks, multi, cells: { inMulti, single, absorbed, d0 }, overlap };
}
