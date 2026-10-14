// D060: twelve parcel-scaled British industrial exteriors, one per existing kind-3 archetype. They are
// free adaptations of real industrial-heritage building types, not reconstructions of any one site.
// Geometry only: callers own the three arenas, picking IDs and world state. Windows come from the existing
// window atlas (no extra triangles, no new texture); small details go to the non-shadow-casting arena D.
// Plan coordinates u (x) and v (z) are 0..1 over the block, v=1 is the street front; heights are absolute
// cells above y0, so towers and chimneys keep their proportions on 1x1 and 2x2 blocks alike.
import * as THREE from 'three';
import type { Geo } from './scene.ts';
import { WIN_STYLE } from './windows.ts';
import type { IndustryModel } from '../content/britishIndustry.ts';

export interface IndustryCtx {
  W: Geo; O: Geo; D: Geo;
  x0: number; z0: number; w: number; d: number; y0: number;
  wall: number;    // recipe wall height, cells
  pal: number;     // palette selector 0..5 (block variant mixed with a position hash; render-only)
  weather?: boolean;
}
type V3 = [number, number, number];
interface Mat { wall: string; dark: string; trim: string }
interface Win { floorH: number; style: number; glass: THREE.Color; perCell?: number; bandH?: number }

// Lit-face colours (the toon ramp supplies the shadow side). Six distinct wall tones per list.
const MIX: Mat[] = [
  { wall: '#b0644c', dark: '#7e4332', trim: '#e3d6b8' },   // red brick
  { wall: '#c8a870', dark: '#8e7248', trim: '#ece2c6' },   // London stock brick
  { wall: '#6479a6', dark: '#46567a', trim: '#d8d2c0' },   // blue engineering brick
  { wall: '#e8e1cd', dark: '#a39b88', trim: '#6f685b' },   // limewash
  { wall: '#8c6248', dark: '#58402f', trim: '#cdbf9f' },   // sooty brick
  { wall: '#4f8a68', dark: '#3a6a4e', trim: '#dcd8c8' },   // green-painted iron
];
const BRICK: Mat[] = [
  { wall: '#b0644c', dark: '#7e4332', trim: '#e3d6b8' },
  { wall: '#c27a55', dark: '#8a5236', trim: '#e8dcc0' },
  { wall: '#c8a870', dark: '#8e7248', trim: '#ece2c6' },
  { wall: '#b39a68', dark: '#7d6944', trim: '#e6dcc0' },
  { wall: '#8c6248', dark: '#58402f', trim: '#cdbf9f' },
  { wall: '#9c5a48', dark: '#6b3a2e', trim: '#dccfb2' },
];
// Roofs: two sooty-clay tones instead of terracotta. The first draft's '#b4593f' and '#a05a3e' sat within CIE76 ΔE 6.8 and 14.1 of the residential TERRA roofs, so colour alone could no longer tell an industrial roof from a house; these two are ΔE ≥ 23 away.
const ROOF = ['#4f5a64', '#7a4a3c', '#3f4a56', '#6a4034', '#8f979a', '#6f9b8a'];
const C = { glass: '#2c3f56', door: '#34302b', doorGreen: '#2f5242', timber: '#3d3a34', oak: '#7a5a3c', stone: '#9b968a', stoneLight: '#b8b3a6',
  iron: '#4b5158', ironLight: '#7d868d', coal: '#2d2d30', sand: '#c9b27a', lumber: '#a07a4a', lumberLight: '#c19a62' };
const color = (c: string) => new THREE.Color(c);

