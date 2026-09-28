// D015 重建只換變動的部分（src/render/cityScene.ts 用）：
// 建築幾何照「件」快取（一個街區、一棟不走街區的建築、全部高架路合成一件），鍵＝決定它幾何的全部輸入；
// 牆、其他、點綴三個網格各一份常駐的頂點緩衝（Arena），每件佔一段，換掉的段清成退化三角形，只上傳改到的那幾段。
// 只讀城市，不改世界狀態（規則 2）。
import * as THREE from 'three';
import type { ArtCounts, NearJob, YardTree } from './blockArt.ts';

export type Spec = [name: string, size: number][];
// 一件在一個網格裡的頂點資料（照 spec 的順序；每個三角形 3 個頂點）
export interface Part { tris: number; a: Float32Array[] }

const MIN_CAP = 2048;          // 一個網格最少留幾個三角形的容量（新城從空的開始長）
const SPARE = 0.25;            // 首次建多留 25% 的容量
const GROW = 1.5;              // 容量不夠時放大 1.5 倍
const MAX_MOVES = 8;           // 一次重建最多把幾件從尾端搬進前面的空洞
const HOLE_LIMIT = 0.35;       // 空洞超過要畫範圍的 35% 就整份重排一次

export class Arena {
  geo!: THREE.BufferGeometry;
  cap = 0; used = 0; live = 0;                // 容量、要畫的範圍（含空洞）、真的有東西的三角形數
  owners = new Int32Array(0);                 // 點擊用：每個三角形屬於誰（街區＝−(計畫索引＋1)；0＝空洞或高架路）
  free: [number, number][] = [];              // 空洞 [起點, 三角形數]，照起點排序、相鄰的合併
  up = 0; grown = 0;                          // 這一次重建上傳了幾個位元組、放大了幾次
  private arrs: Float32Array[] = []; private attrs: THREE.BufferAttribute[] = [];
  readonly spec: Spec; private sphere: THREE.Sphere;   // Node 守衛直接載這個檔（只去型別），不用建構子參數屬性
  constructor(spec: Spec, cap: number, sphere: THREE.Sphere) { this.spec = spec; this.sphere = sphere; this.alloc(Math.max(MIN_CAP, cap), 0); }
  static capFor(tris: number) { return Math.max(MIN_CAP, Math.ceil(tris * (1 + SPARE))); }
  bytesPerTri() { return this.spec.reduce((s, [, k]) => s + k, 0) * 3 * 4; }
  // 配新的緩衝（新的 BufferGeometry：第一次畫會整份上傳）；keep＝沿用舊緩衝前面多少個三角形
  private alloc(cap: number, keep: number) {
    const old = this.arrs, oldOw = this.owners, oldGeo = this.geo;
    this.cap = cap;
    this.arrs = this.spec.map(([, s]) => new Float32Array(cap * 3 * s));
    this.owners = new Int32Array(cap);
    if (keep) { this.arrs.forEach((a, k) => a.set(old[k].subarray(0, keep * 3 * this.spec[k][1]))); this.owners.set(oldOw.subarray(0, keep)); }
    const g = new THREE.BufferGeometry();
    this.attrs = this.spec.map(([name, s], k) => { const at = new THREE.BufferAttribute(this.arrs[k], s); at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, at); return at; });
    g.boundingSphere = this.sphere.clone();   // 整張地圖的球：不用每次重算，也不會把還在畫面裡的網格剔掉
    g.setDrawRange(0, this.used * 3);
    this.geo = g;
    this.up += cap * this.bytesPerTri();
    if (oldGeo) { oldGeo.dispose(); this.grown++; }   // 舊場景不會再畫（換下來、等著丟），可以直接釋放
  }
  private mark(k: number, s: number, tris: number) {
    const sz = this.spec[k][1];
    this.attrs[k].addUpdateRange(s * 3 * sz, tris * 3 * sz); this.attrs[k].needsUpdate = true;
    this.up += tris * 3 * sz * 4;
  }
  // 放 tris 個三角形：最前面放得下的空洞，沒有就接在尾端（不夠就放大）
  place(tris: number): number {
    for (let k = 0; k < this.free.length; k++) {
      const [s, c] = this.free[k];
      if (c < tris) continue;
      if (c === tris) this.free.splice(k, 1); else this.free[k] = [s + tris, c - tris];
      return s;
    }
    if (this.used + tris > this.cap) this.alloc(Math.max(Math.ceil(this.cap * GROW), this.used + tris + MIN_CAP), this.used);
    const s = this.used; this.used += tris; this.geo.setDrawRange(0, this.used * 3);
    return s;
  }
  // 寫一件：fresh＝這份緩衝還沒上傳過（整份會一起上傳），不必記分段
  write(s: number, p: Part, owner: number, fresh = false) {
    this.spec.forEach(([, sz], k) => { this.arrs[k].set(p.a[k], s * 3 * sz); if (!fresh) this.mark(k, s, p.tris); });
    this.owners.fill(owner, s, s + p.tris); this.live += p.tris;
  }
  setOwner(s: number, tris: number, owner: number) { this.owners.fill(owner, s, s + tris); }
  // 清掉一段：位置歸零（退化三角形：不畫、不投影子、點不到）、主人歸零、記成空洞；尾端的空洞直接縮短要畫的範圍
  clear(s: number, tris: number) {
    this.arrs[0].fill(0, s * 9, (s + tris) * 9); this.mark(0, s, tris);
    this.owners.fill(0, s, s + tris); this.live -= tris;
    const f = this.free; let k = 0;
    while (k < f.length && f[k][0] < s) k++;
    f.splice(k, 0, [s, tris]);
    if (k + 1 < f.length && f[k][0] + f[k][1] === f[k + 1][0]) { f[k][1] += f[k + 1][1]; f.splice(k + 1, 1); }
    if (k > 0 && f[k - 1][0] + f[k - 1][1] === f[k][0]) { f[k - 1][1] += f[k][1]; f.splice(k, 1); }
    const last = f[f.length - 1];
    if (last && last[0] + last[1] === this.used) { this.used = last[0]; f.pop(); this.geo.setDrawRange(0, this.used * 3); }
  }
  // 把一段搬到 to（to 必須是 place 給的空位）
  move(from: number, to: number, tris: number) {
    this.spec.forEach(([, sz], k) => { this.arrs[k].copyWithin(to * 3 * sz, from * 3 * sz, (from + tris) * 3 * sz); this.mark(k, to, tris); });
    this.owners.copyWithin(to, from, from + tris); this.live += tris;
    this.clear(from, tris);
  }
  holes() { return this.free.reduce((s, [, c]) => s + c, 0); }
  // 讀出一段（整份重排用）
  read(s: number, tris: number): Part { return { tris, a: this.spec.map(([, sz], k) => this.arrs[k].slice(s * 3 * sz, (s + tris) * 3 * sz)) }; }
  // 整份重排：照 order 的順序一段一段接起來（沒有空洞；結果跟首次建逐位元組相同），換新緩衝整份上傳
  relayout(order: { s: number; tris: number; owner: number; set(s: number): void }[]) {
    const parts = order.map(o => this.read(o.s, o.tris));
    this.used = 0; this.live = 0; this.free = [];
    this.alloc(Arena.capFor(parts.reduce((t, p) => t + p.tris, 0)), 0);
    order.forEach((o, i) => { const s = this.used; this.used += parts[i].tris; this.write(s, parts[i], o.owner, true); o.set(s); });
    this.geo.setDrawRange(0, this.used * 3);
    this.grown--;   // 重排不算放大
  }
  dispose() { this.geo?.dispose(); }
}

