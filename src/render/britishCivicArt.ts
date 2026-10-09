// D056: eight authored silhouettes; all dimensions are bounded by the existing parcel and H.
// Only batched geometry is emitted. No state, random numbers, runtime assets or per-building meshes.
import { col, type Pen } from './kindArt.ts';
import { BRITISH_KINDS, BRITISH_PALETTE as C } from '../content/britishCivic.ts';

// Unlike the older generic hip helper, choose the ridge on the longer axis.
// This avoids zero-area triangles when a narrow tower's ridge collapses to a point.
function hip(p: Pen, a: number, b: number, c: number, d: number, y: number, rise: number, color: string) {
  const x0=p.X(a),x1=p.X(b),z0=p.Z(c),z1=p.Z(d),Y=p.a.y0+y,T=Y+rise,g=p.a.O,C=col(color);
  const w=x1-x0,depth=z1-z0,t=Math.min(w,depth)*.42;
  if(w>=depth){const z=(z0+z1)/2;
    g.slope([x0,Y,z0],[x1,Y,z0],[x1-t,T,z],[x0+t,T,z],[0,1,-1],C);
    g.slope([x0,Y,z1],[x1,Y,z1],[x1-t,T,z],[x0+t,T,z],[0,1,1],C);
    g.triangle([x0,Y,z0],[x0,Y,z1],[x0+t,T,z],[-1,1,0],C);
    g.triangle([x1,Y,z0],[x1,Y,z1],[x1-t,T,z],[1,1,0],C);
  }else{const x=(x0+x1)/2;
    g.slope([x0,Y,z0],[x0,Y,z1],[x,T,z1-t],[x,T,z0+t],[-1,1,0],C);
    g.slope([x1,Y,z0],[x1,Y,z1],[x,T,z1-t],[x,T,z0+t],[1,1,0],C);
    g.triangle([x0,Y,z0],[x1,Y,z0],[x,T,z0+t],[0,1,-1],C);
    g.triangle([x0,Y,z1],[x1,Y,z1],[x,T,z1-t],[0,1,1],C);
  }
}

const courses = (p: Pen, a: number, b: number, z: number, y: number) =>
  p.bit(a, b, z, z + .018, y, y + p.H * .025, C.stone);
function entry(p: Pen, u: number, z: number, y = 0, height = .24, width = .12) {
  const H = p.H, w = width / 2;
  p.bit(u - w - .022, u + w + .022, z, z + .022, y, y + H * (height + .035), C.stone);
  p.bit(u - w, u + w, z + .023, z + .026, y, y + H * height, C.green);
  p.bit(u - .006, u + .006, z + .027, z + .03, y + H * .04, y + H * height, C.gold);
}
function chimney(p: Pen, u: number, z: number, bottom: number, top: number) {
  const H = p.H;
  p.blk(u - .035, u + .035, z - .034, z + .034, H * bottom, H * (top - .025), C.brick, C.stone, false);
  p.bit(u - .043, u + .043, z - .041, z + .041, H * (top - .07), H * (top - .045), C.stone);
  for (const x of [u - .021, u + .021]) p.bit(x - .011, x + .011, z - .012, z + .012, H * (top - .045), H * top, C.brick, C.dark);
}
function clock(p: Pen, u: number, z: number, y: number, w = .11) {
  const H = p.H;
  p.bit(u - w / 2, u + w / 2, z, z + .012, H * (y - .052), H * (y + .052), C.stone);
  p.bit(u - .007, u + .007, z + .013, z + .016, H * (y - .006), H * (y + .038), C.dark);
  p.bit(u - .005, u + w * .31, z + .013, z + .016, H * (y - .007), H * (y + .007), C.dark);
}
function rail(p: Pen, a: number, b: number, z: number, h = .12) {
  p.bit(a, b, z, z + .009, p.H * h, p.H * (h + .015), C.green);
  for (let i = 0; i < 5; i++) { const u = a + (b - a) * i / 4; p.bit(u, u + .008, z, z + .009, 0, p.H * h, C.green); }
}
function plinth(p: Pen) {
  p.bit(.095, .905, .17, .86, 0, p.H * .035, C.stone);
}

