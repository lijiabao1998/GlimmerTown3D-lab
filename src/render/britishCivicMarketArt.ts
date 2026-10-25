// Exact explicit new slots only; all old kind/variant dispatch is unchanged.
import { civicMarketSlot } from '../content/britishCivicMarkets.ts';
import { emitCivicMarketDesign } from './britishCivicMarketModels.mjs';
import type { Pen } from './kindArt.ts';
export function drawBritishCivicMarket(p:Pen):boolean {
 const model=civicMarketSlot(p.a.k,p.a.v);
 if(!model)return false;
 emitCivicMarketDesign(p,model.id);
 return true;
}
