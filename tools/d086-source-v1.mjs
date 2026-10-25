// D086 exact current-source lease. Only historical source readers receive preimages;
// runtime, model emission and browser builds always use actual current source.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{D084_CHANGED as INNER_CHANGED,D084_ADDED as INNER_ADDED,D085_CHANGED,d084PriorSource as innerSource,d084PriorInventory as innerInventory,d085PriorSource as innerD085}from'./d085-source-v1.mjs';
export{D085_CHANGED};
const sha=x=>createHash('sha256').update(x).digest('hex');
const bytes=fs.readFileSync(new URL('../fixtures/d086/source-v1.json',import.meta.url),'utf8');
export const D086_MANIFEST_SHA='42f02c45256e167a65aa19cd13dd666975343d1e166e0bd8b58e9bd0fecb4546';
assert.equal(sha(bytes),D086_MANIFEST_SHA,'D086 immutable finite source lease');
const m=JSON.parse(bytes);assert.equal(m.baseline,'77b8616382f6115711b2b8eb39735a769b859cde');
export const D086_MODIFIED=Object.freeze(['src/cityView.ts','src/content/kindShapes.ts','src/content/kinds.ts','src/render/kindArt.ts','src/sim/edit.ts','src/ui/growthGuide.ts']);
export const D086_ADDED=Object.freeze(['src/content/britishCivicMarkets.ts','src/render/britishCivicMarketArt.ts','src/render/britishCivicMarketModels.d.mts','src/render/britishCivicMarketModels.mjs','src/sim/nativeArtVariant.ts']);
assert.deepEqual(Object.keys(m.modified),D086_MODIFIED);assert.deepEqual(Object.keys(m.added),D086_ADDED);
for(const r of Object.values(m.modified))assert.equal(sha(r.before),r.beforeSha256);
export const D086_CURRENT_PATHS=Object.freeze(m.currentFiles);
export const D084_CHANGED=Object.freeze([...new Set([...INNER_CHANGED,...D086_MODIFIED,...D086_ADDED])]);
export const D084_ADDED=Object.freeze([...INNER_ADDED,...D086_ADDED]);
export function d086PriorSource(file,text){
 if(!D086_MODIFIED.includes(file)&&!D086_ADDED.includes(file))return text;
 assert.equal(typeof text,'string',file+' exact allowed source: actual D086 source required');
 assert.equal(sha(text),m.modified[file]?.afterSha256??m.added[file],file+' exact allowed source: D086 bytes');
 return m.modified[file]?.before??'';
}
export function d086PriorInventory(files,read){
 assert.equal(new Set(files).size,files.length,'D086 duplicate inventory rejected');
 assert.deepEqual([...files].sort(),D086_CURRENT_PATHS,'D086 exact current inventory');
 for(const f of [...D086_MODIFIED,...D086_ADDED])d086PriorSource(f,read(f));
 const prior=files.filter(f=>!D086_ADDED.includes(f));assert.deepEqual([...prior].sort(),m.baselineFiles);return prior;
}
export const d085PriorSource=(file,text)=>innerD085(file,d086PriorSource(file,text));
export const d084PriorSource=(file,text)=>innerSource(file,d086PriorSource(file,text));
export function d084PriorInventory(files,read){return innerInventory(d086PriorInventory(files,read),f=>d086PriorSource(f,read(f)));}