const BUILD: Record<number, (p: Pen) => void> = {
  6(p) {
    const H = p.H; plinth(p);
    p.blk(.12, .7, .25, .76, H * .035, H * .45, C.brick, null, false);
    p.gable(.12, .7, .25, .76, H * .45, H * .19, C.slate, C.brick, 'x');
    for (const u of [.27, .54]) {
      p.bit(u - .115, u + .115, .765, .79, 0, H * .36, C.stone);
      p.bit(u - .085, u + .085, .792, .798, H * .02, H * .305, C.red);
      p.bit(u - .065, u + .065, .799, .805, H * .205, H * .27, C.glass);
      p.bit(u - .004, u + .004, .806, .809, H * .02, H * .3, C.dark);
    }
    p.blk(.7, .87, .31, .57, 0, H * .88, C.brick, C.stone, 'arch');
    p.blk(.685, .885, .295, .585, H * .85, H * .89, C.stone, C.stone, false);
    hip(p, .685, .885, .295, .585, H * .89, H * .11, C.slate);
    courses(p, .12, .69, .763, H * .39);
    p.bit(.735, .835, .58, .6, H * .64, H * .79, C.dark);
    for (const h of [.67, .71, .75]) p.bit(.73, .84, .601, .611, H * h, H * (h + .012), C.stone);
  },
  7(p) {
    const H = p.H; plinth(p);
    p.blk(.13, .87, .26, .66, 0, H * .5, C.brick, null, 'arch');
    p.gable(.13, .87, .26, .66, H * .5, H * .2, C.slate, C.stone, 'x');
    for (const [a, b] of [[.13, .35], [.65, .87]]) {
      p.blk(a, b, .43, .79, 0, H * .54, C.brick, null, 'arch');
      p.gable(a, b, .43, .79, H * .54, H * .23, C.slate, C.stone, 'z');
      p.bit((a+b)/2-.012, (a+b)/2+.012, .795, .81, H * .55, H * .69, C.timber);
    }
    p.blk(.43, .57, .6, .78, 0, H * .66, C.stone, null, false);
    p.gable(.43, .57, .6, .78, H * .66, H * .15, C.slate, C.stone, 'z');
    entry(p, .5, .787, 0, .3, .09);
    p.blk(.46, .54, .39, .49, H * .68, H * .9, C.stone, null, false);
    p.bit(.478, .522, .495, .502, H * .76, H * .86, C.dark);
    hip(p, .45, .55, .38, .5, H * .9, H * .1, C.slate);
    rail(p, .13, .36, .9); rail(p, .64, .87, .9);
  },
  14(p) {
    const H = p.H; plinth(p);
    p.blk(.14, .86, .22, .77, H * .035, H * .58, C.brick, null, 'arch');
    hip(p, .12, .88, .2, .79, H * .58, H * .2, C.slate);
    p.blk(.32, .68, .37, .58, H * .71, H * .9, C.glass, C.slate, false);
    for (const u of [.32, .44, .56, .68]) p.bit(u-.01, u+.01, .36, .59, H*.73, H*.9, C.stone);
    hip(p, .3, .7, .35, .6, H * .9, H * .1, C.slate);
    p.blk(.36, .64, .74, .85, 0, H * .42, C.stone, null, false);
    p.gable(.34, .66, .74, .85, H * .42, H * .15, C.stone, C.stone, 'z');
    entry(p, .5, .856, 0, .33, .15);
    courses(p, .14, .86, .775, H * .49);
  },
  15(p) {
    const H = p.H; plinth(p);
    p.blk(.13, .69, .35, .78, 0, H * .45, C.brick, null, 'arch');
    p.blk(.13, .36, .18, .65, 0, H * .5, C.brick, null, 'grid');
    hip(p, .12, .7, .33, .79, H * .45, H * .18, C.slate);
    p.gable(.13, .36, .18, .65, H * .5, H * .18, C.slate, C.stone, 'z');
    p.blk(.66, .87, .56, .79, 0, H * .84, C.brick, C.stone, false);
    p.bit(.645, .885, .545, .805, H * .69, H * .72, C.stone);
    clock(p, .765, .798, .78, .14);
    hip(p, .645, .885, .545, .805, H * .84, H * .16, C.green);
    entry(p, .76, .812, 0, .27, .1);
    courses(p, .13, .65, .79, H * .35);
    p.bit(.2, .57, .79, .81, H * .31, H * .36, C.green);
    p.cyl(.47, .885, p.a.s * .026, 0, H * .16, C.red, 6);
    p.bit(.452, .488, .91, .918, H * .11, H * .123, C.dark);
  },
  17(p) {
    const H = p.H;
    p.bit(.08, .92, .18, .88, 0, H * .08, C.stone);
    p.blk(.13, .64, .23, .58, H * .08, H * .57, C.brick, null, 'grid');
    p.gable(.12, .66, .22, .6, H * .57, H * .25, C.slate, C.stone, 'x');
    p.blk(.68, .85, .23, .43, 0, H * .68, C.brick, C.slate, 'grid');
    hip(p, .65, .88, .2, .46, H * .68, H * .15, C.slate);
    for (const u of [.17, .42, .68, .88]) p.pole(u, .79, .009*p.a.s, H * .08, H * .48, C.green);
    p.gable(.1, .91, .56, .84, H * .47, H * .12, C.green, C.stone, 'x');
    p.bit(.1, .91, .839, .85, H * .445, H * .485, C.stone);
    entry(p, .39, .586, H * .08, .3, .1);
    chimney(p, .22, .37, .65, 1); chimney(p, .58, .37, .65, .95);
    p.bit(.18, .3, .65, .69, H * .12, H * .17, C.timber);
  },
  42(p) {
    const H = p.H; plinth(p);
    for (const [a, b] of [[.12, .4], [.6, .88]]) {
      p.blk(a, b, .3, .75, 0, H * .49, C.brick, null, 'arch');
      hip(p, a-.015, b+.015, .28, .77, H*.49, H*.18, C.slate);
      courses(p, a, b, .755, H*.3);
      p.blk(a+.055, b-.055, .63, .8, 0, H*.53, C.stone, null, 'arch');
      p.gable(a+.045, b-.045, .63, .8, H*.53, H*.13, C.slate, C.stone, 'z');
    }
    p.blk(.405, .595, .38, .78, 0, H * .84, C.brick, C.stone, 'arch');
    p.bit(.39, .61, .37, .795, H * .68, H * .72, C.stone);
    clock(p, .5, .79, .78, .115);
    p.pyr(.5, .56, .105 * p.a.s, H * .84, H * .16, C.slate);
    entry(p, .5, .802, 0, .3, .13);
    for (let i=0;i<3;i++) p.bit(.34+i*.015,.66-i*.015,.87-i*.02,.895-i*.02,0,H*(.02+i*.02),C.stone);
  },
  43(p) {
    const H = p.H; plinth(p);
    p.blk(.12, .88, .21, .68, H*.06, H*.67, C.stone, null, 'arch');
    hip(p, .1, .9, .19, .7, H*.67, H*.21, C.slate);
    p.blk(.29, .71, .53, .7, H*.66, H*.82, C.stone, C.stone, false);
    // A real open portico: four detached columns support the pediment, no solid box behind the gaps.
    for (const u of [.31,.437,.563,.69]) {
      p.cyl(u,.81,.02*p.a.s,H*.11,H*.65,C.stone,6);
      p.bit(u-.029,u+.029,.782,.839,H*.62,H*.68,C.stone);
      p.bit(u-.03,u+.03,.78,.84,H*.08,H*.13,C.stone);
    }
    p.bit(.27,.73,.65,.87,H*.67,H*.74,C.stone);
    p.gable(.27,.73,.65,.87,H*.74,H*.26,C.slate,C.stone,'z');
    entry(p,.5,.685,H*.06,.38,.14);
    for(let i=0;i<3;i++) p.bit(.23+i*.015,.77-i*.015,.86+i*.021,.89+i*.021,0,H*(.08-i*.02),C.stone);
    courses(p,.12,.88,.689,H*.5);
  },
  87(p) {
    const H = p.H;
    p.bit(.1,.9,.16,.88,0,H*.055,C.stone);
    // Three separate roofs and open structural frames give this building its unique low silhouette.
    for(const [a,b] of [[.13,.35],[.39,.61],[.65,.87]]) {
      for(const u of [a+.025,b-.025]) for(const z of [.24,.5,.78]) p.pole(u,z,.012*p.a.s,H*.055,H*.58,C.timber);
      p.gable(a,b,.2,.82,H*.58,H*.27,C.slate,C.stone,'z');
      p.bit(a,b,.785,.802,H*.53,H*.58,C.timber);
      for(const z of [.35,.61]) {
        p.bit(a+.04,b-.04,z,z+.1,H*.09,H*.25,C.green,C.stone);
        p.bit(a+.05,b-.05,z+.01,z+.08,H*.25,H*.29,C.gold);
      }
    }
    p.blk(.435,.565,.36,.62,H*.74,H*.9,C.glass,C.green,false);
    p.gable(.425,.575,.35,.63,H*.9,H*.1,C.green,C.stone,'z');
    for(const u of [.44,.5,.56]) p.bit(u-.006,u+.006,.63,.64,H*.77,H*.9,C.timber);
  },
};
export function drawBritishCivic(p: Pen): boolean {
  if (!BRITISH_KINDS.has(p.a.k)) return false;
  BUILD[p.a.k](p);
  return true;
}
