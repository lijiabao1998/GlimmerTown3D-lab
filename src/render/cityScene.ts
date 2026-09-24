// 城市場景（D003）：只讀 City，建出 three.js 場景；不回頭改城市（CLAUDE.md 規則 2）。
// 建築是量體佔位：高度量自 2D 實驗線的精靈圖（src/content/lab-kinds.json），外形只分幾類；逐種配方是 D004 的事。
// 畫面全部由程式生成，沒有任何外部素材（CLAUDE.md 規則 7）。
import * as THREE from 'three';
import type { City, CityBuilding } from '../sim/city.ts';
import { hash2 } from '../sim/rng.ts';
import type { Style } from './styles.ts';
import { Geo } from './scene.ts';
import { windowTexture, toonRamp } from './textures.ts';
import type { BlockMode, DrawBlock } from '../content/blocks.ts';
import { PX_PER_CELL, TERRA, shade, type Recipe } from '../content/recipes.ts';

export interface KindLook { cat(k: number): string; catColor(cat: string): string; height(k: number, lv: number, v?: number): number }
export interface CityHit { id: number; x: number; z: number; block?: number }
// D004：住商工改用街區配方畫（?blocks=a|b|c）。plan＝要畫的街區（src/content/blocks.ts），recipe＝每個街區的配方（src/content/recipes.ts）
export interface BlockRender { mode: BlockMode; plan: DrawBlock[]; recipe(b: DrawBlock): Recipe }
export interface BuiltCity {
  scene: THREE.Scene;
  pick(ray: THREE.Raycaster): CityHit | null;
  owners(): number;                                   // 場景裡實際畫出來的建築數（守衛：要等於城市的建築數）
  anchorOf(id: number): THREE.Vector3 | null;        // 建築量體的中心（測點擊用）
  blocksDrawn(): number[];                           // D004：幾何裡真的有三角形的街區（plan 的索引）
  blockAnchor(i: number): THREE.Vector3 | null;      // D004：街區主體量體的中心（測點擊用）
  timing: Record<string, number>;
  dispose(): void;
}

export const EL_H = 0.4;          // 高地抬高幾格
export const WATER_Y = -0.06;     // 水面略低於地面，岸邊才有一道邊
const BASE_Y = -0.45;             // 地圖邊緣底座的底

const C = (h: number, s: number, l: number) => new THREE.Color().setHSL(h / 360, s, l, THREE.SRGBColorSpace);
const hex = (s: string) => new THREE.Color(s);
const mix = (a: number, b: number, t: number) => {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

// 每格的地面高度：橋面跟地面齊平；水面略低；高地抬高
export function tileTop(c: City, i: number): number {
  const r = c.road[i];
  if (r === 2 || r === 4) return 0.02;
  if (c.ter[i] === 0) return WATER_Y;
  return c.el[i] ? EL_H : 0;
}

// 地面貼圖：每格 S×S 像素；資料第 r 列＝世界 z＝r/S（UV 直接用 x/n、z/n，不翻轉）
function groundTexture(c: City, look: KindLook, S: number): THREE.DataTexture {
  const n = c.n, W = n * S, data = new Uint8Array(W * W * 4);
  const put = (px: number, py: number, col: number) => { const i = (py * W + px) * 4; data[i] = (col >> 16) & 255; data[i + 1] = (col >> 8) & 255; data[i + 2] = col & 255; data[i + 3] = 255; };
  const ZONE = [0, 0x9fd28a, 0x8fb4e0, 0xe0c27a];
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const i = z * n + x, r = c.road[i], b = c.occ[i] ? c.buildings[c.occ[i] - 1] : null, cat = b ? look.cat(b.k) : '';
    for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
      const h = hash2(x * S + u, z * S + v, 7), edge = u === 0 || v === 0 || u === S - 1 || v === S - 1, mid = u === (S >> 1) || v === (S >> 1);
      let col: number;
      if (r === 1) col = c.rclass[i] >= 4 ? (edge ? 0x86837c : mid && h < 0.5 ? 0xcfc9a8 : 0x55534f) : (edge ? 0x8a8780 : 0x6b6a66);
      else if (r === 2) col = edge ? 0xa9a59a : 0x6b6a66;                         // 橋面：柏油＋淺色護欄（實驗線的橋也是灰色路面）
      else if (r === 3) col = edge ? 0xc9a646 : 0x4d4c49;                         // 高速：黃邊線
      else if (r === 4) col = edge ? 0xc9a646 : 0x5c5048;                         // 高速橋
      else if (c.rail[i]) col = (u === 1 || u === S - 2) ? 0x3a3a3a : v % 2 ? 0x7a5a3c : 0x6a6258;
      else if (c.dock[i]) col = v % 2 ? 0x8a6a48 : 0x7a5c3e;
      // 建築用地：住商工是草坪（實驗線的街區精靈底下是草坪，量體縮在中間）、綠地更綠、農田條紋，其他設施是鋪面
      else if (b) col = cat === 'G' ? mix(0x86bd5c, 0x9bcc6a, h) : cat === 'F' ? (v % 2 ? 0xb9c95a : 0x9fb24a)
        : (cat === 'R' || cat === 'C' || cat === 'I') ? (edge ? mix(0x9aa08c, 0x8f9582, h) : mix(0x7fb356, 0x74a64d, h)) : mix(0xc9c3b5, 0xb8b1a2, h);
      else if (c.ter[i] === 0) col = h < 0.07 ? 0x7fb4d8 : mix(0x3f78a8, 0x356a98, h);
      else if (c.ter[i] === 1) col = mix(0xd8c690, 0xcdb983, h);
      else {
        col = mix(0x78a452, 0x6c9749, h);
        if (h > 0.93) col = 0x8fb862;
        const zn = c.zone[i];
        if (zn) col = mix(col, ZONE[zn], edge ? 0.45 : 0.22);   // 劃了區還沒蓋：淡淡帶一點分區色，邊框深一點（實驗線也只是淡淡的）
      }
      if (c.tram[i] && (u === 1 || u === S - 2)) col = 0x2e2e2e;
      put(x * S + u, z * S + v, col);
    }
  }
  const t = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
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

