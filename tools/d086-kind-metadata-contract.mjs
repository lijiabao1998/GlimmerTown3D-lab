// Independent metadata expectation for already-existing facility kinds.
import assert from'node:assert/strict';
const ADDITIONS=Object.freeze([[87,3,1.15],[87,4,1.35],[87,5,.95],[91,3,1.9],[91,4,1.35],[14,5,.9],[15,5,1.05],[7,5,.85],[6,5,1.25],[13,5,.85]]);
export function assertD086KindMetadata(actual,original){assert.equal(actual.length,original.length);for(let i=0;i<original.length;i++){const old=original[i],add=ADDITIONS.filter(([k])=>k===old.k),expected=structuredClone(old);if(add.length){expected.hv={...old.hv,1:{...old.hv[1],...Object.fromEntries(add.map(([,v,h])=>[v,h]))}};expected.variants={...old.variants,1:Math.max(old.variants[1]??0,...add.map(([,v])=>v+1))};}assert.deepEqual(actual[i],expected,'only declared new variant metadata '+old.k);}}
