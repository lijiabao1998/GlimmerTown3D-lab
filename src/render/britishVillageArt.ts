// D059: six original, parcel-scaled British exterior studies. George Inn's
// courtyard is a design adaptation, not a reconstruction of its surviving wing.
// Geometry only: callers own the three arenas, picking IDs and world state.
import * as THREE from 'three';
import type { Geo } from './scene.ts';

export type VillageModel = 'cottage' | 'rows' | 'inn' | 'church' | 'oast' | 'manor';
export interface VillageCtx {
  W: Geo; O: Geo; D: Geo;
  x0: number; z0: number; w: number; d: number; y0: number; H: number;
  weather?: boolean;
}
type V3 = [number, number, number];
type Side = 'front' | 'back' | 'left' | 'right';
const C = {
  honey: '#c9b98a', honeyLight: '#e4d5af', stone: '#c3bda7', stoneLight: '#e7dfca',
  slate: '#55616b', stoneRoof: '#858475', brick: '#a0684d', cream: '#eee3ca',
  timber: '#373c35', oak: '#695544', glass: '#314658', glassLight: '#64818a',
  door: '#31564a', brass: '#c0a05d', green: '#547654', dark: '#4b4c43',
};
const color = (c: string) => new THREE.Color(c);

class VillagePen {
  readonly a: VillageCtx;
  constructor(a: VillageCtx) { this.a = a; }
  X(u: number) { return this.a.x0 + u * this.a.w; }
  Z(v: number) { return this.a.z0 + v * this.a.d; }
  Y(y: number) { return this.a.y0 + y * this.a.H; }
  point(u: number, y: number, v: number): V3 { return [this.X(u), this.Y(y), this.Z(v)]; }
  box(g: Geo, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, c: string, top: string | null = c) {
    g.box(this.X(u0), this.Z(v0), this.X(u1), this.Z(v1), this.Y(y0), this.Y(y1), color(c), top ? color(top) : null, null);
  }
  mass(u0: number, u1: number, v0: number, v1: number, top: number, c: string, bottom = 0) {
    const { W } = this.a, previous = W.tag;
    if (this.a.weather) W.tag = this.Y(top);
    try {
      this.box(W, u0, u1, v0, v1, bottom, top, c, null);
    } finally {
      W.tag = previous;
    }
  }
  flat(u0: number, u1: number, v0: number, v1: number, y: number, c: string, g = this.a.D) {
    g.quad(this.point(u0, y, v0), this.point(u1, y, v0), this.point(u1, y, v1), this.point(u0, y, v1), [0, 1, 0], color(c));
  }
  // An explicitly bounded roof: Geo.gable's fixed world-space overhang is
  // unsuitable for thin parcels, so all six points stay in the supplied lot.
  roof(u0: number, u1: number, v0: number, v1: number, y: number, rise: number, c: string, wall: string, along: 'x' | 'z' = 'x') {
    const { W, O } = this.a, yr = y + rise;
    if (along === 'x') {
      const v = (v0 + v1) / 2;
      O.slope(this.point(u0, y, v1), this.point(u1, y, v1), this.point(u1, yr, v), this.point(u0, yr, v), [0, 1, 1], color(c));
      O.slope(this.point(u0, y, v0), this.point(u1, y, v0), this.point(u1, yr, v), this.point(u0, yr, v), [0, 1, -1], color(c));
      W.triangle(this.point(u0, y, v0), this.point(u0, y, v1), this.point(u0, yr, v), [-1, 0, 0], color(wall));
      W.triangle(this.point(u1, y, v0), this.point(u1, y, v1), this.point(u1, yr, v), [1, 0, 0], color(wall));
    } else {
      const u = (u0 + u1) / 2;
      O.slope(this.point(u0, y, v0), this.point(u0, y, v1), this.point(u, yr, v1), this.point(u, yr, v0), [-1, 1, 0], color(c));
      O.slope(this.point(u1, y, v0), this.point(u1, y, v1), this.point(u, yr, v1), this.point(u, yr, v0), [1, 1, 0], color(c));
      W.triangle(this.point(u0, y, v0), this.point(u1, y, v0), this.point(u, yr, v0), [0, 0, -1], color(wall));
      W.triangle(this.point(u0, y, v1), this.point(u1, y, v1), this.point(u, yr, v1), [0, 0, 1], color(wall));
    }
  }
  face(side: Side, fixed: number, lo: number, hi: number, bottom: number, top: number, c: string, out = .002) {
    const f = this.facePoint(side, fixed, out), n: V3 = side === 'front' ? [0, 0, 1] : side === 'back' ? [0, 0, -1] : side === 'left' ? [-1, 0, 0] : [1, 0, 0];
    this.a.D.quad(f(lo, bottom), f(hi, bottom), f(hi, top), f(lo, top), n, color(c));
  }
  facePoint(side: Side, fixed: number, out: number) {
    return (t: number, y: number): V3 => side === 'front' ? this.point(t, y, fixed + out)
      : side === 'back' ? this.point(t, y, fixed - out)
      : side === 'left' ? this.point(fixed - out, y, t) : this.point(fixed + out, y, t);
  }
  window(side: Side, fixed: number, mid: number, bottom: number, width: number, height: number, trim = C.stoneLight, cross = true) {
    const t = Math.min(width * .12, height * .09, .014), lo = mid - width / 2, hi = mid + width / 2;
    this.face(side, fixed, lo, hi, bottom, bottom + height, trim);
    this.face(side, fixed, lo + t, hi - t, bottom + t, bottom + height - t, C.glass, .003);
    if (cross) {
      this.face(side, fixed, mid - t / 3, mid + t / 3, bottom + t, bottom + height - t, trim, .004);
      this.face(side, fixed, lo + t, hi - t, bottom + height * .51, bottom + height * .51 + t / 2, trim, .004);
    }
  }
  door(side: Side, fixed: number, mid: number, width: number, top: number, bottom = 0, c = C.door) {
    this.face(side, fixed, mid - width / 2 - .012, mid + width / 2 + .012, bottom, top + .015, C.stoneLight);
    this.face(side, fixed, mid - width / 2, mid + width / 2, bottom, top, c, .003);
    this.face(side, fixed, mid - width * .30, mid + width * .30, top - (top - bottom) * .22, top - (top - bottom) * .06, C.glassLight, .004);
  }
  beam(side: Side, fixed: number, t0: number, y0: number, t1: number, y1: number, width: number, c = C.timber) {
    const f = this.facePoint(side, fixed, .005), dx = t1 - t0, dy = y1 - y0, len = Math.hypot(dx, dy), tx = -dy * width / len / 2, ty = dx * width / len / 2;
    const n: V3 = side === 'front' ? [0, 0, 1] : side === 'back' ? [0, 0, -1] : side === 'left' ? [-1, 0, 0] : [1, 0, 0];
    this.a.D.quad(f(t0 + tx, y0 + ty), f(t1 + tx, y1 + ty), f(t1 - tx, y1 - ty), f(t0 - tx, y0 - ty), n, color(c));
  }
  chimney(u: number, v: number, bottom: number, top: number, c: string) {
    this.box(this.a.O, u - .035, u + .035, v - .03, v + .03, bottom, top - .06, c);
    this.box(this.a.D, u - .041, u + .041, v - .036, v + .036, top - .085, top - .055, C.stoneLight);
    for (const x of [u - .018, u + .018]) this.box(this.a.D, x - .010, x + .010, v - .010, v + .010, top - .055, top, C.brick, C.dark);
  }
  pointedWindow(side: Side, fixed: number, mid: number, bottom: number, width: number, height: number) {
    const f = this.facePoint(side, fixed, .004), n: V3 = side === 'front' ? [0, 0, 1] : side === 'left' ? [-1, 0, 0] : [1, 0, 0];
    const half = width / 2, shoulder = bottom + height * .66;
    this.face(side, fixed, mid - half - .009, mid + half + .009, bottom - .012, shoulder, C.stoneLight);
    this.a.D.triangle(f(mid - half - .009, shoulder), f(mid + half + .009, shoulder), f(mid, bottom + height + .014), n, color(C.stoneLight));
    this.face(side, fixed, mid - half + .009, mid + half - .009, bottom + .004, shoulder, C.glass, .005);
    const g = this.facePoint(side, fixed, .006);
    this.a.D.triangle(g(mid - half + .009, shoulder), g(mid + half - .009, shoulder), g(mid, bottom + height - .012), n, color(C.glass));
    this.face(side, fixed, mid - .004, mid + .004, bottom + .004, shoulder, C.stoneLight, .007);
  }
  // A genuine arch ring extruded between the already-solid gatehouse piers.
  // Stone jamb finishes replace duplicate boxes hidden inside those piers;
  // the centre is never filled with a dark rectangle or an invisible wall.
  archGate(u: number, half: number, v0: number, v1: number, spring: number, rise: number, thickness: number) {
    const { O } = this.a, left = u - half, right = u + half;
    this.face('right', left, v0, v1, 0, spring, C.honey, .001);
    this.face('left', right, v0, v1, 0, spring, C.honey, .001);
    for (let i = 0; i < 8; i++) {
      const aa = Math.PI - i * Math.PI / 8, bb = Math.PI - (i + 1) * Math.PI / 8;
      const p = (ang: number, outer: boolean, v: number): V3 => this.point(u + Math.cos(ang) * (half + (outer ? thickness : 0)), spring + Math.sin(ang) * (rise + (outer ? thickness : 0)), v);
      O.quad(p(aa, false, v1), p(bb, false, v1), p(bb, true, v1), p(aa, true, v1), [0, 0, 1], color(i % 2 ? C.honey : C.honeyLight));
      O.quad(p(aa, false, v0), p(bb, false, v0), p(bb, true, v0), p(aa, true, v0), [0, 0, -1], color(C.honey));
      const mid = (aa + bb) / 2;
      O.slope(p(aa, false, v0), p(bb, false, v0), p(bb, false, v1), p(aa, false, v1), [-Math.cos(mid), -Math.sin(mid), 0], color(C.dark));
      O.slope(p(aa, true, v0), p(bb, true, v0), p(bb, true, v1), p(aa, true, v1), [Math.cos(mid), Math.sin(mid), 0], color(C.honey));
    }
  }
}

