// 住商工的建築配方（D004）：照抄 2D 實驗線 makeBlockSprite547 的量體公式、屋頂分支與調色盤，換算成以「格」為單位的幾何描述。
// 出處：lijiabao1998/GlimmerTown-lab @ d23c18d（v13.43／T638）index.html，行號見各段註解；對拍的黃金樣本在 src/content/samples/d004-massing.json。
// 純函式：不 import three、不碰 DOM（卡面驗收 9）；原型表由呼叫端傳進來（src/content/lab-arche.json），不在這裡 import JSON。
// 實驗線的怪癖照抄：v 同時決定原型（|v| mod 表長）與色盤（v mod 6）；畫街區用起點那格的等級與變體（見 blocks.ts）。

export interface ArcheRow { n: string; fs?: string; box: number[]; hm: number; ex?: { box: number[]; hm: number }; flat?: number; wd?: number[]; win?: string }
export type ArcheTable = Record<string, ArcheRow[]>;
export interface Palette { light: string; mid: string; dark: string; accent: string; roof: string; glass: string; lit: string }

// 注入錯誤（只給 tools/unit.mjs 驗「守衛真的會紅」用；正式畫面一律不帶）
export interface RecipeFaults { parcelMin?: number; podiumCap?: number }

export const PX_PER_CELL = 39.2;   // 實驗線精靈像素 → 格（D003 卡「高度換算的理由」）

// ARCHE568 取原型（70742 arche568）
export function archeOf(t: ArcheTable, k: number, lv: number, v: number): ArcheRow | null {
  const L = t[k + '_' + lv];
  return L && L.length ? L[Math.abs(v) % L.length] : null;
}
// T602：第一級住宅的 villa 原型不併進超街區（70747 arNameVilla600）
export const isVilla = (t: ArcheTable, k: number, lv: number, v: number) => archeOf(t, k, lv, v)?.n === 'villa';

// ---- 顏色（39978 shade、70268 metroPalette516、70748 speciesPal601）----
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return '#' + ((r << 16 | g << 8 | b).toString(16).padStart(6, '0'));
}
const RES = [['#e7c6a2', '#ba795d', '#77443c', '#6f86a3'], ['#d5c2a8', '#8d9cad', '#4d5f79', '#79a5b8'], ['#e7d7c5', '#c48770', '#8a5148', '#8cb88a'], ['#d7d2c3', '#8c8b91', '#444b5e', '#c99a62'], ['#d9c9b7', '#9f7d68', '#65504c', '#80a6c7'], ['#d6e0dd', '#7da09c', '#415d63', '#d47b5e']];
const COM = [['#98bcd8', '#4e708f', '#263b55', '#ef715f'], ['#acd6d3', '#4b888a', '#254c58', '#e6a34b'], ['#b7b5d9', '#665f9b', '#343453', '#e76880'], ['#c7d8e5', '#6581a7', '#2f435f', '#59c2c8'], ['#c9c2ad', '#8d795b', '#534833', '#f08a46'], ['#a5c5db', '#426b89', '#243d59', '#d7c35c']];
const IND = [['#a7adb0', '#687078', '#3a4148', '#d98245'], ['#b2a68f', '#776c5b', '#403a34', '#d4a240'], ['#8fa6aa', '#556d73', '#314047', '#df6e55'], ['#abb0bd', '#696f82', '#383b4b', '#61a8c7'], ['#a49b92', '#665d55', '#38322f', '#d4b45a'], ['#a6b8ad', '#60796b', '#33483e', '#e77b4e']];
const HI_ROOF: Record<number, string[]> = {
  1: ['#c45a42', '#8a5a44', '#b8884a', '#6d7a90', '#7a4e44', '#5e6b48', '#a07058', '#4d5a6a', '#c97a5a', '#6a5340', '#8b6e4c', '#5a6e7a'],
  2: ['#3d5a78', '#c4b496', '#2c3a52', '#8a6a4a', '#4a6e7a', '#5a4a6a', '#d0c4a8', '#2a3850', '#6a5a48', '#3a5068', '#b8a888', '#243040'],
  3: ['#5a6068', '#6a5a48', '#4a545c', '#5c5044', '#6b3a26', '#365058'],
};
// we＝財富（住宅色變）；實驗線畫街區精靈一律傳 1（71265）
export function metroPalette(k: number, v: number, we = 1, lv = 1): Palette {
  const src = k === 1 ? RES : k === 2 ? COM : IND, p = src[v % src.length].slice();
  if (k === 1 && we === 0) { p[0] = shade(p[0], -24); p[1] = shade(p[1], -18); p[2] = shade(p[2], -10); }
  if (k === 1 && we === 2) { p[0] = shade(p[0], 22); p[1] = shade(p[1], 16); p[3] = shade(p[3], 18); }
  let roof = shade(p[2], 8);
  if (lv >= 2) { const h = HI_ROOF[k === 1 || k === 2 ? k : 3]; roof = h[v % h.length]; }   // T543
  return { light: p[0], mid: p[1], dark: p[2], accent: p[3], roof, glass: k === 2 ? shade(p[2], 12) : '#27364c', lit: '#fffbe5' };   // T541 夜窗 FFFBE5
}
export function speciesPal(pal: Palette, ar: ArcheRow | null, k: number): Palette {
  if (!ar) return pal;
  const n = ar.n || '';
  if (n.indexOf('modern') >= 0) return { ...pal, light: '#dce2e8', mid: '#9aa4ae', dark: '#44505c', roof: k === 2 ? '#3a4652' : '#6a7380', glass: '#6a8aa8', accent: '#c45a48' };
  if (n.indexOf('town') >= 0 || n.indexOf('stone') >= 0) return { ...pal, light: '#d6c4a6', mid: '#a88c68', dark: '#5a4634', roof: '#8a3e32', glass: '#3a4a58', accent: '#c9a050' };
  if (n === 'mill' || n === 'mill3' || n === 'chimneyHall') return { ...pal, light: '#b8a090', mid: '#7a6a58', dark: '#3a322c', roof: '#6a3a28', accent: '#c45a3a' };
  if (n === 'warehouse' || n === 'tankfarm') return { ...pal, light: '#b0b4b0', mid: '#6a706c', dark: '#3a403c', roof: '#5a5850', accent: '#c9a040' };
  if (n === 'stack') return { ...pal, light: '#a8aab0', mid: '#686e78', dark: '#343840', roof: '#4a5058', accent: '#d98245' };
  return pal;
}
export const PAL_KEYS = ['light', 'mid', 'dark', 'accent', 'roof', 'glass', 'lit'] as const;

