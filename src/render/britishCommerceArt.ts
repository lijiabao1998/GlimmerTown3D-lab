// D063: eleven parcel-scaled British commercial exteriors, one per existing kind-2 core-path archetype. They are
// free adaptations of real listed commercial buildings, not reconstructions of any one site.
// Geometry only: callers own the three arenas, picking IDs and world state. Windows come from the existing
// window atlas (no extra triangles, no new texture); small details go to the non-shadow-casting arena D.
// Plan coordinates u (x) and v (z) are 0..1 over the block, v=1 is the street front; heights are absolute
// cells above y0, so towers, domes and masts keep their proportions on 1x1 and 2x2 blocks alike.
import * as THREE from 'three';
import type { Geo } from './scene.ts';
import { WIN_STYLE } from './windows.ts';
import type { CommerceModel } from '../content/britishCommerce.ts';

export interface CommerceCtx {
  W: Geo; O: Geo; D: Geo;
  x0: number; z0: number; w: number; d: number; y0: number;
  wall: number;    // recipe wall height, cells
  pal: number;     // palette selector 0..5 (block variant mixed with a position hash; render-only)
  weather?: boolean;
}
type V3 = [number, number, number];
interface Mat { wall: string; dark: string; trim: string }
interface Win { floorH: number; style: number; glass: THREE.Color; perCell?: number; bandH?: number }

// Lit-face colours (the toon ramp supplies the shadow side). Six distinct wall tones per family.
const STONE: Mat[] = [
  { wall: '#e0d6bd', dark: '#ada38a', trim: '#f4eedb' },   // Portland stone
  { wall: '#b9bcc0', dark: '#898c91', trim: '#dadcdf' },   // cool grey limestone
  { wall: '#d8bf86', dark: '#a68d57', trim: '#ecdcb0' },   // Bath-stone gold
  { wall: '#c98f73', dark: '#98644c', trim: '#e4bfa9' },   // red sandstone
  { wall: '#9fb3a6', dark: '#72867a', trim: '#cddbd1' },   // green-grey stone
  { wall: '#f3f0e6', dark: '#bdb9ac', trim: '#fffdf5' },   // whitewashed stone
];
const BRICKS: Mat[] = [
  { wall: '#b0644c', dark: '#7e4332', trim: '#e3d6b8' },   // red brick
  { wall: '#c8a870', dark: '#8e7248', trim: '#ece2c6' },   // London stock brick
  { wall: '#9c5a48', dark: '#6b3a2e', trim: '#dccfb2' },   // dark red
  { wall: '#c27a55', dark: '#8a5236', trim: '#e8dcc0' },   // orange-red
  { wall: '#6f7f98', dark: '#4c586d', trim: '#d8d2c0' },   // blue engineering brick
  { wall: '#a9896a', dark: '#765d45', trim: '#e0d3b6' },   // brown
];
const TERRA: Mat[] = [
  { wall: '#dcb89c', dark: '#a98568', trim: '#f0ddc6' },   // pinky-buff terracotta
  { wall: '#b86a55', dark: '#864636', trim: '#dba08e' },   // deep terracotta red
  { wall: '#eadbb8', dark: '#b9a982', trim: '#f8eed4' },   // cream faience
  { wall: '#c3b8aa', dark: '#928778', trim: '#e2dacf' },   // grey-buff
  { wall: '#d99a62', dark: '#a76d3a', trim: '#eec59d' },   // orange buff
  { wall: '#e8c6c0', dark: '#b79690', trim: '#f6e2de' },   // pale rose
];
const GRANITE: Mat[] = [
  { wall: '#8b9096', dark: '#62676c', trim: '#c9ccd0' },   // polished grey granite
  { wall: '#a49b95', dark: '#756d68', trim: '#d6d0cb' },   // warm grey
  { wall: '#b08a86', dark: '#7f605d', trim: '#dcc4c0' },   // pink granite
  { wall: '#78808c', dark: '#505762', trim: '#bfc4cc' },   // blue-grey
  { wall: '#9aa08f', dark: '#6c7263', trim: '#cfd3c7' },   // green granite
  { wall: '#c2bdb2', dark: '#938e84', trim: '#e7e3da' },   // light granite
];
const CONCRETE: Mat[] = [
  { wall: '#b3b0a8', dark: '#84817a', trim: '#d9d6cf' },   // grey concrete
  { wall: '#8f9aa3', dark: '#646f78', trim: '#c2cad0' },   // blue-grey
  { wall: '#c9bda3', dark: '#9a8e74', trim: '#e8dfca' },   // board-marked buff
  { wall: '#7f8a7f', dark: '#566056', trim: '#b9c2b9' },   // green-grey
  { wall: '#a89690', dark: '#796760', trim: '#d3c6c1' },   // pinkish
  { wall: '#d0d3d4', dark: '#9fa3a5', trim: '#eceeee' },   // pale cladding
];
const ROOF = ['#5d6a73', '#6f4a3d', '#4a5560', '#7a8a7c', '#4f6a58', '#8b8f93'];
const C = { glass: '#2c3f56', door: '#34302b', iron: '#4b5158', ironLight: '#7d868d', copper: '#5f9d86', slate: '#4a525c',
  dome: '#6aa68f', timber: '#3d3a34', gold: '#c9a54a', dial: '#efe7c8' };
const color = (c: string) => new THREE.Color(c);

