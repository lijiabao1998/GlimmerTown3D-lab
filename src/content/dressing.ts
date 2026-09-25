// 街區點綴的擺放計畫（D005）：前庭道具、屋頂設備、雨遮、門、裝卸口。純函式、決定性，不 import three、不碰 DOM。
// 種類、件數上限、擺放區域照 2D 實驗線 @ d23c18d：lotFill570（70790）、villaYard559（70851）、roofKit559（70588）、
// 商業雨遮（71322）、住宅門（bayDoor557，71341／71366）、工業裝卸口（71384）。
// 實驗線的亂數 metroRand516 不搬：本線用配方的鍵（k、lv、寬、高、v）當種子，所以跟實驗線一樣「同一組配方長得一樣」。
// 位置在 3D 裡會真的插進量體，所以多一道檢查：道具不落在主體、第二量體、上層量體的框裡（實驗線是 2D 先畫道具再畫房子蓋掉）。
import { kitCount, type Recipe } from './recipes.ts';
import { mulberry32, fnv1a } from '../sim/rng.ts';
import { shade } from './recipes.ts';

export type PropKind = 'tree' | 'bench' | 'post' | 'car' | 'planter' | 'lamp' | 'container' | 'truck' | 'crate' | 'flowerbed' | 'drive';
export interface Prop { kind: PropKind; u: number; v: number; color?: string }          // u、v：地界裡的分數（u 沿 x、v 沿 z，v＝1 是正面）
export interface Edge { kind: 'hedge' | 'fence'; u0: number; v0: number; u1: number; v1: number; gap?: number }
export type KitKind = 'ac' | 'vent' | 'stair' | 'tank';
export interface KitItem { kind: KitKind; on: 'main' | 'deck' | 'upper' | 'ex'; u: number; v: number }   // u、v：那片屋頂的框裡的分數
export interface Dressing {
  props: Prop[]; edges: Edge[]; kits: KitItem[];
  awnings: { u0: number; u1: number; color: string }[];   // 主體正面，主體框裡沿 u 的分數
  doors: number[];                                         // 主體正面，主體框裡的 u
  dock: number | null;                                     // 主體正面，主體框裡的 u
  shopPx: number;                                          // 商業一樓店面帶高（像素；0＝沒有）
}

// 每種道具的上限（實驗線 lotFill570 迴圈的次數；free() 找不到空位就停）
export const PROP_CAPS: Record<number, [PropKind, number][]> = {
  1: [['tree', 3], ['bench', 4], ['post', 2]],
  2: [['car', 4], ['planter', 3], ['lamp', 4]],
  3: [['container', 3], ['truck', 2], ['crate', 3]],
};
const CARC = ['#b4544a', '#3f6f9a', '#c9a63f', '#4d7f56', '#8d5aa0', '#c4c8cc'];
const BOXC = ['#3f6f6a', '#8a4a3a', '#4a5f8a'];
const KIT_LIST: Record<number, KitKind[]> = { 1: ['ac', 'vent', 'stair', 'tank'], 2: ['ac', 'ac', 'stair', 'vent'], 3: ['ac', 'vent', 'vent', 'tank'] };

export const inBox = (b: number[], u: number, v: number, m = 0) => u > b[0] - m && u < b[1] + m && v > b[2] - m && v < b[3] + m;
// 道具不能落進的框：主體、第二量體、上層量體（上層在主體框裡，一併涵蓋）
export const solidBoxes = (r: Recipe) => [r.box, ...(r.ex ? [r.ex.box] : [])];

export function dressing(r: Recipe): Dressing {
  const R = mulberry32(parseInt(fnv1a(`dress:${r.k}_${r.lv}_${r.w}_${r.h}_${r.v}`), 16));
  const props: Prop[] = [], edges: Edge[] = [], kits: KitItem[] = [];
  const solid = solidBoxes(r), core = r.path === 'core';
  // 空位：不在量體裡、離已放的道具至少 0.3 格（前庭樹冠直徑約 0.29 格，再近就疊在一起）
  const clear = (u: number, v: number) => !solid.some(b => inBox(b, u, v, .03))
    && props.every(p => Math.hypot((p.u - u) * r.w, (p.v - v) * r.h) >= .3);
  if (r.villa) {
    // villaYard559：後兩邊綠籬、前兩邊矮圍欄（東側留門）、三棵樹、花圃、車道＋車
    edges.push({ kind: 'hedge', u0: 0, v0: 0, u1: 1, v1: 0 }, { kind: 'hedge', u0: 0, v0: 0, u1: 0, v1: 1 },
      { kind: 'fence', u0: 1, v0: 0, u1: 1, v1: 1, gap: .72 }, { kind: 'fence', u0: 0, v0: 1, u1: 1, v1: 1 });
    for (const [u, v] of [[.60, .94], [.90, .90], [.16, .92]]) props.push({ kind: 'tree', u, v });
    props.push({ kind: 'flowerbed', u: .30, v: .86 }, { kind: 'drive', u: .92, v: .60 }, { kind: 'car', u: .92, v: .60, color: r.pal.accent });
  } else if (r.lotFill) {
    // lotFill570 的 free()：先找前庭（主體框前緣之前），再找兩側；看的是 T582／T602 改動前的原型框
    const b = r.lotBox;
    const free = (): [number, number] | null => {
      if (b[3] < .90) for (let t = 0; t < 8; t++) {
        const v = Math.min(.95, b[3] + .05 + R() * (.95 - b[3] - .05)), u = .08 + R() * .84;
        if (v > b[3] + .03 && clear(u, v)) return [u, v];
      }
      for (let t = 0; t < 10; t++) { const u = .06 + R() * .88, v = .30 + R() * .64; if ((u < b[0] - .05 || u > b[1] + .05) && clear(u, v)) return [u, v]; }
      return null;
    };
    for (const [kind, cap] of PROP_CAPS[r.k]) for (let i = 0; i < cap; i++) {
      const p = free();
      if (!p) break;
      if (kind === 'car') { if (R() < .72) props.push({ kind, u: p[0], v: p[1], color: CARC[Math.floor(R() * CARC.length)] }); }
      else props.push({ kind, u: p[0], v: p[1], color: kind === 'container' ? BOXC[Math.floor(R() * BOXC.length)] : undefined });
    }
  }
  // 屋頂設備：每片屋頂 clamp(round(area×0.9),2,9) 件，落在那片屋頂框的 18%–82%，種類依 k 輪換
  for (const q of r.kits) for (let i = 0; i < kitCount(q.area); i++)
    kits.push({ kind: KIT_LIST[r.k][Math.floor(R() * 4)], on: q.on, u: .18 + R() * .64, v: .18 + R() * .64 });
  // 沿街小件（只有核心路徑；立面繪製器自己畫門窗店面）
  const long = Math.max(r.w, r.h), nBay = Math.max(2, Math.min(8, long));
  const awnings: Dressing['awnings'] = [], doors: number[] = [];
  let dock: number | null = null, shopPx = 0;
  if (core && r.k === 2) {
    shopPx = Math.min(11, Math.round(r.wallPx * .36));
    for (let i = 0; i < nBay; i++) awnings.push({ u0: i / nBay, u1: (i + .7) / nBay, color: i % 2 ? r.pal.accent : shade(r.pal.accent, -24) });
  }
  if (core && r.k === 1) for (let i = 0; i < nBay; i++) doors.push((i + (r.roof.kind === 'gables' ? .48 : .5)) / nBay);
  if (core && r.k === 3) dock = .45;
  return { props, edges, kits, awnings, doors, dock, shopPx };
}