function cottage(p: VillagePen) {
  const { D } = p.a;
  p.mass(.13, .59, .20, .78, .61, C.honey);
  p.roof(.115, .605, .185, .795, .61, .24, C.stoneRoof, C.honeyLight, 'z');
  p.mass(.56, .87, .36, .76, .46, C.honeyLight);
  p.roof(.545, .885, .345, .775, .46, .22, C.slate, C.honeyLight, 'x');
  p.mass(.34, .50, .755, .89, .33, C.honey);
  p.roof(.325, .515, .74, .905, .33, .16, C.stoneRoof, C.honeyLight, 'z');
  p.chimney(.24, .40, .695, .98, C.honey);
  p.chimney(.76, .50, .54, .83, C.honeyLight);
  p.door('front', .89, .42, .084, .28);
  for (const u of [.23, .53]) p.window('front', .78, u, .19, .12, .18);
  p.window('front', .78, .36, .47, .125, .12);
  p.window('front', .76, .71, .17, .13, .18);
  for (const v of [.32, .59]) p.window('left', .13, v, .22, .13, .18);
  p.window('right', .87, .57, .19, .13, .16);
  p.flat(.385, .455, .90, .985, .008, C.stoneLight);
  p.box(D, .11, .32, .92, .945, 0, .065, C.green, '#729067');
  p.box(D, .57, .90, .91, .935, 0, .060, C.green, '#729067');
  for (const u of [.18, .25, .67, .77]) p.box(D, u - .022, u + .022, .885, .91, .008, .029, '#997c63', '#c98788');
  // Occasional quoins give the stone house structure without individual bricks.
  for (const y of [.12, .28, .44]) for (const u of [.14, .57]) p.face('front', .78, u - .012, u + .025, y, y + .035, C.honeyLight);
  return new THREE.Vector3(p.X(.36), p.Y(.85), p.Z(.49));
}

