// 住商工街區的 3D 畫法（D004 量體＋D005 點綴）：只讀配方與擺放計畫，不改城市（規則 2）；畫面全部由程式生成（規則 7）。
// 框 [u0,u1,v0,v1] 的 u 沿 x、v 沿 z（v＝1 是正面，朝鏡頭）；像素 ÷39.2＝格。牆用受光面的顏色（light），背光面交給 3D 打光。
import * as THREE from 'three';
import type { Geo } from './scene.ts';
import type { DrawBlock } from '../content/blocks.ts';
import { PX_PER_CELL, TERRA, shade, type Recipe } from '../content/recipes.ts';
import type { Dressing, KitItem } from '../content/dressing.ts';
import { WIN_STYLE } from './windows.ts';
import type { FacadePlan, TrimPlan } from '../content/facades.ts';

export interface YardTree { x: number; z: number; y: number; s: number }
export interface ArtCounts { props: number; edges: number; kits: number; awnings: number; doors: number; docks: number; shopBands: number; plainBands: number; units: number; rows: number; parts: number; trims: number; partKinds: Record<string, number> }
export const emptyCounts = (): ArtCounts => ({ props: 0, edges: 0, kits: 0, awnings: 0, doors: 0, docks: 0, shopBands: 0, plainBands: 0, units: 0, rows: 0, parts: 0, trims: 0, partKinds: {} });

const cache = new Map<string, THREE.Color>();
const col = (s: string) => { let c = cache.get(s); if (!c) { c = new THREE.Color(s); cache.set(s, c); } return c; };
const P = (px: number) => px / PX_PER_CELL;