class Pen {
  readonly a: CommerceCtx;
  constructor(a: CommerceCtx) { this.a = a; }
  get s() { return Math.min(this.a.w, this.a.d) >= 2 ? 1.3 : 1; }   // bigger parcels get slightly bigger landmarks
  get area() { return this.a.w * this.a.d; }
  get lod() { const a = this.area; return a <= 2 ? 0 : a <= 4 ? 1 : 2; }        // detail tier by parcel area: small / medium / large
  get s2() { return Math.min(1.9, Math.max(1, Math.sqrt(this.area) / 1.25)); }   // landmark scale: grows with the parcel, but slower than it
  X(u: number) { return this.a.x0 + u * this.a.w; }
  Z(v: number) { return this.a.z0 + v * this.a.d; }
  Y(h: number) { return this.a.y0 + h; }
  pt(u: number, h: number, v: number): V3 { return [this.X(u), this.Y(h), this.Z(v)]; }
  // A part with absolute half extent `a` (cells) must stay inside the parcel: its centre may not come closer than a + 3 mm to an edge.
  fitU(u: number, a: number) { const m = (a + .003) / this.a.w; return Math.min(1 - m, Math.max(m, u)); }
  fitV(v: number, a: number) { const m = (a + .003) / this.a.d; return Math.min(1 - m, Math.max(m, v)); }
  mat(list: Mat[]): Mat { return list[Math.abs(this.a.pal) % list.length]; }
  roof(salt: number): string { return ROOF[(Math.abs(this.a.pal) + salt) % ROOF.length]; }
  win(style: number, floorH: number, perCell?: number, bandH?: number): Win { return { floorH, style, glass: color(C.glass), perCell, bandH }; }
  box(g: Geo, u0: number, u1: number, v0: number, v1: number, h0: number, h1: number, c: string, top: string | null = c) {
    g.box(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), this.Y(h0), this.Y(h1), color(c), top ? color(top) : null, null);
  }
  // Box centred on (u,v) with absolute half extents in cells: stays square on 1x2 and 2x1 parcels.
  cbox(g: Geo, u: number, v: number, ax: number, az: number, h0: number, h1: number, c: string, top: string | null = c) {
    const x = this.X(u), z = this.Z(v);
    g.box(x - ax, z - az, x + ax, z + az, this.Y(h0), this.Y(h1), color(c), top ? color(top) : null, null);
  }
  // Walls carry the window atlas, and the weathering tag (wall-top height) on the core path.
  wall(u0: number, u1: number, v0: number, v1: number, h0: number, h1: number, c: string, win: Win | null = null) {
    const { W } = this.a, previous = W.tag;
    if (this.a.weather) W.tag = this.Y(h1);
    try {
      W.box(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), this.Y(h0), this.Y(h1), color(c), null,
        win ? { floorH: win.floorH, style: win.style, glass: win.glass, perCell: win.perCell, bandH: win.bandH } : null);
    } finally { W.tag = previous; }
  }
  cwall(u: number, v: number, ax: number, az: number, h0: number, h1: number, c: string, win: Win | null = null) {
    this.wall(u - ax / this.a.w, u + ax / this.a.w, v - az / this.a.d, v + az / this.a.d, h0, h1, c, win);
  }
  // Flat cap over a roofless box: two triangles, drawn outside any weathering tag.
  cap(u0: number, u1: number, v0: number, v1: number, h: number, c: string, g: Geo = this.a.O) {
    g.quad(this.pt(u0, h, v0), this.pt(u1, h, v0), this.pt(u1, h, v1), this.pt(u0, h, v1), [0, 1, 0], color(c));
  }
  ccap(u: number, v: number, ax: number, az: number, h: number, c: string, g: Geo = this.a.O) {
    this.cap(u - ax / this.a.w, u + ax / this.a.w, v - az / this.a.d, v + az / this.a.d, h, c, g);
  }
  gable(u0: number, u1: number, v0: number, v1: number, h: number, rise: number, roof: string, wall: string, along: 'x' | 'z' = 'x',
    g: Geo = this.a.O, wg: Geo = this.a.W) {
    const yr = h + rise;
    if (along === 'x') {
      const v = (v0 + v1) / 2;
      g.slope(this.pt(u0, h, v1), this.pt(u1, h, v1), this.pt(u1, yr, v), this.pt(u0, yr, v), [0, 1, 1], color(roof));
      g.slope(this.pt(u0, h, v0), this.pt(u1, h, v0), this.pt(u1, yr, v), this.pt(u0, yr, v), [0, 1, -1], color(roof));
      wg.triangle(this.pt(u0, h, v0), this.pt(u0, h, v1), this.pt(u0, yr, v), [-1, 0, 0], color(wall));
      wg.triangle(this.pt(u1, h, v0), this.pt(u1, h, v1), this.pt(u1, yr, v), [1, 0, 0], color(wall));
    } else {
      const u = (u0 + u1) / 2;
      g.slope(this.pt(u0, h, v0), this.pt(u0, h, v1), this.pt(u, yr, v1), this.pt(u, yr, v0), [-1, 1, 0], color(roof));
      g.slope(this.pt(u1, h, v0), this.pt(u1, h, v1), this.pt(u, yr, v1), this.pt(u, yr, v0), [1, 1, 0], color(roof));
      wg.triangle(this.pt(u0, h, v1), this.pt(u1, h, v1), this.pt(u, yr, v1), [0, 0, 1], color(wall));
      wg.triangle(this.pt(u0, h, v0), this.pt(u1, h, v0), this.pt(u, yr, v0), [0, 0, -1], color(wall));
    }
  }
  // Four-sided pyramid on a rectangle centred at (u,v) with absolute half extents.
  pyr(g: Geo, u: number, v: number, ax: number, az: number, h: number, rise: number, c: string) {
    const cx = this.X(u), cz = this.Z(v), top: V3 = [cx, this.Y(h + rise), cz];
    const cs: V3[] = [[cx - ax, this.Y(h), cz - az], [cx + ax, this.Y(h), cz - az], [cx + ax, this.Y(h), cz + az], [cx - ax, this.Y(h), cz + az]];
    for (let i = 0; i < 4; i++) {
      const a = cs[i], b = cs[(i + 1) % 4];
      g.triangle(a, b, top, [(a[0] + b[0]) / 2 - cx, .5, (a[2] + b[2]) / 2 - cz], color(c));
    }
  }
  // Regular polygon (seg sides) around (u,v), absolute radii in cells, as plan points in world x,z.
  ring(u: number, v: number, rx: number, rz: number, seg: number, rot = 0): [number, number][] {
    const cx = this.X(u), cz = this.Z(v), pts: [number, number][] = [];
    for (let i = 0; i < seg; i++) { const t = rot + i * Math.PI * 2 / seg; pts.push([cx + Math.cos(t) * rx, cz + Math.sin(t) * rz]); }
    return pts;
  }
  // One vertical facet between two plan points, optionally carrying window UVs (same recipe as Geo.box).
  facet(g: Geo, a: [number, number], b: [number, number], h0: number, h1: number, c: string, out: [number, number], win: Win | null = null, tag = false) {
    const st0 = g.style, gl0 = g.glass, tg0 = g.tag;
    if (win) { g.style = win.style; g.glass = win.glass; if (win.bandH) g.band = win.bandH / win.floorH; }
    if (tag && this.a.weather) g.tag = this.Y(h1);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), U = Math.max(1, Math.round(len * (win?.perCell ?? 2))), Vv = win ? (h1 - h0) / win.floorH : 1;
    const A: V3 = [a[0], this.Y(h0), a[1]], B: V3 = [b[0], this.Y(h0), b[1]], Cc: V3 = [b[0], this.Y(h1), b[1]], Dd: V3 = [a[0], this.Y(h1), a[1]];
    g.quad(A, B, Cc, Dd, [out[0], 0, out[1]], color(c), win ? [[0, 0], [U, 0], [U, Vv], [0, Vv]] : undefined);
    g.band = 0; g.style = st0; g.glass = gl0; g.tag = tg0;
  }
  // Vertical prism or frustum over a polygon (outward normals from the polygon centre): `rb` and `rt` scale the ring at h0 and h1.
  prism(g: Geo, u: number, v: number, rx: number, rz: number, seg: number, h0: number, h1: number, c: string, win: Win | null = null, taper = 1, rot = Math.PI / seg, tag = false) {
    const cx = this.X(u), cz = this.Z(v), lo = this.ring(u, v, rx, rz, seg, rot), hi = this.ring(u, v, rx * taper, rz * taper, seg, rot);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg, mx = (lo[i][0] + lo[j][0]) / 2 - cx, mz = (lo[i][1] + lo[j][1]) / 2 - cz, n = Math.hypot(mx, mz) || 1;
      if (taper === 1) this.facet(g, lo[i], lo[j], h0, h1, c, [mx / n, mz / n], win, tag);
      else g.slope([lo[i][0], this.Y(h0), lo[i][1]], [lo[j][0], this.Y(h0), lo[j][1]], [hi[j][0], this.Y(h1), hi[j][1]], [hi[i][0], this.Y(h1), hi[i][1]], [mx, .35, mz], color(c));
    }
  }
  // Flat fan cap over a regular polygon.
  polyCap(g: Geo, u: number, v: number, rx: number, rz: number, seg: number, h: number, c: string, rot = Math.PI / seg) {
    const p = this.ring(u, v, rx, rz, seg, rot);
    for (let i = 1; i < seg - 1; i++) g.triangle([p[0][0], this.Y(h), p[0][1]], [p[i][0], this.Y(h), p[i][1]], [p[i + 1][0], this.Y(h), p[i + 1][1]], [0, 1, 0], color(c));
  }
  // Cone or dome-ish spire over a regular polygon.
  cone(g: Geo, u: number, v: number, rx: number, rz: number, seg: number, h: number, rise: number, c: string, rot = Math.PI / seg) {
    const p = this.ring(u, v, rx, rz, seg, rot), cx = this.X(u), cz = this.Z(v), top: V3 = [cx, this.Y(h + rise), cz];
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      g.triangle([p[i][0], this.Y(h), p[i][1]], [p[j][0], this.Y(h), p[j][1]], top, [(p[i][0] + p[j][0]) / 2 - cx, .5, (p[i][1] + p[j][1]) / 2 - cz], color(c));
    }
  }
  // Front face plus top face of a thin horizontal strip along the street front (a cornice or parapet): four triangles. The top is as deep
  // as the strip is tall, so a camera ray that slips behind the front face meets the top first (never a culled back face).
  strip(g: Geo, u0: number, u1: number, vFront: number, depth: number, h0: number, h1: number, c: string) {
    g.quad(this.pt(u0, h0, vFront), this.pt(u1, h0, vFront), this.pt(u1, h1, vFront), this.pt(u0, h1, vFront), [0, 0, 1], color(c));
    g.quad(this.pt(u0, h1, vFront), this.pt(u1, h1, vFront), this.pt(u1, h1, vFront - depth / this.a.d), this.pt(u0, h1, vFront - depth / this.a.d), [0, 1, 0], color(c));
  }
  // A small free-standing triangle that can be seen from behind through a gap (a dormer front): drawn once each way, two triangles in all.
  double(g: Geo, a: V3, b: V3, c: V3, out: V3, col: string) {
    g.triangle(a, b, c, out, color(col));
    g.triangle(a, b, c, [-out[0], -out[1], -out[2]], color(col));
  }
  // Parapet along one front facet: its outer face plus a top as deep as the face is tall (four triangles), so no ray reaches a culled back face first.
  rim(g: Geo, a: [number, number], b: [number, number], h0: number, h1: number, c: string, out: [number, number]) {
    this.facet(g, a, b, h0, h1, c, out);
    const t = h1 - h0, A: V3 = [a[0], this.Y(h1), a[1]], B: V3 = [b[0], this.Y(h1), b[1]];
    g.quad(A, B, [b[0] - out[0] * t, this.Y(h1), b[1] - out[1] * t], [a[0] - out[0] * t, this.Y(h1), a[1] - out[1] * t], [0, 1, 0], color(c));
  }
  // Front-plane decal (normal +z) at plan depth v.
  face(vFixed: number, u0: number, u1: number, h0: number, h1: number, c: string, out = .003, g: Geo = this.a.D) {
    const z = this.Z(vFixed) + out;
    g.quad([this.X(u0), this.Y(h0), z], [this.X(u1), this.Y(h0), z], [this.X(u1), this.Y(h1), z], [this.X(u0), this.Y(h1), z], [0, 0, 1], color(c));
  }
  anchor(u: number, h: number, v: number) { return new THREE.Vector3(this.X(u), this.Y(h), this.Z(v)); }
}

