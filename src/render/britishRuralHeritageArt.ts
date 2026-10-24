// Native owned Pen/Geo emission of the exact accepted D083 generator.
import {Pen} from './kindArt.ts';
import {RURAL_HERITAGE_BUILDINGS} from '../content/britishRuralHeritage.ts';
import {emitD083Prototype} from './d083AcceptedModels.mjs';
export function drawBritishRuralHeritage(p:Pen):boolean {
 if(typeof p.a.k!=='number'||!Number.isInteger(p.a.k)||p.a.v!==0)return false;
 const m=RURAL_HERITAGE_BUILDINGS.find(m=>m.k===p.a.k);if(!m)return false;
 // Asset y scale and native height are distinct only for the windmill.
 // At its native dimensions every vertex remains byte-identical to the
 // already accepted1.8-scale game mesh; no protected old kind height changes.
 const assetH=m.assetH;
 const emitter=typeof assetH==='number'?new Pen({...p.a,H:p.H===m.H?assetH:p.H/m.H*assetH}):p;
 emitD083Prototype(emitter,m.id);return true;
}
