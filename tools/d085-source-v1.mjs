// D085 outer exact source contract. Runtime remains the real product, never these preimages.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import {D084_CHANGED,D084_ADDED,d084PriorSource as oldSource,d084PriorInventory as oldInventory} from './d084-source-v2.mjs';
export {D084_CHANGED,D084_ADDED};
const sha=x=>createHash('sha256').update(x).digest('hex');
const bytes=fs.readFileSync(new URL('../fixtures/d085-source-v1.json',import.meta.url),'utf8');
assert.equal(sha(bytes),'1cd7aa5233df86e17a6d8395454026b9a3ed02d7a53285ec3c2cf84d91ae58b0','immutable finite D085 manifest');
const m=JSON.parse(bytes);assert.equal(m.baseline,'1e7b43e96097969fac33b57c37fe02444cefb15c');
export const D085_CHANGED=Object.freeze(['src/cityView.ts','src/render/preview.ts']);
assert.deepEqual(Object.keys(m.modified),D085_CHANGED);
for(const r of Object.values(m.modified))assert.equal(sha(r.before),r.beforeSha256);
export function d085PriorSource(file,text){
 if(!D085_CHANGED.includes(file))return text;
 assert.equal(typeof text,'string',file+' exact allowed source: actual D085 source required');
 assert.equal(sha(text),m.modified[file].afterSha256,file+' exact allowed source: D085 bytes');
 return m.modified[file].before;
}
export function d084PriorSource(file,text){return oldSource(file,d085PriorSource(file,text));}
export function d084PriorInventory(files,read){
 assert.equal(new Set(files).size,files.length,'D085 duplicate inventory rejected');
 for(const f of D085_CHANGED){assert.ok(files.includes(f),f+' required');d085PriorSource(f,read(f));}
 return oldInventory(files,f=>d085PriorSource(f,read(f)));
}