// Wg＝有窗的牆、Og＝屋頂與量體細節（都投影子）；Dg＝點綴（前庭道具、屋頂設備、雨遮、門、裝卸口）：不投影子，手機上省一半三角形（影子那趟不畫它）
// fp／tp：D008 英美立面逐戶計畫與核心路徑飾條（A 檔不帶，維持 D007 的樣子）
export function drawBlock(Wg: Geo, Og: Geo, Dg: Geo, bk: DrawBlock, r: Recipe, d: Dressing, y0: number, trees: YardTree[], n: ArtCounts, fp: FacadePlan | null = null, tp: TrimPlan | null = null): THREE.Vector3 {
  const X = (u: number) => bk.x + u * bk.w, Z = (v: number) => bk.z + v * bk.h;
  const wall = col(r.pal.light), glass = col(r.pal.glass), b = r.box, yw = y0 + P(r.wallPx);
  const x0 = X(b[0]), x1 = X(b[1]), z0 = Z(b[2]), z1 = Z(b[3]);
  const style = WIN_STYLE[r.win] ?? WIN_STYLE.grid, floorH = Math.max(.22, 2 * r.winRowPx / PX_PER_CELL);
  const win = { floorH, style, glass };
  const rf = r.roof, rise = P(rf.risePx), core = r.path === 'core';
  // 第二量體（massBox568：小方窗）
  if (r.ex) Wg.box(X(r.ex.box[0]), Z(r.ex.box[2]), X(r.ex.box[1]), Z(r.ex.box[3]), y0, y0 + P(r.ex.hPx), wall, col(shade(r.pal.dark, 10)), { floorH, style: WIN_STYLE.grid, glass });
  // 主體牆：商業核心一樓是店面帶（壓暗的牆＋店面大窗）；工業牆下 45% 不開窗（71396）。
  // 兩種色帶都畫在同一個牆盒裡，由著色器依高度換窗型（windows.ts wBand），不多一圈牆
  const flatTop = rf.kind === 'flat' || rf.kind === 'parapet', topCol = flatTop ? col(rf.color) : null;
  let band: { bandH: number; bandShop: boolean } | null = null;
  if (core && r.k === 2 && d.shopPx > 0) { band = { bandH: P(d.shopPx), bandShop: true }; n.shopBands++; }
  else if (core && r.k === 3) { band = { bandH: (yw - y0) * .45, bandShop: false }; n.plainBands++; }
  if (fp) drawFacade(Wg, Og, Dg, fp, r, x0, z0, x1, z1, y0, yw, rise, win, n);
  else {
    Wg.box(x0, z0, x1, z1, y0, yw, wall, topCol, band ? { ...win, ...band } : win);
    if (tp) drawTrim(Dg, tp, x0, z0, x1, z1, y0, yw, n);
    if (rf.kind === 'parapet') {                                   // 女兒牆：屋頂板往內收 7%（shrinkPara547 .07）再墊高 4px
      const du = (x1 - x0) * .035, dv = (z1 - z0) * .035;
      Og.box(x0 + du, z0 + dv, x1 - du, z1 - dv, yw, yw + rise, col(shade(r.pal.light, -10)), col(shade(r.pal.dark, 14)), null);
    } else if (rf.kind === 'gables') {                              // 一戶一尖：沿 x 分戶，每戶一個朝正面的山牆
      const dx = (x1 - x0) / rf.units;
      for (let i = 0; i < rf.units; i++) Og.gable(x0 + i * dx, z0, x0 + (i + 1) * dx, z1, yw, rise, col(TERRA[(i + r.v) % TERRA.length]), wall, 'z');
    } else if (rf.kind === 'gable') Og.gable(x0, z0, x1, z1, yw, rise, col(rf.color), wall, rf.axis ? 'x' : 'z');
    else if (rf.kind === 'hip') Og.hip(x0, z0, x1, z1, yw, rise, col(rf.color));
    else if (rf.kind === 'saw') Og.saw(x0, z0, x1, z1, yw, rise, rf.units, rf.axis === 0, col(shade(rf.color, 10)), glass);
  }
  if (r.upper) {
    const u = r.upper.box, top = r.k === 2 ? shade(r.pal.dark, 18) : shade(r.pal.roof, r.lv === 1 ? 8 : -6);
    Wg.box(X(u[0]), Z(u[2]), X(u[1]), Z(u[3]), yw, yw + P(r.upper.hPx), wall, col(top), r.k === 3 ? null : win);   // 工業上層不開窗（71433）
  }
  for (const s of r.stacks) {
    const sx = X(s.u), sz = Z(s.v), base = s.tall ? yw : r.upper ? yw + P(r.upper.hPx) : yw, h = P(s.hPx);
    if (s.tall) { Og.cylinder(sx, sz, s.r, s.r * 0.8, base, h, col('#4b5158'), 6); Og.cylinder(sx, sz, s.r * 1.05, s.r * 1.05, base + h - .1, .1, col(r.pal.accent), 6); }
    else Dg.box(sx - s.r, sz - s.r, sx + s.r, sz + s.r, base, base + h, col(r.k === 1 ? shade(r.pal.dark, -6) : '#4b5158'), col(r.k === 1 ? '#3a3a3a' : r.pal.accent), null);   // 小煙囪不投影子（D005 手機預算）
  }
  // ---- 屋頂設備（roofKit559）----
  const roofOf = (k: KitItem): [number[], number] => {
    if (k.on === 'ex') return [r.ex!.box, y0 + P(r.ex!.hPx)];
    if (k.on === 'upper') return [r.upper!.box, yw + P(r.upper!.hPx)];
    if (k.on === 'deck') { const du = (b[1] - b[0]) * .035, dv = (b[3] - b[2]) * .035; return [[b[0] + du, b[1] - du, b[2] + dv, b[3] - dv], yw + rise]; }
    return [b, yw];
  };
  for (const k of d.kits) {
    const [rb, ry] = roofOf(k), cx = X(rb[0] + (rb[1] - rb[0]) * k.u), cz = Z(rb[2] + (rb[3] - rb[2]) * k.v);
    if (k.kind === 'ac') Dg.box(cx - .06, cz - .04, cx + .06, cz + .04, ry, ry + .07, col('#b9c0c6'), col('#dfe4e8'), null);
    else if (k.kind === 'vent') Dg.box(cx - .015, cz - .015, cx + .015, cz + .015, ry, ry + .15, col('#9aa1a7'), col('#c3c9ce'), null);
    else if (k.kind === 'stair') Dg.box(cx - .09, cz - .07, cx + .09, cz + .07, ry, ry + .17, col(shade(r.pal.dark, 14)), col(shade(r.pal.light, 10)), null);
    else Dg.box(cx - .065, cz - .065, cx + .065, cz + .065, ry, ry + .24, col('#8a8272'), col('#b0a692'), null);
    n.kits++;
  }
  // ---- 前庭道具（lotFill570／villaYard559）----
  for (const p of d.props) {
    const px = X(p.u), pz = Z(p.v);
    const slab = (hw: number, hd: number, h: number, c: string) => Dg.quad([px - hw, y0 + h, pz - hd], [px + hw, y0 + h, pz - hd], [px + hw, y0 + h, pz + hd], [px - hw, y0 + h, pz + hd], [0, 1, 0], col(c));
    const bx = (hw: number, hd: number, h0: number, h1: number, c: string, t: string | null) => Dg.box(px - hw, pz - hd, px + hw, pz + hd, y0 + h0, y0 + h1, col(c), t ? col(t) : null, null);
    switch (p.kind) {
      case 'tree': trees.push({ x: px, z: pz, y: y0, s: .55 }); break;
      case 'bench': slab(.09, .03, .03, '#b9b2a2'); break;
      case 'post': bx(.012, .012, 0, .12, '#9aa1a7', '#c3c9ce'); break;
      case 'lamp': bx(.012, .012, 0, .28, '#b9bcc0', '#e2e5e8'); break;
      case 'planter': bx(.08, .05, 0, .07, '#7b6a52', '#3f7a3c'); break;
      case 'crate': bx(.08, .04, 0, .05, '#8a6a42', '#a5824f'); break;
      case 'flowerbed': slab(.13, .05, .04, '#d4566a'); break;
      case 'drive': slab(.17, .1, .012, '#6b6760'); break;
      case 'container': bx(.19, .08, 0, .18, p.color!, shade(p.color!, 26)); break;
      case 'car': bx(.13, .06, .012, .1, p.color!, shade(p.color!, 24)); break;
      case 'truck': bx(.16, .065, .02, .14, '#8b8f93', '#a9adb1'); Dg.box(px + .16, pz - .065, px + .26, pz + .065, y0 + .02, y0 + .12, col('#c05a46'), col('#d8735c'), null); break;
    }
    n.props++;
  }
  for (const e of d.edges) {                                      // villa：後兩邊綠籬、前兩邊矮圍欄（東側留門）
    const hedge = e.kind === 'hedge', th = hedge ? .03 : .01, h = hedge ? .13 : .1, c = hedge ? '#2f5a2c' : '#cfc6b2', t = hedge ? '#437a3a' : '#e8e1cf';
    const seg = (a0: number, a1: number) => {
      const ua = e.u0 + (e.u1 - e.u0) * a0, ub = e.u0 + (e.u1 - e.u0) * a1, va = e.v0 + (e.v1 - e.v0) * a0, vb = e.v0 + (e.v1 - e.v0) * a1;
      const ix = e.u0 === e.u1 ? (e.u0 < .5 ? th : -th) : 0, iz = e.v0 === e.v1 ? (e.v0 < .5 ? th : -th) : 0;   // 往地界內收半個厚度
      Dg.box(Math.min(X(ua), X(ub)) + ix - th, Math.min(Z(va), Z(vb)) + iz - th, Math.max(X(ua), X(ub)) + ix + th, Math.max(Z(va), Z(vb)) + iz + th, y0, y0 + h, col(c), col(t), null);
    };
    if (e.gap !== undefined) { seg(0, e.gap - .09); seg(e.gap + .09, 1); } else seg(0, 1);
    n.edges++;
  }
  // ---- 沿街小件：雨遮、門、裝卸口（主體正面 z1）----
  const fx = (t: number) => x0 + (x1 - x0) * t;
  if (d.awnings.length) {
    const ys = y0 + P(d.shopPx);
    for (const a of d.awnings) { Dg.slope([fx(a.u0), ys, z1], [fx(a.u1), ys, z1], [fx(a.u1), ys - .06, z1 + .09], [fx(a.u0), ys - .06, z1 + .09], [0, 1, 1], col(a.color)); n.awnings++; }
  }
  for (const t of d.doors) {
    const cx = fx(t), hw = .04, dz = z1 + .004;
    Dg.quad([cx - hw, y0, dz], [cx + hw, y0, dz], [cx + hw, y0 + P(9), dz], [cx - hw, y0 + P(9), dz], [0, 0, 1], col('#3a2418'));
    n.doors++;
  }
  if (d.dock !== null) {
    const cx = fx(d.dock), hw = Math.min(.2, (x1 - x0) * .2), dz = z1 + .004, yt = y0 + P(10);
    Dg.quad([cx - hw, y0, dz], [cx + hw, y0, dz], [cx + hw, yt, dz], [cx - hw, yt, dz], [0, 0, 1], col('#2a2620'));
    Dg.slope([cx - hw - .03, yt + .06, z1], [cx + hw + .03, yt + .06, z1], [cx + hw + .03, yt + .03, z1 + .08], [cx - hw - .03, yt + .03, z1 + .08], [0, 1, 1], col('#5a5850'));
    n.docks++;
  }
  return new THREE.Vector3((x0 + x1) / 2, yw, (z0 + z1) / 2);   // 主體頂面的中心（從上往下點街區的中間）
}

