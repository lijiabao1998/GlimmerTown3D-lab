// New exact D087 slots only. Existing old157 dispatcher semantics stay unchanged.
import { workingRuralSlot } from '../content/britishWorkingRural.ts';
import { emitWorkingRuralDesign } from './britishWorkingRuralModels.mjs';
import type { Pen } from './kindArt.ts';
export function drawBritishWorkingRural(p:Pen):boolean {
 const model=workingRuralSlot(p.a.k,p.a.v);
 if(!model)return false;
 emitWorkingRuralDesign(p,model.id);
 return true;
}
