// 非住商工建築的 3D 畫法（D007）：依 src/content/kindShapes.ts 的造型表，逐種組出量體。
// 只讀城市與內容表、不改城市（規則 2）；畫面全部由程式生成（規則 7）。
// 座標：地界裡用分數 u（沿 x）、v（沿 z，v＝1 是正面、朝鏡頭）；高度用格。H＝D003 量到的實驗線高度（格），最高那一件對準 H。
// 顏色：lab-looks.json 讀出的受光牆、屋頂、點綴、地坪（實驗線精靈圖），缺的用分類色補。
import * as THREE from 'three';
import type { Geo } from './scene.ts';
import type { YardTree } from './blockArt.ts';
import type { Shape, KindColors } from '../content/kindShapes.ts';
import { WIN_STYLE } from './windows.ts';

export interface KindCtx {
  W: Geo; O: Geo; D: Geo; trees: YardTree[];
  x0: number; z0: number; s: number; y0: number; H: number; k: number; C: KindColors;
}

const cache = new Map<string, THREE.Color>();
let USED: Set<string> | null = null;
export const col = (s: string) => { USED?.add(s.toLowerCase()); let c = cache.get(s); if (!c) { c = new THREE.Color(s); cache.set(s, c); } return c; };
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SC = new THREE.Vector3();
const GEO = {
  sphere: new THREE.SphereGeometry(1, 8, 5),        // 段數壓低：像素風看不出差別，手機預算（D007 種子城 A 檔差 194 個三角形）
  dome: new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.06, 3, 12),
  box: new THREE.BoxGeometry(1, 1, 1),
  barrel: new THREE.CylinderGeometry(1, 1, 1, 6, 1, false, 0, Math.PI),
  cone4: new THREE.ConeGeometry(1, 1, 4, 1, true),
  hyper: new THREE.LatheGeometry([new THREE.Vector2(1, 0), new THREE.Vector2(0.72, 0.55), new THREE.Vector2(0.62, 0.8), new THREE.Vector2(0.68, 1)], 8),
};

// 一棟的畫筆：座標換算＋常用部件
class Pen {
  a: KindCtx;
  constructor(a: KindCtx) { this.a = a; }   // 不用 TS 參數屬性：Node 的型別剝除不支援（單元守衛要 import 這支）
  X(u: number) { return this.a.x0 + u * this.a.s; }
  Z(v: number) { return this.a.z0 + v * this.a.s; }
  get H() { return this.a.H; }
  get c() { return this.a.C; }
  // 有窗的量體（牆用窗磚）；win＝false 用素牆
  blk(u0: number, u1: number, v0: number, v1: number, h0: number, h1: number, wall: string, top: string | null, win: boolean | string = true, glass = '#3a4a58') {
    const y = this.a.y0, w = win ? { floorH: 0.28, style: typeof win === 'string' ? WIN_STYLE[win] : WIN_STYLE.grid, glass: col(glass) } : null;
    (win ? this.a.W : this.a.O).box(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), y + h0, y + h1, col(wall), top ? col(top) : null, w);
  }
  // 小件（不投影子）：路燈、車、貨櫃、欄杆……
  bit(u0: number, u1: number, v0: number, v1: number, h0: number, h1: number, wall: string, top: string | null = null) {
    const y = this.a.y0;
    this.a.D.box(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), y + h0, y + h1, col(wall), col(top ?? wall), null);
  }
  gable(u0: number, u1: number, v0: number, v1: number, h: number, rise: number, roof: string, wall: string, along?: 'x' | 'z') {
    this.a.O.gable(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), this.a.y0 + h, rise, col(roof), col(wall), along);
  }
  hip(u0: number, u1: number, v0: number, v1: number, h: number, rise: number, roof: string) {
    this.a.O.hip(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), this.a.y0 + h, rise, col(roof));
  }
  pyr(u: number, v: number, half: number, h: number, rise: number, roof: string) {   // half：邊長一半（格）
    this.a.O.pyramid(this.X(u), this.Z(v), half, this.a.y0 + h, rise, col(roof));
  }
  cyl(u: number, v: number, r: number, h0: number, h1: number, c: string, seg = 8, rTop = r) {
    this.a.O.cylinder(this.X(u), this.Z(v), r, rTop, this.a.y0 + h0, h1 - h0, col(c), seg);
  }
  cone(u: number, v: number, r: number, h0: number, h1: number, c: string, seg = 8) { this.cyl(u, v, r, h0, h1, c, seg, 0.001); }
  geo(g: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string, rx = 0, ry = 0, rz = 0, mesh: 'O' | 'D' = 'O') {
    M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), SC.set(sx, sy, sz));
    this.a[mesh].addGeometry(g, M, col(c));
  }
  barrel(u: number, v: number, halfW: number, len: number, rise: number, h: number, c: string, alongZ = true) {
    M.compose(V.set(this.X(u), this.a.y0 + h, this.Z(v)), Q.setFromEuler(alongZ ? E.set(Math.PI / 2, 0, Math.PI / 2, 'ZYX') : E.set(Math.PI, 0, -Math.PI / 2, 'XYZ')), SC.set(rise, len, halfW));
    this.a.O.addGeometry(GEO.barrel, M, col(c));
  }
  // 葉片／風車翼：從轂心往外一支，在朝鏡頭的斜面（繞 y 轉 45°）上轉 angle
  spoke(x: number, y: number, z: number, len: number, w: number, angle: number, c: string) {
    V.set(0, len / 2, 0).applyEuler(E.set(0, Math.PI / 4, angle, 'XYZ'));
    M.compose(V.set(x + V.x, y + V.y, z + V.z), Q.setFromEuler(E.set(0, Math.PI / 4, angle, 'XYZ')), SC.set(w, len, w * .3));
    this.a.O.addGeometry(GEO.box, M, col(c));
  }
  domeH(u: number, v: number, r: number, h: number, rise: number, c: string) { this.geo(GEO.dome, this.X(u), this.a.y0 + h, this.Z(v), r, rise, r, c); }
  dome(u: number, v: number, r: number, h: number, c: string) { this.geo(GEO.dome, this.X(u), this.a.y0 + h, this.Z(v), r, r, r, c); }
  ball(u: number, v: number, r: number, h: number, c: string) { this.geo(GEO.sphere, this.X(u), this.a.y0 + h, this.Z(v), r, r, r, c); }
  // 地面上一片（球場、水面、田、停車格）：不投影子
  flat(u0: number, u1: number, v0: number, v1: number, h: number, c: string) {
    const y = this.a.y0 + h, D = this.a.D;
    D.quad([this.X(u0), y, this.Z(v0)], [this.X(u1), y, this.Z(v0)], [this.X(u1), y, this.Z(v1)], [this.X(u0), y, this.Z(v1)], [0, 1, 0], col(c));
  }
  tree(u: number, v: number, s = 0.6) { this.a.trees.push({ x: this.X(u), z: this.Z(v), y: this.a.y0, s }); }
  car(u: number, v: number, c: string, alongZ = false) {
    const hw = alongZ ? .05 : .11, hd = alongZ ? .11 : .05;
    this.a.D.box(this.X(u) - hw, this.Z(v) - hd, this.X(u) + hw, this.Z(v) + hd, this.a.y0 + .01, this.a.y0 + .09, col(c), col(c), null);
  }
  pole(u: number, v: number, w: number, h0: number, h1: number, c: string) { const x = this.X(u), z = this.Z(v); this.a.O.box(x - w, z - w, x + w, z + w, this.a.y0 + h0, this.a.y0 + h1, col(c), col(c), null); }
  // 格子上沿一條線放 n 個
  row(n: number, f: (t: number, i: number) => void) { for (let i = 0; i < n; i++) f(n === 1 ? .5 : i / (n - 1), i); }
}

const CARS = ['#b4544a', '#3f6f9a', '#c9a63f', '#4d7f56', '#8d5aa0', '#c4c8cc', '#2f3440'];
const BOXES = ['#3f6f6a', '#8a4a3a', '#4a5f8a', '#c9a040', '#b4544a', '#5a8a4a'];
const WHITE = '#e6e6e0', STONE = '#e8e1d0', BRICK = '#a4533f', DARK = '#3a3f48', STEEL = '#8b9199', GLASS = '#6f9cc4', WATER = '#3f7ec0', RED = '#c8403a', ASPH = '#4e525b';

type Builder = (p: Pen, o: Record<string, number | string | boolean>) => void;

