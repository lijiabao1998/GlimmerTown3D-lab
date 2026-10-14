// D060: exterior studies only. Existing kind 3, its three levels and the twelve archetypes are unchanged.
import type { Recipe } from './recipes.ts';

export type IndustryModel = 'goodsShed' | 'loftWorkshop' | 'northLight' | 'timberYard'
  | 'brickFactory' | 'cottonMill' | 'dockWarehouse' | 'boilerHouse'
  | 'engineWorks' | 'steamMill' | 'gasworks' | 'bottleKilns';
export const INDUSTRY_MODELS: readonly IndustryModel[] = ['goodsShed', 'loftWorkshop', 'northLight', 'timberYard',
  'brickFactory', 'cottonMill', 'dockWarehouse', 'boilerHouse', 'engineWorks', 'steamMill', 'gasworks', 'bottleKilns'];

// lab-arche.json `3_<lv>` rows, by level and archetype name.
const BY: Record<string, IndustryModel> = {
  '1:shed': 'goodsShed', '1:workshop': 'loftWorkshop', '1:sawShed': 'northLight', '1:yard': 'timberYard',
  '2:factory': 'brickFactory', '2:mill': 'cottonMill', '2:warehouse': 'dockWarehouse', '2:stack': 'boilerHouse',
  '3:heavy': 'engineWorks', '3:mill3': 'steamMill', '3:tankfarm': 'gasworks', '3:chimneyHall': 'bottleKilns',
};

export function industryBlock(r: Recipe): IndustryModel | null {
  if (r.k !== 3 || r.path !== 'core' || !r.arche) return null;
  return BY[`${r.lv}:${r.arche}`] ?? null;
}
