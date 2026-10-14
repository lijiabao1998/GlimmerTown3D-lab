// D064: which of the fourteen British merge-tower models a (kind, variant) pair draws. Pure data and pure functions: no three, no DOM,
// no randomness. The four kinds are the merge buildings of src/sim/rules/merge.ts (33 residential skyscraper, 34 commercial skyscraper,
// 105 residential mega-block, 106 commercial complex); the variant numbers are the ones already in lab-kinds.json. Variant heights are
// fixed by the kind table (33/34: 8.07, 7.39, 4.32, 7.76 cells; 105: 5.65, 6.56, 5.65; 106: 9.15, 9.15, 8.38), so the models are matched
// to variants by the real buildings' storey counts, tallest first. See docs/D064-reference-record.md for the listed buildings behind each.
// Reachability (measured, docs/D064-skyline.md): src/sim/rules/merge.ts gives a 2x2 merge (33, 34) a variant from pickV406 (0-3, by density and land value) but a 3x3 merge
// (105, 106) always variant 0, so the other 3x3 variants are drawn only when something else supplies those numbers (the gallery sample, the __gt.towerV capture hook).
export type TowerModel =
  | 'triangleTower' | 'crankedPointBlock' | 'clusterBlock' | 'slabServiceTower'
  | 'diaboloTower' | 'boomerangTower' | 'roundTower' | 'serviceTTower'
  | 'steppedMegablock' | 'deckRanges' | 'perimeterBlock'
  | 'recessedTower' | 'pinwheelTowers' | 'cantedGroup';

export const TOWER_KINDS: ReadonlySet<number> = new Set([33, 34, 105, 106]);

const MODELS: Readonly<Record<string, TowerModel>> = {
  '33:0': 'triangleTower', '33:1': 'crankedPointBlock', '33:2': 'clusterBlock', '33:3': 'slabServiceTower',
  '34:0': 'diaboloTower', '34:1': 'boomerangTower', '34:2': 'roundTower', '34:3': 'serviceTTower',
  '105:0': 'steppedMegablock', '105:1': 'deckRanges', '105:2': 'perimeterBlock',
  '106:0': 'recessedTower', '106:1': 'pinwheelTowers', '106:2': 'cantedGroup',
};
export const TOWER_MODELS: readonly TowerModel[] = Object.values(MODELS);
// How many variants each kind has in lab-kinds.json (`variants`), so a capture can clamp a forced variant.
export const towerVariants = (k: number): number => (k === 33 || k === 34 ? 4 : k === 105 || k === 106 ? 3 : 1);
export const towerModel = (k: number, v: number): TowerModel | null => MODELS[`${k}:${v}`] ?? null;
// Photography hook (render only; the world is never edited): the building list a capture builds the scene from when it forces every merge tower to one
// variant (`forced`) and/or keeps one kind only (`only`). It copies and never edits; with neither set it hands back the same array.
export function towerBuildings<B extends { k: number; v: number }>(buildings: readonly B[], forced: number | null, only: number | null): B[] {
  if (forced === null && only === null) return buildings as B[];
  const out: B[] = [];
  for (const b of buildings) {
    if (only !== null && b.k !== only) continue;
    out.push(forced !== null && TOWER_KINDS.has(b.k) ? { ...b, v: Math.min(Math.max(0, forced), towerVariants(b.k) - 1) } : b);
  }
  return out;
}