// ---- D008：核心路徑的飾條（classicTrim565／modernTrim565）：四面外凸一點點的環帶，不投影子 ----
function ring(G: Geo, x0: number, z0: number, x1: number, z1: number, out: number, ya: number, yb: number, c: string) {
  G.box(x0 - out, z0 - out, x1 + out, z1 + out, ya, yb, col(c), null, null);
}
function drawTrim(Dg: Geo, t: TrimPlan, x0: number, z0: number, x1: number, z1: number, y0: number, yw: number, n: ArtCounts) {
  const h = yw - y0;
  for (const { ring: k, color } of t.rings) {
    if (k === 'coping') ring(Dg, x0, z0, x1, z1, .012, yw - P(2), yw + P(2), color);                          // 現代：女兒牆壓頂
    else if (k === 'lobby') ring(Dg, x0, z0, x1, z1, .006, y0, y0 + Math.min(P(5), h * .3), color);           // 現代：底層門廳帶
    else if (k === 'base') ring(Dg, x0, z0, x1, z1, .01, y0, y0 + Math.min(P(4), h * .25), color);            // 石／磚基座
    else if (k === 'belt') ring(Dg, x0, z0, x1, z1, .008, y0 + h * .52, y0 + h * .52 + P(2), color);          // 腰線
    else if (k === 'cornice') ring(Dg, x0, z0, x1, z1, .02, yw - P(4), yw - P(1), color);                     // 簷口
    else Dg.box(x1 - .035, z1 - .035, x1 + .012, z1 + .012, y0, yw - P(4), col(color), null, null);          // 轉角石（正面右角）
    n.trims++;
  }
}