function rows(p: VillagePen) {
  const { D, O } = p.a, n = Math.max(2, Math.min(4, Math.round(p.a.w / .6))), gap = .006, unit = .84 / n;
  // Shops below, a recessed first-floor gallery, and projecting timber rooms
  // above it. At v=.70,y=.51 the gallery is clear across u=.12..88.
  p.mass(.08, .92, .13, .87, .34, '#bcad8d');
  p.mass(.08, .92, .13, .57, .66, C.cream, .34);
  p.box(O, .08, .92, .57, .89, .35, .38, C.oak);
  p.mass(.075, .925, .13, .91, .80, C.cream, .60);
  p.flat(.075, .925, .13, .91, .60, C.timber, O);
  for (let i = 0; i < n; i++) {
    const a = .08 + i * unit, b = a + unit, mid = (a + b) / 2;
    p.roof(a - (i ? 0 : .009), b + (i === n - 1 ? .009 : 0), .115, .925, .80, i % 2 ? .15 : .18, C.slate, C.cream, 'z');
    p.door('front', .87, a + unit * .21, unit * .18, .27, 0, i % 2 ? '#62443f' : C.door);
    p.window('front', .87, a + unit * .66, .09, unit * .48, .18, C.timber, false);
    p.face('front', .87, a + gap, b - gap, .295, .325, i % 2 ? '#735043' : '#36564b', .004);
    p.window('front', .91, mid, .655, unit * .43, .115, C.timber);
    p.window('front', .57, mid, .43, unit * .45, .14, C.oak, false);
    // The black posts sit in front of the recess, never across its inner path.
    p.box(D, a + .004, a + .022, .85, .873, .38, .605, C.timber);
    p.box(D, a + .026, b - .008, .854, .875, .408, .424, C.oak);
    for (const t of [.30, .56, .80]) p.box(D, a + unit * t - .004, a + unit * t + .004, .858, .872, .38, .423, C.oak);
    p.face('front', .91, a + .004, b - .004, .610, .631, C.timber, .006);
    p.face('front', .91, a + .004, b - .004, .78, .80, C.timber, .006);
    p.face('front', .91, a + .005, a + .022, .61, .80, C.timber, .006);
    p.face('front', .91, b - .022, b - .005, .61, .80, C.timber, .006);
    p.beam('front', .91, a + .027, .643, a + unit * .27, .765, .012);
    p.beam('front', .91, b - .027, .643, b - unit * .27, .765, .012);
    p.beam('front', .925, a + .017, .81, mid, .94, .015);
    p.beam('front', .925, b - .017, .81, mid, .94, .015);
  }
  p.box(D, .905, .922, .85, .873, .38, .605, C.timber);
  p.face('right', .925, .17, .89, .62, .64, C.timber);
  p.face('left', .075, .17, .89, .75, .77, C.timber);
  return new THREE.Vector3(p.X(.5), p.Y(.80), p.Z(.55));
}

