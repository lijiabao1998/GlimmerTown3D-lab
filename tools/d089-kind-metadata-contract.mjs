// Independent finite additions; validate every current field before removing any.
import assert from 'node:assert/strict';
export const D089_METADATA_ADDITIONS=Object.freeze([[87,6,1.05],[87,7,.8],[87,8,.65],[91,5,1.4],[91,6,1.15],[57,6,1.6],[57,7,.95],[57,8,1],[22,17,.8],[53,4,1.35],[63,6,.6]].map(Object.freeze));
export function appendD089Metadata(prior179){
 const expected=structuredClone(prior179);
 for(const[k,v,h]of D089_METADATA_ADDITIONS){
  const old=prior179.find(r=>r.k===k),row=expected.find(r=>r.k===k);
  assert.ok(old&&row,'required old kind '+k);assert.equal(old.hv[1]?.[v],undefined,'unoccupied slot '+k+':'+v);
  assert.ok((old.variants[1]??0)<=v,'append-only slot '+k+':'+v);
  row.hv={...row.hv,1:{...row.hv[1],[v]:h}};row.variants={...row.variants,1:Math.max(row.variants[1]??0,v+1)};
 }
 return expected;
}
export function checkedD089Predecessor(actual,prior179){
 assert.deepEqual(actual,appendD089Metadata(prior179),'every old179 field and exactly eleven new heights/counts');
 const before=structuredClone(actual);
 for(const row of before){const added=D089_METADATA_ADDITIONS.filter(([k])=>k===row.k);if(!added.length)continue;const old=prior179.find(r=>r.k===row.k);for(const[,v]of added)delete row.hv[1][v];if(!Object.hasOwn(old.hv,'1'))delete row.hv[1];row.variants=structuredClone(old.variants);}
 assert.deepEqual(before,prior179,'only eleven independently validated slots removed');return before;
}
export function assertD089KindMetadata(actual,prior179){checkedD089Predecessor(actual,prior179);return{oldRows:prior179.length,addedVariants:11};}
// Finite chain for original D083 and D086 callers. Their second arguments remain
// their original pre-D086 / post-D086 rows, never relabelled as prior179.
import {D087_METADATA_ADDITIONS} from './d087-kind-metadata-contract.mjs';
import {D088_METADATA_ADDITIONS,assertD088KindMetadata,checkedD088D086Predecessor} from './d088-kind-metadata-contract.mjs';
const D086_ADDITIONS=Object.freeze([[87,3,1.15],[87,4,1.35],[87,5,.95],[91,3,1.9],[91,4,1.35],[14,5,.9],[15,5,1.05],[7,5,.85],[6,5,1.25],[13,5,.85]].map(Object.freeze));
function appendPrior(original,additions){const result=structuredClone(original);for(const[k,v,h]of additions){const old=original.find(r=>r.k===k),row=result.find(r=>r.k===k);assert.ok(old&&row);assert.equal(old.hv[1]?.[v],undefined);assert.ok((old.variants[1]??0)<=v);row.hv={...row.hv,1:{...row.hv[1],[v]:h}};row.variants={...row.variants,1:Math.max(row.variants[1]??0,v+1)};}return result;}
export function assertD089PreD086KindMetadata(actual,originalBeforeD086){const prior179=appendPrior(appendPrior(appendPrior(originalBeforeD086,D086_ADDITIONS),D087_METADATA_ADDITIONS),D088_METADATA_ADDITIONS);assertD088KindMetadata(prior179,originalBeforeD086);checkedD089Predecessor(actual,prior179);return{oldRows:prior179.length,addedVariants:11};}
export function checkedD089D086Predecessor(actual,prior157){const prior179=appendPrior(appendPrior(prior157,D087_METADATA_ADDITIONS),D088_METADATA_ADDITIONS);return checkedD088D086Predecessor(checkedD089Predecessor(actual,prior179),prior157);}
