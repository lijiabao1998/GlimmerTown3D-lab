// D081: independently hand-coded field-study and camp architecture.
// W/O contain every wall and roof. D contains only upward ground paving/water.
// No fixture imports or polygon triangulator: each planar partition is explicit.
import { col, type Pen } from './kindArt.ts';
import { WIN_STYLE } from './windows.ts';
import { FIELD_STUDY_LODGES } from '../content/britishFieldStudyLodges.ts';

type V3 = [number, number, number];
type Tri = [number, number, number];
type FieldStudyId = typeof FIELD_STUDY_LODGES[number]['id'];
const C = { brick: '#a56650', stone: '#d7cbb4', pale: '#e6dfcd', slate: '#4c5b62', green: '#3a6155', glass: '#84adb7', paving: '#bbb399', water: '#477e99' };
// Outward partitions for a wall ordered ground-a, ground-b, roof-b, roof-a.
// false uses diagonal 0–2; true uses diagonal 1–3. Roof loops face upward.
const diagonal02: Tri[] = [[2, 0, 3], [0, 2, 1]];
const diagonal13: Tri[] = [[1, 0, 3], [3, 2, 1]];
const roofTriangle: Tri[] = [[1, 0, 2]];

function face(p: Pen, layer: 'W' | 'O' | 'D', points: readonly V3[], partition: readonly Tri[], away: V3, color: string, win?: string) {
  const g = p.a[layer], old = [g.style, g.band, g.glass] as const;
  const world = points.map((q): V3 => [p.X(q[0]), p.a.y0 + p.H * q[1], p.Z(q[2])]);
  // Clerestory walls begin with a vertical edge; find their horizontal UV axis.
  const a = world[0], b = world.find(q => q[0] !== a[0] || q[2] !== a[2]) ?? world[1];
  const dx = b[0] - a[0], dz = b[2] - a[2], len2 = dx * dx + dz * dz;
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
  ground(p, .14, .44, .62, .86, C.water);
  ground(p, .54, .86, .62, .86, C.water);
}

