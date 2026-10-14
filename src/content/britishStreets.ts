// D058 render-only street orientation. Saved plots, variants and simulation stay untouched.
import type { Recipe } from './recipes.ts';
import type { DrawBlock } from './blocks.ts';

export const isBritishStreet = (r: Recipe) => r.path === 'ukTerrace' || r.path === 'ukSemi'
  || r.path === 'ukVictorian' || r.path === 'ukHighStreet' && r.lv < 2;

export interface StreetRoads { front: boolean; left: boolean; right: boolean; back: boolean }
export interface StreetFrame { turn: 0 | 1 | 2 | 3; roads: StreetRoads; key: string }
export interface StreetGrid { n: number; road: ArrayLike<number>; fly?: ArrayLike<number> }

// 0=south, 1=east, 2=north, 3=west. Count actual adjacent ground-level roads.
// Equal counts prefer the old south-facing direction, then north, east, west.
export function streetFrame(g: StreetGrid, b: DrawBlock): StreetFrame {
  const road = (x: number, z: number) => x >= 0 && z >= 0 && x < g.n && z < g.n
    && !!g.road[z * g.n + x] && !g.fly?.[z * g.n + x];
  const counts = [0, 0, 0, 0];
  for (let x = b.x; x < b.x + b.w; x++) {
    counts[0] += +road(x, b.z + b.h); counts[2] += +road(x, b.z - 1);
  }
  for (let z = b.z; z < b.z + b.h; z++) {
    counts[1] += +road(b.x + b.w, z); counts[3] += +road(b.x - 1, z);
  }
  let turn: StreetFrame['turn'] = 0;
  for (const side of [2, 1, 3] as const) if (counts[side] > counts[turn]) turn = side;
  const roads = { front: counts[turn] > 0, left: counts[(turn + 3) % 4] > 0,
    right: counts[(turn + 1) % 4] > 0, back: counts[(turn + 2) % 4] > 0 };
  return { turn, roads, key: `${turn}:${+roads.front}${+roads.left}${+roads.right}${+roads.back}` };
}

// Canonical +z front, with a proper rotation (no mirroring or negative scale).
export function streetPoint(b: DrawBlock, turn: StreetFrame['turn'], x: number, z: number): [number, number] {
  if (turn === 1) return [b.x + z, b.z + b.h - x];
  if (turn === 2) return [b.x + b.w - x, b.z + b.h - z];
  if (turn === 3) return [b.x + b.w - z, b.z + x];
  return [b.x + x, b.z + z];
}
export function streetNormal(turn: StreetFrame['turn'], x: number, z: number): [number, number] {
  return turn === 1 ? [z, -x] : turn === 2 ? [-x, -z] : turn === 3 ? [-z, x] : [x, z];
}