// ---- 幾何小工具（實驗線的平行四邊形座標：u 沿地圖 x、v 沿地圖 y，v＝1 是正面）----
// 屋脊方向（70536 ridgeAxis554）：1＝沿 x、0＝沿 y
export const ridgeAxis = (bw: number, bh: number, v: number) => (bw > bh + 1 ? 1 : bh > bw + 1 ? 0 : v & 1);
const lotFull = (b: number[]) => b[0] <= .02 && b[1] >= .98 && b[2] <= .02 && b[3] >= .98;   // 70789 lotFull570
// 精靈裡的地坪角點 x 座標（71261 起：locS…、pad 16、ax＝−minX；71270 blockCorners547）與 paraPt559 的 x（70584）。
// 只有鋸齒齒高（sawRise608 70931）用得到：它量的是螢幕 x 投影，照同一串浮點運算算，四捨五入才會跟實驗線一致。
function cornersX(bw: number, bh: number) {
  const xs = [0, -(bw - bh) * 32, bh * 32, -bw * 32], ax = -(Math.min(...xs) - 16);
  return { S: ax, N: ax - (bw - bh) * 32, E: ax + bh * 32, W: ax - bw * 32 };
}
const paraX = (C: { N: number; E: number; W: number }, u: number, vv: number) => C.N + u * (C.E - C.N) + vv * (C.W - C.N);
function sawRise(bw: number, bh: number, box: number[], n: number, axis: number, cap: number) {
  const G0 = cornersX(bw, bh);
  const E = paraX(G0, box[1], box[2]), S = paraX(G0, box[1], box[3]), W = paraX(G0, box[0], box[3]);
  const A = axis ? S - E : S - W, w = Math.abs(A) / Math.max(1, n);
  return Math.max(6, Math.min(cap || 14, Math.round(w * .5)));
}

