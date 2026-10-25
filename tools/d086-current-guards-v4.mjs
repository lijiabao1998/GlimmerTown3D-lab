// Compose, never edit, every V1/V2 guard and its exact assertion bytes.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{assertD086CurrentGuardVersionsV3,d086GuardRoute as priorRoute}from'./d086-current-guards-v3.mjs';
export const D086_V4_GUARDS_SHA='85e4b2f050aafd02efefa83b0ce43aaa13e7225ff9838f056489ba5a6d9b45f6';
const sha=b=>createHash('sha256').update(b).digest('hex'),pairs=[["tools/d086-source-v3.test.mjs","tools/d086-source-v4.test.mjs","a124242ae1b799c2da94b0ead4a55f78d0782c629c1b89a85b8181d750cf5a67"],["tools/d085-source-d086-v3.test.mjs","tools/d085-source-d086-v4.test.mjs","a198dc6b59ec392d0e631f7caa99176f5b1e975fb5127dda82b5dbd834c75c69"]];
export function assertD086V4GuardCopies(bytes,read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8')){
 assert.equal(sha(bytes),D086_V4_GUARDS_SHA,'exact V4 import-only guard manifest');const m=JSON.parse(bytes);assert.deepEqual(Object.keys(m),['schema','baseline','reason','copies']);assert.equal(m.schema,4);assert.equal(m.baseline,'cc8280f30e7b4115c6ffff2df27ca6ca7aa0baba');assert.deepEqual(m.copies.map(r=>[r.source,r.target,r.sourceSha256]),pairs);
 for(const r of m.copies){assert.deepEqual(Object.keys(r),['source','target','sourceSha256','targetSha256','before','after']);assert.equal(r.before,"'./d086-source-v3.mjs'");assert.equal(r.after,"'./d086-source-v4.mjs'");const before=read(r.source);assert.equal(sha(before),r.sourceSha256,r.source+' immutable original assertions');assert.equal(before.split(r.before).length,2);const after=read(r.target);assert.equal(after,before.replace(r.before,r.after),r.target+' import seam only, no assertion edits');assert.equal(sha(after),r.targetSha256);}
 return m.copies.length;
}
export function assertD086CurrentGuardVersionsV4(){const prior=assertD086CurrentGuardVersionsV3(),current=assertD086V4GuardCopies(fs.readFileSync(new URL('../fixtures/d086/current-guard-versions-v4.json',import.meta.url),'utf8'));return{prior,current};}
export function d086GuardRoute(file){assertD086CurrentGuardVersionsV4();return priorRoute(file);}
