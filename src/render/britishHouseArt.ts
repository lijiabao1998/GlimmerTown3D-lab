// D065: eight parcel-scaled British detached houses (five villas, three modern houses). They are free adaptations of
// building *types*, not reconstructions of any one house. Geometry only: callers own the three arenas, picking IDs and
// world state. Windows come from the existing window atlas (no extra triangles, no new texture); small details go to
// the non-shadow-casting arena D. Plan coordinates u (x) and v (z) are 0..1 over the parcel, v=1 is the street front;
// heights are absolute cells above y0. Every part stays inside [.12, .86] of the parcel: the old yard trees stay where
// they were (front edge, one corner) whichever way the house turns.
import * as THREE from 'three';
import type { Geo } from './scene.ts';
import { WIN_STYLE } from './windows.ts';
import type { HouseModel } from '../content/britishHouses.ts';

export interface HouseCtx {
  W: Geo; O: Geo; D: Geo;
  x0: number; z0: number; w: number; d: number; y0: number;
  pal: number;       // colourway selector 0..5 (block variant mixed with a position hash; render-only)
  weather?: boolean;
}
type V3 = [number, number, number];
interface Mat { wall: string; dark: string; trim: string }

const BRICK: Mat[] = [
  { wall: '#b0644c', dark: '#7e4332', trim: '#efe6cf' },   // red brick
  { wall: '#c8a870', dark: '#8e7248', trim: '#f1e8d0' },   // London stock brick
  { wall: '#9c5a48', dark: '#6b3a2e', trim: '#e6dabf' },   // dark red brick
  { wall: '#dcc9a6', dark: '#a8956f', trim: '#fbf5e4' },   // cream stucco
  { wall: '#9fb0a2', dark: '#72867a', trim: '#e3ebe2' },   // grey-green stucco
  { wall: '#f1eee4', dark: '#bdb9ac', trim: '#fffdf5' },   // white stucco
];
const SLATE = ['#5d6a73', '#4a5560', '#6b7078', '#56626b', '#4f5a63', '#656d75'];
const TILE = ['#b05a3c', '#9a4c34', '#c26b48', '#a85a40', '#8e4a38', '#b86c4a'];
// Modern houses: render, brick and cladding tones (wall, dark, trim).
const RENDER: Mat[] = [
  { wall: '#f1eee4', dark: '#bdb9ac', trim: '#fffdf5' },   // white
  { wall: '#e6dcc4', dark: '#b3a98f', trim: '#f7f0dc' },   // cream
  { wall: '#d4d6d6', dark: '#a0a3a4', trim: '#eeefef' },   // pale grey
  { wall: '#c9d4dc', dark: '#97a2ab', trim: '#e6edf2' },   // pale blue-grey
  { wall: '#e0cdb0', dark: '#ad9b80', trim: '#f4e8d2' },   // buff
  { wall: '#ead4cc', dark: '#b8a29a', trim: '#f8ebe6' },   // pale rose
];
const CLAD = ['#8a6a4a', '#6f5a45', '#9b7d57', '#5f6b5a', '#7a6552', '#6b7580'];   // timber and tile cladding
const C = { glass: '#2c3f56', door: '#2f4a3c', ink: '#3a3631', hedge: '#4f7a45', path: '#cfc6b0', stone: '#e4dcc8' };
const color = (c: string) => new THREE.Color(c);