// ---- 配方 ----
export type RoofKind = 'flat' | 'parapet' | 'gables' | 'gable' | 'hip' | 'saw';
export interface Roof {
  kind: RoofKind;
  risePx: number;          // 坡高／齒高／女兒牆高（像素）
  axis: 0 | 1;             // 屋脊（或鋸齒排列）方向：1＝沿 x、0＝沿 z
  units: number;           // gables：戶數（沿 x 排）；saw：齒數
  color: string;           // 屋頂主色
}
export interface Recipe {
  k: number; lv: number; w: number; h: number; v: number;
  arche: string | null;
  path: string;            // 'core'＝核心繪製；其餘是英美立面繪製器的名字（T577）
  pitch: boolean;          // 實驗線 __t547.pitch（核心路徑＝有沒有 ridge 物件：商業平頂也是 true，照抄）
  villa: boolean; split582: boolean; podium602: boolean;
  wallPx: number; stepPx: number; pitchPx: number;
  box: number[];                                   // 主體佔地框 [u0,u1,v0,v1]
  ex: { box: number[]; hm: number; hPx: number } | null;   // 第二量體（裙樓、側翼、T582 後棟）
  roof: Roof;
  upper: { box: number[]; hPx: number } | null;    // 上層量體（核心路徑、≥4 格的非住宅）
  stacks: { u: number; v: number; hPx: number; r: number; tall: boolean }[];   // 煙囪（框內座標；實驗線 chim608 等只取位置與大概高度）
  pal: Palette;
}

// 立面繪製器自己回報的坡頂旗標（T577；facade_uk1／uk2／us1 的 draw() 回傳值，73114–74660）
const FACADE_PITCH: Record<string, (lv: number) => boolean> = {
  ukTerrace: () => true, ukSemi: () => true, ukVictorian: () => false, ukMansion: () => false,
  ukHighStreet: lv => lv < 2,   // lv1 drawShops（坡頂）、lv≥2 drawHotel（平頂）
  usBrownstone: () => false, usPrewar: () => false, usMainStreet: () => false,
};
export const TERRA = ['#c45a42', '#b44a38', '#d46848', '#a04030', '#c87850', '#9a3830'];   // 住宅一戶一色（71361）