// 1 market → market hall: a stone-fronted range of pilastered storeys with a cornice and parapet, and behind it a glazed barrel-vault hall
// (Grainger Market's ashlar ranges, Leadenhall Market's arched roof of timber and glass).
function marketHall(p: Pen) {
  const { O, D, W } = p.a, m = p.mat(STONE), hw = Math.max(.26, p.a.wall), s = p.s, L = p.lod;
  const vf = .945;                                                                                        // one front plane for wall, cornice and pilaster roots: no gap for a ray to slip behind
  p.wall(.05, .95, .70, vf, 0, hw, m.wall, p.win(WIN_STYLE.punch, hw / 3, 3));
  p.cap(.05, .95, .70, vf, hw, m.dark);
  p.strip(D, .045, .955, vf, .03, hw, hw + .03, m.trim);                                                // cornice and parapet
  const np = L === 0 ? 2 : L === 1 ? 3 : Math.min(6, 3 + Math.round(p.a.w));                              // three-sided pilasters, proud of the wall
  for (let i = 0; i < np; i++) {
    const u = np === 2 ? [.18, .82][i] : .13 + (.74 * i) / (np - 1);
    const x0 = p.X(u) - .022, x1 = p.X(u) + .022, z0 = p.Z(vf), z1 = z0 + .016, y0 = p.Y(0), y1 = p.Y(hw);
    D.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color(m.trim));
    D.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color(m.trim));
    D.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], color(m.trim));
  }
  p.face(vf, .43, .57, 0, hw * .62, C.door);                                                            // central entrance
  // barrel vault along the depth, springing from the ground: ridge a little above the front cornice
  const rise = hw + .09 * s, n = L === 0 ? 4 : L === 1 ? 5 : 6, u0 = .10, u1 = .90, v0 = .08, v1 = .70, uc = .5, ur = (u1 - u0) / 2;
  const at = (i: number): [number, number] => { const t = Math.PI * (1 - i / n); return [uc + ur * Math.cos(t), rise * Math.sin(t)]; };
  for (let i = 0; i < n; i++) {
    const [ua, ha] = at(i), [ub, hb] = at(i + 1), mid = (ua + ub) / 2 - uc;
    O.slope(p.pt(ua, ha, v1), p.pt(ub, hb, v1), p.pt(ub, hb, v0), p.pt(ua, ha, v0), [mid, 1, 0], color(i % 2 ? '#74a8c8' : '#6f98b4'));   // glass: at least 20 CIE76 from every stone palette
  }
  for (let i = 1; i < n; i++) {                                                                          // both gable ends, n - 1 triangles each; the front end stands behind the range and shows only above its cornice
    const a = at(0), b = at(i), c = at(i + 1);
    W.triangle(p.pt(a[0], a[1], v0), p.pt(b[0], b[1], v0), p.pt(c[0], c[1], v0), [0, 0, -1], color(m.dark));
    D.triangle(p.pt(a[0], a[1], v1), p.pt(b[0], b[1], v1), p.pt(c[0], c[1], v1), [0, 0, 1], color(m.dark));
  }
  return p.anchor(.5, hw, .55);
}