class Pen {
  readonly a: IndustryCtx;
  constructor(a: IndustryCtx) { this.a = a; }
  get s() { return Math.min(this.a.w, this.a.d) >= 2 ? 1.3 : 1; }   // bigger parcels get slightly bigger landmarks
  X(u: number) { return this.a.x0 + u * this.a.w; }
  Z(v: number) { return this.a.z0 + v * this.a.d; }
  Y(h: number) { return this.a.y0 + h; }
  pt(u: number, h: number, v: number): V3 { return [this.X(u), this.Y(h), this.Z(v)]; }
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
  // Bounded roof: all points stay inside the supplied rectangle.
  gable(u0: number, u1: number, v0: number, v1: number, h: number, rise: number, roof: string, wall: string, along: 'x' | 'z' = 'x',
    g: Geo = this.a.O, wg: Geo = this.a.W, ends: 'both' | 'front' = 'both') {
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
      if (ends === 'both') wg.triangle(this.pt(u0, h, v0), this.pt(u1, h, v0), this.pt(u, yr, v0), [0, 0, -1], color(wall));
    }
  }
  // Mono-pitch roof along z; side infill triangles and a strip closing the high edge, all in wall colour.
  // The caller built walls up to min(hBack, hFront). `strip` is false when the caller already raised the high-edge wall.
  lean(u0: number, u1: number, v0: number, v1: number, hBack: number, hFront: number, roof: string, wall: string, strip = true, g: Geo = this.a.O, wg: Geo = this.a.W) {
    const lo = Math.min(hBack, hFront), hi = Math.max(hBack, hFront), backHigh = hBack > hFront, up = backHigh ? 1 : -1;
    g.slope(this.pt(u0, hFront, v1), this.pt(u1, hFront, v1), this.pt(u1, hBack, v0), this.pt(u0, hBack, v0), [0, 1, up], color(roof));
    const tip = (u: number): V3 => backHigh ? this.pt(u, hi, v0) : this.pt(u, hi, v1);
    for (const [u, nx] of [[u0, -1], [u1, 1]] as [number, number][])
      wg.triangle(this.pt(u, lo, v0), this.pt(u, lo, v1), tip(u), [nx, 0, 0], color(wall));
    if (strip) {
      const vh = backHigh ? v0 : v1, nz = backHigh ? -1 : 1;
      wg.quad(this.pt(u0, lo, vh), this.pt(u1, lo, vh), this.pt(u1, hi, vh), this.pt(u0, hi, vh), [0, 0, nz], color(wall));
    }
  }
  // Flat cap over a roofless box (annex, plinth): two triangles, drawn outside any weathering tag.
  cap(u0: number, u1: number, v0: number, v1: number, h: number, c: string, g: Geo = this.a.O) {
    g.quad(this.pt(u0, h, v0), this.pt(u1, h, v0), this.pt(u1, h, v1), this.pt(u0, h, v1), [0, 1, 0], color(c));
  }
  ccap(u: number, v: number, ax: number, az: number, h: number, c: string, g: Geo = this.a.O) {
    this.cap(u - ax / this.a.w, u + ax / this.a.w, v - az / this.a.d, v + az / this.a.d, h, c, g);
  }
  hip(u0: number, u1: number, v0: number, v1: number, h: number, rise: number, roof: string) {
    this.a.O.hip(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), this.Y(h), rise, color(roof));
  }
  pyr(g: Geo, u: number, v: number, ax: number, az: number, h: number, rise: number, c: string) {
    const cx = this.X(u), cz = this.Z(v), top: V3 = [cx, this.Y(h + rise), cz];
    const cs: V3[] = [[cx - ax, this.Y(h), cz - az], [cx + ax, this.Y(h), cz - az], [cx + ax, this.Y(h), cz + az], [cx - ax, this.Y(h), cz + az]];
    for (let i = 0; i < 4; i++) {
      const a = cs[i], b = cs[(i + 1) % 4];
      g.triangle(a, b, top, [(a[0] + b[0]) / 2 - cx, .5, (a[2] + b[2]) / 2 - cz], color(c));
    }
  }
  // Open frustum (no bottom). Radii are absolute cells; seg=4 gives a square chimney, 6 or 8 a round-ish one.
  frustum(g: Geo, u: number, v: number, rb: number, rt: number, h0: number, h1: number, seg: number, c: string, cap = false, rot = 0) {
    const cx = this.X(u), cz = this.Z(v), col = color(c), k = Math.PI * 2 / seg;
    const ring = (r: number, h: number, i: number): V3 => [cx + Math.cos(rot + i * k) * r, this.Y(h), cz + Math.sin(rot + i * k) * r];
    for (let i = 0; i < seg; i++) {
      const am = rot + (i + .5) * k;
      g.slope(ring(rb, h0, i), ring(rb, h0, i + 1), ring(rt, h1, i + 1), ring(rt, h1, i), [Math.cos(am), 0, Math.sin(am)], col);
      if (cap) g.triangle([cx, this.Y(h1), cz], ring(rt, h1, i), ring(rt, h1, i + 1), [0, 1, 0], col);
    }
  }
  // Front-plane decal (normal +z) at plan depth v.
  face(vFixed: number, u0: number, u1: number, h0: number, h1: number, c: string, out = .003, g: Geo = this.a.D) {
    const z = this.Z(vFixed) + out;
    g.quad([this.X(u0), this.Y(h0), z], [this.X(u1), this.Y(h0), z], [this.X(u1), this.Y(h1), z], [this.X(u0), this.Y(h1), z], [0, 0, 1], color(c));
  }
  door(vFixed: number, u: number, width: number, h: number, c = C.door, trim = '#d9ccb0') {
    this.face(vFixed, u - width / 2, u + width / 2, 0, h, c);
    this.face(vFixed, u - width / 2 - .012, u + width / 2 + .012, h, h + .035, trim, .004);
  }
  // A parked lorry along the street: body and cab, two boxes in the non-shadow arena. `ax` is the body centre measured
  // in cells from the block's left edge, so it stays inside 1-wide parcels; the palette picks the body colour.
  lorry(ax: number, v: number) {
    const { D } = this.a, x = this.a.x0 + ax, z = this.Z(v), body = ['#8b8f93', '#6f8f8f', '#a09070', '#7d6f8f', '#8f7f6f', '#7f8f6f'][Math.abs(this.a.pal) % 6];
    D.box(x - .12, z - .05, x + .08, z + .05, this.Y(.02), this.Y(.115), color(body), color('#b9bcc0'), null);
    D.box(x + .08, z - .05, x + .17, z + .05, this.Y(.02), this.Y(.095), color('#b5503f'), color('#d0705a'), null);
  }
  anchor(u: number, h: number, v: number) { return new THREE.Vector3(this.X(u), this.Y(h), this.Z(v)); }
}

