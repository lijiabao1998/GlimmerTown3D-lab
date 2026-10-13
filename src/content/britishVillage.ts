// D059: exterior studies only. Existing kinds, variants and gameplay are unchanged.
import type { Recipe } from './recipes.ts';

export type VillageModel = 'cottage' | 'rows' | 'inn' | 'church' | 'oast' | 'manor';
export const VILLAGE_MODELS: readonly VillageModel[] = ['cottage', 'rows', 'inn', 'church', 'oast', 'manor'];

export function villageBlock(r: Recipe): VillageModel | null {
  if (r.k === 1 && r.lv === 1 && r.arche === 'town') return 'cottage';
  if (r.k === 2 && r.lv === 1 && r.arche === 'townShop') return 'rows';
  if (r.k === 2 && r.lv === 2 && r.arche === 'hotel') return 'inn';
  if (r.k === 1 && r.lv === 2 && r.arche === 'courtyard') return 'manor';
  return null;
}

export function villageKind(k: number): VillageModel | null {
  if (k === 16 || k === 66) return 'church';
  if (k === 22 || k === 100) return 'oast';
  return null;
}
