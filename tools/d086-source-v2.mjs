// Exact finite geometry-v2 lease, composing rather than rewriting the v1 proof.
// Actual runtime always uses current geometry; only historical readers rewind.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import * as prior from'./d086-source-v1.mjs';
export{D085_CHANGED,D084_CHANGED,D084_ADDED,D086_MODIFIED,D086_ADDED,D086_CURRENT_PATHS}from'./d086-source-v1.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const bytes=fs.readFileSync(new URL('../fixtures/d086/source-v2.json',import.meta.url),'utf8');
export const D086_V2_MANIFEST_SHA='a141bf3f1db33d93d9da56d4ce7a395a79c042c17ccb0f0ed67f190ecf57cd65';
assert.equal(sha(bytes),D086_V2_MANIFEST_SHA,'D086 immutable finite geometry-v2 lease');
const m=JSON.parse(bytes);assert.equal(m.schema,2);assert.equal(m.baseline,'4b0bbcdafaa3b3df615633c7eb2fa236242f07fc');
assert.deepEqual(m.changes.map(r=>r.file),['src/render/britishCivicMarketModels.mjs']);
for(const r of m.changes){assert.equal(sha(r.before),r.beforeSha256);assert.equal(r.beforeSha256,'bd588212b2c0cc61f91bc3dc234e3448869ffadddef9fd1d58fb64199b1925ab');}
export function d086V2PriorSource(file,text){const r=m.changes.find(r=>r.file===file);if(!r)return text;assert.equal(typeof text,'string',file+' exact allowed source: actual v2 required');assert.equal(sha(text),r.afterSha256,file+' exact allowed source: exact v2 geometry');return r.before;}
export const d086PriorSource=(file,text)=>prior.d086PriorSource(file,d086V2PriorSource(file,text));
export const d085PriorSource=(file,text)=>prior.d085PriorSource(file,d086V2PriorSource(file,text));
export const d084PriorSource=(file,text)=>prior.d084PriorSource(file,d086V2PriorSource(file,text));
export const d086PriorInventory=(files,read)=>prior.d086PriorInventory(files,f=>d086V2PriorSource(f,read(f)));
export const d084PriorInventory=(files,read)=>prior.d084PriorInventory(files,f=>d086V2PriorSource(f,read(f)));