// ---- D004：一個住商工街區照配方畫 ----
// 框 [u0,u1,v0,v1] 的 u 沿 x、v 沿 z（v＝1 是正面，朝鏡頭）；像素 ÷39.2＝格。牆用受光面的顏色（light），背光面交給 3D 打光。
// 立面細節、窗型、夜景不畫（卡面「不改什麼」）；窗子沿用 D003 的窗貼圖。
function drawBlock(Wg: Geo, Og: Geo, bk: DrawBlock, r: Recipe, y0: number) {
  const P = (px: number) => px / PX_PER_CELL, X = (u: number) => bk.x + u * bk.w, Z = (v: number) => bk.z + v * bk.h;
  const col = (s: string) => hex(s), wall = col(r.pal.light), b = r.box, yw = y0 + P(r.wallPx);
  const x0 = X(b[0]), x1 = X(b[1]), z0 = Z(b[2]), z1 = Z(b[3]), win = { floorH: 0.3 };
  const rf = r.roof, rise = P(rf.risePx);
  if (r.ex) Wg.box(X(r.ex.box[0]), Z(r.ex.box[2]), X(r.ex.box[1]), Z(r.ex.box[3]), y0, y0 + P(r.ex.hPx), wall, col(shade(r.pal.dark, 10)), win);
  const flatTop = rf.kind === 'flat' || rf.kind === 'parapet';
  Wg.box(x0, z0, x1, z1, y0, yw, wall, flatTop ? col(rf.color) : null, win);
  if (rf.kind === 'parapet') {                                   // 女兒牆：屋頂板往內收 7%（shrinkPara547 .07）再墊高 4px
    const du = (x1 - x0) * .035, dv = (z1 - z0) * .035;
    Og.box(x0 + du, z0 + dv, x1 - du, z1 - dv, yw, yw + rise, col(shade(r.pal.light, -10)), col(shade(r.pal.dark, 14)), null);
  } else if (rf.kind === 'gables') {                              // 一戶一尖：沿 x 分戶，每戶一個朝正面的山牆
    const dx = (x1 - x0) / rf.units;
    for (let i = 0; i < rf.units; i++) Og.gable(x0 + i * dx, z0, x0 + (i + 1) * dx, z1, yw, rise, col(TERRA[(i + r.v) % TERRA.length]), wall, 'z');
  } else if (rf.kind === 'gable') Og.gable(x0, z0, x1, z1, yw, rise, col(rf.color), wall, rf.axis ? 'x' : 'z');
  else if (rf.kind === 'hip') Og.hip(x0, z0, x1, z1, yw, rise, col(rf.color));
  else if (rf.kind === 'saw') Og.saw(x0, z0, x1, z1, yw, rise, rf.units, rf.axis === 0, col(shade(rf.color, 10)), col(r.pal.glass));
  if (r.upper) {
    const u = r.upper.box, top = r.k === 2 ? shade(r.pal.dark, 18) : shade(r.pal.roof, r.lv === 1 ? 8 : -6);
    Wg.box(X(u[0]), Z(u[2]), X(u[1]), Z(u[3]), yw, yw + P(r.upper.hPx), wall, col(top), win);
  }
  for (const s of r.stacks) {
    const sx = X(s.u), sz = Z(s.v), base = s.tall ? yw : r.upper ? yw + P(r.upper.hPx) : yw, h = P(s.hPx);
    if (s.tall) Og.cylinder(sx, sz, s.r, s.r * 0.8, base, h, col('#4b5158'), 6);
    else Og.box(sx - s.r, sz - s.r, sx + s.r, sz + s.r, base, base + h, col(r.k === 1 ? shade(r.pal.dark, -6) : '#4b5158'), col('#3a3a3a'), null);
  }
  return new THREE.Vector3((x0 + x1) / 2, yw, (z0 + z1) / 2);   // 主體頂面的中心（從上往下點街區的中間）
}