// 1 shed → goods shed: low brick shed, shallow gable roof, a louvred lantern along the ridge, wagon doors, loading dock.
function goodsShed(p: Pen) {
  const { D } = p.a, m = p.mat(MIX), roof = p.roof(0), hw = Math.max(.27, p.a.wall), rr = .11, yr = hw + rr;
  p.wall(.06, .94, .14, .80, 0, hw, m.wall, p.win(WIN_STYLE.grid, hw * 1.05, 2));
  p.gable(.05, .95, .13, .81, hw, rr, roof, m.wall, 'x');
  p.box(D, .26, .74, .38, .56, yr - .045, yr + .09, m.trim, null);              // louvred lantern body, embedded in the ridge
  p.gable(.25, .75, .37, .57, yr + .09, .045, p.roof(3), m.trim, 'x', D, D);    // its own, contrasting roof
  for (const u of [.30, .70]) p.door(.80, u, .16, hw * .78);
  p.box(D, .04, .96, .80, .90, 0, .045, C.stone, C.stoneLight);               // loading dock
  p.box(D, .12, .18, .22, .29, hw - .01, yr + .13, m.dark, '#3a3a3a');         // stove chimney
  p.box(D, .70, .80, .83, .89, .045, .10, C.lumber, C.lumberLight);            // crate on the dock
  p.lorry(.60, .95);
  return p.anchor(.5, yr, .47);
}

// 1 workshop → loft-hoist workshop: two storeys, a small gable breaking the front roof, a hoist beam, taking-in door.
function loftWorkshop(p: Pen) {
  const { D } = p.a, m = p.mat(MIX), roof = p.roof(1), hw = Math.max(.40, p.a.wall), rr = .15, vf = .84;
  p.wall(.10, .90, .12, vf, 0, hw, m.wall, p.win(WIN_STYLE.arch, hw / 2, 2.4));
  p.gable(.09, .91, .11, vf + .01, hw, rr, roof, m.wall, 'x');
  // The hoist gablet continues the front wall plane up through the roof slope.
  p.wall(.34, .66, .72, vf, hw - .01, hw + .14, m.wall);
  p.gable(.33, .67, .72, vf + .01, hw + .14, .09, p.roof(4), m.wall, 'z', p.a.O, p.a.W);
  p.box(D, .48, .52, vf, vf + .13, hw + .19, hw + .215, C.timber);             // hoist beam
  p.face(vf, .43, .57, hw * .55, hw + .10, C.door);                            // loft taking-in door
  p.door(vf, .22, .12, hw * .55);
  p.box(D, .74, .83, .28, .37, hw - .01, hw + rr + .16, m.dark, '#3a3a3a');    // chimney
  return p.anchor(.5, hw + rr, .48);
}