// 1 modernShop → shop parade: a shallow curved row of red-brick shops behind high parapets, a cut-through passage in the middle on larger
// parcels, full-height glazing at the curved ends (Charles Holden's 1–8 Station Parade).
function shopParade(p: Pen) {
  const { O, D } = p.a, m = p.mat(BRICKS), hw = Math.max(.33, p.a.wall), big = p.area >= 4, n = 4, gap = big ? .08 : 0, roof = '#6b6f73';
  const zf = (u: number) => p.Z(.86 - .10 * Math.pow(2 * u - 1, 2));                                      // segmental front: centre nearest the street
  const vol = (ua: number, ub: number, k: number, left: boolean, right: boolean) => {                    // k facets from ua to ub
    const pts: [number, number][] = [];
    for (let i = 0; i <= k; i++) { const u = ua + (ub - ua) * i / k; pts.push([p.X(u), zf(u)]); }
    for (let i = 0; i < k; i++) {
      const endBay = (left && i === 0) || (right && i === k - 1);
      const win = p.win(endBay ? WIN_STYLE.shop : WIN_STYLE.ribbon, hw / 2, 3);
      const ox = pts[i][1] - pts[i + 1][1], oz = pts[i + 1][0] - pts[i][0], nn = Math.hypot(ox, oz) || 1;
      p.facet(p.a.W, pts[i], pts[i + 1], 0, hw, m.wall, [ox / nn, oz / nn], win, true);
      p.rim(D, pts[i], pts[i + 1], hw, hw + .04, m.trim, [ox / nn, oz / nn]);                            // high parapet in trim colour, with a top
    }
    const zb = p.Z(.34);
    p.facet(p.a.W, [p.X(ub), zb], [p.X(ua), zb], 0, hw, m.dark, [0, -1], null, true);                      // back
    p.facet(p.a.W, [p.X(ua), zb], pts[0], 0, hw, m.wall, [-1, 0], null, true);                            // left end: the outer end, or the passage wall facing the passage
    p.facet(p.a.W, pts[k], [p.X(ub), zb], 0, hw, m.wall, [1, 0], null, true);                             // right end: likewise faces +x
    for (let i = 1; i < k; i++) O.triangle([pts[0][0], p.Y(hw), pts[0][1]], [pts[i][0], p.Y(hw), pts[i][1]], [pts[i + 1][0], p.Y(hw), pts[i + 1][1]], [0, 1, 0], color(roof));   // fan over the arc: k - 1 triangles close the roof up to the last facet
    O.triangle([pts[0][0], p.Y(hw), pts[0][1]], [pts[k][0], p.Y(hw), pts[k][1]], [p.X(ub), p.Y(hw), zb], [0, 1, 0], color(roof));
    O.triangle([pts[0][0], p.Y(hw), pts[0][1]], [p.X(ub), p.Y(hw), zb], [p.X(ua), p.Y(hw), zb], [0, 1, 0], color(roof));
  };
  if (gap) { vol(.05, .5 - gap / 2, n / 2, true, false); vol(.5 + gap / 2, .95, n / 2, false, true); }
  else vol(.05, .95, n, true, true);
  return p.anchor(.5, hw, .6);
}

