// Compose, never edit, every V1/V2 guard and its exact assertion bytes.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{assertD086CurrentGuardVersionsV2,d086GuardRoute as priorRoute}from'./d086-current-guards-v2.mjs';
export const D086_V3_GUARDS_SHA='b13a0312c50dc7e55af05bd7f965b5e953c6396da2737882151f5335b39875be';
const sha=b=>createHash('sha256').update(b).digest('hex'),pairs=[['tools/d086-source-v2.test.mjs','tools/d086-source-v3.test.mjs','8e55e0802efc3d7094151625dffed66c6c63dc55dbd48b830894371bf16a0db6'],['tools/d085-source-d086-v2.test.mjs','tools/d085-source-d086-v3.test.mjs','55169ffcfe1e9fc09b5200ed34e4ee1da8392f081e94854275cd61f6f7784ff6']];
export function assertD086V3GuardCopies(bytes,read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8')){
 assert.equal(sha(bytes),D086_V3_GUARDS_SHA,'exact V3 import-only guard manifest');const m=JSON.parse(bytes);assert.deepEqual(Object.keys(m),['schema','baseline','reason','copies']);assert.equal(m.schema,3);assert.equal(m.baseline,'207404e1479593cd748b6e71bbe9c2d7e3c1042a');assert.deepEqual(m.copies.map(r=>[r.source,r.target,r.sourceSha256]),pairs);
 for(const r of m.copies){assert.deepEqual(Object.keys(r),['source','target','sourceSha256','targetSha256','before','after']);assert.equal(r.before,"'./d086-source-v2.mjs'");assert.equal(r.after,"'./d086-source-v3.mjs'");const before=read(r.source);assert.equal(sha(before),r.sourceSha256,r.source+' immutable original assertions');assert.equal(before.split(r.before).length,2);const after=read(r.target);assert.equal(after,before.replace(r.before,r.after),r.target+' import seam only, no assertion edits');assert.equal(sha(after),r.targetSha256);}
 return m.copies.length;
}
export function assertD086CurrentGuardVersionsV3(){const prior=assertD086CurrentGuardVersionsV2(),current=assertD086V3GuardCopies(fs.readFileSync(new URL('../fixtures/d086/current-guard-versions-v3.json',import.meta.url),'utf8'));return{prior,current};}
export function d086GuardRoute(file){assertD086CurrentGuardVersionsV3();return priorRoute(file);}
