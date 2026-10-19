// D080: independently hand-coded community, estate and fishery architecture.
// W/O contain every wall and roof. D contains only upward ground paving/water.
// No fixture imports or polygon triangulator: each planar partition is explicit.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { COMMUNITY_BUILDINGS } from '../content/britishCommunityBuildings.ts';

type V3 = [number, number, number];
type Tri = [number, number, number];
type CommunityId = typeof COMMUNITY_BUILDINGS[number]['id'];
const C = { brick: '#a56650', stone: '#d7cbb4', pale: '#e6dfcd', slate: '#4c5b62', green: '#3a6155', glass: '#84adb7', paving: '#bbb399', water: '#477e99' };
// Outward partitions for a wall ordered ground-a, ground-b, roof-b, roof-a.
// false uses diagonal 0–2; true uses diagonal 1–3. Roof loops face upward.
const diagonal02: Tri[] = [[2, 0, 3], [0, 2, 1]];
const diagonal13: Tri[] = [[1, 0, 3], [3, 2, 1]];
const roofTriangle: Tri[] = [[1, 0, 2]];

function face(p: Pen, layer: 'W' | 'O' | 'D', points: readonly V3[], partition: readonly Tri[], away: V3, color: string, win?: string) {
  const g = p.a[layer], old = [g.style, g.band, g.glass] as const;
  const world = points.map((q): V3 => [p.X(q[0]), p.a.y0 + p.H * q[1], p.Z(q[2])]);
  const a = world[0], b = world[1], dx = b[0] - a[0], dz = b[2] - a[2], len2 = dx * dx + dz * dz;
  const repeats = Math.max(1, Math.round(Math.sqrt(len2) * 3));
  if (win) { g.style = WIN_STYLE[win]; g.band = 0; g.glass = col(C.glass); }
  try {
    for (const [i, j, k] of partition) {
      const start = g.pos.length;
      // Geo computes the perpendicular normal from transformed world positions,
      // so nonuniform parcel/height scaling has the inverse-transpose result.
      g.triangle(world[i], world[j], world[k], away, col(color));
      if (win) for (let n = start; n < g.pos.length; n += 3) {
        const uv = n / 3 * 2;
        g.uv[uv] = ((g.pos[n] - a[0]) * dx + (g.pos[n + 2] - a[2]) * dz) / len2 * repeats;
        g.uv[uv + 1] = (g.pos[n + 1] - p.a.y0) / .22;
      }
    }
  } finally { [g.style, g.band, g.glass] = old; }
}

function walls(p: Pen, boundary: readonly V3[], diagonals: readonly boolean[], color: string, win: string) {
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    face(p, 'W', [[a[0], 0, a[2]], [b[0], 0, b[2]], b, a], diagonals[i] ? diagonal13 : diagonal02, [b[2] - a[2], 0, a[0] - b[0]], color, win);
  }
}
function roof(p: Pen, boundary: readonly V3[], partition: readonly Tri[], color = C.slate) {
  face(p, 'O', boundary, partition, [0, 1, 0], color);
}
function radialRoof(p: Pen, boundary: readonly V3[], apex: V3) {
  for (let i = 0; i < boundary.length; i++) roof(p, [boundary[i], boundary[(i + 1) % boundary.length], apex], roofTriangle);
}
function ground(p: Pen, x0: number, x1: number, z0: number, z1: number, color: string) {
  // All four vertices share this exact horizontal plane. Use its analytic
  // normal, preserving the existing 0–2 diagonal without normalization drift.
  const y = p.a.y0 + p.H * .004;
  p.a.D.quad([p.X(x0), y, p.Z(z0)], [p.X(x1), y, p.Z(z0)], [p.X(x1), y, p.Z(z1)], [p.X(x0), y, p.Z(z1)], [0, 1, 0], col(color));
}
function forecourt(p: Pen) {
  ground(p, .16, .42, .90, .94, C.paving);
  ground(p, .58, .84, .90, .94, C.paving);
}
function ponds(p: Pen) {
  ground(p, .14, .42, .66, .86, C.water);
  ground(p, .54, .86, .66, .86, C.water);
}