// 1 sawShed → north-light weaving shed: every glazed face points the same way, plus a boiler house and slender chimney.
function northLight(p: Pen) {
  const { D, O } = p.a, m = p.mat(MIX), roof = p.roof(2), hw = Math.max(.27, p.a.wall * .9), s = p.s;
  p.wall(.04, .96, .10, .74, 0, hw, m.wall, p.win(WIN_STYLE.punch, hw, 2));
  O.saw(p.X(.04), p.Z(.10), p.X(.96), p.Z(.74), p.Y(hw), .105 * s, 2, false, color(roof), color('#6d8ca0'));
  p.wall(.04, .26, .74, .94, 0, hw * .8, m.dark, p.win(WIN_STYLE.arch, hw * .8, 2));   // boiler house
  p.cap(.04, .26, .74, .94, hw * .8, C.iron);
  p.frustum(O, .15, .84, .045, .03, hw * .8 - .02, hw * .8 + .78 * s, 6, C.iron);
  p.cbox(D, .15, .84, .042, .042, hw * .8 + .78 * s - .02, hw * .8 + .78 * s + .035, m.dark, '#3a3a3a');
  p.door(.94, .15, .10, hw * .55);
  return p.anchor(.5, hw + .105 * s, .42);
}

// 1 yard → timber and coal yard: open lean-to on posts (a real covered space), heaps, timber stacks, weighbridge office.
function timberYard(p: Pen) {
  const { D, O, W } = p.a, m = p.mat(MIX), hb = Math.max(.30, p.a.wall * 1.25), s = p.s;
  p.wall(.08, .92, .08, .13, 0, hb + .05, m.wall);                             // back wall, up to the high roof edge
  p.lean(.08, .92, .08, .40, hb + .05, hb - .07, p.roof(3), m.wall, false);     // lean-to roof, high at the back
  for (const u of [.11, .50, .89]) p.cbox(D, u, .38, .016, .016, 0, hb - .06, C.timber, C.timber);   // posts, closed on top
  p.box(D, .18, .46, .16, .30, 0, .13, C.lumber, null);                        // stack kept dry under the roof (its top is never seen)
  p.box(D, .12, .34, .56, .72, 0, .11, C.lumber, C.lumberLight);               // open-air timber stack
  p.pyr(D, .66, .64, .11 * s, .11 * s, 0, .13 * s, C.coal);                    // coal heap
  p.pyr(D, .84, .80, .09 * s, .09 * s, 0, .10 * s, C.sand);                    // sand heap
  p.wall(.60, .80, .14, .30, 0, .20, m.dark, null);                            // weighbridge office
  p.pyr(O, .70, .22, .12, .10, .20, .09, '#4a4540');                           // office roof
  void O; void W;
  return p.anchor(.5, hb, .22);
}

// 2 factory → brick factory: three storeys of arched windows, a stair tower, and a lower boiler house with a chimney.
function brickFactory(p: Pen) {
  const { D, O } = p.a, m = p.mat(BRICK), roof = p.roof(4), hw = Math.max(.55, p.a.wall), rr = .12, s = p.s;
  p.wall(.04, .96, .04, .66, 0, hw, m.wall, p.win(WIN_STYLE.arch, hw / 3, 2.5));
  p.gable(.03, .97, .03, .67, hw, rr, roof, m.wall, 'x');
  p.cwall(.17, .70, .095 * s, .095 * s, 0, hw + .18, m.wall, p.win(WIN_STYLE.punch, (hw + .18) / 3, 2));   // stair tower
  p.cbox(D, .17, .70, .115 * s, .115 * s, hw + .18, hw + .225, m.trim, m.dark);                           // corbelled top
  const bh = Math.max(.24, hw * .42);
  p.wall(.50, .94, .66, .94, 0, bh, m.dark, p.win(WIN_STYLE.arch, bh, 2));                                 // boiler house
  p.lean(.50, .94, .66, .94, bh + .06, bh, C.iron, m.dark);
  p.frustum(O, .86, .80, .05, .034, bh, bh + .9 * s, 6, m.wall);
  p.cbox(D, .86, .80, .047, .047, bh + .9 * s - .02, bh + .9 * s + .03, m.dark, '#3a3a3a');
  p.door(.94, .60, .10, bh * .75);
  return p.anchor(.5, hw + rr, .35);
}

