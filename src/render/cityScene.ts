// 城市場景（D003）：只讀 City，建出 three.js 場景；不回頭改城市（CLAUDE.md 規則 2）。
// 建築是量體佔位：高度量自 2D 實驗線的精靈圖（src/content/lab-kinds.json），外形只分幾類；逐種配方是 D004 的事。
// 畫面全部由程式生成，沒有任何外部素材（CLAUDE.md 規則 7）。
import * as THREE from 'three';
import type { City, CityBuilding } from '../sim/city.ts';
import { hash2 } from '../sim/rng.ts';
import type { Style } from './styles.ts';
import { Geo } from './scene.ts';
import { windowTexture, toonRamp, PLAIN_UV } from './textures.ts';
import type { BlockMode, DrawBlock } from '../content/blocks.ts';
import type { Recipe } from '../content/recipes.ts';
import type { Dressing } from '../content/dressing.ts';
import { drawBlock, emptyCounts, type ArtCounts, type YardTree } from './blockArt.ts';
import { windowAtlas, patchWindowMaterial } from './windows.ts';
import { paintGround, groundCellPx } from './ground.ts';
import { drawKind } from './kindArt.ts';
import type { Shape, KindColors } from '../content/kindShapes.ts';

export interface KindLook { cat(k: number): string; catColor(cat: string): string; height(k: number, lv: number, v?: number): number }
export interface CityHit { id: number; x: number; z: number; block?: number }
// D004：住商工改用街區配方畫（?blocks=a|b|c）。plan＝要畫的街區（src/content/blocks.ts），recipe＝每個街區的配方（src/content/recipes.ts）
export interface BlockRender { mode: BlockMode; plan: DrawBlock[]; recipe(b: DrawBlock): Recipe; dress(b: DrawBlock): Dressing }
// D007：非住商工照造型表畫（街區模式才有；?blocks=off 仍是 D003 的量體佔位）
export interface CivicRender { colors(k: number, lv: number): KindColors; shape(k: number): Shape | null }
export interface BuiltCity {
  scene: THREE.Scene;
  pick(ray: THREE.Raycaster): CityHit | null;
  owners(): number;                                   // 場景裡實際畫出來的建築數（守衛：要等於城市的建築數）
  anchorOf(id: number): THREE.Vector3 | null;        // 建築量體的中心（測點擊用）
  blocksDrawn(): number[];                           // D004：幾何裡真的有三角形的街區（plan 的索引）
  blockAnchor(i: number): THREE.Vector3 | null;      // D004：街區主體量體的中心（測點擊用）
  artCounts(): ArtCounts;                            // D005：實際畫出的點綴件數（守衛：要等於擺放計畫）
  groundAt(x: number, z: number): number[];          // D005：地面貼圖那一格的 S×S 個像素 RGB（守衛：地坪色、非住商工格不變）
  wallStyles(): { blockTris: number; windowed: number; style0Windowed: number };
  meshStats(): { name: string; tris: number; shadow: boolean }[];
  ownerBoxes(): Record<number, number[]>;
  kindColorsUsed(): Record<number, string[]>;           // D007：每棟建築（owner＞0）的三角形數與包圍盒 [tris, x0, y0, z0, x1, y1, z1]（守衛：不出界、高度）
  groundData(): { S: number; W: number; rgba: Uint8Array };        // D006：整張地面貼圖（守衛逐像素驗色族、人行道、車道線）   // 每個網格的三角形數（實例網格乘實例數）、投不投影子：手機預算用   // D005：街區牆面三角形裡，有窗的都不是圖集第 0 格
  timing: Record<string, number>;
  dispose(): void;
}

export const EL_H = 0.4;          // 高地抬高幾格
export const WATER_Y = -0.06;     // 水面略低於地面，岸邊才有一道邊
const BASE_Y = -0.45;             // 地圖邊緣底座的底

const C = (h: number, s: number, l: number) => new THREE.Color().setHSL(h / 360, s, l, THREE.SRGBColorSpace);
const hex = (s: string) => new THREE.Color(s);

// 每格的地面高度：橋面跟地面齊平；水面略低；高地抬高
export function tileTop(c: City, i: number): number {
  const r = c.road[i];
  if (r === 2 || r === 4) return 0.02;
  if (c.ter[i] === 0) return WATER_Y;
  return c.el[i] ? EL_H : 0;
}

