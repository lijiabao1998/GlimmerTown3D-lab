// 英美立面的逐戶計畫與核心路徑的飾條（D008）。純函式、決定性：不 import three、不碰 DOM。
// 參照 2D 實驗線 @ d23c18d 的立面繪製器（T577，72936–74660）與 classicTrim565／modernTrim565（70700 起）；
// 實驗線是逐像素畫的 2D 立面，這裡只取「一戶多寬、有哪些突出物、屋頂什麼形」，翻成 3D 的量體與小件。
// u：主體框裡沿正面（x）的分數 0–1；正面＝主體框 v1 那一邊（+z）。顏色是立面繪製器自帶的幾組（不走配方調色盤），逐戶用雜湊輪換。
import type { Recipe } from './recipes.ts';
import { mulberry32, fnv1a } from '../sim/rng.ts';

export type FacadeRoof = 'gable' | 'hip-pairs' | 'flat-parapet' | 'mansard' | 'stepped';
export type FacadePartKind = 'bay' | 'bay2' | 'chimney' | 'stoop' | 'porch' | 'turret' | 'tank' | 'escape' | 'dormer' | 'sign' | 'canopy' | 'pier' | 'flag';
export interface FacadeUnit { u0: number; u1: number; dhPx: number; wall: string; upper?: string }   // upper：上層牆色（半獨立屋上層粉刷）
export interface FacadePart { kind: FacadePartKind; u: number; w: number; row?: number }             // w：寬（主體框的分數）；row：煙囪在第幾排的屋脊上
export interface FacadeRow { v0: number; v1: number; risePx: number }                                 // 沿深度分排（v：主體框深度的分數）；最後一排是正面
// units 由左到右、不重疊；加上 gap（半獨立屋對與對之間的車道縫，每道同寬）剛好蓋滿正面 [0,1]
export interface FacadePlan { style: string; roof: FacadeRoof; roofColor: string; rows: FacadeRow[]; gap: number; units: FacadeUnit[]; parts: FacadePart[]; bands: ('cornice' | 'balcony' | 'base' | 'floors')[] }

const BRICK = ['#a4533f', '#9a4a3a', '#b0603f', '#8e4636', '#a85a44'];
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
// 實驗線的色碼加減（sh，73230）
const sh = (hex: string, amt: number) => { const n = parseInt(hex.slice(1), 16), c = (x: number) => x < 0 ? 0 : x > 255 ? 255 : x;
  return '#' + ((c((n >> 16) + amt) << 16) | (c(((n >> 8) & 255) + amt) << 8) | c((n & 255) + amt)).toString(16).padStart(6, '0'); };
const RENDER = ['#ece4d2', '#e6dcc4', '#f0e8d8', '#e2d8c2'];
const BROWN = ['#7a5a48', '#6e4e3e', '#84604c', '#6a4a3a'];
const TAN = ['#c8a878', '#b89868', '#d0b088'];