// 2 mill → cotton mill: long shallow block, many storeys, a pyramid-capped stair tower at one end, a roof cupola.
function cottonMill(p: Pen) {
  const { D } = p.a, m = p.mat(BRICK), roof = p.roof(5), hw = Math.max(.52, p.a.wall), rr = .10, s = p.s;
  p.wall(.03, .97, .14, .62, 0, hw, m.wall, p.win(WIN_STYLE.punch, hw / 4, 3));
  p.gable(.02, .98, .13, .63, hw, rr, roof, m.wall, 'x');
  p.cwall(.88, .66, .08 * s, .10 * s, 0, hw + .15, m.wall, p.win(WIN_STYLE.arch, (hw + .15) / 3, 2));       // stair tower
  p.pyr(p.a.O, .88, .66, .10 * s, .115 * s, hw + .15, .20 * s, '#5a4a44');
  p.cbox(D, .50, .38, .055 * s, .055 * s, hw + rr - .045, hw + rr + .075, m.trim, null);                    // cupola
  p.pyr(D, .50, .38, .075 * s, .075 * s, hw + rr + .075, .05 * s, '#4a4540');
  p.wall(.03, .30, .62, .86, 0, hw * .5, m.dark, p.win(WIN_STYLE.punch, hw * .5, 2));                      // counting house
  p.lean(.03, .30, .62, .86, hw * .5 + .05, hw * .5, '#5d6872', m.dark);
  p.door(.86, .16, .10, hw * .38);
  p.lorry(.62, .95);
  return p.anchor(.5, hw + rr, .38);
}

// 2 warehouse → canal warehouse: low and long, blank loading floor, a projecting hoist hood and wall crane.
function dockWarehouse(p: Pen) {
  const { D, O } = p.a, m = p.mat(BRICK), roof = p.roof(0), hw = Math.max(.40, p.a.wall * 1.2), rr = .10, yr = hw + rr;
  p.wall(.02, .98, .12, .80, 0, hw, m.wall, p.win(WIN_STYLE.grid, hw * .5, 2, hw * .5));
  p.gable(.01, .99, .11, .81, hw, rr, roof, m.wall, 'x');
  // Hoist hood: a timber canopy on two posts over the central loading door, plus a crane jib at the ridge.
  O.slope(p.pt(.32, hw * .62, .80), p.pt(.68, hw * .62, .80), p.pt(.68, hw * .50, .95), p.pt(.32, hw * .50, .95), [0, 1, 1], color(C.oak));
  for (const u of [.34, .66]) p.cbox(D, u, .93, .014, .014, 0, hw * .50, C.timber, C.timber);
  p.box(D, .485, .515, .80, .98, yr + .005, yr + .04, C.timber);
  for (const u of [.16, .50, .84]) p.door(.80, u, .17, hw * .46, C.doorGreen);
  p.box(D, .02, .98, .80, .87, 0, .04, C.stone, C.stoneLight);
  return p.anchor(.5, yr, .46);
}

// 2 stack → boiler house with a tall tapering octagonal chimney, brick banding and a corbelled cap.
function boilerHouse(p: Pen) {
  const { D, O } = p.a, m = p.mat(BRICK), hw = Math.max(.36, p.a.wall * .8), s = p.s, top = 1.5 * s;
  p.wall(.06, .60, .22, .82, 0, hw, m.wall, p.win(WIN_STYLE.arch, hw, 2));
  p.lean(.06, .60, .22, .82, hw + .10, hw, p.roof(1), m.wall);
  p.door(.82, .33, .11, hw * .7);
  p.cwall(.80, .52, .095 * s, .095 * s, 0, .16, m.dark);                                                    // plinth
  p.ccap(.80, .52, .095 * s, .095 * s, .16, m.trim);
  p.frustum(O, .80, .52, .088 * s, .047 * s, .15, top, 8, m.wall, false, Math.PI / 8);
  p.cbox(D, .80, .52, .05 * s, .05 * s, top * .62, top * .62 + .035, m.trim, m.dark);                      // contrast band
  p.cbox(D, .80, .52, .068 * s, .068 * s, top - .005, top + .045, m.trim, m.dark);                         // corbelled cap
  p.box(D, .08, .26, .84, .94, 0, .09, C.coal, '#3a3a3e');                                                 // coal bunker
  p.lorry(.60, .95);
  return p.anchor(.33, hw + .10, .52);
}

