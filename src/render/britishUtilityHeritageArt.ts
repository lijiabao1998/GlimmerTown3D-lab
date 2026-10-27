// Exact D090 slots only; old and unknown variants retain their prior dispatch.
import { utilityHeritageSlot } from '../content/britishUtilityHeritage.ts';
import { emitBritishUtilityHeritage } from './britishUtilityHeritageModels.mjs';
import type { Pen } from './kindArt.ts';
export function drawBritishUtilityHeritage(p:Pen):boolean {
 const model=utilityHeritageSlot(p.a.k,p.a.v);
 if(!model)return false;
 emitBritishUtilityHeritage(p,model.id);
 return true;
}