const BUILD: Record<CommunityId, (p: Pen) => void> = {
  'z-plan-tram-terminus-hall': p => {
    const edge: V3[] = [[.12, .48, .16], [.58, .7947368421052632, .16], [.58, .7947368421052632, .38], [.88, 1, .38], [.88, 1, .84], [.42, .6852631578947368, .84], [.42, .6852631578947368, .62], [.12, .48, .62]];
    walls(p, edge, [false, true, false, true, true, false, true, false], C.brick, 'grid');
    // Explicit six-triangle partition leaves both re-entrant corners open.
    roof(p, edge, [[6, 0, 7], [0, 2, 1], [2, 4, 3], [4, 6, 5], [6, 2, 0], [2, 6, 4]]);
    forecourt(p);
  },
  'y-plan-tram-waiting-pavilion': p => {
    const edge: V3[] = [[.43, .5, .14], [.61, .5, .14], [.61, .5, .4], [.88, .5, .68], [.75, .5, .84], [.52, .5, .58], [.26, .5, .84], [.12, .5, .68], [.43, .5, .38]];
    walls(p, edge, [false, true, true, true, false, true, false, false, false], C.stone, 'ribbon');
    radialRoof(p, edge, [.52, 1, .47]);
    forecourt(p);
  },
  'notched-municipal-sorting-lodge': p => {
    const hall: V3[] = [[.14, .56, .3], [.86, .56, .3], [.86, .56, .84], [.5, .56, .6], [.14, .56, .84]];
    walls(p, hall, [false, true, true, true, false], C.brick, 'grid');
    radialRoof(p, hall, [.5, 1, .48]);
    const intake: V3[] = [[.36, .3, .12], [.64, .3, .12], [.64, .3, .3], [.36, .3, .3]];
    // Both complete opposing walls remain at z=.30. The intake top is
    // .30H beneath the hall's .56H eave, leaving .26H contact clearance.
    walls(p, intake, [false, true, true, false], C.stone, 'punch');
    roof(p, intake, diagonal02, C.green);
    forecourt(p);
  },
  'cranked-council-housing-slab': p => {
    const edge: V3[] = [[.14, 1, .16], [.86, 1, .16], [.52, 1, .44], [.72, 1, .84]];
    walls(p, edge, [false, true, true, false], C.pale, 'ribbon');
    roof(p, edge, diagonal02, C.green);
  },
  'kite-plan-council-point-block': p => {
    const edge: V3[] = [[.16, .58, .36], [.44, 1, .12], [.86, .58, .42], [.54, .86, .86]];
    walls(p, edge, [false, false, true, false], C.stone, 'punch');
    // Diagonal 1–3 is a real convex ridge, not a coplanar diagonal change.
    roof(p, [edge[0], edge[1], edge[3]], roofTriangle);
    roof(p, [edge[1], edge[2], edge[3]], roofTriangle);
  },
  'diagonal-valley-council-housing': p => {
    const edge: V3[] = [[.14, 1, .18], [.86, .56, .3], [.7, .84, .84], [.3, .5, .66]];
    walls(p, edge, [false, true, true, false], C.brick, 'grid');
    // The same boundary diagonal is now a concave two-plane roof valley.
    roof(p, [edge[0], edge[1], edge[3]], roofTriangle);
    roof(p, [edge[1], edge[2], edge[3]], roofTriangle);
  },
  're-entrant-fishery-keeper-lodge': p => {
    const edge: V3[] = [[.14, 1, .14], [.62, 1, .14], [.62, 1, .54], [.37, 1, .38], [.14, 1, .54]];
    walls(p, edge, [false, true, true, true, false], C.stone, 'punch');
    roof(p, edge, [[3, 0, 4], [0, 2, 1], [2, 0, 3]], C.green);
    ponds(p);
  },
  'paired-fishery-keeper-rooms': p => {
    const net: V3[] = [[.14, .48, .14], [.43, 1, .14], [.14, .48, .54]];
    walls(p, net, [false, true, false], C.brick, 'punch');
    roof(p, net, roofTriangle);
    const feed: V3[] = [[.52, .44, .22], [.86, .44, .22], [.86, .68, .54]];
    walls(p, feed, [false, true, true], C.stone, 'grid');
    roof(p, feed, roofTriangle, C.green);
    ponds(p);
  },
  'chamfered-folded-fishery-store': p => {
    const edge: V3[] = [[.14, .54, .14], [.52, .54, .14], [.72, 1, .32], [.52, .66, .54], [.14, .54, .54]];
    walls(p, edge, [false, false, true, true, false], C.brick, 'grid');
    roof(p, [edge[0], edge[1], edge[2]], roofTriangle);
    roof(p, [edge[0], edge[2], edge[4]], roofTriangle);
    roof(p, [edge[2], edge[3], edge[4]], roofTriangle);
    ponds(p);
  },
  'remembrance-hall-and-vigil-pavilion': p => {
    const hall: V3[] = [[.14, .56, .16], [.6, .56, .16], [.34, .56, .78]];
    walls(p, hall, [false, true, false], C.stone, 'arch');
    radialRoof(p, hall, [.34, 1, .36]);
    // A complete lower room starts at x=.68; the hall ends at x=.60.
    const vigil: V3[] = [[.7, .42, .42], [.88, .42, .78], [.68, .42, .84]];
    walls(p, vigil, [true, true, false], C.pale, 'punch');
    roof(p, vigil, roofTriangle, C.green);
    ground(p, .16, .84, .90, .94, C.paving);
  },
};

export function drawBritishCommunityBuilding(p: Pen): boolean {
  const { k, v } = p.a;
  if (typeof v !== 'number' || !Number.isInteger(v)) return false;
  const slot = COMMUNITY_BUILDINGS.find(b => b.k === k && b.v === v);
  if (!slot) return false;
  BUILD[slot.id](p);
  return true;
}