// 2 dept → great store: two storeys of display windows under four of plain walls, corner pavilions with steep mansard roofs and
// octagonal cupolas, a central pediment, a balustraded parapet (Harrods).
function greatStore(p: Pen) {
  const { O, D } = p.a, m = p.mat(TERRA), hw = Math.max(.54, p.a.wall), s2 = p.s2, lo = hw * .34, roof = C.copper;
  p.wall(.05, .95, .14, .93, 0, lo, m.wall, p.win(WIN_STYLE.shop, lo / 2, 3));                            // two storeys of display windows
  p.wall(.05, .95, .14, .93, lo, hw, m.wall, p.win(WIN_STYLE.grid, (hw - lo) / 4, 3));                     // four storeys above
  p.strip(D, .045, .955, .945, .035, hw, hw + .035, m.trim);                                             // balustraded parapet, drawn as a pale band
  p.cap(.05, .95, .14, .93, hw, m.dark);
  const pw = .08 * s2, ph = .10 * s2, rh = .14 * s2;
  const big = p.area >= 12;
  const corners: [number, number][] = big ? [[.12, .80], [.88, .80], [.12, .24], [.88, .24]] : [[.12, .80], [.88, .80]];
  for (const [u0, v0] of corners) {                                                                      // corner pavilions: a storey of windows under a steep copper roof, a gilt finial
    const u = p.fitU(u0, pw * 1.15), v = p.fitV(v0, pw * 1.15);
    p.cwall(u, v, pw, pw, hw, hw + ph, m.wall, p.win(WIN_STYLE.grid, ph / 2, 3));
    p.pyr(O, u, v, pw * 1.15, pw * 1.15, hw + ph, rh, roof);
    if (p.lod > 0) p.cone(D, u, v, .018 * s2, .018 * s2, 6, hw + ph + rh, .05 * s2, C.gold);
  }
  const pedH = .09 * s2;                                                                                 // central pediment on the front
  D.triangle(p.pt(.38, hw + .035, .95), p.pt(.62, hw + .035, .95), p.pt(.5, hw + .035 + pedH, .95), [0, 0, 1], color(m.trim));
  if (p.area >= 4) p.cone(O, .5, .50, .10 * s2, .10 * s2, 8, hw, .20 * s2, C.dome);                      // central dome over the roof
  return p.anchor(.5, hw, .55);
}

