// D064: fourteen parcel-scaled British tower and mega-block exteriors for the four merge kinds (33, 34, 105, 106). They are free adaptations
// of real listed buildings (docs/D064-reference-record.md), not reconstructions of any one site. Geometry only: callers own the three arenas,
// picking IDs and world state. Windows come from the existing window atlas (no extra triangles, no new texture); small details go to the
// non-shadow-casting arena D. Colours are the kind's laboratory colours (wall, wall side, roof, accent): the shape is British, the colour is the game's.
// Plan coordinates are LOCAL: x and z in cells from the centre of the footprint (±s/2), then turned by a quarter-turn picked from the position
// (render only, never stored). Heights are cells above y0, as fractions of the kind-table height H, so a variant keeps its proportions.
import * as THREE from 'three';
import type { Geo } from './scene.ts';
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { towerModel, type TowerModel } from '../content/britishTowers.ts';

type V3 = [number, number, number];
type P2 = [number, number];
interface Win { floorH: number; style: number; glass: THREE.Color; perCell: number }

const GLASS = '#3a4a58', GLASS_LIGHT = '#6f9cc4', STEEL = '#8b9199', CRANE = '#2d6cb0';
const toneCache = new Map<string, string>();
// Small lightness / hue / saturation moves around a base colour (deterministic; the base is always one of the kind's laboratory colours).
function tone(hex: string, dl: number, dh = 0, ds = 0): string {
  const key = `${hex}|${dl}|${dh}|${ds}`;
  let v = toneCache.get(key);
  if (!v) { const c = new THREE.Color(hex); c.offsetHSL(dh, ds, dl); v = '#' + c.getHexString(); toneCache.set(key, v); }
  return v;
}
function mix(a: string, b: string, t: number): string {
  const key = `${a}>${b}@${t}`;
  let v = toneCache.get(key);
  if (!v) { v = '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); toneCache.set(key, v); }
  return v;
}

// A turn of 0..3 quarter-turns from the plot position: stateless, so the same plot always faces the same way.
export const towerTurn = (x0: number, z0: number): number => (((Math.imul(x0 | 0, 73856093) ^ Math.imul(z0 | 0, 19349663)) >>> 0) % 4);

class Tw {
  readonly p: Pen;
  readonly rot: number;
  readonly s: number;
  readonly H: number;
  readonly K: { wall: string; wallR: string; roof: string; acc: string };
  private readonly cx: number;
  private readonly cz: number;
  private readonly y0: number;
  constructor(p: Pen, rot: number) {
    this.p = p; this.rot = ((rot % 4) + 4) % 4; this.s = p.a.s; this.H = p.a.H; this.y0 = p.a.y0;
    this.cx = p.a.x0 + p.a.s / 2; this.cz = p.a.z0 + p.a.s / 2;
    this.K = { wall: p.c.wall, wallR: p.c.wallR || p.c.wall, roof: p.c.roof, acc: p.c.accent || p.c.roof };
  }
  get W(): Geo { return this.p.a.W; }
  get O(): Geo { return this.p.a.O; }
  get D(): Geo { return this.p.a.D; }
  // local plan point → world x, z after the quarter-turn about the centre of the footprint
  w(x: number, z: number): P2 {
    const { cx, cz } = this;
    switch (this.rot) {
      case 1: return [cx - z, cz + x];
      case 2: return [cx - x, cz - z];
      case 3: return [cx + z, cz - x];
      default: return [cx + x, cz + z];
    }
  }
  pt(x: number, h: number, z: number): V3 { const [a, b] = this.w(x, z); return [a, this.y0 + h, b]; }
  win(style: keyof typeof WIN_STYLE = 'grid', floorH = .28, perCell = 2, glass = GLASS): Win { return { floorH, style: WIN_STYLE[style], glass: col(glass), perCell }; }
  // Axis-aligned boxes stay axis-aligned under quarter-turns.
  private box(g: Geo, x0: number, z0: number, x1: number, z1: number, h0: number, h1: number, wall: string, top: string | null, win: Win | null) {
    const [ax, az] = this.w(x0, z0), [bx, bz] = this.w(x1, z1);
    g.box(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), this.y0 + h0, this.y0 + h1, col(wall), top ? col(top) : null, win);
  }
  blk(x0: number, z0: number, x1: number, z1: number, h0: number, h1: number, wall: string, top: string | null = null, win: Win | null = this.win()) { this.box(this.W, x0, z0, x1, z1, h0, h1, wall, top, win); }
  solid(x0: number, z0: number, x1: number, z1: number, h0: number, h1: number, wall: string, top: string | null = wall) { this.box(this.O, x0, z0, x1, z1, h0, h1, wall, top, null); }
  bit(x0: number, z0: number, x1: number, z1: number, h0: number, h1: number, wall: string, top: string | null = wall) { this.box(this.D, x0, z0, x1, z1, h0, h1, wall, top, null); }
  post(x: number, z: number, half: number, h0: number, h1: number, c = STEEL) { this.bit(x - half, z - half, x + half, z + half, h0, h1, c); }
  // Vertical prism over a convex polygon (or one that is star-shaped about its centroid when `star`), windows optional (arena W only).
  // `top` draws the cap; `skip` lists edge indices whose wall is hidden (a shared joint).
  prism(g: Geo, pts: P2[], h0: number, h1: number | ((x: number, z: number) => number), wall: string, top: string | null, win: Win | null = null, star = false, skip: number[] = []) {
    const n = pts.length, wp = pts.map(([x, z]) => this.w(x, z)), hh = (i: number) => typeof h1 === 'function' ? h1(pts[i][0], pts[i][1]) : h1;
    const cxp = wp.reduce((a, q) => a + q[0], 0) / n, czp = wp.reduce((a, q) => a + q[1], 0) / n, c = col(wall);
    const st0 = g.style, gl0 = g.glass;
    if (win) { g.style = win.style; g.glass = win.glass; }
    for (let i = 0; i < n; i++) {
      if (skip.includes(i)) continue;
      const j = (i + 1) % n, a = wp[i], b = wp[j], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      let nx = dz / len, nz = -dx / len;
      if (nx * ((a[0] + b[0]) / 2 - cxp) + nz * ((a[1] + b[1]) / 2 - czp) < 0) { nx = -nx; nz = -nz; }
      const ya = this.y0 + hh(i), yb = this.y0 + hh(j), y0 = this.y0 + h0;
      const uvs: [number, number][] = win ? (() => { const U = Math.max(1, Math.round(len * win.perCell)), V = ((ya + yb) / 2 - y0) / win.floorH; return [[0, 0], [U, 0], [U, V], [0, V]] as [number, number][]; })() : [[0, 0], [0, 0], [0, 0], [0, 0]];
      g.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], yb, b[1]], [a[0], ya, a[1]], [nx, 0, nz], c, uvs);
    }
    g.style = st0; g.glass = gl0;
    if (top) {
      const tc = col(top), v = (i: number): V3 => [wp[i][0], this.y0 + hh(i), wp[i][1]];
      if (star) { const hm = (this.y0 + (typeof h1 === 'function' ? h1(0, 0) : h1)); for (let i = 0; i < n; i++) g.triangle([cxp, hm, czp], v(i), v((i + 1) % n), [0, 1, 0], tc); }
      else for (let i = 1; i < n - 1; i++) g.triangle(v(0), v(i), v(i + 1), [0, 1, 0], tc);
    }
  }
  pyr(x: number, z: number, half: number, h: number, rise: number, c: string) { const [a, b] = this.w(x, z); this.O.pyramid(a, b, half, this.y0 + h, rise, col(c)); }
  barrel(x: number, z: number, halfW: number, len: number, rise: number, h: number, c: string, alongZ = true) {
    const [wx, wz] = this.w(x, z);
    this.p.barrel((wx - this.p.a.x0) / this.s, (wz - this.p.a.z0) / this.s, halfW, len, rise, h, c, this.rot % 2 === 0 ? alongZ : !alongZ);
  }
}