// 3 heavy → engine works: three parallel gables (ridge-and-furrow), a lantern, and an open gantry-crane yard.
function engineWorks(p: Pen) {
  const { D, O } = p.a, m = p.mat(BRICK), hw = Math.max(.62, p.a.wall * .8), rr = .23, s = p.s, roof = p.roof(2);
  p.wall(.04, .96, .06, .66, 0, hw, m.wall, p.win(WIN_STYLE.arch, hw / 2, 2.2));
  for (const [a, b] of [[.04, .347], [.347, .653], [.653, .96]]) p.gable(a, b, .06, .66, hw, rr, roof, m.wall, 'z');
  p.box(D, .44, .56, .26, .44, hw + rr - .02, hw + rr + .06, m.trim, null);                                 // clerestory lantern
  p.gable(.43, .57, .25, .45, hw + rr + .06, .03, '#4a4540', m.trim, 'x', D, D);
  p.wall(.62, .96, .66, .92, 0, hw * .45, m.dark, p.win(WIN_STYLE.grid, hw * .45, 2));                       // side annex
  p.cap(.62, .96, .66, .92, hw * .45, C.iron);
  p.frustum(O, .12, .20, .05, .035, hw - .02, hw + .85 * s, 6, C.iron, true);
  // Gantry: two pairs of posts and a rail beam with a trolley; the space under it stays open.
  for (const u of [.12, .56]) for (const v of [.80, .90]) p.cbox(D, u, v, .012, .012, 0, .42 * s, C.ironLight, C.ironLight);
  p.box(D, .10, .58, .78, .92, .42 * s, .455 * s, C.iron);
  p.box(D, .30, .38, .81, .89, .385 * s, .42 * s, '#c9a040');
  return p.anchor(.5, hw + rr, .35);
}

// 3 mill3 → Italianate steam mill: tall brick block, pyramid-capped tower, and a square corbelled chimney.
function steamMill(p: Pen) {
  const { D, O } = p.a, m = p.mat(BRICK), roof = p.roof(3), hw = Math.max(.70, p.a.wall), rr = .10, s = p.s;
  p.wall(.05, .95, .12, .62, 0, hw, m.wall, p.win(WIN_STYLE.arch, hw / 5, 2.6));
  p.gable(.04, .96, .11, .63, hw, rr, roof, m.wall, 'x');
  p.cwall(.50, .66, .10 * s, .11 * s, 0, hw + .26, m.wall, p.win(WIN_STYLE.arch, (hw + .26) / 4, 2));        // tower
  p.cbox(D, .50, .66, .125 * s, .135 * s, hw + .26, hw + .30, m.trim, m.dark);                               // overhanging cornice
  p.pyr(O, .50, .66, .115 * s, .125 * s, hw + .30, .24 * s, '#4a4540');
  const top = 1.75 * s;
  p.cwall(.88, .28, .07 * s, .07 * s, 0, .20, m.dark);                                                       // plinth
  p.ccap(.88, .28, .07 * s, .07 * s, .20, m.trim);
  p.frustum(O, .88, .28, .062 * s, .038 * s, .19, top, 4, m.wall, false, Math.PI / 4);                      // square shaft
  p.cbox(D, .88, .28, .058 * s, .058 * s, top - .01, top + .05, m.trim, m.dark);                             // corbelled cap
  p.cbox(D, .88, .28, .048 * s, .048 * s, top * .55, top * .55 + .03, m.trim, m.dark);
  p.wall(.05, .34, .62, .84, 0, hw * .45, m.dark, p.win(WIN_STYLE.punch, hw * .45, 2));                      // engine house
  p.lean(.05, .34, .62, .84, hw * .45 + .06, hw * .45, '#5d6872', m.dark);
  p.lorry(.62, .95);
  return p.anchor(.5, hw + rr, .37);
}