// Extrude a manually specified x/height roof profile. End walls have explicit
// concavity-aware partitions; each roof segment is a complete independent face.
function profile(p: Pen, line: readonly [number, number][], z0: number, z1: number, end: readonly Tri[], roofDiagonals: readonly boolean[], color: string, win: string) {
  const first = line[0], last = line[line.length - 1];
  const front: V3[] = [[first[0], 0, z0], [last[0], 0, z0], ...[...line].reverse().map(([x, h]): V3 => [x, h, z0])];
  face(p, 'W', front, end, [0, 0, -1], color, win);
  face(p, 'W', front.map(q => [q[0], q[1], z1]), end.map(([a,b,c]) => [a,c,b]), [0,0,1], color, win);
  face(p, 'W', [[first[0],0,z0],[first[0],0,z1],[first[0],first[1],z1],[first[0],first[1],z0]], [[1,3,0],[3,1,2]], [-1,0,0], color, win);
  face(p, 'W', [[last[0],0,z0],[last[0],0,z1],[last[0],last[1],z1],[last[0],last[1],z0]], diagonal13, [1,0,0], color, win);
  for (let i=0; i<line.length-1; i++) {
    const [x,h]=line[i], [xx,hh]=line[i+1];
    const q: V3[] = [[x,h,z0],[xx,hh,z0],[xx,hh,z1],[x,h,z1]];
    if(x===xx) face(p,'W',q,roofDiagonals[i]?diagonal13:diagonal02,[hh>h?-1:1,0,0],color,win);
    else roof(p,q,roofDiagonals[i]?diagonal13:diagonal02);
  }
}
const gableEnd: Tri[] = [[3,0,4],[0,2,1],[2,0,3]];
const BUILD: Record<FieldStudyId, (p: Pen) => void> = {
  'wetland-visitor-and-learning-lodges': p => {
    profile(p,[[.14,.52],[.265,1],[.4,.52]],.14,.46,gableEnd,[false,true],C.stone,'arch');
    const e: V3[] = [[.56,.38,.18],[.84,.38,.18],[.84,.38,.44],[.56,.38,.44]], a: V3=[.63,.76,.31], b: V3=[.77,.76,.31];
    walls(p,e,[false,true,true,false],C.brick,'punch');
    roof(p,[e[0],e[1],b,a],diagonal02); roof(p,[e[1],e[2],b],roofTriangle);
    roof(p,[e[2],e[3],a,b],diagonal13); roof(p,[e[3],e[0],a],roofTriangle); ponds(p);
  },
  'octagonal-classroom-and-specimen-store': p => {
    const e: V3[] = [[.238,.46,.15],[.382,.46,.15],[.47,.46,.238],[.47,.46,.382],[.382,.46,.47],[.238,.46,.47],[.15,.46,.382],[.15,.46,.238]];
    walls(p,e,[false,true,true,true,true,true,false,false],C.stone,'arch'); radialRoof(p,e,[.31,1,.31]);
    const store: V3[] = [[.61,.36,.18],[.86,.68,.18],[.86,.68,.45],[.61,.36,.45]];
    walls(p,store,[false,true,true,false],C.brick,'ribbon'); roof(p,store,diagonal02,C.green); ponds(p);
  },
  'cranked-field-laboratory-and-workshop': p => {
    const h=(z:number)=>.48+(z-.14)*(.52/.34);
    const e: V3[] = [[.14,h(.14),.14],[.46,h(.14),.14],[.46,h(.26),.26],[.29,h(.26),.26],[.29,h(.48),.48],[.14,h(.48),.48]];
    walls(p,e,[false,true,true,true,true,false],C.brick,'ribbon'); roof(p,e,[[4,0,5],[0,2,1],[3,0,4],[0,3,2]]);
    profile(p,[[.59,.42],[.72,.82],[.85,.42]],.17,.47,gableEnd,[false,true],C.stone,'punch'); ponds(p);
  },
  'double-gabled-reedland-centre-and-office': p => {
    profile(p,[[.14,.5],[.235,1],[.32,.5],[.4,.8],[.48,.5]],.15,.45,[[5,0,6],[0,2,1],[2,4,3],[4,0,5],[0,4,2]],[false,true,false,true],C.stone,'arch');
    const e: V3[] = [[.64,.62,.19],[.79,.62,.19],[.87,.62,.27],[.87,.62,.42],[.72,.62,.48],[.6,.62,.38]];
    walls(p,e,[false,true,true,true,true,false],C.brick,'punch'); roof(p,e,[[4,0,5],[0,2,1],[2,4,3],[4,2,0]],C.green); ponds(p);
  },
  'cruciform-observation-lodge-and-boathouse': p => {
    const e: V3[] = [[.25,.45,.14],[.37,.45,.14],[.37,.45,.25],[.48,.45,.25],[.48,.45,.37],[.37,.45,.37],[.37,.45,.48],[.25,.45,.48],[.25,.45,.37],[.14,.45,.37],[.14,.45,.25],[.25,.45,.25]];
    walls(p,e,[false,true,false,true,true,true,true,false,true,false,false,false],C.stone,'arch'); radialRoof(p,e,[.31,1,.31]);
    const boat: V3[] = [[.64,.38,.19],[.86,.44,.25],[.69,.66,.47]];
    walls(p,boat,[false,true,false],C.brick,'punch'); roof(p,boat,roofTriangle,C.green); ponds(p);
  },
  'clerestory-camp-amenity-hall': p => {
    profile(p,[[.14,.44],[.35,.66],[.35,.87],[.57,1],[.57,.62],[.86,.42]],.18,.78,[[6,0,7],[0,2,1],[3,5,4],[6,2,0],[3,6,5],[6,3,2]],[false,false,false,true,false],C.brick,'ribbon'); forecourt(p);
  },
  'hipped-campwarden-house-and-washhouse': p => {
    const e: V3[] = [[.14,.54,.16],[.49,.54,.16],[.49,.54,.78],[.14,.54,.78]], a: V3=[.315,1,.315], b: V3=[.315,1,.625];
    walls(p,e,[false,true,true,false],C.stone,'punch');
    roof(p,[e[0],e[1],a],roofTriangle); roof(p,[e[1],e[2],b,a],diagonal13);
    roof(p,[e[2],e[3],b],roofTriangle); roof(p,[e[3],e[0],a,b],diagonal02);
    const wash: V3[] = [[.64,.36,.3],[.88,.456,.54],[.64,.56,.8]];
    walls(p,wash,[true,true,false],C.brick,'ribbon'); roof(p,wash,roofTriangle,C.green); forecourt(p);
  },
  'canted-camp-kitchen-and-pyramidal-store': p => {
    const e: V3[] = [[.14,.47,.18],[.5,.47,.26],[.46,.47,.78],[.14,.47,.7]], a: V3=[.29,1,.35], b: V3=[.28,.83,.62];
    walls(p,e,[false,true,true,false],C.brick,'arch');
    for(const q of [[e[0],e[1],a],[e[1],e[2],a],[e[2],e[3],b],[e[3],e[0],b],[a,e[2],b],[b,e[0],a]]) roof(p,q,roofTriangle);
    const store: V3[] = [[.66,.35,.42],[.88,.35,.42],[.88,.35,.7],[.66,.35,.7]];
    walls(p,store,[false,true,true,false],C.stone,'punch'); radialRoof(p,store,[.77,.66,.56]); forecourt(p);
  },
  'pentagonal-ridge-remembrance-chapel': p => {
    const e: V3[] = [[.16,.58,.2],[.68,.62,.14],[.86,1,.42],[.7,.62,.82],[.2,.58,.76]];
    walls(p,e,[false,true,true,true,false],C.stone,'arch');
    roof(p,[e[0],e[1],e[2]],roofTriangle); roof(p,[e[0],e[2],e[4]],roofTriangle); roof(p,[e[2],e[3],e[4]],roofTriangle); forecourt(p);
  },
  'notched-monopitch-vigil-house': p => {
    const h=(z:number)=>.42+(z-.16)*(.58/.68);
    const e: V3[] = [[.14,h(.16),.16],[.86,h(.16),.16],[.86,h(.84),.84],[.5,h(.62),.62],[.14,h(.84),.84]];
    walls(p,e,[false,true,true,true,false],C.pale,'punch'); roof(p,e,[[3,0,4],[0,2,1],[2,0,3]],C.green); forecourt(p);
  },
};
export function drawBritishFieldStudyLodge(p: Pen): boolean {
  const { k,v }=p.a;
  if(typeof v!=='number'||!Number.isInteger(v)) return false;
  const slot=FIELD_STUDY_LODGES.find(b=>b.k===k&&b.v===v);
  if(!slot) return false;
  BUILD[slot.id](p);
  return true;
}