// 2 modernOffice → slab and drum: an eight-storey granite slab raised on tapering pilotis beside a taller cylindrical tower (Space House).
function slabDrum(p: Pen) {
  const { O, D } = p.a, m = p.mat(GRANITE), hw = Math.max(.71, p.a.wall), s2 = p.s2, small = p.area <= 3;
  const lift = .12, hs = hw * .62, ht = hw * 1.25, seg = small ? 8 : 12;
  p.wall(.06, .66, .50, .90, lift, hs, m.wall, p.win(WIN_STYLE.ribbon, (hs - lift) / 8, 3));
  p.cap(.06, .66, .50, .90, hs, m.dark);
  const piers = small ? [[.12, .56], [.12, .84], [.60, .56], [.60, .84]] : [[.12, .56], [.36, .56], [.60, .56], [.12, .84], [.36, .84], [.60, .84]];
  for (const [u, v] of piers) p.prism(D, u, v, .034 * s2, .034 * s2, 4, 0, lift, m.dark, null, .6, Math.PI / 4);   // tapering piers
  const R = .105 * s2;
  p.prism(p.a.W, .82, .42, R, R, seg, 0, ht, m.wall, p.win(WIN_STYLE.ribbon, ht / 16, 3), 1, Math.PI / seg, true);
  p.polyCap(O, .82, .42, R, R, seg, ht, m.dark);
  return p.anchor(.82, ht, .42);
}

// 2 stoneHotel → Gothic Revival hotel: red brick with pale stone bands, a steep roof lit by a row of gabled dormers, flanking towers
// with pointed spires (the Midland Grand Hotel at St Pancras).
function gothicHotel(p: Pen) {
  const { O, D } = p.a, m = p.mat(BRICKS), hw = Math.max(.92, p.a.wall), s2 = p.s2, eave = hw * .78;
  const rise = Math.max(hw * .22, .135 * p.a.d);                                                         // steep at every depth: rise over the half depth (.26 d) stays above .5
  p.wall(.14, .86, .30, .80, 0, eave, m.wall, p.win(WIN_STYLE.arch, eave / 4, 3));
  p.gable(.13, .87, .29, .81, eave, rise, ROOF[0], m.wall, 'x');
  const nd = p.lod === 0 ? 4 : p.lod === 1 ? 5 : 7, hr = (v: number) => eave + rise * (.81 - v) / .26;   // hr: the roof surface height at depth v
  const dh = Math.max(.09, rise * .075 / .26 + .05);                                                      // dormer roof rise: stays above the steeper slope behind it
  for (let i = 0; i < nd; i++) {                                                                          // gabled dormers on the front slope, standing on it
    const u = .22 + (.56 * i) / (nd - 1), vf = .775, base = hr(vf) - .012, w = .045;
    O.slope(p.pt(u - w, base, vf), p.pt(u + w, base, vf), p.pt(u + w, base + dh, .70), p.pt(u - w, base + dh, .70), [0, 1, 1], color(ROOF[1]));
    p.double(D, p.pt(u - w, base, vf), p.pt(u + w, base, vf), p.pt(u, base + dh * .78, vf), [0, 0, 1], m.trim);
  }
  p.box(D, .13, .87, .795, .805, eave * .52, eave * .56, m.trim, m.trim);                                 // stone string course
  for (const u0 of [.07, .93]) {                                                                         // flanking towers with spires
    const u = p.fitU(u0, .075 * s2);
    p.cwall(u, .74, .07 * s2, .07 * s2, 0, hw * 1.08, m.wall, p.win(WIN_STYLE.arch, hw * 1.08 / 5, 3));
    p.pyr(O, u, .74, .075 * s2, .075 * s2, hw * 1.08, .28 * s2, ROOF[2]);
  }
  return p.anchor(.5, eave + rise, .55);
}

// 3 podTower → tower on pilotis: a slender octagonal tower with slightly convex faces raised on paired piers, a low rectangular block beside it (Centre Point).
function pilotisTower(p: Pen) {
  const { O, D } = p.a, m = p.mat(CONCRETE), hw = Math.max(1.86, p.a.wall), s2 = p.s2, lift = .14, small = p.area <= 2;
  const ax = .27 * s2, az = .21 * s2, cx = .56, cz = .5;                                                  // absolute half extents: the tower does not widen with the parcel
  const shape: [number, number][] = [[-.62, -.80], [0, -1], [.62, -.80], [1, 0], [.62, .80], [0, 1], [-.62, .80], [-1, 0]];
  const pts: [number, number][] = shape.map(([a, b]) => [p.X(cx) + a * ax, p.Z(cz) + b * az]);
  for (let i = 0; i < 8; i++) {
    const a = pts[i], b = pts[(i + 1) % 8], mx = (a[0] + b[0]) / 2 - p.X(cx), mz = (a[1] + b[1]) / 2 - p.Z(cz), nn = Math.hypot(mx, mz) || 1;
    p.facet(p.a.W, a, b, lift, hw, m.wall, [mx / nn, mz / nn], p.win(i % 2 ? WIN_STYLE.grid : WIN_STYLE.ribbon, (hw - lift) / 28, 3), true);
  }
  for (let i = 1; i < 7; i++) O.triangle([pts[0][0], p.Y(hw), pts[0][1]], [pts[i][0], p.Y(hw), pts[i][1]], [pts[i + 1][0], p.Y(hw), pts[i + 1][1]], [0, 1, 0], color(m.dark));
  const pp = small ? [[-.55, -.5], [.55, -.5], [-.55, .5], [.55, .5]] : [[-.62, -.5], [-.25, -.8], [.25, -.8], [.62, -.5], [-.62, .5], [-.25, .8], [.25, .8], [.62, .5]];   // every pier stays wholly under the tower plan: nothing open to the sky
  for (const [a, b] of pp) p.cbox(D, cx + a * ax / p.a.w, cz + b * az / p.a.d, .02 * s2, .02 * s2, 0, lift, m.dark, null);   // piers (paired; waisted in the full study)
  const bw = Math.min(.20, .13 * s2);                                                                     // low block beside the tower
  p.wall(.04, .04 + bw, .30, .70, 0, hw * .34, m.trim, p.win(WIN_STYLE.grid, hw * .34 / 9, 3));
  p.cap(.04, .04 + bw, .30, .70, hw * .34, m.dark);
  return p.anchor(cx, hw, cz);
}