export function recipe(t: ArcheTable, k: number, lv: number, bw: number, bh: number, v: number, f: RecipeFaults = {}): Recipe {
  const span = Math.min(bw, bh), long = Math.max(bw, bh), axis = ridgeAxis(bw, bh, v) as 0 | 1, pitchSpan = axis ? long : span;
  let wallH = lv === 1 ? 14 + span * 3 : lv === 2 ? 20 + span * 4 : 26 + span * 5;
  const stepH = lv === 1 ? 10 : lv === 2 ? 16 : 22;
  let pitchH = lv === 1 ? 14 + pitchSpan * 4 : lv === 2 ? 18 + pitchSpan * 5 : 22 + pitchSpan * 6;
  if (k === 2) pitchH = 8; else if (k === 1) pitchH = Math.max(12, 8 + span * 3);   // T556 類型學
  let ar = archeOf(t, k, lv, v);
  if (ar) wallH = Math.max(8, Math.round(wallH * ar.hm));                           // T601
  const pal = speciesPal(metroPalette(k, v, 1, lv), ar, k);
  const villa = k === 1 && lv === 1 && bw * bh <= 4 && isVilla(t, k, lv, v);         // villaYard559
  let split582 = false, podium602 = false;
  // T582 前後分棟：主體在前、後棟當第二量體（T624 的順序），後棟高 ×0.85
  if (ar && !ar.ex && !villa && bw * bh >= (k === 3 ? 4 : (f.parcelMin ?? 6)) && (ar.box[3] - ar.box[2]) >= .5) {
    const b = ar.box, vm = (b[2] + b[3]) * .5;
    const back = [b[0], b[1], b[2], Math.max(b[2] + .12, vm - .04)], front = [b[0], b[1], Math.min(b[3] - .06, vm + .04), b[3]];
    ar = { ...ar, box: front, ex: { box: back, hm: ar.hm * .85 } };
    split582 = true;
  }
  // T602 裙樓：第二量體是整塊地、街區 ≥4 格 ⇒ 改成前段低裙樓
  if (ar && ar.ex && bw * bh >= 4 && lotFull(ar.ex.box)) {
    ar = { ...ar, ex: { box: [.08, .92, .06, .38], hm: Math.min(f.podiumCap ?? .40, ar.ex.hm || .4) } };
    podium602 = true;
  }
  const box = ar ? ar.box : [0, 1, 0, 1];
  const ex = ar && ar.ex ? { box: ar.ex.box, hm: ar.ex.hm, hPx: Math.max(6, Math.round(wallH * ar.ex.hm)) } : null;
  const flat = !!(ar && ar.flat);
  const bayRow604 = k === 1 && Math.min(bw, bh) >= 2 && !flat;   // T604：進深 ≥2 的住宅一戶一尖，不交給立面
  const path = ar && ar.fs && FACADE_PITCH[ar.fs] && !bayRow604 ? ar.fs : 'core';
  const stacks: Recipe['stacks'] = [];
  let roof: Roof, upper: Recipe['upper'] = null, pitch: boolean;
  if (path !== 'core') {
    // 立面細節不搬（卡面「不改什麼」）：只照它回報的坡頂畫外形。坡高用立面繪製器的量級（約 6–12px，73037／73136／73578），屋脊順正面（沿 x）
    pitch = FACADE_PITCH[path](lv);
    const depthPx = 32 * bh * (box[3] - box[2]);
    roof = pitch
      ? { kind: path === 'ukSemi' ? 'hip' : 'gable', risePx: clamp(Math.round(depthPx * .36), 6, 12), axis: 1, units: 1, color: path === 'ukSemi' ? '#b4553e' : '#5d6470' }
      : { kind: 'flat', risePx: 0, axis: 1, units: 1, color: shade(pal.dark, 6) };
  } else {
    pitch = !flat;
    const nBay = Math.max(2, Math.min(8, long));
    if (flat) roof = { kind: 'flat', risePx: 0, axis, units: 1, color: shade(pal.dark, 6) };
    else if (k === 1) {
      roof = { kind: 'gables', risePx: pitchH, axis: 0, units: nBay, color: TERRA[v % TERRA.length] };
      for (let i = 0; i < nBay; i++) stacks.push({ u: box[0] + (box[1] - box[0]) * (i + .62) / nBay, v: (box[2] + box[3]) / 2, hPx: pitchH + 6, r: .045, tall: false });
    } else if (k === 2) roof = { kind: 'parapet', risePx: 4, axis, units: 1, color: shade(pal.dark, 26) };
    else if (bw * bh >= 4) roof = { kind: 'flat', risePx: 0, axis, units: 1, color: shade(pal.roof, -6) };   // T608：有上層量體時下層是平頂
    else {
      const cap = ar && ar.n === 'warehouse' ? 8 : 14;
      roof = { kind: 'saw', risePx: sawRise(bw, bh, box, 2, axis, cap), axis, units: 2, color: pal.roof };
    }
    if (bw * bh >= 4 && k !== 1) {                                 // 上層量體：屋頂四角各往中心收 32%（shrinkPara547）
      const du = (box[1] - box[0]) * .16, dv = (box[3] - box[2]) * .16;
      upper = { box: [box[0] + du, box[1] - du, box[2] + dv, box[3] - dv], hPx: stepH };
    }
    if (k === 3) {
      const tall = !!ar && (ar.n === 'stack' || ar.n === 'chimneyHall');
      if (tall) stacks.push({ u: box[0] + (box[1] - box[0]) * .62, v: box[3] + (box[2] - box[3]) * .62, hPx: 50, r: .09, tall: true });   // roof.W→E 的 62%
      stacks.push({ u: (box[0] + box[1]) / 2 + .1 / bw, v: (box[2] + box[3]) / 2, hPx: upper ? 30 : 24, r: .05, tall: false });
    }
  }
  return {
    k, lv, w: bw, h: bh, v, arche: ar ? ar.n : null, path, pitch, villa, split582, podium602,
    wallPx: wallH, stepPx: stepH, pitchPx: pitchH, box, ex, roof, upper, stacks, pal,
  };
}

// 對拍用：這份配方在實驗線核心路徑上會留下的呼叫紀錄（跟 tools/lab-extract.mjs 包住的函式同一種格式）。
// sub＝subPara568 收到的框（主體、第二量體）；mass＝massBox568 收到的高；只有核心路徑才有 saw／shr／pp。
export function labCalls(r: Recipe) {
  const sub = [r.box, ...(r.ex ? [r.ex.box] : [])], mass = r.ex ? [r.ex.hPx] : [];
  const saw: (number | null)[][] = [], shr: number[] = [], pp: number[][] = [];
  if (r.path === 'core') {
    if (r.roof.kind === 'gables') for (let i = 0; i < r.roof.units; i++) pp.push([r.roof.risePx, 0]);
    if (r.roof.kind === 'parapet') shr.push(.07);
    if (r.roof.kind === 'saw') saw.push([2, r.roof.axis, r.arche === 'warehouse' ? 8 : 14, r.roof.risePx]);
    if (r.upper) shr.push(.32);
  }
  return { sub, mass, saw, shr, pp };
}