// ---- plan helpers (local coordinates) ----
const ngon = (x: number, z: number, r: number, n: number, phase = 0): P2[] => Array.from({ length: n }, (_, i) => { const a = phase + i * Math.PI * 2 / n; return [x + r * Math.cos(a), z + r * Math.sin(a)] as P2; });
const around = (pts: P2[], k: number): P2[] => { const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length; return pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k] as P2); };
const shift = (pts: P2[], dx: number, dz: number): P2[] => pts.map(([x, z]) => [x + dx, z + dz] as P2);
// Octagon with canted corners: a square of half-size `a` whose corners are cut by `c`.
const canted = (x: number, z: number, a: number, c: number): P2[] => [[x - a + c, z - a], [x + a - c, z - a], [x + a, z - a + c], [x + a, z + a - c], [x + a - c, z + a], [x - a + c, z + a], [x - a, z + a - c], [x - a, z - a + c]];
// A bent band (two mitred legs) around the centreline p0 → pm → p1: returns the two convex quads; their shared edge is `skip`ped when drawn.
function chevron(p0: P2, pm: P2, p1: P2, wd: number): { a: P2[]; b: P2[] } {
  const hw = wd / 2, nrm = (u: P2, v: P2): P2 => { const dx = v[0] - u[0], dz = v[1] - u[1], l = Math.hypot(dx, dz); return [dz / l, -dx / l]; };
  const n0 = nrm(p0, pm), n1 = nrm(pm, p1);
  let mx = n0[0] + n1[0], mz = n0[1] + n1[1]; const ml = Math.hypot(mx, mz); mx /= ml; mz /= ml;
  const k = hw / Math.max(.2, mx * n0[0] + mz * n0[1]);   // mitre length
  const off = (p: P2, n: P2, d: number): P2 => [p[0] + n[0] * d, p[1] + n[1] * d];
  const l0 = off(p0, n0, hw), r0 = off(p0, n0, -hw), lm = off(pm, [mx, mz], k), rm = off(pm, [mx, mz], -k), l1 = off(p1, n1, hw), r1 = off(p1, n1, -hw);
  return { a: [l0, lm, rm, r0], b: [lm, l1, r1, rm] };
}