// 3 setback → stepped office: a symmetrical Portland-stone front stepped inwards in three tiers, a short central clock tower, an arcaded ground floor (Shell Mex House).
function steppedOffice(p: Pen) {
  const m = p.mat(STONE), hw = Math.max(1.38, p.a.wall), s2 = p.s2;
  const tiers: [number, number, number, number, number, number][] = [[.06, .94, .20, .90, 0, hw * .42], [.15, .85, .28, .82, hw * .42, hw * .72], [.25, .75, .36, .74, hw * .72, hw]];
  for (const [i, [u0, u1, v0, v1, h0, h1]] of tiers.entries()) {
    p.wall(u0, u1, v0, v1, h0, h1, m.wall, p.win(i === 0 ? WIN_STYLE.punch : WIN_STYLE.grid, (h1 - h0) / (i === 0 ? 5 : 4), 3));
    p.cap(u0, u1, v0, v1, h1, m.dark);
  }
  const th = .17 * s2;
  p.cwall(.5, .54, .075 * s2, .075 * s2, hw, hw + th, m.trim, p.win(WIN_STYLE.punch, th / 2, 3));         // short central tower
  p.ccap(.5, .54, .075 * s2, .075 * s2, hw + th, m.dark);
  p.face(.54 + .076 * s2 / p.a.d, .46, .54, hw + th * .30, hw + th * .78, C.dial);                        // clock face (front)
  { const x = p.X(.5) + .076 * s2, y0 = p.Y(hw + th * .30), y1 = p.Y(hw + th * .78), z0 = p.Z(.54) - .035 * s2, z1 = p.Z(.54) + .035 * s2;   // clock face (side)
    p.a.D.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], [1, 0, 0], color(C.dial)); }
  const arches = p.lod === 0 ? 5 : 7;
  for (let i = 0; i < arches; i++) { const u = .12 + (.76 * (i + .5)) / arches; p.face(.903, u - .045, u + .045, 0, hw * .16, C.door); }   // ground-floor arcade
  return p.anchor(.5, hw + th, .54);
}

// 3 slabC → grid court: four exposed-grid blocks around a central courtyard, tallest at the north, lowest at the flanks, each crowned by a free-standing beam (Metro Central Heights).
function gridCourt(p: Pen) {
  const { D } = p.a, m = p.mat(CONCRETE), hw = Math.max(1.15, p.a.wall), s2 = p.s2;
  const blocks: [number, number, number, number, number][] = [
    [.14, .86, .05, .27, hw],             // north (tallest)
    [.14, .86, .73, .95, hw * .67],       // south
    [.04, .24, .31, .69, hw * .5],        // west
    [.76, .96, .31, .69, hw * .5],        // east
  ];
  for (const [u0, u1, v0, v1, h] of blocks) {
    p.wall(u0, u1, v0, v1, 0, h, m.wall, p.win(WIN_STYLE.grid, h / Math.round(h * 14), 3));
    p.cap(u0, u1, v0, v1, h, m.dark);
    p.box(D, u0 - .01, u1 + .01, v0 + (v1 - v0) * .42, v0 + (v1 - v0) * .58, h + .025 * s2, h + .055 * s2, m.trim, m.trim);   // free-standing beam above the parapet
  }
  return p.anchor(.5, hw, .16);
}

// 3 stoneTower → domed tower: a granite block with a recessed colonnaded top storey, receding attic stages and two domed corner clock towers (Royal Liver Building).
function domedTower(p: Pen) {
  const { O, D } = p.a, m = p.mat(GRANITE), hw = Math.max(1.68, p.a.wall), s2 = p.s2, L = p.area >= 12 ? 2 : p.area > 2 ? 1 : 0, seg = L === 0 ? 6 : 8;
  const h1 = hw * .64, h2 = hw * .80, h3 = hw * .90;
  p.wall(.06, .94, .20, .90, 0, h1, m.wall, p.win(WIN_STYLE.arch, h1 / 7, 3));
  p.cap(.06, .94, .20, .90, h1, m.dark);
  p.wall(.14, .86, .28, .82, h1, h2, m.dark, p.win(WIN_STYLE.punch, (h2 - h1) / 2, 3));                    // recessed top storey
  const cols = L === 0 ? 3 : L === 1 ? 4 : 8;
  for (let i = 0; i < cols; i++) {                                                                       // colonnade in front of the recess: three-sided posts, capped
    const u = .17 + (.66 * i) / (cols - 1), r = .014 * s2;
    p.prism(D, u, .845, r, r, 3, h1, h2, m.trim); p.polyCap(D, u, .845, r, r, 3, h2, m.trim);
  }
  p.cap(.14, .86, .28, .82, h2, m.dark);
  if (L > 1) {
    p.wall(.30, .70, .40, .70, h2, h3, m.wall, p.win(WIN_STYLE.punch, (h3 - h2) / 2, 3));                  // attic stage
    p.cap(.30, .70, .40, .70, h3, m.dark);
  }
  p.cone(O, .5, .55, .13 * s2, .13 * s2, seg, L > 1 ? h3 : h2, (L > 1 ? .22 : .36) * s2, C.dome);       // central dome (the highest point)
  for (const u0 of [.12, .88]) {                                                                         // corner clock towers with domes
    const u = p.fitU(u0, (L === 0 ? .075 : .095) * s2);
    const top = h2 + .10 * s2;
    p.cwall(u, .31, .06 * s2, .06 * s2, h1, top, m.wall, p.win(WIN_STYLE.punch, (top - h1) / 3, 3));
    if (L === 0) p.pyr(O, u, .31, .075 * s2, .075 * s2, top, .16 * s2, C.dome); else p.cone(O, u, .31, .095 * s2, .095 * s2, seg, top, .16 * s2, C.dome);   // the octagon's inradius (.924 R) must clear the square tower's corner (.085 s2)
  }
  return p.anchor(.5, h3, .55);
}

