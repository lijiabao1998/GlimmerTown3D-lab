// D063: exterior studies only. Existing kind 2, its three levels and the eleven core-path archetypes are unchanged.
import type { Recipe } from './recipes.ts';

export type CommerceModel = 'marketHall' | 'shopParade' | 'greatStore' | 'slabDrum' | 'gothicHotel'
  | 'pilotisTower' | 'steppedOffice' | 'gridCourt' | 'domedTower' | 'telecomTower' | 'bridgedCourt';
export const COMMERCE_MODELS: readonly CommerceModel[] = ['marketHall', 'shopParade', 'greatStore', 'slabDrum', 'gothicHotel',
  'pilotisTower', 'steppedOffice', 'gridCourt', 'domedTower', 'telecomTower', 'bridgedCourt'];

// lab-arche.json `2_<lv>` rows, by level and archetype name (core path only; the usMainStreet, ukHighStreet and townShop rows are not part of this wave).
const BY: Record<string, CommerceModel> = {
  '1:market': 'marketHall', '1:modernShop': 'shopParade',
  '2:dept': 'greatStore', '2:modernOffice': 'slabDrum', '2:stoneHotel': 'gothicHotel',
  '3:podTower': 'pilotisTower', '3:setback': 'steppedOffice', '3:slabC': 'gridCourt',
  '3:stoneTower': 'domedTower', '3:modernNeedle': 'telecomTower', '3:courtC': 'bridgedCourt',
};

export function commerceBlock(r: Recipe): CommerceModel | null {
  if (r.k !== 2 || r.path !== 'core' || !r.arche) return null;
  return BY[`${r.lv}:${r.arche}`] ?? null;
}