// ================= 33 住宅摩天樓 =================
// v0 Barbican towers (NHLE 1352667): triangular plan, upswept balconies running round, jagged stepped tops, a raised podium.
function triangleTower(t: Tw) {
  const { H, K } = t, hp = Math.min(.5, .07 * H), top = .86 * H, R = .80, cz = .03;
  const tri = (r: number, dx = 0, dz = 0, deg = 0): P2[] => [0, 1, 2].map(i => { const a = (90 + deg + i * 120) * Math.PI / 180; return [dx + r * Math.cos(a), cz + dz + r * Math.sin(a)] as P2; });
  t.blk(-.92, -.92, .92, .92, 0, hp, K.wallR, K.roof, t.win('grid'));
  t.prism(t.W, tri(R), hp, top, K.wall, K.roof, t.win('grid', .26));
  for (let i = 0; i < 7; i++) { const y = hp + (top - hp) * (i + .5) / 7; t.prism(t.O, tri(R + .055), y, y + .11, mix(K.wall, K.roof, .55), tone(K.wall, -.04)); }
  const steps: [number, number, number, number, number, number][] = [[.78, .06, .03, 12, .86, .905], [.62, -.07, .06, 40, .905, .955], [.44, .06, -.06, 75, .955, 1]];
  for (const [r, dx, dz, deg, a, b] of steps) t.prism(t.W, tri(r, dx, dz, deg), a * H, b * H, K.wall, K.roof, t.win('punch', .24));
}
// v3 Trellick Tower (NHLE 1246688): L-shaped slab, a 35-storey service tower semi-freestanding at the corner, linked every third floor,
// a projecting glazed boiler house near the top, balconies forming a pattern.
function slabServiceTower(t: Tw) {
  const { H, K } = t, hA = .886 * H, hB = .2 * H, gl = t.win('grid', .26);
  t.blk(-.92, -.90, .46, -.50, 0, hA, K.wall, K.roof, gl);                 // main range
  t.blk(.06, -.50, .46, .42, 0, hB, K.wall, K.roof, gl);                   // lower range (seven storeys)
  t.blk(.60, -.98, .90, -.68, 0, H, K.wallR, K.roof, t.win('punch', .30, 1.2));   // service tower
  for (const f of [.30, .42, .54, .66, .78]) t.bit(.46, -.84, .60, -.74, f * H, (f + .035) * H, tone(K.wall, -.12));   // links every third floor
  t.blk(.57, -.99, .93, -.65, .915 * H, .975 * H, tone(K.wall, .08), K.roof, t.win('ribbon', .22, 2, GLASS_LIGHT));   // projecting glazed boiler house
  for (let i = 0; i < 5; i++) { const y = (.12 + .14 * i) * H; t.bit(-.90, -.945, .44, -.90, y, y + .03 * H, tone(K.wall, -.13, 0, -.07)); t.bit(-.90, -.50, .44, -.455, y, y + .03 * H, tone(K.wall, -.13, 0, -.07)); }   // balcony bands
  t.bit(-.5, -.80, -.1, -.55, hA, hA + .03 * H, tone(K.roof, .05));
}
// v1 Sivill House (NHLE 1469965): two parallel stacks cranked into shallow arrow-heads, a circular stair tower between them, an undercroft, a concrete crown on cranked arms.
function crankedPointBlock(t: Tw) {
  const { H, K } = t, hb = .08 * H, top = .935 * H;
  const N = chevron([-.88, -.66], [0, -.36], [.88, -.66], .30), S = chevron([-.88, .04], [0, .34], [.88, .04], .30);
  const gl = t.win('grid', .26, 1.6);
  for (const c of [N, S]) { t.prism(t.W, c.a, hb, top, K.wall, K.roof, gl, false, [1]); t.prism(t.W, c.b, hb, top, K.wall, K.roof, gl, false, [3]); }
  t.prism(t.W, ngon(0, -.01, .21, 8, Math.PI / 8), 0, .99 * H, K.wallR, K.roof, t.win('punch', .26));
  for (const px of [-.7, 0, .7]) { const zn = px === 0 ? -.36 : -.599, zs = px === 0 ? .34 : .101; t.post(px, zn, .045, 0, hb); t.post(px, zs, .045, 0, hb); }
  const CN = chevron([-.88, -.66], [0, -.36], [.88, -.66], .38), CS = chevron([-.88, .04], [0, .34], [.88, .04], .38);
  for (const c of [CN, CS]) { t.prism(t.O, c.a, .965 * H, H, tone(K.wall, -.05), tone(K.wall, -.02), null, false, [1]); t.prism(t.O, c.b, .965 * H, H, tone(K.wall, -.05), tone(K.wall, -.02), null, false, [3]); }
  for (const [x, z] of [[-.45, -.52], [.45, -.52], [-.45, .19], [.45, .19]] as P2[]) t.bit(x - .035, z - .035, x + .035, z + .035, top, .965 * H, K.roof);
}
// v2 Keeling House (NHLE 1242108): a cluster block: four subsidiary towers linked to a core, solid balconies alternating with bedroom floors.
function clusterBlock(t: Tw) {
  const { H, K } = t, ht = .93 * H, win = t.win('ribbon', .24, 1.6);
  for (const [x, z] of [[.66, 0], [-.66, 0], [0, .66], [0, -.66]] as P2[]) t.blk(x - .2, z - .2, x + .2, z + .2, 0, ht, K.wall, K.roof, win);
  t.blk(-.18, -.18, .18, .18, 0, H, K.wallR, K.roof, t.win('punch', .26));
  for (const f of [.24, .50, .76]) {
    t.bit(.18, -.06, .46, .06, f * H, (f + .04) * H, tone(K.wall, -.1)); t.bit(-.46, -.06, -.18, .06, f * H, (f + .04) * H, tone(K.wall, -.1));
    t.bit(-.06, .18, .06, .46, f * H, (f + .04) * H, tone(K.wall, -.1)); t.bit(-.06, -.46, .06, -.18, f * H, (f + .04) * H, tone(K.wall, -.1));
  }
  for (const f of [.18, .46, .74]) t.bit(-.2, -.2, .2, .2, f * H, (f + .03) * H, tone(K.wall, -.16));
  for (const [x, z] of [[.66, 0], [-.66, 0], [0, .66], [0, -.66]] as P2[]) t.bit(x - .22, z - .22, x + .22, z + .22, .38 * H, .405 * H, tone(K.wall, -.16));
  t.bit(-.07, -.07, .07, .07, H, H + .06 * H, tone(K.roof, .06));
}