// 一件的畫法結果（不含頂點資料：寫進 Arena 之後就不留）
export interface PieceMeta {
  yard: YardTree[];                          // 前庭樹（絕對座標）
  anchor: THREE.Vector3 | null;              // 建築量體中心／街區主體中心（測點擊用）
  counts: ArtCounts | null;                  // 街區的點綴件數（近看小物另算）
  kindUsed: string[] | null;                 // 非住商工用了哪些色
  near: NearJob | null;                      // 近看小物的底稿（hb、owner 每次重建另填）
  weather: number; facade: boolean;          // 會風化的牆三角形數、是不是英美立面街區
  ws: [number, number, number];              // 窗樣式統計：街區牆三角形、有窗、有窗但是圖集第 0 格
  box: number[] | null;                      // 包圍盒 [三角形數, x0, y0, z0, x1, y1, z1]（主人 > 0）
  tiles: Int32Array; top: Float32Array; wall: Float32Array;   // 對每格最高點、牆頂的貢獻
}
export interface Piece { key: string; owner: number; tris: number[]; slot: number[]; meta: PieceMeta }

// 件的鍵：決定它幾何的全部輸入（tools/unit-d015.mjs 逐項改一個輸入：幾何變了，鍵一定要跟著變）。
// 街區：位置、寬高、種類、等級、變體、地基高（配方、點綴、立面都只看 k、lv、w、h、v；逐戶立面開不開跟著畫法檔，換檔就清快取）
export const blockKey = (bk: { x: number; z: number; w: number; h: number; k: number; lv: number; v: number }, y0: number) => `B${bk.x}_${bk.z}_${bk.w}_${bk.h}_${bk.k}_${bk.lv}_${bk.v}_${y0}`;
// 非住商工（照造型表）：編號、種類、等級、變體、位置、大小、地基高
export const civicKey = (b: { id: number; k: number; lv: number; v: number; x: number; z: number }, s: number, y0: number) => `K${b.id}_${b.k}_${b.lv}_${b.v}_${b.x}_${b.z}_${s}_${y0}`;
// 不走街區的量體（?blocks=off）：同上＋廢棄（牆色跟著變）
export const houseKey = (b: { id: number; k: number; lv: number; v: number; x: number; z: number; abandoned: boolean }, s: number, y0: number) => `H${b.id}_${b.k}_${b.lv}_${b.v}_${b.x}_${b.z}_${s}_${y0}_${b.abandoned ? 1 : 0}`;

// 一座城一份（放在施工資料裡，換城、換畫法檔清空）
export class SceneCache {
  mode = '';
  pieces = new Map<string, Piece>();
  arenas: Arena[] | null = null;
  groundTex: THREE.DataTexture | null = null;
  trees: { key: string; tg: THREE.BufferGeometry; rg: THREE.BufferGeometry; cg: THREE.BufferGeometry; attrs: THREE.InstancedBufferAttribute[]; counts: number[]; meshes: THREE.InstancedMesh[] } | null = null;
  // 這一次重建：件數、重做幾件、上傳幾個位元組、放大幾次、搬了幾件、整份重排幾次、是不是從頭建
  stats = { pieces: 0, regen: 0, up: 0, upFull: 0, grown: 0, moved: 0, relayout: 0, fresh: false, groundUp: 0, groundFull: 0, treesKept: false };
  reset(mode: string) {
    this.mode = mode; this.pieces.clear();
    this.arenas?.forEach(a => a.dispose()); this.arenas = null;
    this.groundTex?.dispose(); this.groundTex = null;
    this.disposeTrees();
  }
  disposeTrees() {
    const t = this.trees; if (!t) return;
    for (const m of t.meshes) m.dispose();   // 釋放實例矩陣與顏色的緩衝
    for (const g of [t.tg, t.rg, t.cg]) g.dispose();
    this.trees = null;
  }
}

export { MAX_MOVES, HOLE_LIMIT };