class Pen {
  readonly a: HouseCtx;
  constructor(a: HouseCtx) { this.a = a; }
  X(u: number) { return this.a.x0 + u * this.a.w; }
  Z(v: number) { return this.a.z0 + v * this.a.d; }
  Y(h: number) { return this.a.y0 + h; }
  pt(u: number, h: number, v: number): V3 { return [this.X(u), this.Y(h), this.Z(v)]; }
  mat(list: Mat[]): Mat { return list[Math.abs(this.a.pal) % list.length]; }
  win(style: number, floorH: number, perCell: number) { return { floorH, style, glass: color(C.glass), perCell }; }
  // Walls carry the window atlas and, on the core path, the weathering tag (wall-top height).
  wall(u0: number, u1: number, v0: number, v1: number, h0: number, h1: number, c: string, win: ReturnType<Pen['win']> | null = null) {
    const { W } = this.a, previous = W.tag;
    if (this.a.weather) W.tag = this.Y(h1);
    try { W.box(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), this.Y(h0), this.Y(h1), color(c), null, win); } finally { W.tag = previous; }
  }
  box(g: Geo, u0: number, u1: number, v0: number, v1: number, h0: number, h1: number, c: string, top: string | null = c) {
    g.box(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), this.Y(h0), this.Y(h1), color(c), top ? color(top) : null, null);
  }
  // Flat cap over a roofless box: two triangles.
  cap(u0: number, u1: number, v0: number, v1: number, h: number, c: string, g: Geo = this.a.O) {
    g.quad(this.pt(u0, h, v0), this.pt(u1, h, v0), this.pt(u1, h, v1), this.pt(u0, h, v1), [0, 1, 0], color(c));
  }
  // Hip roof, ridge along x, both ends pulled in by half the depth (45 degrees): two slopes, two end triangles.
  hip(u0: number, u1: number, v0: number, v1: number, h: number, rise: number, c: string) {
    const { O } = this.a, vm = (v0 + v1) / 2, yr = h + rise;
    const t = Math.min(((v1 - v0) * this.a.d) / 2 / this.a.w, (u1 - u0) / 2);
    const r0 = this.pt(u0 + t, yr, vm), r1 = this.pt(u1 - t, yr, vm);
    O.slope(this.pt(u0, h, v1), this.pt(u1, h, v1), r1, r0, [0, 1, 1], color(c));
    O.slope(this.pt(u0, h, v0), this.pt(u1, h, v0), r1, r0, [0, 1, -1], color(c));
    O.triangle(this.pt(u0, h, v0), this.pt(u0, h, v1), r0, [-1, .5, 0], color(c));
    O.triangle(this.pt(u1, h, v0), this.pt(u1, h, v1), r1, [1, .5, 0], color(c));
  }
  // Gable roof over a rectangle: two slopes (O) and two end triangles in the wall colour (W).
  gable(u0: number, u1: number, v0: number, v1: number, h: number, rise: number, c: string, wall: string, along: 'x' | 'z' = 'x') {
    const { O, W } = this.a, yr = h + rise;
    if (along === 'x') {
      const vm = (v0 + v1) / 2;
      O.slope(this.pt(u0, h, v1), this.pt(u1, h, v1), this.pt(u1, yr, vm), this.pt(u0, yr, vm), [0, 1, 1], color(c));
      O.slope(this.pt(u0, h, v0), this.pt(u1, h, v0), this.pt(u1, yr, vm), this.pt(u0, yr, vm), [0, 1, -1], color(c));
      W.triangle(this.pt(u0, h, v0), this.pt(u0, h, v1), this.pt(u0, yr, vm), [-1, 0, 0], color(wall));
      W.triangle(this.pt(u1, h, v0), this.pt(u1, h, v1), this.pt(u1, yr, vm), [1, 0, 0], color(wall));
    } else {
      const um = (u0 + u1) / 2;
      O.slope(this.pt(u0, h, v0), this.pt(u0, h, v1), this.pt(um, yr, v1), this.pt(um, yr, v0), [-1, 1, 0], color(c));
      O.slope(this.pt(u1, h, v0), this.pt(u1, h, v1), this.pt(um, yr, v1), this.pt(um, yr, v0), [1, 1, 0], color(c));
      W.triangle(this.pt(u0, h, v1), this.pt(u1, h, v1), this.pt(um, yr, v1), [0, 0, 1], color(wall));
      W.triangle(this.pt(u0, h, v0), this.pt(u1, h, v0), this.pt(um, yr, v0), [0, 0, -1], color(wall));
    }
  }
  // Chimney stack (shadowless D): a box with a lighter cap band.
  chimney(u: number, v: number, h0: number, h1: number, c: string, capC = C.stone, half = .03) {
    this.box(this.a.D, u - half, u + half, v - half * .85, v + half * .85, h0, h1, c, capC);
  }
  // Front-plane decal (normal +z) at plan depth v.
  face(v: number, u0: number, u1: number, h0: number, h1: number, c: string, out = .004, g: Geo = this.a.D) {
    const z = this.Z(v) + out;
    g.quad([this.X(u0), this.Y(h0), z], [this.X(u1), this.Y(h0), z], [this.X(u1), this.Y(h1), z], [this.X(u0), this.Y(h1), z], [0, 0, 1], color(c));
  }
  anchor(u: number, h: number, v: number) { return new THREE.Vector3(this.X(u), this.Y(h), this.Z(v)); }
}