// 地面貼圖：每格 S×S 像素；逐像素顏色在 ground.ts（D006：顏色取自實驗線、草皮格線、人行道、車道線）
function groundTexture(c: City, look: KindLook, S: number, lots?: Uint8Array, plates?: Int32Array): THREE.DataTexture {
  const W = c.n * S, t = new THREE.DataTexture(paintGround(c, k => look.cat(k), S, lots, plates), W, W, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// 牆色：依分類；住宅低樓層是紅磚、高樓偏米白；商業偏冷色玻璃；工業是金屬灰
function wallColor(b: CityBuilding, cat: string, H: number): THREE.Color {
  const t = hash2(b.x, b.z, 31);
  let col: THREE.Color;
  switch (cat) {
    case 'R': col = H > 3 ? C(35 + t * 15, 0.2, 0.74 + t * 0.06) : C(8 + t * 24, 0.42 + t * 0.14, 0.5 + t * 0.08); break;
    case 'C': col = C(200 + t * 22, 0.28, 0.6 + t * 0.1); break;
    case 'I': col = C(38 + t * 12, 0.12, 0.56 + t * 0.08); break;
    case 'H': col = C(0, 0, 0.9); break;
    case 'D': col = C(40, 0.35, 0.78); break;
    case 'A': col = C(45, 0.3, 0.8); break;
    case 'S': col = C(0, 0, 0.78); break;
    default: col = C(205, 0.1, 0.64 + t * 0.06);
  }
  if (b.abandoned) col.lerp(C(35, 0.12, 0.42), 0.45);
  return col;
}

// D006 立面明暗（只給 2D 城市模式；300 年示範有自己的場景）：a＝D005 現況；b＝背光面壓暗（三階中間階 175→120、天光 1.1→0.9）；c＝b 再把太陽 2.2→2.6；d＝只壓暗背光面
export type Tone = 'a' | 'b' | 'c' | 'd';
export const TONES: Record<Tone, { ramp: [number, number, number]; hemi: number; sun: number }> = {
  a: { ramp: [90, 175, 255], hemi: 1.1, sun: 2.2 },
  b: { ramp: [90, 120, 255], hemi: 0.9, sun: 2.2 },
  c: { ramp: [90, 120, 255], hemi: 0.9, sun: 2.6 },
  d: { ramp: [80, 125, 255], hemi: 1.1, sun: 2.2 },   // 施工中加的第四檔：只壓暗背光面，受光面與天光同 a（c 的太陽太強，米白牆被削成粉紅）
};
export function buildCityScene(c: City, look: KindLook, style: Style, blocks?: BlockRender, tone: Tone = 'a', civic?: CivicRender): BuiltCity {
  const TN = TONES[tone];
  const n = c.n, nn = n * n, scene = new THREE.Scene();
  const T: Record<string, number> = {}; let tp = performance.now(); const mark = (k: string) => { const q = performance.now(); T[k] = q - tp; tp = q; };
  scene.background = new THREE.Color().setHSL(0.58, 0.35, 0.82, THREE.SRGBColorSpace);
  const disposables: { dispose(): void }[] = [];
  const ramp = style.toon ? toonRamp(TN.ramp) : null;
  if (ramp) disposables.push(ramp);
  const mat = (opts: { map?: THREE.Texture; vertexColors?: boolean; color?: THREE.ColorRepresentation }) => {
    const m = style.toon ? new THREE.MeshToonMaterial({ ...opts, gradientMap: ramp! }) : new THREE.MeshStandardMaterial({ ...opts, roughness: 0.92, metalness: 0 });
    disposables.push(m); return m;
  };

  // ---- 地面：每格一片頂面（貼圖），高低差處補直立的岸／崖面，地圖四周補一圈底座 ----
  const S = groundCellPx(n);   // D006：每格 8 像素（地圖 ≤128 格），貼圖邊長 ≤1,024
  // D005：街區蓋到的格依 k 鋪地坪（villa 是庭院）；沒畫到的住商工格（B 檔的 D0、被吸收）是草坪
  let lots: Uint8Array | undefined;
  if (blocks) {
    lots = new Uint8Array(nn);
    for (let i = 0; i < nn; i++) { const b = c.occ[i] ? c.buildings[c.occ[i] - 1] : null; if (b && b.k >= 1 && b.k <= 3) lots[i] = 5; }
    for (const bk of blocks.plan) { const lot = blocks.recipe(bk).villa ? 4 : bk.k; for (const i of bk.cells) lots[i] = lot; }
  }
  // D007：非住商工建築的格子鋪實驗線精靈圖的地坪色
  let plates: Int32Array | undefined;
  if (civic) {
    plates = new Int32Array(nn).fill(-1);
    for (const b of c.buildings) {
      if (b.k <= 3 || !civic.shape(b.k)) continue;
      const pc = parseInt(civic.colors(b.k, b.lv).plate.slice(1), 16);
      for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) if (b.x + dx < n && b.z + dz < n) plates[(b.z + dz) * n + b.x + dx] = pc;
    }
  }
  const gtex = groundTexture(c, look, S, lots, plates); disposables.push(gtex);
  const top = new Float32Array(nn);
  for (let i = 0; i < nn; i++) top[i] = tileTop(c, i);
  const gp: number[] = [], guv: number[] = [];
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const y = top[z * n + x], u0 = x / n, u1 = (x + 1) / n, v0 = z / n, v1 = (z + 1) / n;
    gp.push(x, y, z, x, y, z + 1, x + 1, y, z + 1, x, y, z, x + 1, y, z + 1, x + 1, y, z);
    guv.push(u0, v0, u0, v1, u1, v1, u0, v0, u1, v1, u1, v0);
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gg.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2));
  gg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(gp.length).map((_, j) => (j % 3 === 1 ? 1 : 0)), 3));
  const ground = new THREE.Mesh(gg, mat({ map: gtex }));
  ground.receiveShadow = true; disposables.push(gg); scene.add(ground);

  const cliff = new Geo();
  const bank = C(35, 0.28, 0.42), rock = C(28, 0.2, 0.36), soil = C(30, 0.25, 0.3);
  const side = (hi: number, lo: number, a: [number, number], b: [number, number], nrm: [number, number, number], col: THREE.Color) =>
    cliff.quad([a[0], lo, a[1]], [b[0], lo, b[1]], [b[0], hi, b[1]], [a[0], hi, a[1]], nrm, col);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const y = top[z * n + x];
    if (x + 1 < n) { const y2 = top[z * n + x + 1]; if (y !== y2) side(Math.max(y, y2), Math.min(y, y2), [x + 1, z], [x + 1, z + 1], [y > y2 ? 1 : -1, 0, 0], Math.max(y, y2) >= EL_H ? rock : bank); }
    if (z + 1 < n) { const y2 = top[(z + 1) * n + x]; if (y !== y2) side(Math.max(y, y2), Math.min(y, y2), [x, z + 1], [x + 1, z + 1], [0, 0, y > y2 ? 1 : -1], Math.max(y, y2) >= EL_H ? rock : bank); }
    if (x === 0) side(y, BASE_Y, [0, z], [0, z + 1], [-1, 0, 0], soil);
    if (x === n - 1) side(y, BASE_Y, [n, z], [n, z + 1], [1, 0, 0], soil);
    if (z === 0) side(y, BASE_Y, [x, 0], [x + 1, 0], [0, 0, -1], soil);
    if (z === n - 1) side(y, BASE_Y, [x, n], [x + 1, n], [0, 0, 1], soil);
  }
  const cliffMesh = new THREE.Mesh(cliff.geometry(), mat({ vertexColors: true }));
  cliffMesh.receiveShadow = true; disposables.push(cliffMesh.geometry); scene.add(cliffMesh);
  mark('ground');

  // ---- 建築量體 ----
  const Wg = new Geo({ ext: !!blocks }), Og = new Geo(), Dg = new Geo();
  const kindUsed: Record<number, string[]> = {};   // D007：每棟非住商工用了哪些色（守衛）
  const yard: YardTree[] = [], treeOwners: [number, number, number][] = [];   // 前庭的樹（D005 街區、D007 非住商工共用）；treeOwners＝哪棟建築擁有哪一段樹（守衛用）
  const anchors = new Map<number, THREE.Vector3>();
  const RCI = new Set(['R', 'C', 'I']);
  for (const b of c.buildings) {
    const cat = look.cat(b.k), s = b.size, root = Math.min(nn - 1, b.z * n + b.x);
    if (b.x + s > n || b.z + s > n) continue;                  // 出界的建築不畫（城市模型已計數）
    if (blocks && b.k >= 1 && b.k <= 3) continue;               // D004：住商工交給街區配方（下面）
    const shape = civic && b.k > 3 ? civic.shape(b.k) : null;
    if (shape) {                                               // D007：非住商工照造型表畫
      Wg.owner = Og.owner = Dg.owner = b.id;
      let y0 = 0;
      for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) y0 = Math.max(y0, top[(b.z + dz) * n + b.x + dx]);
      const H = Math.max(0.12, look.height(b.k, b.lv, b.v));
      const t0 = yard.length;
      kindUsed[b.id] = [...drawKind({ W: Wg, O: Og, D: Dg, trees: yard, x0: b.x, z0: b.z, s, y0, H, k: b.k, C: civic!.colors(b.k, b.lv) }, shape)];
      if (yard.length > t0) treeOwners.push([b.id, t0, yard.length]);
      anchors.set(b.id, new THREE.Vector3(b.x + s / 2, y0 + H / 2, b.z + s / 2));
      continue;
    }
    Wg.owner = Og.owner = b.id;
    const H = Math.max(0.12, look.height(b.k, b.lv, b.v)), y0 = Math.max(0, top[root]);
    const m = s === 1 ? (RCI.has(cat) ? 0.17 : 0.1) : 0.12 * s, x0 = b.x + m, z0 = b.z + m, x1 = b.x + s - m, z1 = b.z + s - m, cx = b.x + s / 2, cz = b.z + s / 2;
    const wall = wallColor(b, cat, H), roofDark = C(210, 0.08, 0.34), flat = C(30, 0.06, 0.5);
    let yTop: number;
    if (H < 0.35) {                                            // 貼地的：農田、公園、太陽能板、廣場
      const topCol = cat === 'G' ? C(110, 0.4, 0.42) : cat === 'F' ? C(70, 0.45, 0.5) : cat === 'E' ? C(220, 0.45, 0.28) : C(35, 0.1, 0.7);
      yTop = y0 + Math.max(0.06, H * 0.6);
      Og.box(x0, z0, x1, z1, y0, yTop, wall, topCol, null);
    } else if (H <= 2.4 && (cat === 'R' || (!RCI.has(cat) && H <= 1.4))) {   // 矮房子：帶窗的牆＋山牆屋頂
      const wh = H * 0.78; yTop = y0 + H;
      Wg.box(x0, z0, x1, z1, y0, y0 + wh, wall, null, { floorH: 0.3 });
      Og.gable(x0, z0, x1, z1, y0 + wh, H - wh, cat === 'R' ? C(355 + hash2(b.x, b.z, 32) * 12, 0.35, 0.32) : roofDark, wall);
    } else if (H > 3) {                                        // 高樓：裙樓＋收窄的塔身＋屋頂設備
      const ph = Math.min(1, H * 0.18), t = (x1 - x0) * 0.16;
      yTop = y0 + H;
      Wg.box(x0, z0, x1, z1, y0, y0 + ph, wall, flat, { floorH: 0.3 });
      Wg.box(x0 + t, z0 + t, x1 - t, z1 - t, y0 + ph, yTop, cat === 'C' ? C(205, 0.3, 0.68) : wall.clone().offsetHSL(0, -0.05, 0.05), roofDark, { floorH: 0.3 });
      Og.box(cx - 0.14, cz - 0.14, cx + 0.14, cz + 0.14, yTop, yTop + 0.16, C(0, 0, 0.7), C(0, 0, 0.8), null);
    } else {                                                   // 中型：平頂盒；工業加一支煙囪
      yTop = y0 + H;
      Wg.box(x0, z0, x1, z1, y0, yTop, wall, cat === 'I' ? roofDark : flat, { floorH: cat === 'I' ? 0.4 : 0.3 });
      if (cat === 'I') Og.cylinder(x1 - 0.18, z0 + 0.18, 0.07, 0.05, yTop, 0.45, C(0, 0, 0.72), 6);
    }
    if (!RCI.has(cat)) {                                       // 分類色環（參考實驗線 T345 的類別色環，讓遠看也分得出是什麼設施）
      const band = hex(look.catColor(cat));
      Og.box(x0 - 0.03, z0 - 0.03, x1 + 0.03, z1 + 0.03, y0, y0 + 0.07, band, band, null);
    }
    anchors.set(b.id, new THREE.Vector3(cx, (y0 + yTop) / 2, cz));
  }
  // D004 街區：三角形的 owner 記成 −(街區索引＋1)，點擊時再換回點到的那一格
  const blockAnchors: (THREE.Vector3 | null)[] = [], counts = emptyCounts();
  if (blocks) blocks.plan.forEach((bk, bi) => {
    Wg.owner = Og.owner = Dg.owner = -(bi + 1);
    let y0 = 0;
    for (const i of bk.cells) y0 = Math.max(y0, top[i]);
    blockAnchors[bi] = drawBlock(Wg, Og, Dg, bk, blocks.recipe(bk), blocks.dress(bk), y0, yard, counts);
  });
  Wg.owner = Og.owner = Dg.owner = 0;
  // 高架路：路面抬高、每兩格一根橋墩
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const i = z * n + x;
    if (!c.fly[i] || !c.road[i]) continue;
    const y = Math.max(0, top[i]) + 0.42;
    Og.box(x, z, x + 1, z + 1, y, y + 0.08, C(0, 0, 0.62), C(0, 0, 0.36), null);
    if ((x + z) % 2 === 0) Og.box(x + 0.44, z + 0.44, x + 0.56, z + 0.56, Math.max(0, top[i]), y, C(0, 0, 0.6), null, null);
  }
  // D005：街區模式的牆用窗磚圖集（第 0 格＝D003 窗磚，非住商工畫面不變）；D003 模式照舊用單張窗磚
  const texW = blocks ? windowAtlas() : windowTexture(); disposables.push(texW);
  // D007：逐棟包圍盒（建幾何之前先從累積器算，之後就不用再讀 GPU 緩衝）
  const boxes: Record<number, number[]> = {};
  for (const g of [Wg, Og, Dg]) for (let t = 0; t < g.owners.length; t++) {
    const id = g.owners[t]; if (id <= 0) continue;
    const bb = boxes[id] ??= [0, Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    bb[0]++;
    for (let j = 0; j < 3; j++) { const q = (t * 3 + j) * 3; for (let a = 0; a < 3; a++) { const v = g.pos[q + a]; if (v < bb[1 + a]) bb[1 + a] = v; if (v > bb[4 + a]) bb[4 + a] = v; } }
  }
  for (const [id, a, z] of treeOwners) { const bb = boxes[id]; if (!bb) continue; for (let i = a; i < z; i++) { const t = yard[i], sc = t.s * 1.1, r = .26 * sc; bb[1] = Math.min(bb[1], t.x - r); bb[3] = Math.min(bb[3], t.z - r); bb[4] = Math.max(bb[4], t.x + r); bb[6] = Math.max(bb[6], t.z + r); bb[5] = Math.max(bb[5], t.y + .4 * sc + .26 * 1.15 * sc); } }
  const wallMat = mat({ map: texW, vertexColors: true });
  if (blocks) patchWindowMaterial(wallMat);
  const wallsMesh = new THREE.Mesh(Wg.geometry(), wallMat);
  const ws = { blockTris: 0, windowed: 0, style0Windowed: 0 };
  if (blocks) for (let t = 0; t < Wg.owners.length; t++) {
    if (Wg.owners[t] >= 0) continue;
    ws.blockTris++;
    const plain = [0, 1, 2].every(j => Wg.uv[(t * 3 + j) * 2] === PLAIN_UV[0] && Wg.uv[(t * 3 + j) * 2 + 1] === PLAIN_UV[1]);
    if (!plain) { ws.windowed++; if (Wg.wst[t * 3] === 0) ws.style0Windowed++; }
  }
  const otherMesh = new THREE.Mesh(Og.geometry(), mat({ vertexColors: true }));
  const owners = new Map<THREE.Object3D, Int32Array>([[wallsMesh, Int32Array.from(Wg.owners)], [otherMesh, Int32Array.from(Og.owners)]]);
  for (const m of [wallsMesh, otherMesh]) { m.castShadow = m.receiveShadow = true; disposables.push(m.geometry); scene.add(m); }
  // D005 點綴：不投影子（收影子），單獨一個網格；沒有街區時不建（D003 模式的 draw call 不變）
  const dressMesh = Dg.owners.length ? new THREE.Mesh(Dg.geometry(), mat({ vertexColors: true })) : null;
  if (dressMesh) { dressMesh.receiveShadow = true; owners.set(dressMesh, Int32Array.from(Dg.owners)); disposables.push(dressMesh.geometry); scene.add(dressMesh); }
  const drawn = new Set<number>(), drawnBlocks = new Set<number>();
  for (const a of owners.values()) for (const id of a) if (id > 0) drawn.add(id); else if (id < 0) drawnBlocks.add(-id - 1);
  if (blocks) for (const bi of drawnBlocks) for (const i of blocks.plan[bi].cells) if (c.occ[i]) drawn.add(c.occ[i]);
  mark('buildings');

  // ---- 樹：偶數樹種是針葉（錐形），奇數是闊葉（圓冠）；有建築、道路、水的格子不種 ----
  const spots: [number, number, number, number][] = [];
  for (let i = 0; i < nn; i++) if (c.tree[i] && !c.occ[i] && !c.road[i] && c.ter[i] !== 0 && !c.rail[i]) spots.push([i % n, (i / n) | 0, c.tree[i], top[i]]);
  if (spots.length) {
    const round = spots.filter(s => s[2] % 2 === 1), cone = spots.filter(s => s[2] % 2 === 0);
    // D005：街區模式的樹幹不帶上下蓋（下蓋朝地、上蓋藏在樹冠裡，畫面逐像素相同），省一半樹幹三角形；D003 模式照舊
    const tg = new THREE.CylinderGeometry(0.045, 0.06, 0.28, 5, 1, !!blocks), rg = new THREE.IcosahedronGeometry(0.3, 0), cg = new THREE.ConeGeometry(0.28, 0.7, 6);
    disposables.push(tg, rg, cg);
    const trunks = new THREE.InstancedMesh(tg, mat({ color: 0x6b4f35 }), spots.length);
    const crownsR = new THREE.InstancedMesh(rg, mat({ color: 0xffffff }), Math.max(1, round.length));
    const crownsC = new THREE.InstancedMesh(cg, mat({ color: 0xffffff }), Math.max(1, cone.length));
    crownsR.count = round.length; crownsC.count = cone.length;
    const q = new THREE.Object3D(), col = new THREE.Color();
    let ti = 0;
    const place = (arr: typeof spots, mesh: THREE.InstancedMesh, coneShape: boolean) => arr.forEach(([x, z, sp, y], k) => {
      const jx = (hash2(x, z, 11) - 0.5) * 0.4, jz = (hash2(x, z, 12) - 0.5) * 0.4, sc = 0.8 + hash2(x, z, 13) * 0.4;
      q.position.set(x + 0.5 + jx, y + 0.14 * sc, z + 0.5 + jz); q.rotation.set(0, 0, 0); q.scale.set(sc, sc, sc); q.updateMatrix(); trunks.setMatrixAt(ti++, q.matrix);
      q.position.y = y + (coneShape ? 0.55 : 0.42) * sc; q.rotation.set(0, hash2(x, z, 15) * 3, 0); q.updateMatrix(); mesh.setMatrixAt(k, q.matrix);
      const h = hash2(x, z, 16) + sp * 0.07;
      mesh.setColorAt(k, col.setHSL((coneShape ? 0.33 : 0.27) + (h % 1) * 0.06, 0.45, (coneShape ? 0.28 : 0.36) + (h % 1) * 0.1, THREE.SRGBColorSpace));
    });
    place(round, crownsR, false);
    place(cone, crownsC, true);
    for (const m of [trunks, crownsR, crownsC]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }
  // D005 前庭的樹（villa、住宅地坪）：八面體樹冠＋三稜樹幹，14 個三角形（野樹 40 個），不投影子
  if (yard.length) {
    const ytg = new THREE.CylinderGeometry(0.03, 0.04, 0.24, 3, 1, true), ycg = new THREE.OctahedronGeometry(0.26, 0);
    disposables.push(ytg, ycg);
    const yt = new THREE.InstancedMesh(ytg, mat({ color: 0x6b4f35 }), yard.length), yc = new THREE.InstancedMesh(ycg, mat({ color: 0xffffff }), yard.length);
    const q = new THREE.Object3D(), col = new THREE.Color();
    yard.forEach((t, j) => {
      const hx = Math.round(t.x * 64), hz = Math.round(t.z * 64), sc = t.s * (0.9 + hash2(hx, hz, 13) * 0.2);
      q.position.set(t.x, t.y + 0.12 * sc, t.z); q.rotation.set(0, 0, 0); q.scale.set(sc, sc, sc); q.updateMatrix(); yt.setMatrixAt(j, q.matrix);
      q.position.y = t.y + 0.4 * sc; q.rotation.set(0, hash2(hx, hz, 15) * 3, 0); q.scale.set(sc, sc * 1.15, sc); q.updateMatrix(); yc.setMatrixAt(j, q.matrix);
      yc.setColorAt(j, col.setHSL(0.29 + hash2(hx, hz, 16) * 0.05, 0.42, 0.3 + hash2(hx, hz, 17) * 0.08, THREE.SRGBColorSpace));
    });
    for (const m of [yt, yc]) { m.receiveShadow = true; scene.add(m); }
  }
  mark('trees');

  // ---- 光：從畫面左上方來（同 D002）----
  const center = new THREE.Vector3(n / 2, 0, n / 2);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x6b5a44, style.toon ? TN.hemi : 1.35));
  const sun = new THREE.DirectionalLight(0xfff4e0, style.toon ? TN.sun : 2.4);
  sun.position.copy(center).add(new THREE.Vector3(-0.35, 1.25, 1.0).multiplyScalar(n));
  sun.target.position.copy(center);
  sun.castShadow = true;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -n * 0.75; sc.right = sc.top = n * 0.75; sc.near = 1; sc.far = n * 4;
  const shadowSize = style.softShadow ? 2048 : Math.min(2048, Math.max(1536, n * 16));
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  if (style.softShadow) sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  mark('lights');

  // 點擊：打到建築就回那棟（格子取根格）；打到地面回那一格。樹不擋
  const byId = new Map(c.buildings.map(b => [b.id, b]));
  const pickables: THREE.Object3D[] = [wallsMesh, otherMesh, ...(dressMesh ? [dressMesh] : []), ground];
  const pick = (ray: THREE.Raycaster): CityHit | null => {
    for (const h of ray.intersectObjects(pickables, false)) {
      const id = owners.has(h.object) && h.faceIndex != null ? owners.get(h.object)![h.faceIndex] : 0;
      if (id < 0 && blocks) {                                  // 街區：取點到的那一格（夾在街區範圍內，屋簷外挑也算）
        const bi = -id - 1, bk = blocks.plan[bi];
        const x = Math.min(bk.x + bk.w - 1, Math.max(bk.x, Math.floor(h.point.x))), z = Math.min(bk.z + bk.h - 1, Math.max(bk.z, Math.floor(h.point.z)));
        return { id: c.occ[z * n + x], x, z, block: bi };
      }
      const b = id > 0 ? byId.get(id) : undefined;
      if (b) return { id, x: b.x, z: b.z };
      if (h.object === ground) {
        const x = Math.floor(h.point.x), z = Math.floor(h.point.z);
        if (x >= 0 && z >= 0 && x < n && z < n) return { id: c.occ[z * n + x], x, z };
      }
    }
    return null;
  };
  return {
    scene, pick, timing: T,
    owners: () => drawn.size,
    anchorOf: id => anchors.get(id)?.clone() ?? null,
    blocksDrawn: () => [...drawnBlocks].sort((a, b) => a - b),
    blockAnchor: i => blockAnchors[i]?.clone() ?? null,
    artCounts: () => ({ ...counts }),
    wallStyles: () => ({ ...ws }),
    groundData: () => ({ S, W: n * S, rgba: gtex.image.data as Uint8Array }),
    ownerBoxes: () => boxes,
    kindColorsUsed: () => kindUsed,
    meshStats: () => {
      const names = new Map<THREE.Object3D, string>([[ground, 'ground'], [cliffMesh, 'cliff'], [wallsMesh, 'walls'], [otherMesh, 'other'], ...(dressMesh ? [[dressMesh, 'dress'] as [THREE.Object3D, string]] : [])]);
      const out: { name: string; tris: number; shadow: boolean }[] = [];
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry, per = (g.index ? g.index.count : g.attributes.position.count) / 3, inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
        out.push({ name: names.get(m) ?? ((m as THREE.InstancedMesh).isInstancedMesh ? 'inst' + per : 'mesh'), tris: per * inst, shadow: m.castShadow });
      });
      return out;
    },
    groundAt: (x, z) => { const d = gtex.image.data as Uint8Array, W = n * S, o: number[] = []; for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) { const i = ((z * S + v) * W + x * S + u) * 4; o.push(d[i], d[i + 1], d[i + 2]); } return o; },
    dispose: () => { for (const d of disposables) d.dispose(); },
  };
}
