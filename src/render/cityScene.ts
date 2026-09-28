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
import type { FacadePlan, TrimPlan } from '../content/facades.ts';
import { drawBlock, drawNearJob, countNear, emptyCounts, type ArtCounts, type YardTree, type NearJob } from './blockArt.ts';
import { windowAtlas, patchWindowMaterial } from './windows.ts';
import { paintGround, paintGroundInc, groundCellPx } from './ground.ts';
import { drawKind } from './kindArt.ts';
import type { Shape, KindColors } from '../content/kindShapes.ts';
import { nearGate, nearHb } from '../content/construction.ts';
import { conAttr, conAttrRect, patchClip, clipDepthMaterial, patchTree, patchSite, siteDepthMaterial, siteGeometry, type ConState, type SiteSpec } from './construction.ts';
import { Arena, SceneCache, MAX_MOVES, HOLE_LIMIT, blockKey, civicKey, houseKey, type Spec, type Part, type Piece, type PieceMeta } from './pieces.ts';

export interface KindLook { cat(k: number): string; catColor(cat: string): string; height(k: number, lv: number, v?: number): number }
export interface CityHit { id: number; x: number; z: number; block?: number }
// D004：住商工改用街區配方畫（?blocks=a|b|c）。plan＝要畫的街區（src/content/blocks.ts），recipe＝每個街區的配方（src/content/recipes.ts）
export interface BlockRender { mode: BlockMode; plan: DrawBlock[]; recipe(b: DrawBlock): Recipe; dress(b: DrawBlock): Dressing;
  detail: boolean; facade(b: DrawBlock): FacadePlan | null; trim(b: DrawBlock): TrimPlan | null }   // D008：detail＝B、C 兩檔才畫英美立面逐戶造型與飾條
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
  // D014 施工：每格建築幾何的最高點、地基、牆頂（量自幾何）、每格屬於哪個街區（1 起；0＝不是街區）；前庭樹的格；工地網格
  con: { top: Float32Array; base: Float32Array; wallTop: Float32Array; blockOf: Int32Array } | null;
  setTreeAges(ageAt: (i: number) => number): void;
  setSites(specs: SiteSpec[], ageAt: (i: number) => number, live: boolean): { tris: number; perSite: Map<number, string[]> } | null;
  nearCounts(): { near: number; kinds: Record<string, number> };   // D014 近看小物畫了幾件（逐種）
  setNear(on: boolean): void;                          // D014 近看小物：實驗線縮放 ≥ 1.22 才畫
  nearMesh(): THREE.Mesh | null;
  buildingMeshes(): THREE.Mesh[];                      // D014 守衛：牆、其他、點綴（探針只畫這三個）
  pickOwners(): Int32Array[];                         // D015 守衛：牆、其他、點綴每個三角形的主人（點擊用的那一份）
  groundCheck(): boolean;                              // D014 守衛：這一次的地面（增量）＝同一組輸入整張重畫
  weatherInfo(): { core: number; facade: number };     // D014 守衛：會風化（帶牆頂）的牆三角形，核心路徑／英美立面街區各幾個
  siteMesh(): THREE.Mesh | null;
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
// D014：有施工資料（城市模式）時走增量重畫：跟上一次重建一樣的格沿用像素（src/render/ground.ts paintGroundInc）
// D015：有施工資料時貼圖常駐（施工資料的快取），像素直接改在上一次那份上，只上傳變動的格（每格 S 列，一列一段）；變動超過一半就整張傳
function groundTexture(c: City, look: KindLook, S: number, lots?: Uint8Array, plates?: Int32Array, con?: ConState, T?: Record<string, number>): THREE.DataTexture {
  const W = c.n * S;
  const make = (px: Uint8Array) => {
    const t = new THREE.DataTexture(px, W, W, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  if (!con) return make(paintGround(c, k => look.cat(k), S, lots, plates));
  const r = paintGroundInc(c, k => look.cat(k), S, lots, plates, con.ground, true), sc = con.cache, px = r.cache.data;
  con.ground = r.cache; if (T) T.groundTiles = r.painted;
  let t = sc.groundTex;
  if (!t || t.image.data !== px || t.image.width !== W) { t?.dispose(); t = make(px); sc.groundTex = t; sc.stats.groundUp = W * W * 4; }
  else if (r.tiles && r.tiles.length) {
    if (r.tiles.length * 2 > c.n * c.n) { t.clearUpdateRanges(); sc.stats.groundUp = W * W * 4; }
    else {
      for (const i of r.tiles) { const x = i % c.n, z = (i / c.n) | 0; for (let v = 0; v < S; v++) t.addUpdateRange(((z * S + v) * W + x * S) * 4, S * 4); }
      sc.stats.groundUp = r.tiles.length * S * S * 4;
    }
    t.needsUpdate = true;
  }
  return t;
}
// 點綴件數相加（D015：每件自己數，重建時照順序加總；近看小物另算）
function addCounts(a: ArtCounts, b: ArtCounts) {
  for (const k of Object.keys(b) as (keyof ArtCounts)[]) {
    if (k === 'partKinds') { for (const [q, v] of Object.entries(b.partKinds)) a.partKinds[q] = (a.partKinds[q] ?? 0) + v; }
    else if (k !== 'near' && k !== 'nearKinds') (a[k] as number) += b[k] as number;
  }
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
// fresh＝從頭建（換城、換畫法檔）：清空快取。平常（逐日、施工之後）只換變動的件
export function buildCityScene(c: City, look: KindLook, style: Style, blocks?: BlockRender, tone: Tone = 'a', civic?: CivicRender, con?: ConState, fresh = false): BuiltCity {
  const TN = TONES[tone];
  const n = c.n, nn = n * n, scene = new THREE.Scene();
  const T: Record<string, number> = {}; let tp = performance.now(); const mark = (k: string) => { const q = performance.now(); T[k] = q - tp; tp = q; };
  // D015 快取：一座城一份（施工資料裡）；畫法檔、地圖大小不同就從頭建
  const sc = con ? con.cache : new SceneCache(), stats = sc.stats;
  const modeKey = `${blocks ? blocks.mode : 'off'}|${blocks?.detail ? 1 : 0}|${civic ? 1 : 0}|${con ? 1 : 0}|${n}`;
  Object.assign(stats, { pieces: 0, regen: 0, up: 0, upFull: 0, grown: 0, moved: 0, relayout: 0, fresh: false, groundUp: 0, groundFull: 0, treesKept: false });
  if (fresh || sc.mode !== modeKey || !sc.arenas) { sc.reset(modeKey); stats.fresh = true; }
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
      if (b.goneDay !== undefined || b.k <= 3 || !civic.shape(b.k)) continue;   // D011：拆掉的（墓碑）不畫
      const pc = parseInt(civic.colors(b.k, b.lv).plate.slice(1), 16);
      for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) if (b.x + dx < n && b.z + dz < n) plates[(b.z + dz) * n + b.x + dx] = pc;
    }
  }
  const gtex = groundTexture(c, look, S, lots, plates, con, T); if (!con) disposables.push(gtex);   // D015：有施工資料時貼圖屬於快取
  stats.up += stats.groundUp; stats.groundFull = n * S * n * S * 4;
  mark('groundTex');
  const top = new Float32Array(nn);
  for (let i = 0; i < nn; i++) top[i] = tileTop(c, i);
  // D014：地面、崖面的幾何只跟每格高度有關——高度沒變就沿用上一次建的（記在施工資料裡），重建時省下組這兩個網格的時間。
  // 沒快取到（第一次、換城、鋪了橋）才重建；換下來的舊幾何交給這一次的場景，等這一次的場景也換下來才釋放（那時用舊幾何的場景早就丟了）
  let gg: THREE.BufferGeometry, cliffG: THREE.BufferGeometry;
  const tc = con?.terrain;
  if (tc && tc.n === n && tc.top.length === nn && tc.top.every((v, i) => v === top[i])) { gg = tc.ground; cliffG = tc.cliff; T.terrainCached = 1; }
  else {
    const gp = new Float32Array(nn * 18), guv = new Float32Array(nn * 12), gn = new Float32Array(nn * 18);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const i = z * n + x, y = top[i], u0 = x / n, u1 = (x + 1) / n, v0 = z / n, v1 = (z + 1) / n;
      gp.set([x, y, z, x, y, z + 1, x + 1, y, z + 1, x, y, z, x + 1, y, z + 1, x + 1, y, z], i * 18);
      guv.set([u0, v0, u0, v1, u1, v1, u0, v0, u1, v1, u1, v0], i * 12);
      for (let j = 0; j < 6; j++) gn[i * 18 + j * 3 + 1] = 1;
    }
    gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
    gg.setAttribute('uv', new THREE.BufferAttribute(guv, 2));
    gg.setAttribute('normal', new THREE.BufferAttribute(gn, 3));
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
    cliffG = cliff.geometry();
    if (con) { if (tc) disposables.push(tc.ground, tc.cliff); con.terrain = { n, top: Float32Array.from(top), ground: gg, cliff: cliffG }; }
    else disposables.push(gg, cliffG);
    T.terrainCached = 0;
  }
  const ground = new THREE.Mesh(gg, mat({ map: gtex }));
  ground.receiveShadow = true; scene.add(ground);
  mark('groundMesh');
  const cliffMesh = new THREE.Mesh(cliffG, mat({ vertexColors: true }));
  cliffMesh.receiveShadow = true; scene.add(cliffMesh);
  mark('ground');

  // ---- 建築量體（D015：照「件」快取——一個街區、一棟不走街區的建築、全部高架路合成一件；鍵＝決定它幾何的全部輸入。
  // 牆、其他、點綴三個網格各一份常駐的頂點緩衝（src/render/pieces.ts），每件佔一段：換掉的段清成退化三角形，只上傳改到的那幾段）----
  const RCI = new Set(['R', 'C', 'I']);
  interface PSpec { key: string; owner: number; block: number; rect: number[] | null; gen(W: Geo, O: Geo, D: Geo, m: PieceMeta): void }
  const specs: PSpec[] = [];
  for (const b of c.buildings) {
    const cat = look.cat(b.k), s = b.size, root = Math.min(nn - 1, b.z * n + b.x);
    if (b.goneDay !== undefined) continue;                     // D011：拆掉的（墓碑）不畫
    if (b.x + s > n || b.z + s > n) continue;                  // 出界的建築不畫（城市模型已計數）
    if (blocks && b.k >= 1 && b.k <= 3) continue;               // D004：住商工交給街區配方（下面）
    const shape = civic && b.k > 3 ? civic.shape(b.k) : null, rect = [b.x, b.z, b.x + s, b.z + s];
    if (shape) {                                               // D007：非住商工照造型表畫
      let y0 = 0;
      for (let dz = 0; dz < s; dz++) for (let dx = 0; dx < s; dx++) y0 = Math.max(y0, top[(b.z + dz) * n + b.x + dx]);
      specs.push({ key: civicKey(b, s, y0), owner: b.id, block: -1, rect, gen: (W, O, D, m) => {
        const H = Math.max(0.12, look.height(b.k, b.lv, b.v));
        m.kindUsed = [...drawKind({ W, O, D, trees: m.yard, x0: b.x, z0: b.z, s, y0, H, k: b.k, v: b.v, C: civic!.colors(b.k, b.lv) }, shape)];   // v：D018 公園照變體畫（鍵裡本來就有 v）
        m.anchor = new THREE.Vector3(b.x + s / 2, y0 + H / 2, b.z + s / 2);
      } });
      continue;
    }
    const y0 = Math.max(0, top[root]);
    specs.push({ key: houseKey(b, s, y0), owner: b.id, block: -1, rect, gen: (Wg, Og, _D, mm) => {
      const H = Math.max(0.12, look.height(b.k, b.lv, b.v));
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
      mm.anchor = new THREE.Vector3(cx, (y0 + yTop) / 2, cz);
    } });
  }
  // D004 街區：三角形的 owner 記成 −(街區索引＋1)，點擊時再換回點到的那一格（D015：索引每次重建照這一次的計畫重寫）
  if (blocks) blocks.plan.forEach((bk, bi) => {
    let y0 = 0;
    for (const i of bk.cells) y0 = Math.max(y0, top[i]);
    specs.push({ key: blockKey(bk, y0), owner: -(bi + 1), block: bi, rect: [bk.x, bk.z, bk.x + bk.w, bk.z + bk.h], gen: (W, O, D, m) => {
      const fp = blocks.detail ? blocks.facade(bk) : null, nj: NearJob[] = [];
      m.counts = emptyCounts(); m.facade = !!fp;
      m.anchor = drawBlock(W, O, D, bk, blocks.recipe(bk), blocks.dress(bk), y0, m.yard, m.counts, fp, blocks.detail ? blocks.trim(bk) : null, con ? nj : null);
      m.near = nj[0] ?? null;
    } });
  });
  // 高架路：路面抬高、每兩格一根橋墩（全部合成一件，沒有主人）
  const flyTiles: number[] = [];
  for (let i = 0; i < nn; i++) if (c.fly[i] && c.road[i]) flyTiles.push(i);
  if (flyTiles.length) specs.push({ key: 'F' + flyTiles.map(i => `${i}:${top[i]}`).join(','), owner: 0, block: -1, rect: null, gen: (_W, Og) => {
    for (const i of flyTiles) {
      const x = i % n, z = (i / n) | 0, y = Math.max(0, top[i]) + 0.42;
      Og.box(x, z, x + 1, z + 1, y, y + 0.08, C(0, 0, 0.62), C(0, 0, 0.36), null);
      if ((x + z) % 2 === 0) Og.box(x + 0.44, z + 0.44, x + 0.56, z + 0.56, Math.max(0, top[i]), y, C(0, 0, 0.6), null, null);
    }
  } });
  // 產生一件：量體畫進三個新的累積器，窗樣式、風化牆、包圍盒從原始數字算（跟 D015 之前同一套），再轉成頂點資料＋施工屬性
  const ext = !!blocks;
  const base: Spec = [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]];
  const specW: Spec = [...base, ...(ext ? [['wStyle', 1], ['wGlass', 3], ['wBand', 1]] as Spec : []), ...(con ? [['aCon', 3]] as Spec : [])];
  const specO: Spec = [...base, ...(con ? [['aCon', 3]] as Spec : [])];
  const makePiece = (s: PSpec): { p: Piece; parts: (Part | null)[] } => {
    const G = [new Geo({ ext }), new Geo(), new Geo()];
    for (const g of G) g.owner = s.owner;
    const m: PieceMeta = { yard: [], anchor: null, counts: null, kindUsed: null, near: null, weather: 0, facade: false, ws: [0, 0, 0], box: null, tiles: new Int32Array(0), top: new Float32Array(0), wall: new Float32Array(0) };
    s.gen(G[0], G[1], G[2], m);
    const W = G[0];
    if (s.block >= 0) for (let t = 0; t < W.owners.length; t++) {
      m.ws[0]++;
      const plain = [0, 1, 2].every(j => W.uv[(t * 3 + j) * 2] === PLAIN_UV[0] && W.uv[(t * 3 + j) * 2 + 1] === PLAIN_UV[1]);
      if (!plain) { m.ws[1]++; if (W.wst[t * 3] === 0) m.ws[2]++; }
      if (W.tags[t] > 0) m.weather++;
    }
    if (s.owner > 0) {                                         // D007：逐棟包圍盒（含它的前庭樹）
      const bb = [0, Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const g of G) for (let t = 0; t < g.owners.length; t++) {
        bb[0]++;
        for (let j = 0; j < 3; j++) { const q = (t * 3 + j) * 3; for (let a = 0; a < 3; a++) { const v = g.pos[q + a]; if (v < bb[1 + a]) bb[1 + a] = v; if (v > bb[4 + a]) bb[4 + a] = v; } }
      }
      if (bb[0]) {
        for (const t of m.yard) { const sc = t.s * 1.1, r = .26 * sc; bb[1] = Math.min(bb[1], t.x - r); bb[3] = Math.min(bb[3], t.z - r); bb[4] = Math.max(bb[4], t.x + r); bb[6] = Math.max(bb[6], t.z + r); bb[5] = Math.max(bb[5], t.y + .4 * sc + .26 * 1.15 * sc); }
        m.box = bb;
      }
    }
    const topM = new Map<number, number>(), wallM = new Map<number, number>();
    const parts = G.map((g, j): Part | null => {
      const tris = g.owners.length;
      if (!tris) return null;
      const a: Float32Array[] = [Float32Array.from(g.pos), Float32Array.from(g.nor), Float32Array.from(g.uv), Float32Array.from(g.col)];
      if (j === 0 && ext) a.push(Float32Array.from(g.wst), Float32Array.from(g.wgl), Float32Array.from(g.wbd));
      if (con) a.push(conAttrRect(g.pos, g.nor, g.tags, s.rect, n, topM, wallM));
      return { tris, a };
    });
    m.tiles = Int32Array.from(topM.keys()); m.top = Float32Array.from(topM.values()); m.wall = Float32Array.from(m.tiles, i => wallM.get(i) ?? 0);
    return { p: { key: s.key, owner: s.owner, tris: parts.map(q => q?.tris ?? 0), slot: [-1, -1, -1], meta: m }, parts };
  };
  // 這一次的件（照首次建的順序：先非街區建築、再街區、最後高架路）；沒快取到的才產生
  const cur: Piece[] = [], newParts = new Map<Piece, (Part | null)[]>(), seen = new Set<string>();
  for (const s of specs) {
    let key = s.key;
    for (let k = 2; seen.has(key); k++) key = `${s.key}#${k}`;   // 鍵重複（理論上不會：位置、編號都在鍵裡）就加序號，免得兩件搶同一份
    seen.add(key); s.key = key;
    let p = sc.pieces.get(key);
    if (!p) { const r = makePiece(s); p = r.p; newParts.set(p, r.parts); sc.pieces.set(key, p); stats.regen++; }
    cur.push(p);
  }
  stats.pieces = cur.length;
  if (!sc.arenas) {                                            // 從頭建：照順序一件接一件（沒有空洞，跟 D015 之前逐位元組相同）
    const sphere = new THREE.Sphere(new THREE.Vector3(n / 2, 4, n / 2), n * 0.75 + 8);
    const tot = [0, 1, 2].map(j => cur.reduce((t, p) => t + p.tris[j], 0));
    sc.arenas = [specW, specO, specO].map((sp, j) => new Arena(sp, Arena.capFor(tot[j]), sphere));
    for (const p of cur) newParts.get(p)!.forEach((q, j) => { if (!q) return; const a = sc.arenas![j], s0 = a.used; a.used += q.tris; a.write(s0, q, p.owner, true); p.slot[j] = s0; });
    for (const a of sc.arenas) a.geo.setDrawRange(0, a.used * 3);
  } else {
    const A = sc.arenas;
    for (const a of A) { a.up = 0; a.grown = 0; }
    for (const [k, p] of sc.pieces) if (!seen.has(k)) { p.slot.forEach((s0, j) => { if (s0 >= 0) A[j].clear(s0, p.tris[j]); }); sc.pieces.delete(k); }   // 換下來的件：清成空洞
    for (const p of cur) { const q = newParts.get(p); if (q) q.forEach((part, j) => { if (!part) return; const s0 = A[j].place(part.tris); A[j].write(s0, part, p.owner); p.slot[j] = s0; }); }
    // 尾端的件搬進前面放得下它的空洞（縮短要畫的範圍）；空洞還是太多就整份重排
    for (let j = 0; j < 3; j++) {
      const a = A[j];
      for (let mv = 0; mv < MAX_MOVES && a.free.length; mv++) {
        let last: Piece | null = null;
        for (const p of cur) if (p.slot[j] >= 0 && (!last || p.slot[j] > last.slot[j])) last = p;
        if (!last) break;
        const t = last.tris[j], from = last.slot[j];
        if (!a.free.some(([s0, cnt]) => cnt >= t && s0 < from)) break;
        const to = a.place(t);
        a.move(from, to, t); last.slot[j] = to; stats.moved++;
      }
      if (a.used > 4096 && a.holes() > a.used * HOLE_LIMIT) {
        a.relayout(cur.filter(p => p.slot[j] >= 0).map(p => ({ s: p.slot[j], tris: p.tris[j], owner: p.owner, set: (s0: number) => { p.slot[j] = s0; } })));
        stats.relayout++;
      }
    }
  }
  // 主人照這一次重寫（街區索引會跟著計畫變）
  cur.forEach((p, i) => { const want = specs[i].owner; if (p.owner !== want) { p.slot.forEach((s0, j) => { if (s0 >= 0) sc.arenas![j].setOwner(s0, p.tris[j], want); }); p.owner = want; } });
  const [aW, aO, aD] = sc.arenas;
  stats.up += aW.up + aO.up + aD.up; stats.grown = aW.grown + aO.grown + aD.grown;
  stats.upFull += aW.live * aW.bytesPerTri() + aO.live * aO.bytesPerTri() + aD.live * aD.bytesPerTri() + stats.groundFull;   // D015 之前每次重建整份上傳的量（建築三個網格＋地面；野樹在下面加）
  mark('bldGeo');
  // 照首次建的順序把每件的結果收起來：前庭樹、錨點、點綴件數、包圍盒、用色、窗樣式、風化牆、畫到誰、每格最高點與牆頂；近看小物照這一次的屋齡判
  const yard: YardTree[] = [], anchors = new Map<number, THREE.Vector3>(), blockAnchors: (THREE.Vector3 | null)[] = [];
  const counts = emptyCounts(), weatherTris = { core: 0, facade: 0 }, kindUsed: Record<number, string[]> = {}, boxes: Record<number, number[]> = {};
  const ws = { blockTris: 0, windowed: 0, style0Windowed: 0 }, nearJobs: NearJob[] = [], drawn = new Set<number>(), drawnBlocks = new Set<number>();
  const ctop = Float32Array.from(top), wallTop = new Float32Array(nn), blockOf = new Int32Array(nn);
  cur.forEach((p, idx) => {
    const s = specs[idx], m = p.meta;
    for (const t of m.yard) yard.push(t);
    if (s.block >= 0) blockAnchors[s.block] = m.anchor; else if (m.anchor) anchors.set(s.owner, m.anchor);
    if (m.kindUsed) kindUsed[s.owner] = m.kindUsed;
    if (m.box) boxes[s.owner] = m.box.slice();
    if (m.counts) addCounts(counts, m.counts);
    if (s.block >= 0) {
      if (m.facade) weatherTris.facade += m.weather; else weatherTris.core += m.weather;
      ws.blockTris += m.ws[0]; ws.windowed += m.ws[1]; ws.style0Windowed += m.ws[2];
      // D014 近看小物（58393）：街區起點那棟屋齡 ≥ 9、streetHash(x,y,60630)<.72 才畫；hb＝floor(streetHash(x,y,60631)*3)
      const bk = blocks!.plan[s.block], oi = c.occ[bk.z * n + bk.x], ob = oi ? c.buildings[oi - 1] : null;
      if (m.near && con && ob && nearGate(bk.x, bk.z, ob.age)) { const j = { ...m.near, hb: nearHb(bk.x, bk.z), owner: s.owner }; nearJobs.push(j); countNear(j, counts); }
    }
    if (p.tris[0] + p.tris[1] + p.tris[2] > 0) { if (s.owner > 0) drawn.add(s.owner); else if (s.owner < 0) drawnBlocks.add(-s.owner - 1); }
    for (let k = 0; k < m.tiles.length; k++) { const i = m.tiles[k]; if (m.top[k] > ctop[i]) ctop[i] = m.top[k]; if (m.wall[k] > wallTop[i]) wallTop[i] = m.wall[k]; }
  });
  if (blocks) for (const bi of drawnBlocks) for (const i of blocks.plan[bi].cells) if (c.occ[i]) drawn.add(c.occ[i]);
  // D014 施工：每格的最高點與牆頂（量自幾何，工地的樓高、樓板線用）、每格屬於哪個街區
  let conOut: BuiltCity['con'] = null, nearRect: ((o: number) => number[] | null) | null = null;
  if (con) {
    const byIdR = new Map(c.buildings.map(b => [b.id, b]));
    nearRect = (o: number): number[] | null => {
      if (o > 0) { const b = byIdR.get(o); return b ? [b.x, b.z, b.x + b.size, b.z + b.size] : null; }
      const bk = blocks?.plan[-o - 1]; return bk ? [bk.x, bk.z, bk.x + bk.w, bk.z + bk.h] : null;
    };
    if (blocks) blocks.plan.forEach((bk, bi) => { for (const i of bk.cells) blockOf[i] = bi + 1; });
    conOut = { top: ctop, base: Float32Array.from(top), wallTop, blockOf };
  }
  mark('conAttr');
  // D005：街區模式的牆用窗磚圖集（第 0 格＝D003 窗磚，非住商工畫面不變）；D003 模式照舊用單張窗磚
  const texW = blocks ? windowAtlas() : windowTexture(); disposables.push(texW);
  const wallMat = mat({ map: texW, vertexColors: true });
  if (blocks) patchWindowMaterial(wallMat);
  if (con) patchClip(wallMat, con.uni, true);
  // 三個建築網格的幾何屬於快取（src/render/pieces.ts），不跟著場景丟
  const wallsMesh = new THREE.Mesh(aW.geo, wallMat);
  const otherMesh = new THREE.Mesh(aO.geo, mat({ vertexColors: true }));
  const owners = new Map<THREE.Object3D, Arena>([[wallsMesh, aW], [otherMesh, aO]]);
  for (const m of [wallsMesh, otherMesh]) { m.castShadow = m.receiveShadow = true; scene.add(m); }
  // D005 點綴：不投影子（收影子），單獨一個網格；沒有點綴時不建（D003 模式的 draw call 不變）
  const dressMesh = aD.live ? new THREE.Mesh(aD.geo, mat({ vertexColors: true })) : null;
  if (dressMesh) { dressMesh.receiveShadow = true; owners.set(dressMesh, aD); scene.add(dressMesh); }
  if (!con) for (const a of sc.arenas) disposables.push(a);   // 沒有施工資料（快取只給這一次）：跟著場景丟
  // D014 近看小物：單獨一個網格、不投影子，縮放夠近才畫（setNear）
  let nearM: THREE.Mesh | null = null;
  const buildNear = () => {
    if (nearM || !nearJobs.length || !con || !nearRect) return;
    const t0 = performance.now(), Ng = new Geo();
    for (const j of nearJobs) drawNearJob(Ng, j);
    nearM = new THREE.Mesh(Ng.geometry(), mat({ vertexColors: true }));
    nearM.geometry.setAttribute('aCon', new THREE.Float32BufferAttribute(conAttr(Ng.pos, Ng.nor, Ng.owners, Ng.tags, nearRect, n, new Float32Array(nn), new Float32Array(nn)), 3));   // 近看小物不算進最高點
    patchClip(nearM.material as THREE.Material, con.uni, false);
    nearM.receiveShadow = true; nearM.name = 'near'; disposables.push(nearM.geometry); scene.add(nearM);
    T.near = performance.now() - t0;
  };
  // D014：三個建築網格都吃施工裁切；影子那趟用同一段裁切的深度材質
  if (con) {
    [wallsMesh, otherMesh, dressMesh].forEach(m => {
      if (!m) return;
      if (m !== wallsMesh) patchClip(m.material as THREE.Material, con.uni, false);
      if (m.castShadow) { const dm = clipDepthMaterial(con.uni); m.customDepthMaterial = dm; disposables.push(dm); }
    });
  }
  mark('buildings');

  // ---- 樹：偶數樹種是針葉（錐形），奇數是闊葉（圓冠）；有建築、道路、水的格子不種 ----
  const spots: [number, number, number, number][] = [];
  for (let i = 0; i < nn; i++) if (c.tree[i] && !c.occ[i] && !c.road[i] && c.ter[i] !== 0 && !c.rail[i]) spots.push([i % n, (i / n) | 0, c.tree[i], top[i]]);
  if (spots.length) {
    const round = spots.filter(s => s[2] % 2 === 1), cone = spots.filter(s => s[2] % 2 === 0);
    // D015：樹的位置、種類、地面高沒變就沿用上一次的幾何與實例資料（同一份緩衝，不重傳）；實例網格本身每次新建（材質跟著場景）
    // 鍵：每棵樹的格、樹種、地面高逐一混成兩個 32 位元雜湊（不串字串：幾千棵樹每次重建都要算）
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (const [x, z, sp, y] of spots) { const w = (z * n + x) * 16 + sp; h1 = Math.imul(h1 ^ w, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ (w + Math.round(y * 1000)), 0x85ebca6b) >>> 0; }
    const key = `${spots.length}:${h1}:${h2}`, kept = con && sc.trees?.key === key ? sc.trees : null;
    const mats = [mat({ color: 0x6b4f35 }), mat({ color: 0xffffff }), mat({ color: 0xffffff })];
    let meshes: THREE.InstancedMesh[];
    if (kept) {
      meshes = [new THREE.InstancedMesh(kept.tg, mats[0], spots.length), new THREE.InstancedMesh(kept.rg, mats[1], Math.max(1, round.length)), new THREE.InstancedMesh(kept.cg, mats[2], Math.max(1, cone.length))];
      meshes[0].instanceMatrix = kept.attrs[0]; meshes[1].instanceMatrix = kept.attrs[1]; meshes[2].instanceMatrix = kept.attrs[3];
      if (kept.attrs[2]) meshes[1].instanceColor = kept.attrs[2];
      if (kept.attrs[4]) meshes[2].instanceColor = kept.attrs[4];
      stats.treesKept = true;
    } else {
      if (con) sc.disposeTrees();
      // D005：街區模式的樹幹不帶上下蓋（下蓋朝地、上蓋藏在樹冠裡，畫面逐像素相同），省一半樹幹三角形；D003 模式照舊
      const tg = new THREE.CylinderGeometry(0.045, 0.06, 0.28, 5, 1, !!blocks), rg = new THREE.IcosahedronGeometry(0.3, 0), cg = new THREE.ConeGeometry(0.28, 0.7, 6);
      const trunks = new THREE.InstancedMesh(tg, mats[0], spots.length);
      const crownsR = new THREE.InstancedMesh(rg, mats[1], Math.max(1, round.length));
      const crownsC = new THREE.InstancedMesh(cg, mats[2], Math.max(1, cone.length));
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
      meshes = [trunks, crownsR, crownsC];
      for (const m of meshes) stats.up += (m.instanceMatrix.array as Float32Array).byteLength + ((m.instanceColor?.array as Float32Array | undefined)?.byteLength ?? 0);
      // 有施工資料：幾何與實例資料歸快取（換下來才釋放）；沒有就跟著場景丟（D010：實例網格的矩陣／顏色緩衝要自己釋放）
      if (con) sc.trees = { key, tg, rg, cg, attrs: [trunks.instanceMatrix, crownsR.instanceMatrix, crownsR.instanceColor!, crownsC.instanceMatrix, crownsC.instanceColor!], counts: [spots.length, round.length, cone.length], meshes };
      else disposables.push(tg, rg, cg, ...meshes);
    }
    meshes[1].count = round.length; meshes[2].count = cone.length;
    for (const m of meshes) stats.upFull += (m.instanceMatrix.array as Float32Array).byteLength + ((m.instanceColor?.array as Float32Array | undefined)?.byteLength ?? 0);
    for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  } else if (con) sc.disposeTrees();
  let yardAges: { attr: THREE.InstancedBufferAttribute; tiles: number[] } | null = null;
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
    for (const m of [yt, yc]) { m.receiveShadow = true; scene.add(m); disposables.push(m); }
    if (con) {   // D014：前庭的樹等完工才種（每棵一個實例屬性：它那一格的屋齡）
      const at = new THREE.InstancedBufferAttribute(new Float32Array(yard.length).fill(99), 1);
      for (const m of [yt, yc]) { m.geometry.setAttribute('aTreeT', at); patchTree(m.material as THREE.Material, con.uni); }
      yardAges = { attr: at, tiles: yard.map(t => Math.min(n - 1, Math.max(0, Math.floor(t.z))) * n + Math.min(n - 1, Math.max(0, Math.floor(t.x)))) };
    }
  }
  mark('trees');

  // ---- 光：從畫面左上方來（同 D002）----
  const center = new THREE.Vector3(n / 2, 0, n / 2);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x6b5a44, style.toon ? TN.hemi : 1.35));
  const sun = new THREE.DirectionalLight(0xfff4e0, style.toon ? TN.sun : 2.4);
  sun.position.copy(center).add(new THREE.Vector3(-0.35, 1.25, 1.0).multiplyScalar(n));
  sun.target.position.copy(center);
  sun.castShadow = true;
  const shc = sun.shadow.camera as THREE.OrthographicCamera;
  shc.left = shc.bottom = -n * 0.75; shc.right = shc.top = n * 0.75; shc.near = 1; shc.far = n * 4;
  const shadowSize = style.softShadow ? 2048 : Math.min(2048, Math.max(1536, n * 16));
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  if (style.softShadow) sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  disposables.push({ dispose: () => sun.shadow.dispose() });   // D010：陰影貼圖的算繪目標也要釋放
  mark('lights');

  let siteM: THREE.Mesh | null = null, siteMat: THREE.Material | null = null, siteDepth: THREE.MeshDepthMaterial | null = null;   // D014 工地網格（每天換）
  // 點擊：打到建築就回那棟（格子取根格）；打到地面回那一格。樹不擋
  const byId = new Map(c.buildings.map(b => [b.id, b]));
  const pickables: THREE.Object3D[] = [wallsMesh, otherMesh, ...(dressMesh ? [dressMesh] : []), ground];
  const pick = (ray: THREE.Raycaster): CityHit | null => {
    for (const h of ray.intersectObjects(pickables, false)) {
      const id = owners.has(h.object) && h.faceIndex != null ? owners.get(h.object)!.owners[h.faceIndex] : 0;
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
    artCounts: () => { const { near: _n, nearKinds: _k, ...rest } = counts; void _n; void _k; return { ...rest, partKinds: sortKeys(counts.partKinds) } as ArtCounts; },
    nearCounts: () => ({ near: counts.near, kinds: sortKeys(counts.nearKinds) }),
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
        const g = m.geometry, dr = g.drawRange, pc = g.attributes.position.count, per = (g.index ? g.index.count : Math.min(pc, dr.start + dr.count) - dr.start) / 3, inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : (g as THREE.InstancedBufferGeometry).isInstancedBufferGeometry ? (g as THREE.InstancedBufferGeometry).instanceCount : 1;
        out.push({ name: names.get(m) ?? (m.name || ((m as THREE.InstancedMesh).isInstancedMesh ? 'inst' + per : 'mesh')), tris: per * inst, shadow: m.castShadow });
      });
      return out;
    },
    con: conOut,
    setTreeAges: ageAt => { if (!yardAges) return; const a = yardAges.attr.array as Float32Array; yardAges.tiles.forEach((i, j) => { a[j] = ageAt(i); }); yardAges.attr.needsUpdate = true; },
    setSites: (specs, ageAt, live) => {
      if (!con) return null;
      if (siteM) { scene.remove(siteM); siteM.geometry.dispose(); siteM = null; }
      if (!specs.length) return { tris: 0, perSite: new Map() };
      const sg = siteGeometry(specs, ageAt, conOut!, n, live);
      if (!siteMat) { siteMat = mat({ vertexColors: true }); patchSite(siteMat, con.uni); siteDepth = siteDepthMaterial(con.uni); disposables.push(siteDepth); }
      siteM = new THREE.Mesh(sg.geometry, siteMat); siteM.castShadow = siteM.receiveShadow = true; siteM.customDepthMaterial = siteDepth!; siteM.name = 'site';
      scene.add(siteM);
      return { tris: sg.tris, perSite: sg.perSite };
    },
    siteMesh: () => siteM,
    setNear: on => { if (on) buildNear(); if (nearM) nearM.visible = on; },
    buildingMeshes: () => [wallsMesh, otherMesh, ...(dressMesh ? [dressMesh] : [])],
    pickOwners: () => [wallsMesh, otherMesh, ...(dressMesh ? [dressMesh] : [])].map(m => owners.get(m)!.owners),
    groundCheck: () => { const full = paintGround(c, k => look.cat(k), S, lots, plates), cur = gtex.image.data as Uint8Array; if (full.length !== cur.length) return false; for (let i = 0; i < full.length; i++) if (full[i] !== cur[i]) return false; return true; },
    weatherInfo: () => ({ ...weatherTris }),
    nearMesh: () => nearM,
    groundAt: (x, z) => { const d = gtex.image.data as Uint8Array, W = n * S, o: number[] = []; for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) { const i = ((z * S + v) * W + x * S + u) * 4; o.push(d[i], d[i + 1], d[i + 2]); } return o; },
    dispose: () => { if (siteM) siteM.geometry.dispose(); for (const d of disposables) d.dispose(); },
  };
}

export const sortKeys = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