// villa → Georgian box: square, symmetrical, hipped slate roof, a chimney at each end, a pedimented door in the middle.
function georgianBox(p: Pen) {
  const m = p.mat(BRICK), { D } = p.a, roof = SLATE[p.a.pal % SLATE.length];
  p.wall(.20, .80, .27, .75, 0, .42, m.wall, p.win(WIN_STYLE.punch, .21, 8));
  p.hip(.17, .83, .24, .78, .42, .19, roof);
  p.chimney(.31, .50, .44, .69, m.dark); p.chimney(.69, .50, .44, .69, m.dark);
  p.face(.75, .465, .535, 0, .17, C.door);
  p.face(.75, .445, .465, 0, .19, m.trim); p.face(.75, .535, .555, 0, .19, m.trim);
  D.triangle(p.pt(.44, .19, .754), p.pt(.56, .19, .754), p.pt(.50, .235, .754), [0, 0, 1], color(m.trim));
  p.box(D, .44, .56, .75, .79, 0, .025, C.path);
  p.face(.75, .20, .80, .205, .215, m.trim);
  D.quad(p.pt(.46, .004, .79), p.pt(.54, .004, .79), p.pt(.54, .004, .86), p.pt(.46, .004, .86), [0, 1, 0], color(C.path));
  p.box(D, .16, .43, .82, .85, 0, .05, C.hedge); p.box(D, .57, .84, .82, .85, 0, .05, C.hedge);
  return p.anchor(.5, .6, .5);
}


const STUCCO = [BRICK[3], BRICK[4], BRICK[5]];

// villa → Victorian Gothic villa: steep front gable, a gabled side wing, a bay window and tall chimneys; asymmetrical.
function gothicVilla(p: Pen) {
  const m = p.mat(BRICK), { D } = p.a, roof = SLATE[(p.a.pal + 1) % SLATE.length];
  p.wall(.16, .52, .28, .78, 0, .40, m.wall, p.win(WIN_STYLE.arch, .20, 6));          // main block, gable to the street
  p.gable(.13, .55, .25, .81, .40, .30, roof, m.wall, 'z');
  p.wall(.50, .82, .30, .58, 0, .34, m.wall, p.win(WIN_STYLE.arch, .17, 6));          // side wing, ridge across
  p.gable(.47, .85, .27, .61, .34, .19, roof, m.wall, 'x');
  p.wall(.18, .34, .78, .84, 0, .20, m.wall, p.win(WIN_STYLE.punch, .20, 8));         // bay window
  p.cap(.17, .35, .77, .85, .20, m.trim);
  p.chimney(.30, .38, .44, .80, m.dark, m.trim, .032);
  p.chimney(.74, .46, .38, .60, m.dark, m.trim, .03);
  p.face(.78, .38, .46, 0, .15, C.door); p.face(.78, .365, .38, 0, .17, m.trim); p.face(.78, .46, .475, 0, .17, m.trim);
  D.slope(p.pt(.36, .20, .78), p.pt(.485, .20, .78), p.pt(.485, .15, .83), p.pt(.36, .15, .83), [0, 1, 1], color(roof));      // porch hood
  p.face(.78, .30, .38, .46, .58, m.trim, .004); p.face(.78, .315, .365, .475, .565, C.glass, .006);                        // gable window
  p.face(.78, .16, .52, .195, .21, m.trim);                                                                                   // string course
  D.quad(p.pt(.40, .004, .80), p.pt(.46, .004, .80), p.pt(.46, .004, .86), p.pt(.40, .004, .86), [0, 1, 0], color(C.path));
  return p.anchor(.4, .6, .5);
}