const BUILDERS: Record<string, Builder> = {
  // ---- 高樓：裙樓＋逐段退縮的塔身＋尖頂（或飛碟餐廳、控制塔）----
  tower(p, o) {
    const H = p.H, c = p.c, glass = !!o.glass, style = glass ? 'ribbon' : 'grid', gl = glass ? GLASS : '#3a4a58';
    if (o.disk) {                                                        // 天際觀景餐廳
      p.cyl(.5, .5, .12 * p.a.s, 0, H * .78, c.wall, 8);
      p.cyl(.5, .5, .36 * p.a.s, H * .78, H * .86, c.accent || c.roof, 12, .4 * p.a.s);
      p.cyl(.5, .5, .16 * p.a.s, H * .86, H * .92, GLASS, 10);
      p.pole(.5, .5, .015, H * .92, H, STEEL);
      p.blk(.1, .9, .6, .95, 0, .25, c.wall, c.roof);
      return;
    }
    if (o.control) {                                                     // 防災中心：控制塔＋機庫
      p.blk(.15, .45, .15, .45, 0, H * .82, c.wall, null, 'grid');
      p.blk(.08, .52, .08, .52, H * .82, H, GLASS, c.roof, false);
      p.blk(.55, .95, .3, .9, 0, H * .35, c.wallR || STEEL, null, false);
      p.barrel(.75, .6, .2 * p.a.s, .6 * p.a.s, .2 * p.a.s, H * .35, c.roof);
      return;
    }
    if (o.office) {                                                      // 研究院、電網調度中心
      p.blk(.18, .82, .2, .8, 0, H, c.wall, c.roof, style, gl);
      if (o.yard) for (const [u, v] of [[.08, .1], [.9, .15], [.9, .9]]) p.bit(u - .05, u + .05, v - .05, v + .05, 0, .12, STEEL);
      p.bit(.4, .6, .4, .6, H, H + .08, STEEL);
      return;
    }
    const spire = typeof o.spire === 'number' ? o.spire : 0, bodyH = H * (1 - spire);
    let h = 0, inset = o.wide ? .06 : o.slab ? .1 : .16;
    if (o.podium) { const ph = Math.max(.3, bodyH * .1); p.blk(.04, .96, .04, .96, 0, ph, c.wallR || c.wall, c.roof, 'grid'); h = ph; }
    const n = Math.max(1, Number(o.tiers) || 1);
    const shares = n === 1 ? [1] : n === 2 ? [.62, .38] : n === 3 ? [.5, .3, .2] : [.4, .27, .2, .13];
    for (let i = 0; i < n; i++) {
      const th = (bodyH - h) * shares[i], vi = o.slab ? [.3, .7] : [inset, 1 - inset];
      p.blk(inset, 1 - inset, vi[0], vi[1], h, h + th, i % 2 && o.deco ? c.wallR || c.wall : c.wall, c.roof, style, gl);
      if (o.deco) p.bit(inset - .01, 1 - inset + .01, inset - .01, 1 - inset + .01, h + th - .06, h + th, c.accent || '#c9a050');
      h += th; inset += o.wide ? .1 : .08;
    }
    if (spire) { if (o.deco) p.cone(.5, .5, (.5 - inset) * p.a.s * .8, h, h + (H - h) * .45, c.roof, 4); p.pole(.5, .5, .018, h, H, o.deco ? STEEL : c.accent || RED); }
  },
  // ---- 大廳：購物中心、倉儲、會展、劇院、數據中心……----
  hall(p, o) {
    const H = p.H, c = p.c, wall = c.wall, big = !!o.big, small = !!o.small;
    const [u0, u1, v0, v1] = big ? [.06, .94, .1, .8] : small ? [.2, .8, .2, .75] : o.parking ? [.08, .92, .08, .55] : [.1, .9, .12, .72];
    const wallH = o.roof === 'gable' || o.roof === 'barrel' ? H * .62 : H;
    if (o.open) {                                                        // 貿易站：柱子撐的棚＋攤位
      for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) p.pole(u, v, .025, 0, wallH, c.wall);
      p.gable(u0 - .03, u1 + .03, v0 - .03, v1 + .03, wallH, H - wallH, c.roof, c.roof, 'x');
      p.row(3, t => p.bit(.2 + t * .5, .28 + t * .5, .35, .5, 0, .12, BOXES[Math.round(t * 2)]));
      return;
    }
    if (o.roof === 'barrel') {
      const n = Number(o.halls) || 1, w = (u1 - u0) / n;
      for (let i = 0; i < n; i++) {
        p.blk(u0 + i * w + .01, u0 + (i + 1) * w - .01, v0, v1, 0, wallH, wall, null, 'ribbon', GLASS);
        p.barrel(u0 + (i + .5) * w, (v0 + v1) / 2, (w / 2 - .01) * p.a.s, (v1 - v0) * p.a.s, H - wallH, wallH, i % 2 ? GLASS : c.roof);
      }
    } else {
      p.blk(u0, u1, v0, v1, 0, wallH, wall, o.roof === 'flat' ? c.roof : null, o.theater ? false : 'grid');
      if (o.roof === 'gable') p.gable(u0, u1, v0, v1, wallH, H - wallH, c.roof, wall, 'x');
    }
    if (o.coolers) p.row(4, t => p.bit(u0 + .08 + t * (u1 - u0 - .16) - .04, u0 + .08 + t * (u1 - u0 - .16) + .04, .3, .45, H, H + .1, '#b9c0c6', '#dfe4e8'));
    if (o.stacks) p.cyl(u1 - .1, v0 + .1, .04, H, H + .35, STEEL, 6);
    if (o.sign) p.bit((u0 + u1) / 2 - .18, (u0 + u1) / 2 + .18, v1, v1 + .02, H * .55, H * .95, c.accent || RED);
    if (o.theater) { p.blk(u0 + .1, u1 - .1, v0 + .05, v1 - .25, H, H * 1.25, c.wallR || wall, c.roof, false); p.bit(u0, u1, v1, v1 + .06, H * .4, H * .48, c.accent || '#e8c34a'); }
    if (o.silos) p.row(Number(o.silos), t => { const u = u1 - .08 - t * .18; p.cyl(u, v1 + .12, .07 * p.a.s, 0, H * .9, '#d8d8d0', 10); p.domeH(u, v1 + .12, .07 * p.a.s, H * .9, H * .1, '#c4c4bc'); });
    if (o.parking) { p.flat(.06, .94, .6, .96, .005, ASPH); p.row(6, (t, i) => p.car(.12 + t * .76, .72 + (i % 2) * .14, CARS[i % CARS.length])); }
    if (o.trucks) p.row(3, (t, i) => { p.bit(.15 + t * .6, .27 + t * .6, v1 + .06, v1 + .14, .02, .14, '#8b9199', '#a9adb1'); p.bit(.27 + t * .6, .31 + t * .6, v1 + .06, v1 + .14, .02, .12, CARS[i]); });
  },
  // ---- 古典建築：市政廳、法院、銀行、市民中心、中央行政園區 ----
  classic(p, o) {
    const H = p.H, c = p.c, wall = c.wall || STONE, big = !!o.big;
    const body = o.dome ? H * .55 : H * .8;
    const [u0, u1, v0, v1] = o.long ? [.06, .94, .25, .7] : big ? [.25, .75, .25, .7] : [.18, .82, .2, .72];
    p.blk(u0, u1, v0, v1, 0, body, wall, o.dome ? c.roof || '#b8b0a0' : null, 'arch');
    if (!o.dome && !o.domes) p.gable(u0, u1, v0, v1, body, H - body, c.roof || '#b8b0a0', wall, 'x');
    if (o.portico) {
      p.row(6, t => p.cyl(u0 + .04 + t * (u1 - u0 - .08), v1 + .06, .025 * p.a.s * 1.4, 0, body * .9, WHITE, 6));
      p.bit(u0, u1, v1, v1 + .12, body * .9, body, WHITE);
      p.a.O.gable(p.X(u0), p.Z(v1 - .02), p.X(u1), p.Z(v1 + .12), p.a.y0 + body, (H - body) * .8, col(WHITE), col(WHITE), 'x');
      p.bit(u0 - .03, u1 + .03, v1 + .1, v1 + .2, 0, .04, '#d8d0bc');
    }
    if (o.wings) { p.blk(big ? .06 : .04, u0, v0 + .08, v1 - .04, 0, body * .65, wall, c.roof || '#b8b0a0', 'arch'); p.blk(u1, big ? .94 : .96, v0 + .08, v1 - .04, 0, body * .65, wall, c.roof || '#b8b0a0', 'arch'); }
    if (o.dome) {
      const r = (u1 - u0) * .22 * p.a.s;
      p.cyl((u0 + u1) / 2, (v0 + v1) / 2, r, body, body + (H - body) * .35, WHITE, 12);
      p.dome((u0 + u1) / 2, (v0 + v1) / 2, r, body + (H - body) * .35, c.accent && /^#[4-9a-c][0-9a-f]{5}$/i.test(c.accent) ? c.accent : '#7fb0a0');
      p.pole((u0 + u1) / 2, (v0 + v1) / 2, .012, body + (H - body) * .35 + r, H, '#d8c060');
    }
    if (o.domes) p.row(2, t => { const u = u0 + .15 + t * (u1 - u0 - .3); p.cyl(u, (v0 + v1) / 2, .07 * p.a.s, body, body + (H - body) * .3, WHITE, 10); p.dome(u, (v0 + v1) / 2, .07 * p.a.s, body + (H - body) * .3, '#7fb0a0'); });
    if (o.gardens) { p.flat(.06, .94, .76, .96, .004, '#c9c3b5'); p.row(6, t => p.tree(.1 + t * .8, .86, .7)); p.row(4, t => p.tree(.08, .15 + t * .5, .7)); p.cyl(.5, .86, .06 * p.a.s, 0, .06, '#9ab8c8', 12); }
  },
  // ---- 紅磚：消防、警察、郵局、學校、圖書館、博物館、抽水站 ----
  brick(p, o) {
    const H = p.H, c = p.c, wall = c.wall || BRICK, roof = c.roof || '#5a4a44';
    if (o.pair) { for (const u of [.2, .62]) { p.blk(u, u + .22, .35, .65, 0, H * .7, wall, null, 'arch'); p.gable(u, u + .22, .35, .65, H * .7, H * .3, roof, wall, 'x'); } return; }
    const big = !!o.big, small = !!o.small;
    const [u0, u1, v0, v1] = big ? [.08, .78, .2, .82] : small ? [.3, .78, .35, .8] : [.12, .72, .22, .82];
    const eave = o.tower ? H * .55 : H * .75;
    p.blk(u0, u1, v0, v1, 0, eave, wall, null, 'arch');
    if (o.gable || o.school || o.museum) p.gable(u0, u1, v0, v1, eave, H * .22, roof, wall, 'x'); else p.hip(u0, u1, v0, v1, eave, H * .18, roof);
    if (o.tower === 'hose' || o.tower === 'clock' || o.tower === 'pump') {
      const tu0 = u1 - .02, tu1 = Math.min(.96, u1 + .18), tv0 = v0, tv1 = v0 + .2;
      if (o.tower === 'pump') { p.cyl((tu0 + tu1) / 2, (tv0 + tv1) / 2, .09 * p.a.s, 0, H * .85, wall, 8); p.cone((tu0 + tu1) / 2, (tv0 + tv1) / 2, .11 * p.a.s, H * .85, H, roof, 8); }
      else {
        p.blk(tu0, tu1, tv0, tv1, 0, H * .86, wall, null, false);
        if (o.tower === 'clock') { p.bit(tu0 + .03, tu1 - .03, tv1, tv1 + .01, H * .66, H * .8, WHITE); p.bit((tu0 + tu1) / 2 - .005, (tu0 + tu1) / 2 + .005, tv1 + .01, tv1 + .015, H * .7, H * .77, DARK); }
        else p.bit(tu0 + .02, tu1 - .02, tv1, tv1 + .01, H * .7, H * .8, o.blue ? '#3f6f9a' : RED);
        p.pyr((tu0 + tu1) / 2, (tv0 + tv1) / 2, (tu1 - tu0) * p.a.s / 2 + .02, H * .86, H * .14, roof);
      }
    }
    if (o.garage) p.row(big ? 3 : 2, t => p.bit(u0 + .06 + t * (u1 - u0 - .24), u0 + .18 + t * (u1 - u0 - .24), v1, v1 + .01, 0, eave * .5, '#3a3f48'));
    if (o.trucks) p.row(big ? 2 : 1, (t, i) => p.car(u0 + .15 + t * .4, v1 + .1, i % 2 ? RED : o.tower === 'clock' ? '#c9a040' : RED));
    if (o.school) { p.flat(.05, .95, .86, .97, .005, '#b8866a'); p.pole(.9, .88, .01, 0, .6, WHITE); }
    if (o.blue) p.bit((u0 + u1) / 2 - .08, (u0 + u1) / 2 + .08, v1, v1 + .01, eave * .7, eave * .85, '#3f6f9a');
  },
  // ---- 醫院：白色量體＋紅十字 ----
  hospital(p, o) {
    const H = p.H, c = p.c, wall = c.wall || WHITE, roof = c.roof || '#8a9098';
    const tall = !!o.tall, wide = !!o.wide, small = !!o.small;
    const main: [number, number, number, number] = tall ? [.38, .62, .3, .55] : small ? [.25, .75, .3, .75] : [.2, .7, .2, .7];
    p.blk(main[0], main[1], main[2], main[3], 0, H, wall, roof, 'grid');
    if (wide || tall) p.blk(.08, .92, .6, .9, 0, Math.min(H * .35, 1), wall, roof, 'grid');
    // 紅十字：正面與屋頂
    const cu = (main[0] + main[1]) / 2, ch = H * (tall ? .85 : .6), cs = Math.min(.12, (main[1] - main[0]) * .3);
    p.bit(cu - cs / 3, cu + cs / 3, main[3], main[3] + .01, ch - cs * p.a.s, ch + cs * p.a.s * .2, RED);
    p.bit(cu - cs, cu + cs, main[3], main[3] + .01, ch - cs * p.a.s * .55, ch - cs * p.a.s * .25, RED);
    p.bit(cu - cs / 3, cu + cs / 3, (main[2] + main[3]) / 2 - cs, (main[2] + main[3]) / 2 + cs, H, H + .01, RED);
    p.bit(cu - cs, cu + cs, (main[2] + main[3]) / 2 - cs / 3, (main[2] + main[3]) / 2 + cs / 3, H, H + .01, RED);
    if (o.domes) p.row(2, t => { const u = .15 + t * .7; p.cyl(u, .15, .07 * p.a.s, 0, .3, WHITE, 10); p.dome(u, .15, .07 * p.a.s, .3, '#c8ccd0'); });
    if (o.ambulance) p.car(.8, .88, WHITE);
    if (o.parking) { p.flat(.05, .5, .05, .15, .005, ASPH); p.row(3, (t, i) => p.car(.1 + t * .35, .1, CARS[i])); }
  },
  // ---- 教堂、墓園、婚禮教堂 ----
  church(p, o) {
    const H = p.H, c = p.c, wall = c.wall || '#d8d0c0', roof = c.roof || '#5a5058', small = !!o.small;
    if (o.dome) { p.blk(.3, .7, .3, .7, 0, H * .55, wall, null, 'arch'); p.dome(.5, .5, .2 * p.a.s, H * .55, roof); p.pole(.5, .5, .01, H * .55 + .2 * p.a.s, H, '#d8c060'); return; }
    const [u0, u1, v0, v1] = small ? [.35, .65, .15, .5] : [.28, .62, .15, .78];
    const eave = o.graves && !o.spire ? H * .6 : H * .45;
    p.blk(u0, u1, v0, v1, 0, eave, wall, null, 'arch');
    p.gable(u0, u1, v0, v1, eave, o.graves && !o.spire ? H * .4 : H * .22, roof, wall, 'z');
    if (o.spire || (!o.graves && !o.small)) { p.blk(u0 + .05, u1 - .05, v1 - .02, v1 + .12, 0, H * .62, wall, null, false); p.cone((u0 + u1) / 2, v1 + .05, (u1 - u0 - .1) * p.a.s * .7, H * .62, H, roof, 4); }
    if (o.graves) {
      const n = small ? 8 : 18;
      for (let i = 0; i < n; i++) { const u = .1 + (i % 6) * .15, v = small ? .62 + Math.floor(i / 6) * .12 : .15 + Math.floor(i / 6) * .28; if (u > u0 - .05 && u < u1 + .05 && v < v1) continue; p.bit(u - .02, u + .02, v - .01, v + .01, 0, .07, '#9a9a9a', '#b8b8b8'); }
      if (o.trees) p.row(5, t => p.tree(.08 + t * .84, .94, .65));
    }
  },
  // ---- 車站、車庫 ----
  station(p, o) {
    const H = p.H, c = p.c, wall = c.wall || '#c8b89a', roof = c.roof || '#5a6068';
    if (o.roundhouse) {
      p.flat(.1, .9, .1, .9, .004, '#6a6258');
      p.cyl(.5, .5, .12 * p.a.s, 0, .03, '#5a5048', 12);
      for (let i = 0; i < 7; i++) { const a = Math.PI * (.1 + i * .8 / 6), r0 = .22, r1 = .44; const u = .5 + Math.cos(a) * (r0 + r1) / 2, v = .5 - Math.sin(a) * (r0 + r1) / 2; p.geo(GEO.box, p.X(u), p.a.y0 + H * .4, p.Z(v), .16 * p.a.s, H * .8, (r1 - r0) * p.a.s, i % 2 ? wall : roof, 0, a + Math.PI / 2, 0); }
      return;
    }
    if (o.canopy && o.small) {
      p.flat(.05, .95, .45, .55, .004, '#3a3a3a');
      for (const u of [.2, .5, .8]) p.pole(u, .35, .015, 0, H * .85, STEEL);
      p.bit(.1, .9, .28, .42, H * .85, H, c.roof || '#6a8aa8');
      p.blk(.35, .65, .62, .85, 0, H * .7, wall, roof, false);
      return;
    }
    const big = !!o.big, tracksV = [.12, .3];
    if (!o.buses) { p.flat(.02, .98, tracksV[0], tracksV[1], .004, '#3a3a3a'); p.row(3, t => p.flat(.02, .98, tracksV[0] + .02 + t * .12, tracksV[0] + .03 + t * .12, .006, '#8a7a6a')); }
    const [u0, u1, v0, v1] = o.small ? [.2, .75, .4, .78] : big ? [.08, .92, .35, .92] : [.08, .92, .38, .88];
    if (o.hall === 'arch') {
      const n = Number(o.halls) || 1, w = (u1 - u0) / n;
      for (let i = 0; i < n; i++) {
        p.blk(u0 + i * w + .01, u0 + (i + 1) * w - .01, v0, v1 - .15, 0, H * .35, wall, null, 'arch');
        p.barrel(u0 + (i + .5) * w, (v0 + v1 - .15) / 2, (w / 2 - .01) * p.a.s, (v1 - .15 - v0) * p.a.s, Math.min(H * .5, (w / 2) * p.a.s * .9), H * .35, i % 2 ? GLASS : roof);
      }
      p.blk(.3, .7, v1 - .15, v1, 0, H * .7, wall, null, 'arch');
      if (o.dome) { p.dome(.5, v1 - .08, .1 * p.a.s, H * .7, '#7fb0a0'); p.pole(.5, v1 - .08, .01, H * .7, H, '#d8c060'); }
    } else if (o.hall === 'flat') {
      p.blk(u0, u1, v0, v1, 0, H, wall, roof, 'grid');
      if (o.buses) p.row(4, (t, i) => p.bit(.12 + t * .7, .2 + t * .7, .1, .3, .02, .16, i % 2 ? '#e8c34a' : '#3f6f9a'));
    } else {
      const eave = H * .6;
      p.blk(u0, u1, v0, v1, 0, eave, wall, null, 'arch');
      p.gable(u0, u1, v0, v1, eave, H - eave, roof, wall, 'x');
      if (o.canopy) p.bit(.05, .95, .3, .38, eave * .8, eave * .85, STEEL);
      if (o.tower) { p.blk(.8, .95, .7, .85, 0, H * 1.0, wall, null, false); p.pyr(.875, .775, .08 * p.a.s, H, .15, roof); }
      if (o.trucks) p.row(3, (t, i) => p.bit(.15 + t * .6, .27 + t * .6, .9, .98, .02, .14, '#8b9199', CARS[i]));
    }
  },
  // ---- 港口、碼頭、造船、鋼材、回收 ----
  port(p, o) {
    const H = p.H, c = p.c, s = p.a.s;
    if (o.water) p.flat(.0, 1, .0, .3, .01, WATER);
    p.flat(.0, 1, o.water ? .3 : 0, 1, .006, '#b8b0a0');
    const crane = (u: number, v: number, hh: number, colr: string) => {       // 岸邊門式吊車：兩腳、橫梁、懸臂伸向水面
      p.pole(u - .06, v, .012 * s, 0, hh * .7, colr); p.pole(u + .06, v, .012 * s, 0, hh * .7, colr);
      p.bit(u - .08, u + .08, v - .02, v + .02, hh * .7, hh * .78, colr);
      p.a.O.box(p.X(u) - .02 * s, p.Z(v - .34), p.X(u) + .02 * s, p.Z(v + .1), p.a.y0 + hh * .82, p.a.y0 + hh * .88, col(colr), col(colr), null);
      p.pole(u, v, .01 * s, hh * .7, hh, colr);
    };
    if (o.cranes) p.row(Number(o.cranes), t => crane(.2 + t * .6, .36, H, c.wall));
    if (o.containers) for (let i = 0; i < 18; i++) { const u = .12 + (i % 6) * .14, v = .52 + Math.floor(i / 6) * .14; p.bit(u, u + .1, v, v + .06, 0, .1 + (i % 3) * .08, BOXES[i % BOXES.length]); }
    if (o.warehouse || o.hall) { p.blk(.55, .95, .7, .95, 0, H * .45, c.wall || STEEL, c.roof || '#6a7078', 'grid'); }
    if (o.ship) { p.geo(GEO.box, p.X(.5), p.a.y0 + .08, p.Z(.18), .8 * s, .16, .16 * s, '#3f5a78'); p.bit(.62, .78, .13, .23, .16, .38, WHITE); crane(.3, .4, H, c.accent || '#c9a040'); }
    if (o.pier) { p.bit(.4, .6, .0, .34, .02, .05, c.roof); p.row(3, t => p.pole(.42, .04 + t * .26, .01, 0, .05, '#5a4a38')); }
    if (o.boats) p.row(4, (t, i) => { p.bit(.08 + t * .2, .16 + t * .2, .05, .2, 0, .05, i % 2 ? WHITE : '#c8d0d8'); p.pole(.12 + t * .2, .12, .005, .05, H, WHITE); });
    if (o.beacon) { p.cyl(.75, .15, .04 * s, 0, H * .9, WHITE, 8); p.cyl(.75, .15, .045 * s, H * .45, H * .6, RED, 8); p.cone(.75, .15, .05 * s, H * .9, H, RED, 8); }
    if (o.gantry) {                                                       // 鋼材場、回收廠：黃色門式天車跨過料場
      for (const u of [.15, .85]) for (const v of [.25, .75]) p.pole(u, v, .015 * s, 0, H * .85, c.accent);
      for (const v of [.25, .75]) p.bit(.12, .88, v - .02, v + .02, H * .85, H * .92, '#d8a830');
      p.bit(.45, .55, .2, .8, H * .78, H * .85, '#b88a20');
      if (o.steel) p.row(4, t => p.bit(.2, .8, .3 + t * .12, .36 + t * .12, 0, .08, '#6a6e74', '#8a8e94'));
      if (o.silos) p.row(2, t => p.cyl(.1 + t * .15, .9, .05 * s, 0, H * .7, '#c8c8c0', 8));
    }
    if (o.conveyor) { for (let i = 0; i < 3; i++) p.cone(.25 + i * .25, .7, .12 * s, 0, H * .45, i % 2 ? c.roof : c.wall, 8); p.geo(GEO.box, p.X(.5), p.a.y0 + H * .7, p.Z(.35), .06 * s, .04, .6 * s, '#d8a830', 0, 0, 0); p.pole(.5, .6, .015 * s, 0, H * .7, '#d8a830'); p.pole(.5, .12, .015 * s, 0, H, '#d8a830'); }
    if (o.rail) { p.flat(0, 1, .9, .98, .008, '#3a3a3a'); }
  },
  // ---- 機場 ----
  airport(p, o) {
    const H = p.H, c = p.c, s = p.a.s;
    p.flat(.03, .97, .08, .24, .006, '#3e4148');
    p.row(8, t => p.flat(.08 + t * .8, .12 + t * .8, .155, .165, .008, WHITE));
    p.flat(.1, .9, .3, .55, .005, '#8a8e94');
    const [u0, u1] = o.big ? [.15, .8] : [.2, .7];
    p.blk(u0, u1, .6, .88, 0, H * .45, c.wall || '#d8dce0', c.roof || '#8a9098', 'ribbon', GLASS);
    p.cyl(u1 + .1, .75, .05 * s, 0, H * .85, c.wall || WHITE, 8);
    p.cyl(u1 + .1, .75, .09 * s, H * .85, H, GLASS, 8, .1 * s);
    p.row(Number(o.planes) || 2, t => { const u = .25 + t * .5; p.geo(GEO.box, p.X(u), p.a.y0 + .08, p.Z(.42), .5 * s * .5, .08, .08 * s, WHITE); p.geo(GEO.box, p.X(u), p.a.y0 + .08, p.Z(.42), .07 * s, .02, .4 * s * .5, '#c8ccd0'); p.geo(GEO.box, p.X(u - .1), p.a.y0 + .14, p.Z(.42), .04 * s, .1, .015 * s, RED); });
  },
  // ---- 電廠、工廠：廠房＋煙囪／冷卻塔／反應爐圓頂／儲槽／筒倉 ----
  plant(p, o) {
    const H = p.H, c = p.c, s = p.a.s, wall = o.brick && p.a.k === 5 ? BRICK : c.wall || '#b8b4a8', roof = c.roof || '#5a6068';
    const halls = o.halls === undefined ? 1 : Number(o.halls);
    const hallH = Math.min(H * .45, o.cooling || o.stacks || o.silos ? H * .4 : H * .7);
    for (let i = 0; i < halls; i++) { const u0 = .08 + i * (.84 / Math.max(1, halls)), u1 = u0 + .84 / Math.max(1, halls) - .04; p.blk(u0, u1, .55, .92, 0, hallH * (i % 2 ? .8 : 1), wall, null, 'grid'); p.a.O.saw(p.X(u0), p.Z(.55), p.X(u1), p.Z(.92), p.a.y0 + hallH * (i % 2 ? .8 : 1), .15, 2, true, col(roof), col(GLASS)); }
    let slot = 0;
    const spot = () => { const pts = [[.25, .3], [.55, .3], [.8, .3], [.15, .12], [.4, .12], [.7, .12], [.9, .5]]; return pts[slot++ % pts.length]; };
    if (o.cooling) for (let i = 0; i < Number(o.cooling); i++) { const [u, v] = spot(); p.geo(GEO.hyper, p.X(u), p.a.y0, p.Z(v), .16 * s, H, .16 * s, '#d0d6dc'); p.cyl(u, v, .16 * s * .66, H * .6, H * .6 + .01, '#4a4f58', 10); }
    if (o.dome) { const [u, v] = spot(); p.cyl(u, v, .12 * s, 0, H * .6, '#e0e0dc', 12); p.domeH(u, v, .12 * s, H * .6, H * .4, '#c8ccd0'); }
    if (o.stacks) for (let i = 0; i < Number(o.stacks); i++) { const [u, v] = spot(); const top = o.tall || i === 0 ? H : H * .8; p.cyl(u, v, .04 * s, 0, top, i % 2 ? STEEL : '#d8d4cc', 8, .03 * s); p.cyl(u, v, .042 * s, top * .85, top * .92, RED, 8); }
    if (o.steam) for (let i = 0; i < Number(o.steam); i++) { const [u, v] = spot(); p.geo(GEO.hyper, p.X(u), p.a.y0, p.Z(v), .09 * s, H * .7, .09 * s, '#ccd2d8'); p.cyl(u, v, .09 * s * .66, H * .42, H * .42 + .01, '#4a4f58', 10); }
    if (o.furnace) for (let i = 0; i < Number(o.furnace); i++) { const [u, v] = spot(); p.cyl(u, v, .08 * s, 0, H * .85, '#5a5048', 10, .06 * s); p.cone(u, v, .06 * s, H * .85, H, '#4a4038', 8); }
    if (o.tanks) for (let i = 0; i < Number(o.tanks); i++) { const [u, v] = spot(); p.cyl(u, v, .09 * s, 0, H * .45, c.wallR, 12); }
    if (o.silos) for (let i = 0; i < Number(o.silos); i++) { const [u, v] = halls === 0 ? [[.3, .3], [.7, .3], [.3, .7], [.7, .7]][i % 4] : spot(); p.cyl(u, v, (halls === 0 ? .16 : .07) * s, 0, H * .9, wall, 10); p.domeH(u, v, (halls === 0 ? .16 : .07) * s, H * .9, H * .1, roof); }
    if (o.pipes) p.bit(.2, .8, .4, .43, .2, .26, STEEL);
  },
  // ---- 煉油、儲槽、井架、礦場 ----
  refinery(p, o) {
    const H = p.H, s = p.a.s, c = p.c;
    p.flat(.04, .96, .04, .96, .004, '#8a867c');
    let n = 0;
    const at = () => [[.25, .25], [.7, .25], [.25, .7], [.7, .7], [.48, .48], [.15, .48], [.85, .48]][n++ % 7];
    if (o.columns) for (let i = 0; i < Number(o.columns); i++) { const [u, v] = at(); p.cyl(u, v, .04 * s, 0, H * (i ? .8 : 1), c.wallR, 8); p.row(3, t => p.cyl(u, v, .05 * s, H * (.2 + t * .5), H * (.23 + t * .5), STEEL, 8)); }
    if (o.spheres) for (let i = 0; i < Number(o.spheres); i++) { const [u, v] = at(); const r = .13 * s; for (const [du, dv] of [[-.08, -.08], [.08, -.08], [-.08, .08], [.08, .08]]) p.pole(u + du, v + dv, .008 * s, 0, H * .6, STEEL); p.ball(u, v, r, Math.max(r, H * .6), c.wall); }
    if (o.tanks) for (let i = 0; i < Number(o.tanks); i++) { const [u, v] = at(); p.cyl(u, v, .13 * s, 0, H * (o.columns ? .4 : .9), c.wall, 14); p.bit(u - .02, u + .02, v - .13, v - .12, 0, H * .3, STEEL); }
    if (o.flare) { const u = .9, v = .15; p.pole(u, v, .01 * s, 0, H, STEEL); p.cone(u, v, .02 * s, H * .95, H * 1.05, '#ff8a3a', 6); }
    if (o.derrick) { p.geo(GEO.cone4, p.X(.4), p.a.y0 + H / 2, p.Z(.4), .12 * s, H, .12 * s, c.wall, 0, Math.PI / 4, 0); p.bit(.3, .5, .3, .5, 0, .06, '#5a4a38'); }
    if (o.pumpjack) { p.bit(.62, .82, .6, .7, 0, .08, '#4a4f58'); p.geo(GEO.box, p.X(.72), p.a.y0 + .3, p.Z(.65), .28 * s, .05, .04 * s, '#d8a830', 0, 0, .25); p.pole(.72, .65, .012 * s, .08, .3, '#4a4f58'); }
    if (o.headframe) { p.geo(GEO.box, p.X(.4), p.a.y0 + H * .5, p.Z(.45), .03 * s, H, .03 * s, c.wall, 0, 0, .25); p.geo(GEO.box, p.X(.55), p.a.y0 + H * .5, p.Z(.45), .03 * s, H, .03 * s, c.wall, 0, 0, -.25); p.geo(GEO.torus, p.X(.48), p.a.y0 + H * .92, p.Z(.45), .08 * s, .08 * s, .08 * s, '#8a8e94'); }
    if (o.pit) { p.flat(.55, .95, .6, .95, .003, '#4a3a2a'); p.cone(.75, .78, .12 * s, 0, .25, '#7a6a52', 8); }
  },
  // ---- 太陽能板陣、電池、風機 ----
  solar(p, o) {
    const H = p.H, s = p.a.s, c = p.c, rows = Number(o.rows) || 0;
    for (let r = 0; r < rows; r++) {
      const v = .1 + r * (.8 / Math.max(1, rows)), dv = .8 / Math.max(1, rows) * .6;
      p.a.D.slope([p.X(.08), p.a.y0 + .06, p.Z(v + dv)], [p.X(.92), p.a.y0 + .06, p.Z(v + dv)], [p.X(.92), p.a.y0 + .06 + Math.min(.25, H), p.Z(v)], [p.X(.08), p.a.y0 + .06 + Math.min(.25, H), p.Z(v)], [0, 1, 1], col(c.roof));
    }
    if (o.turbines) p.row(Number(o.turbines), t => turbine(p, .2 + t * .6, .95, H * 1.25));
    if (o.batteries) p.row(4, t => p.blk(.12 + t * .2, .26 + t * .2, rows ? .75 : .2, rows ? .92 : .6, 0, Math.max(.22, H * .55), c.wall, c.roof, false));
    if (o.dome) { p.cyl(.75, .78, .1 * s, 0, H * .6, WHITE, 10); p.domeH(.75, .78, .1 * s, H * .6, H * .35, '#c8ccd0'); }
    if (o.hut) p.blk(.7, .9, .78, .95, 0, H * .6 + .2, c.wall, c.roof, false);
  },
  wind(p, o) {
    const H = p.H, n = Number(o.n) || 1;
    if (o.water) p.flat(0, 1, 0, 1, .01, WATER);
    if (n === 1) turbine(p, .5, .5, H);
    else for (const [u, v] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75]]) turbine(p, u, v, H);
  },
  // ---- 水壩、抽蓄 ----
  dam(p, o) {
    const H = p.H, c = p.c, s = p.a.s;
    if (o.reservoir) {
      for (const [u, v] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7]]) p.pole(u, v, .03 * s, 0, H * .75, '#b8b4a8');
      p.cyl(.5, .5, .38 * s, H * .75, H, '#b8b4a8', 16); p.cyl(.5, .5, .34 * s, H, H + .01, WATER, 16);
      p.blk(.05, .35, .82, .98, 0, H * .35, c.wall || '#c8c0b0', c.roof || '#5a6068', 'grid');
      return;
    }
    p.flat(0, 1, 0, .45, .02, WATER);
    p.geo(GEO.box, p.X(.5), p.a.y0 + H * .5, p.Z(.48), 1 * s, H, .1 * s, '#b8b4a8');
    p.blk(.25, .75, .58, .9, 0, H * .55, c.wall || '#c8c8c0', c.roof || '#4a6a8a', 'grid');
    p.flat(.1, .9, .9, 1, .01, WATER);
  },
  // ---- 變電所 ----
  substation(p, o) {
    const H = p.H, s = p.a.s, c = p.c, small = !!o.small;
    p.flat(.06, .94, .06, .94, .004, '#8a8a82');
    const n = small ? 2 : 4;
    p.row(n, t => { const u = .2 + t * .6; p.bit(u - .07, u + .07, .45, .6, 0, H * .5, c.wall, c.roof); p.bit(u - .02, u + .02, .5, .55, H * .5, H * .7, '#6a7078'); });
    for (const u of [.12, .88]) { p.pole(u, .3, .01 * s, 0, H * .9, STEEL); p.pole(u, .75, .01 * s, 0, H * .9, STEEL); }
    p.bit(.1, .9, .29, .31, H * .88, H * .92, STEEL); p.bit(.1, .9, .74, .76, H * .88, H * .92, STEEL);
    if (o.pylons) p.row(Number(o.pylons), t => p.geo(GEO.cone4, p.X(.15 + t * .7), p.a.y0 + H * .6, p.Z(.15), .06 * s, H * 1.2, .06 * s, STEEL, 0, Math.PI / 4, 0));
    if (o.domes) p.row(2, t => p.ball(.3 + t * .4, .85, .07 * s, .07 * s, WHITE));
    p.blk(.06, .3, .8, .94, 0, H * .6, c.wallR, c.roof, false);
  },
  // ---- 水處理：圓池、方池、泵房、清水庫 ----
  basins(p, o) {
    const H = p.H, s = p.a.s, c = p.c;
    p.flat(.04, .96, .04, .96, .004, '#a8a498');
    if (o.reservoir) { p.cyl(.5, .5, .42 * s, 0, H * .7, '#b8b4a8', 20); p.cyl(.5, .5, .38 * s, H * .7, H * .7 + .01, '#6a9a78', 20); p.blk(.82, .96, .82, .96, 0, H, c.wall, c.roof, false); return; }
    const round = Number(o.round) || 0, rect = Number(o.rect) || 0;
    let i = 0;
    const cells = [[.28, .28], [.72, .28], [.28, .7], [.72, .7]];
    for (let r = 0; r < round; r++) { const [u, v] = cells[i++ % 4]; const rr = (o.small ? .14 : .18) * s; p.cyl(u, v, rr, 0, .12, c.wallR, 14); p.cyl(u, v, rr * .9, .12, .125, WATER, 14); p.pole(u, v, .01 * s, .12, .2, STEEL); }
    for (let r = 0; r < rect; r++) { const [u, v] = cells[i++ % 4]; p.blk(u - .18, u + .18, v - .12, v + .12, 0, .1, '#b8b4a8', WATER, false); }
    if (o.hut) p.row(Number(o.hut), t => p.blk(.08 + t * .6, .3 + t * .6, .84, .96, 0, Math.max(.3, H), c.wall, c.roof, 'grid'));
    if (o.tower) { p.cyl(.85, .15, .07 * s, 0, H * .8, c.wall, 8); p.cone(.85, .15, .09 * s, H * .8, H, c.roof, 8); }
    if (o.wells) p.row(Number(o.wells), t => { p.bit(.2 + t * .3 - .04, .2 + t * .3 + .04, .3, .38, 0, .15, '#6a7078'); p.pole(.2 + t * .3, .34, .01, .15, .3, STEEL); });
    if (o.watertower) waterTower(p, .8, .75, H, false);
  },
  watertower(p, o) { waterTower(p, .5, .5, p.H, !!o.brick); },
  // ---- 垃圾、回收、堆肥 ----
  dump(p, o) {
    const H = p.H, s = p.a.s, c = p.c;
    p.flat(.05, .95, .05, .95, .004, '#7a6a52');
    if (o.heaps) p.row(Number(o.heaps), (t, i) => p.cone(.2 + t * .6, .35 + (i % 2) * .2, .16 * s, 0, Math.max(.2, H * .8), [c.wall, c.roof, c.wallR][i % 3], 7));
    if (o.bins) p.row(4, (t, i) => p.bit(.15 + t * .6, .25 + t * .6, .2, .3, 0, .12, ['#3f6f9a', '#4d7f56', '#c9a63f', '#b4544a'][i]));
    if (o.shed || o.gantry) p.blk(.55, .95, .6, .95, 0, H, c.wall, c.roof, false);
    if (o.gantry) { for (const u of [.1, .45]) p.pole(u, .7, .012 * s, 0, H * 1.1, '#d8a830'); p.bit(.08, .47, .68, .72, H * 1.1, H * 1.18, '#d8a830'); }
  },
  // ---- 公園、廣場、濕地、露營 ----
  park(p, o) {
    const H = p.H, s = p.a.s, c = p.c;
    if (o.plaza) p.flat(.06, .94, .06, .94, .004, '#d8d0bc');
    if (o.path) { p.flat(.45, .55, .02, .98, .004, c.plate); p.flat(.02, .98, .45, .55, .005, '#d8d0bc'); }
    if (o.ring) { p.flat(.1, .9, .1, .16, .004, c.wall); p.flat(.1, .9, .84, .9, .004, '#d8d0bc'); p.flat(.1, .16, .1, .9, .005, '#d8d0bc'); p.flat(.84, .9, .1, .9, .005, '#d8d0bc'); }
    if (o.pond) p.cyl(.55, .55, .18 * s, 0, .02, c.roof, 14);
    if (o.basin) { p.blk(.08, .92, .08, .92, 0, .08, c.wall, null, false); p.flat(.12, .88, .12, .88, .06, WATER); }
    if (o.wetland) { p.flat(.05, .95, .05, .95, .01, c.roof); for (let i = 0; i < 14; i++) p.cone(.1 + (i * .37) % .8, .1 + (i * .53) % .8, .05 * s, 0, H * .9, '#5a8a3a', 5); }
    if (o.fountain) { p.cyl(.5, .5, .2 * s, 0, .06, c.wall, 14); p.cyl(.5, .5, .17 * s, .06, .065, '#7fb4d8', 14); p.cyl(.5, .5, .03 * s, .06, H, '#e8f4fa', 8); if (o.jets) p.row(4, t => p.cyl(.3 + t * .4, .5 + (t - .5) * .3, .01 * s, .06, H * .7, '#e8f4fa', 6)); }
    if (o.glassdome) { p.cyl(.5, .5, .3 * s, 0, H * .35, c.wall, 12); p.domeH(.5, .5, .3 * s, H * .35, H * .65, '#9cc8e0'); }
    if (o.shelters) p.row(Number(o.shelters), t => { const u = .25 + t * .5; for (const [du, dv] of [[-.08, -.08], [.08, -.08], [-.08, .08], [.08, .08]]) p.pole(u + du, .3 + dv, .01, 0, H * .7, STEEL); p.hip(u - .12, u + .12, .18, .42, H * .7, H * .3, c.roof); });
    if (o.fence) { p.bit(.05, .95, .05, .07, 0, .1, c.wall); p.bit(.05, .95, .93, .95, 0, .1, '#cfc6b2'); p.bit(.05, .07, .05, .95, 0, .1, '#cfc6b2'); p.bit(.93, .95, .05, .95, 0, .1, '#cfc6b2'); }
    if (o.lanterns) for (let i = 0; i < 6; i++) { const u = .2 + (i % 3) * .3, v = .3 + Math.floor(i / 3) * .4; p.pole(u, v, .006, 0, H * .7, '#6a4a30'); p.bit(u - .03, u + .03, v - .03, v + .03, H * .7, H, c.accent); }
    if (o.tents) p.row(4, (t, i) => p.cone(.2 + t * .6, .35 + (i % 2) * .3, .1 * s, 0, Math.max(.3, H), [c.accent, c.roof, c.wall, '#4d7f56'][i], 4));
    const n = Number(o.trees) || 0;
    // 樹高跟著實驗線量到的高度走（公園的最高點就是樹）；貼地的公園（H＜0.35）用小樹。樹圈半徑讓樹冠留在地界裡
    const ts = H < .35 ? .5 : Math.max(.6, Math.min(1.3, H / .7)), crown = .26 * 1.1 * ts / s, ring = Math.max(.12, Math.min(.36, .48 - crown));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.tree(.5 + Math.cos(a) * ring, .5 + Math.sin(a) * ring, ts); }
  },
  // ---- 球場、溜冰、滑板、泳池、遊樂場 ----
  court(p, o) {
    const s = p.a.s, H = p.H, c = p.c;
    const kind = String(o.kind);
    const surf = kind === 'basket' ? '#c8704a' : kind === 'tennis' ? '#4a8a5a' : kind === 'rink' ? '#e8f0f4' : kind === 'pool' ? '#4fa8d8' : kind === 'skate' ? '#b8b4a8' : '#d8c689';
    p.flat(.08, .92, .12, .88, .005, kind === 'pool' ? '#e0dcd0' : surf);
    if (kind === 'pool') { p.flat(.18, .82, .22, .78, .01, surf); p.blk(.08, .3, .82, .96, 0, H * .5, c.wall, c.roof, false); p.pole(.85, .5, .012 * s, 0, H, WHITE); p.bit(.8, .9, .45, .55, H * .9, H, WHITE); }
    p.flat(.08, .92, .495, .505, .008, WHITE);
    if (kind === 'basket') for (const v of [.18, .82]) { p.pole(.5, v, .01 * s, 0, H, c.wall); p.bit(.45, .55, v - .01, v + .01, H * .8, H, WHITE); }
    if (kind === 'tennis') { p.bit(.08, .92, .49, .51, 0, .12, WHITE); p.bit(.05, .95, .08, .1, 0, H, c.wall); }
    if (kind === 'rink') { p.bit(.06, .94, .1, .12, 0, .08, WHITE); p.bit(.06, .94, .88, .9, 0, .08, WHITE); for (const [u, v] of [[.08, .14], [.92, .14], [.08, .86], [.92, .86]]) p.pole(u, v, .012 * s, 0, H * .75, STEEL); p.barrel(.5, .5, .44 * s, .76 * s, H * .25, H * .75, c.roof, false); }
    if (kind === 'skate') { p.a.D.slope([p.X(.15), p.a.y0, p.Z(.3)], [p.X(.45), p.a.y0, p.Z(.3)], [p.X(.45), p.a.y0 + H, p.Z(.15)], [p.X(.15), p.a.y0 + H, p.Z(.15)], [0, 1, 1], col(c.wall)); p.a.D.slope([p.X(.55), p.a.y0, p.Z(.7)], [p.X(.85), p.a.y0, p.Z(.7)], [p.X(.85), p.a.y0 + H * .6, p.Z(.85)], [p.X(.55), p.a.y0 + H * .6, p.Z(.85)], [0, 1, -1], col('#a8a498')); }
    if (kind === 'play') { p.a.D.slope([p.X(.2), p.a.y0, p.Z(.3)], [p.X(.3), p.a.y0, p.Z(.3)], [p.X(.3), p.a.y0 + H, p.Z(.55)], [p.X(.2), p.a.y0 + H, p.Z(.55)], [0, 1, 1], col(c.accent)); p.pole(.6, .4, .01 * s, 0, H * .8, '#e8c34a'); p.pole(.8, .4, .01 * s, 0, H * .8, '#e8c34a'); p.bit(.58, .82, .39, .41, H * .8, H * .85, '#e8c34a'); }
  },
  // ---- 體育場（碗形看台）、體育園區（圓頂館）----
  stadium(p, o) {
    const H = p.H, s = p.a.s, c = p.c;
    if (o.dome) {
      p.flat(.05, .95, .05, .95, .004, '#4a8a5a');
      p.cyl(.35, .4, .25 * s, 0, H * .45, c.wall || '#c8ccd0', 16); p.domeH(.35, .4, .25 * s, H * .45, H * .55, WHITE);
      p.flat(.62, .95, .55, .95, .006, '#c8704a');
      return;
    }
    p.flat(.12, .88, .12, .88, .004, '#4a9a4a');
    bowl(p, .5, .5, .3 * s, .48 * s, H, c.accent || '#c8403a', c.wall || '#c8ccd0');
  },
  // ---- 遊樂設施與觀光 ----
  ride(p, o) {
    const H = p.H, s = p.a.s, c = p.c, which = String(o.which);
    if (which === 'ferris') {
      const R = H * .45, cy = H - R;
      p.geo(GEO.torus, p.X(.5), p.a.y0 + cy, p.Z(.5), R, R, R * .6, c.accent || '#c8403a', 0, Math.PI / 4, 0);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.geo(GEO.box, p.X(.5) + Math.cos(a) * R * .7071, p.a.y0 + cy + Math.sin(a) * R, p.Z(.5) - Math.cos(a) * R * .7071, .06, .06, .06, ['#e8c34a', '#3f6f9a', '#c8403a', '#4d7f56'][i % 4]); }
      p.geo(GEO.box, p.X(.42), p.a.y0 + cy / 2, p.Z(.58), .03, cy, .03, STEEL, 0, 0, .2); p.geo(GEO.box, p.X(.58), p.a.y0 + cy / 2, p.Z(.42), .03, cy, .03, STEEL, 0, 0, -.2);
      p.bit(.3, .7, .3, .7, 0, .06, '#d8d0bc');
      return;
    }
    if (which === 'carousel') { p.cyl(.5, .5, .32 * s, 0, .08, '#d8c060', 12); p.row(6, (t) => p.pole(.5 + Math.cos(t * 6) * .25, .5 + Math.sin(t * 6) * .25, .008 * s, .08, H * .6, '#e8e0c0')); p.cone(.5, .5, .36 * s, H * .6, H, c.accent, 12); p.cone(.5, .5, .36 * s, H * .6, H * .62, WHITE, 12); return; }
    if (which === 'balloon') { p.ball(.5, .45, .2 * s, H - .2 * s, c.accent || '#e8743a'); p.bit(.47, .53, .42, .48, H * .25, H * .35, '#8a6a48'); p.cone(.5, .45, .08 * s, H * .35, H - .3 * s, '#c8b89a', 6); p.flat(.2, .8, .2, .8, .004, '#d8d0bc'); return; }
    if (which === 'coaster') {
      for (let i = 0; i < 16; i++) { const t = i / 16, u = .15 + t * .7, v = .5 + Math.sin(t * Math.PI * 2) * .3, h = H * (.35 + .65 * Math.abs(Math.sin(t * Math.PI * 1.5))); p.pole(u, v, .006 * s, 0, h, '#8a8e94'); p.bit(u - .03, u + .03, v - .02, v + .02, h, h + .03, c.accent); }
      p.blk(.05, .3, .8, .95, 0, H * .3, '#e8c34a', '#c8403a', false); p.cone(.8, .85, .1 * s, 0, H * .4, '#3f6f9a', 8);
      return;
    }
    if (which === 'waterpark') { p.flat(.08, .92, .08, .92, .004, '#d8d0bc'); p.flat(.15, .55, .15, .55, .01, '#4fa8d8'); p.flat(.6, .9, .6, .9, .01, '#4fa8d8'); p.cyl(.75, .3, .05 * s, 0, H, c.accent, 6); p.geo(GEO.torus, p.X(.7), p.a.y0 + H * .5, p.Z(.35), .15 * s, .15 * s, .15 * s, '#c8403a', Math.PI / 2, 0, 0); return; }
    if (which === 'dolphin') { p.flat(.1, .9, .1, .6, .01, '#3f9ec8'); bowl(p, .5, .75, .1 * s, .3 * s, H, c.roof, c.wall); return; }
    if (which === 'zoo') { p.flat(.08, .48, .08, .48, .004, '#b8a878'); p.flat(.52, .92, .08, .48, .004, '#8ab870'); p.flat(.52, .92, .52, .92, .008, WATER); p.bit(.49, .51, .06, .94, 0, .1, '#8a6a48'); p.bit(.06, .94, .49, .51, 0, .1, '#8a6a48'); for (let i = 0; i < 6; i++) p.tree(.15 + (i % 3) * .12, .6 + Math.floor(i / 3) * .2, .7); p.blk(.15, .35, .15, .35, 0, H, c.wall, c.roof, false); return; }
    // aquarium：白色曲面館＋玻璃
    p.blk(.15, .85, .3, .85, 0, H * .6, c.wall, null, 'ribbon', '#4fa8d8');
    p.barrel(.5, .575, .35 * s, .55 * s, H * .4, H * .6, c.roof);
  },
  // ---- 地標 ----
  landmark(p, o) { LANDMARKS[String(o.which)]?.(p); },
  // ---- 農場、牧場、溫室、市集、菜園、魚塘 ----
  farm(p, o) {
    const H = p.H, s = p.a.s, c = p.c;
    const F = ['#8a6a3a', '#9fb24a', '#c9b24a', '#6a9a3a', '#b8864a', '#8ab84a'];
    const n = Number(o.fields) || 0;
    for (let i = 0; i < n; i++) { const cols = n > 3 ? 3 : n, u0 = .04 + (i % cols) * (.92 / cols), v0 = n > 3 ? .04 + Math.floor(i / cols) * .3 : .04; p.flat(u0 + .01, u0 + .92 / cols - .01, v0, v0 + (n > 3 ? .28 : .55), .004, F[i % F.length]); for (let r = 0; r < 4; r++) p.flat(u0 + .02, u0 + .92 / cols - .02, v0 + .03 + r * (n > 3 ? .065 : .12), v0 + .04 + r * (n > 3 ? .065 : .12), .006, '#5a4a30'); }
    if (o.pasture) { p.flat(.05, .95, .05, .6, .004, '#8ab84a'); p.bit(.05, .95, .05, .06, 0, .08, c.wall); p.bit(.05, .06, .05, .6, 0, .08, '#cfc6b2'); p.bit(.94, .95, .05, .6, 0, .08, '#cfc6b2'); for (let i = 0; i < 5; i++) p.bit(.15 + i * .15, .21 + i * .15, .25 + (i % 2) * .15, .29 + (i % 2) * .15, 0, .06, i % 2 ? WHITE : '#6a4a30'); }
    if (o.barn) { const [u0, v0] = n > 3 ? [.7, .7] : [.6, .65]; p.blk(u0, u0 + .22, v0, v0 + .25, 0, H * .6, c.accent, null, false); p.gable(u0, u0 + .22, v0, v0 + .25, H * .6, H * .4, c.roof, c.accent, 'z'); p.cyl(u0 - .08, v0 + .15, .05 * s, 0, H * .9, '#c8c0b0', 8); p.domeH(u0 - .08, v0 + .15, .05 * s, H * .9, H * .1, '#8a8e94'); p.blk(.1, .3, .7, .9, 0, H * .5, '#e8dcc0', null, false); p.gable(.1, .3, .7, .9, H * .5, H * .3, '#8a3e32', '#e8dcc0', 'x'); }
    if (o.greenhouses) p.row(Number(o.greenhouses), t => { const u = .1 + t * .6; p.blk(u, u + .22, .1, .9, 0, H * .55, c.wall, null, false); p.gable(u, u + .22, .1, .9, H * .55, H * .45, c.roof, c.wall, 'z'); });
    if (o.stalls) { p.flat(.05, .95, .05, .95, .004, '#d8d0bc'); for (let i = 0; i < 6; i++) { const u = .15 + (i % 3) * .3, v = .25 + Math.floor(i / 3) * .4; p.bit(u - .1, u + .1, v - .08, v + .08, 0, H * .45, '#c8b89a'); p.gable(u - .12, u + .12, v - .1, v + .1, H * .45, H * .55, [c.roof, c.accent, '#3f6f9a'][i % 3], '#c8b89a', 'x'); } if (o.hall) p.blk(.1, .9, .82, .96, 0, H * .7, c.wall || '#c8b89a', c.roof || '#8a3e32', false); }
    if (o.beds) { for (let i = 0; i < 6; i++) p.bit(.12 + (i % 3) * .26, .32 + (i % 3) * .26, .15 + Math.floor(i / 3) * .35, .38 + Math.floor(i / 3) * .35, 0, .08, c.wall, ['#6a9a3a', '#9fb24a', '#c9b24a'][i % 3]); }
    if (o.ponds) p.row(Number(o.ponds), t => p.flat(.08 + t * .47, .45 + t * .47, .1, .7, .01, c.roof));
    if (o.shed) p.blk(.7, .92, .76, .95, 0, H * .7, c.wall, null, false), p.gable(.7, .92, .76, .95, H * .7, H * .3, c.roof, c.wall, 'x');
  },
  // ---- 小房子：民宿、幼兒園、樂齡、寵物醫院、青年旅舍 ----
  house(p, o) {
    const H = p.H, c = p.c;
    const wall = c.wall || '#e0d0b8';
    const roof = c.roof || '#8a3e32';
    if (o.stacked) { const cs = [c.wall, c.roof, c.accent, '#8ab84a']; for (let i = 0; i < 4; i++) p.blk(.2 + (i % 2) * .3, .5 + (i % 2) * .3, .25 + (i % 2) * .1, .7 + (i % 2) * .1, H * Math.floor(i / 2) * .5, H * (Math.floor(i / 2) + 1) * .5, cs[i], cs[(i + 1) % 4], 'grid'); return; }
    p.blk(.2, .8, .25, .72, 0, H * .6, wall, null, 'arch');
    p.gable(.2, .8, .25, .72, H * .6, H * .4, roof, wall, 'x');
    if (o.play) { p.flat(.1, .9, .8, .96, .005, '#d8c689'); p.a.D.slope([p.X(.2), p.a.y0, p.Z(.95)], [p.X(.28), p.a.y0, p.Z(.95)], [p.X(.28), p.a.y0 + .25, p.Z(.82)], [p.X(.2), p.a.y0 + .25, p.Z(.82)], [0, 1, 1], col('#3f9ec8')); }
    if (o.garden) p.row(3, t => p.tree(.15 + t * .7, .88, .6));
    if (o.cross) { p.bit(.46, .54, .72, .73, H * .25, H * .45, RED); p.bit(.42, .58, .72, .73, H * .31, H * .39, RED); }
  },
  hotel(p, o) {
    const H = p.H, c = p.c;
    if (o.resort) {
      for (let i = 0; i < 3; i++) p.blk(.1 + i * .08, .9 - i * .08, .1 + i * .08, .6 - i * .04, H * i / 3, H * (i + 1) / 3, c.wall || WHITE, c.roof || '#c8b89a', 'ribbon', GLASS);
      p.flat(.2, .8, .7, .92, .01, '#4fa8d8'); p.row(4, t => p.tree(.1 + t * .8, .96, .6));
      return;
    }
    p.blk(.15, .85, .35, .7, 0, H, c.wall || WHITE, c.roof || '#8a9098', 'grid');
    p.blk(.1, .9, .72, .9, 0, H * .15, c.accent || '#c8403a', null, false);
  },
  parking(p) {
    p.flat(.04, .96, .04, .96, .005, ASPH);
    for (const [u, v] of [[.06, .06], [.94, .06], [.06, .94], [.94, .94]]) { p.pole(u, v, .01, 0, p.H, '#9aa1a7'); p.bit(u - .03, u + .03, v - .015, v + .015, p.H, p.H + .02, '#e2e5e8'); }
    p.blk(.44, .56, .9, .98, 0, p.H * .6, p.c.wall, p.c.roof, false);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { if ((r * 7 + i * 3) % 5 === 0) continue; p.car(.1 + i * .15, .18 + r * .3, CARS[(r * 6 + i) % CARS.length], true); }
    for (let r = 0; r < 3; r++) p.flat(.06, .94, .3 + r * .3, .31 + r * .3, .008, WHITE);
  },
  // ---- 校園：幾棟樓圍著綠地；鐘塔、跑道、圓頂、雷達碟、太陽能 ----
  campus(p, o) {
    const H = p.H, c = p.c, s = p.a.s, big = !!o.big;
    const wall = c.wall || BRICK, roof = c.roof || '#5a4a44', style = o.glass ? 'ribbon' : 'arch';
    if (o.plaza) p.flat(.2, .8, .2, .8, .004, '#d8d0bc');
    const blds = big ? [[.05, .35, .05, .3], [.65, .95, .05, .3], [.05, .3, .6, .95], [.7, .95, .6, .95]] : [[.05, .45, .08, .35], [.55, .95, .08, .35], [.05, .35, .62, .92]];
    blds.forEach(([u0, u1, v0, v1], i) => { const h = H * (o.towers && i < 2 ? 1 : .45); p.blk(u0, u1, v0, v1, 0, h, i % 2 ? c.wallR || wall : wall, o.glass || o.towers ? c.roof || '#8a9098' : null, style, o.glass ? GLASS : '#3a4a58'); if (!o.glass && !o.towers) p.gable(u0, u1, v0, v1, h, H * .15, roof, wall, 'x'); });
    if (o.tower) { p.blk(.62, .76, .62, .76, 0, H * .85, wall, null, false); p.pyr(.69, .69, .07 * s + .02, H * .85, H * .15, roof); p.bit(.64, .74, .76, .77, H * .6, H * .72, WHITE); }
    if (o.track) { p.flat(.45, .95, .55, .95, .004, '#c8604a'); p.flat(.52, .88, .62, .88, .006, '#4a9a4a'); }
    if (o.dome) { p.cyl(.5, .5, .12 * s, 0, H * .4, STONE, 12); p.dome(.5, .5, .12 * s, H * .4, '#7fb0a0'); }
    if (o.dish) { p.pole(.85, .85, .015 * s, 0, H * .4, STEEL); p.geo(GEO.dome, p.X(.85), p.a.y0 + H * .45, p.Z(.85), .1 * s, .04 * s, .1 * s, WHITE, -.7, 0, 0); }
    if (o.pond) p.cyl(.5, .8, .1 * s, 0, .02, WATER, 12);
    if (o.solar) p.row(3, t => p.a.D.slope([p.X(.55 + t * .13), p.a.y0 + .05, p.Z(.9)], [p.X(.65 + t * .13), p.a.y0 + .05, p.Z(.9)], [p.X(.65 + t * .13), p.a.y0 + .2, p.Z(.7)], [p.X(.55 + t * .13), p.a.y0 + .2, p.Z(.7)], [0, 1, 1], col('#2c4a78')));
    if (o.green) p.row(4, t => p.tree(.45 + t * .15, .55, .65));
  },
  // ---- 監獄：圍牆、角樓、牢房 ----
  prison(p) {
    const H = p.H, s = p.a.s, c = p.c;
    p.flat(.05, .95, .05, .95, .004, '#9a968c');
    for (const [u0, u1, v0, v1] of [[.05, .95, .05, .09], [.05, .95, .91, .95], [.05, .09, .05, .95], [.91, .95, .05, .95]]) p.blk(u0, u1, v0, v1, 0, H * .45, c.wall, c.roof, false);
    for (const [u, v] of [[.07, .07], [.93, .07], [.07, .93], [.93, .93]]) { p.cyl(u, v, .06 * s, 0, H * .85, '#7a7a74', 6); p.cone(u, v, .08 * s, H * .85, H, '#4a4a48', 6); }
    p.blk(.2, .8, .2, .45, 0, H * .7, '#a8a8a0', '#6a6a64', 'punch'); p.blk(.25, .55, .55, .8, 0, H * .55, '#a8a8a0', '#6a6a64', 'punch');
  },
};