// ================= 34 商業摩天樓 =================
// v0 Millbank Tower (NHLE 1242617): a butterfly / diabolo plan on a two-storey podium raised on columns, a perimeter viewing platform, a Y-shaped lower block.
function diaboloTower(t: Tw) {
  const { H, K } = t, hp0 = .045 * H, hp1 = .115 * H, top = .93 * H;
  const k = 1.15, plan = shift([[.5, -.5], [0, -.62], [-.5, -.5], [-.38, 0], [-.5, .5], [0, .62], [.5, .5], [.38, 0]].map(([x, z]) => [x * k, z * k] as P2), .1, .1);
  t.blk(-.95, -.95, .95, .95, hp0, hp1, K.wallR, K.roof, t.win('grid', .26));
  for (const [x, z] of [[-.78, -.78], [0, -.78], [.78, -.78], [-.78, .78], [0, .78], [.78, .78]] as P2[]) t.post(x, z, .05, 0, hp0);
  t.prism(t.W, plan, hp1, top, K.wall, null, t.win('ribbon', .24, 2, GLASS_LIGHT), true);
  t.prism(t.O, around(plan, 1.07), top, .945 * H, K.roof, K.roof, null, true);
  t.prism(t.O, around(plan, .62), .945 * H, H, tone(K.wall, -.06), K.roof, null, true);
  const hub: P2 = [-.62, -.62];
  for (const deg of [20, 140, 260]) { const a = deg * Math.PI / 180, ex = hub[0] + Math.cos(a) * .32, ez = hub[1] + Math.sin(a) * .32, nx = -Math.sin(a) * .09, nz = Math.cos(a) * .09;
    t.prism(t.D, [[hub[0] + nx, hub[1] + nz], [ex + nx, ez + nz], [ex - nx, ez - nz], [hub[0] - nx, hub[1] - nz]], hp1, hp1 + .22 * H, tone(K.wall, -.04), K.roof); }
}
// v3 CIS Building (NHLE 1270494): a glass-walled tower and a blank mosaic service tower forming a squat T, a five-storey podium with a plant room, a tower
// that projects over the entrance on six columns.
function serviceTTower(t: Tw) {
  const { H, K } = t, hp = .18 * H, grey = tone(K.wall, -.2, 0, -.1);
  t.blk(-.95, -.95, .95, .35, 0, hp, K.wall, K.roof, t.win('grid', .26));
  t.blk(-.92, -.90, -.58, .32, hp, hp + .04 * H, tone(K.wall, -.12), K.roof, null);     // the large plant room
  t.blk(.6, -.90, .92, -.30, hp, hp + .03 * H, tone(K.wall, -.12), K.roof, null);
  t.blk(-.5, -.55, .5, .22, hp, .93 * H, K.wall, K.roof, t.win('ribbon', .24, 2, '#1f2b3a'));     // glass curtain-wall tower
  t.blk(-.5, .22, .5, .70, .10 * H, hp, K.wall, K.roof, t.win('ribbon', .24, 2, '#1f2b3a'));    // the tower projects over the entrance
  for (let i = 0; i < 6; i++) t.post(-.45 + i * .18, .64, .03, 0, .10 * H);
  t.solid(-.2, -.95, .2, -.55, hp, H, grey, K.roof);                                       // blank service tower
  for (const f of [.55, .78]) t.bit(-.215, -.965, .215, -.535, f * H, (f + .05) * H, tone(K.roof, -.1));   // two deep bands of vents
}
// v1 Alpha Tower (NHLE 1420049): a cranked "boomerang" plan with wedge ends, raised on pillars, a set-back roof plant, a free-standing low service block of
// obliquely cut turrets.
function boomerangTower(t: Tw) {
  const { H, K } = t, hb = .06 * H, top = .93 * H, win = t.win('ribbon', .24, 2, '#463b32');
  const wing = (c: P2, tip: P2, w: number): P2[] => { const dx = tip[0] - c[0], dz = tip[1] - c[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, nx = -uz * w / 2, nz = ux * w / 2, f = .58; return [[c[0] + nx, c[1] + nz], [c[0] + dx * f + nx * .9, c[1] + dz * f + nz * .9], tip, [c[0] + dx * f - nx * .9, c[1] + dz * f - nz * .9], [c[0] - nx, c[1] - nz]]; };
  const A = wing([0, .08], [-.92, -.26], .46), B = wing([0, .08], [.92, -.26], .46);
  t.prism(t.W, A, hb, top, K.wall, K.roof, win, false, [4]);
  t.prism(t.W, B, hb, top, K.wall, K.roof, win, false, [4]);
  for (const [x, z] of [[-.55, -.10], [-.22, .0], [.22, .0], [.55, -.10], [0, .22], [0, -.12]] as P2[]) t.post(x, z, .04, 0, hb);
  t.blk(-.15, -.10, .15, .20, top, H, tone(K.wall, -.06), K.roof, null);
  const cut = (x: number, z: number, r: number, h: number, k: number, axis: 0 | 1) => t.prism(t.O, ngon(x, z, r, 8, Math.PI / 8), 0, (px, pz) => h + k * ((axis === 0 ? px - x : pz - z)), tone(K.wall, .12, 0, -.1), tone(K.wall, .16, 0, -.1));
  cut(-.80, .60, .14, .13 * H, .4, 0); cut(-.58, .81, .11, .12 * H, .4, 1);
  t.prism(t.O, [[-.94, .72], [-.70, .72], [-.70, .94], [-.94, .94]], 0, (px, pz) => .11 * H + .4 * (px + .82), tone(K.wall, .12, 0, -.1), tone(K.wall, .16, 0, -.1));
}
// v2 The Rotunda (NHLE 1381413): a circular tower with continuous glazing bands on a one-storey wedge-shaped podium raised on pilotis, a steel-frame parapet.
function roundTower(t: Tw) {
  const { H, K } = t, h0 = .07 * H, h1 = h0 + .30, top = .955 * H, c: P2 = [.1, -.12];
  t.prism(t.W, [[-.92, -.78], [.92, -.40], [.92, .84], [-.92, .84]], h0, h1, K.wallR, K.roof, t.win('punch', .24, 1.5));
  for (const [x, z] of [[-.8, -.6], [0, -.2], [.8, -.3], [-.8, .74], [0, .74], [.8, .74]] as P2[]) t.post(x, z, .045, 0, h0);
  t.prism(t.W, ngon(c[0], c[1], .56, 12, Math.PI / 12), h1, top, K.wall, null, t.win('ribbon', .22, 2, GLASS_LIGHT));
  t.prism(t.O, ngon(c[0], c[1], .605, 12, Math.PI / 12), top, H, tone(K.wall, -.1), K.roof);
}

// ================= 105 住宅巨廈 =================
// v0 The Brunswick Centre (NHLE 1246230): two stepped A-frame blocks (outer five storeys, inner eight) linked by a raised podium of shops, rooftop lift and vent towers.
function steppedMegablock(t: Tw) {
  const { H, K } = t, hp = .2 * H, win = t.win('grid', .26, 1.4);
  const block = (zc: number, d: number, hb: number, c: string) => {
    for (let i = 0; i < 4; i++) { const dd = d * Math.pow(.84, i); t.blk(-1.42, zc - dd / 2, 1.42, zc + dd / 2, hb * i / 4, hb * (i + 1) / 4, c, K.roof, win); }
    for (const x of [-.85, .85]) t.bit(x - .08, zc - .08, x + .08, zc + .08, hb, hb + .075 * H, tone(K.wallR, -.05));
  };
  block(.85, .92, H, K.wall);
  block(-.85, .92, .625 * H, tone(K.wall, -.05));
  t.blk(-1.42, -.40, 1.42, .40, 0, hp, K.roof, tone(K.wall, -.1), t.win('shop', .2, 1.2));
}
// v1 Park Hill (NHLE 1246881): four ranges cranked at obtuse angles, one even roof level over a stepped site, linked by bridges across the upper decks, brick in four shades.
function deckRanges(t: Tw) {
  const { H, K } = t, bases = [0, .13, .26, .26], win = t.win('grid', .26, 1.3);
  const zs = [-1.30, -.64, .02, .68], ch = zs.map(z => chevron([-1.15, z], [0, z + .62], [1.15, z], .26));
  ch.forEach((c, i) => {
    const wall = mix(K.roof, K.wall, i / 3), b = bases[i] * H;
    if (b > 0) { t.prism(t.O, c.a, 0, b, mix(K.wall, K.roof, .5), null, null, false, [1]); t.prism(t.O, c.b, 0, b, mix(K.wall, K.roof, .5), null, null, false, [3]); }
    t.prism(t.W, c.a, b, H, wall, K.roof, win, false, [1]);
    t.prism(t.W, c.b, b, H, wall, K.roof, win, false, [3]);
  });
  const zc = (i: number, x: number) => zs[i] + .62 * (1 - Math.abs(x) / 1.15);
  for (let i = 0; i < 3; i++) { const x = i === 1 ? .55 : -.55, a = zc(i, x) + .15, b = zc(i + 1, x) - .15; t.bit(x - .05, a, x + .05, b, .72 * H, .76 * H, tone(K.roof, .1)); }
}
// v2 Byker (NHLE 1392166): a perimeter block (five to eight storeys) round a courtyard, a five-storey crescent, carriageway openings, lift and stair towers rising to metal-clad points.
function perimeterBlock(t: Tw) {
  const { K } = t, H = t.H * .84, h5 = .625 * H, win = t.win('grid', .26, 1.5), metal = mix(K.wall, '#9ec4dd', .55);
  t.blk(-1.45, -1.45, -.15, -.95, 0, H, K.wall, metal, win);                 // north wing, west of the carriageway opening
  t.blk(.15, -1.45, 1.45, -.95, 0, H, K.wall, metal, win);                   // north wing, east of the opening
  t.blk(-.15, -1.45, .15, -.95, .2 * H, H, tone(K.wall, -.04), metal, win);  // the lintel over the opening
  t.blk(-1.45, -.95, -.95, 1.2, 0, h5, K.wall, metal, win);                  // west wing
  t.blk(.95, -.95, 1.45, 1.2, 0, h5, K.wall, metal, win);                    // east wing
  const cx = .95, cz = .95, ro = .5, ri = .27, n = 6;                         // the crescent: a half ring opening to the east wing
  const at = (i: number, r: number): P2 => { const a = Math.PI / 2 + i * Math.PI / n; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
  for (let i = 0; i < n; i++) t.prism(t.W, [at(i, ro), at(i + 1, ro), at(i + 1, ri), at(i, ri)], 0, h5, tone(K.wall, -.03), metal, win, false, [i < n - 1 ? 1 : -1, i > 0 ? 3 : -1]);
  for (const [x, z, h] of [[-.8, -1.2, H], [.8, -1.2, H], [-1.2, .3, h5], [1.2, .3, h5]] as [number, number, number][]) { t.blk(x - .1, z - .1, x + .1, z + .1, h, h + .09 * H, K.roof, null, null); t.pyr(x, z, .1, h + .09 * H, .09 * H, metal); }
}

// ================= 106 商業綜合體 =================
// v0 Senate House (NHLE 1113107): an 18-storey tower in recessed stages with broad central buttresses, flanked by courtyard ranges either side, symmetrical.
function recessedTower(t: Tw) {
  const { H, K } = t, st = [.30, .52, .70, .84, 1], wx = [.55, .48, .41, .34, .27], wz = [.45, .39, .33, .27, .21];
  let h0 = 0;
  st.forEach((h, i) => { t.blk(-wx[i], -wz[i], wx[i], wz[i], h0 * H, h * H, K.wall, i === 4 ? K.roof : tone(K.roof, .03 * i), t.win(i < 3 ? 'punch' : 'grid', .26, 1.8)); if (i < 4) t.bit(-wx[i] - .02, -wz[i] - .02, wx[i] + .02, wz[i] + .02, (h - .02) * H, h * H, tone(K.wall, -.12)); h0 = h; });
  for (const sx of [-1, 1]) t.blk(sx > 0 ? .5 : -.62, -.2, sx > 0 ? .62 : -.5, .2, 0, .9 * H, K.wall, tone(K.wall, -.1), t.win('punch', .26, 1.2));
  const hr = .26 * H;
  for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? .75 : -1.45, x1 = sx > 0 ? 1.45 : -.75;
    t.blk(x0, -1.45, x1, -1.0, 0, hr, K.wall, K.roof, t.win('punch', .24, 1.6));                        // rear arm
    t.blk(sx > 0 ? 1.05 : -1.45, -1.0, sx > 0 ? 1.45 : -1.05, 1.0, 0, hr, K.wall, K.roof, t.win('punch', .24, 1.6));   // outer arm
  }
}
// v1 Lloyd's Building (NHLE 1405493): a rectangular core with six perimeter service towers in a pinwheel, a stepped profile, three-tiered plant rooms, blue cranes, a barrel-vaulted atrium.
function pinwheelTowers(t: Tw) {
  const { H, K } = t, steel = K.wall;
  t.blk(-.75, -.55, .75, .55, 0, .6 * H, K.wall, K.roof, t.win('ribbon', .24, 2, GLASS_LIGHT));
  t.blk(-.6, -.42, .6, .42, .6 * H, .74 * H, K.wall, K.roof, t.win('ribbon', .24, 2, GLASS_LIGHT));
  t.barrel(0, 0, .26, 1.0, .12, .74 * H, tone(K.wall, .1), false);
  const towers: [number, number, number][] = [[-.55, -.82, .895], [.5, -.82, .76], [1.02, -.15, .83], [.55, .84, .66], [-.5, .84, .87], [-1.02, .2, .6]];
  towers.forEach(([x, z, f], i) => {
    t.solid(x - .15, z - .15, x + .15, z + .15, 0, f * H, steel, i % 2 ? K.roof : tone(steel, .05));
    if ([0, 2, 4, 5].includes(i)) for (let k = 0; k < 3; k++) { const a = .15 - k * .022; t.bit(x - a, z - a, x + a, z + a, f * H + k * .035 * H, f * H + (k + 1) * .035 * H, tone(K.roof, .04 * k)); }
  });
  t.bit(-.5, -.1, -.1, .1, .74 * H, .74 * H + .04 * H, CRANE); t.bit(.2, -.3, .5, -.15, .74 * H, .74 * H + .04 * H, CRANE);
}
// v2 The Economist group (NHLE 1264050): three buildings on a raised podium (a 16-storey tower, an 8-storey residential block, a 4-storey bank), each a square with canted corners, set-back plant rooms.
function cantedGroup(t: Tw) {
  const { H, K } = t, hp = .06 * H;
  t.blk(-1.45, -1.45, 1.45, 1.45, 0, hp, tone(K.wall, -.1), tone(K.wall, -.14), null);
  const b = (x: number, z: number, a: number, c: number, f: number) => {      // f: top of the building including its set-back plant room (fraction of H), so the three heights stay 16:8:4
    const body = .96 * f * H, plant = .04 * f * H;
    t.prism(t.W, canted(x, z, a, c), hp, body, K.wall, K.roof, t.win('grid', .26, 1.8));
    t.prism(t.O, canted(x, z, a * .62, c * .6), body, body + plant, tone(K.wall, -.06), K.roof);
    for (const sx of [-1, 1]) t.bit(x + sx * a * .55 - .02, z - a * .5, x + sx * a * .55 + .02, z + a * .5, body, body + plant, tone(K.wall, -.2));
  };
  b(-.2, -.2, .55, .18, 1); b(.95, -.9, .38, .13, .5); b(-.95, .95, .36, .12, .25);
}

const BUILD: Record<TowerModel, (t: Tw) => void> = {
  triangleTower, slabServiceTower, crankedPointBlock, clusterBlock,
  diaboloTower, serviceTTower, boomerangTower, roundTower,
  steppedMegablock, deckRanges, perimeterBlock,
  recessedTower, pinwheelTowers, cantedGroup,
};

// Draws the model for this (kind, variant). Returns false for anything that is not one of the fourteen, so the generic tower is used.
export function drawBritishTower(p: Pen, rot?: number): boolean {
  const model = towerModel(p.a.k, p.a.v ?? 0);
  if (!model) return false;
  BUILD[model](new Tw(p, rot ?? towerTurn(p.a.x0, p.a.z0)));
  return true;
}