// villa → Arts-and-Crafts house: a long low roof that sweeps down at the back, a ribbon of windows, buttresses and a fat chimney.
function craftsHouse(p: Pen) {
  const m = p.mat(BRICK), { O, W, D } = p.a, roof = TILE[p.a.pal % TILE.length], mat = [BRICK[3], BRICK[5], BRICK[1]][p.a.pal % 3];
  p.wall(.16, .84, .44, .72, 0, .31, mat.wall, p.win(WIN_STYLE.ribbon, .31, 3));
  p.wall(.16, .84, .28, .44, 0, .17, mat.wall);
  const u0 = .14, u1 = .86;
  O.slope(p.pt(u0, .30, .76), p.pt(u1, .30, .76), p.pt(u1, .58, .54), p.pt(u0, .58, .54), [0, 1, 1], color(roof));
  O.slope(p.pt(u0, .14, .24), p.pt(u1, .14, .24), p.pt(u1, .58, .54), p.pt(u0, .58, .54), [0, 1, -1], color(roof));
  W.triangle(p.pt(u0, .14, .24), p.pt(u0, .30, .76), p.pt(u0, .58, .54), [-1, 0, 0], color(mat.wall));
  W.triangle(p.pt(u1, .14, .24), p.pt(u1, .30, .76), p.pt(u1, .58, .54), [1, 0, 0], color(mat.wall));
  p.gable(.43, .63, .70, .84, .23, .15, roof, mat.wall, 'z');                                                       // porch gable over the door
  for (const u of [.455, .605]) { D.quad(p.pt(u - .012, 0, .82), p.pt(u + .012, 0, .82), p.pt(u + .012, .23, .82), p.pt(u - .012, .23, .82), [0, 0, 1], color(mat.dark)); D.quad(p.pt(u, 0, .808), p.pt(u, 0, .832), p.pt(u, .23, .832), p.pt(u, .23, .808), [1, 0, 0], color(mat.dark)); }
  p.chimney(.34, .54, .40, .74, m.dark, m.trim, .045);
  p.box(D, .25, .29, .72, .77, 0, .22, mat.dark, mat.trim); p.box(D, .71, .75, .72, .77, 0, .22, mat.dark, mat.trim);
  p.face(.72, .49, .57, 0, .15, C.door); p.face(.72, .475, .49, 0, .165, mat.trim); p.face(.72, .57, .585, 0, .165, mat.trim);
  D.quad(p.pt(.49, .004, .84), p.pt(.57, .004, .84), p.pt(.57, .004, .86), p.pt(.49, .004, .86), [0, 1, 0], color(C.path));
  return p.anchor(.5, .55, .5);
}

// villa → Italianate villa: stucco walls, a low hipped roof with deep eaves and a square campanile at the front corner.
function italianateVilla(p: Pen) {
  const m = STUCCO[p.a.pal % STUCCO.length], { D } = p.a, roof = TILE[(p.a.pal + 3) % TILE.length];
  p.wall(.22, .78, .34, .74, 0, .40, m.wall, p.win(WIN_STYLE.arch, .20, 7));
  p.hip(.17, .83, .29, .79, .40, .10, roof);
  p.wall(.20, .38, .62, .82, 0, .72, m.wall, p.win(WIN_STYLE.arch, .18, 6));            // campanile
  const O = p.a.O, cx = p.X(.29), cz = p.Z(.72), hx = .10, top: V3 = [cx, p.Y(.82), cz], yb = p.Y(.72);
  const cs: V3[] = [[cx - hx, yb, cz - hx], [cx + hx, yb, cz - hx], [cx + hx, yb, cz + hx], [cx - hx, yb, cz + hx]];
  for (let i = 0; i < 4; i++) { const a = cs[i], b = cs[(i + 1) % 4]; O.triangle(a, b, top, [(a[0] + b[0]) / 2 - cx, .5, (a[2] + b[2]) / 2 - cz], color(roof)); }
  p.wall(.46, .68, .74, .80, 0, .17, m.wall, p.win(WIN_STYLE.arch, .17, 8));           // entrance bay
  p.cap(.45, .69, .73, .81, .17, m.trim);
  p.chimney(.64, .46, .42, .62, m.dark, m.trim, .03);
  p.face(.80, .54, .60, 0, .13, C.door); p.face(.80, .525, .54, 0, .145, m.trim); p.face(.80, .60, .615, 0, .145, m.trim);
  p.face(.74, .22, .78, .385, .40, m.trim, .004);
  D.quad(p.pt(.52, .004, .81), p.pt(.58, .004, .81), p.pt(.58, .004, .86), p.pt(.52, .004, .86), [0, 1, 0], color(C.path));
  p.box(D, .56, .84, .83, .86, 0, .05, C.hedge);
  return p.anchor(.3, .8, .7);
}