// ---- 共用部件 ----
function turbine(p: Pen, u: number, v: number, h: number) {
  const s = p.a.s, x = p.X(u), z = p.Z(v), y = p.a.y0;
  p.a.O.cylinder(x, z, .03, .018, y, h * .8, col(p.c.wall), 6);
  p.a.O.box(x - .03, z - .05, x + .03, z + .05, y + h * .8, y + h * .84, col(WHITE), col(WHITE), null);
  for (let i = 0; i < 3; i++) p.spoke(x + .04, y + h * .82, z + .04, h * .22, .035, i * Math.PI * 2 / 3 + .3, WHITE);
  void s;
}
function waterTower(p: Pen, u: number, v: number, h: number, brick: boolean) {
  const s = p.a.s;
  if (brick) { p.cyl(u, v, .14 * s, 0, h * .75, p.c.wall, 8); p.cyl(u, v, .18 * s, h * .75, h * .9, p.c.wallR, 8); p.dome(u, v, .18 * s, h * .9, p.c.roof); return; }
  for (const [du, dv] of [[-.1, -.1], [.1, -.1], [-.1, .1], [.1, .1]]) p.pole(u + du, v + dv, .012 * s, 0, h * .6, STEEL);
  p.cyl(u, v, .17 * s, h * .6, h * .88, p.c.wall, 12); p.cone(u, v, .18 * s, h * .88, h, p.c.roof, 12);
}
// 碗形看台：內圈 r0（地面）到外圈 r1（高 h），斜面朝上朝內
function bowl(p: Pen, u: number, v: number, r0: number, r1: number, h: number, seatA: string, seatB: string) {
  const cx = p.X(u), cz = p.Z(v), y = p.a.y0, n = 16;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
    p.a.O.slope([cx + Math.cos(a0) * r0, y + .05, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, y + .05, cz + Math.sin(a1) * r0],
      [cx + Math.cos(a1) * r1, y + h * .8, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, y + h * .8, cz + Math.sin(a0) * r1], [-Math.cos(am), 1, -Math.sin(am)], col(i % 2 ? seatA : seatB));
    p.a.O.quad([cx + Math.cos(a0) * r1, y, cz + Math.sin(a0) * r1], [cx + Math.cos(a1) * r1, y, cz + Math.sin(a1) * r1], [cx + Math.cos(a1) * r1, y + h, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, y + h, cz + Math.sin(a0) * r1], [Math.cos(am), 0, Math.sin(am)], col('#c8ccd0'));
    p.a.O.quad([cx + Math.cos(a0) * r1, y + h * .8, cz + Math.sin(a0) * r1], [cx + Math.cos(a1) * r1, y + h * .8, cz + Math.sin(a1) * r1], [cx + Math.cos(a1) * r1, y + h, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, y + h, cz + Math.sin(a0) * r1], [-Math.cos(am), 0, -Math.sin(am)], col('#a8acb0'));
  }
}
const LANDMARKS: Record<string, (p: Pen) => void> = {
  clock(p) { const H = p.H, c = p.c, w = c.wall || '#d8c8a8'; p.blk(.36, .64, .36, .64, 0, H * .8, w, null, false); for (const [u0, u1, v0, v1] of [[.4, .6, .64, .65], [.64, .65, .4, .6]]) p.bit(u0, u1, v0, v1, H * .62, H * .74, WHITE); p.pyr(.5, .5, .15 * p.a.s, H * .8, H * .2, c.roof || '#5a6a5a'); p.flat(.2, .8, .2, .8, .004, '#d8d0bc'); },
  lighthouse(p) { const H = p.H, s = p.a.s; for (let i = 0; i < 5; i++) p.cyl(.5, .5, (.16 - i * .015) * s, H * i * .16, H * (i + 1) * .16, i % 2 ? p.c.accent : p.c.wall, 10, (.16 - (i + 1) * .015) * s); p.cyl(.5, .5, .08 * s, H * .8, H * .9, '#fff2a8', 8); p.cone(.5, .5, .1 * s, H * .9, H, p.c.accent, 8); p.blk(.62, .88, .55, .85, 0, H * .18, p.c.wall, p.c.accent, false); },
  tvtower(p) { const H = p.H, s = p.a.s; for (let i = 0; i < 6; i++) p.geo(GEO.cone4, p.X(.5), p.a.y0 + H * (i + .5) * .13, p.Z(.5), (.2 - i * .028) * s, H * .13, (.2 - i * .028) * s, i % 2 ? p.c.accent : p.c.wall, 0, Math.PI / 4, 0); p.cyl(.5, .5, .06 * s, H * .72, H * .78, '#c8ccd0', 8); p.pole(.5, .5, .008 * s, H * .78, H, RED); },
  arch(p) { const H = p.H, c = p.c, w = c.wall || STONE; p.blk(.2, .38, .4, .6, 0, H * .8, w, null, false); p.blk(.62, .8, .4, .6, 0, H * .8, w, null, false); p.blk(.18, .82, .38, .62, H * .62, H, w, c.roof || w, false); p.flat(.1, .9, .3, .7, .004, '#d8d0bc'); },
  obelisk(p) { const H = p.H, s = p.a.s, c = p.c; p.bit(.3, .7, .3, .7, 0, .08, '#b8b0a0'); p.blk(.44, .56, .44, .56, .08, H * .88, c.wall || '#d8d0c0', null, false); p.pyr(.5, .5, .06 * s, H * .88, H * .12, c.wall || '#d8d0c0'); },
  pagoda(p) { const H = p.H, s = p.a.s, c = p.c; for (let i = 0; i < 5; i++) { const w = .34 - i * .05, h0 = H * i * .17, h1 = h0 + H * .12; p.blk(.5 - w, .5 + w, .5 - w, .5 + w, h0, h1, c.wall || '#d8c8a0', null, false); p.hip(.5 - w - .06, .5 + w + .06, .5 - w - .06, .5 + w + .06, h1, H * .05, c.roof || '#8a3e32'); } p.pole(.5, .5, .01 * s, H * .85, H, '#d8c060'); },
  windmill(p) { const H = p.H, s = p.a.s, c = p.c; p.cyl(.5, .5, .18 * s, 0, H * .65, c.wall || '#d8d0c0', 8, .12 * s); p.cone(.5, .5, .15 * s, H * .65, H * .78, c.roof || '#5a4a44', 8); for (let i = 0; i < 4; i++) p.spoke(p.X(.5) + .13 * s, p.a.y0 + H * .7, p.Z(.5) + .13 * s, H * .3, .06, i * Math.PI / 2 + .4, '#e8e0c8'); },
  observatory(p) { const H = p.H, s = p.a.s; p.blk(.2, .8, .55, .9, 0, H * .35, p.c.wallR, p.c.roof, 'arch'); p.cyl(.45, .35, .22 * s, 0, H * .55, p.c.wall, 12); p.dome(.45, .35, .22 * s, H * .55, '#d8dce0'); },
  radar(p) { const H = p.H, s = p.a.s; p.geo(GEO.cone4, p.X(.4), p.a.y0 + H * .35, p.Z(.4), .12 * s, H * .7, .12 * s, STEEL, 0, Math.PI / 4, 0); p.ball(.4, .4, .2 * s, H - .2 * s, WHITE); p.blk(.62, .92, .6, .9, 0, H * .3, p.c.wall, p.c.roof, 'grid'); },
  rocket(p) { const H = p.H, s = p.a.s; p.cyl(.35, .45, .07 * s, .1, H * .8, p.c.wall, 10); p.cone(.35, .45, .07 * s, H * .8, H, RED, 10); p.bit(.28, .42, .38, .52, 0, .1, '#6a6e74'); p.pole(.45, .45, .02 * s, 0, H * .85, '#c8403a'); p.blk(.55, .95, .6, .95, 0, H * .3, '#d8dce0', '#8a9098', 'grid'); p.cyl(.8, .3, .1 * s, 0, H * .3, WHITE, 10); p.dome(.8, .3, .1 * s, H * .3, '#c8ccd0'); },
  weather(p) { const H = p.H, s = p.a.s; p.blk(.2, .6, .5, .85, 0, H * .35, p.c.wall, p.c.roof, 'grid'); p.pole(.75, .3, .012 * s, 0, H, STEEL); p.ball(.75, .3, .06 * s, H * .9, WHITE); p.cyl(.35, .3, .1 * s, H * .35, H * .45, WHITE, 10); p.dome(.35, .3, .1 * s, H * .45, '#d8dce0'); },
  viewtower(p) { const H = p.H, s = p.a.s; p.cyl(.5, .5, .07 * s, 0, H * .8, p.c.wall, 8); p.cyl(.5, .5, .2 * s, H * .8, H * .9, GLASS, 10); p.cyl(.5, .5, .22 * s, H * .9, H * .93, '#8a9098', 10); p.pole(.5, .5, .01 * s, H * .93, H, STEEL); },
  gazebo(p) { const H = p.H; for (const [u, v] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7]]) p.pole(u, v, .015 * p.a.s, 0, H * .65, p.c.wall); p.hip(.25, .75, .25, .75, H * .65, H * .35, p.c.roof || '#8a3e32'); p.flat(.25, .75, .25, .75, .03, '#d8d0bc'); },
  pavilion(p) { const H = p.H; for (const [u, v] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7]]) p.pole(u, v, .015 * p.a.s, 0, H * .6, p.c.wall); p.hip(.22, .78, .22, .78, H * .6, H * .4, p.c.roof || '#c8403a'); p.bit(.35, .65, .78, .98, 0, .04, '#8a6a48'); },
  bigtree(p) { const H = p.H, s = p.a.s; p.cyl(.5, .5, .08 * s, 0, H * .45, p.c.wallR, 7, .05 * s); p.ball(.5, .5, .3 * s, H * .6, p.c.wall); p.ball(.35, .42, .2 * s, H * .55, '#4f8a44'); p.ball(.62, .6, .22 * s, H * .5, '#357035'); p.flat(.2, .8, .2, .8, .004, '#c8b89a'); },
  lookout(p) { const H = p.H, s = p.a.s; for (const [u, v] of [[.4, .4], [.6, .4], [.4, .6], [.6, .6]]) p.pole(u, v, .012 * s, 0, H * .75, p.c.wallR); p.blk(.35, .65, .35, .65, H * .72, H * .86, p.c.wall, null, false); p.pyr(.5, .5, .18 * s, H * .86, H * .14, p.c.roof); },
  chimney(p) { const H = p.H, s = p.a.s; p.blk(.15, .6, .45, .85, 0, H * .3, p.c.wall, p.c.roof, 'grid'); p.cyl(.75, .35, .06 * s, 0, H, p.c.wall, 8, .05 * s); p.bit(.72, .78, .44, .45, H * .7, H * .82, RED); },
  deck(p) { const H = p.H, s = p.a.s; p.bit(.2, .8, .2, .8, H * .4, H * .45, p.c.wall); for (const [u, v] of [[.22, .22], [.78, .22], [.22, .78], [.78, .78]]) p.pole(u, v, .015 * s, 0, H * .4, '#6a4a30'); p.bit(.2, .8, .2, .22, H * .45, H * .6, '#6a4a30'); p.pole(.5, .3, .02 * s, H * .45, H, '#3a3f48'); },
};

// 畫一棟；回傳這棟用到的顏色（小寫十六進位）
export function drawKind(a: KindCtx, shape: Shape | null): Set<string> {
  const b = shape ? BUILDERS[shape.type] : null;
  USED = new Set();
  try { if (b) b(new Pen(a), shape!.p ?? {}); return USED; } finally { USED = null; }
}
export const BUILDER_TYPES = Object.keys(BUILDERS);
export const LANDMARK_KINDS = Object.keys(LANDMARKS);