function inn(p: VillagePen) {
  const { D } = p.a;
  // The original George Inn survives as a single wing; this U plan is an
  // explicitly free adaptation of its gallery and coaching-yard vocabulary.
  p.mass(.08, .92, .13, .35, .65, C.cream);
  p.roof(.065, .935, .115, .365, .65, .18, C.slate, C.cream);
  for (const [a, b] of [[.08, .28], [.72, .92]]) {
    p.mass(a, b, .34, .84, .59, C.cream);
    p.roof(a - .014, b + .014, .325, .855, .59, .19, C.slate, C.cream, 'z');
  }
  // Two upper end rooms and the real arch leave the entry route hollow.
  p.mass(.28, .36, .75, .85, .58, C.cream);
  p.mass(.64, .72, .75, .85, .58, C.cream);
  p.archGate(.5, .14, .765, .845, .26, .16, .025);
  p.mass(.36, .64, .765, .845, .58, C.cream, .445);
  p.roof(.27, .73, .75, .86, .58, .13, C.slate, C.cream);
  p.flat(.30, .70, .375, .73, .009, '#b1a58c');
  p.flat(.44, .56, .72, .975, .010, '#cbbd9f');
  // Gallery decks, upright timber supports and open railings face the yard.
  for (const side of ['left', 'right'] as const) {
    const ua = side === 'left' ? .28 : .65, ub = side === 'left' ? .35 : .72;
    // Small gallery decks receive shadows in D; the building wings cast them.
    p.box(D, ua, ub, .37, .72, .385, .41, C.oak);
    const post = side === 'left' ? .33 : .67;
    for (const v of [.39, .51, .64, .715]) {
      p.box(D, post - .007, post + .007, v - .008, v + .008, .01, .59, C.timber);
      p.box(D, post - .005, post + .005, v - .003, v + .003, .41, .49, C.oak);
    }
    p.box(D, post - .008, post + .008, .39, .715, .482, .495, C.oak);
    for (const v of [.44, .59, .76]) p.window(side === 'left' ? 'right' : 'left', side === 'left' ? .28 : .72, v, .45, .095, .105, C.oak);
  }
  // Raised rear gallery stops at v=.395, before the open courtyard contract.
  p.box(D, .30, .70, .35, .395, .385, .41, C.oak);
  p.box(D, .30, .70, .382, .392, .485, .50, C.oak);
  for (const u of [.33, .5, .67]) {
    p.window('front', .35, u, .46, .10, .12, C.oak);
    p.window('back', .13, u, .18, .10, .13, C.oak);
    p.face('front', .35, u - .010, u + .010, .05, .64, C.timber);
  }
  p.door('front', .35, .41, .08, .29);
  p.chimney(.17, .22, .72, .98, C.brick);
  p.chimney(.81, .48, .66, .91, C.brick);
  for (const u of [.09, .27, .73, .91]) p.face('front', .84, u - .007, u + .007, .05, .58, C.timber);
  p.face('front', .85, .285, .715, .54, .58, C.timber, .005);
  p.face('front', .845, .402, .598, .465, .526, '#3c5749', .004);
  return new THREE.Vector3(p.X(.49), p.Y(.65), p.Z(.24));
}