// ---- D008：英美立面逐戶畫 ----
function drawFacade(Wg: Geo, Og: Geo, Dg: Geo, f: FacadePlan, r: Recipe, x0: number, z0: number, x1: number, z1: number, y0: number, yw: number, rise: number,
  win: { floorH: number; style: number; glass: THREE.Color }, n: ArtCounts) {
  const W = x1 - x0, D = z1 - z0, h = yw - y0, U = (u: number) => x0 + u * W;
  const shop = f.style === 'usMainStreet' && r.lv < 2 || f.style === 'ukHighStreet' && r.lv < 2;
  const lighten = (c: string, a: number) => shade(c, a);
  const flat = f.roof === 'flat-parapet' || f.roof === 'stepped', roofTop = flat ? col(f.roofColor) : null, front = f.rows.length - 1;
  const rowZ = (ri: number): [number, number] => [z0 + f.rows[ri].v0 * D, z0 + f.rows[ri].v1 * D];
  // 逐排：後排（背靠背）只有牆與屋頂，最後一排是正面、逐戶畫；每排各自一道屋脊（連棟、半獨立的 M 形屋頂）
  for (let ri = 0; ri <= front; ri++) {
    const [za, zb] = rowZ(ri), rr = P(f.rows[ri].risePx);
    for (const u of f.units) {
      const ua = U(u.u0), ub = U(u.u1), top = yw + P(u.dhPx);
      if (u.upper) {                                                  // 半獨立屋：下層紅磚、上層粉刷
        Wg.box(ua, za, ub, zb, y0, y0 + h * .5, col(u.wall), null, win);
        Wg.box(ua, za, ub, zb, y0 + h * .5, top, col(u.upper), roofTop, win);
      } else Wg.box(ua, za, ub, zb, y0, top, col(u.wall), f.roof === 'mansard' ? null : roofTop, shop ? { ...win, bandH: P(11), bandShop: true } : win);
      if (f.roof === 'stepped') Dg.box(ua, zb - .02, ub, zb + .01, top, top + P(3), col(lighten(u.wall, 24)), col(lighten(u.wall, 30)), null);   // 主街女兒牆壓頂
      if (ri === front) n.units++;
    }
    if (f.roof === 'gable') Og.gable(x0, za, x1, zb, yw, rr, col(f.roofColor), col(f.units[0].wall), 'x');
    else if (f.roof === 'hip-pairs') for (let i = 0; i < f.units.length; i += 2) Og.hip(U(f.units[i].u0), za, U(f.units[Math.min(i + 1, f.units.length - 1)].u1), zb, yw, rr, col(f.roofColor));
    n.rows++;
  }
  if (f.roof === 'mansard') {                                  // 孟莎：四面斜屋面往內收、平頂
    const inset = Math.min(W, D) * .16, ym = yw + Math.max(P(10), h * .22), c = col(f.roofColor);
    Og.slope([x0, yw, z1], [x1, yw, z1], [x1 - inset, ym, z1 - inset], [x0 + inset, ym, z1 - inset], [0, 1, 1], c);
    Og.slope([x0, yw, z0], [x1, yw, z0], [x1 - inset, ym, z0 + inset], [x0 + inset, ym, z0 + inset], [0, 1, -1], c);
    Og.slope([x1, yw, z0], [x1, yw, z1], [x1 - inset, ym, z1 - inset], [x1 - inset, ym, z0 + inset], [1, 1, 0], c);
    Og.slope([x0, yw, z0], [x0, yw, z1], [x0 + inset, ym, z1 - inset], [x0 + inset, ym, z0 + inset], [-1, 1, 0], c);
    Og.quad([x0 + inset, ym, z0 + inset], [x1 - inset, ym, z0 + inset], [x1 - inset, ym, z1 - inset], [x0 + inset, ym, z1 - inset], [0, 1, 0], col(shade(f.roofColor, 12)));
  }
  // 帶：簷口、陽台、基座、樓板帶
  const trimC = f.units[0].upper ?? f.units[0].wall;
  for (const b of f.bands) {
    if (b === 'cornice') ring(Dg, x0, z0, x1, z1, .025, yw - P(3), yw + P(1), lighten(trimC, 40));
    else if (b === 'balcony') { Dg.box(x0, z1, x1, z1 + .08, y0 + h * .33, y0 + h * .33 + P(2), col(lighten(trimC, 30)), col(lighten(trimC, 36)), null); Dg.box(x0, z1 + .07, x1, z1 + .08, y0 + h * .33, y0 + h * .33 + P(5), col('#2a2e34'), null, null); }
    else if (b === 'base') ring(Dg, x0, z0, x1, z1, .012, y0, y0 + Math.min(P(6), h * .3), lighten(trimC, -24));
    else if (b === 'floors') for (let y = y0 + win.floorH; y < yw - P(4); y += win.floorH) ring(Dg, x0, z0, x1, z1, .01, y, y + P(1.5), '#e8e0cc');
    n.trims++;
  }
  // 小件
  for (const p of f.parts) {
    const cx = U(p.u), hw = Math.max(.02, p.w * W / 2);
    switch (p.kind) {
      case 'bay': Wg.box(cx - hw, z1, cx + hw, z1 + .07, y0, y0 + h * .42, col(lighten(f.units[0].wall, 12)), col(f.roofColor), { floorH: h * .42, style: WIN_STYLE.arch, glass: col(r.pal.glass) }); break;
      case 'bay2': Wg.box(cx - hw, z1, cx + hw, z1 + .07, y0, y0 + h * .88, col(f.units[0].upper ?? f.units[0].wall), col(f.roofColor), { floorH: h * .44, style: WIN_STYLE.arch, glass: col(r.pal.glass) }); break;
      case 'porch': Dg.box(cx - hw, z1, cx + hw, z1 + .1, y0 + h * .34, y0 + h * .34 + P(2), col(f.roofColor), col(f.roofColor), null); break;
      case 'chimney': {                                              // 坡頂：騎在那一排的屋脊上；平頂：靠後
        const ri = p.row ?? front, [za, zb] = rowZ(ri), rr = P(f.rows[ri].risePx), cz = flat ? z0 + D * .2 : (za + zb) / 2, base = flat ? yw : yw + rr * .5;
        Dg.box(cx - hw, cz - .04, cx + hw, cz + .04, base, yw + rr + P(6), col(lighten(f.units[0].wall, -10)), col('#3a3a3a'), null); break;
      }
      case 'stoop': Dg.box(cx - hw, z1, cx + hw, z1 + .09, y0, y0 + P(5), col('#8a7a6a'), col('#a8988a'), null); break;
      case 'pier': Dg.box(cx - hw, z1, cx + hw, z1 + .02, y0, yw, col(lighten(trimC, 18)), null, null); break;
      case 'escape': Dg.box(cx - hw, z1, cx + hw, z1 + .04, y0 + h * .2, yw - P(3), col('#2a2e34'), col('#2a2e34'), null); break;
      case 'canopy': Dg.slope([cx - hw, y0 + P(12), z1], [cx + hw, y0 + P(12), z1], [cx + hw, y0 + P(9), z1 + .09], [cx - hw, y0 + P(9), z1 + .09], [0, 1, 1], col(r.pal.accent)); break;
      case 'sign': Dg.box(cx - hw, z1, cx + hw, z1 + .015, yw - P(9), yw - P(4), col(r.pal.accent), null, null); break;
      case 'dormer': { const ym = yw + Math.max(P(10), h * .22); Wg.box(cx - hw, z1 - Math.min(W, D) * .16, cx + hw, z1 - Math.min(W, D) * .08, yw + P(2), ym - P(1), col(STONE_C), null, { floorH: ym - yw, style: WIN_STYLE.punch, glass: col(r.pal.glass) }); break; }
      case 'turret': { const rr = Math.min(hw, D * .3); Og.cylinder(cx, z1 - rr, rr, rr, y0, yw - y0 + rise * .3, col(f.units[f.units.length - 1].wall), 8); Og.cylinder(cx, z1 - rr, rr * 1.15, 0.001, yw + rise * .3, rise * 1.2, col(f.roofColor), 8); break; }
      case 'tank': { const rr = Math.min(.12, D * .15), tz = z0 + D * .3; for (const [dx, dz] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) Dg.box(cx + dx * rr - .01, tz + dz * rr - .01, cx + dx * rr + .01, tz + dz * rr + .01, yw, yw + P(8), col('#5a4a3a'), null, null); Og.cylinder(cx, tz, rr, rr, yw + P(8), P(14), col('#8a6a48'), 8); Og.cylinder(cx, tz, rr * 1.05, .001, yw + P(22), P(6), col('#5a4a3a'), 8); break; }
      case 'flag': Dg.box(cx - .008, z0 + D * .5 - .008, cx + .008, z0 + D * .5 + .008, yw, yw + P(24), col('#c8ccd0'), null, null); Dg.box(cx + .008, z0 + D * .5 - .004, cx + .1, z0 + D * .5 + .004, yw + P(18), yw + P(24), col(r.pal.accent), null, null); break;
    }
    n.parts++; n.partKinds[p.kind] = (n.partKinds[p.kind] ?? 0) + 1;
  }
}
const STONE_C = '#e0d8c4';
