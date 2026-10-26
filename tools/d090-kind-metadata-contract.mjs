// Independent finite additions; validate every current field before removing any.
import assert from 'node:assert/strict';
export const D090_METADATA_ADDITIONS=Object.freeze([[10,5,1.6],[10,6,1.7],[27,3,1.05],[27,4,.65],[16,5,.9],[188,1,1.25],[190,1,.9],[192,1,1.2],[6,6,1.15],[14,7,.75]].map(Object.freeze));
export function appendD090Metadata(prior190){
 const expected=structuredClone(prior190);
 for(const[k,v,h]of D090_METADATA_ADDITIONS){
  const old=prior190.find(r=>r.k===k),row=expected.find(r=>r.k===k);
  assert.ok(old&&row,'required old kind '+k);assert.equal(old.hv[1]?.[v],undefined,'unoccupied slot '+k+':'+v);
  assert.ok((old.variants[1]??0)<=v,'append-only slot '+k+':'+v);
  row.hv={...row.hv,1:{...row.hv[1],[v]:h}};row.variants={...row.variants,1:Math.max(row.variants[1]??0,v+1)};
 }
 return expected;
}
export function checkedD090Predecessor(actual,prior190){
 assert.deepEqual(actual,appendD090Metadata(prior190),'every old190 field and exactly ten new heights/counts');
 const before=structuredClone(actual);
 for(const row of before){const added=D090_METADATA_ADDITIONS.filter(([k])=>k===row.k);if(!added.length)continue;const old=prior190.find(r=>r.k===row.k);for(const[,v]of added)delete row.hv[1][v];if(!Object.hasOwn(old.hv,'1'))delete row.hv[1];row.variants=structuredClone(old.variants);}
 assert.deepEqual(before,prior190,'only ten independently validated slots removed');return before;
}
export function assertD090KindMetadata(actual,prior190){checkedD090Predecessor(actual,prior190);return{oldRows:prior190.length,addedVariants:10};}
// Independently reconstruct all prior additions; never treat old original rows as190.
import {D087_METADATA_ADDITIONS} from './d087-kind-metadata-contract.mjs';
import {D088_METADATA_ADDITIONS} from './d088-kind-metadata-contract.mjs';
import {D089_METADATA_ADDITIONS,assertD089PreD086KindMetadata,checkedD089D086Predecessor} from './d089-kind-metadata-contract.mjs';
const D086_ADDITIONS=Object.freeze([[87,3,1.15],[87,4,1.35],[87,5,.95],[91,3,1.9],[91,4,1.35],[14,5,.9],[15,5,1.05],[7,5,.85],[6,5,1.25],[13,5,.85]].map(Object.freeze));
function appendPrior(original,additions){const result=structuredClone(original);for(const[k,v,h]of additions){const old=original.find(r=>r.k===k),row=result.find(r=>r.k===k);assert.ok(old&&row);assert.equal(old.hv[1]?.[v],undefined);assert.ok((old.variants[1]??0)<=v);row.hv={...row.hv,1:{...row.hv[1],[v]:h}};row.variants={...row.variants,1:Math.max(row.variants[1]??0,v+1)};}return result;}
export function assertD090PreD086KindMetadata(actual,originalBeforeD086){const prior190=[D086_ADDITIONS,D087_METADATA_ADDITIONS,D088_METADATA_ADDITIONS,D089_METADATA_ADDITIONS].reduce(appendPrior,originalBeforeD086);assertD089PreD086KindMetadata(prior190,originalBeforeD086);checkedD090Predecessor(actual,prior190);return{oldRows:prior190.length,addedVariants:10};}
export function checkedD090D086Predecessor(actual,prior157){const prior190=[D087_METADATA_ADDITIONS,D088_METADATA_ADDITIONS,D089_METADATA_ADDITIONS].reduce(appendPrior,prior157);return checkedD089D086Predecessor(checkedD090Predecessor(actual,prior190),prior157);}
