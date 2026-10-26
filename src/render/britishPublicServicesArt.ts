// Exact D088 slots only; historical shape calls retain their previous recipes.
import { publicServiceSlot } from '../content/britishPublicServices.ts';
import { emitPublicServiceDesign } from './britishPublicServicesModels.mjs';
import type { Pen } from './kindArt.ts';
export function drawBritishPublicServices(p:Pen):boolean {
 const model=publicServiceSlot(p.a.k,p.a.v);
 if(!model)return false;
 emitPublicServiceDesign(p,model.id);
 return true;
}