export function buildCityScene(c: City, look: KindLook, style: Style, blocks?: BlockRender): BuiltCity {
  const n = c.n, nn = n * n, scene = new THREE.Scene();
  const T: Record<string, number> = {}; let tp = performance.now(); const mark = (k: string) => { const q = performance.now(); T[k] = q - tp; tp = q; };
  scene.background = new THREE.Color().setHSL(0.58, 0.35, 0.82, THREE.SRGBColorSpace);
  const disposables: { dispose(): void }[] = [];
  const ramp = style.toon ? toonRamp() : null;
  if (ramp) disposables.push(ramp);
  const mat = (opts: { map?: THREE.Texture; vertexColors?: boolean; color?: THREE.ColorRepresentation }) => {
    const m = style.toon ? new THREE.MeshToonMaterial({ ...opts, gradientMap: ramp! }) : new THREE.MeshStandardMaterial({ ...opts, roughness: 0.92, metalness: 0 });
    disposables.push(m); return m;
  };

  // ---- 地面：每格一片頂面（貼圖），高低差處補直立的岸／崖面，地圖四周補一圈底座 ----
  const S = Math.max(1, Math.min(4, Math.floor(2048 / n)));
  const gtex = groundTexture(c, look, S); disposables.push(gtex);
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
  const Wg = new Geo(), Og = new Geo();
  const anchors = new Map<number, THREE.Vector3>();
  const RCI = new Set(['R', 'C', 'I']);
  for (const b of c.buildings) {
    const cat = look.cat(b.k), s = b.size, root = Math.min(nn - 1, b.z * n + b.x);
    if (b.x + s > n || b.z + s > n) continue;                  // 出界的建築不畫（城市模型已計數）
    if (blocks && b.k >= 1 && b.k <= 3) continue;               // D004：住商工交給街區配方（下面）
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
  const blockAnchors: (THREE.Vector3 | null)[] = [];
  if (blocks) blocks.plan.forEach((bk, bi) => {
    Wg.owner = Og.owner = -(bi + 1);
    let y0 = 0;
    for (const i of bk.cells) y0 = Math.max(y0, top[i]);
    blockAnchors[bi] = drawBlock(Wg, Og, bk, blocks.recipe(bk), y0);
  });
  Wg.owner = Og.owner = 0;
  // 高架路：路面抬高、每兩格一根橋墩
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const i = z * n + x;
    if (!c.fly[i] || !c.road[i]) continue;
    const y = Math.max(0, top[i]) + 0.42;
    Og.box(x, z, x + 1, z + 1, y, y + 0.08, C(0, 0, 0.62), C(0, 0, 0.36), null);
    if ((x + z) % 2 === 0) Og.box(x + 0.44, z + 0.44, x + 0.56, z + 0.56, Math.max(0, top[i]), y, C(0, 0, 0.6), null, null);
  }
  const texW = windowTexture(); disposables.push(texW);
  const wallsMesh = new THREE.Mesh(Wg.geometry(), mat({ map: texW, vertexColors: true }));
  const otherMesh = new THREE.Mesh(Og.geometry(), mat({ vertexColors: true }));
  const owners = new Map<THREE.Object3D, Int32Array>([[wallsMesh, Int32Array.from(Wg.owners)], [otherMesh, Int32Array.from(Og.owners)]]);
  for (const m of [wallsMesh, otherMesh]) { m.castShadow = m.receiveShadow = true; disposables.push(m.geometry); scene.add(m); }
  const drawn = new Set<number>(), drawnBlocks = new Set<number>();
  for (const a of owners.values()) for (const id of a) if (id > 0) drawn.add(id); else if (id < 0) drawnBlocks.add(-id - 1);
  if (blocks) for (const bi of drawnBlocks) for (const i of blocks.plan[bi].cells) if (c.occ[i]) drawn.add(c.occ[i]);
  mark('buildings');

  // ---- 樹：偶數樹種是針葉（錐形），奇數是闊葉（圓冠）；有建築、道路、水的格子不種 ----
  const spots: [number, number, number, number][] = [];
  for (let i = 0; i < nn; i++) if (c.tree[i] && !c.occ[i] && !c.road[i] && c.ter[i] !== 0 && !c.rail[i]) spots.push([i % n, (i / n) | 0, c.tree[i], top[i]]);
  if (spots.length) {
    const round = spots.filter(s => s[2] % 2 === 1), cone = spots.filter(s => s[2] % 2 === 0);
    const tg = new THREE.CylinderGeometry(0.045, 0.06, 0.28, 5), rg = new THREE.IcosahedronGeometry(0.3, 0), cg = new THREE.ConeGeometry(0.28, 0.7, 6);
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
    place(round, crownsR, false); place(cone, crownsC, true);
    for (const m of [trunks, crownsR, crownsC]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }
  mark('trees');

  // ---- 光：從畫面左上方來（同 D002）----
  const center = new THREE.Vector3(n / 2, 0, n / 2);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x6b5a44, style.toon ? 1.1 : 1.35));
  const sun = new THREE.DirectionalLight(0xfff4e0, style.toon ? 2.2 : 2.4);
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
  const pickables: THREE.Object3D[] = [wallsMesh, otherMesh, ground];
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
    dispose: () => { for (const d of disposables) d.dispose(); },
  };
}