function church(p: VillagePen) {
  const { O, D } = p.a;
  p.mass(.22, .66, .14, .76, .40, C.stone);
  p.roof(.205, .675, .125, .775, .40, .22, C.slate, C.stoneLight, 'z');
  p.mass(.28, .56, .69, .92, .87, C.stone);
  p.flat(.28, .56, .69, .92, .87, '#858679', O);
  // Flat-topped tower, parapet ring and corner merlons; no pointed cap.
  for (const [a, b, c, d] of [[.28, .56, .69, .72], [.28, .56, .89, .92], [.28, .31, .72, .89], [.53, .56, .72, .89]]) p.box(O, a, b, c, d, .87, .94, C.stoneLight);
  for (const u of [.29, .53]) for (const v of [.70, .89]) p.box(D, u, u + .02, v, v + .02, .94, .985, C.stone);
  for (const v of [.24, .43, .62]) {
    p.box(O, .17, .22, v - .027, v + .027, 0, .35, C.stoneLight);
    p.box(O, .66, .71, v - .027, v + .027, 0, .35, C.stoneLight);
    p.pointedWindow('left', .22, v, .14, .10, .205);
    p.pointedWindow('right', .66, v, .14, .10, .205);
  }
  p.pointedWindow('front', .92, .42, .55, .115, .20);
  p.pointedWindow('right', .56, .805, .55, .105, .20);
  p.door('front', .92, .42, .105, .26, 0, '#56493b');
  p.flat(.36, .48, .92, .985, .009, '#c4bca4');
  for (const [u, v] of [[.78, .30], [.85, .49], [.78, .68]]) p.box(D, u - .022, u + .022, v - .009, v + .009, 0, .08, '#93968d', C.stoneLight);
  return new THREE.Vector3(p.X(.42), p.Y(.90), p.Z(.81));
}