// 3 modernNeedle → telecom tower: a slender concrete cylinder carrying a ring of equipment floors near the top and a mast above it (the BT Tower).
function telecomTower(p: Pen) {
  const { O, D } = p.a, m = p.mat(CONCRETE), hw = Math.max(2.04, p.a.wall), s2 = p.s2, small = p.area <= 3, seg = small ? 8 : 12;
  const R = .085 * s2, hb = hw * .78, hr = hw * .90;
  p.prism(p.a.W, .5, .5, R, R, seg, 0, hb, m.wall, p.win(WIN_STYLE.ribbon, hw / 30, 3), 1, Math.PI / seg, true);
  p.prism(p.a.W, .5, .5, R * 1.42, R * 1.42, seg, hb, hr, m.trim, p.win(WIN_STYLE.ribbon, (hr - hb) / 5, 3), 1, Math.PI / seg, true);   // equipment and restaurant floors
  p.polyCap(O, .5, .5, R * 1.42, R * 1.42, seg, hr, m.dark);
  p.prism(D, .5, .5, .012, .012, 4, hr, hw * 1.06, C.iron, null, .7, Math.PI / 4);                         // mast
  p.polyCap(D, .5, .5, .012 * .7, .012 * .7, 4, hw * 1.06, C.iron, Math.PI / 4);
  if (!small) { p.cwall(.5, .5, .20 * s2, .20 * s2, 0, hw * .08, m.trim, p.win(WIN_STYLE.punch, hw * .08, 3)); p.ccap(.5, .5, .20 * s2, .20 * s2, hw * .08, m.dark); }   // wider plant base, roofed
  return p.anchor(.5, hw, .5);
}

// 3 courtC → bridged court: a brick-and-stone ring of ranges around a long narrow courtyard crossed by two iron bridges and a spiral stair (The Albany).
function bridgedCourt(p: Pen) {
  const { D } = p.a, m = p.mat(BRICKS), hw = Math.max(1.05, p.a.wall), s2 = p.s2, hf = hw * .62;
  const wall = (u0: number, u1: number, v0: number, v1: number, h: number) => {
    p.wall(u0, u1, v0, v1, 0, h, m.wall, p.win(WIN_STYLE.grid, h / Math.max(3, Math.round(h * 5 / hw)), 3)); p.cap(u0, u1, v0, v1, h, m.dark);
  };
  wall(.05, .35, .06, .94, hw);                   // west range
  wall(.65, .95, .06, .94, hw);                   // east range
  wall(.35, .65, .06, .22, hw);                   // back range
  wall(.35, .65, .78, .94, hf);                   // front range, lower: the courtyard shows from the street
  p.strip(D, .04, .35, .96, .035, hw, hw + .035, m.trim); p.strip(D, .65, .96, .96, .035, hw, hw + .035, m.trim);   // cornice and balustrade over the two wings
  for (const h of [hw * .46, hw * .72]) p.cbox(D, .5, .50, .15 * p.a.w, .028 * s2, h, h + .02, C.iron, C.ironLight);   // two iron bridges across the courtyard
  const sg = p.lod === 0 ? 3 : 4;                                                                         // spiral stair: newel post (three-sided on the smallest parcels), capped…
  p.prism(D, .43, .32, .016 * s2, .016 * s2, sg, 0, hw * .62, C.iron, null, 1, Math.PI / sg); p.polyCap(D, .43, .32, .016 * s2, .016 * s2, sg, hw * .62, C.iron, Math.PI / sg);
  for (let i = 0; i < 2; i++) p.cbox(D, .43 + (i ? .022 : -.022) * s2 / p.a.w, .32 + (i ? .026 : -.026) * s2 / p.a.d, .022 * s2, .02 * s2, hw * (.20 + i * .24), hw * (.22 + i * .24), C.ironLight, C.ironLight);   // …and treads
  return p.anchor(.5, hw, .5);
}

const MODELS: Record<CommerceModel, (p: Pen) => THREE.Vector3> = {
  marketHall, shopParade, greatStore, slabDrum, gothicHotel, pilotisTower, steppedOffice, gridCourt, domedTower, telecomTower, bridgedCourt,
};

export function drawBritishCommerce(a: CommerceCtx, model: CommerceModel): THREE.Vector3 {
  return MODELS[model](new Pen(a));
}
