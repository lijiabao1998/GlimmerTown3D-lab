// D065: exterior studies only. Existing kind 1, level 1 and the villa and modern core-path archetypes are unchanged.
import type { Recipe } from './recipes.ts';

export type HouseArche = 'villa' | 'modern';
export type HouseModel = 'georgianBox' | 'gothicVilla' | 'craftsHouse' | 'italianateVilla' | 'tudorbethan'
  | 'whiteCubist' | 'spanHouse' | 'canopyBungalow';
export const HOUSE_FORMS: Record<HouseArche, readonly HouseModel[]> = {
  villa: ['georgianBox', 'gothicVilla', 'craftsHouse', 'italianateVilla', 'tudorbethan'],
  modern: ['whiteCubist', 'spanHouse', 'canopyBungalow'],
};
export const HOUSE_MODELS: readonly HouseModel[] = [...HOUSE_FORMS.villa, ...HOUSE_FORMS.modern];

// lab-arche.json `1_1` rows without a facade style: villa and modern always take the generic core path (town is D059's).
export function houseBlock(r: Recipe): HouseArche | null {
  return r.k === 1 && r.lv === 1 && r.path === 'core' && (r.arche === 'villa' || r.arche === 'modern') ? r.arche : null;
}

// The saved variant picks the form family step (v is 0, 5, 10, ... for villa and 3, 8, 13, ... for modern); a position salt (render-only) spreads
// the forms over a street so a row of equal variants is not a row of equal houses. Same city, same houses, every time.
export function houseModel(arche: HouseArche, v: number, salt: number, force: number | null = null): HouseModel {
  const list = HOUSE_FORMS[arche];
  return list[(force ?? Math.floor(Math.abs(v) / 5) + Math.abs(salt)) % list.length];
}