export function facadePlan(r: Recipe): FacadePlan | null {
  if (r.path === 'core') return null;
  const R = mulberry32(parseInt(fnv1a(`facade:${r.k}_${r.lv}_${r.w}_${r.h}_${r.v}`), 16));
  const front = Math.max(.5, (r.box[1] - r.box[0]) * r.w);   // 正面長（格）
  const LX = 32 * front, DX = 32 * r.h * (r.box[3] - r.box[2]);   // 實驗線的正面長、深度（px，一格 32px）
  const one: FacadeRow[] = [{ v0: 0, v1: 1, risePx: r.roof.risePx }];
  // 深街區背靠背多排（M 形屋頂）：排數＝clamp(round(DX/32/.72),1,3)，每排坡高 clamp(round(排深×k),lo,hi)（73025／73124）
  const rowsOf = (k: number, lo: number, hi: number): FacadeRow[] => { const n = clamp(Math.round(DX / 32 / .72), 1, 3);
    return Array.from({ length: n }, (_, i) => ({ v0: i / n, v1: (i + 1) / n, risePx: clamp(Math.round(DX / n * k), lo, hi) })); };
  const pick = (a: string[]) => a[Math.floor(R() * a.length)];
  const split = (n: number, colors: string[], dh = 0, upper?: string[]): FacadeUnit[] =>
    Array.from({ length: n }, (_, i) => ({ u0: i / n, u1: (i + 1) / n, dhPx: dh ? Math.round((R() - .5) * 2 * dh) : 0, wall: pick(colors), upper: upper ? pick(upper) : undefined }));
  const parts: FacadePart[] = [];
  switch (r.path) {
    case 'ukTerrace': {                                                        // 連棟屋（73021）：一戶 16px；每戶右側一樓凸窗；每兩戶一座煙囪（含左端）；石板長脊；深街區多排
      const n = Math.max(1, Math.round(LX / 16)), rows = rowsOf(.38, 7, 12);
      const base = r.v % 2 === 0 ? ['#b59c6a', '#ad9668', '#bea472'][r.v % 3] : ['#a0563f', '#984f3b', '#a85d45'][r.v % 3];   // 偶數 v 黃磚（stock）、奇數紅磚
      const PAINT = ['#e6dfcd', '#d9dfe6', '#ead9cf'];
      const units: FacadeUnit[] = Array.from({ length: n }, (_, i) => ({ u0: i / n, u1: (i + 1) / n, dhPx: 0, wall: R() < .11 ? PAINT[Math.floor(R() * 3)] : sh(base, Math.round((R() - .5) * 16)) }));
      units.forEach(u => parts.push({ kind: 'bay', u: u.u1 - (u.u1 - u.u0) * .28, w: (u.u1 - u.u0) * .32 }));
      const cw = .12 / front;
      rows.forEach((_, ri) => { for (let j = 0; j <= (n === 1 ? 0 : Math.floor(n / 2)); j++) parts.push({ kind: 'chimney', u: clamp(Math.min(1, 2 * j / n), cw / 2, 1 - cw / 2), w: cw, row: ri }); });
      return { style: r.path, roof: 'gable', roofColor: '#66717f', rows, gap: 0, units, parts, bands: [] };
    }
    case 'ukSemi': {                                                           // 半獨立屋（73120）：一對 24px、對與對之間 4px 車道縫；上層粉刷下層紅磚（整對同色）；
      const gapPx = 4, nP = Math.max(1, Math.round((LX + gapPx) / (24 + gapPx))), gap = nP > 1 ? gapPx / LX : 0, pw = (1 - gap * (nP - 1)) / nP;   // 兩層凸窗在兩端、門廊在中間；四坡陶瓦頂、對中央煙囪
      const rows = rowsOf(.36, 6, 11), brick = ['#a4523f', '#9c4d3c', '#ad5a44'][r.v % 3], REN = ['#e9e3d6', '#e2d8c2', '#d8d3c6', '#ece7dd'];
      const units: FacadeUnit[] = [];
      for (let p = 0; p < nP; p++) {
        const a = p * (pw + gap), b = a + pw, wall = sh(brick, Math.round((R() - .5) * 10)), upper = REN[Math.floor(R() * REN.length)];
        units.push({ u0: a, u1: a + pw / 2, dhPx: 0, wall, upper }, { u0: a + pw / 2, u1: p === nP - 1 ? 1 : b, dhPx: 0, wall, upper });
        parts.push({ kind: 'bay2', u: a + pw * .13, w: pw * .21 }, { kind: 'bay2', u: b - pw * .13, w: pw * .21 }, { kind: 'porch', u: a + pw * .5, w: pw * .36 });
        rows.forEach((_, ri) => parts.push({ kind: 'chimney', u: a + pw * .5, w: .12 / front, row: ri }));
      }
      return { style: r.path, roof: 'hip-pairs', roofColor: '#c26a44', rows, gap, units, parts, bands: [] };
    }
    case 'ukVictorian': {                                                      // 維多利亞排屋：灰泥、戶界壁柱、一樓陽台帶、簷口＋女兒牆
      const n = Math.max(2, Math.round(front * 2.5)), units = split(n, RENDER);
      for (let i = 0; i <= n; i++) parts.push({ kind: 'pier', u: clamp(i / n, .02 / front, 1 - .02 / front), w: .04 / front }, { kind: 'chimney', u: clamp(i / n, .025 / front, 1 - .025 / front), w: .05 / front });
      return { style: r.path, roof: 'flat-parapet', roofColor: '#8a8e94', rows: one, gap: 0, units, parts, bands: ['cornice', 'balcony', 'base'] };
    }
    case 'ukMansion': {                                                        // 大宅：紅磚＋白石樓板帶、孟莎屋頂＋一排天窗、中央石門廊
      const units = split(1, BRICK), nd = Math.max(2, Math.round(front * 2.5));
      for (let i = 0; i < nd; i++) parts.push({ kind: 'dormer', u: (i + .5) / nd, w: .35 / nd });
      parts.push({ kind: 'porch', u: .5, w: .18 });
      return { style: r.path, roof: 'mansard', roofColor: '#5d6470', rows: one, gap: 0, units, parts, bands: ['floors', 'cornice', 'base'] };
    }
    case 'ukHighStreet': {
      if (r.lv >= 2) {                                                         // 旅館：石砌一樓、大門雨遮、陽台帶、名牌、孟莎屋頂、旗桿
        const units = split(1, [pick(RENDER), pick(BRICK)]);
        parts.push({ kind: 'canopy', u: .5, w: .22 }, { kind: 'sign', u: .5, w: .5 }, { kind: 'flag', u: .9, w: .02 });
        return { style: r.path, roof: 'mansard', roofColor: '#5d6470', rows: one, gap: 0, units, parts, bands: ['base', 'balcony', 'cornice'] };
      }
      const n = Math.max(2, Math.round(front * 2)), units = split(n, [...BRICK, ...RENDER]);   // 店屋：一樓店面、上層磚／灰泥交錯、板岩長脊、分戶煙囪、轉角角樓
      for (let i = 1; i < n; i++) parts.push({ kind: 'chimney', u: i / n, w: .06 / front });
      parts.push({ kind: 'turret', u: .96, w: .12 });
      return { style: r.path, roof: 'gable', roofColor: '#5d6470', rows: one, gap: 0, units, parts, bands: ['base'] };
    }
    case 'usBrownstone': {                                                     // 布朗石：約半格一戶、門前石階成對鏡像、托架簷口
      const n = Math.max(2, Math.round(front * 2)), units = split(n, BROWN, 2);
      units.forEach((u, i) => parts.push({ kind: 'stoop', u: i % 2 ? u.u0 + (u.u1 - u.u0) * .22 : u.u1 - (u.u1 - u.u0) * .22, w: (u.u1 - u.u0) * .26 }));
      return { style: r.path, roof: 'flat-parapet', roofColor: '#6a6e74', rows: one, gap: 0, units, parts, bands: ['cornice'] };
    }
    case 'usPrewar': {                                                         // 戰前公寓：石基座、簷口、屋頂水塔、防火梯
      const units = split(1, [...BRICK, ...TAN]), ne = Math.max(1, Math.round(front * .8));
      for (let i = 0; i < ne; i++) parts.push({ kind: 'escape', u: (i + .5) / ne, w: .22 / ne });
      parts.push({ kind: 'tank', u: .72, w: .14 });
      return { style: r.path, roof: 'flat-parapet', roofColor: '#6a6e74', rows: one, gap: 0, units, parts, bands: ['base', 'cornice'] };
    }
    case 'usMainStreet': {
      if (r.lv >= 2) {                                                         // 芝加哥學派辦公：直立壁柱、簷口
        const units = split(1, [...BRICK, ...TAN]), np = Math.max(3, Math.round(front * 3));
        for (let i = 0; i <= np; i++) parts.push({ kind: 'pier', u: clamp(i / np, .025 / front, 1 - .025 / front), w: .05 / front });
        return { style: r.path, roof: 'flat-parapet', roofColor: '#6a6e74', rows: one, gap: 0, units, parts, bands: ['base', 'cornice'] };
      }
      const n = Math.max(2, Math.round(front * 2)), units = split(n, [...BRICK, ...TAN], 6);   // 主街店屋：每戶女兒牆高低不一、雨遮、招牌
      units.forEach(u => parts.push({ kind: 'canopy', u: (u.u0 + u.u1) / 2, w: (u.u1 - u.u0) * .8 }, { kind: 'sign', u: (u.u0 + u.u1) / 2, w: (u.u1 - u.u0) * .6 }));
      return { style: r.path, roof: 'stepped', roofColor: '#6a6e74', rows: one, gap: 0, units, parts, bands: [] };
    }
  }
  return null;
}