function oast(p: VillagePen) {
  const { O, D } = p.a, radius = Math.min(p.a.w, p.a.d) * .145;
  p.mass(.10, .91, .12, .40, .45, C.brick);
  p.roof(.085, .925, .105, .415, .45, .20, '#6f4c43', C.brick);
  for (const u of [.29, .72]) {
    O.cylinder(p.X(u), p.Z(.48), radius, radius, p.Y(.025), p.a.H * .555, color(C.brick), 12);
    const coneBase = .57, top = .89;
    for (let i = 0; i < 12; i++) {
      const aa = i * Math.PI * 2 / 12, bb = (i + 1) * Math.PI * 2 / 12;
      const pa: V3 = [p.X(u) + Math.cos(aa) * radius * 1.10, p.Y(coneBase), p.Z(.48) + Math.sin(aa) * radius * 1.10];
      const pb: V3 = [p.X(u) + Math.cos(bb) * radius * 1.10, p.Y(coneBase), p.Z(.48) + Math.sin(bb) * radius * 1.10];
      O.triangle(pa, pb, p.point(u, top, .48), [Math.cos((aa + bb) / 2), 1, Math.sin((aa + bb) / 2)], color('#644c47'));
    }
    // A white cowl with a closed wind-facing back and a real open underside.
    const hw = .026 * Math.min(p.a.w, p.a.d) / p.a.w;
    const hd = .038 * Math.min(p.a.w, p.a.d) / p.a.d;
    for (const x of [u - hw * .70, u + hw * .70]) p.box(D, x - hw * .14, x + hw * .14, .48 - hd * .20, .48 + hd * .20, .875, .955, C.stoneLight);
    p.box(D, u - hw, u + hw, .48 - hd, .48 - hd * .70, .90, .956, C.stoneLight);
    p.roof(u - hw * 1.45, u + hw * 1.45, .48 - hd * 1.3, .48 + hd * 1.3, .952, .04, C.cream, C.stoneLight, 'x');
    p.face('front', .48 + radius / p.a.d, u - .041, u + .041, .12, .34, C.dark);
    p.face('front', .48 + radius / p.a.d, u - .032, u + .032, .16, .30, C.door, .003);
  }
  p.window('front', .40, .50, .20, .11, .16, C.stoneLight);
  p.window('left', .10, .27, .16, .09, .15, C.stoneLight);
  p.flat(.37, .63, .69, .955, .007, '#aa9b80');
  p.box(D, .11, .22, .83, .87, 0, .07, '#8f7453', '#d4bf88');
  return new THREE.Vector3(p.X(.29), p.Y(.60), p.Z(.48));
}

function manor(p: VillagePen) {
  const { D } = p.a;
  p.mass(.12, .90, .13, .38, .60, C.honeyLight);
  for (const [a, b, rise] of [[.105, .36, .23], [.36, .63, .27], [.63, .915, .22]]) p.roof(a, b, .115, .395, .60, rise, C.stoneRoof, C.honeyLight, 'z');
  for (const [a, b] of [[.12, .31], [.69, .90]]) {
    p.mass(a, b, .375, .825, .52, C.honey);
    p.roof(a - .015, b + .015, .36, .84, .52, .22, C.stoneRoof, C.honeyLight, 'z');
    p.window('front', .825, (a + b) / 2, .15, .11, .18);
    p.window('front', .825, (a + b) / 2, .385, .085, .105);
    const inner = a < .5 ? 'right' : 'left', wall = a < .5 ? b : a;
    for (const v of [.46, .63, .77]) p.window(inner, wall, v, .21, .085, .17);
  }
  // The centre remains a true court, with an off-axis historical-style entry.
  p.flat(.32, .68, .405, .85, .008, '#bdb29b');
  p.flat(.44, .56, .85, .98, .008, C.stoneLight);
  for (const u of [.20, .39, .58, .80]) {
    p.window('front', .38, u, .15, .11, .17);
    p.window('front', .38, u, .405, .105, .14);
    p.window('back', .13, u, .25, .10, .16);
  }
  p.door('front', .38, .29, .095, .28, 0, '#61513e');
  // Small stone porch stays behind the court's v=.43 open-sky boundary.
  p.box(D, .23, .25, .385, .416, 0, .29, C.stoneLight);
  p.box(D, .33, .35, .385, .416, 0, .29, C.stoneLight);
  p.box(D, .23, .35, .385, .42, .29, .315, C.stoneLight);
  p.chimney(.18, .24, .665, .985, C.honey);
  p.chimney(.83, .26, .67, .945, C.honey);
  for (const u of [.29, .71]) p.box(D, u - .022, u + .022, .90, .94, 0, .16, C.honey, C.stoneLight);
  for (const [a, b] of [[.11, .265], [.735, .915]]) p.box(D, a, b, .915, .928, 0, .06, C.stoneLight);
  p.face('front', .38, .125, .895, .345, .365, C.stoneLight);
  return new THREE.Vector3(p.X(.49), p.Y(.80), p.Z(.25));
}

export function drawBritishVillage(a: VillageCtx, model: VillageModel): THREE.Vector3 {
  const p = new VillagePen(a);
  switch (model) {
    case 'cottage': return cottage(p);
    case 'rows': return rows(p);
    case 'inn': return inn(p);
    case 'church': return church(p);
    case 'oast': return oast(p);
    case 'manor': return manor(p);
  }
}