// villa → inter-war Tudorbethan: brick ground floor, jettied rendered upper floor with timber, a hipped roof with a front gablet, a side garage.
function tudorbethan(p: Pen) {
  const brick = BRICK[p.a.pal % 3], render = BRICK[5], { D } = p.a, roof = TILE[(p.a.pal + 2) % TILE.length], timber = '#3a2f26';
  p.wall(.14, .66, .34, .74, 0, .22, brick.wall, p.win(WIN_STYLE.punch, .22, 7));
  p.wall(.13, .67, .32, .77, .22, .44, render.wall, p.win(WIN_STYLE.grid, .22, 7));
  p.hip(.12, .70, .30, .80, .44, .18, roof);
  p.gable(.16, .40, .52, .82, .44, .16, roof, render.wall, 'z');
  p.wall(.66, .85, .48, .78, 0, .17, brick.wall);
  p.cap(.65, .86, .47, .79, .17, brick.dark);
  p.chimney(.148, .52, 0, .66, brick.dark, render.trim, .028);
  p.face(.82, .27, .29, .44, .60, timber, .004); p.face(.82, .18, .38, .50, .515, timber, .004);                 // gablet timber
  p.face(.82, .17, .185, .44, .50, timber, .004); p.face(.82, .375, .39, .44, .50, timber, .004);
  p.face(.77, .13, .67, .22, .235, timber, .004);                                                                   // jetty beam
  p.face(.74, .24, .32, 0, .15, C.door); p.face(.74, .225, .24, 0, .165, render.trim); p.face(.74, .32, .335, 0, .165, render.trim);
  D.slope(p.pt(.22, .20, .74), p.pt(.34, .20, .74), p.pt(.34, .165, .80), p.pt(.22, .165, .80), [0, 1, 1], color(roof));
  p.face(.78, .69, .82, 0, .13, C.ink);
  D.quad(p.pt(.25, .004, .80), p.pt(.31, .004, .80), p.pt(.31, .004, .86), p.pt(.25, .004, .86), [0, 1, 0], color(C.path));
  p.box(D, .40, .64, .83, .86, 0, .05, C.hedge);
  return p.anchor(.4, .6, .55);
}

// modern → white Modern Movement house: stacked white boxes, the upper one cantilevered, flat roofs, ribbon windows, a stair tower.
function whiteCubist(p: Pen) {
  const m = p.mat(RENDER), { O, D } = p.a;
  p.wall(.14, .66, .30, .78, 0, .20, m.wall, p.win(WIN_STYLE.ribbon, .20, 4));
  p.cap(.14, .66, .30, .78, .20, m.trim);
  p.wall(.30, .84, .34, .74, .20, .38, m.wall, p.win(WIN_STYLE.ribbon, .18, 4));
  p.cap(.30, .84, .34, .74, .38, m.trim);
  O.quad(p.pt(.66, .20, .34), p.pt(.84, .20, .34), p.pt(.84, .20, .74), p.pt(.66, .20, .74), [0, -1, 0], color(m.dark));   // underside of the cantilever
  p.box(D, .14, .24, .34, .46, .20, .50, m.trim, m.dark);                                                                   // stair tower
  p.face(.78, .46, .54, 0, .14, C.ink);
  return p.anchor(.5, .4, .5);
}