// 3 tankfarm → gasworks: a gasholder inside its open guide frame (columns and top ring) beside a retort house.
function gasworks(p: Pen) {
  const { D, O } = p.a, m = p.mat(BRICK), s = p.s, r = .25 * Math.min(p.a.w, p.a.d), hh = .75 * s, hw = Math.max(.34, p.a.wall * .9);
  const tone = ['#6f8f8f', '#7d8a8f', '#8a6a52', '#6f7f6f', '#7d7088', '#8f8a78'][Math.abs(p.a.pal) % 6];
  p.frustum(O, .62, .46, r, r * .985, 0, hh, 10, tone, true);                                                 // the holder drum
  const k = 8, cx = p.X(.62), cz = p.Z(.46), ring = r + .055;
  for (let i = 0; i < k; i++) {
    const a = i * Math.PI * 2 / k + Math.PI / 8;
    p.frustum(D, (cx + Math.cos(a) * ring - p.a.x0) / p.a.w, (cz + Math.sin(a) * ring - p.a.z0) / p.a.d, .014, .014, 0, hh + .14, 3, C.iron, true);
  }
  for (let i = 0; i < k; i++) {                                                                               // flat top ring between columns
    const a0 = i * Math.PI * 2 / k + Math.PI / 8, a1 = (i + 1) * Math.PI * 2 / k + Math.PI / 8, y = p.Y(hh + .14), q = (rr: number, a: number): V3 => [cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr];
    D.quad(q(ring - .012, a0), q(ring + .012, a0), q(ring + .012, a1), q(ring - .012, a1), [0, 1, 0], color(C.iron));
  }
  p.wall(.06, .34, .16, .74, 0, hw, m.wall, p.win(WIN_STYLE.punch, hw, 2));                                  // retort house
  p.gable(.05, .35, .15, .75, hw, .12, p.roof(2), m.wall, 'z');
  p.frustum(O, .22, .84, .04, .028, 0, hw + 1.0 * s, 6, m.dark, true);
  return p.anchor(.20, hw + .12, .45);
}

// 3 chimneyHall → Potteries bottle kilns: two belly-and-neck brick ovens beside a long firing hall.
function bottleKilns(p: Pen) {
  const { O } = p.a, m = p.mat(BRICK), hw = Math.max(.34, p.a.wall * .5), s = p.s, k = 6;
  p.wall(.08, .92, .56, .90, 0, hw, m.wall, p.win(WIN_STYLE.grid, hw, 2));
  p.gable(.07, .93, .55, .91, hw, .14, p.roof(5), m.wall, 'x');
  for (const [u, v, sc] of [[.27, .27, 1], [.72, .31, .85]] as [number, number, number][]) {
    const r0 = .20 * sc * s, hk = 1.25 * sc * s;
    p.frustum(O, u, v, r0, r0 * 1.18, 0, hk * .30, k, m.wall);                                                // belly
    p.frustum(O, u, v, r0 * 1.18, r0 * .62, hk * .30, hk * .64, k, m.wall);                                   // shoulder
    p.frustum(O, u, v, r0 * .62, r0 * .52, hk * .64, hk, k, m.dark, true);                                    // neck, capped
  }
  return p.anchor(.5, hw + .14, .73);
}

export function drawBritishIndustry(a: IndustryCtx, model: IndustryModel): THREE.Vector3 {
  const p = new Pen(a);
  switch (model) {
    case 'goodsShed': return goodsShed(p);
    case 'loftWorkshop': return loftWorkshop(p);
    case 'northLight': return northLight(p);
    case 'timberYard': return timberYard(p);
    case 'brickFactory': return brickFactory(p);
    case 'cottonMill': return cottonMill(p);
    case 'dockWarehouse': return dockWarehouse(p);
    case 'boilerHouse': return boilerHouse(p);
    case 'engineWorks': return engineWorks(p);
    case 'steamMill': return steamMill(p);
    case 'gasworks': return gasworks(p);
    case 'bottleKilns': return bottleKilns(p);
  }
}
