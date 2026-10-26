// Exact D089 slots only; every old/unsupported slot retains its native recipe.
import { marketEstateSlot } from '../content/britishMarketEstates.ts';
import { emitBritishMarketEstate } from './britishMarketEstateModels.mjs';
import type { Pen } from './kindArt.ts';
export function drawBritishMarketEstate(p:Pen):boolean {
 const model=marketEstateSlot(p.a.k,p.a.v);
 if(!model)return false;
 emitBritishMarketEstate(p,model.id);
 return true;
}