// 核心路徑的飾條（D008）：石／磚＝基座帶、腰線（牆高 52%）、簷口、轉角石；現代＝女兒牆壓頂、門廳帶（classicTrim565／modernTrim565）
export type TrimRing = 'base' | 'belt' | 'cornice' | 'quoin' | 'coping' | 'lobby';
export interface TrimPlan { kind: 'stone' | 'brick' | 'modern'; rings: { ring: TrimRing; color: string }[] }   // 由下往上；quoin 是正面右角的轉角石
const TRIM565: Record<string, { base: string; band: string; cor: string; quoin: string }> = {
  stone: { base: '#b9b09c', band: '#cfc5ae', cor: '#ddd3bb', quoin: '#cdc3ac' },   // 70697 TRIM565.stone（受光面色）
  brick: { base: '#8f4a38', band: '#d8c9b4', cor: '#e2d6c2', quoin: '#9a5240' },   // 70698 TRIM565.brick
};
export function trimPlan(r: Recipe): TrimPlan | null {
  if (!r.trim) return null;
  if (r.trim === 'modern') return { kind: 'modern', rings: [{ ring: 'lobby', color: '#3a4a58' }, { ring: 'coping', color: '#d3d8dc' }] };   // 門廳帶＋女兒牆壓頂
  const T = TRIM565[r.trim], rings: TrimPlan['rings'] = [{ ring: 'base', color: T.base }];
  if (r.wallPx > 14) rings.push({ ring: 'belt', color: T.band });   // 腰線（牆高 52%）：牆太矮（≤14px）不畫
  rings.push({ ring: 'cornice', color: T.cor }, { ring: 'quoin', color: T.quoin });
  return { kind: r.trim, rings };
}