// modern → Span-type house: brick base, clad upper floor, a single-pitch roof rising to the back, a carport at the side.
function spanHouse(p: Pen) {
  const m = p.mat(RENDER), { O, W, D } = p.a, brick = BRICK[p.a.pal % 3], clad = CLAD[p.a.pal % CLAD.length];
  p.wall(.14, .64, .30, .74, 0, .17, brick.wall, p.win(WIN_STYLE.ribbon, .17, 3));
  p.wall(.14, .64, .30, .74, .17, .34, clad, p.win(WIN_STYLE.ribbon, .17, 3));
  O.slope(p.pt(.12, .34, .78), p.pt(.66, .34, .78), p.pt(.66, .50, .28), p.pt(.12, .50, .28), [0, 1, 1], color(m.dark));
  W.quad(p.pt(.14, .34, .30), p.pt(.64, .34, .30), p.pt(.64, .50, .30), p.pt(.14, .50, .30), [0, 0, -1], color(clad));
  W.triangle(p.pt(.14, .34, .30), p.pt(.14, .34, .74), p.pt(.14, .50, .30), [-1, 0, 0], color(clad));
  W.triangle(p.pt(.64, .34, .30), p.pt(.64, .34, .74), p.pt(.64, .50, .30), [1, 0, 0], color(clad));
  D.quad(p.pt(.64, .18, .36), p.pt(.86, .18, .36), p.pt(.86, .18, .72), p.pt(.64, .18, .72), [0, 1, 0], color(m.dark));      // carport roof
  D.quad(p.pt(.64, .16, .72), p.pt(.86, .16, .72), p.pt(.86, .18, .72), p.pt(.64, .18, .72), [0, 0, 1], color(m.trim));      // its fascia
  D.quad(p.pt(.85, 0, .715), p.pt(.85, 0, .725), p.pt(.85, .17, .725), p.pt(.85, .17, .715), [1, 0, 0], color(C.ink));        // slim post
  D.quad(p.pt(.845, 0, .72), p.pt(.855, 0, .72), p.pt(.855, .17, .72), p.pt(.845, .17, .72), [0, 0, 1], color(C.ink));
  p.face(.74, .30, .38, 0, .13, C.ink);
  return p.anchor(.4, .4, .5);
}

// modern → 1960s flat-roofed bungalow: one storey, a deep canopy on slim posts, a central chimney.
function canopyBungalow(p: Pen) {
  const m = p.mat(RENDER), brick = BRICK[p.a.pal % 3], { D } = p.a;
  p.wall(.14, .84, .34, .64, 0, .20, brick.wall, p.win(WIN_STYLE.ribbon, .20, 3.5));
  p.cap(.14, .84, .34, .64, .20, m.dark);
  p.box(D, .14, .84, .64, .82, .20, .22, m.trim, m.dark);                                                                   // canopy
  for (const u of [.20, .80]) { D.quad(p.pt(u - .012, 0, .80), p.pt(u + .012, 0, .80), p.pt(u + .012, .20, .80), p.pt(u - .012, .20, .80), [0, 0, 1], color(C.ink)); D.quad(p.pt(u, 0, .792), p.pt(u, 0, .808), p.pt(u, .20, .808), p.pt(u, .20, .792), [1, 0, 0], color(C.ink)); }
  p.chimney(.50, .46, .20, .40, brick.dark, m.trim, .035);
  p.face(.64, .46, .54, 0, .14, C.ink);
  return p.anchor(.5, .3, .5);
}
const MODELS: Record<HouseModel, (p: Pen) => THREE.Vector3> = {
  georgianBox, gothicVilla, craftsHouse, italianateVilla, tudorbethan, whiteCubist, spanHouse, canopyBungalow,
};

export function drawBritishHouse(a: HouseCtx, model: HouseModel): THREE.Vector3 {
  return MODELS[model](new Pen(a));
}
